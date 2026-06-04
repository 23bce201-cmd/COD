// Reports tab for generating analytics reports, downloading exports, and emailing report PDFs.
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  DollarSign,
  Download,
  FileBarChart,
  FileText,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../../context/AuthContext";
import { ReportEmailComposer } from "./ReportEmailComposer";

interface AnalyticsRow {
  client_name?: string;
  platform: string;
  campaign_name: string;
  status: string;
  total_spend: string | number;
  total_impressions: string | number;
  total_clicks: string | number;
  total_leads: string | number;
  total_conversions?: string | number;
  total_revenue?: string | number;
  ctr: string;
  cpl: string;
  cpc: string;
  conversion_rate?: string;
  roas?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

type ReportFormat = "PDF" | "CSV" | "Excel";
type DownloadFormat = "PDF" | "CSV" | "Excel";

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  description: string;
  clientId: string;
  clientName: string;
  dateRangeLabel: string;
  days: string;
  format: ReportFormat;
  downloadFormat: DownloadFormat;
  from: string;
  to: string;
  createdAt: string;
  rowCount: number;
  totalSpend: number;
  totalLeads: number;
  data: AnalyticsRow[];
}

interface PlatformMetric {
  name: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  cpl: number;
  cpc: number;
  ctr: number;
  roas: number;
  conversionRate: number;
  spendShare: number;
  impressionShare: number;
}

interface CampaignMetric {
  client: string;
  platform: string;
  campaign: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
  conversionRate: number;
}

interface ClientMetric {
  name: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  conversions: number;
  revenue: number;
  campaignCount: number;
  cpl: number;
  cpc: number;
  ctr: number;
  roas: number;
  conversionRate: number;
}

interface StatusMetric {
  name: string;
  campaigns: number;
  spend: number;
}

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: "PDF", label: "PDF Document" },
  { value: "CSV", label: "CSV Feed" },
  { value: "Excel", label: "Excel Feed" },
];

const CHART_COLORS = ["#6366F1", "#EC4899", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6", "#F43F5E", "#64748B"];

const TEMPLATES = [
  {
    id: "performance",
    title: "Performance Report",
    description: "Spend, CPL, CTR, and lead performance by campaign.",
  },
  {
    id: "lead_gen",
    title: "Lead Gen Summary",
    description: "Lead volume, cost per lead, and conversion efficiency.",
  },
  {
    id: "platform",
    title: "Platform Breakdown",
    description: "Google, Meta, LinkedIn, and Twitter performance rollup.",
  },
  {
    id: "monthly",
    title: "Monthly Overview",
    description: "Agency-level report package for stakeholders.",
  },
];

function getDateRange(days: string) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Number(days));

  return {
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0],
  };
}

function getRangeLabel(days: string) {
  return DATE_RANGE_OPTIONS.find(option => option.value === days)?.label || `Last ${days} Days`;
}

