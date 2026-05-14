/**
 * FORTRESS V2 — Candidates Page
 * IV rank screener: surfaces new short-premium entry opportunities.
 *
 * For each ticker in the configurable universe, shows:
 *   - IV rank (0–100) with visual bar
 *   - IV percentile with visual bar
 *   - Current IV vs HV (30-day) with spread
 *   - 52-week IV range
 *   - Underlying last price + daily change
 *   - Entry signal badge: STRONG SELL / SELL PREMIUM / WATCH / NEUTRAL / NO SIGNAL
 *
 * Entry logic (configurable thresholds in Settings):
 *   STRONG SELL  → IV rank ≥ 80 AND IV/HV spread ≥ 2× threshold
 *   SELL PREMIUM → IV rank ≥ threshold AND IV > HV by ≥ threshold
 *   WATCH        → IV rank ≥ threshold but spread thin
 *   NEUTRAL      → IV rank 35–threshold
 *   NO SIGNAL    → IV rank < 35 or no data
 */

import { useState, useMemo } from 'react';
import {
  useCandidates,
  useMarketIntelligence,
  evaluateCandidate,
  type CandidateData,
  type EntrySignal,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Info,
} from 'lucide-react';

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ signal, label, color, pulse }: { signal: EntrySignal; label: string; color: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold font-mono-data border',
        pulse && 'animate-pulse',
      )}
      style={{
        color,
        borderColor: `${color.replace(')', ' / 35%)')}`,
        background: `${color.replace(')', ' / 10%)')}`,
      }}
    >
      {signal === 'STRONG_SELL' && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />}
      {label}
    </span>
  );
}

// ─── IV rank bar ──────────────────────────────────────────────────────────────

function IvRankBar({ value, threshold }: { value: number | undefined; threshold: number }) {
  if (value === undefined) {
    return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  }

  const pct = Math.min(100, Math.max(0, value));
  const isHigh = pct >= threshold;
  const barColor = pct >= 80 ? 'oklch(0.65 0.22 25)' : pct >= threshold ? 'oklch(0.78 0.18 85)' : 'oklch(0.55 0.010 258)';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span
        className="font-mono-data text-xs w-8 text-right"
        style={{ color: isHigh ? barColor : 'oklch(0.65 0.010 258)' }}
      >
        {pct.toFixed(0)}
      </span>
    </div>
  );
}

// ─── IV vs HV spread cell ─────────────────────────────────────────────────────

function IvHvCell({ iv, hv, threshold }: { iv: number; hv: number; threshold: number }) {
  const spread = iv - hv;
  const isPositive = spread >= threshold;
  const spreadColor = spread >= threshold * 2
    ? 'oklch(0.65 0.22 25)'
    : spread >= threshold
    ? 'oklch(0.78 0.18 85)'
    : spread > 0
    ? 'oklch(0.72 0.18 145)'
    : 'oklch(0.55 0.010 258)';

  return (
    <div className="text-right">
      <div className="font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>
        {(iv * 100).toFixed(1)}% <span style={{ color: 'oklch(0.45 0.010 258)' }}>/ {(hv * 100).toFixed(1)}%</span>
      </div>
      <div className="font-mono-data text-[10px]" style={{ color: spreadColor }}>
        {spread >= 0 ? '+' : ''}{(spread * 100).toFixed(1)}pp spread
      </div>
    </div>
  );
}

// ─── 52w range cell ───────────────────────────────────────────────────────────

function IvRangeCell({ iv, low, high }: { iv: number; low?: number; high?: number }) {
  if (!low || !high) {
    return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  }
  const range = high - low;
  const pos = range > 0 ? ((iv - low) / range) * 100 : 50;

  return (
    <div className="min-w-[110px]">
      <div className="flex justify-between font-mono-data text-[10px] mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
        <span>{(low * 100).toFixed(0)}%</span>
        <span>{(high * 100).toFixed(0)}%</span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
        <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(to right, oklch(0.72 0.18 145), oklch(0.78 0.18 85), oklch(0.65 0.22 25))' }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2"
          style={{
            left: `calc(${pos}% - 4px)`,
            background: 'oklch(0.93 0.005 258)',
            borderColor: 'oklch(0.14 0.010 258)',
          }}
        />
      </div>
    </div>
  );
}

