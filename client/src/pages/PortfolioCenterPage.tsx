/**
 * FORTRESS V3 — Cockpit 3: Portfolio Center
 * Tabbed view: Positions · P&L · Earnings · Journal
 */

import { useState } from "react";
import { BookOpen, DollarSign, CalendarDays, NotebookPen, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePositions, usePnL, useCalendar, useJournal, useBriefing } from "../hooks/useApi";
import { cn } from "@/lib/utils";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt$(v: number | null | undefined, digits = 0) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(digits)}`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function pnlColor(v: number | null | undefined) {
  if (v == null) return "oklch(0.58 0.010 258)";
  if (v > 0)  return "oklch(0.72 0.18 145)";
  if (v < 0)  return "oklch(0.65 0.22 25)";
  return "oklch(0.58 0.010 258)";
}

// ─── Tab: Positions ───────────────────────────────────────────────────────────

function PositionsTab() {
  const { data, loading, error } = usePositions();

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMsg msg={error} />;

  const positions = data?.positions ?? [];
  const totals    = data?.totals;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      {totals && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Net Liq",        value: `$${totals.net_liq?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? "—"}` },
            { label: "Daily P&L",      value: fmt$(totals.daily_pnl),      color: pnlColor(totals.daily_pnl) },
            { label: "Unrealized P&L", value: fmt$(totals.unrealized_pnl), color: pnlColor(totals.unrealized_pnl) },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "oklch(0.50 0.010 258)" }}>{label}</div>
              <div className="text-lg font-mono font-semibold" style={{ color: color ?? "oklch(0.93 0.005 258)" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Positions table */}
      {positions.length === 0 ? (
        <EmptyState msg="No open positions" />
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid oklch(1 0 0 / 8%)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.16 0.010 258)", borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                {["Ticker", "Strategy", "Position", "Delta", "Days", "Daily P&L", "Unreal. P&L", "Status"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: "oklch(0.45 0.010 258)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, i) => {
                const urgency = (pos as any).urgency ?? "normal";
                const urgencyBorder = urgency === "critical" ? "oklch(0.65 0.22 25)" : urgency === "warning" ? "oklch(0.78 0.18 85)" : "transparent";
                return (
                  <tr key={i}
                      className="transition-colors hover:bg-[oklch(1_0_0_/_3%)]"
                      style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)", borderLeft: `2px solid ${urgencyBorder}` }}>
                    <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: "oklch(0.80 0.15 200)" }}>{pos.ticker}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.70 0.010 258)" }}>{pos.strategy ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.85 0.005 258)" }}>{pos.description ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: (pos.net_delta ?? 0) >= 0 ? "oklch(0.72 0.18 145)" : "oklch(0.65 0.22 25)" }}>
                      {pos.net_delta != null ? pos.net_delta.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.70 0.010 258)" }}>{pos.dte ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: pnlColor(pos.daily_pnl) }}>
                      {fmt$(pos.daily_pnl)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: pnlColor(pos.unrealized_pnl) }}>
                      {fmt$(pos.unrealized_pnl)}
                    </td>
                    <td className="px-3 py-2.5">
                      {urgency !== "normal" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ color: urgencyBorder, background: `${urgencyBorder}18`, border: `1px solid ${urgencyBorder}40` }}>
                          {urgency.toUpperCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: P&L ─────────────────────────────────────────────────────────────────

function PnLTab() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data, loading, error } = usePnL(period);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMsg msg={error} />;

  const summary  = data?.summary;
  const series   = data?.series   ?? [];
  const byTicker = data?.by_ticker ?? [];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {(["daily", "weekly", "monthly"] as const).map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: period === p ? "oklch(0.80 0.15 200 / 15%)" : "oklch(0.18 0.010 258)",
              border: `1px solid ${period === p ? "oklch(0.80 0.15 200 / 40%)" : "oklch(1 0 0 / 8%)"}`,
              color: period === p ? "oklch(0.80 0.15 200)" : "oklch(0.55 0.010 258)",
            }}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total P&L",   value: fmt$(summary.total_pnl),   color: pnlColor(summary.total_pnl) },
            { label: "Realized",    value: fmt$(summary.realized_pnl), color: pnlColor(summary.realized_pnl) },
            { label: "Unrealized",  value: fmt$(summary.unrealized_pnl), color: pnlColor(summary.unrealized_pnl) },
            { label: "Win Rate",    value: summary.win_rate != null ? `${(summary.win_rate * 100).toFixed(0)}%` : "—",
              color: summary.win_rate != null && summary.win_rate >= 0.5 ? "oklch(0.72 0.18 145)" : "oklch(0.65 0.22 25)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "oklch(0.50 0.010 258)" }}>{label}</div>
              <div className="text-lg font-mono font-semibold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* P&L series */}
        {series.length > 0 && (
          <div className="rounded-lg p-4" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <div className="text-xs font-medium mb-3" style={{ color: "oklch(0.70 0.010 258)" }}>P&L Series</div>
            <div className="space-y-1 max-h-64 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {series.map((pt, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }}>
                  <span style={{ color: "oklch(0.55 0.010 258)", fontFamily: "monospace" }}>{pt.date}</span>
                  <span style={{ color: pnlColor(pt.pnl), fontFamily: "monospace" }}>{fmt$(pt.pnl)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By ticker */}
        {byTicker.length > 0 && (
          <div className="rounded-lg p-4" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <div className="text-xs font-medium mb-3" style={{ color: "oklch(0.70 0.010 258)" }}>By Ticker</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {byTicker.sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }}>
                  <span style={{ color: "oklch(0.80 0.15 200)", fontFamily: "monospace", fontWeight: 600 }}>{t.ticker}</span>
                  <div className="flex items-center gap-2">
                    {(t.pnl ?? 0) > 0
                      ? <TrendingUp className="w-3 h-3" style={{ color: "oklch(0.72 0.18 145)" }} />
                      : (t.pnl ?? 0) < 0
                      ? <TrendingDown className="w-3 h-3" style={{ color: "oklch(0.65 0.22 25)" }} />
                      : <Minus className="w-3 h-3" style={{ color: "oklch(0.45 0.010 258)" }} />}
                    <span style={{ color: pnlColor(t.pnl), fontFamily: "monospace" }}>{fmt$(t.pnl)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Best/worst day */}
      {(data?.best_day || data?.worst_day) && (
        <div className="grid grid-cols-2 gap-3">
          {data.best_day && (
            <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "oklch(0.72 0.18 145 / 8%)", border: "1px solid oklch(0.72 0.18 145 / 25%)" }}>
              <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.72 0.18 145)" }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "oklch(0.55 0.010 258)" }}>Best Day</div>
                <div className="text-sm font-mono font-semibold" style={{ color: "oklch(0.72 0.18 145)" }}>{fmt$(data.best_day.pnl)} <span className="text-xs font-normal" style={{ color: "oklch(0.50 0.010 258)" }}>{data.best_day.date}</span></div>
              </div>
            </div>
          )}
          {data.worst_day && (
            <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "oklch(0.65 0.22 25 / 8%)", border: "1px solid oklch(0.65 0.22 25 / 25%)" }}>
              <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.22 25)" }} />
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "oklch(0.55 0.010 258)" }}>Worst Day</div>
                <div className="text-sm font-mono font-semibold" style={{ color: "oklch(0.65 0.22 25)" }}>{fmt$(data.worst_day.pnl)} <span className="text-xs font-normal" style={{ color: "oklch(0.50 0.010 258)" }}>{data.worst_day.date}</span></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Earnings ────────────────────────────────────────────────────────────

function EarningsTab() {
  const { data, loading, error } = useCalendar();
  const { data: briefing } = useBriefing();

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMsg msg={error} />;

  const calendar = data?.calendar ?? [];

  return (
    <div className="space-y-4">
      {/* Portfolio earnings risk summary */}
      {briefing?.earnings_risk && (
        <div className="rounded-lg p-3" style={{ background: "oklch(0.78 0.18 85 / 8%)", border: "1px solid oklch(0.78 0.18 85 / 25%)" }}>
          <div className="text-xs font-medium mb-1" style={{ color: "oklch(0.78 0.18 85)" }}>Earnings Risk in Portfolio</div>
          <p className="text-sm" style={{ color: "oklch(0.80 0.005 258)" }}>{typeof briefing.earnings_risk === 'string' ? briefing.earnings_risk : JSON.stringify(briefing.earnings_risk)}</p>
        </div>
      )}

      {calendar.length === 0 ? (
        <EmptyState msg="No earnings calendar entries" />
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid oklch(1 0 0 / 8%)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.16 0.010 258)", borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                {["Ticker", "Date", "Time", "EPS Est.", "EPS Prior", "Rev Est.", "In Portfolio"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: "oklch(0.45 0.010 258)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendar.map((entry, i) => (
                <tr key={i}
                    className="transition-colors hover:bg-[oklch(1_0_0_/_3%)]"
                    style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }}>
                  <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: "oklch(0.80 0.15 200)" }}>{entry.ticker}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.70 0.010 258)" }}>{entry.report_date}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "oklch(0.55 0.010 258)" }}>{entry.time ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.85 0.005 258)" }}>{entry.eps_estimate != null ? `$${entry.eps_estimate.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.70 0.010 258)" }}>{entry.eps_prior != null ? `$${entry.eps_prior.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "oklch(0.70 0.010 258)" }}>{entry.revenue_estimate != null ? `$${(entry.revenue_estimate / 1e9).toFixed(1)}B` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {entry.in_portfolio && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ color: "oklch(0.78 0.18 85)", background: "oklch(0.78 0.18 85 / 12%)", border: "1px solid oklch(0.78 0.18 85 / 35%)" }}>
                        HELD
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Journal ─────────────────────────────────────────────────────────────

