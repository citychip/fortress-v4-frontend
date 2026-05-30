/**
 * FORTRESS V3 — Settings Page
 * ALL configuration lives here — API URL, token, ticker universe, strategy parameters.
 * Stored in localStorage via ConfigContext. Nothing is hardcoded.
 * Supports export (without token) and import for backup/restore.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useConfig, DEFAULT_CONFIG, type PrefsSaveStatus } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { useHealth, useServerSettings, useTraderPresets, useUniverse, useUniverseActions, apiFetch, type TraderPreset, type IbkrStatus } from '@/hooks/useApi';
import { toast } from 'sonner';
import {
  Save,
  RotateCcw,
  Download,
  Upload,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Server,
  Layers,
  RefreshCw,
  Shield,
  TrendingUp,
  Star,
  Ban,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CYAN, GREEN, AMBER, RED, DIM, BRIGHT, CARD, BORDER, BG, MUTED, PURPLE, ACCENT, CARD2, CARD3, FAINT, CYAN_BG, GREEN_BG, RED_BG, AMBER_BG } from '@/lib/theme';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded border p-5"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}
    >
      <div className="mb-4">
        <h2 className="font-display text-sm font-bold" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.010 258)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.65 0.010 258)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px]" style={{ color: 'oklch(0.50 0.010 258)' }}>{hint}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full px-3 py-2 rounded border text-sm font-mono-data outline-none transition-all',
        'focus:border-[oklch(0.80_0.15_200_/_60%)] focus:ring-1 focus:ring-[oklch(0.80_0.15_200_/_30%)]',
        className,
      )}
      style={{
        background: 'oklch(0.22 0.010 258)',
        borderColor: 'oklch(1 0 0 / 12%)',
        color: 'oklch(0.93 0.005 258)',
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step ?? 1}
        className="w-28 px-3 py-2 rounded border text-sm font-mono-data outline-none transition-all focus:border-[oklch(0.80_0.15_200_/_60%)]"
        style={{
          background: 'oklch(0.22 0.010 258)',
          borderColor: 'oklch(1 0 0 / 12%)',
          color: 'oklch(0.93 0.005 258)',
        }}
      />
      {suffix && (
        <span className="text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>{suffix}</span>
      )}
    </div>
  );
}

// ─── API Connection Section ───────────────────────────────────────────────────

type TestResult = {
  ok: boolean;
  status?: string;
  version?: string;
  latencyMs?: number;
  error?: string;
};

function ApiSection() {
  const { config, updateConfig } = useConfig();
  const { data: health, error: healthError, loading: autoLoading } = useHealth();
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const isConnected = !!health && !healthError;

  const runTest = useCallback(async () => {
    if (!config.apiToken) {
      toast.error('Enter a bearer token first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const base = config.apiUrl || '';
    const url = `${base}/api/health`;
    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.apiToken}` },
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Math.round(performance.now() - t0);
      if (!res.ok) {
        setTestResult({ ok: false, latencyMs, error: `HTTP ${res.status} ${res.statusText}` });
        return;
      }
      const json = await res.json().catch(() => ({}));
      setTestResult({
        ok: true,
        status: json.status ?? 'ok',
        version: json.version,
        latencyMs,
      });
      toast.success(`Connection OK — ${latencyMs}ms`);
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ ok: false, latencyMs, error: msg });
      toast.error(`Connection failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return (
    <Section
      title="API Connection"
      description="Fortress Dashboard REST API endpoint and authentication token."
    >
      <div className="space-y-4">
        <Field label="API Base URL" hint="Leave empty to use the nginx proxy on the same host. Set an absolute URL only if the API is on a different server.">
          <Input
            value={config.apiUrl}
            onChange={v => updateConfig({ apiUrl: v })}
            placeholder="(empty = same-origin proxy)"
          />
        </Field>

        <Field label="Bearer Token" hint="Stored locally in your browser only. Never sent to any third party.">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.apiToken}
              onChange={e => updateConfig({ apiToken: e.target.value })}
              placeholder="Enter your API bearer token"
              className="w-full px-3 py-2 pr-10 rounded border text-sm font-mono-data outline-none transition-all focus:border-[oklch(0.80_0.15_200_/_60%)]"
              style={{
                background: 'oklch(0.22 0.010 258)',
                borderColor: 'oklch(1 0 0 / 12%)',
                color: 'oklch(0.93 0.005 258)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowToken(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'oklch(0.55 0.010 258)' }}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        {/* CORS notice for http:// APIs */}
        {config.apiUrl.startsWith('http://') && (
          <div
            className="rounded border p-3 text-xs"
            style={{ background: 'oklch(0.78 0.18 85 / 8%)', borderColor: 'oklch(0.78 0.18 85 / 25%)' }}
          >
            <span className="font-semibold" style={{ color: 'oklch(0.78 0.18 85)' }}>Browser CORS note: </span>
            <span style={{ color: 'oklch(0.65 0.010 258)' }}>
              Your API uses HTTP. When this dashboard is served over HTTPS, browsers block mixed-content requests.
              To connect, either: (1) access the dashboard via HTTP, (2) add HTTPS to your API server,
              or (3) run a local CORS proxy. The API will work fine when both are on the same protocol.
            </span>
          </div>
        )}

        {/* Connection Test button + result */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={runTest}
            disabled={testing || !config.apiToken}
            className="flex items-center gap-2 px-4 py-2 rounded border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[oklch(0.80_0.15_200_/_10%)]"
            style={{
              background: 'oklch(0.80 0.15 200 / 8%)',
              borderColor: 'oklch(0.80 0.15 200 / 30%)',
              color: 'oklch(0.80 0.15 200)',
            }}
          >
            {testing ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>

          {/* Manual test result */}
          {testResult && (
            <div
              className="flex items-start gap-2.5 px-3 py-2.5 rounded border text-xs"
              style={{
                background: testResult.ok ? 'oklch(0.72 0.18 145 / 8%)' : 'oklch(0.65 0.22 25 / 8%)',
                borderColor: testResult.ok ? 'oklch(0.72 0.18 145 / 30%)' : 'oklch(0.65 0.22 25 / 30%)',
              }}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'oklch(0.72 0.18 145)' }} />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'oklch(0.65 0.22 25)' }} />
              )}
              <div className="space-y-0.5">
                {testResult.ok ? (
                  <>
                    <div className="font-semibold" style={{ color: 'oklch(0.72 0.18 145)' }}>
                      Connection successful
                    </div>
                    <div style={{ color: 'oklch(0.65 0.010 258)' }}>
                      Status: <span className="font-mono-data">{testResult.status}</span>
                      {testResult.version && (
                        <> · Version: <span className="font-mono-data">{testResult.version}</span></>
                      )}
                      {' '}· Latency: <span className="font-mono-data">{testResult.latencyMs}ms</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold" style={{ color: 'oklch(0.65 0.22 25)' }}>
                      Connection failed
                    </div>
                    <div className="font-mono-data" style={{ color: 'oklch(0.65 0.010 258)' }}>
                      {testResult.error}
                      {testResult.latencyMs !== undefined && ` (${testResult.latencyMs}ms)`}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Auto-poll status (passive indicator) */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px]"
            style={{ color: isConnected ? 'oklch(0.55 0.010 258)' : 'oklch(0.50 0.010 258)' }}
          >
            {autoLoading ? (
              <div className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
            ) : isConnected ? (
              <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.72 0.18 145)' }} />
            ) : (
              <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.65 0.22 25)' }} />
            )}
            {autoLoading
              ? 'Auto-checking…'
              : isConnected
              ? `Auto-poll: connected — ${health?.status ?? 'ok'}${health?.version ? ` v${health.version}` : ''}`
              : `Auto-poll: ${healthError ? healthError : 'no token'}`
            }
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Ticker Universe Section ──────────────────────────────────────────────────