// ─── Price change cell ────────────────────────────────────────────────────────

function PriceCell({ price, changePct }: { price?: number; changePct?: number }) {
  if (!price) return <span className="font-mono-data text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;

  const Icon = changePct === undefined ? Minus : changePct > 0 ? TrendingUp : changePct < 0 ? TrendingDown : Minus;
  const color = changePct === undefined ? 'oklch(0.55 0.010 258)' : changePct > 0 ? 'oklch(0.72 0.18 145)' : changePct < 0 ? 'oklch(0.65 0.22 25)' : 'oklch(0.55 0.010 258)';

  return (
    <div className="text-right">
      <div className="font-mono-data text-xs" style={{ color: 'oklch(0.85 0.005 258)' }}>
        ${price.toFixed(2)}
      </div>
      {changePct !== undefined && (
        <div className="flex items-center justify-end gap-0.5 font-mono-data text-[10px]" style={{ color }}>
          <Icon className="w-3 h-3" />
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

// ─── Sort control ─────────────────────────────────────────────────────────────

type SortKey = 'ticker' | 'iv_rank' | 'iv_percentile' | 'iv' | 'hv' | 'spread' | 'signal';

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
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
        {active ? (
          dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

// ─── Candidate row ────────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  ivRankThreshold,
  ivHvSpreadThreshold,
}: {
  candidate: CandidateData;
  ivRankThreshold: number;
  ivHvSpreadThreshold: number;
}) {
  const evaluation = evaluateCandidate(candidate, ivRankThreshold, ivHvSpreadThreshold);
  const rank = candidate.iv_rank ?? candidate.iv_percentile;
  const isActionable = evaluation.signal === 'STRONG_SELL' || evaluation.signal === 'SELL';

  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]',
        isActionable && 'bg-[oklch(0.78_0.18_85_/_3%)]',
      )}
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
        {candidate.market_cap_tier && (
          <div className="text-[10px] mt-0.5" style={{ color: 'oklch(0.50 0.010 258)' }}>
            {candidate.market_cap_tier}
          </div>
        )}
      </td>

      {/* Signal */}
      <td className="px-4 py-3">
        <SignalBadge
          signal={evaluation.signal}
          label={evaluation.label}
          color={evaluation.color}
          pulse={evaluation.signal === 'STRONG_SELL'}
        />
        <div className="text-[10px] mt-1 max-w-[180px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
          {evaluation.reason}
        </div>
      </td>

      {/* IV Rank */}
      <td className="px-4 py-3">
        <IvRankBar value={candidate.iv_rank} threshold={ivRankThreshold} />
      </td>

      {/* IV Percentile */}
      <td className="px-4 py-3">
        <IvRankBar value={candidate.iv_percentile} threshold={ivRankThreshold} />
      </td>

      {/* IV / HV */}
      <td className="px-4 py-3">
        <IvHvCell iv={candidate.iv} hv={candidate.hv} threshold={ivHvSpreadThreshold} />
      </td>

      {/* 52w IV range */}
      <td className="px-4 py-3">
        <IvRangeCell iv={candidate.iv} low={candidate.iv_52w_low} high={candidate.iv_52w_high} />
      </td>

      {/* Price */}
      <td className="px-4 py-3">
        <PriceCell price={candidate.last_price} changePct={candidate.price_change_pct} />
      </td>
    </tr>
  );
}

// ─── Entry criteria explanation ───────────────────────────────────────────────

