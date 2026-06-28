// Maps a raw POST /api/snapshots body (bg/storage.js postSnapshot payload) into a
// DB row. Kept separate from the route so the field mapping has one home and is
// unit-testable. Tolerant of missing fields — the extension omits some per cycle.
import type { InsertSnapshotInput } from "./db";

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseSnapshotBody(
  body: Record<string, any>
): InsertSnapshotInput {
  const extra = body.extra_usage || null;
  return {
    user_email: body.user_email || body.email || "unknown@local",
    provider: "claude", // Claude-only fork — provider column kept, fixed to claude

    plan: body.plan ?? null,
    org_uuid: body.claude_org_uuid ?? null,
    install_id: body.install_id ?? null,
    five_hour_utilization: num(body.five_hour?.utilization),
    five_hour_resets_at: body.five_hour?.resets_at ?? null,
    seven_day_utilization: num(body.seven_day?.utilization),
    seven_day_resets_at: body.seven_day?.resets_at ?? null,
    extra_usage_used: num(extra?.used_credits),
    extra_usage_limit: num(extra?.monthly_limit),
    collected_at: body.collected_at || new Date().toISOString(),
    raw: JSON.stringify(body),
  };
}
