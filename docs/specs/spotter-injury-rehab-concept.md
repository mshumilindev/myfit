# Injury & Rehab — concept

_Train around an injury instead of around a calendar. You tell Spotter what you
hurt and for how long it must stay unloaded; the app protects that area
everywhere — session builder, program, readiness map, stats — and eases it back
in when the clock runs out._

Built entirely on systems Spotter already has. Nothing here needs a new engine —
it reuses recovery/readiness, the volume landmarks, the goals **emphasis** model,
the session builder, and the rest-period plumbing.

---

## 1. Why

Today Spotter's only answer to "I can't train normally" is a **whole-body**
rest period (`RestMode = 'active' | 'off' | 'illness'`) — you step away from the
gym and the streak is protected. But a real injury is the opposite: you _keep_
training, just **not one area**, and often for **weeks or months**. "Hurt my
knee, no legs for ~6 months" should quietly reshape every recommendation while
you carry on pressing and pulling — not force you to either ignore it or stop
everything.

So we add a **targeted, time-boxed "protect this area" state** that plugs into
the surfaces that already reason per-muscle.

---

## 2. What we already have (the foundation)

Everything the feature needs to _read from_ and _write to_ exists:

- **Rest periods** — `RestPeriod { startDay, endDay, mode, open, note }` with a
  clean entry point (the Rest sheet: _Aktywna regeneracja / Pełny odpoczynek /
  Choroba_, plus an **OD → DO** date range and an open-ended "until I'm better"
  mode). Injury reuses this UI shell and the "these days aren't _missed_" logic.
- **Per-muscle readiness** — `recovery.ts` (`muscleReadiness`, `READINESS_COLOR`,
  states recovering/nearly/ready/stale) already drives the **Progress →
  Gotowość** screen as both a **list** (per-muscle % + recovery ETA) and a **body
  Map** (front/back silhouette tinted per muscle). An injured muscle is just a
  new, dominant state on the exact same surface.
- **Volume landmarks** — `volume.ts` `LANDMARKS` (MEV/MAV/MRV per muscle) +
  `personalize.ts` + `goals.ts`. "Don't load it" = clamp its landmarks to 0;
  "ease it back" = the graded ramp we already do for the `ease` emphasis.
- **Goals emphasis** — `goals.ts` `Emphasis = 'grow' | 'hold' | 'ease'` and
  `groupEmphasis()` already bias the session builder per muscle. Injury adds one
  stronger step on the same axis: **`avoid`**.
- **Session builder** — `sessionBuilder.ts` `pickMuscles()` / `buildDay()`
  already skip _unrecovered_ tissue and respect emphasis. Excluding an injured
  muscle is one filter in the same place.
- **Program model** — weekday-anchored program days with `targetMuscles` per day
  and exercises carrying `primaryMuscle` / `secondaryMuscles`. Enough to detect
  "this day / this exercise loads the injured area."
- **Muscle model** — a single `MuscleGroup` vocabulary shared by the catalog,
  readiness, volume and the body map, so a body part maps cleanly to muscles.

> Grounding screenshots captured for this concept: the **Rest sheet** (rest
> modes + OD→DO range), **Progress → Gotowość** in both **Lista** and **Mapa**
> (per-muscle % and the tinted body silhouette), and the **session-builder
> muscle step** (readiness-tinted muscle chips). The injury UI lives inside
> these exact screens rather than inventing new ones.

---

## 3. The core idea

An **Injury** is a first-class record:

> "I hurt my **{body part}**. Don't load **{muscles}** at **{no-load | light
> only}** from **{start}** for **{duration / until date}**, then ease it back."

It is deliberately **separate from `RestPeriod`** (which is whole-body and
short) but **shares its surfaces**:

- entry point → the Rest sheet gets a fourth choice ("Uraz / rehabilitacja");
- day accounting → injured days aren't "missed" for the protected area;
- visibility → the Today banner and the readiness map.

