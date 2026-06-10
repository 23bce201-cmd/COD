// Manager dashboard shell with scoped client routes, Reports, and Email automation navigation.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronUp,
  Cloud,
  FileBarChart,
  Kanban as KanbanIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Reports } from "../reports/Reports";
import { EmailCenter } from "../email/EmailCenter";
import { SettingsD, SettingsM } from "../settings/Settings";
import { SyncStatusD, SyncStatusM } from "../integrations/SyncStatus";
import { KanbanBoard } from "../kanban/KanbanBoard";
import { PageTransition, TableSkeleton, useDelayedLoading } from "../../ui/LoadingSkeletons";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb";
import {
  CampaignCompareBar,
  CompareCheckbox,
  CustomizableMetricGrid,
  RoleCampaignComparisonPage,
  roleCompareCampaigns,
  useCampaignCompareSelection,
} from "./RoleDashboardTools";

type ManagerClient = {
  id: string;
  name: string;
  industry?: string | null;
  monthly_budget?: number | string | null;
  onboarding_status?: string | null;
  total_spend?: number | string | null;
  total_leads?: number | string | null;
  total_revenue?: number | string | null;
  campaign_count?: number | string | null;
};

type AssignedEmployee = {
  id: string;
  name: string;
};

type CampaignRow = {
  id: string;
  client_id: string;
  client_name?: string | null;
  name: string;
  platform: string;
  status: string;
  budget?: number | string | null;
  total_spend?: number | string | null;
  total_leads?: number | string | null;
  total_clicks?: number | string | null;
  total_impressions?: number | string | null;
  total_conversions?: number | string | null;
  total_revenue?: number | string | null;
  assigned_employees?: AssignedEmployee[];
};

type MetricRow = {
  date: string;
  period?: string;
  spend?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  leads?: number | string | null;
  reach?: number | string | null;
  conversions?: number | string | null;
  revenue?: number | string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  roas?: number | string | null;
};

type CampaignDetail = CampaignRow & {
  start_date?: string | null;
  end_date?: string | null;
};

type DashboardTab = "dashboard" | "reports" | "sync-status" | "settings";
type RangeKey = "7D" | "30D" | "3M" | "6M";
type MetricKey = "spend" | "roas" | "leads" | "conversions";
type StatusFilter = "all" | "active" | "paused" | "completed";
type SortKey = "name" | "employee" | "status" | "spend" | "conversions" | "roas" | "ctr";

const PRIMARY = "#6366F1";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";
const DANGER = "#F43F5E";
const PINK = "#EC4899";
const TEAL = "#0F766E";
const CLIENT_ACCENTS = [PRIMARY, PINK, WARNING, SUCCESS, TEAL];

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtMoney(value: number, compact = true) {
  if (!compact) return `$${Math.round(value).toLocaleString()}`;
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}m`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

function fmtNumber(value: number) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function fmtPct(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function fmtRoas(value: number) {
  return `${value.toFixed(2)}x`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CL";
}

function clientAccent(index: number) {
  return CLIENT_ACCENTS[index % CLIENT_ACCENTS.length];
}

function platformLabel(platform: string) {
  const map: Record<string, string> = {
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
    linkedin_ads: "LinkedIn Ads",
    twitter_ads: "Twitter Ads",
    mailchimp: "Mailchimp",
    manual: "Manual",
  };
  return map[platform] || platform;
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "completed" || status === "ended") return "Ended";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Ended";
}

function dateToInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function rangeBounds(range: RangeKey) {
  const to = new Date();
  const from = new Date(to);
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "3M" ? 90 : 180;
  from.setDate(to.getDate() - days);
  return {
    from: dateToInput(from),
    to: dateToInput(to),
    bucket: range === "7D" || range === "30D" ? "day" : "month",
  };
}

function withManagerId(path: string, managerId?: string) {
  if (!managerId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}manager_id=${encodeURIComponent(managerId)}`;
}

function campaignCtr(campaign: CampaignRow) {
  const impressions = n(campaign.total_impressions);
  return impressions > 0 ? (n(campaign.total_clicks) / impressions) * 100 : 0;
}

function campaignRoas(campaign: CampaignRow) {
  const spend = n(campaign.total_spend);
  return spend > 0 ? n(campaign.total_revenue) / spend : 0;
}

function metricFromRow(row: MetricRow, key: MetricKey) {
  return n(row[key]);
}

function normalizeTrend(rows: MetricRow[]) {
  return rows.map((row) => ({
    ...row,
    label: new Date(row.period || row.date).toLocaleDateString("en-US", {
      month: "short",
      day: row.period ? undefined : "numeric",
    }),
    spend: n(row.spend),
    leads: n(row.leads),
    conversions: n(row.conversions),
    ctr: n(row.ctr),
    cpc: n(row.cpc),
    roas: n(row.roas),
    impressions: n(row.impressions),
    clicks: n(row.clicks),
    reach: n(row.reach),
    revenue: n(row.revenue),
  }));
}

