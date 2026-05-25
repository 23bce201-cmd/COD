import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Cloud, Bell, Download, ArrowUpRight, ArrowDownRight,
  ChevronDown, LayoutDashboard, FileBarChart, LogOut,
} from "lucide-react";
import { clientPerformance, platformPie, campaigns, fmtK, fmtFull } from "../../hifi/mockData";
import { useAuth } from "../../../context/AuthContext";
import { Reports } from "../reports/Reports";
import { SyncStatusD, SyncStatusM } from "../integrations/SyncStatus";
import { RefreshCw } from "lucide-react";

export type Section = "Dashboard" | "Reports" | "Sync Status";
type Range = "Week" | "Month" | "3 Months" | "Custom";

/* ── Shared atoms ──────────────────────────────────────────── */
function StatCard({ label, value, change, up }: { label: string; value: string; change: string; up: boolean }) {
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
          {change}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    Active: { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
    Paused: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B" },
  };
  const s = map[status] || { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium" style={{ background: s.bg, color: s.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Google Ads": { bg: "#EEF2FF", color: "#4338CA" },
    "Meta Ads": { bg: "#FDF2F8", color: "#9D174D" },
    "Mailchimp": { bg: "#FFFBEB", color: "#92400E" },
  };
  const s = map[platform] || { bg: "#F1F5F9", color: "#475569" };
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 font-medium" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
      {platform}
    </span>
  );
}