Recommended data model — a new `Injury` entity, not a `RestMode`:

```ts
type LoadRule = 'no-load' | 'light-only'; // full protection vs deloaded/isolation-safe

interface Injury {
  id: string;
  /** What the user picked — a joint/region label for display. */
  bodyPart: BodyPartKey; // 'knee' | 'shoulder' | 'lower_back' | 'elbow' | ...
  /** Resolved muscle groups this injury protects (from BODY_PART_MUSCLES,
   *  editable by the user). */
  muscles: MuscleGroup[];
  rule: LoadRule;
  startDay: number; // day key, like RestPeriod
  /** Fixed return, or open-ended "until cleared". */
  endDay: number | null;
  open?: boolean;
  /** Ease-back window after endDay, in weeks (graded reload). Default ~2–4. */
  rampWeeks?: number;
  note?: string | null;
  createdAt: number;
  updatedAt?: number;
  clearedAt?: number | null; // early clearance
}
```

Why its own type, not a `RestMode`: a rest period is _whole-body and days-long_;
an injury is _muscle-scoped and months-long_, coexists with normal training, and
has a **ramp-back** phase a rest period never needs. Keeping it separate avoids
overloading `RestPeriod`'s "these days are rest" semantics — during an injury
most days are **normal training days**, just missing one area.

---

## 4. Body part → muscles (the "automatic" part)

The user thinks in **joints / body parts**; the engine thinks in `MuscleGroup`.
One lookup bridges them (seeded default, then user-adjustable per injury):

```ts
const BODY_PART_MUSCLES: Record<BodyPartKey, MuscleGroup[]> = {
  knee: ['quads', 'hamstrings', 'glutes', 'calves'],
  hip: ['glutes', 'hamstrings', 'quads', 'adductors', 'abductors'],
  ankle: ['calves'],
  lower_back: ['lower_back', 'glutes', 'hamstrings'], // + caution on loaded spinal flexion
  shoulder: ['shoulders', 'chest', 'triceps', 'lats', 'biceps'],
  elbow: ['biceps', 'triceps', 'forearms'],
  wrist: ['forearms', 'biceps'],
  neck: ['neck', 'traps'],
  chest: ['chest'],
  // ...
};
```

Flow: user picks a body part → we pre-select its muscles → **they can add/remove
muscles** (a tweaked ankle might only need `calves`; a shoulder impingement
might spare `biceps`). This keeps it automatic _and_ honest — we never silently
lock out a muscle the user still wants to train.

The body part list should be pickable two ways, both already-present idioms:

1. **Tap the body Map** (the Gotowość _Mapa_ silhouette) — tap the sore area,
   which is the most natural "where does it hurt" gesture; or
2. a plain **list** of joints/regions (the _Lista_ idiom) for accessibility.

`light-only` vs `no-load` is the severity switch: `no-load` removes the muscles
entirely; `light-only` keeps them but caps intensity/volume and prefers
machine/isolation over heavy compound loading (a rehab-appropriate dose).

---

## 5. Input flow

Reuse the Rest sheet's structure, add an injury path:

1. **Rest sheet → "Uraz / rehabilitacja"** (a fourth card under the existing
   _Aktywna regeneracja / Pełny odpoczynek / Choroba_).
2. **Where?** — tap the body map or choose from the joint list. → pre-selects
   muscles, editable.
3. **How bad?** — `no-load` (protect fully) or `light-only` (deloaded / isolation
   OK). One sentence explains each, matching the Rest sheet's mode blurbs.
4. **How long?** — the same **OD → DO** date range the Rest sheet already uses,
   plus quick chips ("2 tyg", "6 tyg", "3 mies", "6 mies") and an open-ended
   "until cleared". This is the "скільки часу не можна навантажувати" input.
5. **Note** (optional) — free text ("prawe kolano, po biegu").
6. Save → an `Injury` record; the app reshapes immediately.