const TIER_META: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  tier1: { label: 'Tier 1', color: 'oklch(0.80 0.15 200)', icon: Star,      description: 'High IV — primary candidates' },
  tier2: { label: 'Tier 2', color: 'oklch(0.78 0.18 85)',  icon: TrendingUp, description: 'Moderate IV — secondary candidates' },
  macro: { label: 'Macro / Index', color: 'oklch(0.72 0.18 145)', icon: Shield, description: 'Benchmark & hedge instruments' },
};

function TierBadge({ tier }: { tier: string }) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35` }}>
      {meta.label}
    </span>
  );
}

function TickerSection() {
  const { data: universe, loading: univLoading, refresh: univRefresh } = useUniverse();
  const { addTicker, removeTicker, excludeTicker, unexcludeTicker, loading: actionLoading } = useUniverseActions();
  const [newTicker, setNewTicker] = useState('');
  const [newTier, setNewTier] = useState('tier1');
  const [excludeReason, setExcludeReason] = useState('');
  const [excludingTicker, setExcludingTicker] = useState<string | null>(null);

  const handleAdd = async () => {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    try {
      await addTicker(t, newTier);
      setNewTicker('');
      univRefresh();
      toast.success(`Added ${t} to ${TIER_META[newTier]?.label ?? newTier}`);
    } catch {
      toast.error('Failed to add ticker');
    }
  };

  const handleRemove = async (tier: string, ticker: string) => {
    try {
      await removeTicker(tier, ticker);
      univRefresh();
      toast.info(`Removed ${ticker} from ${TIER_META[tier]?.label ?? tier}`);
    } catch {
      toast.error('Failed to remove ticker');
    }
  };

  const handleExclude = async (ticker: string, reason: string) => {
    try {
      await excludeTicker(ticker, reason);
      univRefresh();
      setExcludingTicker(null);
      setExcludeReason('');
      toast.info(`${ticker} excluded`);
    } catch {
      toast.error('Failed to exclude ticker');
    }
  };

  const handleUnexclude = async (ticker: string) => {
    try {
      await unexcludeTicker(ticker);
      univRefresh();
      toast.success(`${ticker} restored to universe`);
    } catch {
      toast.error('Failed to restore ticker');
    }
  };

  return (
    <Section
      title="Ticker Universe"
      description="Managed via ticker_universe.json on the VPS. Tiers control priority and workflow inclusion."
    >
      {univLoading && (
        <div className="text-xs py-4 text-center" style={{ color: 'oklch(0.55 0.010 258)' }}>Loading universe…</div>
      )}

      {universe && (
        <div className="space-y-4">
          {/* Tier 1, Tier 2, Macro */}
          {(['tier1', 'tier2', 'macro'] as const).map(tier => {
            const meta = TIER_META[tier];
            const tickers = universe[tier] ?? [];
            const Icon = meta.icon;
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>— {meta.description}</span>
                  <span className="ml-auto text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                    style={{ background: `${meta.color}15`, color: meta.color }}>
                    {tickers.length} tickers
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tickers.map(t => (
                    <div key={t} className="flex items-center gap-1 px-2 py-0.5 rounded border"
                      style={{ background: 'oklch(0.20 0.010 258)', borderColor: `${meta.color}30` }}>
                      <span className="font-mono-data text-xs font-semibold" style={{ color: meta.color }}>{t}</span>
                      <button onClick={() => handleRemove(tier, t)} disabled={actionLoading}
                        className="hover:opacity-80 ml-0.5" style={{ color: 'oklch(0.50 0.010 258)' }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {tickers.length === 0 && (
                    <span className="text-[11px]" style={{ color: 'oklch(0.45 0.010 258)' }}>No tickers in this tier</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Excluded */}
          {universe.excluded && universe.excluded.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-3.5 h-3.5" style={{ color: 'oklch(0.65 0.22 25)' }} />
                <span className="text-xs font-semibold" style={{ color: 'oklch(0.65 0.22 25)' }}>Excluded</span>
                <span className="text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>— Regulatory, ignored, or suspended</span>
              </div>
              <div className="space-y-1">
                {universe.excluded.map(ex => (
                  <div key={ex.ticker} className="flex items-center gap-2 px-3 py-1.5 rounded border"
                    style={{ background: 'oklch(0.65 0.22 25 / 6%)', borderColor: 'oklch(0.65 0.22 25 / 25%)' }}>
                    <span className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.75 0.22 25)' }}>{ex.ticker}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.65 0.22 25 / 15%)', color: 'oklch(0.70 0.18 25)' }}>
                      {ex.reason}
                    </span>
                    {ex.note && (
                      <span className="text-[10px] truncate flex-1" style={{ color: 'oklch(0.55 0.010 258)' }}>{ex.note}</span>
                    )}
                    <button onClick={() => handleUnexclude(ex.ticker)} disabled={actionLoading}
                      className="ml-auto text-[10px] px-2 py-0.5 rounded border hover:opacity-80"
                      style={{ color: 'oklch(0.72 0.18 145)', borderColor: 'oklch(0.72 0.18 145 / 30%)' }}>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add ticker */}
      <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        <input
          type="text"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Ticker (e.g. AAPL)"
          className="flex-1 px-3 py-2 rounded border text-sm font-mono-data outline-none transition-all focus:border-[oklch(0.80_0.15_200_/_60%)]"
          style={{ background: 'oklch(0.22 0.010 258)', borderColor: 'oklch(1 0 0 / 12%)', color: 'oklch(0.93 0.005 258)' }}
        />
        <select
          value={newTier}
          onChange={e => setNewTier(e.target.value)}
          className="px-3 py-2 rounded border text-sm outline-none"
          style={{ background: 'oklch(0.22 0.010 258)', borderColor: 'oklch(1 0 0 / 12%)', color: 'oklch(0.85 0.005 258)' }}
        >
          <option value="tier1">Tier 1</option>
          <option value="tier2">Tier 2</option>
          <option value="macro">Macro</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={actionLoading || !newTicker.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)] disabled:opacity-40"
          style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
        <button
          onClick={univRefresh}
          disabled={univLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-all hover:opacity-80 disabled:opacity-40"
          style={{ color: 'oklch(0.55 0.010 258)', borderColor: 'oklch(1 0 0 / 12%)' }}
        >
          <RefreshCw className={`w-4 h-4 ${univLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </Section>
  );
}

