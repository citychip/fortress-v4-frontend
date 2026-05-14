/**
 * FORTRESS V2 — Market Intelligence Page
 * Layer 2: Per-ticker flow analysis — GEX walls, DP floors, Net Drift, directional bias.
 * Uses /api/market-intelligence?ticker=TICKER (nested regime object).
 */

import { useState } from 'react';
import { useMarketIntelligence, regimeInfo, type MarketIntelligence } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';

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

  const netDrift = regime?.net_drift;
  const dpFloor = regime?.dp_floor;
  const dpCeiling = regime?.dp_ceiling;
  const gexCall = regime?.gex_call_wall;
  const gexPut = regime?.gex_put_wall;
  const score = regime?.score;

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

          <div className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
            Session: {data.session_date} · As of: {new Date(data.as_of).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketIntelPage() {
  const { config } = useConfig();

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

        {config.tickers.map(ticker => (
          <TickerIntelCard key={ticker} ticker={ticker} />
        ))}
      </div>
    </div>
  );
}
