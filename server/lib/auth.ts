// Loose auth for a personal local server. The extension sends either
// `X-API-Key: <key>` (default 'claude-manager-dev-key-2024') or
// `Authorization: Bearer <ext_token>`. We never issue an ext_token (so the
// extension keeps using the API key), and we accept everything — the important
// invariant (see plan) is that this server must NEVER return 401/403/410, which
// would trigger the extension's re-auth loop or stop collection entirely.
import type { NextRequest } from "next/server";

const EXPECTED_API_KEY = "claude-manager-dev-key-2024";

export function checkAuth(req: NextRequest): boolean {
  const apiKey = req.headers.get("x-api-key");
  const bearer = req.headers.get("authorization");
  if (apiKey && apiKey !== EXPECTED_API_KEY) {
    console.warn(`[ct-server] unexpected X-API-Key: ${apiKey} (allowing anyway)`);
  }
  // Return true regardless — we only log mismatches. A local personal server has
  // no adversary, and rejecting would break the extension's collection loop.
  return Boolean(apiKey || bearer) || true;
}
