/**
 * Attendance Service — Pure Business Logic
 *
 * No req/res. All functions accept plain values and return plain values.
 * DB access via query() or a passed-in DB client (for transactions).
 */

import { query, getClient } from './db.js';

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Fetch the single active attendance settings row.
 * @returns {Promise<object>}
 */
export async function getActiveSettings() {
    const result = await query(
        `SELECT * FROM attendance_settings ORDER BY created_at ASC LIMIT 1`,
    );
    if (result.rows.length === 0) {
        throw new Error('Attendance settings not configured');
    }
    return result.rows[0];
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

/**
 * Check if a given date (YYYY-MM-DD) is a company holiday.
 * @param {string} dateStr
 * @returns {Promise<boolean>}
 */
export async function isHoliday(dateStr) {
    const result = await query(
        `SELECT 1 FROM attendance_holidays WHERE date = $1 LIMIT 1`,
        [dateStr],
    );
    return result.rows.length > 0;
}

/**
 * Check if a given date falls on a configured weekend day.
 * @param {string|Date} date
 * @param {object} settings — from getActiveSettings()
 * @returns {boolean}
 */
export function isWeekend(date, settings) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dayOfWeek = d.getUTCDay();
    return settings.weekend_days.includes(dayOfWeek);
}

/**
 * Count working days between two dates (exclusive of weekends/holidays).
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @param {object} settings
 * @returns {Promise<number>}
 */
export async function countWorkingDays(startDate, endDate, settings) {
    const result = await query(
        `SELECT COUNT(*) AS cnt
         FROM generate_series($1::date, $2::date, '1 day'::interval) AS d
         WHERE EXTRACT(DOW FROM d) != ALL($3::int[])
           AND d::date NOT IN (
             SELECT date FROM attendance_holidays
             WHERE date BETWEEN $1::date AND $2::date
           )`,
        [startDate, endDate, settings.weekend_days],
    );
    return parseInt(result.rows[0].cnt, 10);
}

// ─── Work Hour Calculations ───────────────────────────────────────────────────

/**
 * Calculate net work hours from check-in, check-out, and break records.
 *
 * @param {Date|string} checkIn
 * @param {Date|string} checkOut
 * @param {Array<{break_start: Date|string, break_end: Date|string}>} breaks
 * @param {object} settings — from getActiveSettings()
 * @returns {{ total_minutes, break_minutes, net_work_minutes, is_late, late_minutes, overtime_minutes }}
 */
export function calculateWorkHours(checkIn, checkOut, breaks = [], settings) {
    const inTime = new Date(checkIn);
    const outTime = new Date(checkOut);

    const total_minutes = Math.floor((outTime - inTime) / 60000);

    // Sum up break durations
    const break_minutes = breaks.reduce((acc, b) => {
        if (b.break_start && b.break_end) {
            const diff = Math.floor(
                (new Date(b.break_end) - new Date(b.break_start)) / 60000,
            );
            return acc + Math.max(0, diff);
        }
        return acc;
    }, 0);

    const net_work_minutes = Math.max(0, total_minutes - break_minutes);

    // Late calculation — compare check-in time against work_start_time + grace
    const [sh, sm] = settings.work_start_time.split(':').map(Number);
    const workStartMinutes = sh * 60 + sm;
    const checkInMinutes = inTime.getUTCHours() * 60 + inTime.getUTCMinutes();
    const late_minutes = Math.max(
        0,
        checkInMinutes - workStartMinutes - settings.grace_minutes,
    );
    const is_late = late_minutes > 0;

    // Overtime — minutes worked beyond daily_ot_threshold
    const expectedMinutes = settings.standard_daily_minutes;
    const overtime_minutes = Math.max(
        0,
        net_work_minutes - expectedMinutes - settings.daily_ot_threshold_minutes,
    );

    return {
        total_minutes,
        break_minutes,
        net_work_minutes,
        is_late,
        late_minutes,
        overtime_minutes,
    };
}

