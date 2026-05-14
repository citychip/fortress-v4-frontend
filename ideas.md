# Fortress v2 — Design Brainstorm

## Context
A professional options trading dashboard for a single trader managing a PMCC/PCS book (~$81K Net Liq, 8 tickers, 19 legs). Primary use: morning workflow (regime check → position review → order list), intraday monitoring, and weekly audit. The user is sophisticated, data-driven, and time-constrained. Every pixel must earn its place.

---

<response>
<probability>0.07</probability>
<text>

## Idea A — "Terminal Noir" (Dark Brutalism meets Bloomberg)

**Design Movement:** Dark Brutalism / Financial Terminal

**Core Principles:**
1. Information density over decoration — every element carries data
2. Monospace type as a design element, not just code
3. High contrast amber/green on near-black — the original trading terminal palette
4. Structural honesty — borders, dividers, and grid lines are visible, not hidden

**Color Philosophy:**
- Background: `oklch(0.10 0.005 240)` — near-black with a cold blue undertone
- Surface: `oklch(0.14 0.006 240)` — slightly lighter panels
- Accent Amber: `oklch(0.78 0.18 85)` — alerts, warnings, urgent items
- Accent Green: `oklch(0.72 0.18 145)` — safe, confirmed, bullish
- Accent Red: `oklch(0.62 0.22 25)` — bearish, stop-loss, urgent
- Text primary: `oklch(0.92 0.005 65)` — warm off-white
- Text muted: `oklch(0.55 0.01 240)` — cool grey for secondary data

**Layout Paradigm:**
- Fixed left sidebar (64px icon rail + 200px expanded label) — persistent navigation
- Main content area: dense data grid, no wasted space
- Top bar: 48px — account stats always visible (Net Liq, Excess, Available, regime badge)
- No cards with rounded corners — sharp rectangular panels with 1px borders

**Signature Elements:**
1. Amber "ACT" badges that pulse on urgent items
2. Monospace numbers in tabular figures — all numbers right-aligned
3. Horizontal rule separators with ticker labels (like Bloomberg terminal section headers)

**Interaction Philosophy:**
- Keyboard-first: every action has a hotkey shown in the UI
- Hover reveals full detail; click executes or expands
- No animations except for data refresh (subtle fade-in on new data)

**Animation:**
- Data refresh: 200ms opacity fade from 0.6 to 1.0
- Alert pulse: 1.5s amber glow on urgent items
- Sidebar expand: 150ms ease-out width transition

**Typography System:**
- Display/headers: `JetBrains Mono` — monospace, professional, terminal-native
- Body/data: `JetBrains Mono` — consistent monospace throughout
- Numbers: tabular-nums, right-aligned, letter-spacing: -0.01em

</text>
</response>

<response>
<probability>0.08</probability>
<text>

## Idea B — "Precision Slate" (Swiss Grid + Financial Minimalism)

**Design Movement:** Swiss International Typographic Style applied to fintech

**Core Principles:**
1. Grid supremacy — every element snaps to an 8px grid
2. Typography as hierarchy — weight and size carry all meaning, color is secondary
3. Restrained palette — two accent colors maximum, used sparingly
4. White space is data — breathing room signals importance

**Color Philosophy:**
- Background: `oklch(0.97 0.002 240)` — near-white with a cold tint (not pure white)
- Surface: `oklch(1.0 0 0)` — pure white panels
- Slate accent: `oklch(0.35 0.04 240)` — deep slate for headers and borders
- Urgent red: `oklch(0.58 0.22 25)` — used only for ACT signals
- Positive green: `oklch(0.55 0.18 145)` — used only for SAFE/confirmed
- Text primary: `oklch(0.18 0.01 240)` — near-black with cold undertone
- Text muted: `oklch(0.55 0.01 240)`

**Layout Paradigm:**
- No sidebar — horizontal top navigation with 6 tabs
- Full-width content with strict 12-column grid
- Account stats: persistent sticky bar below top nav
- Cards: sharp corners, 1px border, no shadow — pure Swiss grid

**Signature Elements:**
1. Large tabular numbers in a bold condensed font for key metrics
2. Thin horizontal rules as the only decorative element
3. Status dots (3px circles) instead of badges for regime/alert state

**Interaction Philosophy:**
- Click to expand inline — no modals
- Hover highlights the entire row
- Refresh is manual only — no auto-polling

**Animation:**
- None except data load skeleton shimmer
- Transitions: 100ms linear only

**Typography System:**
- Display: `DM Sans` Bold 700 — clean, modern, not Inter
- Body: `DM Sans` Regular 400
- Numbers: `DM Mono` — tabular figures

</text>
</response>

<response>
<probability>0.06</probability>
<text>

## Idea C — "Obsidian Edge" (Dark Premium + Subtle Depth)

**Design Movement:** Premium Dark UI / Vercel/Linear aesthetic applied to trading

**Core Principles:**
1. Dark background with subtle depth — layered surfaces, not flat
2. Accent color used as a signal, not decoration
3. Typography hierarchy through weight contrast (light body, bold headers)
4. Micro-interactions that feel intentional and responsive

**Color Philosophy:**
- Background: `oklch(0.12 0.008 260)` — deep blue-black (not pure black)
- Surface L1: `oklch(0.17 0.008 260)` — card background
- Surface L2: `oklch(0.22 0.008 260)` — elevated panels, hover states
- Accent Cyan: `oklch(0.80 0.15 200)` — primary interactive, links, active states
- Urgent Amber: `oklch(0.78 0.18 85)` — warnings, approaching thresholds
- Danger Red: `oklch(0.65 0.22 25)` — ACT signals, stop-loss
- Success Emerald: `oklch(0.72 0.18 145)` — safe, confirmed
- Text primary: `oklch(0.95 0.005 260)` — near-white with blue tint
- Text secondary: `oklch(0.65 0.01 260)` — muted

**Layout Paradigm:**
- Persistent left sidebar (240px) with icon + label navigation
- Content area: 3-column grid on dashboard, full-width on detail tabs
- Top bar: 52px — account stats + regime badge + sync button
- Cards: subtle border + inner shadow — depth without heaviness

**Signature Elements:**
1. Cyan glow on active sidebar item and focused inputs
2. Gradient borders on urgent cards (amber → red)
3. Sparkline mini-charts inline in the positions table

**Interaction Philosophy:**
- Hover: surface lifts (subtle shadow increase + background lightens)
- Active: cyan left border on sidebar, cyan underline on tabs
- Refresh: spinning icon + data fades in

**Animation:**
- Page transitions: 200ms slide-in from right
- Card hover: 150ms transform translateY(-2px) + shadow increase
- Alert pulse: 2s amber border glow on urgent items
- Number updates: 300ms count-up animation on key metrics

**Typography System:**
- Display: `Syne` Bold 700 — geometric, distinctive, not Inter
- Body: `Inter` 400/500 — readable at small sizes (exception: body only)
- Numbers: `JetBrains Mono` — monospace, tabular, right-aligned

</text>
</response>

---

## Selected Design: **Idea C — "Obsidian Edge"**

This is the right choice for a trading dashboard because:
- Dark background reduces eye strain during extended sessions
- The cyan accent creates a clear, unambiguous interactive affordance
- Amber/red/green signal hierarchy maps directly to the trading workflow's urgency levels (URGENT/THIS WEEK/WATCH)
- The sidebar layout gives persistent access to all 6 tabs without losing screen real estate
- Depth through layered surfaces (not flat) makes the dense data grid feel organised rather than overwhelming
- JetBrains Mono for numbers ensures all financial data is perfectly aligned and scannable
