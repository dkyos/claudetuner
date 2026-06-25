import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Notification prefs sync (bg/collect.js:156-185) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
