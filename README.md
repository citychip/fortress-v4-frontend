# Fortress v3 — Options Trading Dashboard

A fully configurable, browser-based options portfolio management terminal. Built with React 19, Tailwind CSS 4, tRPC 11, Drizzle ORM, and Recharts. Connects to the Fortress REST API server (FastAPI/Python, port 8080) via an nginx same-origin proxy on port 3000. Includes Manus OAuth authentication, a MySQL/TiDB database layer, and a full server-side Express/tRPC backend.

**Live instance:** http://76.13.138.194:3000

---

## Overview

Fortress v3 implements the four-layer morning workflow for options portfolio management:

| Layer | Tab | What it does |
|---|---|---|
| 1 — Macro Regime Gate | **Dashboard** | SPY regime score, account metrics, SPY hedge coverage, IBKR live account data, quick-action cards |
| 2 — Per-Ticker Flow | **Market Intel** | Per-ticker GEX walls, DP floor/ceiling, Net Drift, directional bias |
| 3 — Position Evaluation | **Positions** | Per-leg evaluation: delta breach, DTE roll window, stop-loss, concentration alerts; max profit/loss/breakeven badges; forward P&L simulator |
| 4 — Order Execution | **Trade → Orders** | Prioritised order list: URGENT → THIS WEEK → WATCH; alert snooze/dismiss; pending orders panel |

**8-item sidebar (v6.0):**

| Nav Item | Tabs / Content |
|---|---|
| **Dashboard** | Regime gate, account metrics, quick-action cards |
| **Market Intel** | Per-ticker GEX/DP/drift intel |
| **Positions** | Live positions with greeks, limits badges, P&L simulator |
| **Trade** | Scan (Morning Brief) • Candidates (IV screener) • Orders (alerts + pending) |
| **Analysis** | Per-ticker chart, levels, order flow, vol analytics |
| **Performance** | P&L (unrealised P&L) • Journal (trade log) |
| **Earnings** | Earnings calendar with Outlook sync |
| **Config** | Strategy (persona + playbook + sandbox) • Settings (universe + entry + sizing + API) • Scripts (automation runner) |

---

## Stack

- **React 19** + **Wouter** (client-side routing)
- **Tailwind CSS 4** with OKLCH design tokens ("Obsidian Edge" dark theme)
- **shadcn/ui** component primitives
- **Recharts** for P&L and Analysis charts
- **Vite 7** build tooling
- **Fonts:** Syne (display), JetBrains Mono (data), Inter (body) via Google Fonts CDN

---

## Quick Start

### Prerequisites

- Node.js ≥ 18 and pnpm installed
- Fortress REST API server running and accessible (default: port 8080)

### Local development

```bash
git clone https://github.com/citychip/fortress-v2.git
cd fortress-v2
pnpm install
pnpm dev
# → http://localhost:3000
```

Open **Settings → API Connection** and enter your bearer token. The API URL defaults to a relative path (same-origin proxy) — leave it blank when running behind nginx.

### Production build

```bash
pnpm build
# Output: dist/public/
```

---

## Deployment (nginx on VPS)

The dashboard is a pure static SPA. nginx serves `dist/public/` on port 3000 and proxies `/api/*` to the Fortress API server on port 8080.

### nginx site config (`/etc/nginx/sites-available/fortress-v2`)

```nginx
server {
    listen 3000;
    server_name _;
    root /var/www/fortress-v2;
    index index.html;

    # Proxy all API calls to the Fortress server
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fortress-v2 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Redeploy one-liner (from the Manus sandbox)

```bash
cd /home/ubuntu/fortress-v2 && pnpm build && \
  tar czf /tmp/fortress-v2-dist.tar.gz -C dist/public . && \
  scp -i ~/.ssh/fortress_vps /tmp/fortress-v2-dist.tar.gz ubuntu@76.13.138.194:/tmp/ && \
  ssh -i ~/.ssh/fortress_vps ubuntu@76.13.138.194 \
    "sudo rm -rf /var/www/fortress-v2/* && \
     sudo tar xzf /tmp/fortress-v2-dist.tar.gz -C /var/www/fortress-v2/"