// ─── Strategy Parameters Section ─────────────────────────────────────────────

function StrategySection() {
  const { config, updateStrategy } = useConfig();
  const s = config.strategy;

  return (
    <Section
      title="Strategy Parameters"
      description="Thresholds used for position evaluation, alert generation, and order recommendations. Adjust to match your personal strategy rules."
    >
      <div className="grid grid-cols-2 gap-5">
        <Field
          label="Delta Alert Threshold"
          hint="Short leg alert when |delta| ≥ this value. Default: 0.40"
        >
          <NumberInput
            value={s.deltaAlertThreshold}
            onChange={v => updateStrategy({ deltaAlertThreshold: v })}
            min={0.10}
            max={0.90}
            step={0.01}
            suffix="(0.10 – 0.90)"
          />
        </Field>

        <Field
          label="Roll Window (DTE)"
          hint="Trigger roll evaluation when DTE ≤ this value. Paired with the DTE Triage Threshold in General settings."
        >
          {(() => {
            const ROLL_OPTIONS = [14, 21, 30, 45] as const;
            return (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {ROLL_OPTIONS.map(days => (
                    <button
                      key={days}
                      onClick={() => updateStrategy({ rollDteDays: days })}
                      className="flex-1 py-2 rounded border text-xs font-mono-data font-semibold transition-all"
                      style={s.rollDteDays === days ? {
                        background: 'oklch(0.80 0.15 200 / 15%)',
                        borderColor: 'oklch(0.80 0.15 200 / 60%)',
                        color: 'oklch(0.80 0.15 200)',
                      } : {
                        background: 'transparent',
                        borderColor: 'oklch(1 0 0 / 12%)',
                        color: 'oklch(0.55 0.010 258)',
                      }}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'oklch(0.80 0.15 200 / 8%)', border: '1px solid oklch(0.80 0.15 200 / 20%)' }}>
                  <span className="font-mono-data text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 20%)', color: 'oklch(0.80 0.15 200)' }}>↻ ROLL</span>
                  <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 258)' }}>signal fires at DTE ≤ <strong style={{ color: 'oklch(0.80 0.15 200)' }}>{s.rollDteDays}d</strong></span>
                </div>
              </div>
            );
          })()}
        </Field>

        <Field
          label="Max Single-Name Concentration"
          hint="Alert when one ticker exceeds this % of Net Liq. Default: 20%"
        >
          <NumberInput
            value={s.maxSingleNamePct}
            onChange={v => updateStrategy({ maxSingleNamePct: v })}
            min={5}
            max={100}
            step={1}
            suffix="% Net Liq"
          />
        </Field>

        <Field
          label="Max Sector Concentration"
          hint="Alert when one sector exceeds this % of Net Liq. Default: 40%"
        >
          <NumberInput
            value={s.maxSectorPct}
            onChange={v => updateStrategy({ maxSectorPct: v })}
            min={10}
            max={100}
            step={1}
            suffix="% Net Liq"
          />
        </Field>

        <Field
          label="Min Premium Credit"
          hint="Close short leg if remaining credit falls below this. Default: $50"
        >
          <NumberInput
            value={s.minPremiumCredit}
            onChange={v => updateStrategy({ minPremiumCredit: v })}
            min={0}
            max={500}
            step={10}
            suffix="USD"
          />
        </Field>

        <Field
          label="Regime Entry Threshold"
          hint="No new entries when regime score ≤ this value. Default: 0 (neutral)"
        >
          <NumberInput
            value={s.regimeEntryThreshold}
            onChange={v => updateStrategy({ regimeEntryThreshold: v })}
            min={-4}
            max={4}
            step={1}
            suffix="(−4 to +4)"
          />
        </Field>

        <Field
          label="IV Rank Entry Threshold"
          hint="Candidates screener: signal entry when IV rank ≥ this value. Default: 50"
        >
          <NumberInput
            value={s.ivRankThreshold ?? 50}
            onChange={v => updateStrategy({ ivRankThreshold: v })}
            min={10}
            max={95}
            step={5}
            suffix="(10 – 95)"
          />
        </Field>

        <Field
          label="IV/HV Spread Threshold"
          hint="Candidates screener: min IV − HV spread (pp) for SELL signal. Default: 5pp"
        >
          <NumberInput
            value={Math.round((s.ivHvSpreadThreshold ?? 0.05) * 100)}
            onChange={v => updateStrategy({ ivHvSpreadThreshold: v / 100 })}
            min={1}
            max={30}
            step={1}
            suffix="pp (1 – 30)"
          />
        </Field>

        <Field label="Stop-Loss: 200-SMA Breach" hint="Close position if underlying breaks below 200-SMA">
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateStrategy({ stopLoss200SMA: !s.stopLoss200SMA })}
              className={cn(
                'relative w-10 h-5 rounded-full transition-all',
                s.stopLoss200SMA ? 'bg-[oklch(0.72_0.18_145)]' : 'bg-[oklch(0.30_0.010_258)]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                  s.stopLoss200SMA ? 'left-5' : 'left-0.5'
                )}
              />
            </button>
            <span className="text-xs" style={{ color: s.stopLoss200SMA ? 'oklch(0.72 0.18 145)' : 'oklch(0.55 0.010 258)' }}>
              {s.stopLoss200SMA ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

// ─── Refresh Settings ─────────────────────────────────────────────────────────

function RefreshSection() {
  const { config, updateConfig } = useConfig();

  return (
    <Section
      title="Data Refresh"
      description="Auto-refresh settings for live data polling."
    >
      <div className="grid grid-cols-2 gap-5">
        <Field label="Auto-Refresh">
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateConfig({ autoRefresh: !config.autoRefresh })}
              className={cn(
                'relative w-10 h-5 rounded-full transition-all',
                config.autoRefresh ? 'bg-[oklch(0.72_0.18_145)]' : 'bg-[oklch(0.30_0.010_258)]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                  config.autoRefresh ? 'left-5' : 'left-0.5'
                )}
              />
            </button>
            <span className="text-xs" style={{ color: config.autoRefresh ? 'oklch(0.72 0.18 145)' : 'oklch(0.55 0.010 258)' }}>
              {config.autoRefresh ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </Field>

        <Field label="Refresh Interval" hint="How often to poll the API when auto-refresh is on">
          <NumberInput
            value={config.refreshIntervalSec}
            onChange={v => updateConfig({ refreshIntervalSec: Math.max(10, v) })}
            min={10}
            max={3600}
            step={10}
            suffix="seconds"
          />
        </Field>
      </div>
    </Section>
  );
}

// ─── Dashboard Name ───────────────────────────────────────────────────────────

function GeneralSection() {
  const { config, updateConfig } = useConfig();
  const DTE_OPTIONS = [7, 14, 21] as const;

  return (
    <Section title="General" description="Dashboard display settings.">
      <div className="space-y-4">
        <Field label="Dashboard Name" hint="Shown in the sidebar header">
          <Input
            value={config.dashboardName}
            onChange={v => updateConfig({ dashboardName: v })}
            placeholder="Fortress v4"
          />
        </Field>

        <Field
          label="DTE Triage Threshold"
          hint="Legs at or below this DTE show a pulsing TRIAGE badge in the P&L tab and are clickable to jump to the Analysis tab."
        >
          <div className="flex gap-2">
            {DTE_OPTIONS.map(days => (
              <button
                key={days}
                onClick={() => updateConfig({ dteTriage: days })}
                className="flex-1 py-2 rounded border text-xs font-mono-data font-semibold transition-all"
                style={config.dteTriage === days ? {
                  background: 'oklch(0.78 0.18 85 / 15%)',
                  borderColor: 'oklch(0.78 0.18 85 / 60%)',
                  color: 'oklch(0.78 0.18 85)',
                } : {
                  background: 'transparent',
                  borderColor: 'oklch(1 0 0 / 12%)',
                  color: 'oklch(0.55 0.010 258)',
                }}
              >
                {days}d
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded" style={{ background: 'oklch(0.78 0.18 85 / 8%)', border: '1px solid oklch(0.78 0.18 85 / 20%)' }}>
            <span className="font-mono-data text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse" style={{ background: 'oklch(0.78 0.18 85 / 20%)', color: 'oklch(0.78 0.18 85)' }}>TRIAGE</span>
            <span className="text-[11px]" style={{ color: 'oklch(0.65 0.010 258)' }}>badge appears on legs with DTE ≤ <strong style={{ color: 'oklch(0.78 0.18 85)' }}>{config.dteTriage}d</strong></span>
          </div>
        </Field>
      </div>
    </Section>
  );
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

function BackupSection() {
  const { exportConfig, importConfig, resetConfig } = useConfig();
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fortress-v2-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported (token excluded for security)');
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const ok = importConfig(importText);
    if (ok) {
      toast.success('Config imported successfully');
      setImportText('');
      setShowImport(false);
    } else {
      toast.error('Invalid config JSON');
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetConfig();
      toast.info('Settings reset to defaults');
    }
  };

  return (
    <Section
      title="Backup & Restore"
      description="Export your configuration (without the API token) for backup or sharing. Import to restore."
    >
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
          style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
        >
          <Download className="w-4 h-4" />
          Export Config
        </button>

        <button
          onClick={() => setShowImport(s => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.78_0.18_85_/_10%)]"
          style={{ color: 'oklch(0.78 0.18 85)', borderColor: 'oklch(0.78 0.18 85 / 30%)' }}
        >
          <Upload className="w-4 h-4" />
          Import Config
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.65_0.22_25_/_10%)]"
          style={{ color: 'oklch(0.65 0.22 25)', borderColor: 'oklch(0.65 0.22 25 / 30%)' }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>

      {showImport && (
        <div className="mt-4 space-y-2">
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste config JSON here…"
            rows={6}
            className="w-full px-3 py-2 rounded border text-xs font-mono-data outline-none resize-none"
            style={{
              background: 'oklch(0.22 0.010 258)',
              borderColor: 'oklch(1 0 0 / 12%)',
              color: 'oklch(0.85 0.005 258)',
            }}
          />
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.72_0.18_145_/_10%)]"
            style={{ color: 'oklch(0.72 0.18 145)', borderColor: 'oklch(0.72 0.18 145 / 30%)' }}
          >
            <Save className="w-4 h-4" />
            Apply Import
          </button>
        </div>
      )}
    </Section>
  );
}

// ─── Server Settings Sync ────────────────────────────────────────────────────

function ServerSettingsSection() {
  const { data, loading, error, refresh } = useServerSettings();
  const { data: presetsData } = useTraderPresets();
  const { config } = useConfig();

  if (!config.apiToken) return null;

  return (
    <Section
      title="Server Settings"
      description="Live view of the Fortress server's active configuration. Read-only — edit via the server config file."
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: 'oklch(0.80 0.15 200)' }} />
          <span className="text-xs" style={{ color: 'oklch(0.65 0.010 258)' }}>Fetched from /api/settings</span>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:opacity-80"
          style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 25%)' }}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>Error: {error}</p>}

      {data && (
        <div className="space-y-3">
          {/* Strategy thresholds from server */}
          {data.strategy && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>Strategy Thresholds (Server)</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(data.strategy as Record<string, string | number | boolean>).map(([k, v]) => (
                  <div key={k} className="rounded p-2" style={{ background: 'oklch(0.22 0.010 258)' }}>
                    <div className="text-[9px] uppercase tracking-wide" style={{ color: 'oklch(0.50 0.010 258)' }}>{k.replace(/_/g, ' ')}</div>
                    <div className="font-mono-data text-xs mt-0.5" style={{ color: 'oklch(0.85 0.005 258)' }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Universe from server */}
          {Array.isArray(data.universe) && (
            <div>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'oklch(0.50 0.010 258)' }}>Universe (Server)</div>
              <div className="flex flex-wrap gap-1.5">
                {(data.universe as string[]).map((t: string) => (
                  <span key={t} className="font-mono-data text-[10px] px-2 py-0.5 rounded" style={{ background: 'oklch(0.22 0.010 258)', color: 'oklch(0.80 0.15 200)' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Presets */}
      {presetsData && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3.5 h-3.5" style={{ color: 'oklch(0.78 0.18 85)' }} />
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.50 0.010 258)' }}>Trader Presets</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {presetsData.presets.map((p: TraderPreset) => (
              <div key={p.id} className="rounded border p-3" style={{ background: 'oklch(0.22 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)' }}>
                <div className="font-mono-data text-xs font-bold" style={{ color: 'oklch(0.85 0.005 258)' }}>{p.label}</div>
                {p.description && <div className="text-[10px] mt-0.5" style={{ color: 'oklch(0.55 0.010 258)' }}>{p.description}</div>}
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex justify-between text-[9px] font-mono-data">
                    <span style={{ color: 'oklch(0.50 0.010 258)' }}>risk</span>
                    <span style={{ color: 'oklch(0.72 0.18 145)' }}>{p.risk_tolerance}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono-data">
                    <span style={{ color: 'oklch(0.50 0.010 258)' }}>objective</span>
                    <span style={{ color: 'oklch(0.72 0.18 145)' }}>{p.primary_objective}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}// ─── Connection Health Section ──────────────────────────────────────────────

type IbkrCheckResult = {
  ok: boolean;
  latencyMs: number | null;
  backend: string | null;
  account: string | null;
  opra: boolean | null;
  webApiConnected: boolean | null;
  error: string | null;
  checkedAt: string | null;
};

type QuantDataCheckResult = {
  ok: boolean;
  latencyMs: number | null;
  message: string | null;
  ivRank: number | null;
  error: string | null;
  checkedAt: string | null;
};

function StatusDot({ ok, pending }: { ok: boolean | null; pending: boolean }) {
  if (pending) return <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'oklch(0.78 0.18 85)' }} />;
  if (ok === null) return <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'oklch(0.45 0.010 258)' }} />;
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: ok ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }} />;
}

function ConnectionHealthSection() {
  const { config } = useConfig();
  const [ibkrResult, setIbkrResult] = useState<IbkrCheckResult | null>(null);
  const [ibkrPending, setIbkrPending] = useState(false);
  const [qdResult, setQdResult] = useState<QuantDataCheckResult | null>(null);
  const [qdPending, setQdPending] = useState(false);
  const ibkrAbort = useRef<AbortController | null>(null);
  const qdAbort = useRef<AbortController | null>(null);

  async function testIbkr() {
    if (!config.apiToken) { toast.error('Set your API token first'); return; }
    ibkrAbort.current?.abort();
    ibkrAbort.current = new AbortController();
    setIbkrPending(true);
    setIbkrResult(null);
    const t0 = Date.now();
    try {
      const data = await apiFetch<IbkrStatus>(config.apiUrl, config.apiToken, '/api/ibkr/capability?refresh=1');
      const latencyMs = Date.now() - t0;
      const wa = data.web_api;
      setIbkrResult({
        ok: wa?.session_status?.established === true,
        latencyMs,
        backend: data.active_backend ?? null,
        account: wa?.account ?? null,
        opra: wa?.opra_subscribed ?? null,
        webApiConnected: wa?.session_status?.connected ?? null,
        error: wa?.error ?? null,
        checkedAt: data.checked_at ?? null,
      });
    } catch (e) {
      setIbkrResult({ ok: false, latencyMs: Date.now() - t0, backend: null, account: null, opra: null, webApiConnected: null, error: String(e), checkedAt: null });
    } finally {
      setIbkrPending(false);
    }
  }

  async function testQuantData() {
    if (!config.apiToken) { toast.error('Set your API token first'); return; }
    qdAbort.current?.abort();
    qdAbort.current = new AbortController();
    setQdPending(true);
    setQdResult(null);
    const t0 = Date.now();
    try {
      const data = await apiFetch<{ ok: boolean; message: string; iv_rank: number | null; error?: string }>(
        config.apiUrl, config.apiToken, '/api/settings/test_quantdata', { method: 'POST' }
      );
      const latencyMs = Date.now() - t0;
      setQdResult({ ok: data.ok, latencyMs, message: data.message ?? null, ivRank: data.iv_rank ?? null, error: data.error ?? null, checkedAt: new Date().toISOString() });
    } catch (e) {
      setQdResult({ ok: false, latencyMs: Date.now() - t0, message: null, ivRank: null, error: String(e), checkedAt: new Date().toISOString() });
    } finally {
      setQdPending(false);
    }
  }

  const GREEN  = 'oklch(0.72 0.18 145)';
  const RED    = 'oklch(0.65 0.22 25)';
  const AMBER  = 'oklch(0.78 0.18 85)';
  const CYAN   = 'oklch(0.80 0.15 200)';
  const DIM    = 'oklch(0.55 0.010 258)';
  const BRIGHT = 'oklch(0.93 0.005 258)';

  return (
    <Section title="Connection Health" description="Live ping tests for IBKR Web API and QuantData. Results are not cached.">
      <div className="space-y-4">

        {/* IBKR Web API */}
        <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StatusDot ok={ibkrResult?.ok ?? null} pending={ibkrPending} />
              <Wifi className="w-4 h-4" style={{ color: CYAN }} />
              <span className="font-display text-sm" style={{ color: BRIGHT }}>IBKR Web API</span>
              {ibkrResult?.latencyMs != null && (
                <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ color: DIM, background: 'oklch(1 0 0 / 5%)' }}>
                  {ibkrResult.latencyMs}ms
                </span>
              )}
            </div>
            <button
              onClick={testIbkr}
              disabled={ibkrPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono-data transition-all disabled:opacity-50"
              style={{ background: 'oklch(0.80 0.15 200 / 12%)', color: CYAN, border: '1px solid oklch(0.80 0.15 200 / 30%)' }}
            >
              <Activity className="w-3 h-3" />
              {ibkrPending ? 'Testing…' : 'Run Test'}
            </button>
          </div>

          {ibkrResult && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { label: 'Status', value: ibkrResult.ok ? 'CONNECTED' : 'DISCONNECTED', color: ibkrResult.ok ? GREEN : RED },
                { label: 'Backend', value: ibkrResult.backend ?? '—', color: CYAN },
                { label: 'Account', value: ibkrResult.account ?? '—', color: BRIGHT },
                { label: 'OPRA', value: ibkrResult.opra === true ? 'Subscribed' : ibkrResult.opra === false ? 'Not subscribed' : '—', color: ibkrResult.opra ? GREEN : AMBER },
              ].map(item => (
                <div key={item.label} className="rounded p-2" style={{ background: 'oklch(0.22 0.010 258)' }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: DIM }}>{item.label}</div>
                  <div className="font-mono-data text-xs font-semibold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {ibkrResult?.error && (
            <div className="mt-2 text-[10px] font-mono-data px-2 py-1.5 rounded" style={{ color: RED, background: 'oklch(0.65 0.22 25 / 10%)' }}>
              {ibkrResult.error}
            </div>
          )}

          {ibkrResult?.checkedAt && (
            <div className="flex items-center gap-1 mt-2 text-[9px]" style={{ color: DIM }}>
              <Clock className="w-3 h-3" />
              Checked at {new Date(ibkrResult.checkedAt).toLocaleTimeString()}
            </div>
          )}

          {!ibkrResult && !ibkrPending && (
            <p className="text-[11px]" style={{ color: DIM }}>Click Run Test to check IBKR Web API connectivity.</p>
          )}
        </div>

        {/* QuantData */}
        <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 9%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StatusDot ok={qdResult?.ok ?? null} pending={qdPending} />
              <Database className="w-4 h-4" style={{ color: AMBER }} />
              <span className="font-display text-sm" style={{ color: BRIGHT }}>QuantData API</span>
              {qdResult?.latencyMs != null && (
                <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ color: DIM, background: 'oklch(1 0 0 / 5%)' }}>
                  {qdResult.latencyMs}ms
                </span>
              )}
            </div>
            <button
              onClick={testQuantData}
              disabled={qdPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono-data transition-all disabled:opacity-50"
              style={{ background: 'oklch(0.78 0.18 85 / 12%)', color: AMBER, border: '1px solid oklch(0.78 0.18 85 / 30%)' }}
            >
              <Activity className="w-3 h-3" />
              {qdPending ? 'Testing…' : 'Run Test'}
            </button>
          </div>

          {qdResult && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Status', value: qdResult.ok ? 'OK' : 'FAILED', color: qdResult.ok ? GREEN : RED },
                  { label: 'SPY IV Rank', value: qdResult.ivRank != null ? `${qdResult.ivRank.toFixed(1)}` : '—', color: qdResult.ok ? CYAN : DIM },
                ].map(item => (
                  <div key={item.label} className="rounded p-2" style={{ background: 'oklch(0.22 0.010 258)' }}>
                    <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: DIM }}>{item.label}</div>
                    <div className="font-mono-data text-xs font-semibold" style={{ color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {qdResult.message && (
                <div className="text-[10px] font-mono-data px-2 py-1.5 rounded"
                  style={{ color: qdResult.ok ? GREEN : RED, background: qdResult.ok ? 'oklch(0.72 0.18 145 / 8%)' : 'oklch(0.65 0.22 25 / 10%)' }}>
                  {qdResult.message}
                </div>
              )}
            </div>
          )}

          {qdResult?.checkedAt && (
            <div className="flex items-center gap-1 mt-2 text-[9px]" style={{ color: DIM }}>
              <Clock className="w-3 h-3" />
              Checked at {new Date(qdResult.checkedAt).toLocaleTimeString()}
            </div>
          )}

          {!qdResult && !qdPending && (
            <p className="text-[11px]" style={{ color: DIM }}>Click Run Test to verify QuantData credentials (Settings &gt; Security must be configured).</p>
          )}
        </div>

      </div>
    </Section>
  );
}


