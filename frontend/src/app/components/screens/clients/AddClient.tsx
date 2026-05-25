import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle,
  Cloud,
  Copy,
  DollarSign,
  Globe,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const STEPS = ["Client Details", "Connect Platforms", "Done"] as const;
const PLATFORM_ORDER = ["google_ads", "meta_ads", "mailchimp"] as const;

type Step = 0 | 1 | 2;
type PlatformKey = (typeof PLATFORM_ORDER)[number];
type PlatformCredentials = Record<
  PlatformKey,
  { access_token: string; refresh_token: string; account_id: string }
>;

const PLATFORM_META: Record<
  PlatformKey,
  { label: string; helper: string; accentBg: string; accentColor: string }
> = {
  google_ads: {
    label: "Google Ads",
    helper: "Use the access token and optional customer/account reference.",
    accentBg: "#EEF2FF",
    accentColor: "#4338CA",
  },
  meta_ads: {
    label: "Meta Ads",
    helper: "Paste a long-lived access token and ad account ID if you have one.",
    accentBg: "#FDF2F8",
    accentColor: "#9D174D",
  },
  mailchimp: {
    label: "Mailchimp",
    helper: "API token and account identifier are optional during setup.",
    accentBg: "#FFFBEB",
    accentColor: "#92400E",
  },
};

const EMPTY_PLATFORM_CREDENTIALS: PlatformCredentials = {
  google_ads: { access_token: "", refresh_token: "", account_id: "" },
  meta_ads: { access_token: "", refresh_token: "", account_id: "" },
  mailchimp: { access_token: "", refresh_token: "", account_id: "" },
};

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-3 last:flex-initial">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={{
                  background: done ? "#10B981" : active ? "#2563EB" : "#E2E8F0",
                  color: done || active ? "#fff" : "#94A3B8",
                  fontSize: 12,
                }}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span
                className="font-medium"
                style={{
                  fontSize: 12,
                  color: active ? "#2563EB" : done ? "#10B981" : "#94A3B8",
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1"
                style={{ height: 2, background: i < current ? "#10B981" : "#E2E8F0" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span style={{ color: "#F43F5E" }}> *</span>}
      </label>
      <div className="relative">
        <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-400"
          style={{ fontSize: 13 }}
        />
      </div>
    </div>
  );
}

function Banner({ tone, text }: { tone: "error" | "info"; text: string }) {
  const isError = tone === "error";
  return (
    <div
      className="rounded-2xl p-3 flex items-start gap-2.5"
      style={{
        background: isError ? "#FFF1F2" : "#EFF6FF",
        border: `1px solid ${isError ? "#FECDD3" : "#BFDBFE"}`,
      }}
    >
      {isError ? (
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#E11D48" }} />
      ) : (
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#2563EB" }} />
      )}
      <p style={{ fontSize: 12, color: isError ? "#9F1239" : "#1D4ED8" }}>{text}</p>
    </div>
  );
}

function normalizeBudget(rawBudget: string) {
  const trimmed = rawBudget.trim();
  if (!trimmed) return { value: undefined as number | undefined, error: null as string | null };

  const normalized = trimmed.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: undefined, error: "Monthly budget must be a positive number." };
  }

  return { value: parsed, error: null };
}

function friendlyError(payload: any, fallback: string) {
  if (payload?.error && typeof payload.error === "string") return payload.error;
  if (payload?.details && typeof payload.details === "object") {
    const firstField = Object.values(payload.details)[0];
    if (Array.isArray(firstField) && firstField.length > 0) {
      return String(firstField[0]);
    }
  }
  return fallback;
}

