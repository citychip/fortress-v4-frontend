/**
 * FORTRESS V3 — Monitoring Page
 * Automated regression dashboard: runs all checks against the live VPS
 * and displays pass/fail status per category.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  CheckCircle, XCircle, AlertTriangle, Minus,
  RefreshCw, Clock, Server, Layers, Zap, Navigation, Package,
} from 'lucide-react';

// ─── Colours ──────────────────────────────────────────────────────────────────

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';
const BG     = 'oklch(0.14 0.010 258)';
const CARD   = 'oklch(0.17 0.010 258)';
const BORDER = 'oklch(1 0 0 / 9%)';

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusColor(s: CheckStatus): string {
  return s === 'pass' ? GREEN : s === 'fail' ? RED : s === 'warn' ? AMBER : DIM;
}

function StatusIcon({ status, size = 14 }: { status: CheckStatus; size?: number }) {
  const color = statusColor(status);
  const cls = `flex-shrink-0`;
  if (status === 'pass') return <CheckCircle  className={cls} style={{ width: size, height: size, color }} />;
  if (status === 'fail') return <XCircle      className={cls} style={{ width: size, height: size, color }} />;
  if (status === 'warn') return <AlertTriangle className={cls} style={{ width: size, height: size, color }} />;
  return                        <Minus         className={cls} style={{ width: size, height: size, color }} />;
}

function StatusPill({ status }: { status: CheckStatus }) {
  const color = statusColor(status);
  const label = status.toUpperCase();
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider"
      style={{ color, background: `${color}18`, border: `1px solid ${color}35` }}
    >
      {label}
    </span>
  );
}

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  deployment:     Package,
  backend:        Server,
  navigation:     Navigation,
  features:       Zap,
  infrastructure: Layers,
};

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ total, passed, failed, warned }: { total: number; passed: number; failed: number; warned: number }) {
  const health = failed === 0 ? (warned === 0 ? 'ALL CLEAR' : 'WARNINGS') : 'DEGRADED';
  const healthColor = failed === 0 ? (warned === 0 ? GREEN : AMBER) : RED;

  return (
    <div
      className="flex items-center gap-6 px-5 py-4 rounded"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      {/* Overall health */}
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: healthColor, boxShadow: `0 0 8px ${healthColor}` }}
        />
        <span className="font-mono text-sm font-bold" style={{ color: healthColor }}>{health}</span>
      </div>

      <div className="w-px h-6" style={{ background: BORDER }} />

      {/* Counts */}
      <div className="flex items-center gap-4">
        {[
          { label: 'Passed',   count: passed,        color: GREEN },
          { label: 'Failed',   count: failed,        color: RED },
          { label: 'Warnings', count: warned,        color: AMBER },
          { label: 'Total',    count: total,         color: DIM },
        ].map(({ label, count, color }) => (
          <div key={label} className="text-center">
            <div className="font-display font-bold text-xl leading-none" style={{ color }}>{count}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pass rate bar */}
      <div className="flex-1 ml-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono" style={{ color: DIM }}>Pass rate</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: BRIGHT }}>
            {total > 0 ? Math.round((passed / total) * 100) : 0}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: total > 0 ? `${(passed / total) * 100}%` : '0%',
              background: failed > 0 ? RED : warned > 0 ? AMBER : GREEN,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  ms?: number;
}

interface CheckCategory {
  id: string;
  label: string;
  checks: CheckResult[];
}

