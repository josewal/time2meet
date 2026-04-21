# Design System

Single source of truth lives in [public/styles.css](public/styles.css) — the `:root` block at the top. This doc mirrors that and adds the component catalog.

## Principles

1. **Monospace-only typography.** The whole UI is rendered in `ui-monospace`. It's the strongest identity cue; don't break it.
2. **Tokens, not literals.** Compose from the vars in `:root`. Micro-spacing (`2px`, `6px`, `10px`) and component-specific geometry (FAB size, input padding) may stay as literals.
3. **Dark mode is a token swap.** No component-level dark overrides; only the `:root` overrides under `@media (prefers-color-scheme: dark)`.
4. **Focus is visible.** Every interactive element must show a `:focus-visible` ring. Never `outline: none` without a replacement.

## Tokens

### Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-fg` | `#1a1a1a` | `#e8e8ea` | Primary text, default button |
| `--color-bg` | `#fafafa` | `#0f0f11` | Page background |
| `--color-muted` | `#666` | `#9a9a9f` | Secondary text, labels |
| `--color-subtle` | `#bbb` | `#4a4a4f` | Tertiary / disabled |
| `--color-surface` | `#ffffff` | `#1a1a1d` | Cards, inputs |
| `--color-surface-alt` | `#f0f0f0` | `#26262b` | Hints, hover rows |
| `--color-surface-alt-soft` | `#f4f4f4` | `#1d1d20` | Softer alt surface |
| `--color-pill-bg` | `#eef2f7` | `#252933` | Participant pills |
| `--color-border` | `#d4d4d4` | `#35353b` | Input/card borders |
| `--color-cell-empty` | `#eee` | `#242428` | Empty grid cells |
| `--color-primary` | `#10b981` | same | Selection, focus ring, success |
| `--color-primary-soft` | `#6ee7b7` | `#0e5740` | Hover previews |
| `--color-primary-rgb` | `16, 185, 129` | same | For `rgba(...)` heatmap |
| `--color-on-primary` | `#ffffff` | same | Text on primary |
| `--color-danger` | `#fca5a5` | `#7f1d1d` | Error border |
| `--color-danger-strong` | `#b91c1c` | `#fca5a5` | Error text |
| `--color-danger-soft` | `#fef2f2` | `#2b1113` | Error background |

### Radius

| Token | Value | Uses |
|---|---|---|
| `--radius-xs` | 1px | Grid cells |
| `--radius-sm` | 2px | Datepicker days, legend swatches |
| `--radius-md` | 3px | Buttons, inputs, hints, errors |
| `--radius-pill` | 10px | Participant pills |

### Spacing (4px base)

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |

Off-scale micro-values (`2px`, `6px`, `10px`) remain as literals for control internals (e.g., input `padding: 10px`) and tight grid gaps.

### Motion

| Token | Value | Uses |
|---|---|---|
| `--duration-fast` | 120ms | Hover, focus, dot state |
| `--duration-base` | 220ms | Edge affordance, pill, share link |
| `--duration-slow` | 320ms | Collapse / expand |
| `--ease-standard` | `ease` | Default curve |

The save-sync keyframe pulse (`1100ms`) is a semantic heartbeat, not a UI transition — stays as a literal.

### Elevation

