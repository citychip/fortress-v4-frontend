/**
 * FORTRESS V2 — P&L Page
 * Computes unrealised P&L from /api/positions (avg_cost x qty x multiplier vs market_value).
 * No /api/pnl endpoint exists on the server — all calculations are client-side.
 */

import { usePositions } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { useConfig } from '@/contexts/ConfigContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, CartesianGrid,
} from 'recharts';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

interface LegPnL {
  ticker: string;
  strategy: string;
  localSymbol: string;
  qty: number;
  avgCost: number;
  marketValue: number;
  costBasis: number;
  unrealisedPnL: number;
  unrealisedPct: number;
  expiry: string;
  right: string;
  strike: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeLegPnL(pos: any): LegPnL {
  const qty = Number(pos.qty ?? 0);
  const multiplier = Number(pos.multiplier ?? 100);
  const avgCost = Number(pos.avg_cost ?? 0);
  const marketValue = Number(pos.market_value ?? 0);
  const costBasis = avgCost * Math.abs(qty) * multiplier;
  const isShort = qty < 0;
  const unrealisedPnL = isShort ? costBasis + marketValue : marketValue - costBasis;
  const unrealisedPct = costBasis !== 0 ? (unrealisedPnL / Math.abs(costBasis)) * 100 : 0;
  return {
    ticker: pos.ticker ?? '',
    strategy: pos.strategy ?? 'UNTAGGED',
    localSymbol: pos.local_symbol ?? '',
    qty, avgCost, marketValue, costBasis, unrealisedPnL, unrealisedPct,
    expiry: pos.expiry ?? '',
    right: pos.right ?? '',
    strike: Number(pos.strike ?? 0),
  };
}

function pnlColor(v: number) { return v >= 0 ? GREEN : RED; }
function fmt(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return v < 0 ? `-${s}` : `+${s}`;
}
function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded border px-3 py-2 text-xs font-mono-data" style={{ background: 'oklch(0.15 0.010 258)', borderColor: 'oklch(1 0 0 / 15%)' }}>
      <div className="font-semibold mb-1" style={{ color: BRIGHT }}>{label}</div>
      <div style={{ color: pnlColor(val) }}>{fmt(val)} unrealised P&amp;L</div>
    </div>
  );
}

function LegRow({ leg }: { leg: LegPnL }) {
  const isShort = leg.qty < 0;
  const dte = useMemo(() => {
    if (!leg.expiry) return null;
    const diff = new Date(leg.expiry).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  }, [leg.expiry]);

  return (
    <div className="grid gap-3 items-center py-3 border-b text-xs" style={{ gridTemplateColumns: '1fr 60px 80px 90px 90px', borderColor: 'oklch(1 0 0 / 6%)' }}>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono-data font-semibold" style={{ color: BRIGHT }}>{leg.ticker}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: isShort ? 'oklch(0.65 0.22 25 / 12%)' : 'oklch(0.72 0.18 145 / 12%)', color: isShort ? RED : GREEN }}>
            {isShort ? 'SHORT' : 'LONG'}
          </span>
          <span className="font-mono-data" style={{ color: DIM }}>${leg.strike} {leg.right === 'P' ? 'Put' : 'Call'} {leg.expiry}</span>
          {dte !== null && <span className="font-mono-data" style={{ color: dte <= 7 ? AMBER : DIM }}>{dte}d</span>}
        </div>
      </div>
      <div className="font-mono-data text-right" style={{ color: DIM }}>{leg.qty > 0 ? '+' : ''}{leg.qty}</div>
      <div className="font-mono-data text-right" style={{ color: DIM }}>${Math.abs(leg.costBasis).toFixed(0)}</div>
      <div className="font-mono-data text-right" style={{ color: DIM }}>${leg.marketValue.toFixed(2)}</div>
      <div className="text-right">
        <div className="font-mono-data font-semibold" style={{ color: pnlColor(leg.unrealisedPnL) }}>{fmt(leg.unrealisedPnL)}</div>
        <div className="font-mono-data text-[10px]" style={{ color: pnlColor(leg.unrealisedPct), opacity: 0.7 }}>{fmtPct(leg.unrealisedPct)}</div>
      </div>
    </div>
  );
}