function EntryCriteriaPanel({ ivRankThreshold, ivHvSpreadThreshold }: { ivRankThreshold: number; ivHvSpreadThreshold: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: 'oklch(1 0 0 / 9%)' }}
    >
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[oklch(1_0_0_/_3%)] transition-colors"
        style={{ background: 'oklch(0.20 0.010 258)' }}
        onClick={() => setOpen(s => !s)}
      >
        <Info className="w-4 h-4 flex-shrink-0" style={{ color: 'oklch(0.80 0.15 200)' }} />
        <span className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
          Entry Criteria — How Signals Are Generated
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 ml-auto" style={{ color: 'oklch(0.55 0.010 258)' }} />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" style={{ color: 'oklch(0.55 0.010 258)' }} />
        )}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-3" style={{ background: 'oklch(0.17 0.010 258)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.60 0.010 258)' }}>
            The screener evaluates each ticker in your universe using two primary signals:
            <strong style={{ color: 'oklch(0.85 0.005 258)' }}> IV rank</strong> (where current IV sits in its 52-week range)
            and the <strong style={{ color: 'oklch(0.85 0.005 258)' }}>IV/HV spread</strong> (implied vs realised volatility premium).
            Both conditions must be met for an actionable signal — elevated IV rank alone is insufficient if IV is not
            meaningfully above realised vol.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                signal: 'STRONG SELL',
                color: 'oklch(0.65 0.22 25)',
                rule: `IV rank ≥ 80 AND IV/HV spread ≥ ${(ivHvSpreadThreshold * 2 * 100).toFixed(0)}pp`,
                desc: 'Highest-conviction short-premium setup. IV is in the top quintile of its range and significantly above realised vol.',
              },
              {
                signal: 'SELL PREMIUM',
                color: 'oklch(0.78 0.18 85)',
                rule: `IV rank ≥ ${ivRankThreshold} AND IV/HV spread ≥ ${(ivHvSpreadThreshold * 100).toFixed(0)}pp`,
                desc: 'Standard entry signal. IV is elevated relative to history and above realised vol — edge exists for selling premium.',
              },
              {
                signal: 'WATCH',
                color: 'oklch(0.80 0.15 200)',
                rule: `IV rank ≥ ${ivRankThreshold} but spread < ${(ivHvSpreadThreshold * 100).toFixed(0)}pp`,
                desc: 'IV rank is elevated but the IV/HV spread is thin. Monitor for spread expansion before entering.',
              },
              {
                signal: 'NEUTRAL / NO SIGNAL',
                color: 'oklch(0.55 0.010 258)',
                rule: `IV rank < ${ivRankThreshold}`,
                desc: 'IV is not elevated enough to justify selling premium. Wait for IV expansion or look elsewhere.',
              },
            ].map(({ signal, color, rule, desc }) => (
              <div key={signal} className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[11px] font-semibold font-mono-data px-2 py-0.5 rounded border"
                    style={{ color, borderColor: `${color.replace(')', ' / 35%)')}`, background: `${color.replace(')', ' / 10%)')}` }}
                  >
                    {signal}
                  </span>
                </div>
                <div className="font-mono-data text-[10px] mb-1" style={{ color: 'oklch(0.65 0.010 258)' }}>{rule}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: 'oklch(0.55 0.010 258)' }}>{desc}</div>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: 'oklch(0.50 0.010 258)' }}>
            Thresholds are configurable in <strong style={{ color: 'oklch(0.80 0.15 200)' }}>Settings → Strategy Parameters</strong>.
            The macro regime gate (Layer 1) still applies — no new entries when the regime score is below your threshold,
            even if a ticker shows a STRONG SELL signal.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Macro regime gate warning ────────────────────────────────────────────────

