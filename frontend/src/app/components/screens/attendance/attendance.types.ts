// ─── Attendance API Types ─────────────────────────────────────────────────────

export type WorkMode = 'office' | 'wfh' | 'on_duty';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'on_leave'
  | 'holiday'
  | 'weekend'
  | 'work_from_home'
  | 'on_duty';

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'casual'
  | 'on_duty'
  | 'work_from_home'
  | 'unpaid'
  | 'compensatory';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export type FlagType =
  | 'late_arrival'
  | 'early_departure'
  | 'absent'
  | 'overtime_anomaly'
  | 'missing_checkout'
  | 'consecutive_absences';

export type AuditAction =
  | 'check_in'
  | 'check_out'
  | 'break_start'
  | 'break_end'
  | 'correction_submitted'
  | 'correction_approved'
  | 'correction_rejected'
  | 'leave_applied'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_cancelled'
  | 'admin_override'
  | 'flag_raised'
  | 'flag_resolved'
  | 'settings_changed'
  | 'holiday_added'
  | 'holiday_deleted'
  | 'record_finalized';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  manager_name?: string;
  date: string;
  status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  total_minutes: number | null;
  break_minutes: number;
  net_work_minutes: number | null;
  is_late: boolean;
  late_minutes: number;
  overtime_minutes: number;
  work_mode: WorkMode;
  check_in_location: { lat?: number; lng?: number; label?: string } | null;
  notes: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  break_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceBreak {
  id: string;
  record_id: string;
  break_start: string;
  break_end: string | null;
  duration_minutes: number | null;
}

export interface AttendanceLeave {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewer_name?: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  submitted_at: string;
}

export interface AttendanceCorrection {
  id: string;
  record_id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  requested_status: AttendanceStatus | null;
  reason: string;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_remarks: string | null;
  original_check_in: string | null;
  original_check_out: string | null;
  original_status: AttendanceStatus | null;
  manager_id?: string;
  is_finalized?: boolean;
  submitted_at: string;
}

export interface AttendanceFlag {
  id: string;
  employee_id: string;
  employee_name?: string;
  record_id: string | null;
  flag_type: FlagType;
  notes: string | null;
  raised_by: string | null;
  raised_at: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface AttendanceSettings {
  id: string;
  work_start_time: string;
  work_end_time: string;
  grace_minutes: number;
  daily_ot_threshold_minutes: number;
  standard_daily_minutes: number;
  weekend_days: number[];
  timezone: string;
  wfh_requires_approval: boolean;
  consecutive_absence_threshold: number;
  updated_at: string;
}

export interface AttendanceHoliday {
  id: string;
  date: string;
  name: string;
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  actor_role: string;
  target_record_id: string | null;
  target_employee_id: string | null;
  employee_name?: string | null;
  target_leave_id: string | null;
  target_correction_id: string | null;
  target_flag_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  logged_at: string;
}

export interface TeamSummaryRow {
  employee_id: string;
  employee_name: string;
  present_days: number;
  absent_days: number;
  half_days: number;
  leave_days: number;
  late_arrivals: number;
  total_work_minutes: number;
  total_ot_minutes: number;
}

export interface CompanyReportSummary {
  total_employees: number;
  present_count: number;
  absent_count: number;
  half_day_count: number;
  on_leave_count: number;
  wfh_count: number;
  late_arrivals: number;
  avg_work_minutes: number;
  total_ot_minutes: number;
}

export interface ClientTimesheetRow {
  employee_name: string;
  campaign_name: string;
  date: string;
  net_work_minutes: number;
  hours: number;
  work_mode: WorkMode;
  synced_at: string;
}

export interface ClientTimesheetSummary {
  employee_name: string;
  total_minutes: number;
  total_hours: number;
  days_worked: number;
}