function trendDelta(rows: MetricRow[], key: MetricKey) {
  if (rows.length < 2) return { value: "No prior period", up: true };
  const half = Math.max(1, Math.floor(rows.length / 2));
  const previous = rows.slice(0, half).reduce((sum, row) => sum + metricFromRow(row, key), 0);
  const current = rows.slice(half).reduce((sum, row) => sum + metricFromRow(row, key), 0);
  if (previous === 0) return { value: current > 0 ? "+100%" : "0%", up: true };
  const delta = ((current - previous) / previous) * 100;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`, up: delta >= 0 };
}

function StatCard({
  label,
  value,
  delta,
  up,
  delay = 0,
}: {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  delay?: number;
}) {
  return (
    <Card
      className="rounded-xl bg-white p-4 gap-2 transition-all duration-150 hover:-translate-y-0.5"
      style={{ border: "1px solid #E2E8F0", animationDelay: `${delay}ms` }}
    >
      <span className="text-slate-500 font-semibold uppercase tracking-wide" style={{ fontSize: 11 }}>{label}</span>
      <span className="text-slate-900 font-semibold font-mono tabular-nums" style={{ fontSize: 24 }}>{value}</span>
      <div className="flex items-center gap-1">
        {up ? <ArrowUpRight size={12} style={{ color: SUCCESS }} /> : <ArrowDownRight size={12} style={{ color: DANGER }} />}
        <span className="font-medium" style={{ fontSize: 11, color: up ? SUCCESS : DANGER }}>{delta}</span>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    Active: { bg: "#ECFDF5", text: "#065F46", dot: SUCCESS },
    Paused: { bg: "#FFFBEB", text: "#92400E", dot: WARNING },
    Ended: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  };
  const c = colors[label] || colors.Ended;
  return (
    <Badge className="rounded-full border-0 px-2 py-0.5 gap-1.5" style={{ background: c.bg, color: c.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {label}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const label = platformLabel(platform);
  const map: Record<string, { bg: string; color: string }> = {
    "Google Ads": { bg: "#EEF2FF", color: "#4338CA" },
    "Meta Ads": { bg: "#FDF2F8", color: "#9D174D" },
    "LinkedIn Ads": { bg: "#F0F9FF", color: "#0369A1" },
    "Twitter Ads": { bg: "#F0FDFA", color: TEAL },
    Mailchimp: { bg: "#FFFBEB", color: "#92400E" },
    Manual: { bg: "#F1F5F9", color: "#475569" },
  };
  const c = map[label] || map.Manual;
  return (
    <Badge className="rounded px-2 py-0.5 border-0" style={{ background: c.bg, color: c.color, fontSize: 11 }}>
      {label}
    </Badge>
  );
}

function ChartCard({ title, children, right, ariaLabel }: { title: string; children: ReactNode; right?: ReactNode; ariaLabel: string }) {
  return (
    <Card className="bg-white rounded-xl p-4 gap-3 min-w-0" style={{ border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{title}</h2>
        {right}
      </div>
      <div aria-label={ariaLabel} role="img" className="min-h-0">
        {children}
      </div>
    </Card>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-8 text-center text-slate-400" style={{ border: "1px solid #E2E8F0", fontSize: 13 }}>
      {children}
    </div>
  );
}

function PacingBar({ label, value, accent, budget }: { label: string; value: number; accent: string; budget: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
          <span className="text-slate-700 font-medium truncate" style={{ fontSize: 12 }}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {clamped > 90 && <AlertTriangle size={12} style={{ color: WARNING }} />}
          <span className="text-slate-500 font-semibold" style={{ fontSize: 11 }}>{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} budget pacing`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, background: accent }} />
      </div>
      <span className="text-slate-400" style={{ fontSize: 10 }}>{fmtMoney(budget, false)} monthly budget</span>
    </div>
  );
}

function Sparkline({ data, color, dataKey, label }: { data: MetricRow[]; color: string; dataKey: "ctr" | "cpc"; label: string }) {
  const normalized = normalizeTrend(data);
  return (
    <div className="h-12" aria-label={label} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalized}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} dot={false} isAnimationActive />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Avatar({ name, accent, size = 28 }: { name: string; accent: string; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: accent, fontSize: Math.max(9, size / 3) }}
    >
      {initials(name)}
    </span>
  );
}

