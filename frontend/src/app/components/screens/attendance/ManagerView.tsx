import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Users, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { AttendanceRecord, AttendanceLeave, AttendanceCorrection, TeamSummaryRow } from './attendance.types';
import {
  getTeamAttendance, getTeamLeaves, getTeamCorrections, getTeamSummary,
  approveLeave, approveCorrection, raiseFlag,
  fmtTime, fmtMinutes, fmtDate, todayISO, nDaysAgoISO,
  STATUS_LABELS, STATUS_COLORS, LEAVE_TYPE_LABELS,
} from './attendance.api';

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ApprovalCard({
  title, items, onApprove, onReject, renderBody,
}: {
  title: string;
  items: Array<{ id: string; [k: string]: any }>;
  onApprove: (id: string, remarks?: string) => Promise<void>;
  onReject: (id: string, remarks?: string) => Promise<void>;
  renderBody: (item: any) => React.ReactNode;
}) {
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function doAction(id: string, action: 'approve' | 'reject') {
    setLoading((l) => ({ ...l, [id]: true }));
    try {
      if (action === 'approve') await onApprove(id, remarks[id]);
      else await onReject(id, remarks[id]);
      toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading((l) => ({ ...l, [id]: false }));
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 text-center" style={{ border: '1px solid #E2E8F0' }}>
        <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#10B981' }} />
        <p className="text-slate-500 font-medium" style={{ fontSize: 13 }}>No pending {title.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>{title}</h3>
        <p className="text-slate-500" style={{ fontSize: 12 }}>{items.length} pending</p>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map((item) => (
          <div key={item.id} className="p-4 flex flex-col gap-3">
            {renderBody(item)}
            <input
              type="text"
              placeholder="Remarks (optional)"
              value={remarks[item.id] || ''}
              onChange={(e) => setRemarks((r) => ({ ...r, [item.id]: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{ border: '1px solid #E2E8F0', fontSize: 12, color: '#475569' }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => doAction(item.id, 'approve')}
                disabled={loading[item.id]}
                className="flex-1 rounded-lg py-2 font-semibold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #10B981, #34D399)', fontSize: 12, opacity: loading[item.id] ? 0.7 : 1 }}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => doAction(item.id, 'reject')}
                disabled={loading[item.id]}
                className="flex-1 rounded-lg py-2 font-semibold cursor-pointer"
                style={{ background: '#FFF1F2', color: '#BE123C', fontSize: 12, border: '1px solid #FECDD3', opacity: loading[item.id] ? 0.7 : 1 }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ManagerView() {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<'today' | 'leaves' | 'corrections' | 'summary'>('today');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [summary, setSummary] = useState<TeamSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayISO();
      const [recRes, leaveRes, corrRes, summaryRes] = await Promise.all([
        getTeamAttendance(apiFetch, { start_date: today, end_date: today }),
        getTeamLeaves(apiFetch, { status: 'pending' }),
        getTeamCorrections(apiFetch, { status: 'pending' }),
        getTeamSummary(apiFetch, { start_date: nDaysAgoISO(30), end_date: today }),
      ]);
      setRecords(recRes.records);
      setLeaves(leaveRes.leaves);
      setCorrections(corrRes.corrections);
      setSummary(summaryRes.summary);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: 'today', label: "Today's Team", badge: records.length },
    { key: 'leaves', label: 'Leave Requests', badge: leaves.length },
    { key: 'corrections', label: 'Corrections', badge: corrections.length },
    { key: 'summary', label: '30-Day Summary' },
  ] as const;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}>
            <Users size={20} className="text-white" />
          </span>
          <div>
            <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Team Attendance</h2>
            <p className="text-slate-500" style={{ fontSize: 12 }}>Manage and approve your team's attendance</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Present Today', value: records.filter(r => ['present', 'work_from_home', 'on_duty'].includes(r.status)).length, color: '#10B981' },
            { label: 'Absent Today', value: records.filter(r => r.status === 'absent').length, color: '#F43F5E' },
            { label: 'Pending Leaves', value: leaves.length, color: '#F59E0B' },
            { label: 'Corrections', value: corrections.length, color: '#6366F1' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: `${s.color}10` }}>
              <p className="font-bold" style={{ fontSize: 20, color: s.color }}>{s.value}</p>
              <p className="text-slate-600 font-medium" style={{ fontSize: 11 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className="flex-1 rounded-lg py-2 font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
            style={{ fontSize: 12, background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1E293B' : '#64748B', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t.label}
            {'badge' in t && (t.badge ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full text-white flex items-center justify-center" style={{ background: '#6366F1', fontSize: 9 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Today */}
      {tab === 'today' && (
        <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>Today — {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          </div>
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading…</div>
          ) : records.length === 0 ? (
            <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No team records found</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}>
                      {(r.employee_name || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                    <div>
                      <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{r.employee_name || r.employee_id}</p>
                      <p className="text-slate-500" style={{ fontSize: 11 }}>
                        {r.check_in ? `In: ${fmtTime(r.check_in)}` : 'Not checked in'}
                        {r.check_out ? ` · Out: ${fmtTime(r.check_out)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.is_late && <span className="text-amber-600 font-medium" style={{ fontSize: 11 }}>Late</span>}
                    {r.net_work_minutes != null && <span className="text-slate-600 font-medium" style={{ fontSize: 12 }}>{fmtMinutes(r.net_work_minutes)}</span>}
                    <StatusPill status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Leaves */}
      {tab === 'leaves' && (
        <ApprovalCard
          title="Pending Leave Requests"
          items={leaves}
          onApprove={(id, remarks) => approveLeave(apiFetch, id, { status: 'approved', remarks }).then(load)}
          onReject={(id, remarks) => approveLeave(apiFetch, id, { status: 'rejected', remarks }).then(load)}
          renderBody={(l: AttendanceLeave) => (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: '#6366F1' }}>
                  {(l.employee_name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{l.employee_name}</p>
                <span className="ml-auto rounded-full px-2 py-0.5 font-medium" style={{ background: '#EFF6FF', color: '#1D4ED8', fontSize: 11 }}>
                  {LEAVE_TYPE_LABELS[l.leave_type]}
                </span>
              </div>
              <p className="text-slate-600" style={{ fontSize: 12 }}>
                {fmtDate(l.start_date)} → {fmtDate(l.end_date)} · <strong>{l.days_count} days</strong>
              </p>
              <p className="text-slate-500 mt-1 italic" style={{ fontSize: 12 }}>"{l.reason}"</p>
            </div>
          )}
        />
      )}

      {/* Tab: Corrections */}
      {tab === 'corrections' && (
        <ApprovalCard
          title="Pending Correction Requests"
          items={corrections}
          onApprove={(id, remarks) => approveCorrection(apiFetch, id, { status: 'approved', remarks }).then(load)}
          onReject={(id, remarks) => approveCorrection(apiFetch, id, { status: 'rejected', remarks }).then(load)}
          renderBody={(c: AttendanceCorrection) => (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: '#F59E0B' }}>
                  {(c.employee_name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{c.employee_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="rounded-lg p-2" style={{ background: '#FFF1F2', fontSize: 11 }}>
                  <p className="font-bold text-red-700 mb-0.5">Original</p>
                  <p className="text-red-600">In: {fmtTime(c.original_check_in)}</p>
                  <p className="text-red-600">Out: {fmtTime(c.original_check_out)}</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: '#ECFDF5', fontSize: 11 }}>
                  <p className="font-bold text-green-700 mb-0.5">Requested</p>
                  <p className="text-green-600">In: {fmtTime(c.requested_check_in)}</p>
                  <p className="text-green-600">Out: {fmtTime(c.requested_check_out)}</p>
                </div>
              </div>
              <p className="text-slate-500 mt-2 italic" style={{ fontSize: 12 }}>"{c.reason}"</p>
            </div>
          )}
        />
      )}

      {/* Tab: Summary */}
      {tab === 'summary' && (
        <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>30-Day Team Summary</h3>
          </div>
          {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: 12 }}>
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Employee', 'Present', 'Absent', 'Half Day', 'Leave', 'Late', 'Work Hours', 'OT Hours'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.employee_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.employee_name}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{row.present_days}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">{row.absent_days}</td>
                      <td className="px-4 py-3 text-amber-600 font-medium">{row.half_days}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{row.leave_days}</td>
                      <td className="px-4 py-3 text-orange-500 font-medium">{row.late_arrivals}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{fmtMinutes(row.total_work_minutes)}</td>
                      <td className="px-4 py-3 text-indigo-600 font-medium">{fmtMinutes(row.total_ot_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