A live/active injury shows on **Today** as a persistent banner (same slot as the
illness banner): _"Rehab: kolano · zostało ~5 mies"_ with a _"Przegląd"_ action
that opens the injury detail (edit muscles, shorten/extend, mark cleared).

---

## 6. What it changes automatically

One injury, protected everywhere the app reasons per-muscle:

**Session builder** (`sessionBuilder.ts`)

- `pickMuscles()` excludes `no-load` muscles outright (same place it already
  skips unrecovered tissue); `light-only` muscles stay eligible but flagged.
- `buildDay()`:
  - never anchors on or fills a `no-load` muscle;
  - for `light-only`, forces low intensity + isolation/machine picks and caps
    sets to a rehab dose (reuse `deriveLoadType` + the ordering priority to
    prefer machines over free-weight compounds);
  - actively **trains around** the injury — with legs out, it leans the day into
    upper-body volume that's due, so a session is still full and useful.
- The wizard's **muscle step** shows injured muscles as a distinct locked chip
  (a rehab tone, disabled/【🔒】), so the "why isn't legs offered" is obvious.

**Readiness list + body Map** (Progress → Gotowość)

- Injured muscles get a dedicated **rehab state/tone** (distinct from the
  recovering→ready→stale palette — e.g. a muted red / hatched fill on the map),
  with a **countdown** ("kolano · ~5 mies") instead of a recovery ETA. The body
  map becomes the at-a-glance "what's protected" view.

**Program** (weekday days + exercises)

- Program days whose `targetMuscles` are dominated by the injured area are
  flagged and offered a **temporary swap** (e.g. a Leg day → an accessory/upper
  day for the duration) rather than silently failing; those days no longer read
  as "missed".
- Individual prescribed exercises that load a `no-load` muscle are marked and
  offered a substitution (train-around), not auto-deleted.

**Logging guard (soft)**

- If you add/log an exercise whose primary/secondary hits a `no-load` muscle, a
  **gentle, dismissible warning** ("To obciąża kolano — na pewno?") — never a
  hard block. The user is the authority on their own body; we inform, they
  decide. (Consistent with Spotter's "coach, not cop" tone.)

**Stats / streak / "missed"**

- Injured days are not "missed" for the protected area (same protection illness
  gives the whole body). The consistency streak survives. Trends' "least-trained
  / on pause / neglect" insights **suppress** the injured muscles for the
  duration — otherwise they'd nag you to train exactly what you're protecting.

**Volume / landmarks** (`volume.ts` + `personalize.ts`)

- `no-load` → the muscle's effective MEV/MAV/MRV clamp to 0 for the window (no
  "you're under MEV on quads" nudges while a knee heals).
- This is a filter layered on the existing landmark lookup, not a rewrite.

---

## 7. Return to load (the ramp-back)

The bit that makes it _rehab_, not just _exclusion_. When `endDay` passes (or the
user marks **cleared**), the injury doesn't flip straight back to full training —
it enters a **ramp-back window** (`rampWeeks`, default 2–4):

- the protected muscles switch from `avoid` → the existing **`ease`** emphasis,
  which the session builder already handles (reduced volume, gentler
  progression);
- `progression.ts` starts the reintroduced lifts **below** the pre-injury top
  (a cold-start-style conservative weight) and ramps over the window instead of
  resuming at the old max;
- the body map shows a "wracasz do formy" (returning) tone during the ramp;
- after the window, everything returns to normal automatically.

This is the single most important design point: a hard cut back to prior loads
is how people re-injure. The graded reintroduction falls out of systems we
already have (`ease` emphasis + cold-start weighting), so it's cheap to build.

---

## 8. Edge cases

- **Multiple injuries** at once — the model is a list; a muscle protected by any
  active injury is protected. Union of excluded muscles.
- **Extend / shorten** — editing `endDay` re-derives everything live; no
  recomputation of history.
