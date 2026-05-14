/**
 * FORTRESS V2 — Market Intelligence Page
 * Layer 2: Per-ticker flow analysis — GEX walls, DP floors, Net Drift, directional bias.
 * Ticker universe is fully configurable in Settings. No hardcoded symbols.
 */

import { useState } from 'react';
import { useMarketIntelligence, type MarketIntelligence } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { RegimeBadge } from '@/components/RegimeBadge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Ticker Intel Card ────────────────────────────────────────────────────────

function TickerIntelCard({ ticker }: { ticker: string }) {
  const { data, loading, error, refresh } = useMarketIntelligence(ticker);
  const [expanded, setExpanded] = useState(false);

  const biasColor = {
    bullish: 'oklch(0.72 0.18 145)',
    bearish: 'oklch(0.65 0.22 25)',
    neutral: 'oklch(0.78 0.18 85)',
  };

  const BiasIcon = data?.directional_bias === 'bullish'
    ? TrendingUp
    : data?.directional_bias === 'bearish'
    ? TrendingDown
    : Minus;

  return (
    <div
      className="rounded border overflow-hidden"
      style={{
        borderColor: data?.directional_bias === 'bullish'
          ? 'oklch(0.72 0.18 145 / 30%)'
          : data?.directional_bias === 'bearish'
          ? 'oklch(0.65 0.22 25 / 30%)'
          : 'oklch(1 0 0 / 9%)',
      }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        style={{ background: 'oklch(0.20 0.010 258)' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
        )}

        <span className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {ticker}
        </span>

        {loading && (
          <div className="h-4 w-20 rounded animate-pulse ml-2" style={{ background: 'oklch(1 0 0 / 8%)' }} />
        )}

        {!loading && data && (
          <div className="ml-auto flex items-center gap-4">
            {/* Directional bias */}
            <div className="flex items-center gap-1.5">
              <BiasIcon
                className="w-4 h-4"
                style={{ color: biasColor[data.directional_bias ?? 'neutral'] }}
              />
              <span
                className="font-mono-data text-xs font-semibold capitalize"
                style={{ color: biasColor[data.directional_bias ?? 'neutral'] }}
              >
                {data.directional_bias ?? 'neutral'}
              </span>
            </div>

            {/* Regime score */}
            {data.regime_score !== undefined && (
              <RegimeBadge score={data.regime_score} size="sm" />
            )}

            {/* Key metrics inline */}
            <div className="flex items-center gap-3 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
              {data.dp_floor !== undefined && (
                <span>DP: <span style={{ color: 'oklch(0.80 0.15 200)' }}>${data.dp_floor.toFixed(2)}</span></span>
              )}
              {data.net_drift !== undefined && (
                <span>Drift: <span style={{
                  color: data.net_drift > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
                }}>
                  {data.net_drift > 0 ? '+' : ''}{data.net_drift.toFixed(2)}
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
            <MetricBox label="GEX" value={data.gex !== undefined ? data.gex.toLocaleString() : '—'} color="oklch(0.80 0.15 200)" />
            <MetricBox label="DP Floor" value={data.dp_floor !== undefined ? `$${data.dp_floor.toFixed(2)}` : '—'} color="oklch(0.80 0.15 200)" />
            <MetricBox label="DP Ceiling" value={data.dp_ceiling !== undefined ? `$${data.dp_ceiling.toFixed(2)}` : '—'} color="oklch(0.80 0.15 200)" />
            <MetricBox
              label="Net Drift"
              value={data.net_drift !== undefined ? `${data.net_drift > 0 ? '+' : ''}${data.net_drift.toFixed(2)}` : '—'}
              color={data.net_drift === undefined ? 'oklch(0.80 0.15 200)' : data.net_drift > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)'}
            />
          </div>

          {/* GEX walls */}
          {data.gex_walls && data.gex_walls.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
                GEX Walls
              </div>
              <div className="flex flex-wrap gap-2">
                {data.gex_walls.map((wall, i) => (
                  <span
                    key={i}
                    className="font-mono-data text-xs px-2 py-1 rounded border"
                    style={{
                      color: 'oklch(0.80 0.15 200)',
                      borderColor: 'oklch(0.80 0.15 200 / 30%)',
                      background: 'oklch(0.80 0.15 200 / 8%)',
                    }}
                  >
                    ${wall.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trade setups */}
          {data.trade_setups && data.trade_setups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Trade Setups
              </div>
              <div className="space-y-1.5">
                {data.trade_setups.map((setup, i) => (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded border"
                    style={{
                      color: 'oklch(0.75 0.005 258)',
                      borderColor: 'oklch(1 0 0 / 8%)',
                      background: 'oklch(0.22 0.010 258)',
                    }}
                  >
                    {setup}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.last_updated && (
            <div className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
              Updated: {data.last_updated}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
        {/* Workflow explanation */}
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

        {/* Per-ticker cards */}
        {config.tickers.map(ticker => (
          <TickerIntelCard key={ticker} ticker={ticker} />
        ))}
      </div>
    </div>
  );
}