function TickerGroup({ ticker, legs }: { ticker: string; legs: LegPnL[] }) {
  const totalPnL = legs.reduce((s, l) => s + l.unrealisedPnL, 0);
  const totalCost = legs.reduce((s, l) => s + Math.abs(l.costBasis), 0);
  const totalPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  return (
    <div className="rounded border overflow-hidden" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{ticker}</span>
          <span className="text-xs font-mono-data" style={{ color: DIM }}>{legs.length} leg{legs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono-data text-sm font-semibold" style={{ color: pnlColor(totalPnL) }}>{fmt(totalPnL)}</span>
          <span className="font-mono-data text-xs" style={{ color: pnlColor(totalPct), opacity: 0.8 }}>{fmtPct(totalPct)}</span>
        </div>
      </div>
      <div className="grid gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ gridTemplateColumns: '1fr 60px 80px 90px 90px', borderColor: 'oklch(1 0 0 / 6%)', color: 'oklch(0.42 0.010 258)' }}>
        <span>Leg</span><span className="text-right">Qty</span><span className="text-right">Cost Basis</span><span className="text-right">Mkt Value</span><span className="text-right">Unrealised P&amp;L</span>
      </div>
      <div className="px-4">{legs.map((leg, i) => <LegRow key={i} leg={leg} />)}</div>
    </div>
  );
}

export default function PnLPage() {
  const { data, loading, error, refresh, lastUpdated } = usePositions();
  const { config } = useConfig();

  const legs = useMemo<LegPnL[]>(() => {
    if (!data?.positions) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.positions as any[]).map(computeLegPnL);
  }, [data]);

  const totalUnrealised = useMemo(() => legs.reduce((s, l) => s + l.unrealisedPnL, 0), [legs]);
  const totalCostBasis  = useMemo(() => legs.reduce((s, l) => s + Math.abs(l.costBasis), 0), [legs]);
  const totalPct        = totalCostBasis > 0 ? (totalUnrealised / totalCostBasis) * 100 : 0;
  const winners         = legs.filter(l => l.unrealisedPnL > 0).length;
  const losers          = legs.filter(l => l.unrealisedPnL < 0).length;

  const byTicker = useMemo(() => {
    const map = new Map<string, LegPnL[]>();
    legs.forEach(l => { if (!map.has(l.ticker)) map.set(l.ticker, []); map.get(l.ticker)!.push(l); });
    return Array.from(map.entries())
      .map(([ticker, legs]) => ({ ticker, legs, total: legs.reduce((s, l) => s + l.unrealisedPnL, 0) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [legs]);

  const chartData = useMemo(() => byTicker.map(({ ticker, total }) => ({ ticker, pnl: Math.round(total) })), [byTicker]);
  const best  = byTicker.length ? byTicker.reduce((a, b) => b.total > a.total ? b : a) : null;
  const worst = byTicker.length ? byTicker.reduce((a, b) => b.total < a.total ? b : a) : null;

  return (
    <div className="min-h-screen">
      <PageHeader title="P&L" subtitle="Unrealised profit &amp; loss — computed from avg_cost vs market_value per leg" lastUpdated={lastUpdated} onRefresh={refresh} refreshing={loading} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Unrealised P&L" value={loading ? '—' : fmt(totalUnrealised)} signal={totalUnrealised >= 0 ? 'green' : 'red'} loading={loading} />
          <StatCard label="Return on Premium" value={loading ? '—' : fmtPct(totalPct)} signal={totalPct >= 0 ? 'green' : 'red'} loading={loading} />
          <StatCard label="Winners / Losers" value={loading ? '—' : `${winners} / ${losers}`} signal={winners >= losers ? 'green' : 'red'} loading={loading} />
          <StatCard label="Total Legs" value={loading ? '—' : legs.length.toString()} signal="cyan" loading={loading} />
        </div>

        {error && !loading && <EmptyState type="error" title="Failed to load positions" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading positions…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your token in Settings." />}

        {!loading && legs.length > 0 && (
          <>
            <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-sm font-bold" style={{ color: BRIGHT }}>Unrealised P&amp;L by Ticker</h2>
                <div className="flex items-center gap-4 text-xs font-mono-data">
                  <span style={{ color: GREEN }}>&#9632; Profit</span>
                  <span style={{ color: RED }}>&#9632; Loss</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 5%)" />
                  <XAxis dataKey="ticker" tick={{ fill: 'oklch(0.55 0.010 258)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'oklch(0.45 0.010 258)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? GREEN : RED} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {best && worst && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border p-4 flex items-center gap-3" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(0.72 0.18 145 / 20%)' }}>
                  <TrendingUp className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>Best Position</div>
                    <div className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{best.ticker}</div>
                    <div className="font-mono-data text-sm font-semibold" style={{ color: GREEN }}>{fmt(best.total)}</div>
                  </div>
                </div>
                <div className="rounded border p-4 flex items-center gap-3" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(0.65 0.22 25 / 20%)' }}>
                  <TrendingDown className="w-5 h-5 flex-shrink-0" style={{ color: RED }} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>Worst Position</div>
                    <div className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{worst.ticker}</div>
                    <div className="font-mono-data text-sm font-semibold" style={{ color: RED }}>{fmt(worst.total)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded p-3 text-xs" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}>
              <span className="font-semibold" style={{ color: CYAN }}>Data source: </span>
              <span style={{ color: DIM }}>
                Unrealised P&amp;L = (avg_cost x |qty| x multiplier) + market_value for short legs, or market_value - cost_basis for long legs.
                Computed from <code className="font-mono-data" style={{ color: 'oklch(0.70 0.010 258)' }}>/api/positions</code>.
                Realised P&amp;L (closed trades) is not yet available via the API.
              </span>
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-sm font-bold" style={{ color: BRIGHT }}>Position Detail</h2>
              {byTicker.map(({ ticker, legs }) => <TickerGroup key={ticker} ticker={ticker} legs={legs} />)}
            </div>
          </>
        )}

        {!loading && legs.length === 0 && data && (
          <EmptyState type="empty" title="No positions" description="No open positions found." />
        )}
      </div>
    </div>
  );
}
