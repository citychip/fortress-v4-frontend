/**
 * FORTRESS V2 — Candidates Page
 * IV rank screener: surfaces new short-premium entry opportunities.
 * Uses /api/candidates → CandidatesResponse.rows (CandidateRow[]).
 * Uses /api/market-intelligence?ticker=X for DP floor anchoring of strikes.
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

import { useState, useMemo, useEffect } from 'react';
import { Copy, CheckCircle2, AlertTriangle, SendHorizonal, CheckCheck, ShieldOff, ShieldCheck } from 'lucide-react';
import {
  useCandidates,
  useMarketIntelligence,
  usePretradeAll,
  evaluateCandidate,
  type CandidateRow,
  type EntrySignal,
  type MarketIntelligence,
  type PretradeResult,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { usePendingOrders } from '@/contexts/PendingOrdersContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, ExternalLink, TrendingUp as TrendUp, BarChart2 } from 'lucide-react';
import { useConfig as _useConfig } from '@/contexts/ConfigContext';
import { useEarningsVolatility, type EarningsVolData } from '@/hooks/useApi';

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

function PretradeGateBadge({ result }: { result: PretradeResult | undefined }) {
  if (!result) return <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>—</span>;
  if (result.verdict === 'BLOCKED') {
    return (
      <div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded" style={{ color: 'oklch(0.65 0.22 25)', background: 'oklch(0.65 0.22 25 / 12%)' }}>
          <ShieldOff className="w-3 h-3" /> BLOCKED
        </span>
        {result.failures.slice(0, 2).map((f, i) => (
          <div key={i} className="text-[9px] mt-0.5 truncate max-w-[140px]" style={{ color: 'oklch(0.55 0.010 258)' }}>{f}</div>
        ))}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded" style={{ color: 'oklch(0.72 0.18 145)', background: 'oklch(0.72 0.18 145 / 10%)' }}>
      <ShieldCheck className="w-3 h-3" /> PROCEED
    </span>
  );
}


// ─── E-08: Earnings Volatility Compare Panel ─────────────────────────────────

const DIM_EV  = 'oklch(0.50 0.010 258)';
const CYAN_EV = 'oklch(0.80 0.15 200)';
const AMBER_EV = 'oklch(0.78 0.18 85)';
const GREEN_EV = 'oklch(0.72 0.18 145)';
const RED_EV  = 'oklch(0.65 0.22 25)';

function EarningsVolPanel({ ticker, colSpan }: { ticker: string; colSpan: number }) {
  const { data, loading } = useEarningsVolatility(ticker);

  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 pb-3 pt-0">
          <div className="rounded p-3 flex items-center gap-2"
            style={{ background: 'oklch(0.14 0.010 258)', border: '1px solid oklch(1 0 0 / 6%)' }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${CYAN_EV} transparent transparent transparent` }} />
            <span className="text-[11px]" style={{ color: DIM_EV }}>Loading earnings vol data…</span>
          </div>
        </td>
      </tr>
    );
  }

  if (!data) return null;

  const moves = data.historical_moves?.slice(0, 4) ?? [];
  const maxMove = Math.max(...moves.map((m: any) => m.move_pct ?? 0), data.implied_move_pct ?? 0, 1);
  const ratio = data.implied_vs_historical_ratio;
  const ratioColor = ratio == null ? DIM_EV : ratio > 1.5 ? AMBER_EV : ratio < 0.8 ? GREEN_EV : CYAN_EV;

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 pb-3 pt-0">
        <div className="rounded p-3" style={{ background: 'oklch(0.14 0.010 258)', border: '1px solid oklch(1 0 0 / 6%)' }}>
          <div className="flex items-center gap-3 mb-2.5">
            <BarChart2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: CYAN_EV }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: CYAN_EV }}>
              Earnings Volatility
            </span>
            {data.next_earnings_date && (
              <span className="text-[10px]" style={{ color: DIM_EV }}>
                Next: {data.next_earnings_date}
              </span>
            )}
            <span className="ml-auto text-[10px]" style={{ color: DIM_EV }}>
              Straddle expiry: {data.straddle_expiry ?? '—'}
            </span>
          </div>

          <div className="flex items-end gap-6">
            {/* Key metrics */}
            <div className="flex items-center gap-4 shrink-0">
              <div>
                <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: DIM_EV }}>Implied Move</div>
                <div className="font-mono-data text-xl font-bold" style={{ color: AMBER_EV }}>
                  {data.implied_move_pct != null ? `±${data.implied_move_pct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="text-lg" style={{ color: DIM_EV }}>vs</div>
              <div>
                <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: DIM_EV }}>Avg Historical</div>
                <div className="font-mono-data text-xl font-bold" style={{ color: GREEN_EV }}>
                  {data.avg_historical_pct != null ? `±${data.avg_historical_pct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: DIM_EV }}>Ratio</div>
                <div className="font-mono-data text-xl font-bold" style={{ color: ratioColor }}>
                  {ratio != null ? `${ratio.toFixed(2)}x` : '—'}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: DIM_EV }}>
                  {ratio != null ? (ratio > 1.5 ? 'market pricing more' : ratio < 0.8 ? 'below history' : 'inline with history') : ''}
                </div>
              </div>
            </div>

            {/* Mini bar chart of last 4 historical moves */}
            {moves.length > 0 && (
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: DIM_EV }}>
                  Last {moves.length} earnings moves
                </div>
                <div className="flex items-end gap-1.5 h-10">
                  {/* Implied move bar */}
                  {data.implied_move_pct != null && (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-6 rounded-sm"
                        style={{
                          height: `${Math.round((data.implied_move_pct / maxMove) * 36)}px`,
                          background: AMBER_EV,
                          opacity: 0.7,
                        }} />
                      <span className="text-[8px] font-mono" style={{ color: AMBER_EV }}>impl</span>
                    </div>
                  )}
                  <div className="w-px h-full self-stretch" style={{ background: 'oklch(1 0 0 / 10%)' }} />
                  {moves.map((m: any, i: number) => {
                    const barH = Math.max(2, Math.round((m.move_pct / maxMove) * 36));
                    const barColor = m.direction_pct > 0 ? GREEN_EV : RED_EV;
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5 group relative">
                        <div className="w-5 rounded-sm" style={{ height: `${barH}px`, background: barColor, opacity: 0.8 }} />
                        <span className="text-[8px] font-mono" style={{ color: DIM_EV }}>
                          {m.date?.slice(5) ?? ''}
                        </span>
                        {/* Hover tooltip */}
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10
                          px-1.5 py-1 rounded text-[9px] whitespace-nowrap"
                          style={{ background: 'oklch(0.20 0.010 258)', border: '1px solid oklch(1 0 0 / 15%)', color: barColor }}>
                          {m.direction_pct > 0 ? '+' : ''}{m.direction_pct?.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function CandidateRowItem({
  candidate, ivRankThreshold, ivHvSpreadThreshold, pretradeResult, colSpan = 7,
}: {
  candidate: CandidateRow; ivRankThreshold: number; ivHvSpreadThreshold: number; pretradeResult?: PretradeResult; colSpan?: number;
}) {
  const evaluation = evaluateCandidate(candidate, ivRankThreshold, ivHvSpreadThreshold);
  const isBlocked = pretradeResult?.verdict === 'BLOCKED';
  const isActionable = !isBlocked && (evaluation.signal === 'STRONG_SELL' || evaluation.signal === 'SELL');
  const [earningsExpanded, setEarningsExpanded] = useState(false);

  return (
    <>
    <tr
      className={cn('border-b transition-colors hover:bg-[oklch(1_0_0_/_3%)]', isActionable && 'bg-[oklch(0.78_0.18_85_/_3%)]')}
      style={{ borderColor: earningsExpanded ? 'transparent' : 'oklch(1 0 0 / 6%)' }}
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
          <button
            onClick={() => setEarningsExpanded(e => !e)}
            className="opacity-40 hover:opacity-90 transition-opacity ml-0.5"
            title="Earnings volatility"
            style={{ color: earningsExpanded ? 'oklch(0.78 0.18 85)' : 'oklch(0.60 0.010 258)' }}
          >
            <BarChart2 className="w-3 h-3" />
          </button>
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
      {/* Pre-trade gate */}
      <td className="px-4 py-3">
        <PretradeGateBadge result={pretradeResult} />
      </td>
    </tr>
    {earningsExpanded && <EarningsVolPanel ticker={candidate.ticker} colSpan={colSpan} />}
    </>
  );
}

// ─── Strike derivation ────────────────────────────────────────────────────────

/**
 * Derives the best short-put strike for a bull put spread.
 *
 * Priority:
 *  1. Find the largest DP floor that is BELOW current price and below the
 *     5% OTM level — place the short put just below that floor (floor − $5)
 *     so the floor acts as support above the short strike.
 *  2. If no suitable DP floor exists, fall back to 5% OTM rounded to $5.
 *
 * Width: $15 for stocks ≥$200, $10 for stocks <$200.
 */

// ─── Monitoring Row (non-actionable universe tickers) ─────────────────────────
function MonitoringRow({ ticker }: { ticker: string }) {
  const DIM = 'oklch(0.45 0.010 258)';
  const MID = 'oklch(0.55 0.010 258)';
  return (
    <tr
      className="border-b"
      style={{ borderColor: 'oklch(1 0 0 / 5%)', opacity: 0.65 }}
    >
      <td className="px-4 py-2.5">
        <span className="font-display text-xs font-bold" style={{ color: MID }}>{ticker}</span>
      </td>
      <td className="px-4 py-2.5">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border"
          style={{ color: DIM, borderColor: 'oklch(1 0 0 / 10%)', background: 'oklch(1 0 0 / 4%)' }}
        >
          monitoring
        </span>
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs" style={{ color: DIM }}>—</td>
      <td className="px-4 py-2.5 font-mono-data text-xs" style={{ color: DIM }}>—</td>
      <td className="px-4 py-2.5 font-mono-data text-xs text-right" style={{ color: DIM }}>—</td>
      <td className="px-4 py-2.5 text-center" style={{ color: DIM }}>—</td>
      <td className="px-4 py-2.5 font-mono-data text-xs" style={{ color: DIM }}>—</td>
    </tr>
  );
}

function deriveStrikes(price: number, mi: MarketIntelligence | null): {
  shortStrike: number;
  longStrike: number;
  dpFloorUsed: number | null;
  strikeMethod: 'dp_anchored' | 'otm_fallback';
} {
  const width = price >= 200 ? 15 : 10;
  const otmShort = Math.round((price * 0.95) / 5) * 5;

  if (mi?.dark_pool?.floors?.length) {
    // Find floors below price and below 5% OTM level
    const eligibleFloors = mi.dark_pool.floors
      .filter(f => f.price < price && f.price < price * 0.97) // at least 3% below price
      .sort((a, b) => b.notional_m - a.notional_m); // largest notional first

    if (eligibleFloors.length > 0) {
      const floor = eligibleFloors[0];
      // Short put just below the floor (floor − $5), rounded to $5
      const rawShort = Math.floor((floor.price - 5) / 5) * 5;
      // Don't go more than 12% OTM
      const shortStrike = Math.max(rawShort, Math.round((price * 0.88) / 5) * 5);
      const longStrike = shortStrike - width;
      return { shortStrike, longStrike, dpFloorUsed: floor.price, strikeMethod: 'dp_anchored' as const };
    }
  }

  return { shortStrike: otmShort, longStrike: otmShort - width, dpFloorUsed: null, strikeMethod: 'otm_fallback' as const };
}

// ─── Suggested trade panel ────────────────────────────────────────────────────

interface SuggestedTrade {
  ticker: string;
  strategy: string;
  shortStrike: number;
  longStrike: number;
  expiry: string;
  creditMin: number;
  creditMax: number;
  qty: number;
  rationale: string;
  warning?: string;
  dpFloorUsed?: number | null;
  strikeMethod: 'dp_anchored' | 'otm_fallback';
}

// Attach _eval to CandidateRow for use in deriveSetup
type EvaluatedRow = CandidateRow & { _eval: ReturnType<typeof evaluateCandidate> };

function SuggestedTradePanelWithMI({
  candidate,
}: {
  candidate: EvaluatedRow;
}) {
  const { config } = useConfig();
  const { data: mi, loading: miLoading } = useMarketIntelligence(
    config.apiToken ? candidate.ticker : null
  );
  const { addOrder, hasOrder, removeOrder, orders } = usePendingOrders();
  const [copied, setCopied] = useState(false);

  const price = candidate.price;
  const { shortStrike, longStrike, dpFloorUsed, strikeMethod } = useMemo(
    () => deriveStrikes(price, mi ?? null),
    [price, mi]
  );

  const width = shortStrike - longStrike;
  const creditMin = parseFloat((width * 0.18).toFixed(2));
  const creditMax = parseFloat((width * 0.28).toFixed(2));

  // Expiry: 3rd Friday of next month (~30–45 DTE)
  const expiry = useMemo(() => {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    let fridays = 0;
    while (fridays < 3) {
      if (target.getDay() === 5) fridays++;
      if (fridays < 3) target.setDate(target.getDate() + 1);
    }
    return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const rationale = `IV rank ${candidate.ivr?.toFixed(0)} · IV ${candidate.current_iv?.toFixed(1)}% vs HV ${candidate.hv20?.toFixed(1)}% · +${candidate.spread_pp?.toFixed(1)}pp spread · earnings ${candidate.days_to_earnings}d out`;
  const warning = candidate.concentration_pct > 15
    ? `Concentration already ${candidate.concentration_pct.toFixed(1)}% of NL — size carefully`
    : undefined;

  const orderText = `SELL 1x ${candidate.ticker} ${shortStrike}/${longStrike} Put Spread exp ${expiry} · target credit $${creditMin}–$${creditMax}`;

  const alreadyQueued = hasOrder(candidate.ticker);
  const queuedOrder = orders.find(o => o.ticker === candidate.ticker);

  const copy = () => {
    navigator.clipboard.writeText(orderText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const sendToOrders = () => {
    if (alreadyQueued) {
      if (queuedOrder) removeOrder(queuedOrder.id);
      return;
    }
    addOrder({
      ticker: candidate.ticker,
      strategy: 'Bull Put Spread',
      shortStrike,
      longStrike,
      expiry,
      creditMin,
      creditMax,
      qty: 1,
      rationale,
      dpFloorUsed: dpFloorUsed ?? undefined,
    });
  };

  return (
    <div
      className="rounded border p-4 space-y-3"
      style={{ borderColor: 'oklch(0.78 0.18 85 / 35%)', background: 'oklch(0.78 0.18 85 / 5%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: 'oklch(0.78 0.18 85 / 20%)', color: 'oklch(0.88 0.18 85)' }}>
            Suggested Trade
          </span>
          <span className="font-display font-bold text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
            {candidate.ticker}
          </span>
          {miLoading && (
            <span className="text-[10px] animate-pulse" style={{ color: 'oklch(0.50 0.010 258)' }}>
              loading DP floors…
            </span>
          )}
          {strikeMethod === 'dp_anchored' && dpFloorUsed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: 'oklch(0.80 0.15 200)' }}>
              DP floor ${dpFloorUsed.toFixed(0)} anchored
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'oklch(0.20 0.010 258)', color: 'oklch(0.65 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)' }}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={sendToOrders}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={alreadyQueued
              ? { background: 'oklch(0.72 0.18 145 / 15%)', color: 'oklch(0.72 0.18 145)', border: '1px solid oklch(0.72 0.18 145 / 40%)' }
              : { background: 'oklch(0.80 0.15 200 / 15%)', color: 'oklch(0.85 0.15 200)', border: '1px solid oklch(0.80 0.15 200 / 30%)' }
            }
          >
            {alreadyQueued ? <CheckCheck className="w-3.5 h-3.5" /> : <SendHorizonal className="w-3.5 h-3.5" />}
            {alreadyQueued ? 'In Orders (remove)' : 'Send to Orders'}
          </button>
        </div>
      </div>

      {/* Trade details */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Strategy</span>
          <span className="font-semibold" style={{ color: 'oklch(0.85 0.005 258)' }}>Bull Put Spread</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Expiry</span>
          <span className="font-mono-data" style={{ color: 'oklch(0.85 0.005 258)' }}>{expiry}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Short Put</span>
          <span className="font-mono-data font-bold" style={{ color: 'oklch(0.65 0.22 25)' }}>${shortStrike}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Long Put</span>
          <span className="font-mono-data" style={{ color: 'oklch(0.72 0.18 145)' }}>${longStrike}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Width</span>
          <span className="font-mono-data" style={{ color: 'oklch(0.85 0.005 258)' }}>${width}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Target Credit</span>
          <span className="font-mono-data font-bold" style={{ color: 'oklch(0.78 0.18 85)' }}>${creditMin}–${creditMax}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Qty</span>
          <span className="font-mono-data" style={{ color: 'oklch(0.85 0.005 258)' }}>1 contract</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'oklch(0.50 0.010 258)' }}>Max Risk</span>
          <span className="font-mono-data" style={{ color: 'oklch(0.65 0.22 25)' }}>${((width - creditMax) * 100).toFixed(0)}</span>
        </div>
      </div>

      {/* Rationale */}
      <div className="text-[11px] pt-1 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.58 0.010 258)' }}>
        {rationale}
        {dpFloorUsed && (
          <span style={{ color: 'oklch(0.80 0.15 200)' }}>
            {' '}· Short strike anchored below DP floor ${dpFloorUsed.toFixed(0)}
          </span>
        )}
      </div>

      {/* Warning */}
      {warning && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'oklch(0.78 0.18 85)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {warning}
        </div>
      )}
    </div>
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
          <div className="pt-2 border-t text-[10px]" style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.45 0.010 258)' }}>
            Strike selection: Short put anchored below largest DP floor (if available), else 5% OTM. Width $15 for stocks ≥$200, $10 below.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'actionable' | 'watch';

export default function CandidatesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, loading, error, refresh, lastUpdated } = useCandidates();
  const { data: pretradeData } = usePretradeAll();
  const { config } = useConfig();
  const [sortKey, setSortKey] = useState<SortKey>('iv_rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Build a lookup map: ticker -> PretradeResult
  const pretradeMap = useMemo(() => {
    const m: Record<string, PretradeResult> = {};
    pretradeData?.results.forEach(r => { m[r.ticker] = r; });
    return m;
  }, [pretradeData]);

  const ivRankThreshold = config.strategy.ivRankThreshold ?? 50;
  const ivHvSpreadThreshold = config.strategy.ivHvSpreadThreshold ?? 5;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const rawRows: CandidateRow[] = data?.rows ?? [];

  const evaluated = useMemo<EvaluatedRow[]>(() => rawRows.map(c => ({
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

  const actionableCandidates = useMemo(
    () => evaluated.filter(c => c._eval.signal === 'STRONG_SELL' || c._eval.signal === 'SELL'),
    [evaluated]
  );


  // Universe tickers not in the API response (monitoring-only)
  const monitoringTickers = useMemo(() => {
    const inData = new Set(evaluated.map(c => c.ticker));
    return config.tickers.filter(t => !inData.has(t));
  }, [evaluated, config.tickers]);

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

        {/* Suggested trades — shown for actionable tickers */}
        {!loading && actionableCandidates.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>
              Suggested Setups · DP-floor anchored strikes
            </div>
            {actionableCandidates.map(c => (
              <SuggestedTradePanelWithMI key={c.ticker} candidate={c} />
            ))}
          </div>
        )}

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
        {!loading && (filtered.length > 0 || (filterMode === 'all' && monitoringTickers.length > 0)) && (
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
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>Pre-Trade Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <CandidateRowItem
                      key={c.ticker}
                      candidate={c}
                      ivRankThreshold={ivRankThreshold}
                      ivHvSpreadThreshold={ivHvSpreadThreshold}
                      pretradeResult={pretradeMap[c.ticker]}
                    />
                  ))}
                  {/* Universe — Monitoring divider (All tab only) */}
                  {filterMode === 'all' && monitoringTickers.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={7} className="px-4 py-2" style={{ background: 'oklch(0.14 0.010 258)', borderTop: '1px solid oklch(1 0 0 / 8%)', borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
                          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.45 0.010 258)' }}>
                            Universe — Monitoring ({monitoringTickers.length})
                          </span>
                        </td>
                      </tr>
                      {monitoringTickers.map(t => (
                        <MonitoringRow key={t} ticker={t} />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && monitoringTickers.length === 0 && config.apiToken && (
          <EmptyState type="empty" title="No candidates match filter" description="Try changing the filter or refreshing the data." />
        )}

        <div className="text-[10px] font-mono-data" style={{ color: 'oklch(0.40 0.010 258)' }}>
          Source: {data?.source ?? 'GET /api/candidates'} · As of: {data?.as_of ? new Date(data.as_of).toLocaleString() : '—'}
        </div>
      </div>
    </div>
  );
}
