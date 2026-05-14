/**
 * FORTRESS V2 — P&L Page
 * Obsidian Edge design: dark theme, teal/amber/red accent palette.
 *
 * Shows:
 *   - Period selector: Daily / Weekly / Monthly
 *   - Summary stat cards: Total Net, Realised, Unrealised, Win Rate
 *   - Stacked bar chart: Realised + Unrealised per period with cumulative line overlay
 *   - Breakdown by Ticker: horizontal bar chart + table
 *   - Breakdown by Strategy: horizontal bar chart + table
 *
 * API endpoint: GET /api/pnl?period=daily|weekly|monthly
 * All data from configurable API — nothing hardcoded.
 */

import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  BarChart,
  Legend,
} from 'recharts';
import { usePnL, formatDollar, type PnLByTicker, type PnLByStrategy } from '@/hooks/useApi';
import { useConfig } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C_REALISED  = 'oklch(0.72 0.18 145)';   // teal-green
const C_UNREALISED = 'oklch(0.80 0.15 200)';  // cyan
const C_CUMULATIVE = 'oklch(0.78 0.18 85)';   // amber
const C_NEGATIVE  = 'oklch(0.65 0.22 25)';    // red-orange
const C_GRID      = 'oklch(1 0 0 / 6%)';
const C_AXIS      = 'oklch(0.50 0.010 258)';
const C_BG_CARD   = 'oklch(0.17 0.010 258)';
const C_BG_ROW    = 'oklch(0.22 0.010 258)';
const C_BORDER    = 'oklch(1 0 0 / 9%)';

// ─── Period selector ──────────────────────────────────────────────────────────

