import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Clock, Download, Briefcase, BarChart2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { ClientTimesheetRow, ClientTimesheetSummary } from './attendance.types';
import { getProjectTimesheets, fmtMinutes, fmtDate, todayISO, nDaysAgoISO } from './attendance.api';

export function ClientView() {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<'summary' | 'details'>('summary');
  const [timesheets, setTimesheets] = useState<ClientTimesheetRow[]>([]);
  const [summary, setSummary] = useState<ClientTimesheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: nDaysAgoISO(30), end: todayISO() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProjectTimesheets(apiFetch, { start_date: dateRange.start, end_date: dateRange.end });
      setTimesheets(res.timesheets);
      setSummary(res.summary);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, dateRange]);

  useEffect(() => { load(); }, [load]);

  const totalMinutes = summary.reduce((acc, s) => acc + s.total_minutes, 0);

  function exportCSV() {
    if (timesheets.length === 0) return toast.error('No data to export');
    const header = ['Date', 'Employee', 'Campaign', 'Work Mode', 'Hours', 'Minutes'].join(',');
    const rows = timesheets.map(t => 
      [t.date, `"${t.employee_name}"`, `"${t.campaign_name}"`, t.work_mode, t.hours, t.net_work_minutes].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets_${dateRange.start}_${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0284C7, #38BDF8)' }}>
              <Clock size={20} className="text-white" />
            </span>
            <div>
              <h2 className="text-slate-800 font-bold" style={{ fontSize: 16 }}>Project Timesheets</h2>
              <p className="text-slate-500" style={{ fontSize: 12 }}>View hours logged by the agency team on your campaigns</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(r => ({ ...r, start: e.target.value }))}
                className="rounded-lg px-2 py-1.5 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 12 }} />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(r => ({ ...r, end: e.target.value }))}
                className="rounded-lg px-2 py-1.5 outline-none" style={{ border: '1px solid #E2E8F0', fontSize: 12 }} />
            </div>
            <button type="button" onClick={exportCSV} className="rounded-lg p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200" title="Export CSV">
              <Download size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
        <button type="button" onClick={() => setTab('summary')}
          className="flex-1 rounded-lg py-2 font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
          style={{ fontSize: 12, background: tab === 'summary' ? 'white' : 'transparent', color: tab === 'summary' ? '#1E293B' : '#64748B', boxShadow: tab === 'summary' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
          <Briefcase size={14} /> Summary
        </button>
        <button type="button" onClick={() => setTab('details')}
          className="flex-1 rounded-lg py-2 font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
          style={{ fontSize: 12, background: tab === 'details' ? 'white' : 'transparent', color: tab === 'details' ? '#1E293B' : '#64748B', boxShadow: tab === 'details' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
          <BarChart2 size={14} /> Detailed Log
        </button>
      </div>

      {tab === 'summary' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E2E8F0' }}>
            <h3 className="text-slate-800 font-bold mb-1" style={{ fontSize: 14 }}>Total Hours Billed</h3>
            <p className="text-sky-600 font-bold" style={{ fontSize: 32 }}>{fmtMinutes(totalMinutes)}</p>
          </div>
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-slate-800 font-bold" style={{ fontSize: 14 }}>By Team Member</h3>
            </div>
            {loading ? <div className="text-center text-slate-400 py-8">Loading…</div> : (
              <div className="divide-y divide-slate-50">
                {summary.length === 0 ? (
                  <div className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No hours logged in this period</div>
                ) : summary.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: '#0284C7' }}>
                        {s.employee_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>{s.employee_name}</p>
                        <p className="text-slate-500" style={{ fontSize: 11 }}>{s.days_worked} days logged</p>
                      </div>
                    </div>
                    <p className="text-slate-800 font-bold" style={{ fontSize: 14 }}>{fmtMinutes(s.total_minutes)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'details' && (
        <div className="bg-white rounded-2xl" style={{ border: '1px solid #E2E8F0' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-slate-500 font-semibold">Date</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-semibold">Employee</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-semibold">Campaign</th>
                  <th className="text-left px-5 py-3 text-slate-500 font-semibold">Mode</th>
                  <th className="text-right px-5 py-3 text-slate-500 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">Loading…</td></tr>
                ) : timesheets.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">No records found</td></tr>
                ) : timesheets.map((t, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-600">{fmtDate(t.date)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{t.employee_name}</td>
                    <td className="px-5 py-3 text-slate-600">{t.campaign_name}</td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5" style={{ fontSize: 10 }}>
                        {t.work_mode.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-700">{t.hours.toFixed(2)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
