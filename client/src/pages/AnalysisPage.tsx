/**
 * FORTRESS V2 — Analysis Page
 * Per-ticker deep dive: chart data with SMA/support/resistance, stop-loss evaluation,
 * roll evaluation, and TradingView integration link.
 * Ticker selection from configurable universe.
 */

import { useState } from 'react';
import { useChartData, useMarketIntelligence, usePositions, calcDte, formatDollar } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { RegimeBadge } from '@/components/RegimeBadge';
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
  tickers: string[];
  selected: string;
  onSelect: (t: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tickers.map(t => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={cn(
            'font-mono-data text-xs px-3 py-1.5 rounded border transition-all',
            selected === t
              ? 'font-semibold'
              : 'hover:bg-[oklch(1_0_0_/_5%)]'
          )}
          style={selected === t ? {
            color: 'oklch(0.80 0.15 200)',
            borderColor: 'oklch(0.80 0.15 200 / 50%)',
            background: 'oklch(0.80 0.15 200 / 12%)',
          } : {
            color: 'oklch(0.65 0.010 258)',
            borderColor: 'oklch(1 0 0 / 10%)',
            background: 'transparent',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Price chart ──────────────────────────────────────────────────────────────

function PriceChart({ ticker }: { ticker: string }) {
  const { data, loading, error } = useChartData(ticker);

  if (loading) {
    return (
      <div className="h-64 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
    );
  }

  if (error || !data) {
    return (
      <div
        className="h-64 rounded border flex items-center justify-center"
        style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}
      >
        <div className="text-center">
          <div className="text-sm mb-1">Chart data unavailable</div>
          <div className="text-xs">{error ?? 'No data returned'}</div>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs"
            style={{ color: 'oklch(0.80 0.15 200)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in TradingView
          </a>
        </div>
      </div>
    );
  }

  const chartData = data.prices.map((p, i) => ({
    date: p.date,
    close: p.close,
    sma50: data.sma_50?.[i],
    sma200: data.sma_200?.[i],
  }));

  const prices = data.prices.map(p => p.close);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;

  return (
    <div
      className="rounded border p-4"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {ticker} — Price Chart
        </h3>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
          style={{ color: 'oklch(0.80 0.15 200)' }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          TradingView
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fontSize: 10, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v.toFixed(0)}`}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: 'oklch(0.22 0.010 258)',
              border: '1px solid oklch(1 0 0 / 12%)',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono',
              color: 'oklch(0.93 0.005 258)',
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`]}
          />

          {/* Support levels */}
          {data.support_levels?.map((level, i) => (
            <ReferenceLine
              key={`sup-${i}`}
              y={level}
              stroke="oklch(0.72 0.18 145 / 50%)"
              strokeDasharray="4 4"
              label={{ value: `S $${level.toFixed(0)}`, fontSize: 9, fill: 'oklch(0.72 0.18 145)', position: 'right' }}
            />
          ))}

          {/* Resistance levels */}
          {data.resistance_levels?.map((level, i) => (
            <ReferenceLine
              key={`res-${i}`}
              y={level}
              stroke="oklch(0.65 0.22 25 / 50%)"
              strokeDasharray="4 4"
              label={{ value: `R $${level.toFixed(0)}`, fontSize: 9, fill: 'oklch(0.65 0.22 25)', position: 'right' }}
            />
          ))}

          <Line type="monotone" dataKey="close" stroke="oklch(0.80 0.15 200)" strokeWidth={1.5} dot={false} />
          {data.sma_50 && (
            <Line type="monotone" dataKey="sma50" stroke="oklch(0.78 0.18 85)" strokeWidth={1} dot={false} strokeDasharray="3 3" />
          )}
          {data.sma_200 && (
            <Line type="monotone" dataKey="sma200" stroke="oklch(0.65 0.22 25)" strokeWidth={1} dot={false} strokeDasharray="5 3" />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { color: 'oklch(0.80 0.15 200)', label: 'Price' },
          data.sma_50 ? { color: 'oklch(0.78 0.18 85)', label: 'SMA 50' } : null,
          data.sma_200 ? { color: 'oklch(0.65 0.22 25)', label: 'SMA 200' } : null,
        ].filter(Boolean).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: item!.color }} />
            <span className="font-mono-data text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
              {item!.label}
            </span>
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
      <div
        className="rounded border p-4 text-xs"
        style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}
      >
        No open positions for {ticker}
      </div>
    );
  }

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: 'oklch(1 0 0 / 9%)' }}
    >
      <div className="px-4 py-2.5 font-display text-xs font-bold" style={{ background: 'oklch(0.20 0.010 258)', color: 'oklch(0.93 0.005 258)' }}>
        Open Positions — {ticker}
      </div>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
            {['Right', 'Strike', 'Expiry', 'DTE', 'Qty', 'Delta', 'Mkt Val', 'Roll?'].map(h => (
              <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'oklch(0.50 0.010 258)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map(leg => {
            const dte = calcDte(leg.expiry);
            const isRoll = leg.qty < 0 && dte <= config.strategy.rollDteDays;
            const isDeltaAlert = leg.qty < 0 && Math.abs(leg.delta) >= config.strategy.deltaAlertThreshold;
            return (
              <tr
                key={leg.id}
                className="border-b hover:bg-[oklch(1_0_0_/_3%)]"
                style={{ borderColor: 'oklch(1 0 0 / 6%)' }}
              >
                <td className="px-3 py-2">
                  <span className="font-mono-data text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
                      color: leg.right === 'C' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
                    }}>
                    {leg.right}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>${leg.strike}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>{leg.expiry}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: dte <= 7 ? 'oklch(0.65 0.22 25)' : isRoll ? 'oklch(0.78 0.18 85)' : 'oklch(0.65 0.010 258)' }}>{dte}d</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: leg.qty > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>{leg.qty > 0 ? '+' : ''}{leg.qty}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: isDeltaAlert ? 'oklch(0.65 0.22 25)' : 'oklch(0.65 0.010 258)' }}>{leg.delta > 0 ? '+' : ''}{leg.delta.toFixed(3)}</td>
                <td className="px-3 py-2 font-mono-data text-xs" style={{ color: leg.mkt_val >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>{formatDollar(leg.mkt_val)}</td>
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

// ─── Market intel panel ───────────────────────────────────────────────────────

function TickerIntelPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useMarketIntelligence(ticker);

  if (loading) {
    return <div className="h-24 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  }

  if (!data) return null;

  return (
    <div
      className="rounded border p-4"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
          Market Intelligence — {ticker}
        </h3>
        {data.regime_score !== undefined && (
          <RegimeBadge score={data.regime_score} size="sm" />
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'GEX', value: data.gex !== undefined ? data.gex.toLocaleString() : '—' },
          { label: 'DP Floor', value: data.dp_floor !== undefined ? `$${data.dp_floor.toFixed(2)}` : '—' },
          { label: 'DP Ceiling', value: data.dp_ceiling !== undefined ? `$${data.dp_ceiling.toFixed(2)}` : '—' },
          { label: 'Net Drift', value: data.net_drift !== undefined ? `${data.net_drift > 0 ? '+' : ''}${data.net_drift.toFixed(2)}` : '—' },
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
          <EmptyState
            type="no-config"
            title="No tickers configured"
            description="Add tickers to your universe in Settings."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Analysis"
        subtitle="Per-ticker deep dive — chart, levels, positions, market intelligence"
      />

      <div className="p-6 space-y-4">
        {/* Ticker selector */}
        <TickerSelector
          tickers={config.tickers}
          selected={selectedTicker}
          onSelect={setSelectedTicker}
        />

        {selectedTicker && (
          <>
            {/* Price chart */}
            <PriceChart ticker={selectedTicker} />

            {/* Market intel */}
            <TickerIntelPanel ticker={selectedTicker} />

            {/* Open positions */}
            <TickerLegs ticker={selectedTicker} />
          </>
        )}
      </div>
    </div>
  );
}
