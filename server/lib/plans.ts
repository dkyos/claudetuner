// Plan recommendation + fitness-matrix heuristics.
//
// We only have the 7-day utilization signal per snapshot (relative to the user's
// CURRENT plan). To estimate usage on a different plan we scale by the relative
// rate-limit multiplier: projected = util * (MULT[current] / MULT[target]).
import type { RecentSnapshot } from "./db";

const MULT: Record<string, number> = {
  Free: 0.2,
  Pro: 1,
  "Max 5x": 5,
  "Max 20x": 20,
};
const COST: Record<string, number> = {
  Free: 0,
  Pro: 20,
  "Max 5x": 100,
  "Max 20x": 200,
};
// Upgrade/downgrade ladder (Free is an entry point but not shown in the matrix).
const LADDER = ["Free", "Pro", "Max 5x", "Max 20x"];
// Plans shown as rows in the fitness matrix.
const MATRIX_PLANS = ["Pro", "Max 5x", "Max 20x"];

export function normalizePlan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (MULT[s] != null) return s;
  const lower = s.toLowerCase();
  if (lower === "free") return "Free";
  if (lower === "pro") return "Pro";
  if (lower.includes("20")) return "Max 20x";
  if (lower.includes("max")) return "Max 5x"; // bare "Max" / "Max 5x"
  return null; // Team / Enterprise / unknown → no rec/fitness
}

function projected(util: number, from: string, to: string): number {
  const fm = MULT[from],
    tm = MULT[to];
  if (!fm || !tm) return util;
  return util * (fm / tm);
}

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

// 7d-utilization values whose collected_at falls within the last `days` days.
function utilWithin(snaps: RecentSnapshot[], days: number, now: number): number[] {
  const cutoff = now - days * 86400000;
  const out: number[] = [];
  for (const s of snaps) {
    const t = Date.parse(s.collected_at);
    if (Number.isFinite(t) && t >= cutoff && s.seven_day_utilization != null) {
      out.push(s.seven_day_utilization);
    }
  }
  return out;
}

export interface Recommendation {
  type: "upgrade" | "downgrade";
  from_plan: string;
  to_plan: string;
  from_cost: number;
  to_cost: number;
  cost_diff: number;
  urgency: "urgent" | "normal";
  text: string;
}

export function computeRecommendation(
  snaps: RecentSnapshot[],
  rawPlan: string | null,
  now = Date.now()
): Recommendation | null {
  const current = normalizePlan(rawPlan);
  if (!current) return null;
  const util = avg(utilWithin(snaps, 7, now));
  if (util == null) return null;

  const idx = LADDER.indexOf(current);
  if (idx === -1) return null;

  // Upgrade when the 7-day window runs hot; downgrade when it stays cold.
  if (util >= 80 && idx < LADDER.length - 1) {
    const to = LADDER[idx + 1];
    const proj = projected(util, current, to);
    return {
      type: "upgrade",
      from_plan: current,
      to_plan: to,
      from_cost: COST[current],
      to_cost: COST[to],
      cost_diff: Math.abs(COST[to] - COST[current]),
      urgency: util >= 95 ? "urgent" : "normal",
      text: `Your 7-day usage is averaging ${Math.round(
        util
      )}% on ${current}. ${to} would bring that down to ~${Math.round(
        proj
      )}%.`,
    };
  }
  if (util < 25 && idx > 1) {
    // never auto-suggest dropping to Free
    const to = LADDER[idx - 1];
    const proj = projected(util, current, to);
    if (proj <= 80) {
      return {
        type: "downgrade",
        from_plan: current,
        to_plan: to,
        from_cost: COST[current],
        to_cost: COST[to],
        cost_diff: Math.abs(COST[current] - COST[to]),
        urgency: "normal",
        text: `Your 7-day usage is only ${Math.round(
          util
        )}% on ${current}. ${to} would still cover it at ~${Math.round(
          proj
        )}% and save $${Math.abs(COST[current] - COST[to])}/mo.`,
      };
    }
  }
  return null;
}

type Level = "exceeded" | "tight" | "fit" | "overspend";
function levelFor(projectedUtil: number): Level {
  if (projectedUtil > 100) return "exceeded";
  if (projectedUtil >= 80) return "tight";
  if (projectedUtil >= 25) return "fit";
  return "overspend";
}

export interface FitnessCell {
  level: Level;
  projected: number;
  partial?: boolean;
}
export interface FitnessPlanRow {
  name: string;
  windows: Record<string, FitnessCell>;
}
export interface Fitness {
  current_plan: string;
  rec_plan?: string;
  plans: FitnessPlanRow[];
}

const WINDOWS: { key: string; days: number }[] = [
  { key: "24h", days: 1 },
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
];

export function computeFitness(
  snaps: RecentSnapshot[],
  rawPlan: string | null,
  now = Date.now()
): Fitness | null {
  const current = normalizePlan(rawPlan);
  if (!current || current === "Free") return null;
  if (!snaps.length) return null;

  // Oldest data point bounds how far back any window can actually reach.
  const oldest = Math.min(
    ...snaps
      .map((s) => Date.parse(s.collected_at))
      .filter((t) => Number.isFinite(t))
  );
  const dataSpanDays = Number.isFinite(oldest)
    ? (now - oldest) / 86400000
    : 0;

  const rec = computeRecommendation(snaps, rawPlan, now);

  const plans: FitnessPlanRow[] = MATRIX_PLANS.map((name) => {
    const windows: Record<string, FitnessCell> = {};
    for (const w of WINDOWS) {
      const vals = utilWithin(snaps, w.days, now);
      const a = avg(vals);
      if (a == null) continue; // no data in this window → cell shows "—"
      const proj = projected(a, current, name);
      windows[w.key] = {
        level: levelFor(proj),
        projected: proj,
        partial: dataSpanDays < w.days ? true : undefined,
      };
    }
    return { name, windows };
  }).filter((p) => Object.keys(p.windows).length > 0);

  if (!plans.length) return null;

  return {
    current_plan: current,
    rec_plan: rec?.to_plan,
    plans,
  };
}
