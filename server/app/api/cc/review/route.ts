// Generate an LLM usage review by calling the local `claude` CLI (subscription),
// store the markdown. scope: 'overall' (default) | 'session' (needs session_id).
import { NextRequest, NextResponse } from "next/server";
import {
  buildOverallPrompt,
  buildSessionPrompt,
  runClaudeReview,
} from "@/lib/cc-review";
import { setCcReview } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const scope = body.scope === "session" ? "session" : "overall";
  const sessionId = scope === "session" ? body.session_id || null : null;
  if (scope === "session" && !sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id required" },
      { status: 400 }
    );
  }

  const prompt =
    scope === "session"
      ? buildSessionPrompt(sessionId)
      : buildOverallPrompt();

  const r = await runClaudeReview(prompt);
  if (r.ok && r.content) {
    setCcReview(scope, sessionId, r.content);
    return NextResponse.json({ ok: true });
  }
  console.error("[ct-server] cc review failed:", r.error);
  return NextResponse.json({ ok: false, error: r.error || "failed" });
}
