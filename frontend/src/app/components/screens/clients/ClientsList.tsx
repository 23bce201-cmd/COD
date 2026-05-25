import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, MoreHorizontal } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { StatusBadge, fmtK } from "../overview/Overview";

export function ClientsD({ search }: { search: string }) {
  const navigate = useNavigate();
  const { apiFetch, user } = useAuth();
  const canAddClient = user?.role === "admin";
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/clients").then(res => res.json()).then(data => setClients(data.clients || []));
  }, [apiFetch]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry || '').toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Clients</h1>
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
      <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              {["Client", "Industry", "Monthly Budget", "Leads", "Campaigns", "ROAS", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const spend = parseFloat(c.total_spend || '0');
              const revenue = parseFloat(c.total_revenue || '0');
              const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
              const leads = parseInt(c.total_leads || '0');
              
              return (
                <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#6366F1", fontSize: 10 }}>{c.name.substring(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500" style={{ fontSize: 12 }}>{c.industry || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-800 font-semibold" style={{ fontSize: 12 }}>{fmtK(c.monthly_budget || 0)}/mo</td>
                  <td className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{leads.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{c.campaign_count || 0}</td>
                  <td className="px-4 py-3 text-slate-800" style={{ fontSize: 12 }}>{roas}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.onboarding_status === 'active' ? 'Active' : 'Setup'} /></td>
                  <td className="px-4 py-3 text-right text-slate-400 hover:text-indigo-600">
                    <MoreHorizontal size={14} className="ml-auto" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-400" style={{ fontSize: 13 }}>No clients match your search.</div>
        )}
      </div>
    </div>
  );
}

export function ClientsM({ search }: { search: string }) {
  const navigate = useNavigate();
  const { apiFetch, user } = useAuth();
  const canAddClient = user?.role === "admin";
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/clients").then(res => res.json()).then(data => setClients(data.clients || []));
  }, [apiFetch]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.industry || '').toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-800 font-bold" style={{ fontSize: 15 }}>Clients</p>
        {canAddClient && (
          <button
            onClick={() => navigate("/agency/add-client")}
            className="rounded-lg px-2.5 py-1.5 text-white font-semibold flex items-center gap-1 cursor-pointer hover:bg-indigo-600"
            style={{ background: "#6366F1", fontSize: 11 }}
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      {filtered.map((c) => {
        const spend = parseFloat(c.total_spend || '0');
        const revenue = parseFloat(c.total_revenue || '0');
        const roas = spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '0.00x';
        const leads = parseInt(c.total_leads || '0');

        return (
          <div key={c.id} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#6366F1", fontSize: 10 }}>{c.name.substring(0, 2).toUpperCase()}</div>
                <p className="text-slate-800 font-semibold" style={{ fontSize: 12 }}>{c.name}</p>
              </div>
              <StatusBadge status={c.onboarding_status === 'active' ? 'Active' : 'Setup'} />
            </div>
            <div className="grid grid-cols-3 gap-2">
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
        <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No clients found.</p>
      )}
    </div>
  );
}
