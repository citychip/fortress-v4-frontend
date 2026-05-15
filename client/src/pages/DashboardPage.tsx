/**
 * FORTRESS V2 — Dashboard Page
 * Layer 1 entry point: Trade Report (morning action list) + IBKR Live Preview +
 * Account health + Macro Regime Gate + SPY Hedge Coverage + Priority orders + Position alerts.
 */

import { useState } from 'react';
import {
  useBriefing, useStopLossAll, useRollAll, useAlerts,
  useTradeReport, useIbkrPreview, useSpyHedgeCoverage, useIbkrSync, useIbkrSyncHistory,
  formatDollar, regimeInfo,
  type BriefingData, type TradeReport, type TradeReportRollCandidate, type TradeReportPostEarningsCandidate,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  ArrowRight, AlertTriangle, TrendingUp, BookOpen, Crosshair,
  DollarSign, Shield, Zap, TrendingDown, CheckCircle, XCircle, Target,
  Mail, X, RefreshCw, Database,
} from 'lucide-react';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

// ─── Regime badge ─────────────────────────────────────────────────────────────

function RegimePill({ regime }: { regime: string }) {
  const { label, color } = regimeInfo(regime);
  const colorMap = {
    red:   { bg: `${RED} / 15%`,   border: `${RED} / 40%`,   text: 'oklch(0.75 0.22 25)' },
    amber: { bg: `${AMBER} / 15%`, border: `${AMBER} / 40%`, text: 'oklch(0.85 0.18 85)' },
    green: { bg: `${GREEN} / 15%`, border: `${GREEN} / 40%`, text: 'oklch(0.80 0.18 145)' },
    cyan:  { bg: `${CYAN} / 15%`,  border: `${CYAN} / 40%`,  text: 'oklch(0.85 0.15 200)' },
  };
  const c = colorMap[color];
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono-data"
      style={{ background: `oklch(${c.bg})`, border: `1px solid oklch(${c.border})`, color: c.text }}>
      {label}
    </span>
  );
}

// ─── Trade Report Panel ───────────────────────────────────────────────────────

