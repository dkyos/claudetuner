import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Collection-failure heartbeat (bg/collect.js:1257) — fire-and-forget.
export async function POST() {
  return noContent();
}
