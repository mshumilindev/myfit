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

Enforced by `.claude/rules/ui.md` (always applied) and the kit test.

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
- **gym / people** `--color-gym*` / `--color-people*` — fixed identity of the Gym (gold) and People (silver) apps. Use these (not `accent`) where a row must keep its own app colour whatever app is active (app switcher): per-app themes re-skin `--color-accent`.

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
  `Pages/…` (`views/health/Health.stories.tsx`, `views/logActivity/LogActivity.stories.tsx`,
  `views/sessionSummary/NicotineCard.stories.tsx`)
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

| Primitive                                                     | For                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `IconButton`                                       | every button variant / size / state                                                                                                                                                                                                                                                                                  |
| `Card`, `Banner`, `Chip` + `ChipGroup`                        | surfaces, frosted banners, pills                                                                                                                                                                                                                                                                                     |
| `Calendar` (+ `CalendarLegend`)                               | THE calendar: single / range, open end, min / max / disabled, markers, today ring, keyboard grid, presets slot, 1–2 months                                                                                                                                                                                           |
| `GroupedList` + `ListRow` + `ListPanel`                       | settings-style groups: icon, label + sub, value, chevron, check, switch, action rows, expansion panel                                                                                                                                                                                                                |
| `Segmented`                                                   | one-of-N: iOS `track` or toned `buttons`                                                                                                                                                                                                                                                                             |
| `Switch`                                                      | role="switch" checkbox, toned                                                                                                                                                                                                                                                                                        |
| `PresetChips`                                                 | toggle chips (date presets, body parts, filters), wrap, scroll or equal-column grid (weekdays)                                                                                                                                                                                                                       |
| `PinToggle`                                                   | pin / unpin: icon, boxed, row-with-switch                                                                                                                                                                                                                                                                            |
| `IconTile`                                                    | rounded icon square in a family, 22–56px                                                                                                                                                                                                                                                                             |
| `CategoryRow`                                                 | browse-by-category card (tile, title, count, meta, minis)                                                                                                                                                                                                                                                            |
| `Snackbar`                                                    | confirmation with Undo (presentational; caller owns the timer)                                                                                                                                                                                                                                                       |
| `StickyActionBar`                                             | pinned bottom bar (page, safe-area) or panel foot                                                                                                                                                                                                                                                                    |
| `Timeline` (+ `TimelineDate`)                                 | read-only period rail with lanes, Now, gaps, months                                                                                                                                                                                                                                                                  |
| `ToneText`                                                    | inline text in a family colour                                                                                                                                                                                                                                                                                       |
| `MonthGrid` (+ `MonthGridLegend`)                             | browse a month of day tiles: markers (phone) or named chips (desktop), health tints, planned dashes, today ring, selection                                                                                                                                                                                           |
| `StatStrip`                                                   | a row of numbers in one card (value + unit + label per cell, toned values)                                                                                                                                                                                                                                           |
| `StoryBubble` (+ `StoryRow`, `StoryDivider`)                  | stories bubble: face/initial in a state ring (default · new · live · alert · atlas), count or "!" badge, name, "+N more"; scrolling row + hairline                                                                                                                                                                   |
| `BrandBar` (+ `BellButton`)                                   | THE app header in every sub-app: wordmark, app label, actions slot, language chip                                                                                                                                                                                                                                    |
| `TabBar`                                                      | THE bottom bar (generic items; optional centre `fab` with attention pulse; `tabs` + `activeFill` for sub-apps)                                                                                                                                                                                                       |
| `BackButton`                                                  | every back control (round well; `text` pill; `overlay`)                                                                                                                                                                                                                                                              |
| `LockerWall`                                                  | the people a device remembers, as a row of lockers (avatar, number, first name; one tap = "this is me"; the picked locker keeps the same body with an accent outline); `busyId` shows a ring around the avatar of the person being signed in and disables the rest; landing sign-in only, never in-app (SPO-209/213) |
| `PageHead`                                                    | THE page header row: back, title (+ sub), actions slot on one axis; edges = page edges, `--s-36` row (SPO-96, `docs/hero-audit-table.md`)                                                                                                                                                                            |
| `Field` / `TimeField` / `Select` / `Textarea` / `SearchField` | every text, time, select, multi-line and search input (label, hint, error, lead / trail; `bare` for in-row values)                                                                                                                                                                                                   |
| `Widget` + `uiw-t-*`                                          | Today widgets; typography only through the `uiw-t-*` scale, never inline styles                                                                                                                                                                                                                                      |

