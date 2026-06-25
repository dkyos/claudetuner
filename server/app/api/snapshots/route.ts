// Main collection endpoint. The extension POSTs a usage snapshot every poll
// cycle (bg/storage.js postSnapshot). We store it and return:
//   - recent_snapshots[] (only when need_history) for chart backfill
//   - recommendation (when usage warrants) for the popup card
// CRITICAL: always 200. 401/403 trigger the extension's re-auth loop; 410 stops
// collection entirely (see bg/storage.js:232-252).
import { NextRequest, NextResponse } from "next/server";
import { insertSnapshot, getRecentSnapshots } from "@/lib/db";
import { computeRecommendation } from "@/lib/plans";
import { checkAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function POST(req: NextRequest) {
  checkAuth(req);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const email: string = body.user_email || body.email || "unknown@local";
  const collectedAt: string = body.collected_at || new Date().toISOString();
  const plan: string | null = body.plan ?? null;
  const provider: string = body.provider || "claude";
  const orgUuid: string | null = body.claude_org_uuid ?? null;
  const extra = body.extra_usage || null;

  insertSnapshot({
    user_email: email,
    provider,
    plan,
    org_uuid: orgUuid,
    install_id: body.install_id ?? null,
    five_hour_utilization: num(body.five_hour?.utilization),
    five_hour_resets_at: body.five_hour?.resets_at ?? null,
    seven_day_utilization: num(body.seven_day?.utilization),
    seven_day_resets_at: body.seven_day?.resets_at ?? null,
    extra_usage_used: num(extra?.used_credits),
    extra_usage_limit: num(extra?.monthly_limit),
    collected_at: collectedAt,
    raw: JSON.stringify(body),
  });

  const recent = getRecentSnapshots(email, 200, { provider });
  const recommendation = computeRecommendation(recent, plan);

  const res: Record<string, unknown> = { success: true };
  // Only ship history when asked (first sync / empty local cache) to keep the
  // steady-state POST response small. Otherwise the extension backfills via /api/me.
  if (body.need_history) res.recent_snapshots = recent;
  if (recommendation) res.recommendation = recommendation;

  console.log(
    `[ct-server] POST /api/snapshots ${email} plan=${plan} 7d=${
      num(body.seven_day?.utilization) ?? "-"
    }%${recommendation ? ` rec=${recommendation.type}->${recommendation.to_plan}` : ""}`
  );

  return NextResponse.json(res);
}
