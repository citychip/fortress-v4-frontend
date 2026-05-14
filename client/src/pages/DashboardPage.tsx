/**
 * FORTRESS V2 — Dashboard Page
 * Layer 1 entry point: Account health + Macro Regime Gate + Top priority orders + Market snapshot.
 * All data from configurable API. No hardcoded tickers.
 */

import { useBriefing, usePositions, formatDollar, calcDte, evaluateLeg } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { RegimeBadge } from '@/components/RegimeBadge';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { EmptyState } from '@/components/EmptyState';
import { Link } from 'wouter';
import { ArrowRight, AlertTriangle, TrendingUp, BookOpen, Crosshair } from 'lucide-react';

// ─── Account Summary Cards ────────────────────────────────────────────────────

function AccountSummary() {
  const { data, loading, error, refresh, lastUpdated } = useBriefing();
  const { config } = useConfig();

  if (!config.apiToken) {
    return (
      <EmptyState
        type="no-config"
        title="API token required"
        description="Add your bearer token in Settings → API Connection to connect to the Fortress Dashboard."
      />
    );
  }

  const account = data?.account;
  const macro = data?.macro;

  return (
    <div className="space-y-4">
      {/* Account metrics */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Net Liquidation"
          value={account ? formatDollar(account.net_liquidation) : '—'}
          signal="cyan"
          loading={loading}
        />
        <StatCard
          label="Excess Liquidity"
          value={account ? formatDollar(account.excess_liquidity) : '—'}
          signal={account && account.excess_liquidity < 10000 ? 'amber' : 'default'}
          loading={loading}
        />
        <StatCard
          label="Available Funds"
          value={account ? formatDollar(account.available_funds) : '—'}
          signal={account && account.available_funds < 5000 ? 'red' : 'default'}
          loading={loading}
        />
      </div>

      {/* Macro Regime Gate */}
      <div
        className="rounded p-4"
        style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
              Layer 1 — Macro Regime Gate
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.010 258)' }}>
              SPY GEX / Dark Pool / Net Drift synthesis
            </p>
          </div>
          {macro && (
            <RegimeBadge
              score={macro.regime_score}
              entryPermitted={macro.entry_permitted}
              size="md"
            />
          )}
          {loading && (
            <div className="h-7 w-40 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
          )}
        </div>

        {macro && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                GEX
              </div>
              <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>
                {macro.spy_gex !== undefined ? macro.spy_gex.toLocaleString() : '—'}
              </div>
            </div>
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                DP Floor
              </div>
              <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>
                {macro.spy_dp_floor !== undefined ? `$${macro.spy_dp_floor.toFixed(2)}` : '—'}
              </div>
            </div>
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Net Drift
              </div>
              <div
                className="font-mono-data text-sm"
                style={{
                  color: macro.spy_net_drift === undefined ? 'oklch(0.80 0.15 200)'
                    : macro.spy_net_drift > 0 ? 'oklch(0.72 0.18 145)'
                    : 'oklch(0.65 0.22 25)',
                }}
              >
                {macro.spy_net_drift !== undefined
                  ? `${macro.spy_net_drift > 0 ? '+' : ''}${macro.spy_net_drift.toFixed(2)}`
                  : '—'}
              </div>
            </div>
          </div>
        )}

        {macro?.summary && (
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'oklch(0.65 0.010 258)' }}>
            {macro.summary}
          </p>
        )}

        {error && (
          <p className="text-xs mt-2" style={{ color: 'oklch(0.65 0.22 25)' }}>
            Error: {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Top Priority Orders ──────────────────────────────────────────────────────

function TopOrders() {
  const { data, loading } = useBriefing();
  const orders = data?.today_actions ?? [];
  const urgent = orders.filter(o => o.urgency === 'URGENT');
  const thisWeek = orders.filter(o => o.urgency === 'THIS_WEEK');
  const displayed = [...urgent, ...thisWeek].slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
        ))}
      </div>
    );
  }

  if (!displayed.length) {
    return (
      <div className="py-8 text-center" style={{ color: 'oklch(0.55 0.010 258)' }}>
        <div className="text-sm">No priority orders</div>
        <div className="text-xs mt-1">All positions within thresholds</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map(order => (
        <div
          key={order.id}
          className="flex items-start gap-3 p-3 rounded border transition-all hover:bg-[oklch(1_0_0_/_3%)]"
          style={{
            background: 'oklch(0.17 0.010 258)',
            borderColor: order.urgency === 'URGENT'
              ? 'oklch(0.65 0.22 25 / 30%)'
              : 'oklch(0.78 0.18 85 / 25%)',
          }}
        >
          <UrgencyBadge urgency={order.urgency} pulse={order.urgency === 'URGENT'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-sm font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
                {order.action} {order.ticker}
              </span>
              {order.right && order.strike && (
                <span className="font-mono-data text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
                  {order.right} ${order.strike} {order.expiry}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.58 0.010 258)' }}>
              {order.reason}
            </p>
          </div>
        </div>
      ))}

      {orders.length > 5 && (
        <Link href="/orders">
          <div
            className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border transition-all hover:bg-[oklch(0.80_0.15_200_/_8%)] cursor-pointer"
            style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 20%)' }}
          >
            View all {orders.length} orders
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Position Alerts Summary ──────────────────────────────────────────────────

function PositionAlertsSummary() {
  const { data, loading } = usePositions();
  const { config } = useConfig();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
        ))}
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const alerts = positions.flatMap(leg => {
    const legAlerts = evaluateLeg(leg, config.strategy);
    return legAlerts.map(a => ({ ticker: leg.ticker, right: leg.right, strike: leg.strike, alert: a }));
  });

  if (!alerts.length) {
    return (
      <div className="py-6 text-center" style={{ color: 'oklch(0.55 0.010 258)' }}>
        <div className="text-sm">No position alerts</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 4).map((a, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3 py-2 rounded border"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
          <span className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
            {a.ticker} {a.right}${a.strike}
          </span>
          <span className="text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>
            {a.alert}
          </span>
        </div>
      ))}
      {alerts.length > 4 && (
        <Link href="/positions">
          <div className="text-xs text-center py-1 cursor-pointer" style={{ color: 'oklch(0.80 0.15 200)' }}>
            +{alerts.length - 4} more alerts → Positions
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Quick Nav Cards ──────────────────────────────────────────────────────────

function QuickNav() {
  const links = [
    { href: '/positions',    label: 'View Positions', sub: 'Per-leg evaluation',          icon: BookOpen,     color: 'oklch(0.80 0.15 200)' },
    { href: '/market-intel', label: 'Market Intel',   sub: 'GEX / DP / Drift',            icon: TrendingUp,   color: 'oklch(0.72 0.18 145)' },
    { href: '/candidates',   label: 'Candidates',     sub: 'IV rank screener',             icon: Crosshair,    color: 'oklch(0.78 0.18 85)' },
    { href: '/orders',       label: 'All Orders',     sub: 'URGENT / THIS WEEK / WATCH',  icon: AlertTriangle, color: 'oklch(0.65 0.22 25)' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {links.map(({ href, label, sub, icon: Icon, color }) => (
        <Link key={href} href={href}>
          <div
            className="flex items-center gap-3 p-3 rounded border transition-all hover:bg-[oklch(1_0_0_/_4%)] cursor-pointer"
            style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}
          >
            <div
              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: `${color.replace(')', ' / 15%)')}`, border: `1px solid ${color.replace(')', ' / 30%)')}` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'oklch(0.85 0.005 258)' }}>{label}</div>
              <div className="text-[10px]" style={{ color: 'oklch(0.55 0.010 258)' }}>{sub}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 ml-auto" style={{ color: 'oklch(0.45 0.010 258)' }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, loading, refresh, lastUpdated } = useBriefing();

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Dashboard"
        subtitle="Morning workflow — Regime Gate → Position Review → Order List"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />

      <div className="p-6 space-y-6">
        {/* Account + Regime */}
        <AccountSummary />

        {/* Quick nav */}
        <QuickNav />

        {/* Workflow guide */}
        <div
          className="rounded p-4"
          style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}
        >
          <h2 className="font-display text-sm mb-3" style={{ color: 'oklch(0.93 0.005 258)' }}>
            Morning Workflow
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { step: '1', label: 'Macro Regime Gate', desc: 'Check SPY GEX/DP/Drift. If regime ≤ threshold → no new entries.', color: 'oklch(0.80 0.15 200)' },
              { step: '2', label: 'Market Intelligence', desc: 'Review per-ticker flow. Identify directional bias for each position.', color: 'oklch(0.72 0.18 145)' },
              { step: '3', label: 'Position Review', desc: 'Scan delta alerts, roll candidates, concentration breaches.', color: 'oklch(0.78 0.18 85)' },
              { step: '4', label: 'Execute Orders', desc: 'Work through URGENT → THIS WEEK → WATCH order list.', color: 'oklch(0.65 0.22 25)' },
            ].map(({ step, label, desc, color }) => (
              <div key={step} className="rounded p-3" style={{ background: 'oklch(0.22 0.010 258)' }}>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center font-mono-data text-xs font-bold mb-2"
                  style={{ background: `${color.replace(')', ' / 20%)')}`, color }}
                >
                  {step}
                </div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'oklch(0.85 0.005 258)' }}>{label}</div>
                <div className="text-[11px] leading-relaxed" style={{ color: 'oklch(0.55 0.010 258)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: orders + alerts */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority orders */}
          <div
            className="rounded p-4"
            style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
                Layer 4 — Priority Orders
              </h2>
              <Link href="/orders">
                <span className="text-xs cursor-pointer" style={{ color: 'oklch(0.80 0.15 200)' }}>
                  All orders →
                </span>
              </Link>
            </div>
            <TopOrders />
          </div>

          {/* Position alerts */}
          <div
            className="rounded p-4"
            style={{ background: 'oklch(0.17 0.010 258)', border: '1px solid oklch(1 0 0 / 9%)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
                Layer 3 — Position Alerts
              </h2>
              <Link href="/positions">
                <span className="text-xs cursor-pointer" style={{ color: 'oklch(0.80 0.15 200)' }}>
                  All positions →
                </span>
              </Link>
            </div>
            <PositionAlertsSummary />
          </div>
        </div>

        {/* Last sync info */}
        {data?.last_updated && (
          <p className="text-[11px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
            Last sync: {data.last_updated}
          </p>
        )}
      </div>
    </div>
  );
}
