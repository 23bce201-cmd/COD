import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

export const fmtK = (num: number) => `$${(num / 1000).toFixed(1)}k`;
export const fmtFull = (num: number) => `$${num.toLocaleString()}`;

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    Active: { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
    Paused: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
    Setup: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
    Synced: { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
    Warning: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
    Error: { bg: "#FFF1F2", text: "#9F1239", dot: "#F43F5E" },
  };
  const s = map[status] || map.Setup;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium" style={{ background: s.bg, color: s.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

export function StatCard({ label, value, sub, up }: { label: string; value: string; sub: string; up: boolean }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 flex-1" style={{ border: "1px solid #E2E8F0" }}>
      <span className="text-slate-500 font-medium" style={{ fontSize: 12 }}>{label}</span>
      <span className="text-slate-900 font-bold" style={{ fontSize: 22 }}>{value}</span>
      <div className="flex items-center gap-1">
        {up ? (
          <ArrowUpRight size={12} style={{ color: "#10B981" }} />
        ) : (
          <ArrowDownRight size={12} style={{ color: "#F43F5E" }} />
        )}
        <span className="font-medium" style={{ fontSize: 11, color: up ? "#10B981" : "#F43F5E" }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

export function DashboardOverviewD({ onSection }: { onSection: (s: string) => void }) {
  const navigate = useNavigate();
  const { apiFetch, user } = useAuth();
  const canAddClient = user?.role === "admin";
  
  const [metrics, setMetrics] = useState<any>({ total_spend: 0, avg_roas: 0, active_clients: 0, total_campaigns: 0 });
  const [clients, setClients] = useState<any[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<any[]>([]);
  const [platformPie, setPlatformPie] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/dashboard/agency").then(res => res.json()).then(setMetrics);
    apiFetch("/api/clients").then(res => res.json()).then(data => setClients((data.clients || []).slice(0, 5)));
    apiFetch("/api/charts/agency-spend").then(res => res.json()).then(data => {
      if (data.data) {
         setPlatformPie(data.data.map((d: any) => ({
           name: d.platform,
           value: Number(d.spend),
           color: d.platform === 'google_ads' ? '#6366F1' : d.platform === 'meta_ads' ? '#EC4899' : '#F59E0B'
         })));
      }
    });
  }, [apiFetch]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Good morning, {user?.name || "User"} 👋</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Bright Agency</p>
        </div>
        {canAddClient && (
          <button
            onClick={() => navigate("/agency/add-client")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors"
            style={{ background: "#6366F1", fontSize: 12 }}
          >
            <Plus size={13} /> Add Client
          </button>
        )}
      </div>

      {/* 4 stat cards */}
      <div className="flex gap-3">
        <StatCard label="Total Spend (Mar)" value={fmtK(metrics.total_spend)} sub="" up={true} />
        <StatCard label="Avg ROAS" value={`${metrics.avg_roas}×`} sub="" up={true} />
        <StatCard label="Active Clients" value={String(metrics.active_clients)} sub="" up={true} />
        <StatCard label="Total Campaigns" value={String(metrics.total_campaigns)} sub="" up={true} />
      </div>

      {/* Charts row */}
      <div className="flex gap-3">
        <div className="bg-white rounded-xl p-4 flex-1" style={{ border: "1px solid #E2E8F0" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Monthly Spend by Platform</span>
            <span className="text-slate-400" style={{ fontSize: 11 }}>Oct – Mar</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlySpend} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar dataKey="google" name="Google Ads" fill="#6366F1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="meta" name="Meta Ads" fill="#EC4899" radius={[3, 3, 0, 0]} />
              <Bar dataKey="mailchimp" name="Mailchimp" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 flex flex-col" style={{ width: 200, border: "1px solid #E2E8F0" }}>
          <span className="text-slate-800 font-semibold mb-3" style={{ fontSize: 13 }}>Spend Breakdown</span>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={platformPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                {platformPie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client table */}
      <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Clients Overview</span>
          <button onClick={() => onSection("Clients")} className="text-slate-500 hover:text-indigo-600 cursor-pointer" style={{ fontSize: 12 }}>View all →</button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Client", "Industry", "Spend", "ROAS", "Leads", "Campaigns", "Status"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-slate-500 font-semibold" style={{ fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const spend = parseFloat(c.total_spend || '0');
              const revenue = parseFloat(c.total_revenue || '0');
              const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
              const leads = parseInt(c.total_leads || '0');
              
              return (
                <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#6366F1", fontSize: 9 }}>{c.name.substring(0, 2).toUpperCase()}</div>
                      <span className="text-slate-800 font-medium" style={{ fontSize: 12 }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500" style={{ fontSize: 12 }}>{c.industry || 'N/A'}</td>
                  <td className="px-4 py-2.5 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtK(spend)}</td>
                  <td className="px-4 py-2.5 text-slate-800" style={{ fontSize: 12 }}>{roas}</td>
                  <td className="px-4 py-2.5 text-slate-800" style={{ fontSize: 12 }}>{leads.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-800" style={{ fontSize: 12 }}>{c.campaign_count || 0}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.onboarding_status === 'active' ? 'Active' : 'Setup'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardOverviewM() {
  const { apiFetch, user } = useAuth();
  const [metrics, setMetrics] = useState<any>({ total_spend: 0, avg_roas: 0, active_clients: 0, total_campaigns: 0 });
  const [clients, setClients] = useState<any[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/dashboard/agency").then(res => res.json()).then(setMetrics);
    apiFetch("/api/clients").then(res => res.json()).then(data => setClients((data.clients || []).slice(0, 4)));
  }, [apiFetch]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="text-slate-800 font-bold" style={{ fontSize: 15 }}>Good morning, {user?.name || "User"} 👋</p>
        <p className="text-slate-400" style={{ fontSize: 11 }}>Bright Agency</p>
      </div>
      {/* 2×2 stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Total Spend", value: fmtK(metrics.total_spend), up: true },
          { label: "Avg ROAS", value: `${metrics.avg_roas}×`, up: false },
          { label: "Active Clients", value: String(metrics.active_clients), up: true },
          { label: "Campaigns", value: String(metrics.total_campaigns), up: true },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
            <p className="text-slate-400" style={{ fontSize: 10 }}>{s.label}</p>
            <p className="text-slate-900 font-bold mt-0.5" style={{ fontSize: 17 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: s.up ? "#10B981" : "#F43F5E" }}>{s.up ? "↑" : "↓"} vs last month</p>
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
        <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 12 }}>Monthly Spend</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={monthlySpend} barSize={6}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
            <Bar dataKey="google" fill="#6366F1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="meta" fill="#EC4899" radius={[2, 2, 0, 0]} />
            <Bar dataKey="mailchimp" fill="#F59E0B" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Client list */}
      <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
        <div className="px-3 py-2.5 border-b border-slate-100">
          <span className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Clients</span>
        </div>
        {clients.slice(0, 4).map((c) => {
          const spend = parseFloat(c.total_spend || '0');
          const revenue = parseFloat(c.total_revenue || '0');
          const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
          
          return (
            <div key={c.id} className="flex items-center justify-between px-3 py-2.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#6366F1", fontSize: 9 }}>
                  {c.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-slate-800 font-medium" style={{ fontSize: 11 }}>{c.name}</p>
                  <p className="text-slate-400" style={{ fontSize: 10 }}>{fmtK(spend)} · {roas} ROAS</p>
                </div>
              </div>
              <StatusBadge status={c.onboarding_status === 'active' ? 'Active' : 'Setup'} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
