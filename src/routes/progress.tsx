import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientMeasurement, ProgressEntry } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import {
  EmptyState,
  LoadingSpinner,
  NoClientProfile,
  PageHero,
  HeroStat,
  SectionCard,
} from "@/components/ui-cards";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  Ruler,
  Percent,
  Plus,
  HeartPulse,
  ChevronDown,
  History,
  LineChart as LineChartIcon,
} from "lucide-react";
import { MeasurementForm } from "@/components/measurement-form";
import { HealthCheckinForm } from "@/components/health-checkin-form";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

type MetricKey =
  | "weight"
  | "bmi"
  | "body_fat_percent"
  | "waist"
  | "hip"
  | "chest"
  | "thigh"
  | "arm"
  | "neck"
  | "calf";

const METRIC_LABEL: Record<MetricKey, string> = {
  weight: "Weight",
  bmi: "BMI",
  body_fat_percent: "Body Fat",
  waist: "Waist",
  hip: "Hip",
  chest: "Chest",
  thigh: "Thigh",
  arm: "Arm",
  neck: "Neck",
  calf: "Calf",
};

const METRIC_UNIT: Record<MetricKey, string> = {
  weight: "kg",
  bmi: "",
  body_fat_percent: "%",
  waist: "cm",
  hip: "cm",
  chest: "cm",
  thigh: "cm",
  arm: "cm",
  neck: "cm",
  calf: "cm",
};

const SUMMARY_METRICS: MetricKey[] = ["weight", "bmi", "waist", "hip", "body_fat_percent"];
const CHART_METRICS: MetricKey[] = ["weight", "bmi", "waist"];

// Lower is better for these metrics
const LOWER_IS_BETTER: MetricKey[] = [
  "weight",
  "bmi",
  "body_fat_percent",
  "waist",
  "hip",
  "chest",
  "thigh",
  "arm",
  "neck",
  "calf",
];

interface MetricTrend {
  key: MetricKey;
  first: number;
  latest: number;
  change: number;
  pct: number;
  positive: boolean; // true = improvement
}

function buildTrends(measurements: ClientMeasurement[]): MetricTrend[] {
  if (measurements.length < 2) return [];
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const trends: MetricTrend[] = [];
  for (const key of HISTORY_METRICS) {
    const f = first[key];
    const l = last[key];
    if (typeof f !== "number" || typeof l !== "number") continue;
    const change = l - f;
    const pct = f !== 0 ? (change / f) * 100 : 0;
    const positive = LOWER_IS_BETTER.includes(key) ? change < 0 : change > 0;
    trends.push({ key, first: f, latest: l, change, pct, positive });
  }
  return trends;
}

