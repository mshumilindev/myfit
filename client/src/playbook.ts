/**
 * Playbook — routines LEARNED from real history, not saved snapshots.
 *
 * Every finished session is clustered by the day it represents (the user's own
 * `dayName` when present — "Chest 2" — otherwise the inferred push/pull/legs
 * day). For each recurring day we synthesize a canonical "play": the exercises
 * you reliably do on that day, in your usual order, with a target set count and
 * rep range drawn from how you actually train, plus a representative recent top
 * weight. On top of that we layer the two things a plain template can't give:
 *   · a muscle-coverage read of the synthesized play (fractional set counting,
 *     the same primary=1 / secondary=0.5 model used across the app), and
 *   · smart nudges — a favourite lift missing from the play, a gap the day-type
 *     usually covers, or a core lift that has plateaued and wants a variation.
 *
 * Pure module: `computePlaybook(finished, now)` in, structured plays out. No
 * store mutation, no React — the view renders it and `startPlay` (store) begins
 * a session from one.
 */
import { isStrengthExercise, resolveMuscles, setTopWeight, setTypeOf } from './store';
import type { Exercise, Workout } from './types';
import type { MuscleGroup } from './data/exercises';
import { describeDay, exerciseDay, type DayReadout, type TrainingDay } from './data/daySuggest';

const DAY = 24 * 3600 * 1000;

// A day needs at least this many sessions before it earns a synthesized play.
const MIN_SESSIONS = 2;
// An exercise is "core" to a play if it shows up in at least this share of the
// day's sessions; "staple" (always-there) at the higher bar.
const CORE_FREQ = 0.5;
const STAPLE_FREQ = 0.75;
// Recency window for the representative top weight shown on each play exercise.
const WEIGHT_WINDOW_DAYS = 120;
// A globally frequent lift must have at least this many sessions to be offered
// as a "you love this — add it?" suggestion.
const FAVORITE_MIN_SESSIONS = 4;

export interface PlayExercise {
  name: string;
  kind: 'strength' | 'cardio';
  /** Typical working-set count on this day (median across the cluster). */
  sets: number;
  /** Representative rep range (25th–75th pct of working reps); low===high = fixed. */
  repLow: number;
  repHigh: number;
  /** Representative recent top working weight; null = bodyweight / none logged. */
  topWeight: number | null;
  /** 0..1 — share of the day's sessions this exercise appeared in. */
  frequency: number;
  /** frequency >= STAPLE_FREQ — an anchor of the day. */
  staple: boolean;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
}

export interface CoverageEntry {
  muscle: MuscleGroup;
  sets: number;
  primary: boolean;
}

export type PlaySuggestion =
  | { kind: 'add'; reason: 'favorite'; exercise: string; muscle: MuscleGroup | null }
  | { kind: 'add'; reason: 'gap'; muscle: MuscleGroup }
  | { kind: 'swap'; reason: 'plateau'; exercise: string };

export interface Play {
  /** Stable per-cluster key (so React lists and start actions are consistent). */
  id: string;
  /** The user's own day name if the cluster is named; else null (view falls back to readout). */
  name: string | null;
  /** Describes the synthesized play's muscle mix (for a label when unnamed). */
  readout: DayReadout | null;
  dayType: TrainingDay | null;
  /** How many sessions this play was learned from. */
  sessions: number;
  lastTrainedAt: number;
  exercises: PlayExercise[];
  coverage: CoverageEntry[];
  suggestions: PlaySuggestion[];
  /** Most recent source session — used to start/repeat exactly if wanted. */
  sampleWorkoutId: string;
}

export interface PlaybookResult {
  ready: boolean;
  plays: Play[];
  /** Newest finished sessions, deduped by day, for an exact one-tap replay. */
  recent: Workout[];
}

