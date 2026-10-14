# Claude Design prompt — Spotter "Home moves" (Vacuum + casual bodyweight sets)

_Paste everything below the line into Claude Design. Attach alongside it (so the renders match the real app, not a guess):_
_`gym-tracker/client/src/components/StartSheet.tsx`, `components/ActivitySheet.tsx`, `views/ActivityView.tsx`, `components/HistoryTimeline.tsx`, `components/TimelineRange.tsx`, `components/EffortGauge.tsx`, and the boards `Spotter - Time and Duration.dc.html`, `Spotter - Notifications & Challenges.dc.html`._

---

Design **"Home moves"** for **Spotter**, a personal gym-training tracker (mobile-first PWA, dark). Today Spotter logs **gym sessions** (sets × reps × kg) and **activities** (timed things: run, yoga, sauna…). What it can't log is the stuff people do **at home, outside a workout**: a **stomach vacuum** in the morning, **10 pull-ups** every time they walk past the doorway bar, **push-ups** before a shower, a **plank**, some **dips** on a chair. Short, bodyweight, often several times a day, often remembered only later.

Deliver **10 distinct directions**. **One horizontal row = one direction**, and each row walks the **whole flow, every state, left → right** (see §5). All renders must be built **from the real screens and components described in §2–§3** — reuse them, extend them, don't invent a new app around them.

## 1. What must be loggable

| Movement                                    | How it's measured                                                                                                        | Notes                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stomach vacuum**                          | **Timed hold**, sets × seconds (e.g. 3 × 20 s)                                                                           | Isometric, core. Real instructions in the app: stand, hands on hips, inhale, exhale fully, pull the navel toward the spine, **hold ~20 s breathing shallowly**, release; build up to **40–60 s**. Typically a **daily habit**, morning, empty stomach. |
| **Pull-ups / chin-ups**                     | Reps per set                                                                                                             | Doorway bar. Often "grease the groove": many small sets across the day.                                                                                                                                                                                |
| **Push-ups** (incl. incline / close / wide) | Reps per set                                                                                                             |                                                                                                                                                                                                                                                        |
| **Dips** (chair / bench)                    | Reps per set                                                                                                             |                                                                                                                                                                                                                                                        |
| **Bodyweight squats**                       | Reps per set                                                                                                             |                                                                                                                                                                                                                                                        |
| **Plank / side plank**                      | Timed hold                                                                                                               |                                                                                                                                                                                                                                                        |
| **"Something else"**                        | Pick from the app's bodyweight library (111 `body` exercises: Superman, Glute bridge, Hanging leg raise, Russian twist…) | Search, not a wall of tiles.                                                                                                                                                                                                                           |

Optional per set: added load (backpack +10 kg) or a band (the app already has band rungs for assisted pull-ups). Default is plain bodyweight — never force it.

## 2. Where this lives today — the real app (render from this)

**Tab bar:** 3 tabs — **Today · Overview · Gyms** — with a **notched gold "+"** in the middle that opens the **Start sheet**.

**Start sheet** (`Start`): a big context **hero** card (program day / "your usual Monday" / "Start a session · From scratch", or **"In progress → Resume"** when something is live), then a **2×2 tile grid**:

- **Auto session** — "A full day from your goal & recovery" (gold icon chip)
- **Activity** — "Run, ride, sport" (green icon chip, heartbeat icon)
- **Health** — "Sleep, recovery, injury, unwell" (blue icon chip)
- **Log past** — "A session you forgot" (neutral icon chip)

**Activity → "Log activity" sheet**: caption _"Cardio & recovery count too — so Spotter sees your whole load."_ Two groups of square tiles (icon + name, 3-up grid):

- **CONDITIONING** (gold icons): Run, Cycling, Swim, Rowing, Walk, HIIT, Dance, Cardio
- **RECOVERY** (rest-blue icons): Yoga, Mobility, Massage, Sauna, Cold plunge

**Activity page** (full screen, not a sheet): header = back caret · type icon + name · pill badge (**"Adds conditioning load"** gold, or **"Counts as recovery"** blue). A segmented control **Start now | Log a past one**.

- _Start now_: "The timer starts when you press Start." + outlined **▶ Start**.
- _Running_: giant tabular clock (`12:47`), **flame ~kcal** chip (blue `#3d84c9`) or "Add your weight to see calories", the semicircular **Effort gauge** (Light / Moderate / Hard, green→brass→red), distance field for distance types; bottom bar **Discard · Pause/Resume · ✓ Finish**; Finish and Discard confirm with a dialog.
- _Log a past one_ (**the current backfill pattern**): **Date** field (max = today) → **TimelineRange** (drag start/end handles on a 00:00→ day scale, 5-min snap) → Effort gauge → distance → `~kcal` + **✓ Save**.
- _Edit_ (opened from History): the same backfill form prefilled + **Delete** (danger-outline) with a confirm.