function OverallAnalysisCard({ measurements }: { measurements: ClientMeasurement[] }) {
  const trends = buildTrends(measurements);

  if (trends.length === 0) {
    return (
      <SectionCard icon={<TrendingUp />} title="Overall analysis">
        <p className="text-sm text-muted-foreground">
          Log at least 2 measurements to see your trend analysis.
        </p>
      </SectionCard>
    );
  }

  const improved = trends.filter((t) => t.positive);
  const worsened = trends.filter((t) => !t.positive && Math.abs(t.change) > 0.01);

  const spanDays = Math.round(
    (new Date(measurements[measurements.length - 1].measurement_date).getTime() -
      new Date(measurements[0].measurement_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  let headline = "";
  if (improved.length > worsened.length) {
    headline = "Overall progress is looking positive!";
  } else if (worsened.length > improved.length) {
    headline = "Some metrics need attention — keep going!";
  } else {
    headline = "Mixed progress — consistency is key.";
  }

  // Bar chart data: % change, positive = improvement (flipped sign for "lower is better" metrics)
  const chartData = trends.map((t) => ({
    name: METRIC_LABEL[t.key],
    pct: parseFloat((t.positive ? Math.abs(t.pct) : -Math.abs(t.pct)).toFixed(1)),
    positive: t.positive,
  }));

  return (
    <SectionCard
      icon={<TrendingUp />}
      iconClassName="bg-emerald-100 text-emerald-700"
      title="Overall analysis"
      subtitle={
        spanDays > 0 ? `${headline} · over ${spanDays} day${spanDays !== 1 ? "s" : ""}` : headline
      }
    >
      {/* Bar chart: % change per metric */}
      <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 32)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${v}%`, "Change"]}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.positive ? "var(--color-success)" : "var(--color-destructive)"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
          {improved.length} improving
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
          {worsened.length} to work on
        </span>
      </div>
    </SectionCard>
  );
}
const HISTORY_METRICS: MetricKey[] = [
  "weight",
  "bmi",
  "body_fat_percent",
  "waist",
  "hip",
  "chest",
  "thigh",
  "arm",
  "neck",
  "calf",
];

function MetricIcon({ k }: { k: MetricKey }): ReactNode {
  if (k === "weight") return <Scale className="h-4 w-4" />;
  if (k === "bmi") return <Activity className="h-4 w-4" />;
  if (k === "body_fat_percent") return <Percent className="h-4 w-4" />;
  return <Ruler className="h-4 w-4" />;
}

function ProgressPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<ClientMeasurement[]>([]);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadMeasurements = useCallback(async () => {
    if (!clientProfile) return;
    const [measRes, entriesRes] = await Promise.all([
      supabase
        .from("body_measurements")
        .select("*")
        .eq("client_id", clientProfile.id)
        .order("measurement_date", { ascending: true }),
      supabase
        .from("client_progress_entries")
        .select("*")
        .eq("client_id", clientProfile.id)
        .order("entry_date", { ascending: false }),
    ]);
    setMeasurements((measRes.data ?? []) as ClientMeasurement[]);
    setProgressEntries((entriesRes.data ?? []) as ProgressEntry[]);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (!clientProfile) return;
    loadMeasurements().finally(() => setLoading(false));
  }, [clientProfile, loadMeasurements]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;
  if (!clientProfile)
    return <NoClientProfile onSignOut={() => signOut().then(() => navigate({ to: "/login" }))} />;

  // latest measurement (last in asc order)
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;

  // which metrics actually have any data?
  const hasData = (k: MetricKey) => measurements.some((m) => m[k] !== null && m[k] !== undefined);

  const summaryAvailable = SUMMARY_METRICS.filter(hasData);
  const chartsAvailable = CHART_METRICS.filter(hasData);

  const isImprovement = (k: MetricKey, d: number) => (LOWER_IS_BETTER.includes(k) ? d < 0 : d > 0);
  const firstWeight = measurements.find((m) => typeof m.weight === "number")?.weight ?? null;
  const totalWeightChange =
    typeof latest?.weight === "number" && typeof firstWeight === "number"
      ? latest.weight - firstWeight
      : null;

  return (
    <PageShell title="My Progress">
      <div className="space-y-4">
        {/* Hero */}
        <PageHero
          eyebrow="Your progress"
          title="Track your journey"
          subtitle={
            latest
              ? `Last measured ${new Date(latest.measurement_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : "Log check-ins and measurements to see your progress"
          }
          icon={<TrendingUp />}
        >
          {(latest?.weight != null || latest?.bmi != null) && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroStat
                label="Weight"
                value={latest?.weight ?? "—"}
                hint={latest?.weight != null ? "kg" : undefined}
              />
              <HeroStat
                label="Change"
                value={
                  totalWeightChange != null
                    ? `${totalWeightChange > 0 ? "+" : ""}${totalWeightChange.toFixed(1)}`
                    : "—"
                }
                hint={totalWeightChange != null ? "kg overall" : undefined}
              />
              <HeroStat label="BMI" value={latest?.bmi ?? "—"} />
            </div>
          )}
          {clientProfile && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCheckinForm(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-transform active:scale-95"
              >
                <HeartPulse className="h-3.5 w-3.5" /> Log check-in
              </button>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition-transform active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" /> Add measurement
              </button>
            </div>
          )}
        </PageHero>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Latest summary */}
            {latest && summaryAvailable.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {summaryAvailable.map((k) => {
                  const val = latest[k];
                  const prev = previous?.[k];
                  const delta =
                    typeof val === "number" && typeof prev === "number" ? val - prev : null;
                  const good = delta !== null && delta !== 0 && isImprovement(k, delta);
                  return (
                    <div key={k} className="rounded-3xl border bg-card p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <MetricIcon k={k} />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {METRIC_LABEL[k]}
                        </span>
                      </div>
                      <p className="font-display text-2xl font-bold text-foreground">
                        {val ?? "—"}
                        {val !== null && METRIC_UNIT[k] && (
                          <span className="ml-1 text-sm font-medium text-muted-foreground">
                            {METRIC_UNIT[k]}
                          </span>
                        )}
                      </p>
                      {delta !== null && (
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            delta === 0
                              ? "bg-muted text-muted-foreground"
                              : good
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {delta < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)} {METRIC_UNIT[k]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Health check-ins */}
            <SectionCard
              icon={<HeartPulse />}
              iconClassName="bg-rose-100 text-rose-600"
              title="Health check-ins"
              subtitle="How you've been feeling"
            >
              {progressEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No check-ins yet. Tap “Log check-in” above to record your first one.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {progressEntries.map((entry) => {
                    const isOpen = expandedEntry === entry.id;
                    const ratings = [
                      ["Sleep", entry.sleep_quality_rating],
                      ["Digestion", entry.digestion_rating],
                      ["Energy", entry.energy_rating],
                      ["Skin", entry.skin_rating],
                      ["Hair", entry.hair_rating],
                    ].filter(([, v]) => v != null) as [string, number][];
                    return (
                      <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                        <button
                          onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {entry.weight_kg && (
                                <span className="ml-2 font-normal text-muted-foreground">
                                  {entry.weight_kg} kg
                                </span>
                              )}
                            </p>
                            {ratings.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {ratings.slice(0, 3).map(([label, val]) => (
                                  <span
                                    key={label}
                                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                  >
                                    {label} {val}/5
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ChevronDown
                            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {isOpen && (
                          <div className="mt-3 space-y-2 rounded-2xl bg-muted/50 p-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {entry.weight_kg != null && (
                                <div>
                                  <span className="text-muted-foreground">Weight </span>
                                  <span className="font-medium">{entry.weight_kg} kg</span>
                                </div>
                              )}
                              {entry.sleep_hours != null && (
                                <div>
                                  <span className="text-muted-foreground">Sleep </span>
                                  <span className="font-medium">{entry.sleep_hours} hrs</span>
                                </div>
                              )}
                              {entry.water_intake && (
                                <div>
                                  <span className="text-muted-foreground">Water </span>
                                  <span className="font-medium">{entry.water_intake}</span>
                                </div>
                              )}
                              {entry.activity_level && (
                                <div>
                                  <span className="text-muted-foreground">Activity </span>
                                  <span className="font-medium capitalize">
                                    {entry.activity_level.replace("_", " ")}
                                  </span>
                                </div>
                              )}
                              {entry.screen_time_hrs != null && (
                                <div>
                                  <span className="text-muted-foreground">Screen </span>
                                  <span className="font-medium">{entry.screen_time_hrs} hrs</span>
                                </div>
                              )}
                              {entry.stress_rating != null && (
                                <div>
                                  <span className="text-muted-foreground">Stress </span>
                                  <span className="font-medium">{entry.stress_rating}/5</span>
                                </div>
                              )}
                            </div>
                            {ratings.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2 text-xs">
                                {(
                                  [
                                    ["Sleep quality", entry.sleep_quality_rating],
                                    ["Digestion", entry.digestion_rating],
                                    ["Energy", entry.energy_rating],
                                    ["Fatigue", entry.fatigue_rating],
                                    ["Skin", entry.skin_rating],
                                    ["Hair", entry.hair_rating],
                                    ["Acidity", entry.acidity_rating],
                                    ["Bloating", entry.bloating_rating],
                                  ] as [string, number | null][]
                                )
                                  .filter(([, v]) => v != null)
                                  .map(([label, val]) => (
                                    <div key={label}>
                                      <span className="text-muted-foreground">{label} </span>
                                      <span className="font-medium">{val}/5</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                            {entry.blood_parameters?.length ? (
                              <p className="border-t border-border/70 pt-2 text-xs text-muted-foreground">
                                Blood markers: {entry.blood_parameters.join(", ")}
                              </p>
                            ) : null}
                            {entry.notes && (
                              <p className="border-t border-border/70 pt-2 text-xs text-muted-foreground">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {measurements.length === 0 ? (
              <EmptyState
                icon={<TrendingUp />}
                title="No measurements yet"
                description="Tap “Add measurement” above to log your first one, or wait for your nutritionist to record it."
              />
            ) : (
              <>
                {/* Trends */}
                <OverallAnalysisCard measurements={measurements} />
                {chartsAvailable.map((k) => {
                  const data = measurements
                    .filter((m) => m[k] !== null && m[k] !== undefined)
                    .map((m) => ({
                      date: new Date(m.measurement_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      }),
                      value: m[k],
                    }));
                  if (data.length === 0) return null;
                  return (
                    <SectionCard
                      key={k}
                      icon={<LineChartIcon />}
                      title={`${METRIC_LABEL[k]} trend`}
                      subtitle={METRIC_UNIT[k] ? `in ${METRIC_UNIT[k]}` : undefined}
                    >
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            axisLine={false}
                            tickLine={false}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: "0.75rem",
                              fontSize: 12,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="var(--primary)"
                            strokeWidth={2.5}
                            fill={`url(#fill-${k})`}
                            dot={{
                              fill: "var(--card)",
                              stroke: "var(--primary)",
                              strokeWidth: 2,
                              r: 3.5,
                            }}
                            activeDot={{ r: 5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </SectionCard>
                  );
                })}

                {/* History */}
                <SectionCard
                  icon={<History />}
                  iconClassName="bg-muted text-muted-foreground"
                  title="Measurement history"
                >
                  <div className="divide-y divide-border">
                    {[...measurements].reverse().map((m) => {
                      const visibleMetrics = HISTORY_METRICS.filter(
                        (k) => m[k] !== null && m[k] !== undefined,
                      );
                      const note = m.notes ?? null;
                      return (
                        <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="mb-2 text-sm font-semibold text-foreground">
                            {new Date(m.measurement_date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          {visibleMetrics.length > 0 && (
                            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                              {visibleMetrics.map((k) => (
                                <div key={k}>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    {METRIC_LABEL[k]}
                                  </p>
                                  <p className="text-sm font-semibold text-foreground">
                                    {m[k]}
                                    {METRIC_UNIT[k] && (
                                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                        {METRIC_UNIT[k]}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </>
            )}
          </>
        )}
      </div>

      {showCheckinForm && clientProfile && (
        <HealthCheckinForm
          clientProfile={clientProfile}
          onClose={() => setShowCheckinForm(false)}
          onSaved={() => {
            setShowCheckinForm(false);
            setLoading(true);
            loadMeasurements();
          }}
        />
      )}

      {showForm && clientProfile && (
        <MeasurementForm
          clientId={clientProfile.id}
          heightCm={clientProfile.height ?? null}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setLoading(true);
            loadMeasurements();
          }}
        />
      )}
    </PageShell>
  );
}
