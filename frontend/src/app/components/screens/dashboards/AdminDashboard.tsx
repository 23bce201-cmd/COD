// Admin dashboard shell with navigation routes, including Reports and Email automation tabs.
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  FileBarChart,
  Kanban as KanbanIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Reports } from "../reports/Reports";
import { EmailCenter } from "../email/EmailCenter";
import { SettingsD, SettingsM } from "../settings/Settings";
import { SyncStatusD, SyncStatusM } from "../integrations/SyncStatus";
import { TeamAccess } from "../team/TeamAccess";
import { KanbanBoard } from "../kanban/KanbanBoard";
import { AdminView as AttendanceAdminView } from "../attendance/AdminView";
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
  NotificationPanel,
  RoleCampaignComparisonPage,
  roleCompareCampaigns,
  useCampaignCompareSelection,
} from "./RoleDashboardTools";

type AdminClient = {
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

type CampaignDetail = CampaignRow & {
  start_date?: string | null;
  end_date?: string | null;
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
  source?: string | null;
  installs?: number | string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  roas?: number | string | null;
};

type Assignment = {
  id: string;
  manager_id: string;
  client_id: string;
  manager_name: string;
  manager_email?: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  display_role?: string;
  manager_id?: string | null;
  is_active?: boolean;
};

type RangeKey = "7D" | "30D" | "3M" | "6M";
type ClientSortKey = "name" | "manager" | "spend" | "roas" | "conversions" | "leads" | "active" | "status";
type CampaignSortKey = "name" | "employee" | "status" | "spend" | "conversions" | "roas" | "ctr" | "leads";
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
const PLATFORM_FILTERS = ["all", "google_ads", "meta_ads", "linkedin_ads", "twitter_ads"];

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
    .toUpperCase() || "NA";
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

function campaignCtr(campaign: CampaignRow) {
  const impressions = n(campaign.total_impressions);
  return impressions > 0 ? (n(campaign.total_clicks) / impressions) * 100 : 0;
}

function campaignRoas(campaign: CampaignRow) {
  const spend = n(campaign.total_spend);
  return spend > 0 ? n(campaign.total_revenue) / spend : 0;
}

function campaignInstalls(campaign: CampaignRow) {
  return campaign.platform === "twitter_ads" ? n(campaign.total_conversions) : 0;
}

function clientCampaigns(clientId: string, campaigns: CampaignRow[]) {
  return campaigns.filter((campaign) => campaign.client_id === clientId);
}

function clientSpend(client: AdminClient, campaigns: CampaignRow[]) {
  const campaignSpend = campaigns.reduce((sum, campaign) => sum + n(campaign.total_spend), 0);
  return campaignSpend || n(client.total_spend);
}

function clientRevenue(client: AdminClient, campaigns: CampaignRow[]) {
  const campaignRevenue = campaigns.reduce((sum, campaign) => sum + n(campaign.total_revenue), 0);
  return campaignRevenue || n(client.total_revenue);
}

function clientRoas(client: AdminClient, campaigns: CampaignRow[]) {
  const spend = clientSpend(client, campaigns);
  return spend > 0 ? clientRevenue(client, campaigns) / spend : 0;
}

function clientConversions(campaigns: CampaignRow[]) {
  return campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0);
}

function clientLeads(client: AdminClient, campaigns: CampaignRow[]) {
  const campaignLeads = campaigns.reduce((sum, campaign) => sum + n(campaign.total_leads), 0);
  return campaignLeads || n(client.total_leads);
}

function clientActiveCampaigns(campaigns: CampaignRow[]) {
  return campaigns.filter((campaign) => campaign.status === "active").length;
}

function managerForClient(clientId: string, assignments: Assignment[]) {
  return assignments.find((assignment) => assignment.client_id === clientId);
}

function healthForClient(client: AdminClient, campaigns: CampaignRow[]) {
  const spend = clientSpend(client, campaigns);
  const budget = n(client.monthly_budget);
  const roas = clientRoas(client, campaigns);
  if (budget > 0 && spend > budget) return "Over Budget";
  if (campaigns.length > 0 && (clientActiveCampaigns(campaigns) === 0 || roas < 1.2)) return "At Risk";
  return "On Track";
}

function normalizeTrend(rows: MetricRow[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(a.period || a.date).getTime() - new Date(b.period || b.date).getTime())
    .map((row) => {
      const spend = n(row.spend);
      const clicks = n(row.clicks);
      const impressions = n(row.impressions);
      const revenue = n(row.revenue);
      const conversions = n(row.conversions);
      const source = row.source || "manual";
      const installs = n(row.installs) || (source === "twitter_ads" ? conversions : 0);
      return {
        ...row,
        label: new Date(row.period || row.date).toLocaleDateString("en-US", {
          month: "short",
          day: row.period ? undefined : "numeric",
        }),
        spend,
        leads: n(row.leads),
        reach: n(row.reach),
        conversions,
        revenue,
        clicks,
        impressions,
        installs,
        roas: spend > 0 ? revenue / spend : n(row.roas),
        ctr: impressions > 0 ? (clicks / impressions) * 100 : n(row.ctr),
        cpc: clicks > 0 ? spend / clicks : n(row.cpc),
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      };
    });
}

function metricDelta(rows: MetricRow[], key: "spend" | "conversions" | "leads" | "revenue") {
  if (rows.length < 2) return { value: "No prior period", up: true };
  const normalized = normalizeTrend(rows);
  const half = Math.max(1, Math.floor(normalized.length / 2));
  const previous = normalized.slice(0, half).reduce((sum, row) => sum + n(row[key]), 0);
  const current = normalized.slice(half).reduce((sum, row) => sum + n(row[key]), 0);
  if (previous === 0) return { value: current > 0 ? "+100% vs prev" : "0% vs prev", up: true };
  const delta = ((current - previous) / previous) * 100;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`, up: delta >= 0 };
}

function roasDelta(rows: MetricRow[]) {
  if (rows.length < 2) return { value: "No prior period", up: true };
  const normalized = normalizeTrend(rows);
  const half = Math.max(1, Math.floor(normalized.length / 2));
  const previousRows = normalized.slice(0, half);
  const currentRows = normalized.slice(half);
  const previousSpend = previousRows.reduce((sum, row) => sum + n(row.spend), 0);
  const previousRevenue = previousRows.reduce((sum, row) => sum + n(row.revenue), 0);
  const currentSpend = currentRows.reduce((sum, row) => sum + n(row.spend), 0);
  const currentRevenue = currentRows.reduce((sum, row) => sum + n(row.revenue), 0);
  const previous = previousSpend > 0 ? previousRevenue / previousSpend : 0;
  const current = currentSpend > 0 ? currentRevenue / currentSpend : 0;
  if (previous === 0) return { value: current > 0 ? "+100% vs prev" : "0% vs prev", up: true };
  const delta = ((current - previous) / previous) * 100;
  return { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`, up: delta >= 0 };
}

