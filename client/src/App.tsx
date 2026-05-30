/**
 * FORTRESS V3 — App Shell
 * Obsidian Edge design: collapsible icon-only sidebar (expands on hover),
 * persistent top status bar, dark theme always on.
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ConfigProvider, useConfig } from "./contexts/ConfigContext";
import { PendingOrdersProvider } from "./contexts/PendingOrdersContext";
import { useHealth, useIbkrSync, useBriefing, useMarketIntelligence, regimeInfo } from "./hooks/useApi";
import { useFortressStream } from "./hooks/useFortressStream";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  BarChart2,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  DollarSign,
  CalendarDays,
  Activity,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// Pages
import DashboardPage from "./pages/DashboardPage";
import PositionsPage from "./pages/PositionsPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import OrdersPage from "./pages/OrdersPage";
import AnalysisPage from "./pages/AnalysisPage";
import CandidatesPage from "./pages/CandidatesPage";
import PnLPage from "./pages/PnLPage";
import SettingsPage from "./pages/SettingsPage";
import EarningsPage from "./pages/EarningsPage";
import JournalPage from "./pages/JournalPage";
import ScriptsPage from "./pages/ScriptsPage";
import NotFound from "./pages/NotFound";
import MorningBriefPage from "./pages/MorningBriefPage";
import TradeBuilderPage from "./pages/TradeBuilderPage";
import StrategyPage from "./pages/StrategyPage";
import TradePage from "./pages/TradePage";
import PnLJournalPage from "./pages/PnLJournalPage";
import ConfigPage from "./pages/ConfigPage";
import ActionCenterPage from "./pages/ActionCenterPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import BuildCenterPage from "./pages/BuildCenterPage";

// ─── Nav items ────────────────────────────────────────────────────────────────

// ─── 8-item sidebar nav (LOCKED — do not add items without explicit request) ──
const NAV_ITEMS = [
  { path: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/market-intel',label: 'Market Intel',icon: TrendingUp },
  { path: '/positions',   label: 'Positions',   icon: BookOpen },
  { path: '/trade',       label: 'Trade',       icon: Activity },
  { path: '/analysis',    label: 'Analysis',    icon: BarChart2 },
  { path: '/performance', label: 'Performance', icon: DollarSign },
  { path: '/earnings',    label: 'Earnings',    icon: CalendarDays },
  { path: '/config',      label: 'Config',      icon: Settings },
];

// ─── Persistent Status Bar ────────────────────────────────────────────────────

function StatusBar() {
  const { config } = useConfig();
  // SSE: open one persistent connection that feeds briefing/positions/alerts into the query cache
  useFortressStream(config.apiToken || null);
  const { data: health, error: healthError } = useHealth();
  const { data: briefing } = useBriefing();
  const { data: spyIntel } = useMarketIntelligence(config.apiToken ? 'SPY' : null);

  const ibkrConnected = !!health && !healthError;
  const vix = briefing?.macro_regime?.vix ?? null;
  const vixState = briefing?.macro_regime?.vix_state ?? '';
  const spyPrice = spyIntel?.current_price ?? null;
  const regime = briefing?.macro_regime?.regime ?? null;

  // Market hours clock (ET) — handles weekends and correct premarket window
  const now = new Date();
  const etTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // Get ET date components for day-of-week and minute-of-day
  const etDateStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false });
  const etDow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay(); // 0=Sun, 6=Sat
  const etHourStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  const [etHH, etMM] = etHourStr.split(':').map(Number);
  const etMinuteOfDay = (isNaN(etHH) ? 0 : etHH) * 60 + (isNaN(etMM) ? 0 : etMM);
  const isWeekend = etDow === 0 || etDow === 6;
  // Pre-market: 4:00 AM – 9:29 AM ET on weekdays
  const isPreMarket = !isWeekend && etMinuteOfDay >= 240 && etMinuteOfDay < 570;
  // Regular hours: 9:30 AM – 4:00 PM ET on weekdays
  const isMarketHours = !isWeekend && etMinuteOfDay >= 570 && etMinuteOfDay < 960;
  // After-hours: 4:00 PM – 8:00 PM ET on weekdays
  const isAfterHours = !isWeekend && etMinuteOfDay >= 960 && etMinuteOfDay < 1200;
  const marketStatus = isMarketHours ? 'OPEN' : isPreMarket ? 'PRE' : isAfterHours ? 'AH' : isWeekend ? 'WKD' : 'CLOSED';
  const marketStatusColor = isMarketHours
    ? 'oklch(0.72 0.18 145)'
    : isPreMarket || isAfterHours
    ? 'oklch(0.78 0.18 85)'
    : 'oklch(0.45 0.010 258)';
  void etDateStr; // suppress unused warning

  const vixColor = vix == null
    ? 'oklch(0.58 0.010 258)'
    : vix > 30 ? 'oklch(0.65 0.22 25)'
    : vix > 20 ? 'oklch(0.78 0.18 85)'
    : 'oklch(0.72 0.18 145)';

  const regimeColor = regime === 'bullish'
    ? 'oklch(0.72 0.18 145)'
    : regime === 'bearish'
    ? 'oklch(0.65 0.22 25)'
    : 'oklch(0.78 0.18 85)';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3"
      style={{
        height: '28px',
        background: 'oklch(0.11 0.010 258)',
        borderBottom: '1px solid oklch(1 0 0 / 10%)',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <span style={{ color: 'oklch(0.80 0.15 200)', fontWeight: 600, letterSpacing: '0.05em' }}>
          FORTRESS V3
        </span>
      </div>

      {/* Center: Market data */}
      <div className="flex items-center gap-4">
        {/* IBKR status */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: ibkrConnected ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)',
              boxShadow: ibkrConnected ? '0 0 4px oklch(0.72 0.18 145 / 60%)' : 'none',
            }}
          />
          <span style={{ color: ibkrConnected ? 'oklch(0.72 0.18 145)' : 'oklch(0.55 0.010 258)' }}>
            IBKR
          </span>
        </div>

        {/* Separator */}
        <span style={{ color: 'oklch(0.30 0.010 258)' }}>│</span>

        {/* VIX */}
        <div className="flex items-center gap-1">
          <span style={{ color: 'oklch(0.45 0.010 258)' }}>VIX</span>
          <span style={{ color: vixColor }}>
            {vix != null ? vix.toFixed(1) : '—'}
          </span>
          {vixState && (
            <span style={{ color: 'oklch(0.40 0.010 258)' }}>
              {vixState.toUpperCase()}
            </span>
          )}
        </div>

        {/* Separator */}
        <span style={{ color: 'oklch(0.30 0.010 258)' }}>│</span>

        {/* SPY */}
        <div className="flex items-center gap-1">
          <span style={{ color: 'oklch(0.45 0.010 258)' }}>SPY</span>
          <span style={{ color: 'oklch(0.80 0.15 200)' }}>
            {spyPrice != null ? `$${spyPrice.toFixed(2)}` : '—'}
          </span>
        </div>

        {/* Separator */}
        <span style={{ color: 'oklch(0.30 0.010 258)' }}>│</span>

        {/* Regime */}
        {regime && (
          <>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" style={{ color: regimeColor }} />
              <span style={{ color: regimeColor }}>{regimeInfo(regime).label}</span>
            </div>
            <span style={{ color: 'oklch(0.30 0.010 258)' }}>│</span>
          </>
        )}

        {/* Market clock */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" style={{ color: 'oklch(0.45 0.010 258)' }} />
          <span style={{ color: 'oklch(0.60 0.010 258)' }}>{etTime} ET</span>
          <span
            className="px-1 rounded text-[9px] font-bold"
            style={{
              color: marketStatusColor,
              background: `${marketStatusColor}18`,
              border: `1px solid ${marketStatusColor}40`,
            }}
          >
            {marketStatus}
          </span>
        </div>
      </div>

      {/* Right: QuantData indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: config.apiToken ? 'oklch(0.72 0.18 145)' : 'oklch(0.40 0.010 258)',
          }}
        />
        <span style={{ color: 'oklch(0.40 0.010 258)' }}>QD</span>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const { config } = useConfig();
  const { triggerSync, syncing } = useIbkrSync();

  const handleSync = useCallback(async () => {
    if (!config.apiToken) {
      toast.error('API token not configured', { description: 'Go to Settings to add your API token.' });
      return;
    }
    await triggerSync();
    toast.success('IBKR sync triggered', { description: 'Positions will update shortly.' });
  }, [config.apiToken, triggerSync]);

  return (
    <aside
      className="fixed left-0 z-40 flex flex-col transition-all duration-200 ease-out"
      style={{
        top: '28px',
        height: 'calc(100vh - 28px)',
        width: expanded ? '208px' : '52px',
        background: 'oklch(0.14 0.010 258)',
        borderRight: '1px solid oklch(1 0 0 / 8%)',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: '52px',
          padding: '0 14px',
          borderBottom: '1px solid oklch(1 0 0 / 8%)',
          gap: '10px',
        }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: 'oklch(0.80 0.15 200 / 20%)', border: '1px solid oklch(0.80 0.15 200 / 40%)' }}
        >
          <Shield className="w-3.5 h-3.5" style={{ color: 'oklch(0.80 0.15 200)' }} />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="font-display text-sm leading-tight" style={{ color: 'oklch(0.93 0.005 258)' }}>
                {config.dashboardName || 'Fortress v4'}
              </div>
              <div className="font-mono-data text-[10px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
                Options Dashboard
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <div
                className={cn(
                  'flex items-center transition-all duration-150 relative cursor-pointer',
                  isActive
                    ? 'text-[oklch(0.80_0.15_200)]'
                    : 'text-[oklch(0.55_0.010_258)] hover:text-[oklch(0.85_0.005_258)] hover:bg-[oklch(1_0_0_/_5%)]'
                )}
                style={{
                  height: '40px',
                  padding: '0 14px',
                  gap: '12px',
                  ...(isActive ? {
                    background: 'oklch(0.80 0.15 200 / 12%)',
                    borderLeft: '2px solid oklch(0.80 0.15 200)',
                    paddingLeft: '12px',
                  } : {}),
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.12 }}
                      className="text-sm whitespace-nowrap overflow-hidden"
                      style={{ fontWeight: isActive ? 500 : 400 }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </Link>
          );
        })}

      </nav>
      {/* Bottom: IBKR sync */}
      <div
        className="flex-shrink-0"
        style={{ padding: '10px', borderTop: '1px solid oklch(1 0 0 / 8%)' }}
      >
        <button
          onClick={handleSync}
          disabled={syncing}
          title="Sync IBKR"
          className={cn(
            'flex items-center rounded transition-all duration-150',
            syncing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[oklch(0.80_0.15_200_/_10%)]'
          )}
          style={{
            width: '100%',
            height: '32px',
            padding: '0 8px',
            gap: '10px',
            color: 'oklch(0.80 0.15 200)',
            border: '1px solid oklch(0.80 0.15 200 / 25%)',
            background: 'transparent',
          }}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 flex-shrink-0', syncing && 'animate-spin')} />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.12 }}
                className="text-xs whitespace-nowrap overflow-hidden"
              >
                {syncing ? 'Syncing…' : 'Sync IBKR'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="h-full"
      >
        <Switch>
          {/* 8-item nav routes */}
          <Route path="/"             component={DashboardPage} />
          <Route path="/market-intel" component={MarketIntelPage} />
          <Route path="/positions"    component={PositionsPage} />
          <Route path="/trade"        component={() => <TradePage />} />
          <Route path="/analysis"     component={AnalysisPage} />
          <Route path="/performance"  component={() => <PnLJournalPage />} />
          <Route path="/earnings"     component={EarningsPage} />
          <Route path="/config"       component={() => <ConfigPage />} />
          {/* Deep-link routes (not in sidebar) */}
          <Route path="/morning-brief" component={() => <MorningBriefPage />} />
          <Route path="/trade-builder" component={() => <TradeBuilderPage />} />
          <Route path="/candidates"   component={() => <CandidatesPage />} />
          <Route path="/orders"       component={() => <OrdersPage />} />
          <Route path="/pnl"          component={() => <PnLPage />} />
          <Route path="/journal"      component={() => <JournalPage />} />
          <Route path="/strategy"     component={() => <StrategyPage />} />
          <Route path="/action"       component={() => <ActionCenterPage />} />
          <Route path="/approvals"    component={() => <ApprovalsPage />} />
          <Route path="/build"        component={() => <BuildCenterPage />} />
          <Route path="/settings"     component={() => <SettingsPage />} />
          <Route path="/scripts"      component={() => <ScriptsPage />} />
          <Route                      component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <StatusBar />
      <Sidebar />
      {/* Main content: offset by status bar height (28px) + collapsed sidebar width (52px) */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ marginTop: '28px', marginLeft: '52px' }}
      >
        <Router />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ConfigProvider>
          <PendingOrdersProvider>
            <TooltipProvider>
              <Toaster
                theme="dark"
                toastOptions={{
                  style: {
                    background: 'oklch(0.20 0.010 258)',
                    border: '1px solid oklch(1 0 0 / 12%)',
                    color: 'oklch(0.93 0.005 258)',
                  },
                }}
              />
              <AppShell />
            </TooltipProvider>
          </PendingOrdersProvider>
        </ConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