```

---

## Configuration

All **local** configuration (API URL, bearer token, display preferences) is stored in browser `localStorage` under `fortress-v2-config`. No secrets are ever committed to the repository.

**Server-side** configuration (trader profile, active strategies, risk tolerance, position sizing thresholds) is read from and written to the Fortress API server via `/api/settings`.

### API Connection (localStorage)

| Field | Description | Default |
|---|---|---|
| API URL | Base URL of the Fortress REST server. Leave blank to use the same-origin nginx proxy. | *(blank — uses proxy)* |
| Bearer Token | `FORTRESS_API_TOKEN` from the server's systemd environment | *(blank — enter manually)* |
| Auto-refresh interval | How often to poll the API (seconds) | `60` |

> **Security:** The bearer token is **never stored in source code or committed to the repository**. It lives exclusively in browser `localStorage`. The config export feature explicitly excludes the token.

### Ticker Universe

The dashboard syncs the ticker universe from `/api/universe` (Tier 1, Tier 2, Macro, Excluded). The Universe Manager in Settings allows adding, removing, moving between tiers, and excluding tickers with a reason. Default universe: `MSFT, AVGO, NFLX, VST, GOOGL, AMZN, AMD, MSTR, UNH` (Tier 1), `META, AAPL, NVDA` (Tier 2), `SPX, SPY` (Macro).

### Trader Presets (server-side)

Five built-in profiles selectable from Settings:

| Preset | Strategies | Risk |
|---|---|---|
| Income Seeker | Wheel, Covered Call, Cash-Secured Put, PMCC, PCS | Conservative |
| Speculator | Long Call/Put, Vertical Spreads | Aggressive |
| Volatility Trader | Iron Condor, Strangle, Straddle, Butterfly | Moderate |
| Portfolio Protector | Collar, Protective Put, SPY Hedge, Covered Call | Conservative |
| Custom | Manual configuration | Any |

---

## API Endpoints Reference

All requests include `Authorization: Bearer <token>`. The full Fortress server exposes 63 routes across 14 groups. The table below covers all endpoints consumed or planned for the dashboard.

### Briefing & Core Data

| Endpoint | Method | Used in |
|---|---|---|
| `/api/health` | GET | Settings — Connection Test |
| `/api/briefing` | GET | Dashboard |
| `/api/positions` | GET | Positions, P&L |
| `/api/market-intelligence` | GET | Market Intel, Analysis |
| `/api/candidates` | GET | Candidates |

### Trade Management

| Endpoint | Method | Used in |
|---|---|---|
| `/api/manage/trade_report` | GET | Dashboard — Trade Report panel |
| `/api/manage/pretrade_all` | GET | Candidates — Pre-Trade Gate badges |
| `/api/manage/pre_trade_check?ticker=X` | GET | Analysis — single-ticker gate |
| `/api/manage/stop_loss_all` | GET | Orders — URGENT section |
| `/api/manage/roll_all` | GET | Orders — THIS WEEK section |
| `/api/manage/stop_loss/{position_id}` | GET | Positions — per-leg evaluation |
| `/api/manage/roll/{position_id}` | GET | Positions — per-leg evaluation |
| `/api/manage/spy_hedge_coverage` | GET | Dashboard — hedge coverage widget |
| `/api/manage/monitor_alerts` | POST | Orders — Refresh Alerts button |
| `/api/manage/validate_jade_lizard` | POST | Candidates — Jade Lizard validation |

### Alerts

| Endpoint | Method | Used in |
|---|---|---|
| `/api/alerts` | GET | Orders — alert list |
| `/api/alerts` | POST | Orders — create alert |
| `/api/alerts/{alert_id}` | PATCH | Orders — snooze alert |
| `/api/alerts/{alert_id}` | DELETE | Orders — dismiss alert |

### Earnings Calendar

| Endpoint | Method | Used in |
|---|---|---|
| `/api/calendar` | GET | Earnings tab |
| `/api/calendar/{ticker}` | PUT | Earnings tab — edit date |
| `/api/calendar/{ticker}` | DELETE | Earnings tab — remove entry |
| `/api/calendar/{ticker}/confirm` | POST | Earnings tab — confirm date |
| `/api/calendar/fetch-earnings` | POST | Earnings tab — auto-fetch from yfinance |

### Universe Management

| Endpoint | Method | Used in |
|---|---|---|
| `/api/universe` | GET | Settings — Universe Manager |
| `/api/universe/add` | POST | Settings — add ticker |
| `/api/universe/{tier}/{ticker}` | DELETE | Settings — remove ticker |
| `/api/universe/move` | POST | Settings — move between tiers |
| `/api/universe/exclude` | POST | Settings — exclude with reason |
| `/api/universe/exclude/{ticker}` | DELETE | Settings — un-exclude |

### IBKR Integration

| Endpoint | Method | Used in |
|---|---|---|
| `/api/ibkr/status` | GET | Settings — IBKR Status panel |
| `/api/ibkr/sync` | POST | Sidebar — Sync IBKR button |
| `/api/ibkr/capability` | GET | Settings — backend info |
| `/api/ibkr/preview` | GET | Dashboard — live account data |

### Chart & Technical Analysis

| Endpoint | Method | Used in |
|---|---|---|
| `/api/chart/{ticker}` | GET | Analysis — OHLCV chart |
| `/api/chart/{ticker}/levels` | GET | Analysis — support/resistance overlay |
| `/api/chart/{ticker}/order_flow` | GET | Analysis — order flow panel |

### Journal

| Endpoint | Method | Used in |
|---|---|---|
| `/api/journal` | GET | Journal tab |
| `/api/journal` | POST | Journal tab — new entry |
| `/api/journal/suggest` | GET | Journal tab — auto-suggest from IBKR sync |
| `/api/journal/{entry_id}` | DELETE | Journal tab — delete entry |

### Script Runner

| Endpoint | Method | Used in |
|---|---|---|
| `/api/run/scripts` | GET | Scripts tab — list available scripts |
| `/api/run/{script_key}` | POST | Scripts tab — run a script |
| `/api/run/time_of_day` | GET | Scripts tab — time-of-day context |
| `/api/run/group/{group_name}` | POST | Scripts tab — run a script group |

### Settings (Server-Side)

| Endpoint | Method | Used in |
|---|---|---|
| `/api/settings` | GET | Settings tab |
| `/api/settings/schema` | GET | Settings tab — dynamic form |
| `/api/settings/trader_presets` | GET | Settings tab — preset selector |
| `/api/settings/apply_preset` | POST | Settings tab — apply preset |
| `/api/settings/{section}` | PUT | Settings tab — save section |
| `/api/settings/narrative` | GET | Settings tab — AI narrative |
| `/api/settings/reset` | POST | Settings tab — reset to defaults |
| `/api/settings/backup` | GET | Settings tab — download backup |
| `/api/settings/restore` | POST | Settings tab — restore backup |
| `/api/settings/test_quantdata` | POST | Settings tab — test QuantData connection |

### Uploads & OCR

| Endpoint | Method | Used in |
|---|---|---|
| `/api/uploads/ibkr` | POST | Settings — IBKR screenshot upload |
| `/api/uploads/ibkr/{upload_id}/confirm` | POST | Settings — confirm OCR parse |
| `/api/uploads/chart` | POST | Analysis — chart image upload |
| `/api/uploads` | GET | Settings — upload history |

### Playbook

| Endpoint | Method | Used in |
|---|---|---|
| `/api/playbook/post_earnings` | POST | Candidates / Analysis — post-earnings playbook |

---

## Project Structure

```
client/
  src/
    pages/
      DashboardPage.tsx     ← Layer 1: regime gate, account metrics, hedge coverage, quick-action cards
      PositionsPage.tsx     ← Layer 3: per-leg evaluation + limits badges + forward P&L simulator
      MarketIntelPage.tsx   ← Layer 2: per-ticker GEX/DP/Drift with hydration cache overlay
      TradePage.tsx         ← Tabbed: Scan (MorningBrief) | Candidates | Orders
      MorningBriefPage.tsx  ← Daily trade report, IV heatmap, SPY chart, portfolio Greeks panel
      CandidatesPage.tsx    ← IV rank screener with pre-trade gate overlay
      OrdersPage.tsx        ← URGENT/THIS WEEK/WATCH + alert management + pending orders
      TradeBuilderPage.tsx  ← GEX/market context, strategy suggester, PoP calculator, order queue
      PnLJournalPage.tsx    ← Tabbed: P&L (unrealised P&L) | Journal (trade log)
      PnLPage.tsx           ← Sortable/filterable unrealised P&L from /api/positions
      JournalPage.tsx       ← Trade journal with realised P&L metrics and auto-suggest
      AnalysisPage.tsx      ← Per-ticker chart + levels + order flow + vol analytics
      EarningsPage.tsx      ← Earnings calendar with countdown, CRUD, Outlook Calendar sync
      ConfigPage.tsx        ← Tabbed: Strategy | Settings | Scripts
      StrategyPage.tsx      ← Strategy Workspace: persona, regime playbook, parameters, payoff sandbox
      SettingsPage.tsx      ← Server settings sync, trader presets, universe manager, IBKR status
      ScriptsPage.tsx       ← Workflow script runner (10 scripts, terminal output)
    components/
      PageHeader.tsx        ← Shared page header with refresh button
      StatCard.tsx          ← Metric display card
      RegimeBadge.tsx       ← Macro regime score badge
      UrgencyBadge.tsx      ← Order urgency badge (URGENT/THIS WEEK/WATCH)
      EmptyState.tsx        ← No-data / no-config / error states
      PendingOrdersPanel.tsx ← Queued trade setups (localStorage)
      DashboardLayout.tsx   ← Sidebar layout with collapsed icon-only mode
    contexts/
      ConfigContext.tsx     ← Full strategy config: persona, strategies, risk, signal mode, backup/restore
      PendingOrdersContext.tsx ← Pending trade setups (localStorage)
    hooks/
      useApi.ts             ← All API hooks + TypeScript types
    lib/
      utils.ts              ← cn() and shared helpers
