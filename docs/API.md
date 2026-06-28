# Claude Monitor API (Local Server)

This fork runs against a **personal local backend** at `http://localhost:3000` — the
`server/` directory in this repo (Next.js App Router + `node:sqlite`). This document
lists the endpoints the extension and dashboard use.

> The server is part of this repo and self-hostable. See `../CLAUDE.md` (architecture)
> and `../CONTRIBUTING.md` (running it locally).

## Authentication

Requests send an `X-API-Key` header (default key in the extension config) or an
`ext_token` `Bearer` issued on the first response (TOFU). The local server's auth is
loose and **always allows** — by contract a backend must never return 401/403/410
(401/403 clears `ext_token` and starts a re-auth loop; 410 stops collection). Always
200; fire-and-forget endpoints return 204.

## Endpoints

### Snapshots

#### `POST /api/snapshots`

Submit a usage snapshot. Main data-collection endpoint, called every polling cycle.

**Headers:** `X-API-Key` (or `Authorization: Bearer <ext_token>`), `Content-Type: application/json`

**Request body** (key fields):

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | `claude` \| `chatgpt` \| `gemini` — stored & queried **per provider** so timelines don't mix (defaults to `claude`) |
| `user_email` | string | Account email |
| `five_hour_percent` | number | 5-hour window usage (0–100) |
| `seven_day_percent` | number | 7-day window usage (0–100) |
| `five_hour_resets_at` | string | ISO timestamp of 5h window reset |
| `seven_day_resets_at` | string | ISO timestamp of 7d window reset |
| `plan` | string | Current plan name (Pro, Max 5x, …) |
| `claude_org_uuid` | string | Organization UUID |
| `install_id` | string | Per-install id (multi-browser measurement) |
| `ext_version` | string | Extension version |
| `timezone` | string | IANA timezone |
| `language` | string | `en` / `ko` |

**Response** includes recommendation data and admin plan orders if applicable.
Snapshots are retained indefinitely server-side (full reset-cycle history); the popup
keeps a 180-day local cache.

Other snapshot endpoints (all under `/api/snapshots`): `GET /fitness?user_email=` (plan
fitness matrix), `PATCH /admin-order-setting`, `POST /plan-order-response`,
`POST /plan-order-revert`, `PATCH /primary-org`, `POST /dismiss`, `PATCH /review-nudge`,
`PATCH /settings`.

### User Data

- `GET /api/me?org={org_uuid}` — recent snapshots for bootstrapping the local cache (org optional).
- `GET /api/me/selected-orgs` — which orgs the user tracks.
- `PATCH /api/users/preferences` — user UI preferences.

### Authentication

- `POST /api/auth/ext-login` — exchange account email for a dashboard login token.
  Body `{ "email": string }` → `{ "token": string, "loginUrl": string }`.

### Health

- `POST /api/heartbeat` — report collection state/errors for monitoring.

### Public

- `GET /api/announcements` — active announcements. **Returns a JSON array.**
- `POST /api/announcements/event` — record an announcement view/click (fire-and-forget, 204).
- `GET /api/promos` — promos/offers. **Returns a JSON array.**

### Claude Code Analytics (local)

Analyze local Claude Code (CLI) transcripts in `~/.claude/projects` — see the
`/dashboard/cc` pages.

#### `GET | POST /api/cc/scan`

Scan transcripts (mtime-incremental) into `cc_sessions` / `cc_messages`. Triggered on
viewing the cc dashboard; also callable directly.

#### `POST /api/cc/review`

Generate an LLM usage-improvement report by invoking the local `claude` CLI (subscription
auth, no API key). Stored in `cc_reviews` and shown in the dashboard.

**Body:** `{ "scope": "overall" | "session", "session_id"?: string }` (`session_id`
required when `scope` is `session`).
**Response:** `{ "ok": boolean, "error"?: string }`.

## Rate Limits

The local server applies no meaningful rate limiting — it serves a single user.

## Building Compatible Clients

To read your own data: use `GET /api/me` for snapshots and `GET /api/snapshots/fitness`
for plan analysis; `POST /api/snapshots` to submit data points. `GET` endpoints are
stable; `POST/PATCH` may change.
