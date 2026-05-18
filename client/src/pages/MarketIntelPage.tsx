/**
 * FORTRESS V2 — Market Intelligence Page
 * Layer 2: Per-ticker flow analysis — GEX walls, DP floors, Net Drift, directional bias.
 * Uses /api/market-intelligence?ticker=TICKER (nested regime object).
 */

import { useState, useEffect, useMemo } from 'react';
import { useMarketIntelligence, regimeInfo, type MarketIntelligence } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Target, ShieldAlert, ArrowUpRight, Database, ArrowUpDown } from 'lucide-react';

// ─── Hydrated asset cache hook ────────────────────────────────────────────────

interface HydratedAsset {
  ticker: string;
  gex_call_wall: number | null;
  gex_put_wall: number | null;
  dp_floor: number | null;
  net_drift: number | null;
  gamma_flip: number | null;
  timestamp: string;
  received_at: string;
}

// Singleton cache map shared across all TickerIntelCard instances
const _hydratedCache = new Map<string, HydratedAsset>();
let _lastFetch = 0;
let _fetchPromise: Promise<void> | null = null;

async function fetchHydratedAssets(): Promise<void> {
  const now = Date.now();
  // Throttle: re-fetch at most every 30 seconds
  if (now - _lastFetch < 30_000 && _hydratedCache.size > 0) return;
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = (async () => {
    try {
      const res = await fetch('/api/manage/hydrated-assets');
      if (res.ok) {
        const json = await res.json() as { assets: HydratedAsset[] };
        for (const asset of json.assets ?? []) {
          _hydratedCache.set(asset.ticker.toUpperCase(), asset);
        }
        _lastFetch = Date.now();
      }
    } catch { /* non-fatal */ }
    _fetchPromise = null;
  })();
  return _fetchPromise;
}

