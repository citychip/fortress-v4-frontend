/**
 * FORTRESS V2 — Positions Page
 * Layer 3: Position-level evaluation — stop-loss, delta breach, roll check, concentration.
 * Uses /api/positions (flat list) + /api/manage/stop_loss_all + /api/manage/roll_all.
 */

import {
  usePositions, useStopLossAll, useRollAll,
  formatDollar, calcDte,
  type Position,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evaluatePositionLeg(
  leg: Position,
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number },
  stopLossAct: Set<string>,
  rollNeeded: Set<string>,
): string[] {
  const alerts: string[] = [];
  const id = leg.local_symbol;

  if (stopLossAct.has(id)) alerts.push('Stop-loss signal active');

  if (rollNeeded.has(id)) alerts.push('Roll candidate');

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
    alerts.push(`${leg.net_liq_pct.toFixed(1)}% NL > ${strategy.maxSingleNamePct}% limit`);
  }

  return alerts;
}

// ─── Delta cell ───────────────────────────────────────────────────────────────

function DeltaCell({ delta, direction, threshold }: { delta: number | null; direction: string; threshold: number }) {
  if (delta === null) return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  const isShort = direction === 'short';
  const absDelta = Math.abs(delta);
  const isAlert = isShort && absDelta >= threshold;
  const isWarn = isShort && absDelta >= threshold * 0.85;

  return (
    <span
      className="font-mono-data text-xs"
      style={{
        color: isAlert ? 'oklch(0.65 0.22 25)' : isWarn ? 'oklch(0.78 0.18 85)' : delta > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
      }}
    >
      {delta > 0 ? '+' : ''}{delta.toFixed(3)}
      {isAlert && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── DTE cell ─────────────────────────────────────────────────────────────────

function DteCell({ expiry, rollDays, dteTriage }: { expiry: string | null; rollDays: number; dteTriage: number }) {
  if (!expiry) return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  const dte = calcDte(expiry);
  const isRoll = dte <= rollDays;
  const isUrgent = dte <= dteTriage;

  return (
    <span
      className="font-mono-data text-xs"
      style={{ color: isUrgent ? 'oklch(0.65 0.22 25)' : isRoll ? 'oklch(0.78 0.18 85)' : 'oklch(0.65 0.010 258)' }}
    >
      {dte}d
      {isRoll && !isUrgent && <span className="ml-1 text-[10px]">↻</span>}
      {isUrgent && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── Leg row ──────────────────────────────────────────────────────────────────

function LegRow({
  leg, strategy, stopLossAct, rollNeeded, dteTriage,
}: {
  leg: Position;
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number };
  stopLossAct: Set<string>;
  rollNeeded: Set<string>;
  dteTriage: number;
}) {
  const alerts = evaluatePositionLeg(leg, strategy, stopLossAct, rollNeeded);
  const hasAlert = alerts.length > 0;

  return (
    <tr
      className="border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]"
      style={{
        borderColor: 'oklch(1 0 0 / 6%)',
        background: hasAlert ? 'oklch(0.65 0.22 25 / 4%)' : 'transparent',
      }}
    >
      {/* Type */}
      <td className="px-4 py-2.5">
        {leg.sec_type === 'OPT' ? (
          <span
            className="font-mono-data text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
              color: leg.right === 'C' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
            }}
          >
            {leg.right} {leg.leg_direction === 'short' ? '↓' : '↑'}
          </span>
        ) : (
          <span className="font-mono-data text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 15%)', color: 'oklch(0.80 0.15 200)' }}>
            STK
          </span>
        )}
      </td>

      {/* Strike */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: 'oklch(0.85 0.005 258)' }}>
        {leg.strike > 0 ? `$${leg.strike.toLocaleString()}` : '—'}
      </td>

      {/* Expiry + DTE */}
      <td className="px-4 py-2.5">
        <div className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
          {leg.expiry ?? '—'}
        </div>
        <DteCell expiry={leg.expiry} rollDays={strategy.rollDteDays} dteTriage={dteTriage} />
      </td>

      {/* Qty */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.qty > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
        {leg.qty > 0 ? '+' : ''}{leg.qty}
      </td>

      {/* Delta */}
      <td className="px-4 py-2.5 text-right">
        <DeltaCell delta={leg.current_delta} direction={leg.leg_direction} threshold={strategy.deltaAlertThreshold} />
      </td>

      {/* Mkt Val */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.market_value >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
        {formatDollar(leg.market_value)}
      </td>

      {/* IV */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: 'oklch(0.65 0.010 258)' }}>
        {leg.current_iv !== undefined ? `${leg.current_iv.toFixed(0)}%` : '—'}
      </td>

      {/* % Net Liq */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{
        color: leg.net_liq_pct > strategy.maxSingleNamePct
          ? 'oklch(0.65 0.22 25)'
          : leg.net_liq_pct > strategy.maxSingleNamePct * 0.8
          ? 'oklch(0.78 0.18 85)'
          : 'oklch(0.65 0.010 258)',
      }}>
        {leg.net_liq_pct.toFixed(1)}%
      </td>

      {/* Alerts */}
      <td className="px-4 py-2.5">
        {hasAlert ? (
          <div className="flex flex-col gap-0.5">
            {alerts.map((a, i) => (
              <span key={i} className="text-[10px]" style={{ color: 'oklch(0.78 0.18 85)' }}>
                ⚠ {a}
              </span>
            ))}
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
  alertCount: number;
}

function TickerGroupCard({
  group, strategy, stopLossAct, rollNeeded, dteTriage,
}: {
  group: TickerGroupData;
  strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number };
  stopLossAct: Set<string>;
  rollNeeded: Set<string>;
  dteTriage: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isConcentrated = group.totalPctNL > strategy.maxSingleNamePct;
  const hasAlerts = group.alertCount > 0;

  return (
    <div
      className="rounded border overflow-hidden"
      style={{
        borderColor: isConcentrated ? 'oklch(0.65 0.22 25 / 35%)' : hasAlerts ? 'oklch(0.78 0.18 85 / 30%)' : 'oklch(1 0 0 / 9%)',
      }}
    >
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
          {group.ticker}
        </span>
        <span className="text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
          {group.legs.length} leg{group.legs.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
            Net Δ:{' '}
            <span style={{ color: group.netDelta > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
              {group.netDelta > 0 ? '+' : ''}{group.netDelta.toFixed(3)}
            </span>
          </span>
          <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
            MktVal:{' '}
            <span style={{ color: group.totalMktVal >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
              {formatDollar(group.totalMktVal)}
            </span>
          </span>
          <span
            className="font-mono-data text-xs font-semibold"
            style={{ color: isConcentrated ? 'oklch(0.65 0.22 25)' : 'oklch(0.65 0.010 258)' }}
          >
            {group.totalPctNL.toFixed(1)}% NL
            {isConcentrated && <AlertTriangle className="inline w-3 h-3 ml-1" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
                {['Type', 'Strike', 'Expiry / DTE', 'Qty', 'Delta', 'Mkt Val', 'IV', '% NL', 'Alerts'].map(h => (
                  <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-right first:text-left last:text-left"
                    style={{ color: 'oklch(0.50 0.010 258)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.legs.map((leg, i) => (
                <LegRow key={i} leg={leg} strategy={strategy} stopLossAct={stopLossAct} rollNeeded={rollNeeded} dteTriage={dteTriage} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { data, loading, error, refresh, lastUpdated } = usePositions();
  const { data: stopData } = useStopLossAll();
  const { data: rollData } = useRollAll();
  const { config } = useConfig();

  // Build sets of position IDs that have active stop-loss / roll signals
  const stopLossAct = useMemo(() => new Set(
    stopData?.positions.filter(p => p.verdict === 'ACT').map(p => p.synthesized_id) ?? []
  ), [stopData]);

  const rollNeeded = useMemo(() => new Set(
    rollData?.positions.filter(p => p.roll_needed).map(p => p.synthesized_id) ?? []
  ), [rollData]);

  // Group positions by ticker client-side
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
      const totalPctNL = legs.reduce((s, l) => s + l.net_liq_pct, 0);
      const netDelta = legs.reduce((s, l) => s + (l.current_delta ?? 0) * l.qty, 0);
      const alertCount = legs.filter(l => evaluatePositionLeg(l, config.strategy, stopLossAct, rollNeeded).length > 0).length;
      return { ticker, legs, totalMktVal, totalPctNL, netDelta, alertCount };
    }).sort((a, b) => Math.abs(b.totalMktVal) - Math.abs(a.totalMktVal));
  }, [data, config.strategy, stopLossAct, rollNeeded]);

  const positions = data?.positions ?? [];
  const totalMktVal = positions.reduce((s, p) => s + p.market_value, 0);
  const alertCount = groups.reduce((s, g) => s + g.alertCount, 0);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Positions"
        subtitle="Layer 3 — Per-leg evaluation: delta, DTE, concentration, stop-loss"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      >
        {alertCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold"
            style={{ color: 'oklch(0.78 0.18 85)', borderColor: 'oklch(0.78 0.18 85 / 40%)', background: 'oklch(0.78 0.18 85 / 10%)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {alertCount} alert{alertCount !== 1 ? 's' : ''}
          </div>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Legs" value={positions.length.toString()} subValue={`${groups.length} tickers`} loading={loading} />
          <StatCard label="Total Mkt Value" value={loading ? '—' : formatDollar(totalMktVal)} signal={totalMktVal >= 0 ? 'green' : 'red'} loading={loading} />
          <StatCard label="Active Alerts" value={alertCount.toString()} signal={alertCount > 0 ? (alertCount > 3 ? 'red' : 'amber') : 'green'} loading={loading} />
          <StatCard label="Delta Threshold" value={`${config.strategy.deltaAlertThreshold}`} subValue={`Roll at ${config.strategy.rollDteDays}d DTE`} signal="cyan" />
        </div>

        {error && !loading && <EmptyState type="error" title="Failed to load positions" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading positions…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your API URL and token in Settings to load live positions." />}

        {!loading && groups.length > 0 && (
          <div className="space-y-3">
            {groups.map(group => (
              <TickerGroupCard key={group.ticker} group={group} strategy={config.strategy} stopLossAct={stopLossAct} rollNeeded={rollNeeded} dteTriage={config.dteTriage ?? 7} />
            ))}
          </div>
        )}

        {!loading && !error && groups.length === 0 && config.apiToken && (
          <EmptyState type="empty" title="No positions found" description="Sync IBKR to load your current positions." />
        )}

        <div className="rounded p-3 text-xs" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}>
          <span className="font-semibold" style={{ color: 'oklch(0.65 0.010 258)' }}>Active thresholds: </span>
          <span className="font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
            Δ alert ≥ {config.strategy.deltaAlertThreshold} · Roll at ≤ {config.strategy.rollDteDays}d · Max single-name {config.strategy.maxSingleNamePct}% NL · Max sector {config.strategy.maxSectorPct}% NL
          </span>
        </div>
      </div>
    </div>
  );
}
