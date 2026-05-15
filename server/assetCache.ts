/**
 * FORTRESS V3 — Asset Hydration Cache
 *
 * In-memory key-value store that holds the latest GEX/DP/drift values
 * broadcast by Python scripts (max_pain.py, whale_flow.py) via the
 * POST /api/manage/hydrate-asset REST endpoint.
 *
 * The cache is intentionally ephemeral (process memory only) — it is
 * refreshed every time a script runs and is used purely as a fallback
 * overlay when live QuantData fields are blank.
 */

export interface HydratedAsset {
  ticker: string;
  gex_call_wall: number | null;
  gex_put_wall: number | null;
  dp_floor: number | null;
  net_drift: number | null;
  gamma_flip: number | null;
  /** ISO-8601 timestamp from the script execution */
  timestamp: string;
  /** Wall-clock time the entry was received by the server */
  received_at: string;
}

// Module-level singleton map — survives across requests in the same process
const _cache = new Map<string, HydratedAsset>();

/** Write or overwrite a hydrated asset entry */
export function setHydratedAsset(entry: HydratedAsset): void {
  _cache.set(entry.ticker.toUpperCase(), {
    ...entry,
    ticker: entry.ticker.toUpperCase(),
    received_at: new Date().toISOString(),
  });
}

/** Read a single hydrated asset entry (returns undefined if not cached) */
export function getHydratedAsset(ticker: string): HydratedAsset | undefined {
  return _cache.get(ticker.toUpperCase());
}

/** Return all cached entries as an array */
export function getAllHydratedAssets(): HydratedAsset[] {
  return Array.from(_cache.values());
}
