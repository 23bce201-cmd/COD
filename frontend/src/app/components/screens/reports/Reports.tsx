import React, { useState, useEffect } from "react";
import { 
  Download, FileBarChart, Filter, RefreshCw, BarChart2, 
  TrendingUp, DollarSign, Target, FileText, ChevronLeft,
  Calendar, Layers, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area
} from "recharts";
import { useAuth } from "../../../context/AuthContext";

interface AnalyticsRow {
  platform: string;
  campaign_name: string;
  status: string;
  total_spend: string | number;
  total_impressions: string | number;
  total_clicks: string | number;
  total_leads: string | number;
  ctr: string;
  cpl: string;
  cpc: string;
}

export function Reports() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  
  // Custom builder states
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("30");
  const [selectedFormat, setSelectedFormat] = useState("PDF");

  // Active generated report state
  const [activeReport, setActiveReport] = useState<{
    type: string;
    title: string;
    description: string;
    clientName: string;
    dateRangeLabel: string;
    format: string;
  } | null>(null);

  // Load clients
  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch("/api/clients");
        if (res.ok) {
          const cData = await res.json();
          setClients(cData.clients || []);
        }
      } catch (err) {
        console.error("Failed to load clients");
      }
    }
    init();
  }, [apiFetch]);

  // Handle report generation
  async function handleGenerateReport(
    type: string, 
    title: string, 
    description: string, 
    cId?: string, 
    days?: string,
    format?: string
  ) {
    setLoading(true);
    const resolvedClientId = cId !== undefined ? cId : selectedClient;
    const resolvedDays = days || selectedDateRange;
    const resolvedFormat = format || selectedFormat;

    const clientObj = clients.find(c => c.id === resolvedClientId);
    const clientLabel = clientObj ? clientObj.name : "All Clients";
    
    let rangeLabel = "Last 30 Days";
    if (resolvedDays === "7") rangeLabel = "Last 7 Days";
    else if (resolvedDays === "90") rangeLabel = "Last 90 Days";
    else if (resolvedDays === "365") rangeLabel = "Year to Date";

    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(resolvedDays));
      
      const from = start.toISOString().split('T')[0];
      const to = end.toISOString().split('T')[0];
      
      let url = `/api/reports/analytics?from=${from}&to=${to}`;
      if (resolvedClientId) url += `&client_id=${resolvedClientId}`;
      
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setActiveReport({
          type,
          title,
          description,
          clientName: clientLabel,
          dateRangeLabel: rangeLabel,
          format: resolvedFormat
        });
      }
    } catch (e) {
      console.error("Error generating report", e);
    } finally {
      // Small simulated delay for premium UX feel
      setTimeout(() => {
        setLoading(false);
      }, 600);
    }
  }

  // Aggregate by platform for charts
  const platformAgg = data.reduce((acc, row) => {
    if (!acc[row.platform]) {
      acc[row.platform] = { name: row.platform, spend: 0, leads: 0, clicks: 0, impressions: 0 };
    }
    acc[row.platform].spend += Number(row.total_spend) || 0;
    acc[row.platform].leads += Number(row.total_leads) || 0;
    acc[row.platform].clicks += Number(row.total_clicks) || 0;
    acc[row.platform].impressions += Number(row.total_impressions) || 0;
    return acc;
  }, {} as Record<string, any>);
  
  const chartData = Object.values(platformAgg);

  const totalSpend = chartData.reduce((sum, p) => sum + p.spend, 0);
  const totalLeads = chartData.reduce((sum, p) => sum + p.leads, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const totalImpressions = chartData.reduce((sum, p) => sum + p.impressions, 0);
  const totalClicks = chartData.reduce((sum, p) => sum + p.clicks, 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Report templates from the screenshot
  const TEMPLATES = [
    {
      id: "performance",
      title: "Performance Report",
      description: "Spend, ROAS, CTR per client",
      icon: <FileBarChart size={18} className="text-indigo-500" />
    },
    {
      id: "lead_gen",
      title: "Lead Gen Summary",
      description: "Leads, CPL, conversion rate",
      icon: <FileBarChart size={18} className="text-indigo-500" />
    },
    {
      id: "platform",
      title: "Platform Breakdown",
      description: "Google vs Meta vs Mailchimp",
      icon: <FileBarChart size={18} className="text-indigo-500" />
    },
    {
      id: "monthly",
      title: "Monthly Overview",
      description: "Full agency rollup report",
      icon: <FileBarChart size={18} className="text-indigo-500" />
    }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-500 min-h-[60vh] bg-slate-50/50 rounded-2xl border border-slate-100">
        <RefreshCw size={36} className="animate-spin text-indigo-600 mb-4" />
        <span className="font-semibold text-lg text-slate-800 animate-pulse">Assembling Report Data...</span>
        <span className="text-slate-400 text-xs mt-1">Aggregating platform metrics & performance benchmarks</span>
      </div>
    );
  }

  // If a report is active, show the stunning report results!
  if (activeReport) {
    return (
      <div className="flex flex-col gap-6">
        {/* Back and Title Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveReport(null)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700">
                  {activeReport.format} format
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-500 text-xs font-medium">{activeReport.dateRangeLabel}</span>
              </div>
              <h1 className="text-slate-900 font-bold text-xl mt-0.5">{activeReport.title}</h1>
            </div>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity shadow-sm" 
            style={{ background: "#6366F1", fontSize: 12 }}
          >
            <Download size={14} /> Export Report
          </button>
        </div>

        {/* Info Header */}
        <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-2xl p-5 border border-indigo-100/50 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-indigo-950 font-bold text-sm flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              Generated Report: {activeReport.clientName}
            </h3>
            <p className="text-indigo-800 text-xs mt-1">{activeReport.description}</p>
          </div>
          <div className="text-right text-slate-500 text-xs font-semibold">
            Generated on: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Aggregated KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md"><DollarSign size={16} /></div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Total Ad Spend</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl">${totalSpend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md"><Target size={16} /></div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Total Leads</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl">{totalLeads.toLocaleString()}</span>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md"><TrendingUp size={16} /></div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Average CPL</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl">${avgCPL.toFixed(2)}</span>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded-md"><FileBarChart size={16} /></div>
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Blended CTR</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl">{ctr.toFixed(2)}%</span>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Chart: Spend vs Leads */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">Spend vs Leads by Platform</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#F8FAFC'}} 
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number, name: string) => name === 'Spend' ? [`$${val.toFixed(2)}`, name] : [val, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#64748B" }} />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar yAxisId="right" dataKey="leads" name="Leads" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart: Platform Breakdown */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col h-80">
            <h2 className="text-slate-800 font-semibold text-sm mb-4">CPL Efficiency Platform Breakdown</h2>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#F8FAFC'}} 
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(val: number) => [`$${val.toFixed(2)}`, 'CPL']}
                  />
                  <Bar dataKey={(d) => d.leads > 0 ? (d.spend / d.leads) : 0} name="CPL" fill="#8B5CF6" radius={[0, 4, 4, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-slate-800 font-semibold text-sm">Campaign Performance Detail</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Platform", "Campaign Name", "Status", "Spend", "Impressions", "Clicks", "CTR", "Leads", "CPL"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-500 text-sm">No campaign data available for this period.</td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {row.platform.replace('_ads', '')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900 truncate max-w-[200px]" title={row.campaign_name}>{row.campaign_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'active' ? 'bg-emerald-500' : row.status === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                          <span className="text-xs font-medium text-slate-600 capitalize">{row.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-slate-900">${Number(row.total_spend).toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{Number(row.total_impressions).toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{Number(row.total_clicks).toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{row.ctr}</td>
                      <td className="px-5 py-3 text-sm font-medium text-indigo-600">{Number(row.total_leads).toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-600">${row.cpl}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // MOCKUP LANDING VIEW MATCHING THE SCREENSHOT EXACTLY
  return (
    <div className="flex flex-col gap-6" style={{ background: "#FAFAFA" }}>
      {/* Page Title */}
      <div>
        <h1 className="text-slate-900 font-bold tracking-tight text-3xl" style={{ fontSize: 24 }}>Reports</h1>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-2 gap-6">
        {TEMPLATES.map((t) => (
          <div 
            key={t.id} 
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md hover:border-slate-200 transition-all duration-200"
          >
            <div>
              {/* File Icon Block */}
              <div className="w-10 h-10 rounded-xl bg-indigo-50/70 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100/30">
                {t.icon}
              </div>
              <h3 className="text-slate-800 font-bold text-[14px] leading-tight mb-2">{t.title}</h3>
              <p className="text-slate-400 text-xs leading-normal font-medium mb-6">{t.description}</p>
            </div>
            
            <button
              onClick={() => handleGenerateReport(t.id, t.title, t.description)}
              className="text-indigo-600 font-bold text-xs leading-none hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none p-0 text-left"
            >
              Generate →
            </button>
          </div>
        ))}
      </div>

      {/* Custom Report Builder Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mt-2 flex flex-col gap-5">
        <h3 className="text-slate-800 font-bold text-[14px] leading-tight flex items-center gap-1.5">
          Custom Report Builder
        </h3>
        
        {/* Builder Form Fields */}
        <div className="flex items-end gap-5">
          {/* Client select */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Client</label>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
              style={{ fontSize: 13, height: 42 }}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date range select */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Date Range</label>
            <select
              value={selectedDateRange}
              onChange={e => setSelectedDateRange(e.target.value)}
              className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
              style={{ fontSize: 13, height: 42 }}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Year to Date</option>
            </select>
          </div>

          {/* Format select */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Format</label>
            <select
              value={selectedFormat}
              onChange={e => setSelectedFormat(e.target.value)}
              className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors cursor-pointer"
              style={{ fontSize: 13, height: 42 }}
            >
              <option value="PDF">PDF Document</option>
              <option value="CSV">CSV Spreadsheet</option>
              <option value="Excel">Excel Spreadsheet</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => handleGenerateReport("custom", "Custom Performance Report", `Generated custom ${selectedFormat} report for selected configurations.`, selectedClient, selectedDateRange, selectedFormat)}
            className="flex items-center justify-center gap-1.5 rounded-xl px-5 text-white font-bold cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all duration-100 flex-shrink-0"
            style={{ background: "#5850EC", fontSize: 13, height: 42 }}
          >
            <Download size={14} /> Generate
          </button>
        </div>
      </div>
    </div>
  );
}
