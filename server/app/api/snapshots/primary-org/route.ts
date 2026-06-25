import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Primary org selection (ui/org-selector.js:420) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
