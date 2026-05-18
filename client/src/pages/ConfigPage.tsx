/**
 * FORTRESS V3 — Config Page
 * Unified tab wrapper: Strategy · Settings · Scripts
 * Replaces three separate nav items with one coherent configuration page.
 */
import { useState } from 'react';
import { Target, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import StrategyPage from './StrategyPage';
import SettingsPage from './SettingsPage';
import ScriptsPage from './ScriptsPage';

type ConfigTab = 'strategy' | 'settings' | 'scripts';

const TABS: { id: ConfigTab; label: string; icon: React.ElementType; subtitle: string }[] = [
  { id: 'strategy', label: 'Strategy', icon: Target,   subtitle: 'Persona, regime matrix, signal mode, payoff sandbox' },
  { id: 'settings', label: 'Settings', icon: Settings, subtitle: 'Universe, entry criteria, position sizing, API config' },
  { id: 'scripts',  label: 'Scripts',  icon: Zap,      subtitle: 'Workflow automation — premarket, IV crush, EOD review' },
];

export default function ConfigPage() {
  const [tab, setTab] = useState<ConfigTab>('strategy');

  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen">
      {/* ── Page Header ── */}
      <div
        className="sticky top-0 z-30 px-6 py-3"
        style={{
          background: 'oklch(0.12 0.010 258 / 95%)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid oklch(1 0 0 / 8%)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-xl" style={{ color: 'oklch(0.93 0.005 258)' }}>
              Config
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'oklch(0.58 0.010 258)' }}>
              {active.subtitle}
            </p>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'text-[oklch(0.80_0.15_200)] border'
                    : 'hover:bg-[oklch(0.80_0.15_200_/_6%)]'
                )}
                style={isActive ? {
                  background: 'oklch(0.80 0.15 200 / 10%)',
                  borderColor: 'oklch(0.80 0.15 200 / 35%)',
                  color: 'oklch(0.80 0.15 200)',
                } : {
                  color: 'oklch(0.58 0.010 258)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div>
        {tab === 'strategy' && <StrategyPage embedded />}
        {tab === 'settings' && <SettingsPage embedded />}
        {tab === 'scripts'  && <ScriptsPage  embedded />}
      </div>
    </div>
  );
}
