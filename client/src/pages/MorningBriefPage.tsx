/**
 * FORTRESS V3 — Morning Brief Page (v3.1)
 * Improvements: IV heatmap fallback, enriched trade rows with IVR/GEX/bias,
 * gamma flip in regime display, beta-weighted delta, theta efficiency,
 * market status pill, taller SPY chart, cleaner layout.
 */

import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  useBriefing,
  useTradeReport,
  usePositions,
  useCandidates,
  useChartData,
  useIbkrPreview,
  useMarketIntelligence,
  formatDollar,
  type TradeReport,
  type TradeReportRollCandidate,
  type TradeReportPostEarningsCandidate,
  type CandidateRow,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Link } from 'wouter';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Target,
  XCircle,
  CheckCircle,
  ArrowRight,
  Sigma,
  Activity,
  BarChart2,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

/** Navigate to Analysis page with ticker pre-selected */
function navigateToAnalysis(ticker: string, navigate: (path: string) => void) {
  sessionStorage.setItem('fortress_analysis_ticker', ticker);
  navigate('/analysis');
}

// ─── Market status pill ───────────────────────────────────────────────────────

function MarketStatusPill() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  const [hStr, mStr] = etStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const totalMin = h * 60 + m;

  let label: string;
  let color: string;
  if (isWeekend) { label = 'WEEKEND'; color = DIM; }
  else if (totalMin >= 240 && totalMin < 570) { label = 'PRE-MARKET'; color = AMBER; }
  else if (totalMin >= 570 && totalMin < 960) { label = 'MARKET OPEN'; color = GREEN; }
  else if (totalMin >= 960 && totalMin < 1200) { label = 'AFTER HOURS'; color = CYAN; }
  else { label = 'CLOSED'; color = DIM; }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border"
      style={{ background: `${color}12`, borderColor: `${color}30`, color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      <span className="font-mono-data text-[10px] font-semibold">{label}</span>
    </div>
  );
}

// ─── SPY Chart with 50/200 SMA ────────────────────────────────────────────────

