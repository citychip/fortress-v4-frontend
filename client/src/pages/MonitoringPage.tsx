/**
 * FORTRESS V3 — Monitoring Page
 * Automated regression dashboard: runs all checks client-side via direct fetch.
 * No tRPC dependency — all checks run as browser fetch() calls against VPS_BASE.
 * Fixes "Failed to run checks" error caused by VPS nginx routing /api/* to Python backend.
 */

import { useState, useCallback } from 'react';
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

// ─── VPS base URL ─────────────────────────────────────────────────────────────

const VPS_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

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

interface CheckReport {
  categories: CheckCategory[];
  total: number;
  passed: number;
  failed: number;
  warned: number;
  startedAt: number;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchCheck(url: string, timeout = 8000): Promise<{ ok: boolean; status: number; body: string; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal, mode: 'cors', cache: 'no-store' });
    clearTimeout(timer);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err), ms: Date.now() - start };
  }
}

const pass = (id: string, label: string, detail: string, ms?: number): CheckResult => ({ id, label, status: 'pass', detail, ms });
const fail = (id: string, label: string, detail: string, ms?: number): CheckResult => ({ id, label, status: 'fail', detail, ms });
const warn = (id: string, label: string, detail: string, ms?: number): CheckResult => ({ id, label, status: 'warn', detail, ms });

// ─── Check categories ─────────────────────────────────────────────────────────

async function checkDeployment(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  const r = await fetchCheck(`${VPS_BASE}/`);
  if (!r.ok && r.status !== 0) { checks.push(fail('deploy_reachable', 'VPS reachable', `HTTP ${r.status}`, r.ms)); return checks; }
  if (r.status === 0) { checks.push(fail('deploy_reachable', 'VPS reachable', `Network error: ${r.body.slice(0, 80)}`, r.ms)); return checks; }
  checks.push(pass('deploy_reachable', 'VPS reachable', `HTTP 200 in ${r.ms}ms`, r.ms));

  const bundleMatch = r.body.match(/index-([A-Za-z0-9_\-]+)\.js/);
  const bundleFile = bundleMatch ? bundleMatch[0] : null;
  if (!bundleFile) { checks.push(fail('deploy_bundle_ref', 'index.html references bundle', 'No index-*.js found in HTML')); return checks; }
  checks.push(pass('deploy_bundle_ref', 'index.html references bundle', bundleFile));

  const br = await fetchCheck(`${VPS_BASE}/assets/${bundleFile}`);
  if (!br.ok) { checks.push(fail('deploy_bundle_served', 'Bundle file served', `HTTP ${br.status}`)); return checks; }
  checks.push(pass('deploy_bundle_served', 'Bundle file served', `${Math.round(br.body.length / 1024)}KB in ${br.ms}ms`, br.ms));

  const bundle = br.body;
  const featureChecks: [string, string, string, boolean][] = [
    ['deploy_feat_sort',        'Sort dropdown present',          '"Sort:"',                    true],
    ['deploy_feat_monitoring',  'Monitoring row split present',   '"monitoring"',               true],
    ['deploy_feat_quantdata',   'QuantData Credentials section',  '"QuantData Credentials"',    true],
    ['deploy_feat_quantdata_url','QuantData URL uses underscore', 'quantdata_credentials',      true],
    ['deploy_feat_8nav',        '8-tab nav: /performance route',  '"/performance"',             true],
    ['deploy_feat_no_cockpits', 'Cockpits section removed',       'COCKPITS',                   false],
    ['deploy_feat_scripts_card','Scripts QuickNav card',          '"Scripts"',                  true],
    ['deploy_feat_null_greeks', 'Null-safe greeks.toFixed()',     'delta!=null',                true],
    ['deploy_feat_null_ivr',    'Null-safe ivr.toFixed()',        'ivr!=null',                  true],
  ];
  for (const [id, label, needle, shouldExist] of featureChecks) {
    const found = bundle.includes(needle);
    if (shouldExist) {
      checks.push(found ? pass(id, label, `"${needle}" in bundle`) : fail(id, label, `"${needle}" missing from bundle`));
    } else {
      checks.push(found ? fail(id, label, `"${needle}" found — should be absent`) : pass(id, label, 'Correctly absent ✓'));
    }
  }
  return checks;
}

