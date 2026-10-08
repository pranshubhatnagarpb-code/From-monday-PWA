import type { DietPlan } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface PlanMeal {
  period?: string;
  time?: string;
  foodPlan?: string;
  alternative?: string;
  notes?: string;
}

export interface PlanDayGroup {
  label?: string;
  meals?: PlanMeal[];
}

export const planDayGroups = (plan: DietPlan | null): PlanDayGroup[] =>
  ((plan?.ai_plan_data?.dayGroups as PlanDayGroup[] | undefined) ?? []).filter(
    (g) => g?.meals?.length,
  );

export function planStartDate(plan: DietPlan | null): string | null {
  if (!plan) return null;
  const ai = plan.ai_plan_data ?? {};
  return (ai.editableStartDate as string) || (ai.startDate as string) || plan.start_date || null;
}

export function planDayCount(plan: DietPlan | null): number {
  const ai = plan?.ai_plan_data ?? {};
  return parseInt((ai.editableDayCount as string) || "", 10) || planDayGroups(plan).length || 0;
}

/** Where the client is in their plan: "Day 3 of 14", "Starts in 2 days", or done. */
export function planProgress(plan: DietPlan | null) {
  const startStr = planStartDate(plan);
  const total = planDayCount(plan);
  if (!startStr || !total) return null;
  const start = startOfDay(new Date(`${startStr.slice(0, 10)}T00:00:00`));
  if (isNaN(start.getTime())) return null;
  const day = Math.floor((startOfDay(new Date()).getTime() - start.getTime()) / DAY_MS) + 1;
  if (day < 1) return { label: `Starts in ${1 - day} day${1 - day === 1 ? "" : "s"}`, percent: 0 };
  if (day > total) return { label: `Completed · ${total} days`, percent: 100 };
  return { label: `Day ${day} of ${total}`, percent: Math.round((day / total) * 100) };
}

/** Day groups are labelled by weekday ("Monday & Thursday", "Friday, 9 Oct"); pick today's. */
export function todayGroupIndex(groups: PlanDayGroup[]): number {
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const idx = groups.findIndex((g) => (g.label ?? "").toLowerCase().includes(weekday));
  return idx === -1 ? 0 : idx;
}

export function formatPlanRange(plan: DietPlan | null): string | null {
  const startStr = planStartDate(plan);
  const total = planDayCount(plan);
  if (!startStr) return null;
  const start = new Date(`${startStr.slice(0, 10)}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (!total) return `From ${fmt(start)}`;
  return `${fmt(start)} – ${fmt(new Date(start.getTime() + (total - 1) * DAY_MS))}`;
}
