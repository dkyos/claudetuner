import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Promo banners feed (ui/notices.js:148). MUST be a JSON array. No promos.
export async function GET() {
  return NextResponse.json([]);
}
