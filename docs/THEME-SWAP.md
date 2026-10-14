# Theme swap: re-theme the whole app in one pass

The app is meant to be restyled by overriding design tokens only. Source of truth: `client/src/styles.css` `:root`; Brass Glass lives in `glass.css` (`html.theme-glass`).

## What to override

- Radius scale `--r-*`, switch-control radii `--seg-r-inner`, `--seg-pad`.
- Spacing scale `--s-*`, gutters (`--page-x`, `--co-gut`), `--dock-clear`.
- Control heights: `--ctl-h-xs/sm/md/lg` (and `--ctl-px-*`, `--ctl-gap-*`, `--ctl-fs-*`, `--ctl-icon-*`). Changing `--ctl-h-*` rescales EVERY button, icon button, select, field, search, segmented, tab, chip and back button at once (iteration 22; `--seg-h-*`, `--chip-h*`, `--tab-h` are aliases of the same scale). `--tap-min` feeds `--ctl-h-md`.
- Colours: surfaces, `--color-btn-2`, `--color-rail`, `--color-ink-ring`, `--color-scrim`, accent ramps. Scoped accent ramps (`.app-coach`, `.theme-*`) must be overridden in a scoped rule too, because `:root` custom properties do not reach a scope that redefines them.
- Fonts: `--font-*`.

## Proof harness (cloud, Playwright)

Scripts in `/home/claude/review/_it21/` (not in the repo): `theme_core.py` (collect computed styles, apply token overrides, diff), `theme_app.py` (coach and client routes at 1440 and 390), `theme_sb.py N 4` (Storybook, 4 shards), `agg2.py` (aggregate; filters Storybook chrome), `swapshot.py` (before/after screenshots). In-repo: Storybook `Foundations/Theme swap` story applies a token map to `documentElement`.
Method: render, override only tokens, re-collect, list properties that stayed constant (radius, padding, gap, font-size, font-family, background).

## Result (iteration 21)

App screens (11 coach and 6 client routes): 0 radius offenders, 0 gap offenders. Remaining, all intentional or derived:

- padding: `tabbar-fab`; 76px bottom clearance on `today-page`/`pg-home`.
- font-size: avatar initials (derived from avatar size), `uiss-val` (cqi clamp).
- font-family: brand wordmark and brand app label.
- background: semantic ok/danger colours, `uistory-live`, `atl-face`, scrim, `uievc-last`.
  Storybook scan: see `/home/claude/review/iter21-report.md`.

## Guard

`tests/kit-guard.test.ts` blocks raw px radii, hex and font sizes in the switch-control family.

## Storybook scan (697 stories, 702 renders, sbC build)

- radius: 1 (`uisk` skeleton avatar, a deliberate circle). gap: 0.
- padding: 3 (story scaffolding `div.app-coach` in StageBoard, `hist-tl`, a story-only flex column).
- font-size: avatar initials, story face, StatStrip value (all derived from a size prop or a cqi clamp, so they scale with the component, not a token).
- font-family: `uisc-g` (monospace security code, intentional), brand wordmark/app label.
- background: 59 selectors, almost all accent or semantic ramps (tile, calendar number, progress fill, switch track, banners, story badges, scrim). These are derived from the accent/semantic colours via `color-mix`; a swap that changes only the neutral surfaces leaves them, and a swap that changes the accent/semantic ramps updates them. The scan overrode surfaces and one accent ramp, so these are "semantic colour not overridden" rather than hard-coded colour; a full colour pass must override the semantic ramps too.

## Control-height proof (iteration 22)

`/home/claude/review/_it22/measure.py` (cloud Playwright, fixtures build; not in the repo) measures every kit control on 11 coach and 34 client routes at 1440 and 390, plus the open states of the schedule forms; `sbmeasure.py` does the same for every Storybook story (4 shards). It reports (a) controls whose height is not a step of the scale, (b) raw (non-kit) buttons / inputs, (c) rows whose controls differ in height. With `SWAP=1` it injects `:root{--ctl-h-xs:34px;--ctl-h-sm:42px;--ctl-h-md:50px;--ctl-h-lg:58px}` and checks every control against the new steps: a token edit alone moves them all.
