// Parse one Claude Code transcript (~/.claude/projects/<enc>/<sessionId>.jsonl)
// into a session record + flattened messages + token totals. Reads only the
// fields we need; tolerant of malformed lines.
import fs from "fs";
import type { CcSessionInput, CcMessageInput } from "./db";

const TEXT_CAP = 4000; // cap stored text per message to bound DB size

function cap(s: string): string {
  return s.length > TEXT_CAP ? s.slice(0, TEXT_CAP) + " …(truncated)" : s;
}

function summarizeToolInput(input: unknown): string {
  if (input == null) return "";
  try {
    const s = typeof input === "string" ? input : JSON.stringify(input);
    return cap(s);
  } catch {
    return "";
  }
}

function summarizeToolResult(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return cap(content);
  if (Array.isArray(content)) {
    const text = content
      .map((b) =>
        b && typeof b === "object" && "text" in b
          ? String((b as { text?: unknown }).text ?? "")
          : typeof b === "string"
            ? b
            : ""
      )
      .filter(Boolean)
      .join("\n");
    return cap(text);
  }
  try {
    return cap(JSON.stringify(content));
  } catch {
    return "";
  }
}

export function parseTranscript(
  filePath: string,
  mtimeMs: number
): CcSessionInput | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let sessionId: string | null = null;
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let ccVersion: string | null = null;
  let title: string | null = null;
  let firstTs: string | null = null;
  let lastTs: string | null = null;
  let inTok = 0,
    outTok = 0,
    cacheTok = 0;
  const messages: CcMessageInput[] = [];
  let idx = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let o: any;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.sessionId && !sessionId) sessionId = o.sessionId;
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.gitBranch && !gitBranch) gitBranch = o.gitBranch;
    if (o.version && !ccVersion) ccVersion = o.version;
    if (o.timestamp) {
      if (!firstTs) firstTs = o.timestamp;
      lastTs = o.timestamp;
    }
    if (o.type === "ai-title" && o.aiTitle) title = o.aiTitle;

    if (o.type !== "user" && o.type !== "assistant") continue;
    const m = o.message;
    if (!m || typeof m !== "object") continue;
    const role: string = m.role || o.type;

    if (o.type === "assistant" && m.usage) {
      inTok += m.usage.input_tokens || 0;
      outTok += m.usage.output_tokens || 0;
      cacheTok +=
        (m.usage.cache_creation_input_tokens || 0) +
        (m.usage.cache_read_input_tokens || 0);
    }

    const c = m.content;
    const push = (kind: string, text: string, tool_name: string | null) =>
      messages.push({
        idx: idx++,
        role,
        kind,
        text,
        tool_name,
        created_at: o.timestamp || null,
      });

    if (typeof c === "string") {
      if (c.trim()) push("text", cap(c), null);
    } else if (Array.isArray(c)) {
      for (const b of c) {
        if (!b || typeof b !== "object") continue;
        if (b.type === "text" && b.text) push("text", cap(b.text), null);
        else if (b.type === "thinking")
          push("thinking", cap(b.thinking || b.text || ""), null);
        else if (b.type === "tool_use")
          push("tool_use", summarizeToolInput(b.input), b.name || null);
        else if (b.type === "tool_result")
          push("tool_result", summarizeToolResult(b.content), null);
      }
    }
  }

  if (!sessionId) return null;
  const project = cwd
    ? cwd.split("/").filter(Boolean).pop() || cwd
    : null;

  return {
    session_id: sessionId,
    project,
    cwd,
    title,
    git_branch: gitBranch,
    cc_version: ccVersion,
    started_at: firstTs,
    ended_at: lastTs,
    input_tokens: inTok,
    output_tokens: outTok,
    cache_tokens: cacheTok,
    source_path: filePath,
    mtime_ms: mtimeMs,
    messages,
  };
}
