// Local token-cost estimation (ccusage-style) for Claude Code transcripts.
// Subscription users don't pay per-token, so this is a "what it WOULD cost on the
// API" estimate — useful for sizing usage and justifying a plan.
//
// Prices are USD per 1M tokens. cache write = 1.25x input (5-minute TTL),
// cache read = 0.1x input. Matched to the published Claude pricing.
export interface Price {
  in: number;
  out: number;
  cw: number; // cache write (5m)
  cr: number; // cache read
}

const OPUS: Price = { in: 5, out: 25, cw: 6.25, cr: 0.5 };
const SONNET: Price = { in: 3, out: 15, cw: 3.75, cr: 0.3 };
const HAIKU: Price = { in: 1, out: 5, cw: 1.25, cr: 0.1 };

// Map a transcript model id (e.g. "claude-opus-4-8[1m]", "claude-sonnet-4-6")
// to its price tier by family substring.
export function priceFor(model: string): Price {
  const m = (model || "").toLowerCase();
  if (m.includes("opus")) return OPUS;
  if (m.includes("sonnet")) return SONNET;
  if (m.includes("haiku")) return HAIKU;
  return OPUS; // unknown → assume top tier (don't under-report)
}

export interface ModelTok {
  i: number; // input
  o: number; // output
  cw: number; // cache creation
  cr: number; // cache read
}

export function parseModelTokens(json: string | null): Record<string, ModelTok> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// USD cost for one session's model_tokens JSON.
export function costOfModelTokens(json: string | null): number {
  let usd = 0;
  for (const [model, t] of Object.entries(parseModelTokens(json))) {
    const p = priceFor(model);
    usd +=
      ((t.i || 0) * p.in +
        (t.o || 0) * p.out +
        (t.cw || 0) * p.cw +
        (t.cr || 0) * p.cr) /
      1e6;
  }
  return usd;
}

export function fmtUsd(n: number): string {
  if (n >= 100) return "$" + Math.round(n).toLocaleString();
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(3);
}
