/**
 * FORTRESS V3 — Cockpit 2: Build Center
 * Ticker search bar anchors both panes to one asset.
 * Left: Asset diagnostics (GEX walls, DP floors, net drift, order flow, key levels, trade setups)
 * Right: Strategy selector → PoP calculator → Breakeven vs GEX wall badge → Send to Orders
 *
 * Navigating here with ?ticker=XXX pre-loads that asset (used by Action Center "Analyse →").
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearch, useLocation } from 'wouter';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  useCandidates, usePretradeAll, useMarketIntelligence,
  useChartLevels, useOrderFlow, evaluateCandidate, usePendingOrderActions,
  type CandidateRow, type PretradeResult,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { usePendingOrders } from '@/contexts/PendingOrdersContext';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, Zap,
  Target, Shield, TrendingDown, BarChart2, Plus, RefreshCw,
  ArrowRight, Info, Activity, Lock, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CYAN   = 'oklch(0.80 0.15 200)';
const GREEN  = 'oklch(0.72 0.18 145)';
const AMBER  = 'oklch(0.78 0.18 85)';
const RED    = 'oklch(0.65 0.22 25)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

// ─── Helpers (copied from TradeBuilderPage) ───────────────────────────────────
function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1/(1+p*Math.abs(x));
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
function calcPoP(price:number,strike:number,iv:number,dte:number):number {
  if(price<=0||strike<=0||iv<=0||dte<=0) return 0;
  const T=dte/365, d2=(Math.log(price/strike)-0.5*iv*iv*T)/(iv*Math.sqrt(T));
  return Math.max(0,Math.min(1,normalCDF(d2)));
}

interface Strategy { id:string; name:string; short:string; idealIvr:number; icon:React.ElementType; regimeBias:'neutral'|'bullish'|'bearish' }
const STRATEGIES: Strategy[] = [
  { id:'pcs',      name:'Put Credit Spread',   short:'PCS',       idealIvr:50, icon:Shield,      regimeBias:'bullish' },
  { id:'csp',      name:'Cash-Secured Put',     short:'CSP',       idealIvr:40, icon:TrendingDown, regimeBias:'bullish' },
  { id:'ic',       name:'Iron Condor',          short:'IC',        idealIvr:55, icon:Target,      regimeBias:'neutral' },
  { id:'strangle', name:'Short Strangle',       short:'Strangle',  idealIvr:60, icon:BarChart2,   regimeBias:'neutral' },
  { id:'jade',     name:'Jade Lizard',          short:'Jade',      idealIvr:55, icon:Zap,         regimeBias:'bullish' },
];

// ─── Compact Ticker Bar ───────────────────────────────────────────────────────
function TickerBar({ selected, onSelect, candidates, universe, loading }:{
  selected:string|null; onSelect:(t:string)=>void;
  candidates:CandidateRow[]; universe:string[]; loading:boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const map = useMemo(()=>{ const m=new Map<string,CandidateRow>(); candidates.forEach(c=>m.set(c.ticker,c)); return m; },[candidates]);
  const filtered = useMemo(()=>{
    const s = q.toUpperCase().trim();
    return universe.filter(t=>!s||t.includes(s));
  },[universe,q]);

  return (
    <div className="relative flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: DIM }}>Asset</span>
      <button onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-2 px-3 py-2 rounded border transition-all"
        style={{ background: CARD, borderColor: selected?'oklch(0.80 0.15 200 / 40%)':BORDER, color: BRIGHT, minWidth:'180px' }}
      >
        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{color:DIM}} /> :
          selected ? <><span className="font-mono-data text-sm font-bold" style={{color:CYAN}}>{selected}</span>
            {map.has(selected)&&<span className="text-xs font-mono-data" style={{color:DIM}}>IVR {map.get(selected)!.ivr.toFixed(0)}</span>}</>
          : <span className="text-sm" style={{color:DIM}}>Select asset…</span>
        }
        <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{color:DIM}} />
      </button>
      {open && (
        <div className="absolute top-full left-8 mt-1 z-30 rounded border" style={{background:'oklch(0.14 0.010 258)',borderColor:BORDER,width:'280px',maxHeight:'360px',overflowY:'auto'}}>
          <div className="p-2 border-b sticky top-0" style={{borderColor:BORDER,background:'oklch(0.14 0.010 258)'}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
              className="w-full px-2 py-1.5 rounded text-sm font-mono-data outline-none"
              style={{background:'oklch(0.20 0.010 258)',color:BRIGHT,border:'1px solid oklch(1 0 0 / 12%)'}} />
          </div>
          {filtered.map(ticker=>{
            const c = map.get(ticker);
            const ev = c ? evaluateCandidate(c) : null;
            return (
              <button key={ticker} onClick={()=>{onSelect(ticker);setOpen(false);setQ('');}}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[oklch(1_0_0_/_4%)] border-b"
                style={{borderColor:'oklch(1 0 0 / 5%)'}}>
                <span className="font-mono-data text-sm font-bold w-14" style={{color:c?CYAN:DIM}}>{ticker}</span>
                {c && <span className="text-xs font-mono-data" style={{color:DIM}}>IVR {c.ivr.toFixed(0)} · ${c.price.toFixed(0)}</span>}
                {ev && <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data ml-auto" style={{background:`${ev.color}18`,color:ev.color}}>{ev.label}</span>}
              </button>
            );
          })}
          {q && !universe.includes(q.toUpperCase()) && (
            <button onClick={()=>{onSelect(q.toUpperCase());setOpen(false);setQ('');}}
              className="w-full px-3 py-2.5 text-left text-sm font-mono-data hover:bg-[oklch(1_0_0_/_4%)]"
              style={{color:AMBER}}>
              Use "{q.toUpperCase()}" →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Left Pane: Asset Diagnostics ────────────────────────────────────────────
function AssetDiagnostics({ ticker }: { ticker: string }) {
  const { data: intel } = useMarketIntelligence(ticker);
  const { data: levels } = useChartLevels(ticker);
  const { data: flow } = useOrderFlow(ticker);

  const regime = intel?.regime;
  const callWall = regime?.gex_call_wall ?? intel?.gex?.call_wall ?? null;
  const putWall  = regime?.gex_put_wall  ?? intel?.gex?.put_wall  ?? null;
  const flipZone = regime?.flip_zone     ?? intel?.gex?.flip_zone ?? null;
  const dpFloor  = regime?.dp_floor      ?? null;
  const dpCeil   = regime?.dp_ceiling    ?? null;
  const netDrift = regime?.net_drift     ?? null;
  const score    = regime?.score         ?? null;
  const spot     = intel?.current_price  ?? null;
  const regimeColor = (regime?.overall === 'bullish'||regime?.overall === 'Bullish') ? GREEN
                    : (regime?.overall === 'bearish'||regime?.overall === 'Bearish') ? RED : AMBER;

  const walls = [
    { label: 'GEX Call Wall',   value: callWall,  color: GREEN },
    { label: 'GEX Put Wall',    value: putWall,   color: RED   },
    { label: 'Flip Zone',       value: flipZone,  color: AMBER },
    { label: 'DP Floor',        value: dpFloor,   color: CYAN  },
    { label: 'DP Ceiling',      value: dpCeil,    color: CYAN  },
    { label: 'Current Price',   value: spot,      color: BRIGHT},
  ];

  return (
    <div className="space-y-4">
      {/* Regime header */}
      {regime && (
        <div className="rounded border p-3 flex items-center gap-3" style={{background:CARD,borderColor:BORDER}}>
          <Activity className="w-4 h-4" style={{color:regimeColor}} />
          <div>
            <span className="font-mono-data text-sm font-bold" style={{color:regimeColor}}>
              {(regime.overall??'neutral').toUpperCase()}
            </span>
            {score!=null && <span className="font-mono-data text-xs ml-2" style={{color:DIM}}>
              Score {score>0?'+':''}{score}
            </span>}
          </div>
          {netDrift!=null && (
            <span className="text-xs ml-auto font-mono-data" style={{color:netDrift>0?GREEN:RED}}>
              Drift {netDrift>0?'▲':'▼'} {Math.abs(netDrift).toFixed(0)}
            </span>
          )}
        </div>
      )}

      {/* Walls & levels grid */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{color:DIM}}>Market Structure</div>
        <div className="grid grid-cols-2 gap-2">
          {walls.map(w => w.value!=null && (
            <div key={w.label} className="rounded p-2.5" style={{background:CARD,border:`1px solid ${BORDER}`}}>
              <div className="text-[9px] uppercase tracking-wider" style={{color:DIM}}>{w.label}</div>
              <div className="font-mono-data text-sm font-bold mt-0.5" style={{color:w.color}}>${w.value.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Trade setups */}
      {intel?.trade_setups && intel.trade_setups.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{color:DIM}}>Suggested Setups</div>
          <div className="space-y-2">
            {intel.trade_setups.slice(0,3).map((s,i)=>{
              const c = s.type==='bullish'?GREEN:s.type==='bearish'?RED:AMBER;
              return (
                <div key={i} className="rounded border p-3" style={{background:'oklch(0.20 0.010 258)',borderColor:`${c}25`}}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-data text-xs font-bold" style={{color:c}}>{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:`${c}18`,color:c}}>{s.confidence}</span>
                  </div>
                  <p className="text-[11px]" style={{color:DIM}}>{s.description}</p>
                  {(s.entry||s.target||s.stop) && (
                    <div className="flex flex-wrap gap-4 mt-1.5 text-[10px] font-mono-data">
                      {s.entry&&<span style={{color:DIM}}>Entry: <span style={{color:BRIGHT}}>{s.entry}</span></span>}
                      {s.target&&<span style={{color:DIM}}>Target: <span style={{color:GREEN}}>{s.target}</span></span>}
                      {s.stop&&<span style={{color:DIM}}>Stop: <span style={{color:RED}}>{s.stop}</span></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key levels */}
      {levels && (levels.dp_floors.length>0||levels.support.length>0||levels.resistance.length>0) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{color:DIM}}>Key Levels</div>
          <div className="flex flex-wrap gap-1.5">
            {levels.dp_floors.slice(0,4).map(l=>(
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded" style={{background:'oklch(0.80 0.15 200 / 10%)',color:CYAN}}>DP ${l.toFixed(0)}</span>
            ))}
            {levels.support.slice(0,3).map(l=>(
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded" style={{background:'oklch(0.72 0.18 145 / 10%)',color:GREEN}}>S ${l.toFixed(0)}</span>
            ))}
            {levels.resistance.slice(0,3).map(l=>(
              <span key={l} className="font-mono-data text-[10px] px-2 py-0.5 rounded" style={{background:'oklch(0.65 0.22 25 / 10%)',color:RED}}>R ${l.toFixed(0)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Order flow summary */}
      {flow && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{color:DIM}}>Order Flow</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {label:'Call Premium',value:flow.call_premium_m!=null?`$${flow.call_premium_m.toFixed(1)}M`:flow.call_pct!=null?`${flow.call_pct.toFixed(0)}%`:'—',color:GREEN},
              {label:'Put Premium', value:flow.put_premium_m!=null?`$${flow.put_premium_m.toFixed(1)}M`:flow.put_pct!=null?`${flow.put_pct.toFixed(0)}%`:'—',color:RED},
              {label:'Net Bias',    value:flow.net_bias??flow.bias??'—',                       color:AMBER},
              {label:'Vol Rank',   value:flow.volume_rank!=null?`${flow.volume_rank.toFixed(0)}%`:'—',color:DIM},
            ].map(m=>(
              <div key={m.label} className="rounded p-2.5" style={{background:CARD,border:`1px solid ${BORDER}`}}>
                <div className="text-[9px] uppercase tracking-wider" style={{color:DIM}}>{m.label}</div>
                <div className="font-mono-data text-sm font-bold mt-0.5" style={{color:m.color}}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Pane: Strategy + PoP + Badge ───────────────────────────────────────
function StrategyBuilder({ ticker, candidate, pretradeResult }: {
  ticker: string; candidate: CandidateRow|null; pretradeResult: PretradeResult|null;
}) {
  const { data: intel } = useMarketIntelligence(ticker);
  const { addOrder, hasOrder } = usePendingOrders();
  const { config } = useConfig();
  const { submitOrder } = usePendingOrderActions();
  const [, navigate] = useLocation();

  const [selectedStrategy, setSelectedStrategy] = useState<string|null>(null);
  const [dte, setDte] = useState(45);
  const [shortStrike, setShortStrike] = useState(0);
  const [longStrike, setLongStrike]   = useState(0);
  const [credit, setCredit] = useState(0);
  const [qty, setQty] = useState(1);

  const price   = candidate?.price ?? intel?.current_price ?? 0;
  const ivDec   = (candidate?.current_iv ?? 30) / 100;

  const callWall = intel?.regime?.gex_call_wall ?? intel?.gex?.call_wall ?? null;
  const putWall  = intel?.regime?.gex_put_wall  ?? intel?.gex?.put_wall  ?? null;

  // Init short strike when price loads
  useEffect(() => {
    if (price > 0 && shortStrike === 0) {
      const est = Math.round(price * 0.93 / 5) * 5;
      setShortStrike(est);
      setLongStrike(Math.round((est - price * 0.05) / 5) * 5);
    }
  }, [price]);

  const stratDef = STRATEGIES.find(s=>s.id===selectedStrategy);

  const pop = useMemo(()=> shortStrike>0 ? calcPoP(price,shortStrike,ivDec,dte) : null, [price,shortStrike,ivDec,dte]);
  const maxProfit = credit * qty;
  const width = Math.abs(shortStrike - longStrike);
  const maxRisk = stratDef?.id==='csp' || stratDef?.id==='strangle' ? null : (width*100 - credit)*qty;
  const rr = maxRisk!=null && maxRisk>0 ? maxProfit/maxRisk : null;

  // Breakeven
  const lowerBE = shortStrike > 0 && credit > 0 ? shortStrike - credit : null;
  const upperBE = (stratDef?.id==='ic'||stratDef?.id==='strangle') && longStrike>0 && credit>0
    ? longStrike + credit : null;

  const handleQueue = useCallback(() => {
    if (!candidate || !stratDef) return;
    addOrder({
      ticker: candidate.ticker,
      strategy: stratDef.short,
      shortStrike, longStrike, expiry:`${dte}d`,
      creditMin: Math.round(credit*0.9),
      creditMax: Math.round(credit*1.1),
      qty,
      rationale: `PoP ${pop!=null?(pop*100).toFixed(1):'?'}% · IVR ${candidate.ivr.toFixed(0)} · ${stratDef.short}`,
      dpFloorUsed: undefined,
    });
    toast.success(`${candidate.ticker} ${stratDef.short} queued`);
  }, [candidate, stratDef, shortStrike, longStrike, dte, credit, qty, pop, addOrder]);

  const handleRouteOrder = useCallback(async () => {
    if (!candidate || !stratDef) return;

    // Nearest Friday >= today + dte
    const target = new Date();
    target.setDate(target.getDate() + dte);
    const dow = target.getDay();
    if (dow !== 5) target.setDate(target.getDate() + ((5 - dow + 7) % 7));
    const yy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const expiryStr = `${yy}${mm}${dd}`;

    type Leg = { ticker:string; sec_type:string; right?:string; strike?:number; expiry?:string; action:string; ratio:number; exchange:string };
    const legs: Leg[] = [];
    const t = candidate.ticker;
    const ex = 'CBOE';

    if (stratDef.id === 'csp') {
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:shortStrike, expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
    } else if (stratDef.id === 'pcs') {
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:shortStrike, expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:longStrike,  expiry:expiryStr, action:'BUY',  ratio:1, exchange:ex });
    } else if (stratDef.id === 'ic') {
      const width = Math.abs(shortStrike - longStrike);
      const callShort = Math.round(price + (price - shortStrike));
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:shortStrike,        expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:longStrike,         expiry:expiryStr, action:'BUY',  ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'C', strike:callShort,          expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'C', strike:callShort + width,  expiry:expiryStr, action:'BUY',  ratio:1, exchange:ex });
    } else if (stratDef.id === 'strangle') {
      const callStrike = Math.round(price + (price - shortStrike));
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:shortStrike, expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'C', strike:callStrike,  expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
    } else {
      legs.push({ ticker:t, sec_type:'OPT', right:'P', strike:shortStrike, expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
      legs.push({ ticker:t, sec_type:'OPT', right:'C', strike:longStrike,  expiry:expiryStr, action:'SELL', ratio:1, exchange:ex });
    }

    try {
      await submitOrder({
        ticker:       candidate.ticker,
        strategy:     stratDef.short,
        legs,
        order_type:   'LMT',
        action:       'SELL',
        quantity:     qty,
        limit_price:  credit > 0 ? parseFloat(credit.toFixed(2)) : undefined,
        tif:          'DAY',
        submitted_by: 'BuildCenter',
        pop:          pop != null ? parseFloat((pop * 100).toFixed(1)) : undefined,
        max_profit:   credit > 0 ? parseFloat((credit * qty * 100).toFixed(0)) : undefined,
        max_loss:     maxRisk != null ? parseFloat(maxRisk.toFixed(0)) : undefined,
      });
      toast.success(`${candidate.ticker} ${stratDef.short} routed to Approvals`);
      navigate('/approvals');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to route order');
    }
  }, [candidate, stratDef, shortStrike, longStrike, dte, credit, qty, pop, maxRisk, price, submitOrder, navigate]);

  const signalMode = config.traderProfile?.signalMode ?? 'advisory';
  const gateBlocked = pretradeResult?.verdict !== 'PROCEED';

  return (
    <div className="space-y-4">
      {/* Pre-trade gate */}
      {pretradeResult && (
        <div className="rounded border p-3"
          style={{background:pretradeResult.verdict==='PROCEED'?'oklch(0.72 0.18 145 / 6%)':'oklch(0.65 0.22 25 / 6%)',
                  borderColor:pretradeResult.verdict==='PROCEED'?'oklch(0.72 0.18 145 / 30%)':'oklch(0.65 0.22 25 / 30%)'}}>
          <div className="flex items-center gap-2">
            {pretradeResult.verdict==='PROCEED'
              ? <CheckCircle2 className="w-4 h-4" style={{color:GREEN}} />
              : <XCircle className="w-4 h-4" style={{color:RED}} />}
            <span className="font-mono-data text-sm font-bold"
              style={{color:pretradeResult.verdict==='PROCEED'?GREEN:RED}}>
              {pretradeResult.verdict}
            </span>
            <span className="text-xs ml-2" style={{color:DIM}}>
              VIX {pretradeResult.vix.toFixed(1)} · {pretradeResult.days_to_earnings}d to earnings
            </span>
          </div>
          {pretradeResult.failures?.length>0 && (
            <ul className="mt-1.5 space-y-0.5">
              {pretradeResult.failures.map((f,i)=>(
                <li key={i} className="text-xs flex items-start gap-1.5" style={{color:RED}}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Signal mode warning */}
      {gateBlocked && signalMode==='strict' && (
        <div className="flex items-start gap-3 rounded px-3 py-2.5"
          style={{background:'oklch(0.65 0.22 25 / 18%)',border:'1px solid oklch(0.65 0.22 25 / 60%)'}}>
          <Lock className="w-4 h-4 mt-0.5 shrink-0" style={{color:RED}} />
          <span className="text-xs" style={{color:RED}}>Strict Mode — gate failed. Change to Advisory in Strategy Workspace.</span>
        </div>
      )}

      {/* Strategy selector */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{color:DIM}}>Strategy</div>
        <div className="space-y-1.5">
          {STRATEGIES.map(s => {
            const ivrOk = (candidate?.ivr??0)>=s.idealIvr;
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={()=>setSelectedStrategy(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-all"
                style={{background:selectedStrategy===s.id?'oklch(0.80 0.15 200 / 8%)':CARD,
                        borderColor:selectedStrategy===s.id?'oklch(0.80 0.15 200 / 50%)':BORDER}}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{color:selectedStrategy===s.id?CYAN:DIM}} />
                <span className="font-mono-data text-sm font-bold" style={{color:selectedStrategy===s.id?BRIGHT:DIM}}>{s.short}</span>
                <span className="text-xs flex-1" style={{color:DIM}}>{s.name}</span>
                {!ivrOk && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'oklch(0.78 0.18 85 / 12%)',color:AMBER}}>IVR low</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculator */}
      {selectedStrategy && price > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{color:DIM}}>Parameters</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {label:'DTE',val:dte,set:setDte,min:1,max:365,step:1},
              {label:'Short Strike',val:shortStrike,set:setShortStrike,min:1,max:99999,step:1},
              {label:'Long Strike', val:longStrike, set:setLongStrike, min:1,max:99999,step:1},
              {label:'Credit ($)',  val:credit,     set:setCredit,     min:0,max:99999,step:0.01},
              {label:'Qty',         val:qty,        set:setQty,        min:1,max:100,  step:1},
            ].map(f=>(
              <div key={f.label} className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider" style={{color:DIM}}>{f.label}</label>
                <input type="number" value={f.val} min={f.min} max={f.max} step={f.step}
                  onChange={e=>f.set(parseFloat(e.target.value)||0)}
                  className="w-full px-2 py-1.5 rounded border text-sm font-mono-data outline-none"
                  style={{background:'oklch(0.22 0.010 258)',borderColor:BORDER,color:BRIGHT}} />
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {label:'PoP',value:pop!=null?`${(pop*100).toFixed(1)}%`:'—',color:pop!=null&&pop>=0.70?GREEN:pop!=null&&pop>=0.55?AMBER:RED},
              {label:'Max Profit',value:`$${maxProfit.toFixed(0)}`,color:GREEN},
              {label:'Max Risk',value:maxRisk!=null?`$${maxRisk.toFixed(0)}`:'Unlimited',color:maxRisk!=null?AMBER:RED},
              {label:'R:R',value:rr!=null?`1:${(1/rr).toFixed(1)}`:'—',color:DIM},
            ].map(m=>(
              <div key={m.label} className="rounded p-2" style={{background:'oklch(0.22 0.010 258)'}}>
                <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{color:DIM}}>{m.label}</div>
                <div className="font-mono-data text-sm font-bold" style={{color:m.color}}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* ─── GEX Wall vs Breakeven Badge ─── */}
          {(lowerBE!=null||upperBE!=null) && (putWall!=null||callWall!=null) && (()=>{
            const items: React.ReactNode[] = [];

            if (lowerBE!=null && putWall!=null && lowerBE<price) {
              const buffer=(putWall-lowerBE)/price;
              const isOk=buffer>0, isMarginal=!isOk&&Math.abs(buffer)<0.02;
              const pct=(Math.abs(buffer)*100).toFixed(1);
              items.push(
                <div key="put" className="flex items-center gap-2 rounded px-3 py-2.5"
                  style={{background:isOk?'oklch(0.72 0.18 145 / 10%)':isMarginal?'oklch(0.78 0.18 85 / 10%)':'oklch(0.65 0.22 25 / 10%)',
                          border:`1px solid ${isOk?'oklch(0.72 0.18 145 / 35%)':isMarginal?'oklch(0.78 0.18 85 / 35%)':'oklch(0.65 0.22 25 / 35%)'}`}}>
                  {isOk
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{color:GREEN}} />
                    : isMarginal
                    ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{color:AMBER}} />
                    : <XCircle className="w-3.5 h-3.5 shrink-0" style={{color:RED}} />}
                  <span className="text-xs font-mono-data" style={{color:isOk?GREEN:isMarginal?AMBER:RED}}>
                    {isOk
                      ? `✓ Downside BE $${lowerBE.toFixed(0)} hidden behind $${putWall.toFixed(0)} Put Wall — ${pct}% buffer`
                      : isMarginal
                      ? `⚠ BE $${lowerBE.toFixed(0)} within ${pct}% of $${putWall.toFixed(0)} Put Wall — thin cushion`
                      : `✗ BE $${lowerBE.toFixed(0)} exposed — ${pct}% beyond $${putWall.toFixed(0)} Put Wall`}
                  </span>
                </div>
              );
            }

            if (upperBE!=null && callWall!=null) {
              const buffer=(upperBE-callWall)/price;
              const isOk=buffer<0, isMarginal=!isOk&&Math.abs(buffer)<0.02;
              const pct=(Math.abs(buffer)*100).toFixed(1);
              items.push(
                <div key="call" className="flex items-center gap-2 rounded px-3 py-2.5"
                  style={{background:isOk?'oklch(0.72 0.18 145 / 10%)':isMarginal?'oklch(0.78 0.18 85 / 10%)':'oklch(0.65 0.22 25 / 10%)',
                          border:`1px solid ${isOk?'oklch(0.72 0.18 145 / 35%)':isMarginal?'oklch(0.78 0.18 85 / 35%)':'oklch(0.65 0.22 25 / 35%)'}`}}>
                  {isOk
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{color:GREEN}} />
                    : isMarginal
                    ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{color:AMBER}} />
                    : <XCircle className="w-3.5 h-3.5 shrink-0" style={{color:RED}} />}
                  <span className="text-xs font-mono-data" style={{color:isOk?GREEN:isMarginal?AMBER:RED}}>
                    {isOk
                      ? `✓ Upside BE $${upperBE.toFixed(0)} hidden behind $${callWall.toFixed(0)} Call Wall — ${pct}% buffer`
                      : isMarginal
                      ? `⚠ Upside BE $${upperBE.toFixed(0)} within ${pct}% of $${callWall.toFixed(0)} Call Wall`
                      : `✗ Upside BE $${upperBE.toFixed(0)} exposed — ${pct}% beyond $${callWall.toFixed(0)} Call Wall`}
                  </span>
                </div>
              );
            }

            return items.length>0?<div className="space-y-1.5">{items}</div>:null;
          })()}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={handleQueue}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded border text-sm font-semibold transition-all hover:opacity-80"
              style={{color:DIM,borderColor:BORDER}}>
              <Plus className="w-4 h-4" />
              {hasOrder(ticker) ? 'Update Queue' : 'Local Queue'}
            </button>
            <button onClick={handleRouteOrder}
              disabled={!selectedStrategy || credit <= 0}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded border text-sm font-semibold transition-all disabled:opacity-40 hover:opacity-90"
              style={{color:GREEN,borderColor:'oklch(0.72 0.18 145 / 50%)'}}>
              <Send className="w-4 h-4" />
              Route to Approvals
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BuildCenterPage() {
  const { config } = useConfig();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tickerParam = params.get('ticker')?.toUpperCase() ?? null;

  const [selectedTicker, setSelectedTicker] = useState<string|null>(tickerParam);

  // Update if query param changes (e.g. Action Center "Analyse →")
  useEffect(() => { if (tickerParam) setSelectedTicker(tickerParam); }, [tickerParam]);

  const { data: candData, loading: candLoading, refresh } = useCandidates();
  const { data: pretradeData } = usePretradeAll();

  const candidates   = candData?.rows ?? [];
  const candidate    = candidates.find(c=>c.ticker===selectedTicker) ?? null;
  const pretrade     = pretradeData?.results.find(r=>r.ticker===selectedTicker) ?? null;

  if (!config.apiToken) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Build Center" subtitle="Cockpit 2 — Research · Strategy · Risk" />
        <div className="p-6">
          <EmptyState type="no-config" title="API token required" description="Configure your API token in Settings." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Build Center"
        subtitle={selectedTicker
          ? `Cockpit 2 — ${selectedTicker} · Research · Strategy · Risk`
          : 'Cockpit 2 — Select an asset to begin'}
        onRefresh={refresh}
        refreshing={candLoading}
      >
        <TickerBar
          selected={selectedTicker}
          onSelect={setSelectedTicker}
          candidates={candidates}
          universe={config.tickers}
          loading={candLoading}
        />
      </PageHeader>

      <div className="p-6">
        {!selectedTicker ? (
          <div className="rounded border py-20 text-center" style={{borderColor:BORDER}}>
            <BarChart2 className="w-12 h-12 mx-auto mb-3" style={{color:DIM}} />
            <p className="text-sm font-semibold" style={{color:BRIGHT}}>Select an asset to begin</p>
            <p className="text-xs mt-1" style={{color:DIM}}>Or click "Analyse →" from an alert in the Action Center</p>
          </div>
        ) : (
          <div className="grid grid-cols-[55%_45%] gap-5" style={{alignItems:'start'}}>
            {/* Left: Asset diagnostics */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-3 pb-1 border-b"
                style={{color:DIM,borderColor:BORDER}}>
                {selectedTicker} — Market Structure &amp; Intel
              </div>
              <AssetDiagnostics ticker={selectedTicker} />
            </div>

            {/* Right: Strategy builder */}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-3 pb-1 border-b"
                style={{color:DIM,borderColor:BORDER}}>
                Strategy Builder
              </div>
              <StrategyBuilder
                ticker={selectedTicker}
                candidate={candidate}
                pretradeResult={pretrade}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
