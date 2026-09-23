# Spotter — UI kit & token conventions

This is the contract for building UI in Spotter so new features look right **by
construction** instead of by hand-matching. Read this before you add or restyle a
screen. It is the companion to `docs/UI-REFACTOR-PLAN.md` (the migration plan);
this file is the standing reference.

---

## The three rules

1. **Features never write raw visual classes or inline styles for anything the kit
   covers.** Compose from the primitives in `client/src/components/ui/` — `<Button
variant="primary">`, `<Card tone="danger">`, etc. Layout-only inline styles
   (flex/grid/gap for a one-off arrangement) are fine; _visual_ inline styles
   (colour, border, radius, background, shadow, padding that the kit owns) are not.
2. **Colours, radii and spacing come only from tokens** — never a raw hex in
   `views/` or `components/` (outside `components/ui/`). One place changes a colour
   app-wide: the `:root` block in `client/src/styles.css`.
3. **Every primitive lives in the gallery** (`#/uikit`) in all its variants and
   states. The gallery is the acceptance surface — a primitive isn't "done" until
   it shows there and has been screenshot-verified in the working loop.

Feature-specific composition (the rehab stage ladder, the session builder wizard)
still lives in the feature — but it is _built out of_ kit primitives (Card, ListRow,
Chip, ProgressDots), not bespoke CSS.

---

## Token catalogue

All tokens are declared in `client/src/styles.css :root`. See them live at `#/uikit`.

### Colour ramps

- **Accent** `--color-accent` (= `-500`) plus `--color-accent-100 … -900`. Brass/gold.
  The primary brand colour: primary actions, the active/selected state, and _caution_
  (a warm warning that isn't an error). Ramp goes light (100) → dark (900).
- **Neutral** `--color-neutral-100 … -900`. Greys for text tiers, dividers, disabled
  states, and surfaces that aren't the semantic families. 100 = near-white, 900 = near-bg.
- **Rest** `--color-rest-200/300/400/700/800/900`. Blue topaz — a saturated azure,
  deliberately _bluer_ than ok-green so "rest" never reads as "done". Used for
  date-bound rest, sleep, and recovery. `-400` is the base.

### Semantic families (each has `base` · `tint` · `text` · `line`)

Pattern: `base` = the saturated colour (icon/accentline), `tint` = very dark fill for
a surface, `text` = light readable foreground on that tint, `line` = mid border.

- **ok** `--color-ok` / `-tint` / `-text` / `-line`. Green. Progress, success, "done",
  positive check-in outcomes.
- **danger** `--color-danger` / `-tint` / `-text` / `-line`. Red. Errors, destructive
  actions, and **rehab/injury** (the injury feature reads as danger-tinted).
- **kcal** `--color-kcal` / `-tint` / `-text` / `-line`. Lazurite blue. Calories /
  energy only (matches Spotter Nutrition). Do **not** use for rest — rest is its own
  bluer ramp.

### Surfaces, radii, spacing, type

- Surfaces: `--color-bg` (app background), `--color-surface` (cards), `--color-text`,
  `--color-divider`. `--color-surface-2` exists in themed scopes; elsewhere use the
  fallback form `var(--color-surface-2, #26282d)`.
- Radii: `--radius-sm 4` · `--radius-md 8` · `--radius-lg 14` · `--radius-sheet 20`.
- Spacing: `--space-1 … -8` (2.8px unit scale); gutters `--gutter` / `--gutter-phone`.
- Type: `--font` (Inter stack). Tap target: `--tap-min 44px`. Safe-area:
  `--safe-top` / `--safe-bottom`.
- Glass: `--glass-*` (graphite), `--glass-brass-*` (accent), `--glass-rest-*` (rest).
- Shadows: `--shadow-sm/md/lg`.

---

## Design → app token map

Our designs arrive as `.dc.html` canvases that use short token names. Translate them
1:1 to app tokens — no guessing, no new hexes.

| Design token            | App token                         | Notes                  |
| ----------------------- | --------------------------------- | ---------------------- |
| `--bg`                  | `--color-bg`                      | #16171a                |
| `--surface`             | `--color-surface`                 | #1f2125                |
| `--surface2`            | `var(--color-surface-2, #26282d)` | ≈ #26282c              |
| `--text`                | `--color-text`                    | #e9eaec                |
| `--div`                 | `--color-divider`                 |                        |
| `--acc`                 | `--color-accent`                  | = `--color-accent-500` |
| `--acc300`              | `--color-accent-300`              |                        |
| `--acc700`              | `--color-accent-700`              |                        |
| `--g300 … --g900`       | `--color-accent-300 … -900`       | gold ramp              |
| `--n300 … --n900`       | `--color-neutral-300 … -900`      | grey ramp              |
| `--ok`                  | `--color-ok`                      |                        |
| `--oktext`              | `--color-ok-text`                 |                        |
| `--okt`                 | `--color-ok-tint`                 |                        |
| `--okl` / `--okline`    | `--color-ok-line`                 |                        |
| `--dng` / `--dgr`       | `--color-danger`                  |                        |
| `--dngtext`/`--dgrtext` | `--color-danger-text`             |                        |
| `--dngtint`/`--dgrt`    | `--color-danger-tint`             |                        |
| `--dngline`/`--dgrline` | `--color-danger-line`             |                        |
| `--kcal`                | `--color-kcal`                    | energy only            |
| `--rest`                | `--color-rest-400`                | base                   |
| `--rest300`             | `--color-rest-300`                |                        |
| `--rest200`             | `--color-rest-200`                |                        |
| `--restt`               | `--color-rest-900`                | dark tint              |
| `--restline`            | `--color-rest-800`                |                        |
| `--rest700`             | `--color-rest-700`                |                        |
| `--r-sm/-md/-lg/-sheet` | `--radius-sm/-md/-lg/-sheet`      |                        |

Two `.rx`-local values have no exact app token yet and stay literal: `--dgrrose`
(#d59a95, a rose danger tint used once) and `--surface2` (#26282c). Promote them to
`:root` if a second use appears.

---

## How to build a new screen

1. Start from the design's `.dc.html`. Translate every design token through the map
   above — never copy a hex.
2. Compose from `components/ui/` primitives. If the design needs something the kit
   doesn't have, that's a **new primitive**: add it to `components/ui/` + the gallery
   first (its own slice), then use it.
3. No raw `.btn*`, `.card*`, `.chip*`, `.pill*` etc. in the view; no visual inline
   styles. Layout-only inline styles are allowed.
4. Run the working loop (see `UI-REFACTOR-PLAN.md §1`): screenshot before, change,
   gates (tsc/eslint/vitest/build all green), screenshot after, compare — a refactor
   changes code, not pixels.

---

## Primitive backlog & prop shapes

Extraction order and initial prop shapes live in `docs/UI-REFACTOR-PLAN.md §5 and §9`.
Summary of the canonical set: `Button`/`IconButton`, `Card`, `Chip`/`Pill` (+`ChipGroup`),
`Banner`, `ListRow`, `SectionLabel`, `Field`/`Input`/`NumberStepper`, `Segmented`,
`WizardStepper`, `ProgressDots`, `StatTile`, `TrafficLightOption`. Each maps variants to
tokens only, ships all states to the gallery, and absorbs the feature-scoped classes it
replaces (`.btn*` + `.rx .btn.*` → `Button`, etc.).
