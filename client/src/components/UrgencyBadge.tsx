/**
 * FORTRESS V2 — UrgencyBadge
 * Displays order urgency: URGENT (red/pulse), THIS_WEEK (amber), WATCH (cyan).
 * Layer 4 of the 4-layer workflow: Prioritised Order Recommendations.
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Eye } from 'lucide-react';

type Urgency = 'URGENT' | 'THIS_WEEK' | 'WATCH';

interface UrgencyBadgeProps {
  urgency: Urgency;
  className?: string;
  pulse?: boolean;
}

const urgencyConfig: Record<Urgency, {
  label: string;
  text: string;
  border: string;
  bg: string;
  icon: React.ElementType;
  animate?: string;
}> = {
  URGENT: {
    label: 'URGENT',
    text: 'oklch(0.65 0.22 25)',
    border: 'oklch(0.65 0.22 25 / 50%)',
    bg: 'oklch(0.65 0.22 25 / 15%)',
    icon: AlertTriangle,
    animate: 'animate-pulse-red',
  },
  THIS_WEEK: {
    label: 'THIS WEEK',
    text: 'oklch(0.78 0.18 85)',
    border: 'oklch(0.78 0.18 85 / 50%)',
    bg: 'oklch(0.78 0.18 85 / 12%)',
    icon: Clock,
    animate: 'animate-pulse-amber',
  },
  WATCH: {
    label: 'WATCH',
    text: 'oklch(0.80 0.15 200)',
    border: 'oklch(0.80 0.15 200 / 40%)',
    bg: 'oklch(0.80 0.15 200 / 10%)',
    icon: Eye,
  },
};

export function UrgencyBadge({ urgency, className, pulse = false }: UrgencyBadgeProps) {
  const cfg = urgencyConfig[urgency];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-semibold tracking-wide font-mono-data',
        pulse && cfg.animate,
        className,
      )}
      style={{ color: cfg.text, borderColor: cfg.border, background: cfg.bg }}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
