# Spotter — Automatic Session Builder (Wizard) — Concept

_"AI-like, without AI."_ A rule-driven wizard that, when you start a workout,
asks a few sharp questions and hands you a **coach-grade** session: the right
muscles for today, the right exercises in the right order, sized to your goal,
with warm-up and working-set weights already dialled in — a program a good
coach would sign off on, not a random pick.

> **TL;DR (укр).** Майстер із кількох кроків при старті тренування. Питає ціль
> на сьогодні (або бере з My Fit), які мʼязи хочеш (або підбирає сам), і будує
> продуману сесію: підбір вправ під ціль/зал/рівень, порядок, кількість
> підходів/повторів/відпочинку, розминкові й робочі ваги, за бажанням кардіо та
> заминку. Спирається на все, що вже є в застосунку (готовність мʼязів, обʼєм,
> історія, стандарти, playbook «що ти любиш робити»). Нічого випадкового —
> кожен вибір обґрунтований. Це **концепція**, код ще не пишемо.

---

## 1. Design principles

1. **Trustworthy, never random.** Every exercise, set, rep and kilo must be
   justifiable to a strong coach. Selection is deterministic and explainable
   ("chosen because: chest is your grow focus, recovered, and you bench often").
2. **Stand on what we already have.** The app already contains almost every
   sub-system a builder needs (see §2). The wizard is mostly an _orchestrator_
   over existing pure modules — not a new engine from scratch.
3. **Ideal × personal.** Blend textbook programming (volume landmarks, SRA
   recovery, double progression) with what the athlete actually likes and does
   (the Playbook). The output should feel like _their_ session, done right.
4. **Honest degradation.** With no history / no body data / no gym inventory,
   still produce a sound beginner session and say what it assumed — never a fake
   number.
5. **Fast by default, deep on demand.** A returning user can get a session in
   two taps ("Auto → Start"); the wizard's extra steps are optional refinements,
   not a gauntlet.

---

## 2. What we already have (the builder's raw materials)

The builder is an orchestration layer. These existing pure modules do the heavy
lifting; the concept below composes them.

