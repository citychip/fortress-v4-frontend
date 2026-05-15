/**
 * FORTRESS V2 — ConfigContext
 * All user-configurable settings stored in localStorage.
 * Nothing is hardcoded — API URL, token, ticker universe, and all strategy
 * parameters are fully editable via the Settings tab.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';

export interface StrategyConfig {
  /** Delta threshold for short leg alert (default 0.40) */
  deltaAlertThreshold: number;
  /** DTE window to trigger roll evaluation (default 45) */
  rollDteDays: number;
  /** Max single-name concentration as % of Net Liq (default 20%) */
  maxSingleNamePct: number;
  /** Max sector concentration as % of Net Liq (default 40%) */
  maxSectorPct: number;
  /** Stop-loss: close position if underlying breaks 200-SMA (default true) */
  stopLoss200SMA: boolean;
  /** Minimum premium credit to keep a short leg open (default $50) */
  minPremiumCredit: number;
  /** Macro regime score threshold below which no new entries (default 0) */
  regimeEntryThreshold: number;
  /** IV rank threshold for Candidates screener entry signal (default 50) */
  ivRankThreshold: number;
  /** IV/HV spread threshold in decimal for Candidates screener (default 0.05 = 5pp) */
  ivHvSpreadThreshold: number;
}

export interface AppConfig {
  /** Fortress Dashboard REST API base URL */
  apiUrl: string;
  /** Bearer token for API authentication */
  apiToken: string;
  /** Ticker universe — list of symbols to monitor */
  tickers: string[];
  /** Strategy parameters */
  strategy: StrategyConfig;
  /** Whether to auto-refresh data (default true) */
  autoRefresh: boolean;
  /** Auto-refresh interval in seconds (default 60) */
  refreshIntervalSec: number;
  /** Dashboard name shown in sidebar header */
  dashboardName: string;
  /** DTE threshold below which a P&L leg shows the TRIAGE badge and click-to-analyse shortcut (default 7) */
  dteTriage: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  // Empty string = relative URL, so requests go to the same origin.
  // When served via nginx on port 3000, /api/* is proxied to port 8080 automatically.
  // Set this to an absolute URL only if running the dashboard on a different host.
  apiUrl: '',
  apiToken: '',
  tickers: ['MSFT', 'AVGO', 'NFLX', 'SPY', 'AMD', 'GOOGL', 'UNH', 'NVDA'],
  strategy: {
    deltaAlertThreshold: 0.40,
    rollDteDays: 45,
    maxSingleNamePct: 20,
    maxSectorPct: 40,
    stopLoss200SMA: true,
    minPremiumCredit: 50,
    regimeEntryThreshold: 0,
    ivRankThreshold: 50,
    ivHvSpreadThreshold: 0.05,
  },
  autoRefresh: true,
  refreshIntervalSec: 60,
  dashboardName: 'Fortress v2',
  dteTriage: 7,
};

const STORAGE_KEY = 'fortress_v2_config';

export type PrefsSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ConfigContextValue {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
  updateStrategy: (patch: Partial<StrategyConfig>) => void;
  resetConfig: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  /** Server-side prefs save status — use in Settings to show sync indicator */
  prefsSaveStatus: PrefsSaveStatus;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migration: if the stored apiUrl points to the old absolute port-8080 address,
        // clear it so requests go through the nginx proxy on the same origin instead.
        const OLD_ABSOLUTE_URLS = [
          'http://76.13.138.194:8080',
          'http://localhost:8080',
        ];
        if (OLD_ABSOLUTE_URLS.some(u => parsed.apiUrl === u)) {
          parsed.apiUrl = '';
        }
        // Deep merge with defaults to handle new fields added in updates
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          strategy: { ...DEFAULT_CONFIG.strategy, ...parsed.strategy },
        };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_CONFIG;
  });

  // ─── Server-side persistence ───────────────────────────────────────────────
  // Load prefs from server on mount (merges over localStorage, preserving local apiToken)
  const serverPrefs = trpc.prefs.get.useQuery(undefined, { retry: false });
  const savePrefs = trpc.prefs.save.useMutation();
  const serverPrefsApplied = useRef(false);

  useEffect(() => {
    if (serverPrefsApplied.current) return;
    if (!serverPrefs.data?.prefs) return;
    serverPrefsApplied.current = true;
    const remote = serverPrefs.data.prefs as Partial<AppConfig>;
    setConfig(prev => ({
      ...DEFAULT_CONFIG,
      ...remote,
      strategy: { ...DEFAULT_CONFIG.strategy, ...(remote.strategy ?? {}) },
      // Always keep the local apiToken — never overwrite with server value (it's stripped on save)
      apiToken: prev.apiToken,
    }));
  }, [serverPrefs.data]);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore storage errors
    }
  }, [config]);

  // Debounced save to server (1 s after last change, skip initial mount)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const { apiToken: _skip, ...safePrefs } = config;
      savePrefs.mutate({ prefs: safePrefs as unknown as Record<string, unknown> });
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const updateConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const updateStrategy = useCallback((patch: Partial<StrategyConfig>) => {
    setConfig(prev => ({
      ...prev,
      strategy: { ...prev.strategy, ...patch },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const exportConfig = useCallback(() => {
    // Export without the API token for safe sharing
    const safe = { ...config, apiToken: '' };
    return JSON.stringify(safe, null, 2);
  }, [config]);

  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      setConfig(prev => ({
        ...DEFAULT_CONFIG,
        ...parsed,
        strategy: { ...DEFAULT_CONFIG.strategy, ...parsed.strategy },
        // Preserve existing token if import doesn't include one
        apiToken: parsed.apiToken || prev.apiToken,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const prefsSaveStatus: PrefsSaveStatus =
    savePrefs.isPending ? 'saving'
    : savePrefs.isSuccess ? 'saved'
    : savePrefs.isError ? 'error'
    : 'idle';

  return (
    <ConfigContext.Provider value={{ config, updateConfig, updateStrategy, resetConfig, exportConfig, importConfig, prefsSaveStatus }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
