/**
 * Attendance Controller
 *
 * Employee actions: check-in, check-out, break, leave, correction, on-duty
 * Manager actions: team view, leave/correction approvals, flags, summary
 * Admin actions:   all records, override, settings, holidays, audit log, report
 * Client actions:  project timesheets (billing-safe, no HR data)
 */

import { query, getClient } from '../services/db.js';
import {
    getActiveSettings,
    isHoliday,
    isWeekend,
    countWorkingDays,
    calculateWorkHours,
    deriveAttendanceStatus,
    canManagerApprove,
    getRecordForDate,
    hasOverlappingLeave,
    syncClientTimesheet,
    writeAuditLog,
    refreshReportCache,
} from '../services/attendance.js';
import {
    checkInSchema,
    checkOutSchema,
    breakSchema,
    leaveSchema,
    correctionSchema,
    onDutySchema,
    approvalSchema,
    flagSchema,
    resolveFlagSchema,
    adminOverrideSchema,
    settingsSchema,
    holidaySchema,
    reportQuerySchema,
    timesheetQuerySchema,
} from '../validators/attendance.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function getIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        null
    );
}

function getUserAgent(req) {
    return req.headers['user-agent'] || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/attendance/check-in ───────────────────────────────────────────

export async function checkIn(req, res) {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { work_mode, location } = parsed.data;
    const checkInTime = parsed.data.check_in ? new Date(parsed.data.check_in) : new Date();
    const dateStr = checkInTime.toISOString().slice(0, 10);
    const employeeId = req.user.user_id;

    const settings = await getActiveSettings();

    // Guard: no future check-ins
    if (checkInTime > new Date(Date.now() + 5 * 60 * 1000)) {
        return res.status(400).json({ error: 'Check-in time cannot be in the future' });
    }

    // Guard: holiday / weekend
    if (await isHoliday(dateStr)) {
        return res.status(422).json({ error: 'Cannot check in on a company holiday' });
    }
    if (isWeekend(checkInTime, settings)) {
        return res.status(422).json({ error: 'Cannot check in on a weekend' });
    }

    // Guard: duplicate check-in
    const existing = await getRecordForDate(employeeId, dateStr);
    if (existing) {
        return res.status(409).json({ error: 'Already checked in today', record_id: existing.id });
    }

    // WFH approval guard
    if (work_mode === 'wfh' && settings.wfh_requires_approval) {
        // Check for an approved WFH leave for today
        const wfhApproved = await query(
            `SELECT 1 FROM attendance_leaves
             WHERE employee_id = $1
               AND leave_type = 'work_from_home'
               AND status = 'approved'
               AND start_date <= $2
               AND end_date >= $2
             LIMIT 1`,
            [employeeId, dateStr],
        );
        if (wfhApproved.rows.length === 0) {
            return res.status(403).json({
                error: 'WFH requires prior manager approval. Please submit a WFH leave request first.',
            });
        }
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const result = await dbClient.query(
            `INSERT INTO attendance_records
               (employee_id, date, status, check_in, work_mode, check_in_location)
             VALUES ($1, $2, 'present', $3, $4, $5)
             RETURNING *`,
            [employeeId, dateStr, checkInTime, work_mode, location ? JSON.stringify(location) : null],
        );
        const record = result.rows[0];

        await writeAuditLog(dbClient, {
            action: 'check_in',
            actor_id: employeeId,
            actor_role: req.user.role,
            target_record_id: record.id,
            target_employee_id: employeeId,
            after_state: { check_in: checkInTime, work_mode, date: dateStr },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.status(201).json({ message: 'Check-in recorded', record });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── PATCH /api/attendance/check-out ─────────────────────────────────────────

export async function checkOut(req, res) {
    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const checkOutTime = parsed.data.check_out ? new Date(parsed.data.check_out) : new Date();
    const dateStr = checkOutTime.toISOString().slice(0, 10);
    const employeeId = req.user.user_id;

    const record = await getRecordForDate(employeeId, dateStr);
    if (!record) {
        return res.status(404).json({ error: 'No check-in found for today' });
    }
    if (!record.check_in) {
        return res.status(400).json({ error: 'Cannot check out without a check-in' });
    }
    if (record.check_out) {
        return res.status(409).json({ error: 'Already checked out today' });
    }
    if (record.is_finalized) {
        return res.status(403).json({ error: 'Record is finalized — submit a correction request' });
    }
    if (checkOutTime <= new Date(record.check_in)) {
        return res.status(400).json({ error: 'Check-out time must be after check-in time' });
    }

    const settings = await getActiveSettings();

    // Load breaks for this record
    const breaksResult = await query(
        `SELECT break_start, break_end FROM attendance_breaks WHERE record_id = $1`,
        [record.id],
    );

    const { total_minutes, break_minutes, net_work_minutes, is_late, late_minutes, overtime_minutes } =
        calculateWorkHours(record.check_in, checkOutTime, breaksResult.rows, settings);

    const status = deriveAttendanceStatus(net_work_minutes, settings);

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const updated = await dbClient.query(
            `UPDATE attendance_records SET
               check_out = $1,
               total_minutes = $2,
               break_minutes = $3,
               net_work_minutes = $4,
               is_late = $5,
               late_minutes = $6,
               overtime_minutes = $7,
               status = $8,
               notes = COALESCE($9, notes),
               updated_at = now()
             WHERE id = $10
             RETURNING *`,
            [
                checkOutTime, total_minutes, break_minutes, net_work_minutes,
                is_late, late_minutes, overtime_minutes, status,
                parsed.data.notes || null, record.id,
            ],
        );
        const updatedRecord = updated.rows[0];

        // Sync client timesheets
        await syncClientTimesheet(dbClient, employeeId, dateStr, net_work_minutes, record.work_mode);

        // Auto-raise missing_checkout flag if previous day still open
        // (handled: checkout was called, so this day is now closed)

        await writeAuditLog(dbClient, {
            action: 'check_out',
            actor_id: employeeId,
            actor_role: req.user.role,
            target_record_id: record.id,
            target_employee_id: employeeId,
            before_state: { check_out: null },
            after_state: { check_out: checkOutTime, net_work_minutes, status },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');

        // Refresh report cache async (non-blocking)
        const year = checkOutTime.getFullYear();
        const month = checkOutTime.getMonth() + 1;
        refreshReportCache(employeeId, year, month).catch((e) =>
            console.error('[ATTENDANCE] Cache refresh failed:', e.message),
        );

        return res.json({ message: 'Check-out recorded', record: updatedRecord });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── POST /api/attendance/breaks ─────────────────────────────────────────────

export async function addBreak(req, res) {
    const parsed = breakSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { break_start, break_end } = parsed.data;
    const dateStr = new Date(break_start).toISOString().slice(0, 10);
    const employeeId = req.user.user_id;

    const record = await getRecordForDate(employeeId, dateStr);
    if (!record) {
        return res.status(404).json({ error: 'No attendance record found for this date' });
    }
    if (record.check_out) {
        return res.status(400).json({ error: 'Cannot add break after check-out' });
    }
    if (record.is_finalized) {
        return res.status(403).json({ error: 'Record is finalized' });
    }

    const duration_minutes =
        break_end
            ? Math.max(0, Math.floor((new Date(break_end) - new Date(break_start)) / 60000))
            : null;

    const result = await query(
        `INSERT INTO attendance_breaks (record_id, break_start, break_end, duration_minutes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [record.id, break_start, break_end || null, duration_minutes],
    );

    return res.status(201).json({ message: 'Break recorded', break: result.rows[0] });
}

// ─── GET /api/attendance/my ───────────────────────────────────────────────────

export async function getMyAttendance(req, res) {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
    }

    const { start_date, end_date, status, limit, offset } = parsed.data;
    const employeeId = req.user.user_id;

    const values = [employeeId, start_date, end_date];
    let whereClauses = `WHERE employee_id = $1 AND date BETWEEN $2 AND $3`;

    if (status) {
        values.push(status);
        whereClauses += ` AND status = $${values.length}`;
    }

    values.push(limit, offset);
    const result = await query(
        `SELECT ar.*,
                (SELECT COUNT(*) FROM attendance_breaks ab WHERE ab.record_id = ar.id) AS break_count
         FROM attendance_records ar
         ${whereClauses}
         ORDER BY date DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    const countResult = await query(
        `SELECT COUNT(*) AS total FROM attendance_records ${whereClauses.replace(` LIMIT $${values.length - 1} OFFSET $${values.length}`, '')}`,
        values.slice(0, -2),
    );

    return res.json({
        records: result.rows,
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset,
    });
}

// ─── POST /api/attendance/leaves ──────────────────────────────────────────────

export async function applyLeave(req, res) {
    const parsed = leaveSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { leave_type, start_date, end_date, reason } = parsed.data;
    const employeeId = req.user.user_id;
    const settings = await getActiveSettings();

    // Guard: past dates (employees can't backdate leave more than 7 days)
    if (new Date(start_date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        return res.status(400).json({ error: 'Cannot apply leave for dates more than 7 days in the past' });
    }

    // Guard: overlap check
    if (await hasOverlappingLeave(employeeId, start_date, end_date)) {
        return res.status(409).json({ error: 'You already have a pending or approved leave in this date range' });
    }

    const days_count = await countWorkingDays(start_date, end_date, settings);
    if (days_count === 0) {
        return res.status(422).json({ error: 'No working days found in the selected date range' });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const result = await dbClient.query(
            `INSERT INTO attendance_leaves
               (employee_id, leave_type, start_date, end_date, days_count, reason, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING *`,
            [employeeId, leave_type, start_date, end_date, days_count, reason],
        );
        const leave = result.rows[0];

        await writeAuditLog(dbClient, {
            action: 'leave_applied',
            actor_id: employeeId,
            actor_role: req.user.role,
            target_employee_id: employeeId,
            target_leave_id: leave.id,
            after_state: { leave_type, start_date, end_date, days_count, reason },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.status(201).json({ message: 'Leave application submitted', leave });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── PATCH /api/attendance/leaves/:id/cancel ─────────────────────────────────

export async function cancelLeave(req, res) {
    const { id } = req.params;
    const employeeId = req.user.user_id;

    const leaveResult = await query(
        `SELECT * FROM attendance_leaves WHERE id = $1 AND employee_id = $2`,
        [id, employeeId],
    );
    if (leaveResult.rows.length === 0) {
        return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];
    if (leave.status !== 'pending') {
        return res.status(409).json({ error: `Cannot cancel a leave that is already ${leave.status}` });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query(
            `UPDATE attendance_leaves SET status = 'cancelled' WHERE id = $1`,
            [id],
        );

        await writeAuditLog(dbClient, {
            action: 'leave_cancelled',
            actor_id: employeeId,
            actor_role: req.user.role,
            target_employee_id: employeeId,
            target_leave_id: leave.id,
            before_state: { status: 'pending' },
            after_state: { status: 'cancelled' },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.json({ message: 'Leave cancelled' });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── GET /api/attendance/my/leaves ───────────────────────────────────────────

export async function getMyLeaves(req, res) {
    const employeeId = req.user.user_id;
    const { status, limit = '20', offset = '0' } = req.query;

    const values = [employeeId];
    let where = `WHERE employee_id = $1`;

    if (status) {
        values.push(status);
        where += ` AND status = $${values.length}`;
    }

    values.push(parseInt(limit), parseInt(offset));
    const result = await query(
        `SELECT al.*, u.name AS reviewer_name
         FROM attendance_leaves al
         LEFT JOIN users u ON u.id = al.reviewed_by
         ${where}
         ORDER BY submitted_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ leaves: result.rows });
}

// ─── POST /api/attendance/corrections ────────────────────────────────────────

export async function submitCorrection(req, res) {
    const parsed = correctionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { record_id, requested_check_in, requested_check_out, requested_status, reason } = parsed.data;
    const employeeId = req.user.user_id;

    // Verify record belongs to employee
    const recordResult = await query(
        `SELECT * FROM attendance_records WHERE id = $1 AND employee_id = $2`,
        [record_id, employeeId],
    );
    if (recordResult.rows.length === 0) {
        return res.status(404).json({ error: 'Attendance record not found' });
    }

    const record = recordResult.rows[0];
    if (record.is_finalized) {
        return res.status(403).json({ error: 'Record is finalized — contact admin for overrides' });
    }

    // Check for existing pending correction
    const existingCorrection = await query(
        `SELECT 1 FROM attendance_corrections
         WHERE record_id = $1 AND status = 'pending' LIMIT 1`,
        [record_id],
    );
    if (existingCorrection.rows.length > 0) {
        return res.status(409).json({ error: 'A correction request is already pending for this record' });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const result = await dbClient.query(
            `INSERT INTO attendance_corrections
               (record_id, employee_id, requested_check_in, requested_check_out,
                requested_status, reason,
                original_check_in, original_check_out, original_status, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
             RETURNING *`,
            [
                record_id, employeeId,
                requested_check_in || null, requested_check_out || null, requested_status || null,
                reason,
                record.check_in, record.check_out, record.status,
            ],
        );
        const correction = result.rows[0];

        await writeAuditLog(dbClient, {
            action: 'correction_submitted',
            actor_id: employeeId,
            actor_role: req.user.role,
            target_record_id: record_id,
            target_employee_id: employeeId,
            target_correction_id: correction.id,
            after_state: { requested_check_in, requested_check_out, requested_status, reason },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.status(201).json({ message: 'Correction request submitted', correction });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── POST /api/attendance/on-duty ────────────────────────────────────────────

export async function submitOnDuty(req, res) {
    const parsed = onDutySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { date, location, purpose } = parsed.data;
    const employeeId = req.user.user_id;

    const result = await query(
        `INSERT INTO attendance_on_duty (employee_id, date, location, purpose, status)
         VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
        [employeeId, date, location, purpose],
    );

    return res.status(201).json({ message: 'On-duty request submitted', on_duty: result.rows[0] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/attendance/team ─────────────────────────────────────────────────

export async function getTeamAttendance(req, res) {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
    }

    const { start_date, end_date, employee_id, status, limit, offset } = parsed.data;
    const managerId = req.user.user_id;

    const values = [managerId, start_date, end_date];
    let where = `WHERE u.manager_id = $1 AND ar.date BETWEEN $2 AND $3`;

    if (employee_id) {
        values.push(employee_id);
        where += ` AND ar.employee_id = $${values.length}`;
    }
    if (status) {
        values.push(status);
        where += ` AND ar.status = $${values.length}`;
    }

    values.push(limit, offset);
    const result = await query(
        `SELECT ar.*, u.name AS employee_name, u.email AS employee_email
         FROM attendance_records ar
         JOIN users u ON u.id = ar.employee_id
         ${where}
         ORDER BY ar.date DESC, u.name ASC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ records: result.rows, limit, offset });
}

// ─── GET /api/attendance/team/leaves ─────────────────────────────────────────

export async function getTeamLeaves(req, res) {
    const managerId = req.user.user_id;
    const { status = 'pending', limit = '50', offset = '0' } = req.query;

    const values = [managerId];
    let where = `WHERE u.manager_id = $1`;

    if (status && status !== 'all') {
        values.push(status);
        where += ` AND al.status = $${values.length}`;
    }

    values.push(parseInt(limit), parseInt(offset));
    const result = await query(
        `SELECT al.*, u.name AS employee_name, u.email AS employee_email
         FROM attendance_leaves al
         JOIN users u ON u.id = al.employee_id
         ${where}
         ORDER BY al.submitted_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ leaves: result.rows });
}

// ─── PATCH /api/attendance/leaves/:id/approve ─────────────────────────────────

export async function approveLeave(req, res) {
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { id } = req.params;
    const { status, remarks } = parsed.data;
    const reviewerId = req.user.user_id;
    const reviewerRole = req.user.role;

    const leaveResult = await query(
        `SELECT al.*, u.manager_id
         FROM attendance_leaves al
         JOIN users u ON u.id = al.employee_id
         WHERE al.id = $1`,
        [id],
    );
    if (leaveResult.rows.length === 0) {
        return res.status(404).json({ error: 'Leave request not found' });
    }

    const leave = leaveResult.rows[0];

    // Manager can only approve their direct reports
    if (reviewerRole === 'manager' && leave.manager_id !== reviewerId) {
        return res.status(403).json({ error: 'This employee is not in your team' });
    }

    if (leave.status !== 'pending') {
        return res.status(409).json({ error: `Leave is already ${leave.status}` });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query(
            `UPDATE attendance_leaves
             SET status = $1, reviewed_by = $2, reviewed_at = now(), remarks = $3
             WHERE id = $4`,
            [status, reviewerId, remarks || null, id],
        );

        // If approved, create/update attendance records for the leave days
        if (status === 'approved') {
            await dbClient.query(
                `INSERT INTO attendance_records (employee_id, date, status)
                 SELECT $1, d::date, 'on_leave'
                 FROM generate_series($2::date, $3::date, '1 day'::interval) d
                 ON CONFLICT (employee_id, date) DO UPDATE SET status = 'on_leave', updated_at = now()`,
                [leave.employee_id, leave.start_date, leave.end_date],
            );
        }

        const auditAction = status === 'approved' ? 'leave_approved' : 'leave_rejected';
        await writeAuditLog(dbClient, {
            action: auditAction,
            actor_id: reviewerId,
            actor_role: reviewerRole,
            target_employee_id: leave.employee_id,
            target_leave_id: leave.id,
            before_state: { status: 'pending' },
            after_state: { status, remarks },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.json({ message: `Leave ${status}`, leave_id: id });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── GET /api/attendance/team/corrections ────────────────────────────────────

export async function getTeamCorrections(req, res) {
    const managerId = req.user.user_id;
    const { status = 'pending', limit = '50', offset = '0' } = req.query;

    const values = [managerId];
    let where = `WHERE u.manager_id = $1`;

    if (status && status !== 'all') {
        values.push(status);
        where += ` AND ac.status = $${values.length}`;
    }

    values.push(parseInt(limit), parseInt(offset));
    const result = await query(
        `SELECT ac.*, u.name AS employee_name, u.email AS employee_email
         FROM attendance_corrections ac
         JOIN users u ON u.id = ac.employee_id
         ${where}
         ORDER BY ac.submitted_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ corrections: result.rows });
}

// ─── PATCH /api/attendance/corrections/:id/approve ───────────────────────────

export async function approveCorrection(req, res) {
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { id } = req.params;
    const { status, remarks } = parsed.data;
    const reviewerId = req.user.user_id;
    const reviewerRole = req.user.role;

    const corrResult = await query(
        `SELECT ac.*, u.manager_id, ar.is_finalized
         FROM attendance_corrections ac
         JOIN users u ON u.id = ac.employee_id
         JOIN attendance_records ar ON ar.id = ac.record_id
         WHERE ac.id = $1`,
        [id],
    );
    if (corrResult.rows.length === 0) {
        return res.status(404).json({ error: 'Correction request not found' });
    }

    const correction = corrResult.rows[0];

    if (reviewerRole === 'manager' && correction.manager_id !== reviewerId) {
        return res.status(403).json({ error: 'This employee is not in your team' });
    }
    if (correction.status !== 'pending') {
        return res.status(409).json({ error: `Correction is already ${correction.status}` });
    }
    if (correction.is_finalized) {
        return res.status(403).json({ error: 'Record is finalized — only admin can override' });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query(
            `UPDATE attendance_corrections
             SET status = $1, reviewed_by = $2, reviewed_at = now(), reviewer_remarks = $3
             WHERE id = $4`,
            [status, reviewerId, remarks || null, id],
        );

        if (status === 'approved') {
            // Apply the correction to the underlying record
            const settings = await getActiveSettings();
            const newCheckIn = correction.requested_check_in || correction.original_check_in;
            const newCheckOut = correction.requested_check_out || correction.original_check_out;

            let updates = [];
            const vals = [];
            let idx = 1;

            if (correction.requested_check_in) {
                updates.push(`check_in = $${idx++}`);
                vals.push(correction.requested_check_in);
            }
            if (correction.requested_check_out) {
                updates.push(`check_out = $${idx++}`);
                vals.push(correction.requested_check_out);
            }
            if (correction.requested_status) {
                updates.push(`status = $${idx++}`);
                vals.push(correction.requested_status);
            }

            // Recalculate work hours if both timestamps are available
            if (newCheckIn && newCheckOut) {
                const breaksResult = await dbClient.query(
                    `SELECT break_start, break_end FROM attendance_breaks WHERE record_id = $1`,
                    [correction.record_id],
                );
                const { total_minutes, break_minutes, net_work_minutes, is_late, late_minutes, overtime_minutes } =
                    calculateWorkHours(newCheckIn, newCheckOut, breaksResult.rows, settings);

                updates.push(
                    `total_minutes = $${idx++}`,
                    `break_minutes = $${idx++}`,
                    `net_work_minutes = $${idx++}`,
                    `is_late = $${idx++}`,
                    `late_minutes = $${idx++}`,
                    `overtime_minutes = $${idx++}`,
                );
                vals.push(total_minutes, break_minutes, net_work_minutes, is_late, late_minutes, overtime_minutes);

                // Sync client timesheets
                const dateStr = new Date(newCheckIn).toISOString().slice(0, 10);
                await syncClientTimesheet(
                    dbClient, correction.employee_id, dateStr, net_work_minutes, 'office',
                );
            }

            updates.push(`updated_at = now()`);
            vals.push(correction.record_id);

            if (updates.length > 1) {
                await dbClient.query(
                    `UPDATE attendance_records SET ${updates.join(', ')} WHERE id = $${idx}`,
                    vals,
                );
            }
        }

        const auditAction = status === 'approved' ? 'correction_approved' : 'correction_rejected';
        await writeAuditLog(dbClient, {
            action: auditAction,
            actor_id: reviewerId,
            actor_role: reviewerRole,
            target_record_id: correction.record_id,
            target_employee_id: correction.employee_id,
            target_correction_id: correction.id,
            before_state: {
                check_in: correction.original_check_in,
                check_out: correction.original_check_out,
                status: correction.original_status,
            },
            after_state: {
                requested_check_in: correction.requested_check_in,
                requested_check_out: correction.requested_check_out,
                requested_status: correction.requested_status,
                approval_status: status,
            },
            reason: remarks,
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.json({ message: `Correction ${status}`, correction_id: id });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── POST /api/attendance/flags ───────────────────────────────────────────────

export async function raiseFlag(req, res) {
    const parsed = flagSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { employee_id, record_id, flag_type, notes } = parsed.data;
    const raisedBy = req.user.user_id;
    const raisedByRole = req.user.role;

    // Manager can only flag their own team
    if (raisedByRole === 'manager') {
        const ok = await canManagerApprove(raisedBy, employee_id);
        if (!ok) {
            return res.status(403).json({ error: 'This employee is not in your team' });
        }
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const result = await dbClient.query(
            `INSERT INTO attendance_flags
               (employee_id, record_id, flag_type, notes, raised_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employee_id, record_id || null, flag_type, notes || null, raisedBy],
        );
        const flag = result.rows[0];

        await writeAuditLog(dbClient, {
            action: 'flag_raised',
            actor_id: raisedBy,
            actor_role: raisedByRole,
            target_record_id: record_id || null,
            target_employee_id: employee_id,
            target_flag_id: flag.id,
            after_state: { flag_type, notes },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.status(201).json({ message: 'Flag raised', flag });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── GET /api/attendance/team/summary ────────────────────────────────────────

export async function getTeamSummary(req, res) {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    const managerId = req.user.user_id;

    const result = await query(
        `SELECT
           u.id AS employee_id, u.name AS employee_name,
           COUNT(*) FILTER (WHERE ar.status = 'present')   AS present_days,
           COUNT(*) FILTER (WHERE ar.status = 'absent')    AS absent_days,
           COUNT(*) FILTER (WHERE ar.status = 'half_day')  AS half_days,
           COUNT(*) FILTER (WHERE ar.status = 'on_leave')  AS leave_days,
           COUNT(*) FILTER (WHERE ar.is_late = true)       AS late_arrivals,
           COALESCE(SUM(ar.net_work_minutes), 0)           AS total_work_minutes,
           COALESCE(SUM(ar.overtime_minutes), 0)           AS total_ot_minutes
         FROM users u
         LEFT JOIN attendance_records ar
           ON ar.employee_id = u.id AND ar.date BETWEEN $2 AND $3
         WHERE u.manager_id = $1
           AND u.is_active = true
         GROUP BY u.id, u.name
         ORDER BY u.name`,
        [managerId, start_date, end_date],
    );

    return res.json({ summary: result.rows, start_date, end_date });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/attendance/all ──────────────────────────────────────────────────

export async function getAllAttendance(req, res) {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
    }

    const { start_date, end_date, employee_id, status, limit, offset } = parsed.data;
    const values = [start_date, end_date];
    let where = `WHERE ar.date BETWEEN $1 AND $2`;

    if (employee_id) {
        values.push(employee_id);
        where += ` AND ar.employee_id = $${values.length}`;
    }
    if (status) {
        values.push(status);
        where += ` AND ar.status = $${values.length}`;
    }

    values.push(limit, offset);
    const result = await query(
        `SELECT ar.*,
                u.name AS employee_name, u.email AS employee_email,
                m.name AS manager_name
         FROM attendance_records ar
         JOIN users u ON u.id = ar.employee_id
         LEFT JOIN users m ON m.id = u.manager_id
         ${where}
         ORDER BY ar.date DESC, u.name ASC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ records: result.rows, limit, offset });
}

// ─── POST /api/attendance/admin/override ─────────────────────────────────────

export async function adminOverride(req, res) {
    const parsed = adminOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { record_id, override_type, check_in, check_out, status, notes, reason } = parsed.data;
    const adminId = req.user.user_id;

    const recordResult = await query(
        `SELECT * FROM attendance_records WHERE id = $1`,
        [record_id],
    );
    if (recordResult.rows.length === 0) {
        return res.status(404).json({ error: 'Attendance record not found' });
    }

    const record = recordResult.rows[0];
    const beforeState = {
        check_in: record.check_in,
        check_out: record.check_out,
        status: record.status,
        notes: record.notes,
    };

    const settings = await getActiveSettings();
    const newCheckIn = check_in || record.check_in;
    const newCheckOut = check_out || record.check_out;

    // Recalculate if timestamps changed
    let recalcFields = {};
    if ((check_in || check_out) && newCheckIn && newCheckOut) {
        const breaksResult = await query(
            `SELECT break_start, break_end FROM attendance_breaks WHERE record_id = $1`,
            [record_id],
        );
        const calc = calculateWorkHours(newCheckIn, newCheckOut, breaksResult.rows, settings);
        recalcFields = {
            total_minutes: calc.total_minutes,
            net_work_minutes: calc.net_work_minutes,
            break_minutes: calc.break_minutes,
            is_late: calc.is_late,
            late_minutes: calc.late_minutes,
            overtime_minutes: calc.overtime_minutes,
        };
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        const updates = [];
        const vals = [];
        let idx = 1;

        if (check_in !== undefined) { updates.push(`check_in = $${idx++}`); vals.push(check_in); }
        if (check_out !== undefined) { updates.push(`check_out = $${idx++}`); vals.push(check_out); }
        if (status !== undefined) { updates.push(`status = $${idx++}`); vals.push(status); }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(notes); }

        for (const [k, v] of Object.entries(recalcFields)) {
            updates.push(`${k} = $${idx++}`);
            vals.push(v);
        }

        updates.push(`updated_at = now()`);
        vals.push(record_id);

        await dbClient.query(
            `UPDATE attendance_records SET ${updates.join(', ')} WHERE id = $${idx}`,
            vals,
        );

        // Store override record
        const afterState = { check_in, check_out, status, notes, ...recalcFields };
        await dbClient.query(
            `INSERT INTO attendance_overrides
               (record_id, admin_id, override_type, before_state, after_state, reason)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [record_id, adminId, override_type, JSON.stringify(beforeState), JSON.stringify(afterState), reason],
        );

        await writeAuditLog(dbClient, {
            action: 'admin_override',
            actor_id: adminId,
            actor_role: req.user.role,
            target_record_id: record_id,
            target_employee_id: record.employee_id,
            before_state: beforeState,
            after_state: afterState,
            reason,
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        // Sync client timesheets if net_work_minutes changed
        if (recalcFields.net_work_minutes !== undefined) {
            const dateStr = new Date(newCheckIn).toISOString().slice(0, 10);
            await syncClientTimesheet(
                dbClient, record.employee_id, dateStr,
                recalcFields.net_work_minutes, record.work_mode,
            );
        }

        await dbClient.query('COMMIT');

        // Refresh report cache
        if (record.date) {
            const d = new Date(record.date);
            refreshReportCache(record.employee_id, d.getFullYear(), d.getMonth() + 1).catch((e) =>
                console.error('[ATTENDANCE] Cache refresh failed:', e.message),
            );
        }

        return res.json({ message: 'Override applied', record_id });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ─── GET /api/attendance/settings ────────────────────────────────────────────

export async function getSettings(req, res) {
    const settings = await getActiveSettings();
    return res.json({ settings });
}

// ─── PATCH /api/attendance/settings ──────────────────────────────────────────

export async function updateSettings(req, res) {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    const beforeResult = await query(
        `SELECT * FROM attendance_settings ORDER BY created_at ASC LIMIT 1`,
    );
    const before = beforeResult.rows[0];

    const fields = [];
    const vals = [];
    let idx = 1;

    for (const [k, v] of Object.entries(parsed.data)) {
        fields.push(`${k} = $${idx++}`);
        vals.push(v);
    }

    fields.push(`updated_by = $${idx++}`, `updated_at = now()`);
    vals.push(req.user.user_id, before.id);

    const result = await query(
        `UPDATE attendance_settings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        vals,
    );
    const after = result.rows[0];

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');
        await writeAuditLog(dbClient, {
            action: 'settings_changed',
            actor_id: req.user.user_id,
            actor_role: req.user.role,
            before_state: before,
            after_state: after,
            reason: req.body.reason || null,
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });
        await dbClient.query('COMMIT');
    } finally {
        dbClient.release();
    }

    return res.json({ message: 'Settings updated', settings: after });
}

// ─── POST /api/attendance/holidays ───────────────────────────────────────────

export async function addHoliday(req, res) {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { date, name, is_recurring } = parsed.data;

    const result = await query(
        `INSERT INTO attendance_holidays (date, name, is_recurring, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [date, name, is_recurring, req.user.user_id],
    ).catch((err) => {
        if (err.code === '23505') {
            throw Object.assign(new Error('A holiday already exists on this date'), { statusCode: 409 });
        }
        throw err;
    });

    return res.status(201).json({ message: 'Holiday added', holiday: result.rows[0] });
}

// ─── DELETE /api/attendance/holidays/:id ─────────────────────────────────────

export async function deleteHoliday(req, res) {
    const { id } = req.params;

    const result = await query(
        `DELETE FROM attendance_holidays WHERE id = $1 RETURNING *`,
        [id],
    );
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Holiday not found' });
    }

    return res.json({ message: 'Holiday deleted', holiday: result.rows[0] });
}

// ─── GET /api/attendance/holidays ────────────────────────────────────────────

export async function getHolidays(req, res) {
    const { year } = req.query;
    const values = [];
    let where = '';

    if (year) {
        values.push(parseInt(year));
        where = `WHERE EXTRACT(YEAR FROM date) = $1`;
    }

    const result = await query(
        `SELECT * FROM attendance_holidays ${where} ORDER BY date ASC`,
        values,
    );

    return res.json({ holidays: result.rows });
}

// ─── GET /api/attendance/audit-log ───────────────────────────────────────────

export async function getAuditLog(req, res) {
    const { action, actor_id, target_employee_id, start_date, end_date, limit = '50', offset = '0' } = req.query;

    const values = [];
    const clauses = [];

    if (action) { values.push(action); clauses.push(`al.action = $${values.length}`); }
    if (actor_id) { values.push(actor_id); clauses.push(`al.actor_id = $${values.length}`); }
    if (target_employee_id) { values.push(target_employee_id); clauses.push(`al.target_employee_id = $${values.length}`); }
    if (start_date) { values.push(start_date); clauses.push(`al.logged_at::date >= $${values.length}`); }
    if (end_date) { values.push(end_date); clauses.push(`al.logged_at::date <= $${values.length}`); }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    values.push(parseInt(limit), parseInt(offset));
    const result = await query(
        `SELECT al.*,
                actor.name AS actor_name, actor.email AS actor_email,
                emp.name AS employee_name
         FROM attendance_audit_log al
         JOIN users actor ON actor.id = al.actor_id
         LEFT JOIN users emp ON emp.id = al.target_employee_id
         ${where}
         ORDER BY al.logged_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
    );

    return res.json({ audit_log: result.rows, limit: parseInt(limit), offset: parseInt(offset) });
}

// ─── GET /api/attendance/company-report ──────────────────────────────────────

export async function getCompanyReport(req, res) {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const summary = await query(
        `SELECT
           COUNT(DISTINCT ar.employee_id)                          AS total_employees,
           COUNT(*) FILTER (WHERE ar.status = 'present')           AS present_count,
           COUNT(*) FILTER (WHERE ar.status = 'absent')            AS absent_count,
           COUNT(*) FILTER (WHERE ar.status = 'half_day')          AS half_day_count,
           COUNT(*) FILTER (WHERE ar.status = 'on_leave')          AS on_leave_count,
           COUNT(*) FILTER (WHERE ar.status = 'work_from_home')    AS wfh_count,
           COUNT(*) FILTER (WHERE ar.is_late = true)               AS late_arrivals,
           COALESCE(AVG(ar.net_work_minutes), 0)                   AS avg_work_minutes,
           COALESCE(SUM(ar.overtime_minutes), 0)                   AS total_ot_minutes
         FROM attendance_records ar
         WHERE ar.date BETWEEN $1 AND $2`,
        [start_date, end_date],
    );

    const byEmployee = await query(
        `SELECT
           u.id, u.name, u.email,
           COUNT(*) FILTER (WHERE ar.status = 'present')  AS present_days,
           COUNT(*) FILTER (WHERE ar.status = 'absent')   AS absent_days,
           COUNT(*) FILTER (WHERE ar.is_late = true)      AS late_arrivals,
           COALESCE(SUM(ar.net_work_minutes), 0)          AS total_work_minutes
         FROM users u
         LEFT JOIN attendance_records ar
           ON ar.employee_id = u.id AND ar.date BETWEEN $1 AND $2
         WHERE u.role = 'employee' AND u.is_active = true
         GROUP BY u.id, u.name, u.email
         ORDER BY u.name`,
        [start_date, end_date],
    );

    return res.json({
        period: { start_date, end_date },
        summary: summary.rows[0],
        by_employee: byEmployee.rows,
    });
}

// ─── PATCH /api/attendance/flags/:id/resolve ──────────────────────────────────

export async function resolveFlag(req, res) {
    const parsed = resolveFlagSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { id } = req.params;
    const { resolution_notes } = parsed.data;
    const adminId = req.user.user_id;

    const flagResult = await query(
        `SELECT * FROM attendance_flags WHERE id = $1`,
        [id],
    );
    if (flagResult.rows.length === 0) {
        return res.status(404).json({ error: 'Flag not found' });
    }
    if (flagResult.rows[0].is_resolved) {
        return res.status(409).json({ error: 'Flag is already resolved' });
    }

    const dbClient = await getClient();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query(
            `UPDATE attendance_flags
             SET is_resolved = true, resolved_by = $1, resolved_at = now(), resolution_notes = $2
             WHERE id = $3`,
            [adminId, resolution_notes, id],
        );

        await writeAuditLog(dbClient, {
            action: 'flag_resolved',
            actor_id: adminId,
            actor_role: req.user.role,
            target_flag_id: id,
            target_employee_id: flagResult.rows[0].employee_id,
            after_state: { is_resolved: true, resolution_notes },
            ip_address: getIp(req),
            user_agent: getUserAgent(req),
        });

        await dbClient.query('COMMIT');
        return res.json({ message: 'Flag resolved' });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/attendance/client/timesheets ────────────────────────────────────

export async function getProjectTimesheets(req, res) {
    const parsed = timesheetQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
    }

    const { start_date, end_date, campaign_id } = parsed.data;
    const clientId = req.user.client_id;

    if (!clientId) {
        return res.status(403).json({ error: 'No client account linked to this user' });
    }

    const values = [clientId, start_date, end_date];
    let where = `WHERE ts.client_id = $1 AND ts.date BETWEEN $2 AND $3`;

    if (campaign_id) {
        values.push(campaign_id);
        where += ` AND ts.campaign_id = $${values.length}`;
    }

    // STRICTLY billing-safe: only expose name, date, hours, mode — NO HR data
    const result = await query(
        `SELECT
           u.name AS employee_name,
           c.name AS campaign_name,
           ts.date,
           ts.net_work_minutes,
           ROUND(ts.net_work_minutes / 60.0, 2) AS hours,
           ts.work_mode,
           ts.synced_at
         FROM client_project_timesheets ts
         JOIN users u ON u.id = ts.employee_id
         JOIN campaigns c ON c.id = ts.campaign_id
         ${where}
         ORDER BY ts.date DESC, u.name ASC`,
        values,
    );

    // Aggregate by employee for summary
    const aggregated = await query(
        `SELECT
           u.name AS employee_name,
           SUM(ts.net_work_minutes)                    AS total_minutes,
           ROUND(SUM(ts.net_work_minutes) / 60.0, 2)  AS total_hours,
           COUNT(DISTINCT ts.date)                     AS days_worked
         FROM client_project_timesheets ts
         JOIN users u ON u.id = ts.employee_id
         ${where}
         GROUP BY u.name
         ORDER BY u.name`,
        values,
    );

    return res.json({
        period: { start_date, end_date },
        timesheets: result.rows,
        summary: aggregated.rows,
    });
}
