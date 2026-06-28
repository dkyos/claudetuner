<p align="center">
  <img src="chrome-extension/icons/icon128.png" alt="Claude Tuner" width="80" />
</p>

<h1 align="center">Claude Tuner</h1>

<p align="center">
  Track your Claude usage limits in real time — across Chat, Code, Cowork, and Design.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/chaehyun2/claudetuner" alt="License" /></a>
  <a href="README-ko.md"><img src="https://img.shields.io/badge/lang-한국어-blue" alt="Korean" /></a>
</p>

> **Personal local-server fork.** This fork runs the extension against a bundled local backend in
> [`server/`](server/) at `http://localhost:3000` (instead of the cloud `api.claudetuner.com`) and
> adds **Claude Code (CLI) usage analytics**. Cloud-only items mentioned below (Chrome Web Store,
> live demo, hosted team dashboard) refer to the upstream project.

---

<p align="center">
  <img src="docs/screenshots/dashboard-top.png" alt="Dashboard — usage gauges, plan fitness, and weekly trend" width="720" />
</p>

## Why Claude Tuner?

Claude's rate limits are opaque — you don't know how much you've used, when it resets, or whether your plan is right for you. Claude Tuner fixes that.

- **See your limits** — live 5h / 7d usage gauges with reset countdowns
- **Predict resets** — know if you'll hit the cap before the window rolls over
- **Find the right plan** — "what if" simulations across Pro, Max 5x, and Max 20x
- **Monitor your team** — free dashboard with per-member analytics, breach tracking, and group comparisons

## Screenshots

| Usage Trends | Team Dashboard |
|:-:|:-:|
| ![5h/7d usage trend charts](docs/screenshots/dashboard-charts.png) | ![Team overview with race and stats](docs/screenshots/team-overview.png) |

| Insights | Members |
|:-:|:-:|
| ![Global insights — plan & utilization distribution](docs/screenshots/insights.png) | ![Per-member analytics](docs/screenshots/members.png) |

## Features

<details open>
<summary><b>Real-Time Usage Monitoring</b></summary>

- Live 5-hour and 7-day usage gauges
- Reset countdown timers
- Toolbar badge showing current usage level
- 6-tier pace indicator (safe → critical)
- Sparkline charts for usage trends
- Multi-organization support (auto-detect or pin)
- 6-month (180-day) local usage history
</details>

<details open>
<summary><b>Smart Alerts & Predictions</b></summary>

- Usage prediction at reset based on consumption rate
- Configurable threshold notifications (80%, 95%)
- Weekly usage reports via email
- Estimated token breakdown (Opus / Sonnet / Haiku)
- Peak hours indicator (weekday 12:00–18:00 UTC)
- Real-time 429 rate limit detection
</details>

<details>
<summary><b>Plan Simulation & Optimizer</b></summary>

- "What if" simulation for every plan (Pro / Max 5x / Max 20x)
- Visual exceeded-days comparison
- Smart upgrade/downgrade recommendations
- Cost-efficiency analysis
</details>

<details>
<summary><b>Plan Fitness Score</b></summary>

- At-a-glance fitness rating for your subscription
- Percentile ranking among Claude Tuner users
- Usage distribution histogram
</details>

<details open>
<summary><b>Claude Code Analytics</b> — this fork</summary>

- Local scan of `~/.claude/projects` transcripts (nothing is uploaded)
- Per-project / per-session breakdown with a request-centric conversation view
- Token & cost estimate (ccusage-style: Opus / Sonnet / Haiku, cache write/read split)
- Usage review: the local server calls your `claude` CLI (subscription, no API key) for improvement tips
</details>

<details>
<summary><b>Hourly Activity Heatmap</b></summary>

- 24×7 heatmap of your Claude usage patterns
- Peak hours and quiet periods at a glance
- Weekday vs weekend comparison
</details>

<details>
<summary><b>Team Dashboard</b> — free for all members</summary>

- Per-member usage analytics and rate limit tracking
- Token usage leaderboard and cost analytics
- Breach tracking with plan upgrade/downgrade recommendations
- Group-based usage comparison analysis
- Daily team reports and weekly personal reports
- Training data policy monitoring
- Domain-based auto-invite and group management (admin)
- CSV / Excel export
</details>

## Supported Plans

