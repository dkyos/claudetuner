// Claude Code session — MY REQUESTS first. Each user turn is the primary content
// ("요청 N"); Claude's response (assistant text + thinking + tools) is collapsed
// into a one-line summary you expand on demand. Keeps focus on how I drive the work.
import { getCcSession, getCcMessages, type CcMessageRow } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(t: string | null): string {
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1000) + "K";
  return String(n);
}

interface Block {
  request: CcMessageRow;
  responses: CcMessageRow[];
}

export default async function CcSessionDetail({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const s = getCcSession(sessionId);

  if (!s) {
    return (
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px" }}>
        <a href="/dashboard/cc" style={{ color: "#6b7280", fontSize: 13 }}>
          ← Claude Code
        </a>
        <p style={{ color: "#9ca3af", marginTop: 16 }}>세션을 찾을 수 없습니다.</p>
      </main>
    );
  }

  const msgs = getCcMessages(sessionId);
  // Group: each user-text turn starts a block; following non-user messages are
  // that request's response.
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const m of msgs) {
    if (m.role === "user" && m.kind === "text") {
      cur = { request: m, responses: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.responses.push(m);
    }
  }

  const avgLen = s.user_turns ? Math.round(s.user_chars / s.user_turns) : 0;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" }}>
      <a
        href="/dashboard/cc"
        style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}
      >
        ← Claude Code
      </a>
      <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>
        {s.title || "(제목 없음)"}
      </h1>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>
        {s.project ?? "—"}
        {s.git_branch ? ` · ${s.git_branch}` : ""} · {fmt(s.ended_at)}
        {s.cc_version ? ` · v${s.cc_version}` : ""}
      </div>
      <div style={{ color: "#7dd3fc", fontSize: 13, marginBottom: 20 }}>
        내 요청 <b>{s.user_turns}</b>개 · 평균 {avgLen}자 · 토큰{" "}
        {fmtTokens(s.input_tokens + s.output_tokens)}
      </div>

      {blocks.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>내 요청이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {blocks.map((b, i) => {
            const reqLen = (b.request.text || "").length;
            const asstText = b.responses
              .filter((r) => r.role === "assistant" && r.kind === "text")
              .map((r) => r.text || "")
              .join("\n")
              .trim();
            const toolCount = b.responses.filter((r) => r.kind === "tool_use").length;
            const thinkCount = b.responses.filter((r) => r.kind === "thinking").length;
            const summary =
              (asstText.slice(0, 90).replace(/\n/g, " ") || "(텍스트 응답 없음)") +
              (asstText.length > 90 ? "…" : "");
            return (
              <div key={i}>
                {/* MY REQUEST — primary */}
                <div
                  style={{
                    background: "#11151d",
                    border: "1px solid #243042",
                    borderLeft: "3px solid #7dd3fc",
                    borderRadius: 10,
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#7dd3fc",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    요청 {i + 1}
                    <span style={{ color: "#4b5563", fontWeight: 400, marginLeft: 8 }}>
                      {reqLen}자 · {fmt(b.request.created_at)}
                    </span>
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: "#e5e7eb",
                    }}
                  >
                    {b.request.text}
                  </div>
                </div>

                {/* Claude response — collapsed one-line summary */}
                <details style={{ marginTop: 6, marginLeft: 14 }}>
                  <summary
                    style={{
                      color: "#6b7280",
                      cursor: "pointer",
                      fontSize: 12,
                      listStyle: "none",
                    }}
                  >
                    ▸ 응답 · {summary}
                    <span style={{ color: "#4b5563", marginLeft: 8 }}>
                      {asstText.length > 0 ? `${asstText.length}자` : ""}
                      {toolCount ? ` · 🔧${toolCount}` : ""}
                      {thinkCount ? ` · 💭${thinkCount}` : ""}
                    </span>
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    {asstText && (
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "#cbd5e1",
                          background: "#0e1117",
                          border: "1px solid #1a1e27",
                          borderRadius: 8,
                          padding: "10px 12px",
                        }}
                      >
                        {asstText.length > 4000 ? asstText.slice(0, 4000) + " …" : asstText}
                      </div>
                    )}
                    {(toolCount > 0 || thinkCount > 0) && (
                      <div style={{ color: "#4b5563", fontSize: 11, marginTop: 6 }}>
                        {thinkCount > 0 && `thinking ${thinkCount} · `}
                        도구 사용 {toolCount}회
                        {(() => {
                          const tools = b.responses
                            .filter((r) => r.kind === "tool_use" && r.tool_name)
                            .map((r) => r.tool_name as string);
                          const counts: Record<string, number> = {};
                          for (const t of tools) counts[t] = (counts[t] || 0) + 1;
                          const top = Object.entries(counts)
                            .sort((a, b2) => b2[1] - a[1])
                            .slice(0, 5)
                            .map(([t, n]) => `${t}×${n}`)
                            .join(", ");
                          return top ? ` (${top})` : "";
                        })()}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
