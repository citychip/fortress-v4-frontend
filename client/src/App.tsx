/**
 * FORTRESS V2 — App Shell
 * Obsidian Edge design: persistent left sidebar, 6 tabs, dark theme always on.
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ConfigProvider, useConfig } from "./contexts/ConfigContext";
import { useHealth, useIbkrSync } from "./hooks/useApi";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  ListOrdered,
  BarChart2,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";

// Pages
import DashboardPage from "./pages/DashboardPage";
import PositionsPage from "./pages/PositionsPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import OrdersPage from "./pages/OrdersPage";
import AnalysisPage from "./pages/AnalysisPage";
import CandidatesPage from "./pages/CandidatesPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/positions',     label: 'Positions',     icon: BookOpen },
  { path: '/market-intel',  label: 'Market Intel',  icon: TrendingUp },
  { path: '/orders',        label: 'Orders',        icon: ListOrdered },
  { path: '/candidates',    label: 'Candidates',    icon: Crosshair },
  { path: '/analysis',      label: 'Analysis',      icon: BarChart2 },
  { path: '/settings',      label: 'Settings',      icon: Settings },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const [location] = useLocation();
  const { config } = useConfig();
  const { data: health, error: healthError } = useHealth();
  const { triggerSync, syncing } = useIbkrSync();

  const isConnected = !!health && !healthError;

  const handleSync = async () => {
    if (!config.apiToken) {
      toast.error('API token not configured', { description: 'Go to Settings to add your API token.' });
      return;
    }
    await triggerSync();
    toast.success('IBKR sync triggered', { description: 'Positions will update shortly.' });
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-40"
      style={{
        background: 'oklch(0.14 0.010 258)',
        borderRight: '1px solid oklch(1 0 0 / 8%)',
      }}
    >
      {/* Logo / Brand */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'oklch(0.80 0.15 200 / 20%)', border: '1px solid oklch(0.80 0.15 200 / 40%)' }}
          >
            <Shield className="w-4 h-4" style={{ color: 'oklch(0.80 0.15 200)' }} />
          </div>
          <div>
            <div className="font-display text-sm leading-tight" style={{ color: 'oklch(0.93 0.005 258)' }}>
              {config.dashboardName}
            </div>
            <div className="font-mono-data text-[10px]" style={{ color: 'oklch(0.58 0.010 258)' }}>
              Options Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <div
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 relative',
                  isActive
                    ? 'text-[oklch(0.80_0.15_200)]'
                    : 'text-[oklch(0.65_0.010_258)] hover:text-[oklch(0.85_0.005_258)] hover:bg-[oklch(1_0_0_/_5%)]'
                )}
                style={isActive ? {
                  background: 'oklch(0.80 0.15 200 / 12%)',
                  borderLeft: '2px solid oklch(0.80 0.15 200)',
                  paddingLeft: '10px',
                } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className={isActive ? 'font-medium' : ''}>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: connection status + IBKR sync */}
      <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        {/* API connection status */}
        <div className="flex items-center gap-2 px-1">
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5" style={{ color: 'oklch(0.72 0.18 145)' }} />
          ) : (
            <WifiOff className="w-3.5 h-3.5" style={{ color: 'oklch(0.65 0.22 25)' }} />
          )}
          <span className="font-mono-data text-[11px]" style={{ color: 'oklch(0.58 0.010 258)' }}>
            {isConnected ? 'API Connected' : config.apiToken ? 'API Offline' : 'No API Token'}
          </span>
        </div>

        {/* IBKR Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-all duration-150',
            'border',
            syncing
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:bg-[oklch(0.80_0.15_200_/_10%)] hover:border-[oklch(0.80_0.15_200_/_40%)]'
          )}
          style={{
            color: 'oklch(0.80 0.15 200)',
            borderColor: 'oklch(0.80 0.15 200 / 25%)',
            background: 'transparent',
          }}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
          {syncing ? 'Syncing IBKR…' : 'Sync IBKR'}
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
          <Route path="/"             component={DashboardPage} />
          <Route path="/positions"    component={PositionsPage} />
          <Route path="/market-intel" component={MarketIntelPage} />
          <Route path="/orders"       component={OrdersPage} />
          <Route path="/analysis"     component={AnalysisPage} />
          <Route path="/candidates"   component={CandidatesPage} />
          <Route path="/settings"     component={SettingsPage} />
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
      <Sidebar />
      <main className="flex-1 ml-56 overflow-y-auto">
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
        </ConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
