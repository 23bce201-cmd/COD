// Employee dashboard shell with assigned campaign routes, Reports, and Email automation navigation.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import {
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
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronUp,
  Cloud,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Reports } from "../reports/Reports";
import { EmailCenter } from "../email/EmailCenter";
import { SettingsD, SettingsM } from "../settings/Settings";
import { SyncStatusD, SyncStatusM } from "../integrations/SyncStatus";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import {
  CampaignCompareBar,
  CompareCheckbox,
  CustomizableMetricGrid,
  RoleCampaignComparisonPage,
  roleCompareCampaigns,
  useCampaignCompareSelection,
} from "./RoleDashboardTools";

type EmployeeCampaign = {
  id: string;
  client_id: string;
  client_name?: string | null;
  client_industry?: string | null;
  name: string;
  platform: string;
  status: string;
  total_leads?: number | string | null;
  total_clicks?: number | string | null;
  total_impressions?: number | string | null;
  total_conversions?: number | string | null;
};

type EmployeeMetric = {
  date: string;
  impressions?: number | string | null;
  clicks?: number | string | null;
  leads?: number | string | null;
  reach?: number | string | null;
  conversions?: number | string | null;
  source?: string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
};

type ClientGroup = {
  id: string;
  name: string;
  industry?: string | null;
  campaigns: EmployeeCampaign[];
};

type CampaignDetail = EmployeeCampaign & {
  start_date?: string | null;
  end_date?: string | null;
};

type RangeKey = "7D" | "30D" | "3M" | "6M";
type CampaignSortKey = "name" | "status" | "impressions" | "clicks" | "ctr" | "cpc" | "leads" | "conversions" | "engagements";
type SortDirection = "asc" | "desc";