// ─── QuantData Credentials Section ───────────────────────────────────────────

function QuantDataCredentialsSection() {
  const { config } = useConfig();
  const [expanded, setExpanded] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [cookie, setCookie] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [credStatus, setCredStatus] = useState<{ exists: boolean; token_preview: string | null; cookie_preview: string | null; mtime: string | null } | null>(null);

  useEffect(() => {
    const base = config.apiUrl || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;
    fetch(`${base}/api/settings/quantdata_credentials_status`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCredStatus(d))
      .catch(() => {});
  }, [config.apiUrl, config.apiToken]);

  async function handleSave() {
    if (!authToken.trim() || !cookie.trim()) {
      setSaveStatus('error');
      setSaveMessage('Both fields are required.');
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      const base = config.apiUrl || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;
      const res = await fetch(`${base}/api/settings/quantdata_credentials`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ auth_token: authToken.trim(), cookie: cookie.trim() }),
      });
      const result = await res.json();
      if (result.ok) {
        setSaveStatus('success');
        setSaveMessage('Credentials saved. QuantData is now active.');
        setAuthToken('');
        setCookie('');
        setExpanded(false);
        fetch(`${base}/api/settings/quantdata_credentials_status`, { headers })
          .then(r => r.ok ? r.json() : null)
          .then(d => d && setCredStatus(d))
          .catch(() => {});
      } else {
        setSaveStatus('error');
        setSaveMessage(result.message || 'Failed to save credentials.');
      }
    } catch (e: unknown) {
      setSaveStatus('error');
      setSaveMessage(e instanceof Error ? e.message : 'Failed to save credentials.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="QuantData Credentials" description="Update your QuantData session token and cookie to restore live market data.">
      {/* Current status */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: credStatus?.exists ? 'oklch(0.75 0.18 145)' : 'oklch(0.65 0.20 25)' }}
        />
        <span className="text-xs" style={{ color: DIM }}>
          {credStatus?.exists
            ? <>Token: <span className="font-mono-data" style={{ color: BRIGHT }}>{credStatus.token_preview}</span>{credStatus.mtime ? ` · Updated ${new Date(credStatus.mtime).toLocaleDateString()}` : ''}</>
            : 'No credentials configured on server'}
        </span>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs px-3 py-1.5 rounded border transition-all hover:opacity-80"
          style={{ borderColor: ACCENT, color: ACCENT, background: 'transparent' }}
        >
          Update Credentials
        </button>
      ) : (
        <div className="space-y-4">
          {/* Instructions */}
          <div
            className="rounded border p-3 text-xs space-y-1.5"
            style={{ borderColor: 'oklch(0.80 0.15 200 / 25%)', background: 'oklch(0.80 0.15 200 / 6%)' }}
          >
            <p className="font-semibold" style={{ color: ACCENT }}>How to get fresh credentials:</p>
            <ol className="list-decimal list-inside space-y-1" style={{ color: DIM }}>
              <li>Open <a href="https://v3.quantdata.us" target="_blank" rel="noreferrer" style={{ color: ACCENT }}>v3.quantdata.us</a> and log in</li>
              <li>Open DevTools (F12) → Network tab → filter for <code className="px-1 rounded" style={{ background: 'oklch(0.25 0.01 258)' }}>core-lb-prod</code></li>
              <li>Click any request → Request Headers → copy the <code className="px-1 rounded" style={{ background: 'oklch(0.25 0.01 258)' }}>authorization</code> value</li>
              <li>Copy the full <code className="px-1 rounded" style={{ background: 'oklch(0.25 0.01 258)' }}>cookie</code> request header value</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1"><label className="block text-xs" style={{ color: DIM }}>Auth Token (authorization header value)</label><button type="button" onClick={() => setShowAuthToken(s => !s)} className="p-0.5 hover:opacity-70" style={{ color: 'oklch(0.55 0.010 258)' }}>{showAuthToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button></div>
              <input
                type={showAuthToken ? "text" : "password"}
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                placeholder="Bearer eyJ..."
                className="w-full rounded border px-3 py-2 text-xs font-mono outline-none"
                style={{ background: 'oklch(0.18 0.01 258)', borderColor: 'oklch(0.35 0.01 258)', color: BRIGHT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: DIM }}>Cookie (full cookie header value)</label>
              <textarea
                value={cookie}
                onChange={e => setCookie(e.target.value)}
                placeholder="session=...; auth=..."
                rows={3}
                className="w-full rounded border px-3 py-2 text-xs font-mono resize-none outline-none"
                style={{ background: 'oklch(0.18 0.01 258)', borderColor: 'oklch(0.35 0.01 258)', color: BRIGHT }}
              />
            </div>
          </div>

          {saveStatus !== 'idle' && (
            <p className="text-xs" style={{ color: saveStatus === 'success' ? 'oklch(0.75 0.18 145)' : 'oklch(0.65 0.20 25)' }}>
              {saveMessage}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded transition-all disabled:opacity-50"
              style={{ background: ACCENT, color: 'oklch(0.12 0.01 258)' }}
            >
              {saving ? 'Saving…' : 'Save Credentials'}
            </button>
            <button
              onClick={() => { setExpanded(false); setSaveStatus('idle'); setAuthToken(''); setCookie(''); }}
              className="text-xs px-3 py-1.5 rounded border transition-all"
              style={{ borderColor: 'oklch(0.35 0.01 258)', color: DIM, background: 'transparent' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}


// ─── QuantData Login Refresh Section ────────────────────────────────────────

function QuantDataLoginRefreshSection() {
  const { config } = useConfig();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [ivRank, setIvRank] = useState<number | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setStatus('error');
      setMessage('Both email and password are required.');
      return;
    }
    setLoading(true);
    setStatus('idle');
    setMessage('');
    setTokenPreview(null);
    setIvRank(null);
    try {
      const base = config.apiUrl || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;
      const res = await fetch(`${base}/api/settings/quantdata_login_refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });
      const result = await res.json();
      if (result.ok) {
        setStatus('success');
        setMessage(result.message || 'Login successful. QuantData credentials refreshed.');
        setTokenPreview(result.token_preview ?? null);
        setIvRank(result.iv_rank ?? null);
        setEmail('');
        setPassword('');
        setExpanded(false);
      } else {
        setStatus('error');
        setMessage(result.message || 'Login failed.');
      }
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="QuantData Auto-Login" description="Enter your QuantData email and password to automatically refresh your session token — no DevTools required.">
      {status === 'success' && (
        <div className="flex items-start gap-3 mb-4 rounded border p-3" style={{ borderColor: 'oklch(0.75 0.18 145 / 30%)', background: 'oklch(0.75 0.18 145 / 8%)' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: 'oklch(0.75 0.18 145)' }} />
          <div className="text-xs space-y-0.5" style={{ color: 'oklch(0.75 0.18 145)' }}>
            <p className="font-semibold">Login successful — credentials refreshed</p>
            {tokenPreview && <p style={{ color: DIM }}>Token: <span className="font-mono-data" style={{ color: BRIGHT }}>{tokenPreview}</span></p>}
            {ivRank !== null && <p style={{ color: DIM }}>SPY IV Rank: <span className="font-mono-data" style={{ color: BRIGHT }}>{ivRank.toFixed(1)}</span> (live verification ✓)</p>}
          </div>
        </div>
      )}

      {!expanded ? (
        <button
          onClick={() => { setExpanded(true); setStatus('idle'); setMessage(''); }}
          className="text-xs px-3 py-1.5 rounded border transition-all hover:opacity-80"
          style={{ borderColor: ACCENT, color: ACCENT, background: 'transparent' }}
        >
          Login to Refresh
        </button>
      ) : (
        <div className="space-y-4">
          <div
            className="rounded border p-3 text-xs"
            style={{ borderColor: 'oklch(0.80 0.15 200 / 25%)', background: 'oklch(0.80 0.15 200 / 6%)' }}
          >
            <p style={{ color: DIM }}>The server will log in to <span style={{ color: ACCENT }}>v3.quantdata.us</span> using Chrome impersonation, extract a fresh JWT token, and save it automatically. The service restarts to pick up the new credentials.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: DIM }}>QuantData Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded border px-3 py-2 text-xs outline-none"
                style={{ background: 'oklch(0.18 0.01 258)', borderColor: 'oklch(0.35 0.01 258)', color: BRIGHT }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: DIM }}>QuantData Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full rounded border px-3 py-2 text-xs outline-none"
                style={{ background: 'oklch(0.18 0.01 258)', borderColor: 'oklch(0.35 0.01 258)', color: BRIGHT }}
              />
            </div>
          </div>

          {status === 'error' && (
            <p className="text-xs" style={{ color: 'oklch(0.65 0.20 25)' }}>{message}</p>
          )}

          {loading && (
            <p className="text-xs" style={{ color: DIM }}>Logging in via Chrome impersonation… this may take 10–20 seconds.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded transition-all disabled:opacity-50"
              style={{ background: ACCENT, color: 'oklch(0.12 0.01 258)' }}
            >
              {loading ? 'Logging in…' : 'Refresh Login'}
            </button>
            <button
              onClick={() => { setExpanded(false); setStatus('idle'); setMessage(''); setEmail(''); setPassword(''); }}
              className="text-xs px-3 py-1.5 rounded border transition-all"
              style={{ borderColor: 'oklch(0.35 0.01 258)', color: DIM, background: 'transparent' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Security Section — Bearer Token Rotation ───────────────────────────────────

function SecuritySection() {
  const { config, updateConfig } = useConfig();
  const [rotating, setRotating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState(false);

  const maskedToken = config.apiToken
    ? '••••••••••••••••' + config.apiToken.slice(-8)
    : '(not set)';
  const displayToken = showToken ? (config.apiToken ?? '(not set)') : maskedToken;

  const handleRotate = useCallback(async () => {
    if (!config.apiToken || !config.apiUrl) {
      toast.error('API URL and token must be configured before rotating.');
      return;
    }
    const confirmed = window.confirm(
      'Rotate the bearer token?\n\nThe server will restart with a new token. ' +
      'The new token will be saved to your browser automatically.'
    );
    if (!confirmed) return;

    setRotating(true);
    setRotateError(null);
    setRotateSuccess(false);
    try {
      const result = await apiFetch<{ ok: boolean; new_token: string; message: string }>(
        config.apiUrl,
        config.apiToken,
        '/api/manage/rotate-token',
        { method: 'POST' },
      );
      if (result.ok && result.new_token) {
        updateConfig({ apiToken: result.new_token });
        setRotateSuccess(true);
        toast.success('Token rotated. Saved to browser. Server is restarting.');
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Token rotation failed';
      setRotateError(msg);
      toast.error(msg);
    } finally {
      setRotating(false);
    }
  }, [config.apiUrl, config.apiToken, updateConfig]);

  return (
    <Section
      title="Security"
      description="Rotate the server bearer token. The new token is automatically saved to your browser."
    >
      <div className="space-y-4">
        <Field label="Current Token" hint="Last 8 characters shown for verification.">
          <div
            className="font-mono-data text-sm px-3 py-2 rounded border"
            style={{
              background: 'oklch(0.14 0.010 258)',
              borderColor: 'oklch(1 0 0 / 10%)',
              color: 'oklch(0.65 0.010 258)',
              letterSpacing: '0.05em',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-data text-sm" style={{ letterSpacing: '0.05em' }}>{displayToken}</span>
              <button onClick={() => setShowToken(s => !s)} className="p-1 hover:opacity-70 transition-opacity flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }}>
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </Field>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRotate}
            disabled={rotating || !config.apiToken}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: rotating ? 'oklch(0.65 0.22 25 / 15%)' : 'oklch(0.65 0.22 25 / 20%)',
              color: 'oklch(0.75 0.20 25)',
              border: '1px solid oklch(0.65 0.22 25 / 40%)',
            }}
          >
            {rotating ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rotating…</>
            ) : (
              <><Shield className="w-3.5 h-3.5" /> Rotate Token</>
            )}
          </button>

          {rotateSuccess && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.72 0.18 145)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> New token saved.
            </span>
          )}
          {rotateError && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'oklch(0.65 0.22 25)' }}>
              <AlertCircle className="w-3.5 h-3.5" /> {rotateError}
            </span>
          )}
        </div>

        <p className="text-xs" style={{ color: 'oklch(0.45 0.010 258)' }}>
          Rotation generates a new 48-character hex token, updates the server systemd config,
          and restarts the service. The dashboard will briefly show connection errors while the
          server restarts (~5s). The new token is saved to your browser immediately.
        </p>
      </div>
    </Section>
  );
}

// ─── Sync badge ─────────────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: PrefsSaveStatus }) {
  if (status === 'idle') return null;
  const styles: Record<PrefsSaveStatus, { text: string; color: string; bg: string; border: string }> = {
    idle:   { text: '',           color: '',                          bg: '',                            border: '' },
    saving: { text: 'Saving…',   color: 'oklch(0.80 0.15 200)',      bg: 'oklch(0.80 0.15 200 / 10%)',  border: 'oklch(0.80 0.15 200 / 30%)' },
    saved:  { text: 'Saved ✓',    color: 'oklch(0.72 0.18 145)',      bg: 'oklch(0.72 0.18 145 / 10%)',  border: 'oklch(0.72 0.18 145 / 30%)' },
    error:  { text: 'Sync failed', color: 'oklch(0.65 0.22 25)',      bg: 'oklch(0.65 0.22 25 / 10%)',   border: 'oklch(0.65 0.22 25 / 30%)' },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-data font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {status === 'saving' && (
        <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: s.color }} />
      )}
      {s.text}
    </span>
  );
}

type SettingsSubTab = 'connections' | 'trading' | 'system';

export default function SettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { prefsSaveStatus } = useConfig();
  const [subTab, setSubTab] = useState<SettingsSubTab>('connections');

  const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
    { id: 'connections', label: 'Connections' },
    { id: 'trading',     label: 'Trading' },
    { id: 'system',      label: 'System' },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="Connections & API config · Trading universe & strategy · System preferences"
      >
        <SyncBadge status={prefsSaveStatus} />
      </PageHeader>
      <div className="p-6 max-w-3xl space-y-4">
        {/* Sub-tab bar */}
        <div className="flex gap-1 rounded border p-1" style={{ background: 'oklch(0.14 0.010 258)', borderColor: 'oklch(1 0 0 / 8%)' }}>
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className="flex-1 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: subTab === id ? 'oklch(0.22 0.010 258)' : 'transparent',
                color: subTab === id ? 'oklch(0.93 0.005 258)' : 'oklch(0.55 0.010 258)',
                border: subTab === id ? '1px solid oklch(1 0 0 / 10%)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === 'connections' && (
          <div className="space-y-4">
            <ApiSection />
            <ConnectionHealthSection />
            <QuantDataCredentialsSection />
            <QuantDataLoginRefreshSection />
            <SecuritySection />
          </div>
        )}

        {subTab === 'trading' && (
          <div className="space-y-4">
            <TickerSection />
            <StrategySection />
          </div>
        )}

        {subTab === 'system' && (
          <div className="space-y-4">
            <GeneralSection />
            <RefreshSection />
            <ServerSettingsSection />
            <BackupSection />
          </div>
        )}
      </div>
    </div>
  );
}
