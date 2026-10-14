# Spotter — Redesign brief: **Today + Session** (mobile)

_Paste this whole file into Claude Design as the brief. It is self-contained — everything Claude Design needs (brand tokens, current screen contents, problems to fix, features to preserve, output spec, sample data) is below._

---

## 1. The ask

Design **20 distinct redesign directions** for two screens of a mobile fitness app — the **Today** (home) screen and the **live Session** (workout logging) screen. For **each** direction, produce **two phone artboards: a Today and a Session**, so the same design language is shown across both (40 artboards total).

- Order the 20 directions as a **spectrum from subtle → radical**: direction 1 is a light declutter of today's design; direction 20 is a bold rethink. The middle is where most of the value is.
- Every direction must **solve the UX problems in §5** and follow the **best-practice guardrails in §7**, while keeping the brand identity in §3.
- Mobile only. Dark theme. Real content (use the sample data in §8) — **no lorem, no placeholder greeking**.
- If 40 artboards is too many for one pass, do it in **batches of 5 directions** (10 artboards each) and keep the numbering and layout consistent.

**Canvas layout.** Two aligned rows: the top row is all 20 Today artboards, the bottom row is all 20 Session artboards, so **column N = direction N** on both screens and they read left-to-right subtle→radical. Above each column, a caption block: **direction name · one-line thesis · what it fixes · the tradeoff**.

---

## 2. Product context

**Spotter** is a gym workout tracker — a mobile-first PWA for a solo lifter. It's dark-themed, premium, calm. **Today** is the home screen you open between sessions (what to do, how you're recovering, recent history). **Session** is the screen you use _during_ a workout to log sets, rest, and move through exercises one-handed, often sweaty and distracted. The core tension: the app has grown feature-rich and now shows too much at once on a ~390px screen.

---

## 3. Brand & design tokens — match these exactly

**Type**

- Body / UI: **Inter** (400/500/600/700/800).
- Wordmark only: **Kaushan Script** (the lowercase “spotter” logo, in white/neutral). Don't use the script for anything else.
- Set a real type scale (≈6 steps) and stay on it.

**Core color (dark)**

- Background `#16171a` · Surface `#1f2125` · Text `#e9eaec` · Divider `rgba(233,234,236,.14)`
- **Accent (gold)** `#d9a24f` — ramp: 300 `#eed3a5`, 400 `#e4bb76`, 500 `#d9a24f`, 600 `#b3833d`, 700 `#8a642e`, 800 `#5b4420`, 900 `#342713`
- Neutrals: 300 `#d0d3d6` · 400 `#b0b4b8` · 500 `#90959a` · 600 `#71767b` · 700 `#55595e` · 800 `#3b3f43` · 900 `#262a2d`

**Semantic color (keep distinct from the gold accent)**

- OK / success `#4cbe8c` (text `#b7e8cf`, tint `#16291f`)
- Danger `#e2564f` (text `#f3c2bf`, tint `#2c1614`)
- Calories `#3d84c9` (text `#cbe0f6`) · Rest/recovery blue `#33a8e0` (300 `#93d4f2`)

**Shape & spacing**

- Radii: sm `4px`, md `8px`, lg `14px`, sheet `20px`.
- Spacing scale (px): 2.8 / 5.6 / 8.4 / 11.2 / 14 / 16.8 / 22.4.
- Shadows are subtle + a 1px inset hairline border, e.g. `0 0 0 1px #55595e, 0 6px 18px rgba(0,0,0,.6)`.

Gold = brand + primary action + emphasis. Don't spend it everywhere; a screen with gold on one thing reads more premium than gold on ten.

---

## 4. Device & chrome specs

- Frame **390 × 844** (iPhone-ish). Respect a top safe area (~47px) and a bottom safe area (~34px).
- A **bottom tab bar** (5 tabs: Today · Progress · Programs · Gyms · Apps) sits at the bottom of Today. You may redesign it, but keep 5 reachable destinations.
- Today currently also has a **floating action pill** hovering above the tab bar — see §5, this is a problem to solve, not a fixture.
- One-handed use: the primary action and the most-used controls belong in the lower ~⅔ of the screen (thumb reach); the top is for glanceable status.

---

## 5. What's on the screens now — and what's wrong

### TODAY — currently shows, top to bottom

