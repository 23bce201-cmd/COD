import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid('Invalid UUID');
const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .refine((d) => !isNaN(Date.parse(d)), 'Invalid date');

const timestampSchema = z
    .string()
    .datetime({ offset: true, message: 'Must be a valid ISO-8601 datetime with timezone' });

// ─── Employee: Check-in ───────────────────────────────────────────────────────

export const checkInSchema = z.object({
    work_mode: z
        .enum(['office', 'wfh', 'on_duty'], {
            errorMap: () => ({ message: 'work_mode must be office, wfh, or on_duty' }),
        })
        .default('office'),
    check_in: timestampSchema.optional(), // If omitted, server uses now()
    location: z
        .object({
            lat: z.number().min(-90).max(90).optional(),
            lng: z.number().min(-180).max(180).optional(),
            label: z.string().max(255).optional(),
        })
        .optional(),
});

// ─── Employee: Check-out ──────────────────────────────────────────────────────

export const checkOutSchema = z.object({
    check_out: timestampSchema.optional(),
    notes: z.string().max(1000).optional(),
});

// ─── Employee: Add Break ──────────────────────────────────────────────────────

export const breakSchema = z
    .object({
        break_start: timestampSchema,
        break_end: timestampSchema.optional(),
    })
    .refine(
        (d) => !d.break_end || new Date(d.break_end) > new Date(d.break_start),
        { message: 'break_end must be after break_start', path: ['break_end'] },
    );

// ─── Employee: Apply Leave ────────────────────────────────────────────────────

export const leaveSchema = z
    .object({
        leave_type: z.enum(['annual', 'sick', 'casual', 'on_duty', 'work_from_home', 'unpaid', 'compensatory']),
        start_date: dateSchema,
        end_date: dateSchema,
        reason: z.string().min(10, 'Reason must be at least 10 characters').max(2000),
    })
    .refine(
        (d) => new Date(d.end_date) >= new Date(d.start_date),
        { message: 'end_date must be on or after start_date', path: ['end_date'] },
    );

// ─── Employee: Submit Correction ──────────────────────────────────────────────

export const correctionSchema = z
    .object({
        record_id: uuidSchema,
        requested_check_in: timestampSchema.optional(),
        requested_check_out: timestampSchema.optional(),
        requested_status: z
            .enum(['present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'work_from_home', 'on_duty'])
            .optional(),
        reason: z.string().min(10, 'Reason must be at least 10 characters').max(2000),
    })
    .refine(
        (d) =>
            d.requested_check_in ||
            d.requested_check_out ||
            d.requested_status,
        { message: 'At least one correction field is required (check_in, check_out, or status)' },
    )
    .refine(
        (d) =>
            !d.requested_check_in ||
            !d.requested_check_out ||
            new Date(d.requested_check_out) > new Date(d.requested_check_in),
        { message: 'requested_check_out must be after requested_check_in', path: ['requested_check_out'] },
    );

// ─── Employee: Submit On-Duty ─────────────────────────────────────────────────

export const onDutySchema = z.object({
    date: dateSchema,
    location: z.string().min(3).max(500),
    purpose: z.string().min(10).max(2000),
});

// ─── Manager / Admin: Approve or Reject ───────────────────────────────────────

export const approvalSchema = z.object({
    status: z.enum(['approved', 'rejected'], {
        errorMap: () => ({ message: 'status must be approved or rejected' }),
    }),
    remarks: z.string().max(1000).optional(),
});

// ─── Manager: Raise Flag ──────────────────────────────────────────────────────

export const flagSchema = z.object({
    employee_id: uuidSchema,
    record_id: uuidSchema.optional(),
    flag_type: z.enum([
        'late_arrival',
        'early_departure',
        'absent',
        'overtime_anomaly',
        'missing_checkout',
        'consecutive_absences',
    ]),
    notes: z.string().max(1000).optional(),
});

// ─── Admin: Resolve Flag ──────────────────────────────────────────────────────

export const resolveFlagSchema = z.object({
    resolution_notes: z
        .string()
        .min(5, 'Resolution notes must be at least 5 characters')
        .max(1000),
});

// ─── Admin: Override Record ───────────────────────────────────────────────────

export const adminOverrideSchema = z
    .object({
        record_id: uuidSchema,
        override_type: z.enum(['check_in', 'check_out', 'status', 'full', 'notes']),
        check_in: timestampSchema.optional(),
        check_out: timestampSchema.optional(),
        status: z
            .enum(['present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'work_from_home', 'on_duty'])
            .optional(),
        notes: z.string().max(1000).optional(),
        // Mandatory — enforced at schema level
        reason: z
            .string()
            .min(10, 'Override reason must be at least 10 characters')
            .max(2000),
    })
    .refine(
        (d) =>
            !d.check_in ||
            !d.check_out ||
            new Date(d.check_out) > new Date(d.check_in),
        { message: 'check_out must be after check_in', path: ['check_out'] },
    );

// ─── Admin: Update Settings ───────────────────────────────────────────────────

export const settingsSchema = z.object({
    work_start_time: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS')
        .optional(),
    work_end_time: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS')
        .optional(),
    grace_minutes: z.number().int().min(0).max(120).optional(),
    daily_ot_threshold_minutes: z.number().int().min(0).max(480).optional(),
    standard_daily_minutes: z.number().int().min(60).max(1440).optional(),
    weekend_days: z
        .array(z.number().int().min(0).max(6))
        .min(0)
        .max(7)
        .optional(),
    timezone: z.string().max(64).optional(),
    wfh_requires_approval: z.boolean().optional(),
    consecutive_absence_threshold: z.number().int().min(1).max(30).optional(),
});

// ─── Admin: Add Holiday ───────────────────────────────────────────────────────

export const holidaySchema = z.object({
    date: dateSchema,
    name: z.string().min(1).max(255),
    is_recurring: z.boolean().default(false),
});

// ─── Report Queries ───────────────────────────────────────────────────────────

export const reportQuerySchema = z
    .object({
        start_date: dateSchema,
        end_date: dateSchema,
        employee_id: uuidSchema.optional(),
        status: z
            .enum(['present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'work_from_home', 'on_duty'])
            .optional(),
        limit: z
            .string()
            .transform(Number)
            .pipe(z.number().int().min(1).max(200))
            .optional()
            .default('50'),
        offset: z
            .string()
            .transform(Number)
            .pipe(z.number().int().min(0))
            .optional()
            .default('0'),
    })
    .refine(
        (d) => new Date(d.end_date) >= new Date(d.start_date),
        { message: 'end_date must be on or after start_date', path: ['end_date'] },
    );

export const timesheetQuerySchema = z
    .object({
        start_date: dateSchema,
        end_date: dateSchema,
        campaign_id: uuidSchema.optional(),
    })
    .refine(
        (d) => new Date(d.end_date) >= new Date(d.start_date),
        { message: 'end_date must be on or after start_date', path: ['end_date'] },
    );
