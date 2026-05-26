/**
 * FORTRESS V3 — Strategy Workspace
 * Non-enforcing tactical decision-support layer.
 * Zone 0: Header bar (persona, regime, signal mode)
 * Zone 1: Trader Profile (persona cards, active strategies, live narrative)
 * Zone 2: Volatility Regime Playbook (IV×GEX matrix, parameter overrides, full params)
 * Zone 3: Strategy Sandbox (candidate screener, payoff curve, metrics, export)
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  useConfig,
  TraderPersona, RiskTolerance, PrimaryObjective, SignalMode, StrategyType,
  DEFAULT_STRATEGY, DEFAULT_TRADER_PROFILE,
  downloadStrategyProfile,
} from '@/contexts/ConfigContext';
import { useMarketIntelligence, useCandidates, regimeInfo } from '@/hooks/useApi';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield, TrendingUp, Zap, BarChart2, DollarSign,
  ChevronDown, ChevronRight, Download, Upload, RotateCcw,
  AlertTriangle, CheckCircle2, Info, ArrowRight, Lock, Unlock, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Persona Definitions ──────────────────────────────────────────────────────
const PERSONAS: {
  id: TraderPersona;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultStrategies: StrategyType[];
  risk: RiskTolerance;
  objective: PrimaryObjective;
  color: string;
}[] = [
  {
    id: 'income_seeker',
    label: 'Income Seeker',
    icon: <DollarSign className="w-4 h-4" />,
    description: 'Conservative yield-focused trader. Generates steady premium income by selling options against owned stocks or cash. Primary strategies: Covered Call, Cash-Secured Put, and the Wheel. Defined risk only, low DTE, tight stops, conservative notional.',
    defaultStrategies: ['CSP', 'COVERED_CALL', 'PMCC'],
    risk: 'conservative',
    objective: 'income',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  {
    id: 'strategic_speculator',
    label: 'Strategic Speculator',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Directional trader seeking leverage on price movement. Uses long calls/puts and vertical spreads to express a view with defined risk. Higher risk tolerance, wider position sizing, shorter holding periods, aggressive growth.',
    defaultStrategies: ['BULL_CALL_SPREAD', 'BEAR_PUT_SPREAD', 'BULL_PUT_SPREAD', 'BEAR_CALL_SPREAD', 'LEAPS'],
    risk: 'aggressive',
    objective: 'growth',
    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  {
    id: 'volatility_trader',
    label: 'Volatility Trader',
    icon: <Zap className="w-4 h-4" />,
    description: 'Non-directional trader who profits from volatility expansion or contraction. Trades Straddles, Strangles, Iron Condors, and Butterflies. Does not care about direction — only about how much the underlying moves.',
    defaultStrategies: ['IRON_CONDOR', 'SHORT_STRANGLE', 'SHORT_STRADDLE', 'IRON_BUTTERFLY', 'JADE_LIZARD'],
    risk: 'moderate',
    objective: 'income',
    color: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
  },
  {
    id: 'portfolio_protector',
    label: 'Portfolio Protector',
    icon: <Shield className="w-4 h-4" />,
    description: 'Risk manager who uses options as insurance for an existing stock portfolio. Trades Collars, Protective Puts, and SPY hedges. Willing to sacrifice some upside to protect against crashes.',
    defaultStrategies: ['COLLAR', 'PROTECTIVE_PUT', 'SPY_HEDGE', 'COVERED_CALL'],
    risk: 'conservative',
    objective: 'protection',
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    id: 'pmcc_income',
    label: 'PMCC Income',
    icon: <BarChart2 className="w-4 h-4" />,
    description: 'Poor Man\'s Covered Call income strategy. Buys deep ITM LEAPs as a stock substitute and sells short-dated OTM calls against them. Combines income generation with leveraged long exposure. Current Fortress default.',
    defaultStrategies: ['PMCC', 'CSP', 'IRON_CONDOR', 'JADE_LIZARD', 'COVERED_CALL'],
    risk: 'moderate',
    objective: 'income',
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  },
];

// ─── Strategy Checklist Groups ─────────────────────────────────────────────────
const STRATEGY_GROUPS: { label: string; color: string; items: { id: StrategyType; label: string }[] }[] = [
  {
    label: 'Income',
    color: 'text-emerald-400',
    items: [
      { id: 'CSP', label: 'Cash-Secured Put' },
      { id: 'PMCC', label: 'PMCC' },
      { id: 'COVERED_CALL', label: 'Covered Call' },
    ],
  },
  {
    label: 'Directional',
    color: 'text-blue-400',
    items: [
      { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spread' },
      { id: 'BEAR_PUT_SPREAD', label: 'Bear Put Spread' },
      { id: 'BULL_PUT_SPREAD', label: 'Bull Put Spread' },
      { id: 'BEAR_CALL_SPREAD', label: 'Bear Call Spread' },
      { id: 'LEAPS', label: 'LEAPS' },
    ],
  },
  {
    label: 'Volatility',
    color: 'text-violet-400',
    items: [
      { id: 'IRON_CONDOR', label: 'Iron Condor' },
      { id: 'SHORT_STRANGLE', label: 'Short Strangle' },
      { id: 'SHORT_STRADDLE', label: 'Short Straddle' },
      { id: 'IRON_BUTTERFLY', label: 'Iron Butterfly' },
      { id: 'JADE_LIZARD', label: 'Jade Lizard' },
    ],
  },
  {
    label: 'Protection',
    color: 'text-amber-400',
    items: [
      { id: 'COLLAR', label: 'Collar' },
      { id: 'PROTECTIVE_PUT', label: 'Protective Put' },
      { id: 'SPY_HEDGE', label: 'SPY Hedge' },
    ],
  },
];

// ─── Regime Playbook Matrix ────────────────────────────────────────────────────
const REGIME_CELLS: {
  id: string;
  ivLabel: string;
  gexLabel: string;
  ivHigh: boolean;
  gexPos: boolean;
  title: string;
  strategies: string[];
  description: string;
  color: string;
}[] = [
  {
    id: 'high_iv_pos_gex',
    ivLabel: 'High IVR',
    gexLabel: 'Positive GEX',
    ivHigh: true, gexPos: true,
    title: 'Pinned + Rich Premium',
    strategies: ['Iron Condor', 'Jade Lizard', 'Short Strangle'],
    description: 'Market is pinned by dealer hedging. Sell premium in both directions with defined wings.',
    color: 'border-emerald-500/50 bg-emerald-500/10',
  },
  {
    id: 'high_iv_neg_gex',
    ivLabel: 'High IVR',
    gexLabel: 'Negative GEX',
    ivHigh: true, gexPos: false,
    title: 'Volatile + Rich Premium',
    strategies: ['CSP at DP Floor', 'Bull Put Spread', 'PMCC'],
    description: 'Dealers amplify moves. Sell puts at key support levels. Avoid short calls.',
    color: 'border-red-500/50 bg-red-500/10',
  },
  {
    id: 'low_iv_pos_gex',
    ivLabel: 'Low IVR',
    gexLabel: 'Positive GEX',
    ivHigh: false, gexPos: true,
    title: 'Pinned + Cheap Premium',
    strategies: ['LEAPS', 'Calendar Spread', 'Covered Call'],
    description: 'Low vol, pinned price. Buy long-dated exposure cheaply. Sell near-term calls for carry.',
    color: 'border-blue-500/50 bg-blue-500/10',
  },
  {
    id: 'low_iv_neg_gex',
    ivLabel: 'Low IVR',
    gexLabel: 'Negative GEX',
    ivHigh: false, gexPos: false,
    title: 'Trending + Cheap Premium',
    strategies: ['LEAPS', 'Bull Call Spread', 'Directional Debit'],
    description: 'Trend likely to continue. Buy directional exposure. Avoid selling premium.',
    color: 'border-amber-500/50 bg-amber-500/10',
  },
];

// ─── Signal Mode Config ────────────────────────────────────────────────────────
const SIGNAL_MODES: { id: SignalMode; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  {
    id: 'strict',
    label: 'Strict',
    icon: <Lock className="w-3.5 h-3.5" />,
    description: 'Hard blocks in Trade Builder when risk limits are crossed. No override.',
    color: 'border-red-500/60 bg-red-500/15 text-red-300',
  },
  {
    id: 'advisory',
    label: 'Advisory',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    description: 'Amber warning banners shown. Trade Builder still generates tickets with "Risk Accepted" sign-off.',
    color: 'border-amber-500/60 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    icon: <Eye className="w-3.5 h-3.5" />,
    description: 'All portfolio limits ignored. Purely hypothetical evaluation — no live signals.',
    color: 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300',
  },
];

// ─── Live Narrative Generator ─────────────────────────────────────────────────
function generateNarrative(
  persona: TraderPersona,
  strategies: StrategyType[],
  risk: RiskTolerance,
  objective: PrimaryObjective,
  signalMode: SignalMode,
): string {
  const personaLabels: Record<TraderPersona, string> = {
    income_seeker: 'Income Seeker',
    strategic_speculator: 'Strategic Speculator',
    volatility_trader: 'Volatility Trader',
    portfolio_protector: 'Portfolio Protector',
    pmcc_income: 'PMCC Income',
  };
  const riskLabels: Record<RiskTolerance, string> = {
    conservative: 'conservative',
    moderate: 'moderate',
    aggressive: 'aggressive',
  };
  const objectiveLabels: Record<PrimaryObjective, string> = {
    income: 'income generation',
    growth: 'capital growth',
    protection: 'portfolio protection',
  };
  const modeLabels: Record<SignalMode, string> = {
    strict: 'Strict (hard blocks on violations)',
    advisory: 'Advisory (warnings, user decides)',
    sandbox: 'Sandbox (limits ignored)',
  };

  const stratList = strategies.length > 0 ? strategies.join(', ') : 'none selected';
  const personaDef = PERSONAS.find(p => p.id === persona);

  return `You are configured as a ${personaLabels[persona]} trader with ${riskLabels[risk]} risk tolerance, ` +
    `focused on ${objectiveLabels[objective]}. ` +
    `${personaDef?.description ?? ''} ` +
    `Active strategies: ${stratList}. ` +
    `Signal mode is set to ${modeLabels[signalMode]} — the dashboard will ${
      signalMode === 'strict' ? 'block trades that violate your risk parameters' :
      signalMode === 'advisory' ? 'warn you of violations but allow you to proceed at your discretion' :
      'ignore all portfolio limits for hypothetical evaluation'
    }.`;
}

// ─── Color constants (sandbox) ──────────────────────────────────────────────
const SB_CYAN   = 'oklch(0.80 0.15 200)';
const SB_GREEN  = 'oklch(0.72 0.18 145)';
const SB_AMBER  = 'oklch(0.78 0.18 85)';
const SB_RED    = 'oklch(0.65 0.22 25)';
const SB_DIM    = 'oklch(0.55 0.010 258)';
const SB_BRIGHT = 'oklch(0.93 0.005 258)';
const SB_CARD   = 'oklch(0.17 0.010 258)';
const SB_BORDER = 'oklch(1 0 0 / 9%)';

// ─── Payoff math helpers ──────────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function calcPoP(price: number, strike: number, iv: number, dte: number): number {
  if (price <= 0 || strike <= 0 || iv <= 0 || dte <= 0) return 0;
  const T = dte / 365;
  const d2 = (Math.log(price / strike) - 0.5 * iv * iv * T) / (iv * Math.sqrt(T));
  return Math.max(0, Math.min(1, normalCDF(d2)));
}

/**
 * Build payoff curve data points for a short put strategy.
 * x-axis: underlying price at expiry (±3σ range)
 * y-axis: P&L in $ per contract (credit received minus intrinsic loss)
 */
