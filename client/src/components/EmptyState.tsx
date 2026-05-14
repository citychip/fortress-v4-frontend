/**
 * FORTRESS V2 — EmptyState
 * Consistent empty/error/loading state display.
 */

import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, Settings } from 'lucide-react';
import { Link } from 'wouter';

interface EmptyStateProps {
  type?: 'empty' | 'error' | 'loading' | 'no-config';
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ type = 'empty', title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className,
      )}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'oklch(0.22 0.010 258)' }}
      >
        {type === 'loading' && (
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'oklch(0.80 0.15 200)' }} />
        )}
        {type === 'error' && (
          <AlertCircle className="w-6 h-6" style={{ color: 'oklch(0.65 0.22 25)' }} />
        )}
        {type === 'no-config' && (
          <Settings className="w-6 h-6" style={{ color: 'oklch(0.78 0.18 85)' }} />
        )}
        {type === 'empty' && (
          <AlertCircle className="w-6 h-6" style={{ color: 'oklch(0.58 0.010 258)' }} />
        )}
      </div>

      <h3 className="font-display text-base mb-1" style={{ color: 'oklch(0.85 0.005 258)' }}>
        {title}
      </h3>

      {description && (
        <p className="text-sm max-w-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>
          {description}
        </p>
      )}

      {type === 'no-config' && (
        <Link href="/settings">
          <button
            className="mt-4 px-4 py-2 rounded text-sm border transition-all hover:bg-[oklch(0.80_0.15_200_/_10%)]"
            style={{ color: 'oklch(0.80 0.15 200)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}
          >
            Go to Settings
          </button>
        </Link>
      )}
    </div>
  );
}