/**
 * Determine attendance status based on net work minutes vs. standard day.
 * @param {number} net_work_minutes
 * @param {object} settings
 * @returns {string} attendance_status value
 */
export function deriveAttendanceStatus(net_work_minutes, settings) {
    const standard = settings.standard_daily_minutes;
    if (net_work_minutes <= 0) return 'absent';
    if (net_work_minutes < standard / 2) return 'half_day';
    return 'present';
}

// ─── Permission Guards ────────────────────────────────────────────────────────

/**
 * Verify that manager_id is the reporting manager of employee_id.
 * @param {string} managerId
 * @param {string} employeeId
 * @returns {Promise<boolean>}
 */
export async function canManagerApprove(managerId, employeeId) {
    const result = await query(
        `SELECT 1 FROM users WHERE id = $1 AND manager_id = $2 LIMIT 1`,
        [employeeId, managerId],
    );
    return result.rows.length > 0;
}

// ─── Record Access ────────────────────────────────────────────────────────────

/**
 * Get today's attendance record for an employee (creates none if absent).
 * @param {string} employeeId
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {Promise<object|null>}
 */
export async function getRecordForDate(employeeId, dateStr) {
    const result = await query(
        `SELECT * FROM attendance_records WHERE employee_id = $1 AND date = $2 LIMIT 1`,
        [employeeId, dateStr],
    );
    return result.rows[0] || null;
}

/**
 * Check for overlapping leave applications for an employee in a date range.
 * @param {string} employeeId
 * @param {string} startDate
 * @param {string} endDate
 * @param {string|null} excludeLeaveId  — exclude current leave when editing
 * @returns {Promise<boolean>}
 */
export async function hasOverlappingLeave(
    employeeId,
    startDate,
    endDate,
    excludeLeaveId = null,
) {
    const result = await query(
        `SELECT 1 FROM attendance_leaves
         WHERE employee_id = $1
           AND status IN ('pending', 'approved')
           AND start_date <= $3
           AND end_date >= $2
           AND ($4::uuid IS NULL OR id != $4)
         LIMIT 1`,
        [employeeId, startDate, endDate, excludeLeaveId],
    );
    return result.rows.length > 0;
}

// ─── Finalization ─────────────────────────────────────────────────────────────

/**
 * Finalize an attendance record (locks employee/manager edits).
 * Must be called within a transaction.
 * @param {object} dbClient  — from getClient()
 * @param {string} recordId
 * @param {string} actorId
 */
export async function finalizeRecord(dbClient, recordId, actorId) {
    await dbClient.query(
        `UPDATE attendance_records
         SET is_finalized = true, finalized_at = now(), finalized_by = $2, updated_at = now()
         WHERE id = $1`,
        [recordId, actorId],
    );
}

// ─── Client Timesheet Sync ────────────────────────────────────────────────────

/**
 * Upsert a row into client_project_timesheets after check-out or correction approval.
 * Only inserts if employee is currently assigned to a campaign under that client.
 * Called within the same DB transaction as the attendance record update.
 * @param {object} dbClient
 * @param {string} employeeId
 * @param {string} dateStr
 * @param {number} netWorkMinutes
 * @param {string} workMode
 */