function buildPayoffData(
  spot: number,
  delta: number,   // target short delta (0.05–0.50)
  dte: number,     // days to expiry
  iv: number,      // decimal IV, e.g. 0.30
  strategyId: string,
): { price: number; pnl: number }[] {
  if (spot <= 0 || iv <= 0 || dte <= 0) return [];

  const T = dte / 365;
  const sigma = iv;
  // Strike approximation from delta using Black-Scholes inverse
  // For a short put at target delta: K ≈ S * exp(N^{-1}(delta) * σ√T - 0.5σ²T)
  // We use a numerical approach: find K such that N(-d1) ≈ delta
  // Simple approximation: K = S * exp(z * sigma * sqrt(T)) where z = N^{-1}(delta)
  // Using a simple z-score table approximation for delta
  const zTable: [number, number][] = [
    [0.05, -1.645], [0.10, -1.282], [0.15, -1.036], [0.16, -0.994],
    [0.20, -0.842], [0.25, -0.674], [0.30, -0.524], [0.35, -0.385],
    [0.40, -0.253], [0.45, -0.126], [0.50, 0.0],
  ];
  let z = -0.842; // default 0.20 delta
  for (let i = 0; i < zTable.length - 1; i++) {
    const [d1, z1] = zTable[i];
    const [d2, z2] = zTable[i + 1];
    if (delta >= d1 && delta <= d2) {
      const t = (delta - d1) / (d2 - d1);
      z = z1 + t * (z2 - z1);
      break;
    }
    if (delta > zTable[zTable.length - 1][0]) z = 0;
    if (delta < zTable[0][0]) z = -2.0;
  }

  const strike = spot * Math.exp(z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
  // Estimated credit: roughly IV * sqrt(T/365) * spot * delta (simplified)
  const credit = Math.max(0.5, spot * sigma * Math.sqrt(T) * 0.4 * delta * 100) / 100;
  const creditPerContract = Math.round(credit * 100) / 100;

  // Price range: spot ± 3σ
  const rangeWidth = spot * sigma * Math.sqrt(T) * 3;
  const priceMin = Math.max(1, spot - rangeWidth);
  const priceMax = spot + rangeWidth;
  const steps = 60;
  const stepSize = (priceMax - priceMin) / steps;

  const isSpread = ['IRON_CONDOR', 'BULL_PUT_SPREAD', 'BEAR_CALL_SPREAD', 'BULL_CALL_SPREAD', 'BEAR_PUT_SPREAD', 'IRON_BUTTERFLY', 'JADE_LIZARD'].includes(strategyId);
  const wingWidth = spot * 0.04; // ~4% wing width

  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = priceMin + i * stepSize;
    let pnl: number;

    if (strategyId === 'IRON_CONDOR' || strategyId === 'IRON_BUTTERFLY') {
      // Short put + short call, both with wings
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putLoss = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      const maxLoss = wingWidth * 100;
      pnl = creditPerContract * 2 * 100 - Math.min(putLoss + callLoss, maxLoss);
    } else if (strategyId === 'SHORT_STRANGLE' || strategyId === 'SHORT_STRADDLE') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putLoss = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 2 * 100 - putLoss - callLoss;
    } else if (strategyId === 'BULL_PUT_SPREAD') {
      const longStrike = strike - wingWidth;
      const putLoss = Math.max(0, strike - price) * 100;
      const longGain = Math.max(0, longStrike - price) * 100;
      pnl = creditPerContract * 100 - putLoss + longGain;
    } else if (strategyId === 'COVERED_CALL') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 100 - callLoss;
    } else if (strategyId === 'COLLAR') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putGain = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 100 + putGain - callLoss;
    } else {
      // Default: short put (CSP, PMCC, JADE_LIZARD, etc.)
      const putLoss = Math.max(0, strike - price) * 100;
      if (isSpread) {
        const longStrike = strike - wingWidth;
        const longGain = Math.max(0, longStrike - price) * 100;
        pnl = creditPerContract * 100 - putLoss + longGain;
      } else {
        pnl = creditPerContract * 100 - putLoss;
      }
    }
    return { price: Math.round(price * 100) / 100, pnl: Math.round(pnl * 100) / 100 };
  });
}

