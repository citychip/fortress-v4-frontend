# Backend Patches

This directory contains patched backend files ready to deploy to the VPS.
Files here are **not** part of the React frontend — they are Python source files
for the FastAPI backend running on the VPS at `/home/ubuntu/Fortress_Dashboard/`.

## Contents

| File | VPS Target | Description |
|---|---|---|
| `market_intelligence.py` | `app/routes/market_intelligence.py` | Sprint v8.1 + v8.2: holiday-aware session dates, MSFT dedicated DP page, GEX/DP wall fields in regime dict |
| `briefing.py` | `app/routes/briefing.py` | Sprint v8.2: live VIX yfinance fallback, SPY-equivalent beta-weighted delta with 1-hour TTL cache |
| `state.py` | `app/services/state.py` | Sprint v8.2: `_fetch_live_vix()`, corrected `compute_beta_weighted_delta()` formula (SPY-equivalent shares) |
| `settings.py` | `app/routes/settings.py` | Sprint v8.1 + v8.2: QuantData token+cookie update, `quantdata_login_refresh` email+password auto-login |

## Deploy Instructions

```bash
VPS="root@76.13.138.194"
KEY="~/.ssh/fortress_vps"

for f in market_intelligence.py briefing.py state.py settings.py; do
  src="backend_patches/$f"
  # Determine target subdirectory
  if [ "$f" = "state.py" ]; then
    dest="/home/ubuntu/Fortress_Dashboard/app/services/$f"
    dest4="/home/ubuntu/Fortress_Dashboard_v4/app/services/$f"
  else
    dest="/home/ubuntu/Fortress_Dashboard/app/routes/$f"
    dest4="/home/ubuntu/Fortress_Dashboard_v4/app/routes/$f"
  fi
  scp -i $KEY $src $VPS:$dest
  ssh -i $KEY $VPS "cp $dest $dest4"
done

ssh -i $KEY $VPS "systemctl restart fortress-dashboard fortress-dashboard-v4"
ssh -i $KEY $VPS "systemctl is-active fortress-dashboard fortress-dashboard-v4"
```

---

## Sprint v8.2 Changes (2026-05-25)

### `market_intelligence.py`
- **`_last_trading_day()`**: Skips weekends and NYSE market holidays (2025–2027 hardcoded) so `session_date` always resolves to the last valid trading day. Fixes QuantData returning empty data on holidays/weekends.
- **GEX/DP fields in regime dict**: `gex_call_wall`, `gex_put_wall`, `dp_floor`, `dp_ceiling` now populated directly from the top wall/floor entries. Previously missing — caused Market Intel tile to show `--` for all four values.

### `briefing.py`
- **Live VIX fallback**: When no daily workflow report has populated VIX, fetches live from yfinance `^VIX`. Prevents the dashboard header showing blank VIX on weekends/holidays.
- **`_fetch_betas_and_prices()`**: Fetches 1-year weekly returns for all portfolio tickers + SPY from yfinance to compute beta. Results cached for 1 hour (TTL cache) to prevent file descriptor exhaustion from repeated SSE stream calls.
- **`compute_portfolio_greeks_with_beta()`**: Now calls `_fetch_betas_and_prices()` and passes result to `state.compute_beta_weighted_delta()`.

### `state.py`
- **`_fetch_live_vix()`**: New helper — `yf.Ticker("^VIX").history(period="1d")` with exception guard. Used by briefing.py VIX fallback.
- **`compute_beta_weighted_delta()`**: Formula rewritten. Old formula computed a dimensionless ratio (`sum(beta × delta × MV) / sum(|MV|)`). New formula computes **SPY-equivalent shares**: for each leg, `dollar_delta = qty × option_delta × multiplier × stock_price`, then `spy_equiv = sum(dollar_delta × beta) / SPY_price`. Result is a meaningful share count (e.g. +388 SPY shares) rather than a near-zero ratio.

### `settings.py`
- **`POST /settings/quantdata_login_refresh`**: Accepts `email` + `password`, logs in to `v3.quantdata.us` using `curl_cffi` Chrome impersonation (bypasses Cloudflare), extracts JWT token from response, builds cookie string, persists to `~/.quantdata-mcp/config.json`, verifies by fetching SPY IV Rank, then triggers a background `systemctl restart fortress-dashboard`. No DevTools required.

---

## Sprint v8.1 Changes (2026-05-23)

### `market_intelligence.py`
- **MSFT dedicated page**: Uses page `2ef8b3c4` / widget `1d0411cd` for Dark Pool, separate from system DP widget.
- **Mixed-page support**: MSFT fetches DP from dedicated page and GEX/drift from system pages.
- **`_load_page_registry()`**: Queries QuantData `/api/pages` on startup, caches widget map 24 hours.
- **SPX net_drift widget**: Corrected to `46560851`.
- **QQQ widgets**: DP `0e3e3809`, net_drift `c36dd60c`.
