"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Triggers POST /api/cc/review (server calls `claude` CLI) then refreshes.
export function ReviewButton({
  scope,
  sessionId,
  hasReport,
}: {
  scope: "overall" | "session";
  sessionId?: string;
  hasReport: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  const run = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/cc/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, session_id: sessionId }),
      });
      const j = await res.json();
      if (j.ok) router.refresh();
      else setErr(j.error || "실패");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: "7px 14px",
          background: loading ? "#334155" : "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading
          ? "분석 중… (최대 3분)"
          : hasReport
            ? "다시 분석"
            : "Claude로 개선점 분석"}
      </button>
      {err && <span style={{ color: "#ef4444", fontSize: 12 }}>{err}</span>}
    </span>
  );
}
