/**
 * FORTRESS V3 — Trade Builder
 * Interactive strategy builder: select ticker → pretrade gate → strategy suggester →
 * PoP / risk calculator → queue ticket to pending orders.
 * IBKR order placement is deferred until backend adds /api/ibkr/order endpoints.
 */

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  useCandidates,
  usePretradeAll,
  useMarketIntelligence,
  useChartLevels,
  evaluateCandidate,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Color constants ──────────────────────────────────────────────────────────
const CYAN   = 'oklch(0.80 0.15 200)';
const GREEN  = 'oklch(0.72 0.18 145)';
const AMBER  = 'oklch(0.78 0.18 85)';
const RED    = 'oklch(0.65 0.22 25)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

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

function TickerSelector({
  selected,
  onSelect,
  candidates,
  loading,
}: {
  selected: string | null;
  onSelect: (t: string) => void;
  candidates: CandidateRow[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toUpperCase();
    return candidates.filter(c => c.ticker.includes(q));
  }, [candidates, search]);

  const sel = candidates.find(c => c.ticker === selected);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded border transition-all"
        style={{
          background: CARD,
          borderColor: selected ? 'oklch(0.80 0.15 200 / 40%)' : BORDER,
          color: BRIGHT,
          minWidth: '200px',
        }}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" style={{ color: DIM }} />
        ) : selected ? (
          <>
            <span className="font-mono-data text-sm font-bold" style={{ color: CYAN }}>{selected}</span>
            {sel && (
              <span className="text-xs font-mono-data" style={{ color: DIM }}>
                IVR {sel.ivr.toFixed(0)} · ${sel.price.toFixed(2)}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ color: DIM }}>Select ticker…</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: DIM }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded border overflow-hidden"
          style={{ background: 'oklch(0.14 0.010 258)', borderColor: BORDER, width: '280px', maxHeight: '320px' }}
        >
          <div className="p-2 border-b" style={{ borderColor: BORDER }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker…"
              className="w-full px-2 py-1.5 rounded text-sm font-mono-data outline-none"
              style={{ background: 'oklch(0.20 0.010 258)', color: BRIGHT, border: '1px solid oklch(1 0 0 / 12%)' }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs" style={{ color: DIM }}>No tickers found</div>
            ) : (
              filtered.map(c => {
                const ev = evaluateCandidate(c);
                return (
                  <button
                    key={c.ticker}
                    onClick={() => { onSelect(c.ticker); setOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[oklch(1_0_0_/_4%)]"
                  >
                    <span className="font-mono-data text-sm font-bold w-14" style={{ color: CYAN }}>{c.ticker}</span>
                    <span className="text-xs font-mono-data" style={{ color: DIM }}>IVR {c.ivr.toFixed(0)}</span>
                    <span className="text-xs font-mono-data ml-auto" style={{ color: ev.color }}>{ev.label}</span>
                  </button>
                );
              })
            )}
          </div>
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
  const regimeColor = regime?.overall === 'bullish' ? GREEN : regime?.overall === 'bearish' ? RED : AMBER;

  return (
    <div className="rounded border p-4 space-y-3" style={{ background: CARD, borderColor: BORDER }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: DIM }}>Market Context</div>

      {regime && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Regime', value: regime.overall?.toUpperCase() ?? '—', color: regimeColor },
            { label: 'Score', value: regime.score != null ? `${regime.score > 0 ? '+' : ''}${regime.score}` : '—', color: regimeColor },
            { label: 'GEX Call Wall', value: regime.gex_call_wall != null ? `$${regime.gex_call_wall.toFixed(0)}` : '—', color: DIM },
            { label: 'GEX Put Wall', value: regime.gex_put_wall != null ? `$${regime.gex_put_wall.toFixed(0)}` : '—', color: DIM },
            { label: 'DP Floor', value: regime.dp_floor != null ? `$${regime.dp_floor.toFixed(0)}` : '—', color: CYAN },
            { label: 'Flip Zone', value: regime.flip_zone != null ? `$${regime.flip_zone.toFixed(0)}` : '—', color: AMBER },
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
                    <div className="flex gap-4 mt-1.5 text-[10px] font-mono-data">
                      {s.entry && <span style={{ color: DIM }}>Entry: <span style={{ color: BRIGHT }}>{s.entry}</span></span>}
                      {s.target && <span style={{ color: DIM }}>Target: <span style={{ color: GREEN }}>{s.target}</span></span>}
                      {s.stop && <span style={{ color: DIM }}>Stop: <span style={{ color: RED }}>{s.stop}</span></span>}
                    </div>
                  )}
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

export default function TradeBuilderPage() {
  const { config } = useConfig();
  const { data: candidatesData, loading: candLoading, refresh: candRefresh } = useCandidates();
  const { data: pretradeData } = usePretradeAll();
  const { addOrder, hasOrder } = usePendingOrders();

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const candidates = candidatesData?.rows ?? [];

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
          onSelect={t => { setSelectedTicker(t); setSelectedStrategy(null); }}
          candidates={candidates}
          loading={candLoading}
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
          </>
        )}
      </div>
    </div>
  );
}
