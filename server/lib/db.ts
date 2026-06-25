// SQLite storage backed by Node's builtin `node:sqlite` (synchronous, no native
// install). One DB file lives at server/data.sqlite. The connection is cached on
// globalThis so Next.js dev HMR doesn't reopen it on every module re-eval.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data.sqlite");

type GlobalWithDb = typeof globalThis & { __ctDb?: DatabaseSync };

function init(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      provider TEXT,
      plan TEXT,
      org_uuid TEXT,
      install_id TEXT,
      five_hour_utilization REAL,
      five_hour_resets_at TEXT,
      seven_day_utilization REAL,
      seven_day_resets_at TEXT,
      extra_usage_used REAL,
      extra_usage_limit REAL,
      collected_at TEXT,
      raw TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migration: older DBs predate the provider column. Add it and backfill from
  // raw so existing rows (Claude/ChatGPT/Gemini mixed under one email) split.
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('snapshots')")
    .all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === "provider")) {
    db.exec("ALTER TABLE snapshots ADD COLUMN provider TEXT");
  }
  const needBackfill = db
    .prepare("SELECT id, raw FROM snapshots WHERE provider IS NULL")
    .all() as unknown as { id: number; raw: string }[];
  if (needBackfill.length) {
    const upd = db.prepare("UPDATE snapshots SET provider = ? WHERE id = ?");
    for (const r of needBackfill) {
      let p = "claude";
      try {
        p = JSON.parse(r.raw).provider || "claude";
      } catch {
        /* keep default */
      }
      upd.run(p, r.id);
    }
  }

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_snapshots_email_provider_collected ON snapshots(user_email, provider, collected_at);"
  );
  return db;
}

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalWithDb;
  if (!g.__ctDb) g.__ctDb = init();
  return g.__ctDb;
}

// Shape the extension expects in recent_snapshots[] (see bg/storage.js
// mergeServerSnapshots: it reads exactly these keys).
export interface RecentSnapshot {
  collected_at: string;
  five_hour_utilization: number | null;
  five_hour_resets_at: string | null;
  seven_day_utilization: number | null;
  seven_day_resets_at: string | null;
  extra_usage_used: number | null;
  extra_usage_limit: number | null;
}

export interface InsertSnapshotInput {
  user_email: string;
  provider: string;
  plan: string | null;
  org_uuid: string | null;
  install_id: string | null;
  five_hour_utilization: number | null;
  five_hour_resets_at: string | null;
  seven_day_utilization: number | null;
  seven_day_resets_at: string | null;
  extra_usage_used: number | null;
  extra_usage_limit: number | null;
  collected_at: string;
  raw: string;
}

export function insertSnapshot(s: InsertSnapshotInput): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO snapshots (
       user_email, provider, plan, org_uuid, install_id,
       five_hour_utilization, five_hour_resets_at,
       seven_day_utilization, seven_day_resets_at,
       extra_usage_used, extra_usage_limit,
       collected_at, raw, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    s.user_email,
    s.provider,
    s.plan,
    s.org_uuid,
    s.install_id,
    s.five_hour_utilization,
    s.five_hour_resets_at,
    s.seven_day_utilization,
    s.seven_day_resets_at,
    s.extra_usage_used,
    s.extra_usage_limit,
    s.collected_at,
    s.raw,
    new Date().toISOString()
  );
}

interface QueryOpts {
  provider?: string | null;
  orgUuid?: string | null;
}

// Most recent N snapshots for a user, returned oldest→newest (chart-friendly).
// Optional provider/org filters keep different services (Claude/Gemini/ChatGPT)
// from bleeding into one timeline.
export function getRecentSnapshots(
  email: string,
  limit = 200,
  opts: QueryOpts = {}
): RecentSnapshot[] {
  const db = getDb();
  const clauses = ["user_email = ?"];
  const args: (string | number)[] = [email];
  if (opts.provider) {
    clauses.push("provider = ?");
    args.push(opts.provider);
  }
  if (opts.orgUuid) {
    clauses.push("org_uuid = ?");
    args.push(opts.orgUuid);
  }
  args.push(limit);
  const rows = db
    .prepare(
      `SELECT collected_at, five_hour_utilization, five_hour_resets_at,
              seven_day_utilization, seven_day_resets_at,
              extra_usage_used, extra_usage_limit
       FROM snapshots
       WHERE ${clauses.join(" AND ")}
       ORDER BY collected_at DESC
       LIMIT ?`
    )
    .all(...args) as unknown as RecentSnapshot[];
  return rows.reverse();
}

export function getLatestSnapshot(
  email: string,
  provider?: string | null
): (RecentSnapshot & { plan: string | null }) | null {
  const db = getDb();
  const clauses = ["user_email = ?"];
  const args: string[] = [email];
  if (provider) {
    clauses.push("provider = ?");
    args.push(provider);
  }
  const row = db
    .prepare(
      `SELECT plan, collected_at, five_hour_utilization, five_hour_resets_at,
              seven_day_utilization, seven_day_resets_at,
              extra_usage_used, extra_usage_limit
       FROM snapshots
       WHERE ${clauses.join(" AND ")}
       ORDER BY collected_at DESC
       LIMIT 1`
    )
    .get(...args) as (RecentSnapshot & { plan: string | null }) | undefined;
  return row ?? null;
}

export interface UserSummary {
  user_email: string;
  count: number;
  latest: string;
}

// Distinct users with snapshot counts, most-recently-active first.
export function getUsers(): UserSummary[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT user_email, COUNT(*) AS count, MAX(collected_at) AS latest
       FROM snapshots
       GROUP BY user_email
       ORDER BY latest DESC`
    )
    .all() as unknown as UserSummary[];
}

export interface ProviderSummary {
  provider: string;
  count: number;
  latest: string;
}

// Distinct providers seen for one email (Claude/Gemini/ChatGPT), so the
// dashboard can offer a per-provider view instead of mixing them.
export function getProvidersForEmail(email: string): ProviderSummary[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT COALESCE(provider, 'claude') AS provider,
              COUNT(*) AS count, MAX(collected_at) AS latest
       FROM snapshots
       WHERE user_email = ?
       GROUP BY COALESCE(provider, 'claude')
       ORDER BY count DESC`
    )
    .all(email) as unknown as ProviderSummary[];
}