| Need                             | Existing module                                                                                                                                                                                    | What it gives us                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goals**                        | `goals.ts` (`FitGoals`, `PhysiqueTarget`, `BlockFocus`, `groupEmphasis`, `focusAdjustLandmarks`)                                                                                                   | Physique archetype + per-muscle grow/hold/ease focus at fine sub-region grain. Already adjusts volume landmarks.                                                         |
| **Muscle readiness (time axis)** | `recovery.ts` (`muscleReadiness`, `readyMuscles`, `recoveringMuscles`, `staleMuscles`, `ReadyState`)                                                                                               | Per-muscle SRA recovery 0..1 with `recovering / nearly / ready / stale`. Exactly "what's ready to train".                                                                |
| **Fatigue (load axis)**          | `fatigue.ts` (`stalledMuscles`, chronic load vs MRV)                                                                                                                                               | Which muscles are overreached / which lifts have stalled.                                                                                                                |
| **Volume landmarks**             | `volume.ts` (`LANDMARKS` MEV/MAV/MRV, `VOLUME_MUSCLES`, `classifyZone`, `weeklyMuscleSets`)                                                                                                        | Weekly productive set ranges per fine muscle; where each muscle currently sits (under/productive/high/over).                                                             |
| **Personalised volume**          | `personalize.ts` (`personalLandmarks`, `tuneLandmark`)                                                                                                                                             | Landmarks tuned to the athlete's own recoverable volume (height/weight-independent, evidence-blended).                                                                   |
| **Exercise catalog**             | `data/exercises.ts` (`RichExercise`: `force`, `level`, `mechanic`, `category`, `equipment`, `primary/secondaryMuscles`, `images`; `richExerciseByName`, `searchCatalog`, `exercisesForSubRegions`) | 873-entry rich DB. Enough metadata to pick compound-before-isolation, level-appropriate, muscle-matched, loadable moves.                                                 |
| **Sub-region focus**             | `data/subregions.ts` (`FocusMuscle`, `focusToGroup`, `FOCUS_MUSCLES`, `SUBREGIONS`)                                                                                                                | Fine targeting (upper vs lower chest, side vs rear delt).                                                                                                                |
| **Progression / working weight** | `progression.ts` (`nextTarget`, `topHistory`)                                                                                                                                                      | Double-progression target (add load / hold / deload / first-time) per lift from history; handles weight / assist / band / bodyweight.                                    |
| **Strength standards**           | `standards.ts` (`computeStandards`, `DISCIPLINES`, level ratios beg→eli)                                                                                                                           | Bodyweight-relative expected loads → cold-start weights when there's no history.                                                                                         |
| **Plate / load reality**         | `plates.ts` (`PLATES_KG/LB`, `BAR_WEIGHTS`), `loads.ts` (`LoadType`, bands, assist stacks)                                                                                                         | Round any prescription to loadable weight; correct math for assisted/band moves.                                                                                         |
| **Personal "what I like"**       | `playbook.ts` (`computePlaybook` → `Play` with exercises, order, sets, rep ranges, top weights, coverage, `suggestions`)                                                                           | Learned canonical days from real history: your exercises, your order, your set/rep habits, favourite-lift & gap & plateau nudges. **This is the personalization spine.** |
| **Swaps**                        | `swaps.ts` (`SwapCandidate`, cosine muscle-profile similarity, gym-aware)                                                                                                                          | Replace any exercise with a same-profile, gym-available alternative.                                                                                                     |
| **Day inference**                | `data/daySuggest.ts` (`describeDay`, `exerciseDay`, `TrainingDay`)                                                                                                                                 | Map muscles ↔ push/pull/legs/core/full; name a day.                                                                                                                      |
| **Gym availability**             | `store.ts` (`exerciseNeeds`, `missingAtGym`, `gym.inventory`)                                                                                                                                      | Filter exercises to the equipment actually present.                                                                                                                      |
| **Body + energy**                | `store.ts` (`bodyMetrics`, `latestWeight`, `bodyMetricsComplete`), `energy.ts` (`bmrKcal`), `dayEnergy.ts`                                                                                         | Height/weight/sex/age for standards & warm-ups; recovery boost from sleep/activities.                                                                                    |
| **Session plumbing**             | `store.ts` (`startWorkout`, `addExercise` with `plannedSets/plannedReps/groupId`, warm-up auto-tagging, circuits)                                                                                  | Materialise the generated plan as a real live session.                                                                                                                   |
| **Existing entry point**         | `components/SessionStartCoach.tsx` (`hasSessionStartCoach`, `predictToday`)                                                                                                                        | Already previews "your usual lifts today + readiness + progression" on the empty session screen. The wizard is its natural evolution.                                    |

**Conclusion:** we do **not** need an exercise database, a progression engine, a
recovery model, a volume model, or a personalization engine — they exist and are
unit-tested. The builder is a well-designed **selection + sizing + sequencing**
layer plus a **wizard UI**.

---

## 3. The two modes

- **Quick Auto (default, returning users).** One tap on the empty-session screen
  → the builder reads goals + readiness + playbook and produces a full session
  instantly, shown as an editable preview. This is the everyday path and should
  feel effortless — it's the Playbook's "ideal play" made concrete for _today_.
- **Wizard (deliberate build).** A short guided flow for when you want to steer:
  pick intent, muscles, length, equipment. Also the **first-run** path (collects
  the one-time Training Profile, §5).

Both end at the same **Preview & tune** screen (§7) and the same generator (§6).

---

## 4. Inputs the generator consumes

Assembled once per build into a `BuildContext`:

- **Session intent** — today's purpose (see §6.1). From the wizard, or inferred.
- **Goal context** — `FitGoals` (physique archetype + block focus grow/hold/ease).
  If none set, the wizard's **first step is the goals mini-picker** (reusing the
  recently-built goals UI) — never silently guess the goal.
- **Target muscles** — chosen in the wizard, or auto-selected (§6.2).
- **Readiness** — `muscleReadiness(finished, now, recoveryBoost)` where
  `recoveryBoost` comes from recent sleep/recovery activities.