### Later additions (SPO-137: purpose, props, when not to use)

| Primitive           | For · key props                                                                                                                                         | Do not use for                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AnatomyTurntable`  | body on a canvas turntable: `base`, `organs`, `marks`, `activeOrgans`, `camera` (yaw/y/zoom), `rotatable`, `label`/`hint`/`caption`                     | a flat muscle map or a static picture (use the atlas SVG widgets)                                                                                                        |
| `Avatar`            | round photo or initials disc: `src`, `name`, `size`                                                                                                     | a person with an uploaded/E2EE photo and cache — wrap it (`components/Avatar` → `UserAvatar`), do not re-draw the disc                                                   |
| `Badge`             | unread-count pill: `n`, `max` (default 9 → `9+`), `tone`, `size` sm/md, `anchor` corner/inline/none, `label`                                            | a status word or a tag (`Chip`); a count is the only content                                                                                                             |
| `Checkbox`          | 22px checkbox over a real input: `checked`, `onChange(checked)`, `tone`                                                                                 | an on/off setting row (`Switch` in `ListRow`)                                                                                                                            |
| `ConsentControls`   | coach consent: read-only `ConsentSummary` rows and the Off / Effects only / Full editor; words come from the caller                                     | anything that decides access — that is upstream (`useCoachWorld`), the piece only draws                                                                                  |
| `DayTimeline`       | one day of a vertical timeline: `tone`, `icon`, `date`, `aside`, `isToday`, `isLast`, children = the day's cards                                        | a period rail with lanes and gaps (`Timeline`)                                                                                                                           |
| `DragHandle`        | ⋮⋮ reorder grip: `label`, `pinned`, `dragging`, `onDragStart/End`, `onMove(±1)` (keyboard)                                                              | touch-only lists — pair with an explicit move control                                                                                                                    |
| `ExerciseThumb`     | catalog picture of an exercise with the neutral icon tile as fallback: `src`, `size`                                                                    | a user photo (`Avatar`); it is decorative, the name always sits next to it                                                                                               |
| `FailedState`       | "couldn't load" row: `title`, `body`, `icon`, `retryLabel` + `onRetry`                                                                                  | an empty list (empty state) or the offline status (`SyncStatus`, offline `Banner`)                                                                                       |
| `FindingRow`        | one result of a check (`<li>`): `icon`, `tone`, `title`, `body`, `status` (always a word), `action`                                                     | a plain list row (`ListRow`)                                                                                                                                             |
| `Gallery`           | dev-only token and primitive gallery at `#/uikit` (not shipped to production)                                                                           | a place to document a primitive — Storybook is the catalog                                                                                                               |
| `InvitePanel`       | THE coach invite form (side panel, phone inline, empty roster): `labels`, `defaultRequest`, `onCreate`, `initialMode`, `hero`, `onSendInChat`           | other forms; strings in, no dictionary or domain imports                                                                                                                 |
| `MessageMenu`       | actions of a chat message/header: popover from the coach breakpoint up, bottom sheet below: `open`, `onClose`, `anchorRef`, `items`, `rule`, `preview`  | non-chat menus                                                                                                                                                           |
| `NoteCard`          | one coach note: `vis` private/shared, `visLabel`, `time`, `text`, `context`, `editing`, `actions`, `highlighted`, `lines`                               | free text without visibility semantics (`Card`)                                                                                                                          |
| `NowLine`           | current-time marker: `NowLine`, `NowStatus`, `NowDivider`, hooks `useMinuteClock`, `useScrollToNow`; the caller passes the clock                        | a countdown (`Ring`) — components never read `Date` themselves                                                                                                           |
| `OptionCard`        | one choice of a one-of-N card picker (+ `OptionCardGrid`): `title`, `sub`, `preview` or `icon`, `selected`, `onSelect`, `tone`                          | a long list or a compact toggle (`Segmented`, `Radio`)                                                                                                                   |
| `Pager`             | quiet ‹ 2 / 6 › for paged lists: `page`, `maxPage`, `onPage` (one page renders nothing)                                                                 | week-based lists (`WeekStepper`)                                                                                                                                         |
| `ProgressBar`       | thin bar: `value` 0–100 or stacked `segments`, `tone`, `height`, `label`                                                                                | a value against a target range (`RangeBar`); segments are decorative, say the numbers in text                                                                            |
| `Radio`             | 22px radio over a real input: `checked`, `onChange`, `tone`; group by `name`                                                                            | one-of-N with previews (`OptionCard`) or 2–4 short options (`Segmented`)                                                                                                 |
| `RangeBar`          | value against a target band: `value`, `max`, `band`, `tone`, `label` (spoken in full)                                                                   | plain progress (`ProgressBar`); state is always also said in text                                                                                                        |
| `RescheduleMessage` | coach chat message for a reschedule request with its state, times, note and actions                                                                     | other chat messages                                                                                                                                                      |
| `Ring`              | progress ring: `value` 0–100, `size`, `width`, `tone`, children in the middle                                                                           | feature rings with a different geometry/gradient (`ApexRing`, `ChallengeRing`, `MasteryRing` are local on purpose — their look differs; unify only by a design decision) |
| `RosterRows`        | coach roster pieces: `ClientRow` (avatar, program, week, status, signals, log mode, unread) and its status/log-mode marks                               | non-client lists                                                                                                                                                         |
| `SecurityCode`      | 24-digit trainer key code: `code`, `verified`, `labels`, `onVerify/onUnverify`, `writeText`                                                             | other secrets — never render key material here                                                                                                                           |
| `SetRow`            | one logged set (index · reps · load · tags): `warm`, `record`, `timed`, `compact`, `metered`                                                            | a generic table row (`ListRow`)                                                                                                                                          |
| `ShareCard`         | chat card of a shared program/workout: `state` (ok · limited · locked · removed), type, `title`, `chips`, `media`, `trend`, `rows`, `facts`             | anything not shared through chat                                                                                                                                         |
| `ShortcutTile`      | XS one-tap action on Today: `label`, `icon`, `tone`, `state`, `primary`, `meta`                                                                         | navigation (`TabBar`) or a list row                                                                                                                                      |
| `SyncStatus`        | non-modal sync chip with optional Retry: `state` (synced · syncing · offline · slow · failed), `floating`; offline is normal, only `failed` is an error | blocking scrims or spinners — it never traps focus                                                                                                                       |
| `WeekBars`          | seven tiny bars for how a week was filled: `days` (`tone`, `level` 1–3)                                                                                 | a chart with values                                                                                                                                                      |
| `WeekPickerSheet`   | drawer to pick any week, paged with `Pager`: `weeks` (newest first), `selected`, `onPick`, `onClose`, `pageSize`                                        | picking a date (`Calendar`)                                                                                                                                              |
| `WeekStepper`       | ‹ range · caption ▾ › week-at-a-time pager: `label`, `sub`, `onPrev/onNext`, `canPrev/canNext`, `onOpen`                                                | long paged lists (`Pager`)                                                                                                                                               |
| `WidgetGrid`        | Today Bento grid (4 cols phone / 8 desktop) by `layout` + `WidgetSection` (title, aside)                                                                | other page layouts                                                                                                                                                       |
| `Hint`              | quiet informational line (`<p>` faint, or `field` = editor hint `<div>`): `variant`, children                                                           | errors (`FailedState`) or dismissible messages (`Banner`)                                                                                                                |
| `OverviewHead`      | `PageHead` with the back-to-Overview control for drill-ins without own actions (Goals, Playbook, Exercises): `title`                                    | pages with actions (`PageHead` directly)                                                                                                                                 |

