// Scan ~/.claude/projects for Claude Code transcripts and upsert them into the
// DB. Incremental: skip files whose mtime is unchanged since the last sync.
import fs from "fs";
import path from "path";
import os from "os";
import { parseTranscript } from "./cc-transcript";
import { getCcSessionMtimes, upsertCcSession } from "./db";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

export function scanCcTranscripts(): {
  scanned: number;
  updated: number;
  skipped: number;
} {
  let scanned = 0,
    updated = 0,
    skipped = 0;
  if (!fs.existsSync(PROJECTS_DIR)) return { scanned, updated, skipped };

  const known = getCcSessionMtimes();

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR);
  } catch {
    return { scanned, updated, skipped };
  }

  for (const proj of projectDirs) {
    const dir = path.join(PROJECTS_DIR, proj);
    let dstat: fs.Stats;
    try {
      dstat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!dstat.isDirectory()) continue;

    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = path.join(dir, f);
      let fstat: fs.Stats;
      try {
        fstat = fs.statSync(fp);
      } catch {
        continue;
      }
      scanned++;
      const mtime = Math.floor(fstat.mtimeMs);
      const sid = f.replace(/\.jsonl$/, "");
      if (known.get(sid) === mtime) {
        skipped++;
        continue; // unchanged since last scan
      }
      const parsed = parseTranscript(fp, mtime);
      if (!parsed) continue;
      try {
        upsertCcSession(parsed);
        updated++;
      } catch {
        /* skip malformed/oversized */
      }
    }
  }
  return { scanned, updated, skipped };
}