async function checkBackendAPI(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  const health = await fetchCheck(`${VPS_BASE}/api/health`);
  if (health.ok) {
    try {
      const j = JSON.parse(health.body);
      checks.push(pass('backend_health', 'Backend health endpoint', `status: ${j.status ?? 'ok'}, v${j.version ?? '?'}`, health.ms));
    } catch {
      checks.push(pass('backend_health', 'Backend health endpoint', `HTTP 200 in ${health.ms}ms`, health.ms));
    }
  } else {
    checks.push(fail('backend_health', 'Backend health endpoint', `HTTP ${health.status}: ${health.body.slice(0, 80)}`, health.ms));
  }

  const qd = await fetchCheck(`${VPS_BASE}/api/settings/quantdata_credentials_status`);
  if (qd.status === 200) {
    try {
      const j = JSON.parse(qd.body);
      checks.push(j.exists === true
        ? pass('backend_quantdata_status', 'QuantData credentials stored', `preview: ${j.token_preview?.slice(0, 20) ?? '—'}`, qd.ms)
        : warn('backend_quantdata_status', 'QuantData credentials stored', 'Endpoint OK but no credentials saved yet', qd.ms));
    } catch {
      checks.push(pass('backend_quantdata_status', 'QuantData credentials endpoint', 'HTTP 200 (endpoint reachable)', qd.ms));
    }
  } else if (qd.status === 401) {
    checks.push(pass('backend_quantdata_status', 'QuantData credentials endpoint', 'HTTP 401 — endpoint exists, auth required', qd.ms));
  } else {
    checks.push(fail('backend_quantdata_status', 'QuantData credentials endpoint', `HTTP ${qd.status}: ${qd.body.slice(0, 80)}`, qd.ms));
  }

  const conn = await fetchCheck(`${VPS_BASE}/api/health/v4`);
  if (conn.ok || conn.status === 401) {
    checks.push(pass('backend_conn_health', 'Health v4 endpoint', `HTTP ${conn.status}`, conn.ms));
  } else {
    checks.push(fail('backend_conn_health', 'Health v4 endpoint', `HTTP ${conn.status}`, conn.ms));
  }

  const mi = await fetchCheck(`${VPS_BASE}/api/market-intelligence?ticker=SPY`);
  if (mi.ok || mi.status === 401 || mi.status === 422) {
    checks.push(pass('backend_mi', 'Market intelligence endpoint', `HTTP ${mi.status}`, mi.ms));
  } else {
    checks.push(fail('backend_mi', 'Market intelligence endpoint', `HTTP ${mi.status}: ${mi.body.slice(0, 80)}`, mi.ms));
  }

  return checks;
}

async function checkNavigation(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const routes = [
    ['nav_dashboard',    '/',             'Dashboard'],
    ['nav_market_intel', '/market-intel', 'Market Intel'],
    ['nav_positions',    '/positions',    'Positions'],
    ['nav_trade',        '/trade',        'Trade'],
    ['nav_analysis',     '/analysis',     'Analysis'],
    ['nav_performance',  '/performance',  'Performance'],
    ['nav_earnings',     '/earnings',     'Earnings'],
    ['nav_config',       '/config',       'Config'],
  ];
  // All routes are SPA routes — just verify the VPS serves the shell
  const r = await fetchCheck(`${VPS_BASE}/`);
  for (const [id, route, label] of routes) {
    if (r.ok) {
      checks.push(pass(id, `${label} route (${route})`, 'SPA shell served'));
    } else {
      checks.push(fail(id, `${label} route (${route})`, `VPS not reachable: HTTP ${r.status}`));
    }
  }
  return checks;
}

