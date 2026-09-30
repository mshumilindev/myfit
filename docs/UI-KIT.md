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

| Primitive                                                     | For                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `IconButton`                                       | every button variant / size / state                                                                                                                |
| `Card`, `Banner`, `Chip` + `ChipGroup`                        | surfaces, frosted banners, pills                                                                                                                   |
| `Calendar` (+ `CalendarLegend`)                               | THE calendar: single / range, open end, min / max / disabled, markers, today ring, keyboard grid, presets slot, 1–2 months                         |
| `GroupedList` + `ListRow` + `ListPanel`                       | settings-style groups: icon, label + sub, value, chevron, check, switch, action rows, expansion panel                                              |
| `Segmented`                                                   | one-of-N: iOS `track` or toned `buttons`                                                                                                           |
| `Switch`                                                      | role="switch" checkbox, toned                                                                                                                      |
| `PresetChips`                                                 | toggle chips (date presets, body parts, filters), wrap or scroll                                                                                   |
| `PinToggle`                                                   | pin / unpin: icon, boxed, row-with-switch                                                                                                          |
| `IconTile`                                                    | rounded icon square in a family, 22–56px                                                                                                           |
| `CategoryRow`                                                 | browse-by-category card (tile, title, count, meta, minis)                                                                                          |
| `Snackbar`                                                    | confirmation with Undo (presentational; caller owns the timer)                                                                                     |
| `StickyActionBar`                                             | pinned bottom bar (page, safe-area) or panel foot                                                                                                  |
| `Timeline` (+ `TimelineDate`)                                 | read-only period rail with lanes, Now, gaps, months                                                                                                |
| `ToneText`                                                    | inline text in a family colour                                                                                                                     |
| `MonthGrid` (+ `MonthGridLegend`)                             | browse a month of day tiles: markers (phone) or named chips (desktop), health tints, planned dashes, today ring, selection                         |
| `StatStrip`                                                   | a row of numbers in one card (value + unit + label per cell, toned values)                                                                         |
| `StoryBubble` (+ `StoryRow`, `StoryDivider`)                  | stories bubble: face/initial in a state ring (default · new · live · alert · atlas), count or "!" badge, name, "+N more"; scrolling row + hairline |
| `BrandBar` (+ `BellButton`)                                   | THE app header in every sub-app: wordmark, app label, actions slot, language chip                                                                  |
| `TabBar`                                                      | THE bottom bar (generic items; optional centre `fab` with attention pulse; `tabs` + `activeFill` for sub-apps)                                     |
| `BackButton`                                                  | every back control (round well; `text` pill; `overlay`)                                                                                            |
| `Field` / `TimeField` / `Select` / `Textarea` / `SearchField` | every text, time, select, multi-line and search input (label, hint, error, lead / trail; `bare` for in-row values)                                 |
| `Widget` + `uiw-t-*`                                          | Today widgets; typography only through the `uiw-t-*` scale, never inline styles                                                                    |

**Guards (tests/kit-guard.test.ts):** no raw `<button>`, no legacy `.btn` class, no raw `<select>` / `<textarea>`, and `<input>` only with a `// kit-ok` comment (hidden file / range inputs) outside `components/ui/`.

## Primitive backlog & prop shapes

Extraction order and initial prop shapes live in `docs/UI-REFACTOR-PLAN.md §5 and §9`.
Summary of the canonical set: `Button`/`IconButton`, `Card`, `Chip`/`Pill` (+`ChipGroup`),
`Banner`, `ListRow`, `SectionLabel`, `Field`/`Input`/`NumberStepper`, `Segmented`,
`WizardStepper`, `ProgressDots`, `StatTile`, `TrafficLightOption`. Each maps variants to
tokens only, ships all states to the gallery, and absorbs the feature-scoped classes it
replaces (`.btn*` + `.rx .btn.*` → `Button`, etc.).

## Text.css utilities, geometry contract, guards (Brass Glass)

- `components/ui/Text.css` holds atomic utilities: type (`ut-2xs…ut-display`, `ut-w5..w8`, `ut-tight/tighter/caps/num`), colour (`ut-text/muted/dim/faint/accent/accent-hi/accent-lo/ok/danger/tone`) and radius (`ur-sm/md/lg/pill/round`). Selectors are doubled (`.ut-x.ut-x`) so they beat feature CSS. Use these instead of inline `style`.
- Kit geometry (padding/size/radius of `.uibtn`, `.uicard`, …) lives in `:where()` so feature CSS can override it with a qualified selector (`.uibtn.my-hook`). Feature CSS must never restyle kit visuals (colour, radius, background) — change the kit or `glass.css`.
- `TimeField` is the kit time input; `Chip` wraps children in `span.uichip-l`.
- `tests/kit-guard.test.ts` enforces: no raw `<button>`, no legacy `.btn`, no raw select/textarea (`<input>` needs `// kit-ok`), no static visual inline styles.

