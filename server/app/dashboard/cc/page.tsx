// Claude Code usage dashboard — usage patterns + project→session flow up top,
// my-request summary front and center, token stats tucked at the bottom.
import {
  getCcStats,
  getCcDailyTokens,
  getCcProjectTokens,
  getCcSessions,
  getCcToolUsage,
  getCcActivityByHour,
} from "@/lib/db";
import { scanCcTranscripts } from "@/lib/cc-scan";
import { Breadcrumb } from "../Breadcrumb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1000) + "K";
  return String(n);
}
function fmtDate(t: string | null): string {
  if (!t) return "—";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const card: React.CSSProperties = {
  background: "#11151d",
  border: "1px solid #1f2530",
  borderRadius: 12,
  padding: "16px 18px",
};
const cardLabel: React.CSSProperties = { color: "#9ca3af", fontSize: 12, marginBottom: 6 };
const sectionTitle: React.CSSProperties = {
  color: "#e5e7eb",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 10,
};

function HourBars({ hours }: { hours: { hour: number; sessions: number }[] }) {
  const map = new Map(hours.map((h) => [h.hour, h.sessions]));
  const max = Math.max(1, ...hours.map((h) => h.sessions));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56 }}>
      {Array.from({ length: 24 }, (_, h) => {
        const v = map.get(h) || 0;
        return (
          <div key={h} style={{ flex: 1, textAlign: "center" }}>
            <div
              title={`${h}시 · ${v}세션`}
              style={{
                height: `${(48 * v) / max}px`,
                background: v ? "#06b6d4" : "#1a1e27",
                borderRadius: 2,
                opacity: 0.85,
              }}
            />
            {h % 6 === 0 && (
              <div style={{ fontSize: 8, color: "#4b5563", marginTop: 2 }}>{h}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TokenBars({ daily }: { daily: { date: string; total: number }[] }) {
  const W = 680, H = 120, padB = 16;
  if (!daily.length) return <div style={{ color: "#6b7280", fontSize: 13 }}>데이터 없음</div>;
  const max = Math.max(...daily.map((d) => d.total), 1);
  const bw = W / daily.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img">
      {daily.map((d, i) => {
        const h = ((H - padB) * d.total) / max;
        return (
          <rect key={i} x={i * bw + bw * 0.1} y={H - padB - h} width={bw * 0.8} height={h} fill="#334155" />
        );
      })}
    </svg>
  );
}

export default async function CcPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; project?: string }>;
}) {
  const sp = await searchParams;
  try {
    scanCcTranscripts();
  } catch {
    /* ignore scan errors */
  }
  const q = sp.q || "";
  const project = sp.project || undefined;

  const stats = getCcStats();
  const sessions = getCcSessions({ search: q || null, project: project || null, limit: 1000 });
  // overall summary uses all sessions regardless of filter
  const allSessions = q || project ? getCcSessions({ limit: 2000 }) : sessions;
  const tools = getCcToolUsage(10);
  const hours = getCcActivityByHour();
  const projects = getCcProjectTokens(180);
  const daily = getCcDailyTokens(180).map((d) => ({
    date: d.date,
    total: d.input_tokens + d.output_tokens + d.cache_tokens,
  }));

  const totalUserTurns = allSessions.reduce((n, s) => n + (s.user_turns || 0), 0);
  const totalUserChars = allSessions.reduce((n, s) => n + (s.user_chars || 0), 0);
  const avgReqLen = totalUserTurns ? Math.round(totalUserChars / totalUserTurns) : 0;
  const avgReqPerSession = allSessions.length
    ? (totalUserTurns / allSessions.length).toFixed(1)
    : "0";
  const peak = [...hours].sort((a, b) => b.sessions - a.sessions)[0];
  const toolMax = Math.max(1, ...tools.map((t) => t.uses));

  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #2a2f3a",
    color: "#9ca3af", fontWeight: 600, fontSize: 12,
  };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #1a1e27", fontSize: 13 };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 64px" }}>
      <Breadcrumb
        items={[
          { label: "대시보드", href: "/dashboard" },
          { label: "Claude Code 분석" },
        ]}
      />
      <h1 style={{ fontSize: 22, margin: 0 }}>Claude Code 활용 분석</h1>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
        ~/.claude/projects 기준 · 세션 {stats.sessions} · 내 요청 {totalUserTurns}개
      </p>
      <div style={{ marginTop: 4 }}>
        <a
          href="/dashboard/cc/review"
          style={{ color: "#c4b5fd", fontSize: 13, textDecoration: "none", fontWeight: 600 }}
        >
          🔍 Claude로 활용 리뷰·개선점 분석 →
        </a>
      </div>

      {stats.sessions === 0 ? (
        <div style={{ ...card, color: "#9ca3af", fontSize: 13, lineHeight: 1.7 }}>
          아직 스캔된 Claude Code 세션이 없습니다.{" "}
          <a href="/api/cc/scan" style={{ color: "#7dd3fc" }}>/api/cc/scan</a> 으로 스캔하세요.
        </div>
      ) : (
        <>
          {/* my-request summary */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12, marginTop: 16,
            }}
          >
            <div style={card}>
              <div style={cardLabel}>내 요청 수</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#7dd3fc" }}>{totalUserTurns}</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>평균 요청 길이</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{avgReqLen}<span style={{ fontSize: 13, color: "#9ca3af" }}>자</span></div>
            </div>
            <div style={card}>
              <div style={cardLabel}>세션당 요청</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{avgReqPerSession}</div>
            </div>
            <div style={card}>
              <div style={cardLabel}>주 활동 시간</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#06b6d4" }}>
                {peak ? `${peak.hour}시` : "—"}
              </div>
            </div>
          </section>

          {/* work type + activity */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div style={card}>
              <div style={sectionTitle}>작업 유형 (Claude에게 시키는 일)</div>
              {tools.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 13 }}>—</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tools.map((t) => (
                    <div key={t.tool_name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 96, fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.tool_name}
                      </div>
                      <div style={{ flex: 1, background: "#0e1117", borderRadius: 4, height: 14 }}>
                        <div style={{ width: `${(100 * t.uses) / toolMax}%`, background: "#a78bfa", height: "100%", borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 48, textAlign: "right", fontSize: 11, color: "#9ca3af" }}>{t.uses}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={card}>
              <div style={sectionTitle}>시간대별 활동 (세션 시작, UTC시)</div>
              <HourBars hours={hours} />
            </div>
          </section>

          {/* projects */}
          <section style={{ ...card, marginTop: 12 }}>
            <div style={sectionTitle}>프로젝트</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>프로젝트</th>
                  <th style={{ ...th, textAlign: "right" }}>세션</th>
                  <th style={{ ...th, textAlign: "right" }}>메시지</th>
                  <th style={{ ...th, textAlign: "right" }}>토큰</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 12).map((p) => (
                  <tr key={p.project ?? "?"}>
                    <td style={td}>
                      <a href={`/dashboard/cc?project=${encodeURIComponent(p.project ?? "")}`} style={{ color: "#a78bfa", textDecoration: "none" }}>
                        {p.project ?? "(unknown)"}
                      </a>
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{p.sessions}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{p.messages}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{fmtTokens(p.input_tokens + p.output_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* session list — first request preview as primary */}
          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ ...sectionTitle, margin: 0 }}>세션 {project ? `· ${project}` : ""} (내 첫 요청)</div>
              <form method="get" style={{ margin: 0 }}>
                {project && <input type="hidden" name="project" value={project} />}
                <input type="text" name="q" defaultValue={q} placeholder="검색…"
                  style={{ padding: "6px 10px", background: "#0b0d12", border: "1px solid #2a2f3a", borderRadius: 8, color: "#e5e7eb", fontSize: 12, width: 200 }} />
              </form>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
              {sessions.map((s) => (
                <a
                  key={s.session_id}
                  href={`/dashboard/cc/${s.session_id}`}
                  style={{
                    display: "block", textDecoration: "none", padding: "10px 12px",
                    borderRadius: 8, border: "1px solid #1a1e27", background: "#0e1117",
                  }}
                >
                  <div style={{ fontSize: 13.5, color: "#e5e7eb", lineHeight: 1.5, marginBottom: 4 }}>
                    {s.first_user_prompt || s.title || "(요청 없음)"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {s.title ? `${s.title} · ` : ""}{s.project ?? "—"} · 내 요청 {s.user_turns}개 · {fmtDate(s.ended_at)}
                  </div>
                </a>
              ))}
            </div>
          </section>

          {/* token stats — secondary, collapsed */}
          <details style={{ ...card, marginTop: 12 }}>
            <summary style={{ ...sectionTitle, margin: 0, cursor: "pointer", color: "#9ca3af" }}>
              토큰 사용량 (입력 {fmtTokens(stats.input_tokens)} / 출력 {fmtTokens(stats.output_tokens)} / 캐시 {fmtTokens(stats.cache_tokens)}) ▾
            </summary>
            <div style={{ marginTop: 12 }}>
              <div style={{ ...cardLabel }}>일별 토큰 (최근 180일)</div>
              <TokenBars daily={daily} />
            </div>
          </details>
        </>
      )}
    </main>
  );
}
