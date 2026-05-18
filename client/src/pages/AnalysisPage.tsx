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

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useChartData, useMarketIntelligence, usePositions, useChartLevels, useOrderFlow,
  useCalendar, useEarningsHistory, useBriefing, calcDte, formatDollar, regimeInfo,
  type Position,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  LineChart,
  ComposedChart,
  Line,
  Bar,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ExternalLink, TrendingUp, Activity, BarChart3, Layers, ShieldCheck, Sigma, AlertTriangle } from 'lucide-react';
import VolAnalyticsPanel from '@/components/VolAnalyticsPanel';
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

// ─── Technical indicator math helpers ───────────────────────────────────────

/** Wilder EMA (used for RSI) — first value is SMA, then Wilder smoothing */
function wilderEma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  // Seed with SMA of first `period` values
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;
  for (let i = period; i < values.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + values[i]) / period;
  }
  return result;
}

/** Standard EMA */
function ema(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

/** RSI(14) — returns array of RSI values (null where not enough data) */
function calcRsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  const avgGains = wilderEma(gains, period);
  const avgLosses = wilderEma(losses, period);
  for (let i = period - 1; i < gains.length; i++) {
    const ag = avgGains[i];
    const al = avgLosses[i];
    if (ag == null || al == null) continue;
    const rs = al === 0 ? 100 : ag / al;
    result[i + 1] = 100 - 100 / (1 + rs);
  }
  return result;
}

