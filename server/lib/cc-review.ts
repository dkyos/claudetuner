// Generate "how well am I using Claude Code + improvements" reports by calling
// the local `claude` CLI headless (subscription auth, no API key). The server
// builds a prompt from usage data + my-request samples, runs `claude -p`, and
// stores the markdown result.
import { spawn } from "child_process";
import os from "os";
import {
  getCcSessions,
  getCcUserMessages,
  getCcToolUsage,
  getCcStats,
  getCcSession,
} from "./db";

function sample(text: string | null, n = 300): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// Overall prompt: stats + work types + first requests from the busiest sessions.
export function buildOverallPrompt(): string {
  const sessions = getCcSessions({ limit: 2000 });
  const tools = getCcToolUsage(15);
  const stats = getCcStats();
  const totalReq = sessions.reduce((n, s) => n + (s.user_turns || 0), 0);
  const top = [...sessions]
    .sort((a, b) => (b.user_turns || 0) - (a.user_turns || 0))
    .slice(0, 18);
  const samples = top
    .map((s) => {
      const reqs = getCcUserMessages(s.session_id)
        .slice(0, 5)
        .map((m) => `- ${sample(m.text)}`)
        .join("\n");
      return `### [${s.project ?? "?"}] ${s.title ?? "(제목 없음)"} — 내 요청 ${s.user_turns}개\n${reqs}`;
    })
    .join("\n\n");

  return [
    "당신은 Claude Code(CLI) 사용 코치입니다. 아래는 한 개발자의 실제 사용 데이터입니다.",
    "분석만 하세요 — 파일 읽기/도구 사용 금지, 주어진 데이터만 사용.",
    "",
    "## 전체 통계",
    `- 세션 ${stats.sessions}개, 내 요청(human turn) ${totalReq}개`,
    `- 작업 유형(도구 사용 빈도): ${tools.map((t) => `${t.tool_name} ${t.uses}`).join(", ")}`,
    "",
    "## 대표 세션의 내 요청 샘플",
    samples,
    "",
    "## 작성 지시 (한국어 마크다운)",
    "다음 4개 섹션으로 간결하고 구체적으로 작성하세요:",
    "1. **활용 패턴 요약** — 주로 어떤 작업에 쓰는지, 내 요청 스타일의 특징",
    "2. **잘하고 있는 점** — 구조적으로 잘 이끄는 부분",
    "3. **개선점 (핵심)** — 모호/비효율했던 요청 패턴을 실제 샘플에 근거해 지적하고, **더 나은 요청 예시(before → after)**를 제시. 반복되는 비효율, CLAUDE.md·커스텀 슬래시명령·워크플로 제안 포함",
    "4. **요금제 관점** — 사용량 규모로 볼 때 코멘트",
  ].join("\n");
}

// Session prompt: all my requests in one session.
export function buildSessionPrompt(sessionId: string): string {
  const s = getCcSession(sessionId);
  const reqs = getCcUserMessages(sessionId);
  const body = reqs.map((m, i) => `${i + 1}. ${sample(m.text, 500)}`).join("\n");
  return [
    "당신은 Claude Code 사용 코치입니다. 아래는 한 세션에서 사용자가 보낸 요청들(시간순)입니다.",
    "분석만 하세요 — 도구 사용 금지.",
    "",
    `## 세션: [${s?.project ?? "?"}] ${s?.title ?? ""}`,
    `## 내 요청 ${reqs.length}개`,
    body,
    "",
    "## 작성 지시 (한국어 마크다운)",
    "1. **이 세션에서 내가 일을 이끈 방식** 요약",
    "2. **개선점** — 모호하거나 더 잘 쪼갤 수 있던 요청을 지적하고 **before → after 예시** 제시",
    "3. 다음에 비슷한 작업 시 **첫 요청을 어떻게 쓰면 좋을지** 한 문단",
  ].join("\n");
}

export interface ReviewResult {
  ok: boolean;
  content?: string;
  error?: string;
}

// Run `claude -p` with tools disabled, in a neutral cwd, with a timeout.
export function runClaudeReview(prompt: string): Promise<ReviewResult> {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(
        "claude",
        [
          "-p",
          prompt,
          "--disallowedTools",
          "Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit",
        ],
        { cwd: os.tmpdir(), env: process.env, timeout: 180_000 }
      );
    } catch (e: any) {
      resolve({ ok: false, error: String(e?.message || e) });
      return;
    }
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) => resolve({ ok: false, error: e.message }));
    proc.on("close", (code) => {
      if (code === 0 && out.trim()) resolve({ ok: true, content: out.trim() });
      else resolve({ ok: false, error: (err || `exit ${code}`).slice(0, 600) });
    });
  });
}
