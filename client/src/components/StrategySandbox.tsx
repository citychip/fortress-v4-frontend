/**
 * StrategySandbox — standalone payoff sandbox component
 * Extracted from StrategyPage for use in the Analyse tab.
 * Props: ticker (syncs with AnalysisPage selection), onExport callback.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useConfig } from '@/contexts/ConfigContext';
import { useCandidates, useMarketIntelligence, useCapitalEfficiency } from '@/hooks/useApi';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BarChart2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

// ── Color constants ───────────────────────────────────────────────────────────
const SB_BG     = 'oklch(0.17 0.010 258)';
const SB_CARD   = 'oklch(0.19 0.012 258)';
const SB_BORDER = 'oklch(1 0 0 / 10%)';
const SB_BRIGHT = 'oklch(0.93 0.005 258)';
const SB_DIM    = 'oklch(0.55 0.010 258)';
const SB_CYAN   = 'oklch(0.80 0.15 200)';
const SB_GREEN  = 'oklch(0.72 0.18 145)';
const SB_RED    = 'oklch(0.65 0.22 25)';
const SB_AMBER  = 'oklch(0.78 0.18 85)';

// ── Math helpers ──────────────────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1/(1+p*x);
  const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}

function calcPoP(spot: number, breakeven: number, iv: number, dte: number): number {
  if (!spot || !breakeven || !iv || !dte) return 0;
  const T = dte / 365;
  const d2 = (Math.log(spot / breakeven) + (-0.5 * iv * iv) * T) / (iv * Math.sqrt(T));
  return normalCDF(d2);
}

function buildPayoffData(spot: number, delta: number, dte: number, iv: number, strategy: string) {
  if (!spot || spot <= 0) return [];
  const range = spot * 0.25;
  const steps = 60;
  const step = (range * 2) / steps;
  const credit = spot * iv * Math.sqrt(dte / 365) * delta * 0.5;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = spot - range + i * step;
    let pnl = 0;
    const s = strategy.toUpperCase();
    if (s === 'CSP' || s === 'BULL_PUT_SPREAD') {
      const strike = spot * (1 - delta * 0.7);
      pnl = price >= strike ? credit : credit - (strike - price) * 100;
      if (s === 'BULL_PUT_SPREAD') pnl = Math.max(pnl, -(spot * 0.05 * 100 - credit));
    } else if (s === 'COVERED_CALL' || s === 'PMCC') {
      const strike = spot * (1 + delta * 0.5);
      pnl = price <= strike ? credit : credit - (price - strike) * 100;
    } else if (s === 'IRON_CONDOR' || s === 'JADE_LIZARD') {
      const callStrike = spot * 1.07;
      const putStrike  = spot * 0.93;
      const wing = spot * 0.05;
      const callPnl = price <= callStrike ? credit * 0.5 : Math.max(credit * 0.5 - (price - callStrike) * 100, -wing * 100);
      const putPnl  = price >= putStrike  ? credit * 0.5 : Math.max(credit * 0.5 - (putStrike - price) * 100, -wing * 100);
      pnl = callPnl + putPnl;
    } else if (s === 'LEAPS' || s === 'BULL_CALL_SPREAD') {
      const strike = spot * (1 - delta * 0.3);
      pnl = Math.max((price - strike) * 100 - credit, -credit);
    } else {
      const strike = spot * (1 - delta * 0.7);
      pnl = price >= strike ? credit : credit - (strike - price) * 100;
    }
    return { price: parseFloat(price.toFixed(2)), pnl: parseFloat(pnl.toFixed(2)) };
  });
}

// ── Strategy groups ───────────────────────────────────────────────────────────
const STRATEGY_OPTIONS = [
  { id: 'CSP',              label: 'Cash-Secured Put' },
  { id: 'PMCC',             label: 'PMCC' },
  { id: 'COVERED_CALL',     label: 'Covered Call' },
  { id: 'BULL_PUT_SPREAD',  label: 'Bull Put Spread' },
  { id: 'BEAR_CALL_SPREAD', label: 'Bear Call Spread' },
  { id: 'IRON_CONDOR',      label: 'Iron Condor' },
  { id: 'JADE_LIZARD',      label: 'Jade Lizard' },
  { id: 'LEAPS',            label: 'LEAPS' },
  { id: 'BULL_CALL_SPREAD', label: 'Bull Call Spread' },
];

// ── Regime cells ──────────────────────────────────────────────────────────────
const REGIME_CELLS = [
  { id: 'high_iv_pos_gex', title: 'Pinned + Rich Premium',    strategies: ['Iron Condor', 'Jade Lizard', 'Short Strangle'],   color: 'border-emerald-500/50 bg-emerald-500/10', ivHigh: true,  gexPos: true  },
  { id: 'high_iv_neg_gex', title: 'Volatile + Rich Premium',  strategies: ['CSP at DP Floor', 'Bull Put Spread', 'PMCC'],      color: 'border-red-500/50 bg-red-500/10',         ivHigh: true,  gexPos: false },
  { id: 'low_iv_pos_gex',  title: 'Pinned + Cheap Premium',   strategies: ['LEAPS', 'Calendar Spread', 'Covered Call'],        color: 'border-blue-500/50 bg-blue-500/10',       ivHigh: false, gexPos: true  },
  { id: 'low_iv_neg_gex',  title: 'Trending + Cheap Premium', strategies: ['LEAPS', 'Bull Call Spread', 'Directional Debit'],  color: 'border-amber-500/50 bg-amber-500/10',     ivHigh: false, gexPos: false },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface StrategySandboxProps {
  ticker?: string;        // pre-selected ticker from parent
  collapsed?: boolean;    // start collapsed
  hideTickerSelect?: boolean;  // when true (Trade tab): don't show internal ticker dropdown
  defaultStrategy?: string;    // seed initial strategy (e.g. 'PMCC' on roll mode)
}

export function StrategySandbox({ ticker: propTicker, collapsed = false, hideTickerSelect = false, defaultStrategy }: StrategySandboxProps) {
  const [, navigate] = useLocation();
  const { config } = useConfig();
  const [open, setOpen] = useState(!collapsed);
  const [sandboxTicker, setSandboxTicker] = useState<string>('');
  const [sandboxStrategy, setSandboxStrategy] = useState<string>(defaultStrategy ?? 'CSP');
  // Sync strategy when parent changes ticker/mode
  useEffect(() => { if (defaultStrategy) setSandboxStrategy(defaultStrategy); }, [defaultStrategy]);

  const [sandboxDte, setSandboxDte] = useState<number>(45);
  const [sandboxDelta, setSandboxDelta] = useState<number>(0.20);

  const { data: candidatesData } = useCandidates();
  const candidateTickers = useMemo(() =>
    (candidatesData?.rows ?? []).filter((r: any) => r.can_trade).map((r: any) => r.ticker).slice(0, 20),
    [candidatesData]
  );

  // Effective ticker: prop (from AnalysisPage) → user pick → first candidate → fallback
  const effectiveTicker = propTicker || sandboxTicker || candidateTickers[0] || 'SPY';

  const { data: sbIntel } = useMarketIntelligence(effectiveTicker);
  const { data: spyIntel } = useMarketIntelligence('SPY');
  const { data: capEffData, loading: capEffLoading } = useCapitalEfficiency();

  const sbSpot = (sbIntel as any)?.current_price ?? 0;
  const sbIv = useMemo(() => {
    const candidate = candidatesData?.rows?.find((r: any) => r.ticker === effectiveTicker);
    return candidate ? candidate.current_iv / 100 : 0.30;
  }, [candidatesData, effectiveTicker]);

  const sbGexCall = (sbIntel as any)?.regime?.gex_call_wall ?? (sbIntel as any)?.gex?.call_wall ?? null;
  const sbGexPut  = (sbIntel as any)?.regime?.gex_put_wall  ?? (sbIntel as any)?.gex?.put_wall  ?? null;
  const sbDpFloor = (sbIntel as any)?.regime?.dp_floor ?? null;
  const sbFlipZone = (sbIntel as any)?.gex?.flip_zone ?? (sbIntel as any)?.regime?.flip_zone ?? null;

  // Multi-level enrichment: use arrays when available, fall back to scalars
  const dpFloors: number[] = useMemo(() => {
    const raw = (sbIntel as any)?.dark_pool?.floors ?? [];
    if (raw.length > 0) return raw.map((f: any) => typeof f === 'number' ? f : (f.level ?? f.price ?? 0)).filter(Boolean).slice(0, 4);
    return sbDpFloor ? [sbDpFloor] : [];
  }, [sbIntel, sbDpFloor]);

  const gexCallWalls: number[] = useMemo(() => {
    const walls = (sbIntel as any)?.gex?.call_walls ?? [];
    if (walls.length > 0) return walls.slice(0, 3).map((w: any) => w.strike).filter(Boolean);
    return sbGexCall ? [sbGexCall] : [];
  }, [sbIntel, sbGexCall]);

  const gexPutWalls: number[] = useMemo(() => {
    const walls = (sbIntel as any)?.gex?.put_walls ?? [];
    if (walls.length > 0) return walls.slice(0, 3).map((w: any) => w.strike).filter(Boolean);
    return sbGexPut ? [sbGexPut] : [];
  }, [sbIntel, sbGexPut]);

  // Live regime cell
  const spyIvr = (spyIntel as any)?.regime?.iv_rank ?? null;
  const spyGex = (spyIntel as any)?.regime?.gex_regime ?? null;
  const liveRegimeCell = useMemo(() => {
    if (spyIvr === null || spyGex === null) return null;
    const ivHigh = spyIvr >= 50;
    const gexPos = spyGex === 'POSITIVE' || spyGex === 'positive';
    if (ivHigh && gexPos)  return 'high_iv_pos_gex';
    if (ivHigh && !gexPos) return 'high_iv_neg_gex';
    if (!ivHigh && gexPos) return 'low_iv_pos_gex';
    return 'low_iv_neg_gex';
  }, [spyIvr, spyGex]);

  const payoffData = useMemo(() =>
    buildPayoffData(sbSpot, sandboxDelta, sandboxDte, sbIv, sandboxStrategy),
    [sbSpot, sandboxDelta, sandboxDte, sbIv, sandboxStrategy]
  );

  const sandboxMetrics = useMemo(() => {
    if (!payoffData.length || sbSpot <= 0) return null;
    const maxPnl = Math.max(...payoffData.map(d => d.pnl));
    const minPnl = Math.min(...payoffData.map(d => d.pnl));
    let breakeven: number | null = null;
    for (let i = 1; i < payoffData.length; i++) {
      if (payoffData[i-1].pnl >= 0 && payoffData[i].pnl < 0) {
        const ratio = payoffData[i-1].pnl / (payoffData[i-1].pnl - payoffData[i].pnl);
        breakeven = payoffData[i-1].price + ratio * (payoffData[i].price - payoffData[i-1].price);
        break;
      }
    }
    const pop = breakeven != null ? calcPoP(sbSpot, breakeven, sbIv, sandboxDte) : null;
    const thetaEst = maxPnl > 0 ? -(maxPnl / sandboxDte) : null;
    return { maxPnl, minPnl, breakeven, pop, thetaEst };
  }, [payoffData, sbSpot, sbIv, sandboxDte]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams({
      ticker: effectiveTicker,
      strategy: sandboxStrategy,
      dte: String(sandboxDte),
      delta: String(sandboxDelta),
    });
    navigate(`/trade-builder?${params.toString()}`);
  }, [effectiveTicker, sandboxStrategy, sandboxDte, sandboxDelta, navigate]);

  const regimeCell = REGIME_CELLS.find(c => c.id === liveRegimeCell);

  return (
    <div className="rounded border overflow-hidden" style={{ background: SB_BG, borderColor: SB_BORDER }}>
      {/* Header — always visible */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setOpen(o => !o)}
      >
        <BarChart2 className="w-4 h-4" style={{ color: SB_CYAN }} />
        <span className="font-display text-sm font-semibold" style={{ color: SB_BRIGHT }}>Strategy Sandbox</span>
        {effectiveTicker && sbSpot > 0 && (
          <span className="font-mono-data text-xs ml-1" style={{ color: SB_DIM }}>
            {effectiveTicker} @ ${sbSpot.toFixed(2)}
          </span>
        )}
        <span className="font-mono-data text-[10px] ml-auto mr-2" style={{ color: SB_DIM }}>
          theoretical — not financial advice
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: SB_DIM }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: SB_DIM }} />}
      </div>

      {open && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: SB_BORDER }}>
          {/* Live regime recommendation */}
          {regimeCell && (
            <div className={`rounded-xl border p-3 ${regimeCell.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-zinc-200">{regimeCell.title}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-current/30 ml-auto text-zinc-400">LIVE REGIME</Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {regimeCell.strategies.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={`grid gap-3 ${hideTickerSelect ? "grid-cols-1" : "grid-cols-2"}`}>
            {/* Ticker — hidden when parent (Trade tab) controls selection */}
            {!hideTickerSelect && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: SB_DIM }}>Ticker</p>
                <Select value={effectiveTicker} onValueChange={setSandboxTicker}>
                  <SelectTrigger size="sm" className="h-8 text-xs font-mono-data" style={{ background: 'oklch(0.22 0.010 258)', borderColor: SB_BORDER, color: SB_BRIGHT }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(candidateTickers.length > 0 ? candidateTickers : ['SPY', 'QQQ', 'MSFT', 'AAPL', 'NVDA']).map((t: string) => (
                      <SelectItem key={t} value={t} className="text-xs font-mono-data">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Strategy */}
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: SB_DIM }}>Strategy</p>
              <Select value={sandboxStrategy} onValueChange={setSandboxStrategy}>
                <SelectTrigger size="sm" className="h-8 text-xs font-mono-data" style={{ background: 'oklch(0.22 0.010 258)', borderColor: SB_BORDER, color: SB_BRIGHT }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DTE + Delta sliders */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: SB_DIM }}>Days to Expiry</span>
                <span className="font-mono-data text-xs font-bold" style={{ color: SB_CYAN }}>{sandboxDte}d</span>
              </div>
              <Slider value={[sandboxDte]} onValueChange={([v]) => setSandboxDte(v)} min={7} max={90} step={1} className="h-1" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: SB_DIM }}>Short Delta</span>
                <span className="font-mono-data text-xs font-bold" style={{ color: SB_AMBER }}>{sandboxDelta.toFixed(2)}</span>
              </div>
              <Slider value={[sandboxDelta]} onValueChange={([v]) => setSandboxDelta(v)} min={0.05} max={0.50} step={0.01} className="h-1" />
            </div>
          </div>

          {/* Payoff chart */}
          {payoffData.length > 0 && sbSpot > 0 ? (
            <div className="rounded border p-3" style={{ background: SB_CARD, borderColor: SB_BORDER }}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={payoffData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                  <XAxis dataKey="price" tick={{ fill: SB_DIM, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <YAxis tick={{ fill: SB_DIM, fontSize: 9 }} tickFormatter={v => `$${v.toFixed(0)}`} width={45} />
                  <Tooltip
                    contentStyle={{ background: 'oklch(0.19 0.012 258)', border: `1px solid ${SB_BORDER}`, borderRadius: '6px', fontSize: '11px' }}
                    labelFormatter={v => `Price: $${Number(v).toFixed(2)}`}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, 'P&L']}
                  />
                  <ReferenceLine x={sbSpot} stroke={SB_CYAN} strokeDasharray="4 2" label={{ value: 'Spot', fill: SB_CYAN, fontSize: 9 }} />
                  {gexCallWalls.map((lvl, i) => (
                    <ReferenceLine key={`gc${i}`} x={lvl} stroke={SB_RED} strokeDasharray="2 3"
                      label={i === 0 ? { value: 'GEX↑', fill: SB_RED, fontSize: 8 } : undefined} />
                  ))}
                  {gexPutWalls.map((lvl, i) => (
                    <ReferenceLine key={`gp${i}`} x={lvl} stroke={SB_GREEN} strokeDasharray="2 3"
                      label={i === 0 ? { value: 'GEX↓', fill: SB_GREEN, fontSize: 8 } : undefined} />
                  ))}
                  {dpFloors.map((lvl, i) => (
                    <ReferenceLine key={`dp${i}`} x={lvl} stroke={SB_AMBER} strokeDasharray="2 3"
                      label={i === 0 ? { value: 'DP', fill: SB_AMBER, fontSize: 8 } : undefined} />
                  ))}
                  {sbFlipZone && (
                    <ReferenceLine x={sbFlipZone} stroke="oklch(0.75 0.20 300)" strokeDasharray="3 2"
                      label={{ value: 'Flip', fill: 'oklch(0.75 0.20 300)', fontSize: 8 }} />
                  )}
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" />
                  <Line type="monotone" dataKey="pnl" dot={false} strokeWidth={2}
                    stroke={payoffData.map(d => d.pnl >= 0 ? SB_GREEN : SB_RED)[0] ?? SB_CYAN} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded border p-4 text-center text-xs" style={{ borderColor: SB_BORDER, color: SB_DIM }}>
              {sbSpot <= 0 ? 'Loading market data…' : 'No payoff data — select a strategy'}
            </div>
          )}

          {/* Metrics */}
          {sandboxMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Max Profit', value: sandboxMetrics.maxPnl > 0 ? `$${sandboxMetrics.maxPnl.toFixed(0)}` : '—', color: SB_GREEN },
                { label: 'Max Loss',   value: sandboxMetrics.minPnl < 0 ? `$${Math.abs(sandboxMetrics.minPnl).toFixed(0)}` : 'Limited', color: SB_RED },
                { label: 'PoP',        value: sandboxMetrics.pop != null ? `${(sandboxMetrics.pop * 100).toFixed(0)}%` : '—', color: SB_CYAN },
                { label: 'Est. Θ/day', value: sandboxMetrics.thetaEst != null ? `$${Math.abs(sandboxMetrics.thetaEst).toFixed(2)}` : '—', color: SB_AMBER },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded p-2 text-center" style={{ background: SB_CARD }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: SB_DIM }}>{label}</div>
                  <div className="font-mono-data text-sm font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* GEX / DP / Flip levels */}
          {(gexCallWalls.length > 0 || gexPutWalls.length > 0 || dpFloors.length > 0 || sbFlipZone) && (
            <div className="flex flex-wrap gap-2 text-[10px] font-mono-data">
              {gexCallWalls.map((lvl, i) => (
                <span key={`gc${i}`} className="px-2 py-0.5 rounded" style={{ background: `${SB_RED}18`, color: SB_RED }}>
                  GEX↑{gexCallWalls.length > 1 ? ` #${i+1}` : ''}: ${lvl.toFixed(0)}
                </span>
              ))}
              {gexPutWalls.map((lvl, i) => (
                <span key={`gp${i}`} className="px-2 py-0.5 rounded" style={{ background: `${SB_GREEN}18`, color: SB_GREEN }}>
                  GEX↓{gexPutWalls.length > 1 ? ` #${i+1}` : ''}: ${lvl.toFixed(0)}
                </span>
              ))}
              {dpFloors.map((lvl, i) => (
                <span key={`dp${i}`} className="px-2 py-0.5 rounded" style={{ background: `${SB_AMBER}18`, color: SB_AMBER }}>
                  DP{dpFloors.length > 1 ? ` #${i+1}` : ''}: ${lvl.toFixed(0)}
                </span>
              ))}
              {sbFlipZone && (
                <span className="px-2 py-0.5 rounded" style={{ background: 'oklch(0.75 0.20 300 / 12%)', color: 'oklch(0.75 0.20 300)' }}>
                  Flip Zone: ${sbFlipZone.toFixed(0)}
                </span>
              )}
            </div>
          )}

          {/* Export */}
          <Button onClick={handleExport} className="w-full gap-2" style={{ background: 'oklch(0.80 0.15 200 / 15%)', color: SB_CYAN, border: `1px solid oklch(0.80 0.15 200 / 30%)` }}>
            <ArrowRight className="w-4 h-4" />
            Export to Trade Builder
          </Button>
        </div>
      )}
    </div>
  );
}

export default StrategySandbox;
