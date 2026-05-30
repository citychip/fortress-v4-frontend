/**
 * FORTRESS V3 — ConfigContext
 * All user-configurable settings stored in localStorage.
 * Nothing is hardcoded — API URL, token, ticker universe, and all strategy
 * parameters are fully editable via the Settings tab.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';

// ─── Trader Persona ────────────────────────────────────────────────────────────
export type TraderPersona =
  | 'income_seeker'
  | 'strategic_speculator'
  | 'volatility_trader'
  | 'portfolio_protector'
  | 'pmcc_income';

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type PrimaryObjective = 'income' | 'growth' | 'protection';

// ─── Signal Mode ───────────────────────────────────────────────────────────────
/** Controls how the dashboard interprets strategy violations across all views */
export type SignalMode = 'strict' | 'advisory' | 'sandbox';

// ─── Active Strategies ─────────────────────────────────────────────────────────
export type StrategyType =
  | 'CSP' | 'PMCC' | 'COVERED_CALL'                              // Income
  | 'BULL_CALL_SPREAD' | 'BEAR_PUT_SPREAD' | 'BULL_PUT_SPREAD' | 'BEAR_CALL_SPREAD' | 'LEAPS'  // Directional
  | 'IRON_CONDOR' | 'SHORT_STRANGLE' | 'SHORT_STRADDLE' | 'IRON_BUTTERFLY' | 'JADE_LIZARD'     // Volatility
  | 'COLLAR' | 'PROTECTIVE_PUT' | 'SPY_HEDGE';                   // Protection

// ─── Strategy Parameters ───────────────────────────────────────────────────────
export interface StrategyConfig {
  // ── Entry Rules ──
  /** Delta threshold for short leg alert (default 0.40) */
  deltaAlertThreshold: number;
  /** Upper delta bound for new entries (default 0.7) */
  deltaEntryMax: number;
  /** Critical gamma delta threshold (default 0.70) */
  criticalGammaDelta: number;
  /** Target DTE for new entries (default 45) */
  targetDte: number;
  /** Minimum DTE for new entries (default 21) */
  minDteEntry: number;
  /** IV rank threshold for Candidates screener entry signal (default 50) */
  ivRankThreshold: number;
  /** IV/HV spread threshold in decimal for Candidates screener (default 0.05 = 5pp) */
  ivHvSpreadThreshold: number;
  /** High IV threshold for regime-based strategy selection (default 50) */
  ivHighThreshold: number;
  /** Macro regime score threshold below which no new entries (default 0) */
  regimeEntryThreshold: number;

  // ── Cut & Roll Rules ──
  /** DTE window to trigger roll evaluation (default 45) */
  rollDteDays: number;
  /** Profit target % of max profit to close early (default 0.5 = 50%) */
  profitTargetPct: number;
  /** Stop-loss drawdown threshold as multiple of credit received (default 2.0) */
  stopLossMultiplier: number;
  /** Stop-loss: close position if underlying breaks 200-SMA (default true) */
  stopLoss200SMA: boolean;
  /** Stop-loss 200-SMA buffer % (default 0.02 = 2%) */
  stopLoss200SMABuffer: number;

  // ── Sizing & Pacing ──
  /** Max open positions across portfolio (default 20) */
  maxOpenPositions: number;
  /** Strikes per week pacing cap (default 5) */
  strikesPerWeekCap: number;
  /** Max single-name concentration as % of Net Liq (default 20%) */
  maxSingleNamePct: number;
  /** Single ticker concentration cap % (default 10) */
  singleTickerConcentrationCap: number;
  /** Minimum premium credit to keep a short leg open (default $50) */
  minPremiumCredit: number;

  // ── Income Strategies ──
  /** Min CSP credit (default $1.00) */
  minCspCredit: number;
  /** Min PMCC call credit (default $0.50) */
  minPmccCredit: number;
  /** Min Covered Call credit (default $0.50) */
  minCoveredCallCredit: number;

  // ── Volatility Strategies ──
  /** Iron Condor short delta (default 0.16) */
  ironCondorShortDelta: number;
  /** Iron Condor wing width (default 5) */
  ironCondorWingWidth: number;
  /** Strangle/Straddle target DTE (default 30) */
  strangleTargetDte: number;

