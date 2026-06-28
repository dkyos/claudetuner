// Claude Code (CLI) usage dashboard — scanned from ~/.claude/projects transcripts.
// Token usage trend + per-project breakdown + session list (click → conversation).
import {
  getCcStats,
  getCcDailyTokens,
  getCcProjectTokens,
  getCcSessions,
} from "@/lib/db";
import { scanCcTranscripts } from "@/lib/cc-scan";

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
const cardLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginBottom: 6,
};

function TokenBars({ daily }: { daily: { date: string; total: number }[] }) {
  const W = 680,
    H = 160,
    padL = 4,
    padR = 4,
    padT = 10,
    padB = 18;
  if (!daily.length)
    return <div style={{ color: "#6b7280", fontSize: 13 }}>데이터 없음</div>;
  const max = Math.max(...daily.map((d) => d.total), 1);
  const bw = (W - padL - padR) / daily.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img">
      {daily.map((d, i) => {
        const h = ((H - padT - padB) * d.total) / max;
        return (
          <rect
            key={i}
            x={padL + i * bw + bw * 0.1}
            y={H - padB - h}
            width={bw * 0.8}
            height={h}
            fill="#06b6d4"
            opacity={0.8}
          />
        );
      })}
      <text x={padL} y={H - 4} fill="#6b7280" fontSize={9}>
        {daily[0].date.slice(5)}
      </text>
      <text x={W - padR} y={H - 4} fill="#6b7280" fontSize={9} textAnchor="end">
        {daily[daily.length - 1].date.slice(5)}
      </text>
    </svg>
  );
}

export default async function CcPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; project?: string }>;
}) {
  const sp = await searchParams;
  // Incremental scan on view (instrumentation removed — node: scheme can't bundle
  // there). First visit indexes all projects; later visits are cheap (mtime skip).
  try {
    scanCcTranscripts();
  } catch {
    /* ignore scan errors */
  }
  const q = sp.q || "";
  const project = sp.project || undefined;

  const stats = getCcStats();
  const daily = getCcDailyTokens(180).map((d) => ({
    date: d.date,
    total: d.input_tokens + d.output_tokens + d.cache_tokens,
  }));
  const projects = getCcProjectTokens(180);
  const sessions = getCcSessions({ search: q || null, project: project || null, limit: 500 });

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: "1px solid #2a2f3a",
    color: "#9ca3af",
    fontWeight: 600,
    fontSize: 12,
  };
  const td: React.CSSProperties = {
    padding: "8px 10px",
    borderBottom: "1px solid #1a1e27",
    fontSize: 13,
  };

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
        <h1 style={{ fontSize: 22, margin: 0 }}>Claude Code 사용 분석</h1>
        <a href="/dashboard" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
          ← 사용량 대시보드
        </a>
      </div>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
        ~/.claude/projects transcript 기준 · 세션 {stats.sessions} · 메시지 {stats.messages}
      </p>

      {stats.sessions === 0 ? (
        <div style={{ ...card, color: "#9ca3af", fontSize: 13, lineHeight: 1.7 }}>
          아직 스캔된 Claude Code 세션이 없습니다. 서버가 부팅·10분마다 자동
          스캔하며, 즉시 스캔하려면{" "}
          <a href="/api/cc/scan" style={{ color: "#7dd3fc" }}>
            /api/cc/scan
          </a>{" "}
          을 여세요.
        </div>
      ) : (
        <>
          {/* token summary cards */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <div style={card}>
              <div style={cardLabel}>입력 토큰</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#06b6d4" }}>
                {fmtTokens(stats.input_tokens)}
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>출력 토큰</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#a78bfa" }}>
                {fmtTokens(stats.output_tokens)}
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>캐시 토큰</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#22c55e" }}>
                {fmtTokens(stats.cache_tokens)}
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>세션 / 메시지</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {stats.sessions}
                <span style={{ fontSize: 14, color: "#9ca3af" }}> / {stats.messages}</span>
              </div>
            </div>
          </section>

          {/* daily token trend */}
          <section style={{ ...card, marginTop: 16 }}>
            <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
              일별 토큰 사용량 (최근 180일)
            </div>
            <TokenBars daily={daily} />
          </section>

          {/* per-project */}
          <section style={{ ...card, marginTop: 16 }}>
            <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600 }}>
              프로젝트별 사용량
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={th}>프로젝트</th>
                  <th style={{ ...th, textAlign: "right" }}>세션</th>
                  <th style={{ ...th, textAlign: "right" }}>메시지</th>
                  <th style={{ ...th, textAlign: "right" }}>입력</th>
                  <th style={{ ...th, textAlign: "right" }}>출력</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 15).map((p) => (
                  <tr key={p.project ?? "?"}>
                    <td style={td}>
                      <a
                        href={`/dashboard/cc?project=${encodeURIComponent(p.project ?? "")}`}
                        style={{ color: "#a78bfa", textDecoration: "none" }}
                      >
                        {p.project ?? "(unknown)"}
                      </a>
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{p.sessions}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{p.messages}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{fmtTokens(p.input_tokens)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{fmtTokens(p.output_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* session list */}
          <section style={{ ...card, marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ ...cardLabel, color: "#e5e7eb", fontWeight: 600, margin: 0 }}>
                세션 {project ? `· ${project}` : ""}
              </div>
              <form method="get" style={{ margin: 0 }}>
                {project && <input type="hidden" name="project" value={project} />}
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="제목·프로젝트 검색…"
                  style={{
                    padding: "6px 10px",
                    background: "#0b0d12",
                    border: "1px solid #2a2f3a",
                    borderRadius: 8,
                    color: "#e5e7eb",
                    fontSize: 12,
                    width: 220,
                  }}
                />
              </form>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={th}>제목</th>
                  <th style={{ ...th, width: 120 }}>프로젝트</th>
                  <th style={{ ...th, textAlign: "right", width: 60 }}>메시지</th>
                  <th style={{ ...th, textAlign: "right", width: 70 }}>토큰</th>
                  <th style={{ ...th, width: 110 }}>시각</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td style={td}>
                      <a
                        href={`/dashboard/cc/${s.session_id}`}
                        style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}
                      >
                        {s.title || "(제목 없음)"}
                      </a>
                    </td>
                    <td style={{ ...td, color: "#6b7280", fontSize: 11 }}>{s.project ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>{s.message_count}</td>
                    <td style={{ ...td, textAlign: "right", color: "#9ca3af" }}>
                      {fmtTokens(s.input_tokens + s.output_tokens)}
                    </td>
                    <td style={{ ...td, color: "#9ca3af" }}>{fmtDate(s.ended_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
