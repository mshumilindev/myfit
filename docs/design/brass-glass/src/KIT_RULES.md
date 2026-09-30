# Spotter brass-glass redesign — rules for screen authors

Folder: /tmp/claude-0/-home-claude/3dc3a19d-8146-52f2-8513-ed1bbd9c77ae/scratchpad/glass (cd here; run scripts with `python3`)

The owner's #1 requirement: **consistency**. The same thing must look the same on every screen, and the whole app
must have the rich brass-glass feel of the chosen Music design (deep glowing backgrounds, brass glass cards, floating pills).

## How to build

1. Read `kit.py` fully (components + CSS) and study the two exemplar scripts `p00_foundations.py` and `p01_today.py`
   (and their renders in `shots/P00-*.png`, `shots/P01-*.png`). Match their density, spacing and composition.
2. Write your own script(s) `pNN_<area>.py` starting with `from kit import *`. Every artboard is produced with
   `P(file, title, phone(...), row_=n, h=...)` for phones (390 wide) or `board(file, title, w, h, content)` for boards/desktop.
   File names: `PNN-Short-Name.dc.html` (NN = your page number, letters/digits/dashes only).
3. Run it, then render: `timeout 300 python3 shot.py 'PNN-*'` → PNGs in `shots/`. LOOK at them (Read the PNG; make
   montages with PIL if useful) and fix overlaps, clipping, empty areas, text overflow. Iterate until they look finished.

## FIDELITY — the owner's rule #0 (overrides everything below)

The redesign is a 1:1 visual translation of the EXISTING app. "Everything the same, only in the new design."

