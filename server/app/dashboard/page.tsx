// Local dashboard backed by collected snapshots. Mirrors the cloud dashboard's
// intent (summary cards + 5h/7d trend charts + plan fitness) using only local
// data. Data is scoped per (email, provider) so Claude/Gemini/ChatGPT don't mix
// into one timeline — see docs/screenshots for the original layout.
import {
  getUsers,
  getRecentSnapshots,
  getLatestSnapshot,
  getProvidersForEmail,
  getDailyUsage,
  getCcCostSummary,
  getCcDailyCost,
} from "@/lib/db";
import { computeFitness, computePlanReview } from "@/lib/plans";
import { predict7d } from "@/lib/predict";
import { fmtUsd } from "@/lib/cost";
import { UsageChart, type Pt } from "./UsageChart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
};
const COST: Record<string, string> = {
  Free: "Free",
  Pro: "$20/mo",
  "Max 5x": "$100/mo",
  "Max 20x": "$200/mo",
};
const FITNESS_PLANS = ["Pro", "Max 5x", "Max 20x"];
const WINDOWS: { key: string; label: string }[] = [
  { key: "24h", label: "최근 24h" },
  { key: "7d", label: "최근 7일" },
  { key: "14d", label: "최근 14일" },
];
const LV: Record<string, { icon: string; color: string; label: string }> = {
  exceeded: { icon: "✕", color: "#ef4444", label: "부족" },
  tight: { icon: "✓", color: "#f59e0b", label: "빠듯" },
  fit: { icon: "✓", color: "#22c55e", label: "적정" },
  overspend: { icon: "↓", color: "#3b82f6", label: "과지출" },
};

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}%`;
}
function fmtResetIn(resetsAt: string | null, now: number): string {
  if (!resetsAt) return "";
  const t = Date.parse(resetsAt);
  if (!Number.isFinite(t)) return "";
  const ms = t - now;
  if (ms <= 0) return "리셋 임박";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}일 ${h % 24}시간 후 리셋` : `${h}시간 후 리셋`;
}
function fmtDateTime(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`;
}
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1000) + "K";
  return String(n);
}

// Daily cost bars (SVG) for the Claude Code token-cost trend.
function CostBars({ daily }: { daily: { date: string; usd: number }[] }) {
  const W = 900,
    H = 90,
    padB = 14;
  if (!daily.length)
    return <div style={{ color: "#6b7280", fontSize: 13 }}>데이터 없음</div>;
  const max = Math.max(...daily.map((d) => d.usd), 0.0001);
  const bw = W / daily.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", marginTop: 8 }}
      role="img"
    >
      {daily.map((d, i) => {
        const h = ((H - padB) * d.usd) / max;
        return (
          <rect
            key={i}
            x={i * bw + bw * 0.12}
            y={H - padB - h}
            width={bw * 0.76}
            height={Math.max(h, d.usd > 0 ? 1 : 0)}
            fill="#22c55e"
            opacity={0.8}
          >
            <title>{`${d.date}: ${fmtUsd(d.usd)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

const card: React.CSSProperties = {
  background: "#11151d",
  border: "1px solid #1f2530",
  borderRadius: 12,
  padding: "16px 18px",
};
const cardLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginBottom: 6,
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; provider?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const users = getUsers();
  const email = sp.email || users[0]?.user_email;
  const now = Date.now();

  if (!email) {
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 22 }}>ClaudeMonitor — 로컬 대시보드</h1>
        <p style={{ color: "#9ca3af" }}>
          아직 수집된 데이터가 없습니다. 확장을 이 서버로 연결하고 claude.ai에서
          수집이 한 번 이상 실행되면 여기에 추세와 예측이 표시됩니다.
        </p>
      </main>
    );
  }

  // Scope to a provider so Claude/Gemini/ChatGPT don't collapse into one
  // timeline (mixing them is what made the latest value read as 0%). Default to
  // Claude when present.
  const providers = getProvidersForEmail(email);
  const provider =
    sp.provider ||
    (providers.some((p) => p.provider === "claude")
      ? "claude"
      : providers[0]?.provider) ||
    "claude";
  const isClaude = provider === "claude";

  // Period: 7d/30d use raw snapshots (+ prediction + reset markers); 6mo uses a
  // daily down-sample (peak/day) and hides prediction (predict7d needs detail).
  const PERIODS: Record<string, number> = { "7d": 7, "30d": 30, "6mo": 180 };
  const period = sp.period && PERIODS[sp.period] ? sp.period : "30d";
  const days = PERIODS[period];
  const isLong = days > 14;
  const cutoff = now - days * 86400000;

  const latest = getLatestSnapshot(email, provider);
  // Recent raw (always) drives fitness/recommendation/latest state.
  const recent = getRecentSnapshots(email, 6000, { provider });
  const fitness = isClaude
    ? computeFitness(recent, latest?.plan ?? null, now)
    : null;
  const review = isClaude
    ? computePlanReview(recent, latest?.plan ?? null, now)
    : null;

  let p5: Pt[];
  let p7: Pt[];
  let resetMarkers: number[] = [];
  let pred: ReturnType<typeof predict7d> = null;

  if (isLong) {
    const daily = getDailyUsage(email, days, provider);
    p5 = daily
      .filter((d) => d.five_hour_max != null)
      .map((d) => ({ t: Date.parse(d.date + "T00:00:00Z"), v: d.five_hour_max! }));
    p7 = daily
      .filter((d) => d.seven_day_max != null)
      .map((d) => ({ t: Date.parse(d.date + "T00:00:00Z"), v: d.seven_day_max! }));
  } else {
    const history = recent.filter((h) => Date.parse(h.collected_at) >= cutoff);
    p5 = history
      .filter((h) => h.five_hour_utilization != null)
      .map((h) => ({ t: Date.parse(h.collected_at), v: h.five_hour_utilization! }));
    p7 = history
      .filter((h) => h.seven_day_utilization != null)
      .map((h) => ({ t: Date.parse(h.collected_at), v: h.seven_day_utilization! }));
    // reset markers = points where seven_day_resets_at changes (window boundary)
    let prevR: string | null = null;
    for (const h of history) {
      const r = h.seven_day_resets_at;
      if (r && r !== prevR) {
        if (prevR !== null) resetMarkers.push(Date.parse(h.collected_at));
        prevR = r;
      }
    }
    pred = predict7d(
      history,
      latest?.seven_day_utilization ?? null,
      latest?.seven_day_resets_at ?? null,
      now
    );
  }

  const predPoint: Pt | null =
    pred && latest?.seven_day_resets_at
      ? {
          t: Date.parse(latest.seven_day_resets_at),
          v: Math.min(pred.predicted, 100),
        }
      : null;

  // Claude Code local token usage + cost (API-equivalent estimate). Provider-
  // independent — comes from ~/.claude transcripts, not snapshots.
  const ccCost = getCcCostSummary();
  const ccDaily = getCcDailyCost(days);

  const linkFor = (e: string, p?: string, per?: string) =>
    `/dashboard?email=${encodeURIComponent(e)}` +
    `&provider=${encodeURIComponent(p ?? provider)}` +
    `&period=${encodeURIComponent(per ?? period)}`;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>ClaudeMonitor — 로컬 대시보드</h1>
        <span style={{ color: "#9ca3af", fontSize: 13 }}>
          {email} · {PROVIDER_LABEL[provider] ?? provider}
          {isClaude && latest?.plan ? ` · ${latest.plan}` : ""}
        </span>
      </div>

      {/* user switcher */}
      {users.length > 1 && (
        <div style={{ margin: "12px 0 0", fontSize: 12 }}>
          <span style={{ color: "#6b7280", marginRight: 8 }}>계정:</span>
          {users.map((u) => (
            <a
              key={u.user_email}
              href={linkFor(u.user_email)}
              style={{
                marginRight: 10,
                color: u.user_email === email ? "#a78bfa" : "#6b7280",
                textDecoration: "none",
                fontWeight: u.user_email === email ? 700 : 400,
              }}
            >
              {u.user_email}
            </a>
          ))}
        </div>
      )}

      {/* provider switcher */}
      {providers.length > 1 && (
        <div style={{ margin: "8px 0 0", fontSize: 12 }}>
          <span style={{ color: "#6b7280", marginRight: 8 }}>서비스:</span>
          {providers.map((p) => (
            <a
              key={p.provider}
              href={linkFor(email, p.provider)}
              style={{
                marginRight: 10,
                color: p.provider === provider ? "#06b6d4" : "#6b7280",
                textDecoration: "none",
                fontWeight: p.provider === provider ? 700 : 400,
              }}
            >
              {PROVIDER_LABEL[p.provider] ?? p.provider} ({p.count})
            </a>
          ))}
        </div>
      )}

      {/* Claude Code analysis link */}
      <div style={{ margin: "10px 0 0" }}>
        <a
          href="/dashboard/cc"
          style={{ color: "#7dd3fc", fontSize: 13, textDecoration: "none" }}
        >
          🧑‍💻 Claude Code 사용 분석 보기 →
        </a>
      </div>

      {/* Claude Code token usage + cost trend (local transcripts, API-equiv) */}
      {ccCost.total_tokens > 0 && (
        <section style={{ ...card, marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600, margin: 0 }}>
              🧑‍💻 Claude Code 토큰·비용 (API 환산 추정)
            </div>
            <a
              href="/dashboard/cc"
              style={{ color: "#7dd3fc", fontSize: 12, textDecoration: "none" }}
            >
              상세 →
            </a>
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 10,
              flexWrap: "wrap",
              alignItems: "baseline",
            }}
          >
            <div>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#22c55e" }}>
                {fmtUsd(ccCost.total_usd)}
              </span>
              <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 6 }}>
                누적 추정
              </span>
            </div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              총 토큰 <b style={{ color: "#e5e7eb" }}>{fmtTokens(ccCost.total_tokens)}</b>
            </div>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>
              {ccCost.by_model.slice(0, 3).map((m, i) => (
                <span key={m.model} style={{ marginLeft: i ? 10 : 0 }}>
                  {m.model.replace(/^claude-/, "").replace(/\[.*\]$/, "")}{" "}
                  <span style={{ color: "#22c55e" }}>{fmtUsd(m.usd)}</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ ...cardLabel, marginTop: 12, marginBottom: 0 }}>
            일별 비용 ({period === "7d" ? "7일" : period === "30d" ? "30일" : "6개월"})
          </div>
          <CostBars daily={ccDaily} />
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>
            ※ 구독 사용분의 공개 API 단가 환산 추정치입니다 — 실제 청구 금액이 아닙니다.
          </div>
        </section>
      )}

      {/* period selector */}
      <div style={{ margin: "8px 0 0", fontSize: 12 }}>
        <span style={{ color: "#6b7280", marginRight: 8 }}>기간:</span>
        {(["7d", "30d", "6mo"] as const).map((per) => (
          <a
            key={per}
            href={linkFor(email, provider, per)}
            style={{
              marginRight: 10,
              color: per === period ? "#22c55e" : "#6b7280",
              textDecoration: "none",
              fontWeight: per === period ? 700 : 400,
            }}
          >
            {per === "7d" ? "7일" : per === "30d" ? "30일" : "6개월"}
          </a>
        ))}
        {isLong && (
          <span style={{ color: "#6b7280", marginLeft: 6 }}>· 일별 피크</span>
        )}
      </div>

      {/* summary cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        <div style={card}>
          <div style={cardLabel}>5시간 사용량</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#06b6d4" }}>
            {pct(latest?.five_hour_utilization)}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
            {fmtResetIn(latest?.five_hour_resets_at ?? null, now)}
          </div>
        </div>
        <div style={card}>
          <div style={cardLabel}>7일 사용량</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#a78bfa" }}>
            {pct(latest?.seven_day_utilization)}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
            {fmtResetIn(latest?.seven_day_resets_at ?? null, now)}
          </div>
        </div>
        <div style={card}>
          <div style={cardLabel}>현재 플랜</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {isClaude ? latest?.plan ?? "—" : PROVIDER_LABEL[provider] ?? provider}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
            마지막 수집{" "}
            {latest ? fmtDateTime(Date.parse(latest.collected_at)) : "—"}
          </div>
        </div>
        <div style={card}>
          <div style={cardLabel}>7일 예측 (리셋 시)</div>
          {pred ? (
            <>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: pred.predicted >= 100 ? "#ef4444" : "#f59e0b",
                }}
              >
                ~{Math.round(pred.predicted)}%
              </div>
              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                {pred.reach100At
                  ? `${fmtDateTime(pred.reach100At)} 한도 도달 예상`
                  : `${(Math.round(pred.rate * 10) / 10).toFixed(1)}%/h 추세`}
              </div>
            </>
          ) : isLong ? (
            <div style={{ color: "#6b7280", fontSize: 13, paddingTop: 8 }}>
              장기 뷰에선 예측을 표시하지 않습니다 — 기간을 7일로 바꾸면 확인할 수 있어요.
            </div>
          ) : (
            <div style={{ color: "#6b7280", fontSize: 13, paddingTop: 8 }}>
              데이터 수집 중… (예측까지 2~3회 필요)
            </div>
          )}
        </div>
      </section>

      {/* charts */}
      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
          5시간 사용량 추세
        </div>
        <UsageChart points={p5} color="#06b6d4" resetMarkers={resetMarkers} />
      </section>

      <section style={{ ...card, marginTop: 12 }}>
        <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
          7일 사용량 추세{predPoint ? " · 점선 = 리셋 시 예측" : ""}
        </div>
        <UsageChart points={p7} color="#a78bfa" prediction={predPoint} resetMarkers={resetMarkers} />
      </section>

      {/* plan review (Claude only) */}
      {isClaude && review && (
        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
            요금제 리뷰
          </div>
          {(() => {
            const V: Record<string, { label: string; color: string }> = {
              keep: { label: "적정 (유지)", color: "#22c55e" },
              upgrade: { label: "업그레이드 권장", color: "#f59e0b" },
              downgrade: { label: "다운그레이드 가능", color: "#3b82f6" },
            };
            const v = V[review.verdict];
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                    flexWrap: "wrap",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      color: "#0b0d12",
                      background: v.color,
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {v.label}
                  </span>
                  <span style={{ color: "#9ca3af" }}>현재 {review.plan}</span>
                  {review.recommended && (
                    <span style={{ color: "#e5e7eb", fontWeight: 600 }}>
                      → {review.recommended}
                      {review.costDelta != null && (
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                          {" "}
                          ({review.costDelta > 0 ? "+" : ""}${review.costDelta}/mo)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <ul
                  style={{
                    margin: "10px 0 0",
                    paddingLeft: 18,
                    color: "#9ca3af",
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  {review.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 8 }}>
                  ※ 회사 업그레이드 요청 시 위 근거를 그대로 첨부할 수 있습니다.
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* plan fitness (Claude only) */}
      {isClaude && (
        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
            플랜 적합도
          </div>
          {fitness ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                marginTop: 8,
              }}
            >
              <thead>
                <tr style={{ color: "#9ca3af" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>플랜</th>
                  {WINDOWS.map((w) => (
                    <th key={w.key} style={{ padding: "6px 8px" }}>
                      {w.label}
                    </th>
                  ))}
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>비용</th>
                </tr>
              </thead>
              <tbody>
                {FITNESS_PLANS.map((name) => {
                  const row = fitness.plans.find((p) => p.name === name);
                  const isCurrent = name === fitness.current_plan;
                  const isRec = name === fitness.rec_plan;
                  return (
                    <tr
                      key={name}
                      style={{
                        borderTop: "1px solid #1a1e27",
                        background: isCurrent ? "#1a1f2e" : undefined,
                      }}
                    >
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        {name}
                        {isCurrent && (
                          <span
                            style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa" }}
                          >
                            현재
                          </span>
                        )}
                        {isRec && !isCurrent && (
                          <span
                            style={{ marginLeft: 6, fontSize: 10, color: "#22c55e" }}
                          >
                            추천
                          </span>
                        )}
                      </td>
                      {WINDOWS.map((w) => {
                        const cell = row?.windows[w.key];
                        const lv = cell ? LV[cell.level] : null;
                        return (
                          <td
                            key={w.key}
                            style={{ padding: "8px", textAlign: "center" }}
                          >
                            {lv ? (
                              <span
                                title={`${lv.label} (~${Math.round(
                                  cell!.projected
                                )}%)`}
                                style={{ color: lv.color, fontWeight: 700 }}
                              >
                                {lv.icon}
                              </span>
                            ) : (
                              <span style={{ color: "#4b5563" }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          color: "#9ca3af",
                        }}
                      >
                        {COST[name] ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "#6b7280", fontSize: 13, paddingTop: 8 }}>
              적합도 분석을 위한 데이터가 부족합니다.
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 10,
              flexWrap: "wrap",
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            {Object.values(LV).map((l) => (
              <span key={l.label}>
                <span style={{ color: l.color, fontWeight: 700 }}>{l.icon}</span>{" "}
                {l.label}
              </span>
            ))}
            <span>
              <span style={{ color: "#4b5563" }}>—</span> 데이터 없음
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
