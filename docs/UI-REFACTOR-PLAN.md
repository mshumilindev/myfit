# Spotter — UI refactor plan (a shared UI kit, so new features look right by construction)

Goal: stop re‑litigating "this element looks wrong in the new feature." We do that by
giving the app a small, canonical set of UI primitives (a UI kit) built on the tokens we
already have, a gallery to eyeball them, and a strict working loop so nothing breaks.

Status quo is good: everything works and looks almost perfect. This plan is **additive and
incremental** — we never do a big‑bang rewrite. Every change is a tiny slice, verified live.

---

## 0. The diagnosis (from an audit of the current code)

What's already strong — **keep it, build on it**:

- **Design tokens are near‑complete.** `client/src/styles.css :root` has full colour ramps
  (`--color-accent-100…950`, `--color-neutral-100…900`), semantic families with
  `tint / text / line` variants (`--color-ok-*`, `--color-danger-*`, `--color-kcal-*`,
  `--color-rest-*`), `--color-bg / -elevated / surface / surface-2 / divider / text`,
  radii (`--radius-sm/md/lg/sheet`), glass tokens, `--font`. This is a real design system.
- **Some primitives already exist** in `client/src/ui.tsx`: `Icon`, `Sheet`, `Dialog`,
  `ConfirmDialog`, `EmptyState`, `Switch`, `Toast`/`Snackbar`, skeletons, `ExerciseName`,
  `useIsDesktop`, `useExerciseName`.

What causes the "looks wrong" problem — **this is what we fix**:

1. **No shared component layer for the recurring building blocks.** Buttons, cards, chips,
   pills, banners, list rows, section labels, fields, segmented controls, steppers, progress
   dots and stat tiles are **re‑implemented per feature** with feature‑scoped classes
   (`styles.css` is 34k lines; class prefixes: `program` 247, `mst` 175, `session` 130,
   `sleep` 110, `rx` 102, `sbw` 76, `focus` 73, …). Each reinvention drifts a little.
2. **More than one button system.** Global `.btn .btn-primary/.btn-secondary/.btn-sm/…`
   _and_ a second `.rx .btn.p/.s/.b/.hot` ported from a design file. New code picks whichever
   → inconsistency.
3. **Heavy inline styles in views** (RecapView 146, InjuryView 111, TodayView 43, …). Inline
   one‑offs can't be reused or kept consistent, and they bypass the tokens.
4. **No gallery / kitchen‑sink screen.** There's nowhere to see every primitive in every
   state (light/dark, mobile/desktop), so we can only catch drift by opening the real feature.

Net: consistency currently depends on a human manually matching a new screen to the tokens
and to other screens. The fix is to make consistency **structural** — assemble features from
a fixed kit instead of raw classes/inline styles.

---

## 1. The working loop (non‑negotiable, applies to EVERY slice)

Small piece → verify live → fix → re‑verify → never break. Concretely, per slice:

