/**
 * FORTRESS V3 — Cockpit 1: Action Center
 * Left: Portfolio health + urgent actions from briefing (with Analyse → link to Build Center)
 * Right: Orders queue (URGENT / THIS WEEK / WATCH) + stop-loss + roll candidates
 */

import { useLocation } from 'wouter';
import { useBriefing, useAlerts, useStopLossAll, useRollAll, useMarketIntelligence } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, XCircle, ArrowRight, RefreshCw,
  TrendingDown, RotateCcw, Shield, Zap, Clock, DollarSign,
  Activity, BarChart2,
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

// ─── Portfolio Health Strip ───────────────────────────────────────────────────
function HealthStrip() {
  const { data: briefing } = useBriefing();
  const { config } = useConfig();
  const { data: spyIntel } = useMarketIntelligence(config.apiToken ? 'SPY' : null);

  const account = briefing?.account;
  const nlv = account?.net_liquidation_value ?? null;
  const netDelta = briefing?.greeks?.net_delta ?? null;
  const hedgePct = briefing?.hedge?.spy_hedge_pct ?? null;
  const regime = briefing?.macro_regime?.regime ?? null;
  const regimeColor = regime === 'bullish' ? GREEN : regime === 'bearish' ? RED : AMBER;
  const gexCallWall = spyIntel?.regime?.gex_call_wall ?? spyIntel?.gex?.call_wall ?? null;
  const gexPutWall  = spyIntel?.regime?.gex_put_wall  ?? spyIntel?.gex?.put_wall  ?? null;

  const metrics = [
    { label: 'NLV', value: nlv != null ? `$${(nlv / 1000).toFixed(1)}k` : '—', color: BRIGHT },
    { label: 'Net Δ', value: netDelta != null ? `${netDelta > 0 ? '+' : ''}${netDelta.toFixed(2)}` : '—', color: Math.abs(netDelta ?? 0) > 0.5 ? AMBER : GREEN },
    { label: 'Hedge', value: hedgePct != null ? `${hedgePct.toFixed(0)}%` : '—', color: (hedgePct ?? 0) < 50 ? AMBER : GREEN },
    { label: 'Regime', value: regime ? regime.toUpperCase() : '—', color: regimeColor },
    { label: 'SPY Call Wall', value: gexCallWall != null ? `$${gexCallWall.toFixed(0)}` : '—', color: GREEN },
    { label: 'SPY Put Wall', value: gexPutWall  != null ? `$${gexPutWall.toFixed(0)}`  : '—', color: RED },
  ];

  return (
    <div className="grid grid-cols-6 gap-2 mb-4">
      {metrics.map(m => (
        <div key={m.label} className="rounded p-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{m.label}</div>
          <div className="font-mono-data text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Action Row ───────────────────────────────────────────────────────────────
function ActionRow({ action, onAnalyse }: { action: any; onAnalyse: (ticker: string) => void }) {
  const urgencyColor = action.urgency === 'URGENT' ? RED : action.urgency === 'THIS_WEEK' ? AMBER : CYAN;
  const Icon = action.type === 'stop_loss' ? XCircle
             : action.type === 'roll' ? RotateCcw
             : action.type === 'entry' ? Zap
             : Activity;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded border transition-all hover:bg-[oklch(1_0_0_/_3%)]"
      style={{ background: CARD, borderColor: BORDER, borderLeft: `3px solid ${urgencyColor}` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: urgencyColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{action.ticker}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data"
            style={{ background: `${urgencyColor}18`, color: urgencyColor }}>
            {action.urgency?.replace('_', ' ') ?? action.type?.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: DIM }}>{action.reason ?? action.message ?? ''}</p>
      </div>
      {action.ticker && (
        <button
          onClick={() => onAnalyse(action.ticker)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-semibold flex-shrink-0 transition-all hover:bg-[oklch(0.80_0.15_200_/_12%)]"
          style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
        >
          Analyse <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────
function AlertRow({ alert, onAnalyse }: { alert: any; onAnalyse: (ticker: string) => void }) {
  const urgencyColor = alert.urgency === 'URGENT' ? RED : alert.urgency === 'THIS_WEEK' ? AMBER : CYAN;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded border"
      style={{ background: CARD, borderColor: BORDER, borderLeft: `3px solid ${urgencyColor}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{alert.ticker}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data"
            style={{ background: `${urgencyColor}18`, color: urgencyColor }}>
            {alert.urgency?.replace('_', ' ') ?? 'ALERT'}
          </span>
          {alert.strategy && <span className="text-[10px]" style={{ color: DIM }}>{alert.strategy}</span>}
        </div>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: DIM }}>{alert.reason ?? alert.message ?? ''}</p>
      </div>
      {alert.ticker && (
        <button
          onClick={() => onAnalyse(alert.ticker)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-semibold flex-shrink-0 transition-all hover:bg-[oklch(0.80_0.15_200_/_12%)]"
          style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
        >
          Analyse <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label, count, color = DIM }: { label: string; count?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>{label}</span>
      {count != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-data" style={{ background: `${color}18`, color }}>{count}</span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActionCenterPage() {
  const { config } = useConfig();
  const [, navigate] = useLocation();

  const { data: briefing, loading: briefingLoading, refresh: refreshBriefing } = useBriefing();
  const { data: alertsData, refresh: refreshAlerts } = useAlerts();
  const { data: stopData } = useStopLossAll();
  const { data: rollData } = useRollAll();

  const handleAnalyse = (ticker: string) => {
    navigate(`/build?ticker=${ticker}`);
  };

  const handleRefresh = () => {
    refreshBriefing();
    refreshAlerts();
    toast.success('Action Center refreshed');
  };

  if (!config.apiToken) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Action Center" subtitle="Morning alerts · Orders · Portfolio health" />
        <div className="p-6">
          <EmptyState type="no-config" title="API token required" description="Go to Settings to configure your API token." />
        </div>
      </div>
    );
  }

  const actions = briefing?.actions ?? [];
  const urgent   = actions.filter((a: any) => a.urgency === 'URGENT');
  const thisWeek = actions.filter((a: any) => a.urgency === 'THIS_WEEK');
  const watch    = actions.filter((a: any) => !['URGENT', 'THIS_WEEK'].includes(a.urgency));

  const alerts   = alertsData?.alerts ?? [];
  const urgentAlerts   = alerts.filter((a: any) => a.urgency === 'URGENT');
  const weekAlerts     = alerts.filter((a: any) => a.urgency === 'THIS_WEEK');
  const watchAlerts    = alerts.filter((a: any) => !['URGENT', 'THIS_WEEK'].includes(a.urgency));

  const stopLoss = stopData?.positions ?? [];
  const rolls    = rollData?.positions ?? [];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Action Center"
        subtitle="Cockpit 1 — Morning alerts · portfolio health · orders queue"
        onRefresh={handleRefresh}
        refreshing={briefingLoading}
      />

      <div className="p-6 space-y-4">
        {/* Portfolio health strip */}
        <HealthStrip />

        {/* Split pane */}
        <div className="grid grid-cols-2 gap-5" style={{ alignItems: 'start' }}>

          {/* ── LEFT: Actions from briefing ─────────────────────────────── */}
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold pb-1 border-b" style={{ color: DIM, borderColor: BORDER }}>
              Today's Action List — {actions.length} item{actions.length !== 1 ? 's' : ''}
            </div>

            {actions.length === 0 && !briefingLoading && (
              <div className="py-10 text-center rounded border" style={{ borderColor: BORDER }}>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: GREEN }} />
                <p className="text-sm font-semibold" style={{ color: GREEN }}>All clear</p>
                <p className="text-xs mt-1" style={{ color: DIM }}>No urgent actions from this morning's briefing</p>
              </div>
            )}

            {urgent.length > 0 && (
              <div>
                <SectionHeader label="Urgent" count={urgent.length} color={RED} />
                <div className="space-y-2">
                  {urgent.map((a: any, i: number) => <ActionRow key={i} action={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}

            {/* Stop-loss positions */}
            {stopLoss.length > 0 && (
              <div>
                <SectionHeader label="Stop Loss Triggered" count={stopLoss.length} color={RED} />
                <div className="space-y-2">
                  {stopLoss.slice(0, 5).map((p: any) => (
                    <div key={p.position_id}
                      className="flex items-center gap-3 px-4 py-3 rounded border"
                      style={{ background: CARD, borderColor: BORDER, borderLeft: `3px solid ${RED}` }}
                    >
                      <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: RED }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{p.ticker}</span>
                          <span className="text-[10px]" style={{ color: DIM }}>{p.strategy} · Δ{p.delta?.toFixed(2)}</span>
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: RED }}>{p.action}</p>
                      </div>
                      <button onClick={() => handleAnalyse(p.ticker)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-semibold flex-shrink-0 transition-all hover:bg-[oklch(0.80_0.15_200_/_12%)]"
                        style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)' }}>
                        Analyse <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {thisWeek.length > 0 && (
              <div>
                <SectionHeader label="This Week" count={thisWeek.length} color={AMBER} />
                <div className="space-y-2">
                  {thisWeek.map((a: any, i: number) => <ActionRow key={i} action={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}

            {/* Roll candidates */}
            {rolls.length > 0 && (
              <div>
                <SectionHeader label="Roll Window" count={rolls.length} color={AMBER} />
                <div className="space-y-2">
                  {rolls.slice(0, 5).map((p: any) => (
                    <div key={p.position_id}
                      className="flex items-center gap-3 px-4 py-3 rounded border"
                      style={{ background: CARD, borderColor: BORDER, borderLeft: `3px solid ${AMBER}` }}
                    >
                      <RotateCcw className="w-4 h-4 flex-shrink-0" style={{ color: AMBER }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-sm font-bold" style={{ color: BRIGHT }}>{p.ticker}</span>
                          <span className="text-[10px]" style={{ color: DIM }}>{p.strategy} · {p.dte}d DTE</span>
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: AMBER }}>{p.action}</p>
                      </div>
                      <button onClick={() => handleAnalyse(p.ticker)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded border text-[11px] font-semibold flex-shrink-0 transition-all hover:bg-[oklch(0.80_0.15_200_/_12%)]"
                        style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)' }}>
                        Analyse <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {watch.length > 0 && (
              <div>
                <SectionHeader label="Watch" count={watch.length} color={CYAN} />
                <div className="space-y-2">
                  {watch.map((a: any, i: number) => <ActionRow key={i} action={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Alerts / Orders queue ────────────────────────────── */}
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold pb-1 border-b" style={{ color: DIM, borderColor: BORDER }}>
              Orders Queue — {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            </div>

            {alerts.length === 0 && (
              <div className="py-10 text-center rounded border" style={{ borderColor: BORDER }}>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: GREEN }} />
                <p className="text-sm font-semibold" style={{ color: GREEN }}>Queue empty</p>
                <p className="text-xs mt-1" style={{ color: DIM }}>No active alerts in the orders queue</p>
              </div>
            )}

            {urgentAlerts.length > 0 && (
              <div>
                <SectionHeader label="Urgent" count={urgentAlerts.length} color={RED} />
                <div className="space-y-2">
                  {urgentAlerts.map((a: any) => <AlertRow key={a.alert_id} alert={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}

            {weekAlerts.length > 0 && (
              <div>
                <SectionHeader label="This Week" count={weekAlerts.length} color={AMBER} />
                <div className="space-y-2">
                  {weekAlerts.map((a: any) => <AlertRow key={a.alert_id} alert={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}

            {watchAlerts.length > 0 && (
              <div>
                <SectionHeader label="Watch" count={watchAlerts.length} color={CYAN} />
                <div className="space-y-2">
                  {watchAlerts.map((a: any) => <AlertRow key={a.alert_id} alert={a} onAnalyse={handleAnalyse} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
