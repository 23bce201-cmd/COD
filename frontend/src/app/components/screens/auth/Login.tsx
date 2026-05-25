import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const GOOGLE_IDP_HINT = import.meta.env.VITE_KEYCLOAK_GOOGLE_IDP_HINT || "google";

const featureList = [
  "One secure workspace for admins, managers, employees, and clients",
  "Clear dashboards and updates for both internal teams and client users",
  "Google sign-in and password login supported through Keycloak",
  "Role-based access keeps every user focused on the right data",
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.24 10.286v3.821h5.445c-.24 1.234-.96 2.279-2.045 2.98l3.308 2.568c1.927-1.777 3.04-4.394 3.04-7.512 0-.717-.065-1.406-.183-2.057z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.76 0 5.076-.914 6.769-2.473l-3.308-2.568c-.917.615-2.088.978-3.461.978-2.66 0-4.914-1.796-5.72-4.212H2.86v2.646A10 10 0 0 0 12 22"
      />
      <path
        fill="#FBBC05"
        d="M6.28 13.725A5.99 5.99 0 0 1 5.96 12c0-.598.103-1.179.32-1.725V7.629H2.86A10 10 0 0 0 2 12c0 1.61.385 3.135 1.06 4.371z"
      />
      <path
        fill="#34A853"
        d="M12 6.063c1.5 0 2.847.516 3.91 1.53l2.93-2.93C17.07 2.98 14.758 2 12 2A10 10 0 0 0 2.86 7.629l3.42 2.646C7.086 7.859 9.34 6.063 12 6.063"
      />
    </svg>
  );
}

function DesktopLayout() {
  return (
    <div className="hidden xl:grid min-h-screen grid-cols-[35%_65%]">
      <section
        className="flex flex-col justify-between px-14 py-12 text-white 2xl:px-20 2xl:py-14"
        style={{ background: "linear-gradient(180deg,#2F355D 0%,#37327D 100%)" }}
      >
        <div className="space-y-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/14">
            <Cloud className="h-8 w-8" />
          </div>
          <div className="space-y-5">
            <h2 className="max-w-md text-[34px] font-semibold leading-[1.08] 2xl:text-[40px]">
              Welcome to your CloudCRM workspace
            </h2>
            <p className="max-w-lg text-[14px] leading-7 text-white/70 2xl:text-[15px] 2xl:leading-8">
              A shared place for teams and clients to review performance, stay aligned,
              and access the information that matters most.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {featureList.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-white/82">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-200" />
              <span className="text-[14px] leading-7 2xl:text-[15px]">{feature}</span>
            </div>
          ))}

          <div className="max-w-xl rounded-[28px] border border-white/12 bg-white/8 p-7 backdrop-blur-sm">
            <p className="text-[16px] italic leading-8 text-white/82 2xl:text-[17px] 2xl:leading-8">
              "Everything we need is easier to find now, and the reporting finally feels clear."
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-400 text-lg font-semibold">
                AR
              </div>
              <div>
                <p className="text-[15px] font-semibold">Aarav Rao</p>
                <p className="text-[12px] text-white/60">Client Marketing Lead</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-10 py-12 2xl:px-16">
        <div className="w-full max-w-[560px]">
          <LoginForm desktop />
        </div>
      </section>
    </div>
  );
}

function LoginForm({ desktop = false }: { desktop?: boolean }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loadingType, setLoadingType] = useState<"standard" | "google" | null>(null);
  const [error, setError] = useState("");
  const { login } = useAuth();

  async function beginLogin(type: "standard" | "google") {
    setLoadingType(type);
    setError("");

    const result = await login({
      email: type === "standard" ? email.trim() || undefined : undefined,
      idpHint: type === "google" ? GOOGLE_IDP_HINT : undefined,
    });

    if (!result.success) {
      setError(result.error || "Unable to start sign-in.");
      setLoadingType(null);
      return;
    }

    navigate("/");
  }

  return (
    <div className={desktop ? "space-y-8" : "space-y-6"}>
      <div className="space-y-3">
        {!desktop && (
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(180deg,#5661F6 0%,#4B44B6 100%)" }}
          >
            <Cloud className="h-7 w-7 text-white" />
          </div>
        )}

        <div className={desktop ? "space-y-4" : "space-y-2"}>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
            Welcome back
          </h1>
          <p className="max-w-xl text-[13px] leading-6 text-slate-500 md:text-[13px] md:leading-6">
            Sign in to continue. Your password stays inside Keycloak, and Google sign-in
            is available for linked accounts.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          <label className="text-[12px] font-semibold text-slate-700">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[12px] text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 md:h-12 md:text-[12px]"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
            <div className="space-y-1">
              <p className="text-[12px] font-medium text-slate-700">
                Password entry happens on the secure Keycloak page
              </p>
              <p className="text-[11px] leading-5 text-slate-500">
                After you continue, you can sign in with your password or use the Google
                button below for a linked Google account with the same email.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => beginLogin("standard")}
          disabled={loadingType !== null}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[12px] font-semibold text-white transition-opacity md:h-12 md:text-[12px]"
          style={{
            background: "linear-gradient(90deg,#5B61F6 0%,#6662EA 100%)",
            opacity: loadingType ? 0.72 : 1,
          }}
        >
          <span>{loadingType === "standard" ? "Redirecting..." : "Sign In"}</span>
          <ArrowRight className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            or
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => beginLogin("google")}
          disabled={loadingType !== null}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 md:h-12 md:text-[12px]"
          style={{ opacity: loadingType ? 0.72 : 1 }}
        >
          <GoogleIcon />
          <span>{loadingType === "google" ? "Redirecting..." : "Continue with Google"}</span>
        </button>

        <div className="flex flex-col gap-2 text-center text-[11px] leading-5 text-slate-500 md:text-[11px]">
          <p>
            Forgot your password? Use the reset option on the Keycloak sign-in screen
            after you continue.
          </p>
          <p>
            Don&apos;t have an account? Contact your administrator or agency owner to get
            invited.
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileLayout() {
  return (
    <div className="xl:hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white">
        <div
          className="px-6 pb-10 pt-8"
          style={{ background: "linear-gradient(180deg,#2F355D 0%,#37327D 100%)" }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-sm text-white/88 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4" />
              Keycloak protected
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/72">
              <Sparkles className="h-4 w-4" />
              CloudCRM
            </div>
          </div>

          <div className="space-y-4 text-white">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/12">
              <Cloud className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <h2 className="text-[26px] font-semibold leading-[1.1]">
                Welcome to your CloudCRM workspace
              </h2>
              <p className="text-[13px] leading-6 text-white/72">
                A shared place for teams and clients to review performance, stay aligned,
                and sign in securely.
              </p>
            </div>
          </div>
        </div>

        <div className="-mt-5 flex-1 rounded-t-[32px] bg-white px-6 pb-8 pt-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

export function Login() {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(94, 92, 230, 0.18), transparent 26%), linear-gradient(180deg,#EFF1F8 0%,#E5EAF6 100%)",
      }}
    >
      <MobileLayout />

      <DesktopLayout />
    </div>
  );
}