  // ── Directional Strategies ──
  /** Vertical spread width (default 5) */
  verticalSpreadWidth: number;
  /** LEAPS minimum DTE at entry (default 365) */
  leapsMinDte: number;

  // ── Protection Strategies ──
  /** Collar short delta (default 0.25) */
  collarShortDelta: number;
  /** Protective put delta (default 0.3) */
  protectivePutDelta: number;
  /** SPY hedge MV target — min (default 20000) */
  spyHedgeTargetMin: number;
  /** SPY hedge MV target — max (default 30000) */
  spyHedgeTargetMax: number;

  // ── Other ──
  /** Portfolio theta target % of Net Liq per day (default 0.001 = 0.1%) */
  portfolioThetaTarget: number;
  /** Portfolio long bias threshold (default 5000) */
  portfolioLongBiasThreshold: number;
  /** Portfolio short bias threshold (default -5000) */
  portfolioShortBiasThreshold: number;
  /** Available funds floor (default 17000) */
  availableFundsFloor: number;
  /** Excess liquidity floor (default 25000) */
  excessLiquidityFloor: number;
  /** Prime entry gap high (default 0) */
  primeEntryGapHigh: number;
  /** VIX high regime threshold (default 25) */
  vixHighRegime: number;
  /** VIX extreme regime threshold (default 35) */
  vixExtremeRegime: number;
  /** Min Strangle credit (default 0.5) */
  minStrangleCredit: number;
  /** Max long option cost (% Net Liq) (default 0.05 = 5%) */
  maxLongOptionCostPct: number;
  /** Long call target delta (default 0.3) */
  longCallTargetDelta: number;
  /** Long put target delta (default 0.3) */
  longPutTargetDelta: number;
  /** Butterfly body width (default 5) */
  butterflyBodyWidth: number;
  /** LEAPS profit take (default 10) */
  leapsProfitTake: number;
  /** LEAPS scale-out tranche (default 25) */
  leapsScaleOutTranche: number;
  /** LEAPS earnings blackout (default 21) */
  leapsEarningsBlackout: number;
  /** Max sector concentration as % of Net Liq (default 40%) — kept for backward compat */
  maxSectorPct: number;
}

// ─── Trader Profile ────────────────────────────────────────────────────────────
export interface TraderProfile {
  persona: TraderPersona;
  activeStrategies: StrategyType[];
  riskTolerance: RiskTolerance;
  primaryObjective: PrimaryObjective;
  signalMode: SignalMode;
  /** Session-only DTE override (not saved to profile unless explicitly saved) */
  sessionDteOverride?: number;
  /** Session-only delta buffer override */
  sessionDeltaBuffer?: number;
}

export const DEFAULT_TRADER_PROFILE: TraderProfile = {
  persona: 'pmcc_income',
  activeStrategies: ['PMCC', 'CSP', 'IRON_CONDOR', 'JADE_LIZARD', 'COVERED_CALL'],
  riskTolerance: 'moderate',
  primaryObjective: 'income',
  signalMode: 'advisory',
};

export interface StrategyConfig {
  deltaAlertThreshold: number;
  deltaEntryMax: number;
  criticalGammaDelta: number;
  targetDte: number;
  minDteEntry: number;
  ivRankThreshold: number;
  ivHvSpreadThreshold: number;
  ivHighThreshold: number;
  regimeEntryThreshold: number;
  rollDteDays: number;
  profitTargetPct: number;
  stopLossMultiplier: number;
  stopLoss200SMA: boolean;
  stopLoss200SMABuffer: number;
  maxOpenPositions: number;
  strikesPerWeekCap: number;
  maxSingleNamePct: number;
  singleTickerConcentrationCap: number;
  minPremiumCredit: number;
  minCspCredit: number;
  minPmccCredit: number;
  minCoveredCallCredit: number;
  ironCondorShortDelta: number;
  ironCondorWingWidth: number;
  strangleTargetDte: number;
  verticalSpreadWidth: number;
  leapsMinDte: number;
  collarShortDelta: number;
  protectivePutDelta: number;
  spyHedgeTargetMin: number;
  spyHedgeTargetMax: number;
  portfolioThetaTarget: number;
  portfolioLongBiasThreshold: number;
  portfolioShortBiasThreshold: number;
  availableFundsFloor: number;
  excessLiquidityFloor: number;
  primeEntryGapHigh: number;
  vixHighRegime: number;
  vixExtremeRegime: number;
  minStrangleCredit: number;
  maxLongOptionCostPct: number;
  longCallTargetDelta: number;
  longPutTargetDelta: number;
  butterflyBodyWidth: number;
  leapsProfitTake: number;
  leapsScaleOutTranche: number;
  leapsEarningsBlackout: number;
}