- **Volume state** — `personalLandmarks` → `focusAdjustLandmarks` (goal) and
  `weeklyMuscleSets` (what's already done this week → remaining "debt").
- **History** — `topHistory` per lift (for `nextTarget`), and the **Playbook**
  (`computePlaybook`) for exercise preferences, order and habitual set/rep.
- **Body** — `latestWeight`, height, sex, age (for standards & warm-ups).
- **Gym** — active gym `inventory` for equipment filtering.
- **Constraints** — time budget, experience level, equipment access, injuries
  (`ease` muscles) — from the Training Profile / wizard.

---

## 5. First-run: the Training Profile (one time)

Asked once, stored (`trainingProfile` doc, mirrors `bodyMetrics` persistence),
editable later in settings. Kept short; most fields have smart defaults and can
be skipped.

1. **Experience** — new / returning / experienced (maps to catalog `level`
   preference and starting volume). Can be inferred from history length if data
   exists.
2. **Days per week you train** — sizes weekly volume → per-session dose, and
   picks a sensible split (see §6.2).
3. **Typical session length** — 30/45/60/75/90 min → the time budget (§6.6).
4. **Where you train** — the gym (→ `inventory`) or a preset ("full gym",
   "home dumbbells", "bodyweight only", "commercial machines"). Drives the
   equipment filter.
5. **Style preference** — barbell-forward / dumbbell / machine-friendly / mixed.
   A soft ranking bias in exercise selection (not a hard filter).
6. **Injuries / avoid** — regions or movements to protect (folds into `ease`
   emphasis + excludes matching `force`/exercises).
7. **Units & warm-up preference** — reuse existing unit setting; "always add a
   general warm-up / cool-down?" toggle.

Anything the app already knows (sex, DOB, height, weight, goals, gym) is
pre-filled and not re-asked.

---

## 6. The generation algorithm (the core)

A deterministic pipeline. Each stage is explainable and testable in isolation.

### 6.1 Intent → training parameters

The session **intent** sets the rep/rest/tempo "shape". Proposed intents and
their parameter blocks (coach-standard):

| Intent                      | Reps          | Sets/exercise  | Rest     | Load emphasis  | Notes                                        |
| --------------------------- | ------------- | -------------- | -------- | -------------- | -------------------------------------------- |
| **Strength**                | 3–5           | 3–5            | 3–5 min  | ~85–92%        | Few compounds, long rest, low total volume.  |
| **Muscle (hypertrophy)**    | 6–12          | 3–4            | 90–150 s | ~70–80%        | Default. Fill MAV; mix compound + isolation. |
| **Endurance / tone**        | 12–20         | 2–4            | 45–75 s  | ~55–65%        | Higher reps, short rest, supersets welcome.  |
| **Power / athletic**        | 3–6 explosive | 3–5            | 2–3 min  | moderate, fast | Compound, quality over fatigue.              |
| **Conditioning / fat-loss** | circuit 10–15 | circuit rounds | 30–45 s  | moderate       | Superset/circuit + cardio finisher.          |

Intent is chosen in the wizard, or defaulted from the goal archetype
(e.g. `powerbuilder` → Strength-leaning hypertrophy; `toned-lean` → Endurance/
tone). Intent parameters are the **per-set prescription**; §6.4 sizes totals.

### 6.2 Muscle selection (what to train today)

Two paths converge on a **target muscle set** with a per-muscle **priority**:

- **User picks muscles** (wizard): honour them, but annotate readiness and warn
  on any that are still `recovering` (offer to swap for a `ready`/`stale` peer).
- **Auto (Quick mode / "surprise me"):** pick the day by combining:
  1. **Readiness** — only `ready` / `stale` muscles are eligible; `recovering`
     ones are excluded (or de-prioritised) so you never hammer unrecovered tissue.
  2. **Volume debt** — muscles under MEV/MAV for the rolling week (`weeklyMuscleSets`
     vs personalised, goal-adjusted landmarks) rank up. `over`-MRV muscles rank down.
  3. **Goal emphasis** — `grow` muscles get a priority boost, `ease` muscles are
     minimised or dropped (also covers injuries).
  4. **Split coherence** — cluster the top muscles into a coherent day via
     `daySuggest` (push / pull / legs / upper / full), respecting your usual
     cadence (days/week) and what you trained most recently (avoid repeating
     yesterday's day). The Playbook's learned day rotation is the prior here.

Output: an ordered list of `(muscle, priority, readiness, remainingSets)`.

### 6.3 Exercise selection (the trainer's eye)

For the target muscles, choose exercises. **Personalization first, textbook to
fill gaps** — this is what makes it feel non-random and "yours":

**Step A — anchor from the Playbook.** If a `Play` exists for this day-type,
seed the session with its staple/core exercises in their learned order (that's
literally "the exercises you reliably do, how you order them"). Apply its
`suggestions`: honour a `plateau` swap (via `swaps.ts`), fill a `gap`, and offer
a `favorite` add. This alone gives a session that already looks like the user's.

**Step B — cover the plan.** For every target muscle still under its per-session
set budget (§6.4), add exercises from the catalog, ranked by:

1. **Gym availability** — drop anything whose `equipment` is `missingAtGym`.
2. **Mechanic order** — one or two **compounds** first (`mechanic === 'compound'`),
   then **isolation** for remaining volume / for `grow` sub-regions
   (`exercisesForSubRegions` targets upper-chest, side-delt, etc. specifically).
3. **"Not weird"** — `category === 'strength'`, exclude the `SUGGEST_SKIP`
   pattern (stretches, drills, "around the world", get-ups…) and rank loadable
   equipment first (the existing `EQUIP_RANK`). No party tricks.
4. **Level-appropriate** — bias to the profile's `level`; never hand a beginner
   an advanced barbell move as their anchor.
5. **Preference & familiarity** — style bias (barbell/dumbbell/machine) and a
   boost for lifts already in history (you know them, they load correctly).
6. **Profile complementarity** — avoid three exercises with the identical
   secondary spread; use muscle-vector diversity (same math as `swaps.ts`) so a
   day covers a muscle from useful angles rather than redundantly.

**Step C — dedupe & cap.** One anchor per movement pattern, cap exercise count
by the time budget (§6.6) and intent (Strength ⇒ fewer, Hypertrophy ⇒ more).

**Step D — injuries / ease.** Exclude exercises whose `force`/pattern conflicts
with a flagged injury; prefer machine/supported variants for protected regions.

### 6.4 Volume sizing (how many sets)

- Per muscle, take the **personalised, goal-adjusted weekly landmark**
  (`personalLandmarks` → `focusAdjustLandmarks`).
- Subtract **already-done sets this week** (`weeklyMuscleSets`) → **remaining
  weekly budget**; divide by the muscle's **remaining sessions this week**
  (from days/week and the split) → **today's per-muscle set budget**, clamped to
  a sane per-session dose (≈ MEV/2 … MAV/2, and never pushing a muscle over MRV
  for the week).
- Distribute today's budget across the muscle's chosen exercises (anchor
  compound gets the most; isolations split the rest), then apply intent
  sets/exercise bounds from §6.1.

This makes the builder respect the _weekly_ picture, not just the single day —
the difference between a template and real programming.

### 6.5 Weight & warm-up prescription

For each working exercise:

- **Working weight** — `nextTarget(topHistory(name), opts)` gives the exact
  target (add-load / hold / deload / first-time), already correct for
  weight / assist / band / bodyweight via `loadType`.
- **Cold-start (no history)** — estimate from **standards**: expected load for
  the profile's `level` × bodyweight ratio (`standards.ts`), rounded to loadable
  plates (`plates.ts`); for accessory/isolation with no standard, seed a
  conservative fraction of a related compound or a light "find your weight" set.
- **Warm-up ramp** — generate a short ramp to the first working weight (e.g.
  bar → ~50% → ~70% → ~88%, reps descending, only for loaded compounds; skip for
  light isolation), each rung **rounded to real plates**. These seed as `warmup`
  sets so the existing auto-warm-up tagging and plate UI just work.
- **Per-set guidance** — later sets show the same double-progression read the
  exercise cards already display; the wizard just pre-fills targets so the ghost
  values are meaningful from set one.

### 6.6 Time budget & fit

- Estimate session minutes: Σ over sets of `(work + rest)` using intent rest +
  a per-set work estimate (reuse the model in `activities.ts` `workoutCalories`),
  plus warm-up/cool-down.
- If over budget: trim isolation sets first, then merge compatible exercises
  into **supersets** (antagonist pairs) or a **circuit** (existing `groupId` /
  `groupKind`) for conditioning intent — this both saves time and matches the
  endurance/fat-loss shape.
- If under budget: offer to add an accessory for a `grow` muscle or a finisher.

### 6.7 Warm-up, cardio, cool-down (the "everything else")

- **General warm-up** (optional, profile toggle) — 4–8 min: light cardio +
  dynamic mobility for the day's patterns. Represented as a lead-in block.
- **Cardio / conditioning** — for `conditioning`/fat-loss intent, or on request,
  append a conditioning piece from the **activities catalog** (`activities.ts`
  MET-based), sized to the remaining time/goal.
- **Cool-down** — optional short stretch/mobility for the trained muscles.

### 6.8 Sequencing (order)

Final ordering rules (a coach's instinct, encoded):

1. General warm-up → 2. Big compounds (most systemic, while fresh) →
2. Secondary compounds → 4. Isolations (grow focus first) →
3. Core / conditioning finisher → 6. Cool-down. Within a tier, heavier/priority
   muscles first; antagonist supersets kept adjacent. The Playbook's learned order
   overrides ties (respect how _you_ like to sequence).

### 6.9 Explainability

Every generated item carries a short **"why"** (e.g. "Incline DB press —
upper-chest is your grow focus & recovered; you do this often"). Surfaced in the
preview (§7) as a tap-to-expand rationale. This is what earns a coach's trust
and teaches the user.

---

## 7. Wizard UX (screens)

Native to the app's design language (glass surfaces, muscle chips, the readiness
tones). Enters from the empty live-session screen (evolving `SessionStartCoach`)
and from a "Build a session" action.

- **Step 0 — Goal** _(only if no `FitGoals`, or "change for today")._ The goals
  mini-picker (archetype + optional focus). Otherwise skipped; goal shown as a
  chip you can tap to override for today.
- **Step 1 — Intent.** Big friendly cards: Strength / Muscle / Endurance /
  Athletic / Conditioning. Pre-selected from the goal.
- **Step 2 — Muscles.** Interactive body map (reuse `SessionMuscleMap` / `Muscle`)
  **tinted by readiness** (green ready, amber nearly, red recovering, blue stale),
  with an **"Auto — pick for me"** default. Recovering picks show a gentle warning
  - a suggested swap. Shows the proposed day name ("Pull").
- **Step 3 — Constraints.** Time length + gym/equipment (pre-filled), quick
  toggles: add warm-up, add cardio finisher, supersets to save time. Most users
  skip straight through.
- **Step 4 — Preview & tune.** The generated session as an editable list:
  ordered exercises with planned sets × reps, target working weight + warm-up
  ramp, per-item "why", muscle-coverage read (reuse Playbook coverage bars), and
  estimated duration + energy. Actions per row: swap (`swaps.ts`), +/− sets,
  remove, reorder; global: regenerate, "make it harder/easier", "shorter".
  **Start** materialises it.

First run inserts the Training Profile (§5) ahead of Step 1.

---

## 8. Materialising the session

Reuse existing plumbing — no new session model:

- `startWorkout(gymId, { dayName, targetMuscles })` with the generated day name +
  target muscles.
- For each planned exercise, `addExercise(id, name, kind, { plannedSets,
plannedReps, equipment, primaryMuscle, secondaryMuscles, groupId, groupKind })`.
- Seed warm-up sets (type `warmup`) and pre-fill working-set target ghosts so the
  first tap logs against a real target.
- Supersets/circuits via `groupId` + `groupKind` (already supported).

The result is an ordinary live session — every existing feature (focus mode,
plate sheet, progression reads, energy, history) works unchanged.

---

## 9. New data (small)

- **`trainingProfile`** — experience, days/week, session length, equipment
  preset, style bias, injuries, warm-up/cool-down prefs. Persisted like
  `bodyMetrics` (local + Firestore `users/{uid}/meta/trainingProfile`), no
  backfill. Editable in settings.
- **`builderPrefs`** _(optional)_ — last-used intent/length, "remember my
  choices". Could live in the same doc.
- **Generated plan** — transient; not persisted separately. Once started it's a
  normal `Workout`. (We may cache the last generated plan in memory so
  "regenerate" is cheap.)

No new heavy collections, no writes on the hot path beyond the normal session.

---

## 10. Personalization deep-dive ("what I like to do")

The Playbook is the spine:

- **Anchor** the session on the matching `Play` (staples in your order).
- **Rep/set habits** — use the play's learned `repLow..repHigh` and typical
  `sets` where they don't conflict with the intent (a coach nudges, doesn't
  override your style).
- **Favourites** — the `favorite` suggestion surfaces a lift you love but the
  ideal plan missed → offered as an easy add.
- **Plateau intelligence** — the `plateau` suggestion triggers a variation swap
  so a stalled staple gets a fresh stimulus (real coaching, not repetition).
- **Cold personalization** — with < 2 sessions of history (Playbook not ready),
  fall back to standards + templates and lean on the first-run profile; the
  session still respects level, equipment and goal.

---

## 11. Guardrails & edge cases

- **No history** → standards + templates; conservative weights; "find your
  weight" first sets; clearly labelled as a starting estimate.
- **Incomplete body metrics** → skip standards-based weight (ask for a weigh-in
  first, or omit weight suggestions) — never invent a number.
- **No gym inventory** → assume the chosen equipment preset; don't over-filter.
- **Everything recovering** (cooked) → propose a lighter/technique or
  conditioning/mobility session, or a rest-day nudge, rather than forcing volume.
- **Injuries / ease** → exclude conflicting patterns, prefer supported variants.
- **Over-MRV muscles** → capped/dropped for the week even if requested (with a
  clear note).
- **Time too short for the plan** → auto-trim + supersets, told to the user.

---

## 12. Why this clears the "no complaints from a real coach" bar

- Volume comes from **evidence-tuned MEV/MAV/MRV**, not guesses, and respects the
  **weekly** picture and **recovery** — the two things templates get wrong.
- Exercise choice is **compound-first, level-appropriate, gym-real, goal-aimed,
  angle-diverse**, and filtered of gimmicks.
- Loads use **double-progression from real history** or **bodyweight-relative
  standards** — the same logic a coach uses to pick the next jump.
- Warm-ups ramp to real plates; rest/reps match the stated goal.
- It **adapts to the person** (Playbook), spots **plateaus**, and **explains
  itself** — so it reads as coaching, not a generator.

---

## 13. Suggested phasing

1. **P1 — Quick Auto MVP.** Generator §6 (intent=Muscle default), readiness +
   volume muscle pick, Playbook anchor + catalog fill, `nextTarget`/standards
   weights, warm-up ramp, Preview & Start. Ships the core value fast.
2. **P2 — Wizard + intents.** Full step flow, all intents, time-budget fit,
   supersets/circuits, cardio/warm-up/cool-down blocks, per-item "why".
3. **P3 — First-run Training Profile**, injuries/ease, style bias, "make it
   harder/easier/shorter" controls, richer explainability.
4. **P4 — polish/learning.** Feedback loop ("too easy/too hard" post-session →
   nudges next build), smarter split rotation, cross-week planning.

---

## 14. Open questions for you

1. **Intents** — is the five-intent set (Strength / Muscle / Endurance /
   Athletic / Conditioning) right, or do you want it simpler (e.g. just
   Strength / Muscle / Fat-loss)?
2. **Auto vs Wizard emphasis** — should Quick Auto be the front-and-centre
   default (two taps) with the wizard behind an "customise" button, or lead with
   the full wizard?
3. **How much to lean on the Playbook** vs textbook-ideal when they disagree —
   favour the user's habits, or nudge them toward the "better" choice more
   assertively?
4. **First-run profile length** — the 7 fields in §5, or trim to the essential
   3–4 (experience, days/week, length, equipment)?
5. **Cross-week planning** — should the builder just nail _today_, or also lay
   out the _week_ (so today's pick knows tomorrow's day)?
6. **Cardio/conditioning** — first-class in the builder, or a later add-on?
7. **Naming** — "Session Builder", "Auto-coach", "Build my day", інше?

_This is a concept for review. Once you're happy with the shape, the next
deliverable is a wizard-flow mockup, then implementation per §13._