// ─── Parameter Row Component ──────────────────────────────────────────────────
function ParamRow({
  label, tooltip, value, onChange, min, max, step, format,
}: {
  label: string;
  tooltip?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
      <div className="w-52 shrink-0">
        <span className="text-xs text-zinc-300">{label}</span>
        {tooltip && <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{tooltip}</p>}
      </div>
      <div className="flex-1">
        <Slider
          min={min} max={max} step={step}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          className="w-full"
        />
      </div>
      <div className="w-20 text-right text-xs font-mono text-cyan-300">{fmt(value)}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StrategyPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { config, updateTraderProfile, updateStrategy, setSignalMode, resetStrategyToDefaults, importStrategyProfile } = useConfig();
  const { traderProfile, strategy } = config;
  const [, navigate] = useLocation();

  // Zone 2 collapsibles
  const [paramsOpen, setParamsOpen] = useState(false);
  const [activeRegimeCell, setActiveRegimeCell] = useState<string | null>(null);

  // Backup/Restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SPY market intel for regime badge
  const spyIntel = useMarketIntelligence('SPY');

  const spyRegime = (spyIntel.data as any)?.regime?.overall ?? 'UNKNOWN';
  const spyIvr = (spyIntel.data as any)?.regime?.iv_rank ?? null;
  const spyGex = (spyIntel.data as any)?.regime?.gex_regime ?? null;

  // Determine active regime cell from live data
  const liveRegimeCell = useMemo(() => {
    if (spyIvr === null || spyGex === null) return null;
    const ivHigh = spyIvr >= (strategy.ivHighThreshold ?? 50);
    const gexPos = spyGex === 'POSITIVE' || spyGex === 'positive';
    if (ivHigh && gexPos) return 'high_iv_pos_gex';
    if (ivHigh && !gexPos) return 'high_iv_neg_gex';
    if (!ivHigh && gexPos) return 'low_iv_pos_gex';
    return 'low_iv_neg_gex';
  }, [spyIvr, spyGex, strategy.ivHighThreshold]);

  const effectiveRegimeCell = activeRegimeCell ?? liveRegimeCell;

  // Narrative
  const narrative = useMemo(() =>
    generateNarrative(
      traderProfile.persona,
      traderProfile.activeStrategies,
      traderProfile.riskTolerance,
      traderProfile.primaryObjective,
      traderProfile.signalMode,
    ),
    [traderProfile],
  );

  // Toggle strategy
  const toggleStrategy = useCallback((id: StrategyType) => {
    const current = traderProfile.activeStrategies;
    const next = current.includes(id)
      ? current.filter(s => s !== id)
      : [...current, id];
    updateTraderProfile({ activeStrategies: next });
  }, [traderProfile.activeStrategies, updateTraderProfile]);

  // Apply persona defaults
  const applyPersona = useCallback((persona: TraderPersona) => {
    const def = PERSONAS.find(p => p.id === persona);
    if (!def) return;
    updateTraderProfile({
      persona,
      activeStrategies: def.defaultStrategies,
      riskTolerance: def.risk,
      primaryObjective: def.objective,
    });
  }, [updateTraderProfile]);

  // Backup/Restore handlers
  const handleExport = useCallback(() => {
    downloadStrategyProfile(config, `${PERSONAS.find(p => p.id === traderProfile.persona)?.label ?? 'Fortress'} Profile`);
    toast.success('Strategy profile exported as JSON');
  }, [config, traderProfile.persona]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const result = importStrategyProfile(json);
      if (result.ok) {
        toast.success(`Profile restored: ${result.profileName ?? 'Unknown'}`);
      } else {
        toast.error(`Import failed: ${result.error}`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, [importStrategyProfile]);

  const handleResetToDefaults = useCallback(() => {
    resetStrategyToDefaults();
    toast.success('Strategy reset to defaults');
  }, [resetStrategyToDefaults]);

  const currentSignalMode = SIGNAL_MODES.find(m => m.id === traderProfile.signalMode) ?? SIGNAL_MODES[1];

  // ── Zone 3: Sandbox state ─────────────────────────────────────────────────
  const { data: candidatesData } = useCandidates();
  const candidateTickers = useMemo(() =>
    (candidatesData?.rows ?? []).filter(r => r.can_trade).map(r => r.ticker).slice(0, 20),
    [candidatesData],
  );
  const [sandboxTicker, setSandboxTicker] = useState<string>('');
  const [sandboxStrategy, setSandboxStrategy] = useState<string>(
    traderProfile.activeStrategies[0] ?? 'CSP',
  );
  const [sandboxDte, setSandboxDte] = useState<number>(strategy.targetDte ?? 45);
  const [sandboxDelta, setSandboxDelta] = useState<number>(strategy.deltaAlertThreshold ?? 0.30);

  // Effective ticker: user pick or first candidate or fallback 'SPY'
  const effectiveTicker = sandboxTicker || candidateTickers[0] || 'SPY';

  // Export to Trade Builder — passes sandbox selections as query params
  const handleExportToTradeBuilder = useCallback(() => {
    const params = new URLSearchParams({
      strategy: sandboxStrategy || traderProfile.activeStrategies[0] || 'CSP',
      mode: traderProfile.signalMode,
      ticker: effectiveTicker,
      dte: String(sandboxDte),
      delta: String(sandboxDelta),
    });
    navigate(`/trade-builder?${params.toString()}`);
  }, [sandboxStrategy, sandboxDte, sandboxDelta, effectiveTicker, traderProfile, navigate]);

  // Market intel for the sandbox ticker
  const { data: sbIntel, loading: sbLoading } = useMarketIntelligence(effectiveTicker);
  const sbSpot = sbIntel?.current_price ?? 0;
  const sbIv = useMemo(() => {
    const candidate = candidatesData?.rows?.find(r => r.ticker === effectiveTicker);
    return candidate ? candidate.current_iv / 100 : 0.30;
  }, [candidatesData, effectiveTicker]);
  const sbGexCall = sbIntel?.regime?.gex_call_wall ?? sbIntel?.gex?.call_wall ?? null;
  const sbGexPut  = sbIntel?.regime?.gex_put_wall  ?? sbIntel?.gex?.put_wall  ?? null;
  const sbDpFloor = sbIntel?.regime?.dp_floor ?? null;
  const sbDpCeil  = sbIntel?.regime?.dp_ceiling ?? null;

  // Payoff curve
  const payoffData = useMemo(() =>
    buildPayoffData(sbSpot, sandboxDelta, sandboxDte, sbIv, sandboxStrategy),
    [sbSpot, sandboxDelta, sandboxDte, sbIv, sandboxStrategy],
  );

  // Derived sandbox metrics
  const sandboxMetrics = useMemo(() => {
    if (!payoffData.length || sbSpot <= 0) return null;
    const maxPnl = Math.max(...payoffData.map(d => d.pnl));
    const minPnl = Math.min(...payoffData.map(d => d.pnl));
    // Breakeven: price where pnl crosses 0
    let breakeven: number | null = null;
    for (let i = 1; i < payoffData.length; i++) {
      if (payoffData[i - 1].pnl >= 0 && payoffData[i].pnl < 0) {
        const ratio = payoffData[i - 1].pnl / (payoffData[i - 1].pnl - payoffData[i].pnl);
        breakeven = payoffData[i - 1].price + ratio * (payoffData[i].price - payoffData[i - 1].price);
        break;
      }
    }
    // PoP: probability that price > breakeven at expiry
    const pop = breakeven != null ? calcPoP(sbSpot, breakeven, sbIv, sandboxDte) : null;
    // Theta estimate: max credit / DTE
    const thetaEst = maxPnl > 0 ? -(maxPnl / sandboxDte) : null;
    return { maxPnl, minPnl, breakeven, pop, thetaEst };
  }, [payoffData, sbSpot, sbIv, sandboxDte]);

  // All strategy options for sandbox selector
  const allStrategyOptions = STRATEGY_GROUPS.flatMap(g => g.items);

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-zinc-950 text-zinc-100`}>
      {/* ── Zone 0: Header Bar ─────────────────────────────────────────────── */}
      {!embedded && <div className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur border-b border-white/10 px-6 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-zinc-100">Strategy Workspace</span>
        </div>

        {/* Current persona badge */}
        <Badge variant="outline" className={`text-xs ${PERSONAS.find(p => p.id === traderProfile.persona)?.color ?? ''}`}>
          {PERSONAS.find(p => p.id === traderProfile.persona)?.label ?? 'Unknown'}
        </Badge>

        {/* SPY regime badge */}
        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
          SPY: {regimeInfo(spyRegime).label}
        </Badge>

        {/* Signal Mode toggle */}
        <div className="ml-auto flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
          {SIGNAL_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setSignalMode(mode.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                traderProfile.signalMode === mode.id
                  ? mode.color + ' border'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={mode.description}
            >
              {mode.icon}
              {mode.label}
            </button>
          ))}
        </div>

        {/* Backup/Restore buttons */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} className="h-7 text-xs gap-1">
            <Download className="w-3 h-3" /> Export Profile
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-7 text-xs gap-1">
            <Upload className="w-3 h-3" /> Import Profile
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetToDefaults} className="h-7 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>}

      <div className="p-6 grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* ── Zone 1: Trader Profile ──────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">1</span>
              Trader Profile
            </h2>

            {/* Persona Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {PERSONAS.map(persona => {
                const isActive = traderProfile.persona === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => applyPersona(persona.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? persona.color + ' ring-1 ring-current/50'
                        : 'border-white/10 bg-zinc-900 hover:border-white/20 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={isActive ? '' : 'text-zinc-500'}>{persona.icon}</span>
                      <span className={`text-xs font-semibold ${isActive ? '' : 'text-zinc-300'}`}>{persona.label}</span>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">{persona.description}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-zinc-500">
                        {persona.risk}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-zinc-500">
                        {persona.objective}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Risk & Objective dropdowns */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Risk Tolerance</Label>
                <select
                  value={traderProfile.riskTolerance}
                  onChange={e => updateTraderProfile({ riskTolerance: e.target.value as RiskTolerance })}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Primary Objective</Label>
                <select
                  value={traderProfile.primaryObjective}
                  onChange={e => updateTraderProfile({ primaryObjective: e.target.value as PrimaryObjective })}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="income">Income</option>
                  <option value="growth">Growth</option>
                  <option value="protection">Protection</option>
                </select>
              </div>
            </div>

            {/* Active Strategies Checklist */}
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3">Active Strategies</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {STRATEGY_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${group.color}`}>{group.label}</p>
                    <div className="space-y-1.5">
                      {group.items.map(item => {
                        const active = traderProfile.activeStrategies.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleStrategy(item.id)}
                              className="w-3.5 h-3.5 rounded accent-cyan-500"
                            />
                            <span className={`text-xs transition-colors ${active ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                              {item.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Strategy Narrative */}
            <div className="bg-zinc-900 border border-cyan-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-400">Live Strategy Narrative</span>
                <Badge variant="outline" className={`ml-auto text-[9px] px-1.5 py-0 ${currentSignalMode.color}`}>
                  {currentSignalMode.icon}
                  <span className="ml-1">{currentSignalMode.label}</span>
                </Badge>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">{narrative}</p>
            </div>
          </section>

          {/* ── Zone 2: Volatility Regime Playbook ──────────────────────────── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-bold">2</span>
              Volatility Regime Playbook
            </h2>

            {/* IV × GEX Matrix */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {REGIME_CELLS.map(cell => {
                const isLive = cell.id === liveRegimeCell;
                const isActive = cell.id === effectiveRegimeCell;
                const isOverride = isActive && cell.id !== liveRegimeCell;
                return (
                  <button
                    key={cell.id}
                    onClick={() => setActiveRegimeCell(cell.id === activeRegimeCell ? null : cell.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isActive
                        ? cell.color + ' ring-1 ring-current/40'
                        : 'border-white/10 bg-zinc-900 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20 text-zinc-400">{cell.ivLabel}</Badge>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20 text-zinc-400">{cell.gexLabel}</Badge>
                      {isLive && <Badge className="text-[9px] px-1 py-0 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 ml-auto">LIVE</Badge>}
                      {isOverride && <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30 ml-auto">OVERRIDE</Badge>}
                    </div>
                    <p className="text-xs font-semibold text-zinc-200 mb-1">{cell.title}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mb-2">{cell.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {cell.strategies.map(s => (
                        <span key={s} className="text-[9px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-zinc-400">{s}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Session Parameter Overrides */}
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-3">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                Session Overrides
                <span className="text-[10px] text-zinc-500 font-normal">(not saved to profile unless you click Save Strategy)</span>
              </h3>
              <div className="space-y-1">
                <ParamRow
                  label="Delta Buffer" tooltip="Moneyness delta for short legs"
                  value={strategy.deltaAlertThreshold} onChange={v => updateStrategy({ deltaAlertThreshold: v })}
                  min={0.05} max={0.50} step={0.01} format={v => `${v.toFixed(2)}Δ`}
                />
                <ParamRow
                  label="Target DTE" tooltip="Days to expiration for new entries"
                  value={strategy.targetDte} onChange={v => updateStrategy({ targetDte: v })}
                  min={7} max={120} step={1} format={v => `${v}d`}
                />
                <ParamRow
                  label="Profit Target %" tooltip="% of max profit to close early"
                  value={strategy.profitTargetPct} onChange={v => updateStrategy({ profitTargetPct: v })}
                  min={0.10} max={0.90} step={0.05} format={v => `${Math.round(v * 100)}%`}
                />
                <ParamRow
                  label="Stop Loss Multiplier" tooltip="Close if loss exceeds N× credit received"
                  value={strategy.stopLossMultiplier} onChange={v => updateStrategy({ stopLossMultiplier: v })}
                  min={1.0} max={5.0} step={0.5} format={v => `${v}×`}
                />
                <ParamRow
                  label="IV Rank Threshold" tooltip="Min IVR for new entries"
                  value={strategy.ivRankThreshold} onChange={v => updateStrategy({ ivRankThreshold: v })}
                  min={20} max={90} step={5} format={v => `${v}`}
                />
              </div>
            </div>

            {/* Full Strategy Parameters (collapsible) */}
            <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                  <span>Full Strategy Parameters</span>
                  {paramsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-zinc-900 border border-t-0 border-white/10 rounded-b-xl p-4 space-y-6">

                  {/* Entry Rules */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Entry Rules</h4>
                    <ParamRow label="Min DTE Entry" value={strategy.minDteEntry} onChange={v => updateStrategy({ minDteEntry: v })} min={7} max={60} step={1} format={v => `${v}d`} />
                    <ParamRow label="IV High Threshold" value={strategy.ivHighThreshold} onChange={v => updateStrategy({ ivHighThreshold: v })} min={20} max={80} step={5} />
                    <ParamRow label="IV/HV Spread" value={strategy.ivHvSpreadThreshold} onChange={v => updateStrategy({ ivHvSpreadThreshold: v })} min={0} max={0.30} step={0.01} format={v => `${(v*100).toFixed(0)}pp`} />
                    <ParamRow label="Critical Gamma Delta" value={strategy.criticalGammaDelta} onChange={v => updateStrategy({ criticalGammaDelta: v })} min={0.40} max={0.90} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                    <ParamRow label="Delta Entry Max" value={strategy.deltaEntryMax} onChange={v => updateStrategy({ deltaEntryMax: v })} min={0.30} max={0.90} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                  </div>

                  {/* Sizing & Pacing */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sizing & Pacing</h4>
                    <ParamRow label="Max Open Positions" value={strategy.maxOpenPositions} onChange={v => updateStrategy({ maxOpenPositions: v })} min={1} max={50} step={1} />
                    <ParamRow label="Strikes/Week Cap" value={strategy.strikesPerWeekCap} onChange={v => updateStrategy({ strikesPerWeekCap: v })} min={1} max={20} step={1} />
                    <ParamRow label="Max Single-Name %" value={strategy.maxSingleNamePct} onChange={v => updateStrategy({ maxSingleNamePct: v })} min={5} max={50} step={1} format={v => `${v}%`} />
                    <ParamRow label="Single Ticker Cap %" value={strategy.singleTickerConcentrationCap} onChange={v => updateStrategy({ singleTickerConcentrationCap: v })} min={5} max={30} step={1} format={v => `${v}%`} />
                    <ParamRow label="Min Premium Credit" value={strategy.minPremiumCredit} onChange={v => updateStrategy({ minPremiumCredit: v })} min={10} max={500} step={10} format={v => `$${v}`} />
                  </div>

                  {/* Income Strategies */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Income Strategies</h4>
                    <ParamRow label="Min CSP Credit" value={strategy.minCspCredit} onChange={v => updateStrategy({ minCspCredit: v })} min={0.25} max={5} step={0.25} format={v => `$${v.toFixed(2)}`} />
                    <ParamRow label="Min PMCC Credit" value={strategy.minPmccCredit} onChange={v => updateStrategy({ minPmccCredit: v })} min={0.10} max={3} step={0.10} format={v => `$${v.toFixed(2)}`} />
                    <ParamRow label="Min Covered Call Credit" value={strategy.minCoveredCallCredit} onChange={v => updateStrategy({ minCoveredCallCredit: v })} min={0.10} max={3} step={0.10} format={v => `$${v.toFixed(2)}`} />
                  </div>

                  {/* Volatility Strategies */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Volatility Strategies</h4>
                    <ParamRow label="IC Short Delta" value={strategy.ironCondorShortDelta} onChange={v => updateStrategy({ ironCondorShortDelta: v })} min={0.05} max={0.30} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                    <ParamRow label="IC Wing Width" value={strategy.ironCondorWingWidth} onChange={v => updateStrategy({ ironCondorWingWidth: v })} min={1} max={20} step={1} format={v => `$${v}`} />
                    <ParamRow label="Strangle Target DTE" value={strategy.strangleTargetDte} onChange={v => updateStrategy({ strangleTargetDte: v })} min={14} max={60} step={1} format={v => `${v}d`} />
                    <ParamRow label="Min Strangle Credit" value={strategy.minStrangleCredit} onChange={v => updateStrategy({ minStrangleCredit: v })} min={0.10} max={5} step={0.10} format={v => `$${v.toFixed(2)}`} />
                  </div>

                  {/* Directional Strategies */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Directional Strategies</h4>
                    <ParamRow label="Vertical Spread Width" value={strategy.verticalSpreadWidth} onChange={v => updateStrategy({ verticalSpreadWidth: v })} min={1} max={25} step={1} format={v => `$${v}`} />
                    <ParamRow label="LEAPS Min DTE" value={strategy.leapsMinDte} onChange={v => updateStrategy({ leapsMinDte: v })} min={180} max={730} step={30} format={v => `${v}d`} />
                    <ParamRow label="LEAPS Profit Take" value={strategy.leapsProfitTake} onChange={v => updateStrategy({ leapsProfitTake: v })} min={5} max={50} step={5} format={v => `${v}%`} />
                    <ParamRow label="LEAPS Scale-Out Tranche" value={strategy.leapsScaleOutTranche} onChange={v => updateStrategy({ leapsScaleOutTranche: v })} min={10} max={50} step={5} format={v => `${v}%`} />
                    <ParamRow label="Long Call Target Δ" value={strategy.longCallTargetDelta} onChange={v => updateStrategy({ longCallTargetDelta: v })} min={0.20} max={0.80} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                    <ParamRow label="Long Put Target Δ" value={strategy.longPutTargetDelta} onChange={v => updateStrategy({ longPutTargetDelta: v })} min={0.20} max={0.80} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                  </div>

                  {/* Protection Strategies */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Protection Strategies</h4>
                    <ParamRow label="Collar Short Delta" value={strategy.collarShortDelta} onChange={v => updateStrategy({ collarShortDelta: v })} min={0.10} max={0.40} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                    <ParamRow label="Protective Put Delta" value={strategy.protectivePutDelta} onChange={v => updateStrategy({ protectivePutDelta: v })} min={0.10} max={0.50} step={0.01} format={v => `${v.toFixed(2)}Δ`} />
                    <ParamRow label="SPY Hedge Target Min" value={strategy.spyHedgeTargetMin} onChange={v => updateStrategy({ spyHedgeTargetMin: v })} min={5000} max={100000} step={5000} format={v => `$${(v/1000).toFixed(0)}k`} />
                    <ParamRow label="SPY Hedge Target Max" value={strategy.spyHedgeTargetMax} onChange={v => updateStrategy({ spyHedgeTargetMax: v })} min={5000} max={100000} step={5000} format={v => `$${(v/1000).toFixed(0)}k`} />
                  </div>

                  {/* Other */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Other</h4>
                    <ParamRow label="VIX High Regime" value={strategy.vixHighRegime} onChange={v => updateStrategy({ vixHighRegime: v })} min={15} max={40} step={1} />
                    <ParamRow label="VIX Extreme Regime" value={strategy.vixExtremeRegime} onChange={v => updateStrategy({ vixExtremeRegime: v })} min={25} max={60} step={1} />
                    <ParamRow label="Portfolio Theta Target" value={strategy.portfolioThetaTarget} onChange={v => updateStrategy({ portfolioThetaTarget: v })} min={0.0005} max={0.005} step={0.0001} format={v => `${(v*100).toFixed(2)}%/d`} />
                    <ParamRow label="Available Funds Floor" value={strategy.availableFundsFloor} onChange={v => updateStrategy({ availableFundsFloor: v })} min={5000} max={100000} step={1000} format={v => `$${(v/1000).toFixed(0)}k`} />
                    <ParamRow label="Excess Liquidity Floor" value={strategy.excessLiquidityFloor} onChange={v => updateStrategy({ excessLiquidityFloor: v })} min={5000} max={100000} step={1000} format={v => `$${(v/1000).toFixed(0)}k`} />
                    <ParamRow label="LEAPS Earnings Blackout" value={strategy.leapsEarningsBlackout} onChange={v => updateStrategy({ leapsEarningsBlackout: v })} min={7} max={45} step={1} format={v => `${v}d`} />
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <div>
                        <span className="text-xs text-zinc-300">Stop-Loss 200 SMA</span>
                        <p className="text-[10px] text-zinc-500">Close position if underlying breaks 200-day SMA</p>
                      </div>
                      <Switch
                        checked={strategy.stopLoss200SMA}
                        onCheckedChange={v => updateStrategy({ stopLoss200SMA: v })}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>
        </div>

        {/* ── RIGHT COLUMN: Zone 3 Sandbox ─────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">3</span>
            Strategy Sandbox
          </h2>

          {/* Active Regime Recommendation */}
          {effectiveRegimeCell && (() => {
            const cell = REGIME_CELLS.find(c => c.id === effectiveRegimeCell);
            if (!cell) return null;
            return (
              <div className={`rounded-xl border p-4 ${cell.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold">{cell.title}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-current/30 ml-auto">
                    {cell.id === liveRegimeCell ? 'LIVE REGIME' : 'MANUAL OVERRIDE'}
                  </Badge>
                </div>
                <p className="text-[10px] text-zinc-400 mb-3">{cell.description}</p>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Recommended Structures</p>
                  {cell.strategies.map(s => (
                    <div key={s} className="flex items-center gap-2 text-xs text-zinc-300">
                      <ChevronRight className="w-3 h-3 text-zinc-500" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─── Interactive Strategy Sandbox ─────────────────────────── */}
          <div className="rounded-xl border p-4 space-y-4" style={{ background: SB_CARD, borderColor: SB_BORDER }}>
            {/* Header */}
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: SB_CYAN }} />
              <h3 className="font-display text-sm" style={{ color: SB_BRIGHT }}>Payoff Sandbox</h3>
              <span className="font-mono-data text-[10px] ml-auto" style={{ color: SB_DIM }}>theoretical — not financial advice</span>
            </div>

            {/* Controls row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ticker selector */}
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: SB_DIM }}>Ticker</p>
                <Select
                  value={effectiveTicker}
                  onValueChange={(v) => setSandboxTicker(v)}
                >
                  <SelectTrigger size="sm" className="h-8 text-xs font-mono-data" style={{ background: 'oklch(0.22 0.010 258)', borderColor: SB_BORDER, color: SB_BRIGHT }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateTickers.length > 0 ? (
                      candidateTickers.map(t => (
                        <SelectItem key={t} value={t} className="text-xs font-mono-data">{t}</SelectItem>
                      ))
                    ) : (
                      ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'].map(t => (
                        <SelectItem key={t} value={t} className="text-xs font-mono-data">{t}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Strategy selector */}
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: SB_DIM }}>Strategy</p>
                <Select
                  value={sandboxStrategy}
                  onValueChange={(v) => setSandboxStrategy(v)}
                >
                  <SelectTrigger size="sm" className="h-8 text-xs" style={{ background: 'oklch(0.22 0.010 258)', borderColor: SB_BORDER, color: SB_BRIGHT }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allStrategyOptions.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DTE slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: SB_DIM }}>Days to Expiry (DTE)</p>
                <span className="font-mono-data text-xs font-bold" style={{ color: SB_CYAN }}>{sandboxDte}d</span>
              </div>
              <Slider
                min={7} max={120} step={1}
                value={[sandboxDte]}
                onValueChange={([v]) => setSandboxDte(v)}
                className="w-full"
              />
              <div className="flex justify-between mt-0.5">
                <span className="font-mono-data text-[9px]" style={{ color: SB_DIM }}>7d</span>
                <span className="font-mono-data text-[9px]" style={{ color: SB_DIM }}>120d</span>
              </div>
            </div>

            {/* Delta slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: SB_DIM }}>Short Delta</p>
                <span className="font-mono-data text-xs font-bold" style={{ color: SB_AMBER }}>{sandboxDelta.toFixed(2)}Δ</span>
              </div>
              <Slider
                min={0.05} max={0.50} step={0.01}
                value={[sandboxDelta]}
                onValueChange={([v]) => setSandboxDelta(v)}
                className="w-full"
              />
              <div className="flex justify-between mt-0.5">
                <span className="font-mono-data text-[9px]" style={{ color: SB_DIM }}>0.05Δ (far OTM)</span>
                <span className="font-mono-data text-[9px]" style={{ color: SB_DIM }}>0.50Δ (ATM)</span>
              </div>
            </div>

            {/* Spot + IV info row */}
            <div className="flex items-center gap-4 flex-wrap">
              {sbLoading ? (
                <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
              ) : sbSpot > 0 ? (
                <>
                  <span className="font-mono-data text-xs" style={{ color: SB_DIM }}>
                    Spot: <span style={{ color: SB_BRIGHT }}>${sbSpot.toFixed(2)}</span>
                  </span>
                  <span className="font-mono-data text-xs" style={{ color: SB_DIM }}>
                    IV: <span style={{ color: SB_AMBER }}>{(sbIv * 100).toFixed(1)}%</span>
                  </span>
                  {sbGexCall != null && (
                    <span className="font-mono-data text-xs" style={{ color: SB_DIM }}>
                      GEX Call: <span style={{ color: SB_GREEN }}>${sbGexCall.toFixed(0)}</span>
                    </span>
                  )}
                  {sbGexPut != null && (
                    <span className="font-mono-data text-xs" style={{ color: SB_DIM }}>
                      GEX Put: <span style={{ color: SB_RED }}>${sbGexPut.toFixed(0)}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="font-mono-data text-xs" style={{ color: SB_DIM }}>Loading market data…</span>
              )}
            </div>

            {/* Payoff chart */}
            {payoffData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={payoffData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis
                      dataKey="price"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fontSize: 9, fill: 'oklch(0.45 0.010 258)', fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v as number).toFixed(0)}`}
                      tickCount={6}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'oklch(0.45 0.010 258)', fontFamily: 'JetBrains Mono' }}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => `$${(v as number).toFixed(0)}`}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'oklch(0.22 0.010 258)',
                        border: '1px solid oklch(1 0 0 / 12%)',
                        borderRadius: '4px', fontSize: '11px',
                        fontFamily: 'JetBrains Mono', color: SB_BRIGHT,
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                      labelFormatter={(label: number) => `Price: $${Number(label).toFixed(2)}`}
                    />
                    {/* Zero line */}
                    <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" strokeWidth={1} />
                    {/* Spot price */}
                    {sbSpot > 0 && (
                      <ReferenceLine
                        x={sbSpot}
                        stroke={`${SB_CYAN.replace(')', ' / 70%)')}`}
                        strokeDasharray="5 3" strokeWidth={1.5}
                        label={{ value: `Spot $${sbSpot.toFixed(0)}`, fontSize: 8, fill: SB_CYAN, position: 'insideTopLeft', offset: 4 }}
                      />
                    )}
                    {/* GEX Call Wall */}
                    {sbGexCall != null && (
                      <ReferenceLine
                        x={sbGexCall}
                        stroke="oklch(0.72 0.18 145 / 60%)"
                        strokeDasharray="4 4" strokeWidth={1}
                        label={{ value: `GEX C $${sbGexCall.toFixed(0)}`, fontSize: 8, fill: SB_GREEN, position: 'insideTopRight', offset: 4 }}
                      />
                    )}
                    {/* GEX Put Wall */}
                    {sbGexPut != null && (
                      <ReferenceLine
                        x={sbGexPut}
                        stroke="oklch(0.65 0.22 25 / 60%)"
                        strokeDasharray="4 4" strokeWidth={1}
                        label={{ value: `GEX P $${sbGexPut.toFixed(0)}`, fontSize: 8, fill: SB_RED, position: 'insideTopLeft', offset: 4 }}
                      />
                    )}
                    {/* DP Floor */}
                    {sbDpFloor != null && (
                      <ReferenceLine
                        x={sbDpFloor}
                        stroke="oklch(0.80 0.15 200 / 50%)"
                        strokeDasharray="3 3" strokeWidth={1}
                        label={{ value: `DP $${sbDpFloor.toFixed(0)}`, fontSize: 8, fill: SB_CYAN, position: 'insideBottomLeft', offset: 4 }}
                      />
                    )}
                    {/* DP Ceiling */}
                    {sbDpCeil != null && (
                      <ReferenceLine
                        x={sbDpCeil}
                        stroke="oklch(0.80 0.15 200 / 40%)"
                        strokeDasharray="3 3" strokeWidth={1}
                        label={{ value: `DP Ceil $${sbDpCeil.toFixed(0)}`, fontSize: 8, fill: SB_CYAN, position: 'insideTopRight', offset: 4 }}
                      />
                    )}
                    {/* Breakeven */}
                    {sandboxMetrics?.breakeven != null && (
                      <ReferenceLine
                        x={sandboxMetrics.breakeven}
                        stroke="oklch(0.78 0.18 85 / 80%)"
                        strokeDasharray="6 2" strokeWidth={1.5}
                        label={{ value: `BE $${sandboxMetrics.breakeven.toFixed(0)}`, fontSize: 8, fill: SB_AMBER, position: 'insideBottomRight', offset: 4 }}
                      />
                    )}
                    <Line
                      type="monotone" dataKey="pnl"
                      stroke={SB_CYAN} strokeWidth={2} dot={false}
                      activeDot={{ r: 3, fill: SB_CYAN }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  {[
                    { color: SB_CYAN, label: 'P&L at Expiry' },
                    { color: SB_AMBER, label: 'Breakeven' },
                    { color: SB_GREEN, label: 'GEX Call Wall' },
                    { color: SB_RED, label: 'GEX Put Wall' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded" style={{ background: color }} />
                      <span className="font-mono-data text-[9px]" style={{ color: SB_DIM }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center rounded" style={{ background: 'oklch(1 0 0 / 4%)' }}>
                <span className="text-xs" style={{ color: SB_DIM }}>Select a ticker to generate payoff curve</span>
              </div>
            )}

            {/* Breakeven warning badge */}
            {sandboxMetrics?.breakeven != null && sbSpot > 0 && (() => {
              const beDistance = Math.abs(sbSpot - sandboxMetrics.breakeven) / sbSpot;
              const isClose = beDistance < 0.05;
              const isVeryClose = beDistance < 0.02;
              if (!isClose) return null;
              return (
                <div className="flex items-center gap-2 rounded px-3 py-2" style={{
                  background: isVeryClose ? 'oklch(0.65 0.22 25 / 12%)' : 'oklch(0.78 0.18 85 / 10%)',
                  border: `1px solid ${isVeryClose ? 'oklch(0.65 0.22 25 / 40%)' : 'oklch(0.78 0.18 85 / 30%)'}`,
                }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: isVeryClose ? SB_RED : SB_AMBER }} />
                  <span className="text-xs" style={{ color: isVeryClose ? SB_RED : SB_AMBER }}>
                    {isVeryClose
                      ? `Breakeven $${sandboxMetrics.breakeven.toFixed(0)} is only ${(beDistance * 100).toFixed(1)}% from spot — very thin margin`
                      : `Breakeven $${sandboxMetrics.breakeven.toFixed(0)} is ${(beDistance * 100).toFixed(1)}% from spot — watch closely`
                    }
                  </span>
                </div>
              );
            })()}

            {/* Live metrics grid */}
            {sandboxMetrics && (() => {
              // Gamma risk score: higher delta + shorter DTE = higher gamma risk
              const gammaScore = Math.round(sandboxDelta * 10 + (1 / (sandboxDte / 30)) * 3);
              const gammaLabel = gammaScore >= 8 ? 'HIGH' : gammaScore >= 5 ? 'MODERATE' : 'LOW';
              const gammaColor = gammaScore >= 8 ? SB_RED : gammaScore >= 5 ? SB_AMBER : SB_GREEN;
              // Margin efficiency: theta per day / max loss (proxy for return on risk)
              const marginEff = sandboxMetrics.thetaEst != null && sandboxMetrics.minPnl < -0.01
                ? Math.abs(sandboxMetrics.thetaEst) / Math.abs(sandboxMetrics.minPnl) * 100
                : null;
              return (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'PoP (Est.)',
                      value: sandboxMetrics.pop != null ? `${(sandboxMetrics.pop * 100).toFixed(1)}%` : '—',
                      color: sandboxMetrics.pop != null && sandboxMetrics.pop >= 0.80 ? SB_GREEN
                           : sandboxMetrics.pop != null && sandboxMetrics.pop >= 0.65 ? SB_AMBER : SB_RED,
                      hint: 'prob. of profit at expiry',
                    },
                    {
                      label: 'Max Profit',
                      value: `$${sandboxMetrics.maxPnl.toFixed(0)}`,
                      color: SB_GREEN,
                      hint: 'per contract',
                    },
                    {
                      label: 'Max Loss',
                      value: sandboxMetrics.minPnl < -9999 ? 'Unlimited' : `$${sandboxMetrics.minPnl.toFixed(0)}`,
                      color: SB_RED,
                      hint: 'per contract',
                    },
                    {
                      label: 'θ/day (Est.)',
                      value: sandboxMetrics.thetaEst != null ? `$${sandboxMetrics.thetaEst.toFixed(2)}` : '—',
                      color: SB_AMBER,
                      hint: 'daily decay',
                    },
                    {
                      label: 'Gamma Risk',
                      value: `${gammaLabel} (${gammaScore}/10)`,
                      color: gammaColor,
                      hint: `Δ${sandboxDelta.toFixed(2)} × ${sandboxDte}d exposure`,
                    },
                    {
                      label: 'θ Efficiency',
                      value: marginEff != null ? `${marginEff.toFixed(2)}%/d` : '—',
                      color: marginEff != null && marginEff >= 0.5 ? SB_GREEN
                           : marginEff != null && marginEff >= 0.2 ? SB_AMBER : SB_DIM,
                      hint: 'theta / max risk per day',
                    },
                  ].map(m => (
                    <div key={m.label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: SB_DIM }}>{m.label}</div>
                      <div className="font-mono-data text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: 'oklch(0.42 0.010 258)' }}>{m.hint}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Signal Mode Info */}
          <div className={`rounded-xl border p-4 ${currentSignalMode.color}`}>
            <div className="flex items-center gap-2 mb-2">
              {currentSignalMode.icon}
              <span className="text-xs font-semibold">{currentSignalMode.label} Mode</span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-80">{currentSignalMode.description}</p>
          </div>

          {/* Active Strategies Summary */}
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-zinc-300 mb-3">
              Active Strategies ({traderProfile.activeStrategies.length})
            </h3>
            {traderProfile.activeStrategies.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No strategies selected. Choose at least one in Zone 1.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {traderProfile.activeStrategies.map(s => (
                  <Badge key={s} variant="outline" className="text-xs border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
                    {s.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Export to Trade Builder */}
          <Button
            onClick={handleExportToTradeBuilder}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Open in Trade Builder
          </Button>

          {/* Backup/Restore Panel */}
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              Backup & Restore
            </h3>
            <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
              Export your complete strategy profile (persona, active strategies, all parameters) as a JSON file.
              Import to restore a previous configuration. The API token is never included in exports.
            </p>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={handleExport} className="w-full h-8 text-xs gap-2 justify-start">
                <Download className="w-3.5 h-3.5" />
                Export Strategy Profile (.json)
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-8 text-xs gap-2 justify-start">
                <Upload className="w-3.5 h-3.5" />
                Import Strategy Profile (.json)
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetToDefaults} className="w-full h-8 text-xs gap-2 justify-start text-red-400 border-red-500/30 hover:bg-red-500/10">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
