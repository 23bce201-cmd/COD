// Free-form email composer — custom subject, body, optional file attachments,
// and a smart recipient picker that blends existing users with free-text emails.
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Link2,
  Paperclip,
  RefreshCw,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";

const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
}

interface ToTag {
  key: string;       // unique per chip
  label: string;     // display name or email
  email: string;
  fromSystem: boolean;
}

// ── Recipient tag chip ────────────────────────────────────────
function Tag({ tag, onRemove }: { tag: ToTag; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border shrink-0"
      style={
        tag.fromSystem
          ? { background: "#EEF2FF", color: "#4338CA", borderColor: "#C7D2FE" }
          : { background: "#F0FDF4", color: "#166534", borderColor: "#BBF7D0" }
      }
    >
      {tag.fromSystem ? <User size={10} /> : null}
      <span className="max-w-[140px] truncate">{tag.label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ── Smart To field ────────────────────────────────────────────
function ToField({
  tags,
  onAdd,
  onRemove,
  suggestions,
}: {
  tags: ToTag[];
  onAdd: (tag: ToTag) => void;
  onRemove: (key: string) => void;
  suggestions: Recipient[];
}) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter suggestions: exclude already-added emails, match name or email
  const query = inputValue.trim().toLowerCase();
  const addedEmails = new Set(tags.map((t) => t.email.toLowerCase()));
  const filtered = suggestions.filter(
    (r) =>
      !addedEmails.has(r.email.toLowerCase()) &&
      (r.email.toLowerCase().includes(query) || r.name.toLowerCase().includes(query))
  );
  const showAddCustom =
    query.length > 0 &&
    EMAIL_RE.test(inputValue.trim()) &&
    !addedEmails.has(inputValue.trim().toLowerCase()) &&
    !filtered.some((r) => r.email.toLowerCase() === inputValue.trim().toLowerCase());

  function addFromSuggestion(r: Recipient) {
    onAdd({ key: r.email, label: r.name || r.email, email: r.email, fromSystem: true });
    setInputValue("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function addCustomEmail() {
    const email = inputValue.trim();
    if (!EMAIL_RE.test(email)) return;
    if (addedEmails.has(email.toLowerCase())) return;
    onAdd({ key: email, label: email, email, fromSystem: false });
    setInputValue("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && inputValue.trim()) {
      e.preventDefault();
      if (filtered.length > 0 && !EMAIL_RE.test(inputValue.trim())) {
        addFromSuggestion(filtered[0]);
      } else {
        addCustomEmail();
      }
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onRemove(tags[tags.length - 1].key);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Tag input area */}
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-2 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Tag key={tag.key} tag={tag} onRemove={() => onRemove(tag.key)} />
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={tags.length === 0 ? "Search users or type an email…" : ""}
          className="flex-1 min-w-[180px] text-slate-700 text-sm outline-none bg-transparent placeholder:text-slate-300"
        />
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <ChevronDown size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (filtered.length > 0 || showAddCustom) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {/* Existing system users */}
            {filtered.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team & Clients</span>
                </div>
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addFromSuggestion(r)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 shrink-0 text-[11px] font-bold">
                      {(r.name || r.email).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-slate-800 text-xs font-semibold truncate">{r.name || r.email}</span>
                      <span className="block text-slate-400 text-[11px] truncate">{r.email}</span>
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 shrink-0">
                      {r.roleLabel}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Add custom email */}
            {showAddCustom && (
              <>
                {filtered.length > 0 && <div className="border-t border-slate-100 my-1" />}
                <button
                  type="button"
                  onClick={addCustomEmail}
                  className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-emerald-50 transition-colors text-left"
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 shrink-0 text-[11px] font-bold">+</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-emerald-700 text-xs font-semibold">Add "{inputValue.trim()}"</span>
                    <span className="block text-slate-400 text-[11px]">Send to this email address</span>
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 bg-slate-50">
            <p className="text-[10px] text-slate-400">
              Press <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-slate-600">Enter</kbd> or{" "}
              <kbd className="rounded bg-slate-200 px-1 py-0.5 font-mono text-slate-600">,</kbd> to add a custom email
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ComposeEmail component ───────────────────────────────
export function ComposeEmail() {
  const { apiFetch } = useAuth();

  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Recipients
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [toTags, setToTags] = useState<ToTag[]>([]);

  // Form state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Gmail status
  useEffect(() => {
    let mounted = true;
    async function loadStatus() {
      try {
        const res = await apiFetch("/api/reports/email/gmail/status");
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (mounted) {
          setGmailConnected(Boolean(json.connected));
          setGmailEmail(json.gmail_email || null);
        }
      } catch {
        if (mounted) { setGmailConnected(false); setGmailEmail(null); }
      }
    }
    loadStatus();
    return () => { mounted = false; };
  }, [apiFetch]);

  // Load accessible recipients for suggestions
  useEffect(() => {
    let mounted = true;
    async function loadRecipients() {
      try {
        const res = await apiFetch("/api/reports/email/recipients");
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setSuggestions(json.recipients || []);
      } catch {
        if (mounted) setSuggestions([]);
      }
    }
    loadRecipients();
    return () => { mounted = false; };
  }, [apiFetch]);

  // Handle ?gmail= redirect after OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get("gmail");
    const reason = params.get("reason");
    if (!gmailStatus) return;
    if (gmailStatus === "connected") {
      toast.success("Gmail connected. You can now send emails.");
    } else {
      toast.error(`Gmail connection failed${reason ? `: ${reason.replace(/_/g, " ")}` : "."}`);
    }
    params.delete("gmail");
    params.delete("reason");
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
  }, []);

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

  function addTag(tag: ToTag) {
    setToTags((prev) => prev.find((t) => t.key === tag.key) ? prev : [...prev, tag]);
  }

  function removeTag(key: string) {
    setToTags((prev) => prev.filter((t) => t.key !== key));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    const next = [...files, ...selected].slice(0, MAX_FILES);
    const oversized = next.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (oversized) {
      toast.error(`${oversized.name} exceeds the ${MAX_FILE_MB} MB limit.`);
      return;
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDiscard() {
    setToTags([]); setSubject(""); setBody(""); setFiles([]);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!gmailConnected) { toast.error("Connect Gmail before sending."); return; }
    if (toTags.length === 0) { toast.error("Add at least one recipient."); return; }
    if (!subject.trim()) { toast.error("Subject is required."); return; }
    if (!body.trim()) { toast.error("Email body is required."); return; }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("to", toTags.map((t) => t.email).join(","));
      formData.append("subject", subject.trim());
      formData.append("body", body.trim());
      files.forEach((file) => formData.append("files", file));

      const res = await apiFetch("/api/email/compose", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));

      if (json.code === "GMAIL_NOT_CONNECTED") {
        setGmailConnected(false);
        throw new Error("Gmail disconnected. Please reconnect.");
      }
      if (!res.ok && res.status !== 207) throw new Error(json.error || "Failed to send email");

      if (json.status === "sent") {
        toast.success(`Email sent to ${json.sent_count} recipient${json.sent_count === 1 ? "" : "s"}.`);
        setToTags([]); setSubject(""); setBody(""); setFiles([]);
      } else if (json.status === "partial") {
        toast.error(`Sent to ${json.sent_count}, failed for ${json.failed_count}.`);
      } else {
        throw new Error("All recipients failed.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const hasContent = toTags.length > 0 || subject || body || files.length > 0;

  return (
    <form
      onSubmit={handleSend}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-0 overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
            <Send size={14} className="text-indigo-500" />
            New Email
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Pick from your team / clients or enter any email address.
          </p>
        </div>
        {gmailConnected ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100 whitespace-nowrap">
            From {gmailEmail}
          </span>
        ) : (
          <button
            type="button"
            onClick={connectGmail}
            disabled={connectingGmail}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 disabled:opacity-60 whitespace-nowrap"
          >
            {connectingGmail ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />}
            Connect Gmail
          </button>
        )}
      </div>

      {/* ── Fields ── */}
      <div className="flex flex-col divide-y divide-slate-100">
        {/* To — smart recipient picker */}
        <div className="flex gap-3 px-6 py-2 items-start">
          <span className="text-slate-400 text-xs font-bold w-14 shrink-0 pt-2.5">To</span>
          <div className="flex-1">
            <ToField
              tags={toTags}
              onAdd={addTag}
              onRemove={removeTag}
              suggestions={suggestions}
            />
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-3 px-6 py-3">
          <span className="text-slate-400 text-xs font-bold w-14 shrink-0">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject…"
            className="flex-1 text-slate-700 text-sm outline-none bg-transparent placeholder:text-slate-300"
          />
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            rows={8}
            className="w-full text-slate-700 text-sm outline-none bg-transparent resize-none placeholder:text-slate-300 leading-relaxed"
          />
        </div>
      </div>

      {/* ── Attachment chips ── */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 px-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Paperclip size={12} className="text-slate-400" />
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
              Attachments ({files.length}/{MAX_FILES}) · {formatBytes(totalSize)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
              >
                <Paperclip size={11} className="text-slate-400 shrink-0" />
                <span className="max-w-[160px] truncate font-medium">{file.name}</span>
                <span className="text-slate-400 shrink-0">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={files.length >= MAX_FILES}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <Paperclip size={13} />
            Attach
            {files.length > 0 && (
              <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                {files.length}
              </span>
            )}
          </button>

          {hasContent && (
            <button
              type="button"
              onClick={handleDiscard}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <Trash2 size={13} />
              Discard
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={sending || !gmailConnected}
          className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
          style={{ background: "#4F46E5", minWidth: 100 }}
        >
          {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? "Sending…" : !gmailConnected ? "Connect Gmail" : "Send"}
        </button>
      </div>
    </form>
  );
}