function RegimeGateWarning() {
  // We import useBriefing lazily to avoid circular issues — just check macro
  const { data } = useCandidates();
  return null; // Handled in parent via briefing hook if needed
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'actionable' | 'watch';

function FilterBar({ mode, onMode, count }: { mode: FilterMode; onMode: (m: FilterMode) => void; count: { all: number; actionable: number; watch: number } }) {
  const options: { key: FilterMode; label: string; countKey: keyof typeof count }[] = [
    { key: 'all', label: 'All', countKey: 'all' },
    { key: 'actionable', label: 'Actionable', countKey: 'actionable' },
    { key: 'watch', label: 'Watch', countKey: 'watch' },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map(({ key, label, countKey }) => (
        <button
          key={key}
          onClick={() => onMode(key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-all',
            mode === key ? 'font-semibold' : 'hover:bg-[oklch(1_0_0_/_5%)]',
          )}
          style={mode === key ? {
            color: 'oklch(0.80 0.15 200)',
            borderColor: 'oklch(0.80 0.15 200 / 40%)',
            background: 'oklch(0.80 0.15 200 / 10%)',
          } : {
            color: 'oklch(0.60 0.010 258)',
            borderColor: 'oklch(1 0 0 / 10%)',
          }}
        >
          {label}
          <span
            className="font-mono-data text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              background: mode === key ? 'oklch(0.80 0.15 200 / 20%)' : 'oklch(1 0 0 / 8%)',
              color: mode === key ? 'oklch(0.80 0.15 200)' : 'oklch(0.55 0.010 258)',
            }}
          >
            {count[countKey]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const { data, loading, error, refresh, lastUpdated } = useCandidates();
  const { config } = useConfig();

  const [sortKey, setSortKey] = useState<SortKey>('iv_rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const ivRankThreshold = config.strategy.ivRankThreshold ?? 50;
  const ivHvSpreadThreshold = config.strategy.ivHvSpreadThreshold ?? 0.05;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const rawCandidates: CandidateData[] = useMemo(() => {
    // Use API data if available, otherwise build stubs from configured tickers
    if (data?.candidates && data.candidates.length > 0) {
      return data.candidates;
    }
    // Return empty stubs for configured tickers so the table shows them
    return config.tickers.map(ticker => ({
      ticker,
      iv: 0,
      hv: 0,
    }));
  }, [data, config.tickers]);

  const evaluated = useMemo(() => {
    return rawCandidates.map(c => ({
      ...c,
      _eval: evaluateCandidate(c, ivRankThreshold, ivHvSpreadThreshold),
    }));
  }, [rawCandidates, ivRankThreshold, ivHvSpreadThreshold]);

  const filtered = useMemo(() => {
    let list = evaluated;
    if (filterMode === 'actionable') {
      list = list.filter(c => c._eval.signal === 'STRONG_SELL' || c._eval.signal === 'SELL');
    } else if (filterMode === 'watch') {
      list = list.filter(c => c._eval.signal === 'WATCH');
    }
    return [...list].sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'ticker':
          return sortDir === 'asc'
            ? a.ticker.localeCompare(b.ticker)
            : b.ticker.localeCompare(a.ticker);
        case 'iv_rank':
          va = a.iv_rank ?? a.iv_percentile ?? -1;
          vb = b.iv_rank ?? b.iv_percentile ?? -1;
          break;
        case 'iv_percentile':
          va = a.iv_percentile ?? a.iv_rank ?? -1;
          vb = b.iv_percentile ?? b.iv_rank ?? -1;
          break;
        case 'iv':
          va = a.iv; vb = b.iv;
          break;
        case 'hv':
          va = a.hv; vb = b.hv;
          break;
        case 'spread':
          va = a.iv - a.hv; vb = b.iv - b.hv;
          break;
        case 'signal': {
          const order: Record<EntrySignal, number> = { STRONG_SELL: 4, SELL: 3, WATCH: 2, NEUTRAL: 1, NO_SIGNAL: 0 };
          va = order[a._eval.signal]; vb = order[b._eval.signal];
          break;
        }
        default:
          return 0;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [evaluated, filterMode, sortKey, sortDir]);

  const counts = useMemo(() => ({
    all: evaluated.length,
    actionable: evaluated.filter(c => c._eval.signal === 'STRONG_SELL' || c._eval.signal === 'SELL').length,
    watch: evaluated.filter(c => c._eval.signal === 'WATCH').length,
  }), [evaluated]);

  const strongSellCount = counts.actionable;
  const avgIvRank = useMemo(() => {
    const withRank = rawCandidates.filter(c => c.iv_rank !== undefined || c.iv_percentile !== undefined);
    if (!withRank.length) return null;
    return withRank.reduce((s, c) => s + (c.iv_rank ?? c.iv_percentile ?? 0), 0) / withRank.length;
  }, [rawCandidates]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Candidates"
        subtitle={`IV rank screener — ${config.tickers.length} tickers in universe · entry opportunities for short-premium strategies`}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />

      <div className="p-6 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Universe Size"
            value={config.tickers.length.toString()}
            subValue="configured tickers"
            signal="cyan"
          />
          <StatCard
            label="Actionable Signals"
            value={strongSellCount.toString()}
            subValue="STRONG SELL + SELL"
            signal={strongSellCount > 0 ? 'amber' : 'default'}
            loading={loading}
          />
          <StatCard
            label="Watch List"
            value={counts.watch.toString()}
            subValue="IV rank OK, spread thin"
            signal={counts.watch > 0 ? 'cyan' : 'default'}
            loading={loading}
          />
          <StatCard
            label="Avg IV Rank"
            value={avgIvRank !== null ? `${avgIvRank.toFixed(0)}` : '—'}
            subValue="across universe"
            signal={avgIvRank !== null && avgIvRank >= ivRankThreshold ? 'amber' : 'default'}
            loading={loading}
          />
        </div>

        {/* Entry criteria panel */}
        <EntryCriteriaPanel ivRankThreshold={ivRankThreshold} ivHvSpreadThreshold={ivHvSpreadThreshold} />

        {/* Error / no config states — show only one message */}
        {!config.apiToken && !loading && (
          <EmptyState
            type="no-config"
            title="API token required"
            description="Configure your API URL and token in Settings to load live IV data."
          />
        )}
        {config.apiToken && error && !loading && (
          <EmptyState type="error" title="Failed to load candidates" description={error} />
        )}

        {/* Main screener table */}
        {config.tickers.length === 0 ? (
          <EmptyState
            type="no-config"
            title="No tickers configured"
            description="Add tickers to your universe in Settings to run the IV screener."
          />
        ) : (
          <div
            className="rounded border overflow-hidden"
            style={{ borderColor: 'oklch(1 0 0 / 9%)' }}
          >
            {/* Table toolbar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ background: 'oklch(0.20 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}
            >
              <FilterBar mode={filterMode} onMode={setFilterMode} count={counts} />
              <div className="text-xs font-mono-data" style={{ color: 'oklch(0.50 0.010 258)' }}>
                {filtered.length} ticker{filtered.length !== 1 ? 's' : ''}
                {loading && <span className="ml-2 animate-pulse">· refreshing…</span>}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)', background: 'oklch(0.15 0.010 258)' }}>
                    <SortHeader label="Ticker" sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Signal" sortKey="signal" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="IV Rank" sortKey="iv_rank" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="IV %ile" sortKey="iv_percentile" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="IV / HV" sortKey="iv" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: 'oklch(0.50 0.010 258)' }}>
                      52w IV Range
                    </th>
                    <SortHeader label="Price" sortKey="spread" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'oklch(0.50 0.010 258)' }}>
                        {filterMode === 'actionable'
                          ? 'No actionable signals — all tickers below entry threshold'
                          : filterMode === 'watch'
                          ? 'No tickers in watch state'
                          : 'No data available — connect API or check ticker universe'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(candidate => (
                      <CandidateRow
                        key={candidate.ticker}
                        candidate={candidate}
                        ivRankThreshold={ivRankThreshold}
                        ivHvSpreadThreshold={ivHvSpreadThreshold}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Thresholds reminder */}
        <div
          className="rounded p-3 text-xs"
          style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.65 0.010 258)' }}>Active thresholds: </span>
          <span className="font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
            IV rank entry ≥ {ivRankThreshold} ·
            IV/HV spread ≥ {(ivHvSpreadThreshold * 100).toFixed(0)}pp ·
            Strong sell at IV rank ≥ 80 + spread ≥ {(ivHvSpreadThreshold * 2 * 100).toFixed(0)}pp ·
            Regime entry threshold: {config.strategy.regimeEntryThreshold}
          </span>
          <span className="ml-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
            — adjust in <a href="/settings" style={{ color: 'oklch(0.80 0.15 200)' }}>Settings</a>
          </span>
        </div>
      </div>
    </div>
  );
}
