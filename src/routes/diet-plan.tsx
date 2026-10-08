import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, Client } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import {
  EmptyState,
  LoadingSpinner,
  NoClientProfile,
  PageHero,
  SectionCard,
} from "@/components/ui-cards";
import { formatPlanRange, planDayGroups, planProgress, todayGroupIndex } from "@/lib/plan";
import {
  Utensils,
  CalendarDays,
  FileText,
  Download,
  ShoppingCart,
  ExternalLink,
  ChevronDown,
  Clock,
  BookOpen,
  ListChecks,
  History,
} from "lucide-react";

function calculateAge(dateOfBirth: string | null): number {
  if (!dateOfBirth) return 0;
  const birthDate = new Date(dateOfBirth);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Format date from yyyy-mm-dd to dd-mm-yyyy — mirrors the PMS PDF generator
// (AIDietPlanGenerator.tsx generatePDF) so both apps render identical dates.
function formatPdfDate(dateString: string): string {
  if (!dateString) return "Not specified";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function escapePdfHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");
}

function escapePdfPlainText(str: string | null | undefined): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const normalizeMealName = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

// Mirrors extractMealCandidates() in AIDietPlanGenerator.tsx so the client
// PDF matches the same recipes the PMS PDF would attach.
function extractMealCandidates(dayGroups: any[]): string[] {
  const raw: string[] = [];
  dayGroups.forEach((dg) => {
    (dg.meals ?? []).forEach((m: any) => {
      [m.foodPlan, m.alternative].forEach((text?: string) => {
        if (!text) return;
        text.split(/\n|,|;|\/|\+|\bor\b|\band\b|\bwith\b/i).forEach((piece) => {
          const cleaned = piece
            .replace(/\(.*?\)/g, "")
            .replace(/\d+\s*(g|ml|gm|kg|tsp|tbsp|cup|cups|pcs|piece|pieces|bowl|glass)\b/gi, "")
            .trim();
          if (cleaned.length >= 3) raw.push(cleaned);
        });
      });
    });
  });
  const seen = new Set<string>();
  const result: string[] = [];
  raw.forEach((r) => {
    const n = normalizeMealName(r);
    if (n && !seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  });
  return result;
}

type MatchedRecipe = {
  Meal_name: string;
  Ingredients: string;
  Instructions: string;
  Remarks: string;
};

// Mirrors fetchMatchedRecipes() in AIDietPlanGenerator.tsx. meal_recipes is
// readable by the client portal role (see migration
// 20260902000000_client_portal_meal_recipes_read.sql) so this returns the
// same matches the PMS PDF would.
async function fetchMatchedRecipes(dayGroups: any[]): Promise<MatchedRecipe[]> {
  const candidates = extractMealCandidates(dayGroups);
  if (candidates.length === 0) return [];
  const { data, error } = await supabase
    .from("meal_recipes")
    .select("Meal_name, meal_name_normalized, Ingredients, Instructions, Remarks")
    .limit(5000);
  if (error || !data) return [];
  const seen = new Set<string>();
  const out: MatchedRecipe[] = [];
  candidates.forEach((c) => {
    const match = (data as any[]).find((r) => {
      const recipeKey = r.meal_name_normalized as string;
      return c === recipeKey || c.includes(recipeKey) || recipeKey.includes(c);
    });
    if (match && !seen.has(match.meal_name_normalized)) {
      seen.add(match.meal_name_normalized);
      out.push({
        Meal_name: match.Meal_name,
        Ingredients: match.Ingredients || "",
        Instructions: match.Instructions || "",
        Remarks: match.Remarks || "",
      });
    }
  });
  return out;
}

// Renders a diet plan to the exact same HTML/PDF layout as the PMS
// "Download PDF" action (PMS-From-Monday-main/src/components/diet/AIDietPlanGenerator.tsx
// generatePDF) so a plan looks identical whether downloaded by staff or by the client.
async function openPlanAsPdf(
  plan: DietPlan,
  clientProfile: Client | null,
  affiliateProducts: { product_name: string; link: string }[] = [],
): Promise<void> {
  const ai = plan.ai_plan_data as Record<string, unknown> | null;

  const buildHtml = async (logoDataUrl: string) => {
    let bodyHtml: string;

    if (ai) {
      const dayGroups = (ai.dayGroups as any[]) ?? [];
      const affirmations = (ai.affirmations as string[]) ?? [];
      const importantNotes = (ai.importantNotes as string[]) ?? [];
      const oilGuidelines = ai.oilGuidelines as any;
      const weeklyGroceryList = (ai.weeklyGroceryList as any[]) ?? [];
      const hiddenSections = (ai.hiddenSections as string[]) ?? [];
      const isSectionHidden = (key: string) => hiddenSections.includes(key);

      const name = clientProfile?.name ?? "Client";
      const age = calculateAge(clientProfile?.date_of_birth ?? null);
      const gender = clientProfile?.gender || "Not specified";
      const height = clientProfile?.height ?? "--";
      const weight = clientProfile?.weight ?? "--";
      const skinType = clientProfile?.skin_type || "Not specified";
      const hairType = clientProfile?.hair_type || "Not specified";
      const goal = clientProfile?.goal || "Not specified";
      const dietPreference =
        clientProfile?.diet_preference === "non-vegetarian"
          ? "non-vegetarian"
          : clientProfile?.diet_preference === "vegetarian"
            ? "vegetarian"
            : "both";

      const editableStartDate = (ai.editableStartDate as string) || "";
      const editableDayCount = (ai.editableDayCount as string) || "";

      const getDateRange = () => {
        const startDateStr = editableStartDate || (ai.startDate as string) || "";
        if (!startDateStr) return "Not specified";
        const startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) return startDateStr;
        const daysToAdd = parseInt(editableDayCount || "7");
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + daysToAdd - 1);
        return `${formatPdfDate(startDateStr)} to ${formatPdfDate(endDate.toISOString().split("T")[0])}`;
      };

      const dayGroupTables = dayGroups
        .map(
          (group: any) => `
      <div class="day-block">
        <h3 class="day-heading">${group.label ?? ""}${group.dates ? ` <span class="day-date">(${group.dates})</span>` : ""}</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Period</th>
              <th style="width: 10%;">Time</th>
              <th style="width: 45%;">Lifestyle Plan</th>
              <th style="width: 30%;">Alternative</th>
            </tr>
          </thead>
          <tbody>
            ${((group.meals ?? []) as any[])
              .map(
                (meal: any) => `
              <tr>
                <td class="period-cell">${meal.period ?? ""}</td>
                <td class="time-cell">${meal.time ?? ""}</td>
                <td class="food-cell">${escapePdfHtml(meal.foodPlan)}${meal.notes ? `<div class="meal-notes">${escapePdfHtml(meal.notes)}</div>` : ""}</td>
                <td class="food-cell alt-cell">${escapePdfHtml(meal.alternative || "-")}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`,
        )
        .join("");

      const planDisplayName = String(ai.planName ?? plan.plan_name ?? "Diet Plan").replace(
        /food plan/gi,
        "Lifestyle Plan",
      );

      const matchedRecipes = await fetchMatchedRecipes(dayGroups);
      const recipesSection =
        matchedRecipes.length > 0
          ? `
  <div class="page-break" style="page-break-before: always;"></div>
  <div style="margin-top: 24px;">
    <h2 style="color: #1F5CA0; font-size: 18px; border-bottom: 2px solid #1F5CA0; padding-bottom: 6px; margin-bottom: 14px;">Recipes for mentioned meals</h2>
    ${matchedRecipes
      .map(
        (r) => `
      <div style="margin-bottom: 16px; page-break-inside: avoid;">
        <h3 style="color: #1F5CA0; font-size: 13px; margin-bottom: 6px;">${escapePdfPlainText(r.Meal_name)}</h3>
        ${r.Ingredients ? `<div style="font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 6px;"><strong>Ingredients:</strong><br/><span style="white-space: pre-wrap;">${escapePdfPlainText(r.Ingredients)}</span></div>` : ""}
        <div style="font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 6px;"><strong>Instructions:</strong><br/><span style="white-space: pre-wrap;">${escapePdfPlainText(r.Instructions)}</span></div>
        ${r.Remarks ? `<div style="font-size: 11px; line-height: 1.5; color: #555;"><strong>Remarks:</strong><br/><span style="white-space: pre-wrap;">${escapePdfPlainText(r.Remarks)}</span></div>` : ""}
      </div>`,
      )
      .join("")}
  </div>`
          : "";

      const affiliateSection =
        affiliateProducts.length > 0
          ? `
  <div style="margin-top:24px;page-break-inside:avoid">
    <h2 style="color:#b45309;font-size:15px;border-bottom:2px solid #f59e0b;padding-bottom:6px;margin-bottom:12px">🛒 Shop Recommended Products</h2>
    <table style="width:100%;border-collapse:collapse;font-size:10px">
      <thead>
        <tr>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left;width:40%">Product</th>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left">Buy Link</th>
        </tr>
      </thead>
      <tbody>
        ${affiliateProducts
          .map(
            (p, i) => `
          <tr style="background:${i % 2 === 0 ? "#fffbeb" : "#ffffff"}">
            <td style="padding:7px 10px;border-bottom:1px solid #fde68a;font-weight:500">${escapePdfPlainText(p.product_name)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #fde68a">
              <a href="${p.link}" style="color:#b45309;text-decoration:underline;word-break:break-all">${p.link}</a>
            </td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`
          : "";

      bodyHtml = `
  <div class="header">
    <img src="${logoDataUrl}" alt="Clinic Logo" class="header-logo" />
    <div class="header-title">
      <h1>${planDisplayName}</h1>
    </div>
  </div>
  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-details-grid">
      <div><span>Name:</span> ${name}</div>
      <div><span>Age:</span> ${age} years</div>
      <div><span>Gender:</span> ${gender}</div>
      <div><span>Height/Weight:</span> ${height}cm / ${weight}kg</div>
      <div><span>Skin Type:</span> ${skinType}</div>
      <div><span>Hair Type:</span> ${hairType}</div>
      <div><span>Goal:</span> ${goal}</div>
      <div><span>Diet Preference:</span> ${dietPreference}</div>
      <div><span>Date:</span> ${getDateRange()}</div>
      <div><span>Duration:</span> ${editableDayCount || "7"} days</div>
    </div>
  </div>

  ${
    !isSectionHidden("importantNotes") && importantNotes.length > 0
      ? `
  <div class="important-notes">
    <h4>⚠️ Important Notes:</h4>
    <ul style="padding-left: 15px;">
      ${importantNotes.map((n) => `<li>${n}</li>`).join("")}
    </ul>
  </div>`
      : ""
  }

  ${
    !isSectionHidden("affirmations") && affirmations.length > 0
      ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${name}:</h3>
    <ul>
      ${affirmations.map((a) => `<li>${a}</li>`).join("")}
    </ul>
  </div>`
      : ""
  }

  ${dayGroupTables}

  ${!isSectionHidden("servingSize") || !isSectionHidden("oilGuidelines") ? `<h3 class="section-title">Additional Guidelines</h3>` : ""}

  ${
    !isSectionHidden("servingSize")
      ? `
  <div class="serving-size">
    <strong>Serving Size:</strong> ${ai.servingSize || "1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml"}
  </div>`
      : ""
  }

  ${
    !isSectionHidden("oilGuidelines") && oilGuidelines
      ? `
  <div>
    <h4 style="font-size: 11px; color: #333; margin-bottom: 6px;">Use of Oils:</h4>
    <div class="oil-grid">
      <div class="oil-card">
        <h4>Cooking - Group A</h4>
        <ul style="list-style:none;padding:0;">${(oilGuidelines.cooking?.groupA || []).map((o: string) => `<li>- ${o}</li>`).join("")}</ul>
      </div>
      <div class="oil-card">
        <h4>Cooking - Group B</h4>
        <ul style="list-style:none;padding:0;">${(oilGuidelines.cooking?.groupB || []).map((o: string) => `<li>- ${o}</li>`).join("")}</ul>
      </div>
      <div class="oil-card">
        <h4>Raw/Topping</h4>
        <ul style="list-style:none;padding:0;">${(oilGuidelines.raw || []).map((o: string) => `<li>- ${o}</li>`).join("")}</ul>
      </div>
      <div class="oil-card">
        <h4>Deep Frying</h4>
        <ul style="list-style:none;padding:0;">${(oilGuidelines.deepFrying || []).map((o: string) => `<li>- ${o}</li>`).join("")}</ul>
      </div>
    </div>
    <p class="oil-note">${oilGuidelines.note || ""}</p>
  </div>`
      : ""
  }

  ${
    !isSectionHidden("weeklyGroceryList") && weeklyGroceryList.length > 0
      ? `
  <h3 class="section-title">🛒 Weekly Grocery List</h3>
  <div class="grocery-grid">
    ${weeklyGroceryList
      .map(
        (cat: any) => `
      <div class="grocery-card">
        <h4>${cat.category}</h4>
        <ul>${(cat.items ?? []).map((item: string) => `<li>${item}</li>`).join("")}</ul>
      </div>`,
      )
      .join("")}
  </div>`
      : ""
  }

  ${
    ["skinCareTips", "hairCareTips", "healthNotes", "supplements"].some((k) => !isSectionHidden(k))
      ? `
  <div class="tips-grid">
    ${!isSectionHidden("skinCareTips") ? `<div class="tip-card"><h4>✨ Skin Care Tips</h4><p>${ai.skinCareTips || ""}</p></div>` : ""}
    ${!isSectionHidden("hairCareTips") ? `<div class="tip-card"><h4>💇 Hair Care Tips</h4><p>${ai.hairCareTips || ""}</p></div>` : ""}
    ${!isSectionHidden("healthNotes") ? `<div class="tip-card"><h4>🏥 Health Notes</h4><p>${ai.healthNotes || ""}</p></div>` : ""}
    ${!isSectionHidden("supplements") ? `<div class="tip-card"><h4>💊 Recommended Supplements</h4><p>${ai.supplements || "No supplements specified"}</p></div>` : ""}
  </div>`
      : ""
  }

  ${
    !isSectionHidden("disclaimer") && ai.disclaimer
      ? `
  <div class="disclaimer">
    <strong>Disclaimer:</strong> ${ai.disclaimer}
  </div>`
      : ""
  }
  ${recipesSection}
  ${affiliateSection}`;
    } else {
      // Fallback for non-AI plans: just show instructions
      const name = clientProfile?.name ?? "Client";
      bodyHtml = `
  <div class="header">
    <img src="${logoDataUrl}" alt="Clinic Logo" class="header-logo" />
    <div class="header-title">
      <h1>${plan.plan_name ?? "Diet Plan"}</h1>
    </div>
  </div>
  <p style="text-align:center;color:#666;margin-bottom:16px">For ${name}</p>
  ${plan.instructions ? `<div class="serving-size">${plan.instructions.replace(/\n/g, "<br/>")}</div>` : ""}`;
    }

    const title = String(ai?.planName ?? plan.plan_name ?? "Diet Plan").replace(
      /food plan/gi,
      "Lifestyle Plan",
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 14mm 18mm 14mm 18mm; color: #333; font-size: 10.5px; line-height: 1.45; }
    /* ── Header ── */
    .header { display: flex; align-items: center; margin-bottom: 18px; border-bottom: 2px solid #1F5CA0; padding-bottom: 12px; page-break-inside: avoid; }
    .header-logo { width: 110px; height: auto; flex-shrink: 0; }
    .header-title { flex: 1; text-align: center; }
    .header h1 { color: #1F5CA0; font-size: 20px; margin: 0; }
    /* ── Client details ── */
    .client-details { background: #EDF3FA; border: 1px solid #D1DCE8; border-radius: 6px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid; }
    .client-details h3 { color: #1F5CA0; font-size: 12px; margin-bottom: 8px; }
    .client-details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9.5px; }
    .client-details-grid div { margin-bottom: 3px; }
    .client-details-grid span { font-weight: 600; color: #555; }
    /* ── Affirmations ── */
    .affirmations { background: #fef9e7; padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 3px solid #f39c12; page-break-inside: avoid; }
    .affirmations h3 { color: #f39c12; font-size: 12px; margin-bottom: 8px; }
    .affirmations ul { margin-left: 16px; }
    .affirmations li { margin-bottom: 4px; font-size: 10px; }
    /* ── Day tables ── */
    .day-block { margin-bottom: 6px; }
    .day-heading { font-size: 13px; color: #1F5CA0; font-weight: 700; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #b3d1ff; page-break-after: avoid; }
    .day-date { font-size: 11px; color: #666; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 10px; table-layout: fixed; }
    thead { display: table-header-group; }
    th { background: #1F5CA0; color: white; padding: 6px 7px; text-align: left; font-weight: 600; }
    td { padding: 5px 7px; border-bottom: 1px solid #e0e0e0; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
    tr:nth-child(even) td { background: #f7f9fc; }
    .period-cell { color: #1F5CA0; font-weight: 600; }
    .time-cell { color: #555; white-space: nowrap; }
    .alt-cell { color: #777; font-style: italic; }
    strong { font-weight: bold !important; }
    em { font-style: italic !important; }
    .meal-notes { font-size: 9px; color: #555; margin-top: 3px; border-top: 1px dashed #ddd; padding-top: 2px; }
    /* ── Additional guidelines ── */
    .section-title { color: #1F5CA0; font-size: 14px; font-weight: 700; margin: 20px 0 10px; border-bottom: 1px solid #b3d1ff; padding-bottom: 4px; page-break-after: avoid; }
    .serving-size { background: #E9F0F7; padding: 8px 10px; border-radius: 4px; margin-bottom: 12px; font-size: 10px; page-break-inside: avoid; }
    .oil-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; page-break-inside: avoid; }
    .oil-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; }
    .oil-card h4 { font-size: 10px; margin-bottom: 4px; color: #495057; font-weight: 600; }
    .oil-card ul { list-style: none; padding: 0; margin: 0; }
    .oil-card li { font-size: 9px; margin-bottom: 2px; }
    .oil-note { font-style: italic; font-size: 9px; color: #6c757d; margin-top: 4px; }
    .important-notes { background: #fff3cd; border: 2px solid #f0a500; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; page-break-inside: avoid; }
    .important-notes h4 { color: #7a4f00; font-size: 13px; font-weight: 800; margin-bottom: 8px; letter-spacing: 0.3px; }
    .important-notes ul { margin-left: 16px; }
    .important-notes li { margin-bottom: 5px; font-size: 11px; font-weight: 600; color: #4a3000; line-height: 1.5; }
    /* ── Grocery ── */
    .grocery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; page-break-inside: avoid; }
    .grocery-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; }
    .grocery-card h4 { font-size: 10px; margin-bottom: 4px; color: #495057; font-weight: 600; }
    .grocery-card ul { list-style: none; padding: 0; margin: 0; }
    .grocery-card li { font-size: 9px; margin-bottom: 2px; }
    /* ── Tips ── */
    .tips-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; page-break-inside: avoid; }
    .tip-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; }
    .tip-card h4 { font-size: 10px; margin-bottom: 4px; color: #495057; font-weight: 600; }
    .tip-card p { font-size: 9px; line-height: 1.4; }
    /* ── Footer ── */
    .disclaimer { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px 10px; margin-top: 14px; font-size: 9px; font-style: italic; color: #6c757d; page-break-inside: avoid; }
    .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #aaa; page-break-inside: avoid; }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="footer">
    © ${new Date().getFullYear()} From Monday — Dr. Aamit Shah. This lifestyle plan is personalized and should be followed as advised.
  </div>
</body>
</html>`;
  };

  const renderAndPrint = async (logoDataUrl: string) => {
    const html = await buildHtml(logoDataUrl);
    // Use a hidden iframe so print works in PWA standalone mode where
    // window.open/_blank popups are blocked.
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:none;opacity:0";
    iframe.srcdoc = html;
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 400);
    };
    document.body.appendChild(iframe);
  };

  let logoDataUrl = "";
  try {
    const res = await fetch("/clinic-logo.png");
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Logo is optional — proceed without it if it fails to load.
  }
  await renderAndPrint(logoDataUrl);
}

export const Route = createFileRoute("/diet-plan")({
  component: DietPlanPage,
});

function DietPlanPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [allPlans, setAllPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showGrocery, setShowGrocery] = useState(false);
  const [affiliateProducts, setAffiliateProducts] = useState<
    { product_name: string; link: string; product_name_normalized: string }[]
  >([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const load = async () => {
      const { data } = await supabase
        .from("diet_plans")
        .select("*")
        .eq("client_id", clientProfile.id)
        .order("created_at", { ascending: false });

      const plans = (data ?? []) as DietPlan[];
      setAllPlans(plans);

      // Active plan summary — prefer an "active" status plan, else the most recent.
      const active =
        plans.find((p) => (p.status ?? "").toLowerCase() === "active") ?? plans[0] ?? null;
      setActivePlan(active);

      // Extract grocery list items from AI plans and match affiliate products
      const groceryItems = new Set<string>();
      const normGrocery = (s: string) =>
        (s || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .trim();
      for (const p of plans) {
        const ai = p.ai_plan_data as any;
        if (!ai?.weeklyGroceryList) continue;
        for (const cat of ai.weeklyGroceryList as any[]) {
          for (const item of (cat.items as string[]) ?? []) {
            const n = normGrocery(
              item
                .replace(/\(.*?\)/g, "")
                .replace(/\d+\s*(g|ml|kg|tsp|tbsp|cup|pcs)\b/gi, "")
                .trim(),
            );
            if (n.length >= 2) groceryItems.add(n);
          }
        }
      }

      if (groceryItems.size > 0) {
        const { data: allProducts } = await supabase
          .from("affiliate_products" as any)
          .select("product_name, link, product_name_normalized");
        if (allProducts) {
          const matched = (allProducts as any[]).filter((p) => {
            const pn = p.product_name_normalized as string;
            return [...groceryItems].some((g) => g === pn || g.includes(pn) || pn.includes(g));
          });
          setAffiliateProducts(matched);
        }
      }

      setLoading(false);
    };
    load().finally(() => setLoading(false));
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;
  if (!clientProfile)
    return <NoClientProfile onSignOut={() => signOut().then(() => navigate({ to: "/login" }))} />;

  const groups = planDayGroups(activePlan);
  const dayIdx = selectedDay ?? todayGroupIndex(groups);
  const todayIdx = todayGroupIndex(groups);
  const day = groups[dayIdx];
  const progress = planProgress(activePlan);
  const range = formatPlanRange(activePlan);
  const ai = (activePlan?.ai_plan_data ?? {}) as Record<string, any>;
  const hidden: string[] = ai.hiddenSections ?? [];
  const intro = activePlan?.instructions || (ai.introMessage as string) || "";
  const grocery = (
    hidden.includes("weeklyGroceryList") ? [] : ((ai.weeklyGroceryList as any[]) ?? [])
  ).filter((c) => c?.items?.length);
  const pastPlans = allPlans.filter((p) => p.id !== activePlan?.id);

  return (
    <PageShell title="My Diet Plan">
      {loading ? (
        <LoadingSpinner />
      ) : !activePlan ? (
        <EmptyState
          icon={<Utensils />}
          title="No diet plan yet"
          description="Your nutritionist will share your personalised plan here soon."
        />
      ) : (
        <div className="space-y-4">
          {/* Plan hero */}
          <PageHero
            eyebrow="Your diet plan"
            title={activePlan.custom_title ?? activePlan.plan_name ?? "Diet Plan"}
            subtitle={
              range ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> {range}
                </span>
              ) : undefined
            }
          >
            {progress && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-white/90">{progress.label}</span>
                  <span className="text-white/60">{progress.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-200 to-white"
                    style={{ width: `${Math.max(progress.percent, 3)}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => openPlanAsPdf(activePlan, clientProfile, affiliateProducts)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-transform active:scale-95"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
          </PageHero>

          {/* Meals for the selected day */}
          {groups.length > 0 && (
            <SectionCard
              icon={<Utensils />}
              title={dayIdx === todayIdx ? "Today's meals" : "Meals"}
              subtitle={day?.label}
            >
              {groups.length > 1 && (
                <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groups.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(i)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        i === dayIdx
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {i === todayIdx ? "Today" : (g.label ?? `Day ${i + 1}`).replace(/,.*$/, "")}
                    </button>
                  ))}
                </div>
              )}

              <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                {(day?.meals ?? [])
                  .filter((m) => m.foodPlan?.trim() || m.alternative?.trim())
                  .map((meal, i) => (
                    <li key={i} className="relative pl-6">
                      <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-primary bg-card" />
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-foreground">
                          {meal.period || "Meal"}
                        </span>
                        {meal.time && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" /> {meal.time}
                          </span>
                        )}
                      </div>
                      {meal.foodPlan && (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {meal.foodPlan}
                        </p>
                      )}
                      {meal.alternative && (
                        <p className="mt-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground/70">Or: </span>
                          {meal.alternative}
                        </p>
                      )}
                      {meal.notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{meal.notes}</p>
                      )}
                    </li>
                  ))}
              </ol>
            </SectionCard>
          )}

          {/* Plan introduction */}
          {intro && (
            <SectionCard
              icon={<BookOpen />}
              iconClassName="bg-sky-100 text-sky-700"
              title="About your plan"
            >
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${showIntro ? "" : "line-clamp-4"}`}
              >
                {intro}
              </p>
              {intro.length > 220 && (
                <button
                  onClick={() => setShowIntro((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  {showIntro ? "Show less" : "Read more"}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showIntro ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </SectionCard>
          )}

          {/* Weekly grocery list */}
          {grocery.length > 0 && (
            <SectionCard
              icon={<ListChecks />}
              iconClassName="bg-emerald-100 text-emerald-700"
              title="Weekly grocery list"
              subtitle={`${grocery.reduce((n, c) => n + c.items.length, 0)} items`}
              action={
                <button
                  onClick={() => setShowGrocery((v) => !v)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={showGrocery ? "Hide grocery list" : "Show grocery list"}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showGrocery ? "rotate-180" : ""}`}
                  />
                </button>
              }
            >
              {showGrocery ? (
                <div className="space-y-3">
                  {grocery.map((cat, i) => (
                    <div key={i}>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {cat.category}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(cat.items as string[]).map((item, j) => (
                          <span
                            key={j}
                            className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowGrocery(true)}
                  className="text-xs font-semibold text-primary"
                >
                  Show list
                </button>
              )}
            </SectionCard>
          )}

          {/* Recommended products */}
          {affiliateProducts.length > 0 && (
            <SectionCard
              icon={<ShoppingCart />}
              iconClassName="bg-amber-100 text-amber-700"
              title="Recommended products"
              subtitle="Picked to match your grocery list"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {affiliateProducts.map((p) => (
                  <a
                    key={p.product_name_normalized}
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="truncate">{p.product_name}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                  </a>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Earlier plans */}
          {pastPlans.length > 0 && (
            <SectionCard
              icon={<History />}
              iconClassName="bg-muted text-muted-foreground"
              title="Earlier plans"
            >
              <ul className="divide-y divide-border">
                {pastPlans.map((plan) => (
                  <li key={plan.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {plan.custom_title ?? plan.plan_name ?? "Diet Plan"}
                      </p>
                      {formatPlanRange(plan) && (
                        <p className="text-xs text-muted-foreground">{formatPlanRange(plan)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => openPlanAsPdf(plan, clientProfile, affiliateProducts)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-primary transition-colors hover:bg-primary/5"
                      aria-label="Download PDF"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}
    </PageShell>
  );
}
