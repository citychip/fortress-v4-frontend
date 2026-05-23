/**
 * FORTRESS V2 — StatCard
 * Metric display card with optional trend indicator and signal color.
 */

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type SignalColor = 'default' | 'cyan' | 'green' | 'amber' | 'red';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'flat';
  signal?: SignalColor;
  className?: string;
  loading?: boolean;
  footer?: React.ReactNode;
}

const signalStyles: Record<SignalColor, { text: string; border: string; bg: string }> = {
  default: {
    text: 'oklch(0.93 0.005 258)',
    border: 'oklch(1 0 0 / 9%)',
    bg: 'oklch(0.17 0.010 258)',
  },
  cyan: {
    text: 'oklch(0.80 0.15 200)',
    border: 'oklch(0.80 0.15 200 / 30%)',
    bg: 'oklch(0.17 0.010 258)',
  },
  green: {
    text: 'oklch(0.72 0.18 145)',
    border: 'oklch(0.72 0.18 145 / 30%)',
    bg: 'oklch(0.17 0.010 258)',
  },
  amber: {
    text: 'oklch(0.78 0.18 85)',
    border: 'oklch(0.78 0.18 85 / 30%)',
    bg: 'oklch(0.17 0.010 258)',
  },
  red: {
    text: 'oklch(0.65 0.22 25)',
    border: 'oklch(0.65 0.22 25 / 30%)',
    bg: 'oklch(0.17 0.010 258)',
  },
};

export function StatCard({ label, value, subValue, trend, signal = 'default', className, loading, footer }: StatCardProps) {
  const styles = signalStyles[signal];

  return (
    <div
      className={cn('rounded p-4 flex flex-col gap-1', className)}
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
      }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'oklch(0.55 0.010 258)' }}>
        {label}
      </div>

      {loading ? (
        <div className="h-7 w-24 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
      ) : (
        <div className="flex items-end gap-2">
          <div className="font-mono-data text-2xl font-semibold leading-none" style={{ color: styles.text }}>
            {value}
          </div>
          {trend && (
            <div className="mb-0.5">
              {trend === 'up' && <TrendingUp className="w-4 h-4" style={{ color: 'oklch(0.72 0.18 145)' }} />}
              {trend === 'down' && <TrendingDown className="w-4 h-4" style={{ color: 'oklch(0.65 0.22 25)' }} />}
              {trend === 'flat' && <Minus className="w-4 h-4" style={{ color: 'oklch(0.58 0.010 258)' }} />}
            </div>
          )}
        </div>
      )}

      {subValue && (
        <div className="font-mono-data text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
          {subValue}
        </div>
      )}

      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}
