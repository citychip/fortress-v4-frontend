/**
 * FORTRESS V2 — Earnings Calendar Page
 * Consumes /api/calendar — shows all tickers with earnings dates, DTE countdown,
 * status badges (CLEAR/APPROACHING/BLACKOUT/PAST), and CRUD actions.
 */

import { useState } from 'react';
import { useCalendar, useCalendarActions, type EarningsEntry } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useConfig } from '@/contexts/ConfigContext';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Download, Edit2, Check, X } from 'lucide-react';

const GREEN  = 'oklch(0.72 0.18 145)';
const RED    = 'oklch(0.65 0.22 25)';
const AMBER  = 'oklch(0.78 0.18 85)';
const CYAN   = 'oklch(0.80 0.15 200)';
const DIM    = 'oklch(0.55 0.010 258)';
const BRIGHT = 'oklch(0.93 0.005 258)';

function statusConfig(status: string) {
  switch (status) {
    case 'blackout':   return { label: 'BLACKOUT',   color: RED,   bg: 'oklch(0.65 0.22 25 / 15%)',  icon: XCircle };
    case 'approaching': return { label: 'APPROACHING', color: AMBER, bg: 'oklch(0.78 0.18 85 / 15%)', icon: AlertTriangle };
    case 'clear':      return { label: 'CLEAR',      color: GREEN, bg: 'oklch(0.72 0.18 145 / 12%)', icon: CheckCircle };
    case 'past':       return { label: 'PAST',       color: DIM,   bg: 'oklch(1 0 0 / 5%)',          icon: Clock };
    default:           return { label: status.toUpperCase(), color: DIM, bg: 'oklch(1 0 0 / 5%)', icon: Clock };
  }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono-data font-semibold px-2 py-0.5 rounded"
      style={{ color: cfg.color, background: cfg.bg }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function DteBar({ days, status }: { days: number; status: string }) {
  const max = 90;
  const pct = Math.min(100, Math.max(0, (days / max) * 100));
  const color = status === 'blackout' ? RED : status === 'approaching' ? AMBER : GREEN;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'oklch(1 0 0 / 8%)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono-data text-xs w-12 text-right" style={{ color: status === 'blackout' ? RED : status === 'approaching' ? AMBER : DIM }}>
        {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
      </span>
    </div>
  );
}

function EarningsRow({ ticker, entry, onRefresh }: { ticker: string; entry: EarningsEntry; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(entry.next_earnings);
  const [newNotes, setNewNotes] = useState(entry.notes ?? '');
  const { updateEarnings, confirmEarnings, loading } = useCalendarActions();

  async function handleSave() {
    try {
      await updateEarnings(ticker, { next_earnings: newDate, notes: newNotes });
      setEditing(false);
      onRefresh();
    } catch { /* error shown by hook */ }
  }

  async function handleConfirm() {
    try {
      await confirmEarnings(ticker);
      onRefresh();
    } catch { /* error shown by hook */ }
  }

  const cfg = statusConfig(entry.status);

  return (
    <div className="rounded border overflow-hidden" style={{ background: 'oklch(0.17 0.010 258)', borderColor: `${cfg.color}30` }}>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{ticker}</span>
              <StatusBadge status={entry.status} />
              {entry.confirmed && (
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: GREEN, background: 'oklch(0.72 0.18 145 / 10%)' }}>
                  CONFIRMED
                </span>
              )}
              {entry._source && (
                <span className="text-[10px] font-mono-data" style={{ color: DIM }}>via {entry._source}</span>
              )}
            </div>
            {editing ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="font-mono-data text-xs px-2 py-1 rounded border"
                  style={{ background: 'oklch(0.13 0.010 258)', borderColor: 'oklch(1 0 0 / 20%)', color: BRIGHT }}
                />
                <input
                  type="text"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Notes…"
                  className="font-mono-data text-xs px-2 py-1 rounded border w-48"
                  style={{ background: 'oklch(0.13 0.010 258)', borderColor: 'oklch(1 0 0 / 20%)', color: BRIGHT }}
                />
                <button onClick={handleSave} disabled={loading} className="p-1 rounded hover:opacity-80" style={{ color: GREEN }}>
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditing(false)} className="p-1 rounded hover:opacity-80" style={{ color: DIM }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="font-mono-data text-xs" style={{ color: DIM }}>
                {entry.next_earnings}
                {entry.notes && <span className="ml-2" style={{ color: 'oklch(0.45 0.010 258)' }}>— {entry.notes}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!entry.confirmed && entry.status !== 'past' && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:opacity-80 transition-opacity"
              style={{ color: GREEN, borderColor: 'oklch(0.72 0.18 145 / 30%)', background: 'oklch(0.72 0.18 145 / 8%)' }}
            >
              <CheckCircle className="w-3 h-3" /> Confirm
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded hover:opacity-80 transition-opacity"
              style={{ color: DIM }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="px-4 pb-4">
        <DteBar days={entry.days_to_earnings} status={entry.status} />
      </div>
    </div>
  );
}

export default function EarningsPage() {
  const { data, loading, error, refresh, lastUpdated } = useCalendar();
  const { fetchEarnings, loading: fetching } = useCalendarActions();
  const { config } = useConfig();

  const entries = data?.tickers ? Object.entries(data.tickers) : [];
  const sorted = [...entries].sort((a, b) => {
    const order = { blackout: 0, approaching: 1, clear: 2, past: 3 };
    const ao = order[a[1].status as keyof typeof order] ?? 4;
    const bo = order[b[1].status as keyof typeof order] ?? 4;
    if (ao !== bo) return ao - bo;
    return a[1].days_to_earnings - b[1].days_to_earnings;
  });

  const blackout    = sorted.filter(([, e]) => e.status === 'blackout');
  const approaching = sorted.filter(([, e]) => e.status === 'approaching');
  const clear       = sorted.filter(([, e]) => e.status === 'clear');
  const past        = sorted.filter(([, e]) => e.status === 'past');

  async function handleFetchEarnings() {
    try { await fetchEarnings(); refresh(); } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Earnings Calendar"
        subtitle="Earnings dates, DTE countdown, and entry blackout windows for your universe"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />
      <div className="p-6 space-y-6">

        {/* Summary stat row */}
        {!loading && entries.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Blackout', count: blackout.length, color: RED, bg: 'oklch(0.65 0.22 25 / 12%)' },
              { label: 'Approaching', count: approaching.length, color: AMBER, bg: 'oklch(0.78 0.18 85 / 12%)' },
              { label: 'Clear', count: clear.length, color: GREEN, bg: 'oklch(0.72 0.18 145 / 10%)' },
              { label: 'Past', count: past.length, color: DIM, bg: 'oklch(1 0 0 / 5%)' },
            ].map(s => (
              <div key={s.label} className="rounded border p-4 text-center" style={{ background: s.bg, borderColor: `${s.color}30` }}>
                <div className="font-display font-bold text-2xl" style={{ color: s.color }}>{s.count}</div>
                <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: DIM }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchEarnings}
            disabled={fetching}
            className="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono-data hover:opacity-80 transition-opacity"
            style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {fetching ? 'Fetching…' : 'Auto-fetch from yfinance'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono-data hover:opacity-80 transition-opacity"
            style={{ color: DIM, borderColor: 'oklch(1 0 0 / 15%)', background: 'transparent' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && !loading && <EmptyState type="error" title="Failed to load calendar" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading earnings calendar…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your token in Settings." />}

        {!loading && entries.length > 0 && (
          <div className="space-y-6">
            {blackout.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: RED }}>
                  <XCircle className="w-3.5 h-3.5" /> Blackout — No New Entries ({blackout.length})
                </h2>
                <div className="space-y-2">
                  {blackout.map(([t, e]) => <EarningsRow key={t} ticker={t} entry={e} onRefresh={refresh} />)}
                </div>
              </section>
            )}
            {approaching.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: AMBER }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Approaching — Caution ({approaching.length})
                </h2>
                <div className="space-y-2">
                  {approaching.map(([t, e]) => <EarningsRow key={t} ticker={t} entry={e} onRefresh={refresh} />)}
                </div>
              </section>
            )}
            {clear.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: GREEN }}>
                  <CheckCircle className="w-3.5 h-3.5" /> Clear — Safe to Trade ({clear.length})
                </h2>
                <div className="space-y-2">
                  {clear.map(([t, e]) => <EarningsRow key={t} ticker={t} entry={e} onRefresh={refresh} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: DIM }}>
                  <Clock className="w-3.5 h-3.5" /> Past ({past.length})
                </h2>
                <div className="space-y-2">
                  {past.map(([t, e]) => <EarningsRow key={t} ticker={t} entry={e} onRefresh={refresh} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {!loading && entries.length === 0 && data && (
          <EmptyState type="empty" title="No earnings data" description="Use Auto-fetch to populate earnings dates from yfinance." />
        )}
      </div>
    </div>
  );
}