function TradeReportPanel() {
  const { data, loading, error } = useTradeReport();

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
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Entry Candidates', count: summary?.entry_candidates_count ?? report.entry_candidates?.length ?? 0, color: GREEN },
          { label: 'Stop-Loss Alerts', count: summary?.stop_loss_alerts_count ?? report.stop_loss_alerts?.length ?? 0, color: RED },
          { label: 'Exit Candidates', count: summary?.exit_candidates_count ?? report.exit_candidates?.length ?? 0, color: AMBER },
          { label: 'Roll Candidates', count: summary?.roll_candidates_count ?? report.roll_candidates?.length ?? 0, color: CYAN },
          { label: 'Post-Earnings', count: summary?.post_earnings_count ?? report.post_earnings_candidates?.length ?? 0, color: GREEN },
          { label: 'Urgent Actions', count: summary?.urgent_actions ?? 0, color: summary?.urgent_actions ? RED : DIM },
        ].map(s => (
          <div key={s.label} className="rounded border p-2 text-center" style={{ background: 'oklch(0.22 0.010 258)', borderColor: `${s.color}25` }}>
            <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stop-loss alerts */}
      {report.stop_loss_alerts?.filter(a => a.verdict !== 'OK').map((a, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded border"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 30%)' }}>
          <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: RED }} />
          <div className="flex-1 min-w-0">
            <div className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>
              STOP-LOSS · {a.ticker} {a.strategy}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.70 0.010 258)' }}>{a.recommended_action}</div>
            {a.signals?.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {a.signals.slice(0, 3).map((s, si) => (
                  <span key={si} className="text-[9px] px-1.5 py-0.5 rounded font-mono-data" style={{ color: RED, background: 'oklch(0.65 0.22 25 / 12%)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Entry candidates */}
      {report.entry_candidates?.slice(0, 5).map((c, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded border"
          style={{ background: 'oklch(0.72 0.18 145 / 6%)', borderColor: 'oklch(0.72 0.18 145 / 25%)' }}>
          <Target className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{c.ticker}</span>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                IVR {c.iv_rank.toFixed(0)}
              </span>
              <span className="text-[10px] font-mono-data" style={{ color: DIM }}>
                {c.concentration_pct.toFixed(1)}% conc
              </span>
              {c.has_existing_position && (
                <span className="text-[9px] font-mono-data px-1 py-0.5 rounded" style={{ color: CYAN, background: 'oklch(0.80 0.15 200 / 10%)' }}>HAS POS</span>
              )}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: DIM }}>
              {c.action} · {c.earnings_state} · {c.days_to_earnings}d to earnings
            </div>
          </div>
        </div>
      ))}

      {/* Roll candidates */}
      {report.roll_candidates?.slice(0, 3).map((rc: TradeReportRollCandidate, i) => {
        const maxDte = 45;
        const dte = rc.current_dte ?? null;
        const dtePct = dte != null ? Math.max(0, Math.min(1, dte / maxDte)) : null;
        const R = 14;
        const circumference = 2 * Math.PI * R;
        const dashOffset = dtePct != null ? circumference * (1 - dtePct) : circumference;
        const ringColor = dte == null ? DIM : dte <= 7 ? RED : dte <= 21 ? AMBER : CYAN;
        const urgencyColor = rc.urgency === 'URGENT' ? RED : rc.urgency === 'THIS_WEEK' ? AMBER : DIM;
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded border"
            style={{ background: 'oklch(0.80 0.15 200 / 5%)', borderColor: 'oklch(0.80 0.15 200 / 20%)' }}>
            {/* DTE countdown ring */}
            <div className="flex-shrink-0 relative" style={{ width: 36, height: 36 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r={R} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="3" />
                {dtePct != null && (
                  <circle cx="18" cy="18" r={R} fill="none" stroke={ringColor} strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-data font-bold" style={{ fontSize: 9, color: ringColor, lineHeight: 1 }}>
                  {dte != null ? dte : '—'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{rc.ticker}</span>
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                  style={{ color: urgencyColor, background: `${urgencyColor}18` }}>
                  {rc.urgency}
                </span>
                {rc.short_strike != null && (
                  <span className="text-[10px] font-mono-data" style={{ color: DIM }}>@{rc.short_strike}</span>
                )}
                {dte != null && dte <= 7 && (
                  <span className="text-[9px] font-mono-data px-1 py-0.5 rounded animate-pulse"
                    style={{ color: RED, background: 'oklch(0.65 0.22 25 / 15%)' }}>EXPIRING</span>
                )}
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: DIM }}>
                {rc.strategy} · {rc.expiry ?? '—'}
                {rc.reasons?.length > 0 && ` · ${rc.reasons[0]}`}
              </div>
            </div>
          </div>
        );
      })}

      {/* Exit candidates */}
      {report.exit_candidates?.slice(0, 3).map((e, i) => {
        // DTE countdown ring: treat 45 days as 100% full; ring empties as expiry approaches
        const maxDte = 45;
        const dte = e.dte ?? null;
        const dtePct = dte != null ? Math.max(0, Math.min(1, dte / maxDte)) : null;
        const R = 14; // ring radius
        const circumference = 2 * Math.PI * R;
        const dashOffset = dtePct != null ? circumference * (1 - dtePct) : circumference;
        const ringColor = dte == null ? DIM : dte <= 7 ? RED : dte <= 21 ? AMBER : GREEN;
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded border"
            style={{ background: 'oklch(0.78 0.18 85 / 6%)', borderColor: 'oklch(0.78 0.18 85 / 25%)' }}>
            {/* DTE countdown ring */}
            <div className="flex-shrink-0 relative" style={{ width: 36, height: 36 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle cx="18" cy="18" r={R} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="3" />
                {/* Progress */}
                {dtePct != null && (
                  <circle cx="18" cy="18" r={R} fill="none" stroke={ringColor} strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                )}
              </svg>
              {/* DTE label in centre */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono-data font-bold" style={{ fontSize: 9, color: ringColor, lineHeight: 1 }}>
                  {dte != null ? dte : '—'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{e.ticker}</span>
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: AMBER, background: 'oklch(0.78 0.18 85 / 12%)' }}>
                  {e.net_liq_pct.toFixed(1)}% net liq
                </span>
                {dte != null && dte <= 7 && (
                  <span className="text-[9px] font-mono-data px-1 py-0.5 rounded animate-pulse" style={{ color: RED, background: 'oklch(0.65 0.22 25 / 15%)' }}>EXPIRING</span>
                )}
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: DIM }}>{e.action} · {e.note}</div>
            </div>
          </div>
        );
      })}

      {/* Post-earnings candidates */}
      {report.post_earnings_candidates?.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px" style={{ background: 'oklch(1 0 0 / 8%)' }} />
            <span className="text-[9px] uppercase tracking-widest font-semibold font-mono-data px-2" style={{ color: 'oklch(0.72 0.18 145)' }}>Post-Earnings Playbook</span>
            <div className="flex-1 h-px" style={{ background: 'oklch(1 0 0 / 8%)' }} />
          </div>
          {report.post_earnings_candidates.map((pe: TradeReportPostEarningsCandidate, i) => {
            const freshness = pe.days_since_earnings === 0 ? 'TODAY'
              : pe.days_since_earnings === 1 ? '1D AGO'
              : `${pe.days_since_earnings}D AGO`;
            const freshnessColor = pe.days_since_earnings === 0 ? GREEN
              : pe.days_since_earnings === 1 ? AMBER
              : DIM;
            const ivLabel = pe.iv_rank_post != null ? `IVR ${pe.iv_rank_post.toFixed(0)}` : null;
            // IV rank post-earnings: high IVR = IV hasn't crushed yet (unusual), low = normal crush
            const ivColor = pe.iv_rank_post == null ? DIM
              : pe.iv_rank_post >= 50 ? AMBER   // still elevated — potential entry
              : pe.iv_rank_post >= 25 ? GREEN    // moderate — normal
              : DIM;                             // crushed — watch only
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded border"
                style={{ background: 'oklch(0.72 0.18 145 / 5%)', borderColor: 'oklch(0.72 0.18 145 / 20%)' }}>
                {/* Days-since badge */}
                <div className="flex-shrink-0 flex items-center justify-center rounded"
                  style={{ width: 36, height: 36, background: `${freshnessColor}18`, border: `1px solid ${freshnessColor}40` }}>
                  <span className="font-mono-data font-bold text-center leading-tight"
                    style={{ fontSize: 8, color: freshnessColor, whiteSpace: 'nowrap' }}>
                    {freshness}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>{pe.ticker}</span>
                    {ivLabel && (
                      <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                        style={{ color: ivColor, background: `${ivColor}18` }}>
                        {ivLabel}
                      </span>
                    )}
                    {pe.current_price != null && (
                      <span className="text-[10px] font-mono-data" style={{ color: DIM }}>
                        ${pe.current_price.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[9px] font-mono-data px-1.5 py-0.5 rounded"
                      style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
                      PLAYBOOK
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5 truncate" style={{ color: DIM }}>{pe.note}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {report.macro && (
        <div className="flex items-center gap-4 text-[10px] font-mono-data pt-1" style={{ color: DIM }}>
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

// ─── IBKR Live Preview ────────────────────────────────────────────────────────

function IbkrLivePreview() {
  const { data, loading, error } = useIbkrPreview();

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label="Net Liq (Live)" value={formatDollar(data.net_liq)} signal="cyan" />
      <StatCard label="Excess Liquidity" value={formatDollar(data.excess_liquidity)} signal="default" />
      <StatCard label="Available Funds" value={formatDollar(data.available_funds)} signal="default" />
      <StatCard
        label="Daily P&L"
        value={data.daily_pnl != null ? formatDollar(data.daily_pnl) : '—'}
        signal={data.daily_pnl != null ? (data.daily_pnl >= 0 ? 'green' : 'red') : 'default'}
      />
    </div>
  );
}

// ─── IBKR Sync History ─────────────────────────────────────────────────

function IbkrSyncHistoryPanel() {
  const { records, loading, refresh } = useIbkrSyncHistory();
  const { triggerSync, syncing, lastSync } = useIbkrSync();

  const handleSync = async () => {
    await triggerSync();
    refresh();
  };

  const statusColor = (s: string) =>
    s === 'ok' ? GREEN : s === 'partial' ? AMBER : RED;

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: CYAN }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>IBKR Sync</span>
          {lastSync && (
            <span className="text-[10px] font-mono-data" style={{ color: DIM }}>
              Last: {lastSync.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-mono-data hover:opacity-80 disabled:opacity-40 transition-opacity"
          style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map(i => <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-xs py-2" style={{ color: DIM }}>No sync data available. Click Sync Now to fetch live positions.</div>
      ) : (
        <div className="overflow-hidden rounded border" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'oklch(1 0 0 / 4%)' }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: DIM }}>Timestamp</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: DIM }}>Backend</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: DIM }}>Positions</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: DIM }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid oklch(1 0 0 / 6%)' }}>
                  <td className="px-3 py-2 font-mono-data" style={{ color: 'oklch(0.70 0.010 258)' }}>
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono-data" style={{ color: CYAN }}>
                    {r.backend === 'web_api' ? 'Web API' : r.backend === 'bs_yfinance' ? 'yFinance' : r.backend}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-data font-semibold" style={{ color: BRIGHT }}>
                    {r.positions_count}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: `${statusColor(r.status)}15`, color: statusColor(r.status) }}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SPY Hedge Coverage ───────────────────────────────────────────────────────

function SpyHedgeWidget() {
  const { data, loading } = useSpyHedgeCoverage();

  if (loading || !data) return null;

  const pct = data.hedge_pct_of_netliq;
  const ok = data.coverage_ok;
  const color = ok ? GREEN : RED;
  const barPct = Math.min(100, (pct / (data.target_max * 1.5)) * 100);

  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: `${color}30` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color }} />
          <span className="font-display text-sm" style={{ color: BRIGHT }}>SPY Hedge Coverage</span>
        </div>
        <span className="text-xs font-mono-data px-2 py-0.5 rounded" style={{ color, background: `${color}15` }}>
          {ok ? 'COVERED' : 'UNDER-HEDGED'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono-data mt-1" style={{ color: DIM }}>
            <span>0%</span>
            <span style={{ color }}>{pct.toFixed(1)}% of Net Liq</span>
            <span>Target: {data.target_min}–{data.target_max}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-data text-sm font-bold" style={{ color }}>{formatDollar(data.hedge_market_value)}</div>
          <div className="text-[10px]" style={{ color: DIM }}>{data.legs_count} legs</div>
        </div>
      </div>
    </div>
  );
}

// ─── Account Summary ──────────────────────────────────────────────────────────

function AccountSummarySection() {
  const { data, loading, error } = useBriefing();
  const { config } = useConfig();

  if (!config.apiToken) {
    return (
      <EmptyState
        type="no-config"
        title="API token required"
        description="Add your bearer token in Settings → API Connection to connect to the Fortress server."
      />
    );
  }

  const account = data?.account;
  const macro = data?.macro_regime;

  return (
    <div className="space-y-4">
      {/* IBKR live preview (most current) */}
      <IbkrLivePreview />

      {/* Fallback briefing account metrics if preview unavailable */}
      {!account && loading && (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
        </div>
      )}

      {/* Macro Regime Gate */}
      <div className="rounded p-4" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Layer 1 — Macro Regime Gate</h2>
            <p className="text-xs mt-0.5" style={{ color: DIM }}>SPY GEX / Dark Pool / Net Drift synthesis</p>
          </div>
          {macro && <RegimePill regime={macro.regime} />}
          {loading && <div className="h-7 w-40 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />}
        </div>

        {macro && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: 'VIX', value: macro.vix !== null ? macro.vix.toFixed(2) : '—' },
              { label: 'VIX State', value: macro.vix_state ?? '—' },
              { label: 'Regime', value: macro.regime },
            ].map(({ label, value }) => (
              <div key={label} className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{label}</div>
                <div className="font-mono-data text-sm capitalize" style={{ color: CYAN }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs mt-2" style={{ color: RED }}>Error: {error}</p>}
      </div>

      {/* SPY Hedge Coverage */}
      <SpyHedgeWidget />

      {/* Concentration warning */}
      {data?.concentration?.msft_warning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border text-xs"
          style={{ background: 'oklch(0.78 0.18 85 / 10%)', borderColor: 'oklch(0.78 0.18 85 / 30%)', color: 'oklch(0.85 0.18 85)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          MSFT concentration warning — {data.concentration.top.find(t => t.ticker === 'MSFT')?.pct.toFixed(1)}% of Net Liq
        </div>
      )}
    </div>
  );
}

// ─── Top Priority Orders (from stop_loss + roll) ──────────────────────────────

function TopOrders() {
  const { data: stopData, loading: stopLoading } = useStopLossAll();
  const { data: rollData, loading: rollLoading } = useRollAll();
  const { data: alertData } = useAlerts();
  const loading = stopLoading || rollLoading;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-14 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
      </div>
    );
  }

  const urgentItems: { ticker: string; label: string; reason: string; urgency: 'URGENT' | 'SOON' | 'WATCH' }[] = [];

  stopData?.positions.filter(p => p.verdict === 'ACT').forEach(p => urgentItems.push({
    ticker: p.ticker, label: `STOP-LOSS ${p.ticker} ${p.strategy}`, reason: p.recommended_action, urgency: 'URGENT',
  }));
  rollData?.positions.filter(p => p.roll_needed && p.urgency === 'URGENT').forEach(p => urgentItems.push({
    ticker: p.ticker, label: `ROLL ${p.ticker} ${p.strategy} ${p.short_strike}`,
    reason: p.reasons.join('; ') || `${p.current_dte}d to expiry`, urgency: 'URGENT',
  }));
  rollData?.positions.filter(p => p.roll_needed && p.urgency === 'SOON').forEach(p => urgentItems.push({
    ticker: p.ticker, label: `ROLL ${p.ticker} ${p.strategy} ${p.short_strike}`,
    reason: p.reasons.join('; ') || `${p.current_dte}d to expiry`, urgency: 'SOON',
  }));
  alertData?.alerts.filter(a => !a.snoozed).slice(0, 2).forEach(a => urgentItems.push({
    ticker: a.ticker, label: a.ticker, reason: a.message, urgency: 'WATCH',
  }));

  const displayed = urgentItems.slice(0, 5);
  const urgencyColor = { URGENT: RED, SOON: AMBER, WATCH: CYAN };

  if (!displayed.length) {
    return (
      <div className="py-8 text-center" style={{ color: DIM }}>
        <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: GREEN }} />
        <div className="text-sm">No priority orders</div>
        <div className="text-xs mt-1">All positions within thresholds</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded border"
          style={{ background: 'oklch(0.17 0.010 258)', borderColor: `${urgencyColor[item.urgency]}30` }}>
          <span className="text-[10px] font-bold font-mono-data px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
            style={{ background: `${urgencyColor[item.urgency]}20`, color: urgencyColor[item.urgency] }}>
            {item.urgency}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-mono-data text-sm font-semibold truncate" style={{ color: BRIGHT }}>{item.label}</div>
            <p className="text-xs mt-0.5 truncate" style={{ color: DIM }}>{item.reason}</p>
          </div>
        </div>
      ))}
      {urgentItems.length > 5 && (
        <Link href="/orders">
          <div className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border transition-all hover:bg-[oklch(0.80_0.15_200_/_8%)] cursor-pointer"
            style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 20%)' }}>
            View all {urgentItems.length} orders <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Position Alerts Summary ──────────────────────────────────────────────────

function PositionAlertsSummary() {
  const { data: alertData, loading } = useAlerts();
  const { data: stopData } = useStopLossAll();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />)}
      </div>
    );
  }

  const alerts = alertData?.alerts.filter(a => !a.snoozed) ?? [];
  const stopLossAct = stopData?.positions.filter(p => p.verdict === 'ACT') ?? [];

  if (!alerts.length && !stopLossAct.length) {
    return (
      <div className="py-6 text-center" style={{ color: DIM }}>
        <div className="text-sm">No position alerts</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {stopLossAct.slice(0, 2).map((p, i) => (
        <div key={`sl-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded border"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: RED }} />
          <span className="font-mono-data text-xs font-semibold" style={{ color: BRIGHT }}>{p.ticker} {p.strategy}</span>
          <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.010 258)' }}>{p.recommended_action}</span>
        </div>
      ))}
      {alerts.slice(0, 4 - Math.min(stopLossAct.length, 2)).map((a, i) => (
        <div key={`al-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded border"
          style={{
            background: a.severity === 'critical' ? 'oklch(0.65 0.22 25 / 8%)' : 'oklch(0.78 0.18 85 / 8%)',
            borderColor: a.severity === 'critical' ? 'oklch(0.65 0.22 25 / 25%)' : 'oklch(0.78 0.18 85 / 25%)',
          }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: a.severity === 'critical' ? RED : AMBER }} />
          <span className="font-mono-data text-xs font-semibold" style={{ color: BRIGHT }}>{a.ticker}</span>
          <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.010 258)' }}>{a.message}</span>
        </div>
      ))}
      {(alerts.length + stopLossAct.length) > 4 && (
        <Link href="/positions">
          <div className="text-xs text-center py-1 cursor-pointer" style={{ color: CYAN }}>
            +{alerts.length + stopLossAct.length - 4} more alerts → Positions
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Quick Nav Cards ──────────────────────────────────────────────────────────

function QuickNav() {
  const links = [
    { href: '/positions',    label: 'View Positions', sub: 'Per-leg evaluation',          icon: BookOpen,      color: CYAN },
    { href: '/market-intel', label: 'Market Intel',   sub: 'GEX / DP / Drift',            icon: TrendingUp,    color: GREEN },
    { href: '/candidates',   label: 'Candidates',     sub: 'IV rank screener',             icon: Crosshair,     color: AMBER },
    { href: '/orders',       label: 'All Orders',     sub: 'URGENT / THIS WEEK / WATCH',  icon: AlertTriangle, color: RED },
    { href: '/earnings',     label: 'Earnings',       sub: 'Calendar & blackout windows', icon: DollarSign,    color: CYAN },
    { href: '/journal',      label: 'Journal',        sub: 'Realised P&L log',            icon: BookOpen,      color: GREEN },
    { href: '/scripts',      label: 'Scripts',        sub: 'Workflow automation',         icon: Zap,           color: AMBER },
    { href: '/settings',     label: 'Settings',       sub: 'Config & universe',           icon: Shield,        color: DIM },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {links.map(({ href, label, sub, icon: Icon, color }) => (
        <Link key={href} href={href}>
          <div className="flex items-center gap-3 p-3 rounded border transition-all hover:bg-[oklch(1_0_0_/_4%)] cursor-pointer"
            style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
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
  );
}

// ─── Send Briefing Modal ─────────────────────────────────────────────────────

function SendBriefingModal({
  tradeReport,
  onClose,
}: {
  tradeReport: TradeReport | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const sendMutation = trpc.fortress.sendMorningBriefing.useMutation();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  function buildBody(): string {
    if (!tradeReport) return 'No trade report data available.';
    const r = tradeReport;
    const lines: string[] = [
      `FORTRESS MORNING BRIEFING — ${today}`,
      '='.repeat(60),
      '',
    ];

    if (r.macro) {
      lines.push(`MACRO REGIME: ${r.macro.regime?.toUpperCase() ?? 'UNKNOWN'}`);
      lines.push(`VIX: ${r.macro.vix?.toFixed(2) ?? '—'}  |  State: ${r.macro.vix_state ?? '—'}`);
      lines.push('');
    }

    if (r.stop_loss_alerts?.length) {
      lines.push('STOP-LOSS ALERTS:');
      r.stop_loss_alerts.filter(a => a.verdict !== 'OK').forEach(a => {
        lines.push(`  ⚠ ${a.ticker} ${a.strategy} — ${a.recommended_action}`);
      });
      lines.push('');
    }

    if (r.entry_candidates?.length) {
      lines.push('TOP ENTRY CANDIDATES (by IV Rank):');
      r.entry_candidates.slice(0, 5).forEach((c, i) => {
        lines.push(`  ${i + 1}. ${c.ticker}  IVR ${c.iv_rank.toFixed(0)}  ${c.concentration_pct.toFixed(1)}% conc  ${c.action}`);
      });
      lines.push('');
    }

    if (r.exit_candidates?.length) {
      lines.push('EXIT CANDIDATES (near profit target):');
      r.exit_candidates.slice(0, 3).forEach(e => {
        lines.push(`  • ${e.ticker}  ${e.net_liq_pct.toFixed(1)}% net liq  ${e.action}`);
      });
      lines.push('');
    }

    if (r.roll_candidates?.length) {
      lines.push('ROLL CANDIDATES:');
      r.roll_candidates.slice(0, 3).forEach((rc: unknown) => {
        const r2 = rc as Record<string, unknown>;
        lines.push(`  • ${r2['ticker'] ?? ''}  ${r2['strategy'] ?? ''}  ${r2['note'] ?? ''}`);
      });
      lines.push('');
    }

    lines.push('─'.repeat(60));
    lines.push('Sent via Fortress Trading Dashboard v2');
    return lines.join('\n');
  }

  async function handleSend() {
    if (!email.trim()) { toast.error('Please enter an email address'); return; }
    try {
      await sendMutation.mutateAsync({ to: email.trim(), body: buildBody() });
      toast.success('Morning briefing sent!', { description: `Delivered to ${email}` });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to send briefing', { description: msg });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'oklch(0 0 0 / 70%)' }}>
      <div className="rounded-xl border p-6 w-full max-w-lg space-y-4" style={{ background: 'oklch(0.15 0.010 258)', borderColor: 'oklch(1 0 0 / 15%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-sm" style={{ color: BRIGHT }}>Send Morning Briefing</h2>
            <p className="text-xs mt-0.5" style={{ color: DIM }}>Emails today's trade report summary via Gmail</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" style={{ color: DIM }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded border p-3 font-mono-data text-[10px] max-h-48 overflow-y-auto whitespace-pre-wrap"
          style={{ background: 'oklch(0.12 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)', color: DIM }}>
          {buildBody()}
        </div>

        <div className="space-y-2">
          <label className="text-xs" style={{ color: DIM }}>Recipient email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full font-mono-data text-xs px-3 py-2 rounded border"
            style={{ background: 'oklch(0.13 0.010 258)', borderColor: 'oklch(1 0 0 / 20%)', color: BRIGHT }}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-xs hover:opacity-80"
            style={{ color: DIM, borderColor: 'oklch(1 0 0 / 15%)' }}>
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 disabled:opacity-40"
            style={{ background: CYAN, color: 'oklch(0.10 0 0)' }}
          >
            <Mail className="w-3.5 h-3.5" />
            {sendMutation.isPending ? 'Sending…' : 'Send Briefing'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, loading, refresh } = useBriefing();
  const { data: tradeReportData } = useTradeReport();
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Dashboard"
        subtitle="Morning workflow — Trade Report → Regime Gate → Position Review → Order List"
        lastUpdated={null}
        onRefresh={refresh}
        refreshing={loading}
      />
      <div className="p-6 space-y-6">
        <AccountSummarySection />
        <IbkrSyncHistoryPanel />
        <QuickNav />

        {/* Trade Report — the morning action list */}
        <div className="rounded p-4" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Morning Trade Report</h2>
              <p className="text-xs mt-0.5" style={{ color: DIM }}>Prioritised action list from /api/manage/trade_report</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBriefingModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-mono-data hover:opacity-80 transition-opacity"
                style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
              >
                <Mail className="w-3 h-3" /> Send Briefing
              </button>
              <Link href="/candidates">
                <span className="text-xs cursor-pointer" style={{ color: CYAN }}>All candidates →</span>
              </Link>
            </div>
          </div>
          <TradeReportPanel />
        </div>

        {/* Two-column: orders + alerts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded p-4" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Layer 4 — Priority Orders</h2>
              <Link href="/orders">
                <span className="text-xs cursor-pointer" style={{ color: CYAN }}>All orders →</span>
              </Link>
            </div>
            <TopOrders />
          </div>
          <div className="rounded p-4" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm" style={{ color: BRIGHT }}>Layer 3 — Position Alerts</h2>
              <Link href="/positions">
                <span className="text-xs cursor-pointer" style={{ color: CYAN }}>All positions →</span>
              </Link>
            </div>
            <PositionAlertsSummary />
          </div>
        </div>

        {data?.as_of && (
          <p className="text-[11px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
            Data as of: {new Date(data.as_of).toLocaleString()}
          </p>
        )}
      </div>

      {showBriefingModal && (
        <SendBriefingModal
          tradeReport={tradeReportData as TradeReport | null}
          onClose={() => setShowBriefingModal(false)}
        />
      )}
    </div>
  );
}