Header (script wordmark + app name, a mastery XP badge “628”, a notifications bell “9+”, a language flag) → big “Today” title + date + a sync status → a **readiness banner** (“much still recovering — lighter day”) → a **week strip** (7 day-dots) → a **Playbook** card → a **4-tile stat grid** (sessions / volume / new PRs / streak) → an **energy (kcal) card** with a lifting/cardio/resting split → a **weekly-volume bar chart** → a **mixed history feed** (workouts + sleep nights + naps interleaved) → a **sleep hero** card → a **records** row → a **floating 4-action pill** (rest · activity · log-past · **Start training**) that hovers over the content.

**Problems to fix on Today:**

1. **~20 stacked sections** before you reach anything actionable. Vertical space is the scarcest thing on a phone.
2. **Advisory banners pile up full-width** (rest / illness / learn / sleep) above a nudge deck that already exists to hold them — one banner can be the whole first screen.
3. **The floating pill hovers over content** — it covers the last history rows / records and competes with the bottom nav for the thumb zone. Two floating bars in one corner.
4. **The same fact repeats:** the weekly-volume chart is _also_ the opening chart of the Progress tab; the week strip, the program-day buttons and the volume bars all encode weekly rhythm; “today is X day” is stated up to four times.
5. **No clear focal point** — the readiness banner, stats, energy, chart and history all compete at similar visual weight; nothing says “do this next.”
6. **The header carries four controls** across a narrow bar before the page even starts.

### SESSION (live workout) — currently shows, top to bottom

A header status bar (workout timer `0:50` + a sets/volume/exercises strip) → a **“current exercise” plaque** (“Incline Dumbbell Press · Set 1”) → a **rest clock** strip (“REST 1:46”) → a **muscles-worked chip row** (Chest 4 · Shoulders 2 · Triceps 2) → a **plan-progress bar** (“57% · 4/7 sets”) → then the **exercise cards**. Each card packs ~10–14 elements: drag handle, name, a “prev” pill, a plan-count, a settings menu, an equipment button, an optional ×2 chip, a muscle row, a **progression target** line with a “why” sentence (“80.0 × 5 · +5.0 · reached top of range — add load”), the set grid, per-set rest lines, a live rest count-up, a ghost/next-set row, and an add-drop / warm-up tools row. A **floating glass pill** (discard · settings · add · muscle-map · finish) hovers over the list. Logging one set opens a **set editor sheet** with steppers + a sides toggle + a unit toggle + a plate calculator + a bodyweight toggle + a load-type row + a set-type row, and can branch to sub-screens. There are **15 different sheets/dialogs** reachable, nested up to 4 deep.

**Problems to fix on Session:**

1. **Five status modules stack above the first exercise** (timer+stats, current-exercise plaque, rest clock, muscle chips, plan-progress bar) — most of the first screen is status, and nothing is clearly primary.
2. **The active set / “what do I do right now” is not obvious** — it's buried under status and inside a busy card.
3. **Rest time shows in three places** (header strip, per-card count-up, between-set lines); **session stats show twice** (header meta + stats strip).
4. **Each exercise card is a crowded dashboard** (10–14 elements) on ~390px.
5. **Logging a set is a multi-page task** when 95% of sets are just reps × weight.
6. **Sheet sprawl** — 15 sheets nested up to 4 deep is punishing to navigate and back out of on a phone.
7. **Two progress metaphors run at once** (a milestone rail + a plan-progress bar).

### The seven cross-cutting principles the redesigns should embody

1. Show each fact **once**. 2. Give each screen **one focal job / one primary action**. 3. Put **content before status** — summaries collapse or move below the thing they summarize. 4. Use **one consistent component kit** (one card, one chip, one sheet, one toggle) — the current app has drifted into dozens of variants. 5. **Progressive disclosure** — advanced/rare controls hide behind a tap. 6. **Respect the thumb zone** — one floating layer at most, never occluding content. 7. **Motion & decoration with restraint** — calm beats flashy; this is used mid-workout and at bedtime.

---

## 6. What each direction may change