| Token | Light | Dark | Uses |
|---|---|---|---|
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.08)` | `0 2px 12px rgba(0,0,0,0.55)` | Floating FAB, popovers |

### Typography

All monospace. One scale covers body + headings.

| Token | Size | Uses |
|---|---|---|
| `--text-2xs` | 0.70rem | Axis labels, legend |
| `--text-xs` | 0.75rem | Hints, fine print |
| `--text-sm` | 0.80rem | Chips, panel titles, save indicator |
| `--text-base` | 0.85rem | Body default, buttons, inputs |
| `--text-md` | 0.90rem | h3, `.muted` |
| `--text-lg` | 1.15rem | h2 |
| `--text-xl` | 1.60rem | h1 |
| `--text-display` | 2rem | Landing title |

## Components

### Button (`button`, `.btn`)

Primary action. Solid `--color-fg` background, `--color-surface` text.

| Variant | Selector | Use when |
|---|---|---|
| Primary | `button`, `.btn` | Main action |
| Secondary | `.btn.secondary` | Supporting action |
| Ghost (identify) | `.identify button` | Inline form submit — inverts on hover |

| State | Behavior |
|---|---|
| Default | Solid fg background |
| Hover | `opacity: 0.88` |
| Focus-visible | 2px primary outline, 2px offset |
| Disabled | `opacity: 0.5`, `cursor: not-allowed` |

### Text input / select / textarea

| State | Behavior |
|---|---|
| Default | 1px border, surface background |
| Focus | 2px primary outline, primary border |

### Datepicker (`.datepicker`)

Two modes toggled via `.mode-specific` / `.mode-dow`.

- **Specific**: 7-column grid of days; `.dp-day` is the cell.
- **Day-of-week**: 7-column tall bars; `.dp-dow-col` is the cell.

| State | Specific | DoW |
|---|---|---|
| Default | `--color-cell-empty` | `--color-cell-empty` |
| Hover | `--color-primary-soft` | `--color-primary-soft` |
| Selected | `--color-primary` + `--color-on-primary` | same |
| Past | transparent, `--color-subtle`, not clickable | — |

### Grid cell (`.cell`)

Dual-use: personal availability (editable) and group availability (heatmap).

**Editable grid** (`.grid:not(.heatmap):not(.disabled)`)

| State | Behavior |
|---|---|
| Default | `--color-cell-empty` |
| Hover | `--color-primary-soft` |
| Selected | `--color-primary` |
| Selected + hover | `opacity: 0.88` |
| Focus-visible | 2px primary inset outline |

A11y: `role="button"`, `tabindex="0"`, `aria-pressed`. Keyboard: Arrow keys move focus, Space/Enter toggles.

**Heatmap grid** (`.grid.heatmap`)

Read-only. `--intensity` CSS var drives alpha on the primary ramp. `title` attr carries the name list.

### Participant pill (`.participant-list .pill`)

| Variant | Selector |
|---|---|
| Static | `.pill` |
| Selectable (filter) | `.pill.selectable` |

| State | Selectable |
|---|---|
| Default | `--color-pill-bg` |
| Hover | `--color-primary-soft` |
| Selected | `--color-primary` + `--color-on-primary` + primary border |
| Focus-visible | 2px primary outline, 1px offset |

### Share link (`.share-link`)

Click-to-copy control. The `::before` pseudo-element supplies the leading label (`Copy link · ` → `Copied · `).

| State | Behavior |
|---|---|
| Default | Surface background, border, full URL visible |
| Hover | `--color-surface-alt` background |
| Copied | `--color-primary` background, label flips to "Copied" |

### Save indicator (`.save-indicator`)

Inline dot + text. Driven by `data-state`: `saved` / `saving` / `error`.

| State | Dot | Text |
|---|---|---|
| Saved | primary (steady) | `Saved · {rel time}` |
| Saving | primary ⇄ subtle (1.1s pulse) | `Saving…` |
| Error | `--color-danger-strong` | `Couldn't save — retry` |

Collapses (hides text) 60s after save; hover/focus expands.

### New-event edge affordance (`.new-event-edge`)

Viewport-edge "plus" link back to `/`. Responsive:
- ≥1280px: full-width edge with label
- 1120–1279px: icon only
- <1120px: bottom-left circular FAB, `--shadow-sm`

### Hint & error blocks

- `.hint`: surface-alt background, body text. Neutral informational.
- `.error`: danger-soft background, danger-strong text, danger border.

### Results legend (`.results-legend`)

Four swatches from lightest to darkest, labelled `0` and `{maxCount}`. Uses the same `rgba(primary, intensity)` ramp as heatmap cells.

### Best-slots list (`.best-slots`)

Numbered `<ol>` with `[data-slot]` hover highlight. Click syncs highlight back to heatmap (via grid JS).

## Audit snapshot (2026-04-21)

Score **78/100** → **~85/100** after the priority actions below.

### Completed

- [x] Spacing scale (`--space-1..7`), replaces ~40 literals
- [x] Motion tokens (`--duration-fast/base/slow`, `--ease-standard`)
- [x] `--shadow-sm` with dark variant
- [x] `:focus-visible` on buttons and grid cells
- [x] Grid cells now keyboard-operable (`role="button"`, `tabindex`, `aria-pressed`, arrow-key nav, Space/Enter toggle)
- [x] Component catalog in this file

### Remaining (from the critique, not yet addressed)

- [ ] Mobile share-link layout (label fades, URL overflows)
- [ ] Dark-mode heatmap low-end intensity (`count=1` cell can appear dimmer than `count=0`)
- [ ] Promote "Best times" visual weight
- [ ] Disambiguate selected-pill green from selected-cell green
