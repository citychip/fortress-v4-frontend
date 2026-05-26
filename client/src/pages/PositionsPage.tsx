/**
 * FORTRESS V3 — Positions / Portfolio Page
 * Layer 3: Position-level evaluation — stop-loss, delta breach, roll check, concentration.
 * Enhanced v3: portfolio Greeks bar, per-ticker P&L sparkline, Trade Builder shortcut.
 */

import {
  usePositions, useStopLossAll, useRollAll, useAlerts, useBriefing,
  formatDollar, calcDte,
  type Position,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import PositionLimitsBadge from '@/components/PositionLimitsBadge';
import ForwardPnLPanel from '@/components/ForwardPnLPanel';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Zap, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Link } from 'wouter';

// ─── Color constants ──────────────────────────────────────────────────────────
const CYAN   = 'oklch(0.80 0.15 200)';
const GREEN  = 'oklch(0.72 0.18 145)';
const AMBER  = 'oklch(0.78 0.18 85)';
const RED    = 'oklch(0.65 0.22 25)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evaluatePositionLeg(
  leg: Position,
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number },
  stopLossAct: Set<string>,
  rollNeeded: Set<string>,
  belowSma200: Set<string>,
): string[] {
  const alerts: string[] = [];
  const id = leg.local_symbol;

  if (stopLossAct.has(id)) alerts.push('Stop-loss signal active');
  if (rollNeeded.has(id)) alerts.push('Roll candidate');

  // Technical violation: ticker trading below its 200-day SMA
  if (belowSma200.has(leg.ticker)) {
    alerts.push('Below SMA-200 — technical violation');
  }

  if (leg.current_delta !== null && leg.leg_direction === 'short') {
    const absDelta = Math.abs(leg.current_delta);
    if (absDelta >= strategy.deltaAlertThreshold) {
      alerts.push(`Δ ${absDelta.toFixed(3)} ≥ ${strategy.deltaAlertThreshold} threshold`);
    }
  }

  if (leg.expiry && leg.leg_direction === 'short') {
    const dte = calcDte(leg.expiry);
    if (dte <= strategy.rollDteDays) {
      alerts.push(`${dte}d to expiry — roll window`);
    }
  }

  if (leg.net_liq_pct > strategy.maxSingleNamePct) {
    alerts.push(`${(leg.net_liq_pct ?? 0).toFixed(1)}% NL > ${strategy.maxSingleNamePct}% limit`);
  }

  return alerts;
}

// ─── Portfolio Greeks Bar ─────────────────────────────────────────────────────

