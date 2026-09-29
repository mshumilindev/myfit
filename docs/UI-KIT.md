# Spotter — UI kit & token conventions

This is the contract for building UI in Spotter so new features look right **by
construction** instead of by hand-matching. Read this before you add or restyle a
screen. It is the companion to `docs/UI-REFACTOR-PLAN.md` (the migration plan);
this file is the standing reference.

---

## The four rules

1. **Features never write raw visual classes or inline styles for anything the kit
   covers.** Compose from the primitives in `client/src/components/ui/` — `<Button
variant="primary">`, `<Card tone="danger">`, etc. Layout-only inline styles
   (flex/grid/gap for a one-off arrangement) are fine; _visual_ inline styles
   (colour, border, radius, background, shadow, padding that the kit owns) are not.
2. **Colours, radii and spacing come only from tokens** — never a raw hex in
   `views/` or `components/` (outside `components/ui/`). One place changes a colour
   app-wide: the `:root` block in `client/src/styles.css`.
3. **Every primitive has Storybook stories next to it** (`Name.stories.tsx`, CSF3)
   covering all variants and states — default / hover-able / active / disabled /
   error, empty and long text, the 5 locales where text matters. Storybook is the
   primary catalog and the acceptance surface; the in-app gallery (`#/uikit`) stays
   as a quick on-device token check. `components/ui/kit.test.ts` fails the test run
   when a primitive has no story file.
4. **Reusable UI goes to the kit first.** Anything a second screen could use — a
   row, a picker, a calendar, a bar — is built in `components/ui/` with its stories
   **before or together with its first use**, never as page-local CSS "for now".

Enforced by `.cursor/rules/ui-kit.mdc` (always applied) and the kit test.

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

### Health & activity families (each has `base` · `tint` · `text` · `line`)

- **sleep** `--color-sleep*` violet — sleep rows, Start sleep.
- **illness** `--color-illness*` amber — unwell periods (softer than the gold accent).
- **injury** `--color-injury*` warm red — injuries / rehab on Health (not the error red).
- **active** `--color-active*` teal — active recovery (darker than full-rest blue).
- **rest** `--color-rest*` — the rest ramp as a family: full rest, recovery activities.
- **sport** `--color-sport*` court green — sports activities.
- **accent** `--color-accent-tint/-text/-line` — gold as a family: gym, conditioning.

In components, pick a family with the `Tone` type (`components/ui/tones.ts`); the
`uit--<tone>` class binds `--t-base / --t-tint / --t-text / --t-line / --t-on` for
the primitive's CSS. A page that groups toned children (Log activity `.la-g/.la-s/.la-r`)
sets the same `--t-*` vars and passes `tone="inherit"`.

### Surfaces, radii, spacing, type

- Surfaces: `--color-bg` (app background), `--color-surface` (cards), `--color-text`,
  `--color-divider`. `--color-surface-2` exists in themed scopes; elsewhere use the
  fallback form `var(--color-surface-2, #26282d)`.
- Radii: `--radius-sm 4` · `--radius-md 8` · `--radius-lg 14` · `--radius-sheet 20`.
- Text tiers: `--color-text-muted` (secondary), `--color-text-faint` (tertiary),
  `--color-text-disabled`; `--color-tile` (raised surface), `--color-border`,
  `--color-scrim` (sheet dim). `--color-surface-2` is now a real `:root` token.
- **Spacing — the 8-pt scale for the kit and every new/refactored screen:**
  `--sp-1 4` · `--sp-2 8` · `--sp-3 12` · `--sp-4 16` · `--sp-5 20` · `--sp-6 24` ·
  `--sp-8 32` · `--sp-10 40`. Page gutters 16 (phone) / 24 (web); 24 between
  sections; 8 header→group; row padding 8×16; 12 between siblings in a row.
  The legacy `--space-1 … -8` (2.8px unit) is for untouched legacy screens only.
- Radii: also `--radius-xl 12` (calendar days, segments) and `--radius-pill`.
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

Health / Log activity canvases (`docs/design/health`, `docs/design/log-activity`)
use raw hexes. Translate:

| Design hex               | App token                                   |
| ------------------------ | ------------------------------------------- |
| `#9d8cf0` / `#211d38`    | `--color-sleep` / `--color-sleep-tint`      |
| `#f0a35e` / `#33200f`    | `--color-illness` / `--color-illness-tint`  |
| `#e2786a` / `#351613`    | `--color-injury` / `--color-injury-tint`    |
| `#5cc8a8` / `#0d2b27`    | `--color-active` / `--color-active-tint`    |
| `#93d4f2` / `#0e2a3b`    | `--color-rest` / `--color-rest-tint`        |
| `#a8dc7c` / `#1f2f14`    | `--color-sport` / `--color-sport-tint`      |
| `#262a2d` / `#3b3f43`    | `--color-tile` / `--color-border`           |
| `#90959a` / `#71767b`    | `--color-text-muted` / `--color-text-faint` |
| `#4f5358` (disabled day) | `--color-text-disabled`                     |
| `#2e2414` (gym tint)     | `--color-accent-tint`                       |

