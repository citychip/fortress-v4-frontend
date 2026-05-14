# Fortress v2 — Options Trading Dashboard

A fully configurable, browser-based dashboard for managing an options portfolio against live market data. Built with React 19, Tailwind CSS 4, and Recharts. Designed to work alongside the [Fortress MCP server](https://github.com/citychip/fortress-mcp) REST API.

![Dashboard preview](docs/preview.png)

---

## Overview

Fortress v2 implements the four-layer morning workflow for options portfolio management:

| Layer | Tab | What it does |
|---|---|---|
| 1 — Macro Regime Gate | **Dashboard** | Fetches SPY GEX / Dark Pool / Net Drift → synthesises a regime score (−4 to +4). Blocks new entries when score ≤ threshold. |
| 2 — Per-Ticker Flow | **Market Intel** | For each ticker in your universe: GEX walls, DP floor/ceiling, Net Drift, directional bias. |
| 3 — Position Evaluation | **Positions** | Per-leg evaluation: delta breach (>0.40), DTE roll window, stop-loss, concentration alerts. |
| 4 — Order Execution | **Orders** | Prioritised order list: URGENT → THIS WEEK → WATCH with specific BUY/SELL/ROLL details. |

Additional tabs: **Candidates** (IV rank screener), **P&L** (daily/weekly/monthly charts), **Analysis** (per-ticker deep-dive), **Settings** (all configuration).

---

## Stack

- **React 19** + **Wouter** (client-side routing)
- **Tailwind CSS 4** with OKLCH design tokens (Obsidian Edge dark theme)
- **shadcn/ui** component primitives
- **Recharts** for P&L and Analysis charts
- **Framer Motion** for page transitions
- **Vite 7** build tooling

---

## Quick Start

### Prerequisites

- Node.js ≥ 18 and pnpm installed
- The [Fortress MCP REST server](https://github.com/citychip/fortress-mcp) running and accessible

### Local development

```bash
git clone https://github.com/citychip/fortress-v2.git
cd fortress-v2
pnpm install
pnpm dev
# → http://localhost:3000
```

Open **Settings** and enter your API URL and bearer token. All settings are stored in `localStorage` — nothing is committed to the repo.

### Production build

```bash
pnpm build
# Output: dist/public/
```

---

## Deployment (nginx on VPS)

The dashboard is a pure static SPA. The recommended deployment is nginx serving `dist/public/` on a dedicated port alongside the Fortress API server.

### One-time setup

```bash
# 1. Build
pnpm build

# 2. Copy to VPS
tar czf /tmp/fortress-v2-dist.tar.gz -C dist/public .
scp /tmp/fortress-v2-dist.tar.gz user@YOUR_VPS:/tmp/

# 3. On the VPS — extract and configure nginx
ssh user@YOUR_VPS
sudo mkdir -p /var/www/fortress-v2
sudo tar xzf /tmp/fortress-v2-dist.tar.gz -C /var/www/fortress-v2/
```

### nginx site config (`/etc/nginx/sites-available/fortress-v2`)

```nginx
server {
    listen 3000;
    server_name _;
    root /var/www/fortress-v2;
    index index.html;

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
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

### Redeploy after updates

```bash
pnpm build && \
  tar czf /tmp/fortress-v2-dist.tar.gz -C dist/public . && \
  scp /tmp/fortress-v2-dist.tar.gz user@YOUR_VPS:/tmp/ && \
  ssh user@YOUR_VPS \
    "sudo rm -rf /var/www/fortress-v2/* && \
     sudo tar xzf /tmp/fortress-v2-dist.tar.gz -C /var/www/fortress-v2/"
```

---

## Configuration

All configuration is stored in **browser `localStorage`** under the key `fortress-v2-config`. No secrets are ever committed to the repository.

Open the **Settings** tab in the dashboard to configure:

### API Connection

| Field | Description | Default |
|---|---|---|
| API URL | Base URL of the Fortress REST server | `http://76.13.138.194:8080` |
| Bearer Token | `FORTRESS_API_TOKEN` from the server's systemd environment | *(blank — enter manually)* |
| Auto-refresh interval | How often to poll the API (seconds) | `60` |

> **CORS note:** If the dashboard is served over HTTPS and the API is HTTP, browsers will block mixed-content requests. Either serve the dashboard over HTTP (e.g. on a VPS port), or add TLS to the API server.

### Ticker Universe

The list of tickers used across Market Intel, Candidates, and Analysis tabs. Add or remove any symbol. Default universe matches the live portfolio: `MSFT, AVGO, NFLX, SPY, AMD, GOOGL, UNH, NVDA`.

### Strategy Thresholds

| Parameter | Description | Default |
|---|---|---|
| Delta Alert Threshold | Alert when short leg delta exceeds this value | `0.40` |
| Roll DTE Window | Flag short legs with DTE ≤ this value for roll evaluation | `45 days` |
| Max Single-Name % | Concentration alert if one ticker exceeds this % of Net Liq | `20%` |
| Max MSFT % | Hard limit for MSFT concentration (portfolio-specific) | `90%` |
| Max Sector % | Sector concentration alert threshold | `40%` |
| Regime Entry Threshold | No new entries when regime score ≤ this value | `0` |
| Stop-Loss: 200-SMA Breach | Close position if underlying breaks below 200-SMA | `enabled` |
| IV Rank Entry Threshold | Candidates screener: signal entry when IV rank ≥ this value | `50` |
| IV/HV Spread Threshold | Candidates screener: min IV − HV spread for SELL signal | `5pp` |

### Config Export / Import

Use the **Export Config** button in Settings to save all settings (token excluded) as a JSON file. Use **Import Config** to restore on a new device.

---

## API Endpoints

The dashboard expects the following endpoints on the configured API URL. All requests include `Authorization: Bearer <token>`.

| Endpoint | Method | Tab | Response shape |
|---|---|---|---|
| `/api/briefing` | GET | Dashboard | `{ account, macro, positions, orders }` |
| `/api/positions` | GET | Positions | `{ positions: Position[] }` |
| `/api/market-intel` | GET | Market Intel | `{ tickers: TickerIntel[] }` |
| `/api/orders` | GET | Orders | `{ orders: Order[] }` |
| `/api/candidates` | GET | Candidates | `{ candidates: CandidateData[] }` |
| `/api/pnl?period=daily\|weekly\|monthly` | GET | P&L | `PnLSummary` |
| `/api/chart/:ticker` | GET | Analysis | `ChartData` |
| `/api/health` | GET | Sidebar | `{ status, version, last_sync }` |
| `/api/ibkr/sync` | POST | Sidebar | `{ ok, message }` |

Full TypeScript type definitions are in `client/src/hooks/useApi.ts`.

---

## Project Structure

```
client/
  src/
    pages/
      DashboardPage.tsx     ← Layer 1: Macro Regime Gate + account summary
      PositionsPage.tsx     ← Layer 3: Per-leg evaluation with alerts
      MarketIntelPage.tsx   ← Layer 2: Per-ticker GEX/DP/Drift
      OrdersPage.tsx        ← Layer 4: URGENT / THIS WEEK / WATCH
      CandidatesPage.tsx    ← IV rank screener
      PnLPage.tsx           ← Daily/weekly/monthly P&L charts
      AnalysisPage.tsx      ← Per-ticker deep-dive + TradingView link
      SettingsPage.tsx      ← All configuration
    components/
      PageHeader.tsx        ← Shared page header with refresh
      StatCard.tsx          ← Metric display card
      RegimeBadge.tsx       ← Macro regime score badge
      UrgencyBadge.tsx      ← Order urgency badge (URGENT/THIS WEEK/WATCH)
      EmptyState.tsx        ← No-data / no-config / error states
    contexts/
      ConfigContext.tsx     ← All settings + localStorage persistence
    hooks/
      useApi.ts             ← All API calls + TypeScript types
```

---

## Security

- The bearer token is **never stored in source code or committed to the repository**. It lives exclusively in browser `localStorage`.
- The config export feature explicitly excludes the token.
- All API calls use `Authorization: Bearer <token>` headers.
- The nginx config does not expose any server-side secrets.

---

## Related Repositories

| Repo | Description |
|---|---|
| [citychip/fortress-mcp](https://github.com/citychip/fortress-mcp) | Fortress MCP server — 29 tools covering positions, briefing, market intelligence, stop-loss, roll, pre-trade gate, journal, and QuantData live data |
| [citychip/fortress-dashboard](https://github.com/citychip/fortress-dashboard) | Original Fortress dashboard (v1) |

---

## License

Private repository — all rights reserved.
