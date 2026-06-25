// Main collection endpoint. The extension POSTs a usage snapshot every poll
// cycle (bg/storage.js postSnapshot). We store it and return:
//   - recent_snapshots[] (only when need_history) for chart backfill
//   - recommendation (when usage warrants) for the popup card
// CRITICAL: always 200. 401/403 trigger the extension's re-auth loop; 410 stops
// collection entirely (see bg/storage.js:232-252).
import { NextRequest, NextResponse } from "next/server";
import { insertSnapshot, getRecentSnapshots } from "@/lib/db";
import { parseSnapshotBody } from "@/lib/snapshot";
import { computeRecommendation } from "@/lib/plans";
import { checkAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  checkAuth(req);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const input = parseSnapshotBody(body);
  insertSnapshot(input);

  const recent = getRecentSnapshots(input.user_email, 200, {
    provider: input.provider,
  });
  const recommendation = computeRecommendation(recent, input.plan);

  const res: Record<string, unknown> = { success: true };
  // Only ship history when asked (first sync / empty local cache) to keep the
  // steady-state POST response small. Otherwise the extension backfills via /api/me.
  if (body.need_history) res.recent_snapshots = recent;
  if (recommendation) res.recommendation = recommendation;

  console.log(
    `[ct-server] POST /api/snapshots ${input.user_email} (${input.provider}) plan=${input.plan} 7d=${
      input.seven_day_utilization ?? "-"
    }%${recommendation ? ` rec=${recommendation.type}->${recommendation.to_plan}` : ""}`
  );

  return NextResponse.json(res);
}
