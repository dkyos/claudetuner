# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Claude Tuner is a Chrome MV3 extension that tracks Claude.ai usage limits (5h / 7d
windows) and optionally ChatGPT/Gemini — surfacing live gauges, trend charts, reset
predictions, alerts, and plan-fitness/upgrade recommendations.

This fork runs the extension against a **personal local backend** (`server/`) instead
of the cloud `api.claudetuner.com`: every server data path and dashboard link in the
extension points at `http://localhost:3000`.

## Commands

### Extension — no build step
Vanilla JS, no bundler/transpile. The files in the repo root ARE the extension.
- Load: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the repo root.
- After editing extension files: **Reload** the extension from `chrome://extensions`.
- Test both `en` and `ko` locales; user-facing strings live in `i18n.js` AND `_locales/{en,ko}/messages.json`.

### Local server (`server/`)
- `cd server && npm install`
- `npm run dev` → `http://localhost:3000` (also `npm run build`, `npm start`)
- Uses Node's builtin `node:sqlite` (no native compile). DB file `server/data.sqlite` is gitignored.

### Tests
No automated test runner. `test/*.js` are manual scripts pasted into the **service worker
DevTools console** (e.g. `test/test-gemini-sw-fetch.js` documents its own run steps in a header comment).

## Architecture

### Extension — three layers
1. **Service worker** — `background.js` + `bg/*` (ES modules): alarm-driven collection.
   - `bg/api.js` reads usage from Claude.ai via a dual path: `chrome.scripting.executeScript`
     into a claude.ai tab first, then a cookie-based fetch fallback. **Never repoint this at
     localhost** — it's the data source.
   - `bg/storage.js` `postSnapshot()` sends snapshots to the server; `bg/collect.js` is the
     collection engine; `bg/plan.js` handles plan detection/change/recommendations;
     `bg/collect-{chatgpt,gemini}.js` cover the extra providers.
   - `bg/send-gate.js` + `bg/cadence-config.js`: the server can tune collect/send cadence, but
     hardcoded defaults always keep the extension working standalone; a 5xx/network failure
     triggers exponential POST backoff (`_serverBackoff` in `chrome.storage.local`).
2. **Content scripts** (injected into claude.ai/ChatGPT): `usage-shared.js` (shared `CORE`
   helpers), `sidebar-usage.js`, `input-usage.js`, `chatgpt-*.js`, `page-script.js`. These render
   in-page usage overlays.
3. **Popup / Options UI** — `popup.html`/`popup.js` + `ui/*` (ES modules): rendered entirely from
   `chrome.storage.local` (gauges, charts, prediction, recommendation). `ui/recommend.js` and
   `ui/notices.js` are the only popup pieces that fetch the server (fitness matrix, announcements).

### Data flow
claude.ai → SW collection → `chrome.storage.local` (usageHistory) **and** server `POST /api/snapshots`.
The popup dashboard draws from local data — the server only supplies the plan-fitness matrix and
announcements/promos, both of which fail silently if absent.

### Config — keep two files in sync
- `config.js` defines global `CT_CONFIG` (a classic script used by content scripts + popup).
- `bg/constants.js` exports the same constants as an ES module (for the service worker).
- Both declare `DEFAULT_SERVER_URL` / `DEFAULT_API_KEY` — **change them together**.
- The effective `serverUrl` comes from `chrome.storage.sync` (default is only a fallback); a stored
  cloud URL overrides the default, so `background.js` has a migration that forces stored
  `*claudetuner*` URLs onto the local default.

### Auth & server contract
- Auth header: `X-API-Key` (default key) or an `ext_token` `Bearer` issued on the first response (TOFU).
  See `bg/storage.js` `authedFetch` / `ui/auth.js` `_authedFetch`.
- **A backend must never return 401/403/410**: 401/403 clears `ext_token` and starts a re-auth loop;
  410 `{account_deleted}` stops collection permanently. Always 200 (fire-and-forget endpoints: 204).
- `GET /api/announcements` and `/api/promos` must return a JSON **array**.

### i18n
`i18n.js` exposes `t()` with inline `ko`/`en` dictionaries. `_locales/{en,ko}/messages.json` holds
the manifest `__MSG_*__` strings. Add user-facing text to both.

### Local server (`server/`)
Next.js App Router + `node:sqlite`. Route handlers under `app/api/**` (full surface documented in
`API.md`). `lib/db.ts` (schema + queries, scoped per `provider`), `lib/plans.ts` (fitness +
upgrade/downgrade heuristics), `lib/predict.ts` (7d reset projection), `lib/auth.ts` (loose, always
allows). `app/dashboard/page.tsx` is the local dashboard with a Claude/Gemini/ChatGPT switcher.
Snapshots are stored and queried **per provider** so the services don't mix into one timeline.

## Conventions
- No build/transpile: `bg/` and `ui/` are ES modules; `config.js` and `i18n.js` are classic scripts
  exposing globals.
- Upstream this repo is a read-only mirror of a private monorepo (see `CONTRIBUTING.md`), but this
  personal fork commits directly to `main`.
- The extension is self-hostable by design (`README.md` → Self-Hosting); `API.md` is the server spec.
