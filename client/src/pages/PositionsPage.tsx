/**
 * FORTRESS V2 — Positions Page
 * Layer 3: Position-level evaluation — stop-loss, delta breach, roll check, concentration.
 * Configurable thresholds from Settings. No hardcoded tickers.
 */

import { usePositions, formatDollar, calcDte, evaluateLeg, type Position, type PositionGroup } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

// ─── Delta cell ───────────────────────────────────────────────────────────────

function DeltaCell({ delta, qty, threshold }: { delta: number; qty: number; threshold: number }) {
  const isShort = qty < 0;
  const absDelta = Math.abs(delta);
  const isAlert = isShort && absDelta >= threshold;
  const isWarn = isShort && absDelta >= threshold * 0.85;

  return (
    <span
      className="font-mono-data text-xs"
      style={{
        color: isAlert
          ? 'oklch(0.65 0.22 25)'
          : isWarn
          ? 'oklch(0.78 0.18 85)'
          : delta > 0
          ? 'oklch(0.72 0.18 145)'
          : 'oklch(0.65 0.22 25)',
      }}
    >
      {delta > 0 ? '+' : ''}{delta.toFixed(3)}
      {isAlert && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── DTE cell ─────────────────────────────────────────────────────────────────

function DteCell({ expiry, rollDays }: { expiry: string; rollDays: number }) {
  const dte = calcDte(expiry);
  const isRoll = dte <= rollDays;
  const isUrgent = dte <= 7;

  return (
    <span
      className="font-mono-data text-xs"
      style={{
        color: isUrgent
          ? 'oklch(0.65 0.22 25)'
          : isRoll
          ? 'oklch(0.78 0.18 85)'
          : 'oklch(0.65 0.010 258)',
      }}
    >
      {dte}d
      {isRoll && !isUrgent && <span className="ml-1 text-[10px]">↻</span>}
      {isUrgent && <AlertTriangle className="inline w-3 h-3 ml-1" />}
    </span>
  );
}

// ─── Leg row ──────────────────────────────────────────────────────────────────

function LegRow({ leg, strategy }: { leg: Position; strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number } }) {
  const alerts = evaluateLeg(leg, strategy);
  const hasAlert = alerts.length > 0;

  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]',
        hasAlert ? 'bg-[oklch(0.65_0.22_25_/_4%)]' : '',
      )}
      style={{ borderColor: 'oklch(1 0 0 / 6%)' }}
    >
      {/* Right */}
      <td className="px-4 py-2.5">
        <span
          className="font-mono-data text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
            color: leg.right === 'C' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
          }}
        >
          {leg.right}
        </span>
      </td>

      {/* Strike */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: 'oklch(0.85 0.005 258)' }}>
        ${leg.strike.toLocaleString()}
      </td>

      {/* Expiry + DTE */}
      <td className="px-4 py-2.5">
        <div className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
          {leg.expiry}
        </div>
        <DteCell expiry={leg.expiry} rollDays={strategy.rollDteDays} />
      </td>

      {/* Qty */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.qty > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
        {leg.qty > 0 ? '+' : ''}{leg.qty}
      </td>

      {/* Delta */}
      <td className="px-4 py-2.5 text-right">
        <DeltaCell delta={leg.delta} qty={leg.qty} threshold={strategy.deltaAlertThreshold} />
      </td>

      {/* Mkt Val */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: leg.mkt_val >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
        {formatDollar(leg.mkt_val)}
      </td>

      {/* IV */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: 'oklch(0.65 0.010 258)' }}>
        {leg.iv !== undefined ? `${(leg.iv * 100).toFixed(0)}%` : '—'}
      </td>

      {/* % Net Liq */}
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{
        color: leg.pct_net_liq > strategy.maxSingleNamePct
          ? 'oklch(0.65 0.22 25)'
          : leg.pct_net_liq > strategy.maxSingleNamePct * 0.8
          ? 'oklch(0.78 0.18 85)'
          : 'oklch(0.65 0.010 258)',
      }}>
        {leg.pct_net_liq.toFixed(1)}%
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