type Period = 'daily' | 'weekly' | 'monthly';

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: { key: Period; label: string }[] = [
    { key: 'daily',   label: 'Daily' },
    { key: 'weekly',  label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];
  return (
    <div className="flex gap-1 rounded border p-0.5" style={{ borderColor: C_BORDER, background: 'oklch(0.15 0.010 258)' }}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-4 py-1.5 rounded text-xs font-semibold transition-all',
            period === key ? '' : 'hover:bg-[oklch(1_0_0_/_5%)]',
          )}
          style={period === key ? {
            background: 'oklch(0.80 0.15 200 / 15%)',
            color: 'oklch(0.80 0.15 200)',
            border: '1px solid oklch(0.80 0.15 200 / 30%)',
          } : { color: 'oklch(0.60 0.010 258)' }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function PnLTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const realised   = payload.find((p: any) => p.dataKey === 'realised')?.value ?? 0;
  const unrealised = payload.find((p: any) => p.dataKey === 'unrealised')?.value ?? 0;
  const cumulative = payload.find((p: any) => p.dataKey === 'cumulative')?.value ?? null;
  const total = realised + unrealised;

  return (
    <div
      className="rounded border p-3 text-xs space-y-1.5 shadow-xl"
      style={{ background: 'oklch(0.20 0.010 258)', borderColor: C_BORDER, minWidth: 160 }}
    >
      <div className="font-semibold mb-2" style={{ color: 'oklch(0.85 0.005 258)' }}>{label}</div>
      <div className="flex justify-between gap-4">
        <span style={{ color: C_AXIS }}>Realised</span>
        <span className="font-mono-data" style={{ color: realised >= 0 ? C_REALISED : C_NEGATIVE }}>
          {realised >= 0 ? '+' : ''}{formatDollar(realised)}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: C_AXIS }}>Unrealised</span>
        <span className="font-mono-data" style={{ color: unrealised >= 0 ? C_UNREALISED : C_NEGATIVE }}>
          {unrealised >= 0 ? '+' : ''}{formatDollar(unrealised)}
        </span>
      </div>
      <div className="border-t pt-1.5 flex justify-between gap-4" style={{ borderColor: C_BORDER }}>
        <span className="font-semibold" style={{ color: 'oklch(0.75 0.010 258)' }}>Net</span>
        <span className="font-mono-data font-bold" style={{ color: total >= 0 ? C_REALISED : C_NEGATIVE }}>
          {total >= 0 ? '+' : ''}{formatDollar(total)}
        </span>
      </div>
      {cumulative !== null && (
        <div className="flex justify-between gap-4">
          <span style={{ color: C_AXIS }}>Cumulative</span>
          <span className="font-mono-data" style={{ color: C_CUMULATIVE }}>
            {cumulative >= 0 ? '+' : ''}{formatDollar(cumulative)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main P&L chart ───────────────────────────────────────────────────────────

function PnLChart({ series, period }: { series: any[]; period: Period }) {
  const formatDate = (d: string) => {
    const date = new Date(d);
    if (period === 'monthly') return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (period === 'weekly')  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatY = (v: number) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  };

  return (
    <div
      className="rounded border p-4"
      style={{ background: C_BG_CARD, borderColor: C_BORDER }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
            P&L Over Time
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C_AXIS }}>
            Bars = Realised + Unrealised · Line = Cumulative
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          {[
            { color: C_REALISED,   label: 'Realised' },
            { color: C_UNREALISED, label: 'Unrealised' },
            { color: C_CUMULATIVE, label: 'Cumulative' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm" style={{ background: color }} />
              <span style={{ color: C_AXIS }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: C_AXIS, fontSize: 11 }}
            axisLine={{ stroke: C_GRID }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatY}
            tick={{ fill: C_AXIS, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<PnLTooltip />} cursor={{ fill: 'oklch(1 0 0 / 4%)' }} />
          <ReferenceLine y={0} stroke="oklch(1 0 0 / 20%)" strokeDasharray="4 2" />
          <Bar dataKey="realised" stackId="pnl" fill={C_REALISED} radius={[0, 0, 0, 0]} maxBarSize={40}>
            {series.map((entry, i) => (
              <Cell key={i} fill={entry.realised < 0 ? C_NEGATIVE : C_REALISED} fillOpacity={0.85} />
            ))}
          </Bar>
          <Bar dataKey="unrealised" stackId="pnl" fill={C_UNREALISED} radius={[3, 3, 0, 0]} maxBarSize={40}>
            {series.map((entry, i) => (
              <Cell key={i} fill={entry.unrealised < 0 ? 'oklch(0.65 0.22 25 / 60%)' : C_UNREALISED} fillOpacity={0.7} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke={C_CUMULATIVE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: C_CUMULATIVE }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ticker breakdown ─────────────────────────────────────────────────────────

const TICKER_COLORS = [
  'oklch(0.80 0.15 200)',
  'oklch(0.72 0.18 145)',
  'oklch(0.78 0.18 85)',
  'oklch(0.65 0.22 25)',
  'oklch(0.75 0.15 280)',
  'oklch(0.70 0.18 60)',
  'oklch(0.68 0.20 320)',
  'oklch(0.73 0.16 180)',
];

function TickerBreakdown({ data }: { data: PnLByTicker[] }) {
  const sorted = [...data].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const maxAbs = Math.max(...sorted.map(d => Math.abs(d.total)), 1);

  return (
    <div className="rounded border p-4 space-y-4" style={{ background: C_BG_CARD, borderColor: C_BORDER }}>
      <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
        P&L by Ticker
      </h2>

      <div className="space-y-2">
        {sorted.map((item, i) => {
          const color = TICKER_COLORS[i % TICKER_COLORS.length];
          const barPct = (Math.abs(item.total) / maxAbs) * 100;
          const isPositive = item.total >= 0;

          return (
            <div key={item.ticker} className="rounded p-3" style={{ background: C_BG_ROW }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
                    {item.ticker}
                  </span>
                  {item.pct_of_net_liq !== undefined && (
                    <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color.replace(')', ' / 15%)')}`, color }}>
                      {item.pct_of_net_liq.toFixed(1)}% NL
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 font-mono-data text-xs" style={{ color: isPositive ? C_REALISED : C_NEGATIVE }}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{formatDollar(item.total)}
                </div>
              </div>

              {/* Bar */}
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'oklch(1 0 0 / 8%)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barPct}%`, background: isPositive ? color : C_NEGATIVE }}
                />
              </div>

              {/* Realised / Unrealised split */}
              <div className="flex gap-4 text-[11px]">
                <span style={{ color: C_AXIS }}>
                  Realised: <span className="font-mono-data" style={{ color: item.realised >= 0 ? C_REALISED : C_NEGATIVE }}>
                    {item.realised >= 0 ? '+' : ''}{formatDollar(item.realised)}
                  </span>
                </span>
                <span style={{ color: C_AXIS }}>
                  Unrealised: <span className="font-mono-data" style={{ color: item.unrealised >= 0 ? C_UNREALISED : C_NEGATIVE }}>
                    {item.unrealised >= 0 ? '+' : ''}{formatDollar(item.unrealised)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Strategy breakdown ───────────────────────────────────────────────────────

const STRATEGY_COLORS = [
  'oklch(0.80 0.15 200)',
  'oklch(0.72 0.18 145)',
  'oklch(0.78 0.18 85)',
  'oklch(0.65 0.22 25)',
  'oklch(0.75 0.15 280)',
];

function StrategyBreakdown({ data }: { data: PnLByStrategy[] }) {
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const chartData = sorted.map((s, i) => ({
    name: s.strategy,
    realised: s.realised,
    unrealised: s.unrealised,
    color: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
  }));

  return (
    <div className="rounded border p-4 space-y-4" style={{ background: C_BG_CARD, borderColor: C_BORDER }}>
      <h2 className="font-display text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>
        P&L by Strategy
      </h2>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: C_AXIS, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'oklch(0.75 0.005 258)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value >= 0 ? '+' : ''}${formatDollar(value)}`,
              name === 'realised' ? 'Realised' : 'Unrealised',
            ]}
            contentStyle={{
              background: 'oklch(0.20 0.010 258)',
              border: `1px solid ${C_BORDER}`,
              borderRadius: 4,
              fontSize: 11,
              color: 'oklch(0.85 0.005 258)',
            }}
          />
          <ReferenceLine x={0} stroke="oklch(1 0 0 / 20%)" />
          <Bar dataKey="realised" stackId="s" fill={C_REALISED} fillOpacity={0.85} radius={[0, 0, 0, 0]} />
          <Bar dataKey="unrealised" stackId="s" fill={C_UNREALISED} fillOpacity={0.7} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="space-y-1.5">
        {sorted.map((item, i) => {
          const color = STRATEGY_COLORS[i % STRATEGY_COLORS.length];
          return (
            <div key={item.strategy} className="flex items-center justify-between rounded px-3 py-2" style={{ background: C_BG_ROW }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color: 'oklch(0.85 0.005 258)' }}>{item.strategy}</span>
              </div>
              <div className="flex gap-4 text-[11px] font-mono-data">
                <span style={{ color: item.realised >= 0 ? C_REALISED : C_NEGATIVE }}>
                  R: {item.realised >= 0 ? '+' : ''}{formatDollar(item.realised)}
                </span>
                <span style={{ color: item.unrealised >= 0 ? C_UNREALISED : C_NEGATIVE }}>
                  U: {item.unrealised >= 0 ? '+' : ''}{formatDollar(item.unrealised)}
                </span>
                <span className="font-bold" style={{ color: item.total >= 0 ? C_REALISED : C_NEGATIVE }}>
                  {item.total >= 0 ? '+' : ''}{formatDollar(item.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Win rate badge ───────────────────────────────────────────────────────────

function WinRateBadge({ rate, period }: { rate: number; period: Period }) {
  const color = rate >= 60 ? C_REALISED : rate >= 40 ? C_CUMULATIVE : C_NEGATIVE;
  const label = period === 'daily' ? 'days' : period === 'weekly' ? 'weeks' : 'months';
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-data"
        style={{ background: `${color.replace(')', ' / 15%)')}`, color, border: `1px solid ${color.replace(')', ' / 30%)')}` }}
      >
        {rate.toFixed(0)}%
      </div>
      <span className="text-[11px]" style={{ color: C_AXIS }}>positive {label}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PnLPage() {
  const [period, setPeriod] = useState<Period>('daily');
  const { data, loading, error, refresh, lastUpdated } = usePnL(period);
  const { config } = useConfig();

  // Enrich series with cumulative if not provided by API
  const enrichedSeries = useMemo(() => {
    if (!data?.series) return [];
    let cum = 0;
    return data.series.map(pt => {
      cum += pt.total;
      return {
        ...pt,
        cumulative: pt.cumulative ?? cum,
      };
    });
  }, [data]);

  const totalNet = data?.total_net ?? 0;
  const totalRealised = data?.total_realised ?? 0;
  const totalUnrealised = data?.total_unrealised ?? 0;
  const winRate = data?.win_rate;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="P&L"
        subtitle="Realised vs unrealised profit & loss — broken down by period, ticker, and strategy"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      >
        <PeriodSelector period={period} onChange={setPeriod} />
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* No config state */}
        {!config.apiToken && !loading && (
          <EmptyState
            type="no-config"
            title="API token required"
            description="Configure your API URL and token in Settings to load P&L data."
          />
        )}
        {config.apiToken && error && !loading && (
          <EmptyState type="error" title="Failed to load P&L data" description={error} />
        )}

        {/* Summary stat cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Total Net P&L"
            value={data ? formatDollar(totalNet) : '—'}
            subValue={period === 'daily' ? 'this period' : `this ${period.replace('ly', '')}`}
            signal={totalNet > 0 ? 'green' : totalNet < 0 ? 'red' : 'default'}
            loading={loading}
          />
          <StatCard
            label="Realised P&L"
            value={data ? formatDollar(totalRealised) : '—'}
            subValue="closed positions"
            signal={totalRealised > 0 ? 'green' : totalRealised < 0 ? 'red' : 'default'}
            loading={loading}
          />
          <StatCard
            label="Unrealised P&L"
            value={data ? formatDollar(totalUnrealised) : '—'}
            subValue="open positions"
            signal={totalUnrealised > 0 ? 'cyan' : totalUnrealised < 0 ? 'amber' : 'default'}
            loading={loading}
          />
          <div
            className="rounded border p-4 flex flex-col justify-between"
            style={{ background: C_BG_CARD, borderColor: C_BORDER }}
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: C_AXIS }}>
              Win Rate
            </div>
            {winRate !== undefined && data ? (
              <WinRateBadge rate={winRate} period={period} />
            ) : (
              <div className="font-mono-data text-lg" style={{ color: 'oklch(0.50 0.010 258)' }}>
                {loading ? <span className="animate-pulse">…</span> : '—'}
              </div>
            )}
            {data?.best_day && (
              <div className="text-[10px] mt-2" style={{ color: C_AXIS }}>
                Best: <span className="font-mono-data" style={{ color: C_REALISED }}>+{formatDollar(data.best_day.total)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main chart — only show when data is available */}
        {enrichedSeries.length > 0 && (
          <PnLChart series={enrichedSeries} period={period} />
        )}

        {/* Empty chart placeholder when no data */}
        {enrichedSeries.length === 0 && !loading && config.apiToken && !error && (
          <div
            className="rounded border p-10 text-center"
            style={{ background: C_BG_CARD, borderColor: C_BORDER }}
          >
            <div className="text-sm" style={{ color: 'oklch(0.50 0.010 258)' }}>
              No P&L data available for this period
            </div>
          </div>
        )}

        {/* Breakdown row */}
        {data && (data.by_ticker.length > 0 || data.by_strategy.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {data.by_ticker.length > 0 && (
              <TickerBreakdown data={data.by_ticker} />
            )}
            {data.by_strategy.length > 0 && (
              <StrategyBreakdown data={data.by_strategy} />
            )}
          </div>
        )}

        {/* Best / worst day callout */}
        {data && (data.best_day || data.worst_day) && (
          <div className="grid grid-cols-2 gap-4">
            {data.best_day && (
              <div
                className="rounded border p-4"
                style={{ background: 'oklch(0.72 0.18 145 / 8%)', borderColor: 'oklch(0.72 0.18 145 / 25%)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" style={{ color: C_REALISED }} />
                  <span className="text-xs font-semibold" style={{ color: C_REALISED }}>Best Period</span>
                </div>
                <div className="font-mono-data text-lg font-bold" style={{ color: C_REALISED }}>
                  +{formatDollar(data.best_day.total)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: C_AXIS }}>
                  {new Date(data.best_day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            )}
            {data.worst_day && (
              <div
                className="rounded border p-4"
                style={{ background: 'oklch(0.65 0.22 25 / 8%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4" style={{ color: C_NEGATIVE }} />
                  <span className="text-xs font-semibold" style={{ color: C_NEGATIVE }}>Worst Period</span>
                </div>
                <div className="font-mono-data text-lg font-bold" style={{ color: C_NEGATIVE }}>
                  {formatDollar(data.worst_day.total)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: C_AXIS }}>
                  {new Date(data.worst_day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* API endpoint note */}
        <div
          className="rounded p-3 text-[11px]"
          style={{ background: 'oklch(0.17 0.010 258)', border: `1px solid ${C_BORDER}` }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.65 0.010 258)' }}>API endpoint: </span>
          <span className="font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
            GET {config.apiUrl || '<API URL>'}/api/pnl?period={period}
          </span>
          <span className="ml-2" style={{ color: 'oklch(0.50 0.010 258)' }}>
            — Returns <code>PnLSummary</code> with <code>series</code>, <code>by_ticker</code>, <code>by_strategy</code> fields
          </span>
        </div>
      </div>
    </div>
  );
}
