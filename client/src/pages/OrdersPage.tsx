/**
 * FORTRESS V2 — Orders Page
 * Layer 4: Prioritised order recommendations — URGENT / THIS WEEK / WATCH.
 * Built from /api/manage/stop_loss_all + /api/manage/roll_all + /api/alerts.
 */

import { useStopLossAll, useRollAll, useAlerts, useAlertActions, calcDte } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { usePendingOrders, type PendingOrder } from '@/contexts/PendingOrdersContext';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { AlertTriangle, Clock, Eye, Copy, CheckCircle2, SendHorizonal, Trash2, X, BellOff, Bell, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

// ─── Pending Orders Panel ────────────────────────────────────────────────────

function PendingOrderCard({ order, onRemove }: { order: PendingOrder; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);

  const orderText = `SELL 1x ${order.ticker} ${order.shortStrike}/${order.longStrike} Put Spread exp ${order.expiry} · target credit $${order.creditMin}–$${order.creditMax}`;

  const copy = () => {
    navigator.clipboard.writeText(orderText).then(() => {
      setCopied(true);
      toast.success('Order copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const addedAgo = useMemo(() => {
    const diff = Date.now() - new Date(order.addedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }, [order.addedAt]);

  return (
    <div
      className="rounded border p-4 transition-all hover:bg-[oklch(1_0_0_/_2%)]"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[10px] font-bold font-mono-data px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
          style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: 'oklch(0.85 0.15 200)' }}
        >
          PENDING
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono-data text-sm font-bold" style={{ color: 'oklch(0.72 0.18 145)' }}>SELL</span>
            <span className="font-mono-data text-sm font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>{order.ticker}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: 'oklch(0.80 0.15 200)' }}>
              {order.strategy}
            </span>
            <span className="font-mono-data text-sm" style={{ color: 'oklch(0.65 0.22 25)' }}>${order.shortStrike}</span>
            <span className="font-mono-data text-sm" style={{ color: 'oklch(0.55 0.010 258)' }}>/</span>
            <span className="font-mono-data text-sm" style={{ color: 'oklch(0.72 0.18 145)' }}>${order.longStrike}</span>
            <span className="font-mono-data text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>{order.expiry}</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'oklch(0.60 0.010 258)' }}>
            Target credit: <span className="font-mono-data font-semibold" style={{ color: 'oklch(0.78 0.18 85)' }}>${order.creditMin}–${order.creditMax}</span>
            {order.dpFloorUsed && (
              <span style={{ color: 'oklch(0.80 0.15 200)' }}> · DP floor ${order.dpFloorUsed.toFixed(0)} anchored</span>
            )}
          </p>
          <p className="text-xs mt-1" style={{ color: 'oklch(0.45 0.010 258)' }}>
            {order.rationale} · added {addedAgo}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={copy}
            className="p-1.5 rounded transition-all hover:bg-[oklch(1_0_0_/_8%)]"
            style={{ color: copied ? 'oklch(0.72 0.18 145)' : 'oklch(0.50 0.010 258)' }}
            title="Copy order"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded transition-all hover:bg-[oklch(1_0_0_/_8%)]"
            style={{ color: 'oklch(0.50 0.010 258)' }}
            title="Remove from pending"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingOrdersPanel() {
  const { orders, removeOrder, clearAll } = usePendingOrders();
  if (orders.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SendHorizonal className="w-4 h-4" style={{ color: 'oklch(0.80 0.15 200)' }} />
          <h2 className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>Pending — Awaiting Execution</h2>
          <span
            className="font-mono-data text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'oklch(0.80 0.15 200 / 15%)', color: 'oklch(0.80 0.15 200)' }}
          >
            {orders.length}
          </span>
        </div>
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all hover:opacity-80"
          style={{ color: 'oklch(0.55 0.010 258)', border: '1px solid oklch(1 0 0 / 12%)' }}
        >
          <Trash2 className="w-3 h-3" /> Clear all
        </button>
      </div>
      <div className="space-y-2">
        {orders.map(o => (
          <PendingOrderCard key={o.id} order={o} onRemove={() => removeOrder(o.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── Normalised order type ────────────────────────────────────────────────────

interface NormalisedOrder {
  id: string;
  urgency: 'URGENT' | 'THIS_WEEK' | 'WATCH';
  action: string;
  ticker: string;
  strategy?: string;
  strike?: number;
  expiry?: string;
  reason: string;
  detail?: string;
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: NormalisedOrder }) {
  const [copied, setCopied] = useState(false);

  const actionColor: Record<string, string> = {
    'CLOSE': 'oklch(0.65 0.22 25)',
    'ROLL':  'oklch(0.78 0.18 85)',
    'SELL':  'oklch(0.65 0.22 25)',
    'BUY':   'oklch(0.72 0.18 145)',
    'HEDGE': 'oklch(0.80 0.15 200)',
  };
  const aColor = actionColor[order.action] ?? 'oklch(0.80 0.15 200)';

  const borderColor: Record<string, string> = {
    URGENT:    'oklch(0.65 0.22 25 / 35%)',
    THIS_WEEK: 'oklch(0.78 0.18 85 / 25%)',
    WATCH:     'oklch(0.80 0.15 200 / 20%)',
  };

  const [jsonCopied, setJsonCopied] = useState(false);

  const copyOrder = () => {
    const text = [
      order.action,
      order.ticker,
      order.strategy ?? '',
      order.strike ? `$${order.strike}` : '',
      order.expiry ?? '',
      `— ${order.reason}`,
    ].filter(Boolean).join(' ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Order copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyJsonPayload = () => {
    const payload = JSON.stringify({
      action: order.action,
      ticker: order.ticker,
      strategy: order.strategy ?? null,
      strike: order.strike ?? null,
      expiry: order.expiry ?? null,
      urgency: order.urgency,
      reason: order.reason,
      timestamp: new Date().toISOString(),
    }, null, 2);
    navigator.clipboard.writeText(payload);
    setJsonCopied(true);
    toast.success('JSON payload copied — paste into IBKR webhook or automation');
    setTimeout(() => setJsonCopied(false), 2000);
  };

  return (
    <div
      className="rounded border p-4 transition-all hover:bg-[oklch(1_0_0_/_2%)]"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: borderColor[order.urgency] }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[10px] font-bold font-mono-data px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
          style={{
            background: `${borderColor[order.urgency].replace(' / 35%)', ' / 15%)').replace(' / 25%)', ' / 15%)').replace(' / 20%)', ' / 15%)')}`,
            color: order.urgency === 'URGENT' ? 'oklch(0.75 0.22 25)' : order.urgency === 'THIS_WEEK' ? 'oklch(0.85 0.18 85)' : 'oklch(0.85 0.15 200)',
          }}
        >
          {order.urgency.replace('_', ' ')}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono-data text-sm font-bold" style={{ color: aColor }}>
              {order.action}
            </span>
            <span className="font-mono-data text-sm font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
              {order.ticker}
            </span>
            {order.strategy && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: 'oklch(0.80 0.15 200)' }}>
                {order.strategy}
              </span>
            )}
            {order.strike && (
              <span className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.005 258)' }}>
                ${order.strike.toLocaleString()}
              </span>
            )}
            {order.expiry && (
              <span className="font-mono-data text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
                {order.expiry}
              </span>
            )}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'oklch(0.60 0.010 258)' }}>
            {order.reason}
          </p>
          {order.detail && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'oklch(0.50 0.010 258)' }}>
              {order.detail}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          {/* Copy human-readable text */}
          <button
            onClick={copyOrder}
            className="p-1.5 rounded transition-all hover:bg-[oklch(1_0_0_/_8%)]"
            style={{ color: copied ? 'oklch(0.72 0.18 145)' : 'oklch(0.50 0.010 258)' }}
            title="Copy order text"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          {/* Copy JSON payload (for IBKR webhook / automation) — URGENT only */}
          {order.urgency === 'URGENT' && (
            <button
              onClick={copyJsonPayload}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all hover:opacity-80"
              style={{
                color: jsonCopied ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
                borderColor: jsonCopied ? 'oklch(0.72 0.18 145 / 40%)' : 'oklch(0.65 0.22 25 / 40%)',
                background: jsonCopied ? 'oklch(0.72 0.18 145 / 8%)' : 'oklch(0.65 0.22 25 / 8%)',
              }}
              title="Copy JSON payload for IBKR webhook or automation"
            >
              {jsonCopied ? <CheckCircle2 className="w-3 h-3" /> : <SendHorizonal className="w-3 h-3" />}
              {jsonCopied ? 'Copied' : 'JSON'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function OrderSection({
  title, icon: Icon, orders, iconColor, emptyText,
}: {
  title: string;
  icon: React.ElementType;
  orders: NormalisedOrder[];
  iconColor: string;
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <h2 className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {title}
        </h2>
        <span
          className="font-mono-data text-xs px-2 py-0.5 rounded-full"
          style={{ background: `${iconColor.replace(')', ' / 15%)')}`, color: iconColor }}
        >
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="rounded border py-6 text-center text-xs" style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}>
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: stopData, loading: stopLoading, error: stopError, refresh: refreshStop, lastUpdated } = useStopLossAll();
  const { data: rollData, loading: rollLoading, refresh: refreshRoll } = useRollAll();
  const { data: alertData, refresh: refreshAlerts } = useAlerts();
  const { snoozeAlert, dismissAlert, refreshAlerts: triggerRefresh } = useAlertActions();
  const { config } = useConfig();

  const loading = stopLoading || rollLoading;
  const error = stopError;

  const refresh = () => { refreshStop(); refreshRoll(); refreshAlerts(); };

  async function handleSnooze(alertId: string) {
    try { await snoozeAlert(alertId); refreshAlerts(); toast.success('Alert snoozed'); } catch { toast.error('Failed to snooze'); }
  }
  async function handleDismiss(alertId: string) {
    try { await dismissAlert(alertId); refreshAlerts(); toast.success('Alert dismissed'); } catch { toast.error('Failed to dismiss'); }
  }
  async function handleRefreshAlerts() {
    try { await triggerRefresh(); refreshAlerts(); toast.success('Alerts refreshed'); } catch { toast.error('Failed to refresh alerts'); }
  }

  // Build normalised order list
  const orders = useMemo<NormalisedOrder[]>(() => {
    const result: NormalisedOrder[] = [];

    // URGENT: stop-loss ACT
    stopData?.positions
      .filter(p => p.verdict === 'ACT')
      .forEach(p => result.push({
        id: `sl-${p.synthesized_id}`,
        urgency: 'URGENT',
        action: 'CLOSE',
        ticker: p.ticker,
        strategy: p.strategy,
        strike: p.short_strike,
        expiry: p.expiry,
        reason: p.recommended_action,
        detail: p.reasons.join(' · '),
      }));

    // URGENT: roll with urgency=URGENT
    rollData?.positions
      .filter(p => p.roll_needed && p.urgency === 'URGENT')
      .forEach(p => result.push({
        id: `roll-urgent-${p.synthesized_id}`,
        urgency: 'URGENT',
        action: 'ROLL',
        ticker: p.ticker,
        strategy: p.strategy,
        strike: p.short_strike,
        expiry: p.expiry,
        reason: p.reasons.join(' · ') || `${p.current_dte}d to expiry — roll now`,
      }));

    // THIS_WEEK: roll with urgency=SOON
    rollData?.positions
      .filter(p => p.roll_needed && p.urgency === 'SOON')
      .forEach(p => result.push({
        id: `roll-soon-${p.synthesized_id}`,
        urgency: 'THIS_WEEK',
        action: 'ROLL',
        ticker: p.ticker,
        strategy: p.strategy,
        strike: p.short_strike,
        expiry: p.expiry,
        reason: p.reasons.join(' · ') || `${p.current_dte}d to expiry`,
      }));

    // WATCH: stop-loss WATCH
    stopData?.positions
      .filter(p => p.verdict === 'WATCH')
      .forEach(p => result.push({
        id: `sl-watch-${p.synthesized_id}`,
        urgency: 'WATCH',
        action: 'CLOSE',
        ticker: p.ticker,
        strategy: p.strategy,
        strike: p.short_strike,
        expiry: p.expiry,
        reason: p.recommended_action,
        detail: p.reasons.join(' · '),
      }));

    // WATCH: active alerts
    alertData?.alerts
      .filter(a => !a.snoozed)
      .forEach(a => result.push({
        id: `alert-${a.id}`,
        urgency: 'WATCH',
        action: 'HEDGE',
        ticker: a.ticker,
        reason: a.message,
      }));

    return result;
  }, [stopData, rollData, alertData]);

  const urgent = orders.filter(o => o.urgency === 'URGENT');
  const thisWeek = orders.filter(o => o.urgency === 'THIS_WEEK');
  const watch = orders.filter(o => o.urgency === 'WATCH');

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Orders"
        subtitle="Layer 4 — Prioritised recommendations: URGENT · THIS WEEK · WATCH"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Urgent (Act Today)" value={urgent.length.toString()} signal={urgent.length > 0 ? 'red' : 'green'} loading={loading} />
          <StatCard label="This Week" value={thisWeek.length.toString()} signal={thisWeek.length > 0 ? 'amber' : 'default'} loading={loading} />
          <StatCard label="Watch" value={watch.length.toString()} signal="cyan" loading={loading} />
        </div>

        <div className="rounded p-3 text-xs" style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}>
          <span className="font-semibold" style={{ color: 'oklch(0.80 0.15 200)' }}>Order generation: </span>
          <span style={{ color: 'oklch(0.58 0.010 258)' }}>
            Orders are synthesised from Layers 1–3: regime gate → per-ticker flow → position evaluation.
            <span style={{ color: 'oklch(0.65 0.22 25)' }}> URGENT</span> = stop-loss ACT, roll URGENT.
            <span style={{ color: 'oklch(0.78 0.18 85)' }}> THIS WEEK</span> = roll SOON.
            <span style={{ color: 'oklch(0.80 0.15 200)' }}> WATCH</span> = stop-loss WATCH, active alerts.
          </span>
        </div>

        {error && !loading && <EmptyState type="error" title="Failed to load orders" description={error} />}
        {loading && !stopData && <EmptyState type="loading" title="Loading orders…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your API URL and token in Settings." />}

        <PendingOrdersPanel />

        {/* Active Alerts Panel with snooze/dismiss */}
        {alertData && alertData.alerts.length > 0 && (
          <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(0.78 0.18 85 / 25%)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: 'oklch(0.78 0.18 85)' }} />
                <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>Active Alerts</h2>
                <span className="font-mono-data text-xs px-2 py-0.5 rounded-full" style={{ background: 'oklch(0.78 0.18 85 / 15%)', color: 'oklch(0.78 0.18 85)' }}>
                  {alertData.alerts.filter(a => !a.snoozed).length}
                </span>
              </div>
              <button onClick={handleRefreshAlerts} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:opacity-80" style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 25%)' }}>
                <RefreshCw className="w-3 h-3" /> Refresh Alerts
              </button>
            </div>
            <div className="space-y-2">
              {alertData.alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded border" style={{
                  background: alert.snoozed ? 'oklch(0.15 0.010 258)' : alert.severity === 'critical' ? 'oklch(0.65 0.22 25 / 8%)' : 'oklch(0.78 0.18 85 / 8%)',
                  borderColor: alert.snoozed ? 'oklch(1 0 0 / 8%)' : alert.severity === 'critical' ? 'oklch(0.65 0.22 25 / 30%)' : 'oklch(0.78 0.18 85 / 30%)',
                  opacity: alert.snoozed ? 0.5 : 1,
                }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: alert.severity === 'critical' ? 'oklch(0.65 0.22 25)' : 'oklch(0.78 0.18 85)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-data text-xs font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>{alert.ticker}</span>
                      <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded uppercase" style={{ color: alert.severity === 'critical' ? 'oklch(0.65 0.22 25)' : 'oklch(0.78 0.18 85)', background: alert.severity === 'critical' ? 'oklch(0.65 0.22 25 / 12%)' : 'oklch(0.78 0.18 85 / 12%)' }}>{alert.severity}</span>
                      {alert.snoozed && <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.50 0.010 258)' }}>SNOOZED</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.65 0.010 258)' }}>{alert.message}</p>
                    <p className="text-[10px] mt-0.5 font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>{alert.source} · {new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!alert.snoozed && (
                      <button onClick={() => handleSnooze(alert.id)} title="Snooze" className="p-1.5 rounded hover:opacity-80" style={{ color: 'oklch(0.78 0.18 85)' }}>
                        <BellOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDismiss(alert.id)} title="Dismiss" className="p-1.5 rounded hover:opacity-80" style={{ color: 'oklch(0.65 0.22 25)' }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <>
            <OrderSection title="URGENT — Act Today" icon={AlertTriangle} orders={urgent} iconColor="oklch(0.65 0.22 25)" emptyText="No urgent actions required" />
            <OrderSection title="THIS WEEK" icon={Clock} orders={thisWeek} iconColor="oklch(0.78 0.18 85)" emptyText="No actions required this week" />
            <OrderSection title="WATCH — No Action Yet" icon={Eye} orders={watch} iconColor="oklch(0.80 0.15 200)" emptyText="No positions approaching thresholds" />
          </>
        )}
      </div>
    </div>
  );
}
