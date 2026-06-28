// Claude Code session detail — full message timeline (text / thinking / tool
// use / tool result). thinking & tool blocks are collapsed by default (<details>).
import { getCcSession, getCcMessages } from "@/lib/db";

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
          ← Claude Code 세션
        </a>
        <p style={{ color: "#9ca3af", marginTop: 16 }}>세션을 찾을 수 없습니다.</p>
      </main>
    );
  }

  const msgs = getCcMessages(sessionId);
  const isHuman = (r: string | null) => (r || "").toLowerCase() === "user";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" }}>
      <a
        href="/dashboard/cc"
        style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}
      >
        ← Claude Code 세션
      </a>
      <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>
        {s.title || "(제목 없음)"}
      </h1>
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>
        {s.project ?? "—"}
        {s.git_branch ? ` · ${s.git_branch}` : ""} · 메시지 {s.message_count} · 토큰{" "}
        {fmtTokens(s.input_tokens + s.output_tokens)} (in {fmtTokens(s.input_tokens)} / out{" "}
        {fmtTokens(s.output_tokens)}) · {fmt(s.ended_at)}
        {s.cc_version ? ` · v${s.cc_version}` : ""}
      </div>

      {msgs.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>저장된 메시지가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => {
            const human = isHuman(m.role);
            // thinking / tool blocks: collapsed, muted
            if (m.kind === "thinking" || m.kind === "tool_use" || m.kind === "tool_result") {
              const label =
                m.kind === "thinking"
                  ? "💭 thinking"
                  : m.kind === "tool_use"
                    ? `🔧 ${m.tool_name || "tool"}`
                    : "↩ tool result";
              return (
                <details
                  key={i}
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "92%",
                    background: "#0e1117",
                    border: "1px solid #1a1e27",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                >
                  <summary style={{ color: "#6b7280", cursor: "pointer" }}>
                    {label}
                    {m.created_at ? (
                      <span style={{ marginLeft: 6, color: "#4b5563" }}>{fmt(m.created_at)}</span>
                    ) : null}
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "#9ca3af",
                      margin: "6px 0 0",
                      fontSize: 11.5,
                      lineHeight: 1.55,
                    }}
                  >
                    {m.text}
                  </pre>
                </details>
              );
            }
            // text bubble
            return (
              <div
                key={i}
                style={{
                  alignSelf: human ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: human ? "#1e293b" : "#11151d",
                  border: `1px solid ${human ? "#334155" : "#1f2530"}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: human ? "#7dd3fc" : "#a78bfa",
                    fontWeight: 700,
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {human ? "나" : "assistant"}
                  {m.created_at ? (
                    <span style={{ color: "#4b5563", fontWeight: 400, marginLeft: 6 }}>
                      {fmt(m.created_at)}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: "#e5e7eb",
                  }}
                >
                  {m.text || <span style={{ color: "#4b5563" }}>(빈 메시지)</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
