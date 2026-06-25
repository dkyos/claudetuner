// Plan fitness matrix for the popup (ui/recommend.js loadFitnessMatrix → renderFitnessMatrix).
// Must return { current_plan, rec_plan?, plans: [{name, windows:{24h,7d,14d:{level,projected}}}] }.
// When there is no usable data we return { plans: [] } so the popup hides the section.
import { NextRequest, NextResponse } from "next/server";
import { getRecentSnapshots, getLatestSnapshot } from "@/lib/db";
import { computeFitness } from "@/lib/plans";
import { checkAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  checkAuth(req);
  const email = new URL(req.url).searchParams.get("user_email");
  if (!email) return NextResponse.json({ plans: [] });

  // Fitness / plan recommendation is a Claude-only concept (Pro/Max tiers).
  const snaps = getRecentSnapshots(email, 500, { provider: "claude" });
  const plan = getLatestSnapshot(email, "claude")?.plan ?? null;
  const fit = computeFitness(snaps, plan);
  return NextResponse.json(fit ?? { plans: [] });
}