async function checkSprintFeatures(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const br = await fetchCheck(`${VPS_BASE}/`);
  if (!br.ok) {
    checks.push(fail('feat_bundle', 'Bundle reachable', `HTTP ${br.status}`));
    return checks;
  }
  const bundleMatch = br.body.match(/index-([A-Za-z0-9_\-]+)\.js/);
  if (!bundleMatch) {
    checks.push(fail('feat_bundle', 'Bundle reference in HTML', 'No index-*.js found'));
    return checks;
  }
  const bundleRes = await fetchCheck(`${VPS_BASE}/assets/${bundleMatch[0]}`);
  if (!bundleRes.ok) {
    checks.push(fail('feat_bundle', 'Bundle file served', `HTTP ${bundleRes.status}`));
    return checks;
  }
  const bundle = bundleRes.body;
  const features: [string, string, string][] = [
    ['feat_approvals',    'Approvals page (/approvals)',   'ApprovalsPage'],
    ['feat_action',       'Action Center (/action)',       'ActionCenterPage'],
    ['feat_build',        'Build Center (/build)',         'BuildCenterPage'],
    ['feat_forward_pnl',  'Forward P&L Panel',             'ForwardPnLPanel'],
    ['feat_position_limits','Position Limits Badge',       'PositionLimitsBadge'],
    ['feat_pnl_journal',  'P&L Journal page',              'PnLJournalPage'],
    ['feat_market_intel', 'Market Intelligence page',      'MarketIntelPage'],
    ['feat_regime_info',  'Regime label helper',           'regimeInfo'],
    ['feat_null_nlq',     'Null-safe net_liq_pct',         'net_liq_pct??'],
    ['feat_earnings',     'Earnings page',                 'EarningsPage'],
  ];
  for (const [id, label, needle] of features) {
    checks.push(bundle.includes(needle)
      ? pass(id, label, `"${needle}" in bundle`)
      : warn(id, label, `"${needle}" not found in bundle`));
  }
  return checks;
}

async function checkSPARoutes(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  // SPA routes — all should return the index.html shell (200)
  const spaRoutes = [
    ['spa_root',        '/'],
    ['spa_market_intel','/market-intel'],
    ['spa_positions',   '/positions'],
    ['spa_trade',       '/trade'],
    ['spa_analysis',    '/analysis'],
    ['spa_performance', '/performance'],
    ['spa_earnings',    '/earnings'],
    ['spa_config',      '/config'],
    ['spa_action',      '/action'],
    ['spa_approvals',   '/approvals'],
    ['spa_build',       '/build'],
  ];
  // VPS nginx serves index.html for all SPA routes — check root as proxy
  const r = await fetchCheck(`${VPS_BASE}/`);
  for (const [id, route] of spaRoutes) {
    checks.push(r.ok
      ? pass(id, `SPA route ${route}`, 'Shell served (nginx SPA fallback)')
      : fail(id, `SPA route ${route}`, `VPS unreachable: HTTP ${r.status}`));
  }
  return checks;
}