| Plan | 5h Limit | 7d Limit | Extras |
|------|----------|----------|--------|
| Pro (1x) | ● | ● | — |
| Max 5x | ● | ● | — |
| Max 20x | ● | ● | — |
| Team Standard | ● | ● | — |
| Team Premium | ● | ● | — |
| Enterprise (seat-based) | ● | ● | Spending cap |
| Enterprise (usage-based) | — | — | Spending cap |

## Install

### Chrome Web Store (recommended)

<a href="https://chromewebstore.google.com/detail/claude-tuner/ajnnckikagphjbgpicpoffockabnhond">
  <img src="https://img.shields.io/badge/Install_from-Chrome_Web_Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Install from Chrome Web Store" />
</a>

### Manual install (developer mode)

```bash
git clone https://github.com/chaehyun2/claudetuner.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the **`chrome-extension/`** folder

## How It Works

```
You ──→ Claude.ai ──→ Claude Tuner extension ──→ Local server (server/)
                        (reads usage data)         localhost:3000 (history & analytics)
                              │
                              ▼
                        Extension popup          Local dashboard
                       (gauges & alerts)     (trends, plan review, Claude Code analytics)
```

1. **Collect** — The extension reads your usage data from Claude.ai (no conversation content, ever)
2. **Analyze** — Snapshots are POSTed to the local server (`server/`), which stores history and computes analytics
3. **Display** — Real-time gauges in the popup, or the [local dashboard](http://localhost:3000/dashboard) (start `server/` first)

## Self-Hosting

This fork already targets `http://localhost:3000`. Start the bundled server:

```bash
cd server && npm install && npm run dev
```

To change the host/port, edit **two files** (`chrome-extension/config.js` and
`chrome-extension/bg/constants.js` — keep them in sync) and start the server on the
matching port:

```js
// chrome-extension/config.js  (and the same values in bg/constants.js)
const CT_CONFIG = {
  DEFAULT_SERVER_URL: 'http://localhost:3000',
  DEFAULT_API_KEY: 'your-api-key',
  SITE_URL: 'http://localhost:3000',
};
```

```bash
# server on a custom port:
PORT=4000 npm run dev
```

The manifest grants `http://localhost/*` (port-agnostic), so a localhost port change
needs no manifest edit. See [docs/API.md](docs/API.md) for the full server API spec.

## Privacy

- **No conversation content** is ever collected — no messages, files, or prompts
- Only usage metrics, reset timestamps, plan info, and organization membership
- In this fork, all data stays on your machine — the local server (`server/data.sqlite`) and browser storage. No external service is contacted for storage.

<details>
<summary><b>Architecture</b></summary>

```
chrome-extension/      The MV3 extension — load THIS folder in chrome://extensions
  popup.html/js        Popup UI (usage gauges, charts, recommendations)
  options.html/js      Settings page (intervals, alerts, org selection)
  background.js        Service worker (alarm scheduling, message routing)
  bg/collect.js        Main collection engine (Claude.ai API -> server)
  bg/plan.js           Plan detection, change execution, recommendations
  bg/api.js            Claude.ai API wrapper (dual auth fallback)
  bg/storage.js        Chrome storage helpers
  bg/constants.js      Config constants (server URL, 180-day retention)
  config.js / i18n.js  Centralized config + localization
  page-script.js       Injected into Claude.ai (fetch with page auth)
  _locales/            English and Korean translations
server/                Local Next.js backend — API, dashboard, Claude Code analytics
docs/                  docs/API.md (server spec) + screenshots
```

**No build step** — the extension files are plain JS/HTML/CSS (no bundler/transpile).

</details>

<details>
<summary><b>Verify CWS Build</b></summary>

In the **upstream** project, the extension files are byte-for-byte identical to the Chrome Web Store package. This fork reorganizes them under `chrome-extension/` and adds a local `server/`, so it is not store-identical. Upstream verification:

1. Install the extension from CWS
2. Find the installed files at `~/Library/Google/Chrome/Default/Extensions/ajnnckikagphjbgpicpoffockabnhond/<version>/`
3. Compare with the upstream repository (excluding `_metadata/` added by Chrome)

</details>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

---

<sub>Claude Tuner is not affiliated with or endorsed by Anthropic. Token limits are community-observed estimates, not official figures.</sub>
