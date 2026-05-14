/**
 * FORTRESS V2 — PageHeader
 * Consistent top bar for all pages: title, subtitle, refresh button, last-updated.
 */

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  lastUpdated,
  onRefresh,
  refreshing,
  children,
}: PageHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
      style={{
        background: 'oklch(0.12 0.010 258 / 95%)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid oklch(1 0 0 / 8%)',
      }}
    >
      <div>
        <h1 className="font-display text-xl" style={{ color: 'oklch(0.93 0.005 258)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.58 0.010 258)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {children}

        {lastUpdated && (
          <span className="font-mono-data text-[11px]" style={{ color: 'oklch(0.50 0.010 258)' }}>
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-all duration-150',
              refreshing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[oklch(0.80_0.15_200_/_10%)]'
            )}
            style={{
              color: 'oklch(0.80 0.15 200)',
              borderColor: 'oklch(0.80 0.15 200 / 30%)',
              background: 'transparent',
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
