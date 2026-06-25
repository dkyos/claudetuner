import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Plan-change accept/reject report (bg/plan.js:138) — fire-and-forget.
export async function POST() {
  return noContent();
}
