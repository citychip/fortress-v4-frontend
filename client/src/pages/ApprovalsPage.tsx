/**
 * FORTRESS V3 — Order Approvals Page (v3.7.2)
 *
 * Lists pending orders submitted from Build Center for human review.
 * Each card shows: strategy, legs, Greeks snapshot, IBKR whatif preview, Approve / Decline buttons.
 */

import { useState, useCallback } from 'react';
import {
  usePendingOrders,
  usePendingOrderActions,
  type PendingOrder,
} from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, Eye, Clock, Send, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Design tokens ─────────────────────────────────────────────────────────────
const CYAN   = 'oklch(0.80 0.15 200)';
const GREEN  = 'oklch(0.72 0.18 145)';
const AMBER  = 'oklch(0.78 0.18 85)';
const RED    = 'oklch(0.65 0.22 25)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

type StatusFilter = 'all' | 'pending' | 'submitted' | 'declined' | 'failed';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'declined',  label: 'Declined' },
  { id: 'failed',    label: 'Failed' },
];

function statusColor(status: string): string {
  switch (status) {
    case 'pending':   return AMBER;
    case 'submitted': return GREEN;
    case 'declined':  return DIM;
    case 'failed':    return RED;
    case 'approved':  return CYAN;
    default:          return DIM;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'pending':   return <Clock className="w-3.5 h-3.5" />;
    case 'submitted': return <Send className="w-3.5 h-3.5" />;
    case 'declined':  return <XCircle className="w-3.5 h-3.5" />;
    case 'failed':    return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'approved':  return <CheckCircle2 className="w-3.5 h-3.5" />;
    default:          return <Activity className="w-3.5 h-3.5" />;
  }
}

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDollar(v: number | undefined | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

// ── Whatif panel ──────────────────────────────────────────────────────────────
function WhatifPanel({ result }: { result: Record<string, unknown> }) {
  if (!result) return null;

  type WhatifKey = 'equity_with_loan' | 'init_margin_req_c' | 'maint_margin_req_c' | 'commission' | 'change_in_equity_with_loan_value';
  const rows: { label: string; key: WhatifKey; prefix?: string }[] = [
    { label: 'Equity Impact',    key: 'change_in_equity_with_loan_value', prefix: '$' },
    { label: 'Init Margin Req',  key: 'init_margin_req_c',   prefix: '$' },
    { label: 'Maint Margin Req', key: 'maint_margin_req_c',  prefix: '$' },
    { label: 'Commission Est',   key: 'commission',           prefix: '$' },
  ];

  const val = (key: WhatifKey) => {
    const v = result[key];
    if (v == null) return '—';
    const n = parseFloat(String(v));
    if (isNaN(n)) return String(v);
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="mt-3 rounded border p-3" style={{ background: 'oklch(0.13 0.010 258)', borderColor: BORDER }}>
      <div className="text-[9px] uppercase tracking-widest mb-2 font-semibold" style={{ color: CYAN }}>
        IBKR Whatif Preview
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        {rows.map(r => (
          <div key={r.key} className="flex justify-between">
            <span style={{ color: DIM }}>{r.label}</span>
            <span className="font-mono-data" style={{ color: BRIGHT }}>{val(r.key)}</span>
          </div>
        ))}
      </div>
      {result.error ? (
        <div className="mt-2 text-xs" style={{ color: RED }}>
          IBKR: {String(result.error)}
        </div>
      ) : null}
    </div>
  );
}

// ── Leg table ─────────────────────────────────────────────────────────────────
function LegTable({ legs, quantity }: { legs: PendingOrder['legs']; quantity: number }) {
  if (!legs?.length) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ color: DIM }}>
            {['Ticker','Type','Right','Strike','Expiry','Action','Qty'].map(h => (
              <th key={h} className="text-left pb-1 pr-4 font-medium uppercase tracking-wide text-[9px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => (
            <tr key={i} className="border-t" style={{ borderColor: BORDER }}>
              <td className="py-1.5 pr-4 font-mono-data" style={{ color: BRIGHT }}>{leg.ticker}</td>
              <td className="py-1.5 pr-4" style={{ color: DIM }}>{leg.sec_type}</td>
              <td className="py-1.5 pr-4 font-mono-data" style={{ color: leg.right === 'C' ? GREEN : RED }}>
                {leg.right ?? '—'}
              </td>
              <td className="py-1.5 pr-4 font-mono-data" style={{ color: BRIGHT }}>
                {leg.strike != null ? `$${leg.strike}` : '—'}
              </td>
              <td className="py-1.5 pr-4 font-mono" style={{ color: DIM }}>
                {leg.expiry ? `${leg.expiry.slice(0,4)}-${leg.expiry.slice(4,6)}-${leg.expiry.slice(6,8)}` : '—'}
              </td>
              <td className="py-1.5 pr-4 font-semibold" style={{ color: leg.action === 'BUY' ? GREEN : AMBER }}>
                {leg.action}
              </td>
              <td className="py-1.5 font-mono-data" style={{ color: BRIGHT }}>
                {leg.ratio * quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onRefresh }: { order: PendingOrder; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy]         = useState(false);
  const { previewOrder, approveOrder, declineOrder } = usePendingOrderActions();

  const handle = useCallback(async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }, [onRefresh]);

  const isPending = order.status === 'pending';

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: CARD, borderColor: BORDER, borderLeft: `3px solid ${statusColor(order.status)}` }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: BRIGHT }}>{order.ticker}</span>
            {order.strategy && (
              <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase" style={{ background: 'oklch(0.22 0.012 258)', color: CYAN, border: `1px solid ${BORDER}` }}>
                {order.strategy}
              </span>
            )}
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded"
              style={{ background: 'oklch(0.22 0.012 258)', color: statusColor(order.status) }}
            >
              {statusIcon(order.status)}
              {order.status.toUpperCase()}
            </span>
            {order.ibkr_order_id && (
              <span className="text-[10px]" style={{ color: DIM }}>IBKR #{order.ibkr_order_id}</span>
            )}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: DIM }}>
            {fmtTs(order.created_at)} · {order.order_type} · {order.tif} · {order.submitted_by}
          </div>
        </div>

        {/* Greeks snapshot */}
        <div className="hidden sm:flex items-center gap-4 mr-2">
          {order.pop != null && (
            <div className="text-center">
              <div className="text-[9px] uppercase" style={{ color: DIM }}>PoP</div>
              <div className="font-mono-data text-xs font-bold" style={{ color: GREEN }}>{order.pop.toFixed(0)}%</div>
            </div>
          )}
          {order.max_profit != null && (
            <div className="text-center">
              <div className="text-[9px] uppercase" style={{ color: DIM }}>Max Profit</div>
              <div className="font-mono-data text-xs font-bold" style={{ color: GREEN }}>{fmtDollar(order.max_profit)}</div>
            </div>
          )}
          {order.max_loss != null && (
            <div className="text-center">
              <div className="text-[9px] uppercase" style={{ color: DIM }}>Max Loss</div>
              <div className="font-mono-data text-xs font-bold" style={{ color: RED }}>{fmtDollar(order.max_loss)}</div>
            </div>
          )}
          {order.limit_price != null && (
            <div className="text-center">
              <div className="text-[9px] uppercase" style={{ color: DIM }}>Limit</div>
              <div className="font-mono-data text-xs font-bold" style={{ color: BRIGHT }}>${order.limit_price.toFixed(2)}</div>
            </div>
          )}
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: DIM }} />}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
          <LegTable legs={order.legs} quantity={order.quantity} />

          {order.notes && (
            <div className="mt-3 text-xs italic" style={{ color: DIM }}>
              Notes: {order.notes}
            </div>
          )}

          {order.whatif_result && (
            <WhatifPanel result={order.whatif_result as Record<string, unknown>} />
          )}

          {order.error && (
            <div className="mt-3 text-xs rounded p-2" style={{ background: 'oklch(0.20 0.02 25)', color: RED, border: `1px solid ${RED}30` }}>
              Error: {order.error}
            </div>
          )}

          {/* Action buttons */}
          {isPending && (
            <div className="flex items-center gap-2 mt-4">
              {/* Preview */}
              <button
                disabled={busy}
                onClick={() => handle(() => previewOrder(order.id), 'Whatif preview loaded')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'oklch(0.22 0.012 258)', color: CYAN, border: `1px solid ${CYAN}40` }}
              >
                <Eye className="w-3.5 h-3.5" />
                {order.whatif_result ? 'Re-preview' : 'Preview'}
              </button>

              {/* Approve */}
              <button
                disabled={busy}
                onClick={() => handle(() => approveOrder(order.id), `Order submitted to IBKR!`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'oklch(0.22 0.04 145)', color: GREEN, border: `1px solid ${GREEN}50` }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve & Send
              </button>

              {/* Decline */}
              <button
                disabled={busy}
                onClick={() => handle(() => declineOrder(order.id), 'Order declined')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'oklch(0.22 0.03 25)', color: RED, border: `1px solid ${RED}40` }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </button>

              {busy && (
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: DIM }} />
              )}
            </div>
          )}

          {order.status === 'submitted' && order.ibkr_order_id && (
            <div className="mt-3 text-xs rounded p-2 flex items-center gap-2" style={{ background: 'oklch(0.20 0.03 145)', color: GREEN, border: `1px solid ${GREEN}30` }}>
              <Send className="w-3.5 h-3.5" />
              Submitted to IBKR — Order ID: {order.ibkr_order_id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data, loading, error, refresh } = usePendingOrders(statusFilter === 'all' ? undefined : statusFilter);

  const orders = data?.orders ?? [];
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Order Approvals"
        subtitle={pendingCount > 0 ? `${pendingCount} awaiting review` : 'No pending orders'}
        onRefresh={refresh}
        refreshing={loading}
      />

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
        {STATUS_TABS.map(tab => {
          const count = tab.id === 'all'
            ? orders.length
            : orders.filter(o => o.status === tab.id).length;
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: active ? 'oklch(0.22 0.012 258)' : 'transparent',
                color: active ? BRIGHT : DIM,
                border: `1px solid ${active ? BORDER : 'transparent'}`,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                  style={{
                    background: tab.id === 'pending' ? `${AMBER}25` : 'oklch(0.22 0.012 258)',
                    color: tab.id === 'pending' ? AMBER : DIM,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 text-sm rounded p-3" style={{ background: 'oklch(0.20 0.03 25)', color: RED, border: `1px solid ${RED}30` }}>
            {error}
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <EmptyState
            type="empty"
            title={statusFilter === 'pending' ? 'No pending orders' : 'No orders found'}
            description={
              statusFilter === 'pending'
                ? 'Orders submitted from Build Center will appear here for review.'
                : `No ${statusFilter} orders.`
            }
          />
        )}

        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} onRefresh={refresh} />
          ))}
        </div>
      </div>
    </div>
  );
}