function ManagerBreadcrumbs({ clients, campaigns }: { clients: ManagerClient[]; campaigns: CampaignRow[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
  const clientId = parts[2] === "clients" ? parts[3] : undefined;
  const campaignId = parts[4] === "campaigns" ? parts[5] : undefined;
  const client = clients.find((item) => item.id === clientId);
  const campaign = campaigns.find((item) => item.id === campaignId);

  if (parts[1] === "kanban" || parts[1] === "reports" || parts[1] === "sync-status" || parts[1] === "settings") {
    const label = parts[1] === "sync-status" ? "Sync Status" : parts[1] === "kanban" ? "Kanban Board" : parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return (
      <Breadcrumb>
        <BreadcrumbList className="text-slate-500" style={{ fontSize: 12 }}>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button onClick={() => navigate("/manager/dashboard")} className="hover:text-indigo-600 transition-colors">Dashboard</button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage className="text-slate-800">{label}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-slate-500" style={{ fontSize: 12 }}>
        <BreadcrumbItem>
          {clientId ? (
            <BreadcrumbLink asChild>
              <button onClick={() => navigate("/manager/dashboard")} className="hover:text-indigo-600 transition-colors">Dashboard</button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="text-slate-800">Dashboard</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {clientId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {campaignId ? (
                <BreadcrumbLink asChild>
                  <button onClick={() => navigate(`/manager/clients/${clientId}`)} className="hover:text-indigo-600 transition-colors">
                    {client?.name || "Client"}
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-slate-800">{client?.name || "Client"}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {campaignId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage className="text-slate-800">{campaign?.name || "Campaign"}</BreadcrumbPage></BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ManagerOverview({
  clients,
  campaigns,
  loading,
  search,
}: {
  clients: ManagerClient[];
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
}) {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("6M");
  const [metric, setMetric] = useState<MetricKey>("conversions");
  const [trend, setTrend] = useState<MetricRow[]>([]);
  const [sparkData, setSparkData] = useState<Record<string, MetricRow[]>>({});
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const { from, to, bucket } = rangeBounds(range);
    setTrendLoading(true);
    apiFetch(withManagerId(`/api/charts/manager-performance?from=${from}&to=${to}&bucket=${bucket}`, user.id))
      .then((res) => {
        if (res.status === 403) {
          toast.error("Access denied");
          navigate("/manager/dashboard");
          return { data: [] };
        }
        return res.json();
      })
      .then((data) => setTrend(data.data || []))
      .finally(() => setTrendLoading(false));
  }, [apiFetch, navigate, range, user?.id]);

  useEffect(() => {
    if (!user?.id || clients.length === 0) return;
    const { from, to } = rangeBounds("7D");
    Promise.all(
      clients.slice(0, 6).map((client) =>
        apiFetch(withManagerId(`/api/charts/performance?client_id=${client.id}&from=${from}&to=${to}`, user.id))
          .then((res) => (res.ok ? res.json() : { data: [] }))
          .then((data) => [client.id, data.data || []] as const)
      )
    ).then((entries) => {
      setSparkData(Object.fromEntries(entries));
    });
  }, [apiFetch, clients, user?.id]);

  const chartData = useMemo(() => normalizeTrend(trend), [trend]);
  const totals = useMemo(() => {
    const totalSpend = clients.reduce((sum, client) => sum + n(client.total_spend), 0);
    const totalRevenue = clients.reduce((sum, client) => sum + n(client.total_revenue), 0);
    const totalLeads = clients.reduce((sum, client) => sum + n(client.total_leads), 0);
    const conversions = campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0);
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
    return {
      totalSpend,
      totalRevenue,
      totalLeads,
      conversions,
      activeCampaigns,
      avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    };
  }, [campaigns, clients]);

  const filteredClients = clients.filter((client) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return client.name.toLowerCase().includes(q) || (client.industry || "").toLowerCase().includes(q);
  });

  const showSkeleton = useDelayedLoading(loading || trendLoading, 100);
  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
        <TableSkeleton cols={5} rows={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Manager Dashboard</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>{clients.length} assigned clients - {campaigns.length} visible campaigns</p>
        </div>
        <div className="flex rounded-lg p-1 gap-1 bg-slate-200">
          {(["7D", "30D", "3M", "6M"] as RangeKey[]).map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer"
              style={{
                fontSize: 11,
                background: range === item ? "#fff" : "transparent",
                color: range === item ? "#1E293B" : "#64748B",
                boxShadow: range === item ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <CustomizableMetricGrid
        storageKey={`manager_dashboard_layout_${user?.id || "default"}`}
        columnsClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3"
        metrics={[
          { key: "spend", label: "Total spend", value: fmtMoney(totals.totalSpend), rawValue: totals.totalSpend, delta: trendDelta(trend, "spend").value, up: trendDelta(trend, "spend").up },
          { key: "conversions", label: "Conversions", value: fmtNumber(totals.conversions), rawValue: totals.conversions, delta: trendDelta(trend, "conversions").value, up: trendDelta(trend, "conversions").up },
          { key: "leads", label: "Leads", value: fmtNumber(totals.totalLeads), rawValue: totals.totalLeads, delta: trendDelta(trend, "leads").value, up: trendDelta(trend, "leads").up },
          { key: "roas", label: "Avg ROAS", value: fmtRoas(totals.avgRoas), rawValue: totals.avgRoas, delta: trendDelta(trend, "roas").value, up: trendDelta(trend, "roas").up },
          { key: "active", label: "Active campaigns", value: String(totals.activeCampaigns), rawValue: totals.activeCampaigns, delta: `${campaigns.length} total`, up: true },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        <ChartCard
          title="Campaign performance trend"
          ariaLabel="Spend bars and selected manager metric over time"
          right={
            <div className="flex rounded-lg p-0.5 gap-0.5 bg-slate-100">
              {(["spend", "roas", "leads", "conversions"] as MetricKey[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setMetric(item)}
                  className="rounded-md px-2.5 py-1 capitalize font-medium transition-all"
                  style={{ fontSize: 10, background: metric === item ? "#fff" : "transparent", color: metric === item ? "#1E293B" : "#64748B" }}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
              <YAxis yAxisId="metric" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "spend") return [fmtMoney(Number(value), false), "Spend"];
                  if (name === "roas") return [fmtRoas(Number(value)), "ROAS"];
                  return [fmtNumber(Number(value)), name.charAt(0).toUpperCase() + name.slice(1)];
                }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
              />
              <Bar yAxisId="spend" dataKey="spend" fill={PRIMARY} radius={[3, 3, 0, 0]} barSize={18} opacity={0.75} />
              <Line yAxisId="metric" type="monotone" dataKey={metric === "spend" ? "conversions" : metric} stroke={SUCCESS} strokeWidth={2} dot={{ r: 2.5, fill: SUCCESS }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Budget pacing by client" ariaLabel="Monthly budget consumed by assigned client">
          <div className="flex flex-col gap-4">
            {clients.slice(0, 7).map((client, index) => {
              const spend = n(client.total_spend);
              const budget = n(client.monthly_budget);
              const pct = budget > 0 ? (spend / budget) * 100 : 0;
              return <PacingBar key={client.id} label={client.name} value={pct} budget={budget} accent={clientAccent(index)} />;
            })}
            {clients.length === 0 && <p className="text-slate-400 text-center py-8" style={{ fontSize: 12 }}>No assigned clients.</p>}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="CTR and CPC trend" ariaLabel="Seven day rolling CTR and CPC sparklines by client">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.slice(0, 6).map((client, index) => (
            <div key={client.id} className="rounded-xl border border-slate-100 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={client.name} accent={clientAccent(index)} size={24} />
                  <span className="text-slate-800 font-semibold truncate" style={{ fontSize: 12 }}>{client.name}</span>
                </div>
                <span className="text-slate-400" style={{ fontSize: 10 }}>7D</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500" style={{ fontSize: 10 }}>CTR</span>
                  </div>
                  <Sparkline data={sparkData[client.id] || []} color={PRIMARY} dataKey="ctr" label={`${client.name} CTR sparkline`} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500" style={{ fontSize: 10 }}>CPC</span>
                  </div>
                  <Sparkline data={sparkData[client.id] || []} color={PINK} dataKey="cpc" label={`${client.name} CPC sparkline`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Assigned clients</h2>
          <span className="text-slate-400" style={{ fontSize: 11 }}>{filteredClients.length} shown</span>
        </div>
        {filteredClients.length === 0 ? (
          <EmptyState>No clients match your search.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredClients.map((client, index) => {
              const spend = n(client.total_spend);
              const roas = spend > 0 ? n(client.total_revenue) / spend : 0;
              const accent = clientAccent(index);
              return (
                <button
                  key={client.id}
                  onClick={() => navigate(`/manager/clients/${client.id}`)}
                  className="group bg-white rounded-xl p-4 text-left transition-all duration-180 hover:-translate-y-0.5 hover:border-[var(--client-accent)] focus-visible:ring-2 focus-visible:ring-indigo-300 outline-none"
                  style={{ border: "1px solid #E2E8F0", "--client-accent": accent } as CSSProperties}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={client.name} accent={accent} size={34} />
                      <div className="min-w-0">
                        <p className="text-slate-800 font-semibold truncate" style={{ fontSize: 13 }}>{client.name}</p>
                        <p className="text-slate-500 truncate" style={{ fontSize: 11 }}>{client.industry || "N/A"}</p>
                      </div>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full mt-1" style={{ background: accent }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricMini label="Spend" value={fmtMoney(spend)} />
                    <MetricMini label="ROAS" value={fmtRoas(roas)} />
                    <MetricMini label="Conversions" value={fmtNumber(campaigns.filter((campaign) => campaign.client_id === client.id).reduce((sum, campaign) => sum + n(campaign.total_conversions), 0))} />
                    <MetricMini label="Campaigns" value={String(client.campaign_count || 0)} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400" style={{ fontSize: 10 }}>{label}</p>
      <p className="text-slate-800 font-semibold font-mono tabular-nums" style={{ fontSize: 13 }}>{value}</p>
    </div>
  );
}

function ClientPage({
  clients,
  campaigns,
  clientsLoading,
  search,
  selectedIds,
  onToggleCompare,
}: {
  clients: ManagerClient[];
  campaigns: CampaignRow[];
  clientsLoading: boolean;
  search: string;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
}) {
  const { clientId } = useParams<{ clientId: string }>();
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const client = clients.find((item) => item.id === clientId);
  const [range, setRange] = useState<RangeKey>("30D");
  const [performance, setPerformance] = useState<MetricRow[]>([]);
  const [platforms, setPlatforms] = useState<Array<{ platform: string; spend: number; impressions: number }>>([]);
  const [platformMode, setPlatformMode] = useState<"spend" | "impressions">("spend");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!clientsLoading && clientId && !client) {
      toast.error("Access denied");
      navigate("/manager/dashboard", { replace: true });
    }
  }, [client, clientId, clientsLoading, navigate]);

  useEffect(() => {
    if (!clientId || !user?.id || !client) return;
    const { from, to } = rangeBounds(range);
    setLoading(true);
    Promise.all([
      apiFetch(withManagerId(`/api/charts/performance?client_id=${clientId}&from=${from}&to=${to}`, user.id)).then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
      apiFetch(withManagerId(`/api/charts/platform-split?client_id=${clientId}&from=${from}&to=${to}`, user.id)).then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
    ])
      .then(([performanceData, platformData]) => {
        setPerformance(performanceData.data || []);
        setPlatforms((platformData.data || []).map((item: { platform: string; spend: unknown; impressions: unknown }) => ({
          platform: item.platform,
          spend: n(item.spend),
          impressions: n(item.impressions),
        })));
      })
      .catch((error) => {
        if (error.message === "forbidden") {
          toast.error("Access denied");
          navigate("/manager/dashboard", { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [apiFetch, client, clientId, navigate, range, user?.id]);

  const clientCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => campaign.client_id === clientId)
      .filter((campaign) => statusFilter === "all" || campaign.status === statusFilter)
      .filter((campaign) => !q || campaign.name.toLowerCase().includes(q) || (campaign.assigned_employees || []).some((employee) => employee.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const employeeA = a.assigned_employees?.[0]?.name || "";
        const employeeB = b.assigned_employees?.[0]?.name || "";
        const values: Record<SortKey, [string | number, string | number]> = {
          name: [a.name, b.name],
          employee: [employeeA, employeeB],
          status: [a.status, b.status],
          spend: [n(a.total_spend), n(b.total_spend)],
          conversions: [n(a.total_conversions), n(b.total_conversions)],
          roas: [campaignRoas(a), campaignRoas(b)],
          ctr: [campaignCtr(a), campaignCtr(b)],
        };
        const [left, right] = values[sortKey];
        if (typeof left === "string" && typeof right === "string") return left.localeCompare(right) * dir;
        return (Number(left) - Number(right)) * dir;
      });
  }, [campaigns, clientId, search, sortDir, sortKey, statusFilter]);

  const stats = useMemo(() => {
    const totalSpend = clientCampaigns.reduce((sum, campaign) => sum + n(campaign.total_spend), 0);
    const totalRevenue = clientCampaigns.reduce((sum, campaign) => sum + n(campaign.total_revenue), 0);
    const conversions = clientCampaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0);
    const leads = clientCampaigns.reduce((sum, campaign) => sum + n(campaign.total_leads), 0);
    return {
      totalSpend,
      conversions,
      leads,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      active: campaigns.filter((campaign) => campaign.client_id === clientId && campaign.status === "active").length,
      paused: campaigns.filter((campaign) => campaign.client_id === clientId && campaign.status === "paused").length,
    };
  }, [campaigns, clientCampaigns, clientId]);

  const perfData = useMemo(() => normalizeTrend(performance), [performance]);
  const totalPlatformValue = platforms.reduce((sum, item) => sum + item[platformMode], 0);
  const platformData = platforms.map((item) => ({
    ...item,
    name: platformLabel(item.platform),
    percent: totalPlatformValue > 0 ? (item[platformMode] / totalPlatformValue) * 100 : 0,
  }));

  if (clientsLoading || loading) return <TableSkeleton cols={7} rows={6} />;
  if (!client) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "employee" || key === "status" ? "asc" : "desc");
    }
  };

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/dashboard")} className="h-8 w-8 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>{client.name}</h1>
              <Badge variant="secondary" className="rounded-full text-slate-600" style={{ fontSize: 11 }}>{client.industry || "N/A"}</Badge>
            </div>
            <p className="text-slate-500" style={{ fontSize: 12 }}>{stats.active} active / {stats.paused} paused campaigns</p>
          </div>
        </div>
        <div className="flex rounded-lg p-1 gap-1 bg-slate-200">
          {(["7D", "30D", "3M", "6M"] as RangeKey[]).map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer"
              style={{ fontSize: 11, background: range === item ? "#fff" : "transparent", color: range === item ? "#1E293B" : "#64748B" }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total spend" value={fmtMoney(stats.totalSpend)} delta={trendDelta(performance, "spend").value} up={trendDelta(performance, "spend").up} />
        <StatCard label="ROAS" value={fmtRoas(stats.roas)} delta={trendDelta(performance, "roas").value} up={trendDelta(performance, "roas").up} />
        <StatCard label="Conversions" value={fmtNumber(stats.conversions)} delta={trendDelta(performance, "conversions").value} up={trendDelta(performance, "conversions").up} />
        <StatCard label="Leads" value={fmtNumber(stats.leads)} delta={trendDelta(performance, "leads").value} up={trendDelta(performance, "leads").up} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-3">
        <ChartCard title="Spend pacing and CTR trend" ariaLabel="Client spend bars and CTR line over time">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
              <YAxis yAxisId="ctr" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar yAxisId="spend" dataKey="spend" fill={PRIMARY} radius={[3, 3, 0, 0]} barSize={18} />
              <Line yAxisId="ctr" type="monotone" dataKey="ctr" stroke={SUCCESS} strokeWidth={2} dot={{ r: 2, fill: SUCCESS }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Platform breakdown"
          ariaLabel="Platform spend or impressions share"
          right={
            <div className="flex rounded-lg p-0.5 gap-0.5 bg-slate-100">
              {(["spend", "impressions"] as const).map((item) => (
                <button key={item} onClick={() => setPlatformMode(item)} className="rounded-md px-2.5 py-1 capitalize font-medium" style={{ fontSize: 10, background: platformMode === item ? "#fff" : "transparent", color: platformMode === item ? "#1E293B" : "#64748B" }}>
                  {item}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={platformData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={82} />
              <Tooltip formatter={(value: number) => [`${Number(value).toFixed(1)}%`, platformMode === "spend" ? "Spend" : "Impressions"]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={14}>
                {platformData.map((_, index) => <Cell key={index} fill={clientAccent(index)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
          <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Campaigns</h2>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-slate-400" />
            {(["all", "active", "paused", "completed"] as StatusFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setStatusFilter(item)}
                className="rounded-lg px-2.5 py-1 font-medium capitalize transition-colors"
                style={{ fontSize: 11, background: statusFilter === item ? "#EEF2FF" : "#F8FAFC", color: statusFilter === item ? "#4338CA" : "#64748B" }}
              >
                {item === "completed" ? "Ended" : item}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th className="px-4 py-2.5 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11 }}>Compare</th>
                {[
                  ["Campaign name", "name"],
                  ["Assigned employee", "employee"],
                  ["Status", "status"],
                  ["Spend", "spend"],
                  ["Conversions", "conversions"],
                  ["ROAS", "roas"],
                  ["CTR", "ctr"],
                ].map(([label, key]) => (
                  <th key={key} className={`px-4 py-2.5 text-slate-500 font-semibold border-b border-slate-100 ${["spend", "conversions", "roas", "ctr"].includes(key) ? "text-right" : "text-left"}`} style={{ fontSize: 11 }}>
                    <button onClick={() => handleSort(key as SortKey)} className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      {label}
                      {sortKey === key && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientCampaigns.map((campaign) => {
                const rowAccent = clientAccent(Math.max(0, clients.findIndex((item) => item.id === campaign.client_id)));
                const employee = campaign.assigned_employees?.[0];
                const open = () => navigate(`/manager/clients/${clientId}/campaigns/${campaign.id}`);
                return (
                  <tr
                    key={campaign.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") open();
                    }}
                    className="border-t border-l-[3px] border-l-transparent border-slate-50 hover:bg-slate-50 hover:border-l-[var(--row-accent)] focus-visible:bg-slate-50 outline-none transition-colors cursor-pointer"
                    style={{ "--row-accent": rowAccent } as CSSProperties}
                  >
                    <td className="px-4 py-3">
                      <CompareCheckbox campaignId={campaign.id} selectedIds={selectedIds} onToggle={onToggleCompare} label={`Compare ${campaign.name}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-800 font-semibold" style={{ fontSize: 14 }}>{campaign.name}</span>
                        <div className="flex items-center gap-1.5 text-slate-400" style={{ fontSize: 11 }}>
                          <UserRound size={11} />
                          {employee?.name || "Unassigned"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {employee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={employee.name} accent={PRIMARY} size={24} />
                          <span className="text-slate-600" style={{ fontSize: 12 }}>{employee.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400" style={{ fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={campaign.status} /></td>
                    <td className="px-4 py-3 text-right text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtMoney(n(campaign.total_spend))}</td>
                    <td className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_conversions))}</td>
                    <td className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtRoas(campaignRoas(campaign))}</td>
                    <td className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtPct(campaignCtr(campaign))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {clientCampaigns.length === 0 && <div className="p-8 text-center text-slate-400" style={{ fontSize: 13 }}>No campaigns match the current filters.</div>}
      </Card>
    </div>
  );
}

function CampaignDetailPage({
  clients,
  clientsLoading,
}: {
  clients: ManagerClient[];
  clientsLoading: boolean;
}) {
  const { clientId, campaignId } = useParams<{ clientId: string; campaignId: string }>();
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const client = clients.find((item) => item.id === clientId);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    if (!clientsLoading && clientId && !client) {
      toast.error("Access denied");
      navigate("/manager/dashboard", { replace: true });
    }
  }, [client, clientId, clientsLoading, navigate]);

  useEffect(() => {
    if (!campaignId || !user?.id || !client) return;
    setLoading(true);
    apiFetch(withManagerId(`/api/campaigns/${campaignId}`, user.id))
      .then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      })
      .then((data) => {
        if (data.campaign?.client_id !== clientId) throw new Error("forbidden");
        setCampaign(data.campaign);
        setMetrics((data.metrics || []).slice().reverse());
      })
      .catch((error) => {
        if (error.message === "forbidden") {
          toast.error("Access denied");
          navigate("/manager/dashboard", { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [apiFetch, campaignId, client, clientId, navigate, user?.id]);

  const chartData = useMemo(() => normalizeTrend(metrics), [metrics]);
  const weeklyData = useMemo(() => {
    const groups = new Map<string, { label: string; impressions: number; clicks: number; spend: number; reach: number; likes: number; comments: number; shares: number; cpm: number; frequency: number }>();
    chartData.forEach((row, index) => {
      const label = `Wk ${Math.floor(index / 7) + 1}`;
      const existing = groups.get(label) || { label, impressions: 0, clicks: 0, spend: 0, reach: 0, likes: 0, comments: 0, shares: 0, cpm: 0, frequency: 0 };
      existing.impressions += n(row.impressions);
      existing.clicks += n(row.clicks);
      existing.spend += n(row.spend);
      existing.reach += n(row.reach);
      existing.likes += Math.round(n(row.clicks) * 0.55);
      existing.comments += Math.round(n(row.clicks) * 0.2);
      existing.shares += Math.round(n(row.clicks) * 0.25);
      groups.set(label, existing);
    });
    return Array.from(groups.values()).map((row) => ({
      ...row,
      cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
      frequency: row.reach > 0 ? row.impressions / row.reach : 0,
    }));
  }, [chartData]);

  const totals = useMemo(() => {
    const spend = chartData.reduce((sum, row) => sum + n(row.spend), 0);
    const conversions = chartData.reduce((sum, row) => sum + n(row.conversions), 0);
    const leads = chartData.reduce((sum, row) => sum + n(row.leads), 0);
    const clicks = chartData.reduce((sum, row) => sum + n(row.clicks), 0);
    const impressions = chartData.reduce((sum, row) => sum + n(row.impressions), 0);
    const cpc = clicks > 0 ? spend / clicks : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const costPerResult = conversions > 0 ? spend / conversions : leads > 0 ? spend / leads : 0;
    return { spend, conversions, leads, cpc, ctr, costPerResult };
  }, [chartData]);

  if (clientsLoading || loading) return <TableSkeleton cols={5} rows={5} />;
  if (!campaign || !client) return null;

  const budget = n(campaign.budget);
  const budgetPct = budget > 0 ? (totals.spend / budget) * 100 : 0;
  const employee = campaign.assigned_employees?.[0];

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/manager/clients/${clientId}`)} className="h-8 w-8 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-slate-900 font-bold truncate" style={{ fontSize: 18 }}>{campaign.name}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <div className="flex items-center gap-1.5 text-slate-500" style={{ fontSize: 12 }}>
                {employee ? <Avatar name={employee.name} accent={PRIMARY} size={22} /> : <UserRound size={13} />}
                {employee?.name || "Unassigned"}
              </div>
              <StatusBadge status={campaign.status} />
              <PlatformBadge platform={campaign.platform} />
              <span className="text-slate-500" style={{ fontSize: 12 }}>Budget {fmtMoney(budget, false)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <StatCard label="Spend" value={fmtMoney(totals.spend)} delta={`${Math.round(budgetPct)}% of budget`} up={budgetPct <= 90} />
        <StatCard label="Conversions" value={fmtNumber(totals.conversions)} delta="30D view" up delay={60} />
        <StatCard label="Leads" value={fmtNumber(totals.leads)} delta="30D view" up delay={120} />
        <StatCard label="CTR" value={fmtPct(totals.ctr)} delta="Click rate" up delay={180} />
        <StatCard label="CPC" value={fmtMoney(totals.cpc, false)} delta="Cost per click" up={totals.cpc < 5} delay={240} />
        <StatCard label="Cost/result" value={fmtMoney(totals.costPerResult, false)} delta="Primary result" up={totals.costPerResult < 100} delay={300} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-3">
        <ChartCard title="Spend pacing" ariaLabel="Campaign budget consumed versus total budget">
          <div className="flex flex-col justify-center gap-4 h-[220px]">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-slate-900 font-semibold font-mono" style={{ fontSize: 26 }}>{Math.round(budgetPct)}%</p>
                <p className="text-slate-500" style={{ fontSize: 12 }}>{fmtMoney(totals.spend, false)} of {fmtMoney(budget, false)}</p>
              </div>
              {budgetPct > 90 && <AlertTriangle size={20} style={{ color: WARNING }} />}
            </div>
            <PacingBar label={campaign.name} value={budgetPct} budget={budget} accent={PRIMARY} />
          </div>
        </ChartCard>

        <ChartCard title="Conversions and leads over time" ariaLabel="Campaign conversions and leads over the last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Line type="monotone" dataKey="conversions" stroke={PRIMARY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="leads" stroke={SUCCESS} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard title="CTR trend" ariaLabel="Campaign CTR trend with rolling daily values">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Area type="monotone" dataKey="ctr" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="CPC trend" ariaLabel="Campaign CPC trend over time">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value), false)} />
              <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Area type="monotone" dataKey="cpc" stroke={PINK} fill={PINK} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Button variant="ghost" onClick={() => setShowDetailed((value) => !value)} className="self-start text-slate-600 hover:text-indigo-600">
        {showDetailed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {showDetailed ? "Hide detailed metrics" : "Show detailed metrics"}
      </Button>

      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: showDetailed ? 1200 : 0 }}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-1">
          <ChartCard title="Impressions and clicks" ariaLabel="Weekly impressions and clicks grouped bars">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Bar dataKey="impressions" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="clicks" fill={SUCCESS} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Reach and frequency" ariaLabel="Reach and frequency by week">
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="reach" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="frequency" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Bar yAxisId="reach" dataKey="reach" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                <Line yAxisId="frequency" type="monotone" dataKey="frequency" stroke={PINK} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Engagements" ariaLabel="Estimated engagement mix from campaign click activity">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Bar dataKey="likes" stackId="engagements" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="comments" stackId="engagements" fill={SUCCESS} />
                <Bar dataKey="shares" stackId="engagements" fill={WARNING} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="CPM trend" ariaLabel="Campaign CPM trend by week">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value), false)} />
                <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Line type="monotone" dataKey="cpm" stroke={TEAL} strokeWidth={2} dot={{ r: 2, fill: TEAL }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ManagerContentRoutes({
  clients,
  campaigns,
  loading,
  search,
  mobile,
  onLogout,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: ManagerClient[];
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  mobile?: boolean;
  onLogout: () => void;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
  onClearCompare: () => void;
}) {
  const location = useLocation();
  const { apiFetch, user } = useAuth();
  return (
    <PageTransition sectionKey={location.pathname}>
      <Routes>
        <Route path="dashboard" element={<ManagerOverview clients={clients} campaigns={campaigns} loading={loading} search={search} />} />
        <Route path="kanban" element={<KanbanBoard search={search} />} />
        <Route path="campaigns/compare" element={<RoleCampaignComparisonPage campaigns={campaigns} selectedIds={selectedIds} apiFetch={apiFetch} buildDetailPath={(campaignId) => withManagerId(`/api/campaigns/${campaignId}`, user?.id)} backPath="/manager/dashboard" onClear={onClearCompare} />} />
        <Route path="clients/:clientId" element={<ClientPage clients={clients} campaigns={campaigns} clientsLoading={loading} search={search} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
        <Route path="clients/:clientId/campaigns/:campaignId" element={<CampaignDetailPage clients={clients} clientsLoading={loading} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="email" element={<EmailCenter />} />
        <Route path="sync-status" element={mobile ? <SyncStatusM /> : <SyncStatusD />} />
        <Route path="settings" element={mobile ? <SettingsM onLogout={onLogout} /> : <SettingsD />} />
        <Route path="clients" element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="campaigns" element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
      </Routes>
    </PageTransition>
  );
}

function DesktopShell({
  clients,
  campaigns,
  loading,
  search,
  setSearch,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: ManagerClient[];
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
  onClearCompare: () => void;
}) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navItems: Array<{ label: string; path: string; icon: React.FC<{ size?: number; className?: string }> }> = [
    { label: "Dashboard", path: "/manager/dashboard", icon: LayoutDashboard },
    { label: "Kanban", path: "/manager/kanban", icon: KanbanIcon },
    { label: "Reports", path: "/manager/reports", icon: FileBarChart },
    { label: "Email", path: "/manager/email", icon: Mail },
    { label: "Sync Status", path: "/manager/sync-status", icon: RefreshCw },
    { label: "Settings", path: "/manager/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8FAFC" }}>
      <aside className="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out" style={{ width: isCollapsed ? 64 : 220, background: "#1E293B" }}>
        <div className="flex items-center justify-start px-[17px] gap-3 h-[52px] border-b overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0" aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <span className={`text-white font-bold whitespace-nowrap transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`} style={{ fontSize: 14 }}>
            CloudCRM
          </span>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path || (path === "/manager/dashboard" && location.pathname === "/manager");
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={isCollapsed ? label : undefined}
                className="flex items-center justify-start h-10 w-full pl-[11px] gap-3 rounded-xl transition-colors cursor-pointer overflow-hidden"
                style={{ background: active ? "rgba(99,102,241,0.25)" : "transparent", color: active ? "#A5B4FC" : "#94A3B8" }}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`} style={{ fontSize: 13 }}>
                  {label}
                </span>
              </button>
            );
          })}

          <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className={`px-[11px] mb-2 text-slate-500 font-bold tracking-wider transition-all ${isCollapsed ? "opacity-0 h-0 mb-0" : "opacity-100"}`} style={{ fontSize: 9 }}>MY CLIENTS</p>
            <div className="flex flex-col gap-1.5">
              {clients.map((client, index) => {
                const path = `/manager/clients/${client.id}`;
                const active = location.pathname.startsWith(path);
                return (
                  <button
                    key={client.id}
                    onClick={() => navigate(path)}
                    title={isCollapsed ? client.name : undefined}
                    className="flex items-center justify-start h-9 w-full pl-[11px] gap-3 rounded-xl transition-colors cursor-pointer overflow-hidden"
                    style={{ background: active ? "rgba(99,102,241,0.20)" : "transparent", color: active ? "#C7D2FE" : "#94A3B8" }}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: clientAccent(index) }} />
                    <span className={`font-medium whitespace-nowrap truncate transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`} style={{ fontSize: 12 }}>
                      {client.name}
                    </span>
                  </button>
                );
              })}
              {!loading && clients.length === 0 && !isCollapsed && (
                <p className="px-[11px] text-slate-500" style={{ fontSize: 11 }}>No assigned clients</p>
              )}
            </div>
          </div>
        </nav>

        <div className="py-3 border-t flex flex-col gap-3 px-3 overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-start pl-[4px] gap-3">
            <Avatar name={user?.name || "User"} accent={PRIMARY} size={32} />
            <div className={`flex flex-col min-w-0 transition-all duration-300 whitespace-nowrap ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}>
              <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>{user?.name ?? "User"}</p>
              <p style={{ fontSize: 9, color: "#64748B" }}>Manager</p>
            </div>
          </div>
          <button onClick={handleLogout} title={isCollapsed ? "Sign Out" : undefined} className="flex items-center justify-start h-10 w-full pl-[11px] gap-3 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-white/10 overflow-hidden" style={{ fontSize: 12 }}>
            <LogOut size={18} className="flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              style={{ fontSize: 12 }}
            />
          </div>
          <ManagerBreadcrumbs clients={clients} campaigns={campaigns} />
          <div className="flex-1" />
          <button className="relative text-slate-500 cursor-pointer hover:text-slate-800 transition-colors" aria-label="Notifications">
            <Bell size={16} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: DANGER }} />
          </button>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-1">
            <Avatar name={user?.name || "User"} accent={PRIMARY} size={28} />
            <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{user?.name || "User"}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        <main className="flex-1 p-5 overflow-y-auto relative">
          <ManagerContentRoutes clients={clients} campaigns={campaigns} loading={loading} search={search} onLogout={handleLogout} selectedIds={selectedIds} onToggleCompare={onToggleCompare} onClearCompare={onClearCompare} />
          <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/manager/campaigns/compare" onClear={onClearCompare} />
        </main>
      </div>
    </div>
  );
}

function MobileShell({
  clients,
  campaigns,
  loading,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: ManagerClient[];
  campaigns: CampaignRow[];
  loading: boolean;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
  onClearCompare: () => void;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const firstClientPath = clients[0] ? `/manager/clients/${clients[0].id}` : "/manager/dashboard";
  const tabs = [
    { label: "Home", path: "/manager/dashboard", icon: LayoutDashboard },
    { label: "Clients", path: firstClientPath, icon: UserRound },
    { label: "Board", path: "/manager/kanban", icon: KanbanIcon },
    { label: "Reports", path: "/manager/reports", icon: FileBarChart },
    { label: "Email", path: "/manager/email", icon: Mail },
    { label: "Sync", path: "/manager/sync-status", icon: RefreshCw },
    { label: "Settings", path: "/manager/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col bg-white h-[100dvh] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
        <button onClick={() => navigate("/manager/dashboard")} className="flex items-center gap-1.5">
          <div className="rounded-md p-1" style={{ background: PRIMARY }}>
            <Cloud size={12} className="text-white" />
          </div>
          <span className="font-bold text-slate-800" style={{ fontSize: 12 }}>CloudCRM</span>
        </button>
        <div className="flex items-center gap-2.5">
          <Bell size={15} className="text-slate-500" />
          <button onClick={handleLogout} className="flex items-center gap-1 text-slate-500" aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative p-3" style={{ background: "#F8FAFC" }}>
        <ManagerContentRoutes clients={clients} campaigns={campaigns} loading={loading} search="" mobile onLogout={handleLogout} selectedIds={selectedIds} onToggleCompare={onToggleCompare} onClearCompare={onClearCompare} />
        <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/manager/campaigns/compare" onClear={onClearCompare} />
      </main>

      <div className="flex border-t border-slate-100 bg-white flex-shrink-0">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = label === "Clients" ? location.pathname.startsWith("/manager/clients") : location.pathname === path;
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 cursor-pointer transition-colors"
              style={{ color: active ? PRIMARY : "#94A3B8" }}
            >
              <Icon size={16} />
              <span style={{ fontSize: 9 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ManagerDashboard() {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ManagerClient[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { selectedIds, toggleCampaign, clearSelection } = useCampaignCompareSelection();

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      apiFetch(withManagerId("/api/clients", user.id)).then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
      apiFetch(withManagerId("/api/campaigns", user.id)).then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
    ])
      .then(([clientData, campaignData]) => {
        setClients(clientData.clients || []);
        setCampaigns(campaignData.campaigns || []);
      })
      .catch((error) => {
        if (error.message === "forbidden") {
          toast.error("Access denied");
          navigate("/manager/dashboard", { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [apiFetch, navigate, user?.id]);

  return (
    <div className="min-h-screen w-full bg-slate-50 relative">
      <div className="hidden md:block w-full">
        <DesktopShell clients={clients} campaigns={campaigns} loading={loading} search={search} setSearch={setSearch} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
      <div className="block md:hidden w-full">
        <MobileShell clients={clients} campaigns={campaigns} loading={loading} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
    </div>
  );
}
