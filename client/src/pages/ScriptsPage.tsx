/**
 * FORTRESS V2 — Script Runner Page
 * Consumes /api/run/scripts, /api/run/time_of_day, POST /api/run/{key}
 * Displays all available workflow scripts with time-of-day context and run results.
 */

import { useState } from 'react';
import { useScripts, useTimeOfDay, useScriptRunner, useRunResults, type CachedRunResult } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useConfig } from '@/contexts/ConfigContext';
import { Play, Clock, CheckCircle, XCircle, Loader2, Terminal } from 'lucide-react';
import { toast } from 'sonner';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

// Human-readable metadata for known script keys
const SCRIPT_META: Record<string, { label: string; description: string; group: string; timeOfDay?: string }> = {
  premarket_scanner:  { label: 'Premarket Scanner',    description: 'Scans all tickers for pre-market signals: IV rank, GEX walls, DP floors, regime score.', group: 'Morning', timeOfDay: 'premarket' },
  iv_crush_report:    { label: 'IV Crush Report',      description: 'Identifies tickers where IV is likely to crush post-event. Ranks by IV/HV spread.', group: 'Morning' },
  whale_flow:         { label: 'Whale Flow',           description: 'Detects large unusual options activity (whale trades) across the universe.', group: 'Intraday' },
  dark_pool_alert:    { label: 'Dark Pool Alert',      description: 'Scans for significant dark pool prints that may signal institutional positioning.', group: 'Intraday' },
  eod_review:         { label: 'EOD Review',           description: 'End-of-day portfolio review: delta exposure, concentration, DTE warnings, P&L summary.', group: 'Evening', timeOfDay: 'afterhours' },
  max_pain:           { label: 'Max Pain',             description: 'Calculates max pain level for all tickers with open options positions.', group: 'Morning' },
  entry_scoring:      { label: 'Entry Scoring',        description: 'Scores all Tier 1 candidates for entry quality using IV rank, regime, and concentration.', group: 'Morning' },
  gex_oi_report:      { label: 'GEX / OI Report',     description: 'Generates gamma exposure and open interest report for the full universe.', group: 'Morning' },
};

function timeOfDayColor(tod: string) {
  if (tod === 'premarket') return AMBER;
  if (tod === 'market') return GREEN;
  if (tod === 'afterhours') return CYAN;
  return DIM;
}

function TimeOfDayBadge({ tod, open }: { tod: string; open: boolean }) {
  const color = timeOfDayColor(tod);
  const label = tod === 'premarket' ? 'Pre-Market' : tod === 'market' ? 'Market Open' : 'After Hours';
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-mono-data font-semibold px-3 py-1.5 rounded border"
        style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
        <Clock className="w-3.5 h-3.5" />
        {label}
      </span>
      {open && (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono-data px-2 py-1 rounded"
          style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 12%)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: GREEN }} />
          LIVE
        </span>
      )}
    </div>
  );
}

function timeAgo(ts: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return '--'; }
}

function CachedRunBadge({ cached }: { cached: CachedRunResult }) {
  const ok = cached.exit_code === 0;
  const color = ok ? GREEN : RED;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono-data" style={{ color: DIM }}>
      <Clock className="w-3 h-3" style={{ color: DIM }} />
      <span style={{ color }}>
        {ok ? <CheckCircle className="w-3 h-3 inline" /> : <XCircle className="w-3 h-3 inline" />}
      </span>
      <span>{timeAgo(cached.finished_at)}</span>
      <span style={{ color: 'oklch(0.40 0.010 258)' }}>·</span>
      <span style={{ color }}>{cached.duration_seconds.toFixed(1)}s</span>
    </div>
  );
}

