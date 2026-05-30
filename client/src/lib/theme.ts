/**
 * Fortress Design System — Colour Constants
 *
 * Single source of truth for all OKLCH colour values used across the dashboard.
 * Import from here instead of declaring local constants in each page file.
 *
 * Usage:
 *   import { CYAN, GREEN, AMBER, RED, DIM, BRIGHT, CARD, BORDER } from '@/lib/theme';
 */

// ── Semantic colours ──────────────────────────────────────────────────────────
export const GREEN  = 'oklch(0.72 0.18 145)';   // positive, bullish, profit
export const RED    = 'oklch(0.65 0.22 25)';    // negative, bearish, loss, error
export const AMBER  = 'oklch(0.78 0.18 85)';    // warning, approaching threshold
export const CYAN   = 'oklch(0.80 0.15 200)';   // accent, info, highlight
export const PURPLE = 'oklch(0.72 0.18 290)';   // earnings, events

// ── Aliases (some files use these names) ─────────────────────────────────────
export const ACCENT = CYAN;

// ── Neutral scale ─────────────────────────────────────────────────────────────
export const BRIGHT = 'oklch(0.93 0.005 258)';  // primary text
export const DIM    = 'oklch(0.55 0.010 258)';  // secondary text / labels
export const MUTED  = 'oklch(0.50 0.010 258)';  // tertiary text / captions
export const FAINT  = 'oklch(0.45 0.010 258)';  // timestamps / metadata

// ── Surface colours ───────────────────────────────────────────────────────────
export const BG     = 'oklch(0.14 0.010 258)';  // page background
export const CARD   = 'oklch(0.17 0.010 258)';  // card / panel background
export const CARD2  = 'oklch(0.20 0.010 258)';  // elevated card / header row
export const CARD3  = 'oklch(0.22 0.010 258)';  // inset / nested card
export const BORDER = 'oklch(1 0 0 / 9%)';      // subtle border

// ── Convenience opacity variants ─────────────────────────────────────────────
export const GREEN_BG  = 'oklch(0.72 0.18 145 / 10%)';
export const RED_BG    = 'oklch(0.65 0.22 25 / 10%)';
export const AMBER_BG  = 'oklch(0.78 0.18 85 / 10%)';
export const CYAN_BG   = 'oklch(0.80 0.15 200 / 10%)';
