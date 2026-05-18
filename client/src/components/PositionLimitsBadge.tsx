/**
 * PositionLimitsBadge — Gap 1 (OptionStrat-inspired)
 * Displays max profit, max loss, net premium, and breakeven price(s)
 * for a multi-leg options position using the /api/options/position-limits endpoint.
 *
 * Shows an amber warning when spot is within 2% of any breakeven.
 */
import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePositionLimits, type LegInput, type Position } from '@/hooks/useApi';

const GREEN  = 'oklch(0.72 0.17 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const DIM    = 'oklch(0.55 0.02 258)';
const BRIGHT = 'oklch(0.88 0.02 258)';
const CYAN   = 'oklch(0.80 0.15 200)';

function fmt(v: number | null, prefix = '$'): string {
  if (v === null) return '∞';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${prefix}${(abs / 1000).toFixed(1)}k`;
  return `${prefix}${abs.toFixed(0)}`;
}

/** Convert a group of Position legs into LegInput[] for the API */
export function positionsToLegs(legs: Position[]): LegInput[] {
  return legs
    .filter(l => l.sec_type === 'OPT' && l.right && l.strike && l.expiry)
    .map(l => ({
      right: l.right as 'C' | 'P',
      strike: l.strike,
      qty: l.qty,
      premium: l.avg_cost ?? 0,
      expiry: (l.expiry ?? '').slice(0, 10),
    }));
}

interface Props {
  ticker: string;
  legs: Position[];
}

export default function PositionLimitsBadge({ ticker, legs }: Props) {
  const legInputs = useMemo(() => positionsToLegs(legs), [legs]);
  const hasOptions = legInputs.length > 0;

  const { data, loading } = usePositionLimits(ticker, legInputs, hasOptions);

  if (!hasOptions) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5">
        <span className="text-[10px] animate-pulse" style={{ color: DIM }}>
          Computing limits…
        </span>
      </div>
    );
  }
  if (!data) return null;

  const { max_profit, max_loss, net_premium, breakevens } = data;

  // Warn if spot is within 2% of any breakeven
  const nearBreakeven = data.spot
    ? breakevens.some(be => Math.abs((data.spot - be) / be) < 0.02)
    : false;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t"
      style={{
        borderColor: nearBreakeven
          ? 'oklch(0.78 0.18 85 / 30%)'
          : 'oklch(1 0 0 / 6%)',
        background: nearBreakeven
          ? 'oklch(0.78 0.18 85 / 5%)'
          : 'oklch(0.17 0.010 258)',
      }}
    >
      {/* Max Profit */}
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3" style={{ color: GREEN }} />
        <span className="text-[10px]" style={{ color: DIM }}>Max profit</span>
        <span className="font-mono-data text-[11px] font-semibold" style={{ color: GREEN }}>
          {max_profit !== null ? `+${fmt(max_profit)}` : '+∞'}
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: DIM }}>·</span>

      {/* Max Loss */}
      <div className="flex items-center gap-1">
        <TrendingDown className="w-3 h-3" style={{ color: RED }} />
        <span className="text-[10px]" style={{ color: DIM }}>Max loss</span>
        <span className="font-mono-data text-[11px] font-semibold" style={{ color: RED }}>
          {max_loss !== null ? `-${fmt(max_loss)}` : '-∞'}
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: DIM }}>·</span>

      {/* Net premium */}
      <div className="flex items-center gap-1">
        <Minus className="w-3 h-3" style={{ color: DIM }} />
        <span className="text-[10px]" style={{ color: DIM }}>
          {net_premium >= 0 ? 'Net debit' : 'Net credit'}
        </span>
        <span className="font-mono-data text-[11px]" style={{ color: BRIGHT }}>
          {net_premium >= 0 ? `-${fmt(net_premium)}` : `+${fmt(Math.abs(net_premium))}`}
        </span>
      </div>

      {/* Breakevens */}
      {breakevens.length > 0 && (
        <>
          <span style={{ color: DIM }}>·</span>
          <div className="flex items-center gap-1">
            {nearBreakeven && (
              <AlertTriangle className="w-3 h-3" style={{ color: AMBER }} />
            )}
            <span className="text-[10px]" style={{ color: nearBreakeven ? AMBER : DIM }}>
              BE{breakevens.length > 1 ? 's' : ''}
            </span>
            {breakevens.map((be, i) => (
              <span
                key={i}
                className="font-mono-data text-[11px] font-semibold"
                style={{ color: nearBreakeven ? AMBER : CYAN }}
              >
                ${be.toFixed(2)}{i < breakevens.length - 1 ? ' /' : ''}
              </span>
            ))}
            {nearBreakeven && (
              <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
                style={{ background: 'oklch(0.78 0.18 85 / 15%)', color: AMBER }}>
                NEAR BE
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
