import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { HERO_GRADIENT } from "@/components/ui-cards";
import { Lock, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    window.location.href = "/dashboard";
    return null;
  }

  const normalizePhone = (raw: string) => {
    const trimmed = raw.trim().replace(/[\s-]/g, "");
    if (!trimmed) return "";
    // Ensure E.164: must start with + and country code
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const id = identifier.trim();
    if (!id) {
      setError(mode === "email" ? "Enter your email" : "Enter your phone number");
      return;
    }
    if (mode === "phone") {
      const normalized = normalizePhone(id);
      if (!/^\+\d{8,15}$/.test(normalized)) {
        setError("Enter phone with country code, e.g. +911234567890");
        return;
      }
    }
    setLoading(true);
    const payload =
      mode === "email" ? { email: id, password } : { phone: normalizePhone(id), password };
    const result = await signIn(payload);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const inputClass =
    "w-full rounded-2xl border bg-background py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Brand header */}
      <div
        className={`relative overflow-hidden ${HERO_GRADIENT} px-6 pb-24 pt-[calc(3.5rem+env(safe-area-inset-top))] text-center text-white`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex flex-col items-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-16 w-16 rounded-2xl bg-white p-1 shadow-xl shadow-black/20"
          />
          <h1 className="mt-4 font-display text-3xl font-bold">From Monday</h1>
          <p className="mt-1 text-sm text-white/75">Decoding Nutrition</p>
        </div>
      </div>

      {/* Sign-in card */}
      <div className="relative -mt-16 flex-1 px-5 pb-10">
        <div className="mx-auto w-full max-w-sm rounded-3xl border bg-card p-6 shadow-xl shadow-primary/10">
          <h2 className="font-display text-xl font-bold text-foreground">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to see your plan and progress.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
              {(["email", "phone"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setIdentifier("");
                    setError("");
                  }}
                  className={`rounded-full py-2 text-xs font-semibold transition-all ${
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "email" ? "Email" : "Phone"}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                {mode === "email" ? "Email" : "Phone"}
              </label>
              <div className="relative">
                {mode === "email" ? (
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                ) : (
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <input
                  id="identifier"
                  type={mode === "email" ? "email" : "tel"}
                  inputMode={mode === "email" ? "email" : "tel"}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={inputClass}
                  placeholder={mode === "email" ? "you@example.com" : "+911234567890"}
                  autoComplete={mode === "email" ? "email" : "tel"}
                />
              </div>
              {mode === "phone" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Include country code (e.g. +91 for India).
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have an account? Contact your nutritionist.
        </p>
      </div>
    </div>
  );
}
