// Client dashboard shell with campaign routes, Reports, and Email automation navigation.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
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
  BarChart3,
  Bell,
  ChevronDown,
  ChevronUp,
  Cloud,
  Columns3,
  FileBarChart,
  GripVertical,
  LayoutDashboard,
  LogOut,
  Mail,
  Maximize2,
  Megaphone,
  Menu,
  Minimize2,
  RefreshCw,
  Search,
  Settings2,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Reports } from "../reports/Reports";
import { EmailCenter } from "../email/EmailCenter";
import { SyncStatusD, SyncStatusM } from "../integrations/SyncStatus";
import { PageTransition, TableSkeleton, useDelayedLoading } from "../../ui/LoadingSkeletons";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../ui/sheet";
import { Switch } from "../../ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

type CampaignStatus = "active" | "paused" | "completed" | "ended" | string;
type RangeKey = "7D" | "30D" | "3M" | "6M";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "active" | "paused" | "completed";
type CampaignSortKey = "name" | "status" | "roas" | "spend" | "conversions" | "leads" | "costPerResult" | "revenue" | "ctr" | "clicks";
type DashboardMetricKey =
  | "roas"
  | "spend"
  | "conversions"
  | "leads"
  | "conversionValue"
  | "costPerResult"
  | "clicks"
  | "ctr"
  | "cpc"
  | "impressions"
  | "reach"
  | "engagements";
type ChartKey =
  | "roasCost"
  | "spendResults"
  | "revenue"
  | "campaignSummary"
  | "clicksCtr"
  | "impressionsReach"
  | "engagements";
type ChartSize = "wide" | "narrow" | "half" | "full";
type ComparisonMetricKey = "roas" | "spend" | "conversions" | "leads" | "costPerResult" | "revenue" | "ctr" | "clicks" | "impressions" | "reach" | "engagements";
type CompareChartKey = "roas" | "spend" | "results" | "ctr" | "revenue";
type CompareViewMode = "overlay" | "multiples";

type CampaignRow = {
  id: string;
  client_id: string;
  client_name?: string | null;
  name: string;
  platform: string;
  status: CampaignStatus;
  start_date?: string | null;
  end_date?: string | null;
  total_spend?: number | string | null;
  total_leads?: number | string | null;
  total_clicks?: number | string | null;
  total_impressions?: number | string | null;
  total_reach?: number | string | null;
  total_conversions?: number | string | null;
  total_revenue?: number | string | null;
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

type NormalizedMetricRow = {
  date: string;
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  reach: number;
  conversions: number;
  revenue: number;
  roas: number;
  ctr: number;
  cpc: number;
  costPerResult: number;
  engagements: number;
};

type DashboardLayout = {
  statOrder: DashboardMetricKey[];
  hiddenMetrics: DashboardMetricKey[];
  chartOrder: ChartKey[];
  hiddenCharts: ChartKey[];
  chartSizes: Record<ChartKey, ChartSize>;
};

type MetricDefinition = {
  key: DashboardMetricKey;
  label: string;
  group: "Primary" | "Secondary";
  value: number;
  formatter: (value: number) => string;
  delta: string;
  up: boolean;
};

type DragItem = {
  id: string;
  index: number;
};

const PRIMARY = "#6366F1";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";
const DANGER = "#F43F5E";
const PINK = "#EC4899";
const SKY = "#0369A1";
const TEAL = "#0F766E";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const PAGE_BG = "#F8FAFC";
const SIDEBAR_BG = "#1E293B";
const SUCCESS_BG = "#ECFDF5";
const WARNING_BG = "#FFFBEB";
const NEUTRAL_BG = "#F1F5F9";
const RANGE_OPTIONS: RangeKey[] = ["7D", "30D", "3M", "6M"];
const MAX_COMPARE = 4;
const STAT_DND = "client-dashboard-stat";
const CHART_DND = "client-dashboard-chart";
const METRIC_ORDER: DashboardMetricKey[] = [
  "roas",
  "spend",
  "conversions",
  "leads",
  "conversionValue",
  "costPerResult",
  "clicks",
  "ctr",
  "cpc",
  "impressions",
  "reach",
  "engagements",
];
const PRIMARY_CHARTS: ChartKey[] = ["roasCost", "spendResults", "revenue", "campaignSummary"];
const SECONDARY_CHARTS: ChartKey[] = ["clicksCtr", "impressionsReach", "engagements"];
const CHART_COLORS = [PRIMARY, SUCCESS, WARNING, PINK, TEAL, SKY];
const LINE_PATTERNS = ["", "5 5", "2 4", "8 3"];

const DEFAULT_LAYOUT: DashboardLayout = {
  statOrder: ["roas", "spend", "conversions", "leads", "conversionValue", "costPerResult", "clicks", "ctr", "cpc", "impressions", "reach", "engagements"],
  hiddenMetrics: ["clicks", "ctr", "cpc", "impressions", "reach", "engagements"],
  chartOrder: ["roasCost", "spendResults", "revenue", "campaignSummary", "clicksCtr", "impressionsReach", "engagements"],
  hiddenCharts: [],
  chartSizes: {
    roasCost: "wide",
    spendResults: "narrow",
    revenue: "full",
    campaignSummary: "full",
    clicksCtr: "half",
    impressionsReach: "half",
    engagements: "half",
  },
};

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
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CL"
  );
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

function clientQuery(clientId?: string | null) {
  return clientId ? `client_id=${encodeURIComponent(clientId)}` : "";
}

function withClientParam(path: string, clientId?: string | null) {
  const query = clientQuery(clientId);
  if (!query) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
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

function statusLabel(status: CampaignStatus) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "completed" || status === "ended") return "Ended";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Ended";
}

function statusFilterValue(status: CampaignStatus): StatusFilter {
  if (status === "active" || status === "paused") return status;
  return "completed";
}

function inferObjective(campaignName: string) {
  const name = campaignName.toLowerCase();
  if (name.includes("lead")) return "Lead generation";
  if (name.includes("search") || name.includes("shopping")) return "Conversion growth";
  if (name.includes("awareness") || name.includes("brand")) return "Brand awareness";
  if (name.includes("retarget")) return "Retargeting";
  if (name.includes("newsletter") || name.includes("mailchimp")) return "Customer nurture";
  if (name.includes("b2b") || name.includes("linkedin")) return "Pipeline influence";
  return "Business performance";
}

function campaignSpend(campaign: CampaignRow) {
  return n(campaign.total_spend);
}

function campaignRevenue(campaign: CampaignRow) {
  return n(campaign.total_revenue);
}

function campaignRoas(campaign: CampaignRow) {
  const spend = campaignSpend(campaign);
  return spend > 0 ? campaignRevenue(campaign) / spend : 0;
}

function campaignCtr(campaign: CampaignRow) {
  const impressions = n(campaign.total_impressions);
  return impressions > 0 ? (n(campaign.total_clicks) / impressions) * 100 : 0;
}

function campaignCpc(campaign: CampaignRow) {
  const clicks = n(campaign.total_clicks);
  return clicks > 0 ? campaignSpend(campaign) / clicks : 0;
}

function campaignCostPerResult(campaign: CampaignRow) {
  const results = n(campaign.total_conversions) || n(campaign.total_leads);
  return results > 0 ? campaignSpend(campaign) / results : 0;
}

function campaignEngagements(campaign: CampaignRow) {
  return Math.round(n(campaign.total_clicks) * 0.45 + n(campaign.total_leads) * 1.2);
}

function normalizeTrend(rows: MetricRow[]): NormalizedMetricRow[] {
  return rows
    .slice()
    .sort((a, b) => new Date(a.period || a.date).getTime() - new Date(b.period || b.date).getTime())
    .map((row) => {
      const date = row.period || row.date;
      const spend = n(row.spend);
      const clicks = n(row.clicks);
      const impressions = n(row.impressions);
      const leads = n(row.leads);
      const conversions = n(row.conversions);
      const revenue = n(row.revenue);
      const reach = n(row.reach);
      const roas = spend > 0 ? revenue / spend : n(row.roas);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : n(row.ctr);
      const cpc = clicks > 0 ? spend / clicks : n(row.cpc);
      const results = conversions || leads;
      return {
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        spend,
        impressions,
        clicks,
        leads,
        reach,
        conversions,
        revenue,
        roas,
        ctr,
        cpc,
        costPerResult: results > 0 ? spend / results : 0,
        engagements: Math.round(clicks * 0.45 + leads * 1.2),
      };
    });
}

function totalsFromCampaigns(campaigns: CampaignRow[]) {
  const spend = campaigns.reduce((sum, campaign) => sum + campaignSpend(campaign), 0);
  const revenue = campaigns.reduce((sum, campaign) => sum + campaignRevenue(campaign), 0);
  const conversions = campaigns.reduce((sum, campaign) => sum + n(campaign.total_conversions), 0);
  const leads = campaigns.reduce((sum, campaign) => sum + n(campaign.total_leads), 0);
  const clicks = campaigns.reduce((sum, campaign) => sum + n(campaign.total_clicks), 0);
  const impressions = campaigns.reduce((sum, campaign) => sum + n(campaign.total_impressions), 0);
  const reach = campaigns.reduce((sum, campaign) => sum + n(campaign.total_reach), 0);
  const results = conversions || leads;
  return {
    spend,
    revenue,
    conversions,
    leads,
    clicks,
    impressions,
    reach,
    engagements: campaigns.reduce((sum, campaign) => sum + campaignEngagements(campaign), 0),
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    costPerResult: results > 0 ? spend / results : 0,
  };
}

