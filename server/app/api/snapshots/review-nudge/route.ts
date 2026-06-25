import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Review-prompt interaction tracking (options.js:412, ui/recommend.js:185) — fire-and-forget.
export async function PATCH() {
  return noContent();
}