## Design tokens (single source of truth: `styles.css` :root, theme overrides in `glass.css`)

Every literal in feature CSS is a token; `tests/kit-guard.test.ts` fails on raw values.

- Type: `--fs-9 … --fs-52` (21 steps). Radius: `--r-2 … --r-24`, `--r-pill`, `--r-round`. Spacing (gap/padding/margin 2–48px): `--s-2 … --s-48`. Stacking layers: `--z-20 … --z-200`. Colours: semantic `--color-*`/tone families, plus the raw palette `--c-RRGGBB` (alpha via `color-mix(in srgb, var(--c-…) 14%, transparent)`).
- To restyle globally edit those values (verified: changing `--r-*`, `--fs-*`, `--s-*` and `--color-accent` in one `<style>` re-skins the whole app).

## Kit API for one-off looks (no feature CSS on kit elements)

- `Button`/`IconButton`: `shape="pill"|"round"`, variants `ok` (positive outline) and `photo` (frosted on imagery). `Chip onPhoto`. `Card emphasis="hero"`.
- `Field`/`SearchField` skin hooks (custom properties, set on the field or a wrapper): `--field-radius`, `--field-bg`, `--field-ring`, `--field-ph`, `--field-lead`.
- Layout utilities in `components/ui/Layout.css`: `ul-flex ul-col ul-wrap ua-* uj-* uf-1 umw-0 uw-full utx-* ug-N umt-N umb-N` (replace inline `style={{ display:'flex', gap… }}`).
- Overlays live in `components/ui/Overlays.tsx` (+ `.css`): `Sheet`, `Dialog`, `ConfirmDialog`, `Toast`, `UndoSnackbar`, `UpdatePlate` (re-exported from `ui.tsx`). Skeletons: `Skeleton`, `Skeletons.tsx`. Empty states: `EmptyState` only.
- Guards: no feature CSS (outside `components/ui`, `glass.css`) sets background/colour/radius/shadow/border-colour on a kit element; no static layout inline styles; no raw px/colour/z literals.

## Sheet chrome & page headers (consistency rules)

- Every sheet: chrome (grabber centred, round × top-right) → exactly 16px → first block. Enforced by `.sheet > .sheet-chrome` margin + `.sheet > .sheet-chrome + * { margin-top: 0 }` in `Overlays.css`; feature CSS must not add top margin to a sheet's first block.
- A sheet row that contains a `‹ Back` button (`.sheet :has(> .uiback)`) is sticky: back + title + row actions stay visible while the body scrolls.
- Nutrition's sheet is the kit `Sheet` (no own chrome).
- Page headers: stacked (‹ Overview pill → `--head-gap` 14px → title 30/700) and row (round back + title 26, min-height 48 so back sits at y=72 everywhere). All title selectors are listed in `redesign.css` "Page titles come in exactly two sizes".

Update: Overview drill-ins now use the round icon back button + title in ONE 36px row (`OverviewBack` has no text). In sheets only the grabber is pinned (`.sheet-grip`, sticky, no layout space); a row with `.uiback` pins below it and fills only once content scrolls under it. `--color-neutral-600` raised to #80858a (≥4.5:1 on the glass background).

### Update: states, labels, button sizes

- `components/ui/States.css` owns hover/press for every interactive kit primitive (`--state-hover`, `--state-press`); feature CSS must not add its own `:active`/`:hover` transforms.
- Button heights come only from kit sizes (sm 36 / md 46 / lg 52); feature classes (`pb-start`, `exl-new`, `pg-tile-members`) must not set `min-height`/`font-size`.
- Disabled buttons are opaque (`filter`), never `opacity`; `--btn-under` keeps glass buttons opaque over content.
- Sheets: `.sheet-grip` (draggable handle, sticky) is separate from `.sheet-chrome` (× row); first content gap is 16px everywhere.
- `RailItem` accepts `glyph` (text/number marker) besides `icon`.

### Update: radii, chips, buttons (iteration 19b)