function GreeksBar({
  portfolioDelta,
  portfolioTheta,
  portfolioVega,
  betaWeightedDelta,
  positionsWithGreeks,
  positionsTotal,
}: {
  portfolioDelta: number;
  portfolioTheta: number;
  portfolioVega: number;
  betaWeightedDelta?: number | null;
  positionsWithGreeks: number;
  positionsTotal: number;
}) {
  const coverage = positionsTotal > 0 ? (positionsWithGreeks / positionsTotal) * 100 : 0;
  const deltaColor = portfolioDelta > 0 ? AMBER : portfolioDelta < 0 ? RED : GREEN;

  return (
    <div className="rounded border p-4" style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: DIM }}>
          Portfolio Greeks
        </span>
        <span className="text-[10px]" style={{ color: DIM }}>
          {positionsWithGreeks}/{positionsTotal} legs with live Greeks ({coverage.toFixed(0)}% coverage)
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* Delta tile — raw + beta-weighted */}
        <div className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: DIM }}>Portfolio Δ</div>
          <div className="font-mono-data text-lg font-bold" style={{ color: deltaColor }}>
            {portfolioDelta > 0 ? '+' : ''}{Math.round(portfolioDelta)}
          </div>
          {betaWeightedDelta != null ? (
            <div className="text-[10px] mt-0.5 font-mono-data" style={{ color: DIM }}>
              β SPY-eq: <span style={{ color: betaWeightedDelta > 0 ? AMBER : RED }}>
                {betaWeightedDelta > 0 ? '+' : ''}{Math.round(betaWeightedDelta)}
              </span>
            </div>
          ) : (
            <div className="text-[10px] mt-0.5" style={{ color: DIM }}>Net directional exposure</div>
          )}
        </div>
        {/* Theta tile */}
        <div className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: DIM }}>Portfolio Θ</div>
          <div className="font-mono-data text-lg font-bold" style={{ color: portfolioTheta >= 0 ? GREEN : RED }}>
            {portfolioTheta > 0 ? '+' : ''}${Math.abs(portfolioTheta).toFixed(0)}/day
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: DIM }}>Daily time decay collected</div>
        </div>
        {/* Vega tile */}
        <div className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: DIM }}>Portfolio V</div>
          <div className="font-mono-data text-lg font-bold" style={{ color: portfolioVega < -50 ? AMBER : portfolioVega < 0 ? GREEN : RED }}>
            {portfolioVega > 0 ? '+' : ''}{portfolioVega.toFixed(1)}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: DIM }}>Sensitivity to IV change</div>
        </div>
      </div>

      {/* Delta bias bar — bullish/bearish based on sign of beta-weighted delta */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[9px] mb-1" style={{ color: DIM }}>
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'oklch(0.25 0.010 258)' }}>
          {(() => {
            const ref = betaWeightedDelta ?? portfolioDelta;
            // Normalize: treat ±500 SPY shares as the extremes for bar display
            const clamped = Math.max(-1, Math.min(1, ref / 500));
            const pct = ((clamped + 1) / 2) * 100;
            const barColor = ref > 50 ? AMBER : ref < -50 ? RED : GREEN;
            return (
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: barColor }}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Mini P&L sparkline (SVG) ─────────────────────────────────────────────────

function PnLSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80, h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ─── Delta cell ───────────────────────────────────────────────────────────────

function DeltaCell({ delta, direction, threshold }: { delta: number | null; direction: string; threshold: number }) {
  if (delta === null) return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  const isShort = direction === 'short';
  const absDelta = Math.abs(delta);
  const isAlert = isShort && absDelta >= threshold;
  const isWarn  = isShort && absDelta >= threshold * 0.85;

  return (
    <span className="font-mono-data text-xs" style={{
      color: isAlert ? RED : isWarn ? AMBER : delta > 0 ? GREEN : RED,
    }}>
      {delta > 0 ? '+' : ''}{delta.toFixed(3)}
      {isAlert && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── DTE cell ─────────────────────────────────────────────────────────────────

function DteCell({ expiry, rollDays, dteTriage }: { expiry: string | null; rollDays: number; dteTriage: number }) {
  if (!expiry) return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  const dte = calcDte(expiry);
  const isRoll   = dte <= rollDays;
  const isUrgent = dte <= dteTriage;

  return (
    <span className="font-mono-data text-xs" style={{
      color: isUrgent ? RED : isRoll ? AMBER : 'oklch(0.65 0.010 258)',
    }}>
      {dte}d
      {isRoll && !isUrgent && <span className="ml-1 text-[10px]">↻</span>}
      {isUrgent && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── Leg row ──────────────────────────────────────────────────────────────────

function LegRow({
  leg, strategy, stopLossAct, rollNeeded, dteTriage, belowSma200,
}: {
  leg: Position;
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number };
  stopLossAct: Set<string>;
  rollNeeded: Set<string>;
  dteTriage: number;
  belowSma200: Set<string>;
}) {
  const alerts = evaluatePositionLeg(leg, strategy, stopLossAct, rollNeeded, belowSma200);
  const hasAlert = alerts.length > 0;

  return (
    <tr
      className="border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]"
      style={{
        borderColor: 'oklch(1 0 0 / 6%)',
        background: hasAlert ? 'oklch(0.65 0.22 25 / 4%)' : 'transparent',
      }}
    >
      <td className="px-4 py-2.5">
        {leg.sec_type === 'OPT' ? (
          <span className="font-mono-data text-xs font-semibold px-1.5 py-0.5 rounded" style={{
            background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
            color: leg.right === 'C' ? GREEN : RED,
          }}>
            {leg.right} {leg.leg_direction === 'short' ? '↓' : '↑'}
          </span>
        ) : (
          <span className="font-mono-data text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 15%)', color: CYAN }}>
            STK
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: BRIGHT }}>
        {leg.strike > 0 ? `$${leg.strike.toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="font-mono-data text-xs" style={{ color: DIM }}>{leg.expiry ?? '—'}</div>
        <DteCell expiry={leg.expiry} rollDays={strategy.rollDteDays} dteTriage={dteTriage} />
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.qty > 0 ? GREEN : RED }}>
        {leg.qty > 0 ? '+' : ''}{leg.qty}
      </td>
      <td className="px-4 py-2.5 text-right">
        <DeltaCell delta={leg.current_delta} direction={leg.leg_direction} threshold={strategy.deltaAlertThreshold} />
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.current_theta != null ? (leg.current_theta >= 0 ? GREEN : RED) : DIM }}>
        {leg.current_theta != null ? `${leg.current_theta >= 0 ? '+' : '-'}$${Math.abs(leg.current_theta).toFixed(2)}/d` : '—'}
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.market_value >= 0 ? GREEN : RED }}>
        {formatDollar(leg.market_value)}
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: DIM }}>
        {leg.current_iv != null ? `${leg.current_iv.toFixed(0)}%` : '—'}
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{
        color: leg.net_liq_pct > strategy.maxSingleNamePct ? RED
          : leg.net_liq_pct > strategy.maxSingleNamePct * 0.8 ? AMBER
          : DIM,
      }}>
        {(leg.net_liq_pct ?? 0).toFixed(1)}%
      </td>
      <td className="px-4 py-2.5">
        {hasAlert ? (
          <div className="flex flex-col gap-0.5">
            {alerts.map((a, i) => (
              <span key={i} className="text-[10px]" style={{ color: AMBER }}>⚠ {a}</span>
            ))}
            {/* Auto-Roll shortcut for legs in roll window — pre-selects ticker in Trade Builder */}
            {alerts.some(a => a.includes('roll window')) && (
              <Link
                href="/trade-builder"
                onClick={() => sessionStorage.setItem('fortress_tradebuilder_ticker', leg.ticker)}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border mt-0.5 hover:opacity-80"
                style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
              >
                <Zap className="w-2.5 h-2.5" />
                Roll →
              </Link>
            )}
          </div>
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'oklch(0.72 0.18 145 / 60%)' }} />
        )}
      </td>
    </tr>
  );
}

// ─── Ticker group ─────────────────────────────────────────────────────────────

interface TickerGroupData {
  ticker: string;
  legs: Position[];
  totalMktVal: number;
  totalPctNL: number;
  netDelta: number;
  netTheta: number;
  alertCount: number;
  /** Simulated P&L series: market_value per leg over time (we use per-leg values as proxy) */
  pnlSeries: number[];
}

function TickerGroupCard({
  group, strategy, stopLossAct, rollNeeded, dteTriage, belowSma200,
}: {
  group: TickerGroupData;
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number };
  stopLossAct: Set<string>;
  rollNeeded: Set<string>;
  dteTriage: number;
  belowSma200: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const isConcentrated = group.totalPctNL > strategy.maxSingleNamePct;
  const hasAlerts = group.alertCount > 0;

  const pnlColor = group.totalMktVal >= 0 ? GREEN : RED;
  const PnLIcon = group.totalMktVal >= 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className="rounded border overflow-hidden"
      style={{
        borderColor: isConcentrated ? 'oklch(0.65 0.22 25 / 35%)'
          : hasAlerts ? 'oklch(0.78 0.18 85 / 30%)'
          : BORDER,
      }}
    >
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        style={{ background: 'oklch(0.20 0.010 258)' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} />
        }

        {/* Ticker */}
        <span className="font-display text-sm font-bold w-14" style={{ color: BRIGHT }}>
          {group.ticker}
        </span>
        <span className="text-xs" style={{ color: DIM }}>
          {group.legs.length} leg{group.legs.length !== 1 ? 's' : ''}
        </span>

        {/* Alert badge */}
        {hasAlerts && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background: 'oklch(0.78 0.18 85 / 12%)', color: AMBER }}>
            {group.alertCount} alert{group.alertCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Right side: sparkline + metrics */}
        <div className="ml-auto flex items-center gap-5">
          {/* P&L sparkline */}
          {group.pnlSeries.length >= 2 && (
            <PnLSparkline values={group.pnlSeries} color={pnlColor} />
          )}

          {/* Net delta */}
          <span className="font-mono-data text-xs" style={{ color: DIM }}>
            Net Δ:{' '}
            <span style={{ color: group.netDelta > 0 ? GREEN : RED }}>
              {group.netDelta > 0 ? '+' : ''}{group.netDelta.toFixed(3)}
            </span>
          </span>

          {/* Net theta */}
          {group.netTheta !== 0 && (
            <span className="font-mono-data text-xs" style={{ color: DIM }}>
              Θ:{' '}
              <span style={{ color: group.netTheta >= 0 ? GREEN : RED }}>
                ${group.netTheta.toFixed(2)}/d
              </span>
            </span>
          )}

          {/* Mkt Val */}
          <div className="flex items-center gap-1">
            <PnLIcon className="w-3 h-3" style={{ color: pnlColor }} />
            <span className="font-mono-data text-xs font-semibold" style={{ color: pnlColor }}>
              {formatDollar(group.totalMktVal)}
            </span>
          </div>

          {/* % NL */}
          <span className="font-mono-data text-xs font-semibold"
            style={{ color: isConcentrated ? RED : DIM }}>
            {group.totalPctNL.toFixed(1)}% NL
            {isConcentrated && <AlertTriangle className="inline w-3 h-3 ml-1" />}
          </span>

          {/* Trade Builder shortcut — pre-selects this ticker */}
          <Link
            href="/trade-builder"
            onClick={e => {
              e.stopPropagation();
              sessionStorage.setItem('fortress_tradebuilder_ticker', group.ticker);
            }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
            style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 25%)' }}
          >
            <Zap className="w-3 h-3" />
            Build
          </Link>
        </div>
      </button>

      {/* Expanded leg table + panels */}
      {expanded && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
                  {['Type', 'Strike', 'Expiry / DTE', 'Qty', 'Delta', 'Theta', 'Mkt Val', 'IV', '% NL', 'Alerts'].map(h => (
                    <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-right first:text-left last:text-left"
                      style={{ color: DIM }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.legs.map((leg, i) => (
                  <LegRow key={i} leg={leg} strategy={strategy} stopLossAct={stopLossAct} rollNeeded={rollNeeded} dteTriage={dteTriage} belowSma200={belowSma200} />
                ))}
              </tbody>
            </table>
          </div>
          <PositionLimitsBadge ticker={group.ticker} legs={group.legs} />
          <ForwardPnLPanel ticker={group.ticker} legs={group.legs} />
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { data, loading, error, refresh, lastUpdated } = usePositions();
  const { data: stopData } = useStopLossAll();
  const { data: rollData } = useRollAll();
  const { data: alertsData } = useAlerts();
  const { data: briefing } = useBriefing();
  const { config } = useConfig();

  const stopLossAct = useMemo(() => new Set(
    stopData?.positions.filter(p => p.verdict === 'ACT').map(p => p.synthesized_id) ?? []
  ), [stopData]);

  const rollNeeded = useMemo(() => new Set(
    rollData?.positions.filter(p => p.roll_needed).map(p => p.synthesized_id) ?? []
  ), [rollData]);

  // Technical violations: tickers trading below their 200-day SMA
  // Briefing actions array may contain objects with type 'below_sma200' and a ticker field
  // Derive below-SMA-200 tickers from the typed alerts API (source = 'below_sma200', not snoozed)
  const belowSma200 = useMemo(() => new Set<string>(
    (alertsData?.alerts ?? []).filter(a => a.source === 'below_sma200' && !a.snoozed).map(a => a.ticker)
  ), [alertsData]);

  const groups = useMemo<TickerGroupData[]>(() => {
    const positions = data?.positions ?? [];
    const byTicker = new Map<string, Position[]>();
    positions.forEach(p => {
      const arr = byTicker.get(p.ticker) ?? [];
      arr.push(p);
      byTicker.set(p.ticker, arr);
    });
    return Array.from(byTicker.entries()).map(([ticker, legs]) => {
      const totalMktVal = legs.reduce((s, l) => s + l.market_value, 0);
      const totalPctNL  = legs.reduce((s, l) => s + (l.net_liq_pct ?? 0), 0);
      const netDelta    = legs.reduce((s, l) => s + (l.current_delta ?? 0) * l.qty, 0);
      const netTheta    = legs.reduce((s, l) => s + (l.current_theta ?? 0) * l.qty, 0);
      const legAlertCount = legs.filter(l => evaluatePositionLeg(l, config.strategy, stopLossAct, rollNeeded, belowSma200).length > 0).length;
      const alertCount  = legAlertCount + (totalPctNL > config.strategy.maxSingleNamePct ? 1 : 0);
      // P&L sparkline: use per-leg market values as a rough proxy series
      const pnlSeries   = legs.map(l => l.market_value);
      return { ticker, legs, totalMktVal, totalPctNL, netDelta, netTheta, alertCount, pnlSeries };
    }).sort((a, b) => Math.abs(b.totalMktVal) - Math.abs(a.totalMktVal));
  }, [data, config.strategy, stopLossAct, rollNeeded, belowSma200]);

  const positions    = data?.positions ?? [];
  const totalMktVal  = positions.reduce((s, p) => s + p.market_value, 0);
  const alertCount   = groups.reduce((s, g) => s + g.alertCount, 0);

  // Portfolio Greeks from briefing (most accurate source)
  const greeks = briefing?.greeks;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Portfolio"
        subtitle="Layer 3 — Per-leg evaluation: delta, DTE, concentration, stop-loss"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      >
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold"
            style={{ color: AMBER, borderColor: 'oklch(0.78 0.18 85 / 40%)', background: 'oklch(0.78 0.18 85 / 10%)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {alertCount} alert{alertCount !== 1 ? 's' : ''}
          </div>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Summary stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Legs" value={positions.length.toString()} subValue={`${groups.length} tickers`} loading={loading} />
          <StatCard label="Total Mkt Value" value={loading ? '—' : formatDollar(totalMktVal)} signal={totalMktVal >= 0 ? 'green' : 'red'} loading={loading} />
          <StatCard label="Active Alerts" value={alertCount.toString()} signal={alertCount > 0 ? (alertCount > 3 ? 'red' : 'amber') : 'green'} loading={loading} />
          <StatCard label="Delta Threshold" value={`${config.strategy.deltaAlertThreshold}`} subValue={`Roll at ${config.strategy.rollDteDays}d DTE`} signal="cyan" />
        </div>

        {/* Portfolio Greeks bar */}
        {greeks && (
          <GreeksBar
            portfolioDelta={greeks.portfolio_delta}
            portfolioTheta={greeks.portfolio_theta}
            portfolioVega={greeks.portfolio_vega}
            betaWeightedDelta={greeks.beta_weighted_delta}
            positionsWithGreeks={greeks.positions_with_greeks}
            positionsTotal={greeks.positions_total}
          />
        )}

        {/* States */}
        {error && !loading && <EmptyState type="error" title="Failed to load positions" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading positions…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your API URL and token in Settings to load live positions." />}

        {/* Ticker groups */}
        {!loading && groups.length > 0 && (
          <div className="space-y-3">
            {groups.map(group => (
              <TickerGroupCard
                key={group.ticker}
                group={group}
                strategy={config.strategy}
                stopLossAct={stopLossAct}
                rollNeeded={rollNeeded}
                dteTriage={config.dteTriage ?? 7}
                belowSma200={belowSma200}
              />
            ))}
          </div>
        )}

        {!loading && !error && groups.length === 0 && config.apiToken && (
          <EmptyState type="empty" title="No positions found" description="Sync IBKR to load your current positions." />
        )}

        {/* Threshold legend */}
        <div className="rounded p-3 text-xs" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <span className="font-semibold" style={{ color: DIM }}>Active thresholds: </span>
          <span className="font-mono-data" style={{ color: 'oklch(0.50 0.010 258)' }}>
            Δ alert ≥ {config.strategy.deltaAlertThreshold} · Roll at ≤ {config.strategy.rollDteDays}d · Max single-name {config.strategy.maxSingleNamePct}% NL · Max sector {config.strategy.maxSectorPct}% NL
          </span>
        </div>
      </div>
    </div>
  );
}
