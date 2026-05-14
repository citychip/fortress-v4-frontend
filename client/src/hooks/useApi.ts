/**
 * FORTRESS V2 — API Hooks
 * All types and endpoints match the actual Fortress REST server responses.
 * Verified against live server at /openapi.json on 2026-05-14.
 * Extended 2026-05-14 with Tier 1+2 features: trade_report full shape,
 * pretrade_all, calendar, IBKR preview/status, journal, scripts, server settings,
 * universe management, chart levels + order flow.
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
  action: string;  // "NEW_ENTRY" | "ADD_TO_POSITION"
}

export interface TradeReportStopLoss {
  ticker: string;
  strategy: string;
  verdict: string;
  recommended_action: string;
  signals: string[];
  reasons: string[];
  synthesized_id: string;
  action: string;
}

export interface TradeReportExitCandidate {
  ticker: string;
  strategy: string;
  expiry: string;
  short_strike: number | null;
  net_market_value: number;
  net_liq_pct: number;
  synthesized_id: string;
  action: string;
  note: string;
}

export interface TradeReport {
  as_of: string;
  macro: { vix: number; regime: string; vix_state: string };
  entry_candidates: TradeReportCandidate[];
  roll_candidates: unknown[];
  stop_loss_alerts: TradeReportStopLoss[];
  exit_candidates: TradeReportExitCandidate[];
  post_earnings_candidates: unknown[];
  summary: {
    entry_candidates_count: number;
    roll_candidates_count: number;
    stop_loss_alerts_count: number;
    exit_candidates_count: number;
    post_earnings_count: number;
    urgent_actions: number;
  };
}

// ─── /api/manage/pretrade_all ─────────────────────────────────────────────────

export interface PretradeResult {
  ticker: string;
  verdict: 'PROCEED' | 'BLOCKED';
  failures: string[];
  days_to_earnings: number;
  earnings_state: string;
  concentration_pct: number;
  vix: number;
  excluded: boolean;
  exclusion_reason: string | null;
  has_leap: boolean;
}

export interface PretradeAllResponse {
  as_of: string;
  tickers_evaluated: number;
  results: PretradeResult[];
  summary: { proceed: number; blocked: number; vix: number; vix_regime: string };
}

// ─── /api/calendar ────────────────────────────────────────────────────────────

export interface EarningsEntry {
  next_earnings: string;
  confirmed: boolean;
  notes: string;
  days_to_earnings: number;
  status: 'clear' | 'approaching' | 'blackout' | 'past';
  _updated_at?: string;
  _source?: string;
}

export interface CalendarResponse {
  as_of: string;
  tickers: Record<string, EarningsEntry>;
}

// ─── /api/ibkr/status ────────────────────────────────────────────────────────

export interface IbkrWebApiStatus {
  configured: boolean;
  gateway_url: string;
  session_status: {
    reachable: boolean;
    connected: boolean;
    authenticated: boolean;
    established: boolean;
    competing: boolean;
    ssoExpires_ms: number | null;
    error: string | null;
  };
  account: string | null;
  opra_subscribed: boolean;
  opra_test: {
    opra_subscribed: boolean;
    method: string;
    test_conid: number;
    test_delta: string;
    test_iv: string;
    test_at: string;
  } | null;
  error: string | null;
}

export interface IbkrStatus {
  checked_at: string;
  tws_gateway: { configured: boolean; reachable: boolean; connected: boolean; account: string | null; error: string | null };
  web_api: IbkrWebApiStatus;
  resolution_hint: string;
  settings_value: string;
  active_backend: string;
  fallback_backend: string;
}

// ─── /api/ibkr/preview ───────────────────────────────────────────────────────

export interface IbkrPreviewPosition {
  ticker: string;
  strategy: string | null;
  qty: number;
  expiry: string | null;
  strike: number;
  right: 'C' | 'P' | null;
  current_delta: number | null;
  market_value: number;
}

export interface IbkrPreview {
  backend: string;
  dry_run: boolean;
  positions_count: number;
  aggregated_count: number;
  net_liq: number;
  excess_liquidity: number;
  available_funds: number;
  daily_pnl: number | null;
  unrealized_pnl: number | null;
  positions_preview: IbkrPreviewPosition[];
}

// ─── /api/journal ─────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  ticker: string;
  strategy: string;
  action: 'OPEN' | 'CLOSE' | 'ROLL' | 'ADJUST' | 'NOTE';
  description: string;
  created_at: string;
  realized_pnl?: number | null;
  tags?: string[];
}

export interface JournalMetrics {
  total_realized_30d: number;
  closed_positions_30d: number;
  pcs_hit_rate_pct: number | null;
  framework_violations_30d: number;
}

export interface JournalResponse {
  as_of: string;
  entries: JournalEntry[];
  metrics: JournalMetrics;
}

export interface JournalSuggestResponse {
  suggestion: { ticker: string; strategy: string; action: string; description: string };
  last_sync: string;
  message: string;
}

// ─── /api/run/scripts ────────────────────────────────────────────────────────

export interface ScriptInfo {
  key: string;
  filename: string;
}

export interface ScriptsResponse {
  scripts: ScriptInfo[];
}

export interface TimeOfDayResponse {
  time_of_day: string;   // "premarket" | "market" | "afterhours"
  market_open: boolean;
  timestamp: string;
}

// ─── /api/settings ───────────────────────────────────────────────────────────

export interface ServerSettings {
  trader_profile: {
    trader_type: string;
    active_strategies: string[];
    risk_tolerance: string;
    primary_objective: string;
  };
  strategy: Record<string, number | string | boolean>;
  [key: string]: unknown;
}

export interface TraderPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  strategies: string[];
  risk_tolerance: string;
  primary_objective: string;
}

export interface TraderPresetsResponse {
  presets: TraderPreset[];
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

export interface ChartLevelsResponse {
  ticker: string;
  as_of: string;
  support: number[];
  resistance: number[];
  sma200: number | null;
  sma50: number | null;
  dp_floors: number[];
}

export interface OrderFlowBar {
  time: number;
  buy_volume: number;
  sell_volume: number;
  delta: number;
  cumulative_delta: number;
}

export interface OrderFlowResponse {
  ticker: string;
  as_of: string;
  bars: OrderFlowBar[];
  net_delta: number;
  buy_pct: number;
  sell_pct: number;
}

// ─── /api/universe ────────────────────────────────────────────────────────────

export interface UniverseResponse {
  tier1: string[];
  tier2: string[];
  macro: string[];
  excluded: { ticker: string; reason: string; until_cleared: boolean; note?: string }[];
}

// ─── /api/manage/spy_hedge_coverage ──────────────────────────────────────────

export interface SpyHedgeCoverage {
  hedge_market_value: number;
  hedge_net_market_value: number;
  hedge_pct_of_netliq: number;
  target_min: number;
  target_max: number;
  coverage_ok: boolean;
  legs_count: number;
  source: string;
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

export async function apiFetch<T>(
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

export function usePretradeAll() {
  return useApiData<PretradeAllResponse>('/api/manage/pretrade_all');
}

export function useCalendar() {
  return useApiData<CalendarResponse>('/api/calendar');
}

export function useIbkrStatus() {
  return useApiData<IbkrStatus>('/api/ibkr/status');
}

export function useIbkrPreview() {
  return useApiData<IbkrPreview>('/api/ibkr/preview');
}

export function useJournal() {
  return useApiData<JournalResponse>('/api/journal');
}

export function useJournalSuggest() {
  return useApiData<JournalSuggestResponse>('/api/journal/suggest');
}

export function useScripts() {
  return useApiData<ScriptsResponse>('/api/run/scripts');
}

export function useTimeOfDay() {
  return useApiData<TimeOfDayResponse>('/api/run/time_of_day');
}

export function useServerSettings() {
  return useApiData<ServerSettings>('/api/settings');
}

export function useTraderPresets() {
  return useApiData<TraderPresetsResponse>('/api/settings/trader_presets');
}

export function useSpyHedgeCoverage() {
  return useApiData<SpyHedgeCoverage>('/api/manage/spy_hedge_coverage');
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

export function useChartLevels(ticker: string | null) {
  return useApiData<ChartLevelsResponse>(
    ticker ? `/api/chart/${ticker}/levels` : null,
    [ticker],
  );
}

export function useOrderFlow(ticker: string | null) {
  return useApiData<OrderFlowResponse>(
    ticker ? `/api/chart/${ticker}/order_flow` : null,
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

// ─── Alert management (PATCH/DELETE) ─────────────────────────────────────────

export function useAlertActions() {
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snoozeAlert = useCallback(async (alertId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ snoozed: true }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to snooze alert');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const dismissAlert = useCallback(async (alertId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/alerts/${alertId}`, {
        method: 'DELETE',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss alert');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const refreshAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/manage/monitor_alerts', { method: 'POST' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh alerts');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { snoozeAlert, dismissAlert, refreshAlerts, loading, error };
}

// ─── Journal actions (POST/DELETE) ───────────────────────────────────────────

export function useJournalActions() {
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEntry = useCallback(async (entry: Partial<JournalEntry>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<JournalEntry>(config.apiUrl, config.apiToken, '/api/journal', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create journal entry');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const deleteEntry = useCallback(async (entryId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/journal/${entryId}`, { method: 'DELETE' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete journal entry');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { createEntry, deleteEntry, loading, error };
}

// ─── Script runner (POST) ────────────────────────────────────────────────────

export function useScriptRunner() {
  const { config } = useConfig();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const runScript = useCallback(async (scriptKey: string) => {
    setRunning(scriptKey);
    setError(null);
    try {
      const result = await apiFetch<unknown>(config.apiUrl, config.apiToken, `/api/run/${scriptKey}`, { method: 'POST' });
      setResults(prev => ({ ...prev, [scriptKey]: result }));
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Script failed');
      throw err;
    } finally {
      setRunning(null);
    }
  }, [config.apiUrl, config.apiToken]);

  return { runScript, running, results, error };
}

// ─── Server settings actions ─────────────────────────────────────────────────

export function useServerSettingsActions() {
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSection = useCallback(async (section: string, data: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/settings/${section}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const applyPreset = useCallback(async (presetId: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/settings/apply_preset', {
        method: 'POST',
        body: JSON.stringify({ preset_id: presetId }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply preset');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { updateSection, applyPreset, loading, error };
}

// ─── Universe management actions ─────────────────────────────────────────────

export function useUniverseActions() {
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTicker = useCallback(async (ticker: string, tier: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/universe/add', {
        method: 'POST',
        body: JSON.stringify({ ticker, tier }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add ticker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const removeTicker = useCallback(async (tier: string, ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/universe/${tier}/${ticker}`, { method: 'DELETE' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove ticker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const excludeTicker = useCallback(async (ticker: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/universe/exclude', {
        method: 'POST',
        body: JSON.stringify({ ticker, reason }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to exclude ticker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const unexcludeTicker = useCallback(async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/universe/exclude/${ticker}`, { method: 'DELETE' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to un-exclude ticker');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { addTicker, removeTicker, excludeTicker, unexcludeTicker, loading, error };
}

// ─── Calendar actions ─────────────────────────────────────────────────────────

export function useCalendarActions() {
  const { config } = useConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEarnings = useCallback(async (ticker: string, data: Partial<EarningsEntry>) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/calendar/${ticker}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update earnings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const confirmEarnings = useCallback(async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, `/api/calendar/${ticker}/confirm`, { method: 'POST' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm earnings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(config.apiUrl, config.apiToken, '/api/calendar/fetch-earnings', { method: 'POST' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch earnings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, config.apiToken]);

  return { updateEarnings, confirmEarnings, fetchEarnings, loading, error };
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