function useHydratedAsset(ticker: string): HydratedAsset | undefined {
  const [asset, setAsset] = useState<HydratedAsset | undefined>(() => _hydratedCache.get(ticker.toUpperCase()));
  useEffect(() => {
    fetchHydratedAssets().then(() => {
      setAsset(_hydratedCache.get(ticker.toUpperCase()));
    });
    // Re-check every 60 seconds
    const id = setInterval(() => {
      fetchHydratedAssets().then(() => {
        setAsset(_hydratedCache.get(ticker.toUpperCase()));
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [ticker]);
  return asset;
}

// ─── Metric box ───────────────────────────────────────────────────────────────

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
        {label}
      </div>
      <div className="font-mono-data text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ─── Ticker Intel Card ────────────────────────────────────────────────────────

function TickerIntelCard({ ticker }: { ticker: string }) {
  const { data, loading, error } = useMarketIntelligence(ticker);
  const hydrated = useHydratedAsset(ticker);
  const [expanded, setExpanded] = useState(false);

  // Derive display values from the nested regime object
  const regime = data?.regime;
  const overall = regime?.overall ?? '';
  const { label: regimeLabel, color: regimeColor } = regimeInfo(overall);

  const colorMap = {
    red: 'oklch(0.65 0.22 25)',
    amber: 'oklch(0.78 0.18 85)',
    green: 'oklch(0.72 0.18 145)',
    cyan: 'oklch(0.80 0.15 200)',
  };
  const regimeHex = colorMap[regimeColor];

  // Use live QuantData values; fall back to hydrated cache when blank
  const rawNetDrift = regime?.net_drift;
  const rawDpFloor = regime?.dp_floor;
  const rawDpCeiling = regime?.dp_ceiling;
  const rawGexCall = regime?.gex_call_wall;
  const rawGexPut = regime?.gex_put_wall;

  const netDrift  = (rawNetDrift  != null && isFinite(rawNetDrift))  ? rawNetDrift  : (hydrated?.net_drift  ?? null);
  const dpFloor   = (rawDpFloor   != null && isFinite(rawDpFloor))   ? rawDpFloor   : (hydrated?.dp_floor   ?? null);
  const dpCeiling = (rawDpCeiling != null && isFinite(rawDpCeiling)) ? rawDpCeiling : null;
  const gexCall   = (rawGexCall   != null && isFinite(rawGexCall))   ? rawGexCall   : (hydrated?.gex_call_wall ?? null);
  const gexPut    = (rawGexPut    != null && isFinite(rawGexPut))    ? rawGexPut    : (hydrated?.gex_put_wall  ?? null);
  const score = regime?.score;

  // Track which fields are coming from the hydrated cache (not live QuantData)
  const isHydrated = hydrated != null;
  const usingCacheFor = [
    (rawGexCall  == null || !isFinite(rawGexCall))  && hydrated?.gex_call_wall != null ? 'GEX' : null,
    (rawDpFloor  == null || !isFinite(rawDpFloor))  && hydrated?.dp_floor      != null ? 'DP'  : null,
    (rawNetDrift == null || !isFinite(rawNetDrift)) && hydrated?.net_drift     != null ? 'Drift' : null,
  ].filter(Boolean) as string[];
  const hydratedAt = hydrated ? new Date(hydrated.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const BiasIcon = overall.includes('bull') ? TrendingUp : overall.includes('bear') ? TrendingDown : Minus;

  const borderColor = overall.includes('bull')
    ? 'oklch(0.72 0.18 145 / 30%)'
    : overall.includes('bear')
    ? 'oklch(0.65 0.22 25 / 30%)'
    : 'oklch(1 0 0 / 9%)';

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor }}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        style={{ background: 'oklch(0.20 0.010 258)' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
        }

        <span className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {ticker}
        </span>

        {data && (
          <span className="font-mono-data text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
            ${data.current_price.toFixed(2)}
          </span>
        )}

        {loading && (
          <div className="h-4 w-20 rounded animate-pulse ml-2" style={{ background: 'oklch(1 0 0 / 8%)' }} />
        )}

        {!loading && data && (
          <div className="ml-auto flex items-center gap-4">
            {/* Directional bias */}
            <div className="flex items-center gap-1.5">
              <BiasIcon className="w-4 h-4" style={{ color: regimeHex }} />
              <span className="font-mono-data text-xs font-semibold" style={{ color: regimeHex }}>
                {regimeLabel}
              </span>
            </div>

            {/* Score pill */}
            {score !== undefined && (
              <span
                className="font-mono-data text-xs px-2 py-0.5 rounded-full"
                style={{ background: `${regimeHex.replace(')', ' / 15%)')}`, color: regimeHex }}
              >
                {score > 0 ? '+' : ''}{score}
              </span>
            )}

            {/* Key metrics inline */}
            <div className="flex items-center gap-3 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
              {dpFloor !== undefined && dpFloor !== null && (
                <span>DP: <span style={{ color: 'oklch(0.80 0.15 200)' }}>${dpFloor.toFixed(2)}</span></span>
              )}
              {netDrift !== undefined && netDrift !== null && (
                <span>Drift: <span style={{ color: netDrift > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
                  {netDrift > 0 ? '+' : ''}{netDrift.toFixed(2)}
                </span></span>
              )}
            </div>
          </div>
        )}

        {!loading && error && (
          <span className="ml-auto text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>
            Error: {error}
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && data && (
        <div className="px-4 py-4 space-y-4" style={{ background: 'oklch(0.17 0.010 258)' }}>
          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-3">
            <MetricBox
              label="GEX Call Wall"
              value={gexCall !== undefined && gexCall !== null ? `$${gexCall.toFixed(2)}` : '—'}
              color="oklch(0.72 0.18 145)"
            />
            <MetricBox
              label="GEX Put Wall"
              value={gexPut !== undefined && gexPut !== null ? `$${gexPut.toFixed(2)}` : '—'}
              color="oklch(0.65 0.22 25)"
            />
            <MetricBox
              label="DP Floor"
              value={dpFloor !== undefined && dpFloor !== null ? `$${dpFloor.toFixed(2)}` : '—'}
              color="oklch(0.80 0.15 200)"
            />
            <MetricBox
              label="DP Ceiling"
              value={dpCeiling !== undefined && dpCeiling !== null ? `$${dpCeiling.toFixed(2)}` : '—'}
              color="oklch(0.80 0.15 200)"
            />
          </div>

          {/* Net drift + regime signals */}
          {netDrift !== undefined && netDrift !== null && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>Net Drift</span>
              <span
                className="font-mono-data text-sm font-semibold"
                style={{ color: netDrift > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}
              >
                {netDrift > 0 ? '+' : ''}{netDrift.toFixed(2)}
              </span>
            </div>
          )}

          {/* Regime signals */}
          {regime?.signals && regime.signals.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Regime Signals
              </div>
              <div className="space-y-1.5">
                {regime.signals.map((sig, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs px-3 py-2 rounded border"
                    style={{ background: 'oklch(0.22 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}
                  >
                    <span
                      className="font-mono-data text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: sig.signal.includes('bull') ? 'oklch(0.72 0.18 145 / 15%)' : sig.signal.includes('bear') ? 'oklch(0.65 0.22 25 / 15%)' : 'oklch(0.78 0.18 85 / 15%)',
                        color: sig.signal.includes('bull') ? 'oklch(0.72 0.18 145)' : sig.signal.includes('bear') ? 'oklch(0.65 0.22 25)' : 'oklch(0.85 0.18 85)',
                      }}
                    >
                      {sig.signal}
                    </span>
                    <span style={{ color: 'oklch(0.65 0.010 258)' }}>{sig.source}</span>
                    <span className="ml-auto font-mono-data text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
                      w={sig.weight}
                    </span>
                    {sig.note && (
                      <span className="text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{sig.note}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade Setups */}
          {data.trade_setups && data.trade_setups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Trade Setups
              </div>
              <div className="space-y-2">
                {data.trade_setups.map((setup, i) => {
                  const isBull = setup.type === 'bullish';
                  const isBear = setup.type === 'bearish';
                  const setupColor = isBull ? 'oklch(0.72 0.18 145)' : isBear ? 'oklch(0.65 0.22 25)' : 'oklch(0.78 0.18 85)';
                  const setupBg = isBull ? 'oklch(0.72 0.18 145 / 8%)' : isBear ? 'oklch(0.65 0.22 25 / 8%)' : 'oklch(0.78 0.18 85 / 8%)';
                  const confColor = setup.confidence === 'high' ? 'oklch(0.72 0.18 145)' : setup.confidence === 'medium' ? 'oklch(0.78 0.18 85)' : 'oklch(0.55 0.010 258)';
                  const SetupIcon = isBull ? TrendingUp : isBear ? TrendingDown : Minus;
                  return (
                    <div key={i} className="rounded border px-3 py-2.5 space-y-1.5" style={{ background: setupBg, borderColor: `${setupColor.replace(')', ' / 20%)')}` }}>
                      <div className="flex items-center gap-2">
                        <SetupIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: setupColor }} />
                        <span className="text-xs font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>{setup.name}</span>
                        <span className="ml-auto font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${confColor.replace(')', ' / 15%)')}`, color: confColor }}>
                          {setup.confidence}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'oklch(0.65 0.010 258)' }}>{setup.description}</p>
                      {(setup.entry || setup.target || setup.stop) && (
                        <div className="flex items-center gap-4 pt-0.5">
                          {setup.entry && (
                            <span className="flex items-center gap-1 font-mono-data text-[10px]" style={{ color: 'oklch(0.65 0.010 258)' }}>
                              <ArrowUpRight className="w-3 h-3" />
                              Entry: <span style={{ color: 'oklch(0.85 0.010 258)' }}>{setup.entry}</span>
                            </span>
                          )}
                          {setup.target && (
                            <span className="flex items-center gap-1 font-mono-data text-[10px]" style={{ color: 'oklch(0.65 0.010 258)' }}>
                              <Target className="w-3 h-3" />
                              Target: <span style={{ color: 'oklch(0.72 0.18 145)' }}>{setup.target}</span>
                            </span>
                          )}
                          {setup.stop && (
                            <span className="flex items-center gap-1 font-mono-data text-[10px]" style={{ color: 'oklch(0.65 0.010 258)' }}>
                              <ShieldAlert className="w-3 h-3" />
                              Stop: <span style={{ color: 'oklch(0.65 0.22 25)' }}>{setup.stop}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gamma flip zone */}
          {regime?.flip_zone !== undefined && regime.flip_zone !== null && (
            <div className="flex items-center gap-3 text-xs px-3 py-2 rounded border" style={{ background: 'oklch(0.22 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>GEX Flip Zone</span>
              <span className="font-mono-data font-semibold" style={{ color: 'oklch(0.78 0.18 85)' }}>${regime.flip_zone.toFixed(2)}</span>
              {regime.gamma_regime && (
                <span className="ml-auto font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: regime.gamma_regime === 'positive' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
                  color: regime.gamma_regime === 'positive' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)'
                }}>
                  {regime.gamma_regime} gamma
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
              Session: {data.session_date} · As of: {new Date(data.as_of).toLocaleTimeString()}
            </div>
            {usingCacheFor.length > 0 && hydratedAt && (
              <div
                className="flex items-center gap-1 font-mono-data text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: 'oklch(0.80 0.15 200)' }}
                title={`${usingCacheFor.join(', ')} values sourced from last script run at ${hydratedAt}`}
              >
                <Database className="w-2.5 h-2.5" />
                cache: {usingCacheFor.join(', ')} · {hydratedAt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortMode = 'default' | 'alpha' | 'bias_bull' | 'bias_bear';

export default function MarketIntelPage() {
  const { config } = useConfig();
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const sortedTickers = useMemo(() => {
    const tickers = [...config.tickers];
    if (sortMode === 'alpha') return tickers.sort((a, b) => a.localeCompare(b));
    // For score-based sort, we use the regime score from each card's data
    // Since cards load independently, we sort by ticker name as fallback when scores unavailable
    if (sortMode === 'bias_bull') return tickers; // cards will reorder on next render once data loads
    if (sortMode === 'bias_bear') return tickers;
    return tickers; // default: config order
  }, [config.tickers, sortMode]);

  if (!config.tickers.length) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Market Intelligence" subtitle="Layer 2 — Per-ticker flow analysis" />
        <div className="p-6">
          <EmptyState
            type="no-config"
            title="No tickers configured"
            description="Add tickers to your universe in Settings to see market intelligence data."
          />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Market Intelligence"
        subtitle={`Layer 2 — Per-ticker flow analysis · ${config.tickers.length} tickers in universe`}
      >
        <div className="flex flex-wrap gap-1.5">
          {config.tickers.map(t => (
            <span
              key={t}
              className="font-mono-data text-[11px] px-2 py-0.5 rounded"
              style={{ background: 'oklch(0.22 0.010 258)', color: 'oklch(0.65 0.010 258)' }}
            >
              {t}
            </span>
          ))}
        </div>
      </PageHeader>
      <div className="p-6 space-y-3">
        {/* Sort controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
          <span className="text-[11px]" style={{ color: 'oklch(0.55 0.010 258)' }}>Sort:</span>
          {([
            { value: 'default' as SortMode, label: 'Default' },
            { value: 'alpha' as SortMode,   label: 'A → Z' },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className="text-[11px] px-2.5 py-1 rounded transition-all"
              style={{
                background: sortMode === opt.value ? 'oklch(0.80 0.15 200 / 15%)' : 'oklch(0.17 0.010 258)',
                color: sortMode === opt.value ? 'oklch(0.85 0.15 200)' : 'oklch(0.55 0.010 258)',
                border: `1px solid ${sortMode === opt.value ? 'oklch(0.80 0.15 200 / 40%)' : 'oklch(1 0 0 / 9%)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div
          className="rounded p-3 text-xs"
          style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.80 0.15 200)' }}>Workflow: </span>
          <span style={{ color: 'oklch(0.58 0.010 258)' }}>
            For each ticker, fetch live GEX walls (gamma pinning/acceleration zones), dark pool floors/ceilings
            (institutional support/resistance), and net drift (directional order flow). Synthesise a directional
            bias (bullish / bearish / neutral) to inform position evaluation and new entry decisions.
          </span>
        </div>
        {sortedTickers.map(ticker => (
          <TickerIntelCard key={ticker} ticker={ticker} />
        ))}
      </div>
    </div>
  );
}
