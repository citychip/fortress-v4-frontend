/**
 * FORTRESS V3 — Trade Builder
 * Interactive strategy builder: select ticker → pretrade gate → strategy suggester →
 * PoP / risk calculator → queue ticket to pending orders.
 * IBKR order placement is deferred until backend adds /api/ibkr/order endpoints.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  useCandidates,
  usePretradeAll,
  useMarketIntelligence,
  useChartLevels,
  usePositions,
  useStopLossAll,
  useRollAll,
  evaluateCandidate,
  regimeInfo,
  type CandidateRow,
  type PretradeResult,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { usePendingOrders } from '@/contexts/PendingOrdersContext';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Zap,
  Target,
  Shield,
  TrendingDown,
  BarChart2,
  Copy,
  Plus,
  RefreshCw,
  Info,
  Lock,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StrategySandbox } from '@/components/StrategySandbox';
import { CYAN, GREEN, AMBER, RED, DIM, BRIGHT, CARD, BORDER, BG, MUTED, PURPLE, ACCENT, CARD2, CARD3, FAINT, CYAN_BG, GREEN_BG, RED_BG, AMBER_BG } from '@/lib/theme';

// ─── Color constants ──────────────────────────────────────────────────────────
// ─── Expiry date helper ──────────────────────────────────────────────────────

/**
 * Find the nearest Friday expiry within the target DTE range.
 * Returns a string like "Jun 20 (35 DTE)".
 */