1. **Pick one tiny piece** (one primitive, or one screen's migration). Nothing bigger.
2. **Look at it live first.** Run the dev server (`npm run dev` in `client/`), open the
   affected screen(s) in the browser, screenshot how it works and looks _before_ touching it.
3. **Make the change.**
4. **Gates (all must pass):** `tsc -p tsconfig.json --noEmit` = 0, `eslint` = 0, `vitest run`
   green, and a clean production build.
5. **Re‑verify live.** Screenshot the same screen(s) + the UI gallery; compare before/after —
   pixels should match (a refactor slice changes _code_, not _appearance_).
6. **Only then** delete the now‑dead CSS/classes for that piece. Never delete ahead of migration.

Guardrails baked into the loop:

- A slice is **behaviour‑preserving by default.** If a slice would change how something looks,
  that's a separate, explicitly‑flagged design change — not a refactor.
- Keep old and new in parallel until a screen is fully migrated; migrate call sites one screen
  at a time so a regression is always isolated to one screen.
- Verification uses **real browser screenshots, not eyeballing by hand.** Claude drives the
  browser (Claude‑in‑Chrome / computer‑use) against the dev server and captures the affected
  screen(s) **and** the `#/uikit` gallery **before and after** each slice, then compares them —
  so every slice gets an actual visual before/after diff. The gallery (Phase 0) makes this fast
  (one screen shows every primitive/state). (Playwright's own browser binary can't be installed
  on the device — network‑blocked — but it isn't needed: the browser tools already give us the
  screenshots.)

---

## 2. Target architecture

Three layers, one direction of dependency (features → kit → tokens):

```
tokens         client/src/styles.css :root         (single source of colour/space/radii)
   ▲
ui kit         client/src/components/ui/*           (Button, Card, Chip, … typed + variants)
   ▲                                                 each primitive owns its CSS
features       client/src/views/*, components/*     (compose primitives; no raw .btn, no inline)
```

Rules:

- **Features never write raw visual classes or inline styles** for anything the kit covers.
  They import `<Button variant="primary">`, `<Card tone="danger">`, etc.
- **Every primitive maps its variants to tokens only** — never a raw hex. One place to change a
  colour/radius app‑wide.
- **Every primitive is in the gallery** in all its variants and states.
- Feature‑specific composition still lives in the feature (e.g. the rehab stage ladder), but it
  is _built out of_ kit primitives (Card, ListRow, Chip, ProgressDots), not bespoke CSS.

---

## 3. Phase 0 — the verification harness (do this first)

Nothing else is safely verifiable without it.

- **0.1 UI gallery route.** Add a dev‑only screen at `#/uikit` (guarded so it never ships in a
  user build, e.g. behind a flag / dev check). It renders every primitive × every variant ×
  key states (default / hover / active / disabled / loading), grouped by primitive, with a
  light/dark toggle and a mobile/desktop width toggle. As we extract each primitive we add it
  here. This is the "look at it live" surface the user asked for.
- **0.2 Token reference block** at the top of the gallery: swatches for every token
  (accent ramp, neutral ramp, ok/danger/kcal/rest tint/text/line, surface/bg/divider), so
  drift in a token is visible at a glance.
- **0.3 Conventions doc.** A short `docs/UI-KIT.md` (or a section in `AGENTS.md`) stating the
  three rules above + "how to build a new screen." Future sessions read this first.

Acceptance: `#/uikit` opens on the dev server, shows the token swatches, toggles light/dark and
width. (Primitives get added as Phase 2 lands.)

---

## 4. Phase 1 — token hygiene & design↔code parity

Small, high‑leverage, low‑risk.

- **1.1 Document the tokens** (in `docs/UI-KIT.md`): the semantic families and when to use
  each (`ok` = progress/success, `danger` = rehab/errors, `rest` = date‑bound rest/sleep,
  `kcal` = energy, `accent` = primary + caution, neutrals for text/dividers). No code change.
- **1.2 Design‑file token map.** Our designs arrive as `.dc.html` canvases with short token
  names (`--dgr`, `--g500`, `--n800`, `--rest`, …). Write the 1:1 map to app tokens
  (`--dgr → --color-danger`, `--g500 → --color-accent`, `--n800 → --color-neutral-800`,
  `--rest → --color-rest-400`, …) in `docs/UI-KIT.md`. This is the recipe that makes a design
  translate into the kit with zero guessing.
- **1.3 Kill the duplicate token block.** The rehab feature's `.rx { --dgr:…; --g500:…; }`
  re‑declares hexes that already exist as `--color-*`. Repoint `.rx` vars to the app tokens
  (`--dgr: var(--color-danger)`), so there is one palette. (Tiny slice; verify the rehab
  screens look identical before/after.)

Acceptance: `docs/UI-KIT.md` has the token catalogue + design→app map; `.rx` uses app tokens;
rehab screens pixel‑identical.

---

## 5. Phase 2 — extract canonical primitives (the backlog)

Each item is **one slice**: create the primitive in `client/src/components/ui/`, move the
relevant CSS out of the monolith into a co‑located block/file, add it to the gallery, ship.
**No call sites are migrated yet** (that's Phase 3) — extraction only, so the app is unchanged.

Ordered by payoff (buttons/cards/chips/banners are what drift most):

1. **Button / IconButton** — variants `primary | secondary | ghost | danger`, sizes `sm | md`,
   `fullWidth`, `loading`, `disabled`, leading/trailing icon. Absorbs `.btn*` **and** the
   `.rx .btn.p/.s/.b/.hot` system into one. (Highest payoff — two systems become one.)
2. **Card** — `tone: neutral | danger | ok | rest | accent`, padding scale, optional header.
   (Absorbs `.card`, `.card.r/.g/.bl`, and countless bespoke card divs.)
3. **Chip / Pill** — `tone`, `selected`, `size`, optional leading icon; a `ChipGroup` wrapper.
   (Absorbs `.chip`, `.pill`, `.mchip`, `.tr-pill`, muscle chips, etc.)
4. **Banner** — the Today‑style banner: `tone` (rest/danger/ok/accent), icon, kicker, title,
   body, dots, actions. (Absorbs `.prog-banner` variants incl. the rehab B1–B4 states.)
5. **ListRow** — icon/leading, title, subtitle/meta, trailing (value / chevron / toggle),
   `onClick`. (Absorbs `.slist .r`, program day rows, manage rows, settings rows.)
6. **SectionLabel** — the uppercase section header used everywhere.
7. **Field / Input / Stepper (numeric)** — labelled input + the +/− numeric stepper (promote
   the private `Stepper` in `SessionView.tsx` to the kit).
8. **Segmented** — the pill segmented control (rest duration, side toggle, units).
9. **WizardStepper** — the 1‑2‑3 step indicator (session builder + rehab setup share this).
10. **ProgressDots** — the N‑dot progress row (rehab stages).
11. **StatTile** — the number + label tiles (Today stats, recap).
12. **TrafficLightOption** — the green/amber/red choice row (rehab check‑in) — feature‑ish but
    recurring enough to standardise.

For each: typed props, variants → tokens only, all states in the gallery, unit‑test the pure
bits if any. Keep the old classes in place (untouched) until Phase 3 migrates their users.

---

## 6. Phase 3 — migrate features onto the kit (screen by screen)

Now replace raw classes/inline styles with primitives, **one screen per slice**, verifying live
each time. Suggested order (start where drift/inline‑styles are worst, and where the payoff of
consistency is highest):

1. `views/InjuryView.tsx` + rehab banners in `TodayView.tsx` (111 inline styles — my code; best
   first win, and it removes the `.rx` fork).
2. `views/SessionBuilderView.tsx` review/wizard (`sbw-*`).
3. `views/SessionView.tsx` (focus mode, set rows, rest strips — highest‑traffic screen; go
   extra carefully, tiny sub‑slices).
4. `views/TodayView.tsx` (rest sheet, banners, stat tiles).
5. `views/RecapView.tsx` (146 inline styles).
6. Then the rest (`ProgressView`, `ProgramsView`, `MasteryView`, `SleepView`, `GymsView`, …).

Per screen: screenshot before → migrate → gates → screenshot after → compare → delete that
screen's now‑dead CSS. A screen is "done" only when it uses zero raw kit‑covered classes and no
inline styles for kit‑covered things.

---

## 7. Phase 4 — guardrails (so it stays fixed)

- **7.1 ESLint rules:** ban raw hex colour literals in `views/` and `components/` (must use a
  token via a class or CSS var); discourage `style={{…}}` in views for properties the kit owns
  (allow layout‑only escapes, allow inside `components/ui/`). Start as warnings, ratchet to errors.
- **7.2 "New screen" checklist** in `AGENTS.md`: use kit primitives; colours via tokens only;
  add any genuinely new primitive to `components/ui/` + the gallery; run the working loop; drop
  a before/after screenshot in the PR.
- **7.3 The gallery is the acceptance surface.** Any new/changed primitive must show in `#/uikit`
  in all states before it's considered done.
- **7.4 Visual regression via browser screenshots.** Every slice, Claude captures the gallery
  (and the touched screens) through the browser tools and compares before/after — a real pixel
  check each time, driven by Claude‑in‑Chrome / computer‑use. Later this same gallery can be
  wired into CI when a CI browser is available, but the per‑slice screenshot check does not wait
  on that.

---

## 8. Per‑slice checklist (copy this into every change)

```
[ ] Scope is ONE primitive or ONE screen — nothing bigger
[ ] Screenshotted the affected screen(s) BEFORE (dev server, live)
[ ] Change made; colours via tokens only; no new inline styles / raw hex
[ ] tsc = 0
[ ] eslint = 0
[ ] vitest run = green
[ ] production build = clean
[ ] Screenshotted AFTER — pixels match before (refactor = no visual change)
[ ] Gallery updated (if a primitive) and checked in light + dark, mobile + desktop
[ ] Dead CSS for this piece removed (only after migration)
```

---

## 9. Primitive spec sheet (initial prop shapes)

```
Button        { variant: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md';
                fullWidth?; loading?; disabled?; icon?; iconTrailing?; onClick }
IconButton    { label; icon; tone?; size?; onClick }
Card          { tone?: 'neutral'|'danger'|'ok'|'rest'|'accent'; pad?: 'sm'|'md'|'lg'; header? }
Chip / Pill   { tone?; selected?; size?; icon?; onClick? }   + ChipGroup (wrap+gap)
Banner        { tone; icon; kicker?; title; body?; dots?; actions? }
ListRow       { icon?|leading?; title; subtitle?; meta?; trailing?; onClick? }
SectionLabel  { children }                                   // uppercase header
Field         { label; children }  Input { unit?; … }  NumberStepper { value; step; min; onChange }
Segmented     { options; value; onChange; tone? }
WizardStepper { steps: {label}[]; active }
ProgressDots  { total; current; tone? }
StatTile      { value; label; tone? }
TrafficLightOption { tone: 'ok'|'amber'|'danger'; title; sub; consequence; onClick }
```

Colours/radii come only from tokens; variants pick the semantic family
(`ok/danger/rest/kcal/accent/neutral` → its `tint/text/line`).

---

## 10. Risks & how we avoid them

- **Regressions from mass edits** → we never mass‑edit; one primitive or one screen per slice,
  live‑verified, old kept until migrated.
- **Perf (34k‑line CSS)** → extracting to co‑located blocks doesn't add weight; we only _move_
  rules, and delete dead ones after migration, so CSS shrinks over time.
- **Design drift creeping in during a refactor slice** → refactor slices are behaviour‑preserving;
  any intended visual change is a separate, flagged task.
- **Device build quirk** → `vite build` can't clear the existing `dist/` on the mounted folder
  (EPERM); build to a scratch dir for the "clean build" gate.

---

## 11. Suggested sequence & rough sizing

1. Phase 0 (gallery + conventions) — 1 slice to scaffold, then grows with Phase 2.
2. Phase 1 (tokens doc + design map + kill `.rx` fork) — 1–2 small slices.
3. Phase 2 (extract 12 primitives) — ~12 slices, Button/Card/Chip/Banner first.
4. Phase 3 (migrate screens) — ~1 slice per screen, rehab/builder first.
5. Phase 4 (guardrails) — fold in as Phase 3 lands.

Each slice ends green (tsc/eslint/tests/build) and live‑verified. We stop any time the app is
in a consistent state — the plan is safe to pause between slices.