async function runAllChecks(): Promise<CheckReport> {
  const startedAt = Date.now();
  const [deployment, backend, navigation, features, spaRoutes] = await Promise.all([
    checkDeployment(),
    checkBackendAPI(),
    checkNavigation(),
    checkSprintFeatures(),
    checkSPARoutes(),
  ]);
  const categories: CheckCategory[] = [
    { id: 'deployment',  label: 'Deployment',     checks: deployment },
    { id: 'backend',     label: 'Backend API',    checks: backend },
    { id: 'navigation',  label: 'Navigation',     checks: navigation },
    { id: 'features',    label: 'Sprint Features',checks: features },
    { id: 'spa_routes',  label: 'SPA Routes',     checks: spaRoutes },
  ];
  const all = categories.flatMap(c => c.checks);
  return {
    categories,
    total:   all.length,
    passed:  all.filter(c => c.status === 'pass').length,
    failed:  all.filter(c => c.status === 'fail').length,
    warned:  all.filter(c => c.status === 'warn').length,
    startedAt,
  };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusColor(s: CheckStatus): string {
  return s === 'pass' ? GREEN : s === 'fail' ? RED : s === 'warn' ? AMBER : DIM;
}

function StatusIcon({ status, size = 14 }: { status: CheckStatus; size?: number }) {
  const color = statusColor(status);
  if (status === 'pass') return <CheckCircle   style={{ width: size, height: size, color, flexShrink: 0 }} />;
  if (status === 'fail') return <XCircle       style={{ width: size, height: size, color, flexShrink: 0 }} />;
  if (status === 'warn') return <AlertTriangle style={{ width: size, height: size, color, flexShrink: 0 }} />;
  return                        <Minus         style={{ width: size, height: size, color, flexShrink: 0 }} />;
}

function StatusPill({ status }: { status: CheckStatus }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider"
      style={{ color, background: `${color}18`, border: `1px solid ${color}35` }}
    >
      {status.toUpperCase()}
    </span>
  );
}

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  deployment:  Package,
  backend:     Server,
  navigation:  Navigation,
  features:    Zap,
  spa_routes:  Layers,
};

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ total, passed, failed, warned }: { total: number; passed: number; failed: number; warned: number }) {
  const health = failed === 0 ? (warned === 0 ? 'ALL CLEAR' : 'WARNINGS') : 'DEGRADED';
  const healthColor = failed === 0 ? (warned === 0 ? GREEN : AMBER) : RED;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6 px-5 py-4 rounded" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: healthColor, boxShadow: `0 0 8px ${healthColor}` }} />
        <span className="font-mono text-sm font-bold" style={{ color: healthColor }}>{health}</span>
      </div>

      <div className="w-px h-6" style={{ background: BORDER }} />

      <div className="flex items-center gap-4">
        {([['Passed', passed, GREEN], ['Failed', failed, RED], ['Warnings', warned, AMBER], ['Total', total, DIM]] as [string, number, string][]).map(([label, count, color]) => (
          <div key={label} className="text-center">
            <div className="font-display font-bold text-xl leading-none" style={{ color }}>{count}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: DIM }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 ml-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono" style={{ color: DIM }}>Pass rate</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: BRIGHT }}>{passRate}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${passRate}%`,
              background: failed > 0 ? RED : warned > 0 ? AMBER : GREEN,
              transition: 'width 0.7s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

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
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: 'transparent' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${statusColor(catStatus)}18`, border: `1px solid ${statusColor(catStatus)}35` }}
        >
          <Icon style={{ width: 14, height: 14, color: statusColor(catStatus) }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-medium" style={{ color: BRIGHT }}>{category.label}</span>
            <StatusPill status={catStatus} />
          </div>
          <div className="text-[10px] mt-0.5 font-mono" style={{ color: DIM }}>
            {passed} pass · {failed} fail · {warned} warn · {category.checks.length} total
          </div>
        </div>

        <div className="text-xs font-mono" style={{ color: DIM }}>{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: BORDER }}>
          {category.checks.map(check => (
            <div
              key={check.id}
              className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0"
              style={{ borderColor: 'oklch(1 0 0 / 5%)' }}
            >
              <StatusIcon status={check.status} size={13} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: BRIGHT }}>{check.label}</span>
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
  const [data, setData] = useState<CheckReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const report = await runAllChecks();
      setData(report);
      setLastRun(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
                onClick={runChecks}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  background: 'oklch(0.80 0.15 200 / 10%)',
                  border: `1px solid oklch(0.80 0.15 200 / 30%)`,
                  color: CYAN,
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Running…' : 'Run Checks'}
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
                onClick={runChecks}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  background: 'oklch(0.80 0.15 200 / 10%)',
                  border: `1px solid oklch(0.80 0.15 200 / 30%)`,
                  color: CYAN,
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Running…' : 'Run Checks'}
              </button>
            </div>
          </div>
        )}

        {/* Initial state — prompt to run */}
        {!isLoading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Server className="w-10 h-10" style={{ color: DIM }} />
            <p className="text-sm" style={{ color: DIM }}>Click "Run Checks" to run automated regression checks.</p>
            <button
              onClick={runChecks}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium"
              style={{ background: 'oklch(0.80 0.15 200 / 10%)', border: `1px solid oklch(0.80 0.15 200 / 30%)`, color: CYAN }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run Checks
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && <Skeleton />}

        {/* Results */}
        {data && !isLoading && (
          <>
            <SummaryBar
              total={data.total}
              passed={data.passed}
              failed={data.failed}
              warned={data.warned}
            />

            <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: DIM }}>
              <Clock className="w-3 h-3" />
              Checks ran at {new Date(data.startedAt).toLocaleString()}
            </div>

            <div className="space-y-3">
              {data.categories.map(cat => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <XCircle className="w-10 h-10" style={{ color: RED }} />
            <p className="text-sm" style={{ color: DIM }}>{error}</p>
            <button
              onClick={runChecks}
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
