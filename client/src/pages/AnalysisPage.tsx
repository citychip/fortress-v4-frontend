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

import { useState, useEffect, useMemo } from 'react';
import {
  useChartData, useMarketIntelligence, usePositions, useChartLevels, useOrderFlow, useSpyHedgeCoverage,
  useCalendar, useEarningsHistory, calcDte, formatDollar, regimeInfo,
} from '@/hooks/useApi';
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
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { ExternalLink, TrendingUp, Activity, BarChart3, Layers, ShieldCheck, Sigma } from 'lucide-react';
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

// ─── Greeks summary panel ────────────────────────────────────────────────────

function GreeksSummaryPanel({ ticker }: { ticker: string }) {
  const { data } = usePositions();
  const legs = (data?.positions ?? []).filter(p => p.ticker === ticker && p.sec_type === 'OPT');

  if (!legs.length) return null;

  // Aggregate per-leg Greeks x qty x multiplier
  let totalDelta = 0, totalGamma = 0, totalTheta = 0, totalVega = 0;
  const ivValues: number[] = [];

  legs.forEach(leg => {
    const mult = Number(leg.multiplier ?? 100);
    const qty = leg.qty ?? 0;
    totalDelta += (leg.current_delta ?? 0) * qty * mult;
    totalGamma += (leg.current_gamma ?? 0) * qty * mult;
    totalTheta += (leg.current_theta ?? 0) * qty * mult;
    totalVega  += (leg.current_vega  ?? 0) * qty * mult;
    if (leg.current_iv != null) ivValues.push(leg.current_iv);
  });

  const avgIv = ivValues.length ? ivValues.reduce((a, b) => a + b, 0) / ivValues.length : null;
  const fmt = (v: number, decimals = 2) => `${v > 0 ? '+' : ''}${v.toFixed(decimals)}`;

  const greeks = [
    {
      label: 'Net Delta',
      value: fmt(totalDelta, 2),
      hint: 'delta x qty x 100',
      color: totalDelta > 0 ? 'oklch(0.72 0.18 145)' : totalDelta < 0 ? 'oklch(0.65 0.22 25)' : 'oklch(0.80 0.15 200)',
    },
    {
      label: 'Net Gamma',
      value: fmt(totalGamma, 3),
      hint: 'gamma x qty x 100',
      color: totalGamma > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
    },
    {
      label: 'Net Theta',
      value: fmt(totalTheta, 2),
      hint: 'daily P&L from decay',
      color: totalTheta > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
    },
    {
      label: 'Net Vega',
      value: fmt(totalVega, 2),
      hint: 'P&L per 1pp IV move',
      color: totalVega > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
    },
    {
      label: 'Avg IV',
      value: avgIv != null ? `${avgIv.toFixed(1)}%` : '—',
      hint: 'mean IV across legs',
      color: avgIv == null ? 'oklch(0.65 0.010 258)'
        : avgIv >= 60 ? 'oklch(0.65 0.22 25)'
        : avgIv >= 35 ? 'oklch(0.78 0.18 85)'
        : 'oklch(0.72 0.18 145)',
    },
    {
      label: 'Legs',
      value: `${legs.length}`,
      hint: 'open option legs',
      color: 'oklch(0.80 0.15 200)',
    },
  ];

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sigma className="w-4 h-4" style={{ color: 'oklch(0.78 0.18 85)' }} />
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Greeks Summary — {ticker}</h3>
        <span className="font-mono-data text-[10px] ml-auto" style={{ color: 'oklch(0.50 0.010 258)' }}>position-weighted aggregates</span>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {greeks.map(g => (
          <div key={g.label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{g.label}</div>
            <div className="font-mono-data text-sm font-bold" style={{ color: g.color }}>{g.value}</div>
            <div className="text-[9px] mt-0.5 leading-tight" style={{ color: 'oklch(0.42 0.010 258)' }}>{g.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Price chart (uses candles + levels + earnings overlay) ───────────────────

function PriceChart({ ticker }: { ticker: string }) {
  const { data, loading, error } = useChartData(ticker);
  const { data: calendarData } = useCalendar();
  const { data: earningsHistory } = useEarningsHistory(ticker);

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
    rawDate: new Date(c.time * 1000).toISOString().slice(0, 10),
    close: c.close,
  }));

  const closes = chartData.map(d => d.close);
  const minPrice = closes.length ? Math.min(...closes) * 0.98 : 0;
  const maxPrice = closes.length ? Math.max(...closes) * 1.02 : 100;

  // ── Pine Script indicators ────────────────────────────────────────────────
  // 50-day SMA (blue)
  const sma50Data = chartData.map((d, i) => {
    if (i < 49) return { ...d, sma50: null };
    const slice = closes.slice(i - 49, i + 1);
    return { ...d, sma50: slice.reduce((a, b) => a + b, 0) / 50 };
  });

  // 200-day SMA (red) — merged into same data array
  const chartDataWithIndicators = sma50Data.map((d, i) => {
    if (i < 199) return { ...d, sma200: null };
    const slice = closes.slice(i - 199, i + 1);
    return { ...d, sma200: slice.reduce((a, b) => a + b, 0) / 200 };
  });

  // 52-week high (highest of last 252 daily closes)
  const hi52w = closes.length >= 252
    ? Math.max(...closes.slice(-252))
    : closes.length > 0 ? Math.max(...closes) : null;

  // Thesis Broken Zone: current price < 200 SMA
  const lastSma200 = chartDataWithIndicators.filter(d => d.sma200 != null).slice(-1)[0]?.sma200 ?? null;
  const currentClose = closes[closes.length - 1] ?? null;
  const thesisBroken = lastSma200 != null && currentClose != null && currentClose < lastSma200;

  const dpFloors = data.levels?.dp_floors ?? [];
  const gexCalls = data.levels?.gex_calls ?? [];
  const gexPuts = data.levels?.gex_puts ?? [];

  // Earnings overlay: multi-marker from history endpoint, fallback to calendar next_earnings
  const earningsMarkers: Array<{ date: string; label: string; isPast: boolean; surprisePct: number | null }> = useMemo(() => {
    if (!chartData.length) return [];
    const firstDate = chartData[0].rawDate;
    const lastDate = chartData[chartData.length - 1].rawDate;

    // Prefer history endpoint (past + upcoming)
    const historyDates = earningsHistory?.dates ?? [];
    const sourceDates = historyDates.length > 0
      ? historyDates
      : (calendarData?.tickers?.[ticker]?.next_earnings
          ? [{ date: calendarData.tickers[ticker].next_earnings, type: 'upcoming', eps_estimate: null, reported_eps: null, surprise_pct: null }]
          : []);

    const markers: typeof earningsMarkers = [];
    for (const entry of sourceDates) {
      const earningsDate = entry.date;
      // Include dates within chart range OR upcoming dates beyond chart end
      if (earningsDate < firstDate && entry.type === 'past') continue; // before chart window
      const closest = chartData.reduce((best, d) =>
        Math.abs(new Date(d.rawDate).getTime() - new Date(earningsDate).getTime()) <
        Math.abs(new Date(best.rawDate).getTime() - new Date(earningsDate).getTime()) ? d : best
      );
      const isPast = entry.type === 'past';
      const surprise = entry.surprise_pct;
      const surpriseTag = surprise != null ? (surprise >= 0 ? ` +${surprise.toFixed(1)}%` : ` ${surprise.toFixed(1)}%`) : '';
      markers.push({
        date: closest.date,
        label: isPast ? `EPS ${earningsDate.slice(5)}${surpriseTag}` : `EPS ${earningsDate.slice(5)} →`,
        isPast,
        surprisePct: surprise ?? null,
      });
    }
    return markers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, earningsHistory, calendarData, ticker]);

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>{ticker} — Price Chart</h3>
        <a href={`https://www.tradingview.com/chart/?symbol=${ticker}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80" style={{ color: 'oklch(0.80 0.15 200)' }}>
          <TrendingUp className="w-3.5 h-3.5" /> TradingView <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartDataWithIndicators} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
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

          {/* Thesis Broken Zone — red background when price < 200 SMA */}
          {thesisBroken && (
            <ReferenceArea
              x1={chartDataWithIndicators[0]?.date}
              x2={chartDataWithIndicators[chartDataWithIndicators.length - 1]?.date}
              fill="oklch(0.65 0.22 25 / 8%)"
              ifOverflow="visible"
            />
          )}

          {/* 52-Week High horizontal line */}
          {hi52w != null && (
            <ReferenceLine
              y={hi52w}
              stroke="oklch(0.65 0.22 25 / 80%)"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: `52W High $${hi52w.toFixed(2)}`, fontSize: 9, fill: 'oklch(0.65 0.22 25)', position: 'insideTopRight', offset: 4 }}
            />
          )}

          {/* Earnings date overlays — multi-marker from history */}
          {earningsMarkers.map((m, i) => {
            // Colour: upcoming = amber, past beat = green, past miss = red, past neutral = amber dim
            const beatColor = 'oklch(0.72 0.18 145 / 70%)';
            const missColor = 'oklch(0.65 0.22 25 / 70%)';
            const upcomingColor = 'oklch(0.78 0.18 85)';
            const pastNeutralColor = 'oklch(0.78 0.18 85 / 50%)';
            let stroke = pastNeutralColor;
            if (!m.isPast) stroke = upcomingColor;
            else if (m.surprisePct != null && m.surprisePct > 0) stroke = beatColor;
            else if (m.surprisePct != null && m.surprisePct < 0) stroke = missColor;
            return (
              <ReferenceLine key={`eps-${i}`} x={m.date}
                stroke={stroke}
                strokeDasharray={m.isPast ? '3 3' : '6 2'} strokeWidth={m.isPast ? 1 : 1.5}
                label={{ value: m.label, fontSize: 9, fill: stroke.replace(/ \/.*/, ')'), position: 'insideTopLeft', offset: 4 }} />
            );
          })}

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

          {/* 50-day SMA — blue */}
          <Line type="monotone" dataKey="sma50" stroke="oklch(0.60 0.18 250)" strokeWidth={1.5} dot={false} connectNulls />
          {/* 200-day SMA — red (Thesis Stop) */}
          <Line type="monotone" dataKey="sma200" stroke="oklch(0.65 0.22 25)" strokeWidth={2} dot={false} connectNulls />
          {/* Price — cyan, on top */}
          <Line type="monotone" dataKey="close" stroke="oklch(0.80 0.15 200)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Thesis Broken Zone badge */}
      {thesisBroken && (
        <div className="flex items-center gap-2 mt-2 mb-1 px-2.5 py-1.5 rounded text-xs" style={{ background: 'oklch(0.65 0.22 25 / 12%)', border: '1px solid oklch(0.65 0.22 25 / 30%)', color: 'oklch(0.65 0.22 25)' }}>
          <span className="font-bold">⚠ THESIS BROKEN</span>
          <span style={{ color: 'oklch(0.55 0.010 258)' }}>Price is below 200 SMA — trend-following regime, reduce size</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {[
          { color: 'oklch(0.80 0.15 200)', label: 'Price' },
          { color: 'oklch(0.60 0.18 250)', label: '50 SMA' },
          { color: 'oklch(0.65 0.22 25)', label: '200 SMA (Thesis Stop)' },
          hi52w != null ? { color: 'oklch(0.65 0.22 25 / 80%)', label: '52W High' } : null,
          dpFloors.length > 0 ? { color: 'oklch(0.80 0.15 200 / 70%)', label: 'DP Floor' } : null,
          gexCalls.length > 0 ? { color: 'oklch(0.72 0.18 145)', label: 'GEX Call' } : null,
          gexPuts.length > 0 ? { color: 'oklch(0.65 0.22 25)', label: 'GEX Put' } : null,
          earningsMarkers.length > 0 ? { color: 'oklch(0.78 0.18 85)', label: 'Earnings' } : null,
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

  // Derive DP floor/ceiling from dark_pool.floors array (sorted by notional)
  const currentPrice = data.current_price ?? 0;
  const allFloors: Array<{ price: number; notional_m: number }> = (data as any).dark_pool?.floors ?? [];
  const floorsBelow = allFloors.filter(f => f.price < currentPrice).sort((a, b) => b.notional_m - a.notional_m);
  const floorsAbove = allFloors.filter(f => f.price >= currentPrice).sort((a, b) => b.notional_m - a.notional_m);
  const dpFloor = floorsBelow[0]?.price ?? null;
  const dpCeiling = floorsAbove[0]?.price ?? null;
  const netDrift = (data as any).net_drift ?? null;
  // GEX: from gex object if present
  const gexData = (data as any).gex;
  const gexCallWall = gexData?.call_wall ?? gexData?.call_resistance ?? null;

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
          { label: 'GEX Call Wall', value: gexCallWall !== null ? `$${Number(gexCallWall).toFixed(2)}` : '—' },
          { label: 'DP Floor', value: dpFloor !== null ? `$${dpFloor.toFixed(2)}` : '—' },
          { label: 'DP Ceiling', value: dpCeiling !== null ? `$${dpCeiling.toFixed(2)}` : '—' },
          { label: 'Net Drift', value: netDrift !== null ? `${netDrift > 0 ? '+' : ''}${Number(netDrift).toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{label}</div>
            <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>{value}</div>
          </div>
        ))}
      </div>
      {floorsBelow.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid oklch(1 0 0 / 8%)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>Top DP Floors (below price)</div>
          <div className="flex flex-wrap gap-2">
            {floorsBelow.slice(0, 5).map(f => (
              <span key={f.price} className="font-mono-data text-xs px-2 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 10%)', color: 'oklch(0.80 0.15 200)' }}>
                ${f.price.toFixed(2)} <span style={{ color: 'oklch(0.50 0.010 258)' }}>${f.notional_m.toFixed(1)}M</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chart Levels Table ────────────────────────────────────────────────────

function ChartLevelsPanel({ ticker }: { ticker: string }) {
  const { data, loading, error } = useChartLevels(ticker);

  if (loading) return <div className="h-32 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (error || !data) return null;

  const allLevels: Array<{ price: number; type: string; label: string; notional_m?: number }> = [];

  // dp_floors is number[] per ChartLevelsResponse
  (data.dp_floors ?? []).forEach((p: number) => {
    allLevels.push({ price: p, type: 'DP Floor', label: 'Support' });
  });
  // support/resistance arrays
  (data.support ?? []).forEach((p: number) => {
    allLevels.push({ price: p, type: 'GEX Put', label: 'Support' });
  });
  (data.resistance ?? []).forEach((p: number) => {
    allLevels.push({ price: p, type: 'GEX Call', label: 'Resistance' });
  });

  allLevels.sort((a, b) => b.price - a.price);

  if (!allLevels.length) return null;

  const typeColor: Record<string, string> = {
    'DP Floor': 'oklch(0.80 0.15 200)',
    'GEX Call': 'oklch(0.72 0.18 145)',
    'GEX Put': 'oklch(0.65 0.22 25)',
  };

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'oklch(0.20 0.010 258)' }}>
        <Layers className="w-3.5 h-3.5" style={{ color: 'oklch(0.78 0.18 85)' }} />
        <span className="font-display text-xs font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>Key Levels — {ticker}</span>
        <span className="font-mono-data text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{allLevels.length} levels</span>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
            {['Price', 'Type', 'Role', 'Notional'].map(h => (
              <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allLevels.map((l, i) => (
            <tr key={i} className="border-b hover:bg-[oklch(1_0_0_/_3%)]" style={{ borderColor: 'oklch(1 0 0 / 6%)' }}>
              <td className="px-4 py-2 font-mono-data text-xs font-bold" style={{ color: typeColor[l.type] ?? 'oklch(0.85 0.005 258)' }}>${l.price.toFixed(2)}</td>
              <td className="px-4 py-2">
                <span className="text-[10px] font-mono-data font-semibold px-1.5 py-0.5 rounded" style={{ color: typeColor[l.type], background: `${typeColor[l.type]}15` }}>{l.type}</span>
              </td>
              <td className="px-4 py-2 text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>{l.label}</td>
              <td className="px-4 py-2 font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
                {l.notional_m != null ? `$${l.notional_m.toFixed(1)}M` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Order Flow Panel ────────────────────────────────────────────────────

function OrderFlowPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useOrderFlow(ticker);

  if (loading) return <div className="h-24 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data) return null;

  // OrderFlowResponse: bars[], net_delta, buy_pct, sell_pct
  // Guard against undefined/null values from the API
  const netDelta = data.net_delta ?? 0;
  const buyPct = data.buy_pct ?? 0;
  const sellPct = data.sell_pct ?? 0;
  const bias = netDelta > 0 ? 'BULLISH' : netDelta < 0 ? 'BEARISH' : 'NEUTRAL';
  const biasColor = bias === 'BULLISH' ? 'oklch(0.72 0.18 145)' : bias === 'BEARISH' ? 'oklch(0.65 0.22 25)' : 'oklch(0.80 0.15 200)';

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4" style={{ color: 'oklch(0.78 0.18 85)' }} />
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Order Flow — {ticker}</h3>
        <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded ml-auto" style={{ color: biasColor, background: `${biasColor}15` }}>{bias}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Net Delta', value: `${netDelta > 0 ? '+' : ''}${Number(netDelta).toLocaleString()}`, color: netDelta > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' },
          { label: 'Buy %', value: `${(Number(buyPct) * 100).toFixed(1)}%`, color: 'oklch(0.72 0.18 145)' },
          { label: 'Sell %', value: `${(Number(sellPct) * 100).toFixed(1)}%`, color: 'oklch(0.65 0.22 25)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{label}</div>
            <div className="font-mono-data text-sm" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>
      {(data.bars?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid oklch(1 0 0 / 8%)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{data.bars?.length ?? 0} flow bars loaded</div>
        </div>
      )}
    </div>
  );
}

// ─── SPY Levels Panel ────────────────────────────────────────────────────────────────

function SpyHedgePanel() {
  const { data, loading } = useSpyHedgeCoverage();

  if (loading) return <div className="h-20 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data) return null;

  const pct = data.hedge_pct_of_netliq;
  const isAdequate = pct >= data.target_min;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4" style={{ color: isAdequate ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }} />
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>SPY Hedge Coverage</h3>
        <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded ml-auto"
          style={{ color: isAdequate ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)', background: isAdequate ? 'oklch(0.72 0.18 145 / 12%)' : 'oklch(0.65 0.22 25 / 12%)' }}>
          {isAdequate ? 'ADEQUATE' : 'UNDER TARGET'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Hedge MV', value: formatDollar(data.hedge_market_value), color: 'oklch(0.80 0.15 200)' },
          { label: 'Net Hedge MV', value: formatDollar(data.hedge_net_market_value), color: 'oklch(0.80 0.15 200)' },
          { label: 'Hedge % NLV', value: `${(pct * 100).toFixed(1)}%`, color: isAdequate ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' },
          { label: 'Target Min', value: `${(data.target_min * 100).toFixed(1)}%`, color: 'oklch(0.65 0.010 258)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{label}</div>
            <div className="font-mono-data text-sm" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { config } = useConfig();
  const [selectedTicker, setSelectedTicker] = useState(() => {
    // Check for triage ticker set by DTE shortcut from P&L page
    const triage = sessionStorage.getItem('fortress_triage_ticker');
    if (triage && config.tickers.includes(triage)) {
      sessionStorage.removeItem('fortress_triage_ticker');
      return triage;
    }
    // Check for deep-link ticker from Dashboard post-earnings / roll candidate navigation
    const deepLink = sessionStorage.getItem('fortress_analysis_ticker');
    if (deepLink) {
      sessionStorage.removeItem('fortress_analysis_ticker');
      return deepLink;
    }
    return config.tickers[0] ?? '';
  });

  // Also handle if tickers load after initial render
  useEffect(() => {
    const triage = sessionStorage.getItem('fortress_triage_ticker');
    if (triage && config.tickers.includes(triage)) {
      sessionStorage.removeItem('fortress_triage_ticker');
      setSelectedTicker(triage);
      return;
    }
    const deepLink = sessionStorage.getItem('fortress_analysis_ticker');
    if (deepLink) {
      sessionStorage.removeItem('fortress_analysis_ticker');
      setSelectedTicker(deepLink);
    }
  }, [config.tickers]);

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
            <GreeksSummaryPanel ticker={selectedTicker} />
            <div className="grid grid-cols-2 gap-4">
              <ChartLevelsPanel ticker={selectedTicker} />
              <OrderFlowPanel ticker={selectedTicker} />
            </div>
            <TickerIntelPanel ticker={selectedTicker} />
            <SpyHedgePanel />
            <TickerLegs ticker={selectedTicker} />
          </>
        )}
      </div>
    </div>
  );
}