export interface AppConfig {
  apiUrl: string;
  apiToken: string;
  tickers: string[];
  strategy: StrategyConfig;
  traderProfile: TraderProfile;
  autoRefresh: boolean;
  refreshIntervalSec: number;
  dashboardName: string;
  dteTriage: number;
}

export const DEFAULT_STRATEGY: StrategyConfig = {
  deltaAlertThreshold: 0.40,
  deltaEntryMax: 0.7,
  criticalGammaDelta: 0.70,
  targetDte: 45,
  minDteEntry: 21,
  ivRankThreshold: 50,
  ivHvSpreadThreshold: 0.05,
  ivHighThreshold: 50,
  regimeEntryThreshold: 0,
  rollDteDays: 45,
  profitTargetPct: 0.50,
  stopLossMultiplier: 2.0,
  stopLoss200SMA: true,
  stopLoss200SMABuffer: 0.02,
  maxOpenPositions: 20,
  strikesPerWeekCap: 5,
  maxSingleNamePct: 20,
  singleTickerConcentrationCap: 10,
  minPremiumCredit: 50,
  minCspCredit: 1.0,
  minPmccCredit: 0.5,
  minCoveredCallCredit: 0.5,
  ironCondorShortDelta: 0.16,
  ironCondorWingWidth: 5,
  strangleTargetDte: 30,
  verticalSpreadWidth: 5,
  leapsMinDte: 365,
  collarShortDelta: 0.25,
  protectivePutDelta: 0.3,
  spyHedgeTargetMin: 20000,
  spyHedgeTargetMax: 30000,
  portfolioThetaTarget: 0.001,
  portfolioLongBiasThreshold: 5000,
  portfolioShortBiasThreshold: -5000,
  availableFundsFloor: 17000,
  excessLiquidityFloor: 25000,
  primeEntryGapHigh: 0,
  vixHighRegime: 25,
  vixExtremeRegime: 35,
  minStrangleCredit: 0.5,
  maxLongOptionCostPct: 0.05,
  longCallTargetDelta: 0.3,
  longPutTargetDelta: 0.3,
  butterflyBodyWidth: 5,
  leapsProfitTake: 10,
  leapsScaleOutTranche: 25,
  leapsEarningsBlackout: 21,
  maxSectorPct: 40,
};

export const DEFAULT_CONFIG: AppConfig = {
  apiUrl: '',
  apiToken: '',
  tickers: ['MSFT', 'AVGO', 'NFLX', 'SPY', 'AMD', 'GOOGL', 'UNH', 'NVDA'],
  strategy: DEFAULT_STRATEGY,
  traderProfile: DEFAULT_TRADER_PROFILE,
  autoRefresh: true,
  refreshIntervalSec: 60,
  dashboardName: 'Fortress v4',
  dteTriage: 7,
};

const STORAGE_KEY = 'fortress_v2_config';

export type PrefsSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Strategy Profile Backup/Restore ──────────────────────────────────────────
export interface StrategyProfileSnapshot {
  version: '1.0';
  exportedAt: string;
  profileName: string;
  traderProfile: TraderProfile;
  strategy: StrategyConfig;
}

export function exportStrategyProfile(config: AppConfig, profileName?: string): string {
  const snapshot: StrategyProfileSnapshot = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profileName: profileName ?? `Fortress Profile ${new Date().toLocaleDateString()}`,
    traderProfile: config.traderProfile,
    strategy: config.strategy,
  };
  return JSON.stringify(snapshot, null, 2);
}

