/**
 * FORTRESS V3 — Morning Brief Page
 * Landing page: full-width trade report + indicator charts.
 * Sections: Trade Report | SPY chart (50/200 SMA) | Portfolio Greeks bar | IV Rank heatmap
 */

import { useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  useBriefing,
  useTradeReport,
  usePositions,
  useCandidates,
  useChartData,
  useIbkrPreview,
  formatDollar,
  type TradeReport,
  type TradeReportRollCandidate,
  type TradeReportPostEarningsCandidate,
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
  BarChart,
  Bar,
  Cell,
  ReferenceLine as BarReferenceLine,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

/** Navigate to Analysis page with ticker pre-selected */
function navigateToAnalysis(ticker: string, navigate: (path: string) => void) {
  sessionStorage.setItem('fortress_analysis_ticker', ticker);
  navigate('/analysis');
}

// ─── SPY Chart with 50/200 SMA ────────────────────────────────────────────────

function SpyChartWidget() {
  const { data: chartData, loading } = useChartData('SPY');

  const { chartDataWithIndicators, hi52w, thesisBroken } = useMemo(() => {
    if (!chartData?.candles?.length) return { chartDataWithIndicators: [], hi52w: null, thesisBroken: false };

    const candles = chartData.candles;
    const closes = candles.map(c => c.close);

    // Build chart data with date labels
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
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
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
          <span className="text-xs cursor-pointer" style={{ color: CYAN }}>Full chart →</span>
        </Link>
      </div>

      {loading ? (
        <div className="h-48 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
      ) : chartDataWithIndicators.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs" style={{ color: DIM }}>
          No chart data — API token required
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
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
          {/* Legend */}
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {[
              { color: CYAN, label: 'SPY Price' },
              { color: 'oklch(0.60 0.18 250)', label: '50 SMA' },
              { color: 'oklch(0.65 0.22 25)', label: '200 SMA' },
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

// ─── Portfolio Greeks Bar ─────────────────────────────────────────────────────

function PortfolioGreeksWidget() {
  const { data: posData, loading } = usePositions();

  const { greeks, netLiq } = useMemo(() => {
    if (!posData?.positions) return { greeks: null, netLiq: null };
    const opts = posData.positions.filter(p => p.sec_type === 'OPT');
    if (!opts.length) return { greeks: null, netLiq: posData.totals?.net_liq ?? null };

    let delta = 0, gamma = 0, theta = 0, vega = 0;
    for (const p of opts) {
      const mult = parseFloat(p.multiplier) || 100;
      const qty = p.qty;
      if (p.current_delta != null) delta += p.current_delta * qty * mult;
      if (p.current_gamma != null) gamma += p.current_gamma * qty * mult;
      if (p.current_theta != null) theta += p.current_theta * qty * mult;
      if (p.current_vega != null) vega += p.current_vega * qty * mult;
    }
    return {
      greeks: { delta, gamma, theta, vega, count: opts.length },
      netLiq: posData.totals?.net_liq ?? null,
    };
  }, [posData]);

  const greekChartData = greeks ? [
    { name: 'Δ Delta', value: greeks.delta, color: greeks.delta >= 0 ? GREEN : RED },
    { name: 'Γ Gamma', value: greeks.gamma * 100, color: AMBER },
    { name: 'Θ Theta', value: greeks.theta, color: greeks.theta >= 0 ? GREEN : RED },
    { name: 'V Vega', value: greeks.vega, color: 'oklch(0.65 0.22 280)' },
  ] : [];

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sigma className="w-4 h-4" style={{ color: AMBER }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>Portfolio Greeks</span>
        </div>
        <Link href="/positions">
          <span className="text-xs cursor-pointer" style={{ color: CYAN }}>Positions →</span>
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
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Net Delta', value: greeks.delta.toFixed(1), color: greeks.delta >= 0 ? GREEN : RED },
              { label: 'Net Theta', value: `$${greeks.theta.toFixed(0)}/d`, color: greeks.theta >= 0 ? GREEN : RED },
              { label: 'Net Vega', value: greeks.vega.toFixed(1), color: 'oklch(0.65 0.22 280)' },
              { label: 'Legs', value: String(greeks.count), color: CYAN },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded p-2 text-center" style={{ background: 'oklch(0.22 0.010 258)' }}>
                <div className="font-mono-data text-sm font-bold" style={{ color }}>{value}</div>
                <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Greeks bar chart */}
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={greekChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: DIM, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: DIM, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'oklch(0.22 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)', borderRadius: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono', color: BRIGHT }}
                formatter={(v: number) => [v.toFixed(2)]}
              />
              <BarReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {greekChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {netLiq != null && (
            <div className="text-[10px] font-mono-data mt-1.5" style={{ color: DIM }}>
              Net Liq: <span style={{ color: CYAN }}>{formatDollar(netLiq)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── IV Rank Heatmap ──────────────────────────────────────────────────────────

function IvRankHeatmap() {
  const { data, loading } = useCandidates();

  const ivrColor = (ivr: number) => {
    if (ivr >= 70) return { bg: 'oklch(0.65 0.22 25 / 20%)', border: 'oklch(0.65 0.22 25 / 40%)', text: 'oklch(0.75 0.22 25)' };
    if (ivr >= 50) return { bg: 'oklch(0.78 0.18 85 / 20%)', border: 'oklch(0.78 0.18 85 / 40%)', text: 'oklch(0.85 0.18 85)' };
    if (ivr >= 30) return { bg: 'oklch(0.72 0.18 145 / 15%)', border: 'oklch(0.72 0.18 145 / 30%)', text: 'oklch(0.80 0.18 145)' };
    return { bg: 'oklch(1 0 0 / 5%)', border: 'oklch(1 0 0 / 10%)', text: DIM };
  };

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4" style={{ color: GREEN }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>IV Rank Heatmap</span>
        </div>
        <Link href="/candidates">
          <span className="text-xs cursor-pointer" style={{ color: CYAN }}>Screener →</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-16 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
          ))}
        </div>
      ) : !data?.rows?.length ? (
        <div className="text-xs py-4 text-center" style={{ color: DIM }}>No candidates data</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {data.rows
              .filter(r => !r.excluded)
              .sort((a, b) => b.ivr - a.ivr)
              .map(row => {
                const c = ivrColor(row.ivr);
                return (
                  <div
                    key={row.ticker}
                    className="rounded border p-2 cursor-pointer transition-all hover:opacity-80"
                    style={{ background: c.bg, borderColor: c.border }}
                    title={`${row.ticker} — IVR ${row.ivr.toFixed(0)}, IV ${row.current_iv.toFixed(0)}%, ${row.signal}`}
                  >
                    <div className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{row.ticker}</div>
                    <div className="font-mono-data text-sm font-bold mt-0.5" style={{ color: c.text }}>
                      {row.ivr.toFixed(0)}
                    </div>
                    <div className="text-[9px] font-mono-data mt-0.5" style={{ color: DIM }}>
                      IVR
                    </div>
                    {row.can_trade && (
                      <div className="text-[8px] font-mono-data mt-0.5 px-1 rounded"
                        style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                        ✓ ENTRY
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[
              { label: '≥70 HIGH', color: 'oklch(0.75 0.22 25)' },
              { label: '50-69 ELEVATED', color: 'oklch(0.85 0.18 85)' },
              { label: '30-49 NORMAL', color: 'oklch(0.80 0.18 145)' },
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
  const [, navigate] = useLocation();

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
      {report.stop_loss_alerts?.filter(a => a.verdict !== 'OK').slice(0, 2).map((a, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded border"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 30%)' }}>
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: RED }} />
          <div className="flex-1 min-w-0">
            <div className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>
              STOP-LOSS · {a.ticker} {a.strategy}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.70 0.010 258)' }}>{a.recommended_action}</div>
          </div>
        </div>
      ))}

      {/* Entry candidates */}
      {report.entry_candidates?.slice(0, 4).map((c, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded border"
          style={{ background: 'oklch(0.72 0.18 145 / 6%)', borderColor: 'oklch(0.72 0.18 145 / 25%)' }}>
          <Target className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{c.ticker}</span>
              {c.iv_rank != null && (
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                  IVR {c.iv_rank.toFixed(0)}
                </span>
              )}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: DIM }}>
              {c.action} · {c.days_to_earnings}d to earnings
            </div>
          </div>
        </div>
      ))}

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

// ─── Account Strip ────────────────────────────────────────────────────────────

function AccountStrip() {
  const { data: preview, loading } = useIbkrPreview();
  const { data: briefing } = useBriefing();

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

  const metrics = [
    { label: 'Net Liq', value: netLiq != null ? formatDollar(netLiq) : '—', color: CYAN },
    { label: 'Excess Liq', value: excessLiq != null ? formatDollar(excessLiq) : '—', color: 'oklch(0.70 0.010 258)' },
    { label: 'Daily P&L', value: dailyPnl != null ? formatDollar(dailyPnl) : '—', color: dailyPnl == null ? DIM : dailyPnl >= 0 ? GREEN : RED },
    { label: 'Regime / VIX', value: regime ? `${regime.toUpperCase()} / ${vix?.toFixed(1) ?? '—'}` : '—', color: regime === 'bullish' ? GREEN : regime === 'bearish' ? RED : AMBER },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map(({ label, value, color }) => (
        <div key={label} className="rounded border p-3" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{label}</div>
          <div className="font-mono-data text-sm font-bold" style={{ color }}>{value}</div>
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
      />

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
            <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Morning Trade Report</h2>
                  <p className="text-xs mt-0.5" style={{ color: DIM }}>Prioritised action list</p>
                </div>
                <Link href="/candidates">
                  <span className="text-xs cursor-pointer" style={{ color: CYAN }}>All candidates →</span>
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
                  )} style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
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
