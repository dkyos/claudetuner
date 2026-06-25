import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Extension settings sync for analytics (options.js:188) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
