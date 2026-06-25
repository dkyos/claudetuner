import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Selected-orgs migration (bg/collect.js:975) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
