/**
 * FORTRESS V2 — P&L Page
 * Computes unrealised P&L from /api/positions (avg_cost x qty x multiplier vs market_value).
 * No /api/pnl endpoint exists on the server — all calculations are client-side.
 *
 * Sorting: by ticker, P&L (abs or value), % return, DTE, qty
 * Filtering: by ticker, by side (long/short), by right (call/put), by P&L sign (winners/losers)
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
import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  dte: number | null;
}

type SortField = 'ticker' | 'pnl' | 'pnlPct' | 'dte' | 'qty' | 'marketValue';
type SortDir   = 'asc' | 'desc';
type FilterSide  = 'all' | 'long' | 'short';
type FilterRight = 'all' | 'C' | 'P';
type FilterPnL   = 'all' | 'winners' | 'losers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeLegPnL(pos: any): LegPnL {
  const qty        = Number(pos.qty ?? 0);
  // IBKR avg_cost for options is the TOTAL cost per contract (price × multiplier already included).
  // Do NOT multiply by multiplier again — that would inflate costBasis by 100×.
  // market_value = qty × avg_cost (backend already applies multiplier when syncing from IBKR).
  const avgCost    = Number(pos.avg_cost ?? 0);
  const marketValue = Number(pos.market_value ?? 0);
  // costBasis = avg_cost × |qty|  (avg_cost already includes the 100× option multiplier)
  const costBasis  = avgCost * Math.abs(qty);
  const isShort    = qty < 0;
  const unrealisedPnL = isShort ? costBasis + marketValue : marketValue - costBasis;
  const unrealisedPct = costBasis !== 0 ? (unrealisedPnL / Math.abs(costBasis)) * 100 : 0;
  const dte = pos.expiry ? Math.ceil((new Date(pos.expiry).getTime() - Date.now()) / 86400000) : null;
  return {
    ticker: pos.ticker ?? '',
    strategy: pos.strategy ?? 'UNTAGGED',
    localSymbol: pos.local_symbol ?? '',
    qty, avgCost, marketValue, costBasis, unrealisedPnL, unrealisedPct,
    expiry: pos.expiry ?? '',
    right: pos.right ?? '',
    strike: Number(pos.strike ?? 0),
    dte,
  };
}

function pnlColor(v: number) { return v >= 0 ? GREEN : RED; }

function fmt(v: number) {
  const abs = Math.abs(v);
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return v < 0 ? `-${s}` : `+${s}`;
}
function fmtPct(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3" style={{ color: CYAN }} />
    : <ArrowDown className="w-3 h-3" style={{ color: CYAN }} />;
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-mono-data text-xs px-2.5 py-1 rounded border transition-all"
      style={active ? {
        color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 50%)', background: 'oklch(0.80 0.15 200 / 12%)',
      } : {
        color: DIM, borderColor: 'oklch(1 0 0 / 12%)', background: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded border px-3 py-2 text-xs font-mono-data" style={{ background: 'oklch(0.15 0.010 258)', borderColor: 'oklch(1 0 0 / 15%)' }}>
      <div className="font-semibold mb-1" style={{ color: BRIGHT }}>{label}</div>
      <div style={{ color: pnlColor(val) }}>{fmt(val)} unrealised P&L</div>
    </div>
  );
}

// ─── Leg row// ─── Leg row ─────────────────────────────────────────────────────

function LegRow({ leg, onTriageClick, dteTriage }: { leg: LegPnL; onTriageClick: (ticker: string) => void; dteTriage: number }) {
  const isShort = leg.qty < 0;
  const isExpiringSoon = leg.dte !== null && leg.dte <= dteTriage;

  return (
    <div
      className={cn(
        'grid gap-3 items-center py-3 border-b text-xs transition-colors',
        isExpiringSoon ? 'hover:bg-[oklch(0.78_0.18_85_/_6%)] cursor-pointer' : 'hover:bg-[oklch(1_0_0_/_2%)]'
      )}
      style={{ gridTemplateColumns: '1fr 55px 80px 90px 70px 90px', borderColor: 'oklch(1 0 0 / 6%)' }}
      onClick={isExpiringSoon ? () => onTriageClick(leg.ticker) : undefined}
      title={isExpiringSoon ? `${leg.dte}d to expiry — click to open Analysis for ${leg.ticker}` : undefined}
    >
      {/* Leg description */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono-data font-semibold" style={{ color: BRIGHT }}>{leg.ticker}</span>
          {isExpiringSoon && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono-data font-bold animate-pulse"
              style={{ color: AMBER, background: 'oklch(0.78 0.18 85 / 15%)', border: '1px solid oklch(0.78 0.18 85 / 30%)' }}>
              <Zap className="w-2.5 h-2.5" /> TRIAGE
            </span>
          )}         <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: isShort ? 'oklch(0.65 0.22 25 / 12%)' : 'oklch(0.72 0.18 145 / 12%)', color: isShort ? RED : GREEN }}>
            {isShort ? 'SHORT' : 'LONG'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: leg.right === 'C' ? 'oklch(0.72 0.18 145 / 8%)' : 'oklch(0.65 0.22 25 / 8%)', color: leg.right === 'C' ? GREEN : RED }}>
            {leg.right === 'C' ? 'CALL' : leg.right === 'P' ? 'PUT' : leg.right}
          </span>
          <span className="font-mono-data" style={{ color: DIM }}>${leg.strike} · {leg.expiry}</span>
        </div>
        <div className="font-mono-data mt-0.5" style={{ color: 'oklch(0.42 0.010 258)', fontSize: '10px' }}>{leg.localSymbol}</div>
      </div>
      {/* DTE */}
      <div className="font-mono-data text-right" style={{ color: leg.dte !== null && leg.dte <= dteTriage ? AMBER : leg.dte !== null && leg.dte <= 21 ? 'oklch(0.78 0.15 85)' : DIM }}>
        {leg.dte !== null ? `${leg.dte}d` : '—'}
      </div>
      {/* Qty */}
      <div className="font-mono-data text-right" style={{ color: leg.qty > 0 ? GREEN : RED }}>
        {leg.qty > 0 ? '+' : ''}{leg.qty}
      </div>
      {/* Cost basis */}
      <div className="font-mono-data text-right" style={{ color: DIM }}>${Math.abs(leg.costBasis).toFixed(0)}</div>
      {/* Market value */}
      <div className="font-mono-data text-right" style={{ color: DIM }}>${leg.marketValue.toFixed(2)}</div>
      {/* P&L */}
      <div className="text-right">
        <div className="font-mono-data font-semibold" style={{ color: pnlColor(leg.unrealisedPnL) }}>{fmt(leg.unrealisedPnL)}</div>
        <div className="font-mono-data text-[10px]" style={{ color: pnlColor(leg.unrealisedPct), opacity: 0.7 }}>{fmtPct(leg.unrealisedPct)}</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PnLPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, loading, error, refresh, lastUpdated } = usePositions();
  const { config } = useConfig();
  const [, setLocation] = useLocation();

  // ── Sort state ──
  const [sortField, setSortField] = useState<SortField>('pnl');
  const [sortDir,   setSortDir]   = useState<SortDir>('asc');

  // ── Filter state ──
  const [filterTicker, setFilterTicker] = useState<string>('all');
  const [filterSide,   setFilterSide]   = useState<FilterSide>('all');
  const [filterRight,  setFilterRight]  = useState<FilterRight>('all');
  const [filterPnL,    setFilterPnL]    = useState<FilterPnL>('all');

  // ── DTE triage shortcut ──
  function handleTriageClick(ticker: string) {
    toast.info(`Opening Analysis for ${ticker}`, {
      description: `DTE ≤ ${config.dteTriage}d — navigating to Analysis tab with ${ticker} pre-selected`,
    });
    // Store triage ticker in sessionStorage so AnalysisPage can pick it up
    sessionStorage.setItem('fortress_triage_ticker', ticker);
    setLocation('/analysis');
  }

  const legs = useMemo<LegPnL[]>(() => {
    if (!data?.positions) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.positions as any[]).map(computeLegPnL);
  }, [data]);

  const tickers = useMemo(() => Array.from(new Set(legs.map(l => l.ticker))).sort(), [legs]);

  // ── Apply filters ──
  const filteredLegs = useMemo(() => {
    return legs.filter(l => {
      if (filterTicker !== 'all' && l.ticker !== filterTicker) return false;
      if (filterSide === 'long'  && l.qty < 0) return false;
      if (filterSide === 'short' && l.qty > 0) return false;
      if (filterRight !== 'all' && l.right !== filterRight) return false;
      if (filterPnL === 'winners' && l.unrealisedPnL <= 0) return false;
      if (filterPnL === 'losers'  && l.unrealisedPnL >= 0) return false;
      return true;
    });
  }, [legs, filterTicker, filterSide, filterRight, filterPnL]);

  // ── Apply sort ──
  const sortedLegs = useMemo(() => {
    const sorted = [...filteredLegs].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'ticker':      diff = a.ticker.localeCompare(b.ticker); break;
        case 'pnl':         diff = a.unrealisedPnL - b.unrealisedPnL; break;
        case 'pnlPct':      diff = a.unrealisedPct - b.unrealisedPct; break;
        case 'dte':         diff = (a.dte ?? 9999) - (b.dte ?? 9999); break;
        case 'qty':         diff = a.qty - b.qty; break;
        case 'marketValue': diff = a.marketValue - b.marketValue; break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [filteredLegs, sortField, sortDir]);

  // ── Group by ticker (for grouped view) ──
  const byTicker = useMemo(() => {
    const map = new Map<string, LegPnL[]>();
    legs.forEach(l => { if (!map.has(l.ticker)) map.set(l.ticker, []); map.get(l.ticker)!.push(l); });
    return Array.from(map.entries())
      .map(([ticker, tLegs]) => ({ ticker, legs: tLegs, total: tLegs.reduce((s, l) => s + l.unrealisedPnL, 0) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [legs]);

  const chartData = useMemo(() => byTicker.map(({ ticker, total }) => ({ ticker, pnl: Math.round(total) })), [byTicker]);

  const totalUnrealised = useMemo(() => legs.reduce((s, l) => s + l.unrealisedPnL, 0), [legs]);
  const totalCostBasis  = useMemo(() => legs.reduce((s, l) => s + Math.abs(l.costBasis), 0), [legs]);
  const totalPct        = totalCostBasis > 0 ? (totalUnrealised / totalCostBasis) * 100 : 0;
  const winners         = legs.filter(l => l.unrealisedPnL > 0).length;
  const losers          = legs.filter(l => l.unrealisedPnL < 0).length;
  const best  = byTicker.length ? byTicker.reduce((a, b) => b.total > a.total ? b : a) : null;
  const worst = byTicker.length ? byTicker.reduce((a, b) => b.total < a.total ? b : a) : null;

  // ── Sort toggle ──
  function handleSort(field: SortField) {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const activeFilters = [filterTicker !== 'all', filterSide !== 'all', filterRight !== 'all', filterPnL !== 'all'].filter(Boolean).length;

  function clearFilters() {
    setFilterTicker('all');
    setFilterSide('all');
    setFilterRight('all');
    setFilterPnL('all');
  }

  const colHeader = (label: string, field: SortField) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      style={{ color: sortField === field ? CYAN : 'oklch(0.42 0.010 258)' }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded && <PageHeader title="P&L" subtitle="Unrealised profit &amp; loss — computed from avg_cost vs market_value per leg" lastUpdated={lastUpdated} onRefresh={refresh} refreshing={loading} />}
      <div className="p-6 space-y-6">

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Unrealised P&L" value={loading ? '—' : fmt(totalUnrealised)} signal={totalUnrealised >= 0 ? 'green' : 'red'} loading={loading} />
          <StatCard label="Return on Premium"    value={loading ? '—' : fmtPct(totalPct)}      signal={totalPct >= 0 ? 'green' : 'red'}      loading={loading} />
          <StatCard label="Winners / Losers"     value={loading ? '—' : `${winners} / ${losers}`} signal={winners >= losers ? 'green' : 'red'} loading={loading} />
          <StatCard label="Total Legs"           value={loading ? '—' : legs.length.toString()} signal="cyan" loading={loading} />
        </div>

        {error && !loading && <EmptyState type="error" title="Failed to load positions" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading positions…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your token in Settings." />}

        {!loading && legs.length > 0 && (
          <>
            {/* ── Chart ── */}
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

            {/* ── Best / Worst ── */}
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

            {/* ── Filter & Sort controls ── */}
            <div className="rounded border p-4 space-y-3" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" style={{ color: activeFilters > 0 ? CYAN : DIM }} />
                  <span className="font-display text-xs font-bold" style={{ color: BRIGHT }}>Filter &amp; Sort</span>
                  {activeFilters > 0 && (
                    <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 15%)', color: CYAN }}>
                      {activeFilters} active
                    </span>
                  )}
                </div>
                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity" style={{ color: DIM }}>
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              {/* Ticker filter */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.42 0.010 258)' }}>Ticker</div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip label="All" active={filterTicker === 'all'} onClick={() => setFilterTicker('all')} />
                  {tickers.map(t => (
                    <FilterChip key={t} label={t} active={filterTicker === t} onClick={() => setFilterTicker(t)} />
                  ))}
                </div>
              </div>

              {/* Side filter */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.42 0.010 258)' }}>Side</div>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'long', 'short'] as FilterSide[]).map(s => (
                    <FilterChip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={filterSide === s} onClick={() => setFilterSide(s)} />
                  ))}
                </div>
              </div>

              {/* Right filter */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.42 0.010 258)' }}>Option Type</div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip label="All" active={filterRight === 'all'} onClick={() => setFilterRight('all')} />
                  <FilterChip label="Calls" active={filterRight === 'C'} onClick={() => setFilterRight('C')} />
                  <FilterChip label="Puts"  active={filterRight === 'P'} onClick={() => setFilterRight('P')} />
                </div>
              </div>

              {/* P&L filter */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.42 0.010 258)' }}>P&amp;L</div>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip label="All"     active={filterPnL === 'all'}     onClick={() => setFilterPnL('all')} />
                  <FilterChip label="Winners" active={filterPnL === 'winners'} onClick={() => setFilterPnL('winners')} />
                  <FilterChip label="Losers"  active={filterPnL === 'losers'}  onClick={() => setFilterPnL('losers')} />
                </div>
              </div>
            </div>

            {/* ── Sortable flat table ── */}
            <div className="rounded border overflow-hidden" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
              {/* Header */}
              <div className="grid gap-3 px-4 py-3 border-b" style={{ gridTemplateColumns: '1fr 55px 80px 90px 70px 90px', borderColor: 'oklch(1 0 0 / 8%)', background: 'oklch(0.20 0.010 258)' }}>
                <div>{colHeader('Leg', 'ticker')}</div>
                <div className="flex justify-end">{colHeader('DTE', 'dte')}</div>
                <div className="flex justify-end">{colHeader('Qty', 'qty')}</div>
                <div className="flex justify-end">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.42 0.010 258)' }}>Cost Basis</span>
                </div>
                <div className="flex justify-end">{colHeader('Mkt Val', 'marketValue')}</div>
                <div className="flex justify-end">{colHeader('P&L', 'pnl')}</div>
              </div>

              {/* Rows */}
              {sortedLegs.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs" style={{ color: DIM }}>
                  No positions match the current filters.
                </div>
              ) : (
                <div className="px-4">
                  {sortedLegs.map((leg, i) => <LegRow key={i} leg={leg} onTriageClick={handleTriageClick} dteTriage={config.dteTriage ?? 7} />)}
                </div>
              )}

              {/* Footer summary */}
              {sortedLegs.length > 0 && (
                <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'oklch(1 0 0 / 8%)', background: 'oklch(0.20 0.010 258)' }}>
                  <span className="font-mono-data text-xs" style={{ color: DIM }}>
                    {sortedLegs.length} of {legs.length} legs
                    {activeFilters > 0 ? ` (${activeFilters} filter${activeFilters > 1 ? 's' : ''} active)` : ''}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono-data text-xs" style={{ color: DIM }}>
                      Filtered total:
                    </span>
                    <span className="font-mono-data text-sm font-semibold" style={{ color: pnlColor(sortedLegs.reduce((s, l) => s + l.unrealisedPnL, 0)) }}>
                      {fmt(sortedLegs.reduce((s, l) => s + l.unrealisedPnL, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Data source note ── */}
            <div className="rounded p-3 text-xs" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}>
              <span className="font-semibold" style={{ color: CYAN }}>Data source: </span>
              <span style={{ color: DIM }}>
                Unrealised P&amp;L = (avg_cost × |qty| × multiplier) + market_value for short legs, or market_value − cost_basis for long legs.
                Computed from <code className="font-mono-data" style={{ color: 'oklch(0.70 0.010 258)' }}>/api/positions</code>.
                Realised P&amp;L (closed trades) is not yet available via the API.
              </span>
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
