// Recipient selector, confirmation dialog, scheduler, and send button for emailing report PDFs.
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Link2, Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Checkbox } from "../../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  client_name?: string | null;
}

interface ReportEmailComposerProps {
  clientId?: string | null;
  from: string;
  to: string;
  title: string;
  compact?: boolean;
}

export function ReportEmailComposer({ clientId, from, to, title, compact = false }: ReportEmailComposerProps) {
  const { apiFetch } = useAuth();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadRecipients() {
      setLoadingRecipients(true);
      try {
        const params = new URLSearchParams();
        if (clientId) params.set("client_id", clientId);
        const res = await apiFetch(`/api/reports/email/recipients${params.toString() ? `?${params.toString()}` : ""}`);
        if (!res.ok) throw new Error("Recipient request failed");
        const json = await res.json();
        const nextRecipients = json.recipients || [];
        if (mounted) {
          setRecipients(nextRecipients);
          setSelectedIds(current => current.filter(id => nextRecipients.some((recipient: EmailRecipient) => recipient.id === id)));
        }
      } catch {
        if (mounted) {
          toast.error("Could not load email recipients.");
          setRecipients([]);
          setSelectedIds([]);
        }
      } finally {
        if (mounted) setLoadingRecipients(false);
      }
    }

    loadRecipients();
    return () => {
      mounted = false;
    };
  }, [apiFetch, clientId]);

  useEffect(() => {
    let mounted = true;

    async function loadGmailStatus() {
      try {
        const res = await apiFetch("/api/reports/email/gmail/status");
        if (!res.ok) throw new Error("Gmail status request failed");
        const json = await res.json();
        if (mounted) {
          setGmailConnected(Boolean(json.connected));
          setGmailEmail(json.gmail_email || null);
        }
      } catch {
        if (mounted) {
          setGmailConnected(false);
          setGmailEmail(null);
        }
      }
    }

    loadGmailStatus();
    return () => {
      mounted = false;
    };
  }, [apiFetch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get("gmail");
    const reason = params.get("reason");
    if (!gmailStatus) return;

    if (gmailStatus === "connected") {
      toast.success("Gmail connected. You can send reports from this account now.");
    } else {
      toast.error(`Gmail connection failed${reason ? `: ${reason.replace(/_/g, " ")}` : "."}`);
    }

    params.delete("gmail");
    params.delete("reason");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const selectedRecipients = useMemo(
    () => recipients.filter(recipient => selectedIds.includes(recipient.id)),
    [recipients, selectedIds],
  );

  function toggleRecipient(id: string, checked: boolean | "indeterminate") {
    setSelectedIds(current => {
      if (checked === true) return current.includes(id) ? current : [...current, id];
      return current.filter(item => item !== id);
    });
  }

  function openConfirm() {
    if (!gmailConnected) {
      toast.error("Connect Gmail before sending reports.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one recipient.");
      return;
    }
    setConfirmOpen(true);
  }

  async function connectGmail() {
    setConnectingGmail(true);
    try {
      const res = await apiFetch("/api/reports/email/gmail/auth-url", {
        method: "POST",
        body: JSON.stringify({ return_to: window.location.href }),
      });
      const json = await res.json();
      if (!res.ok || !json.auth_url) throw new Error(json.error || "Could not start Gmail connection");
      window.location.href = json.auth_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect Gmail.");
      setConnectingGmail(false);
    }
  }

  async function sendReportEmail() {
    setSending(true);
    try {
      const res = await apiFetch("/api/reports/email/send", {
        method: "POST",
        body: JSON.stringify({
          recipient_ids: selectedIds,
          client_id: clientId || null,
          from,
          to,
          title,
          note: note.trim() || undefined,
          scheduled_at: scheduledAt || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.code === "GMAIL_NOT_CONNECTED") {
        setGmailConnected(false);
        throw new Error("Connect Gmail before sending reports.");
      }
      if (!res.ok && res.status !== 207) throw new Error(json.error || "Email request failed");

      if (json.status === "scheduled") {
        toast.success(`Report scheduled for ${new Date(json.scheduled_at).toLocaleString()}.`);
      } else if (json.failed_count > 0) {
        toast.error(`Sent to ${json.sent_count}; ${json.failed_count} failed.`);
      } else {
        toast.success(`Report emailed to ${json.sent_count || selectedIds.length} recipient${selectedIds.length === 1 ? "" : "s"}.`);
      }

      setConfirmOpen(false);
      setScheduledAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send report email.");
    } finally {
      setSending(false);
    }
  }

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-slate-800 font-bold text-[14px] leading-tight flex items-center gap-1.5">
            <Mail size={15} className="text-indigo-500" />
            Email Report
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">Recipients are limited to your role and client access.</p>
        </div>
        <div className="flex items-center gap-3">
          {gmailConnected ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100">
              From {gmailEmail}
            </span>
          ) : (
            <button
              type="button"
              onClick={connectGmail}
              disabled={connectingGmail}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 disabled:opacity-60"
            >
              {connectingGmail ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />}
              Connect Gmail
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(recipients.map(recipient => recipient.id))}
            disabled={recipients.length === 0 || loadingRecipients}
            className="text-indigo-600 text-xs font-bold disabled:text-slate-300"
          >
            Select all
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
          {loadingRecipients ? (
            <div className="flex items-center gap-2 p-4 text-slate-500 text-xs font-semibold">
              <RefreshCw size={13} className="animate-spin" />
              Loading recipients
            </div>
          ) : recipients.length === 0 ? (
            <div className="p-4 text-slate-500 text-xs font-semibold">No available recipients for this report.</div>
          ) : recipients.map(recipient => (
            <label key={recipient.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer">
              <Checkbox
                checked={selectedIds.includes(recipient.id)}
                onCheckedChange={checked => toggleRecipient(recipient.id, checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-800 text-xs font-bold">{recipient.name}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{recipient.roleLabel}</span>
                </span>
                <span className="block text-slate-400 text-[11px] truncate">{recipient.email}</span>
                {recipient.client_name && <span className="block text-slate-400 text-[11px] truncate">{recipient.client_name}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Schedule</label>
          <div className="relative">
            <CalendarClock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={event => setScheduledAt(event.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 outline-none focus:border-indigo-400"
              style={{ fontSize: 13, height: 42 }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Note</label>
          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Optional message"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 outline-none focus:border-indigo-400"
            style={{ fontSize: 13, height: 42 }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={openConfirm}
        disabled={sending || loadingRecipients || selectedIds.length === 0 || !gmailConnected}
        className="flex items-center justify-center gap-1.5 rounded-xl px-5 text-white font-bold cursor-pointer hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
        style={{ background: "#0F766E", fontSize: 13, height: 42 }}
      >
        {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
        {!gmailConnected ? "Connect Gmail to Send" : scheduledAt ? "Schedule Report" : "Send Report"}
      </button>
    </>
  );

  return (
    <div className={compact ? "flex flex-col gap-4" : "bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5"}>
      {content}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send report email?</DialogTitle>
            <DialogDescription>
              {title} will be sent as a PDF attachment to {selectedRecipients.length} recipient{selectedRecipients.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600">
            <div className="font-bold text-slate-800">{from} to {to}</div>
            <div className="mt-1 font-semibold text-slate-700">From: {gmailEmail}</div>
            <div className="mt-1">{selectedRecipients.map(recipient => recipient.email).join(", ")}</div>
            {scheduledAt && <div className="mt-2 font-semibold text-teal-700">Scheduled: {new Date(scheduledAt).toLocaleString()}</div>}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sendReportEmail}
              disabled={sending}
              className="rounded-lg px-4 py-2 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{ background: "#0F766E" }}
            >
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