function getNearestExpiry(minDte: number, maxDte: number): string {
  const today = new Date();
  const targetDte = Math.round((minDte + maxDte) / 2);
  // Start from targetDte and scan ±7 days for a Friday
  for (let offset = 0; offset <= 7; offset++) {
    for (const sign of [1, -1]) {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + targetDte + sign * offset);
      if (candidate.getDay() === 5) { // Friday
        const dte = Math.round((candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const label = candidate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${label} (${dte} DTE)`;
      }
    }
  }
  // Fallback: just show the target date
  const fallback = new Date(today);
  fallback.setDate(today.getDate() + targetDte);
  const label = fallback.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${label} (~${targetDte} DTE)`;
}

// ─── Strategy definitions ─────────────────────────────────────────────────────

interface StrategyDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  legs: number;
  maxProfit: 'credit' | 'limited' | 'unlimited';
  maxLoss: 'limited' | 'unlimited';
  idealIvr: number;    // min IVR for this strategy
  idealDte: [number, number]; // [min, max] DTE
  regimeBias: 'neutral' | 'bullish' | 'bearish';
  icon: React.ElementType;
}

const STRATEGIES: StrategyDef[] = [
  {
    id: 'csp',
    name: 'Cash-Secured Put',
    shortName: 'CSP',
    description: 'Sell OTM put. Bullish-neutral. Collect premium, accept assignment at strike.',
    legs: 1,
    maxProfit: 'credit',
    maxLoss: 'limited',
    idealIvr: 40,
    idealDte: [30, 60],
    regimeBias: 'bullish',
    icon: TrendingDown,
  },
  {
    id: 'pcs',
    name: 'Put Credit Spread',
    shortName: 'PCS',
    description: 'Sell OTM put, buy further OTM put. Defined risk. Best in elevated IV.',
    legs: 2,
    maxProfit: 'credit',
    maxLoss: 'limited',
    idealIvr: 50,
    idealDte: [30, 60],
    regimeBias: 'bullish',
    icon: Shield,
  },
  {
    id: 'strangle',
    name: 'Short Strangle',
    shortName: 'Strangle',
    description: 'Sell OTM call + OTM put. Neutral. High premium, undefined risk.',
    legs: 2,
    maxProfit: 'credit',
    maxLoss: 'unlimited',
    idealIvr: 60,
    idealDte: [30, 60],
    regimeBias: 'neutral',
    icon: BarChart2,
  },
  {
    id: 'ic',
    name: 'Iron Condor',
    shortName: 'IC',
    description: 'PCS + CCS. Neutral. Defined risk on both sides. Best in range-bound high IV.',
    legs: 4,
    maxProfit: 'credit',
    maxLoss: 'limited',
    idealIvr: 55,
    idealDte: [30, 60],
    regimeBias: 'neutral',
    icon: Target,
  },
  {
    id: 'jade_lizard',
    name: 'Jade Lizard',
    shortName: 'Jade Lizard',
    description: 'Short put + short call spread. No upside risk. Bullish-neutral.',
    legs: 3,
    maxProfit: 'credit',
    maxLoss: 'limited',
    idealIvr: 55,
    idealDte: [30, 60],
    regimeBias: 'bullish',
    icon: Zap,
  },
];

// ─── PoP Calculator ───────────────────────────────────────────────────────────

/**
 * Approximate PoP using log-normal model.
 * PoP ≈ N(d2) for short put at strike K, current price S, IV σ, DTE T (years).
 */
function calcPoP(
  price: number,
  strike: number,
  iv: number,   // decimal, e.g. 0.30 for 30%
  dte: number,  // days
): number {
  if (price <= 0 || strike <= 0 || iv <= 0 || dte <= 0) return 0;
  const T = dte / 365;
  const sigma = iv;
  // d2 = (ln(S/K) + (−0.5σ²)T) / (σ√T)
  const d2 = (Math.log(price / strike) - 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
  // Cumulative normal distribution approximation (Abramowitz & Stegun)
  const pop = normalCDF(d2);
  return Math.max(0, Math.min(1, pop));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ─── Ticker selector ──────────────────────────────────────────────────────────

// ─── Trade mode ──────────────────────────────────────────────────────────────
type TradeMode = 'new' | 'add' | 'roll' | 'close';
const TRADE_MODE_LABELS: Record<TradeMode, string> = {
  new: 'New Entry', add: 'Add', roll: 'Roll', close: 'Close',
};

function TickerSelector({
  selected,
  onSelect,
  candidates,
  universeTickers,
  loading,
  positionContextMap,
}: {
  selected: string | null;
  onSelect: (t: string) => void;
  candidates: CandidateRow[];
  universeTickers: string[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');  const sel = candidates.find(c => c.ticker === selected);

  // Build a map of ticker → candidate data for O(1) lookup
  const candidateMap = useMemo(() => {
    const m = new Map<string, CandidateRow>();
    candidates.forEach(c => m.set(c.ticker, c));
    return m;
  }, [candidates]);

  // Active position tickers (urgent first)
  const activeTickers = useMemo(() => {
    if (!positionContextMap?.size) return [];
    const q = search.toUpperCase().trim();
    const all = [...positionContextMap.keys()].filter(t => !q || t.includes(q));
    return all.sort((a, b) => {
      const au = positionContextMap.get(a)!.urgent;
      const bu = positionContextMap.get(b)!.urgent;
      return au === bu ? 0 : au ? -1 : 1;
    });
  }, [positionContextMap, search]);

  // Split universe into READY/NOT READY — exclude active positions
  const { ready, notReady } = useMemo(() => {
    const q = search.toUpperCase().trim();
    const all = universeTickers.filter(t => !q || t.includes(q));
    const r: string[] = [];
    const nr: string[] = [];
    all
      .filter(t => !positionContextMap?.has(t))
      .forEach(t => (candidateMap.has(t) ? r : nr).push(t));
    return { ready: r, notReady: nr };
  }, [universeTickers, candidateMap, positionContextMap, search]);

  // Extra tickers typed that aren't in universe at all
  const freeTextTicker = useMemo(() => {
    const q = search.toUpperCase().trim();
    if (!q) return null;
    if (universeTickers.includes(q)) return null;
    return q;
  }, [universeTickers, search]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded border transition-all"
        style={{
          background: CARD,
          borderColor: selected ? 'oklch(0.80 0.15 200 / 40%)' : BORDER,
          color: BRIGHT,
          minWidth: '220px',
        }}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" style={{ color: DIM }} />
        ) : selected ? (
          <>
            <span className="font-mono-data text-sm font-bold" style={{ color: CYAN }}>{selected}</span>
            {sel ? (
              <span className="text-xs font-mono-data" style={{ color: DIM }}>
                IVR {sel.ivr.toFixed(0)} · ${sel.price.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs font-mono-data" style={{ color: AMBER }}>not in screener</span>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ color: DIM }}>Select ticker…</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: DIM }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded border"
          style={{ background: 'oklch(0.14 0.010 258)', borderColor: BORDER, width: '320px', maxHeight: '400px', overflowY: 'auto' }}
        >
          {/* Search box */}
          <div className="p-2 border-b sticky top-0" style={{ borderColor: BORDER, background: 'oklch(0.14 0.010 258)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker…"
              className="w-full px-2 py-1.5 rounded text-sm font-mono-data outline-none"
              style={{ background: 'oklch(0.20 0.010 258)', color: BRIGHT, border: '1px solid oklch(1 0 0 / 12%)' }}
            />
          </div>

          {/* Active Positions section */}
          {activeTickers.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider flex items-center gap-2"
                style={{ color: CYAN }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: CYAN }} />
                Active positions ({activeTickers.length})
              </div>
              {activeTickers.map(ticker => {
                const ctx = positionContextMap!.get(ticker)!;
                return (
                  <button
                    key={ticker}
                    onClick={() => { onSelect(ticker); setOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[oklch(1_0_0_/_4%)]"
                  >
                    <span className="font-mono-data text-sm font-bold w-16" style={{ color: CYAN }}>{ticker}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: 'oklch(0.80 0.15 200 / 10%)', color: CYAN }}>{ctx.strategy}</span>
                    {ctx.urgent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data ml-auto" style={{ background: 'oklch(0.65 0.22 25 / 12%)', color: 'oklch(0.65 0.22 25)' }}>urgent</span>
                    )}
                  </button>
                );
              })}
              <div className="border-t" style={{ borderColor: BORDER }} />
            </>
          )}
          {/* Free-text: ticker not in universe at all */}
          {freeTextTicker && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Not in universe</div>
              <button
                onClick={() => { onSelect(freeTextTicker); setOpen(false); setSearch(''); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[oklch(1_0_0_/_4%)] border-b"
                style={{ borderColor: BORDER }}
              >
                <span className="font-mono-data text-sm font-bold w-16" style={{ color: CYAN }}>{freeTextTicker}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: 'oklch(0.78 0.18 85 / 12%)', color: AMBER }}>custom</span>
                <span className="text-xs font-mono-data ml-auto" style={{ color: CYAN }}>Use →</span>
              </button>
            </>
          )}

          {/* READY section — tickers that passed screener */}
          {ready.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider flex items-center gap-2"
                style={{ color: 'oklch(0.72 0.18 145)' }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'oklch(0.72 0.18 145)' }} />
                Ready — passed screener ({ready.length})
              </div>
              {ready.map(ticker => {
                const c = candidateMap.get(ticker)!;
                const ev = evaluateCandidate(c);
                return (
                  <button
                    key={ticker}
                    onClick={() => { onSelect(ticker); setOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[oklch(1_0_0_/_4%)]"
                  >
                    <span className="font-mono-data text-sm font-bold w-16" style={{ color: CYAN }}>{ticker}</span>
                    <span className="text-xs font-mono-data" style={{ color: DIM }}>IVR {c.ivr.toFixed(0)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data ml-auto" style={{ background: `${ev.color.replace(')', ' / 12%)')}`, color: ev.color }}>{ev.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* NOT READY section — universe tickers not in screener results */}
          {notReady.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider flex items-center gap-2 border-t"
                style={{ color: DIM, borderColor: BORDER }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: DIM }} />
                Not ready — below screener threshold ({notReady.length})
              </div>
              {notReady.map(ticker => (
                <button
                  key={ticker}
                  onClick={() => { onSelect(ticker); setOpen(false); setSearch(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[oklch(1_0_0_/_4%)]"
                  style={{ opacity: 0.65 }}
                >
                  <span className="font-mono-data text-sm font-bold w-16" style={{ color: DIM }}>{ticker}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: 'oklch(1 0 0 / 5%)', color: DIM }}>low IV rank</span>
                  <span className="text-xs font-mono-data ml-auto" style={{ color: DIM }}>select anyway →</span>
                </button>
              ))}
            </>
          )}

          {ready.length === 0 && notReady.length === 0 && !freeTextTicker && (
            <div className="py-4 text-center text-xs" style={{ color: DIM }}>No tickers found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pretrade Gate ────────────────────────────────────────────────────────────

function PretradeGate({ result }: { result: PretradeResult | null }) {
  if (!result) return null;

  const ok = result.verdict === 'PROCEED';

  return (
    <div
      className="rounded border p-4"
      style={{
        background: ok ? 'oklch(0.72 0.18 145 / 6%)' : 'oklch(0.65 0.22 25 / 6%)',
        borderColor: ok ? 'oklch(0.72 0.18 145 / 30%)' : 'oklch(0.65 0.22 25 / 30%)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {ok ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
        ) : (
          <XCircle className="w-4 h-4" style={{ color: RED }} />
        )}
        <span className="font-mono-data text-sm font-bold" style={{ color: ok ? GREEN : RED }}>
          {ok ? 'PROCEED' : 'BLOCKED'}
        </span>
        <span className="text-xs ml-2" style={{ color: DIM }}>
          VIX {result.vix.toFixed(1)} · DTE {result.days_to_earnings}d to earnings · Concentration {result.concentration_pct.toFixed(1)}%
        </span>
      </div>
      {result.failures.length > 0 && (
        <ul className="space-y-0.5">
          {result.failures.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: RED }}>
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({
  def,
  candidate,
  selected,
  onSelect,
}: {
  def: StrategyDef;
  candidate: CandidateRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const ivrOk = candidate.ivr >= def.idealIvr;
  const Icon = def.icon;

  const score = useMemo(() => {
    let s = 0;
    if (candidate.ivr >= def.idealIvr) s += 2;
    else if (candidate.ivr >= def.idealIvr * 0.75) s += 1;
    if (candidate.spread_pp >= 5) s += 1;
    if (candidate.can_trade) s += 1;
    return Math.min(4, s);
  }, [candidate, def]);

  const scoreColor = score >= 3 ? GREEN : score >= 2 ? AMBER : DIM;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded border p-4 transition-all',
        selected ? 'ring-1' : 'hover:bg-[oklch(1_0_0_/_2%)]'
      )}
      style={{
        background: selected ? 'oklch(0.80 0.15 200 / 8%)' : CARD,
        borderColor: selected ? 'oklch(0.80 0.15 200 / 50%)' : BORDER,
        ...(selected ? { boxShadow: '0 0 0 1px oklch(0.80 0.15 200 / 30%)' } : {}),
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: 'oklch(0.80 0.15 200 / 10%)', color: CYAN }}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{def.shortName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data"
              style={{ background: `${scoreColor}18`, color: scoreColor }}>
              {'★'.repeat(score)}{'☆'.repeat(4 - score)}
            </span>
            {!ivrOk && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'oklch(0.78 0.18 85 / 12%)', color: AMBER }}>
                IVR low
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: DIM }}>{def.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono-data" style={{ color: DIM }}>
            <span>{def.legs} leg{def.legs > 1 ? 's' : ''}</span>
            <span>DTE {def.idealDte[0]}–{def.idealDte[1]}d</span>
            <span>IVR ≥ {def.idealIvr}</span>
            <span style={{ color: def.maxLoss === 'limited' ? GREEN : AMBER }}>
              {def.maxLoss === 'limited' ? 'Defined risk' : 'Undefined risk'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── PoP / Risk Calculator ────────────────────────────────────────────────────

interface CalcState {
  dte: number;
  shortStrike: number;
  longStrike: number;
  qty: number;
  creditPerContract: number;
}

function RiskCalculator({
  candidate,
  strategy,
  onQueue,
}: {
  candidate: CandidateRow;
  strategy: StrategyDef;
  onQueue: (params: CalcState & { pop: number }) => void;
}) {
  const price = candidate.price;
  const iv = (candidate.current_iv ?? 30) / 100;

  // Sensible defaults based on strategy
  const defaultShort = useMemo(() => {
    const delta16 = price * Math.exp(-0.5 * iv * iv * (45 / 365) - iv * Math.sqrt(45 / 365) * 1.0);
    return Math.round(delta16 / 5) * 5;
  }, [price, iv]);

  const [calc, setCalc] = useState<CalcState>({
    dte: 45,
    shortStrike: defaultShort,
    longStrike: Math.round((defaultShort - price * 0.05) / 5) * 5,
    qty: 1,
    creditPerContract: 0,
  });

  const pop = useMemo(() =>
    calcPoP(price, calc.shortStrike, iv, calc.dte),
    [price, calc.shortStrike, iv, calc.dte]
  );

  const maxRisk = useMemo(() => {
    if (strategy.maxLoss === 'unlimited') return null;
    const width = Math.abs(calc.shortStrike - calc.longStrike);
    return (width * 100 - calc.creditPerContract) * calc.qty;
  }, [strategy, calc]);

  const maxProfit = calc.creditPerContract * calc.qty;
  const rr = maxRisk != null && maxRisk > 0 ? maxProfit / maxRisk : null;

  const field = (label: string, key: keyof CalcState, min: number, max: number, step: number) => (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: DIM }}>{label}</label>
      <input
        type="number"
        value={calc[key]}
        min={min}
        max={max}
        step={step}
        onChange={e => setCalc(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
        className="w-full px-3 py-2 rounded border text-sm font-mono-data outline-none"
        style={{ background: 'oklch(0.22 0.010 258)', borderColor: BORDER, color: BRIGHT }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="grid grid-cols-3 gap-3">
        {field('DTE', 'dte', 1, 365, 1)}
        {field('Short Strike', 'shortStrike', 1, 99999, 1)}
        {strategy.legs >= 2 && field('Long Strike', 'longStrike', 1, 99999, 1)}
        {field('Qty (contracts)', 'qty', 1, 100, 1)}
        {field('Credit / Contract ($)', 'creditPerContract', 0, 99999, 0.01)}
      </div>

      {/* Results */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'PoP', value: `${(pop * 100).toFixed(1)}%`, color: pop >= 0.70 ? GREEN : pop >= 0.55 ? AMBER : RED },
          { label: 'Max Profit', value: `$${maxProfit.toFixed(0)}`, color: GREEN },
          { label: 'Max Risk', value: maxRisk != null ? `$${maxRisk.toFixed(0)}` : 'Unlimited', color: maxRisk != null ? AMBER : RED },
          { label: 'R:R', value: rr != null ? `1 : ${(1 / rr).toFixed(1)}` : '—', color: DIM },
        ].map(m => (
          <div key={m.label} className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
            <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{m.label}</div>
            <div className="font-mono-data text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded" style={{ background: 'oklch(0.80 0.15 200 / 6%)', border: '1px solid oklch(0.80 0.15 200 / 15%)' }}>
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: CYAN }} />
        <span style={{ color: DIM }}>
          PoP is a log-normal approximation using current IV ({(iv * 100).toFixed(0)}%). Actual probability depends on skew, term structure, and market conditions.
        </span>
      </div>

      {/* Queue button */}
      <button
        onClick={() => onQueue({ ...calc, pop })}
        className="flex items-center gap-2 px-4 py-2.5 rounded border text-sm font-semibold transition-all hover:bg-[oklch(0.80_0.15_200_/_15%)]"
        style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 40%)' }}
      >
        <Plus className="w-4 h-4" />
        Add to Pending Orders
      </button>
    </div>
  );
}

// ─── Market context panel ─────────────────────────────────────────────────────

function MarketContext({ ticker }: { ticker: string }) {
  const { data: intel } = useMarketIntelligence(ticker);
  const { data: levels } = useChartLevels(ticker);

  if (!intel && !levels) return null;

  const regime = intel?.regime;
  const { label: regimeLabelStr, color: regimeColorKey } = regimeInfo(regime?.overall ?? 'neutral');
  const regimeColor = regimeColorKey === 'green' ? GREEN : regimeColorKey === 'red' ? RED : AMBER;

  // Hydrate GEX walls: prefer regime fields, fall back to top-level gex object
  const callWall = regime?.gex_call_wall ?? intel?.gex?.call_wall;
  const putWall  = regime?.gex_put_wall  ?? intel?.gex?.put_wall;
  const flipZone = regime?.flip_zone     ?? intel?.gex?.flip_zone;
  const dpFloor  = regime?.dp_floor;

  return (
    <div className="rounded border p-4 space-y-3" style={{ background: CARD, borderColor: BORDER }}>
      {/* Ticker-specific label — distinct from the global SPY macro regime in the top bar */}
      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: DIM }}>
        {ticker} Asset Regime
      </div>

      {regime && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Asset Regime', value: regimeLabelStr, color: regimeColor },
            { label: 'Score', value: regime.score != null ? `${regime.score > 0 ? '+' : ''}${regime.score}` : '—', color: regimeColor },
            { label: 'GEX Call Wall', value: callWall != null ? `$${callWall.toFixed(0)}` : '—', color: GREEN },
            { label: 'GEX Put Wall', value: putWall  != null ? `$${putWall.toFixed(0)}`  : '—', color: RED },
            { label: 'DP Floor',     value: dpFloor  != null ? `$${dpFloor.toFixed(0)}`  : '—', color: CYAN },
            { label: 'Flip Zone',    value: flipZone != null ? `$${flipZone.toFixed(0)}` : '—', color: AMBER },
          ].map(m => (
            <div key={m.label} className="rounded p-2" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>{m.label}</div>
              <div className="font-mono-data text-xs font-semibold mt-0.5" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trade setups from market intel */}
      {intel?.trade_setups && intel.trade_setups.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: DIM }}>Suggested Setups</div>
          <div className="space-y-2">
            {intel.trade_setups.slice(0, 3).map((s, i) => {
              const biasColor = s.type === 'bullish' ? GREEN : s.type === 'bearish' ? RED : AMBER;
              return (
                <div key={i} className="rounded border p-3" style={{ background: 'oklch(0.20 0.010 258)', borderColor: `${biasColor}25` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-data text-xs font-bold" style={{ color: biasColor }}>{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${biasColor}18`, color: biasColor }}>{s.confidence}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: DIM }}>{s.description}</p>
                  {(s.entry || s.target || s.stop) && (
                    <div className="flex flex-wrap gap-4 mt-1.5 text-[10px] font-mono-data">
                      {s.entry && <span style={{ color: DIM }}>Entry: <span style={{ color: BRIGHT }}>{s.entry}</span></span>}
                      {s.target && <span style={{ color: DIM }}>Target: <span style={{ color: GREEN }}>{s.target}</span></span>}
                      {s.stop && <span style={{ color: DIM }}>Stop: <span style={{ color: RED }}>{s.stop}</span></span>}
                    </div>
                  )}
                  {/* Expiry date: map setup name to nearest matching strategy's idealDte */}
                  {(() => {
                    const sn = s.name.toLowerCase();
                    const matched = STRATEGIES.find(def =>
                      sn.includes(def.shortName.toLowerCase()) ||
                      sn.includes(def.id.toLowerCase()) ||
                      sn.includes(def.name.toLowerCase().split(' ')[0])
                    );
                    const [minDte, maxDte] = matched?.idealDte ?? [30, 60];
                    return (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-mono-data" style={{ color: DIM }}>
                        <Calendar className="w-3 h-3" />
                        <span>Expiry: <span style={{ color: CYAN }}>{getNearestExpiry(minDte, maxDte)}</span></span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key levels */}
      {levels && (levels.dp_floors.length > 0 || levels.support.length > 0) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: DIM }}>Key Levels</div>
          <div className="flex flex-wrap gap-1.5">
            {levels.dp_floors.slice(0, 3).map(l => (
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'oklch(0.80 0.15 200 / 10%)', color: CYAN }}>
                DP ${l.toFixed(0)}
              </span>
            ))}
            {levels.support.slice(0, 3).map(l => (
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'oklch(0.72 0.18 145 / 10%)', color: GREEN }}>
                S ${l.toFixed(0)}
              </span>
            ))}
            {levels.resistance.slice(0, 3).map(l => (
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'oklch(0.65 0.22 25 / 10%)', color: RED }}>
                R ${l.toFixed(0)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Candidate summary bar ────────────────────────────────────────────────────

function CandidateSummaryBar({ candidate }: { candidate: CandidateRow }) {
  const ev = evaluateCandidate(candidate);
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded border" style={{ background: CARD, borderColor: BORDER }}>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Price</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>${candidate.price.toFixed(2)}</div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>IV Rank</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: candidate.ivr >= 50 ? AMBER : DIM }}>{candidate.ivr.toFixed(0)}</div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>IV</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{candidate.current_iv.toFixed(1)}%</div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>HV20</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: DIM }}>{candidate.hv20.toFixed(1)}%</div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>IV/HV Spread</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: candidate.spread_pp >= 5 ? GREEN : DIM }}>
          {candidate.spread_pp >= 0 ? '+' : ''}{candidate.spread_pp.toFixed(1)}pp
        </div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>DTE Earnings</div>
        <div className="font-mono-data text-sm font-bold" style={{ color: candidate.days_to_earnings <= 14 ? AMBER : DIM }}>
          {candidate.days_to_earnings}d
        </div>
      </div>
      <div className="ml-auto">
        <span className="text-xs px-2 py-1 rounded font-semibold"
          style={{ background: `${ev.color}18`, color: ev.color }}>
          {ev.label}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TradeBuilderPage({
  embedded = false,
  initialTicker = null,
  initialMode = 'new' as TradeMode,
  initialLeg = null,
}: {
  embedded?: boolean;
  initialTicker?: string | null;
  initialMode?: TradeMode;
  initialLeg?: string | null;
} = {}) {
  const { config } = useConfig();
  const { data: candidatesData, loading: candLoading, refresh: candRefresh } = useCandidates();
  const { data: pretradeData } = usePretradeAll();
  const { addOrder, hasOrder } = usePendingOrders();
  const { data: positionsData } = usePositions();
  const { data: rollData } = useRollAll();
  const { data: stopLossData } = useStopLossAll();

  const [selectedTicker, setSelectedTicker] = useState<string | null>(() => {
    if (initialTicker) return initialTicker;
    const preselect = sessionStorage.getItem('fortress_tradebuilder_ticker');
    if (preselect) { sessionStorage.removeItem('fortress_tradebuilder_ticker'); return preselect; }
    return null;
  });
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [mode, setMode] = useState<TradeMode>(initialMode);
  const [legId, setLegId] = useState<string | null>(initialLeg);

  const candidates = candidatesData?.rows ?? [];

  const positionContextMap = useMemo(() => {
    const map = new Map<string, { strategy: string; urgent: boolean }>();
    const rollTickers = new Set<string>((rollData as any)?.positions?.map((p: any) => p.ticker) ?? []);
    const stopTickers = new Set<string>((stopLossData as any)?.positions?.map((p: any) => p.ticker) ?? []);
    ((positionsData as any)?.positions ?? []).forEach((p: any) => {
      if (!map.has(p.ticker)) {
        map.set(p.ticker, { strategy: p.strategy ?? '', urgent: rollTickers.has(p.ticker) || stopTickers.has(p.ticker) });
      }
    });
    return map;
  }, [positionsData, rollData, stopLossData]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSelectedStrategy(null);
    setLegId(null);
  }, [selectedTicker, mode]);

  const candidate = useMemo(
    () => candidates.find(c => c.ticker === selectedTicker) ?? null,
    [candidates, selectedTicker]
  );

  const pretradeResult = useMemo(
    () => pretradeData?.results.find(r => r.ticker === selectedTicker) ?? null,
    [pretradeData, selectedTicker]
  );

  const strategyDef = useMemo(
    () => STRATEGIES.find(s => s.id === selectedStrategy) ?? null,
    [selectedStrategy]
  );

  const handleQueue = useCallback((params: CalcState & { pop: number }) => {
    if (!candidate || !strategyDef) return;
    addOrder({
      ticker: candidate.ticker,
      strategy: strategyDef.shortName,
      shortStrike: params.shortStrike,
      longStrike: params.longStrike,
      expiry: `${params.dte}d`,
      creditMin: Math.round(params.creditPerContract * 0.9),
      creditMax: Math.round(params.creditPerContract * 1.1),
      qty: params.qty,
      rationale: `PoP ${(params.pop * 100).toFixed(1)}% · IVR ${candidate.ivr.toFixed(0)} · ${strategyDef.shortName}`,
      dpFloorUsed: undefined,
    });
    toast.success(`${candidate.ticker} ${strategyDef.shortName} queued in Pending Orders`);
  }, [candidate, strategyDef, addOrder]);

  const handleCopyTicket = useCallback(() => {
    if (!candidate || !strategyDef) return;
    const text = `SELL ${strategyDef.shortName} ${candidate.ticker} · IVR ${candidate.ivr.toFixed(0)} · IV ${candidate.current_iv.toFixed(1)}% · ${new Date().toLocaleDateString()}`;
    navigator.clipboard.writeText(text);
    toast.success('Trade ticket copied to clipboard');
  }, [candidate, strategyDef]);

  if (!config.apiToken) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Trade Builder" subtitle="Strategy builder · PoP calculator · Order queue" />
        <div className="p-6">
          <EmptyState type="no-config" title="API token required" description="Configure your API URL and token in Settings." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Trade Builder"
        subtitle="Strategy builder · PoP calculator · Order queue"
        onRefresh={candRefresh}
        refreshing={candLoading}
      >
        {/* Ticker selector in header */}
        <TickerSelector
          selected={selectedTicker}
          onSelect={t => { setSelectedTicker(t); setSelectedStrategy(null); setMode('new'); setLegId(null); }}
          candidates={candidates}
          universeTickers={config.tickers}
          loading={candLoading}
          positionContextMap={positionContextMap}
        />
        {candidate && strategyDef && (
          <button
            onClick={handleCopyTicket}
            className="flex items-center gap-1.5 px-3 py-2 rounded border text-xs transition-all hover:opacity-80"
            style={{ color: DIM, borderColor: BORDER }}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Ticket
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-5">
        {selectedTicker && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: DIM }}>Mode:</span>
            {(Object.keys(TRADE_MODE_LABELS) as TradeMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="px-3 py-1 rounded border text-[11px] font-mono-data transition-all"
                style={{ background: mode === m ? 'oklch(0.80 0.15 200 / 12%)' : 'transparent', borderColor: mode === m ? 'oklch(0.80 0.15 200 / 40%)' : BORDER, color: mode === m ? CYAN : DIM }}>
                {TRADE_MODE_LABELS[m]}
              </button>
            ))}
            {legId && <span className="text-[10px] font-mono-data ml-2 px-2 py-0.5 rounded" style={{ background: 'oklch(0.78 0.18 85 / 10%)', color: AMBER }}>leg: {legId}</span>}
          </div>
        )}
        {!selectedTicker ? (
          <div className="rounded border py-16 text-center" style={{ borderColor: BORDER }}>
            <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: DIM }} />
            <p className="text-sm font-semibold" style={{ color: BRIGHT }}>Select a ticker to begin</p>
            <p className="text-xs mt-1" style={{ color: DIM }}>Choose from your universe using the dropdown above</p>
          </div>
        ) : (
          <>
            {/* Step 1: Candidate summary */}
            {candidate && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Step 1 — Candidate Overview
                </div>
                <CandidateSummaryBar candidate={candidate} />
              </div>
            )}

            {/* Step 2: Pretrade gate */}
            {pretradeResult && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Step 2 — Pre-Trade Gate
                </div>
                <PretradeGate result={pretradeResult} />
              </div>
            )}

            {/* Two-column layout: strategies + market context */}
            {/* Warning banner: pre-trade gate failed — behaviour depends on signal mode */}
            <div className="relative">
              {(() => {
                const signalMode = config.traderProfile?.signalMode ?? 'advisory';
                const hasFail = pretradeResult && pretradeResult.verdict !== 'PROCEED';
                if (!hasFail) return null;
                if (signalMode === 'sandbox') return null; // silent in sandbox
                if (signalMode === 'strict') {
                  return (
                    <div
                      className="flex items-start gap-3 rounded-lg px-4 py-3 mb-3"
                      style={{ background: 'oklch(0.65 0.22 25 / 18%)', border: '1px solid oklch(0.65 0.22 25 / 60%)' }}
                    >
                      <Lock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
                      <div>
                        <p className="font-mono-data text-xs font-bold" style={{ color: 'oklch(0.65 0.22 25)' }}>PRE-TRADE GATE BLOCKED — STRICT MODE</p>
                        <p className="text-[11px] mt-0.5" style={{ color: DIM }}>
                          Signal mode is set to Strict. One or more pre-trade checks failed. Change to Advisory or Sandbox mode in the Strategy Workspace to proceed.
                        </p>
                      </div>
                    </div>
                  );
                }
                // advisory (default)
                return (
                  <div
                    className="flex items-start gap-3 rounded-lg px-4 py-3 mb-3"
                    style={{ background: 'oklch(0.65 0.22 25 / 10%)', border: '1px solid oklch(0.65 0.22 25 / 35%)' }}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: AMBER }} />
                    <div>
                      <p className="font-mono-data text-xs font-bold" style={{ color: AMBER }}>PRE-TRADE WARNINGS ACTIVE — ADVISORY MODE</p>
                      <p className="text-[11px] mt-0.5" style={{ color: DIM }}>
                        One or more pre-trade checks flagged issues above. Review before entering — you can still proceed at your discretion.
                      </p>
                    </div>
                  </div>
                );
              })()}
            <div className="grid grid-cols-3 gap-5">
              {/* Step 3: Strategy selection */}
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Step 3 — Select Strategy
                </div>
                <div className="space-y-2">
                  {candidate && STRATEGIES.map(def => (
                    <StrategyCard
                      key={def.id}
                      def={def}
                      candidate={candidate}
                      selected={selectedStrategy === def.id}
                      onSelect={() => setSelectedStrategy(def.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Market context sidebar */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Market Context
                </div>
                <MarketContext ticker={selectedTicker} />
              </div>
            </div>
            </div>{/* end BLOCKED overlay wrapper */}

            {/* Step 4: PoP / Risk calculator */}
            {candidate && strategyDef && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Step 4 — PoP &amp; Risk Calculator
                </div>
                <div className="rounded border p-5" style={{ background: CARD, borderColor: BORDER }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-mono-data text-sm font-bold" style={{ color: CYAN }}>{selectedTicker}</span>
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: CYAN }}>
                      {strategyDef.shortName}
                    </span>
                    {hasOrder(selectedTicker) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'oklch(0.72 0.18 145 / 12%)', color: GREEN }}>
                        ✓ Already queued
                      </span>
                    )}
                  </div>
                  <RiskCalculator
                    candidate={candidate}
                    strategy={strategyDef}
                    onQueue={handleQueue}
                  />
                </div>
              </div>
            )}

            {/* Step 5 — Strategy Sandbox (live-wired to selected ticker) */}
            {selectedTicker && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: DIM }}>
                  Step 5 — Strategy Sandbox
                </div>
                <StrategySandbox
                  ticker={selectedTicker}
                  hideTickerSelect
                  collapsed={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
