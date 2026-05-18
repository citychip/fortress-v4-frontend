/**
 * FORTRESS V3 — Trade Page
 * Unified tab wrapper: Scan (Morning Brief) · Candidates · Orders
 * Replaces three separate nav items with one coherent workflow page.
 */
import { useState } from 'react';
import { Activity, Crosshair, ListOrdered, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import MorningBriefPage from './MorningBriefPage';
import CandidatesPage from './CandidatesPage';
import OrdersPage from './OrdersPage';

type TradeTab = 'scan' | 'candidates' | 'orders';

const TABS: { id: TradeTab; label: string; icon: React.ElementType; subtitle: string }[] = [
  { id: 'scan',       label: 'Scan',       icon: Activity,     subtitle: 'Morning brief, trade report, regime context' },
  { id: 'candidates', label: 'Candidates', icon: Crosshair,    subtitle: 'IV rank screener, entry signals' },
  { id: 'orders',     label: 'Orders',     icon: ListOrdered,  subtitle: 'Stop-loss, roll, and alert recommendations' },
];

export default function TradePage() {
  const [tab, setTab] = useState<TradeTab>('scan');

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
              Trade
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
        {tab === 'scan'       && <MorningBriefPage embedded />}
        {tab === 'candidates' && <CandidatesPage   embedded />}
        {tab === 'orders'     && <OrdersPage       embedded />}
      </div>
    </div>
  );
}
