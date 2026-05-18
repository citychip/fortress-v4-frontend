# Fortress Dashboard — React Frontend

> A React 19 + tRPC + Tailwind 4 dashboard for systematic options portfolio management. Connects to the [Fortress API](https://github.com/citychip/fortress-api) backend and provides a full-featured trading operations interface — from morning briefing to trade construction, position management, and strategy configuration.

---

## What It Does

Fortress is a personal trading operations platform built for options sellers who run systematic, rules-based strategies. The frontend is a single-page application that consumes the Fortress REST API and presents a structured workflow: start each session with the Morning Brief, review the trade report, evaluate candidates, manage positions, and route orders through the Approvals queue.

The app is built on the Manus web-app template (React 19 + tRPC 11 + Drizzle ORM + Manus OAuth) and is designed to be deployed as a static build served by nginx on the same VPS as the API.

---

## Pages and Navigation

The sidebar is organized into two groups:

### Main Navigation

| Page | Route | Description |
|---|---|---|
| **Morning Brief** | `/` | Landing page: VIX 30d sparkline, SPY chart with SMAs, portfolio Greeks bar chart, IV rank heatmap, Macro Regime Gauge, and the daily trade report with entry candidates |
| **Trade Builder** | `/trade-builder` | Strategy selector, leg construction, Greeks snapshot, pre-trade advisory banner, and Export to Approvals |
| **Strategy** | `/strategy` | Trader Persona cards (5 profiles), Volatility Regime Playbook matrix (IV × GEX), 24 strategy parameters, signal mode (Strict / Advisory / Sandbox), backup/restore |
| **Dashboard** | `/dashboard` | Macro Regime Gate, concentration limits, hedge coverage, mini sparklines per-ticker, entry candidate rows |
| **Positions** | `/positions` | Live option book with Greeks, strategy labels, Roll→ deep-link, Auto-Roll, alert badge counts |
| **Market Intel** | `/market-intel` | Per-ticker GEX walls, DP floors, net drift, order flow — with "Cached" badge when sourced from hydration cache |
| **Orders** | `/orders` | Pending orders panel, JSON copy on URGENT rows, order status management |
| **Candidates** | `/candidates` | IV crush candidate scanner with IVR/GEX/bias badges |
| **P&L** | `/pnl` | Realized + unrealized P&L, per-ticker breakdown, sorting and filtering |
| **Analysis** | `/analysis` | OHLCV chart with DP/GEX overlays, MACD crossover marker dots, Position Risk Context panel |
| **Earnings** | `/earnings` | Earnings calendar with post-earnings playbook matrix |
| **Journal** | `/journal` | Trade log with strategy tags and outcome tracking |
| **Scripts** | `/scripts` | Workflow script runner with terminal output, exit code badge, and duration |
| **Settings** | `/settings` | IBKR config, QuantData credentials, universe manager, UI preferences, backup/restore |

### Cockpits

| Page | Route | Description |
|---|---|---|
| **Action Center** | `/action` | Per-ticker pre-trade cockpit: pre-trade gate, GEX/DP levels, order flow, chart levels, PoP calculator, breakeven vs GEX wall badge |
| **Build Center** | `/build` | Trade construction cockpit: strategy selector, leg construction, Greeks snapshot, IBKR whatif preview, Route to Approvals |
| **Portfolio Center** | `/portfolio` | Tabbed aggregate view combining Positions, P&L, Earnings, and Journal |
| **Approvals** | `/approvals` | Human-in-the-loop order queue: Approve/Decline buttons, Greeks snapshot, IBKR whatif preview |

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| API client | tRPC 11 + TanStack Query |
| Charts | Recharts |
| Backend | Express 4 + tRPC server (thin proxy layer) |
| Database | Drizzle ORM + MySQL (Manus-hosted) |
| Auth | Manus OAuth |
| Build | Vite 6 |

---

## Development

### Prerequisites

- Node.js 22+
- pnpm

### Quick Start

```bash
git clone https://github.com/citychip/fortress-app.git
cd fortress-app
pnpm install
pnpm dev
```

The dev server starts on port 3000 and proxies `/api/` to the Fortress API backend. Set `VITE_API_BASE_URL` in `.env.local` to point to your running Fortress API instance.

### Key Files

```
client/
  src/
    pages/          ← Page-level components (one file per route)
    components/     ← Reusable UI components
    hooks/
      useApi.ts     ← All API hooks and TypeScript types
    contexts/
      ConfigContext.tsx          ← Strategy config, persona, backup/restore
      PendingOrdersContext.tsx   ← Pending trade setups
    lib/trpc.ts     ← tRPC client binding
    App.tsx         ← Routes and sidebar nav
server/
  routers.ts        ← tRPC procedures
  db.ts             ← Drizzle query helpers
drizzle/
  schema.ts         ← Database tables and types
```

### Running Tests

```bash
pnpm test
```

The test suite covers payoff math helpers (normalCDF, calcPoP, buildPayoffData) with 23 vitest unit tests in `server/sandbox.payoff.test.ts`.

### Building for Production

```bash
pnpm build
```

The build output is in `dist/public/`. Copy this directory to `/var/www/fortress-v2` on your VPS and configure nginx to serve it with `/api/` proxied to port 8080.

---

## Security

The bearer token is never stored in source code or committed to the repository. It lives exclusively in browser `localStorage`. The config export feature explicitly excludes the token. All API calls use `Authorization: Bearer <token>` headers sent through the nginx same-origin proxy — the token never crosses origins.

---

## Related Repositories

| Repository | Description |
|---|---|
| [citychip/fortress-api](https://github.com/citychip/fortress-api) | FastAPI backend — the data source for all dashboard pages |
| [citychip/fortress-mcp](https://github.com/citychip/fortress-mcp) | MCP server — connects Claude Desktop to the Fortress API with 40 tools |

---

## Changelog

| Version | Date | Summary |
|---|---|---|
| v3.9 | 2026-05-18 | Morning Brief: VIX 30d sparkline + Macro Regime Gauge; Dashboard: mini sparklines per-ticker in trade report rows |
| v3.8 | 2026-05-17 | Analysis: MACD crossover marker dots; Positions: Roll→ deep-link to Trade Builder; Trade Builder: full ticker gallery on load |
| v3.7.2 | 2026-05-16 | Cockpits group: Action Center, Build Center, Portfolio Center, Approvals |
| v3.7.1 | 2026-05-16 | Strategy Sandbox: DTE/Delta sliders, Recharts payoff diagram with GEX/DP reference lines, 6-metric panel, Export to Trade Builder; 23 vitest unit tests |
| v3.7 | 2026-05-15 | Strategy Workspace: Trader Persona cards, Volatility Regime Playbook matrix, 24 strategy parameters, signal mode, backup/restore |
| v3.6 | 2026-05-15 | Hydration pipeline: Market Intel overlays cached GEX/DP values with "Cached" badge |
| v3.5 | 2026-05-15 | Portfolio: theta sign fix, alert badge counts, Auto-Roll; Orders: JSON copy on URGENT rows; Script Runner: terminal output, exit code, duration |
| v3.4 | 2026-05-14 | Analysis: Net Drift NaN fix, GEX Call Wall blank fix, Order Flow empty-state, per-ticker Position Risk Context panel |
| v3.3 | 2026-05-14 | Trade Builder: asset regime label, GEX/DP hydration, pre-trade advisory banner, expiry dates |
| v3.2 | 2026-05-14 | Dashboard: Macro Regime Gate hydration, concentration-locked entry rows, Send Briefing notification |
| v3.1 | 2026-05-14 | Morning Brief: IV heatmap fallback, enriched trade report rows, regime strip, beta-weighted delta, theta efficiency |
| v3.0 | 2026-05-14 | Fortress v3 rebuild: tRPC + Drizzle ORM + Manus OAuth; persistent status bar; collapsed sidebar; Morning Brief landing page |
| v2.x | 2026-05-10–14 | Initial builds: Dashboard, Positions, Market Intel, Orders, Analysis, Candidates, P&L, Settings, Trade Builder, Strategy |

---

## Disclaimer

This software is for informational and educational purposes only. It is not financial advice. Trading options involves significant risk. Always verify data and candidates before executing trades in your brokerage account.
