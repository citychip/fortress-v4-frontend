/**
 * FORTRESS V2 — API Hooks
 * All data fetching uses the API URL and token from ConfigContext.
 * No hardcoded endpoints or credentials.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfig } from '@/contexts/ConfigContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountSummary {
  net_liquidation: number;
  excess_liquidity: number;
  available_funds: number;
  last_sync?: string;
}

export interface MacroRegime {
  regime_score: number;       // -4 to +4
  regime_label: string;       // e.g. "Bearish", "Neutral", "Bullish"
  spy_gex?: number;
  spy_dp_floor?: number;
  spy_net_drift?: number;
  entry_permitted: boolean;
  summary?: string;
}

export interface BriefingData {
  account: AccountSummary;
  macro: MacroRegime;
  today_actions: OrderRecommendation[];
  last_updated?: string;
}

export interface Position {
  id: string;
  ticker: string;
  right: 'C' | 'P';
  strike: number;
  expiry: string;
  qty: number;
  delta: number;
  mkt_val: number;
  iv?: number;
  pct_net_liq: number;
  strategy?: string;
  // Computed alert fields
  delta_alert?: boolean;
  dte?: number;
  roll_candidate?: boolean;
  stop_loss_alert?: boolean;
  concentration_alert?: boolean;
  underlying_price?: number;
}

export interface PositionGroup {
  ticker: string;
  legs: Position[];
  total_mkt_val: number;
  total_pct_net_liq: number;
  net_delta: number;
  alerts: string[];
}

export interface OrderRecommendation {
  id: string;
  urgency: 'URGENT' | 'THIS_WEEK' | 'WATCH';
  action: 'BUY' | 'SELL' | 'ROLL' | 'CLOSE' | 'ADJUST';
  ticker: string;
  right?: 'C' | 'P';
  strike?: number;
  expiry?: string;
  qty?: number;
  reason: string;
  detail?: string;
}

export interface MarketIntelligence {
  ticker: string;
  gex?: number;
  gex_walls?: number[];
  dp_floor?: number;
  dp_ceiling?: number;
  net_drift?: number;
  regime_score?: number;
  directional_bias?: 'bullish' | 'bearish' | 'neutral';
  trade_setups?: string[];
  last_updated?: string;
}

export interface CandidateData {
  ticker: string;
  /** Current 30-day implied volatility (0–1 scale, e.g. 0.28 = 28%) */
  iv: number;
  /** 30-day historical/realised volatility (0–1 scale) */
  hv: number;
  /** IV rank 0–100: where current IV sits relative to 52-week range */
  iv_rank?: number;
  /** IV percentile 0–100: % of days in past year where IV was lower */
  iv_percentile?: number;
  /** 52-week IV high */
  iv_52w_high?: number;
  /** 52-week IV low */
  iv_52w_low?: number;
  /** Underlying last price */
  last_price?: number;
  /** Underlying price change % today */
  price_change_pct?: number;
  /** Average daily volume */
  avg_volume?: number;
  /** Market cap tier: 'large' | 'mid' | 'small' */
  market_cap_tier?: string;
  /** API-provided signal label */
  signal?: string;
  /** Timestamp of last data update */
  last_updated?: string;
}

/** Entry signal derived from IV rank + IV/HV spread */
export type EntrySignal = 'STRONG_SELL' | 'SELL' | 'NEUTRAL' | 'WATCH' | 'NO_SIGNAL';

export interface CandidateEvaluation {
  signal: EntrySignal;
  label: string;
  reason: string;
  color: string;
}

/**
 * Evaluates a candidate ticker for short-premium entry opportunity.
 * Logic mirrors the workflow: elevated IV rank + IV > HV = premium selling edge.
 */
export function evaluateCandidate(
  c: CandidateData,
  ivRankThreshold = 50,
  ivHvSpreadThreshold = 0.05,
): CandidateEvaluation {
  const rank = c.iv_rank ?? c.iv_percentile ?? null;
  const spread = c.iv - c.hv;

  if (rank !== null && rank >= 80 && spread >= ivHvSpreadThreshold * 2) {
    return { signal: 'STRONG_SELL', label: 'Strong Sell Premium', reason: `IV rank ${rank.toFixed(0)} + IV/HV spread ${(spread * 100).toFixed(1)}pp`, color: 'oklch(0.65 0.22 25)' };
  }
  if (rank !== null && rank >= ivRankThreshold && spread >= ivHvSpreadThreshold) {
    return { signal: 'SELL', label: 'Sell Premium', reason: `IV rank ${rank.toFixed(0)} ≥ ${ivRankThreshold} + IV > HV by ${(spread * 100).toFixed(1)}pp`, color: 'oklch(0.78 0.18 85)' };
  }
  if (rank !== null && rank >= ivRankThreshold && spread < ivHvSpreadThreshold) {
    return { signal: 'WATCH', label: 'Watch — IV Rank OK', reason: `IV rank ${rank.toFixed(0)} but IV/HV spread thin (${(spread * 100).toFixed(1)}pp)`, color: 'oklch(0.80 0.15 200)' };
  }
  if (rank !== null && rank >= 35) {
    return { signal: 'NEUTRAL', label: 'Neutral', reason: `IV rank ${rank.toFixed(0)} — below entry threshold`, color: 'oklch(0.58 0.010 258)' };
  }
  return { signal: 'NO_SIGNAL', label: 'No Signal', reason: rank !== null ? `IV rank ${rank.toFixed(0)} — IV compressed` : 'Insufficient data', color: 'oklch(0.45 0.010 258)' };
}