function totalsFromTrend(rows: NormalizedMetricRow[], fallbackCampaigns: CampaignRow[]) {
  if (rows.length === 0) return totalsFromCampaigns(fallbackCampaigns);
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);
  const leads = rows.reduce((sum, row) => sum + row.leads, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const reach = rows.reduce((sum, row) => sum + row.reach, 0);
  const results = conversions || leads;
  return {
    spend,
    revenue,
    conversions,
    leads,
    clicks,
    impressions,
    reach,
    engagements: rows.reduce((sum, row) => sum + row.engagements, 0),
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    costPerResult: results > 0 ? spend / results : 0,
  };
}

function metricDelta(rows: NormalizedMetricRow[], valueForRows: (items: NormalizedMetricRow[]) => number, lowerIsBetter = false) {
  if (rows.length < 2) return { value: "No prior period", up: true };
  const half = Math.max(1, Math.floor(rows.length / 2));
  const previous = valueForRows(rows.slice(0, half));
  const current = valueForRows(rows.slice(half));
  if (previous === 0) return { value: current > 0 ? "+100% vs prev" : "0% vs prev", up: true };
  const delta = ((current - previous) / previous) * 100;
  return {
    value: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs prev`,
    up: lowerIsBetter ? delta <= 0 : delta >= 0,
  };
}

function sumMetric(key: keyof NormalizedMetricRow) {
  return (items: NormalizedMetricRow[]) => items.reduce((sum, row) => sum + n(row[key]), 0);
}

function ratioMetric(numerator: keyof NormalizedMetricRow, denominator: keyof NormalizedMetricRow, multiplier = 1) {
  return (items: NormalizedMetricRow[]) => {
    const top = items.reduce((sum, row) => sum + n(row[numerator]), 0);
    const bottom = items.reduce((sum, row) => sum + n(row[denominator]), 0);
    return bottom > 0 ? (top / bottom) * multiplier : 0;
  };
}

function sanitizeLayout(value: unknown): DashboardLayout {
  const candidate = value as Partial<DashboardLayout> | null;
  const statOrder = Array.isArray(candidate?.statOrder)
    ? [...candidate.statOrder.filter((key): key is DashboardMetricKey => METRIC_ORDER.includes(key as DashboardMetricKey)), ...METRIC_ORDER.filter((key) => !candidate.statOrder?.includes(key))]
    : DEFAULT_LAYOUT.statOrder;
  const chartOrder = Array.isArray(candidate?.chartOrder)
    ? [...candidate.chartOrder.filter((key): key is ChartKey => DEFAULT_LAYOUT.chartOrder.includes(key as ChartKey)), ...DEFAULT_LAYOUT.chartOrder.filter((key) => !candidate.chartOrder?.includes(key))]
    : DEFAULT_LAYOUT.chartOrder;
  const hiddenMetrics = Array.isArray(candidate?.hiddenMetrics)
    ? candidate.hiddenMetrics.filter((key): key is DashboardMetricKey => METRIC_ORDER.includes(key as DashboardMetricKey))
    : DEFAULT_LAYOUT.hiddenMetrics;
  const hiddenCharts = Array.isArray(candidate?.hiddenCharts)
    ? candidate.hiddenCharts.filter((key): key is ChartKey => DEFAULT_LAYOUT.chartOrder.includes(key as ChartKey))
    : DEFAULT_LAYOUT.hiddenCharts;
  return {
    statOrder,
    hiddenMetrics,
    chartOrder,
    hiddenCharts,
    chartSizes: { ...DEFAULT_LAYOUT.chartSizes, ...(candidate?.chartSizes || {}) },
  };
}

function layoutStorageKey(userId?: string) {
  return `client_dashboard_layout_${userId || "guest"}`;
}

function readSavedLayout(userId?: string) {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  const raw = window.localStorage.getItem(layoutStorageKey(userId));
  if (!raw) return DEFAULT_LAYOUT;
  try {
    return sanitizeLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function useClientDashboardLayout(userId?: string) {
  const [layout, setLayoutState] = useState<DashboardLayout>(() => readSavedLayout(userId));

  useEffect(() => {
    setLayoutState(readSavedLayout(userId));
  }, [userId]);

  const setLayout = useCallback((next: DashboardLayout | ((current: DashboardLayout) => DashboardLayout)) => {
    setLayoutState((current) => sanitizeLayout(typeof next === "function" ? next(current) : next));
  }, []);

  const saveLayout = useCallback(
    (nextLayout: DashboardLayout = layout) => {
      const sanitized = sanitizeLayout(nextLayout);
      setLayoutState(sanitized);
      window.localStorage.setItem(layoutStorageKey(userId), JSON.stringify(sanitized));
      toast.success("Layout saved");
    },
    [layout, userId]
  );

  const resetLayout = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT);
    window.localStorage.setItem(layoutStorageKey(userId), JSON.stringify(DEFAULT_LAYOUT));
    toast.success("Layout reset");
  }, [userId]);

  return { layout, setLayout, saveLayout, resetLayout };
}

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const change = value - from;
    const easeOutExpo = (progress: number) => (progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress));
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

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: PRIMARY, fontSize: Math.max(9, size / 3) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const label = statusLabel(status);
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    Active: { bg: SUCCESS_BG, text: "#065F46", dot: SUCCESS },
    Paused: { bg: WARNING_BG, text: "#92400E", dot: WARNING },
    Ended: { bg: NEUTRAL_BG, text: "#475569", dot: "#94A3B8" },
  };
  const color = colors[label] || colors.Ended;
  return (
    <Badge className="rounded-full border-0 px-2 py-0.5 gap-1.5" style={{ background: color.bg, color: color.text, fontSize: 11 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.dot }} />
      {label}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const color = platformColor(platform);
  return (
    <Badge className="rounded border-0 px-2 py-0.5" style={{ background: `${color}1A`, color, fontSize: 11 }}>
      {platformLabel(platform)}
    </Badge>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="bg-white rounded-xl p-8 text-center text-slate-400" style={{ border: `1px solid ${BORDER}`, fontSize: 13 }}>
      {children}
    </Card>
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
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-indigo-600 transition-colors ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {label}
      {active && <span aria-hidden="true">{direction === "asc" ? "up" : "down"}</span>}
    </button>
  );
}

function getMetricDefinitions(totals: ReturnType<typeof totalsFromTrend>, rows: NormalizedMetricRow[]): MetricDefinition[] {
  const roasChange = metricDelta(rows, ratioMetric("revenue", "spend"));
  const spendChange = metricDelta(rows, sumMetric("spend"), true);
  const conversionsChange = metricDelta(rows, sumMetric("conversions"));
  const leadsChange = metricDelta(rows, sumMetric("leads"));
  const revenueChange = metricDelta(rows, sumMetric("revenue"));
  const costPerResultChange = metricDelta(rows, ratioMetric("spend", "conversions"), true);
  const clicksChange = metricDelta(rows, sumMetric("clicks"));
  const ctrChange = metricDelta(rows, ratioMetric("clicks", "impressions", 100));
  const cpcChange = metricDelta(rows, ratioMetric("spend", "clicks"), true);
  const impressionsChange = metricDelta(rows, sumMetric("impressions"));
  const reachChange = metricDelta(rows, sumMetric("reach"));
  const engagementsChange = metricDelta(rows, sumMetric("engagements"));

  return [
    { key: "roas", label: "ROAS", group: "Primary", value: totals.roas, formatter: fmtRoas, delta: roasChange.value, up: roasChange.up },
    { key: "spend", label: "Total spend", group: "Primary", value: totals.spend, formatter: fmtMoney, delta: spendChange.value, up: spendChange.up },
    { key: "conversions", label: "Conversions", group: "Primary", value: totals.conversions, formatter: fmtNumber, delta: conversionsChange.value, up: conversionsChange.up },
    { key: "leads", label: "Leads", group: "Primary", value: totals.leads, formatter: fmtNumber, delta: leadsChange.value, up: leadsChange.up },
    { key: "conversionValue", label: "Conversion value", group: "Primary", value: totals.revenue, formatter: fmtMoney, delta: revenueChange.value, up: revenueChange.up },
    { key: "costPerResult", label: "Cost per result", group: "Primary", value: totals.costPerResult, formatter: (value) => fmtMoney(value, false), delta: costPerResultChange.value, up: costPerResultChange.up },
    { key: "clicks", label: "Clicks", group: "Secondary", value: totals.clicks, formatter: fmtNumber, delta: clicksChange.value, up: clicksChange.up },
    { key: "ctr", label: "CTR", group: "Secondary", value: totals.ctr, formatter: fmtPct, delta: ctrChange.value, up: ctrChange.up },
    { key: "cpc", label: "CPC", group: "Secondary", value: totals.cpc, formatter: (value) => fmtMoney(value, false), delta: cpcChange.value, up: cpcChange.up },
    { key: "impressions", label: "Impressions", group: "Secondary", value: totals.impressions, formatter: fmtNumber, delta: impressionsChange.value, up: impressionsChange.up },
    { key: "reach", label: "Reach", group: "Secondary", value: totals.reach, formatter: fmtNumber, delta: reachChange.value, up: reachChange.up },
    { key: "engagements", label: "Engagements", group: "Secondary", value: totals.engagements, formatter: fmtNumber, delta: engagementsChange.value, up: engagementsChange.up },
  ];
}

function CountedValue({ value, formatter }: { value: number; formatter: (value: number) => string }) {
  const display = useCountUp(value);
  return (
    <span className="text-slate-900 font-semibold font-mono tabular-nums" style={{ fontSize: 24 }}>
      {formatter(display)}
    </span>
  );
}

function DraggableMetricCard({
  metric,
  index,
  moveMetric,
  hideMetric,
  announce,
}: {
  metric: MetricDefinition;
  index: number;
  moveMetric: (from: number, to: number) => void;
  hideMetric: (metric: DashboardMetricKey) => void;
  announce: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: STAT_DND,
      item: { id: metric.key, index },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [index, metric.key]
  );
  const [, drop] = useDrop(
    () => ({
      accept: STAT_DND,
      hover(item: DragItem) {
        if (item.index === index) return;
        moveMetric(item.index, index);
        item.index = index;
        announce(`${metric.label} metric moved to position ${index + 1}`);
      },
    }),
    [announce, index, metric.label, moveMetric]
  );
  drag(drop(ref));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const target = Math.max(0, index - 1);
      moveMetric(index, target);
      announce(`${metric.label} metric moved to position ${target + 1}`);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveMetric(index, index + 1);
      announce(`${metric.label} metric moved to position ${index + 2}`);
    }
  };

  return (
    <Card
      ref={ref}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="group relative data-enter rounded-xl bg-white p-4 gap-2 transition-all duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-300"
      style={{
        border: `1px solid ${BORDER}`,
        opacity: isDragging ? 0.72 : 1,
        transform: isDragging ? "scale(1.02)" : undefined,
        boxShadow: isDragging ? "0 12px 30px rgba(15,23,42,0.16)" : undefined,
        animationDelay: `${index * 60}ms`,
      }}
      aria-label={`${metric.label} card. Use arrow keys to reorder.`}
    >
      <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" aria-hidden="true">
        <GripVertical size={14} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => hideMetric(metric.key)}
        className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
        aria-label={`Hide ${metric.label}`}
      >
        <X size={13} />
      </Button>
      <span className="text-slate-500 font-semibold uppercase tracking-wide pr-8" style={{ fontSize: 11 }}>
        {metric.label}
      </span>
      <CountedValue value={metric.value} formatter={metric.formatter} />
      <div className="flex items-center gap-1">
        {metric.up ? <ArrowUpRight size={12} style={{ color: SUCCESS }} /> : <ArrowDownRight size={12} style={{ color: DANGER }} />}
        <span className="font-medium" style={{ fontSize: 11, color: metric.up ? SUCCESS : DANGER }}>
          {metric.delta}
        </span>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  children,
  right,
  ariaLabel,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  ariaLabel: string;
}) {
  return (
    <Card className="bg-white rounded-xl p-4 gap-3 min-w-0 h-full" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-slate-800 font-semibold truncate" style={{ fontSize: 13 }}>
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

function chartSpan(size: ChartSize) {
  const map: Record<ChartSize, string> = {
    wide: "xl:col-span-4",
    narrow: "xl:col-span-2",
    half: "xl:col-span-3",
    full: "xl:col-span-6",
  };
  return map[size];
}

function DraggableChartBlock({
  chartKey,
  index,
  layout,
  moveChart,
  resizeChart,
  hideChart,
  announce,
  children,
}: {
  chartKey: ChartKey;
  index: number;
  layout: DashboardLayout;
  moveChart: (from: number, to: number) => void;
  resizeChart: (key: ChartKey) => void;
  hideChart: (key: ChartKey) => void;
  announce: (message: string) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = layout.chartSizes[chartKey] || "half";
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CHART_DND,
      item: { id: chartKey, index },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [chartKey, index]
  );
  const [, drop] = useDrop(
    () => ({
      accept: CHART_DND,
      hover(item: DragItem) {
        if (item.index === index) return;
        moveChart(item.index, index);
        item.index = index;
        announce(`Chart moved to position ${index + 1}`);
      },
    }),
    [announce, index, moveChart]
  );
  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`group relative min-w-0 transition-all duration-200 ${chartSpan(size)}`}
      style={{
        opacity: isDragging ? 0.78 : 1,
        transform: isDragging ? "scale(1.01)" : undefined,
      }}
    >
      <div className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" aria-hidden="true">
        <GripVertical size={14} />
      </div>
      <div className="absolute right-2 top-2 z-10 flex opacity-0 group-hover:opacity-100 transition-opacity">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => resizeChart(chartKey)} aria-label="Resize chart">
          {size === "full" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-600" onClick={() => hideChart(chartKey)} aria-label="Hide chart">
          <X size={13} />
        </Button>
      </div>
      {children}
    </div>
  );
}

function NoChartData() {
  return (
    <div className="h-[220px] flex items-center justify-center text-slate-400" style={{ fontSize: 12 }}>
      No metric data for this range.
    </div>
  );
}

function Sparkline({ campaign }: { campaign: CampaignRow }) {
  const base = Math.max(1, campaignRoas(campaign));
  const data = Array.from({ length: 7 }).map((_, index) => ({
    label: `D${index + 1}`,
    value: Math.max(0.1, base * (0.84 + ((index * 17 + campaign.name.length) % 22) / 100)),
  }));
  return (
    <div className="h-12" role="img" aria-label={`${campaign.name} ROAS sparkline`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={PRIMARY} strokeWidth={1.8} dot={false} isAnimationActive />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricPickerSheet({
  open,
  onOpenChange,
  layout,
  onSave,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
  onSave: (layout: DashboardLayout) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(layout);

  useEffect(() => {
    if (open) setDraft(layout);
  }, [layout, open]);

  const visibleMetrics = draft.statOrder.filter((key) => !draft.hiddenMetrics.includes(key));
  const hiddenMetrics = draft.statOrder.filter((key) => draft.hiddenMetrics.includes(key));

  const moveVisibleMetric = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(visibleMetrics.length - 1, to));
    if (from === clamped) return;
    const nextVisible = visibleMetrics.slice();
    const [moved] = nextVisible.splice(from, 1);
    nextVisible.splice(clamped, 0, moved);
    setDraft((current) => ({
      ...current,
      statOrder: [...nextVisible, ...current.statOrder.filter((key) => !nextVisible.includes(key))],
    }));
  };

  const toggleMetric = (metric: DashboardMetricKey, visible: boolean) => {
    setDraft((current) => ({
      ...current,
      hiddenMetrics: visible ? current.hiddenMetrics.filter((key) => key !== metric) : [...new Set([...current.hiddenMetrics, metric])],
    }));
  };

  const metricLabel = (key: DashboardMetricKey) => {
    const labels: Record<DashboardMetricKey, string> = {
      roas: "ROAS",
      spend: "Spend",
      conversions: "Conversions",
      leads: "Leads",
      conversionValue: "Conversion value",
      costPerResult: "Cost per result",
      clicks: "Clicks",
      ctr: "CTR",
      cpc: "CPC",
      impressions: "Impressions",
      reach: "Reach",
      engagements: "Engagements",
    };
    return labels[key];
  };

  const row = (key: DashboardMetricKey, visible: boolean, index?: number) => (
    <div key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <GripVertical size={14} className="text-slate-400 flex-shrink-0" />
      <span className="text-slate-700 font-medium flex-1" style={{ fontSize: 12 }}>
        {metricLabel(key)}
      </span>
      {visible && typeof index === "number" && (
        <div className="flex">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => moveVisibleMetric(index, index - 1)} aria-label={`Move ${metricLabel(key)} up`}>
            <ChevronUp size={13} />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => moveVisibleMetric(index, index + 1)} aria-label={`Move ${metricLabel(key)} down`}>
            <ChevronDown size={13} />
          </Button>
        </div>
      )}
      <Switch checked={visible} onCheckedChange={(checked) => toggleMetric(key, checked)} aria-label={`${visible ? "Hide" : "Show"} ${metricLabel(key)}`} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl bg-slate-50">
        <SheetHeader>
          <SheetTitle>Customise dashboard</SheetTitle>
          <SheetDescription>Choose pinned metrics and reorder the KPI row.</SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 overflow-y-auto">
          <section className="flex flex-col gap-2">
            <h3 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Pinned metrics</h3>
            {visibleMetrics.map((key, index) => row(key, true, index))}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Available metrics</h3>
            {hiddenMetrics.map((key) => row(key, false))}
            {hiddenMetrics.length === 0 && <p className="text-slate-400 px-3 py-2" style={{ fontSize: 12 }}>All metrics are visible.</p>}
          </section>
        </div>
        <SheetFooter>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={onReset}>
              Reset layout
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={() => {
                  onSave(draft);
                  onOpenChange(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CampaignComparisonBar({
  selectedCampaigns,
  onClear,
  onView,
}: {
  selectedCampaigns: CampaignRow[];
  onClear: () => void;
  onView: () => void;
}) {
  if (selectedCampaigns.length < 2) return null;
  return (
    <div className="fixed left-3 right-3 bottom-3 z-40 md:left-[216px] data-enter">
      <Card className="bg-white rounded-xl px-4 py-3 gap-3 shadow-lg" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>
              Comparing {selectedCampaigns.length} campaigns:
            </span>
            {selectedCampaigns.map((campaign) => (
              <Badge key={campaign.id} variant="secondary" className="rounded-full max-w-[220px] truncate" style={{ fontSize: 11 }}>
                {campaign.name}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClear}>Clear</Button>
            <Button type="button" onClick={onView}>
              <SplitSquareHorizontal size={15} />
              View Comparison
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CampaignCard({
  campaign,
  selected,
  compareMode,
  onToggleCompare,
  onOpen,
}: {
  campaign: CampaignRow;
  selected: boolean;
  compareMode: boolean;
  onToggleCompare: () => void;
  onOpen: () => void;
}) {
  return (
    <Card
      className="group bg-white rounded-xl p-4 gap-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-300"
      style={{ border: `1px solid ${selected ? PRIMARY : BORDER}`, boxShadow: selected ? "0 0 0 1px rgba(99,102,241,0.35)" : undefined }}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-slate-900 font-semibold truncate" style={{ fontSize: 14 }}>{campaign.name}</h3>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <StatusBadge status={campaign.status} />
            <PlatformBadge platform={campaign.platform} />
          </div>
        </div>
        <div
          className={`${compareMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox checked={selected} onCheckedChange={onToggleCompare} aria-label={`Compare ${campaign.name}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricMini label="ROAS" value={fmtRoas(campaignRoas(campaign))} />
        <MetricMini label="Spend" value={fmtMoney(campaignSpend(campaign))} />
        <MetricMini label="Conversions" value={fmtNumber(n(campaign.total_conversions))} />
        <MetricMini label="Leads" value={fmtNumber(n(campaign.total_leads))} />
      </div>
      <Sparkline campaign={campaign} />
    </Card>
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

function renderChart(
  key: ChartKey,
  data: NormalizedMetricRow[],
  campaigns: CampaignRow[],
  range: RangeKey,
  setRange: (range: RangeKey) => void,
  campaignFilter: string,
  setCampaignFilter: (campaignId: string) => void
) {
  if (data.length === 0 && key !== "campaignSummary") {
    return (
      <ChartCard title={chartTitle(key)} ariaLabel={chartTitle(key)}>
        <NoChartData />
      </ChartCard>
    );
  }

  if (key === "roasCost") {
    return (
      <ChartCard
        title="ROAS and cost per result over time"
        ariaLabel="ROAS and cost per result over time"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2 pr-12">
            <RangeTabs value={range} onChange={setRange} />
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger size="sm" className="w-[170px] bg-white" aria-label="Filter chart campaign">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="roas" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
            <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Line yAxisId="roas" type="monotone" dataKey="roas" name="ROAS" stroke={PRIMARY} strokeWidth={2.2} dot={false} isAnimationActive />
            <Line yAxisId="cost" type="monotone" dataKey="costPerResult" name="Cost/result" stroke={DANGER} strokeDasharray="5 5" strokeWidth={2} dot={false} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (key === "spendResults") {
    return (
      <ChartCard title="Spend vs conversions and leads" ariaLabel="Spend bars with conversions and leads trend lines">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
            <YAxis yAxisId="results" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Bar yAxisId="spend" dataKey="spend" name="Spend" fill={PRIMARY} fillOpacity={0.82} radius={[3, 3, 0, 0]} />
            <Line yAxisId="results" type="monotone" dataKey="conversions" name="Conversions" stroke={SUCCESS} strokeWidth={2} dot={false} />
            <Line yAxisId="results" type="monotone" dataKey="leads" name="Leads" stroke={WARNING} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (key === "revenue") {
    return (
      <ChartCard title="Conversion value over time" ariaLabel="Conversion value trend over time">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value))} />
            <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Area type="monotone" dataKey="revenue" name="Conversion value" stroke={SUCCESS} fill={SUCCESS} fillOpacity={0.12} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (key === "campaignSummary") {
    const summary = campaigns.slice(0, 8).map((campaign) => ({
      name: campaign.name.length > 18 ? `${campaign.name.slice(0, 18)}...` : campaign.name,
      roas: campaignRoas(campaign),
      conversions: n(campaign.total_conversions),
      leads: n(campaign.total_leads),
    }));
    return (
      <ChartCard title="Campaign performance summary" ariaLabel="Grouped campaign performance summary for ROAS, conversions, and leads">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={summary}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-8} height={54} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="roas" name="ROAS" fill={PRIMARY} radius={[3, 3, 0, 0]} />
            <Bar dataKey="conversions" name="Conversions" fill={SUCCESS} radius={[3, 3, 0, 0]} />
            <Bar dataKey="leads" name="Leads" fill={WARNING} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (key === "clicksCtr") {
    return (
      <ChartCard title="Clicks and CTR over time" ariaLabel="Clicks and CTR over time">
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="clicks" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="ctr" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Bar yAxisId="clicks" dataKey="clicks" name="Clicks" fill={SKY} radius={[3, 3, 0, 0]} />
            <Line yAxisId="ctr" type="monotone" dataKey="ctr" name="CTR" stroke={PRIMARY} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  if (key === "impressionsReach") {
    return (
      <ChartCard title="Impressions and reach" ariaLabel="Impressions and reach over time">
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Line type="monotone" dataKey="impressions" name="Impressions" stroke={PRIMARY} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="reach" name="Reach" stroke={SUCCESS} strokeDasharray="5 5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Engagements breakdown" ariaLabel="Estimated engagements breakdown over time">
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data.map((row) => ({ ...row, likes: Math.round(row.engagements * 0.55), comments: Math.round(row.engagements * 0.2), shares: Math.round(row.engagements * 0.15), follows: Math.round(row.engagements * 0.1) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
          <Bar dataKey="likes" stackId="engagements" name="Likes" fill={PRIMARY} radius={[3, 3, 0, 0]} />
          <Bar dataKey="comments" stackId="engagements" name="Comments" fill={SUCCESS} />
          <Bar dataKey="shares" stackId="engagements" name="Shares" fill={WARNING} />
          <Bar dataKey="follows" stackId="engagements" name="Follows" fill={TEAL} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function chartTitle(key: ChartKey) {
  const labels: Record<ChartKey, string> = {
    roasCost: "ROAS and cost per result over time",
    spendResults: "Spend vs conversions and leads",
    revenue: "Conversion value over time",
    campaignSummary: "Campaign performance summary",
    clicksCtr: "Clicks and CTR over time",
    impressionsReach: "Impressions and reach",
    engagements: "Engagements breakdown",
  };
  return labels[key];
}

function ClientOverview({
  campaigns,
  loading,
  search,
  clientId,
  layout,
  setLayout,
  saveLayout,
  resetLayout,
  selectedIds,
  compareMode,
  setCompareMode,
  toggleCompare,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  clientId?: string | null;
  layout: DashboardLayout;
  setLayout: (next: DashboardLayout | ((current: DashboardLayout) => DashboardLayout)) => void;
  saveLayout: (layout?: DashboardLayout) => void;
  resetLayout: () => void;
  selectedIds: string[];
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  toggleCompare: (campaignId: string) => void;
}) {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30D");
  const [trend, setTrend] = useState<MetricRow[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [showDetailed, setShowDetailed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<"roas" | "spend" | "conversions" | "name">("roas");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const { from, to } = rangeBounds(range);
    setTrendLoading(true);
    if (campaignFilter === "all") {
      apiFetch(withClientParam(`/api/charts/performance?from=${from}&to=${to}`, clientId))
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((data) => setTrend(data.data || []))
        .finally(() => setTrendLoading(false));
      return;
    }
    apiFetch(withClientParam(`/api/campaigns/${campaignFilter}`, clientId))
      .then((res) => (res.ok ? res.json() : { metrics: [] }))
      .then((data) => {
        const filtered = (data.metrics || []).filter((row: MetricRow) => row.date >= from && row.date <= to);
        setTrend(filtered);
      })
      .finally(() => setTrendLoading(false));
  }, [apiFetch, campaignFilter, clientId, range]);

  const normalizedTrend = useMemo(() => normalizeTrend(trend), [trend]);
  const totals = useMemo(() => totalsFromTrend(normalizedTrend, campaigns), [campaigns, normalizedTrend]);
  const metricDefinitions = useMemo(() => getMetricDefinitions(totals, normalizedTrend), [normalizedTrend, totals]);
  const metricMap = new Map(metricDefinitions.map((metric) => [metric.key, metric]));
  const visibleMetrics = layout.statOrder.filter((key) => !layout.hiddenMetrics.includes(key)).map((key) => metricMap.get(key)).filter((metric): metric is MetricDefinition => Boolean(metric));
  const showSkeleton = useDelayedLoading(loading || trendLoading, 100);

  const moveMetric = (from: number, to: number) => {
    setLayout((current) => {
      const visible = current.statOrder.filter((key) => !current.hiddenMetrics.includes(key));
      const clamped = Math.max(0, Math.min(visible.length - 1, to));
      if (from === clamped) return current;
      const nextVisible = visible.slice();
      const [moved] = nextVisible.splice(from, 1);
      nextVisible.splice(clamped, 0, moved);
      return { ...current, statOrder: [...nextVisible, ...current.statOrder.filter((key) => !nextVisible.includes(key))] };
    });
  };

  const moveChart = (from: number, to: number) => {
    setLayout((current) => {
      const next = current.chartOrder.slice();
      const clamped = Math.max(0, Math.min(next.length - 1, to));
      const [moved] = next.splice(from, 1);
      next.splice(clamped, 0, moved);
      return { ...current, chartOrder: next };
    });
  };

  const resizeChart = (key: ChartKey) => {
    setLayout((current) => ({
      ...current,
      chartSizes: { ...current.chartSizes, [key]: current.chartSizes[key] === "full" ? "half" : "full" },
    }));
  };

  const hideMetric = (key: DashboardMetricKey) => {
    setLayout((current) => ({ ...current, hiddenMetrics: [...new Set([...current.hiddenMetrics, key])] }));
  };

  const hideChart = (key: ChartKey) => {
    setLayout((current) => ({ ...current, hiddenCharts: [...new Set([...current.hiddenCharts, key])] }));
  };

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => statusFilter === "all" || statusFilterValue(campaign.status) === statusFilter)
      .filter((campaign) => !q || campaign.name.toLowerCase().includes(q) || platformLabel(campaign.platform).toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        const values: Record<typeof sortBy, [number, number]> = {
          roas: [campaignRoas(a), campaignRoas(b)],
          spend: [campaignSpend(a), campaignSpend(b)],
          conversions: [n(a.total_conversions), n(b.total_conversions)],
          name: [0, 0],
        };
        const [left, right] = values[sortBy];
        return right - left;
      });
  }, [campaigns, search, sortBy, statusFilter]);

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-6 gap-3">
          <div className="h-72 bg-white rounded-xl border border-slate-200 xl:col-span-4 animate-pulse" />
          <div className="h-72 bg-white rounded-xl border border-slate-200 xl:col-span-2 animate-pulse" />
        </div>
        <TableSkeleton cols={5} rows={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 data-enter pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Client Dashboard</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>{campaigns.length} campaigns across your company</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={compareMode ? "default" : "outline"} size="sm" onClick={() => setCompareMode(!compareMode)}>
            <SplitSquareHorizontal size={14} />
            Compare
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Settings2 size={14} />
            Customise
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => saveLayout()}>
            Save layout
          </Button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">{announcement}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {visibleMetrics.map((metric, index) => (
          <DraggableMetricCard
            key={metric.key}
            metric={metric}
            index={index}
            moveMetric={moveMetric}
            hideMetric={hideMetric}
            announce={setAnnouncement}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-3">
        {layout.chartOrder
          .filter((key) => PRIMARY_CHARTS.includes(key) && !layout.hiddenCharts.includes(key))
          .map((key, index) => (
            <DraggableChartBlock
              key={key}
              chartKey={key}
              index={index}
              layout={layout}
              moveChart={moveChart}
              resizeChart={resizeChart}
              hideChart={hideChart}
              announce={setAnnouncement}
            >
              {renderChart(key, normalizedTrend, campaigns, range, setRange, campaignFilter, setCampaignFilter)}
            </DraggableChartBlock>
          ))}
      </div>

      <Button type="button" variant="ghost" onClick={() => setShowDetailed((value) => !value)} className="self-start text-slate-600 hover:text-indigo-600">
        {showDetailed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {showDetailed ? "Hide detailed metrics" : "Show detailed metrics"}
      </Button>

      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: showDetailed ? 900 : 0 }}>
        <div className="grid grid-cols-1 xl:grid-cols-6 gap-3 pb-1">
          {layout.chartOrder
            .filter((key) => SECONDARY_CHARTS.includes(key) && !layout.hiddenCharts.includes(key))
            .map((key, index) => (
              <DraggableChartBlock
                key={key}
                chartKey={key}
                index={index}
                layout={layout}
                moveChart={moveChart}
                resizeChart={resizeChart}
                hideChart={hideChart}
                announce={setAnnouncement}
              >
                {renderChart(key, normalizedTrend, campaigns, range, setRange, campaignFilter, setCampaignFilter)}
              </DraggableChartBlock>
            ))}
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-label="Campaign overview">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-slate-900 font-bold" style={{ fontSize: 16 }}>Campaign overview</h2>
            <p className="text-slate-500" style={{ fontSize: 12 }}>Scannable performance cards with comparison selection.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                  onClick={() => setStatusFilter(value as StatusFilter)}
                  className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-300"
                  style={{ fontSize: 11, background: statusFilter === value ? "#fff" : "transparent", color: statusFilter === value ? "#1E293B" : "#64748B" }}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger size="sm" className="w-[160px] bg-white" aria-label="Sort campaigns">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roas">By ROAS</SelectItem>
                <SelectItem value="spend">By Spend</SelectItem>
                <SelectItem value="conversions">By Conversions</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/client/campaigns")}>All Campaigns</Button>
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <EmptyState>No campaigns match the current filters.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                selected={selectedIds.includes(campaign.id)}
                compareMode={compareMode}
                onToggleCompare={() => toggleCompare(campaign.id)}
                onOpen={() => navigate(`/client/campaigns/${campaign.id}`, { state: { from: "dashboard" } })}
              />
            ))}
          </div>
        )}
      </section>

      <MetricPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} layout={layout} onSave={saveLayout} onReset={resetLayout} />
    </div>
  );
}

function CampaignListPage({
  campaigns,
  loading,
  search,
  selectedIds,
  toggleCompare,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  selectedIds: string[];
  toggleCompare: (campaignId: string) => void;
}) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<CampaignSortKey>("roas");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    ctr: true,
    clicks: true,
    leads: true,
    costPerResult: true,
    revenue: true,
  });

  const showSkeleton = useDelayedLoading(loading, 100);
  const bestRoas = campaigns.reduce((best, campaign) => Math.max(best, campaignRoas(campaign)), 0);

  const setSort = (key: CampaignSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" || key === "status" ? "asc" : "desc");
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => statusFilter === "all" || statusFilterValue(campaign.status) === statusFilter)
      .filter((campaign) => !q || campaign.name.toLowerCase().includes(q) || platformLabel(campaign.platform).toLowerCase().includes(q))
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        const values: Record<CampaignSortKey, [string | number, string | number]> = {
          name: [a.name, b.name],
          status: [statusLabel(a.status), statusLabel(b.status)],
          roas: [campaignRoas(a), campaignRoas(b)],
          spend: [campaignSpend(a), campaignSpend(b)],
          conversions: [n(a.total_conversions), n(b.total_conversions)],
          leads: [n(a.total_leads), n(b.total_leads)],
          costPerResult: [campaignCostPerResult(a), campaignCostPerResult(b)],
          revenue: [campaignRevenue(a), campaignRevenue(b)],
          ctr: [campaignCtr(a), campaignCtr(b)],
          clicks: [n(a.total_clicks), n(b.total_clicks)],
        };
        const [left, right] = values[sortKey];
        if (typeof left === "string" && typeof right === "string") return left.localeCompare(right) * direction;
        return (Number(left) - Number(right)) * direction;
      });
  }, [campaigns, search, sortDirection, sortKey, statusFilter]);

  if (showSkeleton) return <TableSkeleton cols={11} rows={7} />;

  return (
    <div className="flex flex-col gap-4 data-enter pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/client/dashboard")} className="h-8 w-8 text-slate-500 hover:text-slate-800" aria-label="Back to dashboard">
            <ArrowLeft size={15} />
          </Button>
          <div>
            <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>All Campaigns</h1>
            <p className="text-slate-500" style={{ fontSize: 12 }}>{rows.length} campaigns visible</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg p-1 gap-1 bg-slate-200">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["paused", "Paused"],
              ["completed", "Ended"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value as StatusFilter)}
                className="rounded-md px-3 py-1 font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-300"
                style={{ fontSize: 11, background: statusFilter === value ? "#fff" : "transparent", color: statusFilter === value ? "#1E293B" : "#64748B" }}
              >
                {label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Columns3 size={14} />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Column visibility</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                ["leads", "Leads"],
                ["costPerResult", "Cost per result"],
                ["revenue", "Conv. value"],
                ["ctr", "CTR"],
                ["clicks", "Clicks"],
              ].map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleColumns[key]}
                  onCheckedChange={(checked) => setVisibleColumns((current) => ({ ...current, [key]: checked }))}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: PAGE_BG }}>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                <span className="sr-only">Compare</span>
              </TableHead>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                <SortButton label="Campaign" active={sortKey === "name"} direction={sortDirection} onClick={() => setSort("name")} />
              </TableHead>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                <SortButton label="Status" active={sortKey === "status"} direction={sortDirection} onClick={() => setSort("status")} />
              </TableHead>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                <SortButton label="ROAS" active={sortKey === "roas"} direction={sortDirection} onClick={() => setSort("roas")} align="right" />
              </TableHead>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                <SortButton label="Spend" active={sortKey === "spend"} direction={sortDirection} onClick={() => setSort("spend")} align="right" />
              </TableHead>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                <SortButton label="Conversions" active={sortKey === "conversions"} direction={sortDirection} onClick={() => setSort("conversions")} align="right" />
              </TableHead>
              {visibleColumns.leads && (
                <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                  <SortButton label="Leads" active={sortKey === "leads"} direction={sortDirection} onClick={() => setSort("leads")} align="right" />
                </TableHead>
              )}
              {visibleColumns.costPerResult && (
                <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                  <SortButton label="Cost/result" active={sortKey === "costPerResult"} direction={sortDirection} onClick={() => setSort("costPerResult")} align="right" />
                </TableHead>
              )}
              {visibleColumns.revenue && (
                <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                  <SortButton label="Conv. value" active={sortKey === "revenue"} direction={sortDirection} onClick={() => setSort("revenue")} align="right" />
                </TableHead>
              )}
              {visibleColumns.ctr && (
                <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                  <SortButton label="CTR" active={sortKey === "ctr"} direction={sortDirection} onClick={() => setSort("ctr")} align="right" />
                </TableHead>
              )}
              {visibleColumns.clicks && (
                <TableHead className="px-4 py-2.5 text-slate-500 font-semibold text-right" style={{ fontSize: 11 }}>
                  <SortButton label="Clicks" active={sortKey === "clicks"} direction={sortDirection} onClick={() => setSort("clicks")} align="right" />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((campaign) => {
              const selected = selectedIds.includes(campaign.id);
              const open = () => navigate(`/client/campaigns/${campaign.id}`, { state: { from: "campaigns" } });
              return (
                <TableRow
                  key={campaign.id}
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open();
                    }
                  }}
                  className="border-t border-l-[3px] border-l-transparent border-slate-50 hover:bg-slate-50 hover:border-l-[var(--row-accent)] focus-visible:bg-slate-50 outline-none transition-colors cursor-pointer"
                  style={{ "--row-accent": PRIMARY } as CSSProperties}
                >
                  <TableCell className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={selected} onCheckedChange={() => toggleCompare(campaign.id)} aria-label={`Compare ${campaign.name}`} />
                  </TableCell>
                  <TableCell className="px-4 py-3 min-w-[260px]">
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{campaign.name}</span>
                      <PlatformBadge platform={campaign.platform} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3"><StatusBadge status={campaign.status} /></TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold" style={{ fontSize: 12, background: campaignRoas(campaign) === bestRoas && bestRoas > 0 ? SUCCESS_BG : undefined, color: "#1E293B" }}>
                    {fmtRoas(campaignRoas(campaign))}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtMoney(campaignSpend(campaign))}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_conversions))}</TableCell>
                  {visibleColumns.leads && <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_leads))}</TableCell>}
                  {visibleColumns.costPerResult && <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtMoney(campaignCostPerResult(campaign), false)}</TableCell>}
                  {visibleColumns.revenue && <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtMoney(campaignRevenue(campaign))}</TableCell>}
                  {visibleColumns.ctr && <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtPct(campaignCtr(campaign))}</TableCell>}
                  {visibleColumns.clicks && <TableCell className="px-4 py-3 text-right text-slate-800" style={{ fontSize: 12 }}>{fmtNumber(n(campaign.total_clicks))}</TableCell>}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="px-4 py-8 text-center text-slate-400" style={{ fontSize: 12 }}>
                  No campaigns match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CampaignDetailPage({
  campaigns,
  clientId,
  layout,
  setLayout,
}: {
  campaigns: CampaignRow[];
  clientId?: string | null;
  layout: DashboardLayout;
  setLayout: (next: DashboardLayout | ((current: DashboardLayout) => DashboardLayout)) => void;
}) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailed, setShowDetailed] = useState(false);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [compareDraft, setCompareDraft] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!campaignId) return;
    setLoading(true);
    apiFetch(withClientParam(`/api/campaigns/${campaignId}`, clientId))
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
  }, [apiFetch, campaignId, clientId]);

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

  const fromDashboard = (location.state as { from?: string } | null)?.from === "dashboard";
  const chartData = normalizeTrend(metrics);
  const totals = totalsFromTrend(chartData, [campaign]);
  const metricDefinitions = getMetricDefinitions(totals, chartData);
  const metricMap = new Map(metricDefinitions.map((metric) => [metric.key, metric]));
  const visibleMetrics = layout.statOrder
    .filter((key) => !layout.hiddenMetrics.includes(key))
    .slice(0, 6)
    .map((key) => metricMap.get(key))
    .filter((metric): metric is MetricDefinition => Boolean(metric));

  const moveMetric = (from: number, to: number) => {
    setLayout((current) => {
      const visible = current.statOrder.filter((key) => !current.hiddenMetrics.includes(key));
      const clamped = Math.max(0, Math.min(visible.length - 1, to));
      if (from === clamped) return current;
      const nextVisible = visible.slice();
      const [moved] = nextVisible.splice(from, 1);
      nextVisible.splice(clamped, 0, moved);
      return { ...current, statOrder: [...nextVisible, ...current.statOrder.filter((key) => !nextVisible.includes(key))] };
    });
  };

  const hideMetric = (key: DashboardMetricKey) => {
    setLayout((current) => ({ ...current, hiddenMetrics: [...new Set([...current.hiddenMetrics, key])] }));
  };

  const otherCampaigns = campaigns.filter((item) => item.id !== campaign.id);
  const goCompare = () => {
    const ids = [campaign.id, ...compareDraft].slice(0, MAX_COMPARE);
    navigate(`/client/campaigns/compare?ids=${ids.join(",")}`);
  };

  return (
    <div className="flex flex-col gap-4 data-enter pb-24">
      <div className="sr-only" aria-live="polite">{announcement}</div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(fromDashboard ? "/client/dashboard" : "/client/campaigns")} className="h-8 w-8 text-slate-500 hover:text-slate-800" aria-label="Back">
            <ArrowLeft size={15} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-slate-900 font-bold truncate" style={{ fontSize: 18 }}>{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
              <PlatformBadge platform={campaign.platform} />
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1 text-slate-500" style={{ fontSize: 12 }}>
              <span>{inferObjective(campaign.name)}</span>
              <span>{campaign.start_date || "Start N/A"} - {campaign.end_date || "Ongoing"}</span>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setCompareSheetOpen(true)}>
          <SplitSquareHorizontal size={14} />
          Compare with another campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {visibleMetrics.map((metric, index) => (
          <DraggableMetricCard key={metric.key} metric={metric} index={index} moveMetric={moveMetric} hideMetric={hideMetric} announce={setAnnouncement} />
        ))}
      </div>

      <ChartCard title="ROAS over time" ariaLabel="Campaign ROAS over time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(1)}x`} />
            <Tooltip formatter={(value: number) => fmtRoas(Number(value))} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <Line type="monotone" dataKey="roas" stroke={PRIMARY} strokeWidth={2.2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {renderChart("spendResults", chartData, [campaign], "30D", () => undefined, "all", () => undefined)}
        {renderChart("revenue", chartData, [campaign], "30D", () => undefined, "all", () => undefined)}
        <ChartCard title="Cost per result over time" ariaLabel="Campaign cost per result over time">
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value), false)} />
              <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
              <Line type="monotone" dataKey="costPerResult" stroke={DANGER} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Leads and conversions over time" ariaLabel="Campaign leads and conversions over time">
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
              <Line type="monotone" dataKey="leads" name="Leads" stroke={SUCCESS} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="conversions" name="Conversions" stroke={PRIMARY} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Button type="button" variant="ghost" onClick={() => setShowDetailed((value) => !value)} className="self-start text-slate-600 hover:text-indigo-600">
        {showDetailed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {showDetailed ? "Hide metrics" : "Show detailed metrics"}
      </Button>

      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: showDetailed ? 1300 : 0 }}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pb-1">
          <ChartCard title="Clicks over time" ariaLabel="Campaign clicks over time">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                <Line type="monotone" dataKey="clicks" stroke={SKY} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="CTR trend" ariaLabel="Campaign CTR trend">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => fmtPct(Number(value))} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                <Area type="monotone" dataKey="ctr" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="CPC trend" ariaLabel="Campaign CPC trend">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => fmtMoney(Number(value), false)} />
                <Tooltip formatter={(value: number) => fmtMoney(Number(value), false)} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                <Line type="monotone" dataKey="cpc" stroke={PINK} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          {renderChart("impressionsReach", chartData, [campaign], "30D", () => undefined, "all", () => undefined)}
          {renderChart("engagements", chartData, [campaign], "30D", () => undefined, "all", () => undefined)}
        </div>
      </div>

      <Sheet open={compareSheetOpen} onOpenChange={setCompareSheetOpen}>
        <SheetContent className="bg-slate-50">
          <SheetHeader>
            <SheetTitle>Compare campaigns</SheetTitle>
            <SheetDescription>Select up to 3 more campaigns.</SheetDescription>
          </SheetHeader>
          <div className="px-4 flex flex-col gap-2 overflow-y-auto">
            {otherCampaigns.map((item) => {
              const selected = compareDraft.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCompareDraft((current) => {
                      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
                      if (current.length >= 3) {
                        toast.error("Choose up to 4 campaigns total");
                        return current;
                      }
                      return [...current, item.id];
                    });
                  }}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left"
                >
                  <Checkbox checked={selected} aria-label={`Compare ${item.name}`} />
                  <span className="flex-1 text-slate-700 font-medium" style={{ fontSize: 12 }}>{item.name}</span>
                  <PlatformBadge platform={item.platform} />
                </button>
              );
            })}
          </div>
          <SheetFooter>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCompareSheetOpen(false)}>Cancel</Button>
              <Button type="button" onClick={goCompare} disabled={compareDraft.length === 0}>View Comparison</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function comparisonTotals(campaign: CampaignRow, rows: NormalizedMetricRow[]) {
  return totalsFromTrend(rows, [campaign]);
}