function ScriptCard({ scriptKey, onRun, running, result, cached }: {
  scriptKey: string;
  onRun: (key: string) => void;
  running: boolean;
  result?: unknown;
  cached?: CachedRunResult;
}) {
  const meta = SCRIPT_META[scriptKey] ?? {
    label: scriptKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: `Run the ${scriptKey} workflow script.`,
    group: 'Other',
  };

  const hasResult = result !== undefined;
  const showCached = !hasResult && cached !== undefined && !running;
  const [expanded, setExpanded] = useState(false);

  // Extract structured fields from the result object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = result as any;
  const exitCode: number | undefined = res?.exit_code;
  const duration: number | undefined = res?.duration_seconds;
  const rawStdout: string | undefined = res?.stdout ?? res?.output;
  const success = exitCode === 0;

  // Convert literal \n escape sequences (from JSON string values) to real newlines
  const stdoutLines: string[] = rawStdout
    ? rawStdout.replace(/\\n/g, '\n').split('\n')
    : [];

  // Fall back to pretty-printed JSON if no stdout field
  const fallbackStr = hasResult && !rawStdout ? JSON.stringify(result, null, 2) : null;

  return (
    <div className="rounded border overflow-hidden transition-colors"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: running ? `${CYAN}40` : hasResult ? `${GREEN}30` : showCached ? 'oklch(1 0 0 / 15%)' : 'oklch(1 0 0 / 10%)' }}>
      <div className="flex items-start justify-between gap-4 p-4">
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{meta.label}</span>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: DIM, background: 'oklch(1 0 0 / 6%)' }}>
              {meta.group}
            </span>
            {meta.timeOfDay && (
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                style={{ color: timeOfDayColor(meta.timeOfDay), background: `${timeOfDayColor(meta.timeOfDay)}15` }}>
                {meta.timeOfDay}
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: DIM }}>{meta.description}</div>
          <div className="font-mono-data text-[10px] mt-1" style={{ color: 'oklch(0.40 0.010 258)' }}>{scriptKey}</div>
          {cached && !running && !hasResult && (
            <div className="mt-2"><CachedRunBadge cached={cached} /></div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(hasResult || showCached) && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] px-2 py-1 rounded font-mono-data hover:opacity-80"
              style={{ color: hasResult ? GREEN : DIM, background: hasResult ? 'oklch(0.72 0.18 145 / 10%)' : 'oklch(1 0 0 / 5%)' }}>
              {expanded ? 'Hide' : showCached ? 'Last Output' : 'Result'}
            </button>
          )}
          <button
            onClick={() => onRun(scriptKey)}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ background: running ? 'oklch(0.80 0.15 200 / 20%)' : CYAN, color: running ? CYAN : 'oklch(0.13 0.010 258)' }}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>
      {expanded && (hasResult || showCached) && (
        <div className="border-t" style={{ borderColor: 'oklch(1 0 0 / 10%)' }}>
          {/* Terminal header bar */}
          <div className="flex items-center justify-between px-4 py-2" style={{ background: 'oklch(0.11 0.010 258)', borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
            <div className="flex items-center gap-2">
              <Terminal className="w-3 h-3" style={{ color: DIM }} />
              <span className="font-mono-data text-[10px]" style={{ color: DIM }}>{showCached ? 'last run output' : 'stdout'}</span>
              {(exitCode ?? cached?.exit_code) !== undefined && (
                <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{
                  color: (exitCode ?? cached?.exit_code) === 0 ? GREEN : RED,
                  background: (exitCode ?? cached?.exit_code) === 0 ? 'oklch(0.72 0.18 145 / 12%)' : 'oklch(0.65 0.22 25 / 12%)'
                }}>
                  exit {exitCode ?? cached?.exit_code}
                </span>
              )}
              {(duration ?? cached?.duration_seconds) !== undefined && (
                <span className="font-mono-data text-[10px]" style={{ color: 'oklch(0.45 0.010 258)' }}>
                  {(duration ?? cached?.duration_seconds)!.toFixed(2)}s{showCached && cached ? ` · ${timeAgo(cached.finished_at)}` : ''}
                </span>
              )}
            </div>
          </div>
          {/* Terminal body */}
          <div className="px-4 py-3 overflow-auto max-h-64" style={{ background: 'oklch(0.10 0.010 258)' }}>
            {showCached && cached ? (
              cached.stdout ? (
                <pre className="text-[11px] font-mono-data whitespace-pre-wrap leading-relaxed" style={{ color: 'oklch(0.60 0.010 258)' }}>
                  {cached.stdout.replace(/\\n/g, '\n')}
                </pre>
              ) : (
                <span className="text-[10px] font-mono-data" style={{ color: DIM }}>No output recorded</span>
              )
            ) : stdoutLines.length > 0 ? (
              <pre className="text-[11px] font-mono-data whitespace-pre-wrap leading-relaxed" style={{ color: success ? 'oklch(0.75 0.15 145)' : 'oklch(0.70 0.20 25)' }}>
                {stdoutLines.map((line, i) => (
                  <span key={i}>
                    {line.startsWith('{') || line.startsWith('[') ? (
                      <span style={{ color: CYAN }}>{line}</span>
                    ) : line.includes('ERROR') || line.includes('FAIL') ? (
                      <span style={{ color: RED }}>{line}</span>
                    ) : line.includes('\u2713') || line.includes('OK') || line.includes('saved') ? (
                      <span style={{ color: GREEN }}>{line}</span>
                    ) : line.includes('SCANNING') || line.includes('Running') ? (
                      <span style={{ color: AMBER }}>{line}</span>
                    ) : (
                      <span style={{ color: 'oklch(0.68 0.010 258)' }}>{line}</span>
                    )}
                    {'\n'}
                  </span>
                ))}
              </pre>
            ) : fallbackStr ? (
              <pre className="text-[10px] font-mono-data whitespace-pre-wrap" style={{ color: CYAN }}>
                {fallbackStr}
              </pre>
            ) : (
              <span className="text-[10px] font-mono-data" style={{ color: DIM }}>No output</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScriptsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: scriptsData, loading: scriptsLoading, error: scriptsError, refresh } = useScripts();
  const { data: todData } = useTimeOfDay();
  const { runScript, running, results, error: runError } = useScriptRunner();
  const { data: runResultsData } = useRunResults();
  const { config } = useConfig();

  const scripts = scriptsData?.scripts ?? [];

  // Morning workflow freshness
  const morningKeys = ['premarket_scanner', 'iv_crush_report', 'max_pain', 'entry_scoring', 'gex_oi_report'];
  const lastMorningRun = morningKeys
    .map(k => runResultsData?.results?.[k]?.finished_at)
    .filter(Boolean)
    .sort()
    .pop();
  const morningRanToday = lastMorningRun
    ? new Date(lastMorningRun).toDateString() === new Date().toDateString()
    : false;

  // Group scripts
  const groups: Record<string, string[]> = {};
  scripts.forEach(s => {
    const meta = SCRIPT_META[s.key];
    const group = meta?.group ?? 'Other';
    if (!groups[group]) groups[group] = [];
    groups[group].push(s.key);
  });
  const groupOrder = ['Morning', 'Intraday', 'Evening', 'Other'];

  async function handleRun(key: string) {
    try {
      await runScript(key);
      toast.success(`Script "${key}" completed`);
    } catch {
      toast.error(`Script "${key}" failed`);
    }
  }

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded && <PageHeader
        title="Script Runner"
        subtitle="Workflow automation scripts — premarket scanner, IV crush, whale flow, EOD review and more"
        lastUpdated={null}
        onRefresh={refresh}
        refreshing={scriptsLoading}
      />}
      <div className="p-6 space-y-6">

        {/* Time of day context + morning workflow status */}
        <div className="flex items-center justify-between rounded border p-4"
          style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)' }}>
          <div className="flex items-center gap-4">
            {todData && <TimeOfDayBadge tod={todData.time_of_day} open={todData.market_open} />}
            <div className="flex items-center gap-2 text-[11px] font-mono-data" style={{ color: DIM }}>
              <span className="w-2 h-2 rounded-full inline-block"
                style={{ background: morningRanToday ? GREEN : 'oklch(0.40 0.010 258)' }} />
              {lastMorningRun
                ? <span>Morning workflow last ran <span style={{ color: morningRanToday ? GREEN : AMBER }}>{timeAgo(lastMorningRun)}</span></span>
                : <span style={{ color: 'oklch(0.40 0.010 258)' }}>Morning workflow not yet run today</span>
              }
            </div>
          </div>
          {runResultsData?.last_updated && (
            <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.40 0.010 258)' }}>
              Cache updated {timeAgo(runResultsData.last_updated)}
            </span>
          )}
        </div>

        {runError && (
          <div className="flex items-center gap-2 text-xs p-3 rounded border" style={{ color: RED, borderColor: 'oklch(0.65 0.22 25 / 30%)', background: 'oklch(0.65 0.22 25 / 10%)' }}>
            <XCircle className="w-4 h-4 flex-shrink-0" /> {runError}
          </div>
        )}

        {scriptsError && !scriptsLoading && <EmptyState type="error" title="Failed to load scripts" description={scriptsError} />}
        {scriptsLoading && !scriptsData && <EmptyState type="loading" title="Loading scripts…" />}
        {!config.apiToken && !scriptsLoading && <EmptyState type="no-config" title="API token required" description="Configure your token in Settings." />}

        {!scriptsLoading && scripts.length === 0 && scriptsData && (
          <EmptyState type="empty" title="No scripts available" description="The server has no registered workflow scripts." />
        )}

        {groupOrder.map(group => {
          const keys = groups[group];
          if (!keys || keys.length === 0) return null;
          return (
            <section key={group} className="space-y-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: DIM }}>
                {group} Scripts
              </h2>
              <div className="space-y-2">
                {keys.map(key => (
                  <ScriptCard
                    key={key}
                    scriptKey={key}
                    onRun={handleRun}
                    running={running === key}
                    result={results[key]}
                    cached={runResultsData?.results?.[key]}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