// Which muscles a push/pull/legs/core day is "supposed" to cover — used to spot
// a gap the day usually trains but this play misses. Mirrors daySuggest's map.
const DAY_MUSCLES: Record<TrainingDay, MuscleGroup[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  // 'back' (generic) is intentionally omitted -- the finer lats/traps/lower_back
  // groups represent it, so a play covering those should not read as missing back.
  pull: ['lats', 'traps', 'lower_back', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  core: ['core'],
  full: [],
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}
function workingSets(ex: Exercise): SetLike[] {
  return ex.sets.filter((s) => setTypeOf(s) !== 'warmup');
}
type SetLike = Exercise['sets'][number];

/** A workout's day signature: the user's own name, else its inferred day-type. */
function dayKey(w: Workout): { key: string; name: string | null; dayType: TrainingDay | null } {
  const named = (w.dayName ?? '').trim();
  const dt = workoutDayType(w);
  if (named) return { key: `name:${named.toLowerCase()}`, name: named, dayType: dt };
  if (dt) return { key: `type:${dt}`, name: null, dayType: dt };
  return { key: 'type:other', name: null, dayType: null };
}

function workoutDayType(w: Workout): TrainingDay | null {
  // Dominant training day by working-set volume -- robust for ANY session,
  // including single-muscle days that describeDay would tag 'muscle' not 'split'
  // (e.g. a lats-heavy pull day). Maps each primary muscle to its push/pull/legs
  // bucket and picks the bucket with the most sets.
  const byDay = new Map<TrainingDay, number>();
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const d = exerciseDay(resolveMuscles(e).primary);
    if (!d) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + Math.max(1, workingSets(e).length));
  }
  let best: TrainingDay | null = null;
  let bestN = 0;
  for (const [d, n] of byDay) {
    if (n > bestN) {
      bestN = n;
      best = d;
    }
  }
  return best;
}

function readoutDayType(readout: DayReadout | null): TrainingDay | null {
  if (!readout) return null;
  if (readout.kind === 'split') return readout.split;
  if (readout.kind === 'full') return 'full';
  return null;
}

export function computePlaybook(finished: Workout[], now: number): PlaybookResult {
  const done = finished
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
  const ready = done.length >= MIN_SESSIONS;

  // Global per-exercise stats — for the representative top weight and the
  // "favourite lift" suggestion (frequency across the whole history).
  const globalTop = new Map<string, number>(); // recent best working top weight
  const globalSessions = new Map<string, number>();
  const globalPrimary = new Map<string, MuscleGroup | null>();
  for (const w of done) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const name = e.name.trim();
      if (!name) continue;
      globalSessions.set(name, (globalSessions.get(name) ?? 0) + 1);
      if (!globalPrimary.has(name)) globalPrimary.set(name, resolveMuscles(e).primary);
      if ((now - w.startedAt) / DAY <= WEIGHT_WINDOW_DAYS) {
        let tw = 0;
        for (const s of workingSets(e)) tw = Math.max(tw, setTopWeight(s));
        globalTop.set(name, Math.max(tw, globalTop.get(name) ?? 0));
      }
    }
  }

  // Cluster sessions by day signature.
  const clusters = new Map<
    string,
    { name: string | null; dayType: TrainingDay | null; workouts: Workout[] }
  >();
  for (const w of done) {
    const { key, name, dayType } = dayKey(w);
    let c = clusters.get(key);
    if (!c) {
      c = { name, dayType, workouts: [] };
      clusters.set(key, c);
    }
    // Prefer a concrete name/day-type if the first session lacked one.
    if (!c.name && name) c.name = name;
    if (!c.dayType && dayType) c.dayType = dayType;
    c.workouts.push(w);
  }

  const plays: Play[] = [];
  for (const [key, c] of clusters) {
    if (c.workouts.length < MIN_SESSIONS) continue;
    const play = synthesize(key, c, globalTop, globalSessions, globalPrimary, now);
    if (play && play.exercises.length > 0) plays.push(play);
  }
  // Most recently trained day first — that's what you're most likely to run.
  plays.sort((a, b) => b.lastTrainedAt - a.lastTrainedAt);

  // Recent, deduped by day — an exact one-tap replay next to the ideal plays.
  const recent: Workout[] = [];
  const seen = new Set<string>();
  for (const w of done) {
    const { key } = dayKey(w);
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(w);
    if (recent.length >= 6) break;
  }

  return { ready, plays, recent };
}