/* ─── Desktop ──────────────────────────────────────────────── */
function Desktop({ section, onSection }: { section: Section; onSection: (s: Section) => void }) {
  const [range, setRange] = useState<Range>("Month");
  const clientCampaigns = campaigns.filter((c) => c.client === "Apex Media");
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex flex-col bg-white" style={{ minHeight: "100vh" }}>
      {/* Top nav — client-facing (no inner sidebar) */}
      <div
        className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
        style={{ background: "#1E293B", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="rounded-lg p-1.5" style={{ background: "#6366F1" }}>
            <Cloud size={13} className="text-white" />
          </div>
          <span className="text-white font-bold" style={{ fontSize: 13 }}>CloudCRM</span>
        </div>

        {/* Client name */}
        <div className="h-4 w-px bg-white/20 mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#6366F1", fontSize: 9 }}>AM</div>
          <span className="text-white font-medium" style={{ fontSize: 13 }}>Apex Media</span>
          <ChevronDown size={12} className="text-slate-400" />
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1 ml-4">
          {[
            { icon: LayoutDashboard, label: "Dashboard" as Section },
            { icon: FileBarChart, label: "Reports" as Section },
            { icon: RefreshCw, label: "Sync Status" as Section },
          ].map(({ icon: Icon, label }) => {
            const active = section === label;
            return (
              <button
                key={label}
                onClick={() => onSection(label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                style={{
                  fontSize: 12,
                  background: active ? "rgba(99,102,241,0.25)" : "transparent",
                  color: active ? "#A5B4FC" : "#94A3B8",
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
        <Bell size={15} className="text-slate-400" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 border border-white/20 rounded-lg px-2.5 py-1.5 text-slate-400 cursor-pointer hover:text-white hover:border-white/40 transition-colors"
          style={{ fontSize: 11 }}
        >
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col" style={{ background: "#F8FAFC" }}>
        {section === "Dashboard" && (
          <div className="p-6 flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-slate-900 font-bold" style={{ fontSize: 20 }}>My Performance Dashboard</h1>
                <p className="text-slate-500" style={{ fontSize: 12 }}>Managed by Bright Agency · March 2026</p>
              </div>
              {/* Date range tabs */}
              <div className="flex rounded-lg p-1 gap-1" style={{ background: "#E2E8F0" }}>
                {(["Week", "Month", "3 Months", "Custom"] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer"
                    style={{
                      fontSize: 11,
                      background: range === r ? "#fff" : "transparent",
                      color: range === r ? "#1E293B" : "#64748B",
                      boxShadow: range === r ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 stat cards */}
            <div className="flex gap-3">
              <StatCard label="Total Spent" value="$31,100" change="+18% vs last month" up={true} />
              <StatCard label="Leads Generated" value="319" change="+42 vs last month" up={true} />
              <StatCard label="People Reached" value="198.2k" change="-3% vs last month" up={false} />
              <StatCard label="Cost Per Lead" value="$97.49" change="-$8 vs last month" up={true} />
            </div>

            {/* Charts row */}
            <div className="flex gap-4">
              {/* Line chart */}
              <div className="bg-white rounded-xl p-5 flex-1" style={{ border: "1px solid #E2E8F0" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Performance Over Time</span>
                  <div className="flex items-center gap-4">
                    {[["Spend", "#6366F1"], ["Leads", "#10B981"]].map(([n, c]) => (
                      <div key={n} className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 rounded-full" style={{ background: c }} />
                        <span className="text-slate-500" style={{ fontSize: 11 }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={clientPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="spend" orientation="left" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <YAxis yAxisId="leads" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "spend" ? [fmtFull(value), "Spend"] : [value, "Leads"]
                      }
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
                    />
                    <Line yAxisId="spend" type="monotone" dataKey="spend" stroke="#6366F1" strokeWidth={2} dot={{ r: 3, fill: "#6366F1" }} />
                    <Line yAxisId="leads" type="monotone" dataKey="leads" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Donut chart */}
              <div className="bg-white rounded-xl p-5 flex flex-col" style={{ width: 220, border: "1px solid #E2E8F0" }}>
                <span className="text-slate-800 font-semibold mb-3" style={{ fontSize: 13 }}>Spend by Platform</span>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={platformPie} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={4}>
                      {platformPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtK(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-auto">
                  {platformPie.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-slate-500" style={{ fontSize: 11 }}>{d.name}</span>
                      </div>
                      <span className="text-slate-800 font-semibold" style={{ fontSize: 11 }}>{fmtK(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Campaigns table */}
            <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <span className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>My Campaigns</span>
                <button
                  className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  style={{ fontSize: 11 }}
                >
                  <Download size={12} /> Download Monthly Report
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Campaign", "Platform", "Money Spent", "Leads", "Reach", "Cost/Lead", "Status"].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-slate-500 font-semibold" style={{ fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientCampaigns.map((c) => (
                    <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-800 font-medium" style={{ fontSize: 12 }}>{c.name}</td>
                      <td className="px-5 py-3"><PlatformBadge platform={c.platform} /></td>
                      <td className="px-5 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtFull(c.spend)}</td>
                      <td className="px-5 py-3 text-slate-800" style={{ fontSize: 12 }}>{c.leads}</td>
                      <td className="px-5 py-3 text-slate-800" style={{ fontSize: 12 }}>
                        {(c.leads * 620).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-slate-800" style={{ fontSize: 12 }}>
                        ${Math.round(c.spend / c.leads)}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {section === "Reports" && (
          <div className="p-6 max-w-[1200px] mx-auto w-full">
            <Reports />
          </div>
        )}
        
        {section === "Sync Status" && (
          <div className="p-6 max-w-[1200px] mx-auto w-full">
            <SyncStatusD />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Mobile ───────────────────────────────────────────────── */
function Mobile({ section, onSection }: { section: Section; onSection: (s: Section) => void }) {
  const [range, setRange] = useState<"Wk" | "Mo" | "3Mo">("Mo");
  const clientCampaigns = campaigns.filter((c) => c.client === "Apex Media");

  return (
    <div className="flex flex-col bg-white" style={{ minHeight: 720 }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ background: "#1E293B" }}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-md p-1" style={{ background: "#6366F1" }}>
            <Cloud size={12} className="text-white" />
          </div>
          <span className="text-white font-bold" style={{ fontSize: 13 }}>Apex Media</span>
        </div>
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-slate-400" />
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#6366F1", fontSize: 9 }}>AM</div>
        </div>
      </div>

      {/* Section Nav */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "#E2E8F0" }}>
          {(["Dashboard", "Reports", "Sync Status"] as Section[]).map((r) => (
            <button
              key={r}
              onClick={() => onSection(r)}
              className="flex-1 rounded-md py-1.5 font-medium transition-all cursor-pointer"
              style={{
                fontSize: 11,
                background: section === r ? "#fff" : "transparent",
                color: section === r ? "#1E293B" : "#64748B",
              }}
            >
              {r === "Sync Status" ? "Sync" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-auto" style={{ background: "#F8FAFC" }}>
        {section === "Dashboard" && (
          <div className="flex flex-col gap-3 p-3">
            {/* 2×2 stat grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total Spent", value: "$31.1k", up: true },
                { label: "Leads", value: "319", up: true },
                { label: "Reach", value: "198.2k", up: false },
                { label: "Cost/Lead", value: "$97.49", up: true },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
                  <p className="text-slate-500" style={{ fontSize: 10 }}>{s.label}</p>
                  <p className="text-slate-900 font-bold mt-0.5" style={{ fontSize: 18 }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: s.up ? "#10B981" : "#F43F5E" }}>
                    {s.up ? "↑" : "↓"} vs last period
                  </p>
                </div>
              ))}
            </div>

            {/* Line chart */}
            <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Performance Over Time</p>
              </div>
              <div className="flex items-center gap-3 mb-2">
                {[["Spend", "#6366F1"], ["Leads", "#10B981"]].map(([n, c]) => (
                  <div key={n} className="flex items-center gap-1">
                    <div className="w-2.5 h-0.5 rounded-full" style={{ background: c }} />
                    <span className="text-slate-500" style={{ fontSize: 10 }}>{n}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={clientPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === "spend" ? [fmtK(value), "Spend"] : [value, "Leads"]
                    }
                    contentStyle={{ fontSize: 10, borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="spend" stroke="#6366F1" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="leads" stroke="#10B981" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Donut chart */}
            <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
              <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 12 }}>Spend by Platform</p>
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={110} height={90}>
                  <PieChart>
                    <Pie data={platformPie} cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" paddingAngle={3}>
                      {platformPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {platformPie.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-slate-500" style={{ fontSize: 10 }}>{d.name}</span>
                      <span className="text-slate-800 font-semibold ml-auto" style={{ fontSize: 10 }}>{fmtK(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Campaign cards */}
            <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
              <div className="px-3 py-2.5 border-b border-slate-100">
                <p className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>My Campaigns</p>
              </div>
              {clientCampaigns.map((c) => (
                <div key={c.id} className="px-3 py-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <PlatformBadge platform={c.platform} />
                  <div className="flex gap-4 mt-2">
                    {[["Spent", fmtFull(c.spend)], ["Leads", c.leads], ["CPL", `$${Math.round(c.spend / c.leads)}`]].map(([l, v]) => (
                      <div key={String(l)}>
                        <p className="text-slate-400" style={{ fontSize: 9 }}>{l}</p>
                        <p className="text-slate-800 font-semibold" style={{ fontSize: 11 }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Download */}
            <button
              className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2 border border-slate-200 text-slate-700 bg-white"
              style={{ fontSize: 13 }}
            >
              <Download size={14} /> Download Monthly Report
            </button>
          </div>
        )}
        
        {section === "Reports" && (
          <div className="p-3 w-full">
            <Reports />
          </div>
        )}
        
        {section === "Sync Status" && (
          <div className="p-3 w-full">
            <SyncStatusM />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Export ───────────────────────────────────────────────── */
const urlToSection = (tab?: string): Section => {
  switch (tab) {
    case "reports": return "Reports";
    case "sync-status": return "Sync Status";
    default: return "Dashboard";
  }
};

const sectionToUrl = (section: Section): string => {
  switch (section) {
    case "Reports": return "reports";
    case "Sync Status": return "sync-status";
    default: return "dashboard";
  }
};

export function ClientDashboard() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const section = urlToSection(tab);

  const handleSectionChange = (s: Section) => {
    navigate(`/client/${sectionToUrl(s)}`);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 relative">
      <div className="hidden md:block w-full">
        <Desktop section={section} onSection={handleSectionChange} />
      </div>
      <div className="block md:hidden w-full">
        <Mobile section={section} onSection={handleSectionChange} />
      </div>
    </div>
  );
}