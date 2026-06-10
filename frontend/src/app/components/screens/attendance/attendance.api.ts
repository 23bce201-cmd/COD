/**
 * Attendance API client — all typed fetch functions.
 * Uses apiFetch from AuthContext for auth headers.
 */

import type {
  AttendanceRecord,
  AttendanceLeave,
  AttendanceCorrection,
  AttendanceFlag,
  AttendanceSettings,
  AttendanceHoliday,
  AuditLogEntry,
  TeamSummaryRow,
  CompanyReportSummary,
  ClientTimesheetRow,
  ClientTimesheetSummary,
  WorkMode,
  LeaveType,
  LeaveStatus,
  AttendanceStatus,
} from './attendance.types';

type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Employee ─────────────────────────────────────────────────────────────────

export async function checkIn(
  apiFetch: ApiFetch,
  payload: { work_mode?: WorkMode; check_in?: string; location?: { lat?: number; lng?: number; label?: string } }
): Promise<{ message: string; record: AttendanceRecord }> {
  const res = await apiFetch('/api/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function checkOut(
  apiFetch: ApiFetch,
  payload: { check_out?: string; notes?: string }
): Promise<{ message: string; record: AttendanceRecord }> {
  const res = await apiFetch('/api/attendance/check-out', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function addBreak(
  apiFetch: ApiFetch,
  payload: { break_start: string; break_end?: string }
): Promise<{ message: string }> {
  const res = await apiFetch('/api/attendance/breaks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function getMyAttendance(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string; status?: AttendanceStatus; limit?: number; offset?: number }
): Promise<{ records: AttendanceRecord[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams(params as Record<string, string>);
  const res = await apiFetch(`/api/attendance/my?${q}`);
  return handle(res);
}

export async function getMyLeaves(
  apiFetch: ApiFetch,
  params?: { status?: LeaveStatus | 'all'; limit?: number; offset?: number }
): Promise<{ leaves: AttendanceLeave[] }> {
  const q = new URLSearchParams((params || {}) as Record<string, string>);
  const res = await apiFetch(`/api/attendance/my/leaves?${q}`);
  return handle(res);
}

export async function applyLeave(
  apiFetch: ApiFetch,
  payload: { leave_type: LeaveType; start_date: string; end_date: string; reason: string }
): Promise<{ message: string; leave: AttendanceLeave }> {
  const res = await apiFetch('/api/attendance/leaves', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function cancelLeave(
  apiFetch: ApiFetch,
  id: string
): Promise<{ message: string }> {
  const res = await apiFetch(`/api/attendance/leaves/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) });
  return handle(res);
}

export async function submitCorrection(
  apiFetch: ApiFetch,
  payload: {
    record_id: string;
    requested_check_in?: string;
    requested_check_out?: string;
    requested_status?: AttendanceStatus;
    reason: string;
  }
): Promise<{ message: string; correction: AttendanceCorrection }> {
  const res = await apiFetch('/api/attendance/corrections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export async function getTeamAttendance(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string; employee_id?: string; status?: AttendanceStatus; limit?: number; offset?: number }
): Promise<{ records: AttendanceRecord[] }> {
  const q = new URLSearchParams(params as Record<string, string>);
  const res = await apiFetch(`/api/attendance/team?${q}`);
  return handle(res);
}

export async function getTeamLeaves(
  apiFetch: ApiFetch,
  params?: { status?: LeaveStatus | 'all' | 'pending'; limit?: number; offset?: number }
): Promise<{ leaves: AttendanceLeave[] }> {
  const q = new URLSearchParams((params || {}) as Record<string, string>);
  const res = await apiFetch(`/api/attendance/team/leaves?${q}`);
  return handle(res);
}

export async function getTeamCorrections(
  apiFetch: ApiFetch,
  params?: { status?: string }
): Promise<{ corrections: AttendanceCorrection[] }> {
  const q = new URLSearchParams((params || {}) as Record<string, string>);
  const res = await apiFetch(`/api/attendance/team/corrections?${q}`);
  return handle(res);
}

export async function getTeamSummary(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string }
): Promise<{ summary: TeamSummaryRow[]; start_date: string; end_date: string }> {
  const q = new URLSearchParams(params);
  const res = await apiFetch(`/api/attendance/team/summary?${q}`);
  return handle(res);
}

export async function approveLeave(
  apiFetch: ApiFetch,
  id: string,
  payload: { status: 'approved' | 'rejected'; remarks?: string }
): Promise<{ message: string }> {
  const res = await apiFetch(`/api/attendance/leaves/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function approveCorrection(
  apiFetch: ApiFetch,
  id: string,
  payload: { status: 'approved' | 'rejected'; remarks?: string }
): Promise<{ message: string }> {
  const res = await apiFetch(`/api/attendance/corrections/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function raiseFlag(
  apiFetch: ApiFetch,
  payload: { employee_id: string; record_id?: string; flag_type: AttendanceFlag['flag_type']; notes?: string }
): Promise<{ message: string; flag: AttendanceFlag }> {
  const res = await apiFetch('/api/attendance/flags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllAttendance(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string; employee_id?: string; status?: AttendanceStatus; limit?: number; offset?: number }
): Promise<{ records: AttendanceRecord[] }> {
  const q = new URLSearchParams(params as Record<string, string>);
  const res = await apiFetch(`/api/attendance/all?${q}`);
  return handle(res);
}

export async function adminOverride(
  apiFetch: ApiFetch,
  payload: {
    record_id: string;
    override_type: 'check_in' | 'check_out' | 'status' | 'full' | 'notes';
    check_in?: string;
    check_out?: string;
    status?: AttendanceStatus;
    notes?: string;
    reason: string;
  }
): Promise<{ message: string }> {
  const res = await apiFetch('/api/attendance/admin/override', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function getSettings(
  apiFetch: ApiFetch
): Promise<{ settings: AttendanceSettings }> {
  const res = await apiFetch('/api/attendance/settings');
  return handle(res);
}

export async function updateSettings(
  apiFetch: ApiFetch,
  payload: Partial<Omit<AttendanceSettings, 'id' | 'updated_at'>>
): Promise<{ message: string; settings: AttendanceSettings }> {
  const res = await apiFetch('/api/attendance/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function getHolidays(
  apiFetch: ApiFetch,
  year?: number
): Promise<{ holidays: AttendanceHoliday[] }> {
  const q = year ? `?year=${year}` : '';
  const res = await apiFetch(`/api/attendance/holidays${q}`);
  return handle(res);
}

export async function addHoliday(
  apiFetch: ApiFetch,
  payload: { date: string; name: string; is_recurring?: boolean }
): Promise<{ message: string; holiday: AttendanceHoliday }> {
  const res = await apiFetch('/api/attendance/holidays', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function deleteHoliday(
  apiFetch: ApiFetch,
  id: string
): Promise<{ message: string }> {
  const res = await apiFetch(`/api/attendance/holidays/${id}`, { method: 'DELETE' });
  return handle(res);
}

export async function getAuditLog(
  apiFetch: ApiFetch,
  params?: { action?: string; actor_id?: string; target_employee_id?: string; start_date?: string; end_date?: string; limit?: number; offset?: number }
): Promise<{ audit_log: AuditLogEntry[] }> {
  const q = new URLSearchParams((params || {}) as Record<string, string>);
  const res = await apiFetch(`/api/attendance/audit-log?${q}`);
  return handle(res);
}

export async function getCompanyReport(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string }
): Promise<{ period: { start_date: string; end_date: string }; summary: CompanyReportSummary; by_employee: TeamSummaryRow[] }> {
  const q = new URLSearchParams(params);
  const res = await apiFetch(`/api/attendance/company-report?${q}`);
  return handle(res);
}

export async function resolveFlag(
  apiFetch: ApiFetch,
  id: string,
  resolution_notes: string
): Promise<{ message: string }> {
  const res = await apiFetch(`/api/attendance/flags/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution_notes }),
  });
  return handle(res);
}

// ─── Client ───────────────────────────────────────────────────────────────────

export async function getProjectTimesheets(
  apiFetch: ApiFetch,
  params: { start_date: string; end_date: string; campaign_id?: string }
): Promise<{ period: { start_date: string; end_date: string }; timesheets: ClientTimesheetRow[]; summary: ClientTimesheetSummary[] }> {
  const q = new URLSearchParams(params as Record<string, string>);
  const res = await apiFetch(`/api/attendance/client/timesheets?${q}`);
  return handle(res);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

export function fmtTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  weekend: 'Weekend',
  work_from_home: 'WFH',
  on_duty: 'On Duty',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  present: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  absent: { bg: '#FFF1F2', text: '#9F1239', dot: '#F43F5E' },
  half_day: { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' },
  on_leave: { bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
  holiday: { bg: '#F5F3FF', text: '#5B21B6', dot: '#8B5CF6' },
  weekend: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
  work_from_home: { bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
  on_duty: { bg: '#FFF7ED', text: '#9A3412', dot: '#F97316' },
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  casual: 'Casual Leave',
  on_duty: 'On Duty',
  work_from_home: 'Work From Home',
  unpaid: 'Unpaid Leave',
  compensatory: 'Compensatory Off',
};
