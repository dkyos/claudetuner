import { NextResponse } from "next/server";
export const runtime = "nodejs";
// Dashboard SSO token exchange (background.js:494). We don't run a web dashboard,
// so return a placeholder token; the popup dashboard never needs it.
export async function POST() {
  return NextResponse.json({ login_token: "local" });
}
