<div align="center">

# ⚡ FORTRESS V3

### Options Trading Command Centre

**React 19 · FastAPI · QuantData MCP · IBKR Web API**

[![Strategy](https://img.shields.io/badge/Strategy-v3.7-00d4aa?style=flat-square)](docs/Portfolio_Strategy_v3_7.md)
[![Sprint](https://img.shields.io/badge/Sprint-v7.1-6366f1?style=flat-square)](#changelog)
[![Stack](https://img.shields.io/badge/Stack-React_19_%2B_FastAPI-0ea5e9?style=flat-square)](#tech-stack)
[![Live](https://img.shields.io/badge/Live-76.13.138.194%3A3000-22c55e?style=flat-square)](http://76.13.138.194:3000)
[![MCP](https://img.shields.io/badge/MCP-29_tools-f59e0b?style=flat-square)](https://github.com/citychip/fortress-mcp)

*Stop spending 50 minutes every morning on manual data gathering. Fortress synthesises GEX walls, dark pool floors, IV rank, and live Greeks into a single prioritised action list — before the market opens.*

</div>

---

## Downloads

> Click the link → then click the **Download raw file** (↓) button in the GitHub file viewer.

| Document | Format | Description |
|---|---|---|
| [**Fortress V3 Presentation**](docs/Fortress_V3_Presentation.pdf) | PDF | 15-slide deck — value proposition, features, MCP/API architecture, tech stack |
| [**Fortress V3 Sales Brochure**](docs/Fortress_V3_Sales_Brochure.pdf) | PDF | 7-page A4 brochure — shareable overview for partners and collaborators |
| [**Portfolio Strategy v3.7**](docs/Portfolio_Strategy_v3_7.md) | Markdown | The complete trading rulebook — delta targets, position sizing, roll criteria, earnings playbook |

---

## The Problem

Every morning, a premium-selling options trader faces the same 50-minute grind:

- Open QuantData → manually check GEX walls for 19 tickers
- Open IBKR → check Greeks on every open position
- Open a spreadsheet → calculate delta bias, concentration, stop-loss distances
- Check the earnings calendar → flag blackout windows
- Decide what to do — with no unified view

**Fortress eliminates all of it.**

---

## The 4-Layer Decision Engine

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — REGIME GATE                                          │
│  Is the macro environment safe to sell premium?                 │
│  VIX level · SPY gamma regime · Net Drift bias                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — MARKET INTELLIGENCE                                  │
│  Where are the structural levels for this ticker?               │
│  GEX call/put walls · Dark pool floors · Flip zone              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — POSITION EVALUATION                                  │
│  What does the existing book need?                              │
│  Greeks · Concentration · Stop-loss status · Roll triggers      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4 — PRIORITY ORDERS                                      │
│  What is the single most important action right now?            │
│  Ranked list: close · roll · hedge · enter                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Pages

| Page | What You See |
|---|---|
| **Dashboard** | Portfolio briefing · Account metrics · Concentration alerts · Delta bias · Priority action list |
| **Market Intel** | Per-ticker cards: GEX walls, DP floors, Net Drift, regime score · Sort by score/bias/alpha · Per-card refresh · Metric tooltips |
| **Trade → Candidates** | IV Rank Heatmap (19 tickers) · Actionable signals at top · Monitoring universe below divider |
| **Analysis** | Chart with DP floor and GEX level overlays · Order flow panel · Vol analytics |
| **Positions** | Open positions · Per-leg Greeks · Stop-loss status · Roll triggers · Forward P&L simulator |
| **Performance** | Unrealised P&L · Trade journal with auto-suggest from IBKR sync |
| **Earnings** | Calendar with countdown timers · CRUD · Outlook Calendar sync |
| **Settings** | Strategy config · QuantData credentials manager · Alert thresholds · Security toggles |

---

## Data Sources

| Source | What It Provides | Integration |
|---|---|---|
| **QuantData** | GEX by strike, Dark Pool levels, Net Drift, IV Rank, Order Flow | REST API (widget-UUID endpoints) + MCP server |
| **IBKR Web API** | Live Greeks (Δ/Γ/Θ/V), positions, account metrics | CP Gateway (voyz/ibeam) via Docker |
| **yFinance** | Price data, option chains (fallback when IBKR unavailable) | Python library |

---

## MCP Integration

The Fortress MCP server exposes **29 tools** to Claude Desktop (or any MCP-compatible agent), enabling natural-language control of the entire dashboard.

```
Claude Desktop  →  fortress_mcp.py  →  Fortress API  →  QuantData / IBKR
```

**Example prompts:**

> *"Run my morning preflight: briefing, SPY hedge coverage, today's calendar, and any stop-loss triggers."*

> *"Show me market intelligence for AMD. Then run the pre-trade gate for a PMCC."*

> *"Post-earnings playbook: NVDA gap −8%, IV crush 42%. Thesis confirmed."*

> *"What is the regime on SPY? Show me the GEX walls and dark pool floors."*

**MCP Repository:** [citychip/fortress-mcp](https://github.com/citychip/fortress-mcp)

---

## REST API

All endpoints are protected by Bearer token authentication.

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Liveness check (no auth required) |
| `/api/briefing` | GET | Portfolio summary, alerts, staleness state |
| `/api/positions` | GET | Open positions with live Greeks |
| `/api/candidates` | GET | IV Crush workflow results (IVR, signal, entry criteria) |
| `/api/market-intelligence` | GET | Full regime analysis for a ticker (GEX, DP, Net Drift, score) |
| `/api/chart/{ticker}` | GET | OHLCV data with DP floor and GEX overlay levels |
| `/api/settings` | GET / POST | Strategy configuration |
| `/api/settings/quantdata-credentials` | POST | Update QuantData auth token + cookie |
| `/api/ibkr/sync` | POST | Trigger IBKR position sync |

Full API reference (63 endpoints across 14 groups) is documented in [`docs/02_Trading_Dashboard_Build_Spec_v2_0.md`](https://github.com/citychip/fortress-app/blob/main/docs/02_Trading_Dashboard_Build_Spec_v2_0.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · Tailwind CSS 4 · tRPC 11 · shadcn/ui · Recharts · Wouter |
| **Backend** | Python · FastAPI · Uvicorn |
| **Broker** | IBKR Web API via CP Gateway (voyz/ibeam, Docker) |
| **Data** | QuantData REST API (widget-UUID endpoints) · yFinance |
| **Hosting** | VPS (Ubuntu 22.04) · nginx (port 3000) · systemd |
| **MCP** | `fortress_mcp.py` — 29 tools · Claude Desktop |
| **Design** | "Obsidian Edge" dark theme · Syne (display) · JetBrains Mono (data) · Inter (body) |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18 and pnpm installed
- Fortress REST API server running (default: port 8080)

### Local Development

```bash
git clone https://github.com/citychip/fortress-app.git
cd fortress-app
pnpm install
pnpm dev
# → http://localhost:3000
```

### Production Build + Deploy

```bash
# Build
pnpm build

# Deploy to VPS
scp -r dist/* ubuntu@<VPS_IP>:/home/ubuntu/Fortress_Dashboard/app/static/
ssh ubuntu@<VPS_IP> "sudo systemctl restart nginx"
```

### VPS Services

```bash
# Backend (FastAPI on port 8080)
sudo systemctl status fortress-dashboard
sudo systemctl restart fortress-dashboard
journalctl -u fortress-dashboard -f

# Frontend (nginx on port 3000)
sudo systemctl status nginx
sudo nginx -t && sudo systemctl reload nginx

# IBKR Gateway (Docker)
cd /home/ubuntu/Fortress_Dashboard/cp-gateway
docker compose ps
docker compose restart
```

---

## QuantData Credential Refresh

When the IV Rank Heatmap shows "no data" or Candidates shows 0 rows, the QuantData session has expired.

**Via Dashboard (no SSH required):**

1. Open **Settings → QuantData Credentials → Update Credentials**
2. Go to [v3.quantdata.us](https://v3.quantdata.us) → DevTools → Network → filter `core-lb-prod`
3. Copy the `authorization` and `cookie` header values from any request
4. Paste into the Settings form → **Save Credentials**

Full recovery procedure: [`operations/04_Incident_Recovery_Playbook.md §5`](https://github.com/citychip/fortress-app/blob/main/docs/operations/04_Incident_Recovery_Playbook.md)

---

## Documentation

Full documentation is in `docs/` on the VPS. Key files:

| Document | Purpose |
|---|---|
| [`01_Portfolio_Strategy_v3_7.md`](docs/Portfolio_Strategy_v3_7.md) | Trading rules — the source of truth |
| `02_Trading_Dashboard_Build_Spec_v2_0.md` | API contract, schema, frontend architecture |
| `03_Trading_Workflow_v2_9.md` | Daily operating procedure |
| `04_VPS_Implementation_Guide_v1_6.md` | VPS setup, deployment, nginx, systemd |
| `05_Implementation_Status.md` | What is live, known issues, backlog |
| `07_MCP_Workflow_and_Prompts_v1_3.md` | MCP prompt library and failure modes |
| `08_Market_Intelligence_Skill_v1_1.md` | GEX/DP/Net Drift agentic workflow |
| `operations/03_Quick_Start_and_Daily_Cheatsheet.md` | One-page daily reference |
| `operations/04_Incident_Recovery_Playbook.md` | Recovery procedures for all failure modes |

---

## Changelog

| Sprint | Date | Highlights |
|---|---|---|
| **v7.1** | May 18, 2026 | Market Intel: sort dropdown, per-card refresh, metric tooltips. Candidates All-tab frontend fallback. QuantData credentials manager in Settings. `chart.py` invalid tool ID fix (no more 400 errors). |
| **v7.0** | May 17, 2026 | Candidates All-tab redesign: full 19-ticker universe. Actionable signals at top; monitoring universe below divider. |
| **v6.x** | May 15, 2026 | Market Intel null crash fix (`current_price`). IV Crush workflow debugging. |
| **Phase 8** | May 13, 2026 | Trade Reports tab. 13 UX improvements (A-M). Market Intelligence endpoint + MCP tool. |
| **v1.8.2** | May 9, 2026 | Security section in Settings. `use_ibkr_web_api` / `use_quantdata` toggles. |
| **v1.8** | May 5, 2026 | MCP server (29 tools). Bearer token auth. CP Gateway primary broker path. |

---

## Security

The bearer token is **never stored in source code or committed to this repository**. It lives exclusively in browser `localStorage`. All API calls use `Authorization: Bearer <token>` headers sent through the nginx same-origin proxy — the token never crosses origins.

---

<div align="center">

*"The edge isn't the data. The edge is the system."*

**Fortress V3 · Sprint v7.1 · May 2026**

</div>