/** MACD(12,26,9) — returns { macd, signal, histogram } arrays */
function calcMacd(
  closes: number[],
  fast = 12, slow = 26, signal = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = ema(closes, fast);
  const ema26 = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  // Signal: EMA of macdLine values (skip nulls)
  const macdValues = macdLine.map(v => v ?? 0);
  const signalRaw = ema(macdValues, signal);
  const signalLine: (number | null)[] = signalRaw.map((v, i) =>
    macdLine[i] != null && i >= slow + signal - 2 ? v : null
  );
  const histogram: (number | null)[] = macdLine.map((m, i) =>
    m != null && signalLine[i] != null ? m - (signalLine[i] as number) : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

/** Bollinger Bands(20, 2) — returns { upper, middle, lower } arrays */
function calcBollingerBands(
  closes: number[],
  period = 20, stdDevMultiplier = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const middle: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    middle[i] = mean;
    upper[i] = mean + stdDevMultiplier * sd;
    lower[i] = mean - stdDevMultiplier * sd;
  }
  return { upper, middle, lower };
}

// ─── OTM Buffer label helper ─────────────────────────────────────────────────

function otmBufferColor(pct: number): string {
  if (pct < 5)  return 'oklch(0.65 0.22 25)';   // red
  if (pct < 8)  return 'oklch(0.78 0.18 85)';   // orange/amber
  if (pct < 15) return 'oklch(0.85 0.18 80)';   // yellow
  return 'oklch(0.72 0.18 145)';                 // green
}

// ─── Price chart (uses candles + levels + earnings overlay) ───────────────────

function PriceChart({ ticker, positions, vix }: {
  ticker: string;
  positions: Position[];
  vix: number | null;
}) {
  const { data, loading, error } = useChartData(ticker);
  const { data: calendarData } = useCalendar();
  const { data: earningsHistory } = useEarningsHistory(ticker);
  const { config } = useConfig();

  // Map candles to recharts format — safe even when data is null (empty array)
  const chartData = useMemo(() => (data?.candles ?? []).map(c => ({
    date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rawDate: new Date(c.time * 1000).toISOString().slice(0, 10),
    close: c.close,
  })), [data]);

  const closes = useMemo(() => chartData.map(d => d.close), [chartData]);

  // ── Pine Script indicators ────────────────────────────────────────────
  const chartDataWithIndicators = useMemo(() => {
    const sma50Data = chartData.map((d, i) => {
      if (i < 49) return { ...d, sma50: null };
      const slice = closes.slice(i - 49, i + 1);
      return { ...d, sma50: slice.reduce((a, b) => a + b, 0) / 50 };
    });
    return sma50Data.map((d, i) => {
      if (i < 199) return { ...d, sma200: null };
      const slice = closes.slice(i - 199, i + 1);
      return { ...d, sma200: slice.reduce((a, b) => a + b, 0) / 200 };
    });
  }, [chartData, closes]);

  const hi52w = useMemo(() => closes.length >= 252
    ? Math.max(...closes.slice(-252))
    : closes.length > 0 ? Math.max(...closes) : null, [closes]);

  const lastSma200 = chartDataWithIndicators.filter(d => d.sma200 != null).slice(-1)[0]?.sma200 ?? null;
  const currentClose = closes[closes.length - 1] ?? null;
  const thesisBroken = lastSma200 != null && currentClose != null && currentClose < lastSma200;

  const minPrice = closes.length ? Math.min(...closes) * 0.98 : 0;
  const maxPrice = closes.length ? Math.max(...closes) * 1.02 : 100;

  const dpFloors = data?.levels?.dp_floors ?? [];
  const gexCalls = data?.levels?.gex_calls ?? [];
  const gexPuts = data?.levels?.gex_puts ?? [];

  // ── §9 Active option strike lines from live positions ─────────────────────
  // Derive short call, short put, long put, LEAP entry from open legs for this ticker
  const tickerLegs = positions.filter(p => p.ticker === ticker && p.sec_type === 'OPT');

  // Short calls: short (qty < 0) call legs → highest strike (nearest OTM)
  const shortCallLegs = tickerLegs.filter(l => l.qty < 0 && l.right === 'C');
  const shortCallStrike = shortCallLegs.length
    ? Math.min(...shortCallLegs.map(l => l.strike))
    : null;

  // Short puts: short (qty < 0) put legs → highest strike (nearest OTM)
  const shortPutLegs = tickerLegs.filter(l => l.qty < 0 && l.right === 'P');
  const shortPutStrike = shortPutLegs.length
    ? Math.max(...shortPutLegs.map(l => l.strike))
    : null;

  // Long puts: long (qty > 0) put legs → highest strike (spread floor)
  const longPutLegs = tickerLegs.filter(l => l.qty > 0 && l.right === 'P');
  const longPutStrike = longPutLegs.length
    ? Math.max(...longPutLegs.map(l => l.strike))
    : null;

  // LEAP entry: long call legs with DTE > 180 (LEAPS)
  const leapLegs = tickerLegs.filter(l => l.qty > 0 && l.right === 'C' && l.expiry && calcDte(l.expiry) > 180);
  const leapEntryStrike = leapLegs.length
    ? Math.min(...leapLegs.map(l => l.strike))
    : null;

  // OTM buffer calculations (vs current close)
  const shortCallOtmPct = shortCallStrike != null && currentClose != null
    ? ((shortCallStrike - currentClose) / shortCallStrike) * 100
    : null;
  const shortPutOtmPct = shortPutStrike != null && currentClose != null
    ? ((currentClose - shortPutStrike) / shortPutStrike) * 100
    : null;

  // ── §4 Earnings blackout window ───────────────────────────────────────────
  const earningsEntry = calendarData?.tickers?.[ticker];
  const earningsBlackout = earningsEntry?.status === 'blackout' || earningsEntry?.status === 'approaching';
  const daysToEarnings = earningsEntry?.days_to_earnings ?? null;
  const earningsWindowDays = 10; // §4 strategy default: 10-day no-entry window
  const earningsWindowActive = daysToEarnings != null && daysToEarnings >= 0 && daysToEarnings <= earningsWindowDays;

  // ── §7 VIX pause zone ─────────────────────────────────────────────────────
  const vixPauseLevel = 25;
  const vixPause = vix != null && vix > vixPauseLevel;

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

  // Early returns AFTER all hooks
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

          {/* §7 VIX Pause Zone — red background when VIX > 25 */}
          {vixPause && (
            <ReferenceArea
              x1={chartDataWithIndicators[0]?.date}
              x2={chartDataWithIndicators[chartDataWithIndicators.length - 1]?.date}
              fill="oklch(0.65 0.22 25 / 6%)"
              ifOverflow="visible"
            />
          )}

          {/* §4 Earnings Blackout Window — yellow background from 10 days before next earnings date */}
          {(() => {
            if (!earningsWindowActive) return null;
            const nextEarningsDate = earningsEntry?.next_earnings;
            if (!nextEarningsDate || !chartData.length) return null;
            // Compute the blackout start date = next_earnings - 10 calendar days
            const earningsMs = new Date(nextEarningsDate).getTime();
            const blackoutStartMs = earningsMs - earningsWindowDays * 24 * 60 * 60 * 1000;
            const blackoutStartStr = new Date(blackoutStartMs).toISOString().slice(0, 10);
            // Find the closest chart bar to the blackout start
            const startBar = chartData.reduce((best, d) =>
              Math.abs(new Date(d.rawDate).getTime() - blackoutStartMs) <
              Math.abs(new Date(best.rawDate).getTime() - blackoutStartMs) ? d : best
            );
            // End bar: last bar in chart (earnings may be beyond chart window)
            const endBar = chartData[chartData.length - 1];
            return (
              <ReferenceArea
                x1={startBar.date}
                x2={endBar.date}
                fill="oklch(0.85 0.18 80 / 8%)"
                ifOverflow="visible"
              />
            );
          })()}

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

          {/* §9 Active option strike lines from live positions */}
          {shortCallStrike != null && (
            <ReferenceLine
              y={shortCallStrike}
              stroke="oklch(0.78 0.18 55 / 90%)"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: `Short Call $${shortCallStrike}${shortCallOtmPct != null ? ` (OTM ${shortCallOtmPct.toFixed(1)}%)` : ''}`,
                fontSize: 9,
                fill: otmBufferColor(shortCallOtmPct ?? 99),
                position: 'insideTopLeft',
                offset: 4,
              }}
            />
          )}
          {shortPutStrike != null && (
            <ReferenceLine
              y={shortPutStrike}
              stroke="oklch(0.65 0.22 25 / 85%)"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: `Short Put $${shortPutStrike}${shortPutOtmPct != null ? ` (OTM ${shortPutOtmPct.toFixed(1)}%)` : ''}`,
                fontSize: 9,
                fill: otmBufferColor(shortPutOtmPct ?? 99),
                position: 'insideBottomLeft',
                offset: 4,
              }}
            />
          )}
          {longPutStrike != null && (
            <ReferenceLine
              y={longPutStrike}
              stroke="oklch(0.60 0.18 250 / 70%)"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={{
                value: `Long Put $${longPutStrike}`,
                fontSize: 9,
                fill: 'oklch(0.60 0.18 250)',
                position: 'insideBottomLeft',
                offset: 4,
              }}
            />
          )}
          {leapEntryStrike != null && (
            <ReferenceLine
              y={leapEntryStrike}
              stroke="oklch(0.72 0.20 180 / 70%)"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: `LEAP Entry $${leapEntryStrike}`,
                fontSize: 9,
                fill: 'oklch(0.72 0.20 180)',
                position: 'insideTopLeft',
                offset: 4,
              }}
            />
          )}

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

      {/* Status badges row */}
      <div className="flex flex-col gap-1 mt-2">
        {/* §6 Thesis Broken Zone badge */}
        {thesisBroken && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs" style={{ background: 'oklch(0.65 0.22 25 / 12%)', border: '1px solid oklch(0.65 0.22 25 / 30%)', color: 'oklch(0.65 0.22 25)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-bold">THESIS BROKEN</span>
            <span style={{ color: 'oklch(0.55 0.010 258)' }}>Price below 200 SMA — trend-following regime, reduce size</span>
          </div>
        )}

        {/* §7 VIX Pause Zone badge */}
        {vixPause && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs" style={{ background: 'oklch(0.65 0.22 25 / 10%)', border: '1px solid oklch(0.65 0.22 25 / 25%)', color: 'oklch(0.65 0.22 25)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-bold">VIX PAUSE — NO NEW ENTRIES</span>
            <span style={{ color: 'oklch(0.55 0.010 258)' }}>VIX {vix?.toFixed(1)} &gt; 25 — §7 regime filter active, pause all new premium-selling entries</span>
          </div>
        )}

        {/* §4 Earnings Blackout Window badge */}
        {earningsWindowActive && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs" style={{ background: 'oklch(0.85 0.18 80 / 10%)', border: '1px solid oklch(0.85 0.18 80 / 30%)', color: 'oklch(0.78 0.18 85)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-bold">EARNINGS WINDOW</span>
            <span style={{ color: 'oklch(0.55 0.010 258)' }}>
              {daysToEarnings === 0 ? 'Earnings today' : `${daysToEarnings}d to earnings`} — §4 no-entry window active, no new puts/diagonals/Jade Lizards
            </span>
          </div>
        )}

        {/* §5 OTM buffer status for short call */}
        {shortCallOtmPct != null && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs"
            style={{
              background: `${otmBufferColor(shortCallOtmPct)}15`,
              border: `1px solid ${otmBufferColor(shortCallOtmPct)}40`,
              color: otmBufferColor(shortCallOtmPct),
            }}>
            <span className="font-bold">SHORT CALL OTM {shortCallOtmPct.toFixed(1)}%</span>
            <span style={{ color: 'oklch(0.55 0.010 258)' }}>
              {shortCallOtmPct < 5 ? '🔴 Critical — evaluate roll up-and-out for net credit'
                : shortCallOtmPct < 8 ? '🟠 Warning — monitor closely'
                : shortCallOtmPct < 15 ? '🟡 Adequate buffer'
                : '🟢 Comfortable buffer'}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {[
          { color: 'oklch(0.80 0.15 200)', label: 'Price' },
          { color: 'oklch(0.60 0.18 250)', label: '50 SMA' },
          { color: 'oklch(0.65 0.22 25)', label: '200 SMA (Thesis Stop)' },
          hi52w != null ? { color: 'oklch(0.65 0.22 25 / 80%)', label: '52W High' } : null,
          shortCallStrike != null ? { color: 'oklch(0.78 0.18 55)', label: 'Short Call' } : null,
          shortPutStrike != null ? { color: 'oklch(0.65 0.22 25)', label: 'Short Put' } : null,
          longPutStrike != null ? { color: 'oklch(0.60 0.18 250)', label: 'Long Put' } : null,
          leapEntryStrike != null ? { color: 'oklch(0.72 0.20 180)', label: 'LEAP Entry' } : null,
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

// ─── Bollinger Bands panel ─────────────────────────────────────────────────────
// Note: BB is overlaid on the price chart data array, not a separate chart.
// The BB lines are added to chartDataWithIndicators in the BollingerBandsPanel component.

function BollingerBandsPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useChartData(ticker);

  const closes = useMemo(() => (data?.candles ?? []).map(c => c.close), [data]);

  const chartData = useMemo(() => (data?.candles ?? []).map(c => ({
    date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    close: c.close,
  })), [data]);

  const bb = useMemo(() => calcBollingerBands(closes, 20, 2), [closes]);

  const chartDataWithBB = useMemo(() => chartData.map((d, i) => ({
    ...d,
    bbUpper: bb.upper[i],
    bbMiddle: bb.middle[i],
    bbLower: bb.lower[i],
  })), [chartData, bb]);

  // Bandwidth for squeeze detection: (upper - lower) / middle
  const lastIdx = chartDataWithBB.length - 1;
  const lastUpper = bb.upper[lastIdx];
  const lastLower = bb.lower[lastIdx];
  const lastMiddle = bb.middle[lastIdx];
  const bandwidth = lastUpper != null && lastLower != null && lastMiddle != null && lastMiddle !== 0
    ? ((lastUpper - lastLower) / lastMiddle) * 100
    : null;

  // Squeeze: bandwidth in bottom 20th percentile of last 50 bars
  const bwHistory = bb.upper.slice(-50).map((u, i) => {
    const l = bb.lower[bb.lower.length - 50 + i];
    const m = bb.middle[bb.middle.length - 50 + i];
    if (u == null || l == null || m == null || m === 0) return null;
    return ((u - l) / m) * 100;
  }).filter((v): v is number => v != null);
  const bwSorted = [...bwHistory].sort((a, b) => a - b);
  const bwP20 = bwSorted[Math.floor(bwSorted.length * 0.2)] ?? null;
  const isSqueeze = bandwidth != null && bwP20 != null && bandwidth <= bwP20;

  const minPrice = closes.length ? Math.min(...closes) * 0.97 : 0;
  const maxPrice = closes.length ? Math.max(...closes) * 1.03 : 100;

  if (loading) return <div className="h-40 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data || !chartData.length) return null;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Bollinger Bands(20, 2) — {ticker}</h3>
        {bandwidth != null && (
          <span className="font-mono-data text-[10px] px-2 py-0.5 rounded" style={{
            background: isSqueeze ? 'oklch(0.78 0.18 85 / 15%)' : 'oklch(0.80 0.15 200 / 10%)',
            color: isSqueeze ? 'oklch(0.78 0.18 85)' : 'oklch(0.80 0.15 200)',
          }}>
            {isSqueeze ? '🔧 SQUEEZE' : 'BW'} {bandwidth.toFixed(1)}%
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {[{ color: 'oklch(0.80 0.15 200)', label: 'Price' }, { color: 'oklch(0.78 0.18 85 / 80%)', label: 'Upper' }, { color: 'oklch(0.65 0.010 258)', label: 'Middle (SMA20)' }, { color: 'oklch(0.72 0.18 145 / 80%)', label: 'Lower' }].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />
              <span className="font-mono-data text-[9px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartDataWithBB} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[minPrice, maxPrice]}
            tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={50} />
          <Tooltip contentStyle={{
            background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)',
            borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'oklch(0.93 0.005 258)',
          }} formatter={(v: number) => [`$${v.toFixed(2)}`]} />
          <Line type="monotone" dataKey="bbUpper" stroke="oklch(0.78 0.18 85 / 70%)" strokeWidth={1} dot={false} connectNulls strokeDasharray="4 2" />
          <Line type="monotone" dataKey="bbMiddle" stroke="oklch(0.65 0.010 258 / 60%)" strokeWidth={1} dot={false} connectNulls strokeDasharray="2 2" />
          <Line type="monotone" dataKey="bbLower" stroke="oklch(0.72 0.18 145 / 70%)" strokeWidth={1} dot={false} connectNulls strokeDasharray="4 2" />
          <Line type="monotone" dataKey="close" stroke="oklch(0.80 0.15 200)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── RSI panel ────────────────────────────────────────────────────────────────────────────────────

function RsiPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useChartData(ticker);

  const closes = useMemo(() => (data?.candles ?? []).map(c => c.close), [data]);
  const rsiValues = useMemo(() => calcRsi(closes, 14), [closes]);

  const chartData = useMemo(() => (data?.candles ?? []).map((c, i) => ({
    date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rsi: rsiValues[i],
  })), [data, rsiValues]);

  const lastRsi = rsiValues.filter(v => v != null).slice(-1)[0] ?? null;
  const rsiState = lastRsi == null ? 'neutral'
    : lastRsi >= 70 ? 'overbought'
    : lastRsi <= 30 ? 'oversold'
    : 'neutral';
  const rsiColor = rsiState === 'overbought' ? 'oklch(0.65 0.22 25)'
    : rsiState === 'oversold' ? 'oklch(0.72 0.18 145)'
    : 'oklch(0.78 0.18 85)';

  if (loading) return <div className="h-32 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data || !chartData.length) return null;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>RSI(14) — {ticker}</h3>
        {lastRsi != null && (
          <span className="font-mono-data text-xs font-bold px-2 py-0.5 rounded" style={{
            color: rsiColor, background: `${rsiColor.replace(')', ' / 12%)')}`,
          }}>
            {lastRsi.toFixed(1)} {rsiState === 'overbought' ? '▲ OVERBOUGHT' : rsiState === 'oversold' ? '▼ OVERSOLD' : ''}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto text-[9px] font-mono-data" style={{ color: 'oklch(0.50 0.010 258)' }}>
          <span style={{ color: 'oklch(0.65 0.22 25)' }}>— 70 Overbought</span>
          <span style={{ color: 'oklch(0.72 0.18 145)' }}>— 30 Oversold</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]}
            tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} ticks={[0, 30, 50, 70, 100]} width={30} />
          <Tooltip contentStyle={{
            background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)',
            borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'oklch(0.93 0.005 258)',
          }} formatter={(v: number) => [v != null ? v.toFixed(1) : '—', 'RSI']} />
          {/* Overbought zone */}
          <ReferenceArea y1={70} y2={100} fill="oklch(0.65 0.22 25 / 8%)" />
          {/* Oversold zone */}
          <ReferenceArea y1={0} y2={30} fill="oklch(0.72 0.18 145 / 8%)" />
          {/* Midline */}
          <ReferenceLine y={50} stroke="oklch(1 0 0 / 15%)" strokeDasharray="3 3" />
          <ReferenceLine y={70} stroke="oklch(0.65 0.22 25 / 50%)" strokeDasharray="4 2" />
          <ReferenceLine y={30} stroke="oklch(0.72 0.18 145 / 50%)" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="rsi" stroke="oklch(0.78 0.18 85)" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── MACD panel ──────────────────────────────────────────────────────────────────────────────────

function MacdPanel({ ticker }: { ticker: string }) {
  const { data, loading } = useChartData(ticker);

  const closes = useMemo(() => (data?.candles ?? []).map(c => c.close), [data]);
  const { macd, signal, histogram } = useMemo(() => calcMacd(closes, 12, 26, 9), [closes]);

  const chartData = useMemo(() => (data?.candles ?? []).map((c, i) => {
    const prevHist = i > 0 ? histogram[i - 1] : null;
    const curHist = histogram[i];
    // Crossover dot: histogram flips sign between this bar and previous
    const isBullishCross = prevHist != null && curHist != null && prevHist < 0 && curHist >= 0;
    const isBearishCross = prevHist != null && curHist != null && prevHist >= 0 && curHist < 0;
    return {
      date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      macd: macd[i],
      signal: signal[i],
      histogram: histogram[i],
      bullishDot: isBullishCross && macd[i] != null ? macd[i] : null,
      bearishDot: isBearishCross && macd[i] != null ? macd[i] : null,
    };
  }), [data, macd, signal, histogram]);

  const lastMacd = macd.filter(v => v != null).slice(-1)[0] ?? null;
  const lastSignal = signal.filter(v => v != null).slice(-1)[0] ?? null;
  const lastHist = histogram.filter(v => v != null).slice(-1)[0] ?? null;
  const prevHist = histogram.filter(v => v != null).slice(-2)[0] ?? null;

  const crossover = lastMacd != null && lastSignal != null
    ? lastMacd > lastSignal ? 'bullish' : 'bearish'
    : null;
  const momentum = lastHist != null && prevHist != null
    ? lastHist > prevHist ? 'increasing' : 'decreasing'
    : null;

  if (loading) return <div className="h-32 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />;
  if (!data || !chartData.length) return null;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>MACD(12, 26, 9) — {ticker}</h3>
        {crossover && (
          <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded" style={{
            color: crossover === 'bullish' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
            background: crossover === 'bullish' ? 'oklch(0.72 0.18 145 / 12%)' : 'oklch(0.65 0.22 25 / 12%)',
          }}>
            {crossover === 'bullish' ? '▲ MACD ABOVE SIGNAL' : '▼ MACD BELOW SIGNAL'}
          </span>
        )}
        {momentum && (
          <span className="font-mono-data text-[9px] px-1.5 py-0.5 rounded" style={{
            color: momentum === 'increasing' ? 'oklch(0.72 0.18 145 / 80%)' : 'oklch(0.65 0.22 25 / 80%)',
            background: 'oklch(1 0 0 / 5%)',
          }}>
            Momentum {momentum}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {[{ color: 'oklch(0.80 0.15 200)', label: 'MACD' }, { color: 'oklch(0.78 0.18 85)', label: 'Signal' }, { color: 'oklch(0.72 0.18 145)', label: 'Histogram' }, { color: 'oklch(0.72 0.18 145)', label: '● Bull X' }, { color: 'oklch(0.65 0.22 25)', label: '● Bear X' }].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />
              <span className="font-mono-data text-[9px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: 'oklch(0.50 0.010 258)', fontFamily: 'JetBrains Mono' }}
            tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(2)} width={45} />
          <Tooltip contentStyle={{
            background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)',
            borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'oklch(0.93 0.005 258)',
          }} formatter={(v: number) => [v != null ? v.toFixed(4) : '—']} />
          <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" />
          <Bar dataKey="histogram" maxBarSize={6}>
            {chartData.map((entry, i) => (
              <Cell
                key={`hist-${i}`}
                fill={(entry.histogram ?? 0) >= 0 ? 'oklch(0.72 0.18 145 / 70%)' : 'oklch(0.65 0.22 25 / 70%)'}
              />
            ))}
          </Bar>
          <Line type="monotone" dataKey="macd" stroke="oklch(0.80 0.15 200)" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="signal" stroke="oklch(0.78 0.18 85)" strokeWidth={1} dot={false} connectNulls strokeDasharray="4 2" />
          {/* Bullish crossover dots — green circles where histogram flips positive */}
          <Line
            type="monotone"
            dataKey="bullishDot"
            stroke="transparent"
            dot={(props: any) => {
              const { cx, cy, value } = props;
              if (value == null || cx == null || cy == null) return <g key={props.key} />;
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill="oklch(0.72 0.18 145)" stroke="oklch(0.17 0.010 258)" strokeWidth={1.5} />;
            }}
            activeDot={false}
            legendType="none"
            connectNulls={false}
          />
          {/* Bearish crossover dots — red circles where histogram flips negative */}
          <Line
            type="monotone"
            dataKey="bearishDot"
            stroke="transparent"
            dot={(props: any) => {
              const { cx, cy, value } = props;
              if (value == null || cx == null || cy == null) return <g key={props.key} />;
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill="oklch(0.65 0.22 25)" stroke="oklch(0.17 0.010 258)" strokeWidth={1.5} />;
            }}
            activeDot={false}
            legendType="none"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Position legs for ticker ─────────────────────────────────────────────────────
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
  // Net Drift: backend returns an object {cumulative_drift, net_drift_last, bias, ...}
  // Guard against NaN by checking isFinite
  const netDriftObj = data.net_drift;
  const netDriftRaw = netDriftObj?.cumulative_drift ?? netDriftObj?.net_drift_last ?? data.regime?.net_drift ?? null;
  const netDrift = (netDriftRaw != null && isFinite(Number(netDriftRaw))) ? Number(netDriftRaw) : null;
  const netDriftBias = netDriftObj?.bias ?? null;
  // GEX: backend returns call_walls[] array, not a scalar call_wall
  const gexData = data.gex;
  const gexCallWall = gexData?.call_walls?.[0]?.strike ?? (gexData as any)?.call_wall ?? data.regime?.gex_call_wall ?? null;

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
          { label: 'Net Drift', value: netDrift !== null
              ? `${netDrift >= 0 ? '+' : ''}${netDrift.toLocaleString('en-US', { maximumFractionDigits: 0 })}${netDriftBias ? ` (${netDriftBias})` : ''}`
              : '—' },
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
  const netDelta = data.net_delta ?? 0;
  const buyPct = data.buy_pct ?? 0;
  const sellPct = data.sell_pct ?? 0;
  const barsCount = data.bars?.length ?? 0;
  // Distinguish true zero from missing data: if all metrics are 0 AND no bars loaded, data is unavailable
  const hasData = barsCount > 0 || netDelta !== 0 || buyPct !== 0 || sellPct !== 0;
  const bias = netDelta > 0 ? 'BULLISH' : netDelta < 0 ? 'BEARISH' : 'NEUTRAL';
  const biasColor = bias === 'BULLISH' ? 'oklch(0.72 0.18 145)' : bias === 'BEARISH' ? 'oklch(0.65 0.22 25)' : 'oklch(0.80 0.15 200)';

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4" style={{ color: 'oklch(0.78 0.18 85)' }} />
        <h3 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Order Flow — {ticker}</h3>
        {hasData && <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded ml-auto" style={{ color: biasColor, background: `${biasColor}15` }}>{bias}</span>}
      </div>
      {!hasData ? (
        <div className="flex items-center justify-center h-16 text-xs" style={{ color: 'oklch(0.50 0.010 258)' }}>
          No intraday flow data available for {ticker}
        </div>
      ) : (
        <>
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
          {barsCount > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid oklch(1 0 0 / 8%)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>{barsCount} flow bars loaded</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SPY Levels Panel ────────────────────────────────────────────────────────────────

function PositionRiskContextPanel({ ticker }: { ticker: string }) {
  const { data: posData } = usePositions();
  const { data: spyChart } = useChartData('SPY');

  const legs = useMemo(() =>
    (posData?.positions ?? []).filter(p => p.ticker === ticker && p.sec_type === 'OPT'),
    [posData, ticker]
  );

  const { concentration, betaWeightedDelta, thetaEfficiencyPct, netTheta, totalMV, netLiq } = useMemo(() => {
    const nl = posData?.totals?.net_liq ?? null;
    const concPct = posData?.concentration?.[ticker] ?? null;

    if (!legs.length) return { concentration: concPct, betaWeightedDelta: null, thetaEfficiencyPct: null, netTheta: null, totalMV: null, netLiq: nl };

    let theta = 0, mv = 0;
    for (const p of legs) {
      const mult = Number(p.multiplier ?? 100);
      const qty = p.qty ?? 0;
      if (p.current_theta != null) theta += p.current_theta * qty * mult;
      mv += (p.market_value ?? 0);
    }

    const spyPrice = spyChart?.candles?.length
      ? spyChart.candles[spyChart.candles.length - 1].close
      : null;
    let bwDelta: number | null = null;
    if (spyPrice) {
      let bwSum = 0;
      for (const p of legs) {
        const mult = Number(p.multiplier ?? 100);
        const qty = p.qty ?? 0;
        const price = p.avg_cost ?? null;
        if (p.current_delta != null && price != null) {
          bwSum += (p.current_delta * qty * mult) * (price / spyPrice);
        }
      }
      bwDelta = bwSum;
    }

    const thetaEff = nl && nl > 0 ? (Math.abs(theta) / nl) * 100 : null;

    return { concentration: concPct, betaWeightedDelta: bwDelta, thetaEfficiencyPct: thetaEff, netTheta: theta, totalMV: mv, netLiq: nl };
  }, [legs, posData, spyChart, ticker]);

  if (!posData) return null;

  const GREEN  = 'oklch(0.72 0.18 145)';
  const RED    = 'oklch(0.65 0.22 25)';
  const AMBER  = 'oklch(0.78 0.18 85)';
  const CYAN   = 'oklch(0.80 0.15 200)';
  const DIM    = 'oklch(0.50 0.010 258)';
  const BRIGHT = 'oklch(0.93 0.005 258)';

  const concColor = concentration == null ? CYAN
    : concentration >= 20 ? RED
    : concentration >= 12 ? AMBER
    : GREEN;

  const thetaEffStatus = thetaEfficiencyPct == null ? null
    : thetaEfficiencyPct >= 0.1 && thetaEfficiencyPct <= 0.5 ? 'on-target'
    : thetaEfficiencyPct < 0.1 ? 'low' : 'high';
  const thetaEffColor = thetaEffStatus === 'on-target' ? GREEN : thetaEffStatus === 'low' ? AMBER : RED;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4" style={{ color: AMBER }} />
        <h3 className="font-display text-sm" style={{ color: BRIGHT }}>Position Risk Context — {ticker}</h3>
        {concentration != null && concentration >= 20 && (
          <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded ml-auto"
            style={{ color: RED, background: 'oklch(0.65 0.22 25 / 12%)' }}>
            ⚠ CONCENTRATION WARNING
          </span>
        )}
      </div>

      {!legs.length ? (
        <div className="flex items-center justify-center h-16 text-xs" style={{ color: DIM }}>
          No open option legs for {ticker}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: DIM }}>Ticker Concentration</div>
              <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: concColor }}>
                {concentration != null ? `${concentration.toFixed(1)}% of Net Liq` : '—'}
              </div>
            </div>
            <div className="text-[9px] text-right" style={{ color: DIM }}>
              {concentration != null && concentration >= 20 ? 'Exceeds 20% limit' : 'Single-name limit: 20%'}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: DIM }}>β-Weighted Δ to SPY</div>
              <div className="font-mono-data text-sm font-bold mt-0.5"
                style={{ color: betaWeightedDelta == null ? DIM : betaWeightedDelta >= 0 ? GREEN : RED }}>
                {betaWeightedDelta != null ? `${betaWeightedDelta >= 0 ? '+' : ''}${betaWeightedDelta.toFixed(1)}` : '—'}
              </div>
            </div>
            <div className="text-[9px] text-right" style={{ color: DIM }}>
              Market-equivalent<br />SPY delta exposure
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: DIM }}>Θ Efficiency (Θ / Net Liq)</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono-data text-sm font-bold"
                  style={{ color: thetaEfficiencyPct == null ? DIM : thetaEffColor }}>
                  {thetaEfficiencyPct != null ? `${thetaEfficiencyPct.toFixed(3)}%/day` : '—'}
                </span>
                {thetaEffStatus && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono-data"
                    style={{ color: thetaEffColor, background: `${thetaEffColor}15` }}>
                    {thetaEffStatus === 'on-target' ? '✓ ON TARGET' : thetaEffStatus === 'low' ? '↓ LOW' : '↑ HIGH'}
                  </span>
                )}
              </div>
            </div>
            <div className="text-[9px] text-right" style={{ color: DIM }}>
              Target: 0.10%–<br />0.50% / day
            </div>
          </div>

          <div className="flex gap-3 text-[10px] font-mono-data pt-1" style={{ color: DIM }}>
            {netTheta != null && <span>Net Θ: <span style={{ color: netTheta >= 0 ? GREEN : RED }}>{netTheta >= 0 ? '+' : ''}{netTheta.toFixed(2)}/day</span></span>}
            {totalMV != null && <span>Position MV: <span style={{ color: CYAN }}>{formatDollar(totalMV)}</span></span>}
            {netLiq != null && <span>Net Liq: <span style={{ color: CYAN }}>{formatDollar(netLiq)}</span></span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { config } = useConfig();
  const { data: positionsData } = usePositions();
  const { data: briefingData } = useBriefing();
  const allPositions = positionsData?.positions ?? [];
  const vix = briefingData?.macro_regime?.vix ?? null;
  // Indicator panel visibility — persisted to localStorage
  const [showBB, setShowBB] = useState(() => localStorage.getItem('fortress_show_bb') !== 'false');
  const [showRsi, setShowRsi] = useState(() => localStorage.getItem('fortress_show_rsi') !== 'false');
  const [showMacd, setShowMacd] = useState(() => localStorage.getItem('fortress_show_macd') !== 'false');

  const toggleBB = () => setShowBB(v => { const next = !v; localStorage.setItem('fortress_show_bb', String(next)); return next; });
  const toggleRsi = () => setShowRsi(v => { const next = !v; localStorage.setItem('fortress_show_rsi', String(next)); return next; });
  const toggleMacd = () => setShowMacd(v => { const next = !v; localStorage.setItem('fortress_show_macd', String(next)); return next; });

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
            <PriceChart ticker={selectedTicker} positions={allPositions} vix={vix} />

            {/* Indicator toggle bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-data text-[10px] uppercase tracking-wider mr-1" style={{ color: 'oklch(0.45 0.010 258)' }}>Indicators</span>
              {([
                { label: 'BB(20,2)', active: showBB, toggle: toggleBB },
                { label: 'RSI(14)', active: showRsi, toggle: toggleRsi },
                { label: 'MACD(12,26,9)', active: showMacd, toggle: toggleMacd },
              ] as const).map(({ label, active, toggle }) => (
                <button
                  key={label}
                  onClick={toggle}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono-data transition-all"
                  style={{
                    background: active ? 'oklch(0.80 0.15 200 / 15%)' : 'oklch(1 0 0 / 5%)',
                    color: active ? 'oklch(0.80 0.15 200)' : 'oklch(0.45 0.010 258)',
                    border: `1px solid ${active ? 'oklch(0.80 0.15 200 / 40%)' : 'oklch(1 0 0 / 10%)'}`,
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: active ? 'oklch(0.80 0.15 200)' : 'oklch(0.35 0.010 258)',
                  }} />
                  {label}
                </button>
              ))}
            </div>

            {showBB && <BollingerBandsPanel ticker={selectedTicker} />}
            {(showRsi || showMacd) && (
              <div className={showRsi && showMacd ? 'grid grid-cols-2 gap-4' : ''}>
                {showRsi && <RsiPanel ticker={selectedTicker} />}
                {showMacd && <MacdPanel ticker={selectedTicker} />}
              </div>
            )}
            <GreeksSummaryPanel ticker={selectedTicker} />
            <div className="grid grid-cols-2 gap-4">
              <ChartLevelsPanel ticker={selectedTicker} />
              <OrderFlowPanel ticker={selectedTicker} />
            </div>
            <TickerIntelPanel ticker={selectedTicker} />
            <VolAnalyticsPanel ticker={selectedTicker} />
            <PositionRiskContextPanel ticker={selectedTicker} />
            <TickerLegs ticker={selectedTicker} />
          </>
        )}
      </div>
    </div>
  );
}