function synthesize(
  key: string,
  c: { name: string | null; dayType: TrainingDay | null; workouts: Workout[] },
  globalTop: Map<string, number>,
  globalSessions: Map<string, number>,
  globalPrimary: Map<string, MuscleGroup | null>,
  now: number,
): Play | null {
  const sessions = c.workouts.length;
  // Aggregate per-exercise occurrences across the cluster's sessions.
  interface Agg {
    name: string;
    kind: 'strength' | 'cardio';
    sessionCount: number;
    positions: number[];
    setCounts: number[];
    reps: number[];
    lastEx: Exercise;
    primary: MuscleGroup | null;
    secondary: MuscleGroup[];
  }
  const byName = new Map<string, Agg>();
  for (const w of c.workouts) {
    const perSession = new Set<string>();
    const ordered = [...w.exercises].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    ordered.forEach((e, idx) => {
      if (!isStrengthExercise(e)) return;
      const name = e.name.trim();
      if (!name) return;
      const ws = workingSets(e);
      let a = byName.get(name);
      if (!a) {
        const rm = resolveMuscles(e);
        a = {
          name,
          kind: 'strength',
          sessionCount: 0,
          positions: [],
          setCounts: [],
          reps: [],
          lastEx: e,
          primary: rm.primary,
          secondary: rm.secondary,
        };
        byName.set(name, a);
      }
      if (!perSession.has(name)) {
        a.sessionCount += 1;
        perSession.add(name);
      }
      a.positions.push(e.position ?? idx);
      a.setCounts.push(Math.max(1, ws.length));
      for (const s of ws) if (s.reps > 0) a.reps.push(s.reps);
      // Keep the most recent occurrence's muscle resolution.
      a.lastEx = e;
      const rm = resolveMuscles(e);
      a.primary = rm.primary;
      a.secondary = rm.secondary;
    });
  }

  const core: PlayExercise[] = [];
  for (const a of byName.values()) {
    const frequency = a.sessionCount / sessions;
    if (frequency < CORE_FREQ) continue;
    const sortedReps = [...a.reps].sort((x, y) => x - y);
    const repLow = a.reps.length ? Math.round(percentile(sortedReps, 25)) : 0;
    const repHigh = a.reps.length ? Math.round(percentile(sortedReps, 75)) : 0;
    const tw = globalTop.get(a.name) ?? 0;
    core.push({
      name: a.name,
      kind: a.kind,
      sets: Math.max(1, Math.round(median(a.setCounts))),
      repLow: Math.min(repLow, repHigh),
      repHigh: Math.max(repLow, repHigh),
      topWeight: tw > 0 ? tw : null,
      frequency,
      staple: frequency >= STAPLE_FREQ,
      primary: a.primary,
      secondary: a.secondary,
    });
  }
  if (core.length === 0) return null;

  // Order by typical position in the session.
  const posOf = new Map<string, number>();
  for (const a of byName.values()) posOf.set(a.name, median(a.positions));
  core.sort((x, y) => (posOf.get(x.name) ?? 0) - (posOf.get(y.name) ?? 0));

  // Coverage — fractional set counting over the synthesized play.
  const primaryTone = new Map<MuscleGroup, boolean>();
  const cover = new Map<MuscleGroup, number>();
  for (const ex of core) {
    if (ex.primary) {
      cover.set(ex.primary, (cover.get(ex.primary) ?? 0) + ex.sets);
      primaryTone.set(ex.primary, true);
    }
    for (const sm of ex.secondary) {
      if (sm === ex.primary) continue;
      cover.set(sm, (cover.get(sm) ?? 0) + ex.sets * 0.5);
      if (!primaryTone.has(sm)) primaryTone.set(sm, false);
    }
  }
  const coverage: CoverageEntry[] = [...cover.entries()]
    .map(([muscle, sets]) => ({ muscle, sets, primary: primaryTone.get(muscle) ?? false }))
    .filter((e) => e.sets > 0)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.sets - a.sets);

  const readout = describeDay(
    coverage
      .filter((e) => e.primary)
      .map((e) => [e.muscle, Math.round(e.sets)] as [MuscleGroup, number]),
  );
  const dayType = c.dayType ?? readoutDayType(readout);

  const lastTrainedAt = Math.max(...c.workouts.map((w) => w.startedAt));
  const sampleWorkoutId = c.workouts.reduce((a, b) => (b.startedAt > a.startedAt ? b : a)).id;

  const suggestions = buildSuggestions(
    core,
    coverage,
    dayType,
    globalSessions,
    globalPrimary,
    globalTop,
    c.workouts,
    now,
  );

  return {
    id: key,
    name: c.name,
    readout,
    dayType,
    sessions,
    lastTrainedAt,
    exercises: core,
    coverage,
    suggestions,
    sampleWorkoutId,
  };
}