- Source of truth for WHAT is on a screen: the app code (views/_.tsx, components/_.tsx, en.ts / atlas.en.ts) and, for Today +
  widgets, the current Today Configurator / widget library canvas (scratchpad/artifact-files/ef716377-…/project/*.dc.html).
- Every screen, state, sheet, dialog, section, button, toggle, chip, field, tab and text that exists there must appear — same order,
  same grouping, same labels (copy the exact en.ts strings; interpolate mock values into their placeholders).
- NOTHING invented: no new screens, features, buttons, sections, settings, steps, metrics or copy that the source does not have.
  If the source has no copy for something, leave it out — do not write your own. If you cannot find it in the source, it does not exist.
- NOTHING removed or merged: if the source shows 7 rows, draw 7 rows; if it has a menu with 5 items, draw all 5.
- Only the visuals change: kit components, glass surfaces, moods, spacing. Map each source element to the closest kit component.
- Keep a mapping file `fidelity/PNN.md`: for every board → source file(s) + component names it reproduces, and a checklist of
  elements from the source that are on it. List anything the kit cannot draw as "approximated: …" (never silently drop it).
- Mock data values (names, numbers) may be the standard mock data below; structure and labels may not change.

## PRODUCTION-READY — rule #0c (owner: "I must see a production-ready design, not sketches")

- REAL IMAGES wherever the app shows a picture: `img(key, w, h, r)` with keys from ASSETS.txt (app public/ folder):
  exercise photos (`exercise_pic(name, w, h)` / `exercise_img(name)` → exercise-img/<id>/0.jpg, 1.jpg for start/end),
  equipment photos (equipment/_.jpg), Atlas portraits (atlas/atlas-N.webp, -full), physiques (physiques/_.png and _-lit.png for
  the selected one), warm-up/cool-down markers (markers/_.jpg), home hero (home-hero.webp), brand icons (icons/, brand/v2/).
  Never draw a hatched `photo()` placeholder where the app has a real image. `photo()` only for things fetched at runtime with no
  local file (e.g. provider gym photos) — and even then prefer what the app shows as fallback (HouseGraphic).
  If you need an image that is not in ASSETS.txt, list it in your reply (path from public/) — do not fake it.
- REAL ANATOMY: `bodymap(view, primary, secondary, paint, region)` / `bodypair(...)` are the app's own body-muscles figures
  (Muscle.tsx). Use them for every muscle map, heatmap (paint={group: 'under'|'productive'|'high'|'over'}), focus map
  (grow = brass, ease = danger), exercise detail, muscle picker, injury "where". Crop with region= like the app does.
- REAL DATA VISUALS: plates = `barbell()`; effort dial = `gauge(level, levels, tones)`; time ranges = `timerange(start, end, dur, a, b, focus=)` with TYPEABLE time fields (`timein()`) — every time/date value the user can change must be drawn as an editable field, not plain text; band colours / plate colours / ramps via `swatch(hex)` with the exact hex from the
  app's data/CSS; charts with real axes/labels as the app draws them; calendars as real month grids.
- COLOUR CODING IS DESIGNED — keep it exactly: tones now include the app families `illness` (amber), `injury` (coral),
  `active` (teal), `rest` (sky), `sleep` (violet), `sport` (lime), `kcal` (blue), `ok`, `danger`/`bad`, `apex`, `learn`, `atlas`,
  plus zone colours `under/productive/high/over` for bars/bodymap. Card tones exist for each (`card(tone='illness')` …).
  Use the SAME tone the app uses for the same meaning (grep the component for tone=/uit--/--color-*); never recolour.
- COMPLETENESS: before finishing, list every view/component/branch/state in your scope from the code and check each has a
  board (or is explicitly covered by another page). The owner found missing functionality — nothing may be missing.

## HIERARCHY — rule #0b (the owner rejected the first pass: "nothing for the eye to catch, everything looks the same")

Fidelity is about WHAT is on screen; hierarchy is about HOW MUCH each thing weighs. The app's design deliberately makes a few
things loud and squeezes the rest so it doesn't compete with the main content. Reproduce that weighting.

- Read the component's CSS before drawing it: /mnt/user-data/uploads/training/gym-tracker/client/src/styles.css (grep the class
  names used in the .tsx), redesign.css, today/today.css, learn/learn.css, views/_.css, views/programs/programs.css,
  components/_.css, components/ui/*.css, docs/DESIGN.md, docs/UI-KIT.md. Take sizes from it: heights (e.g. LiveHero 72 px, Today hero
  148 px), font sizes (a 40 px timer vs 12 px meta), which blocks get accent/glow, which are dim/small/collapsed/one-liners.
- Emphasis levels (kit):
  e1 `card(tone='hero')` — THE focal block of the screen (what the user came here to do). Exactly one per screen (sheets: at most one).
  Big numbers (`t-hero` 56 px, `t-num` 28 px, wells from `stepper`), one big primary button.
  e2 `card(tone='glass')` — at most one or two supporting blocks.
  e3 `card()` — ordinary content.
  e4 `card(tone='quiet')` / plain rows / a single `t-m` line / a `chips` strip — secondary info that the app keeps compact. Many things
  should NOT get a card at all: headers, stat strips, meta, "muscles worked", hints.
- Do not wrap every section in a card; do not give every item the same size; compress repeated info into one line or a strip;
  collapse what the app collapses (disclosure rows, "See all"). Contrast of scale is required on every screen.
- Vary composition: full-bleed heroes (`livehero` goes in `phone(top=...)`, full width, not inside a padded card), photos, big
  numerals, strips, grids, lists without chrome. Two different screens must not look like the same stack of equal cards.
- New kit pieces: `setentry()` (session "Enter this set", e1, supports drops=), `livehero(kind='session'|'compact'|'today')`,
  `stepper()` now = the app's well stepper (value gets full width), `barbell(per_side=(25,15))` + `plates_legend()` for plate maths,
  `.t-hero`, `.t-num`, `card(tone='hero'|'quiet')`.

## Shell, roles and night mode (from App.tsx — applies to every page)

- Tab bar (kit `tabbar`/`phone(tabs=...)`): Today · Overview · (+ Start) · Gyms · Apps. Active keys: 'today', 'overview', 'gyms', 'apps'.
  Sub-apps (Apex, People/Roster, Learn) have their own nav: pass `phone(tabs=(active, [(key, label, icon), ...]))` with the exact items
  from that app's code (e.g. ApexApp: Home · Challenges · Ranks · Awards; RosterApp: Clients (trainer) / People (admin) · Me).
  Desktop = `desktop(...)` (AppRail: Today · Overview · Gyms + Mastery, Alerts, Apps, profile) or the sub-app's `items=`.
- Header = `brandbar(app='Gym')` (spotter · app switcher · Mastery · Notifications · Language); sub-apps pass their own app name.
- ROLES: the app has member, trainer and admin (getRole()). Wherever the code renders something different per role
  (grep `role ===`, `isTrainer`, `isAdmin`, `rosterRole`, trainer/admin strings in en.ts), draw one board per role variant,
  titled "… · Member" / "… · Trainer" / "… · Admin". Never show a trainer/admin-only element on a member board.
- NIGHT MODE: while a night is live, the WHOLE app flips to the moonlit palette on the Spotter Sky, and a SleepHero band
  (`sleephero()`) sits above every screen except the sleep screen. Draw it with `phone(..., mood='sky')` / `desktop(..., mood='sky')` —
  the kit flips every token automatically. For your page, add a night variant (row 1) of each main screen someone can open at night.
  Sub-apps (Apex, People, Learn) at night: palette flips but NO sky and NO SleepHero (App.tsx returns early) → use mood='moon'.
- SUB-APP SKINS (styles.css): each sub-app swaps the accent gem — Gym brass (default), Apex amethyst `skin='apex'`,
  People/Roster silver `skin='roster'`, Learn rubellite `skin='learn'`, Nutrition lazurite `skin='nutrition'`.
  Pass `skin=` to phone()/desktop() on every board of that sub-app (and on the sub-app's sheets/dialogs). The kit re-tints glass,
  buttons, chips, glows; same glass feel. Skin + night = `skin='apex', mood='moon'`.
- Health colours: illness = tone illness, active recovery = tone active, injury = tone injury, rest = tone rest (the app's own families).

## Hard rules (a lint will reject violations)

- Do NOT edit `kit.py`, `shot.py`, `assemble.py`, or other people's `pNN_*.py`.
- Build only from kit functions: `phone, header, brandbar, livepill, tabbar, card, lst, li, section, lbl, txt, span, btn, ibtn, chip, chips, seg,
toggle, check, radio, field, search, stepper, tag, dot, tile, avatar, atlas_face, art, photo, bar, ring, spark, bars, heat, week, stat, stat_card,
banner, empty, skel_rows, failed, setrow, exercise_card, rest_card, miniplayer, sheet, dialog, snack, desktop, widget, shortcut, spec, cap, row, col, grid, sp, ico`.
- You may write small helper functions in your script that COMPOSE kit functions.
- Inline `style=` only for LAYOUT: flex/grid props, gap, width, height, min/max sizes, padding, margin, position/top/left/right/bottom,
  text-align, align-self, flex, overflow, white-space. **No colours, no hex/rgba, no borders, no radius, no shadows, no font sizes/weights** —
  use tones (`brass ok bad rest sleep sport kcal neutral`), card tones (`glass ok bad rest sleep dash`), text classes
  (`t-d1 t-h1 t-h2 t-h3 t-b t-s t-m t-l t-big`, colours `c-mut c-dim c-brass c-ok c-bad c-rest c-sleep`).
- Screen mood (background glow) via `phone(..., mood=...)`: `art` (default for most screens: purple + brass glow), `rest` (rest/recovery),
  `sleep` (sleep), `ok` (PR / success moments), `bad` (injury/illness/failure), `night` (lock screens). Use `art` unless the screen is about one of the others.
- One `card(tone='glass')` = the focus of a screen area (current item, primary block). Everything else is plain `card`. Primary action = `btn(kind='pri')`.
- Copy in English, real labels from the app (grep `/mnt/user-data/uploads/training/gym-tracker/client/src/i18n/en.ts`), plain and factual,
  numbers over adjectives, no exclamation marks. Mock data: user Mykola; gym Iron Temple; program Upper/Lower 4×; workout Chest 2;
  Bench 100 kg × 5 (PR), Squat 140 × 5, Deadlift 180 × 3; weight 82.4 kg; sleep 7 h 12 min; readiness 82 %; streak 6 weeks; coach Atlas;
  clients Anna, Oleh, Iryna, Marek; date 28 Sep 2026.
- Screens that scroll: use a taller capture (`h=1200`–`1800`, same value in `phone(h=)` and `P(h=)`).
- Every list area gets its states somewhere on your page: filled, empty (`empty`), loading (`skel_rows`), failed/offline (`failed`, offline `banner`).
- Sheets/drawers: `phone(<screen behind>, overlay=sheet(title, ...))`; dialogs: `overlay=dialog(...)`; undo: `overlay=snack(...)`.
- Rows (`row_`) group artboards on the canvas: 0 = main flow, 1 = states, 2 = sheets & drawers, 3 = dialogs/edge cases/desktop.

## App sources (read what you need)

Code (almost the whole client is staged): /mnt/user-data/uploads/training/gym-tracker/client/src/ — App.tsx, LearnApp.tsx, learn/, views/_.tsx and views/{health,programs,logActivity,sessionSummary}/, components/_.tsx, components/ui/* (the app's own primitives: Banner, Card, Chip, Calendar, MonthGrid, GroupedList, Timeline, Widget…), today/ (Today + widgets, real implementation), data/, store.ts, types.ts, domain modules (sleep.ts, injury.ts, goals.ts, recaps.ts, mastery.ts, challenges.ts, notifications.ts…), i18n/en.ts, i18n/atlas.en.ts, atlas/{welcome,chips,notes,style,safety}.ts
Specs: /mnt/user-data/uploads/training/gym-tracker/docs/design/INVENTORY-mobile.md, INVENTORY-web-proto.md, docs/specs/_.md, docs/FEATURES-AC.md
Old designs (content reference only, NOT style; code wins when they disagree): /mnt/user-data/uploads/training/gym-tracker/_.dc.html, docs/design/boards/My Fit - All States.dc.html
Current widget library (content reference): /tmp/claude-0/-home-claude/3dc3a19d-8146-52f2-8513-ed1bbd9c77ae/scratchpad/artifact-files/ef716377-d180-45a4-9be0-116feb2087f6/project/_.dc.html
Music feature (already designed, reuse its patterns): /tmp/claude-0/-home-claude/3dc3a19d-8146-52f2-8513-ed1bbd9c77ae/scratchpad/music-canvas/project/_.dc.html

## Finish

When done, reply with: list of your scripts, number of artboards per page, and anything you could not draw.
Do not publish anything and do not touch the user's repository.
