/**
 * FORTRESS V2 — Orders Page
 * Layer 4: Prioritised order recommendations — URGENT / THIS WEEK / WATCH.
 * Each order includes action, ticker, right, strike, expiry, qty, and reason.
 */

import { useBriefing, type OrderRecommendation } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { AlertTriangle, Clock, Eye, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: OrderRecommendation }) {
  const [copied, setCopied] = useState(false);

  const actionColor = {
    BUY:   'oklch(0.72 0.18 145)',
    SELL:  'oklch(0.65 0.22 25)',
    ROLL:  'oklch(0.78 0.18 85)',
    CLOSE: 'oklch(0.65 0.22 25)',
    ADJUST:'oklch(0.80 0.15 200)',
  }[order.action] ?? 'oklch(0.80 0.15 200)';

  const borderColor = {
    URGENT:    'oklch(0.65 0.22 25 / 35%)',
    THIS_WEEK: 'oklch(0.78 0.18 85 / 25%)',
    WATCH:     'oklch(0.80 0.15 200 / 20%)',
  }[order.urgency];

  const copyOrder = () => {
    const text = [
      order.action,
      order.ticker,
      order.right ? `${order.right}` : '',
      order.strike ? `$${order.strike}` : '',
      order.expiry ?? '',
      order.qty ? `x${order.qty}` : '',
      `— ${order.reason}`,
    ].filter(Boolean).join(' ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Order copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="rounded border p-4 transition-all hover:bg-[oklch(1_0_0_/_2%)]"
      style={{
        background: 'oklch(0.17 0.010 258)',
        borderColor,
      }}
    >
      <div className="flex items-start gap-3">
        <UrgencyBadge urgency={order.urgency} pulse={order.urgency === 'URGENT'} />

        <div className="flex-1 min-w-0">
          {/* Action line */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono-data text-sm font-bold"
              style={{ color: actionColor }}
            >
              {order.action}
            </span>
            <span className="font-mono-data text-sm font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
              {order.ticker}
            </span>
            {order.right && (
              <span
                className="font-mono-data text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: order.right === 'C' ? 'oklch(0.72 0.18 145 / 15%)' : 'oklch(0.65 0.22 25 / 15%)',
                  color: order.right === 'C' ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
                }}
              >
                {order.right}
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
            {order.qty && (
              <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
                ×{Math.abs(order.qty)}
              </span>
            )}
          </div>

          {/* Reason */}
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'oklch(0.60 0.010 258)' }}>
            {order.reason}
          </p>

          {/* Detail */}
          {order.detail && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'oklch(0.50 0.010 258)' }}>
              {order.detail}
            </p>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={copyOrder}
          className="flex-shrink-0 p-1.5 rounded transition-all hover:bg-[oklch(1_0_0_/_8%)]"
          style={{ color: copied ? 'oklch(0.72 0.18 145)' : 'oklch(0.50 0.010 258)' }}
          title="Copy order to clipboard"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function OrderSection({
  title,
  icon: Icon,
  orders,
  iconColor,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  orders: OrderRecommendation[];
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
        <div
          className="rounded border py-6 text-center text-xs"
          style={{ borderColor: 'oklch(1 0 0 / 8%)', color: 'oklch(0.50 0.010 258)' }}
        >
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { data, loading, error, refresh, lastUpdated } = useBriefing();
  const { config } = useConfig();

  const orders = data?.today_actions ?? [];
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
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Urgent (Act Today)"
            value={urgent.length.toString()}
            signal={urgent.length > 0 ? 'red' : 'green'}
            loading={loading}
          />
          <StatCard
            label="This Week"
            value={thisWeek.length.toString()}
            signal={thisWeek.length > 0 ? 'amber' : 'default'}
            loading={loading}
          />
          <StatCard
            label="Watch"
            value={watch.length.toString()}
            signal="cyan"
            loading={loading}
          />
        </div>

        {/* Workflow explanation */}
        <div
          className="rounded p-3 text-xs"
          style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 8%)' }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.80 0.15 200)' }}>Order generation: </span>
          <span style={{ color: 'oklch(0.58 0.010 258)' }}>
            Orders are synthesised from Layers 1–3: regime gate → per-ticker flow → position evaluation.
            <span style={{ color: 'oklch(0.65 0.22 25)' }}> URGENT</span> = stop-loss triggers, delta ≥ {config.strategy.deltaAlertThreshold}, expiry ≤ 7d.
            <span style={{ color: 'oklch(0.78 0.18 85)' }}> THIS WEEK</span> = roll candidates, hedge adjustments.
            <span style={{ color: 'oklch(0.80 0.15 200)' }}> WATCH</span> = approaching thresholds, no action yet.
          </span>
        </div>

        {/* Error / loading */}
        {error && !loading && (
          <EmptyState type="error" title="Failed to load orders" description={error} />
        )}
        {loading && !data && (
          <EmptyState type="loading" title="Loading orders…" />
        )}
        {!config.apiToken && !loading && (
          <EmptyState
            type="no-config"
            title="API token required"
            description="Configure your API URL and token in Settings."
          />
        )}

        {/* Order sections */}
        {!loading && (
          <>
            <OrderSection
              title="URGENT — Act Today"
              icon={AlertTriangle}
              orders={urgent}
              iconColor="oklch(0.65 0.22 25)"
              emptyText="No urgent actions required"
            />
            <OrderSection
              title="THIS WEEK"
              icon={Clock}
              orders={thisWeek}
              iconColor="oklch(0.78 0.18 85)"
              emptyText="No actions required this week"
            />
            <OrderSection
              title="WATCH — No Action Yet"
              icon={Eye}
              orders={watch}
              iconColor="oklch(0.80 0.15 200)"
              emptyText="No positions approaching thresholds"
            />
          </>
        )}
      </div>
    </div>
  );
}
