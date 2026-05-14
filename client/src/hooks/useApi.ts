/**
 * FORTRESS V2 — API Hooks
 * All types and endpoints match the actual Fortress REST server responses.
 * Verified against live server at /openapi.json on 2026-05-14.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfig } from '@/contexts/ConfigContext';

// ─── /api/briefing ────────────────────────────────────────────────────────────

export interface BriefingAccount {
  net_liq: number;
  excess_liq: number;
  available_funds: number;
  base_cash: number | null;
  daily_pnl: number | null;
  unrealized_pnl: number | null;
  currency: string;
  fx_rate_eur_usd: number;
  eur_equivalent: {
    net_liq: number;
    excess_liq: number;
    available_funds: number;
  };
  thresholds: {
    available_funds_floor_usd: number;
    excess_liq_floor_usd: number;
    available_funds_ok: boolean;
    excess_liq_ok: boolean;
  };
}

export interface BriefingMacro {
  regime: string;   // e.g. "bearish", "neutral", "bullish"
  vix: number | null;
  vix_state: string;
}

export interface BriefingGreeks {
  portfolio_delta: number;
  portfolio_theta: number;
  portfolio_vega: number;
  delta_bias: string;
  positions_with_greeks: number;
  positions_total: number;
}

export interface BriefingConcentration {
  top: { ticker: string; pct: number }[];
  all: Record<string, number>;
  msft_warning: boolean;
}

export interface BriefingPacing {
  max_per_week: number;
  used: number;
  remaining: number;
  entries_this_week: string[];
}

export interface BriefingData {
  as_of: string;
  account: BriefingAccount;
  has_account_data: boolean;
  macro_regime: BriefingMacro;
  staleness: { hours: number; state: string; ocr_last_sync: string | null };
  pacing: BriefingPacing;
  concentration: BriefingConcentration;
  greeks: BriefingGreeks;
  actions: unknown[];
}

// ─── /api/positions ───────────────────────────────────────────────────────────

export interface Position {
  ticker: string;
  sec_type: string;
  currency: string;
  qty: number;
  avg_cost: number;
  expiry: string | null;
  strike: number;
  short_strike: number;
  long_strike: number | null;
  leg_direction: 'short' | 'long';
  right: 'C' | 'P' | null;
  multiplier: string;
  local_symbol: string;
  conid: number;
  current_delta: number | null;
  current_delta_source: string | null;
  delta_state: string;
  alert_state: string;
  net_liq_pct: number;
  dp_floor: number | null;
  strategy: string | null;
  notes: string;
  _ibkr_synced: boolean;
  _ibkr_sync_time: string;
  market_value: number;
  current_gamma?: number;
  current_theta?: number;
  current_vega?: number;
  current_iv?: number;
  current_mark?: number;
}

export interface PositionsResponse {
  as_of: string;
  ocr_last_sync: string | null;
  positions: Position[];
  concentration: Record<string, number>;
  totals: { net_liq: number; daily_pnl: number | null; unrealized_pnl: number | null };
}

// ─── /api/market-intelligence ─────────────────────────────────────────────────

export interface RegimeSignal {
  source: string;
  signal: string;
  weight: number;
  note: string;
}

export interface DarkPoolFloor {
  price: number;
  notional_m: number;
  contracts: number;
  trades: number;
}

export interface MarketIntelligence {
  as_of: string;
  ticker: string;
  session_date: string;
  current_price: number;
  regime: {
    overall: string;
    score: number;
    signals: RegimeSignal[];
    current_price?: number;
    dp_floor?: number;
    dp_ceiling?: number;
    net_drift?: number;
    gex_call_wall?: number;
    gex_put_wall?: number;
  };
  dark_pool?: {
    floors: DarkPoolFloor[];
    current_price: number;
  };
  gex?: {
    call_wall?: number;
    put_wall?: number;
    flip_zone?: number;
  } | null;
}

// ─── /api/candidates ──────────────────────────────────────────────────────────

export interface CandidateRow {
  ticker: string;
  price: number;
  ivr: number;           // IV rank 0–100
  current_iv: number;    // Current IV %
  hv20: number;          // 20-day HV %
  spread_pp: number;     // IV - HV spread in pp
  days_to_earnings: number;
  signal: string;
  concentration_pct: number;
  earnings_state: string;
  concentration_state: string;
  excluded: boolean;
  exclusion_reason: string | null;
  can_trade: boolean;
}

export interface CandidatesResponse {
  as_of: string;
  source: string;
  rows: CandidateRow[];
}

// ─── /api/alerts ──────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  ticker: string;
  severity: 'warn' | 'info' | 'critical';
  message: string;
  source: string;
  position_id?: string;
  created_at: string;
  snoozed: boolean;
}

export interface AlertsResponse {
  _last_updated: string;
  alerts: Alert[];
}

// ─── /api/manage/stop_loss_all ────────────────────────────────────────────────

export interface StopLossPosition {
  ticker: string;
  strategy: string;
  expiry: string;
  short_strike: number;
  current_delta: number;
  net_market_value: number;
  synthesized_id: string;
  verdict: 'ACT' | 'WATCH' | 'OK';
  recommended_action: string;
  signals: string[];
  reasons: string[];
}

export interface StopLossAllResponse {
  as_of: string;
  positions_evaluated: number;
  positions: StopLossPosition[];
}

// ─── /api/manage/roll_all ─────────────────────────────────────────────────────

export interface RollPosition {
  ticker: string;
  strategy: string;
  expiry: string;
  short_strike: number;
  current_delta: number;
  synthesized_id: string;
  roll_needed: boolean;
  urgency: 'URGENT' | 'SOON' | 'NONE';
  current_dte: number;
  dte_exempt: boolean;
  reasons: string[];
}

export interface RollAllResponse {
  as_of: string;
  positions_evaluated: number;
  positions: RollPosition[];
}

// ─── /api/manage/trade_report ─────────────────────────────────────────────────

export interface TradeReportCandidate {
  ticker: string;
  iv_rank: number;
  iv_pct: number | null;
  days_to_earnings: number;
  earnings_state: string;
  concentration_pct: number;
  has_existing_position: boolean;
  action: string;
}

export interface TradeReport {
  as_of: string;
  macro: { vix: number; regime: string; vix_state: string };
  entry_candidates: TradeReportCandidate[];
}

// ─── /api/chart/:ticker ───────────────────────────────────────────────────────

export interface Candle {
  time: number;   // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartLevels {
  dp_floors: number[];
  gex_calls: number[];
  gex_puts: number[];
}

export interface ChartData {
  ticker: string;
  period: string;
  interval: string;
  candles: Candle[];
  levels_source: string;
  levels: ChartLevels;
}

// ─── /api/universe ────────────────────────────────────────────────────────────

export interface UniverseResponse {
  tier1: string[];
  tier2: string[];
  macro: string[];
  excluded: { ticker: string; reason: string; until_cleared: boolean }[];
}

// ─── Legacy compat types (used by some pages) ─────────────────────────────────

/** @deprecated Use BriefingAccount directly */
export interface AccountSummary {
  net_liquidation: number;
  excess_liquidity: number;
  available_funds: number;
}