- Radius vocabulary (Brass Glass): card 18 (`--radius-lg`), hero 24, inset rows/tiles 12 (`--radius-md`), thumbs 8 (`--radius-sm`), fields 14, pills 999. `glass.css` forces card/hero radius with `!important` so a feature class can no longer change a Card's radius.
- Small status labels are `Tag`; selectable/info pills are `Chip` (`size="sm"`, `muted`, `nested` for a chip inside a clickable card; label may hold figure + text + count). Do not add `.tag`/`*-chip` classes.
- Muscle maps use `--body-dim` / `--body-dim-stroke` (light palette grey in glass, dark in graphite). Raster physique figures stay dark.
- Button/IconButton sizes come from the kit only (sm 36, md 46, lg 52); feature classes may not set `height`/`min-height`/`font-size`/`padding` on them (154 such declarations were removed).
- Page header → first block is exactly 16px on phone (`.screen` gap rule at the end of `redesign.css`); do not add `ug-*` gap utilities or body padding-top on screens with a header row.

## Update: iteration 19c

- Remaining bespoke pills/badges (hours, live, current-exercise, muscle-target, feat/standard tags, plate, equipment, sleep-auto, activity category, sub-muscle) now use kit `Tag`.
- Primary/secondary Button colour overrides (Mastery, Plate, Circuit, Session) removed; variants own colour.
- `.mst-head` joined the shared page-header rules (26px title, 16px gap).

## Update: iteration 19d

- `SearchField` is the ONLY search input (ref, id, aria-*, onFocus/onKeyDown, `hint` while empty). Exercise picker and both Log-activity searches now use it; `.la-search` field overrides removed.
- Phone drawers (`.sheet`) have no close ×: grabber, swipe and scrim close them (`.sheet-close` is hidden < 720px). Sheets never carry an extra Back/× of their own (Exercise editor, Physique, Focus fixed). Desktop dialogs keep the ×.
- Sticky search strips (`.la-sticky`) have no plate in Brass Glass.
- Standalone tiles (la-sug, onb-gym-card, tac-tile, past-ex-card, resume-activity) are plain Cards; their own bg/border/radius removed.
- HealthForm: "Still ongoing" is disabled (with a hint) while start/end date is in the future.

## Update: set-type colour coding (iteration 19e)

- Set-entry card (`.gset`) in Brass Glass: kind (warm-up blue, drop violet, reverse teal, static-dynamic pink, PR gold, failure red) tints plate + ring + glow via `::after` (glass.css).
- Set editor: type chips, load/type/effort cards take the same hue (`se-kind-*` → `--kc`).
- Options sheet footer: Delete exercise on This set / Exercise tabs, Discard session on Session tab; the Exercise tab no longer repeats the delete row.
- Effort (RPE) chips: equal cells, centred labels.

## Правило: правки UI — тільки через кіт (2026-09-30)

Візуальні зміни — властивість/варіант примітива в `components/ui/`. Якщо не
виходить — оверрайд у `glass.css`/`redesign.css` під конкретним фіче-класом, з
коментарем «чому не кіт», без візуальних властивостей на `.ui*` і без
дублікатів (повторюється — піднімаємо в кіт). Деталі: `.cursor/rules/ui-kit.mdc`.

## Sheet `tone` (кольорове кодування шторок)

`<Sheet tone="ok|rest|active|illness|danger">` фарбує всю шторку (фон, край, грабер, заголовок `.ss-title` / `.day-sheet-head .t`) через `--t-*` сім'ї; стилі — `glass.css` (`.sheet--toned`). Використання: Start (зелена, коли вже тренувався сьогодні), DayHistorySheet (done=ok, missed=danger, rest=rest, vacation=active, illness=illness).

## The `chronic` tone (long-term health conditions)

A semantic family for long-term health conditions, separate from injury/illness colours. Tokens (defined in `styles.css` :root, themed in `glass.css`): `--color-chronic`, `--color-chronic-tint`, `--color-chronic-text`, `--color-chronic-line`, `--color-chronic-deep`.

Where it is used, always through the kit and never with feature CSS:

- `ListRow` — the `IconTile` takes `tone="chronic"`.
- `Notice` — `tone="chronic"` for shields and hints about condition limits.
- `Button` — a filled button inherits the tone of its context (chip/row/notice) instead of a per-button colour.
- `AnatomyMap` — condition marks on the body map (Bones / Muscles / Organs / Other layers).

Use the tone only for things that come from the person's conditions, so the colour keeps its meaning.
