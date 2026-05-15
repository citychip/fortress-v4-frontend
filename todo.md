
- [x] Tiered universe view in Settings (Tier 1/2/Macro Index/Excluded with per-ticker tags)
- [x] IBKR sync history table (last 5 syncs: timestamp, backend, positions, status)
- [x] Scheduled morning briefing heartbeat at 08:00 on trading days (requires new dedicated task — see instructions)
- [x] Run all 8 VPS workflows to populate fresh quant/ data (6/8 ran OK; workflow_06 dark pool and workflow_07 whale flow need QuantData MCP config)
- [x] Update mcp_briefing.py to include get_market_intelligence("SPY") output
- [x] Configure QuantData MCP tools for workflow_06 (dark pool) and workflow_07 (whale flow) — MANUAL STEP: log into v3.quantdata.us, add Dark Pool Levels + Order Flow Ticker tools to your page, copy their UUIDs into ~/.quantdata-mcp/config.json on VPS under keys dark_pool_levels and order_flow_ticker
- [x] Audit v3.6 index.html for bare fetch() calls missing Authorization headers — only fetchEarningsDates() was affected; universe.js and settings.js already correct
- [x] Roll candidates DTE ring — added DTE countdown ring SVG + urgency badge + EXPIRING pulse to roll candidates section on DashboardPage (cyan ring, URGENT/THIS_WEEK/WATCH urgency chip)
- [x] Settings sync indicator — added SyncBadge component to SettingsPage header showing Saving…/Saved ✓/Sync failed based on prefsSaveStatus from ConfigContext
- [x] Post-earnings candidates section in Trade Report — add TradeReportPostEarningsCandidate type and render a dedicated section on DashboardPage with days-since-earnings badge, IV rank post, price, and playbook action
- [x] Greeks summary section on AnalysisPage — aggregate delta/gamma/theta/vega across all open positions for the selected ticker
- [x] Earnings date overlay on AnalysisPage price chart — vertical dashed markers at past/upcoming earnings dates
- [x] Deep-link navigation from DashboardPage post-earnings rows to AnalysisPage with ticker pre-selected
- [x] Deep-link navigation from DashboardPage roll candidate rows to AnalysisPage with ticker pre-selected
- [x] Historical earnings overlay on chart — backend only stores next_earnings; add a /api/calendar/{ticker}/history endpoint using yfinance earnings_dates to return past earnings dates for multi-marker chart overlay
- [x] Connection Health panel in Settings — live ping tests for IBKR sync and QuantData with latency, last-seen, and status badges

## Fortress v3 Rebuild

- [ ] Audit all v3.6 settings sections and catalogue every configurable field for migration
- [ ] Audit IBKR Web API order placement endpoints (place, preview, cancel, status)
- [ ] Rationalise and update all documentation (fortress_docs, fortress_docs_vps, README, CHANGELOG)
- [x] Rename project to Fortress v3 (app title, sidebar, page title, package.json)
- [x] Persistent 5px status bar: IBKR status, QuantData status, VIX, SPY price, market hours clock
- [x] Collapsed sidebar (icon-only default, expand on hover/click)
- [ ] Morning Brief landing page (trade report full-width, portfolio snapshot strip below)
- [ ] Migrate all v3.6 settings into Fortress v3 Settings page (strategy, universe, security, notifications, backup/restore)
- [ ] Trade Builder page: live option chain from IBKR, GEX regime, strategy suggester, PoP calculator
- [ ] IBKR order submission flow in Trade Builder (preview ticket, confirm dialog, submit to IBKR, status tracking)
- [ ] Portfolio page rebuild: positions grouped by ticker, Greeks bar, P&L sparkline
- [ ] Retire v3.6 HTML dashboard at port 8080 (keep Python backend, remove HTML frontend dependency)
- [ ] Morning Brief indicator charts: VIX 30d sparkline, SPY price + 20/50/200 SMA, portfolio delta/theta/vega bar chart, IV rank heatmap across universe, macro regime gauge
- [ ] Dashboard mini sparklines: per-ticker price sparkline vs key GEX levels in trade report rows
- [ ] Analysis page indicator panel: RSI, MACD, Bollinger Bands, ATR overlaid on price chart
- [x] Pine Script indicators on Analysis chart: 50-day SMA (blue), 200-day SMA (red), 52-week high line (red dashed), Thesis Broken Zone background (red tint when price < 200 SMA)
