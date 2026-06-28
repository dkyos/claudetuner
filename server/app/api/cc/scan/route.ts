// Manually trigger a Claude Code transcript scan. GET is allowed for convenience
// (open in a browser / cron). Returns {scanned, updated, skipped}.
import { NextResponse } from "next/server";
import { scanCcTranscripts } from "@/lib/cc-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function run() {
  const r = scanCcTranscripts();
  console.log(
    `[ct-server] cc scan: ${r.updated} updated, ${r.skipped} unchanged, ${r.scanned} files`
  );
  return NextResponse.json({ success: true, ...r });
}

export async function POST() {
  return run();
}
export async function GET() {
  return run();
}