server/
  routers.ts              ← tRPC procedures (auth + features)
  db.ts                   ← Drizzle query helpers
  sandbox.payoff.test.ts  ← 23 vitest unit tests for payoff math helpers
drizzle/
  schema.ts               ← Database tables & types
```

---

## Security

- The bearer token is **never stored in source code or committed to the repository**. It lives exclusively in browser `localStorage`.
- The config export feature explicitly excludes the token.
- All API calls use `Authorization: Bearer <token>` headers sent through the nginx same-origin proxy — the token never crosses origins.
- The nginx config does not expose any server-side secrets.

---

## Related Repositories

| Repo | Description |
|---|---|
| [citychip/fortress-mcp](https://github.com/citychip/fortress-mcp) | Fortress MCP server — 57 tools (47 read + 10 write) covering positions, briefing, market intelligence, stop-loss, roll, pre-trade gate, journal, vol analytics, forward P&L, chart data, and QuantData live data |
| [citychip/fortress-dashboard](https://github.com/citychip/fortress-dashboard) | Original Fortress dashboard (v1) |

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v2.0 | 2026-05-10 | Initial build: Dashboard, Positions, Market Intel, Orders, Analysis, Settings |
| v2.1 | 2026-05-11 | Added Candidates tab (IV rank screener, SuggestedTradePanel, Send to Orders) |
| v2.2 | 2026-05-11 | Added P&L tab (unrealised P&L from /api/positions, bar chart, best/worst callouts) |
| v2.3 | 2026-05-12 | Fixed all TypeScript/API field mapping errors; redeployed to VPS |
| v2.4 | 2026-05-12 | Fixed same-origin proxy (removed hardcoded API URL from localStorage) |
| v2.5 | 2026-05-12 | Added Connection Test button with latency + server version to Settings |
| v2.6 | 2026-05-13 | Added PendingOrdersContext, DP-floor-anchored strikes, Pending Orders panel in Orders |
| v2.7 | 2026-05-13 | Fixed AnalysisPage DP floor/ceiling derivation from dark_pool.floors[] array |
| v2.8 | 2026-05-14 | P&L tab: full sorting (ticker/P&L/pct/DTE/qty/marketValue) and filtering (ticker/side/right/P&L sign) |
| v2.9 | 2026-05-14 | Tier 1+2: Trade Report, Pre-Trade Gate, Alert CRUD, Earnings Calendar, IBKR Live Preview, Server Settings, Universe Manager, Script Runner, Trade Journal, Chart Levels + Order Flow, SPY Hedge widget |
| v3.0 | 2026-05-14 | Fortress v3 rebuild: tRPC + Drizzle ORM + Manus OAuth backend; persistent 5px status bar; collapsed icon-only sidebar; Morning Brief landing page; full Settings migration |
| v3.1 | 2026-05-14 | Morning Brief: IV heatmap fallback, enriched trade report rows (IVR/GEX/bias badges), regime strip with gamma flip price, beta-weighted delta, theta efficiency, taller SPY chart, market status pill |
| v3.2 | 2026-05-14 | Dashboard: hydrated Macro Regime Gate (GEX/DP/drift from SPY intel), concentration-locked entry rows, hedge coverage target fix, Send Briefing owner notification |
| v3.3 | 2026-05-14 | Trade Builder: ticker asset regime label, GEX/DP metric hydration, pre-trade advisory banner, expiry dates on suggested setups. Dashboard: Macro Regime Gate data-pipe fixes |
| v3.4 | 2026-05-14 | Analysis page: Net Drift NaN fix, GEX Call Wall blank fix, Order Flow empty-state, SPY Hedge → per-ticker Position Risk Context panel |
| v3.5 | 2026-05-15 | Portfolio view: theta sign fix, alert badge counts, Auto-Roll button. Orders: JSON copy button on URGENT rows. Script Runner: terminal output, exit code badge, duration. Morning Brief: suppress stop-loss tickers from entry candidates. Regime labels standardized to title-case |
| v3.6 | 2026-05-15 | Hydration pipeline: Python scripts POST GEX/DP/drift to /api/manage/hydrate-asset after execution; Market Intel overlays cached values with "Cached" badge |
| v3.7 | 2026-05-15 | Strategy Workspace: Trader Persona cards (5), Volatility Regime Playbook matrix (IV×GEX), full strategy parameters grid, signal mode (Strict/Advisory/Sandbox), backup/restore. Trade Builder: signal mode advisory banner wired in |
| v3.7.1 | 2026-05-16 | Strategy Sandbox (Zone 3): interactive DTE slider (7–120d) + Delta slider (0.05–0.50Δ), Recharts payoff diagram with GEX Call/Put Wall + DP Floor/Ceiling reference lines, breakeven proximity warning badge, 6-metric panel (PoP, Max Profit, Max Loss, θ/day, Gamma Risk score, θ Efficiency). Export to Trade Builder passes sandbox params as query params. 23 vitest unit tests for normalCDF/calcPoP/buildPayoffData |
| v4.0 | 2026-05-17 | SSE smart refresh (replaces 250ms polling for briefing/positions/alerts); 2D Vol Analytics panel on Analysis page (IV skew, term structure, ATM IV ladder); Bearer Token Rotation UI in Settings → Security section; VPS endpoints: /api/stream, /api/options/vol-analytics, /api/manage/rotate-token |
| v5.0 | 2026-05-17 | vollib (py_vollib) installed on VPS; Position Limits Badge (max profit/max loss/breakeven/net premium) on every position card; Forward P&L Simulator (BS model, price slider, date picker, IV multiplier, P&L curve) in position accordion; VPS endpoints: /api/options/position-limits, /api/options/forward-pnl; null-guard fix for breakeven toFixed crash |
| v6.0 | 2026-05-18 | Nav restructure 14→8 items: TradePage (Scan/Candidates/Orders), PnLJournalPage (P&L/Journal), ConfigPage (Strategy/Settings/Scripts); Dashboard simplified (trade report removed, quick-action cards); legacy deep-link routes preserved; README updated |

---

## License

Private repository — all rights reserved.