Two `.rx`-local values have no exact app token yet and stay literal: `--dgrrose`
(#d59a95, a rose danger tint used once) and `--surface2` (#26282c). Promote them to
`:root` if a second use appears.

---

## How to build a new screen

1. Start from the design's `.dc.html`. Translate every design token through the map
   above — never copy a hex.
2. Compose from `components/ui/` primitives. If the design needs something the kit
   doesn't have, that's a **new primitive**: add it to `components/ui/` with its
   `*.stories.tsx` first (its own slice), then use it.
3. No raw `.btn*`, `.card*`, `.chip*`, `.pill*` etc. in the view; no visual inline
   styles. Layout-only inline styles are allowed.
4. Run the working loop (see `UI-REFACTOR-PLAN.md §1`): screenshot before, change,
   gates (tsc/eslint/vitest/build all green), screenshot after, compare — a refactor
   changes code, not pixels.

---

## Storybook

```bash
npm run storybook          # dev, http://localhost:6006 (root alias → client workspace)
npm run build-storybook    # static catalog → client/storybook-static/
```

- Config: `client/.storybook/` — `main.ts` (reuses `client/vite.config.ts` minus the
  PWA plugin; every `…/firebase` import resolves to a demo stub, stories never touch
  the real backend), `preview.tsx` (loads `styles.css` + `redesign.css` + Inter,
  background = `--color-bg`, viewports **Phone 390×844** and **Web 1280×800**,
  a **Locale** toolbar en / uk / pl / lt / et driving the app's own i18n).
- Stories: `Kit/<Primitive>` next to the component; composed page sections under
  `Pages/…` (`views/health/Health.stories.tsx`, `views/logActivity/LogActivity.stories.tsx`)
  seed the store through `src/stories/fixtures.ts`. `LocaleMatrix` renders a
  primitive with each locale's real strings for the long-text check.
- Screenshot check: open `iframe.html?id=<story-id>` at 390 and 1280 (Playwright)
  before and after a change, compare.

## Definition of done for UI work

- Reusable pieces live in `components/ui/`, tokens only (no raw hex), 8-pt spacing.
- Every primitive touched has stories for all variants / states / long text.
- `kit.test.ts`, tsc, eslint, prettier, vitest green; `npm run build-storybook` builds.
- Before/after screenshots (Storybook, 390 and 1280) compared — a refactor changes
  code, not pixels, unless the change is a deliberate design fix.

## Current kit

| Primitive                                    | For                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `IconButton`                      | every button variant / size / state                                                                                                                |
| `Card`, `Banner`, `Chip` + `ChipGroup`       | surfaces, frosted banners, pills                                                                                                                   |
| `Calendar` (+ `CalendarLegend`)              | THE calendar: single / range, open end, min / max / disabled, markers, today ring, keyboard grid, presets slot, 1–2 months                         |
| `GroupedList` + `ListRow` + `ListPanel`      | settings-style groups: icon, label + sub, value, chevron, check, switch, action rows, expansion panel                                              |
| `Segmented`                                  | one-of-N: iOS `track` or toned `buttons`                                                                                                           |
| `Switch`                                     | role="switch" checkbox, toned                                                                                                                      |
| `PresetChips`                                | toggle chips (date presets, body parts, filters), wrap or scroll                                                                                   |
| `PinToggle`                                  | pin / unpin: icon, boxed, row-with-switch                                                                                                          |
| `IconTile`                                   | rounded icon square in a family, 22–56px                                                                                                           |
| `CategoryRow`                                | browse-by-category card (tile, title, count, meta, minis)                                                                                          |
| `Snackbar`                                   | confirmation with Undo (presentational; caller owns the timer)                                                                                     |
| `StickyActionBar`                            | pinned bottom bar (page, safe-area) or panel foot                                                                                                  |
| `Timeline` (+ `TimelineDate`)                | read-only period rail with lanes, Now, gaps, months                                                                                                |
| `ToneText`                                   | inline text in a family colour                                                                                                                     |
| `MonthGrid` (+ `MonthGridLegend`)            | browse a month of day tiles: markers (phone) or named chips (desktop), health tints, planned dashes, today ring, selection                         |
| `StatStrip`                                  | a row of numbers in one card (value + unit + label per cell, toned values)                                                                         |
| `StoryBubble` (+ `StoryRow`, `StoryDivider`) | stories bubble: face/initial in a state ring (default · new · live · alert · atlas), count or "!" badge, name, "+N more"; scrolling row + hairline |

## Primitive backlog & prop shapes

Extraction order and initial prop shapes live in `docs/UI-REFACTOR-PLAN.md §5 and §9`.
Summary of the canonical set: `Button`/`IconButton`, `Card`, `Chip`/`Pill` (+`ChipGroup`),
`Banner`, `ListRow`, `SectionLabel`, `Field`/`Input`/`NumberStepper`, `Segmented`,
`WizardStepper`, `ProgressDots`, `StatTile`, `TrafficLightOption`. Each maps variants to
tokens only, ships all states to the gallery, and absorbs the feature-scoped classes it
replaces (`.btn*` + `.rx .btn.*` → `Button`, etc.).