- **Early clearance** — `clearedAt` ends protection now and starts the ramp-back
  from today.
- **Re-injury** — a new `Injury` supersedes; if it overlaps a ramp-back, the
  ramp resets.
- **`light-only` graduating to normal** — same ramp-back path, shorter.
- **Injury that spares a mapped muscle** — user removes it in step 2; nothing is
  ever locked without consent.
- **"Everything but the injury" days** — the builder must still produce a full,
  worthwhile session; if too little is trainable (e.g. a lower-back injury that
  cautions most compounds), it degrades to an upper-isolation / conditioning day
  and says so, rather than an empty plan.

---

## 9. Integration points (concrete)

| Surface      | File                                 | Change                                                                                                                            |
| ------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Model        | `types.ts`                           | add `Injury`, `LoadRule`, `BodyPartKey`                                                                                           |
| Store        | `store.ts`                           | `injuries[]`, `startInjury / updateInjury / clearInjury / deleteInjury`, Firestore doc mirror (mirror the `restPeriods` plumbing) |
| Mapping      | new `injury.ts`                      | `BODY_PART_MUSCLES`, `activeInjuries(now)`, `protectedMuscles(now): Map<MuscleGroup, LoadRule>`, `injuryRampState(now)`           |
| Emphasis     | `goals.ts`                           | extend `Emphasis` with `'avoid'`; `groupEmphasis` merges injury state                                                             |
| Builder      | `sessionBuilder.ts`                  | `pickMuscles` / `buildDay` honor protected + light-only + ramp                                                                    |
| Volume       | `volume.ts` / `personalize.ts`       | clamp landmarks for protected muscles                                                                                             |
| Readiness UI | Progress → Gotowość (list + Mapa)    | rehab tone + countdown                                                                                                            |
| Entry UI     | Rest sheet + new injury detail sheet | pick body part (map/list), rule, OD→DO, note                                                                                      |
| Today        | `TodayView` banner                   | active-injury banner (illness-banner slot)                                                                                        |
| Program      | program day / exercise rendering     | flag + swap injured days/exercises                                                                                                |
| Trends       | `trends.ts`                          | suppress injured muscles in "neglect / on pause / least-trained"                                                                  |
| Logging      | add-exercise / session               | soft warning on protected-muscle load                                                                                             |

---

## 10. Phasing

**MVP (the core ask)** — the `Injury` model + body-part→muscle mapping +
Rest-sheet entry (map/list, rule, duration) + session-builder exclusion + the
Today banner + readiness/body-map rehab tone + streak/"missed" protection. This
already delivers "hurt my knee → no legs for 6 months, everything adapts."

**V2** — ramp-back reintroduction (ease emphasis + conservative reload), program
day/exercise swaps, the soft logging guard, trends suppression, `light-only`
dosing rules.

**Later** — rehab exercise suggestions per body part (mobility/prehab picks),
pain check-ins over the window, return-readiness prompt near `endDay`.

---

## 11. Open questions (for you)

1. **Body-part granularity** — joints only (knee, shoulder, lower back, elbow,
   wrist, ankle, hip, neck) or finer (e.g. "left vs right", or specific tissues
   like patellar tendon)? Left/right doesn't change the muscle math but reads
   more precise. Recommendation: joint-level for MVP, optional side label.
2. **Default `rampWeeks`** and whether the ramp is opt-in or automatic.
   Recommendation: automatic, ~3 weeks, editable.
3. **`light-only` dosing** — exact caps (sets, %1RM, machine-only?). Needs a
   simple rule; propose ≤ 60% of the muscle's usual per-session sets, isolation/
   machine preferred, no new PRs.
4. **Whole-injury streak** — should an injury protect the streak like illness
   even on days you couldn't train the rest either? Recommendation: no — you can
   still train around it, so normal streak rules apply; only the _injured area_
   is exempt from "neglect" nagging.
