import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Dismiss recommendation badge (bg/plan.js:182) — fire-and-forget.
export async function POST() {
  return noContent();
}
