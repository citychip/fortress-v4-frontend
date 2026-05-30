/**
 * TradePage — Phase 2 nav redesign
 * Execution hub: order builder, pending orders, IBKR submission.
 * Candidate screening moved to ResearchPage (/research).
 */
import { ListOrdered, Wrench } from 'lucide-react';
import { useState } from 'react';
import OrdersPage from './OrdersPage';
import TradeBuilderPage from './TradeBuilderPage';

type TradeTab = 'builder' | 'orders';

const TABS: { id: TradeTab; label: string; subtitle: string }[] = [
  { id: 'builder', label: 'Trade Builder', subtitle: 'Construct and stage orders' },
  { id: 'orders',  label: 'Orders',        subtitle: 'Pending, submitted, and alert queue' },
];

export default function TradePage() {
  const [tab, setTab] = useState<TradeTab>('builder');
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 flex gap-1 px-6 pt-4 pb-0"
        style={{ background: 'oklch(0.13 0.010 258)', borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
        {TABS.map(({ id, label, subtitle }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all"
              style={{
                borderBottomColor: isActive ? 'oklch(0.80 0.15 200)' : 'transparent',
                color: isActive ? 'oklch(0.80 0.15 200)' : 'oklch(0.55 0.010 258)',
                background: 'transparent',
              }}
            >
              {isActive ? <Wrench className="w-3.5 h-3.5" /> : <ListOrdered className="w-3.5 h-3.5" />}
              {label}
            </button>
          );
        })}
      </div>
      {tab === 'builder' && <TradeBuilderPage embedded />}
      {tab === 'orders'  && <OrdersPage       embedded />}
    </div>
  );
}