**Log past** (sessions): Date (defaults to yesterday) · Start time · Duration · Gym → opens the past session to add sets.

**History timeline** (Today + Overview): day buckets; an activity is a _minor_ row: `07:10 · [icon] Run · 32 min · 5.2 km · Conditioning  ›`.

**Session logger** (for gym sessions): exercise cards with **ghost rows** — the next set is pre-filled from last time and a tap on **Log** commits it. Set types include **static-dynamic** (weight + hold seconds).

**Also real and relevant:** **Challenges** already include _bodyweight rep grinds_ — "500 pull-ups", "1000 push-ups", dips, squats (currently counted only from gym sessions). **Atlas** — the in-app AI coach (a face bubble in the Today stories strip, notes panel). A **muscle map** (front/back, tints worked muscles) and a recovery/fatigue model. A weekly **energy** readout on Today: "kcal · last 7 days — X lifting · Y cardio · Z passive".

### Real constraints the designs must respect or explicitly solve

- **Only one live thing at a time** (a session, an activity or a sleep). While one runs, the Start hero says _In progress → Resume_. Decide what a home set does when a gym session is live (suggest "add to current session"?) and when a run is live.
- **TimelineRange has a 1-hour minimum** and is built for long activities — a 3-minute vacuum can't be backfilled with it as-is. Design the short-duration backfill.
- **Activity today has no sets/reps.** Say in each direction how the entry is stored: a new activity type with sets, a lightweight "home session" (a Workout with location = Home), or a new "quick set" record. Keep it honest in the caption.
- Offline-first: every write is queued; offline is a **state, not an error** (neutral "Queued" tag, never ruby).

## 3. Visual language (match exactly)

- Bg `#16171a` · Surface `#1f2125` · Text `#e9eaec` · Divider `rgba(233,234,236,.14)`. Font **Inter**; numbers tabular.
- **Brass/gold `#d9a24f`** = action, focus, live. **Buttons are outlined — the accent never floods a surface.**
- **Emerald `#4cbe8c`** = result (success, records). **Ruby `#e2564f`** = loss/failure only. **Rest-blue `#33a8e0` / `#93d4f2`** = recovery. **Calories `#3d84c9`** always with a flame.
- Radii 4 / 8 / 14 / sheet 20. Small-caps letter-spaced section labels (`CONDITIONING`). Phosphor-style line icons.
- Reversible → **5-second undo snackbar**, no dialog. Irreversible → a dialog that says what's lost.
- Loading: <300 ms nothing · 300 ms–2 s skeleton shaped like the real layout · >2 s spinner with a caption.
- Frames **390 × 844**, safe areas ~47 top / ~34 bottom; thumb-zone actions in the lower ⅔. English copy, but leave ~30% room — the app ships in en / uk / pl / lt / et; never bake numbers into words.

## 4. What the 10 directions should explore

Spread them across **placement** and **interaction model** — from "smallest change to what exists" to "new habit surface". A suggested set (keep, merge or replace, but keep 10 and keep them distinct):

1. **A third group in Log activity** — `AT HOME` next to Conditioning / Recovery (Vacuum, Pull-ups, Push-ups, Dips, Squats, Plank, + More). Tapping opens the existing Activity page, whose body becomes a **sets logger** instead of a clock. Smallest change.
2. **"Quick set" tile on the Start sheet** — the 2×2 grid grows to 5/6 tiles (or Activity splits). One compact sheet: movement chips → big reps stepper / hold timer → **Log**. Done in ~3 taps; each log is a tiny entry, and the day rolls them up into one "Home" card.
3. **Daily practice card on Today** — Vacuum (and any pinned move) as a habit: a 7-day dot strip, "today not done yet", tap → guided hold. Backfill = tap a past dot.
4. **Grease the groove counter** — a day tally per movement ("Pull-ups 42 / 100 today"), each tap adds a set of N; resets at midnight; history as daily totals. Backfill = set a past day's total.
5. **Guided hold timer (vacuum-first)** — full-screen coach: breathe-in → exhale → **hold ring counting 20 s** → release → rest → next set; the 2 real exercise images + the 5 instruction steps; auto-progression toward 60 s. Pull-ups/push-ups get a rep-tap variant of the same screen.
6. **Home as a gym** — "Home" becomes a location in the Gym picker; a home mini-session reuses the real **Session logger with ghost rows**. Backfill = existing Log past with gym = Home. Counts fully toward volume, muscle map, challenges.
7. **One "Bodyweight" activity type** — lives in Conditioning, has the normal timer, plus an optional "what did you do" breakdown (movement × sets). Minimal data change; weakest per-movement stats — show that tradeoff.
8. **Tell Atlas** — type or say _"3×12 push-ups and 2×30 s vacuum this morning"_; Atlas replies with a parsed confirmation card (editable chips) → Save. Backfill is natural language ("yesterday evening", "every day this week"). Show the parse-failed and ambiguous states.
9. **Log into a challenge** — enter from Challenges ("500 pull-ups · 30 days"): progress ring + **+ Log reps** right on the card; also reachable from Start. Casual reps now finally count toward the grind.
10. **Week grid** — a movements × days matrix (Mon–Sun); tap a cell to enter reps / seconds; today's column is the live one. Made for bulk backfill ("I did vacuum every morning this week").

