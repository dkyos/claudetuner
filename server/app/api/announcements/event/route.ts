import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Impression/click beacon (ui/notices.js:88) — fire-and-forget.
export async function POST() {
  return noContent();
}
