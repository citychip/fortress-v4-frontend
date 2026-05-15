/**
 * FORTRESS V2 — Settings Page
 * ALL configuration lives here — API URL, token, ticker universe, strategy parameters.
 * Stored in localStorage via ConfigContext. Nothing is hardcoded.
 * Supports export (without token) and import for backup/restore.
 */

import { useState, useCallback } from 'react';
import { useConfig, DEFAULT_CONFIG } from '@/contexts/ConfigContext';
import { PageHeader } from '@/components/PageHeader';
import { useHealth, useServerSettings, useTraderPresets, type TraderPreset } from '@/hooks/useApi';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

function TickerSection() {
  const { config, updateConfig } = useConfig();
  const [newTicker, setNewTicker] = useState('');

  const addTicker = () => {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    if (config.tickers.includes(t)) {
      toast.error(`${t} is already in your universe`);
      return;
    }
    updateConfig({ tickers: [...config.tickers, t] });
    setNewTicker('');
    toast.success(`Added ${t} to universe`);
  };

  const removeTicker = (t: string) => {
    updateConfig({ tickers: config.tickers.filter(x => x !== t) });
    toast.info(`Removed ${t} from universe`);
  };

  return (
    <Section
      title="Ticker Universe"
      description="Symbols to monitor across all tabs. Used for Market Intelligence, Analysis, and order generation."
    >
      {/* Current tickers */}
      <div className="flex flex-wrap gap-2 mb-4">
        {config.tickers.map(t => (
          <div
            key={t}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border"
            style={{
              background: 'oklch(0.22 0.010 258)',
              borderColor: 'oklch(1 0 0 / 12%)',
            }}
          >
            <span className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.85 0.005 258)' }}>
              {t}
            </span>
            <button
              onClick={() => removeTicker(t)}
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'oklch(0.55 0.010 258)' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {config.tickers.length === 0 && (
          <span className="text-xs" style={{ color: 'oklch(0.50 0.010 258)' }}>
            No tickers configured
          </span>
        )}
      </div>

      {/* Add ticker */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. AAPL)"
          className="flex-1 px-3 py-2 rounded border text-sm font-mono-data outline-none transition-all focus:border-[oklch(0.80_0.15_200_/_60%)]"
          style={{
            background: 'oklch(0.22 0.010 258)',
            borderColor: 'oklch(1 0 0 / 12%)',
            color: 'oklch(0.93 0.005 258)',
          }}
        />
        <button
          onClick={addTicker}
          className="flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
          style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
        >
          <Plus className="w-4 h-4" />
          Add
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
            placeholder="Fortress v2"
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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="All configuration — API, tickers, strategy parameters. Stored locally in your browser."
      />

      <div className="p-6 space-y-4 max-w-3xl">
        {/* Important notice */}
        <div
          className="rounded border p-3 text-xs"
          style={{ background: 'oklch(0.80 0.15 200 / 8%)', borderColor: 'oklch(0.80 0.15 200 / 25%)' }}
        >
          <span className="font-semibold" style={{ color: 'oklch(0.80 0.15 200)' }}>Note: </span>
          <span style={{ color: 'oklch(0.65 0.010 258)' }}>
            All settings are stored in your browser's localStorage. They persist across sessions but are
            specific to this browser. Use Export/Import to transfer settings to another device.
            The API token is never included in exports.
          </span>
        </div>

        <GeneralSection />
        <ApiSection />
        <TickerSection />
        <StrategySection />
        <RefreshSection />
        <ServerSettingsSection />
        <BackupSection />
      </div>
    </div>
  );
}