/** Entry signal for Candidates screener */
export type EntrySignal = 'STRONG_SELL' | 'SELL' | 'NEUTRAL' | 'WATCH' | 'NO_SIGNAL';

export interface CandidateEvaluation {
  signal: EntrySignal;
  label: string;
  reason: string;
  color: string;
}

/** Evaluates a candidate row for short-premium entry opportunity */
export function evaluateCandidate(
  c: CandidateRow,
  ivRankThreshold = 50,
  ivHvSpreadThreshold = 5,
): CandidateEvaluation {
  const rank = c.ivr;
  const spread = c.spread_pp;

  if (rank >= 80 && spread >= ivHvSpreadThreshold * 2) {
    return { signal: 'STRONG_SELL', label: 'Strong Sell Premium', reason: `IV rank ${rank.toFixed(0)} + IV/HV spread ${spread.toFixed(1)}pp`, color: 'oklch(0.65 0.22 25)' };
  }
  if (rank >= ivRankThreshold && spread >= ivHvSpreadThreshold) {
    return { signal: 'SELL', label: 'Sell Premium', reason: `IV rank ${rank.toFixed(0)} ≥ ${ivRankThreshold} + IV > HV by ${spread.toFixed(1)}pp`, color: 'oklch(0.78 0.18 85)' };
  }
  if (rank >= ivRankThreshold && spread < ivHvSpreadThreshold) {
    return { signal: 'WATCH', label: 'Watch — IV Rank OK', reason: `IV rank ${rank.toFixed(0)} but IV/HV spread thin (${spread.toFixed(1)}pp)`, color: 'oklch(0.80 0.15 200)' };
  }
  if (rank >= 35) {
    return { signal: 'NEUTRAL', label: 'Neutral', reason: `IV rank ${rank.toFixed(0)} — below entry threshold`, color: 'oklch(0.58 0.010 258)' };
  }
  return { signal: 'NO_SIGNAL', label: 'No Signal', reason: `IV rank ${rank.toFixed(0)} — IV compressed`, color: 'oklch(0.45 0.010 258)' };
}

