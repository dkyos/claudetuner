// History backfill. The extension calls this (bg/collect.js:874) with the user
// email in the X-User-Email header and an optional ?org= filter, expecting
// { recent_snapshots: [...] }.
import { NextRequest, NextResponse } from "next/server";
import { getRecentSnapshots } from "@/lib/db";
import { checkAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  checkAuth(req);
  const url = new URL(req.url);
  const email =
    req.headers.get("x-user-email") || url.searchParams.get("email");
  const org = url.searchParams.get("org");
  if (!email) return NextResponse.json({ recent_snapshots: [] });
  return NextResponse.json({
    recent_snapshots: getRecentSnapshots(email, 200, { orgUuid: org }),
  });
}
