/**
 * ForwardPnLPanel — Gap 2 (OptionStrat-inspired)
 * Interactive forward P&L simulator inside a position accordion.
 * Inputs: target price slider, target date picker, IV adjustment slider.
 * Outputs: P&L at target + P&L-vs-price curve (Recharts LineChart).
 *
 * Uses /api/options/forward-pnl endpoint (py_vollib Black-Scholes).
 */
import { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react';
import { useForwardPnL, type LegInput, type Position } from '@/hooks/useApi';
import { positionsToLegs } from './PositionLimitsBadge';

const GREEN  = 'oklch(0.72 0.17 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const DIM    = 'oklch(0.55 0.02 258)';
const BRIGHT = 'oklch(0.88 0.02 258)';
const CYAN   = 'oklch(0.80 0.15 200)';
const BG     = 'oklch(0.16 0.010 258)';
const BORDER = 'oklch(1 0 0 / 8%)';

function fmt(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nearestExpiry(legs: LegInput[]): string {
  const expiries = legs.map(l => l.expiry).filter(Boolean).sort();
  return expiries[0] ?? toDateString(addDays(new Date(), 30));
}

interface Props {
  ticker: string;
  legs: Position[];
  spot?: number;
}

export default function ForwardPnLPanel({ ticker, legs }: Props) {
  const legInputs: LegInput[] = useMemo(() => positionsToLegs(legs), [legs]);
  const hasOptions = legInputs.length > 0;

  // Derive a sensible default target price from avg strike
  const avgStrike = useMemo(() => {
    if (!legInputs.length) return 100;
    return Math.round(legInputs.reduce((s, l) => s + l.strike, 0) / legInputs.length);
  }, [legInputs]);

  const maxExpiry = useMemo(() => nearestExpiry(legInputs), [legInputs]);
  const defaultTarget = useMemo(() => Math.round(avgStrike * 1.05), [avgStrike]);
  const defaultDate = useMemo(() => {
    // Default to 14 days from now, capped at nearest expiry
    const twoWeeks = toDateString(addDays(new Date(), 14));
    return twoWeeks < maxExpiry ? twoWeeks : maxExpiry;
  }, [maxExpiry]);

  const [targetPrice, setTargetPrice] = useState(defaultTarget);
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [ivAdj, setIvAdj] = useState(1.0);
  const [showPanel, setShowPanel] = useState(false);

  // Stable legs reference for the hook
  const stableLegs = useMemo(() => legInputs, [legInputs]);

  const { data, loading, error, refresh } = useForwardPnL(
    ticker, stableLegs, targetPrice, targetDate, ivAdj, showPanel && hasOptions
  );

  const handleIvCrush = useCallback(() => setIvAdj(0.6), []);
  const handleIvReset = useCallback(() => setIvAdj(1.0), []);

  if (!hasOptions) return null;

  const pnlColor = data && data.target_pnl >= 0 ? GREEN : RED;
  const PnLIcon = data && data.target_pnl >= 0 ? TrendingUp : TrendingDown;

  // Chart data — colour each point green/red based on sign
  const chartData = data?.curve ?? [];

  return (
    <div
      className="border-t"
      style={{ borderColor: BORDER, background: BG }}
    >
      {/* Toggle header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        onClick={() => setShowPanel(p => !p)}
      >
        <Zap className="w-3.5 h-3.5" style={{ color: CYAN }} />
        <span className="text-[11px] font-semibold" style={{ color: CYAN }}>
          Forward P&L Simulator
        </span>
        {data && (
          <span
            className="ml-2 font-mono-data text-[11px] font-bold"
            style={{ color: pnlColor }}
          >
            {fmt(data.target_pnl)} @ ${targetPrice} on {targetDate}
          </span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: DIM }}>
          {showPanel ? '▲ hide' : '▼ expand'}
        </span>
      </button>

      {showPanel && (
        <div className="px-4 pb-4 space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-end gap-4 pt-2">
            {/* Target price slider */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>
                Target Price
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={Math.round(avgStrike * 0.7)}
                  max={Math.round(avgStrike * 1.4)}
                  step={1}
                  value={targetPrice}
                  onChange={e => setTargetPrice(Number(e.target.value))}
                  className="w-32 accent-cyan-400"
                />
                <span className="font-mono-data text-xs font-semibold" style={{ color: BRIGHT }}>
                  ${targetPrice}
                </span>
              </div>
            </div>

            {/* Target date */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                min={toDateString(new Date())}
                max={maxExpiry}
                onChange={e => setTargetDate(e.target.value)}
                className="text-xs px-2 py-1 rounded border font-mono-data"
                style={{
                  background: 'oklch(0.20 0.010 258)',
                  borderColor: BORDER,
                  color: BRIGHT,
                }}
              />
            </div>

            {/* IV adjustment */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>
                IV Adjustment{' '}
                <span style={{ color: ivAdj < 1 ? AMBER : ivAdj > 1 ? GREEN : DIM }}>
                  {ivAdj < 1 ? `−${((1 - ivAdj) * 100).toFixed(0)}%` : ivAdj > 1 ? `+${((ivAdj - 1) * 100).toFixed(0)}%` : 'flat'}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  value={ivAdj}
                  onChange={e => setIvAdj(Number(e.target.value))}
                  className="w-28 accent-cyan-400"
                />
                <button
                  onClick={handleIvCrush}
                  className="text-[9px] px-1.5 py-0.5 rounded border"
                  style={{ color: AMBER, borderColor: 'oklch(0.78 0.18 85 / 30%)' }}
                  title="Simulate 40% IV crush (post-earnings)"
                >
                  −40% crush
                </button>
                <button
                  onClick={handleIvReset}
                  className="text-[9px] px-1.5 py-0.5 rounded border"
                  style={{ color: DIM, borderColor: BORDER }}
                >
                  reset
                </button>
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded border transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
              style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 25%)' }}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Computing…' : 'Recalculate'}
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="text-[11px] px-3 py-2 rounded" style={{ color: RED, background: 'oklch(0.65 0.22 25 / 8%)' }}>
              {error}
            </div>
          )}

          {/* Result summary */}
          {data && !loading && (
            <div className="flex flex-wrap items-center gap-4 px-3 py-2 rounded"
              style={{ background: 'oklch(0.20 0.010 258)', border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2">
                <PnLIcon className="w-4 h-4" style={{ color: pnlColor }} />
                <span className="text-[10px]" style={{ color: DIM }}>
                  If {ticker} reaches ${targetPrice} by {targetDate}
                  {ivAdj !== 1.0 && ` with IV ${ivAdj < 1 ? '−' : '+'}${Math.abs((ivAdj - 1) * 100).toFixed(0)}%`}:
                </span>
                <span className="font-mono-data text-base font-bold" style={{ color: pnlColor }}>
                  {fmt(data.target_pnl)}
                </span>
              </div>
              {(data.breakevens ?? []).filter((be): be is number => be != null).length > 0 && (
                <div className="flex items-center gap-1 text-[10px]" style={{ color: DIM }}>
                  <span>BE:</span>
                  {(data.breakevens ?? []).filter((be): be is number => be != null).map((be, i, arr) => (
                    <span key={i} className="font-mono-data" style={{ color: CYAN }}>
                      ${be.toFixed(2)}{i < arr.length - 1 ? ' /' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* P&L curve chart */}
          {data && chartData.length > 0 && (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis
                    dataKey="price"
                    tickFormatter={v => `$${v}`}
                    tick={{ fontSize: 9, fill: 'oklch(0.55 0.02 258)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={v => v >= 0 ? `+$${Math.abs(v)}` : `-$${Math.abs(v)}`}
                    tick={{ fontSize: 9, fill: 'oklch(0.55 0.02 258)' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'P&L']}
                    labelFormatter={(label: number) => `Price: $${label}`}
                    contentStyle={{
                      background: 'oklch(0.18 0.010 258)',
                      border: '1px solid oklch(1 0 0 / 12%)',
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: BRIGHT }}
                    itemStyle={{ color: CYAN }}
                  />
                  {/* Zero line */}
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" strokeDasharray="4 2" />
                  {/* Target price line */}
                  <ReferenceLine
                    x={targetPrice}
                    stroke={CYAN}
                    strokeDasharray="4 2"
                    label={{ value: `$${targetPrice}`, position: 'top', fontSize: 9, fill: CYAN }}
                  />
                  {/* Breakeven lines */}
                  {(data.breakevens ?? []).filter((be): be is number => be != null).map((be, i) => (
                    <ReferenceLine
                      key={i}
                      x={be}
                      stroke={AMBER}
                      strokeDasharray="3 3"
                      label={{ value: `BE $${be.toFixed(2)}`, position: 'insideTopLeft', fontSize: 8, fill: AMBER }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    dot={false}
                    strokeWidth={2}
                    stroke={CYAN}
                    // Colour segments by sign using a gradient trick isn't available in Recharts
                    // so we use a single cyan line; the zero reference line provides context
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="h-[180px] flex items-center justify-center">
              <span className="text-[11px] animate-pulse" style={{ color: DIM }}>
                Running Black-Scholes simulation…
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