// ─── P&L types (future endpoint) ─────────────────────────────────────────────

export interface PnLDataPoint {
  date: string;
  realised: number;
  unrealised: number;
  total: number;
  cumulative?: number;
}

export interface PnLByTicker {
  ticker: string;
  realised: number;
  unrealised: number;
  total: number;
  pct_of_net_liq?: number;
}

export interface PnLByStrategy {
  strategy: string;
  realised: number;
  unrealised: number;
  total: number;
}

export interface PnLSummary {
  period: 'daily' | 'weekly' | 'monthly';
  series: PnLDataPoint[];
  by_ticker: PnLByTicker[];
  by_strategy: PnLByStrategy[];
  total_realised: number;
  total_unrealised: number;
  total_net: number;
  best_day?: PnLDataPoint;
  worst_day?: PnLDataPoint;
  win_rate?: number;
  last_updated?: string;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Empty baseUrl = relative URL (same-origin nginx proxy)
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
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
    if (!path) return;
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
  return useApiData<PositionsResponse>('/api/positions');
}

export function useMarketIntelligence(ticker: string | null) {
  return useApiData<MarketIntelligence>(
    ticker ? `/api/market-intelligence?ticker=${ticker}` : null,
    [ticker],
  );
}

export function useCandidates() {
  return useApiData<CandidatesResponse>('/api/candidates');
}

export function useAlerts() {
  return useApiData<AlertsResponse>('/api/alerts');
}

export function useStopLossAll() {
  return useApiData<StopLossAllResponse>('/api/manage/stop_loss_all');
}

export function useRollAll() {
  return useApiData<RollAllResponse>('/api/manage/roll_all');
}

export function useTradeReport() {
  return useApiData<TradeReport>('/api/manage/trade_report');
}

export function usePnL(period: 'daily' | 'weekly' | 'monthly') {
  return useApiData<PnLSummary>(`/api/pnl?period=${period}`, [period]);
}

export function useChartData(ticker: string | null) {
  return useApiData<ChartData>(
    ticker ? `/api/chart/${ticker}` : null,
    [ticker],
  );
}

export function useHealth() {
  return useApiData<{ status: string; version?: string }>('/api/health');
}

export function useUniverse() {
  return useApiData<UniverseResponse>('/api/universe');
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calculates DTE from an ISO date string */
export function calcDte(expiry: string): number {
  const exp = new Date(expiry);
  const now = new Date();
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Formats a dollar value with commas */
export function formatDollar(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats a percentage value */
export function formatPct(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/** Maps regime string to display label and color */
export function regimeInfo(regime: string): { label: string; color: 'red' | 'amber' | 'green' | 'cyan' } {
  const r = regime.toLowerCase();
  if (r.includes('strongly_bearish') || r.includes('strongly bearish')) return { label: 'Strongly Bearish', color: 'red' };
  if (r.includes('bearish')) return { label: 'Bearish', color: 'red' };
  if (r.includes('mildly_bearish') || r.includes('mildly bearish')) return { label: 'Mildly Bearish', color: 'amber' };
  if (r.includes('neutral')) return { label: 'Neutral', color: 'amber' };
  if (r.includes('mildly_bullish') || r.includes('mildly bullish')) return { label: 'Mildly Bullish', color: 'green' };
  if (r.includes('bullish')) return { label: 'Bullish', color: 'green' };
  return { label: regime, color: 'amber' };
}