Variants of each live in its Storybook stories (`Kit/<Name>`); props above are the contract, the `.tsx` is the source of truth.

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
дублікатів (повторюється — піднімаємо в кіт). Деталі: `.claude/rules/ui.md`.

## Sheet `tone` (кольорове кодування шторок)

`<Sheet tone="ok|rest|active|illness|danger">` фарбує всю шторку (фон, край, грабер, заголовок `.ss-title` / `.day-sheet-head .t`) через `--t-*` сім'ї; стилі — `glass.css` (`.sheet--toned`). Використання: Start (зелена, коли вже тренувався сьогодні), DayHistorySheet (done=ok, missed=danger, rest=rest, vacation=active, illness=illness).

## The `warmup` tone (warm-up blue)

`Tone` `warmup` — the blue of warm-up sets (`--color-warmup` / `-tint` / `-text` / `-line`; `--set-warmup` is an alias). Colour-codes the warm-up exercise Edit drawer: `<Sheet tone="warmup">` tints plate, edge, grabber and title, and its filled Save button takes the same blue. Use it only for warm-up things, so the colour keeps its meaning (the `rest` blue stays for full rest). It shows up in every tone story (`TONES`).

## The `chronic` tone (long-term health conditions)

A semantic family for long-term health conditions, separate from injury/illness colours. Tokens (defined in `styles.css` :root, themed in `glass.css`): `--color-chronic`, `--color-chronic-tint`, `--color-chronic-text`, `--color-chronic-line`, `--color-chronic-deep`.

