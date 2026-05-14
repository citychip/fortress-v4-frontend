/**
 * FORTRESS V2 — Candidates Page
 * IV rank screener: surfaces new short-premium entry opportunities.
 * Uses /api/candidates → CandidatesResponse.rows (CandidateRow[]).
 *
 * Fields from server:
 *   ivr          = IV rank 0–100
 *   current_iv   = current IV %
 *   hv20         = 20-day HV %
 *   spread_pp    = IV - HV spread in percentage points
 *   price        = current price
 *   signal       = server-side signal string
 *   can_trade    = boolean
 */

import { useState, useMemo } from 'react';
import {
  useCandidates,
  evaluateCandidate,
  type CandidateRow,
  type EntrySignal,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal, label, color, pulse }: { signal: EntrySignal; label: string; color: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono-data border',
        pulse && 'animate-pulse',
      )}
      style={{ color, borderColor: `${color.replace(')', ' / 35%)')}`, background: `${color.replace(')', ' / 10%)')}` }}
    >
      {signal === 'STRONG_SELL' && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />}
      {label}
    </span>
  );
}

// ─── IV rank bar ──────────────────────────────────────────────────────────────

function IvRankBar({ value, threshold }: { value: number | undefined; threshold: number }) {
  if (value === undefined || value === null) {
    return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  }
  const pct = Math.min(100, Math.max(0, value));
  const barColor = pct >= 80 ? 'oklch(0.65 0.22 25)' : pct >= threshold ? 'oklch(0.78 0.18 85)' : 'oklch(0.55 0.010 258)';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="font-mono-data text-xs w-8 text-right" style={{ color: pct >= threshold ? barColor : 'oklch(0.65 0.010 258)' }}>
        {pct.toFixed(0)}
      </span>
    </div>
  );
}

// ─── IV vs HV spread cell ─────────────────────────────────────────────────────

function IvHvCell({ iv, hv, spreadPp, threshold }: { iv: number; hv: number; spreadPp: number; threshold: number }) {
  const spreadColor = spreadPp >= threshold * 2
    ? 'oklch(0.65 0.22 25)'
    : spreadPp >= threshold
    ? 'oklch(0.78 0.18 85)'
    : spreadPp > 0
    ? 'oklch(0.72 0.18 145)'
    : 'oklch(0.55 0.010 258)';

  return (
    <div className="text-right">
      <div className="font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>
        {iv.toFixed(1)}% <span style={{ color: 'oklch(0.45 0.010 258)' }}>/ {hv.toFixed(1)}%</span>
      </div>
      <div className="font-mono-data text-[10px]" style={{ color: spreadColor }}>
        {spreadPp >= 0 ? '+' : ''}{spreadPp.toFixed(1)}pp spread
      </div>
    </div>
  );
}

// ─── Sort control ─────────────────────────────────────────────────────────────

type SortKey = 'ticker' | 'iv_rank' | 'iv' | 'hv' | 'spread' | 'signal' | 'dte';

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none text-right first:text-left hover:opacity-80 transition-opacity"
      style={{ color: active ? 'oklch(0.80 0.15 200)' : 'oklch(0.50 0.010 258)' }}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end first:justify-start">
        {label}
        {active
          ? dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3 opacity-30" />
        }
      </span>
    </th>
  );
}

// ─── Candidate row ────────────────────────────────────────────────────────────