const PRIMARY = "#6366F1";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";
const DANGER = "#F43F5E";
const PINK = "#EC4899";
const SKY = "#0369A1";
const TEAL = "#0F766E";
const MUTED = "#64748B";
const RANGE_OPTIONS: RangeKey[] = ["7D", "30D", "3M", "6M"];

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtNumber(value: number) {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function fmtPct(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function fmtMoney(value: number) {
  return `$${value.toFixed(value >= 10 ? 0 : 2)}`;
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

function dateToInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function rangeBounds(range: RangeKey) {
  const to = new Date();
  const from = new Date(to);
  const days = range === "7D" ? 7 : range === "30D" ? 30 : range === "3M" ? 90 : 180;
  from.setDate(to.getDate() - days);
  return { from: dateToInput(from), to: dateToInput(to) };
}

function platformLabel(platform: string) {
  const map: Record<string, string> = {
    google_ads: "Google",
    meta_ads: "Meta",
    linkedin_ads: "LinkedIn",
    twitter_ads: "Twitter",
    mailchimp: "Mailchimp",
    manual: "Manual",
  };
  return map[platform] || platform;
}

function platformColor(platform: string) {
  const map: Record<string, string> = {
    google_ads: PRIMARY,
    meta_ads: PINK,
    linkedin_ads: SKY,
    twitter_ads: TEAL,
    mailchimp: WARNING,
    manual: MUTED,
  };
  return map[platform] || MUTED;
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "completed" || status === "ended") return "Ended";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Ended";
}

function statusDot(status: string) {
  if (status === "active") return SUCCESS;
  if (status === "paused") return WARNING;
  return "#94A3B8";
}

function campaignCtr(campaign: EmployeeCampaign) {
  const impressions = n(campaign.total_impressions);
  return impressions > 0 ? (n(campaign.total_clicks) / impressions) * 100 : 0;
}

function weightedCtr(campaigns: EmployeeCampaign[]) {
  const impressions = campaigns.reduce((sum, campaign) => sum + n(campaign.total_impressions), 0);
  const clicks = campaigns.reduce((sum, campaign) => sum + n(campaign.total_clicks), 0);
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}

function avgCpc(rows: EmployeeMetric[]) {
  const weighted = rows.reduce((acc, row) => {
    const clicks = n(row.clicks);
    return {
      clicks: acc.clicks + clicks,
      value: acc.value + n(row.cpc) * clicks,
    };
  }, { clicks: 0, value: 0 });
  return weighted.clicks > 0 ? weighted.value / weighted.clicks : 0;
}

function engagementCount(source: { clicks?: number | string | null; conversions?: number | string | null }) {
  return Math.round(n(source.clicks) * 0.67 + n(source.conversions) * 1.4);
}

function normalizeMetrics(rows: EmployeeMetric[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((row) => {
      const impressions = n(row.impressions);
      const clicks = n(row.clicks);
      const reach = n(row.reach);
      return {
        ...row,
        label: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        impressions,
        clicks,
        leads: n(row.leads),
        conversions: n(row.conversions),
        reach,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : n(row.ctr),
        cpc: n(row.cpc),
        cpm: n(row.cpm),
        frequency: reach > 0 ? impressions / reach : 0,
        likes: Math.round(clicks * 0.42),
        comments: Math.round(clicks * 0.12),
        shares: Math.round(clicks * 0.08),
        follows: Math.round(clicks * 0.05),
      };
    });
}

function applyRange(rows: EmployeeMetric[], range: RangeKey) {
  const { from, to } = rangeBounds(range);
  return rows.filter((row) => row.date >= from && row.date <= to);
}

function aggregateByDate(metricsByCampaign: Record<string, EmployeeMetric[]>, campaigns: EmployeeCampaign[], range: RangeKey) {
  const byDate = new Map<string, EmployeeMetric>();
  const ids = new Set(campaigns.map((campaign) => campaign.id));
  Object.entries(metricsByCampaign).forEach(([campaignId, rows]) => {
    if (!ids.has(campaignId)) return;
    applyRange(rows, range).forEach((row) => {
      const current = byDate.get(row.date) || { date: row.date, impressions: 0, clicks: 0, leads: 0, reach: 0, conversions: 0, cpc: 0, cpm: 0 };
      current.impressions = n(current.impressions) + n(row.impressions);
      current.clicks = n(current.clicks) + n(row.clicks);
      current.leads = n(current.leads) + n(row.leads);
      current.reach = n(current.reach) + n(row.reach);
      current.conversions = n(current.conversions) + n(row.conversions);
      byDate.set(row.date, current);
    });
  });

  return Array.from(byDate.values()).map((row) => {
    const sourceRows = Object.entries(metricsByCampaign)
      .filter(([campaignId]) => ids.has(campaignId))
      .flatMap(([, rows]) => rows.filter((item) => item.date === row.date));
    return {
      ...row,
      ctr: n(row.impressions) > 0 ? (n(row.clicks) / n(row.impressions)) * 100 : 0,
      cpc: avgCpc(sourceRows),
      cpm: sourceRows.length ? sourceRows.reduce((sum, item) => sum + n(item.cpm), 0) / sourceRows.length : 0,
    };
  });
}

function deltaFor(rows: EmployeeMetric[], key: "clicks" | "impressions" | "conversions" | "leads") {
  const normalized = normalizeMetrics(rows);
  if (normalized.length < 2) return { value: "No prior period", up: true };
  const half = Math.max(1, Math.floor(normalized.length / 2));
  const previous = normalized.slice(0, half).reduce((sum, row) => sum + n(row[key]), 0);
  const current = normalized.slice(half).reduce((sum, row) => sum + n(row[key]), 0);
  if (previous === 0) return { value: current > 0 ? "+100% vs prev" : "0% vs prev", up: true };
  const delta = ((current - previous) / previous) * 100;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`, up: delta >= 0 };
}

function ctrDelta(rows: EmployeeMetric[]) {
  const normalized = normalizeMetrics(rows);
  if (normalized.length < 2) return { value: "No prior period", up: true };
  const half = Math.max(1, Math.floor(normalized.length / 2));
  const previous = weightedMetric(normalized.slice(0, half), "ctr");
  const current = weightedMetric(normalized.slice(half), "ctr");
  const delta = current - previous;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pts`, up: delta >= 0 };
}

function cpcDelta(rows: EmployeeMetric[]) {
  const normalized = normalizeMetrics(rows);
  if (normalized.length < 2) return { value: "No prior period", up: true };
  const half = Math.max(1, Math.floor(normalized.length / 2));
  const previous = avgCpc(normalized.slice(0, half));
  const current = avgCpc(normalized.slice(half));
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`, up: delta <= 0 };
}

function weightedMetric(rows: ReturnType<typeof normalizeMetrics>, key: "ctr") {
  if (key === "ctr") {
    const impressions = rows.reduce((sum, row) => sum + n(row.impressions), 0);
    const clicks = rows.reduce((sum, row) => sum + n(row.clicks), 0);
    return impressions > 0 ? (clicks / impressions) * 100 : 0;
  }
  return 0;
}

function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(value * easeOutExpo(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return display;
}

function CountedValue({
  value,
  formatter,
  className,
  style,
}: {
  value: number;
  formatter: (value: number) => string;
  className?: string;
  style?: CSSProperties;
}) {
  const display = useCountUp(value);
  return <span className={className} style={style}>{formatter(display)}</span>;
}

function Avatar({ name, accent = PRIMARY, size = 28 }: { name: string; accent?: string; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: accent, fontSize: Math.max(9, size / 3) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
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
  return (
    <Badge className="rounded border-0 px-2 py-0.5" style={{ background: `${platformColor(platform)}1A`, color: platformColor(platform), fontSize: 11 }}>
      {platformLabel(platform)}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  formatter,
  delta,
  up,
  delay = 0,
}: {
  label: string;
  value: number;
  formatter: (value: number) => string;
  delta: string;
  up: boolean;
  delay?: number;
}) {
  return (
    <Card
      className="data-enter rounded-xl bg-white p-4 gap-2 transition-all duration-150 hover:-translate-y-0.5"
      style={{ border: "1px solid #E2E8F0", animationDelay: `${delay}ms` }}
    >
      <span className="text-slate-500 font-semibold uppercase tracking-wide" style={{ fontSize: 11 }}>{label}</span>
      <CountedValue value={value} formatter={formatter} className="text-slate-900 font-semibold font-mono tabular-nums" style={{ fontSize: 24 }} />
      <div className="flex items-center gap-1">
        {up ? <ArrowUpRight size={12} style={{ color: SUCCESS }} /> : <ArrowDownRight size={12} style={{ color: DANGER }} />}
        <span className="font-medium" style={{ fontSize: 11, color: up ? SUCCESS : DANGER }}>{delta}</span>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  children,
  right,
  ariaLabel,
  className = "",
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Card className={`bg-white rounded-xl p-4 gap-3 min-w-0 ${className}`} style={{ border: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{title}</h2>
        {right}
      </div>
      <div aria-label={ariaLabel} role="img" className="min-h-0">{children}</div>
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

function RangeTabs({ value, onChange, compact }: { value: RangeKey; onChange: (value: RangeKey) => void; compact?: boolean }) {
  const options = compact ? RANGE_OPTIONS.slice(0, 3) : RANGE_OPTIONS;
  return (
    <div className="flex rounded-lg p-1 gap-1 bg-slate-200" aria-label="Date range">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-300"
          style={{
            fontSize: 11,
            background: value === item ? "#fff" : "transparent",
            color: value === item ? "#1E293B" : "#64748B",
            boxShadow: value === item ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-left font-semibold text-slate-500 hover:text-indigo-600">
      {label}
      {active && <span aria-hidden="true">{direction === "asc" ? "asc" : "desc"}</span>}
    </button>
  );
}

function clientGroups(campaigns: EmployeeCampaign[]) {
  const groups = new Map<string, ClientGroup>();
  campaigns.forEach((campaign) => {
    const current = groups.get(campaign.client_id) || {
      id: campaign.client_id,
      name: campaign.client_name || "Client",
      industry: campaign.client_industry,
      campaigns: [],
    };
    current.campaigns.push(campaign);
    groups.set(campaign.client_id, current);
  });
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function clientAccent(index: number) {
  return [PRIMARY, PINK, WARNING, SUCCESS, TEAL][index % 5];
}

function EmployeeBreadcrumbs({ campaigns }: { campaigns: EmployeeCampaign[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
  const page = parts[1] || "dashboard";
  const clientId = page === "clients" && parts[2] ? parts[2] : undefined;
  const campaignId = parts[3] === "campaigns" ? parts[4] : undefined;
  const client = clientGroups(campaigns).find((item) => item.id === clientId);
  const campaign = campaigns.find((item) => item.id === campaignId);
  const flatLabels: Record<string, string> = {
    campaigns: "Campaigns",
    reports: "Reports",
    "sync-status": "Sync Status",
    settings: "Settings",
  };

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-slate-500" style={{ fontSize: 12 }}>
        <BreadcrumbItem>
          {page === "dashboard" ? (
            <BreadcrumbPage className="text-slate-800">Dashboard</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => navigate("/employee/dashboard")} className="hover:text-indigo-600 transition-colors">
                Dashboard
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {page !== "dashboard" && !clientId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage className="text-slate-800">{flatLabels[page] || "Employee"}</BreadcrumbPage></BreadcrumbItem>
          </>
        )}
        {clientId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {campaignId ? (
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => navigate(`/employee/clients/${clientId}`)} className="hover:text-indigo-600 transition-colors">
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

function campaignEngagementRows(campaigns: EmployeeCampaign[]) {
  return campaigns.map((campaign) => ({
    name: campaign.name.length > 18 ? `${campaign.name.slice(0, 18)}...` : campaign.name,
    likes: Math.round(n(campaign.total_clicks) * 0.42),
    comments: Math.round(n(campaign.total_clicks) * 0.12),
    shares: Math.round(n(campaign.total_clicks) * 0.08),
    follows: Math.round(n(campaign.total_clicks) * 0.05),
    conversions: n(campaign.total_conversions),
    color: platformColor(campaign.platform),
  }));
}

function ClientCards({ campaigns, metricsByCampaign }: { campaigns: EmployeeCampaign[]; metricsByCampaign: Record<string, EmployeeMetric[]> }) {
  const navigate = useNavigate();
  const groups = clientGroups(campaigns);
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-label="Assigned clients">
      {groups.map((client, index) => {
        const rows = aggregateByDate(metricsByCampaign, client.campaigns, "30D");
        const totals = {
          clicks: client.campaigns.reduce((sum, campaign) => sum + n(campaign.total_clicks), 0),
          impressions: client.campaigns.reduce((sum, campaign) => sum + n(campaign.total_impressions), 0),
          conversions: client.campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0),
          ctr: weightedCtr(client.campaigns),
        };
        const path = `/employee/clients/${client.id}`;
        return (
          <Card
            key={client.id}
            tabIndex={0}
            role="button"
            onClick={() => navigate(path)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate(path);
            }}
            className="bg-white rounded-xl p-4 gap-4 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-300"
            style={{ border: "1px solid #E2E8F0" }}
          >
            <div className="flex items-center gap-3">
              <Avatar name={client.name} accent={clientAccent(index)} size={34} />
              <div className="min-w-0">
                <h2 className="text-slate-800 font-semibold truncate" style={{ fontSize: 13 }}>{client.name}</h2>
                <p className="text-slate-400" style={{ fontSize: 11 }}>{client.campaigns.length} campaigns assigned</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Clicks", fmtNumber(totals.clicks)],
                ["CTR", fmtPct(totals.ctr)],
                ["Impressions", fmtNumber(totals.impressions)],
                ["Conversions", fmtNumber(totals.conversions)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-400" style={{ fontSize: 10 }}>{label}</p>
                  <p className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="h-10" aria-label={`${client.name} recent click trend`} role="img">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={normalizeMetrics(rows)}>
                  <Line type="monotone" dataKey="clicks" stroke={clientAccent(index)} strokeWidth={1.8} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })}
      {groups.length === 0 && <EmptyState>No campaigns assigned yet.</EmptyState>}
    </section>
  );
}

function Overview({
  campaigns,
  metricsByCampaign,
  loading,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
  loading: boolean;
}) {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("30D");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [barMode, setBarMode] = useState<"engagements" | "conversions">("engagements");
  const visibleCampaigns = campaignFilter === "all" ? campaigns : campaigns.filter((campaign) => campaign.id === campaignFilter);
  const aggregateRows = aggregateByDate(metricsByCampaign, visibleCampaigns, range);
  const chartData = normalizeMetrics(aggregateRows);
  const last30Rows = normalizeMetrics(aggregateByDate(metricsByCampaign, visibleCampaigns, "30D"));
  const totals = {
    clicks: visibleCampaigns.reduce((sum, campaign) => sum + n(campaign.total_clicks), 0),
    impressions: visibleCampaigns.reduce((sum, campaign) => sum + n(campaign.total_impressions), 0),
    conversions: visibleCampaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0),
    ctr: weightedCtr(visibleCampaigns),
    cpc: avgCpc(aggregateRows),
  };
  const allMetricRows = visibleCampaigns.flatMap((campaign) => applyRange(metricsByCampaign[campaign.id] || [], range));
  const showSkeleton = useDelayedLoading(loading, 100);

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Employee Dashboard</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>
            {campaigns.length} assigned campaigns across {clientGroups(campaigns).length} clients
          </p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <CustomizableMetricGrid
        storageKey={`employee_dashboard_layout_${user?.id || "default"}`}
        columnsClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
        metrics={[
          { key: "clicks", label: "Total clicks", value: fmtNumber(totals.clicks), rawValue: totals.clicks, delta: deltaFor(allMetricRows, "clicks").value, up: deltaFor(allMetricRows, "clicks").up },
          { key: "ctr", label: "Avg CTR", value: fmtPct(totals.ctr), rawValue: totals.ctr, delta: ctrDelta(allMetricRows).value, up: ctrDelta(allMetricRows).up },
          { key: "cpc", label: "Avg CPC", value: fmtMoney(totals.cpc), rawValue: totals.cpc, delta: cpcDelta(allMetricRows).value, up: cpcDelta(allMetricRows).up },
          { key: "conversions", label: "Conversions", value: fmtNumber(totals.conversions), rawValue: totals.conversions, delta: deltaFor(allMetricRows, "conversions").value, up: deltaFor(allMetricRows, "conversions").up },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        <ChartCard
          title="CTR, CPC, and clicks over time"
          ariaLabel="CTR, CPC, and clicks trend across assigned campaigns"
          right={
            <select
              value={campaignFilter}
              onChange={(event) => setCampaignFilter(event.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
              style={{ fontSize: 11 }}
              aria-label="Filter by campaign"
            >
              <option value="all">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rate" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="clicks" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Line yAxisId="rate" type="monotone" dataKey="ctr" stroke={PRIMARY} strokeWidth={2} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="cpc" stroke={PINK} strokeWidth={2} strokeDasharray="5 5" dot={false} />
              <Line yAxisId="clicks" type="monotone" dataKey="clicks" stroke={SUCCESS} strokeWidth={2} strokeDasharray="2 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <SimpleLineChart title="Impressions over time" ariaLabel="Impressions over time for assigned campaigns" data={chartData} dataKey="impressions" color={SKY} />
      </div>

      <ChartCard
        title={barMode === "engagements" ? "Engagements by campaign" : "Conversions by campaign"}
        ariaLabel="Engagements or conversions by assigned campaign"
        right={
          <div className="flex rounded-lg p-1 gap-1 bg-slate-200" aria-label="Supporting graph mode">
            {[
              ["engagements", "Engagements"],
              ["conversions", "Conversions"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBarMode(value as "engagements" | "conversions")}
                className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer"
                style={{ fontSize: 11, background: barMode === value ? "#fff" : "transparent", color: barMode === value ? "#1E293B" : "#64748B" }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={campaignEngagementRows(visibleCampaigns)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            {barMode === "engagements" ? (
              <>
                <Bar dataKey="likes" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="comments" fill={SUCCESS} radius={[3, 3, 0, 0]} />
                <Bar dataKey="shares" fill={WARNING} radius={[3, 3, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="conversions" fill={PRIMARY} radius={[3, 3, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SimpleLineChart title="Leads generated over time" ariaLabel="Leads generated over the last 30 days" data={last30Rows} dataKey="leads" color={SUCCESS} />
        <EngagementStack data={last30Rows} />
      </div>

      <div>
        <h2 className="text-slate-800 font-semibold mb-3" style={{ fontSize: 13 }}>Assigned Clients</h2>
        <ClientCards campaigns={campaigns} metricsByCampaign={metricsByCampaign} />
      </div>
    </div>
  );
}

function SimpleLineChart({
  title,
  ariaLabel,
  data,
  dataKey,
  color,
  formatter,
}: {
  title: string;
  ariaLabel: string;
  data: ReturnType<typeof normalizeMetrics>;
  dataKey: keyof ReturnType<typeof normalizeMetrics>[number];
  color: string;
  formatter?: (value: number) => string;
}) {
  return (
    <ChartCard title={title} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => (formatter ? formatter(Number(value)) : fmtNumber(Number(value)))} />
          <Tooltip formatter={(value: number) => (formatter ? formatter(Number(value)) : fmtNumber(Number(value)))} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
          <Line type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function EngagementStack({ data }: { data: ReturnType<typeof normalizeMetrics> }) {
  return (
    <ChartCard title="Engagements breakdown" ariaLabel="Stacked engagements breakdown by likes comments shares and follows">
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
          <Bar dataKey="likes" stackId="engagements" fill={PRIMARY} radius={[3, 3, 0, 0]} />
          <Bar dataKey="comments" stackId="engagements" fill={SUCCESS} />
          <Bar dataKey="shares" stackId="engagements" fill={WARNING} />
          <Bar dataKey="follows" stackId="engagements" fill={TEAL} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CampaignTable({
  campaigns,
  clientAccentColor = PRIMARY,
  title = "Campaigns",
  selectedIds = [],
  onToggleCompare,
}: {
  campaigns: EmployeeCampaign[];
  clientAccentColor?: string;
  title?: string;
  selectedIds?: string[];
  onToggleCompare?: (campaignId: string) => void;
}) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<CampaignSortKey>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const rows = useMemo(() => {
    return campaigns
      .filter((campaign) => statusFilter === "all" || campaign.status === statusFilter)
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        const values: Record<CampaignSortKey, [string | number, string | number]> = {
          name: [a.name, b.name],
          status: [statusLabel(a.status), statusLabel(b.status)],
          impressions: [n(a.total_impressions), n(b.total_impressions)],
          clicks: [n(a.total_clicks), n(b.total_clicks)],
          ctr: [campaignCtr(a), campaignCtr(b)],
          cpc: [0, 0],
          leads: [n(a.total_leads), n(b.total_leads)],
          conversions: [n(a.total_conversions), n(b.total_conversions)],
          engagements: [engagementCount(a), engagementCount(b)],
        };
        const [av, bv] = values[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
        return String(av).localeCompare(String(bv)) * direction;
      });
  }, [campaigns, sortDirection, sortKey, statusFilter]);

  const setSort = (key: CampaignSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" || key === "status" ? "asc" : "desc");
  };

  return (
    <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{title}</h2>
        <div className="flex rounded-lg p-1 gap-1 bg-slate-200" aria-label="Campaign status filter">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["paused", "Paused"],
            ["completed", "Ended"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-300"
              style={{ fontSize: 11, background: statusFilter === value ? "#fff" : "transparent", color: statusFilter === value ? "#1E293B" : "#64748B" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow style={{ background: "#F8FAFC" }}>
            {onToggleCompare && <TableHead className="px-4 py-2.5 text-slate-500" style={{ fontSize: 11 }}>Compare</TableHead>}
            {[
              ["Campaign", "name"],
              ["Status", "status"],
              ["Impressions", "impressions"],
              ["Clicks", "clicks"],
              ["CTR", "ctr"],
              ["Leads", "leads"],
              ["Conversions", "conversions"],
              ["Engagements", "engagements"],
            ].map(([label, key]) => (
              <TableHead key={key} className="px-4 py-2.5 text-slate-500" style={{ fontSize: 11 }}>
                <SortButton label={label} active={sortKey === key} direction={sortDirection} onClick={() => setSort(key as CampaignSortKey)} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((campaign) => {
            const path = `/employee/clients/${campaign.client_id}/campaigns/${campaign.id}`;
            return (
              <TableRow
                key={campaign.id}
                tabIndex={0}
                role="button"
                onClick={() => navigate(path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") navigate(path);
                }}
                className="cursor-pointer border-l-2 border-l-transparent hover:bg-slate-50 transition-colors"
                style={{ "--tw-border-opacity": 1 } as CSSProperties}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderLeftColor = clientAccentColor;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderLeftColor = "transparent";
                }}
              >
                {onToggleCompare && (
                  <TableCell className="px-4 py-3">
                    <CompareCheckbox campaignId={campaign.id} selectedIds={selectedIds} onToggle={onToggleCompare} label={`Compare ${campaign.name}`} />
                  </TableCell>
                )}
                <TableCell className="px-4 py-3">
                  <div className="min-w-48">
                    <p className="text-slate-800 font-semibold truncate" style={{ fontSize: 12 }}>{campaign.name}</p>
                    <div className="mt-1"><PlatformBadge platform={campaign.platform} /></div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3"><StatusBadge status={campaign.status} /></TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_impressions))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_clicks))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtPct(campaignCtr(campaign))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_leads))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_conversions))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(engagementCount(campaign))}</TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={onToggleCompare ? 9 : 8} className="px-4 py-8 text-center text-slate-400" style={{ fontSize: 12 }}>
                No campaigns match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function ClientPage({
  campaigns,
  metricsByCampaign,
  loading,
  selectedIds,
  onToggleCompare,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
  loading: boolean;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
}) {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30D");
  const groups = clientGroups(campaigns);
  const group = groups.find((item) => item.id === clientId);

  useEffect(() => {
    if (loading) return;
    if (!clientId || group) return;
    toast.error("No campaigns assigned");
    navigate("/employee/dashboard", { replace: true });
  }, [clientId, group, loading, navigate]);

  if (loading) return <TableSkeleton cols={8} rows={4} />;
  if (!group) return <EmptyState>No campaigns assigned.</EmptyState>;

  const aggregateRows = normalizeMetrics(aggregateByDate(metricsByCampaign, group.campaigns, range));
  const totals = {
    clicks: group.campaigns.reduce((sum, campaign) => sum + n(campaign.total_clicks), 0),
    impressions: group.campaigns.reduce((sum, campaign) => sum + n(campaign.total_impressions), 0),
    conversions: group.campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0),
    ctr: weightedCtr(group.campaigns),
  };
  const allRows = group.campaigns.flatMap((campaign) => applyRange(metricsByCampaign[campaign.id] || [], range));
  const accent = clientAccent(groups.findIndex((item) => item.id === group.id));

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/employee/dashboard")} className="text-slate-500 hover:text-indigo-600">
          <ArrowLeft size={15} />
          Back
        </Button>
      </div>
      <Card className="bg-white rounded-xl p-4 gap-3" style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={group.name} accent={accent} size={38} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-slate-900 font-bold truncate" style={{ fontSize: 20 }}>{group.name}</h1>
                {group.industry && <Badge variant="secondary" className="rounded-full" style={{ fontSize: 11 }}>{group.industry}</Badge>}
              </div>
              <p className="text-slate-500 mt-1" style={{ fontSize: 12 }}>{group.campaigns.length} campaigns assigned to you</p>
            </div>
          </div>
          <RangeTabs value={range} onChange={setRange} compact />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total clicks" value={totals.clicks} formatter={fmtNumber} delta={deltaFor(allRows, "clicks").value} up={deltaFor(allRows, "clicks").up} />
        <StatCard label="Avg CTR" value={totals.ctr} formatter={fmtPct} delta={ctrDelta(allRows).value} up={ctrDelta(allRows).up} delay={60} />
        <StatCard label="Impressions" value={totals.impressions} formatter={fmtNumber} delta={deltaFor(allRows, "impressions").value} up={deltaFor(allRows, "impressions").up} delay={120} />
        <StatCard label="Leads / conversions" value={totals.conversions} formatter={fmtNumber} delta={deltaFor(allRows, "conversions").value} up={deltaFor(allRows, "conversions").up} delay={180} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        <ChartCard title="CTR and CPC trend" ariaLabel="CTR and CPC trend for assigned campaigns under this client">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={aggregateRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Line type="monotone" dataKey="ctr" stroke={PRIMARY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cpc" stroke={PINK} strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <SimpleLineChart title="Impressions over time" ariaLabel="Impressions trend for assigned campaigns under this client" data={aggregateRows} dataKey="impressions" color={SKY} />
      </div>

      <CampaignTable campaigns={group.campaigns} clientAccentColor={accent} title="Assigned Campaigns" selectedIds={selectedIds} onToggleCompare={onToggleCompare} />
    </div>
  );
}

function CampaignDetailPage({
  campaigns,
  metricsByCampaign,
  loading,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
  loading: boolean;
}) {
  const { clientId, campaignId } = useParams<{ clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const campaign = campaigns.find((item) => item.id === campaignId && item.client_id === clientId);

  useEffect(() => {
    if (loading) return;
    if (!campaignId || campaign) return;
    toast.error("Access denied");
    navigate("/employee/dashboard", { replace: true });
  }, [campaign, campaignId, loading, navigate]);

  if (loading) return <TableSkeleton cols={5} rows={3} />;
  if (!campaign) return <EmptyState>Campaign not assigned to you.</EmptyState>;

  const rows = normalizeMetrics(metricsByCampaign[campaign.id] || []);
  const totals = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + n(row.impressions),
      clicks: acc.clicks + n(row.clicks),
      leads: acc.leads + n(row.leads),
      conversions: acc.conversions + n(row.conversions),
      reach: acc.reach + n(row.reach),
    }),
    { impressions: 0, clicks: 0, leads: 0, conversions: 0, reach: 0 }
  );
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = avgCpc(rows);
  const platformData = platformBreakdown(rows, campaign.platform);

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/employee/clients/${campaign.client_id}`)} className="text-slate-500 hover:text-indigo-600">
          <ArrowLeft size={15} />
          Back
        </Button>
      </div>
      <Card className="bg-white rounded-xl p-4 gap-3" style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-slate-900 font-bold" style={{ fontSize: 20 }}>{campaign.name}</h1>
            <PlatformBadge platform={campaign.platform} />
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-slate-500" style={{ fontSize: 12 }}>
            {campaign.client_name || "Client"} - operational campaign metrics
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Impressions" value={totals.impressions} formatter={fmtNumber} delta={deltaFor(rows, "impressions").value} up={deltaFor(rows, "impressions").up} />
        <StatCard label="Clicks" value={totals.clicks} formatter={fmtNumber} delta={deltaFor(rows, "clicks").value} up={deltaFor(rows, "clicks").up} delay={60} />
        <StatCard label="CTR" value={ctr} formatter={fmtPct} delta={ctrDelta(rows).value} up={ctrDelta(rows).up} delay={120} />
        <StatCard label="CPC" value={cpc} formatter={fmtMoney} delta={cpcDelta(rows).value} up={cpcDelta(rows).up} delay={180} />
        <StatCard label="Leads / conversions" value={totals.conversions} formatter={fmtNumber} delta={deltaFor(rows, "conversions").value} up={deltaFor(rows, "conversions").up} delay={240} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SimpleLineChart title="CTR over time" ariaLabel="Campaign CTR over time" data={rows} dataKey="ctr" color={PRIMARY} formatter={fmtPct} />
        <SimpleLineChart title="CPC over time" ariaLabel="Campaign CPC over time" data={rows} dataKey="cpc" color={PINK} formatter={fmtMoney} />
        <SimpleLineChart title="Impressions over time" ariaLabel="Campaign impressions over time" data={rows} dataKey="impressions" color={SKY} />
        <SimpleLineChart title="Clicks over time" ariaLabel="Campaign clicks over time" data={rows} dataKey="clicks" color={SUCCESS} />
      </div>

      <SimpleLineChart title="Leads and conversions over time" ariaLabel="Campaign conversions over time" data={rows} dataKey="conversions" color={PRIMARY} />
      <EngagementStack data={rows} />

      <Button variant="ghost" onClick={() => setShowMore((value) => !value)} className="self-start text-slate-600 hover:text-indigo-600">
        {showMore ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {showMore ? "Hide metrics" : "Show more metrics"}
      </Button>

      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: showMore ? 1200 : 0 }}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-1">
          <SimpleLineChart title="Reach over time" ariaLabel="Campaign reach over time" data={rows} dataKey="reach" color={TEAL} />
          <SimpleLineChart title="Frequency" ariaLabel="Campaign frequency over time" data={rows} dataKey="frequency" color={PINK} formatter={(value) => value.toFixed(2)} />
          <SimpleLineChart title="CPM trend" ariaLabel="Campaign CPM trend over time" data={rows} dataKey="cpm" color={WARNING} formatter={fmtMoney} />
          <ChartCard title="Platform breakdown" ariaLabel="Impression share by platform">
            <div className="flex flex-col gap-3">
              {platformData.map((item) => (
                <div key={item.platform} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: platformColor(item.platform) }} />
                      <span className="text-slate-700 font-medium truncate" style={{ fontSize: 12 }}>{platformLabel(item.platform)}</span>
                    </div>
                    <span className="text-slate-500 font-semibold" style={{ fontSize: 11 }}>{fmtPct(item.share)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(item.share)} aria-valuemin={0} aria-valuemax={100} aria-label={`${platformLabel(item.platform)} impression share ${fmtPct(item.share)}`}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.share}%`, background: platformColor(item.platform) }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function platformBreakdown(rows: ReturnType<typeof normalizeMetrics>, fallbackPlatform: string) {
  const total = rows.reduce((sum, row) => sum + n(row.impressions), 0);
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const platform = row.source || fallbackPlatform;
    grouped.set(platform, (grouped.get(platform) || 0) + n(row.impressions));
  });
  if (grouped.size === 0) return [{ platform: fallbackPlatform, share: 0 }];
  return Array.from(grouped.entries()).map(([platform, impressions]) => ({
    platform,
    share: total > 0 ? (impressions / total) * 100 : 0,
  }));
}

function EmployeeContentRoutes({
  campaigns,
  metricsByCampaign,
  loading,
  onLogout,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
  loading: boolean;
  onLogout: () => void;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
  onClearCompare: () => void;
}) {
  const location = useLocation();
  return (
    <PageTransition sectionKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Navigate to="/employee/dashboard" replace />} />
        <Route path="dashboard" element={<Overview campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} />} />
        <Route path="campaigns" element={loading ? <TableSkeleton cols={8} rows={6} /> : <CampaignTable campaigns={campaigns} title="My Campaigns" selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
        <Route path="campaigns/compare" element={<RoleCampaignComparisonPage campaigns={campaigns} selectedIds={selectedIds} localMetricsByCampaign={metricsByCampaign} backPath="/employee/campaigns" onClear={onClearCompare} />} />
        <Route path="clients/:clientId" element={<ClientPage campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
        <Route path="clients/:clientId/campaigns/:campaignId" element={<CampaignDetailPage campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="email" element={<EmailCenter />} />
        <Route path="sync-status" element={<SyncStatusD />} />
        <Route path="settings" element={<SettingsD />} />
        <Route path="*" element={<Navigate to="/employee/dashboard" replace />} />
      </Routes>
    </PageTransition>
  );
}

function DesktopShell({
  campaigns,
  metricsByCampaign,
  loading,
  search,
  setSearch,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
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
  const navItems = [
    { label: "Dashboard", path: "/employee/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", path: "/employee/campaigns", icon: Megaphone },
    { label: "Reports", path: "/employee/reports", icon: FileBarChart },
    { label: "Email", path: "/employee/email", icon: Mail },
    { label: "Sync Status", path: "/employee/sync-status", icon: RefreshCw },
    { label: "Settings", path: "/employee/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F8FAFC" }}>
      <aside className="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out" style={{ width: isCollapsed ? 64 : 200, background: "#1E293B" }}>
        <div className="flex items-center justify-start px-[17px] gap-3 h-[52px] border-b overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0" aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <span className={`text-white font-bold whitespace-nowrap transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`} style={{ fontSize: 14 }}>
            CloudCRM
          </span>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto" aria-label="Employee navigation">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = path === "/employee/dashboard" ? location.pathname === path || location.pathname === "/employee" : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                type="button"
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

        </nav>

        <div className="py-3 border-t flex flex-col gap-3 px-3 overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-start pl-[4px] gap-3">
            <Avatar name={user?.name || "Employee"} accent={PRIMARY} size={32} />
            <div className={`flex flex-col min-w-0 transition-all duration-300 whitespace-nowrap ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}>
              <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>{user?.name ?? "Employee"}</p>
              <p style={{ fontSize: 9, color: "#64748B" }}>Employee</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} title={isCollapsed ? "Sign Out" : undefined} className="flex items-center justify-start h-10 w-full pl-[11px] gap-3 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white hover:bg-white/10 overflow-hidden" style={{ fontSize: 12 }}>
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
              placeholder="Search campaigns..."
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              style={{ fontSize: 12 }}
            />
          </div>
          <EmployeeBreadcrumbs campaigns={campaigns} />
          <div className="flex-1" />
          <button type="button" className="relative text-slate-500 cursor-pointer hover:text-slate-800 transition-colors" aria-label="Notifications">
            <Bell size={16} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: DANGER }} />
          </button>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-1">
            <Avatar name={user?.name || "Employee"} accent={PRIMARY} size={28} />
            <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{user?.name || "Employee"}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        <main className="flex-1 p-5 overflow-y-auto relative">
          <EmployeeContentRoutes campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} onLogout={handleLogout} selectedIds={selectedIds} onToggleCompare={onToggleCompare} onClearCompare={onClearCompare} />
          <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/employee/campaigns/compare" onClear={onClearCompare} />
        </main>
      </div>
    </div>
  );
}

