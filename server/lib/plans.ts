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

// 7d-utilization values in the [fromDays, toDays) window (older band, for trend).
function utilBetween(
  snaps: RecentSnapshot[],
  fromDays: number,
  toDays: number,
  now: number
): number[] {
  const newer = now - fromDays * 86400000;
  const older = now - toDays * 86400000;
  const out: number[] = [];
  for (const s of snaps) {
    const t = Date.parse(s.collected_at);
    if (Number.isFinite(t) && t >= older && t < newer && s.seven_day_utilization != null) {
      out.push(s.seven_day_utilization);
    }
  }
  return out;
}

function maxOf(nums: number[]): number | null {
  return nums.length ? Math.max(...nums) : null;
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
  reasons?: string[];
}

export interface PlanReview {
  plan: string;
  verdict: "keep" | "upgrade" | "downgrade";
  recommended?: string;
  avg7: number;
  avg30: number;
  peak7: number;
  trend: number; // %p, recent 7d avg minus prior 8–30d avg (+ = rising)
  costDelta?: number; // monthly $ change if recommended applied
  reasons: string[]; // evidence lines (for the company-facing review)
}

// Multi-signal plan review (the single source of truth). Combines 7d/30d averages,
// recent peak, and trend slope — not just a single 7d mean. Always returns a
// review when there is data (verdict 'keep' when current plan fits).
export function computePlanReview(
  snaps: RecentSnapshot[],
  rawPlan: string | null,
  now = Date.now()
): PlanReview | null {
  const current = normalizePlan(rawPlan);
  if (!current) return null;
  const idx = LADDER.indexOf(current);
  if (idx === -1) return null;

  const w7 = utilWithin(snaps, 7, now);
  const avg7 = avg(w7);
  if (avg7 == null) return null;
  const avg30 = avg(utilWithin(snaps, 30, now)) ?? avg7;
  const peak7 = maxOf(w7) ?? avg7;
  const prior = avg(utilBetween(snaps, 7, 30, now));
  const trend = prior != null ? avg7 - prior : 0;

  const reasons: string[] = [
    `최근 7일 평균 ${Math.round(avg7)}% · 피크 ${Math.round(peak7)}%`,
    `최근 30일 평균 ${Math.round(avg30)}%`,
  ];
  if (Math.abs(trend) >= 3) {
    reasons.push(
      `추세 ${trend > 0 ? "상승" : "하강"} (${trend > 0 ? "+" : ""}${Math.round(trend)}%p, 직전 구간 대비)`
    );
  }

  const hot =
    avg7 >= 80 || (peak7 >= 95 && avg7 >= 60) || (trend >= 5 && avg7 >= 70);
  const cold = avg30 < 25 && peak7 < 50 && trend <= 0;

  let verdict: PlanReview["verdict"] = "keep";
  let recommended: string | undefined;
  let costDelta: number | undefined;

  if (hot && idx < LADDER.length - 1) {
    verdict = "upgrade";
    recommended = LADDER[idx + 1];
    costDelta = COST[recommended] - COST[current];
    reasons.push(
      `${recommended}로 올리면 평균 ~${Math.round(projected(avg7, current, recommended))}%로 여유 확보`
    );
  } else if (cold && idx > 1) {
    const to = LADDER[idx - 1];
    if (projected(avg30, current, to) <= 70) {
      verdict = "downgrade";
      recommended = to;
      costDelta = COST[to] - COST[current];
      reasons.push(
        `${to}로 낮춰도 ~${Math.round(projected(avg30, current, to))}%로 충분, $${Math.abs(costDelta)}/mo 절감`
      );
    }
  }
  if (verdict === "keep") {
    reasons.push("현재 요금제가 사용량에 적정합니다.");
  }

  return { plan: current, verdict, recommended, avg7, avg30, peak7, trend, costDelta, reasons };
}

// Popup/badge recommendation = the review when it suggests a plan change.
export function computeRecommendation(
  snaps: RecentSnapshot[],
  rawPlan: string | null,
  now = Date.now()
): Recommendation | null {
  const r = computePlanReview(snaps, rawPlan, now);
  if (!r || r.verdict === "keep" || !r.recommended) return null;
  const to = r.recommended;
  return {
    type: r.verdict,
    from_plan: r.plan,
    to_plan: to,
    from_cost: COST[r.plan],
    to_cost: COST[to],
    cost_diff: Math.abs(COST[to] - COST[r.plan]),
    urgency:
      r.verdict === "upgrade" && (r.avg7 >= 95 || r.peak7 >= 100)
        ? "urgent"
        : "normal",
    text:
      r.verdict === "upgrade"
        ? `최근 7일 평균 ${Math.round(r.avg7)}%·피크 ${Math.round(r.peak7)}% — ${to} 권장`
        : `최근 30일 평균 ${Math.round(r.avg30)}% — ${to}로 절감 가능`,
    reasons: r.reasons,
  };
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