function TickerGroup({ group, strategy }: { group: PositionGroup; strategy: { deltaAlertThreshold: number; rollDteDays: number; maxSingleNamePct: number } }) {
  const [expanded, setExpanded] = useState(true);
  const hasAlerts = group.alerts.length > 0;
  const isConcentrated = group.total_pct_net_liq > strategy.maxSingleNamePct;

  return (
    <div
      className="rounded border overflow-hidden"
      style={{
        borderColor: isConcentrated
          ? 'oklch(0.65 0.22 25 / 35%)'
          : hasAlerts
          ? 'oklch(0.78 0.18 85 / 30%)'
          : 'oklch(1 0 0 / 9%)',
      }}
    >
      {/* Group header */}
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
          {group.ticker}
        </span>

        <span className="text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
          {group.legs.length} leg{group.legs.length !== 1 ? 's' : ''}
        </span>

        <div className="ml-auto flex items-center gap-4">
          <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
            Net Δ: <span style={{ color: group.net_delta > 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
              {group.net_delta > 0 ? '+' : ''}{group.net_delta.toFixed(3)}
            </span>
          </span>
          <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
            MktVal: <span style={{ color: group.total_mkt_val >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
              {formatDollar(group.total_mkt_val)}
            </span>
          </span>
          <span
            className="font-mono-data text-xs font-semibold"
            style={{ color: isConcentrated ? 'oklch(0.65 0.22 25)' : 'oklch(0.65 0.010 258)' }}
          >
            {group.total_pct_net_liq.toFixed(1)}% NL
            {isConcentrated && <AlertTriangle className="inline w-3 h-3 ml-1" />}
          </span>
        </div>
      </button>

      {/* Legs table */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
                {['Right', 'Strike', 'Expiry / DTE', 'Qty', 'Delta', 'Mkt Val', 'IV', '% NL', 'Alerts'].map(h => (
                  <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-right first:text-left last:text-left"
                    style={{ color: 'oklch(0.50 0.010 258)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.legs.map(leg => (
                <LegRow key={leg.id} leg={leg} strategy={strategy} />
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
  const { config } = useConfig();

  const groups: PositionGroup[] = data?.groups ?? [];
  const positions: Position[] = data?.positions ?? [];

  const totalMktVal = positions.reduce((s, p) => s + p.mkt_val, 0);
  const alertCount = positions.filter(p => evaluateLeg(p, config.strategy).length > 0).length;

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
            style={{
              color: 'oklch(0.78 0.18 85)',
              borderColor: 'oklch(0.78 0.18 85 / 40%)',
              background: 'oklch(0.78 0.18 85 / 10%)',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {alertCount} alert{alertCount !== 1 ? 's' : ''}
          </div>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Total Positions"
            value={positions.length.toString()}
            subValue={`${groups.length} tickers`}
            loading={loading}
          />
          <StatCard
            label="Total Mkt Value"
            value={loading ? '—' : formatDollar(totalMktVal)}
            signal={totalMktVal >= 0 ? 'green' : 'red'}
            loading={loading}
          />
          <StatCard
            label="Active Alerts"
            value={alertCount.toString()}
            signal={alertCount > 0 ? (alertCount > 3 ? 'red' : 'amber') : 'green'}
            loading={loading}
          />
          <StatCard
            label="Delta Threshold"
            value={`${config.strategy.deltaAlertThreshold}`}
            subValue={`Roll at ${config.strategy.rollDteDays}d DTE`}
            signal="cyan"
          />
        </div>

        {/* Error state */}
        {error && !loading && (
          <EmptyState
            type="error"
            title="Failed to load positions"
            description={error}
          />
        )}

        {/* Loading state */}
        {loading && !data && (
          <EmptyState type="loading" title="Loading positions…" />
        )}

        {/* No config */}
        {!config.apiToken && !loading && (
          <EmptyState
            type="no-config"
            title="API token required"
            description="Configure your API URL and token in Settings to load live positions."
          />
        )}

        {/* Position groups */}
        {!loading && groups.length > 0 && (
          <div className="space-y-3">
            {groups.map(group => (
              <TickerGroup key={group.ticker} group={group} strategy={config.strategy} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && groups.length === 0 && config.apiToken && (
          <EmptyState
            type="empty"
            title="No positions found"
            description="Sync IBKR to load your current positions."
          />
        )}

        {/* Strategy thresholds reminder */}
        <div
          className="rounded p-3 text-xs"
          style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.65 0.010 258)' }}>
            Active thresholds:{' '}
          </span>
          <span className="font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
            Δ alert ≥ {config.strategy.deltaAlertThreshold} ·
            Roll at ≤ {config.strategy.rollDteDays}d ·
            Max single-name {config.strategy.maxSingleNamePct}% NL ·
            Max sector {config.strategy.maxSectorPct}% NL
          </span>
        </div>
      </div>
    </div>
  );
}
