// Email hub — tabs for free-form compose and automated report PDF delivery.
import { useEffect, useState } from "react";
import { Mail, PenLine } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { ReportEmailComposer } from "../reports/ReportEmailComposer";
import { ComposeEmail } from "./ComposeEmail";

interface ClientOption {
  id: string;
  name: string;
}

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
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

type Tab = "compose" | "report";

export function EmailCenter() {
  const { apiFetch, user } = useAuth();
  const [tab, setTab] = useState<Tab>("compose");

  // Report tab state
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [days, setDays] = useState("30");
  const [title, setTitle] = useState("Performance Report");

  useEffect(() => {
    let mounted = true;
    async function loadClients() {
      try {
        const res = await apiFetch("/api/clients");
        if (!res.ok) return;
        const json = await res.json();
        const nextClients = json.clients || [];
        if (mounted) {
          setClients(nextClients);
          if (user?.role === "client" && nextClients[0]?.id) {
            setClientId(nextClients[0].id);
          }
        }
      } catch {
        if (mounted) setClients([]);
      }
    }
    loadClients();
    return () => { mounted = false; };
  }, [apiFetch, user?.role]);

  const range = getDateRange(days);

  return (
    <div className="flex flex-col gap-6" style={{ background: "#FAFAFA" }}>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 font-bold tracking-tight" style={{ fontSize: 24 }}>Email</h1>
          <p className="text-slate-400 text-xs font-medium mt-1">
            Compose emails or send automated client report PDFs via your Gmail account.
          </p>
        </div>
        <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
          <Mail size={18} />
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-100 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setTab("compose")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={
            tab === "compose"
              ? { background: "#4F46E5", color: "#fff" }
              : { color: "#64748b" }
          }
        >
          <PenLine size={13} />
          Compose
        </button>
        <button
          type="button"
          onClick={() => setTab("report")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={
            tab === "report"
              ? { background: "#4F46E5", color: "#fff" }
              : { color: "#64748b" }
          }
        >
          <Mail size={13} />
          Report Email
        </button>
      </div>

      {/* ── Compose tab ── */}
      {tab === "compose" && <ComposeEmail />}

      {/* ── Report Email tab ── */}
      {tab === "report" && (
        <>
          {/* Report filters */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Client</label>
                <select
                  value={clientId}
                  onChange={event => setClientId(event.target.value)}
                  disabled={user?.role === "client"}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors disabled:bg-slate-50"
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
                  value={days}
                  onChange={event => setDays(event.target.value)}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors"
                  style={{ fontSize: 13, height: 42 }}
                >
                  {DATE_RANGE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Template</label>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  className="w-full border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-slate-700 bg-white focus:border-indigo-400 outline-none transition-colors"
                  style={{ fontSize: 13, height: 42 }}
                />
              </div>
            </div>
          </div>

          <ReportEmailComposer
            clientId={clientId || null}
            from={range.from}
            to={range.to}
            title={title || "Performance Report"}
          />
        </>
      )}
    </div>
  );
}