Where it is used, always through the kit and never with feature CSS:

- `ListRow` — the `IconTile` takes `tone="chronic"`.
- `Notice` — `tone="chronic"` for shields and hints about condition limits.
- `Notice aligned` — standing among ListRows (empty states): icon in the 30px `IconTile` column, text at the row-title x.
- `Button` — a filled button inherits the tone of its context (chip/row/notice) instead of a per-button colour.
- `AnatomyMap` — condition marks on the body map (Bones / Muscles / Organs / Other layers).

Use the tone only for things that come from the person's conditions, so the colour keeps its meaning.

## Legal and consent pieces (SPO-295 / N1)

Presentational only: no storage, no routing, no i18n provider. Every visible word and link target comes through props (the app wrapper passes i18n keys). Stories `Kit/<Name>`. Rules: red actions always go through prompts; consent is never pre-ticked; dismissing a prompt is never consent.

| Piece                                  | For                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Not for                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ConsentPrompt`                        | the all-or-nothing consent `Sheet` (`role="alertdialog"`): icon + `title` (also its name), `lead`, `facts` (what / who / conditions), `before` slot (document links, read-and-accept), `primary` / `secondary` (+ `primaryDisabled`), `foot`; `onClose` defaults to `onSecondary`                                                                                                                                                                                                                                                                                                                                            | coach sharing levels (`ConsentChips`)                                                                   |
| `ConsentRow`                           | one consent in a list: `label` (the switch name), `sub`, `status` line worded by the caller ("Given · 1.2" / "Not given"), `Switch` `on` / `disabled` / `onChange(on)`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | a plain setting (`ListRow` + `Switch`)                                                                  |
| `LegalLinks`                           | quiet "Privacy Policy · Terms of Use" row; `label`, `privacyLabel`, `termsLabel`, `privacyHref` / `termsHref` (default hash routes `#/privacy` `#/terms` until clean paths), `align`                                                                                                                                                                                                                                                                                                                                                                                                                                         | in-text links                                                                                           |
| `AiTag`                                | the "AI" mark on a reply written by a provider model (EU AI Act Art. 50); word via `label`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | other statuses (`Tag`)                                                                                  |
| `DocReadList` + `AcceptCheck`          | documents to open before agreeing: rows "Not opened yet" / "Read" with a chevron, `lockedHint` until all are read; `AcceptCheck` is the box + sentence (disabled until read). State: `useDocReadGate(ids, versions?)` (with `versions` the opened marks are kept per document+version in this tab's sessionStorage, so a same-tab remount keeps them; `clearDocRead` on accept); rule: `canAccept(allOpened, boxes)`                                                                                                                                                                                                                                                                                                                                                                              | showing a document (the reader is `LegalDoc`)                                                           |
| `LegalDoc` (+ `DocTable`)              | the reader of a public legal document (`/privacy`, `/terms`): brand header with `headerEnd` (the page passes the real `LanguageSelector`), `versionLabel` / `updatedLabel` (worded by the caller from the version table, never typed), contents with `#id` anchors (click scrolls, so the hash router is not touched), numbered `sections` (`{id, title, body}`), "Save as PDF" and "Print" that both call `onPrint` (= the print dialog; `saveHint` says so), optional `note`, `footer` slot (`LegalLinks`). `@media print` drops the chrome and releases the pinned shell. Own scroll container; texts and links via props | the Privacy Policy and Terms of Use pages; not for in-app long text that needs no print (use a `Sheet`) |
| `StepConfirmDialog` + `useStepConfirm` | red action in 1..3 prompts on `ConfirmEffectsDialog` (Cancel and the action in one actions row, short `confirmLabel`s, optional `effects`, `progressLabel`); only the last step may set `typeWord`, and its button stays disabled until the typed text matches (trimmed, case-insensitive). Pure machine: `stepConfirmReducer`                                                                                                                                                                                                                                                                                               | a one-line confirm (`ConfirmDialog`)                                                                    |

`ConfirmEffectsDialog` gained `confirmDisabled` (the confirm stays disabled while true).

`Sheet` gained `dismissible` (default `true`). `dismissible={false}` makes a blocking sheet: no corner close button, the scrim click, Escape and the grabber swipe do nothing, so it closes only through the buttons inside it (`onClose` is then never called by the sheet). Use it only for a prompt the person must answer, with `role="alertdialog"` and a `label`; today that is the legal gate for existing users (`legal/LegalGate.tsx`). A blocking sheet is also modal for the keyboard and assistive tech (`overlays/sheetTrap.ts`): Tab / Shift+Tab cycle inside it, and what was in the page when it opened is `inert` until it unmounts (layers opened later, such as a confirm dialog from the sheet, stay usable). Story `Kit/Overlays` "Sheet · not dismissible"; test `Overlays.dismissible.test.tsx`.

## Coach in the kit (iteration 7)

### The kit reset rule

Coach is a sibling app of Gym, not a second design. Every Coach surface is drawn by the existing kit (`components/ui`) and the Brass Glass recipes in `glass.css`. Only the accent ramp differs per app (Coach is tourmaline, tinted by `--t-base`). So:

- Grep `components/ui` before writing any element. Feature CSS under `coach/**` is layout only (flex / grid / gap / size / alignment / overflow). No colours, surfaces, radii or fonts on kit elements, no raw hex, no raw `px` outside tokens (`--s-*`, `--fs-*`, `--r-*`; 360 px style widths are layout variables in `coach/layout/frame.css`), no raw `<button>` / `<input>` (kit-guard enforces the first and the colours).
- Inner padding comes from tokens: at least `--s-12` horizontal for pills and segments, `--s-16` for cards and rows.
- A new primitive is allowed only when nothing fits. It lives in `components/ui` with a story under `Coach/<Name>` (full pages: `Pages/Coach/<Name>`), is app-agnostic, and any new glass surface class gets its rule in `glass.css`.
- All new user data is sealed (`sealOrThrow` / `NEW_COLLECTIONS`; chat uses Part C envelopes with AAD and a sender signature). Nothing readable in logs or browser storage.
- Strings live in per-feature dictionaries `i18n/coach<Feature>.{en,uk,pl,lt,et}.ts`. `src/i18n/coachParity.test.ts` (run alone: `npm run i18n:coach`) finds every `coach*` dictionary by glob and checks keys, kinds, function arity, placeholders and sample output in all five locales.

### Coach/ pieces that live in the kit

| Piece                               | For                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ChatBubble`, `ChatComposer`        | message bubbles (day dividers, status, retry) and the composer (grows, send, lead / chips slots); reused by the client chat        |
| `ConfirmEffectsDialog`, `UndoToast` | destructive confirms that list their effects; the Undo toast                                                                       |
| `ExportMenu`                        | CSV / print menu; `extra` slot for an extra option (for example the per-set switch)                                                |
| `ResponsivePanel`                   | a Popover on desktop and a Sheet on phone with one content                                                                         |
| `DecisionRecord`                    | the decision card (what, why, who, result)                                                                                         |
| `StageBoard`                        | columns of cards by stage; `foldLabel` + `defaultFolded` fold a column to a narrow track (desktop), phone stacks                   |
| `LiveWidget`                        | the rail foot pill: counts by state, popover list; each entry has `onOpen` and `ariaLabel`, so a row opens that person's live view |
| `SidePanel` (coach layout)          | a drawer from 768 px, a sheet below                                                                                                |

Story groups: pieces in the Storybook tree `Coach/<Name>`; screens `Pages/Coach/<Name>` (Today, Clients, Client 360, Decisions, Chat, Live, Programs, Schedule). The Chat stories also carry the desktop dock (`DockClosed`, `DockList`, `DockThread`).

### Coach group inventory and where the code lives (iteration 14)

Storybook titles (one per kit piece, `Coach/<Name>`): AccountPanel, AccountPopover, Action menu, Chat bubbles, Chat composer, ChoiceList,
Confirm dialog, Consent, DataTable, Decision record, DecisionCard, ErrorBoundary, EvidenceChart, Exercise row, Exercise thumb, Export menu,
Finding row, Invite, Layout, LiveWidget, Message menu, MoreMenu, Note card, Now line, Rail Active, Rail overflow, Range bar, RequestCard,
Reschedule card, Responsive panel, RhythmChart, Roster rows, Scroll tabs, Security code, Session exercise, SeverityDot, Share card,
StageBoard, StepList, SuiteLauncherRow, Undo toast, Weekday toggle. Pages (`Pages/Coach/<Name>`): Chat, Chat share, Check before sending,
Client, Client 360, Decisions, Identity, Library peek, Live, Notes, Program editor, Program tab, Programs, Roster, Schedule, Share cards,
Shell, Signals, Today.

The program editor is a standalone tool, not Coach code: `client/src/tools/programEditor/` (guide `docs/PROGRAM-EDITOR-TOOL.md`, folder
README `client/src/tools/programEditor/README.md`, page differences `docs/PROGRAM-EDITOR-PAGE-DIFF.md`). Its inspector panes are one
module per pane family under `ui/panes/` (`PaneShared`, `RowPane`, `ExerciseAsClient`, `WarmupPane`, `SwapPairPanes`, `AddPane`,
`ActivityPanes`, `LibraryPanes`, `DayPanes`); `ui/Panes.tsx` keeps only `paneTitle` / `PaneBody` and re-exports the public names. Host
contract types: `host.ts`; the catalog types live in `host.catalog.ts` so `check/engine.ts` and `host.ts` do not import each other.

Status of the whole dashboard (real vs fixtures, how to run every check, known gaps): `docs/COACH-STATUS.md`.

### Accessibility rules the kit follows (iteration 8)

- A `role="listbox"` holds only `role="option"` rows. `GroupedList` takes `rowsRole` / `rowsId`, so the rows container itself is the listbox (hairlines keep working); a search field controls several listboxes with `aria-controls="id id"` (SharePicker). Filter chips that are radios must not carry `aria-pressed` (the picker passes `aria-pressed={undefined}`).
- Toggle state (`aria-pressed`) only on a real button: `ExerciseRow` drops it when there is no `onClick`. No `aria-readonly` on a `div` (`SessionExercise` uses `data-readonly`).
- No interactive element inside another one: a row that is a button never holds a chip button (the bare-row "Add sets and reps" chip sits beside the row, `.pg-xrow`).
- `columnheader` cells carry real text (`MonthGrid`, `Calendar`: visible short name `aria-hidden`, full name `sr-only`).
- Every dialog and sheet has a name: `Dialog` is `aria-labelledby` its title; pass `label` to `Sheet`. A menu holds only menu items (`Notice role="none"` inside `ActionMenu`).
- Heading levels: kit panels use `h2` (`ResponsivePanel`, `RequestCard`, `StageBoard`); `EmptyState` takes `titleAs` (default `h4` for Gym, Coach screens pass `h2`).
- `role="log"` goes on a `div` that contains the `ol` (chat thread, trainer and client).
- Chat frame room (gutters, composer padding, widths, gaps) belongs to `ChatShell.css` / `ChatComposer.css` only. A chat (Atlas, trainer, client, dock) sets colours and its own inner parts, never padding / margin / gap / width / inset on `.chs*` / `.uicomp*`. Guard: `chatFrame.guard.test.ts`; geometry: `npm run audit:chat` on the Atlas / client / trainer chat stories (320 / 390 / 768 / 1440).
- The Coach shell puts its skip link in its own `nav` landmark; the client trainer pages (`#/trainer…`, `#/invite…`) sit in a `main` (`display: contents`).
- `ScrollTabs` sets `aria-controls` only on the selected tab (its panel is the only one rendered).

### Shared suite navigation

One navigation pattern for every app of the suite (Gym, Coach, Apex, People, Nutrition, Learn):

- Phone: the app's own tabs (`SuiteTabBar`, Coach: `TabBar`). The app switcher is the chip in `BrandBar` (opens the launcher). The avatar opens the user drawer (`BrandAccount`: name, role, mode switch for trainer / admin, Profile, Sign out). A More tab exists only when it has something to show (Coach: its destinations; Gym: Mastery plus the header controls that had no room); one destination becomes a tab, a bar with a single tab is not shown.
- Desktop: `SuiteRail` (kit `Rail` + the ONE shared foot, `SuiteRailFoot`), used by `AppRail` (Gym, Apex, People, Nutrition, Learn) and by Coach. Foot, top to bottom: the app's own extras (Gym: conditions shield, Mastery), the bell (client apps only: Gym, Apex, Nutrition, Learn), more extras (Gym: admin settings), language, Apps, avatar. Apps and the avatar never collapse; everything above them collapses into More first (the language row opens a language list). People and Coach have no bell: the shared feed's unread shows on Apps (`appsUnread`) and on the Gym tile of the launcher.
- App tone for the shell comes from `SUITE_TONE` (`components/suite/suiteTone.ts`); do not hard-code a hue in an app.
- Help texts (Atlas) name the control "More" then "Apps", not an "Apps" button on the bar.

### Chat dock (desktop only)

`coach/chat/ChatDock.tsx`: from 1280 px, hidden on the Chat screen. A round button with the total unread (same number as the nav badge) and a 360 px glass panel (list, then one thread with the same ThreadView, composer and Share / Notes / reschedule extras). Session-only state (`dockStore`), the panel chunk loads on first open. The button sits at `--z-30`, below dialogs and sheets, so any open overlay covers it.

## Switch controls: Segmented / Tabs / Chip (iteration 21)

One family, styled only by tokens defined in `client/src/styles.css` (`--seg-*`, `--segb-*`, `--segs-*`, `--chip-*`, `--tab-*`). Brass Glass no longer overrides the family; to re-theme change the tokens (see `docs/THEME-SWAP.md`).

- Geometry: `--seg-r-outer = --seg-r-inner + --seg-pad` (concentric radii), no double border, heights `--seg-h-md` (= `--tap-min`) and `--seg-h-sm`; `--chip-h = --seg-h-sm`. Focus ring is a box-shadow ring.
- `Segmented`: `size`, `fill`, `stack`, `hug`, and `scroll` (horizontal overflow for many options). Counts go in the option label.
- `Chip` / `ChipGroup`: `count` prop (rendered inside the label, accessible name "Declined 4"); `ChipGroup` has `scroll` and `fill`. Use `ChipGroup` instead of local wrapper CSS (`.sc-chips`, `.shp-chips`, `.lpk-chips` were removed).
- `ScrollTabs` uses `--tab-*` tokens.
- `IconTile` radius is a step of the `--r-*` scale chosen by size (`--tile-r`).
- Selected segment colour: `color-mix(in srgb, var(--t-base) var(--seg-on-mix), var(--seg-on-base))`.
- Guard: `tests/kit-guard.test.ts` forbids raw px radii/font sizes/hex and token-step px literals (also inside calc/max/clamp/shorthands) in the switch-control CSS.
- Known non-migrated: legacy app classes in `styles.css` (`act-effort-seg`, `lens-seg`, `ch-filter-chips`, `eq-chip`, ...) outside coach; coach `Drawer` (`coach/layout/Layout.tsx`) is a coach-local dialog (candidate for kit `ResponsivePanel`); the program-editor `DayStrip` day-card tabs are deliberate.

## One control-height scale (iteration 22)

Every interactive control of the kit has ONE height, taken from one scale in `client/src/styles.css`. Rows that mix control types (a settings icon button, a text button, a Segmented, a Select, a SearchField) line up because they read the same token, not because someone matched pixels.

| Step | Token        | px  | Use                                                                                                                 |
| ---- | ------------ | --- | ------------------------------------------------------------------------------------------------------------------- |
| `xs` | `--ctl-h-xs` | 28  | dense inline controls: small chips, `PresetChips size="xs"`, icon buttons inside list rows (`IconButton size="xs"`) |
| `sm` | `--ctl-h-sm` | 36  | secondary tools, header wells (BackButton, bell), **default of Chip / PresetChips**                                 |
| `md` | `--ctl-h-md` | 44  | **default of everything else** (= `--tap-min`, the touch target)                                                    |
| `lg` | `--ctl-h-lg` | 52  | prominent actions, the sleep day picker (two-line cells)                                                            |

Per step there are also `--ctl-px-*` (side padding), `--ctl-gap-*` (icon to label), `--ctl-fs-*` (font), `--ctl-icon-*` (icon size); `--ctl-gap` is the gap between sibling controls in a row.

- **Same prop everywhere:** `size: 'sm' | 'md' | 'lg'` (plus `'xs'` on Button, Chip, PresetChips). Button (all variants, `IconButton` is square: width = height), Select / Field / TimeField, SearchField, Segmented, BackButton, ExportMenu, PresetChips, Chip. `ScrollTabs` is the `md` step (`--tab-h`).
- **Geometry is the kit's, never a feature's.** Height is an explicit `height: var(--ctl-h)` (+ `min-height` so a column flex never squeezes it, `box-sizing: border-box`, `line-height: 1`): line-height and padding never change it. A size class (`.uibtn--sm`, `.uiseg--lg`, `.uichip--xs`) only sets the `--ctl-*` variables for that control; the component CSS reads them.
- **Segmented:** the OUTER track is `--ctl-h`; the selected plate is `--ctl-h - 2 * --seg-pad`. The separate-button variant is `--ctl-h` per button.
- **A row picks one step.** `ControlRow` (`size`, `alignEnd`) and the scope class `.ctl-row--{xs|sm|md|lg}` (works on any container, no layout) force every control inside to that step, whatever size prop a member has. The coach `Toolbar` and `Header` actions are `md` rows, so a toolbar cannot mix heights. For a bespoke container add `ctl-row--md` to its class list (done for `.programs-top` / `.pg-home-head`).
- **Touch targets:** `md` (44) is the default; do not shrink controls on a phone, do not stack `xs`/`sm` icon buttons as the only target of an action on a phone.
- **Exempt (not row controls):** the Switch toggle track, NumberStepper tiles, calendar day cells, the tab bar / rail items, cards and list rows, `Button variant="link"` (a text run, `min-height: --ctl-h-xs`), the milestone dots on the session rail, textarea / `Textarea`.
- **`flush`:** `Button flush` removes the side padding for a value or name set into a dense row; the height still comes from the scale.
- **Guards:** `client/src/components/ui/controlScale.test.ts` (tokens resolve to px, steps ascend, every kit control reads `--ctl-h`, every size class and row scope exists; no browser) and `tests/kit-guard.test.ts` "control-height guard" (feature CSS may not set `height` / `min-height` / `max-height` / `line-height` / `padding` on a `.ui*` control; the short allow-list there names each exception and why). Storybook: `Kit/ControlHeights` (every control at sm / md / lg in one row), `Kit/ControlRow`.
- Migration done in iteration 22: `Chip size="sm"` (old 28) became `size="xs"`, the Chip default (old md 36) is now `sm`; Button heights were 36 / 46 / 60, now 36 / 44 / 52 (`xs` 28 added); Segmented md outer height was 52, now 44; Field was 50, now 44; SearchField 44, TimeField sm 38 became 36.
- **Iteration 24.** Coach has no overlay of its own: every coach panel is the kit `Sheet` (via `SidePanel`), coach differs only through theme tokens. New kit pieces only where nothing fitted: `useFitCount` (measured "+N" strips), `Select labelInline` (inline field name), `--ctl-lh` (line-height that never clips descenders in Segmented / Chip), `WeekdayToggle` static tiles, `InfoTable` row `className`. Read-only facts are always `InfoTable`.

## Iteration 25 notes

- **LiveWidget ("Training now" popover)** is a kit `Popover` (400 px) with a flat `GroupedList` per group (no card inside the card), `ListRow` per person (avatar, one-line name, one-line meta "place · since HH:MM", no chevron: the whole row is the hover/press target and only exists as a button when it navigates) and a `SeverityDot` with the elapsed time on the right (live = ok, offline = illness, finished = neutral). Group heads are `SectionLabel`s; the privacy footer is `--fs-12`, muted.
- **Agenda** is the new name of the trainer's Today (`#/c/agenda`; `#/c/today` still opens it). Icon `calendar-check` from the kit registry. The member app's Today is unchanged.
- **No sample data in runtime code.** `tests/kit-guard.test.ts` fails if a runtime file imports a `__fixtures__` module or a fixture file, or mentions the removed demo switches. See `docs/COACH-BACKEND.md` section 8.