## 5. Canvas layout — one row per direction, all states

10 rows, top to bottom = directions 1 → 10. Above each row: a caption block — **name · one-line thesis · where it lives · how it's stored (data model) · what it feeds (muscle map / recovery / challenges / calories / streaks) · the tradeoff.**

Each row, left → right, the same column order so rows compare vertically:

| #   | Column                        | Must show                                                                                                                                                                                                                       |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Entry point**               | Where you start it (Start sheet / Log activity / Today / Challenges / Atlas…) — in the real screen, with the new element highlighted.                                                                                           |
| B   | **First run / empty**         | Nothing logged yet: what it offers, how it explains itself, how it suggests Vacuum/Pull-ups.                                                                                                                                    |
| C   | **Pick movement**             | Pinned favourites + recent + search into the bodyweight library.                                                                                                                                                                |
| D   | **Ready**                     | Pre-filled from last time (ghost row: "last: 3 × 12"). How to do it: short steps / image, collapsible.                                                                                                                          |
| E   | **Doing it — reps**           | Pull-ups/push-ups: logging a set, stepper or tap-count, set list growing.                                                                                                                                                       |
| F   | **Doing it — hold**           | Vacuum/plank: the hold timer running, rest between sets, "+5 s vs last time".                                                                                                                                                   |
| G   | **Logged / summary**          | The saved entry: sets, total reps or hold time, ~kcal (or "Add your weight…"), what it counted toward (muscles, challenge progress), **undo snackbar**.                                                                         |
| H   | **Backfill — choose when**    | Date (max today) + time of day; a **short-duration** control (not the 1-hour TimelineRange), or a "morning / afternoon / evening" shortcut.                                                                                     |
| I   | **Backfill — what**           | Sets for a past day; multi-entry ("did it 4× that day"); multi-day ("every day this week") where the direction supports it.                                                                                                     |
| J   | **History & Today footprint** | How it appears in the History timeline (the minor-row style) and on Today; several quick sets on one day collapse into one row.                                                                                                 |
| K   | **Edit / delete**             | Opened from History: change sets, date; delete with confirm; undo.                                                                                                                                                              |
| L   | **Edge states**               | At least: **blocked** by a live gym session (and the "add to current session" offer), **offline / queued**, **no body weight** (no kcal). Direction-specific edges too (Atlas can't parse, streak broken, challenge completed). |

That's ~12 frames per row, 120 total. If it's too much for one pass, do it in **batches of 2–3 rows**, keeping the column grid identical.

## 6. Sample data (use it, no lorem)

- Athlete: 82 kg body weight. Pinned: **Stomach vacuum**, **Pull-ups**, **Push-ups**.
- Vacuum: last time **3 × 25 s**, best hold **40 s**, done **5 of the last 7 mornings** (missed Wed, Sat).
- Pull-ups today so far: **5 + 6 + 5** (16 reps), last week's typical day ~30.
- Push-ups yesterday evening: **3 × 15** — forgotten, needs backfill.
- Active challenge: **"500 pull-ups in 30 days" — 312 / 500, day 19**.
- A gym session "Pull day" is live in the blocked-state frame (started 18:04).
- Calories: ~3 s per rep at a vigorous resistance MET (7.5) → a set of 12 push-ups ≈ 5 kcal; a 25 s vacuum ≈ 1 kcal. Keep kcal small and quiet — it's not the point.

## 7. Guardrails

- Logging one set must take **≤ 3 taps** from wherever the direction starts. Sweaty-hand, one-thumb.
- Home moves are **secondary to lifting** — they shouldn't clutter Today or make the gym session feel optional. No confetti.
- Be explicit whether it counts as a **training day** / streak (probably not a gym session, but an "active day").
- Reuse the real components (Sheet, segmented control, Effort gauge, Date field, ghost row, hist-item row, flame chip, cat badge) before inventing new ones; where a new component is needed, draw it in the same language.
- Dark mode only.
