import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Popup notices feed (ui/notices.js:147). MUST be a JSON array (the client
// throws & retries on non-200, and treats non-array as empty). No notices.
export async function GET() {
  return NextResponse.json([]);
}