export function AddClient() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [error, setError] = useState("");

  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [budget, setBudget] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [clientId, setClientId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformKey[]>([]);
  const [platformCredentials, setPlatformCredentials] = useState<PlatformCredentials>(
    EMPTY_PLATFORM_CREDENTIALS
  );

  function resetFlow() {
    setStep(0);
    setSubmitting(false);
    setPlatformSaving(false);
    setError("");
    setClientName("");
    setIndustry("");
    setBudget("");
    setContactName("");
    setContactEmail("");
    setClientId(null);
    setTempPassword(null);
    setConnectedPlatforms([]);
    setPlatformCredentials(EMPTY_PLATFORM_CREDENTIALS);
  }

  async function handleCreateClient() {
    setError("");

    if (!clientName.trim() || !contactName.trim() || !contactEmail.trim()) {
      setError("Business name, contact name, and login email are required.");
      return;
    }

    const budgetResult = normalizeBudget(budget);
    if (budgetResult.error) {
      setError(budgetResult.error);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          name: clientName.trim(),
          industry: industry.trim() || undefined,
          monthly_budget: budgetResult.value,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim().toLowerCase(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(friendlyError(payload, "Failed to create client."));
        return;
      }

      setClientId(payload.client_id);
      setTempPassword(payload.temp_password || null);
      setContactEmail(payload.contact_email || contactEmail.trim().toLowerCase());
      setStep(1);
    } catch (err) {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function updatePlatformField(platform: PlatformKey, field: keyof PlatformCredentials[PlatformKey], value: string) {
    setPlatformCredentials((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        [field]: value,
      },
    }));
  }

  async function handleConnectPlatforms() {
    if (!clientId) {
      setError("Client record is missing. Please restart setup.");
      return;
    }

    setError("");
    setPlatformSaving(true);

    const requestedPlatforms = PLATFORM_ORDER.filter(
      (platform) => platformCredentials[platform].access_token.trim().length > 0
    );

    if (requestedPlatforms.length === 0) {
      setConnectedPlatforms([]);
      setStep(2);
      setPlatformSaving(false);
      return;
    }

    try {
      const results = await Promise.all(
        requestedPlatforms.map(async (platform) => {
          const response = await apiFetch(`/api/clients/${clientId}/connect/${platform}`, {
            method: "POST",
            body: JSON.stringify({
              access_token: platformCredentials[platform].access_token.trim(),
              refresh_token: platformCredentials[platform].refresh_token.trim() || undefined,
              account_id: platformCredentials[platform].account_id.trim() || undefined,
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(`${PLATFORM_META[platform].label}: ${friendlyError(payload, "Connection failed.")}`);
          }

          return platform;
        })
      );

      setConnectedPlatforms(results);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save platform credentials.");
    } finally {
      setPlatformSaving(false);
    }
  }

  function skipPlatformSetup() {
    setError("");
    setConnectedPlatforms([]);
    setStep(2);
  }

  return (
    <div
      className="min-h-screen w-full px-4 py-8 md:px-8 md:py-10"
      style={{
        background:
          "radial-gradient(circle at top right, rgba(37,99,235,0.10), transparent 28%), linear-gradient(180deg,#F8FAFC 0%,#EFF6FF 100%)",
      }}
    >
      <div className="mx-auto max-w-4xl">
        <div
          className="bg-white rounded-[28px] border border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,0.10)] overflow-hidden"
        >
          <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-100 flex items-center gap-3">
            <div
              className="rounded-2xl p-2.5 flex items-center justify-center"
              style={{ background: "linear-gradient(145deg,#2563EB 0%,#0F172A 100%)" }}
            >
              <Cloud size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900" style={{ fontSize: 16 }}>CloudCRM</div>
              <div className="text-slate-500" style={{ fontSize: 12 }}>Client onboarding powered by Keycloak</div>
            </div>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-8 flex flex-col gap-6">
            <StepBar current={step} />

            {error && <Banner tone="error" text={error} />}

            {step === 0 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="font-bold text-slate-950" style={{ fontSize: 24 }}>
                    Add a new client
                  </h1>
                  <p className="text-slate-500 mt-1" style={{ fontSize: 14 }}>
                    This creates the business record in CloudCRM and provisions the client login in Keycloak.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Field
                    icon={Building2}
                    label="Business Name"
                    value={clientName}
                    onChange={setClientName}
                    placeholder="Apex Media"
                  />
                  <Field
                    icon={Globe}
                    label="Industry"
                    value={industry}
                    onChange={setIndustry}
                    placeholder="E-commerce"
                    required={false}
                  />
                  <Field
                    icon={DollarSign}
                    label="Monthly Budget"
                    value={budget}
                    onChange={setBudget}
                    placeholder="15000"
                    required={false}
                  />
                  <Field
                    icon={User}
                    label="Contact Name"
                    value={contactName}
                    onChange={setContactName}
                    placeholder="Alex Turner"
                  />
                  <div className="md:col-span-2">
                    <Field
                      icon={Mail}
                      label="Client Login Email"
                      value={contactEmail}
                      onChange={setContactEmail}
                      placeholder="alex@apexmedia.com"
                      type="email"
                    />
                  </div>
                </div>

                <Banner
                  tone="info"
                  text="A temporary Keycloak password will be generated after this step. The client will be asked to update it on first sign-in."
                />

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigate("/agency/dashboard")}
                    className="rounded-xl px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                    style={{ fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={submitting}
                    className="rounded-xl px-5 py-2.5 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                    style={{ background: "#2563EB", fontSize: 13 }}
                  >
                    {submitting ? "Creating..." : "Create Client & Continue"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="font-bold text-slate-950" style={{ fontSize: 24 }}>
                    Connect platforms
                  </h1>
                  <p className="text-slate-500 mt-1" style={{ fontSize: 14 }}>
                    Optional for now. You can save API credentials now or skip and connect them later from the client record.
                  </p>
                </div>

                <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <ShieldCheck size={16} style={{ color: "#2563EB", flexShrink: 0, marginTop: 2 }} />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800" style={{ fontSize: 13 }}>
                      Client login created
                    </span>
                    <span className="text-slate-500" style={{ fontSize: 12 }}>
                      {clientName} was created successfully. Platform credentials below are optional and can be added later.
                    </span>
                  </div>
                </div>

                <div className="grid gap-4">
                  {PLATFORM_ORDER.map((platform) => {
                    const meta = PLATFORM_META[platform];
                    const values = platformCredentials[platform];

                    return (
                      <div
                        key={platform}
                        className="rounded-2xl border border-slate-200 p-4 flex flex-col gap-4"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div
                              className="inline-flex items-center rounded-lg px-3 py-1.5 font-semibold"
                              style={{
                                background: meta.accentBg,
                                color: meta.accentColor,
                                fontSize: 12,
                              }}
                            >
                              {meta.label}
                            </div>
                            <p className="text-slate-500 mt-2" style={{ fontSize: 12 }}>
                              {meta.helper}
                            </p>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-3">
                          <Field
                            icon={Globe}
                            label="Access Token"
                            value={values.access_token}
                            onChange={(value) => updatePlatformField(platform, "access_token", value)}
                            placeholder="Paste access token"
                            required={false}
                          />
                          <Field
                            icon={Copy}
                            label="Refresh Token"
                            value={values.refresh_token}
                            onChange={(value) => updatePlatformField(platform, "refresh_token", value)}
                            placeholder="Optional refresh token"
                            required={false}
                          />
                          <Field
                            icon={User}
                            label="Account ID"
                            value={values.account_id}
                            onChange={(value) => updatePlatformField(platform, "account_id", value)}
                            placeholder="Optional account ID"
                            required={false}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    disabled={platformSaving}
                    className="rounded-xl px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 flex items-center gap-2"
                    style={{ fontSize: 13 }}
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={skipPlatformSetup}
                      disabled={platformSaving}
                      className="rounded-xl px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60"
                      style={{ fontSize: 13 }}
                    >
                      Skip For Now
                    </button>
                    <button
                      type="button"
                      onClick={handleConnectPlatforms}
                      disabled={platformSaving}
                      className="rounded-xl px-5 py-2.5 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                      style={{ background: "#2563EB", fontSize: 13 }}
                    >
                      {platformSaving ? "Saving..." : "Save & Finish"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-6 text-center">
                <div className="flex flex-col items-center gap-3 pt-2">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#2563EB,#0F172A)" }}
                  >
                    <CheckCircle size={30} className="text-white" />
                  </div>
                  <div>
                    <h1 className="font-bold text-slate-950" style={{ fontSize: 24 }}>
                      Client added successfully
                    </h1>
                    <p className="text-slate-500 mt-1" style={{ fontSize: 14 }}>
                      {clientName} is ready in CloudCRM and the login account has been provisioned in Keycloak.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-left">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-slate-600">Client Login Email</p>
                    <p className="text-slate-900 font-semibold" style={{ fontSize: 14 }}>{contactEmail}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-slate-600">Temporary Password</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-blue-700 font-mono font-bold" style={{ fontSize: 15 }}>
                        {tempPassword || "Not returned"}
                      </code>
                      {tempPassword && (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(tempPassword)}
                          className="text-slate-500 hover:text-blue-600 transition-colors"
                          title="Copy temporary password"
                        >
                          <Copy size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-left">
                  <p className="text-slate-800 font-semibold mb-3" style={{ fontSize: 13 }}>
                    Platform status
                  </p>
                  <div className="flex flex-col gap-2">
                    {PLATFORM_ORDER.map((platform) => {
                      const connected = connectedPlatforms.includes(platform);
                      return (
                        <div key={platform} className="flex items-center justify-between">
                          <span className="text-slate-600" style={{ fontSize: 12 }}>
                            {PLATFORM_META[platform].label}
                          </span>
                          <span
                            className="flex items-center gap-1.5 font-medium"
                            style={{
                              fontSize: 11,
                              color: connected ? "#10B981" : "#64748B",
                            }}
                          >
                            {connected ? <Check size={11} /> : null}
                            {connected ? "Connected" : "Skipped"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 flex-col md:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/agency/dashboard")}
                    className="flex-1 rounded-xl py-3 text-white font-semibold"
                    style={{ background: "#2563EB", fontSize: 13 }}
                  >
                    Back to Agency Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="flex-1 rounded-xl py-3 border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                    style={{ fontSize: 13 }}
                  >
                    Add Another Client
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
