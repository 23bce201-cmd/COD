-- ============================================================
-- CloudCRM — Attendance Management Module
-- Migration: 012_attendance.sql
-- Run: npm run migrate:attendance
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'present', 'absent', 'half_day', 'on_leave', 'holiday',
    'weekend', 'work_from_home', 'on_duty'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM (
    'annual', 'sick', 'casual', 'on_duty',
    'work_from_home', 'unpaid', 'compensatory'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM (
    'pending', 'approved', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM (
    'pending', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE flag_type AS ENUM (
    'late_arrival', 'early_departure', 'absent',
    'overtime_anomaly', 'missing_checkout', 'consecutive_absences'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'check_in', 'check_out', 'break_start', 'break_end',
    'correction_submitted', 'correction_approved', 'correction_rejected',
    'leave_applied', 'leave_approved', 'leave_rejected', 'leave_cancelled',
    'admin_override', 'flag_raised', 'flag_resolved',
    'settings_changed', 'holiday_added', 'holiday_deleted',
    'record_finalized'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ════════════════════════════════════════════════════════════
-- TABLE 1: attendance_settings
-- Admin-configured global rules. Only one active row at a time.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_settings (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Working hours
  work_start_time             TIME          NOT NULL DEFAULT '09:00:00',
  work_end_time               TIME          NOT NULL DEFAULT '18:00:00',
  -- Grace period for late arrivals (minutes)
  grace_minutes               INTEGER       NOT NULL DEFAULT 15 CHECK (grace_minutes >= 0),
  -- Daily overtime threshold (minutes beyond work_end_time)
  daily_ot_threshold_minutes  INTEGER       NOT NULL DEFAULT 30 CHECK (daily_ot_threshold_minutes >= 0),
  -- Standard daily work minutes (used for half-day calc)
  standard_daily_minutes      INTEGER       NOT NULL DEFAULT 480 CHECK (standard_daily_minutes > 0),
  -- Days of week considered weekends (0=Sun, 6=Sat) stored as array
  weekend_days                INTEGER[]     NOT NULL DEFAULT '{0,6}',
  -- Timezone for all attendance calculations
  timezone                    VARCHAR(64)   NOT NULL DEFAULT 'Asia/Kolkata',
  -- Whether WFH requires manager approval
  wfh_requires_approval       BOOLEAN       NOT NULL DEFAULT true,
  -- Auto-flag consecutive absences after N days
  consecutive_absence_threshold INTEGER     NOT NULL DEFAULT 3 CHECK (consecutive_absence_threshold > 0),
  -- Metadata
  updated_by                  UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO attendance_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- TABLE 2: attendance_holidays
-- Company-wide holiday calendar
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_holidays (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE         NOT NULL UNIQUE,
  name         VARCHAR(255) NOT NULL,
  -- If true, recurs every year on same month-day
  is_recurring BOOLEAN      NOT NULL DEFAULT false,
  created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_holidays_date
  ON attendance_holidays (date);

-- ════════════════════════════════════════════════════════════
-- TABLE 3: attendance_records
-- Core check-in / check-out data. Immutable after finalization.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_records (
  id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE               NOT NULL,
  status            attendance_status  NOT NULL DEFAULT 'present',
  -- Raw timestamps from employee device
  check_in          TIMESTAMPTZ,
  check_out         TIMESTAMPTZ,
  -- Computed by service layer on check-out
  total_minutes     INTEGER            CHECK (total_minutes >= 0),
  break_minutes     INTEGER            NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  net_work_minutes  INTEGER            CHECK (net_work_minutes >= 0),
  -- Derived flags
  is_late           BOOLEAN            NOT NULL DEFAULT false,
  late_minutes      INTEGER            NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  overtime_minutes  INTEGER            NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0),
  -- Work mode
  work_mode         VARCHAR(20)        NOT NULL DEFAULT 'office'
                    CHECK (work_mode IN ('office', 'wfh', 'on_duty')),
  -- Location capture (optional, for audit)
  check_in_location JSONB,
  -- Free-text notes from employee on check-out
  notes             TEXT,
  -- Finalization lock: once true, only admin can edit
  is_finalized      BOOLEAN            NOT NULL DEFAULT false,
  finalized_at      TIMESTAMPTZ,
  finalized_by      UUID               REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ        NOT NULL DEFAULT now(),
  -- One record per employee per day
  UNIQUE (employee_id, date),
  -- Checkout must be after check-in
  CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_att_records_employee_date
  ON attendance_records (employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_att_records_date
  ON attendance_records (date DESC);
CREATE INDEX IF NOT EXISTS idx_att_records_status
  ON attendance_records (status);

-- ════════════════════════════════════════════════════════════
-- TABLE 4: attendance_breaks
-- Optional break tracking per attendance record
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_breaks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID        NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  break_start TIMESTAMPTZ NOT NULL,
  break_end   TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (break_end IS NULL OR break_end > break_start)
);

CREATE INDEX IF NOT EXISTS idx_att_breaks_record
  ON attendance_breaks (record_id);

-- ════════════════════════════════════════════════════════════
-- TABLE 5: attendance_corrections
-- Employee-submitted correction requests for missed/wrong punches
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                    UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id             UUID               NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  employee_id           UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- What the employee is requesting
  requested_check_in    TIMESTAMPTZ,
  requested_check_out   TIMESTAMPTZ,
  requested_status      attendance_status,
  reason                TEXT               NOT NULL,
  -- Review
  status                correction_status  NOT NULL DEFAULT 'pending',
  reviewed_by           UUID               REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  reviewer_remarks      TEXT,
  -- Snapshot of original values at time of request
  original_check_in     TIMESTAMPTZ,
  original_check_out    TIMESTAMPTZ,
  original_status       attendance_status,
  submitted_at          TIMESTAMPTZ        NOT NULL DEFAULT now(),
  CHECK (requested_check_out IS NULL OR requested_check_in IS NULL
         OR requested_check_out > requested_check_in)
);

CREATE INDEX IF NOT EXISTS idx_att_corrections_record
  ON attendance_corrections (record_id);
CREATE INDEX IF NOT EXISTS idx_att_corrections_employee
  ON attendance_corrections (employee_id);
CREATE INDEX IF NOT EXISTS idx_att_corrections_status
  ON attendance_corrections (status);

-- ════════════════════════════════════════════════════════════
-- TABLE 6: attendance_leaves
-- Leave applications from employees (annual, sick, WFH, etc.)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_leaves (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type   leave_type   NOT NULL,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  days_count   NUMERIC(4,1) NOT NULL CHECK (days_count > 0),
  reason       TEXT         NOT NULL,
  -- Review
  status       leave_status NOT NULL DEFAULT 'pending',
  reviewed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  remarks      TEXT,
  submitted_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_att_leaves_employee
  ON attendance_leaves (employee_id);
CREATE INDEX IF NOT EXISTS idx_att_leaves_status
  ON attendance_leaves (status);
CREATE INDEX IF NOT EXISTS idx_att_leaves_dates
  ON attendance_leaves (start_date, end_date);

-- ════════════════════════════════════════════════════════════
-- TABLE 7: attendance_on_duty
-- On-duty / field visit entries requiring manager approval
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_on_duty (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE         NOT NULL,
  location     VARCHAR(500) NOT NULL,
  purpose      TEXT         NOT NULL,
  status       leave_status NOT NULL DEFAULT 'pending',
  reviewed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  remarks      TEXT,
  submitted_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_on_duty_employee
  ON attendance_on_duty (employee_id);
CREATE INDEX IF NOT EXISTS idx_att_on_duty_date
  ON attendance_on_duty (date);

-- ════════════════════════════════════════════════════════════
-- TABLE 8: attendance_flags
-- Manager or system-raised irregularity flags
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_flags (
  id            UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_id     UUID       REFERENCES attendance_records(id) ON DELETE SET NULL,
  flag_type     flag_type  NOT NULL,
  notes         TEXT,
  raised_by     UUID       REFERENCES users(id) ON DELETE SET NULL,
  raised_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Resolution
  is_resolved   BOOLEAN    NOT NULL DEFAULT false,
  resolved_by   UUID       REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_att_flags_employee
  ON attendance_flags (employee_id);
CREATE INDEX IF NOT EXISTS idx_att_flags_record
  ON attendance_flags (record_id);
CREATE INDEX IF NOT EXISTS idx_att_flags_resolved
  ON attendance_flags (is_resolved);

-- ════════════════════════════════════════════════════════════
-- TABLE 9: attendance_overrides
-- Admin override records. Separate from corrections.
-- Every override MUST have a reason and is permanently audited.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_overrides (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id        UUID              NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  admin_id         UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- What was changed
  override_type    VARCHAR(50)       NOT NULL
                   CHECK (override_type IN ('check_in', 'check_out', 'status', 'full', 'notes')),
  -- Before and after snapshots (JSON for flexibility)
  before_state     JSONB             NOT NULL,
  after_state      JSONB             NOT NULL,
  -- Mandatory reason
  reason           TEXT              NOT NULL CHECK (char_length(reason) >= 10),
  overridden_at    TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_overrides_record
  ON attendance_overrides (record_id);
CREATE INDEX IF NOT EXISTS idx_att_overrides_admin
  ON attendance_overrides (admin_id);

-- ════════════════════════════════════════════════════════════
-- TABLE 10: attendance_audit_log
-- Immutable append-only audit trail. Never update or delete.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_audit_log (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  action        audit_action  NOT NULL,
  actor_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_role    VARCHAR(30)   NOT NULL,
  -- Target (one of these will be set depending on action)
  target_record_id      UUID  REFERENCES attendance_records(id) ON DELETE SET NULL,
  target_employee_id    UUID  REFERENCES users(id) ON DELETE SET NULL,
  target_leave_id       UUID  REFERENCES attendance_leaves(id) ON DELETE SET NULL,
  target_correction_id  UUID  REFERENCES attendance_corrections(id) ON DELETE SET NULL,
  target_flag_id        UUID  REFERENCES attendance_flags(id) ON DELETE SET NULL,
  -- State snapshots
  before_state  JSONB,
  after_state   JSONB,
  reason        TEXT,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  logged_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_audit_actor
  ON attendance_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_att_audit_record
  ON attendance_audit_log (target_record_id);
CREATE INDEX IF NOT EXISTS idx_att_audit_employee
  ON attendance_audit_log (target_employee_id);
CREATE INDEX IF NOT EXISTS idx_att_audit_action
  ON attendance_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_att_audit_logged_at
  ON attendance_audit_log (logged_at DESC);

-- ════════════════════════════════════════════════════════════
-- TABLE 11: attendance_reports_cache
-- Pre-computed monthly summary per employee for fast reporting
-- Refreshed on corrections/overrides
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_reports_cache (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year                SMALLINT NOT NULL,
  month               SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- Aggregated counts
  present_days        INTEGER NOT NULL DEFAULT 0,
  absent_days         INTEGER NOT NULL DEFAULT 0,
  half_days           INTEGER NOT NULL DEFAULT 0,
  leave_days          NUMERIC(5,1) NOT NULL DEFAULT 0,
  holiday_days        INTEGER NOT NULL DEFAULT 0,
  late_arrivals       INTEGER NOT NULL DEFAULT 0,
  total_work_minutes  BIGINT  NOT NULL DEFAULT 0,
  total_ot_minutes    BIGINT  NOT NULL DEFAULT 0,
  -- Cache metadata
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_att_report_cache_emp_period
  ON attendance_reports_cache (employee_id, year, month);

-- ════════════════════════════════════════════════════════════
-- TABLE 12: client_project_timesheets
-- Filtered view for client billing.
-- Contains NO leave type, penalty, or HR-sensitive data.
-- Only aggregated hours for employees on client's campaigns.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS client_project_timesheets (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id       UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  employee_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE    NOT NULL,
  net_work_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (net_work_minutes >= 0),
  work_mode         VARCHAR(20) NOT NULL DEFAULT 'office',
  -- Refreshed from attendance_records on check-out or correction approval
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_client_ts_client_date
  ON client_project_timesheets (client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_client_ts_campaign
  ON client_project_timesheets (campaign_id);
CREATE INDEX IF NOT EXISTS idx_client_ts_employee
  ON client_project_timesheets (employee_id);

COMMIT;