export function downloadStrategyProfile(config: AppConfig, profileName?: string): void {
  const json = exportStrategyProfile(config, profileName);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fortress-strategy-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ConfigContextValue {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
  updateStrategy: (patch: Partial<StrategyConfig>) => void;
  updateTraderProfile: (patch: Partial<TraderProfile>) => void;
  setSignalMode: (mode: SignalMode) => void;
  resetConfig: () => void;
  resetStrategyToDefaults: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  /** Import only strategy profile + trader profile from a snapshot JSON */
  importStrategyProfile: (json: string) => { ok: boolean; profileName?: string; error?: string };
  prefsSaveStatus: PrefsSaveStatus;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const OLD_ABSOLUTE_URLS = [
          'http://76.13.138.194:8080',
          'http://localhost:8080',
        ];
        if (OLD_ABSOLUTE_URLS.some(u => parsed.apiUrl === u)) {
          parsed.apiUrl = '';
        }
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          strategy: { ...DEFAULT_STRATEGY, ...parsed.strategy },
          traderProfile: { ...DEFAULT_TRADER_PROFILE, ...parsed.traderProfile },
        };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_CONFIG;
  });

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
      strategy: { ...DEFAULT_STRATEGY, ...(remote.strategy ?? {}) },
      traderProfile: { ...DEFAULT_TRADER_PROFILE, ...(remote.traderProfile ?? {}) },
      apiToken: prev.apiToken,
    }));
  }, [serverPrefs.data]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore storage errors
    }
  }, [config]);

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

  const updateTraderProfile = useCallback((patch: Partial<TraderProfile>) => {
    setConfig(prev => ({
      ...prev,
      traderProfile: { ...prev.traderProfile, ...patch },
    }));
  }, []);

  const setSignalMode = useCallback((mode: SignalMode) => {
    setConfig(prev => ({
      ...prev,
      traderProfile: { ...prev.traderProfile, signalMode: mode },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const resetStrategyToDefaults = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      strategy: DEFAULT_STRATEGY,
      traderProfile: DEFAULT_TRADER_PROFILE,
    }));
  }, []);

  const exportConfig = useCallback(() => {
    const safe = { ...config, apiToken: '' };
    return JSON.stringify(safe, null, 2);
  }, [config]);

  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      setConfig(prev => ({
        ...DEFAULT_CONFIG,
        ...parsed,
        strategy: { ...DEFAULT_STRATEGY, ...parsed.strategy },
        traderProfile: { ...DEFAULT_TRADER_PROFILE, ...parsed.traderProfile },
        apiToken: parsed.apiToken || prev.apiToken,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const importStrategyProfile = useCallback((json: string): { ok: boolean; profileName?: string; error?: string } => {
    try {
      const snapshot = JSON.parse(json) as Partial<StrategyProfileSnapshot>;
      if (snapshot.version !== '1.0') {
        return { ok: false, error: 'Unrecognised profile format (expected version 1.0)' };
      }
      if (!snapshot.traderProfile || !snapshot.strategy) {
        return { ok: false, error: 'Profile file is missing traderProfile or strategy fields' };
      }
      setConfig(prev => ({
        ...prev,
        strategy: { ...DEFAULT_STRATEGY, ...snapshot.strategy },
        traderProfile: { ...DEFAULT_TRADER_PROFILE, ...snapshot.traderProfile },
      }));
      return { ok: true, profileName: snapshot.profileName };
    } catch (e) {
      return { ok: false, error: `Parse error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }, []);

  const prefsSaveStatus: PrefsSaveStatus =
    savePrefs.isPending ? 'saving'
    : savePrefs.isSuccess ? 'saved'
    : savePrefs.isError ? 'error'
    : 'idle';

  return (
    <ConfigContext.Provider value={{
      config,
      updateConfig,
      updateStrategy,
      updateTraderProfile,
      setSignalMode,
      resetConfig,
      resetStrategyToDefaults,
      exportConfig,
      importConfig,
      importStrategyProfile,
      prefsSaveStatus,
    }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
