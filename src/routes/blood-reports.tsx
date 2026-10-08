import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { BloodMarkerKey, BloodReportValues, ClientBloodReport } from "@/lib/types";
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
  FlaskConical,
  Plus,
  X,
  FileText,
  Info,
  LineChart as LineChartIcon,
  History,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/blood-reports")({
  component: BloodReportsPage,
});

// Mirrors PMS's blood_report_values columns (src/lib/bloodMarkers.ts).
const TRACKED_KEYS: { key: BloodMarkerKey; label: string; unit: string }[] = [
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL" },
  { key: "fasting_blood_sugar", label: "Fasting Blood Sugar", unit: "mg/dL" },
  { key: "postprandial_blood_sugar", label: "Postprandial Blood Sugar", unit: "mg/dL" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "total_cholesterol", label: "Total Cholesterol", unit: "mg/dL" },
  { key: "triglycerides", label: "Triglycerides", unit: "mg/dL" },
  { key: "hdl", label: "HDL", unit: "mg/dL" },
  { key: "ldl", label: "LDL", unit: "mg/dL" },
  { key: "vldl", label: "VLDL", unit: "mg/dL" },
  { key: "vitamin_d", label: "Vitamin D", unit: "ng/mL" },
  { key: "vitamin_b12", label: "Vitamin B12", unit: "pg/mL" },
  { key: "tsh", label: "TSH", unit: "µIU/mL" },
  { key: "uric_acid", label: "Uric Acid", unit: "mg/dL" },
  { key: "creatinine", label: "Creatinine", unit: "mg/dL" },
  { key: "iron", label: "Iron", unit: "µg/dL" },
  { key: "ferritin", label: "Ferritin", unit: "ng/mL" },
  { key: "calcium", label: "Calcium", unit: "mg/dL" },
];

function flattenValues(row: ClientBloodReport): BloodReportValues | null {
  const v = row.blood_report_values;
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function BloodReportsPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ClientBloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    if (!clientProfile) return;
    const { data } = await supabase
      .from("blood_reports")
      .select("*, blood_report_values(*)")
      .eq("client_id", clientProfile.id)
      .order("report_date", { ascending: true });
    setReports((data ?? []) as ClientBloodReport[]);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (clientProfile) load().finally(() => setLoading(false));
  }, [clientProfile, load]);

  const trends = useMemo(() => {
    return TRACKED_KEYS.map((t) => {
      const series = reports
        .map((r) => {
          const values = flattenValues(r);
          const v = values?.[t.key];
          if (typeof v !== "number" || !r.report_date) return null;
          return {
            date: new Date(r.report_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            }),
            value: v,
          };
        })
        .filter((p): p is { date: string; value: number } => p !== null);
      return { ...t, series };
    }).filter((t) => t.series.length > 0);
  }, [reports]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;
  if (!clientProfile)
    return <NoClientProfile onSignOut={() => signOut().then(() => navigate({ to: "/login" }))} />;

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;

  return (
    <PageShell title="Blood Reports">
      <div className="space-y-4">
        <PageHero
          eyebrow="Lab reports"
          title="Your blood markers"
          subtitle="Log test results and see how key markers change over time."
          icon={<FlaskConical />}
        >
          {reports.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <HeroStat label="Reports" value={reports.length} />
              <HeroStat
                label="Latest"
                value={
                  latestReport?.report_date
                    ? new Date(latestReport.report_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"
                }
                hint={latestReport?.lab_name ?? undefined}
              />
            </div>
          )}
          {clientProfile && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-transform active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Add blood report
            </button>
          )}
        </PageHero>

        <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>Your nutritionist may also upload lab reports directly to your file.</p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FlaskConical />}
            title="No blood reports yet"
            description="Tap “Add blood report” above to log a test, or your nutritionist will add one for you."
          />
        ) : (
          <>
            {trends.map((t) => (
              <SectionCard
                key={t.key}
                icon={<LineChartIcon />}
                iconClassName="bg-violet-100 text-violet-700"
                title={t.label}
                subtitle={`in ${t.unit}`}
              >
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={t.series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`blood-${t.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                      fill={`url(#blood-${t.key})`}
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
            ))}

            <SectionCard
              icon={<History />}
              iconClassName="bg-muted text-muted-foreground"
              title="Report history"
            >
              <div className="divide-y divide-border">
                {[...reports].reverse().map((r) => {
                  const values = flattenValues(r);
                  const filled = TRACKED_KEYS.map((t) => ({
                    ...t,
                    value: values?.[t.key],
                  })).filter((x): x is typeof x & { value: number } => typeof x.value === "number");
                  return (
                    <div key={r.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {r.report_date
                              ? new Date(r.report_date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              : "Undated report"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.lab_name
                              ? r.lab_name
                              : `Logged ${new Date(r.created_at).toLocaleDateString("en-IN")}`}
                          </p>
                        </div>
                      </div>
                      {filled.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {filled.map((m) => (
                            <div key={m.key} className="rounded-xl bg-muted/50 px-3 py-2">
                              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {m.label}
                              </p>
                              <p className="text-sm font-semibold text-foreground">
                                {m.value}
                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                  {m.unit}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.notes && <p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {showForm && clientProfile && (
        <BloodReportForm
          clientId={clientProfile.id}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setLoading(true);
            load();
          }}
        />
      )}
    </PageShell>
  );
}

interface FormProps {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}

function BloodReportForm({ clientId, onClose, onSaved }: FormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [labName, setLabName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVal = (k: BloodMarkerKey, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const extracted: BloodReportValues = {};
    for (const t of TRACKED_KEYS) {
      const raw = values[t.key]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100000) {
        setError(`Invalid ${t.label}`);
        return;
      }
      extracted[t.key] = n;
    }

    if (Object.keys(extracted).length === 0 && !notes.trim()) {
      setError("Enter at least one value or a note");
      return;
    }

    setSaving(true);
    const { data: report, error: reportErr } = await supabase
      .from("blood_reports")
      .insert({
        client_id: clientId,
        report_date: date,
        lab_name: labName.trim() || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (reportErr || !report) {
      setSaving(false);
      setError(reportErr?.message ?? "Could not save report");
      return;
    }

    const { error: valuesErr } = await supabase.from("blood_report_values").insert({
      report_id: report.id,
      ...extracted,
    });
    setSaving(false);
    if (valuesErr) {
      setError(valuesErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-sm animate-in fade-in sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-8 sm:rounded-3xl sm:pb-5">
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Add Blood Report</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Report Date
              </label>
              <input
                type="date"
                value={date}
                max={today}
                required
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lab Name
              </label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TRACKED_KEYS.map((t) => (
              <div key={t.key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.label} <span className="lowercase">({t.unit})</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={values[t.key] ?? ""}
                  onChange={(e) => setVal(t.key, e.target.value)}
                  placeholder="—"
                  className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Doctor, observations…"
              className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
