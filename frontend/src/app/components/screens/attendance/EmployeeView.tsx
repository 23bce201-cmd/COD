import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Clock, LogIn, LogOut, Coffee, CalendarDays, FileEdit,
  CheckCircle2, XCircle, AlertCircle, TrendingUp, Timer, Sunrise
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { AttendanceRecord, AttendanceLeave, LeaveType } from './attendance.types';
import {
  checkIn, checkOut, addBreak, getMyAttendance, getMyLeaves, applyLeave, cancelLeave, submitCorrection,
  fmtTime, fmtMinutes, fmtDate, todayISO, nDaysAgoISO,
  STATUS_LABELS, STATUS_COLORS, LEAVE_TYPE_LABELS,
} from './attendance.api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.absent;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
      style={{ background: c.bg, color: c.text, fontSize: 11 }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatBox({ icon: Icon, label, value, accent }: { icon: React.FC<any>; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl p-4" style={{ border: '1px solid #E2E8F0' }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
        <Icon size={18} style={{ color: accent }} />
      </span>
      <div>
        <p className="text-slate-500 font-medium" style={{ fontSize: 11 }}>{label}</p>
        <p className="text-slate-900 font-bold" style={{ fontSize: 16 }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Check-in / Check-out Card ────────────────────────────────────────────────

function CheckInCard({ record, onAction }: { record: AttendanceRecord | null; onAction: () => void }) {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [workMode, setWorkMode] = useState<'office' | 'wfh' | 'on_duty'>('office');
  const now = new Date();

  async function handleCheckIn() {
    setLoading(true);
    try {
      await checkIn(apiFetch, { work_mode: workMode });
      toast.success('Checked in successfully!');
      onAction();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    setLoading(true);
    try {
      await checkOut(apiFetch, { notes: notes || undefined });
      toast.success('Checked out successfully!');
      setNotes('');
      onAction();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isCheckedIn = !!record?.check_in;
  const isCheckedOut = !!record?.check_out;
  const gradients: Record<string, string> = {
    office: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
    wfh: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
    on_duty: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
  };

  return (
    <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: gradients[isCheckedIn ? (record?.work_mode || 'office') : workMode] }}>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-medium opacity-80" style={{ fontSize: 12 }}>
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="font-bold mt-0.5" style={{ fontSize: 28 }}>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
          {record && <StatusPill status={record.status} />}
        </div>

        {isCheckedIn && (
          <div className="flex gap-4 mb-4 text-sm opacity-90">
            <span>In: <strong>{fmtTime(record!.check_in)}</strong></span>
            {isCheckedOut && <span>Out: <strong>{fmtTime(record!.check_out)}</strong></span>}
            {record?.net_work_minutes != null && (
              <span>Work: <strong>{fmtMinutes(record.net_work_minutes)}</strong></span>
            )}
          </div>
        )}

        {!isCheckedIn && (
          <div className="flex gap-2 mb-4">
            {(['office', 'wfh', 'on_duty'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWorkMode(mode)}
                className="rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer"
                style={{
                  fontSize: 11,
                  background: workMode === mode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
                  border: workMode === mode ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                  color: 'white',
                }}
              >
                {mode === 'office' ? '🏢 Office' : mode === 'wfh' ? '🏠 WFH' : '🚗 On Duty'}
              </button>
            ))}
          </div>
        )}

        {isCheckedIn && !isCheckedOut && (
          <input
            type="text"
            placeholder="Add a note for today (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg px-3 py-2 mb-3 text-slate-800 outline-none"
            style={{ background: 'rgba(255,255,255,0.9)', fontSize: 13, border: 'none' }}
          />
        )}

        {!isCheckedOut && (
          <button
            type="button"
            onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
            disabled={loading}
            className="w-full rounded-xl py-3 font-bold transition-all cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: 'white',
              fontSize: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing…' : isCheckedIn ? '🔴 Check Out' : '🟢 Check In'}
          </button>
        )}

        {isCheckedOut && (
          <div className="text-center opacity-80 font-medium" style={{ fontSize: 13 }}>
            ✅ Day complete — {fmtMinutes(record?.net_work_minutes)} worked
            {record?.is_late && <span className="ml-2 opacity-70">(Late by {fmtMinutes(record.late_minutes)})</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({ leave_type: 'annual' as LeaveType, start_date: todayISO(), end_date: todayISO(), reason: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.reason.length < 10) return toast.error('Reason must be at least 10 characters');
    setLoading(true);
    try {
      await applyLeave(apiFetch, form);
      toast.success('Leave application submitted');
      onSubmit();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Apply for Leave</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><XCircle size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Leave Type</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value as LeaveType }))}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E2E8F0', fontSize: 13, color: '#1E293B' }}
            >
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{ border: '1px solid #E2E8F0', fontSize: 13 }}
              />
            </div>
            <div>
              <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>End Date</label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 outline-none"
                style={{ border: '1px solid #E2E8F0', fontSize: 13 }}
              />
            </div>
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the reason for leave (min. 10 characters)"
              rows={3}
              className="w-full rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E2E8F0', fontSize: 13 }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', fontSize: 14, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Correction Modal ─────────────────────────────────────────────────────────

function CorrectionModal({ record, onClose, onSubmit }: { record: AttendanceRecord; onClose: () => void; onSubmit: () => void }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({
    requested_check_in: record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : '',
    requested_check_out: record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : '',
    reason: '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.reason.length < 10) return toast.error('Reason must be at least 10 characters');
    setLoading(true);
    try {
      await submitCorrection(apiFetch, {
        record_id: record.id,
        requested_check_in: form.requested_check_in ? new Date(form.requested_check_in).toISOString() : undefined,
        requested_check_out: form.requested_check_out ? new Date(form.requested_check_out).toISOString() : undefined,
        reason: form.reason,
      });
      toast.success('Correction request submitted');
      onSubmit();
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
          <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Request Correction</h2>
          <button type="button" onClick={onClose} className="text-slate-400 cursor-pointer"><XCircle size={20} /></button>
        </div>
        <p className="text-slate-500 mb-4" style={{ fontSize: 12 }}>
          Original — In: <strong>{fmtTime(record.check_in)}</strong> · Out: <strong>{fmtTime(record.check_out)}</strong>
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Corrected Check-in</label>
            <input type="datetime-local" value={form.requested_check_in}
              onChange={(e) => setForm((f) => ({ ...f, requested_check_in: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Corrected Check-out</label>
            <input type="datetime-local" value={form.requested_check_out}
              onChange={(e) => setForm((f) => ({ ...f, requested_check_out: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <div>
            <label className="text-slate-600 font-medium block mb-1" style={{ fontSize: 12 }}>Reason *</label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Describe why the correction is needed (min. 10 chars)"
              rows={3} className="w-full rounded-lg px-3 py-2 outline-none resize-none"
              style={{ border: '1px solid #E2E8F0', fontSize: 13 }} />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl py-2.5 font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Submitting…' : 'Submit Correction'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main EmployeeView ────────────────────────────────────────────────────────

export function EmployeeView() {
  const { apiFetch } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history' | 'leaves'>('overview');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayISO();
      const [recResult, leaveResult] = await Promise.all([
        getMyAttendance(apiFetch, { start_date: nDaysAgoISO(30), end_date: today, limit: 30 }),
        getMyLeaves(apiFetch, { limit: 10 }),
      ]);
      setRecords(recResult.records);
      setTodayRecord(recResult.records.find((r) => r.date === today) || null);
      setLeaves(leaveResult.leaves);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const totalWork = records.reduce((s, r) => s + (r.net_work_minutes || 0), 0);
  const lateCount = records.filter((r) => r.is_late).length;
  const presentCount = records.filter((r) => r.status === 'present' || r.status === 'work_from_home' || r.status === 'on_duty').length;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'History' },
    { key: 'leaves', label: 'Leave Requests' },
  ] as const;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
      {/* Check-in card */}
      <CheckInCard record={todayRecord} onAction={load} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox icon={CheckCircle2} label="Days Present (30d)" value={String(presentCount)} accent="#10B981" />
        <StatBox icon={Timer} label="Total Hours (30d)" value={`${Math.floor(totalWork / 60)}h`} accent="#6366F1" />
        <StatBox icon={AlertCircle} label="Late Arrivals" value={String(lateCount)} accent="#F59E0B" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-lg py-2 font-medium transition-all cursor-pointer"
            style={{
              fontSize: 12,
              background: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? '#1E293B' : '#64748B',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Recent Attendance</h3>
          </div>
          {loading ? (
            <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>Loading…</div>
          ) : records.length === 0 ? (
            <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No records found</div>
          ) : (
            <div className="flex flex-col gap-2">
              {records.slice(0, 7).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  style={{ border: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>
                        {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-slate-500" style={{ fontSize: 11 }}>
                        {r.check_in ? `${fmtTime(r.check_in)} → ${r.check_out ? fmtTime(r.check_out) : 'Ongoing'}` : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_late && (
                      <span className="text-amber-600 font-medium" style={{ fontSize: 10 }}>+{fmtMinutes(r.late_minutes)} late</span>
                    )}
                    <span className="text-slate-500 font-medium" style={{ fontSize: 12 }}>{fmtMinutes(r.net_work_minutes)}</span>
                    <StatusPill status={r.status} />
                    {!r.is_finalized && r.check_in && (
                      <button
                        type="button"
                        onClick={() => setCorrectionTarget(r)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 cursor-pointer"
                        title="Request correction"
                      >
                        <FileEdit size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0' }}>
          <h3 className="text-slate-800 font-bold mb-3" style={{ fontSize: 14 }}>30-Day History</h3>
          {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : (
            <div className="flex flex-col divide-y divide-slate-50">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 group">
                  <div>
                    <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>
                      {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-slate-500" style={{ fontSize: 11 }}>
                      {r.check_in ? `In: ${fmtTime(r.check_in)}` : ''}{r.check_out ? ` · Out: ${fmtTime(r.check_out)}` : ''}
                      {r.break_minutes > 0 ? ` · Break: ${fmtMinutes(r.break_minutes)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-slate-700 font-bold" style={{ fontSize: 13 }}>{fmtMinutes(r.net_work_minutes)}</p>
                      {r.overtime_minutes > 0 && (
                        <p className="text-indigo-600 font-medium" style={{ fontSize: 10 }}>+{fmtMinutes(r.overtime_minutes)} OT</p>
                      )}
                    </div>
                    <StatusPill status={r.status} />
                    {!r.is_finalized && r.check_in && (
                      <button type="button" onClick={() => setCorrectionTarget(r)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 cursor-pointer" title="Request correction">
                        <FileEdit size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Leaves */}
      {tab === 'leaves' && (
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Leave Requests</h3>
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="rounded-lg px-3 py-1.5 text-white font-medium cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', fontSize: 12 }}
            >
              + Apply Leave
            </button>
          </div>
          {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : leaves.length === 0 ? (
            <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No leave requests</div>
          ) : (
            <div className="flex flex-col gap-2">
              {leaves.map((l) => {
                const statusColors: Record<string, { bg: string; text: string }> = {
                  pending: { bg: '#FFFBEB', text: '#92400E' },
                  approved: { bg: '#ECFDF5', text: '#065F46' },
                  rejected: { bg: '#FFF1F2', text: '#9F1239' },
                  cancelled: { bg: '#F1F5F9', text: '#475569' },
                };
                const c = statusColors[l.status] || statusColors.pending;
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                    <div>
                      <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{LEAVE_TYPE_LABELS[l.leave_type]}</p>
                      <p className="text-slate-500" style={{ fontSize: 11 }}>
                        {fmtDate(l.start_date)} → {fmtDate(l.end_date)} · {l.days_count} day{Number(l.days_count) !== 1 ? 's' : ''}
                      </p>
                      {l.remarks && <p className="text-slate-400 italic mt-0.5" style={{ fontSize: 11 }}>"{l.remarks}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 font-medium capitalize" style={{ background: c.bg, color: c.text, fontSize: 11 }}>
                        {l.status}
                      </span>
                      {l.status === 'pending' && (
                        <button type="button" onClick={async () => {
                          try { await cancelLeave(apiFetch, l.id); toast.success('Leave cancelled'); load(); }
                          catch (e: any) { toast.error(e.message); }
                        }} className="text-slate-400 hover:text-red-500 cursor-pointer"><XCircle size={15} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showLeaveModal && <LeaveModal onClose={() => setShowLeaveModal(false)} onSubmit={load} />}
      {correctionTarget && <CorrectionModal record={correctionTarget} onClose={() => setCorrectionTarget(null)} onSubmit={load} />}
    </div>
  );
}
