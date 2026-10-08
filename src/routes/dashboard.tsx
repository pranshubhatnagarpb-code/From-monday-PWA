import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Appointment, DietPlan, ClientFeedback } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { planProgress } from "@/lib/plan";
import { LoadingSpinner, NoClientProfile } from "@/components/ui-cards";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Lightbulb,
  Quote,
  Sparkles,
} from "lucide-react";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const NOTES_PREVIEW = 4;

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [latestPlan, setLatestPlan] = useState<DietPlan | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<ClientFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllNotes, setShowAllNotes] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const fetchData = async () => {
      const [planRes, apptRes, feedbackRes] = await Promise.all([
        // Latest plan regardless of status — the PMS saves plans as "approved", not "active".
        supabase
          .from("diet_plans")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("*")
          .eq("client_id", clientProfile.id)
          .gte("appointment_date", new Date().toISOString().split("T")[0])
          .order("appointment_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("client_feedback")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setLatestPlan(planRes.data);
      setNextAppointment(apptRes.data);
      setLatestFeedback(feedbackRes.data);
      setLoading(false);
    };
    fetchData().finally(() => setLoading(false));
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;
  if (!clientProfile)
    return <NoClientProfile onSignOut={() => signOut().then(() => navigate({ to: "/login" }))} />;

  const firstName = clientProfile?.name?.split(" ")[0] ?? "there";
  const planData = latestPlan?.ai_plan_data;
  const hiddenSections = (planData?.hiddenSections as string[] | undefined) ?? [];
  const importantNotes = hiddenSections.includes("importantNotes")
    ? []
    : ((planData?.importantNotes as string[] | undefined) ?? []).filter((n) => n?.trim());
  const visibleNotes = showAllNotes ? importantNotes : importantNotes.slice(0, NOTES_PREVIEW);
  const progress = planProgress(latestPlan);
  const apptDate = nextAppointment
    ? new Date(`${nextAppointment.appointment_date}T00:00:00`)
    : null;

  return (
    <PageShell title="Dashboard">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {/* Hero: greeting + current plan */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(212_78%_38%)] via-[hsl(214_72%_30%)] to-[hsl(218_65%_20%)] p-5 text-white shadow-lg shadow-primary/20">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />

            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/70">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                {greeting()}, {firstName}
                <Sparkles className="mb-1 ml-1.5 inline h-5 w-5 text-sky-200" />
              </h2>

              {latestPlan ? (
                <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Your current plan
                  </p>
                  <p className="mt-1 line-clamp-2 font-display text-[15px] font-semibold leading-snug">
                    {latestPlan.plan_name ?? "Diet plan"}
                  </p>
                  {progress && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-white/90">{progress.label}</span>
                        <span className="text-white/60">{progress.percent}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-200 to-white transition-all"
                          style={{ width: `${Math.max(progress.percent, 3)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <Link
                    to="/diet-plan"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-transform active:scale-95"
                  >
                    View today's meals <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/80">
                  Your nutritionist will share your diet plan here soon.
                </p>
              )}
            </div>
          </section>

          {/* Important notes */}
          {importantNotes.length > 0 && (
            <section className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Lightbulb className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Important notes
                  </h3>
                  <p className="text-xs text-muted-foreground">Keep these in mind every day</p>
                </div>
              </div>
              <ol className="space-y-3">
                {visibleNotes.map((note, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{note}</span>
                  </li>
                ))}
              </ol>
              {importantNotes.length > NOTES_PREVIEW && (
                <button
                  onClick={() => setShowAllNotes((v) => !v)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  {showAllNotes ? "Show less" : `Show all ${importantNotes.length} notes`}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showAllNotes ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </section>
          )}

          {/* Next appointment */}
          <section className="flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-sm">
            {apptDate ? (
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border bg-background">
                <span className="w-full bg-primary py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {apptDate.toLocaleDateString("en-IN", { month: "short" })}
                </span>
                <span className="flex-1 pt-0.5 font-display text-2xl font-bold leading-none text-foreground">
                  {apptDate.getDate()}
                </span>
              </div>
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarDays className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Next appointment
              </p>
              {apptDate ? (
                <>
                  <p className="mt-0.5 font-display text-base font-semibold text-foreground">
                    {apptDate.toLocaleDateString("en-IN", { weekday: "long" })}
                  </p>
                  {nextAppointment?.appointment_time && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />{" "}
                      {nextAppointment.appointment_time.slice(0, 5)}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">Nothing scheduled yet</p>
              )}
            </div>
          </section>

          {/* Latest feedback */}
          {latestFeedback?.feedback_text && (
            <section className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-sky-400" />
              <Quote className="absolute right-4 top-4 h-10 w-10 text-primary/10" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Feedback from your nutritionist
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {latestFeedback.feedback_text}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(
                  latestFeedback.published_at ?? latestFeedback.created_at,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