Directions should range across these axes (mix them to create 20 genuinely different points of view — don't just re-skin one layout 20 times):

- **Information architecture:** what's on the screen vs behind a tap vs moved to another screen.
- **Primary-action model:** one big CTA, a docked bar, a FAB, a swipe, a sticky footer.
- **Layout system:** stacked cards → quiet list rows → a calm module grid → a single-focus canvas → a carousel/one-thing-at-a-time.
- **Session logging model:** full card list vs one-exercise-at-a-time vs a minimal “big number” set logger vs a checklist.
- **Status treatment:** persistent header vs collapsible vs contextual (only the rest timer appears while resting).
- **Visual/aesthetic treatment:** where restraint helps — typographic/editorial, OLED-minimal, high-contrast/accessible, warmer or cooler neutral, denser vs airier. Keep the gold accent and dark base as the through-line.
- **Interaction:** tap, swipe-to-log, long-press, bottom-sheet-driven.

Seed ideas to include among the 20 (invent the rest yourself; feel free to replace any of these with something better):
subtle declutter of the current design · one-primary-action Today · “what's next” coach-led Today · journal/timeline Today · calm module grid · glance-mode (radically reduced) · segmented Today (Do / Track / Rest) · Session as one-exercise-at-a-time · minimal big-number set logger · rest-timer-centric Session · sticky active-exercise header · swipe-to-log Session · checklist Session · editorial/typographic treatment · OLED-minimal · high-contrast accessibility-first · denser power-user layout · airier beginner-friendly layout · gesture + bottom-sheet driven · bold radical rethink.

---

## 7. Best-practice guardrails (apply to all 20)

- **One primary action per screen**, unmistakable and in thumb reach.
- **≤ ~5 elements above the fold** on each screen; everything else earns its place or collapses.
- **Progressive disclosure:** default to the simple path; advanced controls (units, sides, load-type, plate math, drop sets) live behind an “advanced/more” affordance.
- **One component vocabulary** across both screens: a single card, chip, sheet, toggle, segmented control, stat tile.
- **A ~6-step type scale**; don't invent per-element sizes.
- **Touch targets ≥ 44px**; **text/background contrast ≥ 4.5:1** (watch gold-on-dark for small text — use the lighter gold ramp or neutrals for body).
- **One floating layer at most**, and it must never permanently cover content (dock it, or hide on scroll).
- **Motion restraint** — no ambient full-screen animation; micro-interactions only, and respect reduced-motion.
- **Dark-first**, legible; keep semantic colors (ok/danger/kcal/rest) distinct from the gold accent.
- **Real content** from §8. Populated states, not empty shells.

---

## 8. Features each redesign MUST still support (don't design away function)

**Today must still let the user:** start a new session (primary) and resume an in-progress one; see a readiness glance; see this week at a glance (streak / volume / trained days); know today's plan or program day (incl. rest/illness state); reach sleep, activity, log-a-past-workout, full history, and notifications; see key totals. It's fine to move any of these behind a tap or into a nudge — but it must be reachable.

**Session must still let the user:** log a set (reps, weight, warm-up, and — behind advanced — drop set / RPE / units / sides / plate math / load type); see and control rest timing; add / replace / reorder exercises; group supersets and run circuits; see the progression target for the current lift; see muscles worked and plan progress; and finish or discard the workout.

**Sample data to populate the mockups (use these exact values):**

- Athlete: “Test”. Today: Thursday. Streak: **76 days**. This week volume: **26.3 t** (▼30%). Sessions this month: **40**. New PRs: **14**. Last sleep: **7h 6m**, quality “good”.
- Last sessions in history: **Pull day** (23 sets · 10,373 kg), **Leg day** (16 sets · 15,880 kg), plus a **Sleep** night and a **Nap**.
- Live Session = **Push day**, 0:50 elapsed. Exercises: **Barbell Bench Press** (working 80 kg × 5, target +2.5), **Incline Dumbbell Press** (24 kg × 10), **Overhead Press** (45 kg × 8), **Lateral Raise** (12 kg × 15), **Triceps Pushdown** (25 kg × 12). Rest running: **1:46**. Muscles worked: Chest, Shoulders, Triceps. Plan progress: 4 of 7 sets.

---

## 9. Output

- **40 artboards**, 390×844, dark. Two aligned rows (Today on top, Session below), 20 columns, ordered subtle→radical.
- Above each column, a **caption**: `NN · Direction name` — one-line thesis — **Fixes:** (the specific problems from §5 it targets) — **Tradeoff:** (what it gives up).
- A short **legend / intro block** at the top-left of the canvas naming the palette and type, and stating the goal (declutter Today + Session, one focal job per screen, one component kit).
- Keep every direction internally consistent (its Today and its Session share one design language).

Produce the strongest, most distinct 20 you can — this is a menu to choose 2–3 from and develop further, so **range matters more than polish on any single one**.