function JournalTab() {
  const { data, loading, error } = useJournal();

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMsg msg={error} />;

  const entries  = data?.entries  ?? [];
  const metrics  = data?.metrics;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Trades",  value: String(metrics.total_trades ?? "—") },
            { label: "Win Rate",      value: metrics.win_rate != null ? `${(metrics.win_rate * 100).toFixed(0)}%` : "—",
              color: metrics.win_rate != null && metrics.win_rate >= 0.5 ? "oklch(0.72 0.18 145)" : "oklch(0.65 0.22 25)" },
            { label: "Avg Win",       value: fmt$(metrics.avg_win),  color: "oklch(0.72 0.18 145)" },
            { label: "Avg Loss",      value: fmt$(metrics.avg_loss), color: "oklch(0.65 0.22 25)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "oklch(0.50 0.010 258)" }}>{label}</div>
              <div className="text-lg font-mono font-semibold" style={{ color: color ?? "oklch(0.93 0.005 258)" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState msg="No journal entries yet" />
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 50).map((entry, i) => (
            <div key={i} className="rounded-lg p-4" style={{ background: "oklch(0.18 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm" style={{ color: "oklch(0.80 0.15 200)" }}>{entry.ticker ?? "GENERAL"}</span>
                  {entry.strategy && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "oklch(0.80 0.15 200 / 12%)", color: "oklch(0.80 0.15 200)", border: "1px solid oklch(0.80 0.15 200 / 25%)" }}>
                      {entry.strategy}
                    </span>
                  )}
                  {entry.outcome && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            color: entry.outcome === "win" ? "oklch(0.72 0.18 145)" : entry.outcome === "loss" ? "oklch(0.65 0.22 25)" : "oklch(0.55 0.010 258)",
                            background: entry.outcome === "win" ? "oklch(0.72 0.18 145 / 12%)" : entry.outcome === "loss" ? "oklch(0.65 0.22 25 / 12%)" : "oklch(0.18 0.010 258)",
                            border: `1px solid ${entry.outcome === "win" ? "oklch(0.72 0.18 145 / 30%)" : entry.outcome === "loss" ? "oklch(0.65 0.22 25 / 30%)" : "oklch(1 0 0 / 8%)"}`,
                          }}>
                      {entry.outcome.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono" style={{ color: "oklch(0.45 0.010 258)" }}>{entry.date}</span>
              </div>
              {entry.notes && (
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.72 0.010 258)" }}>{entry.notes}</p>
              )}
              {entry.pnl != null && (
                <div className="mt-2 text-xs font-mono font-semibold" style={{ color: pnlColor(entry.pnl) }}>
                  {fmt$(entry.pnl)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
           style={{ borderColor: "oklch(0.80 0.15 200 / 30%)", borderTopColor: "oklch(0.80 0.15 200)" }} />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg p-4 text-sm" style={{ background: "oklch(0.65 0.22 25 / 8%)", border: "1px solid oklch(0.65 0.22 25 / 25%)", color: "oklch(0.65 0.22 25)" }}>
      {msg}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: "oklch(0.40 0.010 258)" }}>
      <div className="text-sm">{msg}</div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "positions", label: "Positions",  icon: BookOpen,     component: PositionsTab },
  { id: "pnl",       label: "P&L",        icon: DollarSign,   component: PnLTab },
  { id: "earnings",  label: "Earnings",   icon: CalendarDays, component: EarningsTab },
  { id: "journal",   label: "Journal",    icon: NotebookPen,  component: JournalTab },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioCenterPage() {
  const [activeTab, setActiveTab] = useState("positions");
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component ?? PositionsTab;

  return (
    <div className="min-h-screen p-6" style={{ background: "oklch(0.13 0.010 258)" }}>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold" style={{ color: "oklch(0.93 0.005 258)", fontFamily: "var(--font-display, sans-serif)" }}>
          Portfolio Center
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.010 258)" }}>
          Positions · P&amp;L · Earnings · Journal
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "oklch(0.16 0.010 258)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150",
              activeTab === id
                ? "text-[oklch(0.93_0.005_258)]"
                : "text-[oklch(0.45_0.010_258)] hover:text-[oklch(0.70_0.010_258)]"
            )}
            style={{
              background: activeTab === id ? "oklch(0.22 0.010 258)" : "transparent",
              border: activeTab === id ? "1px solid oklch(0.80 0.15 200 / 20%)" : "1px solid transparent",
              boxShadow: activeTab === id ? "0 1px 3px oklch(0 0 0 / 30%)" : "none",
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: activeTab === id ? "oklch(0.80 0.15 200)" : undefined }} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ActiveComponent />
    </div>
  );
}