export async function syncClientTimesheet(
    dbClient,
    employeeId,
    dateStr,
    netWorkMinutes,
    workMode,
) {
    // Find active campaign assignments for this employee
    const campaigns = await dbClient.query(
        `SELECT DISTINCT c.id AS campaign_id, c.client_id
         FROM campaigns c
         JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
         WHERE eca.employee_id = $1 AND c.status = 'active'`,
        [employeeId],
    );

    for (const row of campaigns.rows) {
        await dbClient.query(
            `INSERT INTO client_project_timesheets
               (client_id, campaign_id, employee_id, date, net_work_minutes, work_mode, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())
             ON CONFLICT (campaign_id, employee_id, date)
             DO UPDATE SET
               net_work_minutes = EXCLUDED.net_work_minutes,
               work_mode = EXCLUDED.work_mode,
               synced_at = now()`,
            [row.client_id, row.campaign_id, employeeId, dateStr, netWorkMinutes, workMode],
        );
    }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * Write an immutable audit log entry.
 * Must be called within a DB transaction for data integrity.
 *
 * @param {object} dbClient — pg client from getClient()
 * @param {object} params
 * @param {string} params.action          — audit_action enum value
 * @param {string} params.actor_id        — user performing the action
 * @param {string} params.actor_role      — role of the actor
 * @param {string} [params.target_record_id]
 * @param {string} [params.target_employee_id]
 * @param {string} [params.target_leave_id]
 * @param {string} [params.target_correction_id]
 * @param {string} [params.target_flag_id]
 * @param {object} [params.before_state]
 * @param {object} [params.after_state]
 * @param {string} [params.reason]
 * @param {string} [params.ip_address]
 * @param {string} [params.user_agent]
 */
export async function writeAuditLog(dbClient, params) {
    const {
        action,
        actor_id,
        actor_role,
        target_record_id = null,
        target_employee_id = null,
        target_leave_id = null,
        target_correction_id = null,
        target_flag_id = null,
        before_state = null,
        after_state = null,
        reason = null,
        ip_address = null,
        user_agent = null,
    } = params;

    await dbClient.query(
        `INSERT INTO attendance_audit_log (
           action, actor_id, actor_role,
           target_record_id, target_employee_id,
           target_leave_id, target_correction_id, target_flag_id,
           before_state, after_state, reason, ip_address, user_agent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
            action,
            actor_id,
            actor_role,
            target_record_id,
            target_employee_id,
            target_leave_id,
            target_correction_id,
            target_flag_id,
            before_state ? JSON.stringify(before_state) : null,
            after_state ? JSON.stringify(after_state) : null,
            reason,
            ip_address,
            user_agent,
        ],
    );
}

// ─── Report Cache ─────────────────────────────────────────────────────────────

/**
 * Recompute and upsert the monthly summary cache for an employee.
 * Called after any record change that affects the target month.
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month  (1–12)
 */
export async function refreshReportCache(employeeId, year, month) {
    await query(
        `INSERT INTO attendance_reports_cache
           (employee_id, year, month,
            present_days, absent_days, half_days, leave_days,
            holiday_days, late_arrivals, total_work_minutes, total_ot_minutes,
            computed_at)
         SELECT
           $1, $2, $3,
           COUNT(*) FILTER (WHERE status = 'present') AS present_days,
           COUNT(*) FILTER (WHERE status = 'absent')  AS absent_days,
           COUNT(*) FILTER (WHERE status = 'half_day') AS half_days,
           COUNT(*) FILTER (WHERE status = 'on_leave') AS leave_days,
           COUNT(*) FILTER (WHERE status = 'holiday')  AS holiday_days,
           COUNT(*) FILTER (WHERE is_late = true)      AS late_arrivals,
           COALESCE(SUM(net_work_minutes), 0)           AS total_work_minutes,
           COALESCE(SUM(overtime_minutes), 0)           AS total_ot_minutes,
           now()
         FROM attendance_records
         WHERE employee_id = $1
           AND EXTRACT(YEAR FROM date) = $2
           AND EXTRACT(MONTH FROM date) = $3
         ON CONFLICT (employee_id, year, month)
         DO UPDATE SET
           present_days        = EXCLUDED.present_days,
           absent_days         = EXCLUDED.absent_days,
           half_days           = EXCLUDED.half_days,
           leave_days          = EXCLUDED.leave_days,
           holiday_days        = EXCLUDED.holiday_days,
           late_arrivals       = EXCLUDED.late_arrivals,
           total_work_minutes  = EXCLUDED.total_work_minutes,
           total_ot_minutes    = EXCLUDED.total_ot_minutes,
           computed_at         = now()`,
        [employeeId, year, month],
    );
}