function MobileShell({
  campaigns,
  metricsByCampaign,
  loading,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  campaigns: EmployeeCampaign[];
  metricsByCampaign: Record<string, EmployeeMetric[]>;
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
  const tabs = [
    { label: "Home", path: "/employee/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", path: "/employee/campaigns", icon: Megaphone },
    { label: "Reports", path: "/employee/reports", icon: FileBarChart },
    { label: "Email", path: "/employee/email", icon: Mail },
    { label: "Sync", path: "/employee/sync-status", icon: RefreshCw },
    { label: "Settings", path: "/employee/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col bg-white h-[100dvh] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
        <button type="button" onClick={() => navigate("/employee/dashboard")} className="flex items-center gap-1.5">
          <div className="rounded-md p-1" style={{ background: PRIMARY }}>
            <Cloud size={12} className="text-white" />
          </div>
          <span className="font-bold text-slate-800" style={{ fontSize: 12 }}>CloudCRM</span>
        </button>
        <div className="flex items-center gap-2.5">
          <Bell size={15} className="text-slate-500" />
          <button type="button" onClick={handleLogout} className="flex items-center gap-1 text-slate-500" aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative p-3" style={{ background: "#F8FAFC" }}>
        <PageTransition sectionKey={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/employee/dashboard" replace />} />
            <Route path="dashboard" element={<Overview campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} />} />
            <Route path="campaigns" element={loading ? <TableSkeleton cols={8} rows={6} /> : <CampaignTable campaigns={campaigns} title="My Campaigns" selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
            <Route path="campaigns/compare" element={<RoleCampaignComparisonPage campaigns={campaigns} selectedIds={selectedIds} localMetricsByCampaign={metricsByCampaign} backPath="/employee/campaigns" onClear={onClearCompare} />} />
            <Route path="clients/:clientId" element={<ClientPage campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
            <Route path="clients/:clientId/campaigns/:campaignId" element={<CampaignDetailPage campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} />} />
            <Route path="reports" element={<Reports />} />
            <Route path="email" element={<EmailCenter />} />
            <Route path="sync-status" element={<SyncStatusM />} />
            <Route path="settings" element={<SettingsM onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/employee/dashboard" replace />} />
          </Routes>
        </PageTransition>
        <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/employee/campaigns/compare" onClear={onClearCompare} />
      </main>

      <div className="flex border-t border-slate-100 bg-white flex-shrink-0">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = path === "/employee/dashboard" ? location.pathname === path : location.pathname.startsWith(path);
          return (
            <button
              key={label}
              type="button"
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

export function EmployeeDashboard() {
  const { apiFetch, user } = useAuth();
  const [campaigns, setCampaigns] = useState<EmployeeCampaign[]>([]);
  const [metricsByCampaign, setMetricsByCampaign] = useState<Record<string, EmployeeMetric[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { selectedIds, toggleCampaign, clearSelection } = useCampaignCompareSelection();

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    apiFetch(`/api/campaigns?employee_id=${encodeURIComponent(user.id)}`)
      .then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      })
      .then(async (data) => {
        const nextCampaigns = data.campaigns || [];
        setCampaigns(nextCampaigns);
        const entries = await Promise.all(
          nextCampaigns.map((campaign: EmployeeCampaign) =>
            apiFetch(`/api/campaigns/${campaign.id}?employee_id=${encodeURIComponent(user.id)}`)
              .then((res) => {
                if (res.status === 403) throw new Error("forbidden");
                return res.ok ? res.json() : { metrics: [] };
              })
              .then((detail) => [campaign.id, detail.metrics || []] as const)
          )
        );
        setMetricsByCampaign(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (error.message === "forbidden") toast.error("Access denied");
      })
      .finally(() => setLoading(false));
  }, [apiFetch, user?.id]);

  return (
    <div className="min-h-screen w-full bg-slate-50 relative">
      <div className="hidden md:block w-full">
        <DesktopShell campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} search={search} setSearch={setSearch} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
      <div className="block md:hidden w-full">
        <MobileShell campaigns={campaigns} metricsByCampaign={metricsByCampaign} loading={loading} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
    </div>
  );
}
