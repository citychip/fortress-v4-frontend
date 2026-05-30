/**
 * PortfolioPage — Phase 4 nav redesign
 * Manage and review: open positions, P&L, trade journal.
 * Sub-tabs: Positions | P&L | Journal
 */
import { useState } from 'react';
import { BookOpen, DollarSign, BookMarked } from 'lucide-react';
import PositionsPage from './PositionsPage';
import PnLPage from './PnLPage';
import JournalPage from './JournalPage';
import { PageHeader } from '@/components/PageHeader';

type PortfolioTab = 'positions' | 'pnl' | 'journal';

const TABS: { id: PortfolioTab; label: string; icon: React.ElementType }[] = [
  { id: 'positions', label: 'Positions', icon: BookOpen   },
  { id: 'pnl',       label: 'P&L',       icon: DollarSign },
  { id: 'journal',   label: 'Journal',   icon: BookMarked },
];

export default function PortfolioPage() {
  const [tab, setTab] = useState<PortfolioTab>('positions');
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Portfolio"
        subtitle="Open positions · P&L history · Trade journal"
      />
      <div className="sticky top-0 z-20 flex gap-1 px-6 pt-3 pb-0"
        style={{ background: 'oklch(0.13 0.010 258)', borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all"
            style={{
              borderBottomColor: tab === id ? 'oklch(0.80 0.15 200)' : 'transparent',
              color: tab === id ? 'oklch(0.80 0.15 200)' : 'oklch(0.55 0.010 258)',
              background: 'transparent',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'positions' && <PositionsPage embedded />}
      {tab === 'pnl'       && <PnLPage       embedded />}
      {tab === 'journal'   && <JournalPage   embedded />}
    </div>
  );
}
