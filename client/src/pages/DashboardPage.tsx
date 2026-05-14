/**
 * FORTRESS V2 — Dashboard Page
 * Layer 1 entry point: Account health + Macro Regime Gate + Top priority orders + Position alerts.
 * All data from /api/briefing, /api/manage/stop_loss_all, /api/manage/roll_all.
 */

import {
  useBriefing, useStopLossAll, useRollAll, useAlerts,
  formatDollar, regimeInfo,
  type BriefingData,
} from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { Link } from 'wouter';
import { ArrowRight, AlertTriangle, TrendingUp, BookOpen, Crosshair, DollarSign } from 'lucide-react';

// ─── Regime badge ─────────────────────────────────────────────────────────────

function RegimePill({ regime }: { regime: string }) {
  const { label, color } = regimeInfo(regime);
  const colorMap = {
    red: { bg: 'oklch(0.65 0.22 25 / 15%)', border: 'oklch(0.65 0.22 25 / 40%)', text: 'oklch(0.75 0.22 25)' },
    amber: { bg: 'oklch(0.78 0.18 85 / 15%)', border: 'oklch(0.78 0.18 85 / 40%)', text: 'oklch(0.85 0.18 85)' },
    green: { bg: 'oklch(0.72 0.18 145 / 15%)', border: 'oklch(0.72 0.18 145 / 40%)', text: 'oklch(0.80 0.18 145)' },
    cyan: { bg: 'oklch(0.80 0.15 200 / 15%)', border: 'oklch(0.80 0.15 200 / 40%)', text: 'oklch(0.85 0.15 200)' },
  };
  const c = colorMap[color];
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono-data"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {label}
    </span>
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
  const intel = (data as BriefingData & { market_intelligence?: { regime?: { dp_floor?: number; net_drift?: number; gex_call_wall?: number } } })?.market_intelligence;

  return (
    <div className="space-y-4">
      {/* Account metrics */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Net Liquidation"
          value={account ? formatDollar(account.net_liq) : '—'}
          signal="cyan"
          loading={loading}
        />
        <StatCard
          label="Excess Liquidity"
          value={account ? formatDollar(account.excess_liq) : '—'}
          signal={account && !account.thresholds.excess_liq_ok ? 'amber' : 'default'}
          loading={loading}
        />
        <StatCard
          label="Available Funds"
          value={account ? formatDollar(account.available_funds) : '—'}
          signal={account && !account.thresholds.available_funds_ok ? 'red' : 'default'}
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
          {macro && <RegimePill regime={macro.regime} />}
          {loading && (
            <div className="h-7 w-40 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
          )}
        </div>

        {macro && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                VIX
              </div>
              <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>
                {macro.vix !== null ? macro.vix.toFixed(2) : '—'}
              </div>
            </div>
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                VIX State
              </div>
              <div className="font-mono-data text-sm" style={{ color: 'oklch(0.80 0.15 200)' }}>
                {macro.vix_state ?? '—'}
              </div>
            </div>
            <div className="rounded p-2.5" style={{ background: 'oklch(0.22 0.010 258)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Regime
              </div>
              <div className="font-mono-data text-sm capitalize" style={{ color: 'oklch(0.80 0.15 200)' }}>
                {macro.regime}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs mt-2" style={{ color: 'oklch(0.65 0.22 25)' }}>
            Error: {error}
          </p>
        )}
      </div>

      {/* Concentration warning */}
      {data?.concentration?.msft_warning && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded border text-xs"
          style={{ background: 'oklch(0.78 0.18 85 / 10%)', borderColor: 'oklch(0.78 0.18 85 / 30%)', color: 'oklch(0.85 0.18 85)' }}
        >
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
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
        ))}
      </div>
    );
  }

  // Build priority order list from stop-loss ACT + roll URGENT/SOON
  const urgentItems: { ticker: string; label: string; reason: string; urgency: 'URGENT' | 'SOON' | 'WATCH' }[] = [];

  stopData?.positions
    .filter(p => p.verdict === 'ACT')
    .forEach(p => urgentItems.push({
      ticker: p.ticker,
      label: `STOP-LOSS ${p.ticker} ${p.strategy}`,
      reason: p.recommended_action,
      urgency: 'URGENT',
    }));

  rollData?.positions
    .filter(p => p.roll_needed && p.urgency === 'URGENT')
    .forEach(p => urgentItems.push({
      ticker: p.ticker,
      label: `ROLL ${p.ticker} ${p.strategy} ${p.short_strike}`,
      reason: p.reasons.join('; ') || `${p.current_dte}d to expiry`,
      urgency: 'URGENT',
    }));

  rollData?.positions
    .filter(p => p.roll_needed && p.urgency === 'SOON')
    .forEach(p => urgentItems.push({
      ticker: p.ticker,
      label: `ROLL ${p.ticker} ${p.strategy} ${p.short_strike}`,
      reason: p.reasons.join('; ') || `${p.current_dte}d to expiry`,
      urgency: 'SOON',
    }));

  // Also include active alerts
  alertData?.alerts
    .filter(a => !a.snoozed)
    .slice(0, 2)
    .forEach(a => urgentItems.push({
      ticker: a.ticker,
      label: a.ticker,
      reason: a.message,
      urgency: 'WATCH',
    }));

  const displayed = urgentItems.slice(0, 5);

  if (!displayed.length) {
    return (
      <div className="py-8 text-center" style={{ color: 'oklch(0.55 0.010 258)' }}>
        <div className="text-sm">No priority orders</div>
        <div className="text-xs mt-1">All positions within thresholds</div>
      </div>
    );
  }

  const urgencyColor = {
    URGENT: 'oklch(0.65 0.22 25)',
    SOON: 'oklch(0.78 0.18 85)',
    WATCH: 'oklch(0.80 0.15 200)',
  };

  return (
    <div className="space-y-2">
      {displayed.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded border"
          style={{
            background: 'oklch(0.17 0.010 258)',
            borderColor: `${urgencyColor[item.urgency]} / 30%`,
          }}
        >
          <span
            className="text-[10px] font-bold font-mono-data px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
            style={{ background: `${urgencyColor[item.urgency]}20`, color: urgencyColor[item.urgency] }}
          >
            {item.urgency}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-mono-data text-sm font-semibold truncate" style={{ color: 'oklch(0.93 0.005 258)' }}>
              {item.label}
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.58 0.010 258)' }}>
              {item.reason}
            </p>
          </div>
        </div>
      ))}
      {urgentItems.length > 5 && (
        <Link href="/orders">
          <div
            className="flex items-center justify-center gap-1.5 py-2 rounded text-xs border transition-all hover:bg-[oklch(0.80_0.15_200_/_8%)] cursor-pointer"
            style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 20%)' }}
          >
            View all {urgentItems.length} orders
            <ArrowRight className="w-3.5 h-3.5" />
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
        {[1, 2].map(i => (
          <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
        ))}
      </div>
    );
  }

  const alerts = alertData?.alerts.filter(a => !a.snoozed) ?? [];
  const stopLossAct = stopData?.positions.filter(p => p.verdict === 'ACT') ?? [];

  if (!alerts.length && !stopLossAct.length) {
    return (
      <div className="py-6 text-center" style={{ color: 'oklch(0.55 0.010 258)' }}>
        <div className="text-sm">No position alerts</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {stopLossAct.slice(0, 2).map((p, i) => (
        <div
          key={`sl-${i}`}
          className="flex items-center gap-2.5 px-3 py-2 rounded border"
          style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
          <span className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
            {p.ticker} {p.strategy}
          </span>
          <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.010 258)' }}>
            {p.recommended_action}
          </span>
        </div>
      ))}
      {alerts.slice(0, 4 - Math.min(stopLossAct.length, 2)).map((a, i) => (
        <div
          key={`al-${i}`}
          className="flex items-center gap-2.5 px-3 py-2 rounded border"
          style={{
            background: a.severity === 'critical' ? 'oklch(0.65 0.22 25 / 8%)' : 'oklch(0.78 0.18 85 / 8%)',
            borderColor: a.severity === 'critical' ? 'oklch(0.65 0.22 25 / 25%)' : 'oklch(0.78 0.18 85 / 25%)',
          }}
        >
          <AlertTriangle
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: a.severity === 'critical' ? 'oklch(0.65 0.22 25)' : 'oklch(0.78 0.18 85)' }}
          />
          <span className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.93 0.005 258)' }}>
            {a.ticker}
          </span>
          <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.010 258)' }}>
            {a.message}
          </span>
        </div>
      ))}
      {(alerts.length + stopLossAct.length) > 4 && (
        <Link href="/positions">
          <div className="text-xs text-center py-1 cursor-pointer" style={{ color: 'oklch(0.80 0.15 200)' }}>
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
  const { data, loading, refresh } = useBriefing();
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Dashboard"
        subtitle="Morning workflow — Regime Gate → Position Review → Order List"
        lastUpdated={null}
        onRefresh={refresh}
        refreshing={loading}
      />
      <div className="p-6 space-y-6">
        <AccountSummarySection />
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
              { step: '1', label: 'Macro Regime Gate',    desc: 'Check SPY GEX/DP/Drift. If regime ≤ threshold → no new entries.',      color: 'oklch(0.80 0.15 200)' },
              { step: '2', label: 'Market Intelligence',  desc: 'Review per-ticker flow. Identify directional bias for each position.',  color: 'oklch(0.72 0.18 145)' },
              { step: '3', label: 'Position Review',      desc: 'Scan delta alerts, roll candidates, concentration breaches.',           color: 'oklch(0.78 0.18 85)' },
              { step: '4', label: 'Execute Orders',       desc: 'Work through URGENT → THIS WEEK → WATCH order list.',                  color: 'oklch(0.65 0.22 25)' },
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

        {data?.as_of && (
          <p className="text-[11px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>
            Data as of: {new Date(data.as_of).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
