import { noContent } from "@/lib/stub";
export const runtime = "nodejs";
// Plan-downgrade cancel notice (background.js:1160) — fire-and-forget.
export async function POST() {
  return noContent();
}
