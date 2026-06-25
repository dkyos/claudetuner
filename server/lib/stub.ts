// Shared no-op response for fire-and-forget endpoints the extension calls but
// whose responses it ignores. 204 keeps them cheap; the only hard rule is never
// 401/403/410 (see plan: those break the extension's collection/auth loop).
import { NextResponse } from "next/server";

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
