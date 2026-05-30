/**
 * FORTRESS V2 — Trade Journal Page
 * Consumes /api/journal and /api/journal/suggest
 * Shows realised P&L metrics, trade log, new entry form, and auto-suggest from IBKR sync.
 */

import { useState } from 'react';
import { useJournal, useJournalActions, useJournalSuggest, type JournalEntry, formatDollar } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useConfig } from '@/contexts/ConfigContext';
import { PlusCircle, Trash2, Sparkles, TrendingUp, TrendingDown, BookOpen, AlertCircle, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { CYAN, GREEN, AMBER, RED, DIM, BRIGHT, CARD, BORDER, BG, MUTED, PURPLE, ACCENT, CARD2, CARD3, FAINT, CYAN_BG, GREEN_BG, RED_BG, AMBER_BG } from '@/lib/theme';

const ACTION_OPTIONS = ['OPEN', 'CLOSE', 'ROLL', 'ADJUST', 'NOTE'] as const;
const ACTION_COLORS: Record<string, string> = {
  OPEN: GREEN, CLOSE: RED, ROLL: CYAN, ADJUST: AMBER, NOTE: DIM,
};

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded border p-4" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)' }}>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DIM }}>{label}</div>
      <div className="font-display font-bold text-xl" style={{ color: color ?? BRIGHT }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: DIM }}>{sub}</div>}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className="text-[10px] font-mono-data font-bold px-2 py-0.5 rounded uppercase"
      style={{ color: ACTION_COLORS[action] ?? DIM, background: `${ACTION_COLORS[action] ?? DIM}20` }}>
      {action}
    </span>
  );
}