function CategoryCard({ category }: { category: CheckCategory }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = CATEGORY_ICONS[category.id] ?? Layers;
  const failed  = category.checks.filter(c => c.status === 'fail').length;
  const warned  = category.checks.filter(c => c.status === 'warn').length;
  const passed  = category.checks.filter(c => c.status === 'pass').length;
  const catStatus: CheckStatus = failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass';

  return (
    <div
      className="rounded overflow-hidden"
      style={{ background: CARD, border: `1px solid ${failed > 0 ? `${RED}35` : warned > 0 ? `${AMBER}25` : BORDER}` }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-[oklch(1_0_0_/_3%)]"
        onClick={() => setExpanded(e => !e)}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${statusColor(catStatus)}18`, border: `1px solid ${statusColor(catStatus)}35` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: statusColor(catStatus) }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-medium" style={{ color: BRIGHT }}>{category.label}</span>
            <StatusPill status={catStatus} />
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: DIM }}>
            {passed}/{category.checks.length} passed
            {failed > 0 && ` · ${failed} failed`}
            {warned > 0 && ` · ${warned} warnings`}
          </div>
        </div>
        <span className="text-xs" style={{ color: DIM }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Check rows */}
      {expanded && (
        <div className="border-t" style={{ borderColor: BORDER }}>
          {category.checks.map((check, i) => (
            <div
              key={check.id}
              className="flex items-start gap-3 px-4 py-2.5"
              style={{
                borderBottom: i < category.checks.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: check.status === 'fail' ? `${RED}08` : check.status === 'warn' ? `${AMBER}06` : 'transparent',
              }}
            >
              <StatusIcon status={check.status} size={13} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: check.status === 'fail' ? 'oklch(0.75 0.22 25)' : BRIGHT }}>
                    {check.label}
                  </span>
                  {check.ms != null && (
                    <span className="text-[9px] font-mono" style={{ color: DIM }}>{check.ms}ms</span>
                  )}
                </div>
                <p className="text-[10px] mt-0.5 break-all" style={{ color: DIM }}>{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-16 rounded animate-pulse" style={{ background: CARD }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-7 h-7 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
              <div className="h-2 w-20 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MonitoringPage({ embedded }: { embedded?: boolean }) {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = trpc.monitoring.runChecks.useQuery(
    undefined,
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const lastRun = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="min-h-screen" style={{ background: embedded ? 'transparent' : BG }}>
      {/* ── Header ── */}
      {!embedded && (
        <div
          className="sticky top-0 z-30 px-6 py-4"
          style={{
            background: 'oklch(0.12 0.010 258 / 95%)',
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl" style={{ color: BRIGHT }}>System Monitor</h1>
              <p className="text-xs mt-0.5" style={{ color: DIM }}>
                Automated regression checks — VPS deployment, backend API, navigation, sprint features
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRun && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: DIM }}>
                  <Clock className="w-3 h-3" />
                  Last run: {lastRun}
                </div>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: 'oklch(0.80 0.15 200 / 10%)',
                  border: `1px solid oklch(0.80 0.15 200 / 30%)`,
                  color: CYAN,
                  opacity: isFetching ? 0.5 : 1,
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Running…' : 'Run Checks'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-5 space-y-4">
        {/* Embedded header */}
        {embedded && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-medium" style={{ color: BRIGHT }}>System Monitor</h2>
              <p className="text-[10px] mt-0.5" style={{ color: DIM }}>
                Automated regression checks — VPS, backend, navigation, sprint features
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRun && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: DIM }}>
                  <Clock className="w-3 h-3" />
                  {lastRun}
                </div>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: 'oklch(0.80 0.15 200 / 10%)',
                  border: `1px solid oklch(0.80 0.15 200 / 30%)`,
                  color: CYAN,
                  opacity: isFetching ? 0.5 : 1,
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Running…' : 'Run Checks'}
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && <Skeleton />}

        {/* Results */}
        {data && (
          <>
            {/* Summary bar */}
            <SummaryBar
              total={data.total}
              passed={data.passed}
              failed={data.failed}
              warned={data.warned}
            />

            {/* Timestamp */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: DIM }}>
              <Clock className="w-3 h-3" />
              Checks ran at {new Date(data.startedAt).toLocaleString()}
            </div>

            {/* Category cards */}
            <div className="space-y-3">
              {data.categories.map(cat => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {!isLoading && !data && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <XCircle className="w-10 h-10" style={{ color: RED }} />
            <p className="text-sm" style={{ color: DIM }}>Failed to run checks. Check server connectivity.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded text-xs font-medium"
              style={{ background: 'oklch(0.80 0.15 200 / 10%)', border: `1px solid oklch(0.80 0.15 200 / 30%)`, color: CYAN }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