function comparisonMetricValue(key: ComparisonMetricKey, totals: ReturnType<typeof totalsFromTrend>) {
  const values: Record<ComparisonMetricKey, number> = {
    roas: totals.roas,
    spend: totals.spend,
    conversions: totals.conversions,
    leads: totals.leads,
    costPerResult: totals.costPerResult,
    revenue: totals.revenue,
    ctr: totals.ctr,
    clicks: totals.clicks,
    impressions: totals.impressions,
    reach: totals.reach,
    engagements: totals.engagements,
  };
  return values[key];
}

function comparisonFormatter(key: ComparisonMetricKey) {
  const map: Record<ComparisonMetricKey, (value: number) => string> = {
    roas: fmtRoas,
    spend: fmtMoney,
    conversions: fmtNumber,
    leads: fmtNumber,
    costPerResult: (value) => fmtMoney(value, false),
    revenue: fmtMoney,
    ctr: fmtPct,
    clicks: fmtNumber,
    impressions: fmtNumber,
    reach: fmtNumber,
    engagements: fmtNumber,
  };
  return map[key];
}

function mergeComparisonData(items: Array<{ campaign: CampaignRow; metrics: NormalizedMetricRow[] }>, chartKey: CompareChartKey) {
  const byDate = new Map<string, Record<string, string | number>>();
  items.forEach(({ campaign, metrics }) => {
    metrics.forEach((row) => {
      const current = byDate.get(row.date) || { date: row.date, label: row.label };
      if (chartKey === "roas") current[campaign.id] = row.roas;
      if (chartKey === "spend") current[campaign.id] = row.spend;
      if (chartKey === "results") current[campaign.id] = row.conversions + row.leads;
      if (chartKey === "ctr") current[campaign.id] = row.ctr;
      if (chartKey === "revenue") current[campaign.id] = row.revenue;
      byDate.set(row.date, current);
    });
  });
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function CampaignComparisonPage({
  campaigns,
  clientId,
  selectedIds,
  clearSelection,
}: {
  campaigns: CampaignRow[];
  clientId?: string | null;
  selectedIds: string[];
  clearSelection: () => void;
}) {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Array<{ campaign: CampaignRow; metrics: NormalizedMetricRow[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState<CompareChartKey>("roas");
  const [viewMode, setViewMode] = useState<CompareViewMode>("overlay");
  const idsFromQuery = searchParams.get("ids")?.split(",").filter(Boolean) || [];
  const ids = (idsFromQuery.length > 0 ? idsFromQuery : selectedIds).slice(0, MAX_COMPARE);

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      ids.map((id) =>
        apiFetch(withClientParam(`/api/campaigns/${id}`, clientId))
          .then((res) => (res.ok ? res.json() : { campaign: null, metrics: [] }))
          .then((data) => ({
            campaign: (data.campaign || campaigns.find((campaign) => campaign.id === id)) as CampaignRow | undefined,
            metrics: normalizeTrend(data.metrics || []),
          }))
      )
    )
      .then((rows) => setItems(rows.filter((row): row is { campaign: CampaignRow; metrics: NormalizedMetricRow[] } => Boolean(row.campaign))))
      .finally(() => setLoading(false));
  }, [apiFetch, campaigns, clientId, ids.join(",")]);

  if (loading) return <TableSkeleton cols={Math.max(3, ids.length + 1)} rows={8} />;

  if (items.length < 2) {
    return (
      <div className="flex flex-col gap-4 data-enter">
        <EmptyState>Select at least two campaigns to compare.</EmptyState>
        <Button type="button" className="self-start" onClick={() => navigate("/client/campaigns")}>Back to campaigns</Button>
      </div>
    );
  }

  const metricRows: Array<{ key: ComparisonMetricKey; label: string; lowerIsBetter?: boolean }> = [
    { key: "roas", label: "ROAS" },
    { key: "spend", label: "Spend", lowerIsBetter: true },
    { key: "conversions", label: "Conversions" },
    { key: "leads", label: "Leads" },
    { key: "costPerResult", label: "Cost per result", lowerIsBetter: true },
    { key: "revenue", label: "Conversion value" },
    { key: "ctr", label: "CTR" },
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impressions" },
    { key: "reach", label: "Reach" },
    { key: "engagements", label: "Engagements" },
  ];
  const totals = items.map((item) => ({ ...item, totals: comparisonTotals(item.campaign, item.metrics) }));
  const chartData = mergeComparisonData(items, chartKey);
  const chartFormatter = chartKey === "roas" ? fmtRoas : chartKey === "ctr" ? fmtPct : chartKey === "spend" || chartKey === "revenue" ? fmtMoney : fmtNumber;

  return (
    <div className="flex flex-col gap-4 data-enter pb-24">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/client/campaigns")} className="h-8 w-8 text-slate-500 hover:text-slate-800" aria-label="Back to campaigns">
            <ArrowLeft size={15} />
          </Button>
          <div>
            <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Campaign Comparison</h1>
            <p className="text-slate-500" style={{ fontSize: 12 }}>{items.length} campaigns selected</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            clearSelection();
            navigate("/client/campaigns");
          }}
        >
          Exit comparison
        </Button>
      </div>

      <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: PAGE_BG }}>
              <TableHead scope="col" className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>Metric</TableHead>
              {items.map((item) => (
                <TableHead key={item.campaign.id} scope="col" className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-800">{item.campaign.name}</span>
                    <StatusBadge status={item.campaign.status} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricRows.map((row) => {
              const values = totals.map((item) => comparisonMetricValue(row.key, item.totals));
              const best = row.lowerIsBetter ? Math.min(...values) : Math.max(...values);
              const worst = row.lowerIsBetter ? Math.max(...values) : Math.min(...values);
              const formatter = comparisonFormatter(row.key);
              return (
                <TableRow key={row.key}>
                  <th scope="row" className="px-4 py-3 text-left align-middle whitespace-nowrap text-slate-700 font-semibold" style={{ fontSize: 12 }}>{row.label}</th>
                  {values.map((value, index) => {
                    const isBest = value === best;
                    const isWorst = value === worst && best !== worst;
                    const diff = best === 0 ? 0 : ((value - best) / best) * 100;
                    return (
                      <TableCell key={`${row.key}-${totals[index].campaign.id}`} className="px-4 py-3" style={{ background: isBest ? SUCCESS_BG : isWorst ? WARNING_BG : undefined }}>
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-semibold font-mono" style={{ fontSize: 12 }}>{formatter(value)}</span>
                          {!isBest && <span className="text-slate-400" style={{ fontSize: 10 }}>{diff >= 0 ? "+" : ""}{diff.toFixed(0)}% vs best</span>}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-white rounded-xl p-4 gap-3" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Overlaid charts</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              {items.map((item, index) => (
                <span key={item.campaign.id} className="flex items-center gap-1.5 text-slate-500" style={{ fontSize: 11 }}>
                  <span className="w-3 h-0.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  {item.campaign.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chartKey} onValueChange={(value) => setChartKey(value as CompareChartKey)}>
              <SelectTrigger size="sm" className="w-[180px] bg-white" aria-label="Comparison chart metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roas">ROAS over time</SelectItem>
                <SelectItem value="spend">Spend over time</SelectItem>
                <SelectItem value="results">Conversions + leads</SelectItem>
                <SelectItem value="ctr">CTR trend</SelectItem>
                <SelectItem value="revenue">Conversion value</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex rounded-lg p-1 gap-1 bg-slate-200">
              {(["overlay", "multiples"] as CompareViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className="rounded-md px-3 py-1 font-medium capitalize"
                  style={{ fontSize: 11, background: viewMode === mode ? "#fff" : "transparent", color: viewMode === mode ? "#1E293B" : "#64748B" }}
                >
                  {mode === "overlay" ? "Overlay" : "Small multiples"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {viewMode === "overlay" ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => chartFormatter(Number(value))} />
              <Tooltip formatter={(value: number) => chartFormatter(Number(value))} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
              {items.map((item, index) => (
                <Line key={item.campaign.id} type="monotone" dataKey={item.campaign.id} name={item.campaign.name} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeDasharray={LINE_PATTERNS[index % LINE_PATTERNS.length]} strokeWidth={2.2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {items.map((item, index) => (
              <div key={item.campaign.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-0.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>{item.campaign.name}</span>
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={item.metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                    <Line type="monotone" dataKey={chartKey === "results" ? "conversions" : chartKey} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ClientBreadcrumbs({ campaigns }: { campaigns: CampaignRow[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
  const page = parts[1] || "dashboard";
  const campaignId = page === "campaigns" && parts[2] && parts[2] !== "compare" ? parts[2] : undefined;
  const campaign = campaigns.find((item) => item.id === campaignId);
  const fromDashboard = (location.state as { from?: string } | null)?.from === "dashboard";

  const simpleLabels: Record<string, string> = {
    reports: "Reports",
    "sync-status": "Sync Status",
  };

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-slate-500" style={{ fontSize: 12 }}>
        <BreadcrumbItem>
          {page === "dashboard" ? (
            <BreadcrumbPage className="text-slate-800">Dashboard</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => navigate("/client/dashboard")} className="hover:text-indigo-600 transition-colors">Dashboard</button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {page === "campaigns" && !fromDashboard && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {campaignId || parts[2] === "compare" ? (
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => navigate("/client/campaigns")} className="hover:text-indigo-600 transition-colors">All Campaigns</button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-slate-800">All Campaigns</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {parts[2] === "compare" && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage className="text-slate-800">Comparison</BreadcrumbPage></BreadcrumbItem>
          </>
        )}
        {campaignId && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage className="text-slate-800">{campaign?.name || "Campaign"}</BreadcrumbPage></BreadcrumbItem>
          </>
        )}
        {simpleLabels[page] && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage className="text-slate-800">{simpleLabels[page]}</BreadcrumbPage></BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ClientContentRoutes({
  campaigns,
  loading,
  search,
  clientId,
  layout,
  setLayout,
  saveLayout,
  resetLayout,
  selectedIds,
  compareMode,
  setCompareMode,
  toggleCompare,
  clearSelection,
  mobile,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  clientId?: string | null;
  layout: DashboardLayout;
  setLayout: (next: DashboardLayout | ((current: DashboardLayout) => DashboardLayout)) => void;
  saveLayout: (layout?: DashboardLayout) => void;
  resetLayout: () => void;
  selectedIds: string[];
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  toggleCompare: (campaignId: string) => void;
  clearSelection: () => void;
  mobile?: boolean;
}) {
  const location = useLocation();
  return (
    <PageTransition sectionKey={`${location.pathname}${location.search}`}>
      <Routes>
        <Route path="/" element={<Navigate to="/client/dashboard" replace />} />
        <Route path="dashboard" element={<ClientOverview campaigns={campaigns} loading={loading} search={search} clientId={clientId} layout={layout} setLayout={setLayout} saveLayout={saveLayout} resetLayout={resetLayout} selectedIds={selectedIds} compareMode={compareMode} setCompareMode={setCompareMode} toggleCompare={toggleCompare} />} />
        <Route path="campaigns" element={<CampaignListPage campaigns={campaigns} loading={loading} search={search} selectedIds={selectedIds} toggleCompare={toggleCompare} />} />
        <Route path="campaigns/compare" element={<CampaignComparisonPage campaigns={campaigns} clientId={clientId} selectedIds={selectedIds} clearSelection={clearSelection} />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage campaigns={campaigns} clientId={clientId} layout={layout} setLayout={setLayout} />} />
        <Route path="reports" element={<Reports />} />
        <Route path="email" element={<EmailCenter />} />
        <Route path="sync-status" element={mobile ? <SyncStatusM /> : <SyncStatusD />} />
        <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
      </Routes>
    </PageTransition>
  );
}

function DesktopShell({
  campaigns,
  loading,
  search,
  setSearch,
  clientName,
  selectedIds,
  clearSelection,
  viewComparison,
  children,
}: {
  campaigns: CampaignRow[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  clientName: string;
  selectedIds: string[];
  clearSelection: () => void;
  viewComparison: () => void;
  children: ReactNode;
}) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedCampaigns = campaigns.filter((campaign) => selectedIds.includes(campaign.id));
  const navItems = [
    { label: "Dashboard", path: "/client/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", path: "/client/campaigns", icon: Megaphone, count: campaigns.length },
    { label: "Reports", path: "/client/reports", icon: FileBarChart },
    { label: "Email", path: "/client/email", icon: Mail },
    { label: "Sync Status", path: "/client/sync-status", icon: RefreshCw },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: PAGE_BG }}>
      <aside className="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out" style={{ width: isCollapsed ? 64 : 200, background: SIDEBAR_BG }}>
        <div className="flex items-center justify-start px-[17px] gap-3 h-[52px] border-b overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0" aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <span className={`text-white font-bold whitespace-nowrap transition-all duration-300 ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`} style={{ fontSize: 14 }}>
            CloudCRM
          </span>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-1.5 px-3 overflow-y-auto" aria-label="Client navigation">
          {navItems.map(({ label, path, icon: Icon, count }) => {
            const active = path === "/client/dashboard" ? location.pathname === path || location.pathname === "/client" : location.pathname.startsWith(path);
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
                {typeof count === "number" && !isCollapsed && (
                  <span className="ml-auto mr-2 rounded-full px-1.5 py-0.5 bg-white/10 text-slate-300" style={{ fontSize: 10 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="py-3 border-t flex flex-col gap-3 px-3 overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-start pl-[4px] gap-3">
            <Avatar name={clientName} size={32} />
            <div className={`flex flex-col min-w-0 transition-all duration-300 whitespace-nowrap ${isCollapsed ? "opacity-0 w-0" : "opacity-100"}`}>
              <p className="text-white font-medium truncate" style={{ fontSize: 11 }}>{clientName}</p>
              <p style={{ fontSize: 9, color: "#64748B" }}>Client</p>
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
          <ClientBreadcrumbs campaigns={campaigns} />
          <div className="flex-1" />
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={viewComparison} disabled={selectedIds.length < 2}>
                <SplitSquareHorizontal size={14} />
                {selectedIds.length < 2 ? "Select one more" : `Compare (${selectedIds.length})`}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
            </div>
          )}
          <button type="button" className="relative text-slate-500 cursor-pointer hover:text-slate-800 transition-colors" aria-label="Notifications">
            <Bell size={16} />
            {!loading && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: DANGER }} />}
          </button>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-1">
            <Avatar name={user?.name || clientName} size={28} />
            <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{user?.name || "Client"}</span>
          </div>
        </div>

        <main className="flex-1 p-5 overflow-y-auto relative">
          {children}
          <CampaignComparisonBar selectedCampaigns={selectedCampaigns} onClear={clearSelection} onView={viewComparison} />
        </main>
      </div>
    </div>
  );
}

function MobileShell({
  campaigns,
  clientName,
  selectedIds,
  clearSelection,
  viewComparison,
  children,
}: {
  campaigns: CampaignRow[];
  clientName: string;
  selectedIds: string[];
  clearSelection: () => void;
  viewComparison: () => void;
  children: ReactNode;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = [
    { label: "Home", path: "/client/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", path: "/client/campaigns", icon: BarChart3 },
    { label: "Reports", path: "/client/reports", icon: FileBarChart },
    { label: "Email", path: "/client/email", icon: Mail },
    { label: "Sync", path: "/client/sync-status", icon: RefreshCw },
  ];

  return (
    <div className="flex flex-col bg-white h-[100dvh] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
        <button type="button" onClick={() => navigate("/client/dashboard")} className="flex items-center gap-1.5">
          <div className="rounded-md p-1" style={{ background: PRIMARY }}>
            <Cloud size={12} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 max-w-[170px] truncate" style={{ fontSize: 12 }}>{clientName}</span>
        </button>
        <div className="flex items-center gap-2.5">
          {selectedIds.length > 0 && (
            <Button type="button" size="sm" className="h-7 px-2" disabled={selectedIds.length < 2} onClick={viewComparison}>
              Compare
            </Button>
          )}
          <Bell size={15} className="text-slate-500" />
          <button type="button" onClick={logout} className="flex items-center gap-1 text-slate-500" aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto relative p-3" style={{ background: PAGE_BG }}>
        {children}
        <CampaignComparisonBar selectedCampaigns={campaigns.filter((campaign) => selectedIds.includes(campaign.id))} onClear={clearSelection} onView={viewComparison} />
      </main>

      <div className="flex border-t border-slate-100 bg-white flex-shrink-0">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = path === "/client/dashboard" ? location.pathname === path : location.pathname.startsWith(path);
          return (
            <button
              key={path}
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

export function ClientDashboard() {
  const { apiFetch, user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const { layout, setLayout, saveLayout, resetLayout } = useClientDashboardLayout(user?.id);

  useEffect(() => {
    setLoading(true);
    apiFetch(withClientParam("/api/campaigns", user?.client_id))
      .then((res) => {
        if (res.status === 403) {
          toast.error("Access denied");
          return { campaigns: [] };
        }
        return res.ok ? res.json() : { campaigns: [] };
      })
      .then((data) => setCampaigns(data.campaigns || []))
      .finally(() => setLoading(false));
  }, [apiFetch, user?.client_id]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => campaigns.some((campaign) => campaign.id === id)));
  }, [campaigns]);

  const clientName = campaigns[0]?.client_name || user?.name || "Client workspace";
  const clearSelection = () => {
    setSelectedIds([]);
    setCompareMode(false);
  };
  const toggleCompare = (campaignId: string) => {
    setSelectedIds((current) => {
      if (current.includes(campaignId)) return current.filter((id) => id !== campaignId);
      if (current.length >= MAX_COMPARE) {
        toast.error("Choose up to 4 campaigns");
        return current;
      }
      return [...current, campaignId];
    });
  };
  const viewComparison = () => {
    if (selectedIds.length < 2) return;
    navigate(`/client/campaigns/compare?ids=${selectedIds.join(",")}`);
  };

  const routeContent = (mobile?: boolean) => (
    <ClientContentRoutes
      campaigns={campaigns}
      loading={loading}
      search={search}
      clientId={user?.client_id}
      layout={layout}
      setLayout={setLayout}
      saveLayout={saveLayout}
      resetLayout={resetLayout}
      selectedIds={selectedIds}
      compareMode={compareMode}
      setCompareMode={setCompareMode}
      toggleCompare={toggleCompare}
      clearSelection={clearSelection}
      mobile={mobile}
    />
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen w-full bg-slate-50 relative">
        <div className="hidden md:block w-full">
          <DesktopShell
            campaigns={campaigns}
            loading={loading}
            search={search}
            setSearch={setSearch}
            clientName={clientName}
            selectedIds={selectedIds}
            clearSelection={clearSelection}
            viewComparison={viewComparison}
          >
            {routeContent(false)}
          </DesktopShell>
        </div>
        <div className="block md:hidden w-full">
          <MobileShell campaigns={campaigns} clientName={clientName} selectedIds={selectedIds} clearSelection={clearSelection} viewComparison={viewComparison}>
            {routeContent(true)}
          </MobileShell>
        </div>
      </div>
    </DndProvider>
  );
}