function EntryRow({ entry, onDelete }: { entry: JournalEntry; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const date = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded border p-4 hover:border-opacity-40 transition-colors"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-display font-bold text-sm" style={{ color: BRIGHT }}>{entry.ticker}</span>
            <ActionBadge action={entry.action} />
            <span className="text-xs font-mono-data" style={{ color: DIM }}>{entry.strategy}</span>
            {entry.realized_pnl != null && (
              <span className="text-xs font-mono-data font-semibold" style={{ color: entry.realized_pnl >= 0 ? GREEN : RED }}>
                {entry.realized_pnl >= 0 ? '+' : ''}{formatDollar(entry.realized_pnl)}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.75 0.005 258)' }}>{entry.description}</p>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {entry.tags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded font-mono-data"
                  style={{ color: CYAN, background: 'oklch(0.80 0.15 200 / 10%)' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-[10px] font-mono-data text-right" style={{ color: DIM }}>
            <div>{date}</div>
            <div>{time}</div>
          </div>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(entry.id)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: RED, background: 'oklch(0.65 0.22 25 / 15%)' }}>
                Delete
              </button>
              <button onClick={() => setConfirming(false)} className="text-[10px] px-2 py-0.5 rounded" style={{ color: DIM, background: 'oklch(1 0 0 / 8%)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="p-1 rounded hover:opacity-80" style={{ color: DIM }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewEntryForm({ onSave, onCancel }: { onSave: (entry: Partial<JournalEntry>) => void; onCancel: () => void }) {
  const [ticker, setTicker] = useState('');
  const [strategy, setStrategy] = useState('');
  const [action, setAction] = useState<typeof ACTION_OPTIONS[number]>('NOTE');
  const [description, setDescription] = useState('');
  const [realizedPnl, setRealizedPnl] = useState('');
  const [tags, setTags] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !description.trim()) return;
    onSave({
      ticker: ticker.toUpperCase().trim(),
      strategy: strategy.trim() || 'Manual',
      action,
      description: description.trim(),
      realized_pnl: realizedPnl ? parseFloat(realizedPnl) : null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  }

  const inputCls = "w-full font-mono-data text-xs px-3 py-2 rounded border outline-none focus:border-opacity-60 transition-colors";
  const inputStyle = { background: 'oklch(0.13 0.010 258)', borderColor: 'oklch(1 0 0 / 20%)', color: BRIGHT };

  return (
    <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}>
      <div className="text-xs font-display font-bold uppercase tracking-wider mb-2" style={{ color: CYAN }}>New Journal Entry</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Ticker *</label>
          <input value={ticker} onChange={e => setTicker(e.target.value)} placeholder="MSFT" required className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Strategy</label>
          <input value={strategy} onChange={e => setStrategy(e.target.value)} placeholder="Covered Call" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Action *</label>
          <select value={action} onChange={e => setAction(e.target.value as typeof ACTION_OPTIONS[number])} className={inputCls} style={inputStyle}>
            {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Description *</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened and why…" required rows={3}
          className={`${inputCls} resize-none`} style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Realised P&L ($)</label>
          <input type="number" value={realizedPnl} onChange={e => setRealizedPnl(e.target.value)} placeholder="0.00" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: DIM }}>Tags (comma-separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="earnings, roll, hedge" className={inputCls} style={inputStyle} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ background: CYAN, color: 'oklch(0.13 0.010 258)' }}>
          <PlusCircle className="w-3.5 h-3.5" /> Save Entry
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded text-xs hover:opacity-80 transition-opacity"
          style={{ color: DIM, background: 'oklch(1 0 0 / 8%)' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}


// ─── E-09: Closed-Loop Accordion ─────────────────────────────────────────────

interface ClosedPair {
  openEntry: JournalEntry;
  closeEntry: JournalEntry;
  daysHeld: number | null;
}

function buildClosedPairs(entries: JournalEntry[]): ClosedPair[] {
  const byId = new Map<string, JournalEntry>(entries.map(e => [e.id, e]));
  const pairs: ClosedPair[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    if (e.action !== 'CLOSE' || seen.has(e.id)) continue;
    const openId = e.open_entry_id;
    if (!openId) continue;
    const openEntry = byId.get(openId);
    if (!openEntry) continue;
    seen.add(e.id);
    seen.add(openId);

    // Days held: diff between close timestamp and open timestamp
    let daysHeld: number | null = null;
    const t0 = openEntry.timestamp ?? openEntry.created_at;
    const t1 = e.timestamp ?? e.created_at;
    if (t0 && t1) {
      const diff = new Date(t1).getTime() - new Date(t0).getTime();
      daysHeld = Math.round(diff / 86400000);
    }
    pairs.push({ openEntry, closeEntry: e, daysHeld });
  }
  // Newest close first
  return pairs.sort((a, b) => {
    const ta = a.closeEntry.timestamp ?? a.closeEntry.created_at ?? '';
    const tb = b.closeEntry.timestamp ?? b.closeEntry.created_at ?? '';
    return tb.localeCompare(ta);
  });
}

function ClosedTradeCard({ pair }: { pair: ClosedPair }) {
  const [expanded, setExpanded] = useState(false);
  const { openEntry: open, closeEntry: close, daysHeld } = pair;
  const pnl = close.realized_pnl ?? 0;
  const isWin = pnl > 0;
  const ivCrush = close.iv_crush_realized;
  const dteClose = close.dte_at_close;

  const openDate = new Date(open.timestamp ?? open.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const closeDate = new Date(close.timestamp ?? close.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="rounded border overflow-hidden transition-colors"
      style={{ background: 'oklch(0.17 0.010 258)', borderColor: isWin ? 'oklch(0.72 0.18 145 / 20%)' : 'oklch(0.65 0.22 25 / 20%)' }}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[oklch(1_0_0_/_2%)] transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
          : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'oklch(0.55 0.010 258)' }} />
        }
        {/* Ticker + strategy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-sm" style={{ color: 'oklch(0.93 0.005 258)' }}>{open.ticker}</span>
            <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded" style={{ color: 'oklch(0.80 0.15 200)', background: 'oklch(0.80 0.15 200 / 10%)' }}>
              {open.strategy}
            </span>
            <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
              {openDate} → {closeDate}
              {daysHeld !== null && ` (${daysHeld}d)`}
            </span>
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.60 0.010 258)' }}>{close.description}</div>
        </div>
        {/* P&L + quick stats */}
        <div className="flex items-center gap-4 flex-shrink-0 text-right">
          {ivCrush != null && (
            <div className="text-right hidden sm:block">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.45 0.010 258)' }}>IV Crush</div>
              <div className="font-mono-data text-xs font-semibold" style={{ color: 'oklch(0.78 0.18 85)' }}>{(ivCrush * 100).toFixed(0)}%</div>
            </div>
          )}
          {dteClose != null && (
            <div className="text-right hidden sm:block">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.45 0.010 258)' }}>DTE@Close</div>
              <div className="font-mono-data text-xs" style={{ color: 'oklch(0.55 0.010 258)' }}>{dteClose}d</div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.45 0.010 258)' }}>Realised P&L</div>
            <div className="font-mono-data text-sm font-semibold" style={{ color: isWin ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
              {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(0)}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
          <div className="grid grid-cols-2 gap-3">
            {/* Open leg */}
            <div className="rounded p-3" style={{ background: 'oklch(0.13 0.010 258)', border: '1px solid oklch(0.72 0.18 145 / 15%)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded uppercase" style={{ color: 'oklch(0.72 0.18 145)', background: 'oklch(0.72 0.18 145 / 12%)' }}>OPEN</span>
                <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>{openDate}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.75 0.005 258)' }}>{open.description}</p>
              {open.debit_credit != null && (
                <div className="mt-2 text-xs font-mono-data" style={{ color: 'oklch(0.55 0.010 258)' }}>
                  Credit/Debit: <span style={{ color: open.debit_credit >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)' }}>
                    {open.debit_credit >= 0 ? '+' : ''}${open.debit_credit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            {/* Close leg */}
            <div className="rounded p-3" style={{ background: 'oklch(0.13 0.010 258)', border: '1px solid oklch(0.65 0.22 25 / 15%)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-mono-data font-bold px-1.5 py-0.5 rounded uppercase" style={{ color: 'oklch(0.65 0.22 25)', background: 'oklch(0.65 0.22 25 / 12%)' }}>CLOSE</span>
                <span className="text-[10px] font-mono-data" style={{ color: 'oklch(0.45 0.010 258)' }}>{closeDate}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.75 0.005 258)' }}>{close.description}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono-data">
                <div>
                  <div style={{ color: 'oklch(0.45 0.010 258)' }}>P&L</div>
                  <div style={{ color: isWin ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)', fontWeight: 600 }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                  </div>
                </div>
                {ivCrush != null && (
                  <div>
                    <div style={{ color: 'oklch(0.45 0.010 258)' }}>IV Crush</div>
                    <div style={{ color: 'oklch(0.78 0.18 85)', fontWeight: 600 }}>{(ivCrush * 100).toFixed(0)}%</div>
                  </div>
                )}
                {dteClose != null && (
                  <div>
                    <div style={{ color: 'oklch(0.45 0.010 258)' }}>DTE@Close</div>
                    <div style={{ color: 'oklch(0.55 0.010 258)' }}>{dteClose}d</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClosedLoopAccordion({ entries }: { entries: JournalEntry[] }) {
  const pairs = buildClosedPairs(entries);
  if (pairs.length === 0) return null;

  const totalPnl = pairs.reduce((s, p) => s + (p.closeEntry.realized_pnl ?? 0), 0);
  const wins = pairs.filter(p => (p.closeEntry.realized_pnl ?? 0) > 0).length;

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5" style={{ color: 'oklch(0.80 0.15 200)' }} />
          <span className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: 'oklch(0.93 0.005 258)' }}>
            Closed Trades
          </span>
          <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(0.80 0.15 200 / 10%)', color: 'oklch(0.80 0.15 200)' }}>
            {pairs.length} pair{pairs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono-data">
          <span style={{ color: 'oklch(0.55 0.010 258)' }}>{wins}/{pairs.length} wins</span>
          <span style={{ color: totalPnl >= 0 ? 'oklch(0.72 0.18 145)' : 'oklch(0.65 0.22 25)', fontWeight: 600 }}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(0)} total
          </span>
        </div>
      </div>
      {pairs.map(pair => (
        <ClosedTradeCard key={pair.closeEntry.id} pair={pair} />
      ))}
    </div>
  );
}

export default function JournalPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, loading, error, refresh, lastUpdated } = useJournal();
  const { data: suggest, loading: suggestLoading, refresh: refreshSuggest } = useJournalSuggest();
  const { createEntry, deleteEntry } = useJournalActions();
  const { config } = useConfig();
  const [showForm, setShowForm] = useState(false);

  async function handleSave(entry: Partial<JournalEntry>) {
    try {
      await createEntry(entry);
      setShowForm(false);
      refresh();
      toast.success('Journal entry saved');
    } catch {
      toast.error('Failed to save entry');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id);
      refresh();
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    }
  }

  async function handleUseSuggest() {
    if (!suggest?.suggestion) return;
    const s = suggest.suggestion;
    await handleSave({
      ticker: s.ticker,
      strategy: s.strategy,
      action: s.action as JournalEntry['action'],
      description: s.description,
    });
  }

  const metrics = data?.metrics;
  const entries = data?.entries ?? [];

  return (
    <div className={embedded ? '' : 'min-h-screen'}>
      {!embedded && <PageHeader
        title="Trade Journal"
        subtitle="Realised P&L tracking, closed position log, and framework compliance"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        refreshing={loading}
      />}
      <div className="p-6 space-y-6">

        {/* Metrics row */}
        {metrics && (
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              label="Realised P&L (30d)"
              value={formatDollar(metrics.total_realized_30d)}
              color={metrics.total_realized_30d >= 0 ? GREEN : RED}
            />
            <MetricCard
              label="Closed Positions (30d)"
              value={String(metrics.closed_positions_30d)}
              color={BRIGHT}
            />
            <MetricCard
              label="PCS Hit Rate"
              value={metrics.pcs_hit_rate_pct != null ? `${metrics.pcs_hit_rate_pct.toFixed(0)}%` : 'N/A'}
              color={metrics.pcs_hit_rate_pct != null && metrics.pcs_hit_rate_pct >= 70 ? GREEN : AMBER}
            />
            <MetricCard
              label="Framework Violations"
              value={String(metrics.framework_violations_30d)}
              color={metrics.framework_violations_30d === 0 ? GREEN : RED}
              sub="last 30 days"
            />
          </div>
        )}

        {/* Auto-suggest banner */}
        {suggest?.suggestion && (
          <div className="rounded border p-4 flex items-start justify-between gap-4"
            style={{ background: 'oklch(0.80 0.15 200 / 8%)', borderColor: 'oklch(0.80 0.15 200 / 30%)' }}>
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: CYAN }} />
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: CYAN }}>Auto-suggest from last IBKR sync</div>
                <div className="text-sm" style={{ color: BRIGHT }}>
                  <span className="font-bold">{suggest.suggestion.ticker}</span>
                  {' · '}{suggest.suggestion.strategy}
                  {' · '}<span className="font-mono-data">{suggest.suggestion.action}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: DIM }}>{suggest.suggestion.description}</div>
              </div>
            </div>
            <button onClick={handleUseSuggest} className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
              style={{ background: CYAN, color: 'oklch(0.13 0.010 258)' }}>
              Use this
            </button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono-data hover:opacity-80 transition-opacity"
            style={{ color: GREEN, borderColor: 'oklch(0.72 0.18 145 / 30%)', background: 'oklch(0.72 0.18 145 / 8%)' }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Entry
          </button>
          <button
            onClick={() => { refreshSuggest(); }}
            disabled={suggestLoading}
            className="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono-data hover:opacity-80 transition-opacity"
            style={{ color: CYAN, borderColor: 'oklch(0.80 0.15 200 / 30%)', background: 'oklch(0.80 0.15 200 / 8%)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Refresh Suggest
          </button>
        </div>

        {showForm && (
          <NewEntryForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        )}

        {error && !loading && <EmptyState type="error" title="Failed to load journal" description={error} />}
        {loading && !data && <EmptyState type="loading" title="Loading journal…" />}
        {!config.apiToken && !loading && <EmptyState type="no-config" title="API token required" description="Configure your token in Settings." />}

        {!loading && entries.length === 0 && data && (
          <div className="rounded border p-8 text-center" style={{ background: 'oklch(0.17 0.010 258)', borderColor: 'oklch(1 0 0 / 10%)' }}>
            <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: DIM }} />
            <div className="font-display font-bold text-sm mb-1" style={{ color: BRIGHT }}>No journal entries yet</div>
            <div className="text-xs" style={{ color: DIM }}>Use the New Entry button or auto-suggest to get started.</div>
          </div>
        )}

        {/* ── E-09: Closed-loop paired view ── */}
        {entries.length > 0 && <ClosedLoopAccordion entries={entries} />}

        {/* ── Full entry log ── */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider" style={{ color: 'oklch(0.93 0.005 258)' }}>All Entries</span>
              <span className="font-mono-data text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(1 0 0 / 6%)', color: 'oklch(0.55 0.010 258)' }}>
                {entries.length}
              </span>
            </div>
            {entries.map(entry => (
              <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
