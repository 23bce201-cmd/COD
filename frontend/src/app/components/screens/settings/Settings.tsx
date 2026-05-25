import { Plus } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

export function SettingsD() {
  const { user, logout } = useAuth();
  
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Settings</h1>
      <div className="flex gap-4">
        {/* Agency info */}
        <div className="bg-white rounded-xl p-5 flex flex-col gap-4 flex-1" style={{ border: "1px solid #E2E8F0" }}>
          <h2 className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Profile</h2>
          {[
            { label: "Name", value: user?.name || "User" },
            { label: "Email", value: user?.email || "" },
            { label: "Role", value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Unknown" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">{f.label}</label>
              <input readOnly defaultValue={f.value} className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-slate-50 outline-none" style={{ fontSize: 12 }} />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Timezone</label>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white" style={{ fontSize: 12 }}>
              <option>UTC+10 — Sydney, Australia</option>
            </select>
          </div>
          <button className="rounded-lg px-4 py-2 text-white font-semibold w-full mt-2 cursor-pointer hover:bg-indigo-600 transition-colors" style={{ background: "#6366F1", fontSize: 12 }}>
            Save Changes
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl p-5 flex flex-col gap-4 flex-1" style={{ border: "1px solid #E2E8F0" }}>
          <div>
            <h2 className="text-slate-800 font-semibold mb-3" style={{ fontSize: 13 }}>Notifications</h2>
            {["Email alerts for sync errors", "Weekly performance digest", "Client report reminders", "Budget threshold alerts"].map((n, i) => (
              <label key={i} className="flex items-center justify-between py-2 border-b border-slate-50 cursor-pointer">
                <span className="text-slate-600" style={{ fontSize: 12 }}>{n}</span>
                <input type="checkbox" defaultChecked={i < 3} className="rounded accent-indigo-600 cursor-pointer" />
              </label>
            ))}
          </div>
          
          <div className="mt-auto pt-4">
             <button
              onClick={logout}
              className="w-full rounded-xl py-2 border border-rose-200 text-rose-600 font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-50 transition-colors"
              style={{ fontSize: 13 }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsM({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-slate-800 font-bold" style={{ fontSize: 15 }}>Settings</p>
      <div className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E8F0" }}>
        <p className="text-slate-700 font-semibold mb-3" style={{ fontSize: 12 }}>Profile</p>
        {([["Name", user?.name || "User"], ["Email", user?.email || ""], ["Role", user?.role || ""]] as [string, string][]).map(([l, v]) => (
          <div key={l} className="flex flex-col gap-1 mb-2">
            <label className="text-slate-400" style={{ fontSize: 10 }}>{l}</label>
            <input readOnly defaultValue={v} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-slate-50 outline-none" style={{ fontSize: 11 }} />
          </div>
        ))}
        <button className="w-full rounded-lg py-2 text-white font-semibold mt-1" style={{ background: "#6366F1", fontSize: 12 }}>Save</button>
      </div>
      
      <button
        onClick={onLogout}
        className="w-full rounded-xl py-3 border border-slate-200 text-slate-600 font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors mt-4"
        style={{ fontSize: 13 }}
      >
        Sign Out
      </button>
    </div>
  );
}