function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const change = value - from;
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(from + change * easeOutExpo(progress));
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
  return (
    <span className={className} style={style}>
      {formatter(display)}
    </span>
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
      <span className="text-slate-500 font-semibold uppercase tracking-wide" style={{ fontSize: 11 }}>
        {label}
      </span>
      <CountedValue
        value={value}
        formatter={formatter}
        className="text-slate-900 font-semibold font-mono tabular-nums"
        style={{ fontSize: 24 }}
      />
      <div className="flex items-center gap-1">
        {up ? <ArrowUpRight size={12} style={{ color: SUCCESS }} /> : <ArrowDownRight size={12} style={{ color: DANGER }} />}
        <span className="font-medium" style={{ fontSize: 11, color: up ? SUCCESS : DANGER }}>
          {delta}
        </span>
      </div>
    </Card>
  );
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

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    "On Track": { bg: "#ECFDF5", text: "#065F46", dot: SUCCESS },
    "At Risk": { bg: "#FFFBEB", text: "#92400E", dot: WARNING },
    "Over Budget": { bg: "#FFF1F2", text: "#9F1239", dot: DANGER },
  };
  const c = colors[status] || colors["At Risk"];
  return (
    <Badge className="rounded-full border-0 px-2 py-0.5 gap-1.5" style={{ background: c.bg, color: c.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <Badge
      className="rounded border-0 px-2 py-0.5"
      style={{ background: `${platformColor(platform)}1A`, color: platformColor(platform), fontSize: 11 }}
    >
      {platformLabel(platform)}
    </Badge>
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
        <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>
          {title}
        </h2>
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

function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (value: RangeKey) => void }) {
  return (
    <div className="flex rounded-lg p-1 gap-1 bg-slate-200" aria-label="Date range">
      {RANGE_OPTIONS.map((item) => (
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

function AdminBreadcrumbs({ clients, campaigns }: { clients: AdminClient[]; campaigns: CampaignRow[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
  const page = parts[1] || "dashboard";
  const clientId = page === "clients" && parts[2] ? parts[2] : undefined;
  const campaignId = parts[3] === "campaigns" ? parts[4] : undefined;
  const client = clients.find((item) => item.id === clientId);
  const campaign = campaigns.find((item) => item.id === campaignId);
  const flatLabels: Record<string, string> = {
    clients: "All Clients",
    campaigns: "Campaigns",
    kanban: "Kanban Board",
    reports: "Reports",
    "sync-status": "Sync Status",
    "team-access": "Team & Access",
    managers: "Managers",
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
              <button type="button" onClick={() => navigate("/admin/dashboard")} className="hover:text-indigo-600 transition-colors">
                Dashboard
              </button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {page !== "dashboard" && !clientId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-slate-800">{flatLabels[page] || "Admin"}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
        {clientId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {campaignId ? (
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => navigate(`/admin/clients/${clientId}`)} className="hover:text-indigo-600 transition-colors">
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
            <BreadcrumbItem>
              <BreadcrumbPage className="text-slate-800">{campaign?.name || "Campaign"}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function platformStatsFromCampaigns(campaigns: CampaignRow[]) {
  const grouped = new Map<string, { platform: string; spend: number; revenue: number; conversions: number; leads: number; installs: number; campaigns: number }>();
  campaigns.forEach((campaign) => {
    const current = grouped.get(campaign.platform) || {
      platform: campaign.platform,
      spend: 0,
      revenue: 0,
      conversions: 0,
      leads: 0,
      installs: 0,
      campaigns: 0,
    };
    current.spend += n(campaign.total_spend);
    current.revenue += n(campaign.total_revenue);
    current.conversions += n(campaign.total_conversions);
    current.leads += n(campaign.total_leads);
    current.installs += campaignInstalls(campaign);
    current.campaigns += 1;
    grouped.set(campaign.platform, current);
  });
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    roas: item.spend > 0 ? item.revenue / item.spend : 0,
  }));
}

function PlatformBreakdownBars({ data }: { data: Array<{ platform: string; spend: number }> }) {
  const total = data.reduce((sum, item) => sum + n(item.spend), 0);
  if (data.length === 0 || total === 0) return <EmptyState>No platform spend available.</EmptyState>;

  return (
    <div className="flex flex-col gap-3">
      {data.map((item, index) => {
        const pct = total > 0 ? (n(item.spend) / total) * 100 : 0;
        return (
          <div key={item.platform} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: platformColor(item.platform) }} />
                <span className="text-slate-700 font-medium truncate" style={{ fontSize: 12 }}>
                  {platformLabel(item.platform)}
                </span>
              </div>
              <span className="text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                {fmtMoney(n(item.spend), false)} / {fmtPct(pct)}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${platformLabel(item.platform)} spend ${fmtMoney(n(item.spend), false)}, ${fmtPct(pct)} of total spend`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: platformColor(item.platform), transitionDelay: `${index * 80}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClientsTable({
  clients,
  campaigns,
  assignments,
  search,
  loading,
  title = "All Clients",
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  search: string;
  loading: boolean;
  title?: string;
}) {
  const navigate = useNavigate();
  const [managerFilter, setManagerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ClientSortKey>("spend");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const managerOptions = useMemo(() => {
    const seen = new Map<string, Assignment>();
    assignments.forEach((assignment) => seen.set(assignment.manager_id, assignment));
    return Array.from(seen.values());
  }, [assignments]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .map((client) => {
        const ownedCampaigns = clientCampaigns(client.id, campaigns);
        const manager = managerForClient(client.id, assignments);
        const health = healthForClient(client, ownedCampaigns);
        return {
          client,
          campaigns: ownedCampaigns,
          manager,
          health,
          spend: clientSpend(client, ownedCampaigns),
          roas: clientRoas(client, ownedCampaigns),
          conversions: clientConversions(ownedCampaigns),
          leads: clientLeads(client, ownedCampaigns),
          active: clientActiveCampaigns(ownedCampaigns),
        };
      })
      .filter((row) => {
        const matchesSearch =
          !q ||
          row.client.name.toLowerCase().includes(q) ||
          (row.client.industry || "").toLowerCase().includes(q) ||
          (row.manager?.manager_name || "").toLowerCase().includes(q);
        const matchesManager = managerFilter === "all" || row.manager?.manager_id === managerFilter;
        const matchesStatus = statusFilter === "all" || row.health === statusFilter;
        return matchesSearch && matchesManager && matchesStatus;
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        const values: Record<ClientSortKey, [string | number, string | number]> = {
          name: [a.client.name, b.client.name],
          manager: [a.manager?.manager_name || "Unassigned", b.manager?.manager_name || "Unassigned"],
          spend: [a.spend, b.spend],
          roas: [a.roas, b.roas],
          conversions: [a.conversions, b.conversions],
          leads: [a.leads, b.leads],
          active: [a.active, b.active],
          status: [a.health, b.health],
        };
        const [av, bv] = values[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
        return String(av).localeCompare(String(bv)) * direction;
      });
  }, [assignments, campaigns, clients, managerFilter, search, sortDirection, sortKey, statusFilter]);

  const setSort = (key: ClientSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" || key === "manager" || key === "status" ? "asc" : "desc");
  };

  if (loading) return <TableSkeleton cols={8} rows={6} />;

  return (
    <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>
            {title}
          </h2>
          <Badge variant="secondary" className="rounded-full" style={{ fontSize: 11 }}>
            {clients.length}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={14} className="text-slate-400" aria-hidden="true" />
          <select
            value={managerFilter}
            onChange={(event) => setManagerFilter(event.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
            style={{ fontSize: 12 }}
            aria-label="Filter clients by manager"
          >
            <option value="all">All managers</option>
            {managerOptions.map((manager) => (
              <option key={manager.manager_id} value={manager.manager_id}>
                {manager.manager_name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
            style={{ fontSize: 12 }}
            aria-label="Filter clients by health"
          >
            <option value="all">All statuses</option>
            <option value="On Track">On Track</option>
            <option value="At Risk">At Risk</option>
            <option value="Over Budget">Over Budget</option>
          </select>
        </div>
      </div>
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow style={{ background: "#F8FAFC" }}>
            {[
              ["Client", "name"],
              ["Assigned Manager", "manager"],
              ["Spend", "spend"],
              ["ROAS", "roas"],
              ["Conversions", "conversions"],
              ["Leads", "leads"],
              ["Active campaigns", "active"],
              ["Status", "status"],
            ].map(([label, key]) => (
              <TableHead key={key} className="px-4 py-2.5 text-slate-500" style={{ fontSize: 11 }}>
                <SortButton
                  label={label}
                  active={sortKey === key}
                  direction={sortDirection}
                  onClick={() => setSort(key as ClientSortKey)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const path = `/admin/clients/${row.client.id}`;
            return (
              <TableRow
                key={row.client.id}
                tabIndex={0}
                role="button"
                onClick={() => navigate(path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") navigate(path);
                }}
                className="cursor-pointer border-l-2 border-l-transparent hover:border-l-indigo-400 hover:bg-slate-50 transition-colors"
              >
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-48">
                    <Avatar name={row.client.name} accent={platformColor(PLATFORM_FILTERS[(index % 4) + 1])} size={28} />
                    <div className="min-w-0">
                      <p className="text-slate-800 font-semibold truncate" style={{ fontSize: 12 }}>
                        {row.client.name}
                      </p>
                      <p className="text-slate-400 truncate" style={{ fontSize: 10 }}>
                        {row.client.industry || "Uncategorized"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {row.manager ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={row.manager.manager_name} accent={PRIMARY} size={24} />
                      <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>
                        {row.manager.manager_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400" style={{ fontSize: 12 }}>Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>
                  {fmtMoney(row.spend)}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>
                  {fmtRoas(row.roas)}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>
                  {fmtNumber(row.conversions)}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>
                  {fmtNumber(row.leads)}
                </TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>
                  {row.active}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <HealthBadge status={row.health} />
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-8 text-center text-slate-400" style={{ fontSize: 12 }}>
                No clients match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function AdminOverview({
  clients,
  campaigns,
  assignments,
  loading,
  search,
  clientsOnly = false,
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  loading: boolean;
  search: string;
  clientsOnly?: boolean;
}) {
  const { apiFetch, user } = useAuth();
  const [range, setRange] = useState<RangeKey>("30D");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [trend, setTrend] = useState<MetricRow[]>([]);
  const [platformSpend, setPlatformSpend] = useState<Array<{ platform: string; spend: number }>>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    const { from, to, bucket } = rangeBounds(range);
    setChartsLoading(true);
    Promise.all([
      apiFetch(`/api/charts/manager-performance?from=${from}&to=${to}&bucket=${bucket}`).then((res) => (res.ok ? res.json() : { data: [] })),
      apiFetch(`/api/charts/agency-spend?from=${from}&to=${to}`).then((res) => (res.ok ? res.json() : { data: [] })),
    ])
      .then(([trendData, spendData]) => {
        setTrend(trendData.data || []);
        setPlatformSpend((spendData.data || []).map((item: { platform: string; spend: string | number }) => ({
          platform: item.platform,
          spend: n(item.spend),
        })));
      })
      .finally(() => setChartsLoading(false));
  }, [apiFetch, range]);

  const normalizedTrend = useMemo(() => normalizeTrend(trend), [trend]);
  const platformStats = useMemo(() => platformStatsFromCampaigns(campaigns), [campaigns]);
  const filteredPlatformStats = platformStats.filter((item) => platformFilter === "all" || item.platform === platformFilter);
  const comparisonSpend = platformSpend.length > 0 ? platformSpend : platformStats.map((item) => ({ platform: item.platform, spend: item.spend }));
  const totals = useMemo(() => {
    const totalSpend = campaigns.reduce((sum, campaign) => sum + n(campaign.total_spend), 0) || clients.reduce((sum, client) => sum + n(client.total_spend), 0);
    const totalRevenue = campaigns.reduce((sum, campaign) => sum + n(campaign.total_revenue), 0) || clients.reduce((sum, client) => sum + n(client.total_revenue), 0);
    return {
      totalSpend,
      avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      totalConversions: campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0),
      totalLeads: campaigns.reduce((sum, campaign) => sum + n(campaign.total_leads), 0) || clients.reduce((sum, client) => sum + n(client.total_leads), 0),
      activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
      installs: campaigns.reduce((sum, campaign) => sum + campaignInstalls(campaign), 0),
    };
  }, [campaigns, clients]);

  const showSkeleton = useDelayedLoading(loading || chartsLoading, 100);
  if (showSkeleton && !clientsOnly) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
        <TableSkeleton cols={8} rows={5} />
      </div>
    );
  }

  if (clientsOnly) {
    return (
      <div className="flex flex-col gap-4 data-enter">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>All Clients</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>
            {clients.length} clients across {assignments.length} manager assignments
          </p>
        </div>
        <ClientsTable clients={clients} campaigns={campaigns} assignments={assignments} search={search} loading={loading} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>
            Admin Dashboard
          </h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>
            {clients.length} clients / {campaigns.length} campaigns / signed in as {user?.name || "Admin"}
          </p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <CustomizableMetricGrid
        storageKey={`admin_dashboard_layout_${user?.id || "default"}`}
        columnsClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3"
        metrics={[
          { key: "spend", label: "Total spend", value: fmtMoney(totals.totalSpend), rawValue: totals.totalSpend, delta: metricDelta(trend, "spend").value, up: metricDelta(trend, "spend").up },
          { key: "roas", label: "Avg ROAS", value: fmtRoas(totals.avgRoas), rawValue: totals.avgRoas, delta: roasDelta(trend).value, up: roasDelta(trend).up },
          { key: "conversions", label: "Conversions", value: fmtNumber(totals.totalConversions), rawValue: totals.totalConversions, delta: metricDelta(trend, "conversions").value, up: metricDelta(trend, "conversions").up },
          { key: "leads", label: "Total leads", value: fmtNumber(totals.totalLeads), rawValue: totals.totalLeads, delta: metricDelta(trend, "leads").value, up: metricDelta(trend, "leads").up },
          { key: "active", label: "Active campaigns", value: fmtNumber(totals.activeCampaigns), rawValue: totals.activeCampaigns, delta: `${fmtNumber(totals.installs)} installs`, up: true },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        <ChartCard
          title="Spend vs ROAS by platform"
          ariaLabel="Grouped platform spend bars with ROAS line overlay"
          right={
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
              style={{ fontSize: 11 }}
              aria-label="Filter platform chart"
            >
              {PLATFORM_FILTERS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform === "all" ? "All platforms" : platformLabel(platform)}
                </option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={filteredPlatformStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="platform" tickFormatter={platformLabel} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
              <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
              <Tooltip
                formatter={(value: number, name: string) => (name === "spend" ? [fmtMoney(Number(value), false), "Spend"] : [fmtRoas(Number(value)), "ROAS"])}
                labelFormatter={(label) => platformLabel(String(label))}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
              />
              <Bar yAxisId="spend" dataKey="spend" name="spend" radius={[3, 3, 0, 0]}>
                {filteredPlatformStats.map((entry) => (
                  <Cell key={entry.platform} fill={platformColor(entry.platform)} />
                ))}
              </Bar>
              <Line yAxisId="roas" type="monotone" dataKey="roas" name="roas" stroke={SUCCESS} strokeWidth={2} dot={{ r: 3, fill: SUCCESS }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Platform comparison" ariaLabel="Percent of total spend by advertising platform">
          <PlatformBreakdownBars data={comparisonSpend} />
        </ChartCard>
      </div>

      <ChartCard title="Conversions and leads over time" ariaLabel="Conversions and leads trend over the selected time range">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={normalizedTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            <Line type="monotone" dataKey="conversions" stroke={PRIMARY} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="leads" stroke={SUCCESS} strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard title="Conversion value over time" ariaLabel="Conversion value trend for all clients">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={normalizedTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
              <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Area type="monotone" dataKey="revenue" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Installs by platform" ariaLabel="Estimated installs by platform for admin-visible campaigns">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={platformStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="platform" tickFormatter={platformLabel} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar dataKey="installs" radius={[3, 3, 0, 0]}>
                {platformStats.map((entry) => (
                  <Cell key={entry.platform} fill={platformColor(entry.platform)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ClientsTable clients={clients} campaigns={campaigns} assignments={assignments} search={search} loading={loading} />
    </div>
  );
}

function CampaignsTable({
  client,
  campaigns,
  search,
  title = "Campaigns",
  selectedIds = [],
  onToggleCompare,
}: {
  client?: AdminClient;
  campaigns: CampaignRow[];
  search: string;
  title?: string;
  selectedIds?: string[];
  onToggleCompare?: (campaignId: string) => void;
}) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<CampaignSortKey>("spend");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => {
        const employeeNames = (campaign.assigned_employees || []).map((employee) => employee.name).join(" ").toLowerCase();
        const matchesSearch = !q || campaign.name.toLowerCase().includes(q) || platformLabel(campaign.platform).toLowerCase().includes(q) || employeeNames.includes(q);
        const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        const aEmployee = a.assigned_employees?.[0]?.name || "Unassigned";
        const bEmployee = b.assigned_employees?.[0]?.name || "Unassigned";
        const values: Record<CampaignSortKey, [string | number, string | number]> = {
          name: [a.name, b.name],
          employee: [aEmployee, bEmployee],
          status: [statusLabel(a.status), statusLabel(b.status)],
          spend: [n(a.total_spend), n(b.total_spend)],
          conversions: [n(a.total_conversions), n(b.total_conversions)],
          roas: [campaignRoas(a), campaignRoas(b)],
          ctr: [campaignCtr(a), campaignCtr(b)],
          leads: [n(a.total_leads), n(b.total_leads)],
        };
        const [av, bv] = values[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
        return String(av).localeCompare(String(bv)) * direction;
      });
  }, [campaigns, search, sortDirection, sortKey, statusFilter]);

  const setSort = (key: CampaignSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" || key === "employee" || key === "status" ? "asc" : "desc");
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
              style={{
                fontSize: 11,
                background: statusFilter === value ? "#fff" : "transparent",
                color: statusFilter === value ? "#1E293B" : "#64748B",
                boxShadow: statusFilter === value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow style={{ background: "#F8FAFC" }}>
            {onToggleCompare && (
              <TableHead className="px-4 py-2.5 text-slate-500" style={{ fontSize: 11 }}>
                <span className="sr-only">Compare</span>
              </TableHead>
            )}
            {[
              ["Campaign", "name"],
              ["Assigned Employee", "employee"],
              ["Status", "status"],
              ["Spend", "spend"],
              ["Conversions", "conversions"],
              ["ROAS", "roas"],
              ["CTR", "ctr"],
              ["Leads", "leads"],
            ].map(([label, key]) => (
              <TableHead key={key} className="px-4 py-2.5 text-slate-500" style={{ fontSize: 11 }}>
                <SortButton
                  label={label}
                  active={sortKey === key}
                  direction={sortDirection}
                  onClick={() => setSort(key as CampaignSortKey)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((campaign) => {
            const path = `/admin/clients/${client?.id || campaign.client_id}/campaigns/${campaign.id}`;
            const employee = campaign.assigned_employees?.[0];
            return (
              <TableRow
                key={campaign.id}
                tabIndex={0}
                role="button"
                onClick={() => navigate(path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") navigate(path);
                }}
                className="cursor-pointer border-l-2 border-l-transparent hover:border-l-indigo-400 hover:bg-slate-50 transition-colors"
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
                <TableCell className="px-4 py-3">
                  {employee ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={employee.name} accent={TEAL} size={24} />
                      <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{employee.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400" style={{ fontSize: 12 }}>Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3"><StatusBadge status={campaign.status} /></TableCell>
                <TableCell className="px-4 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtMoney(n(campaign.total_spend))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_conversions))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtRoas(campaignRoas(campaign))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtPct(campaignCtr(campaign))}</TableCell>
                <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_leads))}</TableCell>
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
  clients,
  campaigns,
  assignments,
  clientsLoading,
  search,
  selectedIds,
  onToggleCompare,
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  clientsLoading: boolean;
  search: string;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
}) {
  const { clientId } = useParams<{ clientId: string }>();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30D");
  const [trend, setTrend] = useState<MetricRow[]>([]);
  const [platformSplit, setPlatformSplit] = useState<Array<{ platform: string; spend: number }>>([]);
  const [loading, setLoading] = useState(true);

  const client = clients.find((item) => item.id === clientId);
  const ownedCampaigns = clientId ? clientCampaigns(clientId, campaigns) : [];
  const manager = clientId ? managerForClient(clientId, assignments) : undefined;

  useEffect(() => {
    if (!clientId) return;
    const { from, to } = rangeBounds(range);
    setLoading(true);
    Promise.all([
      apiFetch(`/api/charts/performance?client_id=${clientId}&from=${from}&to=${to}`).then((res) => (res.ok ? res.json() : { data: [] })),
      apiFetch(`/api/charts/platform-split?client_id=${clientId}&from=${from}&to=${to}`).then((res) => (res.ok ? res.json() : { data: [] })),
    ])
      .then(([trendData, splitData]) => {
        setTrend(trendData.data || []);
        setPlatformSplit((splitData.data || []).map((item: { platform: string; spend: string | number }) => ({
          platform: item.platform,
          spend: n(item.spend),
        })));
      })
      .finally(() => setLoading(false));
  }, [apiFetch, clientId, range]);

  const showSkeleton = useDelayedLoading(clientsLoading || loading, 100);
  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
        <TableSkeleton cols={8} rows={5} />
      </div>
    );
  }

  if (!client) return <EmptyState>Client not found or no longer active.</EmptyState>;

  const normalizedTrend = normalizeTrend(trend);
  const stats = {
    spend: clientSpend(client, ownedCampaigns),
    roas: clientRoas(client, ownedCampaigns),
    conversions: clientConversions(ownedCampaigns),
    leads: clientLeads(client, ownedCampaigns),
    revenue: clientRevenue(client, ownedCampaigns),
  };
  const health = healthForClient(client, ownedCampaigns);
  const split = platformSplit.length > 0 ? platformSplit : platformStatsFromCampaigns(ownedCampaigns).map((item) => ({ platform: item.platform, spend: item.spend }));

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")} className="text-slate-500 hover:text-indigo-600">
          <ArrowLeft size={15} />
          Back
        </Button>
      </div>

      <Card className="bg-white rounded-xl p-4 gap-3" style={{ border: "1px solid #E2E8F0" }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={client.name} accent={PRIMARY} size={38} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-slate-900 font-bold truncate" style={{ fontSize: 20 }}>{client.name}</h1>
                <HealthBadge status={health} />
                {client.industry && <Badge variant="secondary" className="rounded-full" style={{ fontSize: 11 }}>{client.industry}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-500" style={{ fontSize: 12 }}>
                <span className="flex items-center gap-1.5">
                  Assigned Manager:
                  {manager ? (
                    <>
                      <Avatar name={manager.manager_name} accent={PRIMARY} size={22} />
                      <span className="text-slate-700 font-medium">{manager.manager_name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </span>
                <span>{ownedCampaigns.length} campaigns</span>
              </div>
            </div>
          </div>
          <RangeTabs value={range} onChange={setRange} />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="Total spend" value={stats.spend} formatter={fmtMoney} delta={metricDelta(trend, "spend").value} up={metricDelta(trend, "spend").up} />
        <StatCard label="ROAS" value={stats.roas} formatter={fmtRoas} delta={roasDelta(trend).value} up={roasDelta(trend).up} delay={60} />
        <StatCard label="Conversions" value={stats.conversions} formatter={fmtNumber} delta={metricDelta(trend, "conversions").value} up={metricDelta(trend, "conversions").up} delay={120} />
        <StatCard label="Leads" value={stats.leads} formatter={fmtNumber} delta={metricDelta(trend, "leads").value} up={metricDelta(trend, "leads").up} delay={180} />
        <StatCard label="Conversion value" value={stats.revenue} formatter={fmtMoney} delta={metricDelta(trend, "revenue").value} up={metricDelta(trend, "revenue").up} delay={240} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3">
        <ChartCard title="Spend vs ROAS over time" ariaLabel="Client spend bars with ROAS line over time">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={normalizedTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
              <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar yAxisId="spend" dataKey="spend" fill={PRIMARY} radius={[3, 3, 0, 0]} />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke={SUCCESS} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Platform breakdown" ariaLabel="Client spend percentage by platform">
          <PlatformBreakdownBars data={split} />
        </ChartCard>
      </div>

      <ChartCard title="Conversions and leads over time" ariaLabel="Client conversions and leads trend over time">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={normalizedTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            <Line type="monotone" dataKey="conversions" stroke={PRIMARY} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="leads" stroke={SUCCESS} strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <CampaignsTable client={client} campaigns={ownedCampaigns} search={search} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />
    </div>
  );
}

function CampaignDetailPage({
  clients,
  assignments,
}: {
  clients: AdminClient[];
  assignments: Assignment[];
}) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    apiFetch(`/api/campaigns/${campaignId}`)
      .then((res) => {
        if (res.status === 403) {
          toast.error("Access denied");
          return { campaign: null, metrics: [] };
        }
        return res.ok ? res.json() : { campaign: null, metrics: [] };
      })
      .then((data) => {
        setCampaign(data.campaign || null);
        setMetrics(data.metrics || []);
      })
      .finally(() => setLoading(false));
  }, [apiFetch, campaignId]);

  const showSkeleton = useDelayedLoading(loading, 100);
  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!campaign) return <EmptyState>Campaign not found or no longer accessible.</EmptyState>;

  const client = clients.find((item) => item.id === campaign.client_id);
  const manager = managerForClient(campaign.client_id, assignments);
  const employee = campaign.assigned_employees?.[0];
  const chartData = normalizeTrend(metrics);
  const totals = chartData.reduce(
    (acc, row) => {
      acc.spend += n(row.spend);
      acc.revenue += n(row.revenue);
      acc.conversions += n(row.conversions);
      acc.leads += n(row.leads);
      acc.installs += n(row.installs) || (campaign.platform === "twitter_ads" ? n(row.conversions) : 0);
      return acc;
    },
    { spend: 0, revenue: 0, conversions: 0, leads: 0, installs: 0 }
  );
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const platformData = platformStatsFromMetrics(chartData, campaign.platform);
  const engagementData = chartData.map((row) => ({
    ...row,
    likes: Math.round(n(row.clicks) * 0.42),
    comments: Math.round(n(row.clicks) * 0.12),
    shares: Math.round(n(row.clicks) * 0.08),
    follows: Math.round(n(row.clicks) * 0.05),
    frequency: n(row.reach) > 0 ? n(row.impressions) / n(row.reach) : 0,
  }));

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/clients/${campaign.client_id}`)} className="text-slate-500 hover:text-indigo-600">
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
          <div className="flex flex-wrap items-center gap-4 text-slate-500" style={{ fontSize: 12 }}>
            <span className="flex items-center gap-1.5">
              Assigned Employee:
              {employee ? (
                <>
                  <Avatar name={employee.name} accent={TEAL} size={22} />
                  <span className="text-slate-700 font-medium">{employee.name}</span>
                </>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </span>
            <span>Client: <span className="text-slate-700 font-medium">{client?.name || campaign.client_name || "Client"}</span></span>
            <span>Manager: <span className="text-slate-700 font-medium">{manager?.manager_name || "Unassigned"}</span></span>
            <span>Budget: <span className="text-slate-700 font-medium">{fmtMoney(n(campaign.budget), false)}</span></span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <StatCard label="Spend" value={totals.spend} formatter={fmtMoney} delta={metricDelta(metrics, "spend").value} up={metricDelta(metrics, "spend").up} />
        <StatCard label="ROAS" value={roas} formatter={fmtRoas} delta={roasDelta(metrics).value} up={roasDelta(metrics).up} delay={60} />
        <StatCard label="Conversions" value={totals.conversions} formatter={fmtNumber} delta={metricDelta(metrics, "conversions").value} up={metricDelta(metrics, "conversions").up} delay={120} />
        <StatCard label="Leads" value={totals.leads} formatter={fmtNumber} delta={metricDelta(metrics, "leads").value} up={metricDelta(metrics, "leads").up} delay={180} />
        <StatCard label="Conversion value" value={totals.revenue} formatter={fmtMoney} delta={metricDelta(metrics, "revenue").value} up={metricDelta(metrics, "revenue").up} delay={240} />
        <StatCard label="Installs" value={totals.installs} formatter={fmtNumber} delta="Admin metric" up={true} delay={300} />
      </div>

      <ChartCard title="Spend vs ROAS over time" ariaLabel="Campaign spend and ROAS trend over time">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
            <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            <Bar yAxisId="spend" dataKey="spend" fill={PRIMARY} radius={[3, 3, 0, 0]} />
            <Line yAxisId="roas" type="monotone" dataKey="roas" stroke={SUCCESS} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SimpleLineChart title="Conversions over time" ariaLabel="Campaign conversions over time" data={chartData} dataKey="conversions" color={PRIMARY} />
        <SimpleLineChart title="Conversion value over time" ariaLabel="Campaign conversion value over time" data={chartData} dataKey="revenue" color={PINK} formatter={fmtMoney} />
        <SimpleLineChart title="Leads over time" ariaLabel="Campaign leads over time" data={chartData} dataKey="leads" color={SUCCESS} />
        <ChartCard title="Installs by platform" ariaLabel="Campaign installs by platform">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={platformData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="platform" tickFormatter={platformLabel} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
              <Bar dataKey="installs" radius={[3, 3, 0, 0]}>
                {platformData.map((entry) => (
                  <Cell key={entry.platform} fill={platformColor(entry.platform)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Button variant="ghost" onClick={() => setShowDetailed((value) => !value)} className="self-start text-slate-600 hover:text-indigo-600">
        {showDetailed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {showDetailed ? "Hide detailed metrics" : "Show detailed metrics"}
      </Button>

      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: showDetailed ? 1700 : 0 }}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-1">
          <SimpleLineChart title="Impressions over time" ariaLabel="Campaign impressions over time" data={chartData} dataKey="impressions" color={PRIMARY} />
          <SimpleLineChart title="Clicks over time" ariaLabel="Campaign clicks over time" data={chartData} dataKey="clicks" color={SUCCESS} />
          <SimpleLineChart title="CTR trend" ariaLabel="Campaign CTR trend over time" data={chartData} dataKey="ctr" color={PINK} formatter={fmtPct} />
          <SimpleLineChart title="CPC trend" ariaLabel="Campaign CPC trend over time" data={chartData} dataKey="cpc" color={WARNING} formatter={(value) => fmtMoney(value, false)} />
          <SimpleLineChart title="CPM trend" ariaLabel="Campaign CPM trend over time" data={chartData} dataKey="cpm" color={TEAL} formatter={(value) => fmtMoney(value, false)} />
          <ChartCard title="Reach and frequency" ariaLabel="Campaign reach bars with frequency line">
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="reach" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="frequency" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }} />
                <Bar yAxisId="reach" dataKey="reach" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                <Line yAxisId="frequency" type="monotone" dataKey="frequency" stroke={PINK} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Engagement breakdown" ariaLabel="Stacked engagement mix estimated from campaign interactions" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={engagementData}>
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
        </div>
      </div>
    </div>
  );
}

function platformStatsFromMetrics(rows: ReturnType<typeof normalizeTrend>, fallbackPlatform: string) {
  const grouped = new Map<string, { platform: string; spend: number; installs: number }>();
  rows.forEach((row) => {
    const platform = row.source || fallbackPlatform;
    const current = grouped.get(platform) || { platform, spend: 0, installs: 0 };
    current.spend += n(row.spend);
    current.installs += n(row.installs) || (platform === "twitter_ads" ? n(row.conversions) : 0);
    grouped.set(platform, current);
  });
  if (grouped.size === 0) return [{ platform: fallbackPlatform, spend: 0, installs: 0 }];
  return Array.from(grouped.values());
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
  data: ReturnType<typeof normalizeTrend>;
  dataKey: keyof ReturnType<typeof normalizeTrend>[number];
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

function ManagersPage({
  users,
  assignments,
  clients,
  campaigns,
  loading,
  search,
}: {
  users: UserRow[];
  assignments: Assignment[];
  clients: AdminClient[];
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
}) {
  if (loading) return <TableSkeleton cols={5} rows={5} />;
  const q = search.trim().toLowerCase();
  const managers = users.filter((user) => (user.display_role || user.role) === "manager" && (!q || user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)));

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div>
        <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Managers</h1>
        <p className="text-slate-500" style={{ fontSize: 12 }}>Read-only manager coverage across all clients.</p>
      </div>
      <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: "#F8FAFC" }}>
              {["Manager", "Email", "Assigned Clients", "Visible Campaigns", "Status"].map((label) => (
                <TableHead key={label} className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((manager) => {
              const assignedClientIds = assignments.filter((assignment) => assignment.manager_id === manager.id).map((assignment) => assignment.client_id);
              const assignedCampaigns = campaigns.filter((campaign) => assignedClientIds.includes(campaign.client_id));
              return (
                <TableRow key={manager.id} className="hover:bg-slate-50">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={manager.name} accent={PRIMARY} size={28} />
                      <span className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{manager.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-500" style={{ fontSize: 12 }}>{manager.email}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>
                    {assignedClientIds.length} of {clients.length}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{assignedCampaigns.length}</TableCell>
                  <TableCell className="px-4 py-3"><HealthBadge status={manager.is_active === false ? "At Risk" : "On Track"} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AllCampaignsPage({
  campaigns,
  loading,
  search,
  selectedIds,
  onToggleCompare,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
}) {
  if (loading) return <TableSkeleton cols={8} rows={6} />;

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div>
        <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Campaigns</h1>
        <p className="text-slate-500" style={{ fontSize: 12 }}>
          {campaigns.length} campaigns across all clients
        </p>
      </div>
      <CampaignsTable campaigns={campaigns} search={search} title="All Campaigns" selectedIds={selectedIds} onToggleCompare={onToggleCompare} />
    </div>
  );
}

function AdminContentRoutes({
  clients,
  campaigns,
  assignments,
  users,
  loading,
  search,
  mobile,
  onLogout,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  users: UserRow[];
  loading: boolean;
  search: string;
  mobile?: boolean;
  onLogout: () => void;
  selectedIds: string[];
  onToggleCompare: (campaignId: string) => void;
  onClearCompare: () => void;
}) {
  const location = useLocation();
  const { apiFetch } = useAuth();
  return (
    <PageTransition sectionKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminOverview clients={clients} campaigns={campaigns} assignments={assignments} loading={loading} search={search} />} />
        <Route path="clients" element={<AdminOverview clients={clients} campaigns={campaigns} assignments={assignments} loading={loading} search={search} clientsOnly />} />
        <Route path="campaigns" element={<AllCampaignsPage campaigns={campaigns} loading={loading} search={search} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
        <Route path="kanban" element={<KanbanBoard search={search} />} />
        <Route path="campaigns/compare" element={<RoleCampaignComparisonPage campaigns={campaigns} selectedIds={selectedIds} apiFetch={apiFetch} buildDetailPath={(campaignId) => `/api/campaigns/${campaignId}`} backPath="/admin/campaigns" onClear={onClearCompare} />} />
        <Route path="clients/:clientId" element={<ClientPage clients={clients} campaigns={campaigns} assignments={assignments} clientsLoading={loading} search={search} selectedIds={selectedIds} onToggleCompare={onToggleCompare} />} />
        <Route path="clients/:clientId/campaigns/:campaignId" element={<CampaignDetailPage clients={clients} assignments={assignments} />} />
        <Route path="managers" element={<ManagersPage users={users} assignments={assignments} clients={clients} campaigns={campaigns} loading={loading} search={search} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="email" element={<EmailCenter />} />
        <Route path="sync-status" element={mobile ? <SyncStatusM /> : <SyncStatusD />} />
        <Route path="team-access" element={<TeamAccess />} />
        <Route path="attendance" element={<AttendanceAdminView />} />
        <Route path="settings" element={mobile ? <SettingsM onLogout={onLogout} /> : <SettingsD />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </PageTransition>
  );
}

function DesktopShell({
  clients,
  campaigns,
  assignments,
  users,
  loading,
  search,
  setSearch,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  users: UserRow[];
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Clients", path: "/admin/clients", icon: Users },
    { label: "Kanban", path: "/admin/kanban", icon: KanbanIcon },
    { label: "Campaigns", path: "/admin/campaigns", icon: Megaphone },
    { label: "Reports", path: "/admin/reports", icon: FileBarChart },
    { label: "Email", path: "/admin/email", icon: Mail },
    { label: "Attendance", path: "/admin/attendance", icon: Clock },
    { label: "Sync Status", path: "/admin/sync-status", icon: RefreshCw },
    { label: "Team & Access", path: "/admin/team-access", icon: ShieldCheck },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ];

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

        <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto" aria-label="Admin navigation">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = path === "/admin/dashboard" ? location.pathname === path || location.pathname === "/admin" : location.pathname.startsWith(path);
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
            <Avatar name={user?.name || "Admin"} accent={PRIMARY} size={32} />
            <div className={`flex flex-col min-w-0 transition-all duration-300 whitespace-nowrap ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}>
              <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>{user?.name ?? "Admin"}</p>
              <p style={{ fontSize: 9, color: "#64748B" }}>Admin</p>
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
              placeholder="Search..."
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
              style={{ fontSize: 12 }}
            />
          </div>
          <AdminBreadcrumbs clients={clients} campaigns={campaigns} />
          <div className="flex-1" />
          <NotificationPanel role="admin" />
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-1">
            <Avatar name={user?.name || "Admin"} accent={PRIMARY} size={28} />
            <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{user?.name || "Admin"}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        <main className="flex-1 p-5 overflow-y-auto relative">
          <AdminContentRoutes clients={clients} campaigns={campaigns} assignments={assignments} users={users} loading={loading} search={search} onLogout={handleLogout} selectedIds={selectedIds} onToggleCompare={onToggleCompare} onClearCompare={onClearCompare} />
          <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/admin/campaigns/compare" onClear={onClearCompare} />
        </main>
      </div>
    </div>
  );
}

function MobileShell({
  clients,
  campaigns,
  assignments,
  users,
  loading,
  selectedIds,
  onToggleCompare,
  onClearCompare,
}: {
  clients: AdminClient[];
  campaigns: CampaignRow[];
  assignments: Assignment[];
  users: UserRow[];
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
    { label: "Home", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Clients", path: "/admin/clients", icon: Users },
    { label: "Board", path: "/admin/kanban", icon: KanbanIcon },
    { label: "Managers", path: "/admin/managers", icon: UserRound },
    { label: "Attendance", path: "/admin/attendance", icon: Clock },
    { label: "Email", path: "/admin/email", icon: Mail },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col bg-white h-[100dvh] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
        <button type="button" onClick={() => navigate("/admin/dashboard")} className="flex items-center gap-1.5">
          <div className="rounded-md p-1" style={{ background: PRIMARY }}>
            <Cloud size={12} className="text-white" />
          </div>
          <span className="font-bold text-slate-800" style={{ fontSize: 12 }}>CloudCRM</span>
        </button>
        <div className="flex items-center gap-2.5">
          <NotificationPanel role="admin" />
          <button type="button" onClick={handleLogout} className="flex items-center gap-1 text-slate-500" aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative p-3" style={{ background: "#F8FAFC" }}>
        <AdminContentRoutes clients={clients} campaigns={campaigns} assignments={assignments} users={users} loading={loading} search="" mobile onLogout={handleLogout} selectedIds={selectedIds} onToggleCompare={onToggleCompare} onClearCompare={onClearCompare} />
        <CampaignCompareBar selectedCampaigns={roleCompareCampaigns(campaigns, selectedIds)} comparePath="/admin/campaigns/compare" onClear={onClearCompare} />
      </main>

      <div className="flex border-t border-slate-100 bg-white flex-shrink-0">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = path === "/admin/dashboard" ? location.pathname === path : location.pathname.startsWith(path);
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

export function AdminDashboard() {
  const { apiFetch } = useAuth();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { selectedIds, toggleCampaign, clearSelection } = useCampaignCompareSelection();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/clients").then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
      apiFetch("/api/campaigns").then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        return res.json();
      }),
      apiFetch("/api/assignments").then((res) => (res.ok ? res.json() : { assignments: [] })),
      apiFetch("/api/users").then((res) => (res.ok ? res.json() : { users: [] })),
    ])
      .then(([clientData, campaignData, assignmentData, userData]) => {
        setClients(clientData.clients || []);
        setCampaigns(campaignData.campaigns || []);
        setAssignments(assignmentData.assignments || []);
        setUsers(userData.users || []);
      })
      .catch((error) => {
        if (error.message === "forbidden") toast.error("Access denied");
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

  return (
    <div className="min-h-screen w-full bg-slate-50 relative">
      <div className="hidden md:block w-full">
        <DesktopShell clients={clients} campaigns={campaigns} assignments={assignments} users={users} loading={loading} search={search} setSearch={setSearch} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
      <div className="block md:hidden w-full">
        <MobileShell clients={clients} campaigns={campaigns} assignments={assignments} users={users} loading={loading} selectedIds={selectedIds} onToggleCompare={toggleCampaign} onClearCompare={clearSelection} />
      </div>
    </div>
  );
}
