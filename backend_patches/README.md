# Backend Patches

This directory contains patched backend files ready to deploy to the VPS.
Files here are **not** part of the React frontend — they are Python source files
for the FastAPI backend running on the VPS at `/home/ubuntu/Fortress_Dashboard/`.

## Contents

| File | VPS Target | Description |
|---|---|---|
| `market_intelligence.py` | `app/routes/market_intelligence.py` | Sprint v8.1 patch: MSFT dedicated DP page, `_load_page_registry()` auto-discovery, corrected SPX/QQQ widget IDs |

## Deploy Instructions

```bash
# From the fortress-app repo root on your local machine or sandbox:
VPS="root@76.13.138.194"
KEY="~/.ssh/fortress_vps"

# 1. Backup existing file
ssh -i $KEY $VPS "cp /home/ubuntu/Fortress_Dashboard/app/routes/market_intelligence.py \
  /home/ubuntu/Fortress_Dashboard/app/routes/market_intelligence.py.bak"

# 2. Upload patched file
scp -i $KEY backend_patches/market_intelligence.py \
  $VPS:/home/ubuntu/Fortress_Dashboard/app/routes/market_intelligence.py

# 3. Restart service
ssh -i $KEY $VPS "systemctl restart fortress-dashboard"

# 4. Verify
ssh -i $KEY $VPS "systemctl is-active fortress-dashboard"
```

## Sprint v8.1 Changes in market_intelligence.py

- **MSFT dedicated page:** MSFT now uses page `2ef8b3c4` with widget `1d0411cd` for Dark Pool data, instead of the system DP widget which was not filtered correctly to MSFT.
- **Mixed-page support:** MSFT fetches DP from its dedicated page and GEX/drift from the system pages. The system lock is acquired for the system-page calls to prevent global-filter race conditions.
- **`_load_page_registry()`:** Queries QuantData `/api/pages` on startup and caches the full widget map for 24 hours. Uses `_walk_layout()` to traverse the nested layout tree using the correct `component` field (not `type`).
- **SPX net_drift widget:** Corrected to `46560851` (was missing).
- **QQQ widgets:** Corrected DP to `0e3e3809` and net_drift to `c36dd60c` (were missing).
