// Optional debug page (the popup is the real dashboard). Shows the latest
// snapshots stored locally so you can confirm ingestion at a glance.
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Row {
  id: number;
  user_email: string;
  plan: string | null;
  five_hour_utilization: number | null;
  seven_day_utilization: number | null;
  collected_at: string;
}

export default function Page() {
  const db = getDb();
  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM snapshots").get() as { c: number }
  ).c;
  const rows = db
    .prepare(
      `SELECT id, user_email, plan, five_hour_utilization, seven_day_utilization, collected_at
       FROM snapshots ORDER BY id DESC LIMIT 50`
    )
    .all() as unknown as Row[];

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 10px",
    borderBottom: "1px solid #2a2f3a",
    color: "#9ca3af",
    fontWeight: 600,
  };
  const td: React.CSSProperties = {
    padding: "6px 10px",
    borderBottom: "1px solid #1a1e27",
  };

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>
        Claude Monitor — Local Server
      </h1>
      <p style={{ color: "#9ca3af", marginTop: 0 }}>
        {total} snapshot(s) stored · API at <code>/api/snapshots</code>. The
        extension popup is the real dashboard.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No snapshots yet. Load the extension (pointed at this server), open
          claude.ai, and wait for a collection cycle.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>user</th>
              <th style={th}>plan</th>
              <th style={th}>5h %</th>
              <th style={th}>7d %</th>
              <th style={th}>collected_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.user_email}</td>
                <td style={td}>{r.plan ?? "—"}</td>
                <td style={td}>{r.five_hour_utilization ?? "—"}</td>
                <td style={td}>{r.seven_day_utilization ?? "—"}</td>
                <td style={td}>{r.collected_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
