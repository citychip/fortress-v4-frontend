/**
 * FORTRESS V2 — VolAnalyticsPanel
 * Three-panel volatility analytics view:
 *   1. IV Skew chart (moneyness vs IV%, calls/puts coloured separately)
 *   2. Term Structure chart (DTE vs ATM IV%)
 *   3. ATM IV Ladder table (per-expiry call/put/avg/spread)
 *
 * Data source: /api/options/vol-analytics?ticker=<ticker>
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useVolAnalytics } from '@/hooks/useApi';
import { Loader2, TrendingUp, BarChart2, Table2 } from 'lucide-react';

interface Props {
  ticker: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(2) + '%';
}

// ─── Sub-panel: IV Skew ───────────────────────────────────────────────────────

function IvSkewChart({ ticker }: Props) {
  const { data, loading, error } = useVolAnalytics(ticker);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error ?? 'No data'} />;
  if (!data.skew || data.skew.length === 0)
    return <EmptyState msg="No skew data available for this ticker." />;

  // Split into calls and puts for separate series
  const calls = data.skew.filter((p) => p.type === 'call').map((p) => ({
    moneyness: p.moneyness,
    callIv: p.iv,
    strike: p.strike,
  }));
  const puts = data.skew.filter((p) => p.type === 'put').map((p) => ({
    moneyness: p.moneyness,
    putIv: p.iv,
    strike: p.strike,
  }));

  // Merge into single array keyed by moneyness
  const byMoneyness: Record<string, { moneyness: number; callIv?: number; putIv?: number; strike?: number }> = {};
  for (const c of calls) {
    const k = c.moneyness.toString();
    byMoneyness[k] = { ...byMoneyness[k], moneyness: c.moneyness, callIv: c.callIv, strike: c.strike };
  }
  for (const p of puts) {
    const k = p.moneyness.toString();
    byMoneyness[k] = { ...byMoneyness[k], moneyness: p.moneyness, putIv: p.putIv };
  }
  const chartData = Object.values(byMoneyness).sort((a, b) => a.moneyness - b.moneyness);

  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">
        Expiry: <span className="text-gray-200">{data.skew_expiry ?? '—'}</span>
        &nbsp;·&nbsp;Spot: <span className="text-gray-200">${data.spot.toFixed(2)}</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="moneyness"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{ value: 'Moneyness (Strike / Spot)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={44}
          />
          <Tooltip
            formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name === 'callIv' ? 'Call IV' : 'Put IV']}
            labelFormatter={(m: number) => `Moneyness: ${(m * 100).toFixed(1)}%`}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          />
          <Legend formatter={(v) => v === 'callIv' ? 'Call IV' : 'Put IV'} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine x={1} stroke="#6b7280" strokeDasharray="4 4" label={{ value: 'ATM', fill: '#6b7280', fontSize: 11 }} />
          <Line type="monotone" dataKey="callIv" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="putIv" stroke="#f87171" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sub-panel: Term Structure ────────────────────────────────────────────────

function TermStructureChart({ ticker }: Props) {
  const { data, loading, error } = useVolAnalytics(ticker);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error ?? 'No data'} />;
  if (!data.term_structure || data.term_structure.length === 0)
    return <EmptyState msg="No term structure data available." />;

  const chartData = data.term_structure.map((p) => ({ dte: p.dte, atm_iv: p.atm_iv, expiry: p.expiry }));

  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">
        Spot: <span className="text-gray-200">${data.spot.toFixed(2)}</span>
        &nbsp;·&nbsp;{data.term_structure.length} expiries
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="dte"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            label={{ value: 'DTE', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={44}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(2)}%`, 'ATM IV']}
            labelFormatter={(dte: number) => {
              const row = chartData.find((r) => r.dte === dte);
              return `DTE: ${dte} (${row?.expiry ?? ''})`;
            }}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="atm_iv" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Sub-panel: ATM IV Ladder ─────────────────────────────────────────────────

function AtmIvLadder({ ticker }: Props) {
  const { data, loading, error } = useVolAnalytics(ticker);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error ?? 'No data'} />;
  if (!data.atm_ladder || data.atm_ladder.length === 0)
    return <EmptyState msg="No ATM IV ladder data available." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="py-2 pr-3 font-medium">Expiry</th>
            <th className="py-2 pr-3 font-medium text-right">DTE</th>
            <th className="py-2 pr-3 font-medium text-right">ATM Strike</th>
            <th className="py-2 pr-3 font-medium text-right">Call IV</th>
            <th className="py-2 pr-3 font-medium text-right">Put IV</th>
            <th className="py-2 pr-3 font-medium text-right">Avg IV</th>
            <th className="py-2 font-medium text-right">Spread</th>
          </tr>
        </thead>
        <tbody>
          {data.atm_ladder.map((row) => {
            const spreadColor =
              row.iv_spread == null ? 'text-gray-400'
              : row.iv_spread > 3 ? 'text-amber-400'
              : row.iv_spread > 1.5 ? 'text-yellow-300'
              : 'text-gray-300';
            return (
              <tr key={row.expiry} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                <td className="py-1.5 pr-3 text-gray-200 font-mono">{row.expiry}</td>
                <td className="py-1.5 pr-3 text-right text-gray-300">{row.dte}</td>
                <td className="py-1.5 pr-3 text-right text-gray-300">${row.atm_strike}</td>
                <td className="py-1.5 pr-3 text-right text-emerald-400">{fmt2(row.call_iv)}</td>
                <td className="py-1.5 pr-3 text-right text-red-400">{fmt2(row.put_iv)}</td>
                <td className="py-1.5 pr-3 text-right text-blue-300">{fmt2(row.avg_iv)}</td>
                <td className={`py-1.5 text-right ${spreadColor}`}>{fmt2(row.iv_spread)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-32 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">Loading vol data…</span>
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-red-400 text-sm">
      {msg}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
      {msg}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type SubTab = 'skew' | 'term' | 'ladder';

export default function VolAnalyticsPanel({ ticker }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('skew');

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'skew',   label: 'IV Skew',       icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'term',   label: 'Term Structure', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'ladder', label: 'ATM Ladder',     icon: <Table2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              subTab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'skew'   && <IvSkewChart ticker={ticker} />}
      {subTab === 'term'   && <TermStructureChart ticker={ticker} />}
      {subTab === 'ladder' && <AtmIvLadder ticker={ticker} />}
    </div>
  );
}
