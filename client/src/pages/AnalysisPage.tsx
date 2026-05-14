/**
 * FORTRESS V2 — Analysis Page
 * Per-ticker deep dive: candle chart with GEX/DP levels, stop-loss evaluation,
 * roll evaluation, and TradingView integration link.
 *
 * Actual server shapes used:
 *   ChartData.candles[]  → { time, open, high, low, close, volume }
 *   ChartData.levels     → { dp_floors, gex_calls, gex_puts }
 *   MarketIntelligence.regime → { overall, score, signals, dp_floor, dp_ceiling, net_drift, gex_call_wall, gex_put_wall }
 *   Position             → { current_delta, market_value, local_symbol, expiry, right, strike, qty }
 */

import { useState } from 'react';
import { useChartData, useMarketIntelligence, usePositions, calcDte, formatDollar, regimeInfo } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Ticker selector ──────────────────────────────────────────────────────────

function TickerSelector({ tickers, selected, onSelect }: {
  tickers: string[]; selected: string; onSelect: (t: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tickers.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={cn('font-mono-data text-xs px-3 py-1.5 rounded border transition-all', selected !== t && 'hover:bg-[oklch(1_0_0_/_5%)]')}
          style={selected === t ? {
            color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 50%)', background: 'oklch(0.80 0.15 200 / 12%)',
          } : {
            color: 'oklch(0.65 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)', background: 'transparent',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Price chart (uses candles + levels) ─────────────────────────────────────

function PriceChart({ ticker }: { ticker: string }) {
  const { data, loading, error } = useChartData(ticker);

  if (loading) return <div className="h-64 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;

  if (error || !data) {
    return (
      <div className="h-64 rounded border flex items-center justify-center" style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}>
        <div className="text-center">
          <div className="text-sm mb-1">Chart data unavailable</div>
          <div className="text-xs">{error ?? 'No data returned'}</div>
          <a href={`https://www.tradingview.com/chart/?symbol=${ticker}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs" style={{ color: 'oklch(0.80 0.15 200)' }}>
            <ExternalLink className="w-3.5 h-3.5" /> Open in TradingView
          </a>
        </div>
      </div>
    );
  }

  // Map candles to recharts format
  const chartData = (data.candles ?? []).map(c => ({
    date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    close: c.close,
  }));

  const closes = chartData.map(d => d.close);
  const minPrice = closes.length ? Math.min(...closes) * 0.98 : 0;
  const maxPrice = closes.length ? Math.max(...closes) * 1.02 : 100;

  const dpFloors = data.levels?.dp_floors ?? [];
  const gexCalls = data.levels?.gex_calls ?? [];
  const gexPuts = data.levels?.gex_puts ?? [];

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>{ticker} — Price Chart</h3>
        <a href={`https://www.tradingview.com/chart/?symbol=${ticker}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80" style={{ color: 'oklch(0.80 0.15 200)' }}>
          <TrendingUp className="w-3.5 h-3.5" /> TradingView <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[minPrice, maxPrice]}
            tick={{ fontSize: 10, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={55} />
          <Tooltip contentStyle={{
            background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)',
            borderRadius: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono', color: 'oklch(0.93 0.005 258)',
          }} formatter={(value: number) => [`$${value.toFixed(2)}`]} />

          {/* DP floors (support) */}
          {dpFloors.map((level, i) => (
            <ReferenceLine key={`dp-${i}`} y={level} stroke="oklch(0.80 0.15 200 / 50%)" strokeDasharray="4 4"
              label={{ value: `DP $${level.toFixed(0)}`, fontSize: 9, fill: 'oklch(0.80 0.15 200)', position: 'right' }} />
          ))}
          {/* GEX call walls (resistance) */}
          {gexCalls.map((level, i) => (
            <ReferenceLine key={`gexc-${i}`} y={level} stroke="oklch(0.72 0.18 145 / 50%)" strokeDasharray="4 4"
              label={{ value: `GEX C $${level.toFixed(0)}`, fontSize: 9, fill: 'oklch(0.72 0.18 145)', position: 'right' }} />
          ))}
          {/* GEX put walls (support) */}
          {gexPuts.map((level, i) => (
            <ReferenceLine key={`gexp-${i}`} y={level} stroke="oklch(0.65 0.22 25 / 50%)" strokeDasharray="4 4"
              label={{ value: `GEX P $${level.toFixed(0)}`, fontSize: 9, fill: 'oklch(0.65 0.22 25)', position: 'right' }} />
          ))}

          <Line type="monotone" dataKey="close" stroke="oklch(0.80 0.15 200)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { color: 'oklch(0.80 0.15 200)', label: 'Price' },
          dpFloors.length > 0 ? { color: 'oklch(0.80 0.15 200)', label: 'DP Floor' } : null,
          gexCalls.length > 0 ? { color: 'oklch(0.72 0.18 145)', label: 'GEX Call' } : null,
          gexPuts.length > 0 ? { color: 'oklch(0.65 0.22 25)', label: 'GEX Put' } : null,
        ].filter(Boolean).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: item!.color }} />
            <span className="font-mono-data text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{item!.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Position legs for ticker ─────────────────────────────────────────────────

function TickerLegs({ ticker }: { ticker: string }) {
  const { data } = usePositions();
  const { config } = useConfig();
  const legs = (data?.positions ?? []).filter(p => p.ticker === ticker);

  if (!legs.length) {
    return (
      <div className="rounded border p-4 text-xs" style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}>
        No open positions for {ticker}
      </div>
    );
  }

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="px-4 py-2.5 font-display text-xs font-bold" style={{ background: 'oklch(0.20 0.010 258)', color: 'oklch(0.93 0.005 258)' }}>
        Open Positions — {ticker}
      </div>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
            {['Symbol', 'Right', 'Strike', 'Expiry', 'DTE', 'Qty', 'Delta', 'Mkt Val', 'Roll?'].map(h => (
              <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map(leg => {
            const dte = leg.expiry ? calcDte(leg.expiry) : null;
            const isRoll = leg.qty < 0 && dte !== null && dte <= config.strategy.rollDteDays;
            const delta = leg.current_delta ?? 0;
            const isDeltaAlert = leg.qty < 0 && Math.abs(delta) >= config.strategy.deltaAlertThreshold;
            return (
              <tr key={leg.local_symbol} className="border-b hover:bg-[oklch(1_0_0_/_3%)]" style={{ borderColor: 'oklch(1 0 0 / 6%)' }}>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>{leg.local_symbol}</td>
                <td className="px-3 py-2">
                  <span className="font-mono-data text-xs px-1.5 py-0.5 rounded" style={{
                    background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
                    color: leg.right === 'C' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
                  }}>{leg.right ?? '—'}</span>
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>${leg.strike}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>{leg.expiry ?? '—'}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: dte !== null && dte <= 7 ? 'oklch(0.65 0.22 25)' : isRoll ? 'oklch(0.78 0.18 85)' : 'oklch(0.65 0.010 258)' }}>
                  {dte !== null ? `${dte}d` : '—'}
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: leg.qty > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
                  {leg.qty > 0 ? '+' : ''}{leg.qty}
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: isDeltaAlert ? 'oklch(0.65 0.22 25)' : 'oklch(0.65 0.010 258)' }}>
                  {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(3)}` : '—'}
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: leg.market_value >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
                  {formatDollar(leg.market_value)}
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: isRoll ? 'oklch(0.78 0.18 85)' : 'oklch(0.50 0.010 258)' }}>
                  {isRoll ? '↻ Roll' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Market intel panel (uses nested regime object) ───────────────────────────

function TickerIntelPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useMarketIntelligence(ticker);

  if (loading) return <div className="h-24 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data) return null;

  const regime = data.regime;
  const { label: regimeLabel, color: regimeColor } = regimeInfo(regime?.overall ?? 'neutral');
  const colorMap = { red: 'oklch(0.65 0.22 25)', amber: 'oklch(0.78 0.18 85)', green: 'oklch(0.72 0.18 145)', cyan: 'oklch(0.80 0.15 200)' };
  const regimeHex = colorMap[regimeColor];

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Market Intelligence — {ticker}</h3>
        <span className="font-mono-data text-xs px-2 py-0.5 rounded border font-semibold"
          style={{ color: regimeHex, borderColor: `${regimeHex.replace(')', ' / 40%)')}`, background: `${regimeHex.replace(')', ' / 12%)')}` }}>
          {regimeLabel} {regime?.score !== undefined ? `(${regime.score > 0 ? '+' : ''}${regime.score})` : ''}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'GEX Call Wall', value: regime?.gex_call_wall !== undefined && regime.gex_call_wall !== null ? `$${regime.gex_call_wall.toFixed(2)}` : '—' },
          { label: 'DP Floor', value: regime?.dp_floor !== undefined && regime.dp_floor !== null ? `$${regime.dp_floor.toFixed(2)}` : '—' },
          { label: 'DP Ceiling', value: regime?.dp_ceiling !== undefined && regime.dp_ceiling !== null ? `$${regime.dp_ceiling.toFixed(2)}` : '—' },
          { label: 'Net Drift', value: regime?.net_drift !== undefined && regime.net_drift !== null ? `${regime.net_drift > 0 ? '+' : ''}${regime.net_drift.toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{label}</div>
            <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { config } = useConfig();
  const [selectedTicker, setSelectedTicker] = useState(config.tickers[0] ?? '');

  if (!config.tickers.length) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Analysis" subtitle="Per-ticker deep dive" />
        <div className="p-6">
          <EmptyState type="no-config" title="No tickers configured" description="Add tickers to your universe in Settings." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Analysis" subtitle="Per-ticker deep dive — chart, levels, positions, market intelligence" />
      <div className="p-6 space-y-4">
        <TickerSelector tickers={config.tickers} selected={selectedTicker} onSelect={setSelectedTicker} />
        {selectedTicker && (
          <>
            <PriceChart ticker={selectedTicker} />
            <TickerIntelPanel ticker={selectedTicker} />
            <TickerLegs ticker={selectedTicker} />
          </>
        )}
      </div>
    </div>
  );
}
