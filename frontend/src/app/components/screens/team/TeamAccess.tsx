import React, { useState, useEffect } from "react";
import { Plus, ShieldCheck, Trash2, Link as LinkIcon, CheckCircle2, Users } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

// Interface definitions
interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  display_role: string;
  is_active: boolean;
  manager_id: string | null;
  manager_name: string | null;
}

interface Client {
  id: string;
  name: string;
  industry: string;
}

interface Assignment {
  id: string;
  manager_id: string;
  client_id: string;
  client_name: string;
}

export function TeamAccess() {
  const { apiFetch } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({});
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMgrId, setExpandedMgrId] = useState<string | null>(null);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  
  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpRole, setNewEmpRole] = useState<"manager" | "employee">("employee");
  const [newEmpManagerId, setNewEmpManagerId] = useState<string>("");
  const [addingEmp, setAddingEmp] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdRole, setCreatedRole] = useState<"manager" | "employee">("employee");
  
  // Assign state (for manager -> client)
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Assign employee to manager state
  const [assigningEmpManager, setAssigningEmpManager] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  // Assign employee to campaign state
  const [assigningEmpCampaign, setAssigningEmpCampaign] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, clientsRes, assignRes, campsRes] = await Promise.all([
        apiFetch("/api/users"),
        apiFetch("/api/clients"),
        apiFetch("/api/assignments"),
        apiFetch("/api/campaigns")
      ]);
      if (usersRes.ok && clientsRes.ok && assignRes.ok && campsRes.ok) {
        const usersData = await usersRes.json();
        const clientsData = await clientsRes.json();
        const assignData = await assignRes.json();
        const campsData = await campsRes.json();
        
        setTeamMembers(
          usersData.users?.filter((u: any) => u.display_role === "employee" || u.display_role === "manager") || []
        );
        setClients(clientsData.clients || []);
        setCampaigns(campsData.campaigns || []);
        
        // Group assignments by manager
        const grouped: Record<string, Assignment[]> = {};
        for (const a of (assignData.assignments || [])) {
          if (!grouped[a.manager_id]) grouped[a.manager_id] = [];
          grouped[a.manager_id].push(a);
        }
        setAssignments(grouped);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [apiFetch]);

  const managers = teamMembers.filter(m => m.role === "manager");
  const employees = teamMembers.filter(m => m.role === "employee");

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setAddingEmp(true);
    try {
      const body: any = { name: newEmpName, email: newEmpEmail, role: newEmpRole };
      if (newEmpRole === "employee" && newEmpManagerId) {
        body.manager_id = newEmpManagerId;
      }
      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setTempPassword(data.temp_password);
        setCreatedRole(newEmpRole);
        loadData();
        setNewEmpName("");
        setNewEmpEmail("");
        setNewEmpRole("employee");
        setNewEmpManagerId("");
      } else {
        alert(data.error || "Failed to create team member");
      }
    } finally {
      setAddingEmp(false);
    }
  }

  async function handleAssignClient(managerId: string) {
    if (!selectedClientId) return;
    try {
      const res = await apiFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({ manager_id: managerId, client_id: selectedClientId })
      });
      if (res.ok) {
        setAssigningTo(null);
        setSelectedClientId("");
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign client");
      }
    } catch (e) {
      alert("Error assigning client");
    }
  }

  async function handleUnassign(assignmentId: string) {
    try {
      const res = await apiFetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to unassign client");
      }
    } catch (e) {
      alert("Error unassigning client");
    }
  }

  async function handleAssignEmployeeToManager(empId: string) {
    if (!selectedManagerId) return;
    try {
      const res = await apiFetch(`/api/users/${empId}`, {
        method: "PATCH",
        body: JSON.stringify({ manager_id: selectedManagerId })
      });
      if (res.ok) {
        setAssigningEmpManager(null);
        setSelectedManagerId("");
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign employee to manager");
      }
    } catch (e) {
      alert("Error assigning employee to manager");
    }
  }

  async function handleUnassignEmployeeFromManager(empId: string) {
    try {
      const res = await apiFetch(`/api/users/${empId}`, {
        method: "PATCH",
        body: JSON.stringify({ manager_id: null })
      });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to unassign employee from manager");
      }
    } catch (e) {
      alert("Error unassigning employee");
    }
  }

  async function handleAssignCampaign(empId: string) {
    if (!selectedCampaignId) return;
    const camp = campaigns.find(c => c.id === selectedCampaignId);
    if (!camp) return;
    const currentEmpIds = (camp.assigned_employees || []).map((e: any) => e.id);
    if (!currentEmpIds.includes(empId)) {
      currentEmpIds.push(empId);
    }
    try {
      const res = await apiFetch(`/api/campaigns/${selectedCampaignId}/employees`, {
        method: "POST",
        body: JSON.stringify({ employee_ids: currentEmpIds })
      });
      if (res.ok) {
        setAssigningEmpCampaign(null);
        setSelectedCampaignId("");
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to assign campaign");
      }
    } catch (e) {
      alert("Error assigning campaign");
    }
  }

  async function handleUnassignCampaign(empId: string, campaignId: string) {
    const camp = campaigns.find(c => c.id === campaignId);
    if (!camp) return;
    const currentEmpIds = (camp.assigned_employees || []).map((e: any) => e.id).filter((id: string) => id !== empId);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/employees`, {
        method: "POST",
        body: JSON.stringify({ employee_ids: currentEmpIds })
      });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to unassign campaign");
      }
    } catch (e) {
      alert("Error unassigning campaign");
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading team data...</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: 18 }}>Team & Access</h1>
          <p className="text-slate-500" style={{ fontSize: 12 }}>Manage managers, employees, and client assignments.</p>
        </div>
        <button
          onClick={() => { setIsAddModalOpen(true); setTempPassword(null); setCreatedRole("employee"); }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-white font-semibold cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "#6366F1", fontSize: 12 }}
        >
          <Plus size={13} /> Add Team Member
        </button>
      </div>

      {/* ─── Managers Section ─── */}
      <div>
        <h2 className="text-slate-800 font-semibold mb-3 flex items-center gap-2" style={{ fontSize: 14 }}>
          <ShieldCheck size={16} className="text-indigo-500" /> Managers
        </h2>
        <div className="bg-white rounded-xl shadow-sm" style={{ border: "1px solid #E2E8F0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Manager", "Email", "Status", "Assigned Clients", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500" style={{ fontSize: 13 }}>No managers found.</td></tr>
              ) : (
                managers.map(mgr => {
                  const isExpanded = expandedMgrId === mgr.id;
                  const mgrAssignments = assignments[mgr.id] || [];
                  return (
                    <React.Fragment key={mgr.id}>
                      <tr className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div 
                            onClick={() => setExpandedMgrId(isExpanded ? null : mgr.id)}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 group-hover:scale-105 transition-transform" style={{ background: "#6366F1", fontSize: 10 }}>
                              {mgr.name.substring(0,2).toUpperCase()}
                            </div>
                            <span className="text-slate-800 font-semibold group-hover:text-indigo-600 transition-colors" style={{ fontSize: 12 }}>{mgr.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500" style={{ fontSize: 12 }}>{mgr.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium" style={{ background: mgr.is_active ? "#ECFDF5" : "#F1F5F9", color: mgr.is_active ? "#065F46" : "#475569", fontSize: 11 }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: mgr.is_active ? "#10B981" : "#94A3B8" }} />
                            {mgr.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-800 font-medium" style={{ fontSize: 12 }}>{mgrAssignments.length} clients</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedMgrId(isExpanded ? null : mgr.id)}
                            className="border border-slate-200 rounded-md px-2.5 py-1 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            style={{ fontSize: 11 }}
                          >
                            {isExpanded ? "Close" : "Manage Clients"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: "#F8FAFC" }}>
                          <td colSpan={5} className="px-4 py-4 border-t border-slate-100">
                            <div className="ml-9 p-4 bg-white rounded-lg border border-slate-200">
                              <h4 className="text-slate-800 font-semibold mb-3 flex items-center gap-1.5" style={{ fontSize: 12 }}>
                                <ShieldCheck size={14} className="text-indigo-500" />
                                Assigned Clients for {mgr.name}
                              </h4>
                              
                              <div className="flex flex-col gap-2 mb-4">
                                {mgrAssignments.length === 0 ? (
                                  <p className="text-slate-500" style={{ fontSize: 12 }}>No clients assigned yet.</p>
                                ) : (
                                  mgrAssignments.map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg bg-slate-50">
                                      <span className="text-slate-700 font-medium" style={{ fontSize: 12 }}>{a.client_name}</span>
                                      <button 
                                        onClick={() => handleUnassign(a.id)}
                                        className="text-slate-400 hover:text-red-500 cursor-pointer"
                                        title="Remove assignment"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>

                              {assigningTo === mgr.id ? (
                                <div className="flex items-center gap-2 mt-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                  <select 
                                    className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 bg-white" 
                                    style={{ fontSize: 12 }}
                                    value={selectedClientId}
                                    onChange={e => setSelectedClientId(e.target.value)}
                                  >
                                    <option value="">Select a client...</option>
                                    {clients.filter(c => !mgrAssignments.find(a => a.client_id === c.id)).map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAssignClient(mgr.id)}
                                    disabled={!selectedClientId}
                                    className="rounded-md px-3 py-1.5 text-white font-semibold cursor-pointer disabled:opacity-50"
                                    style={{ background: "#6366F1", fontSize: 12 }}
                                  >
                                    Assign
                                  </button>
                                  <button
                                    onClick={() => setAssigningTo(null)}
                                    className="rounded-md px-3 py-1.5 text-slate-600 font-semibold border border-slate-200 cursor-pointer bg-white"
                                    style={{ fontSize: 12 }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAssigningTo(mgr.id); setSelectedClientId(""); }}
                                  className="flex items-center gap-1.5 text-indigo-600 font-medium cursor-pointer hover:underline mt-2"
                                  style={{ fontSize: 12 }}
                                >
                                  <LinkIcon size={12} /> Assign new client
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Employees Section ─── */}
      <div>
        <h2 className="text-slate-800 font-semibold mb-3 flex items-center gap-2" style={{ fontSize: 14 }}>
          <Users size={16} className="text-cyan-600" /> Employees
        </h2>
        <div className="bg-white rounded-xl shadow-sm" style={{ border: "1px solid #E2E8F0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Employee", "Email", "Status", "Assigned Manager", "Assigned Campaigns", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold border-b border-slate-100" style={{ fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500" style={{ fontSize: 13 }}>No employees found.</td></tr>
              ) : (
                employees.map(emp => {
                  const isExpanded = expandedEmpId === emp.id;
                  const empCamps = campaigns.filter(c => (c.assigned_employees || []).some((e: any) => e.id === emp.id));
                  return (
                    <React.Fragment key={emp.id}>
                      <tr className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div 
                            onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 group-hover:scale-105 transition-transform" style={{ background: "#0891B2", fontSize: 10 }}>
                              {emp.name.substring(0,2).toUpperCase()}
                            </div>
                            <span className="text-slate-800 font-semibold group-hover:text-cyan-600 transition-colors" style={{ fontSize: 12 }}>{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500" style={{ fontSize: 12 }}>{emp.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium" style={{ background: emp.is_active ? "#ECFDF5" : "#F1F5F9", color: emp.is_active ? "#065F46" : "#475569", fontSize: 11 }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: emp.is_active ? "#10B981" : "#94A3B8" }} />
                            {emp.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {emp.manager_name ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-800 font-medium" style={{ fontSize: 12 }}>{emp.manager_name}</span>
                              <button
                                onClick={() => handleUnassignEmployeeFromManager(emp.id)}
                                className="text-slate-400 hover:text-red-500 cursor-pointer"
                                title="Unassign from manager"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400" style={{ fontSize: 12 }}>Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-800 font-medium" style={{ fontSize: 12 }}>{empCamps.length} campaigns</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {assigningEmpManager === emp.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  className="border border-slate-200 rounded-md px-2 py-1 text-slate-700 bg-white"
                                  style={{ fontSize: 11 }}
                                  value={selectedManagerId}
                                  onChange={e => setSelectedManagerId(e.target.value)}
                                >
                                  <option value="">Select manager...</option>
                                  {managers.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignEmployeeToManager(emp.id)}
                                  disabled={!selectedManagerId}
                                  className="rounded-md px-2 py-1 text-white font-semibold cursor-pointer disabled:opacity-50"
                                  style={{ background: "#6366F1", fontSize: 11 }}
                                >
                                  Assign
                                </button>
                                <button
                                  onClick={() => setAssigningEmpManager(null)}
                                  className="rounded-md px-2 py-1 text-slate-600 border border-slate-200 cursor-pointer bg-white"
                                  style={{ fontSize: 11 }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAssigningEmpManager(emp.id); setSelectedManagerId(""); }}
                                className="border border-slate-200 rounded-md px-2.5 py-1 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer bg-white"
                                style={{ fontSize: 11 }}
                              >
                                {emp.manager_id ? "Change Manager" : "Assign Manager"}
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                              className="border border-slate-200 rounded-md px-2.5 py-1 text-slate-600 hover:border-cyan-500 hover:text-cyan-600 transition-colors cursor-pointer bg-white"
                              style={{ fontSize: 11 }}
                            >
                              {isExpanded ? "Close" : "Manage Campaigns"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: "#F8FAFC" }}>
                          <td colSpan={6} className="px-4 py-4 border-t border-slate-100">
                            <div className="ml-9 p-4 bg-white rounded-lg border border-slate-200">
                              <h4 className="text-slate-800 font-semibold mb-3 flex items-center gap-1.5" style={{ fontSize: 12 }}>
                                <Users size={14} className="text-cyan-600" />
                                Assigned Campaigns for {emp.name}
                              </h4>
                              
                              <div className="flex flex-col gap-2 mb-4">
                                {empCamps.length === 0 ? (
                                  <p className="text-slate-500" style={{ fontSize: 12 }}>No campaigns assigned yet.</p>
                                ) : (
                                  Object.entries(
                                    empCamps.reduce((acc: Record<string, any[]>, c) => {
                                      const clientName = c.client_name || "Other Clients";
                                      if (!acc[clientName]) acc[clientName] = [];
                                      acc[clientName].push(c);
                                      return acc;
                                    }, {})
                                  ).map(([clientName, camps]) => (
                                    <div key={clientName} className="border border-slate-100 rounded-xl p-3.5 bg-slate-50/50 mb-3 shadow-sm">
                                      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                        <span className="text-slate-800 font-bold tracking-wide uppercase" style={{ fontSize: 10 }}>{clientName}</span>
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        {camps.map(c => (
                                          <div key={c.id} className="flex items-center justify-between p-2.5 border border-slate-100 rounded-lg bg-white hover:border-slate-300 transition-colors shadow-sm">
                                            <div>
                                              <span className="text-slate-700 font-semibold block" style={{ fontSize: 12 }}>{c.name}</span>
                                              <span className="text-slate-400 block" style={{ fontSize: 10 }}>Platform: {c.platform}</span>
                                            </div>
                                            <button 
                                              onClick={() => handleUnassignCampaign(emp.id, c.id)}
                                              className="text-slate-400 hover:text-red-500 cursor-pointer p-1"
                                              title="Remove campaign assignment"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              {assigningEmpCampaign === emp.id ? (
                                <div className="flex items-center gap-2 mt-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                  <select 
                                    className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 bg-white" 
                                    style={{ fontSize: 12 }}
                                    value={selectedCampaignId}
                                    onChange={e => setSelectedCampaignId(e.target.value)}
                                  >
                                    <option value="">Select a campaign...</option>
                                    {campaigns.filter(c => !empCamps.find(a => a.id === c.id)).map(c => (
                                      <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAssignCampaign(emp.id)}
                                    disabled={!selectedCampaignId}
                                    className="rounded-md px-3 py-1.5 text-white font-semibold cursor-pointer disabled:opacity-50"
                                    style={{ background: "#6366F1", fontSize: 12 }}
                                  >
                                    Assign
                                  </button>
                                  <button
                                    onClick={() => setAssigningEmpCampaign(null)}
                                    className="rounded-md px-3 py-1.5 text-slate-600 font-semibold border border-slate-200 cursor-pointer bg-white"
                                    style={{ fontSize: 12 }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAssigningEmpCampaign(emp.id); setSelectedCampaignId(""); }}
                                  className="flex items-center gap-1.5 text-cyan-600 font-medium cursor-pointer hover:underline mt-2"
                                  style={{ fontSize: 12 }}
                                >
                                  <LinkIcon size={12} /> Assign new campaign
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Team Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {!tempPassword ? (
              <>
                <h3 className="text-slate-900 font-bold mb-1" style={{ fontSize: 18 }}>Add Team Member</h3>
                <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>They will receive an email with their Keycloak temporary credentials.</p>
                
                <form onSubmit={handleAddEmployee} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Role</label>
                    <select
                      value={newEmpRole}
                      onChange={e => setNewEmpRole(e.target.value as "manager" | "employee")}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-indigo-500 outline-none bg-white"
                      style={{ fontSize: 13 }}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Full Name</label>
                    <input 
                      required value={newEmpName} onChange={e => setNewEmpName(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-indigo-500 outline-none" style={{ fontSize: 13 }}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Email Address</label>
                    <input 
                      required type="email" value={newEmpEmail} onChange={e => setNewEmpEmail(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-indigo-500 outline-none" style={{ fontSize: 13 }}
                      placeholder="jane@agency.com"
                    />
                  </div>

                  {newEmpRole === "employee" && managers.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-slate-700 font-semibold" style={{ fontSize: 12 }}>Assign to Manager (optional)</label>
                      <select
                        value={newEmpManagerId}
                        onChange={e => setNewEmpManagerId(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-indigo-500 outline-none bg-white"
                        style={{ fontSize: 13 }}
                      >
                        <option value="">No manager</option>
                        {managers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-4">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 rounded-lg py-2 text-slate-700 font-semibold border border-slate-200 hover:bg-slate-50 cursor-pointer" style={{ fontSize: 13 }}>Cancel</button>
                    <button type="submit" disabled={addingEmp} className="flex-1 rounded-lg py-2 text-white font-semibold cursor-pointer disabled:opacity-50" style={{ background: "#6366F1", fontSize: 13 }}>
                      {addingEmp ? "Creating..." : `Create ${newEmpRole === "manager" ? "Manager" : "Employee"}`}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-slate-900 font-bold mb-1" style={{ fontSize: 18 }}>
                  {createdRole === "manager" ? "Manager Created!" : "Employee Created!"}
                </h3>
                <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>An email has been sent to them. Alternatively, you can securely copy their temporary password below.</p>
                
                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 flex flex-col items-center gap-2">
                  <span className="text-slate-500 font-medium" style={{ fontSize: 11 }}>TEMPORARY PASSWORD</span>
                  <span className="text-slate-900 font-mono font-bold text-lg">{tempPassword}</span>
                </div>
                
                <button onClick={() => setIsAddModalOpen(false)} className="w-full rounded-lg py-2 text-white font-semibold cursor-pointer" style={{ background: "#6366F1", fontSize: 13 }}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
