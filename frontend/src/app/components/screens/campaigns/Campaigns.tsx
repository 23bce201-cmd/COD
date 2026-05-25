import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, Download, MoreHorizontal } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { StatusBadge, fmtK } from "../overview/Overview";

export function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Google Ads": { bg: "#EEF2FF", color: "#4338CA" },
    "Meta Ads": { bg: "#FDF2F8", color: "#9D174D" },
    "Mailchimp": { bg: "#FFFBEB", color: "#92400E" },
    "LinkedIn Ads": { bg: "#F0F9FF", color: "#0369A1" },
    "Twitter Ads": { bg: "#F0FDFA", color: "#0F766E" }
  };
  const s = map[platform] || { bg: "#F1F5F9", color: "#475569" };
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 font-medium" style={{ background: s.bg, color: s.color, fontSize: 11 }}>
      {platform}
    </span>
  );
}

export function CampaignsD({ search }: { search: string }) {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/campaigns").then(res => res.json()).then(data => setCampaigns(data.campaigns || []));
  }, [apiFetch]);

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group campaigns by client name
  const grouped = filtered.reduce((acc: Record<string, any[]>, c) => {
    const clientName = c.client_name || "Other Clients";
    if (!acc[clientName]) acc[clientName] = [];
    acc[clientName].push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Campaigns</h1>
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors" style={{ background: "#6366F1", fontSize: 12 }}>
          <Plus size={13} /> New Campaign
        </button>
      </div>
      <div className="flex items-center gap-2 mb-2">
        {["All Clients ▾", "Platform ▾", "Status ▾", "Date ▾"].map((f) => (
          <button key={f} className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white hover:border-indigo-400 transition-colors cursor-pointer" style={{ fontSize: 11 }}>{f}</button>
        ))}
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white cursor-pointer hover:border-slate-300 transition-colors" style={{ fontSize: 11 }}>
          <Download size={11} /> Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-200" style={{ fontSize: 13 }}>
          No campaigns match your search.
        </div>
      ) : (
        Object.entries(grouped).map(([clientName, clientCampaigns]) => (
          <div key={clientName} className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-3 bg-indigo-500 rounded-full" />
              <span className="text-slate-800 font-bold tracking-wide text-xs uppercase">{clientName}</span>
              <span className="text-slate-400 text-xs font-semibold">({clientCampaigns.length} campaigns)</span>
            </div>
            
            <div className="bg-white rounded-xl overflow-hidden shadow-sm" style={{ border: "1px solid #E2E8F0" }}>
              <table className="w-full table-fixed">
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {[
                      { name: "Campaign", width: "35%" },
                      { name: "Platform", width: "15%" },
                      { name: "Spend", width: "12%" },
                      { name: "ROAS", width: "10%" },
                      { name: "Leads", width: "10%" },
                      { name: "Status", width: "12%" },
                      { name: "", width: "6%" },
                    ].map((h) => (
                      <th key={h.name} className="px-4 py-2.5 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11, width: h.width }}>{h.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientCampaigns.map((c) => {
                    const spend = parseFloat(c.total_spend || '0');
                    const revenue = parseFloat(c.total_revenue || '0');
                    const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
                    const leads = parseInt(c.total_leads || '0');
                    
                    return (
                      <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-800 font-medium truncate" style={{ fontSize: 12 }} title={c.name}>{c.name}</td>
                        <td className="px-4 py-3">
                          <PlatformBadge platform={
                            c.platform === 'google_ads' ? 'Google Ads' :
                            c.platform === 'meta_ads' ? 'Meta Ads' :
                            c.platform === 'linkedin_ads' ? 'LinkedIn Ads' :
                            c.platform === 'twitter_ads' ? 'Twitter Ads' :
                            'Mailchimp'
                          } />
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtK(spend)}</td>
                        <td className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{roas}</td>
                        <td className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{leads.toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status === 'active' ? 'Active' : c.status === 'paused' ? 'Paused' : 'Completed'} /></td>
                        <td className="px-4 py-3"><button className="text-slate-400 hover:text-slate-600 cursor-pointer"><MoreHorizontal size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function CampaignsM({ search }: { search: string }) {
  const { apiFetch } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/campaigns").then(res => res.json()).then(data => setCampaigns(data.campaigns || []));
  }, [apiFetch]);

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.client_name || '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-slate-800 font-bold" style={{ fontSize: 15 }}>Campaigns</p>
      {filtered.map((c) => {
        const spend = parseFloat(c.total_spend || '0');
        const revenue = parseFloat(c.total_revenue || '0');
        const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
        const leads = parseInt(c.total_leads || '0');

        return (
          <div key={c.id} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
            <div className="flex items-start justify-between mb-1.5">
              <p className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{c.name}</p>
              <StatusBadge status={c.status === 'active' ? 'Active' : c.status === 'paused' ? 'Paused' : 'Completed'} />
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <PlatformBadge platform={
                c.platform === 'google_ads' ? 'Google Ads' :
                c.platform === 'meta_ads' ? 'Meta Ads' :
                c.platform === 'linkedin_ads' ? 'LinkedIn Ads' :
                c.platform === 'twitter_ads' ? 'Twitter Ads' :
                'Mailchimp'
              } />
              <span className="text-slate-400" style={{ fontSize: 11 }}>· {c.client_name}</span>
            </div>
            <div className="flex gap-4">
              {([["Spend", fmtK(spend)], ["ROAS", roas], ["Leads", leads.toLocaleString()]] as [string, string | number][]).map(([l, v]) => (
                <div key={l}>
                  <p className="text-slate-400" style={{ fontSize: 9 }}>{l}</p>
                  <p className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No campaigns found.</p>
      )}
    </div>
  );
}