function buildSuggestions(
  core: PlayExercise[],
  coverage: CoverageEntry[],
  dayType: TrainingDay | null,
  globalSessions: Map<string, number>,
  globalPrimary: Map<string, MuscleGroup | null>,
  globalTop: Map<string, number>,
  workouts: Workout[],
  now: number,
): PlaySuggestion[] {
  const out: PlaySuggestion[] = [];
  const inPlay = new Set(core.map((e) => e.name.toLowerCase()));
  const covered = new Set(coverage.filter((c) => c.sets >= 1).map((c) => c.muscle));

  // GAP — a muscle this day-type usually trains that the play barely touches.
  if (dayType && DAY_MUSCLES[dayType]?.length) {
    const gap = DAY_MUSCLES[dayType].find((m) => !covered.has(m));
    if (gap) out.push({ kind: 'add', reason: 'gap', muscle: gap });
  }

  // FAVOURITE — a lift you do often (globally) for this day-type but not here.
  if (dayType) {
    let best: { name: string; n: number; muscle: MuscleGroup | null } | null = null;
    for (const [name, n] of globalSessions) {
      if (n < FAVORITE_MIN_SESSIONS || inPlay.has(name.toLowerCase())) continue;
      const primary = globalPrimary.get(name) ?? null;
      if (!primary || primary === 'cardio') continue;
      if (DAY_MUSCLES[dayType].includes(primary) && (!best || n > best.n))
        best = { name, n, muscle: primary };
    }
    if (best)
      out.push({ kind: 'add', reason: 'favorite', exercise: best.name, muscle: best.muscle });
  }

  // PLATEAU — a core lift whose recent top hasn't beaten its earlier best.
  {
    const bestBand = (name: string, from: number, to: number): number => {
      let b = 0;
      for (const w of workouts) {
        const age = (now - w.startedAt) / DAY;
        if (age <= from || age > to) continue;
        for (const e of w.exercises) {
          if (!isStrengthExercise(e) || e.name.trim() !== name) continue;
          for (const s of e.sets) if (setTypeOf(s) !== 'warmup') b = Math.max(b, setTopWeight(s));
        }
      }
      return b;
    };
    for (const ex of core) {
      if (!ex.staple || ex.topWeight == null) continue;
      const recent = bestBand(ex.name, 0, 45);
      const prior = bestBand(ex.name, 45, 150);
      if (recent > 0 && prior > 0 && recent <= prior) {
        out.push({ kind: 'swap', reason: 'plateau', exercise: ex.name });
        break;
      }
    }
  }

  return out.slice(0, 3);
}