function formatCurrency(value: number, digits = 2) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function numeric(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentNumber(value: string | undefined) {
  const parsed = Number(String(value || "0").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPlatform(platform: string) {
  return platform
    .replace("_ads", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function shortenLabel(value: string | number, maxLength = 18) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "All_Clients";
}

function csvEscape(value: string | number) {
  const rawText = String(value ?? "");
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlEscape(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCsv(report: GeneratedReport) {
  const metaRows = [
    ["Report", report.title],
    ["Client", report.clientName],
    ["Period", `${report.from} to ${report.to}`],
    ["Generated", new Date(report.createdAt).toLocaleString()],
    [],
  ];

  const headers = [
    "Client",
    "Platform",
    "Campaign Name",
    "Status",
    "Spend",
    "Impressions",
    "Clicks",
    "CTR",
    "Leads",
    "Conversions",
    "Revenue",
    "Conversion Rate",
    "ROAS",
    "CPL",
    "CPC",
  ];

  const dataRows = report.data.map(row => [
    row.client_name || report.clientName,
    formatPlatform(row.platform),
    row.campaign_name,
    row.status,
    Number(row.total_spend).toFixed(2),
    Number(row.total_impressions),
    Number(row.total_clicks),
    row.ctr,
    Number(row.total_leads),
    numeric(row.total_conversions),
    numeric(row.total_revenue).toFixed(2),
    row.conversion_rate || "0%",
    row.roas || "0",
    row.cpl,
    row.cpc,
  ]);

  return [...metaRows, headers, ...dataRows]
    .map(row => row.map(csvEscape).join(","))
    .join("\n");
}

function buildExcelHtml(report: GeneratedReport) {
  const rows = report.data.map(row => `
    <tr>
      <td>${htmlEscape(row.client_name || report.clientName)}</td>
      <td>${htmlEscape(formatPlatform(row.platform))}</td>
      <td>${htmlEscape(row.campaign_name)}</td>
      <td>${htmlEscape(row.status)}</td>
      <td>${Number(row.total_spend).toFixed(2)}</td>
      <td>${Number(row.total_impressions)}</td>
      <td>${Number(row.total_clicks)}</td>
      <td>${htmlEscape(row.ctr)}</td>
      <td>${Number(row.total_leads)}</td>
      <td>${numeric(row.total_conversions)}</td>
      <td>${numeric(row.total_revenue).toFixed(2)}</td>
      <td>${htmlEscape(row.conversion_rate || "0%")}</td>
      <td>${htmlEscape(row.roas || "0")}</td>
      <td>${htmlEscape(row.cpl)}</td>
      <td>${htmlEscape(row.cpc)}</td>
    </tr>
  `).join("");

  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <h2>${htmlEscape(report.title)}</h2>
        <p>${htmlEscape(report.clientName)} | ${report.from} to ${report.to}</p>
        <table border="1">
          <thead>
            <tr>
              <th>Client</th>
              <th>Platform</th>
              <th>Campaign Name</th>
              <th>Status</th>
              <th>Spend</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>CTR</th>
              <th>Leads</th>
              <th>Conversions</th>
              <th>Revenue</th>
              <th>Conversion Rate</th>
              <th>ROAS</th>
              <th>CPL</th>
              <th>CPC</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildDownloadName(report: GeneratedReport) {
  const extension = report.downloadFormat === "Excel" ? "xls" : report.downloadFormat.toLowerCase();
  return `Report_${safeFileName(report.clientName)}_${report.days}days_${report.to}.${extension}`;
}

export function Reports() {
  const { apiFetch, user } = useAuth();
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("30");
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("PDF");
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [activeReport, setActiveReport] = useState<GeneratedReport | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch("/api/clients");
        if (res.ok) {
          const cData = await res.json();
          const nextClients = cData.clients || [];
          setClients(nextClients);
          if (user?.role === "client" && nextClients[0]?.id) {
            setSelectedClient(nextClients[0].id);
          }
        }
      } catch {
        setError("Failed to load clients for report generation.");
      }
    }

    init();
  }, [apiFetch, user?.role]);

  const platformMetrics = useMemo<PlatformMetric[]>(() => {
    const platformAgg = data.reduce((acc, row) => {
      const platform = formatPlatform(row.platform);
      if (!acc[platform]) {
        acc[platform] = {
          name: platform,
          spend: 0,
          leads: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          revenue: 0,
          cpl: 0,
          cpc: 0,
          ctr: 0,
          roas: 0,
          conversionRate: 0,
          spendShare: 0,
          impressionShare: 0,
        };
      }
      acc[platform].spend += numeric(row.total_spend);
      acc[platform].leads += numeric(row.total_leads);
      acc[platform].clicks += numeric(row.total_clicks);
      acc[platform].impressions += numeric(row.total_impressions);
      acc[platform].conversions += numeric(row.total_conversions);
      acc[platform].revenue += numeric(row.total_revenue);
      return acc;
    }, {} as Record<string, PlatformMetric>);

    const metrics = Object.values(platformAgg);
    const spendTotal = metrics.reduce((sum, metric) => sum + metric.spend, 0);
    const impressionTotal = metrics.reduce((sum, metric) => sum + metric.impressions, 0);

    return metrics.map(metric => ({
      ...metric,
      cpl: metric.leads > 0 ? metric.spend / metric.leads : 0,
      cpc: metric.clicks > 0 ? metric.spend / metric.clicks : 0,
      ctr: metric.impressions > 0 ? (metric.clicks / metric.impressions) * 100 : 0,
      roas: metric.spend > 0 ? metric.revenue / metric.spend : 0,
      conversionRate: metric.clicks > 0 ? (metric.conversions / metric.clicks) * 100 : 0,
      spendShare: spendTotal > 0 ? (metric.spend / spendTotal) * 100 : 0,
      impressionShare: impressionTotal > 0 ? (metric.impressions / impressionTotal) * 100 : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [data]);

  const campaignMetrics = useMemo<CampaignMetric[]>(() => {
    return data.map(row => {
      const spend = numeric(row.total_spend);
      const clicks = numeric(row.total_clicks);
      const impressions = numeric(row.total_impressions);
      const leads = numeric(row.total_leads);
      const conversions = numeric(row.total_conversions);
      const revenue = numeric(row.total_revenue);

      return {
        client: row.client_name || "All Clients",
        platform: formatPlatform(row.platform),
        campaign: row.campaign_name,
        status: row.status,
        spend,
        impressions,
        clicks,
        leads,
        conversions,
        revenue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : percentNumber(row.ctr),
        cpc: clicks > 0 ? spend / clicks : numeric(row.cpc),
        cpl: leads > 0 ? spend / leads : numeric(row.cpl),
        roas: spend > 0 ? revenue / spend : numeric(row.roas),
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : percentNumber(row.conversion_rate),
      };
    }).sort((a, b) => b.spend - a.spend);
  }, [data]);

  const clientMetrics = useMemo<ClientMetric[]>(() => {
    const clientAgg = data.reduce((acc, row) => {
      const clientName = row.client_name || "All Clients";
      if (!acc[clientName]) {
        acc[clientName] = {
          name: clientName,
          spend: 0,
          leads: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
          revenue: 0,
          campaignCount: 0,
          cpl: 0,
          cpc: 0,
          ctr: 0,
          roas: 0,
          conversionRate: 0,
        };
      }

      acc[clientName].spend += numeric(row.total_spend);
      acc[clientName].leads += numeric(row.total_leads);
      acc[clientName].clicks += numeric(row.total_clicks);
      acc[clientName].impressions += numeric(row.total_impressions);
      acc[clientName].conversions += numeric(row.total_conversions);
      acc[clientName].revenue += numeric(row.total_revenue);
      acc[clientName].campaignCount += 1;
      return acc;
    }, {} as Record<string, ClientMetric>);

    return Object.values(clientAgg).map(metric => ({
      ...metric,
      cpl: metric.leads > 0 ? metric.spend / metric.leads : 0,
      cpc: metric.clicks > 0 ? metric.spend / metric.clicks : 0,
      ctr: metric.impressions > 0 ? (metric.clicks / metric.impressions) * 100 : 0,
      roas: metric.spend > 0 ? metric.revenue / metric.spend : 0,
      conversionRate: metric.clicks > 0 ? (metric.conversions / metric.clicks) * 100 : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [data]);

  const statusMetrics = useMemo<StatusMetric[]>(() => {
    const statusAgg = campaignMetrics.reduce((acc, campaign) => {
      const status = campaign.status || "unknown";
      if (!acc[status]) acc[status] = { name: status, campaigns: 0, spend: 0 };
      acc[status].campaigns += 1;
      acc[status].spend += campaign.spend;
      return acc;
    }, {} as Record<string, StatusMetric>);

    return Object.values(statusAgg).sort((a, b) => b.campaigns - a.campaigns);
  }, [campaignMetrics]);

  const totalSpend = platformMetrics.reduce((sum, platform) => sum + platform.spend, 0);
  const totalLeads = platformMetrics.reduce((sum, platform) => sum + platform.leads, 0);
  const totalImpressions = platformMetrics.reduce((sum, platform) => sum + platform.impressions, 0);
  const totalClicks = platformMetrics.reduce((sum, platform) => sum + platform.clicks, 0);
  const totalConversions = platformMetrics.reduce((sum, platform) => sum + platform.conversions, 0);
  const totalRevenue = platformMetrics.reduce((sum, platform) => sum + platform.revenue, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const leadRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;
  const activeCampaignCount = campaignMetrics.filter(campaign => campaign.status === "active").length;
  const topCampaigns = campaignMetrics.slice(0, 8);
  const topLeadCampaigns = [...campaignMetrics].sort((a, b) => b.leads - a.leads).slice(0, 8);
  const topRoasCampaigns = [...campaignMetrics].filter(campaign => campaign.spend > 0).sort((a, b) => b.roas - a.roas).slice(0, 8);
  const topClientMetrics = clientMetrics.slice(0, 8);
  const bestCtrPlatform = [...platformMetrics].sort((a, b) => b.ctr - a.ctr)[0];
  const bestRoasPlatform = [...platformMetrics].sort((a, b) => b.roas - a.roas)[0];
  const bestCplPlatform = [...platformMetrics].filter(platform => platform.leads > 0).sort((a, b) => a.cpl - b.cpl)[0];
  const topLeadCampaignName = shortenLabel(topLeadCampaigns[0]?.campaign || "No lead data", 28);
  const selectedBuilderRange = getDateRange(selectedDateRange);

  async function handleGenerateReport(
    type: string,
    title: string,
    description: string,
    clientId = selectedClient,
    days = selectedDateRange,
    format = selectedFormat,
  ) {
    setLoading(true);
    setError("");

    const { from, to } = getDateRange(days);
    const effectiveClientId = user?.role === "client" ? (clientId || user.client_id || "") : clientId;
    const clientObj = clients.find(client => client.id === effectiveClientId);
    const clientName = clientObj ? clientObj.name : user?.role === "client" ? (user.name || "Client") : "All Clients";
    const dateRangeLabel = getRangeLabel(days);
    const downloadFormat: DownloadFormat = format;

    try {
      let url = `/api/reports/analytics?from=${from}&to=${to}`;
      if (effectiveClientId) url += `&client_id=${effectiveClientId}`;

      const res = await apiFetch(url);
      if (!res.ok) {
        throw new Error("Report analytics request failed.");
      }

      const json = await res.json();
      const rows: AnalyticsRow[] = json.data || [];
      const spend = rows.reduce((sum, row) => sum + (Number(row.total_spend) || 0), 0);
      const leads = rows.reduce((sum, row) => sum + (Number(row.total_leads) || 0), 0);
      const report: GeneratedReport = {
        id: `${Date.now()}-${type}`,
        type,
        title,
        description,
        clientId: effectiveClientId,
        clientName,
        dateRangeLabel,
        days,
        format,
        downloadFormat,
        from,
        to,
        createdAt: new Date().toISOString(),
        rowCount: rows.length,
        totalSpend: spend,
        totalLeads: leads,
        data: rows,
      };

      setData(rows);
      setActiveReport(report);
      setGeneratedReports(prev => [report, ...prev].slice(0, 8));
    } catch {
      setError("Could not generate the report. Please check the selected filters and try again.");
    } finally {
      window.setTimeout(() => setLoading(false), 450);
    }
  }

  async function handleDownloadReport(report: GeneratedReport) {
    setDownloadingId(report.id);
    setError("");

    try {
      if (report.downloadFormat === "PDF") {
        const params = new URLSearchParams({
          from: report.from,
          to: report.to,
          title: report.title,
          client_name: report.clientName,
        });
        const endpoint = report.clientId
          ? `/api/reports/pdf/${report.clientId}?${params.toString()}`
          : `/api/reports/pdf?${params.toString()}`;
        const res = await apiFetch(endpoint);
        if (!res.ok) throw new Error("PDF request failed.");
        const blob = await res.blob();
        downloadBlob(blob, buildDownloadName(report));
        return;
      }

      if (report.downloadFormat === "Excel") {
        downloadBlob(
          new Blob([buildExcelHtml(report)], { type: "application/vnd.ms-excel;charset=utf-8" }),
          buildDownloadName(report),
        );
        return;
      }

      downloadBlob(
        new Blob([buildCsv(report)], { type: "text/csv;charset=utf-8" }),
        buildDownloadName(report),
      );
    } catch {
      setError("Download failed. Please generate the report again and retry.");
    } finally {
      setDownloadingId(null);
    }
  }

  function openReport(report: GeneratedReport) {
    setData(report.data);
    setActiveReport(report);
  }

  function renderMetricGrid(metrics: { label: string; value: string; icon: JSX.Element; color: string; bg: string }[]) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(metric => (
          <div key={metric.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-indigo-100 hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${metric.bg} ${metric.color}`}>{metric.icon}</div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{metric.label}</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl break-words">{metric.value}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderChartCard(title: string, children: JSX.Element, className = "") {
    return (
      <div className={`bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80 hover:border-indigo-100 hover:-translate-y-0.5 transition-all ${className}`}>
        <h2 className="text-slate-800 font-semibold text-sm mb-4">{title}</h2>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  }

  function renderPerformanceReport() {
    const metrics = [
      { label: "Total Spend", value: formatCurrency(totalSpend), icon: <DollarSign size={16} />, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Conversion Value", value: formatCurrency(totalRevenue), icon: <TrendingUp size={16} />, color: "text-pink-600", bg: "bg-pink-50" },
      { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: <Sparkles size={16} />, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Conversions", value: totalConversions.toLocaleString(), icon: <Target size={16} />, color: "text-purple-600", bg: "bg-purple-50" },
      { label: "Leads", value: totalLeads.toLocaleString(), icon: <Target size={16} />, color: "text-cyan-600", bg: "bg-cyan-50" },
      { label: "CTR", value: `${ctr.toFixed(2)}%`, icon: <MousePointerClick size={16} />, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Avg CPC", value: formatCurrency(avgCPC), icon: <FileBarChart size={16} />, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Avg CPL", value: formatCurrency(avgCPL), icon: <FileBarChart size={16} />, color: "text-rose-600", bg: "bg-rose-50" },
    ];

    return (
      <>
        {renderMetricGrid(metrics)}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderChartCard("Campaign Spend vs Conversion Value", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCampaigns} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="campaign" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-18} height={70} tickFormatter={value => shortenLabel(value, 14)} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="revenue" name="Conversion Value" fill="#EC4899" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Top Campaigns by ROAS", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRoasCampaigns} layout="vertical" margin={{ top: 5, right: 20, left: 42, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}x`} />
                <YAxis type="category" dataKey="campaign" width={150} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => shortenLabel(value, 20)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => `${Number(val).toFixed(2)}x`} />
                <Bar dataKey="roas" name="ROAS" fill="#10B981" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("CTR and CPC by Campaign", (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={topCampaigns} margin={{ top: 5, right: 32, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="campaign" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-18} height={70} tickFormatter={value => shortenLabel(value, 14)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#BE123C" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Number(value).toFixed(2)}`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number, name: string) => name === "CPC" ? [formatCurrency(val), name] : [`${Number(val).toFixed(2)}%`, name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar yAxisId="left" dataKey="ctr" name="CTR" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Lead Performance by Campaign", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topLeadCampaigns} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="campaign" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-18} height={70} tickFormatter={value => shortenLabel(value, 14)} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="leads" name="Leads" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ))}
        </div>
        {renderCampaignTable("Campaign Performance Detail", campaignMetrics)}
      </>
    );
  }

  function renderLeadGenReport() {
    const metrics = [
      { label: "Lead Volume", value: totalLeads.toLocaleString(), icon: <Target size={16} />, color: "text-cyan-600", bg: "bg-cyan-50" },
      { label: "Avg CPL", value: formatCurrency(avgCPL), icon: <DollarSign size={16} />, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Lead Rate", value: `${leadRate.toFixed(2)}%`, icon: <MousePointerClick size={16} />, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Conversions", value: totalConversions.toLocaleString(), icon: <CheckCircle2 size={16} />, color: "text-purple-600", bg: "bg-purple-50" },
      { label: "Conv. Rate", value: `${conversionRate.toFixed(2)}%`, icon: <TrendingUp size={16} />, color: "text-pink-600", bg: "bg-pink-50" },
      { label: "Cost / Conversion", value: formatCurrency(totalConversions > 0 ? totalSpend / totalConversions : 0), icon: <FileBarChart size={16} />, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Top Lead Campaign", value: topLeadCampaignName, icon: <Sparkles size={16} />, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Active Campaigns", value: activeCampaignCount.toLocaleString(), icon: <BarChart3 size={16} />, color: "text-rose-600", bg: "bg-rose-50" },
    ];

    const leadQualityData = [
      { name: "Volume", value: Math.min(100, totalLeads / 10) },
      { name: "CPL Efficiency", value: avgCPL > 0 ? Math.min(100, 1000 / avgCPL) : 0 },
      { name: "Conversion", value: Math.min(100, conversionRate * 8) },
      { name: "Engagement", value: Math.min(100, ctr * 12) },
      { name: "Velocity", value: Math.min(100, leadRate * 4) },
      { name: "Retention", value: Math.min(100, roas * 18) },
    ];

    return (
      <>
        {renderMetricGrid(metrics)}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderChartCard("Leads and Conversions by Platform", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="leads" name="Leads" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Cost Per Lead by Platform", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Number(value).toFixed(0)}`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="cpl" name="CPL" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Top Lead Gen Campaigns", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topLeadCampaigns} layout="vertical" margin={{ top: 5, right: 20, left: 42, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="campaign" width={150} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => shortenLabel(value, 20)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
                <Bar dataKey="leads" name="Leads" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Lead Quality Score", (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={leadQualityData} outerRadius={96}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => `${Number(val).toFixed(0)}/100`} />
                <Radar dataKey="value" name="Score" stroke="#EC4899" fill="#EC4899" fillOpacity={0.22} />
              </RadarChart>
            </ResponsiveContainer>
          ))}
        </div>
        {renderLeadTable()}
      </>
    );
  }

  function renderPlatformReport() {
    const metrics = [
      { label: "Platforms", value: platformMetrics.length.toLocaleString(), icon: <BarChart3 size={16} />, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Total Spend", value: formatCurrency(totalSpend), icon: <DollarSign size={16} />, color: "text-pink-600", bg: "bg-pink-50" },
      { label: "Conversion Value", value: formatCurrency(totalRevenue), icon: <TrendingUp size={16} />, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Blended ROAS", value: `${roas.toFixed(2)}x`, icon: <Sparkles size={16} />, color: "text-purple-600", bg: "bg-purple-50" },
      { label: "Best ROAS", value: bestRoasPlatform ? `${bestRoasPlatform.name} ${bestRoasPlatform.roas.toFixed(2)}x` : "No data", icon: <Target size={16} />, color: "text-cyan-600", bg: "bg-cyan-50" },
      { label: "Best CPL", value: bestCplPlatform ? `${bestCplPlatform.name} ${formatCurrency(bestCplPlatform.cpl)}` : "No data", icon: <FileBarChart size={16} />, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Best CTR", value: bestCtrPlatform ? `${bestCtrPlatform.name} ${bestCtrPlatform.ctr.toFixed(2)}%` : "No data", icon: <MousePointerClick size={16} />, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Avg CPM", value: formatCurrency(avgCpm), icon: <FileBarChart size={16} />, color: "text-rose-600", bg: "bg-rose-50" },
    ];

    return (
      <>
        {renderMetricGrid(metrics)}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderChartCard("Spend vs ROAS by Platform", (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={platformMetrics} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#059669" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}x`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number, name: string) => name === "ROAS" ? [`${Number(val).toFixed(2)}x`, name] : [formatCurrency(val), name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Spend Distribution", (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformMetrics} dataKey="spend" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  {platformMetrics.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
              </PieChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Efficiency Matrix: CTR / CPC", (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={platformMetrics} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#BE123C" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Number(value).toFixed(2)}`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number, name: string) => name === "CPC" ? [formatCurrency(val), name] : [`${Number(val).toFixed(2)}%`, name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar yAxisId="left" dataKey="ctr" name="CTR" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Leads and Conversion Rate", (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={platformMetrics} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#7C3AED" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}%`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number, name: string) => name === "Conversion Rate" ? [`${Number(val).toFixed(2)}%`, name] : [val.toLocaleString(), name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Conversion Rate" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ))}
        </div>
        {renderPlatformTable()}
      </>
    );
  }

  function renderMonthlyReport() {
    const metrics = [
      { label: "Clients", value: clientMetrics.length.toLocaleString(), icon: <FileText size={16} />, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Agency Spend", value: formatCurrency(totalSpend), icon: <DollarSign size={16} />, color: "text-pink-600", bg: "bg-pink-50" },
      { label: "Pipeline Value", value: formatCurrency(totalRevenue), icon: <TrendingUp size={16} />, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Portfolio ROAS", value: `${roas.toFixed(2)}x`, icon: <Sparkles size={16} />, color: "text-purple-600", bg: "bg-purple-50" },
      { label: "Leads", value: totalLeads.toLocaleString(), icon: <Target size={16} />, color: "text-cyan-600", bg: "bg-cyan-50" },
      { label: "Conversions", value: totalConversions.toLocaleString(), icon: <CheckCircle2 size={16} />, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Campaigns", value: campaignMetrics.length.toLocaleString(), icon: <BarChart3 size={16} />, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Active Campaigns", value: activeCampaignCount.toLocaleString(), icon: <Clock3 size={16} />, color: "text-rose-600", bg: "bg-rose-50" },
    ];

    return (
      <>
        {renderMetricGrid(metrics)}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {renderChartCard("Client Spend vs Pipeline Value", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClientMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-18} height={64} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="revenue" name="Pipeline Value" fill="#EC4899" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Client Leads and Conversions", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClientMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval={0} angle={-18} height={64} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="leads" name="Leads" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Platform Mix Across Agency", (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformMetrics} dataKey="spend" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  {platformMetrics.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
              </PieChart>
            </ResponsiveContainer>
          ))}

          {renderChartCard("Campaign Status Mix", (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number, name: string) => name === "Spend" ? [formatCurrency(val), name] : [val.toLocaleString(), name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                <Bar dataKey="campaigns" name="Campaigns" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="spend" name="Spend" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ))}
        </div>
        {renderClientTable()}
      </>
    );
  }

  function renderCampaignTable(title: string, rows: CampaignMetric[]) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold text-sm">{title}</h2>
          <span className="text-slate-400 text-xs font-semibold">{activeReport?.rowCount || 0} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Client", "Platform", "Campaign", "Status", "Spend", "Revenue", "ROAS", "CTR", "CPC", "CPL", "Leads", "Conversions"].map(header => (
                  <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-8 text-center text-slate-500 text-sm">No campaign data available for this period.</td>
                </tr>
              ) : rows.map((row, index) => (
                <tr key={`${row.platform}-${row.campaign}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[180px]" title={row.client}>{row.client}</td>
                  <td className="px-5 py-3"><span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">{row.platform}</span></td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900 min-w-[260px] max-w-[360px] whitespace-normal break-words leading-snug" title={row.campaign}>{row.campaign}</td>
                  <td className="px-5 py-3"><span className="inline-flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${row.status === "active" ? "bg-emerald-500" : row.status === "paused" ? "bg-amber-500" : "bg-slate-400"}`} /><span className="text-xs font-medium text-slate-600 capitalize">{row.status}</span></span></td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.spend)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-pink-600">{formatCurrency(row.revenue)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{row.roas.toFixed(2)}x</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{row.ctr.toFixed(2)}%</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(row.cpc)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.cpl)}</td>
                  <td className="px-5 py-3 text-sm font-medium text-indigo-600">{row.leads.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm font-medium text-purple-600">{row.conversions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderLeadTable() {
    const rows = [...campaignMetrics].sort((a, b) => b.leads - a.leads);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold text-sm">Lead Generation Detail</h2>
          <span className="text-slate-400 text-xs font-semibold">{totalLeads.toLocaleString()} leads</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Campaign", "Platform", "Client", "Leads", "CPL", "Clicks", "Lead Rate", "Conversions", "Conv. Rate", "Spend"].map(header => (
                  <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-500 text-sm">No lead data available for this period.</td></tr>
              ) : rows.map((row, index) => {
                const rowLeadRate = row.clicks > 0 ? (row.leads / row.clicks) * 100 : 0;
                return (
                  <tr key={`${row.campaign}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900 min-w-[260px] max-w-[360px] whitespace-normal break-words leading-snug" title={row.campaign}>{row.campaign}</td>
                    <td className="px-5 py-3"><span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">{row.platform}</span></td>
                    <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[180px]" title={row.client}>{row.client}</td>
                    <td className="px-5 py-3 text-sm font-bold text-indigo-600">{row.leads.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.cpl)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.clicks.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{rowLeadRate.toFixed(2)}%</td>
                    <td className="px-5 py-3 text-sm font-medium text-purple-600">{row.conversions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.conversionRate.toFixed(2)}%</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.spend)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPlatformTable() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold text-sm">Platform Rollup Detail</h2>
          <span className="text-slate-400 text-xs font-semibold">{platformMetrics.length} platforms</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Platform", "Spend", "Revenue", "ROAS", "Impressions", "Clicks", "CTR", "CPC", "CPM", "Leads", "CPL", "Conversions", "Conv. Rate"].map(header => (
                  <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {platformMetrics.length === 0 ? (
                <tr><td colSpan={13} className="px-5 py-8 text-center text-slate-500 text-sm">No platform data available for this period.</td></tr>
              ) : platformMetrics.map((row, index) => {
                const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
                return (
                  <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{row.name}</span></td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.spend)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-pink-600">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{row.roas.toFixed(2)}x</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.impressions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.clicks.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.ctr.toFixed(2)}%</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(row.cpc)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(cpm)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-indigo-600">{row.leads.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.cpl)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-purple-600">{row.conversions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{row.conversionRate.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderClientTable() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-800 font-semibold text-sm">Agency Client Rollup</h2>
          <span className="text-slate-400 text-xs font-semibold">{clientMetrics.length} clients</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Client", "Spend", "Revenue", "ROAS", "Leads", "Conversions", "CTR", "CPL", "CPC", "Campaigns"].map(header => (
                  <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clientMetrics.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-500 text-sm">No client data available for this period.</td></tr>
              ) : clientMetrics.map(row => (
                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900 truncate max-w-[220px]" title={row.name}>{row.name}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.spend)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-pink-600">{formatCurrency(row.revenue)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{row.roas.toFixed(2)}x</td>
                  <td className="px-5 py-3 text-sm font-medium text-indigo-600">{row.leads.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm font-medium text-purple-600">{row.conversions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{row.ctr.toFixed(2)}%</td>
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.cpl)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatCurrency(row.cpc)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{row.campaignCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderReportBody() {
    if (activeReport?.type === "lead_gen") return renderLeadGenReport();
    if (activeReport?.type === "platform") return renderPlatformReport();
    if (activeReport?.type === "monthly") return renderMonthlyReport();
    return renderPerformanceReport();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 min-h-[60vh] bg-slate-50/50 rounded-2xl border border-slate-100">
        <RefreshCw size={36} className="animate-spin text-indigo-600 mb-4" />
        <span className="font-semibold text-lg text-slate-800 animate-pulse">Assembling Report Data...</span>
        <span className="text-slate-400 text-xs mt-1">Aggregating platform metrics and building the download feed</span>
      </div>
    );
  }

  if (activeReport) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveReport(null)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer text-slate-600 flex-shrink-0"
              aria-label="Back to report feed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700">
                  {activeReport.downloadFormat} download
                </span>
                <span className="text-slate-400 text-xs">-</span>
                <span className="text-slate-500 text-xs font-medium">{activeReport.dateRangeLabel}</span>
                <span className="text-slate-400 text-xs">-</span>
                <span className="text-slate-500 text-xs font-medium">{activeReport.clientName}</span>
              </div>
              <h1 className="text-slate-900 font-bold text-xl mt-0.5 truncate">{activeReport.title}</h1>
            </div>
          </div>

          <button
            onClick={() => handleDownloadReport(activeReport)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
            style={{ background: "#6366F1", fontSize: 12 }}
          >
            {downloadingId === activeReport.id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Download {activeReport.downloadFormat}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700 text-xs font-semibold">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-2xl p-5 border border-indigo-100/50 shadow-sm flex items-center justify-between gap-4">
          <div>
            <h3 className="text-indigo-950 font-bold text-sm flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              Generated Report: {activeReport.clientName}
            </h3>
            <p className="text-indigo-800 text-xs mt-1">{activeReport.description}</p>
          </div>
          <div className="text-right text-slate-500 text-xs font-semibold">
            Generated on: {new Date(activeReport.createdAt).toLocaleDateString()}
            <div className="mt-1 text-slate-400">{activeCampaignCount} active campaigns - {platformMetrics.length} platforms</div>
          </div>
        </div>

        <ReportEmailComposer
          clientId={activeReport.clientId || null}
          from={activeReport.from}
          to={activeReport.to}
          title={activeReport.title}
        />

        {renderReportBody()}

        {false && (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Total Spend", value: formatCurrency(totalSpend), icon: <DollarSign size={16} />, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Conversion Value", value: formatCurrency(totalRevenue), icon: <TrendingUp size={16} />, color: "text-pink-600", bg: "bg-pink-50" },
            { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: <Sparkles size={16} />, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Conversions", value: totalConversions.toLocaleString(), icon: <Target size={16} />, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Leads", value: totalLeads.toLocaleString(), icon: <Target size={16} />, color: "text-cyan-600", bg: "bg-cyan-50" },
            { label: "CTR", value: `${ctr.toFixed(2)}%`, icon: <MousePointerClick size={16} />, color: "text-sky-600", bg: "bg-sky-50" },
            { label: "Avg CPC", value: formatCurrency(avgCPC), icon: <FileBarChart size={16} />, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Avg CPL", value: formatCurrency(avgCPL), icon: <FileBarChart size={16} />, color: "text-rose-600", bg: "bg-rose-50" },
          ].map(metric => (
            <div key={metric.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-indigo-100 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${metric.bg} ${metric.color}`}>{metric.icon}</div>
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{metric.label}</span>
              </div>
              <span className="text-slate-900 font-bold text-2xl break-words">{metric.value}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-slate-800 font-semibold text-sm">Performance Funnel</h2>
            <span className="text-slate-400 text-xs font-semibold">Click-to-lead {leadRate.toFixed(2)}% - Click-to-conversion {conversionRate.toFixed(2)}%</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { label: "Impressions", value: totalImpressions, sub: `${formatCurrency(avgCpm)} CPM` },
              { label: "Clicks", value: totalClicks, sub: `${ctr.toFixed(2)}% CTR` },
              { label: "Leads", value: totalLeads, sub: `${formatCurrency(avgCPL)} CPL` },
              { label: "Conversions", value: totalConversions, sub: `${roas.toFixed(2)}x ROAS` },
            ].map((step, index) => (
              <div key={step.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{step.label}</span>
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
                </div>
                <p className="text-slate-900 text-xl font-bold mt-2">{step.value.toLocaleString()}</p>
                <p className="text-slate-500 text-xs font-semibold mt-1">{step.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Spend vs ROAS by Platform</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={platformMetrics} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#059669" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}x`} />
                  <Tooltip
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                    formatter={(val: number, name: string) => name === "Spend" ? [formatCurrency(val), name] : [`${Number(val).toFixed(2)}x`, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Revenue vs Spend by Platform</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                  <Bar dataKey="revenue" name="Conversion Value" fill="#EC4899" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Leads & Conversions by Platform</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformMetrics} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                  <Bar dataKey="leads" name="Leads" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="conversions" name="Conversions" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">CTR / CPC Efficiency by Platform</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={platformMetrics} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `${Number(value).toFixed(1)}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#BE123C" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Number(value).toFixed(2)}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }}
                    formatter={(val: number, name: string) => name === "CPC" ? [formatCurrency(val), name] : [`${Number(val).toFixed(2)}%`, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                  <Bar yAxisId="left" dataKey="ctr" name="CTR" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="right" type="monotone" dataKey="cpc" name="CPC" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Spend Distribution</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformMetrics} dataKey="spend" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {platformMetrics.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Top Campaigns by Spend</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCampaigns} layout="vertical" margin={{ top: 5, right: 20, left: 18, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={value => `$${Math.round(Number(value) / 1000)}k`} />
                  <YAxis type="category" dataKey="campaign" width={120} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} formatter={(val: number) => formatCurrency(val)} />
                  <Bar dataKey="spend" name="Spend" fill="#6366F1" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {platformMetrics.map((platform, index) => (
            <div key={platform.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <h3 className="text-slate-800 text-sm font-bold">{platform.name}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                  {platform.spendShare.toFixed(1)}% spend
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">ROAS</p>
                  <p className="text-slate-900 font-bold mt-0.5">{platform.roas.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">CPL</p>
                  <p className="text-slate-900 font-bold mt-0.5">{formatCurrency(platform.cpl)}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">CTR</p>
                  <p className="text-slate-900 font-bold mt-0.5">{platform.ctr.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Conv. Rate</p>
                  <p className="text-slate-900 font-bold mt-0.5">{platform.conversionRate.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-slate-800 font-semibold text-sm">Campaign Performance Detail</h2>
            <span className="text-slate-400 text-xs font-semibold">{activeReport.rowCount} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Platform", "Campaign Name", "Status", "Spend", "Revenue", "ROAS", "Impressions", "Clicks", "CTR", "Leads", "Conversions", "Conv. Rate", "CPL"].map(header => (
                    <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-5 py-8 text-center text-slate-500 text-sm">No campaign data available for this period.</td>
                  </tr>
                ) : (
                  campaignMetrics.map((row, index) => (
                    <tr key={`${row.platform}-${row.campaign}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {row.platform}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900 truncate max-w-[260px]" title={row.campaign}>{row.campaign}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${row.status === "active" ? "bg-emerald-500" : row.status === "paused" ? "bg-amber-500" : "bg-slate-400"}`} />
                          <span className="text-xs font-medium text-slate-600 capitalize">{row.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.spend)}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-pink-600">{formatCurrency(row.revenue)}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{row.roas.toFixed(2)}x</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{row.impressions.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{row.clicks.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{row.ctr.toFixed(2)}%</td>
                      <td className="px-5 py-3 text-sm font-medium text-indigo-600">{row.leads.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm font-medium text-purple-600">{row.conversions.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{row.conversionRate.toFixed(2)}%</td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{formatCurrency(row.cpl)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" style={{ background: "#FAFAFA" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 font-bold tracking-tight text-3xl" style={{ fontSize: 24 }}>Reports</h1>
          <p className="text-slate-400 text-xs font-medium mt-1">Generate report packages from live CRM metrics and download them from the feed.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold">
          <CheckCircle2 size={13} />
          Live data
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-700 text-xs font-semibold">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_380px] gap-6">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEMPLATES.map(template => (
              <div
                key={template.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md hover:border-slate-200 transition-all duration-200"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50/70 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100/30">
                    <FileBarChart size={18} />
                  </div>
                  <h3 className="text-slate-800 font-bold text-[14px] leading-tight mb-2">{template.title}</h3>
                  <p className="text-slate-400 text-xs leading-normal font-medium mb-6">{template.description}</p>
                </div>

                <button
                  onClick={() => handleGenerateReport(template.id, template.title, template.description)}
                  className="text-indigo-600 font-bold text-xs leading-none hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none p-0 text-left"
                >
                  Generate report
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-slate-800 font-bold text-[14px] leading-tight flex items-center gap-1.5">
                <Table2 size={15} className="text-indigo-500" />
                Custom Report Builder
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Downloadable feed</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] items-end gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Client</label>
                <select
                  value={selectedClient}
                  onChange={event => setSelectedClient(event.target.value)}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
                  style={{ fontSize: 13, height: 42 }}
                >
                  <option value="">All Clients</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Date Range</label>
                <select
                  value={selectedDateRange}
                  onChange={event => setSelectedDateRange(event.target.value)}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
                  style={{ fontSize: 13, height: 42 }}
                >
                  {DATE_RANGE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Format</label>
                <select
                  value={selectedFormat}
                  onChange={event => setSelectedFormat(event.target.value as ReportFormat)}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
                  style={{ fontSize: 13, height: 42 }}
                >
                  {FORMAT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleGenerateReport("custom", "Custom Performance Report", `Generated custom ${selectedFormat} report for selected configurations.`)}
                className="flex items-center justify-center gap-1.5 rounded-xl px-5 text-white font-bold cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all duration-100"
                style={{ background: "#5850EC", fontSize: 13, height: 42 }}
              >
                <Download size={14} />
                Generate
              </button>
            </div>

            <ReportEmailComposer
              clientId={selectedClient || null}
              from={selectedBuilderRange.from}
              to={selectedBuilderRange.to}
              title="Custom Performance Report"
              compact
            />
          </div>
        </div>

        <aside className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-slate-800 font-bold text-[14px]">Generated Report Feed</h3>
              <p className="text-slate-400 text-xs mt-0.5">Download or reopen recent report exports.</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BarChart3 size={17} />
            </div>
          </div>

          <div className="p-3 flex flex-col gap-3">
            {generatedReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
                <FileText size={22} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 text-xs font-bold">No reports generated yet</p>
                <p className="text-slate-400 text-xs mt-1">Generated reports will appear here as downloadable feed items.</p>
              </div>
            ) : (
              generatedReports.map(report => (
                <div key={report.id} className="rounded-xl border border-slate-100 bg-white p-4 hover:border-indigo-100 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {report.downloadFormat}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Ready
                        </span>
                      </div>
                      <p className="text-slate-900 text-xs font-bold truncate">{report.title}</p>
                      <p className="text-slate-400 text-[11px] font-medium mt-1 truncate">
                        {report.clientName} - {report.dateRangeLabel}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                        <Clock3 size={11} />
                        {new Date(report.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <span>-</span>
                        {report.rowCount} rows
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => openReport(report)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleDownloadReport(report)}
                      className="rounded-lg px-3 py-2 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
                      style={{ background: "#6366F1" }}
                    >
                      {downloadingId === report.id ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                      Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
