
- [x] Tiered universe view in Settings (Tier 1/2/Macro Index/Excluded with per-ticker tags)
- [x] IBKR sync history table (last 5 syncs: timestamp, backend, positions, status)
- [x] Scheduled morning briefing heartbeat at 08:00 on trading days (requires new dedicated task — see instructions)
- [x] Run all 8 VPS workflows to populate fresh quant/ data (6/8 ran OK; workflow_06 dark pool and workflow_07 whale flow need QuantData MCP config)
- [x] Update mcp_briefing.py to include get_market_intelligence("SPY") output
- [x] Configure QuantData MCP tools for workflow_06 (dark pool) and workflow_07 (whale flow) — MANUAL STEP: log into v3.quantdata.us, add Dark Pool Levels + Order Flow Ticker tools to your page, copy their UUIDs into ~/.quantdata-mcp/config.json on VPS under keys dark_pool_levels and order_flow_ticker
