import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Auto-approve plan-change preference (options.js:162) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
