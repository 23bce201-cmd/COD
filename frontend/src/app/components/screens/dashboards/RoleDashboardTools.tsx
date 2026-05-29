import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Settings2, SplitSquareHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Checkbox } from "../../ui/checkbox";
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

export type ComparableCampaign = {
  id: string;
  name: string;
  platform?: string | null;
  status?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  total_spend?: number | string | null;
  total_clicks?: number | string | null;
  total_impressions?: number | string | null;
  total_leads?: number | string | null;
  total_conversions?: number | string | null;
  total_revenue?: number | string | null;
};

export type ComparableMetric = {
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

export type DashboardMetricCard = {
  key: string;
  label: string;
  value: string;
  rawValue?: number;
  delta?: string;
  up?: boolean;
};

type LayoutPreference = {
  order: string[];
  hidden: string[];
};

const PRIMARY = "#6366F1";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";
const DANGER = "#F43F5E";
const PINK = "#EC4899";
const TEAL = "#0F766E";
const SKY = "#0369A1";
const BORDER = "#E2E8F0";
const PAGE_BG = "#F8FAFC";
const COLORS = [PRIMARY, SUCCESS, WARNING, PINK, TEAL, SKY];
const MAX_COMPARE = 4;

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

function normalizeLayout(metrics: DashboardMetricCard[], saved?: Partial<LayoutPreference> | null): LayoutPreference {
  const keys = metrics.map((metric) => metric.key);
  const order = Array.isArray(saved?.order)
    ? [...saved.order.filter((key) => keys.includes(key)), ...keys.filter((key) => !saved.order?.includes(key))]
    : keys;
  const hidden = Array.isArray(saved?.hidden) ? saved.hidden.filter((key) => keys.includes(key)) : [];
  return { order, hidden };
}

function readLayout(storageKey: string, metrics: DashboardMetricCard[]) {
  if (typeof window === "undefined") return normalizeLayout(metrics);
  try {
    return normalizeLayout(metrics, JSON.parse(window.localStorage.getItem(storageKey) || "null"));
  } catch {
    return normalizeLayout(metrics);
  }
}

export function CustomizableMetricGrid({
  storageKey,
  metrics,
  columnsClassName,
}: {
  storageKey: string;
  metrics: DashboardMetricCard[];
  columnsClassName: string;
}) {
  const [layout, setLayout] = useState<LayoutPreference>(() => readLayout(storageKey, metrics));
  const [open, setOpen] = useState(false);
  const metricMap = new Map(metrics.map((metric) => [metric.key, metric]));

  useEffect(() => {
    setLayout(readLayout(storageKey, metrics));
  }, [metrics.map((metric) => metric.key).join("|"), storageKey]);

  const save = (next = layout) => {
    const normalized = normalizeLayout(metrics, next);
    setLayout(normalized);
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
    toast.success("Dashboard layout saved");
  };

  const reset = () => {
    const next = normalizeLayout(metrics);
    setLayout(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    toast.success("Dashboard layout reset");
  };

  const visible = layout.order.map((key) => metricMap.get(key)).filter((metric): metric is DashboardMetricCard => Boolean(metric) && !layout.hidden.includes(metric.key));

  const move = (key: string, direction: -1 | 1) => {
    setLayout((current) => {
      const order = current.order.slice();
      const index = order.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      const [item] = order.splice(index, 1);
      order.splice(target, 0, item);
      return { ...current, order };
    });
  };

  const toggle = (key: string, checked: boolean) => {
    setLayout((current) => ({
      ...current,
      hidden: checked ? current.hidden.filter((item) => item !== key) : [...new Set([...current.hidden, key])],
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings2 size={14} />
          Customise
        </Button>
      </div>
      <div className={columnsClassName}>
        {visible.map((metric, index) => (
          <Card key={metric.key} className="data-enter rounded-xl bg-white p-4 gap-2 transition-all duration-150 hover:-translate-y-0.5" style={{ border: `1px solid ${BORDER}`, animationDelay: `${index * 60}ms` }}>
            <span className="text-slate-500 font-semibold uppercase tracking-wide" style={{ fontSize: 11 }}>{metric.label}</span>
            <span className="text-slate-900 font-semibold font-mono tabular-nums" style={{ fontSize: 24 }}>{metric.value}</span>
            {metric.delta && (
              <div className="flex items-center gap-1">
                {metric.up === false ? <ArrowDownRight size={12} style={{ color: DANGER }} /> : <ArrowUpRight size={12} style={{ color: SUCCESS }} />}
                <span className="font-medium" style={{ fontSize: 11, color: metric.up === false ? DANGER : SUCCESS }}>{metric.delta}</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="bg-slate-50">
          <SheetHeader>
            <SheetTitle>Customise dashboard</SheetTitle>
            <SheetDescription>Pin, hide, and reorder dashboard KPI cards.</SheetDescription>
          </SheetHeader>
          <div className="px-4 flex flex-col gap-2 overflow-y-auto">
            {layout.order.map((key) => {
              const metric = metricMap.get(key);
              if (!metric) return null;
              const checked = !layout.hidden.includes(key);
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-slate-700 font-medium flex-1" style={{ fontSize: 12 }}>{metric.label}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => move(key, -1)} aria-label={`Move ${metric.label} up`}>
                    <ChevronUp size={13} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => move(key, 1)} aria-label={`Move ${metric.label} down`}>
                    <ChevronDown size={13} />
                  </Button>
                  <Switch checked={checked} onCheckedChange={(value) => toggle(key, value)} aria-label={`${checked ? "Hide" : "Show"} ${metric.label}`} />
                </div>
              );
            })}
          </div>
          <SheetFooter>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={reset}>Reset</Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="button" onClick={() => { save(); setOpen(false); }}>Save</Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CompareCheckbox({
  campaignId,
  selectedIds,
  onToggle,
  label,
}: {
  campaignId: string;
  selectedIds: string[];
  onToggle: (campaignId: string) => void;
  label: string;
}) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Checkbox checked={selectedIds.includes(campaignId)} onCheckedChange={() => onToggle(campaignId)} aria-label={label} />
    </div>
  );
}

export function useCampaignCompareSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleCampaign = (campaignId: string) => {
    setSelectedIds((current) => {
      if (current.includes(campaignId)) return current.filter((id) => id !== campaignId);
      if (current.length >= MAX_COMPARE) {
        toast.error("Choose up to 4 campaigns");
        return current;
      }
      return [...current, campaignId];
    });
  };

  const clearSelection = () => setSelectedIds([]);

  return { selectedIds, toggleCampaign, clearSelection };
}

export function CampaignCompareBar({
  selectedCampaigns,
  comparePath,
  onClear,
}: {
  selectedCampaigns: ComparableCampaign[];
  comparePath: string;
  onClear: () => void;
}) {
  const navigate = useNavigate();
  if (selectedCampaigns.length < 2) return null;
  return (
    <div className="fixed left-3 right-3 bottom-3 z-40 md:left-[216px] data-enter">
      <Card className="bg-white rounded-xl px-4 py-3 gap-3 shadow-lg" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-slate-700 font-semibold" style={{ fontSize: 13 }}>Comparing {selectedCampaigns.length} campaigns:</span>
            {selectedCampaigns.map((campaign) => (
              <Badge key={campaign.id} variant="secondary" className="rounded-full max-w-[220px] truncate" style={{ fontSize: 11 }}>
                {campaign.name}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClear}>Clear</Button>
            <Button type="button" onClick={() => navigate(`${comparePath}?ids=${selectedCampaigns.map((campaign) => campaign.id).join(",")}`)}>
              <SplitSquareHorizontal size={15} />
              View Comparison
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function normalizeMetrics(rows: ComparableMetric[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(a.period || a.date).getTime() - new Date(b.period || b.date).getTime())
    .map((row) => {
      const spend = n(row.spend);
      const clicks = n(row.clicks);
      const impressions = n(row.impressions);
      const revenue = n(row.revenue);
      const conversions = n(row.conversions);
      const leads = n(row.leads);
      const date = row.period || row.date;
      return {
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        spend,
        clicks,
        impressions,
        revenue,
        conversions,
        leads,
        reach: n(row.reach),
        ctr: impressions > 0 ? (clicks / impressions) * 100 : n(row.ctr),
        cpc: clicks > 0 ? spend / clicks : n(row.cpc),
        roas: spend > 0 ? revenue / spend : n(row.roas),
        engagements: Math.round(clicks * 0.45 + leads * 1.2),
      };
    });
}

function totals(campaign: ComparableCampaign, rows: ReturnType<typeof normalizeMetrics>) {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0) || n(campaign.total_spend);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0) || n(campaign.total_revenue);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0) || n(campaign.total_conversions);
  const leads = rows.reduce((sum, row) => sum + row.leads, 0) || n(campaign.total_leads);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0) || n(campaign.total_clicks);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0) || n(campaign.total_impressions);
  return {
    spend,
    revenue,
    conversions,
    leads,
    clicks,
    impressions,
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    engagements: rows.reduce((sum, row) => sum + row.engagements, 0) || Math.round(clicks * 0.45 + leads * 1.2),
  };
}

function mergeChartData(items: Array<{ campaign: ComparableCampaign; metrics: ReturnType<typeof normalizeMetrics> }>, key: "roas" | "spend" | "conversions" | "clicks") {
  const byDate = new Map<string, Record<string, string | number>>();
  items.forEach(({ campaign, metrics }) => {
    metrics.forEach((row) => {
      const current = byDate.get(row.date) || { date: row.date, label: row.label };
      current[campaign.id] = row[key];
      byDate.set(row.date, current);
    });
  });
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function RoleCampaignComparisonPage({
  campaigns,
  selectedIds,
  apiFetch,
  buildDetailPath,
  localMetricsByCampaign,
  backPath,
  onClear,
}: {
  campaigns: ComparableCampaign[];
  selectedIds: string[];
  apiFetch?: (path: string) => Promise<Response>;
  buildDetailPath?: (campaignId: string) => string;
  localMetricsByCampaign?: Record<string, ComparableMetric[]>;
  backPath: string;
  onClear: () => void;
}) {
  const navigate = useNavigate();
  const search = new URLSearchParams(window.location.search);
  const ids = (search.get("ids")?.split(",").filter(Boolean) || selectedIds).slice(0, MAX_COMPARE);
  const [items, setItems] = useState<Array<{ campaign: ComparableCampaign; metrics: ReturnType<typeof normalizeMetrics> }>>([]);
  const [loading, setLoading] = useState(true);
  const [chartKey, setChartKey] = useState<"roas" | "spend" | "conversions" | "clicks">("roas");

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const next = await Promise.all(
        ids.map(async (id) => {
          const fallback = campaigns.find((campaign) => campaign.id === id);
          if (!fallback) return null;
          if (localMetricsByCampaign) {
            return { campaign: fallback, metrics: normalizeMetrics(localMetricsByCampaign[id] || []) };
          }
          if (!apiFetch || !buildDetailPath) return { campaign: fallback, metrics: [] };
          const response = await apiFetch(buildDetailPath(id));
          const data = response.ok ? await response.json() : { campaign: fallback, metrics: [] };
          return { campaign: data.campaign || fallback, metrics: normalizeMetrics(data.metrics || []) };
        })
      );
      setItems(next.filter((item): item is { campaign: ComparableCampaign; metrics: ReturnType<typeof normalizeMetrics> } => Boolean(item)));
      setLoading(false);
    };

    load();
  }, [apiFetch, buildDetailPath, campaigns, ids.join(","), localMetricsByCampaign]);

  if (loading) {
    return <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />;
  }

  if (items.length < 2) {
    return (
      <div className="flex flex-col gap-4 data-enter">
        <Card className="bg-white rounded-xl p-8 text-center text-slate-400" style={{ border: `1px solid ${BORDER}`, fontSize: 13 }}>
          Select at least two campaigns to compare.
        </Card>
        <Button type="button" className="self-start" onClick={() => navigate(backPath)}>Back</Button>
      </div>
    );
  }

  const rows: Array<{ key: keyof ReturnType<typeof totals>; label: string; formatter: (value: number) => string; lower?: boolean }> = [
    { key: "roas", label: "ROAS", formatter: fmtRoas },
    { key: "spend", label: "Spend", formatter: fmtMoney, lower: true },
    { key: "conversions", label: "Conversions", formatter: fmtNumber },
    { key: "leads", label: "Leads", formatter: fmtNumber },
    { key: "revenue", label: "Conversion value", formatter: fmtMoney },
    { key: "ctr", label: "CTR", formatter: fmtPct },
    { key: "clicks", label: "Clicks", formatter: fmtNumber },
    { key: "impressions", label: "Impressions", formatter: fmtNumber },
    { key: "engagements", label: "Engagements", formatter: fmtNumber },
  ];
  const totalsByCampaign = items.map((item) => ({ ...item, totals: totals(item.campaign, item.metrics) }));
  const chartData = mergeChartData(items, chartKey);
  const chartFormatter = chartKey === "roas" ? fmtRoas : chartKey === "spend" ? fmtMoney : fmtNumber;

  return (
    <div className="flex flex-col gap-4 data-enter">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Campaign Comparison</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>{items.length} selected campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(backPath)}>Back</Button>
          <Button type="button" variant="ghost" onClick={() => { onClear(); navigate(backPath); }}>
            <X size={14} />
            Exit comparison
          </Button>
        </div>
      </div>

      <Card className="bg-white rounded-xl gap-0 overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: PAGE_BG }}>
              <TableHead className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>Metric</TableHead>
              {items.map((item) => (
                <TableHead key={item.campaign.id} className="px-4 py-2.5 text-slate-500 font-semibold" style={{ fontSize: 11 }}>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-800">{item.campaign.name}</span>
                    {item.campaign.client_name && <span className="text-slate-400">{item.campaign.client_name}</span>}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const values = totalsByCampaign.map((item) => n(item.totals[row.key]));
              const best = row.lower ? Math.min(...values) : Math.max(...values);
              const worst = row.lower ? Math.max(...values) : Math.min(...values);
              return (
                <TableRow key={row.key}>
                  <th scope="row" className="px-4 py-3 text-left align-middle text-slate-700 font-semibold" style={{ fontSize: 12 }}>{row.label}</th>
                  {values.map((value, index) => (
                    <TableCell key={`${row.key}-${totalsByCampaign[index].campaign.id}`} className="px-4 py-3" style={{ background: value === best ? "#ECFDF5" : value === worst && best !== worst ? "#FFFBEB" : undefined }}>
                      <span className="text-slate-900 font-semibold font-mono" style={{ fontSize: 12 }}>{row.formatter(value)}</span>
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-white rounded-xl p-4 gap-3" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Overlay trend</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              {items.map((item, index) => (
                <span key={item.campaign.id} className="flex items-center gap-1.5 text-slate-500" style={{ fontSize: 11 }}>
                  <span className="w-3 h-0.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  {item.campaign.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex rounded-lg p-1 gap-1 bg-slate-200">
            {(["roas", "spend", "conversions", "clicks"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setChartKey(key)}
                className="rounded-md px-3 py-1 font-medium capitalize"
                style={{ fontSize: 11, background: chartKey === key ? "#fff" : "transparent", color: chartKey === key ? "#1E293B" : "#64748B" }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(value) => chartFormatter(Number(value))} />
            <Tooltip formatter={(value: number) => chartFormatter(Number(value))} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            {items.map((item, index) => (
              <Line key={item.campaign.id} type="monotone" dataKey={item.campaign.id} name={item.campaign.name} stroke={COLORS[index % COLORS.length]} strokeWidth={2.2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export function roleCompareCampaigns(campaigns: ComparableCampaign[], selectedIds: string[]) {
  return campaigns.filter((campaign) => selectedIds.includes(campaign.id));
}