function CandidateRowItem({
  candidate, ivRankThreshold, ivHvSpreadThreshold,
}: {
  candidate: CandidateRow; ivRankThreshold: number; ivHvSpreadThreshold: number;
}) {
  const evaluation = evaluateCandidate(candidate, ivRankThreshold, ivHvSpreadThreshold);
  const isActionable = evaluation.signal === 'STRONG_SELL' || evaluation.signal === 'SELL';

  return (
    <tr
      className={cn('border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]', isActionable && 'bg-[oklch(0.78_0.18_85_/_3%)]')}
      style={{ borderColor: 'oklch(1 0 0 / 6%)' }}
    >
      {/* Ticker */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
            {candidate.ticker}
          </span>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${candidate.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-40 hover:opacity-80 transition-opacity"
            style={{ color: 'oklch(0.80 0.15 200)' }}
            title="Open in TradingView"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {candidate.earnings_state && candidate.earnings_state !== 'safe' && (
          <div className="text-[10px] mt-0.5" style={{ color: 'oklch(0.78 0.18 85)' }}>
            ⚠ {candidate.earnings_state} · {candidate.days_to_earnings}d
          </div>
        )}
        {candidate.excluded && (
          <div className="text-[10px] mt-0.5" style={{ color: 'oklch(0.65 0.22 25)' }}>
            Excluded: {candidate.exclusion_reason}
          </div>
        )}
      </td>

      {/* Signal */}
      <td className="px-4 py-3">
        <SignalBadge signal={evaluation.signal} label={evaluation.label} color={evaluation.color} pulse={evaluation.signal === 'STRONG_SELL'} />
        <div className="text-[10px] mt-1 max-w-[180px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
          {evaluation.reason}
        </div>
      </td>

      {/* IV Rank */}
      <td className="px-4 py-3">
        <IvRankBar value={candidate.ivr} threshold={ivRankThreshold} />
      </td>

      {/* IV / HV */}
      <td className="px-4 py-3">
        <IvHvCell iv={candidate.current_iv} hv={candidate.hv20} spreadPp={candidate.spread_pp} threshold={ivHvSpreadThreshold} />
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right">
        <div className="font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>
          ${candidate.price.toFixed(2)}
        </div>
        <div className="text-[10px] font-mono-data" style={{ color: candidate.concentration_pct > 20 ? 'oklch(0.65 0.22 25)' : 'oklch(0.50 0.010 258)' }}>
          {candidate.concentration_pct.toFixed(1)}% NL
        </div>
      </td>

      {/* Can trade */}
      <td className="px-4 py-3 text-center">
        {candidate.can_trade ? (
          <span className="text-xs font-semibold" style={{ color: 'oklch(0.72 0.18 145)' }}>✓</span>
        ) : (
          <span className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>✗</span>
        )}
      </td>
    </tr>
  );
}

// ─── Entry criteria panel ─────────────────────────────────────────────────────

function EntryCriteriaPanel({ ivRankThreshold, ivHvSpreadThreshold }: { ivRankThreshold: number; ivHvSpreadThreshold: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: 'oklch(1 0 0 / 9%)' }}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        style={{ background: 'oklch(0.20 0.010 258)' }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4" style={{ color: 'oklch(0.55 0.010 258)' }} /> : <ChevronDown className="w-4 h-4 rotate-[-90deg]" style={{ color: 'oklch(0.55 0.010 258)' }} />}
        <span className="text-xs font-semibold" style={{ color: 'oklch(0.80 0.15 200)' }}>Entry Criteria</span>
        <span className="text-xs ml-auto" style={{ color: 'oklch(0.50 0.010 258)' }}>
          IV rank ≥ {ivRankThreshold} · IV/HV spread ≥ {ivHvSpreadThreshold}pp
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 text-xs" style={{ background: 'oklch(0.17 0.010 258)' }}>
          {[
            { signal: 'STRONG SELL', color: 'oklch(0.65 0.22 25)', desc: `IV rank ≥ 80 AND IV/HV spread ≥ ${ivHvSpreadThreshold * 2}pp` },
            { signal: 'SELL PREMIUM', color: 'oklch(0.78 0.18 85)', desc: `IV rank ≥ ${ivRankThreshold} AND IV/HV spread ≥ ${ivHvSpreadThreshold}pp` },
            { signal: 'WATCH', color: 'oklch(0.80 0.15 200)', desc: `IV rank ≥ ${ivRankThreshold} but IV/HV spread thin` },
            { signal: 'NEUTRAL', color: 'oklch(0.58 0.010 258)', desc: 'IV rank 35–threshold — below entry criteria' },
            { signal: 'NO SIGNAL', color: 'oklch(0.45 0.010 258)', desc: 'IV rank < 35 or insufficient data' },
          ].map(({ signal, color, desc }) => (
            <div key={signal} className="flex items-start gap-3">
              <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${color.replace(')', ' / 12%)')}`, color }}>
                {signal}
              </span>
              <span style={{ color: 'oklch(0.60 0.010 258)' }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'actionable' | 'watch';

export default function CandidatesPage() {
  const { data, loading, error, refresh, lastUpdated } = useCandidates();
  const { config } = useConfig();
  const [sortKey, setSortKey] = useState<SortKey>('iv_rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const ivRankThreshold = config.strategy.ivRankThreshold ?? 50;
  const ivHvSpreadThreshold = config.strategy.ivHvSpreadThreshold ?? 5;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // Use server rows directly (already filtered to universe)
  const rawRows: CandidateRow[] = data?.rows ?? [];

  const evaluated = useMemo(() => rawRows.map(c => ({
    ...c,
    _eval: evaluateCandidate(c, ivRankThreshold, ivHvSpreadThreshold),
  })), [rawRows, ivRankThreshold, ivHvSpreadThreshold]);

  const filtered = useMemo(() => {
    let list = evaluated;
    if (filterMode === 'actionable') list = list.filter(c => c._eval.signal === 'STRONG_SELL' || c._eval.signal === 'SELL');
    else if (filterMode === 'watch') list = list.filter(c => c._eval.signal === 'WATCH');
    return [...list].sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'ticker': return sortDir === 'asc' ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker);
        case 'iv_rank': va = a.ivr ?? -1; vb = b.ivr ?? -1; break;
        case 'iv': va = a.current_iv; vb = b.current_iv; break;
        case 'hv': va = a.hv20; vb = b.hv20; break;
        case 'spread': va = a.spread_pp; vb = b.spread_pp; break;
        case 'signal': {
          const order: Record<EntrySignal, number> = { STRONG_SELL: 4, SELL: 3, WATCH: 2, NEUTRAL: 1, NO_SIGNAL: 0 };
          va = order[a._eval.signal] ?? 0; vb = order[b._eval.signal] ?? 0; break;
        }
        default: return 0;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [evaluated, filterMode, sortKey, sortDir]);

  const counts = useMemo(() => ({
    all: evaluated.length,
    actionable: evaluated.filter(c => c._eval.signal === 'STRONG_SELL' || c._eval.signal === 'SELL').length,
    watch: evaluated.filter(c => c._eval.signal === 'WATCH').length,
  }), [evaluated]);

  const avgIvRank = useMemo(() => {
    const withRank = rawRows.filter(c => c.ivr > 0);
    if (!withRank.length) return null;
    return withRank.reduce((s, c) => s + c.ivr, 0) / withRank.length;
  }, [rawRows]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Candidates"
        subtitle={`IV rank screener — ${config.tickers.length} tickers in universe · short-premium entry opportunities`}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />

      <div className="p-6 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Universe Size" value={config.tickers.length.toString()} subValue="configured tickers" signal="cyan" />
          <StatCard label="Actionable Signals" value={counts.actionable.toString()} subValue="STRONG SELL + SELL" signal={counts.actionable > 0 ? 'amber' : 'default'} loading={loading} />
          <StatCard label="Watch List" value={counts.watch.toString()} subValue="IV rank OK, spread thin" signal="cyan" loading={loading} />
          <StatCard
            label="Avg IV Rank"
            value={avgIvRank !== null ? `${avgIvRank.toFixed(0)}` : '—'}
            subValue={`threshold: ${ivRankThreshold}`}
            signal={avgIvRank !== null && avgIvRank >= ivRankThreshold ? 'amber' : 'default'}
            loading={loading}
          />
        </div>

        {/* Entry criteria */}
        <EntryCriteriaPanel ivRankThreshold={ivRankThreshold} ivHvSpreadThreshold={ivHvSpreadThreshold} />

        {/* Error / loading / no-config */}
        {error && !loading && <EmptyState type="error" title="Failed to load candidates" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading candidates…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your bearer token in Settings." />}

        {/* Filter bar */}
        {!loading && (
          <div className="flex items-center gap-2">
            {(['all', 'actionable', 'watch'] as FilterMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: filterMode === mode ? 'oklch(0.80 0.15 200 / 15%)' : 'oklch(0.17 0.010 258)',
                  color: filterMode === mode ? 'oklch(0.85 0.15 200)' : 'oklch(0.55 0.010 258)',
                  border: `1px solid ${filterMode === mode ? 'oklch(0.80 0.15 200 / 40%)' : 'oklch(1 0 0 / 9%)'}`,
                }}
              >
                {mode === 'all' ? `All (${counts.all})` : mode === 'actionable' ? `Actionable (${counts.actionable})` : `Watch (${counts.watch})`}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="rounded border overflow-hidden" style={{ borderColor: 'oklch(1 0 0 / 9%)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
                    <SortHeader label="Ticker" sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>Signal</th>
                    <SortHeader label="IV Rank" sortKey="iv_rank" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="IV / HV / Spread" sortKey="spread" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: 'oklch(0.50 0.010 258)' }}>Price / % NL</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: 'oklch(0.50 0.010 258)' }}>Can Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <CandidateRowItem
                      key={c.ticker}
                      candidate={c}
                      ivRankThreshold={ivRankThreshold}
                      ivHvSpreadThreshold={ivHvSpreadThreshold}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && config.apiToken && (
          <EmptyState type="empty" title="No candidates match filter" description="Try changing the filter or refreshing the data." />
        )}

        <div className="text-[10px] font-mono-data" style={{ color: 'oklch(0.40 0.010 258)' }}>
          Source: {data?.source ?? 'GET /api/candidates'} · As of: {data?.as_of ? new Date(data.as_of).toLocaleString() : '—'}
        </div>
      </div>
    </div>
  );
}
