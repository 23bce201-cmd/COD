import { useState, useEffect, useMemo } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { StatusBadge } from "../overview/Overview";
import { PlatformBadge } from "../campaigns/Campaigns";

const icons: Record<string, React.ReactNode> = {
  Synced: <CheckCircle2 size={14} style={{ color: "#10B981" }} />,
  Warning: <AlertTriangle size={14} style={{ color: "#F59E0B" }} />,
  Error: <XCircle size={14} style={{ color: "#F43F5E" }} />,
};

const iconsM: Record<string, React.ReactNode> = {
  Synced: <CheckCircle2 size={12} style={{ color: "#10B981" }} />,
  Warning: <AlertTriangle size={12} style={{ color: "#F59E0B" }} />,
  Error: <XCircle size={12} style={{ color: "#F43F5E" }} />,
};

const formatPlatform = (p: string) => {
  return p === 'google_ads' ? 'Google Ads' :
         p === 'meta_ads' ? 'Meta Ads' :
         p === 'linkedin_ads' ? 'LinkedIn Ads' :
         p === 'twitter_ads' ? 'Twitter Ads' :
         'Mailchimp';
};

export function SyncStatusD() {
  const { apiFetch, user } = useAuth();
  const [syncRows, setSyncRows] = useState<any[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "client" | "platform">("none");

  useEffect(() => {
    apiFetch("/api/sync/all-logs", { cache: "no-store" }).then(res => res.json()).then(data => setSyncRows(data.logs || []));
  }, [apiFetch]);

  async function handleSync(clientId: string, platform?: string) {
    const key = platform ? `${clientId}-${platform}` : clientId;
    if (!clientId || syncingIds.has(key)) return;
    setSyncingIds(prev => new Set(prev).add(key));
    try {
      const routePlat = platform ? platform.replace('_ads', '').replace('linkedin', 'linkedin').replace('twitter', 'twitter') : 'all';
      await apiFetch(`/api/sync/${clientId}/${routePlat}`, { method: "POST" });
      const res = await apiFetch("/api/sync/all-logs", { cache: "no-store" });
      const data = await res.json();
      setSyncRows(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSyncAll() {
    try {
      if (user?.role === "client") {
        if (user.client_id) handleSync(user.client_id);
        return;
      }
      const res = await apiFetch("/api/clients");
      const data = await res.json();
      (data.clients || []).forEach((c: any) => handleSync(c.id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSyncGroup(groupKey: string, rows: any[]) {
    if (groupBy === "client") {
      handleSync(rows[0].client_id);
    } else if (groupBy === "platform") {
      const clientsToSync = Array.from(new Set(rows.map(r => r.client_id)));
      clientsToSync.forEach(cid => handleSync(cid, groupKey));
    }
  }

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "All": syncRows };
    const g: Record<string, any[]> = {};
    syncRows.forEach(r => {
      const k = groupBy === "client" ? r.client_name : r.platform;
      if (!g[k]) g[k] = [];
      g[k].push(r);
    });
    return g;
  }, [syncRows, groupBy]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Sync Status</h1>
        <div className="flex items-center gap-2">
          {user?.role !== "client" && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white font-medium outline-none hover:border-indigo-400 transition-colors cursor-pointer"
              style={{ fontSize: 12 }}
            >
              <option value="none">Group: None</option>
              <option value="client">Group: Client</option>
              <option value="platform">Group: Platform</option>
            </select>
          )}
          <button 
            onClick={handleSyncAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold border border-slate-200 bg-white text-slate-700 hover:border-indigo-400 transition-colors cursor-pointer" 
            style={{ fontSize: 12 }}
          >
            <RefreshCw size={12} /> Sync All
          </button>
        </div>
      </div>
      
      {Object.entries(grouped).map(([gKey, rows]) => (
        <div key={gKey} className="flex flex-col gap-2">
          {groupBy !== "none" && (
            <div className="flex items-center justify-between px-1 mt-2">
              <h3 className="font-semibold text-slate-800" style={{ fontSize: 14 }}>
                {groupBy === "platform" ? formatPlatform(gKey) : gKey}
              </h3>
              <button 
                onClick={() => handleSyncGroup(gKey, rows)}
                className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                style={{ fontSize: 12 }}
              >
                Sync {groupBy === "client" ? "Client" : "Platform"}
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl" style={{ border: "1px solid #E2E8F0" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Platform", "Client", "Last Synced", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><PlatformBadge platform={formatPlatform(r.platform)} /></td>
                    <td className="px-4 py-3 text-slate-700 font-medium" style={{ fontSize: 12 }}>{r.client_name}</td>
                    <td className="px-4 py-3 text-slate-500" style={{ fontSize: 12 }}>{new Date(r.synced_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.status === 'success' ? icons.Synced : r.status === 'failed' ? icons.Error : icons.Warning}
                        <StatusBadge status={r.status === 'success' ? 'Synced' : r.status === 'failed' ? 'Error' : 'Warning'} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleSync(r.client_id, r.platform)}
                        disabled={syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)}
                        className="border border-slate-200 rounded-md px-2.5 py-1 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1" 
                        style={{ fontSize: 11 }}
                      >
                        <RefreshCw size={10} className={(syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)) ? "animate-spin" : ""} />
                        {(syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)) ? "Syncing..." : "Sync now"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-slate-400" style={{ fontSize: 11 }}>Data syncs automatically every 15 minutes. Last full sync: 2 mins ago.</p>
    </div>
  );
}

export function SyncStatusM() {
  const { apiFetch, user } = useAuth();
  const [syncRows, setSyncRows] = useState<any[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "client" | "platform">("none");

  useEffect(() => {
    apiFetch("/api/sync/all-logs", { cache: "no-store" }).then(res => res.json()).then(data => setSyncRows(data.logs || []));
  }, [apiFetch]);

  async function handleSync(clientId: string, platform?: string) {
    const key = platform ? `${clientId}-${platform}` : clientId;
    if (!clientId || syncingIds.has(key)) return;
    setSyncingIds(prev => new Set(prev).add(key));
    try {
      const routePlat = platform ? platform.replace('_ads', '').replace('linkedin', 'linkedin').replace('twitter', 'twitter') : 'all';
      await apiFetch(`/api/sync/${clientId}/${routePlat}`, { method: "POST" });
      const res = await apiFetch("/api/sync/all-logs", { cache: "no-store" });
      const data = await res.json();
      setSyncRows(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSyncAll() {
    try {
      if (user?.role === "client") {
        if (user.client_id) handleSync(user.client_id);
        return;
      }
      const res = await apiFetch("/api/clients");
      const data = await res.json();
      (data.clients || []).forEach((c: any) => handleSync(c.id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSyncGroup(groupKey: string, rows: any[]) {
    if (groupBy === "client") {
      handleSync(rows[0].client_id);
    } else if (groupBy === "platform") {
      const clientsToSync = Array.from(new Set(rows.map(r => r.client_id)));
      clientsToSync.forEach(cid => handleSync(cid, groupKey));
    }
  }

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "All": syncRows };
    const g: Record<string, any[]> = {};
    syncRows.forEach(r => {
      const k = groupBy === "client" ? r.client_name : r.platform;
      if (!g[k]) g[k] = [];
      g[k].push(r);
    });
    return g;
  }, [syncRows, groupBy]);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-800 font-bold" style={{ fontSize: 15 }}>Sync Status</p>
        <button 
          onClick={handleSyncAll}
          className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 cursor-pointer hover:border-indigo-400 transition-colors bg-white" 
          style={{ fontSize: 11 }}
        >
          <RefreshCw size={11} /> Sync All
        </button>
      </div>

      {user?.role !== "client" && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-500 font-medium" style={{ fontSize: 11 }}>Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 bg-white font-medium outline-none cursor-pointer flex-1"
            style={{ fontSize: 12 }}
          >
            <option value="none">None</option>
            <option value="client">Client</option>
            <option value="platform">Platform</option>
          </select>
        </div>
      )}

      {Object.entries(grouped).map(([gKey, rows]) => (
        <div key={gKey} className="flex flex-col gap-2">
          {groupBy !== "none" && (
            <div className="flex items-center justify-between mt-2 px-1">
              <h3 className="font-semibold text-slate-800" style={{ fontSize: 13 }}>
                {groupBy === "platform" ? formatPlatform(gKey) : gKey}
              </h3>
              <button 
                onClick={() => handleSyncGroup(gKey, rows)}
                className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                style={{ fontSize: 11 }}
              >
                Sync {groupBy === "client" ? "Client" : "Platform"}
              </button>
            </div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
              <div className="flex items-center justify-between mb-1">
                <PlatformBadge platform={formatPlatform(r.platform)} />
                <div className="flex items-center gap-1">
                  {r.status === 'success' ? iconsM.Synced : r.status === 'failed' ? iconsM.Error : iconsM.Warning}
                  <StatusBadge status={r.status === 'success' ? 'Synced' : r.status === 'failed' ? 'Error' : 'Warning'} />
                </div>
              </div>
              <p className="text-slate-500" style={{ fontSize: 11 }}>{r.client_name}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-slate-400" style={{ fontSize: 10 }}>Last synced {new Date(r.synced_at).toLocaleTimeString()}</p>
                <button 
                  onClick={() => handleSync(r.client_id, r.platform)}
                  disabled={syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)}
                  className="border border-slate-200 rounded px-2 py-0.5 text-slate-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 hover:border-indigo-400 hover:text-indigo-600 transition-colors" 
                  style={{ fontSize: 10 }}
                >
                  <RefreshCw size={10} className={(syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)) ? "animate-spin" : ""} />
                  {(syncingIds.has(`${r.client_id}-${r.platform}`) || syncingIds.has(r.client_id)) ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
