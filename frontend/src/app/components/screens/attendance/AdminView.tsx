import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Shield, BarChart2, Calendar, Settings, BookOpen, AlertTriangle, XCircle, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { AttendanceRecord, AttendanceSettings, AttendanceHoliday, AuditLogEntry, CompanyReportSummary, TeamSummaryRow } from './attendance.types';
import {
  getAllAttendance, adminOverride, getSettings, updateSettings,
  addHoliday, deleteHoliday, getHolidays, getAuditLog, getCompanyReport, resolveFlag,
  fmtTime, fmtMinutes, fmtDate, todayISO, nDaysAgoISO,
  STATUS_LABELS, STATUS_COLORS,
} from './attendance.api';

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text, fontSize: 10 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ─── Override Modal ───────────────────────────────────────────────────────────

function OverrideModal({ record, onClose, onDone }: { record: AttendanceRecord; onClose: () => void; onDone: () => void }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({
    check_in: record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : '',
    check_out: record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : '',
    reason: '',
    notes: record.notes || '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.reason.length < 10) return toast.error('Reason must be at least 10 characters');
    setLoading(true);
    try {
      await adminOverride(apiFetch, {
        record_id: record.id,
        override_type: 'full',
        check_in: form.check_in ? new Date(form.check_in).toISOString() : undefined,
        check_out: form.check_out ? new Date(form.check_out).toISOString() : undefined,
        notes: form.notes || undefined,
        reason: form.reason,
      });
      toast.success('Override applied and audit log updated');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Admin Override</h2>
            <p className="text-slate-500" style={{ fontSize: 12 }}>
              {record.employee_name} · {fmtDate(record.date)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 cursor-pointer"><XCircle size={20} /></button>
        </div>
        <div className="rounded-xl p-3 mb-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-amber-700 font-medium" style={{ fontSize: 12 }}>
            ⚠️ All admin overrides are permanently logged with your identity and reason.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Check-in Time</label>
            <input type="datetime-local" value={form.check_in}
              onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Check-out Time</label>
            <input type="datetime-local" value={form.check_out}
              onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Notes</label>
            <input type="text" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Override Reason <span className="text-red-500">*</span></label>
            <textarea value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Explain why this override is necessary (min. 10 characters)"
              rows={3} className="w-full rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl py-2.5 font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #EF4444, #F87171)', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Applying Override…' : '⚡ Apply Override'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── AdminView ────────────────────────────────────────────────────────────────

export function AdminView() {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<'records' | 'report' | 'settings' | 'holidays' | 'audit'>('records');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [reportSummary, setReportSummary] = useState<CompanyReportSummary | null>(null);
  const [reportByEmployee, setReportByEmployee] = useState<TeamSummaryRow[]>([]);
  const [overrideTarget, setOverrideTarget] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: nDaysAgoISO(7), end: todayISO() });
  const [newHoliday, setNewHoliday] = useState({ date: todayISO(), name: '', is_recurring: false });
  const [settingsForm, setSettingsForm] = useState<Partial<AttendanceSettings>>({});
  const [settingsDirty, setSettingsDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, settingsRes, holidayRes, auditRes, reportRes] = await Promise.all([
        getAllAttendance(apiFetch, { start_date: dateRange.start, end_date: dateRange.end }),
        getSettings(apiFetch),
        getHolidays(apiFetch, new Date().getFullYear()),
        getAuditLog(apiFetch, { limit: 20 }),
        getCompanyReport(apiFetch, { start_date: dateRange.start, end_date: dateRange.end }),
      ]);
      setRecords(recRes.records);
      setSettings(settingsRes.settings);
      setSettingsForm({
        work_start_time: settingsRes.settings.work_start_time,
        work_end_time: settingsRes.settings.work_end_time,
        grace_minutes: settingsRes.settings.grace_minutes,
        daily_ot_threshold_minutes: settingsRes.settings.daily_ot_threshold_minutes,
        standard_daily_minutes: settingsRes.settings.standard_daily_minutes,
        wfh_requires_approval: settingsRes.settings.wfh_requires_approval,
        consecutive_absence_threshold: settingsRes.settings.consecutive_absence_threshold,
      });
      setHolidays(holidayRes.holidays);
      setAuditLog(auditRes.audit_log);
      setReportSummary(reportRes.summary);
      setReportByEmployee(reportRes.by_employee);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, dateRange]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveSettings() {
    try {
      await updateSettings(apiFetch, settingsForm);
      toast.success('Settings saved');
      setSettingsDirty(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleAddHoliday() {
    if (!newHoliday.name.trim()) return toast.error('Holiday name is required');
    try {
      await addHoliday(apiFetch, newHoliday);
      toast.success('Holiday added');
      setNewHoliday({ date: todayISO(), name: '', is_recurring: false });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDeleteHoliday(id: string) {
    try {
      await deleteHoliday(apiFetch, id);
      toast.success('Holiday removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const TABS = [
    { key: 'records', label: 'All Records' },
    { key: 'report', label: 'Company Report' },
    { key: 'settings', label: 'Settings' },
    { key: 'holidays', label: 'Holidays' },
    { key: 'audit', label: 'Audit Log' },
  ] as const;

  const auditActionColors: Record<string, string> = {
    check_in: '#10B981', check_out: '#6366F1', admin_override: '#EF4444',
    leave_approved: '#10B981', leave_rejected: '#EF4444', correction_approved: '#10B981',
    correction_rejected: '#EF4444', settings_changed: '#F59E0B', flag_raised: '#F97316',
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EF4444, #F87171)' }}>
              <Shield size={20} className="text-white" />
            </span>
            <div>
              <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Admin — Attendance Control</h2>
              <p className="text-slate-500" style={{ fontSize: 12 }}>Full system access · All actions are audited</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              className="rounded-lg px-2 py-1.5 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 12 }} />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              className="rounded-lg px-2 py-1.5 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className="flex-1 rounded-lg py-2 font-medium transition-all cursor-pointer"
            style={{ fontSize: 12, background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1E293B' : '#64748B', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Records */}
      {tab === 'records' && (
        <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>All Attendance Records</h3>
            <p className="text-slate-500" style={{ fontSize: 12 }}>{records.length} records · Click Override to edit any record</p>
          </div>
          {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Employee', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Status', 'Late?', 'OT', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-700">{r.employee_name}</p>
                          <p className="text-slate-400" style={{ fontSize: 10 }}>{r.manager_name ? `Mgr: ${r.manager_name}` : ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.check_in)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtTime(r.check_out)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{fmtMinutes(r.net_work_minutes)}</td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3">
                        {r.is_late ? <span className="text-amber-600 font-medium">+{fmtMinutes(r.late_minutes)}</span> : <span className="text-green-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-indigo-600 font-medium">{r.overtime_minutes > 0 ? fmtMinutes(r.overtime_minutes) : '—'}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setOverrideTarget(r)}
                          className="rounded-lg px-2 py-1 font-semibold cursor-pointer"
                          style={{ background: '#FFF1F2', color: '#BE123C', fontSize: 11, border: '1px solid #FECDD3' }}>
                          Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Company Report */}
      {tab === 'report' && reportSummary && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Present', value: reportSummary.present_count, color: '#10B981' },
              { label: 'Absent', value: reportSummary.absent_count, color: '#F43F5E' },
              { label: 'Late Arrivals', value: reportSummary.late_arrivals, color: '#F59E0B' },
              { label: 'WFH Days', value: reportSummary.wfh_count, color: '#6366F1' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 text-center" style={{ border: '1px solid #E2E8F0' }}>
                <p className="font-bold" style={{ fontSize: 28, color: s.color }}>{s.value}</p>
                <p className="text-slate-500 font-medium" style={{ fontSize: 12 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Employee Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Employee', 'Present', 'Absent', 'Late', 'Total Hours'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportByEmployee.map((row) => (
                    <tr key={row.employee_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.employee_name}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{row.present_days}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">{row.absent_days}</td>
                      <td className="px-4 py-3 text-amber-600 font-medium">{row.late_arrivals}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{fmtMinutes(row.total_work_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {tab === 'settings' && settings && (
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0' }}>
          <h3 className="text-slate-800 font-bold mb-4" style={{ fontSize: 14 }}>Attendance Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'work_start_time', label: 'Work Start Time', type: 'time' },
              { key: 'work_end_time', label: 'Work End Time', type: 'time' },
              { key: 'grace_minutes', label: 'Grace Period (minutes)', type: 'number' },
              { key: 'daily_ot_threshold_minutes', label: 'OT Threshold (minutes)', type: 'number' },
              { key: 'standard_daily_minutes', label: 'Standard Day (minutes)', type: 'number' },
              { key: 'consecutive_absence_threshold', label: 'Absence Alert Threshold (days)', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>{label}</label>
                <input
                  type={type}
                  value={(settingsForm as any)[key] || ''}
                  onChange={(e) => {
                    setSettingsForm((f) => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value) : e.target.value }));
                    setSettingsDirty(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 outline-none"
                  style={{ border: '1px solid #E2E8F0', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <input type="checkbox" id="wfh_approval" checked={settingsForm.wfh_requires_approval ?? true}
              onChange={(e) => { setSettingsForm((f) => ({ ...f, wfh_requires_approval: e.target.checked })); setSettingsDirty(true); }} />
            <label htmlFor="wfh_approval" className="text-slate-700 font-medium cursor-pointer" style={{ fontSize: 13 }}>
              WFH requires manager approval
            </label>
          </div>
          {settingsDirty && (
            <button type="button" onClick={handleSaveSettings}
              className="mt-4 rounded-xl px-5 py-2.5 font-bold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', fontSize: 13 }}>
              Save Settings
            </button>
          )}
        </div>
      )}

      {/* Tab: Holidays */}
      {tab === 'holidays' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0' }}>
            <h3 className="text-slate-800 font-bold mb-3" style={{ fontSize: 14 }}>Add Holiday</h3>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Date</label>
                <input type="date" value={newHoliday.date}
                  onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
                  className="rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
              </div>
              <div className="flex-1">
                <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Name</label>
                <input type="text" value={newHoliday.name} placeholder="e.g. Diwali"
                  onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input type="checkbox" id="recurring" checked={newHoliday.is_recurring}
                  onChange={(e) => setNewHoliday((h) => ({ ...h, is_recurring: e.target.checked }))} />
                <label htmlFor="recurring" className="text-slate-600 font-medium cursor-pointer" style={{ fontSize: 12 }}>Recurring</label>
              </div>
              <button type="button" onClick={handleAddHoliday}
                className="rounded-xl px-4 py-2 font-bold text-white cursor-pointer flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', fontSize: 13 }}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Holidays — {new Date().getFullYear()}</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {holidays.length === 0 ? (
                <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No holidays added</div>
              ) : holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{h.name}</p>
                    <p className="text-slate-500" style={{ fontSize: 11 }}>{fmtDate(h.date)}{h.is_recurring ? ' · Recurring annually' : ''}</p>
                  </div>
                  <button type="button" onClick={() => handleDeleteHoliday(h.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Audit Log */}
      {tab === 'audit' && (
        <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Immutable Audit Trail</h3>
            <p className="text-slate-500" style={{ fontSize: 12 }}>All actions are permanently recorded and cannot be modified</p>
          </div>
          {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : (
            <div className="divide-y divide-slate-50">
              {auditLog.map((entry) => (
                <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: auditActionColors[entry.action] || '#94A3B8' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700" style={{ fontSize: 12 }}>{entry.actor_name || entry.actor_id}</span>
                      <span className="text-slate-400" style={{ fontSize: 11 }}>({entry.actor_role})</span>
                      <span className="text-slate-500" style={{ fontSize: 12 }}>{entry.action.replace(/_/g, ' ')}</span>
                      {entry.employee_name && <span className="text-indigo-600 font-medium" style={{ fontSize: 12 }}>→ {entry.employee_name}</span>}
                    </div>
                    {entry.reason && <p className="text-slate-400 italic mt-0.5" style={{ fontSize: 11 }}>"{entry.reason}"</p>}
                    <p className="text-slate-400" style={{ fontSize: 10 }}>
                      {new Date(entry.logged_at).toLocaleString('en-IN')}
                      {entry.ip_address ? ` · IP: ${entry.ip_address}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {overrideTarget && (
        <OverrideModal
          record={overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