export interface ChartData {
  ticker: string;
  prices: { date: string; close: number; volume?: number }[];
  sma_50?: number[];
  sma_200?: number[];
  support_levels?: number[];
  resistance_levels?: number[];
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Generic data hook ────────────────────────────────────────────────────────

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdated: Date | null;
}

function useApiData<T>(
  path: string | null,
  deps: unknown[] = [],
): UseApiResult<T> {
  const { config } = useConfig();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!path || !config.apiUrl) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(
        config.apiUrl,
        config.apiToken,
        path,
        { signal: abortRef.current.signal },
      );
      setData(result);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, config.apiUrl, config.apiToken, ...deps]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!config.autoRefresh || !path) return;
    const interval = setInterval(fetchData, config.refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [config.autoRefresh, config.refreshIntervalSec, fetchData, path]);

  return { data, loading, error, refresh: fetchData, lastUpdated };
}

// ─── Specific endpoint hooks ──────────────────────────────────────────────────

export function useBriefing() {
  return useApiData<BriefingData>('/api/briefing');
}

export function usePositions() {
  return useApiData<{ positions: Position[]; groups: PositionGroup[] }>('/api/positions');
}

export function useMarketIntelligence(ticker: string | null) {
  return useApiData<MarketIntelligence>(
    ticker ? `/api/market-intelligence?ticker=${ticker}` : null,
    [ticker],
  );
}

export function useCandidates() {
  return useApiData<{ candidates: CandidateData[] }>('/api/candidates');
}

export function useChartData(ticker: string | null) {
  return useApiData<ChartData>(
    ticker ? `/api/chart/${ticker}` : null,
    [ticker],
  );
}

export function useHealth() {
  return useApiData<{ status: string; timestamp: string }>('/api/health');
}

// ─── IBKR sync (POST) ─────────────────────────────────────────────────────────

export function useIbkrSync() {
  const { config } = useConfig();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/ibkr/sync', { method: 'POST' });
      setLastSync(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { triggerSync, syncing, error, lastSync };
}

// ─── Workflow evaluation helpers ──────────────────────────────────────────────

/**
 * Evaluates a position leg against strategy config thresholds.
 * Returns an array of alert strings.
 */
export function evaluateLeg(
  leg: Position,
  strategy: {
    deltaAlertThreshold: number;
    rollDteDays: number;
    maxSingleNamePct: number;
  },
): string[] {
  const alerts: string[] = [];

  // Delta breach check (short legs only — negative qty)
  if (leg.qty < 0 && Math.abs(leg.delta) >= strategy.deltaAlertThreshold) {
    alerts.push(`Delta ${Math.abs(leg.delta).toFixed(3)} ≥ ${strategy.deltaAlertThreshold} threshold`);
  }

  // DTE roll check
  if (leg.dte !== undefined && leg.qty < 0 && leg.dte <= strategy.rollDteDays) {
    alerts.push(`${leg.dte}d to expiry — roll window`);
  }

  // Concentration check
  if (leg.pct_net_liq > strategy.maxSingleNamePct) {
    alerts.push(`${leg.pct_net_liq.toFixed(1)}% Net Liq > ${strategy.maxSingleNamePct}% limit`);
  }

  return alerts;
}

/**
 * Derives a macro regime label from a numeric score (-4 to +4).
 */
export function regimeLabel(score: number): { label: string; color: 'red' | 'amber' | 'green' | 'cyan' } {
  if (score <= -3) return { label: 'Strongly Bearish', color: 'red' };
  if (score <= -1) return { label: 'Bearish', color: 'red' };
  if (score === 0) return { label: 'Neutral', color: 'amber' };
  if (score <= 2) return { label: 'Bullish', color: 'green' };
  return { label: 'Strongly Bullish', color: 'cyan' };
}

/**
 * Calculates DTE from an ISO date string.
 */
export function calcDte(expiry: string): number {
  const exp = new Date(expiry);
  const now = new Date();
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Formats a dollar value with commas and 2 decimal places.
 */
export function formatDollar(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a percentage value.
 */
export function formatPct(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