function SpyChartWidget() {
  const { data: chartData, loading } = useChartData('SPY');

  const { chartDataWithIndicators, hi52w, thesisBroken } = useMemo(() => {
    if (!chartData?.candles?.length) return { chartDataWithIndicators: [], hi52w: null, thesisBroken: false };

    const candles = chartData.candles;
    const closes = candles.map(c => c.close);

    const base = candles.map(c => ({
      date: new Date(c.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      close: c.close,
    }));

    // 50-day SMA
    const withSma50 = base.map((d, i) => {
      if (i < 49) return { ...d, sma50: null as number | null };
      const slice = closes.slice(i - 49, i + 1);
      return { ...d, sma50: slice.reduce((a, b) => a + b, 0) / 50 };
    });

    // 200-day SMA
    const withBoth = withSma50.map((d, i) => {
      if (i < 199) return { ...d, sma200: null as number | null };
      const slice = closes.slice(i - 199, i + 1);
      return { ...d, sma200: slice.reduce((a, b) => a + b, 0) / 200 };
    });

    const hi52w = closes.length >= 252
      ? Math.max(...closes.slice(-252))
      : Math.max(...closes);

    const lastSma200 = withBoth.filter(d => d.sma200 != null).slice(-1)[0]?.sma200 ?? null;
    const currentClose = closes[closes.length - 1] ?? null;
    const thesisBroken = lastSma200 != null && currentClose != null && currentClose < lastSma200;

    return { chartDataWithIndicators: withBoth, hi52w, thesisBroken };
  }, [chartData]);

  const closes = chartDataWithIndicators.map(d => d.close);
  const minPrice = closes.length ? Math.min(...closes) * 0.98 : 0;
  const maxPrice = closes.length ? Math.max(...closes) * 1.02 : 100;

  return (
    <div className="rounded border p-4" style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: CYAN }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>SPY — Price + 50/200 SMA</span>
          {thesisBroken && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono-data"
              style={{ color: RED, background: 'oklch(0.65 0.22 25 / 15%)', border: '1px solid oklch(0.65 0.22 25 / 30%)' }}>
              ⚠ THESIS BROKEN
            </span>
          )}
        </div>
        <Link href="/analysis">
          <span className="text-xs cursor-pointer font-medium" style={{ color: CYAN }}>Full chart →</span>
        </Link>
      </div>

      {loading ? (
        <div className="h-56 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
      ) : chartDataWithIndicators.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs" style={{ color: DIM }}>
          No chart data — API token required
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartDataWithIndicators} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'oklch(0.45 0.010 258)', fontFamily: 'JetBrains Mono' }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[minPrice, maxPrice]}
                tick={{ fontSize: 9, fill: 'oklch(0.45 0.010 258)', fontFamily: 'JetBrains Mono' }}
                tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={50} />
              <Tooltip
                contentStyle={{
                  background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)',
                  borderRadius: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono', color: BRIGHT,
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`]}
              />
              {hi52w != null && (
                <ReferenceLine y={hi52w} stroke="oklch(0.65 0.22 25 / 60%)" strokeDasharray="5 3" strokeWidth={1}
                  label={{ value: `52W Hi $${hi52w.toFixed(0)}`, fontSize: 8, fill: 'oklch(0.65 0.22 25)', position: 'insideTopRight' }} />
              )}
              <Line type="monotone" dataKey="sma50" stroke="oklch(0.60 0.18 250)" strokeWidth={1.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="sma200" stroke="oklch(0.65 0.22 25)" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="close" stroke={CYAN} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {[
              { color: CYAN, label: 'SPY Price' },
              { color: 'oklch(0.60 0.18 250)', label: '50 SMA' },
              { color: 'oklch(0.65 0.22 25)', label: '200 SMA (Thesis Stop)' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{ background: color }} />
                <span className="font-mono-data text-[9px]" style={{ color: DIM }}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Portfolio Greeks Panel ───────────────────────────────────────────────────

function PortfolioGreeksWidget() {
  const { data: posData, loading } = usePositions();
  const { data: spyChart } = useChartData('SPY');

  const { greeks, netLiq, betaWeightedDelta, thetaEfficiencyPct } = useMemo(() => {
    if (!posData?.positions) return { greeks: null, netLiq: null, betaWeightedDelta: null, thetaEfficiencyPct: null };
    const opts = posData.positions.filter(p => p.sec_type === 'OPT');
    if (!opts.length) return { greeks: null, netLiq: posData.totals?.net_liq ?? null, betaWeightedDelta: null, thetaEfficiencyPct: null };

    let delta = 0, gamma = 0, theta = 0, vega = 0;
    for (const p of opts) {
      const mult = parseFloat(p.multiplier) || 100;
      const qty = p.qty;
      if (p.current_delta != null) delta += p.current_delta * qty * mult;
      if (p.current_gamma != null) gamma += p.current_gamma * qty * mult;
      if (p.current_theta != null) theta += p.current_theta * qty * mult;
      if (p.current_vega != null) vega += p.current_vega * qty * mult;
    }

    const nl = posData.totals?.net_liq ?? null;

    // Beta-weighted delta: approximate using SPY price as denominator
    // β-Δ = raw delta * (underlying price / SPY price)
    // We approximate by summing per-position if price is available
    let bwDelta: number | null = null;
    const spyPrice = spyChart?.candles?.length
      ? spyChart.candles[spyChart.candles.length - 1].close
      : null;
    if (spyPrice) {
      let bwSum = 0;
      for (const p of opts) {
        const mult = parseFloat(p.multiplier) || 100;
        const qty = p.qty;
        const price = p.avg_cost ?? null;
        if (p.current_delta != null && price != null) {
          bwSum += (p.current_delta * qty * mult) * (price / spyPrice);
        }
      }
      bwDelta = bwSum;
    }

    // Theta efficiency: daily theta / net liq as a percentage
    const thetaEff = nl && nl > 0 ? (Math.abs(theta) / nl) * 100 : null;

    return {
      greeks: { delta, gamma, theta, vega, count: opts.length },
      netLiq: nl,
      betaWeightedDelta: bwDelta,
      thetaEfficiencyPct: thetaEff,
    };
  }, [posData, spyChart]);

  // Theta efficiency target: 0.1% – 0.5% of net liq per day
  const thetaEffStatus = thetaEfficiencyPct == null ? null
    : thetaEfficiencyPct >= 0.1 && thetaEfficiencyPct <= 0.5 ? 'on-target'
    : thetaEfficiencyPct < 0.1 ? 'low'
    : 'high';

  const thetaEffColor = thetaEffStatus === 'on-target' ? GREEN
    : thetaEffStatus === 'low' ? AMBER
    : RED;

  return (
    <div className="rounded border p-4" style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sigma className="w-4 h-4" style={{ color: AMBER }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>Portfolio Greeks</span>
        </div>
        <Link href="/positions">
          <span className="text-xs cursor-pointer font-medium" style={{ color: CYAN }}>Positions →</span>
        </Link>
      </div>

      {loading ? (
        <div className="h-40 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
      ) : !greeks ? (
        <div className="h-40 flex items-center justify-center text-xs" style={{ color: DIM }}>
          No options positions
        </div>
      ) : (
        <>
          {/* Primary Greeks grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'Net Δ Delta', value: greeks.delta.toFixed(1), color: greeks.delta >= 0 ? GREEN : RED, sub: greeks.delta > 0 ? 'long bias' : 'short bias' },
              { label: 'Net Θ Theta/day', value: `$${greeks.theta.toFixed(0)}`, color: greeks.theta >= 0 ? GREEN : RED, sub: greeks.theta >= 0 ? 'collecting' : 'paying' },
              { label: 'Net V Vega', value: greeks.vega.toFixed(1), color: 'oklch(0.65 0.22 280)', sub: greeks.vega > 0 ? 'long vol' : 'short vol' },
              { label: 'Legs', value: String(greeks.count), color: CYAN, sub: 'option legs' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
                <div className="font-mono-data text-base font-bold" style={{ color }}>{value}</div>
                <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{label}</div>
                <div className="text-[9px] mt-0.5" style={{ color: 'oklch(0.50 0.010 258)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Beta-weighted delta */}
          {betaWeightedDelta != null && (
            <div className="flex items-center justify-between px-3 py-2 rounded mb-2"
              style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: DIM }}>β-Weighted Δ to SPY</div>
                <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: betaWeightedDelta >= 0 ? GREEN : RED }}>
                  {betaWeightedDelta >= 0 ? '+' : ''}{betaWeightedDelta.toFixed(1)}
                </div>
              </div>
              <div className="text-[9px] text-right" style={{ color: DIM }}>
                Market-equivalent<br />SPY delta exposure
              </div>
            </div>
          )}

          {/* Theta efficiency */}
          {thetaEfficiencyPct != null && (
            <div className="flex items-center justify-between px-3 py-2 rounded"
              style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: DIM }}>Θ Efficiency (Θ / Net Liq)</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono-data text-sm font-bold" style={{ color: thetaEffColor }}>
                    {thetaEfficiencyPct.toFixed(3)}%/day
                  </span>
                  {thetaEffStatus && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono-data"
                      style={{ color: thetaEffColor, background: `${thetaEffColor}15` }}>
                      {thetaEffStatus === 'on-target' ? '✓ ON TARGET' : thetaEffStatus === 'low' ? '↓ LOW' : '↑ HIGH'}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[9px] text-right" style={{ color: DIM }}>
                Target: 0.10%–<br />0.50% / day
              </div>
            </div>
          )}

          {netLiq != null && (
            <div className="text-[10px] font-mono-data mt-2" style={{ color: DIM }}>
              Net Liq: <span style={{ color: CYAN }}>{formatDollar(netLiq)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── IV Rank Heatmap (with fallback for empty screener) ───────────────────────

function IvRankHeatmap() {
  const { data, loading } = useCandidates();
  const { config } = useConfig();

  const ivrColor = (ivr: number) => {
    if (ivr >= 70) return { bg: 'oklch(0.65 0.22 25 / 20%)', border: 'oklch(0.65 0.22 25 / 40%)', text: 'oklch(0.75 0.22 25)' };
    if (ivr >= 50) return { bg: 'oklch(0.78 0.18 85 / 20%)', border: 'oklch(0.78 0.18 85 / 40%)', text: 'oklch(0.85 0.18 85)' };
    if (ivr >= 30) return { bg: 'oklch(0.72 0.18 145 / 15%)', border: 'oklch(0.72 0.18 145 / 30%)', text: 'oklch(0.80 0.18 145)' };
    return { bg: 'oklch(1 0 0 / 5%)', border: 'oklch(1 0 0 / 10%)', text: DIM };
  };

  // Determine display rows: screener results if available, else universe placeholders
  const displayRows: Array<{ ticker: string; ivr: number; current_iv?: number; signal?: string; can_trade?: boolean; isPlaceholder: boolean }> = useMemo(() => {
    const screenerRows = (data?.rows ?? []).filter(r => !r.excluded);
    if (screenerRows.length > 0) {
      return screenerRows
        .sort((a, b) => b.ivr - a.ivr)
        .map(r => ({ ...r, isPlaceholder: false }));
    }
    // Fallback: show universe tickers as placeholder tiles
    return config.tickers.map(t => ({ ticker: t, ivr: 0, isPlaceholder: true }));
  }, [data, config.tickers]);

  const isScreenerEmpty = !loading && (data?.rows ?? []).filter(r => !r.excluded).length === 0;

  return (
    <div className="rounded border p-4" style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: GREEN }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>IV Rank Heatmap</span>
        </div>
        <Link href="/candidates">
          <span className="text-xs cursor-pointer font-medium" style={{ color: CYAN }}>Screener →</span>
        </Link>
      </div>

      {/* Compressed IV banner when screener is empty */}
      {isScreenerEmpty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded mb-3 text-[10px]"
          style={{ background: 'oklch(0.78 0.18 85 / 10%)', border: '1px solid oklch(0.78 0.18 85 / 25%)', color: AMBER }}>
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          No tickers currently meet IVR &gt; {50}. Broad market IV compressed — universe shown for reference.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-16 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {displayRows.map(row => {
              const c = ivrColor(row.ivr);
              return (
                <div
                  key={row.ticker}
                  className="rounded border p-2 cursor-pointer transition-all hover:opacity-80"
                  style={{
                    background: row.isPlaceholder ? 'oklch(1 0 0 / 4%)' : c.bg,
                    borderColor: row.isPlaceholder ? BORDER : c.border,
                    opacity: row.isPlaceholder ? 0.6 : 1,
                  }}
                  title={row.isPlaceholder ? `${row.ticker} — not in screener` : `${row.ticker} — IVR ${row.ivr.toFixed(0)}, IV ${(row.current_iv ?? 0).toFixed(0)}%, ${row.signal}`}
                >
                  <div className="font-mono-data text-xs font-bold" style={{ color: row.isPlaceholder ? DIM : BRIGHT }}>{row.ticker}</div>
                  <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: row.isPlaceholder ? DIM : c.text }}>
                    {row.isPlaceholder ? '—' : row.ivr.toFixed(0)}
                  </div>
                  <div className="text-[9px] font-mono-data mt-0.5" style={{ color: DIM }}>
                    {row.isPlaceholder ? 'no data' : 'IVR'}
                  </div>
                  {!row.isPlaceholder && row.can_trade && (
                    <div className="text-[8px] font-mono-data mt-0.5 px-1 rounded"
                      style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                      ✓ ENTRY
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[
              { label: '≥70 HIGH', color: 'oklch(0.75 0.22 25)' },
              { label: '50–69 ELEVATED', color: 'oklch(0.85 0.18 85)' },
              { label: '30–49 NORMAL', color: 'oklch(0.80 0.18 145)' },
              { label: '<30 LOW', color: DIM },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                <span className="font-mono-data text-[9px]" style={{ color: DIM }}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Compact Trade Report ─────────────────────────────────────────────────────

function CompactTradeReport() {
  const { data, loading, error } = useTradeReport();
  const { data: candidatesData } = useCandidates();
  const [, navigate] = useLocation();
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Build a map of ticker → candidate row for enrichment badges
  const candidateMap = useMemo(() => {
    const m = new Map<string, CandidateRow>();
    (candidatesData?.rows ?? []).forEach(c => m.set(c.ticker, c));
    return m;
  }, [candidatesData]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
      </div>
    );
  }
  if (error) return <p className="text-xs" style={{ color: RED }}>Error: {error}</p>;
  if (!data) return null;

  const report = data as TradeReport;
  const summary = report.summary;

  return (
    <div className="space-y-3">
      {/* Summary chips */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Entries', count: summary?.entry_candidates_count ?? report.entry_candidates?.length ?? 0, color: GREEN },
          { label: 'Stop-Loss', count: summary?.stop_loss_alerts_count ?? report.stop_loss_alerts?.length ?? 0, color: RED },
          { label: 'Exit', count: summary?.exit_candidates_count ?? report.exit_candidates?.length ?? 0, color: AMBER },
          { label: 'Roll', count: summary?.roll_candidates_count ?? report.roll_candidates?.length ?? 0, color: CYAN },
          { label: 'Post-Earn', count: summary?.post_earnings_count ?? report.post_earnings_candidates?.length ?? 0, color: GREEN },
          { label: 'Urgent', count: summary?.urgent_actions ?? 0, color: summary?.urgent_actions ? RED : DIM },
        ].map(s => (
          <div key={s.label} className="rounded border p-2 text-center" style={{ background: 'oklch(0.22 0.010 258)', borderColor: `${s.color}25` }}>
            <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stop-loss alerts */}
      {report.stop_loss_alerts?.filter(a => a.verdict !== 'OK').slice(0, 3).map((a, i) => (
        <div key={i}
          className="flex items-start gap-3 p-3 rounded border cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 30%)' }}
          onClick={() => navigateToAnalysis(a.ticker, navigate)}
        >
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: RED }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>
                STOP-LOSS · {a.ticker} {a.strategy}
              </span>
              {candidateMap.get(a.ticker) && (
                <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                  style={{ color: AMBER, background: 'oklch(0.78 0.18 85 / 12%)' }}>
                  IVR {candidateMap.get(a.ticker)!.ivr.toFixed(0)}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.70 0.010 258)' }}>{a.recommended_action}</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: DIM }} />
        </div>
      ))}

      {/* Entry candidates — enriched with IVR + GEX zone + bias */}
      {report.entry_candidates?.slice(0, 5).map((c, i) => {
        const cand = candidateMap.get(c.ticker);
        const isExpanded = expandedTicker === c.ticker;
        return (
          <div key={i}
            className="rounded border transition-all"
            style={{ background: 'oklch(0.72 0.18 145 / 6%)', borderColor: 'oklch(0.72 0.18 145 / 25%)' }}
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedTicker(isExpanded ? null : c.ticker)}
            >
              <Target className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{c.ticker}</span>
                  {/* IVR badge */}
                  {(c.iv_rank != null || cand?.ivr != null) && (
                    <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                      style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                      IVR {(c.iv_rank ?? cand?.ivr ?? 0).toFixed(0)}
                    </span>
                  )}
                  {/* Signal badge from screener */}
                  {cand && (
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                      style={{ color: AMBER, background: 'oklch(0.78 0.18 85 / 10%)' }}>
                      {cand.signal}
                    </span>
                  )}
                  {/* Bullish/bearish bias badge from screener */}
                  {cand && (() => {
                    const sig = cand.signal?.toLowerCase() ?? '';
                    const isBullish = sig.includes('buy') || sig.includes('strong_sell') === false && sig.includes('sell');
                    const isBearish = sig.includes('sell') || sig.includes('strong_sell');
                    if (isBearish) return (
                      <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                        style={{ color: RED, background: 'oklch(0.65 0.22 25 / 10%)' }}>↓ BEARISH</span>
                    );
                    if (isBullish) return (
                      <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                        style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 10%)' }}>↑ BULLISH</span>
                    );
                    return null;
                  })()}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: DIM }}>
                  {c.action} · {c.days_to_earnings}d to earnings
                </div>
              </div>
              <button
                className="text-[10px] px-2 py-1 rounded border transition-all hover:opacity-80"
                style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
                onClick={e => { e.stopPropagation(); navigateToAnalysis(c.ticker, navigate); }}
              >
                Analyse →
              </button>
            </div>
            {/* Expanded: GEX zone + bias from market intel */}
            {isExpanded && (
              <EntryTickerDetail ticker={c.ticker} />
            )}
          </div>
        );
      })}

      {/* Roll candidates */}
      {report.roll_candidates?.slice(0, 3).map((rc: TradeReportRollCandidate, i) => {
        const maxDte = 45;
        const dte = rc.current_dte ?? null;
        const dtePct = dte != null ? Math.max(0, Math.min(1, dte / maxDte)) : null;
        const R = 12;
        const circumference = 2 * Math.PI * R;
        const dashOffset = dtePct != null ? circumference * (1 - dtePct) : circumference;
        const ringColor = dte == null ? DIM : dte <= 7 ? RED : dte <= 21 ? AMBER : CYAN;
        return (
          <div key={i}
            className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
            style={{ background: 'oklch(0.80 0.15 200 / 5%)', borderColor: 'oklch(0.80 0.15 200 / 20%)' }}
            onClick={() => navigateToAnalysis(rc.ticker, navigate)}
          >
            <div className="flex-shrink-0 relative" style={{ width: 30, height: 30 }}>
              <svg width="30" height="30" viewBox="0 0 30 30" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="15" cy="15" r={R} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="2.5" />
                {dtePct != null && (
                  <circle cx="15" cy="15" r={R} fill="none" stroke={ringColor} strokeWidth="2.5"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-data font-bold" style={{ fontSize: 8, color: ringColor }}>{dte ?? '—'}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{rc.ticker}</span>
                <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                  style={{ color: rc.urgency === 'URGENT' ? RED : rc.urgency === 'THIS_WEEK' ? AMBER : DIM, background: 'oklch(1 0 0 / 5%)' }}>
                  {rc.urgency}
                </span>
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: DIM }}>{rc.strategy} · {rc.expiry ?? '—'}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: DIM }} />
          </div>
        );
      })}

      {/* Post-earnings */}
      {report.post_earnings_candidates?.slice(0, 2).map((pe: TradeReportPostEarningsCandidate, i) => (
        <div key={i}
          className="flex items-center gap-3 p-3 rounded border cursor-pointer transition-all hover:bg-[oklch(0.72_0.18_145_/_12%)]"
          style={{ background: 'oklch(0.72 0.18 145 / 5%)', borderColor: 'oklch(0.72 0.18 145 / 20%)' }}
          onClick={() => navigateToAnalysis(pe.ticker, navigate)}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{pe.ticker}</span>
              <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                POST-EARN
              </span>
            </div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: DIM }}>{pe.note}</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: DIM }} />
        </div>
      ))}

      {/* Macro footer */}
      {report.macro && (
        <div className="flex items-center gap-3 text-[10px] font-mono-data pt-1" style={{ color: DIM }}>
          <span>VIX {report.macro.vix?.toFixed(2)}</span>
          <span>·</span>
          <span className="capitalize">{report.macro.regime}</span>
          <span>·</span>
          <span>{report.macro.vix_state}</span>
        </div>
      )}
    </div>
  );
}

// ─── Entry ticker detail (expanded row) ──────────────────────────────────────

function EntryTickerDetail({ ticker }: { ticker: string }) {
  const { data: intel, loading } = useMarketIntelligence(ticker);

  if (loading) {
    return (
      <div className="px-3 pb-3">
        <div className="h-10 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="px-3 pb-3 text-[10px]" style={{ color: DIM }}>
        No market intelligence data
      </div>
    );
  }

  const gammaRegime = intel.regime?.gamma_regime ?? intel.regime?.overall ?? null;
  const netDrift = intel.regime?.net_drift ?? null;
  const flipZone = intel.regime?.flip_zone ?? null;
  const gexCallWall = intel.regime?.gex_call_wall ?? null;
  const gexPutWall = intel.regime?.gex_put_wall ?? null;

  const gammaColor = gammaRegime?.toLowerCase().includes('positive') ? GREEN
    : gammaRegime?.toLowerCase().includes('negative') ? RED
    : AMBER;

  const driftColor = netDrift != null
    ? (netDrift > 0 ? GREEN : netDrift < 0 ? RED : DIM)
    : DIM;

  return (
    <div className="px-3 pb-3 border-t" style={{ borderColor: 'oklch(0.72 0.18 145 / 20%)' }}>
      <div className="flex flex-wrap gap-2 pt-2">
        {gammaRegime && (
          <span className="text-[9px] font-mono-data px-2 py-1 rounded border"
            style={{ color: gammaColor, background: `${gammaColor}12`, borderColor: `${gammaColor}30` }}>
            GEX: {gammaRegime}
          </span>
        )}
        {netDrift != null && (
          <span className="text-[9px] font-mono-data px-2 py-1 rounded border"
            style={{ color: driftColor, background: `${driftColor}12`, borderColor: `${driftColor}30` }}>
            Drift: {netDrift > 0 ? '+' : ''}{netDrift.toFixed(2)}
          </span>
        )}
        {flipZone != null && (
          <span className="text-[9px] font-mono-data px-2 py-1 rounded border"
            style={{ color: AMBER, background: 'oklch(0.78 0.18 85 / 10%)', borderColor: 'oklch(0.78 0.18 85 / 25%)' }}>
            Flip: ${flipZone.toFixed(0)}
          </span>
        )}
        {gexCallWall != null && (
          <span className="text-[9px] font-mono-data px-2 py-1 rounded border"
            style={{ color: RED, background: 'oklch(0.65 0.22 25 / 10%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}>
            Call Wall: ${gexCallWall.toFixed(0)}
          </span>
        )}
        {gexPutWall != null && (
          <span className="text-[9px] font-mono-data px-2 py-1 rounded border"
            style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 10%)', borderColor: 'oklch(0.72 0.18 145 / 25%)' }}>
            Put Wall: ${gexPutWall.toFixed(0)}
          </span>
        )}
        {(!gammaRegime && netDrift == null && flipZone == null) && (
          <span className="text-[9px]" style={{ color: DIM }}>No GEX data available</span>
        )}
      </div>
    </div>
  );
}

// ─── Account Strip ────────────────────────────────────────────────────────────

function AccountStrip() {
  const { data: preview, loading } = useIbkrPreview();
  const { data: briefing } = useBriefing();
  const { data: spyIntel } = useMarketIntelligence('SPY');

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
      </div>
    );
  }

  const netLiq = preview?.net_liq ?? null;
  const excessLiq = preview?.excess_liquidity ?? null;
  const availFunds = preview?.available_funds ?? null;
  const dailyPnl = preview?.daily_pnl ?? null;
  const regime = briefing?.macro_regime?.regime ?? null;
  const vix = briefing?.macro_regime?.vix ?? null;

  // Gamma flip from SPY market intel
  const spyFlip = spyIntel?.regime?.flip_zone ?? null;
  const spyGammaRegime = spyIntel?.regime?.gamma_regime ?? null;

  // Build regime label with gamma flip
  const regimeLabel = (() => {
    if (!regime) return '—';
    const base = regime.toUpperCase();
    if (spyFlip != null) return `${base} · Flip $${spyFlip.toFixed(0)}`;
    return base;
  })();

  const regimeColor = regime === 'bullish' ? GREEN : regime === 'bearish' ? RED : AMBER;

  const metrics = [
    { label: 'Net Liq', value: netLiq != null ? formatDollar(netLiq) : '—', color: CYAN, sub: null },
    { label: 'Excess Liq', value: excessLiq != null ? formatDollar(excessLiq) : '—', color: 'oklch(0.70 0.010 258)', sub: null },
    { label: 'Daily P&L', value: dailyPnl != null ? formatDollar(dailyPnl) : '—', color: dailyPnl == null ? DIM : dailyPnl >= 0 ? GREEN : RED, sub: null },
    {
      label: 'Macro Regime',
      value: regimeLabel,
      color: regimeColor,
      sub: spyGammaRegime ? `SPY GEX: ${spyGammaRegime}` : (vix != null ? `VIX ${vix.toFixed(1)}` : null),
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map(({ label, value, color, sub }) => (
        <div key={label} className="rounded border p-3" style={{ background: CARD, borderColor: BORDER }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{label}</div>
          <div className="font-mono-data text-sm font-bold leading-tight" style={{ color }}>{value}</div>
          {sub && <div className="text-[9px] mt-1 font-mono-data" style={{ color: DIM }}>{sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MorningBriefPage() {
  const { config } = useConfig();
  const { data: briefing, loading, refresh } = useBriefing();

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Morning Brief"
        subtitle={`Fortress v3 — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        lastUpdated={briefing?.as_of ? new Date(briefing.as_of) : null}
        onRefresh={refresh}
        refreshing={loading}
      >
        <MarketStatusPill />
      </PageHeader>

      <div className="p-6 space-y-6">
        {!config.apiToken ? (
          <EmptyState
            type="no-config"
            title="API token required"
            description="Add your bearer token in Settings → API Connection to connect to the Fortress server."
          />
        ) : (
          <>
            {/* Account strip */}
            <AccountStrip />

            {/* Trade Report — full width */}
            <div className="rounded border p-4" style={{ background: CARD, borderColor: BORDER }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Morning Trade Report</h2>
                  <p className="text-xs mt-0.5" style={{ color: DIM }}>Prioritised action list — click any entry row to expand GEX context</p>
                </div>
                <Link href="/candidates">
                  <span className="text-xs cursor-pointer font-medium" style={{ color: CYAN }}>All candidates →</span>
                </Link>
              </div>
              <CompactTradeReport />
            </div>

            {/* Indicator widgets — 3-col grid below trade report */}
            <div className="grid grid-cols-3 gap-4">
              <SpyChartWidget />
              <PortfolioGreeksWidget />
              <IvRankHeatmap />
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { href: '/analysis', label: 'Analysis', sub: 'Charts + indicators', icon: Activity, color: CYAN },
                { href: '/positions', label: 'Positions', sub: 'Per-leg Greeks', icon: BarChart2, color: GREEN },
                { href: '/candidates', label: 'Candidates', sub: 'IV rank screener', icon: Target, color: AMBER },
                { href: '/market-intel', label: 'Market Intel', sub: 'GEX / DP / Drift', icon: TrendingUp, color: RED },
              ].map(({ href, label, sub, icon: Icon, color }) => (
                <Link key={href} href={href}>
                  <div className={cn(
                    'flex items-center gap-3 p-3 rounded border transition-all hover:bg-[oklch(1_0_0_/_4%)] cursor-pointer'
                  )} style={{ background: CARD, borderColor: BORDER }}>
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}25`, border: `1px solid ${color}40` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'oklch(0.85 0.005 258)' }}>{label}</div>
                      <div className="text-[10px] truncate" style={{ color: DIM }}>{sub}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: 'oklch(0.45 0.010 258)' }} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
