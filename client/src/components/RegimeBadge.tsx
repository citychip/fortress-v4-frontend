/**
 * FORTRESS V2 — RegimeBadge
 * Displays the macro regime score with color-coded signal.
 * Layer 1 of the 4-layer workflow: Macro Regime Gate.
 */

import { cn } from '@/lib/utils';
import { regimeInfo } from '@/hooks/useApi';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface RegimeBadgeProps {
  score: number;
  entryPermitted?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RegimeBadge({ score, entryPermitted, className, size = 'md' }: RegimeBadgeProps) {
  const { label, color } = regimeInfo(typeof score === 'number' ? (score >= 0 ? 'bullish' : 'bearish') : String(score));

  const colorMap = {
    red:   { text: 'oklch(0.65 0.22 25)',  border: 'oklch(0.65 0.22 25 / 40%)',  bg: 'oklch(0.65 0.22 25 / 12%)' },
    amber: { text: 'oklch(0.78 0.18 85)',  border: 'oklch(0.78 0.18 85 / 40%)',  bg: 'oklch(0.78 0.18 85 / 12%)' },
    green: { text: 'oklch(0.72 0.18 145)', border: 'oklch(0.72 0.18 145 / 40%)', bg: 'oklch(0.72 0.18 145 / 12%)' },
    cyan:  { text: 'oklch(0.80 0.15 200)', border: 'oklch(0.80 0.15 200 / 40%)', bg: 'oklch(0.80 0.15 200 / 12%)' },
  };

  const c = colorMap[color];
  const Icon = color === 'red' ? ShieldX : color === 'amber' ? ShieldAlert : ShieldCheck;

  const sizeClasses = {
    sm: 'px-2 py-1 text-[11px] gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
    lg: 'px-4 py-2 text-sm gap-2.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded border font-medium',
        sizeClasses[size],
        className,
      )}
      style={{ color: c.text, borderColor: c.border, background: c.bg }}
    >
      <Icon className={iconSize[size]} />
      <span className="font-mono-data">
        {label}
        {score !== undefined && (
          <span className="ml-1 opacity-70">
            ({score > 0 ? '+' : ''}{score})
          </span>
        )}
      </span>
      {entryPermitted !== undefined && (
        <span
          className="ml-1 opacity-70 text-[10px]"
          style={{ color: entryPermitted ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}
        >
          {entryPermitted ? '· ENTRIES OK' : '· NO ENTRIES'}
        </span>
      )}
    </div>
  );
}
