/**
 * Challenges — self-started, long-horizon training goals you can chip away at
 * for weeks, months, even years. Everything here is DERIVED and LOCAL: the
 * catalog is generated from a handful of families (so there are a great many
 * distinct, practical challenges without a wall of hand-written translations —
 * titles are built from a few i18n templates with the numbers filled in), and
 * an active challenge's progress is computed from training history, never
 * written to the server. Starting one is a manual, deliberate act; progress
 * then tracks itself.
 *
 * Two moving parts:
 *   • CATALOG — ChallengeTemplate[]: the menu you start from. Pure data + text
 *     builders. Each has a metric (how it's measured), a default target and a
 *     range the start-sheet stepper can nudge, and duration options.
 *   • ACTIVE — ActiveChallenge[]: what you've started, in localStorage. A tiny
 *     reactive store (mirrors store.ts) so views re-render on start/give-up.
 */
import { useSyncExternalStore } from 'react';
import {
  useStore,
  isStrengthExercise,
  setTypeOf,
  setRepsTotal,
  exerciseVolumeKg,
  muscleSetsInWorkout,
  dayKey,
  latestWeight,
  restDayKeys,
  topSet,
  setTopWeight,
  uuid,
} from './store';
import { computeStandards } from './standards';
import {
  VOLUME_ZONES,
  VOLUME_MUSCLES,
  LANDMARKS,
  classifyZone,
  weeklyMuscleSets,
  scaleLandmark,
} from './volume';
import { activityCategory, activityCalories, durationMin, workoutCalories } from './activities';
import type { MuscleGroup } from './data/exercises';
import type { Workout, Activity, SetEntry } from './types';
import type { useT } from './i18n';

type T = ReturnType<typeof useT>['t'];

const DAY = 24 * 3600 * 1000;

// --- Categories, units, accents ---------------------------------------------

export type ChallengeCategory =
  | 'volume'
  | 'consistency'
  | 'strength'
  | 'streak'
  | 'endurance'
  | 'balance'
  | 'milestone'
  | 'bodyweight';

export const CHALLENGE_CATEGORIES: ChallengeCategory[] = [
  'volume',
  'consistency',
  'strength',
  'streak',
  'endurance',
  'balance',
  'milestone',
  'bodyweight',
];

export type ChallengeUnit =
  'sets' | 'reps' | 'sessions' | 'days' | 'weeks' | 'km' | 'min' | 'kcal' | 'prs' | 'kg';

/** Icon tint bucket — mapped to CSS in the view. */
export type Accent = 'brass' | 'ok' | 'blue';

// --- Metric: how a challenge measures progress ------------------------------

/**
 * A challenge is either CUMULATIVE (count something up to the target before the
 * clock runs out) or a REACH goal (hit a level — a lift, a streak — at any
 * point in the window). The metric's `kind` selects the reducer in
 * `challengeValue`.
 */
export type Metric =
  | { kind: 'zoneSets'; zone: string } // fractional hard sets for a volume zone
  | { kind: 'totalSets' } // all working sets, any muscle
  | { kind: 'sessions' } // finished workouts
  | { kind: 'trainingDays' } // distinct days trained
  | { kind: 'tonnage' } // total kg moved
  | { kind: 'reps'; match?: string } // total reps (optionally one movement)
  | { kind: 'prs' } // personal records set
  | { kind: 'strength'; discipline: string } // reach an est-1RM (reach)
  | { kind: 'streak' } // consecutive-day streak (reach)
  | { kind: 'balance' } // weeks with every muscle productive
  | { kind: 'distance'; activity: string } // km of one activity
  | { kind: 'minutes' } // conditioning minutes
  | { kind: 'activityCount'; activity?: string } // number of activities
  | { kind: 'calories' }; // kcal burned (lifting + cardio)

const REACH_KINDS = new Set<Metric['kind']>(['strength', 'streak', 'balance']);

// --- Template (a catalog entry) ---------------------------------------------

export interface ChallengeTemplate {
  id: string;
  category: ChallengeCategory;
  icon: string;
  accent: Accent;
  metric: Metric;
  unit: ChallengeUnit;
  /** Default target and the range the start-sheet stepper can move it in. */
  target: number;
  min: number;
  max: number;
  step: number;
  /** Duration choices in days (the segmented control); first is the default. */
  durations: number[];
  /** Localized concrete title, e.g. "100 leg sets". */
  title: (t: T, target: number) => string;
  /** Longer explanation for the start sheet + detail. */
  blurb: (t: T) => string;
  /** English search terms (matched alongside the localized title). */
  keywords: string;
}

export function isReach(m: Metric): boolean {
  return REACH_KINDS.has(m.kind);
}

// --- The catalog ------------------------------------------------------------

/** Volume zones as start-sheet challenges (per coarse muscle group). */
const VOL_PRESETS: { zone: string; target: number; max: number }[] = [
  { zone: 'chest', target: 120, max: 600 },
  { zone: 'back', target: 150, max: 800 },
  { zone: 'shoulders', target: 100, max: 600 },
  { zone: 'arms', target: 120, max: 600 },
  { zone: 'legs', target: 150, max: 800 },
  { zone: 'core', target: 80, max: 500 },
];

const STRENGTH_PRESETS: { discipline: string; target: number; min: number; max: number }[] = [
  { discipline: 'bench', target: 100, min: 40, max: 300 },
  { discipline: 'squat', target: 140, min: 50, max: 400 },
  { discipline: 'deadlift', target: 180, min: 60, max: 450 },
  { discipline: 'ohp', target: 60, min: 25, max: 180 },
  { discipline: 'row', target: 100, min: 40, max: 260 },
];

const CARDIO_DISTANCE: { activity: string; target: number; max: number; icon: string }[] = [
  { activity: 'run', target: 50, max: 2000, icon: 'person-simple-run' },
  { activity: 'cycle', target: 200, max: 5000, icon: 'bicycle' },
  { activity: 'swim', target: 20, max: 500, icon: 'person-simple-swim' },
  { activity: 'walk', target: 100, max: 3000, icon: 'person-simple-walk' },
  { activity: 'row', target: 40, max: 1000, icon: 'wave-sine' },
];

/** Bodyweight rep grinds — matched loosely by exercise name. */
const BODYWEIGHT: { key: string; match: string; target: number; max: number }[] = [
  { key: 'pullup', match: 'pull up|pull-up|pullup|chin up|chin-up', target: 500, max: 20000 },
  { key: 'pushup', match: 'push up|push-up|pushup', target: 1000, max: 50000 },
  { key: 'dip', match: 'dip', target: 500, max: 20000 },
  { key: 'squat', match: 'bodyweight squat|air squat|pistol', target: 1000, max: 50000 },
];

const CONS_WEEKS = [4, 8, 12];

function catalog(): ChallengeTemplate[] {
  const out: ChallengeTemplate[] = [];
  const zoneName = (t: T, z: string) => (t.volZoneNames as Record<string, string>)[z] ?? z;

  // — Volume — hard sets per muscle group, over a block.
  for (const p of VOL_PRESETS) {
    out.push({
      id: `vol:${p.zone}`,
      category: 'volume',
      icon: 'stack',
      accent: 'brass',
      metric: { kind: 'zoneSets', zone: p.zone },
      unit: 'sets',
      target: p.target,
      min: 40,
      max: p.max,
      step: 10,
      durations: [30, 14, 42, 90],
      title: (t, n) => t.chVolTitle(zoneName(t, p.zone), n),
      blurb: (t) => t.chVolBlurb(zoneName(t, p.zone)),
      keywords: `volume sets ${p.zone} hypertrophy hard sets`,
    });
  }

  // — Total sets milestones (any muscle) —
  out.push({
    id: 'sets:total',
    category: 'volume',
    icon: 'stack',
    accent: 'brass',
    metric: { kind: 'totalSets' },
    unit: 'sets',
    target: 500,
    min: 100,
    max: 20000,
    step: 50,
    durations: [30, 90, 180, 365],
    title: (t, n) => t.chSetsTitle(n),
    blurb: (t) => t.chSetsBlurb(),
    keywords: 'total sets working sets volume milestone',
  });

  // — Sessions logged —
  out.push({
    id: 'sessions',
    category: 'milestone',
    icon: 'medal',
    accent: 'brass',
    metric: { kind: 'sessions' },
    unit: 'sessions',
    target: 50,
    min: 10,
    max: 2000,
    step: 5,
    durations: [90, 180, 365, 730],
    title: (t, n) => t.chSessionsTitle(n),
    blurb: (t) => t.chSessionsBlurb(),
    keywords: 'sessions workouts count milestone consistency',
  });

  // — Tonnage (total kg moved) —
  out.push({
    id: 'tonnage',
    category: 'milestone',
    icon: 'barbell',
    accent: 'brass',
    metric: { kind: 'tonnage' },
    unit: 'kg',
    target: 100000,
    min: 10000,
    max: 5000000,
    step: 10000,
    durations: [90, 180, 365, 730],
    title: (t, n) => t.chTonnageTitle(n / 1000),
    blurb: (t) => t.chTonnageBlurb(),
    keywords: 'tonnage total weight kg tonnes moved lifted milestone',
  });

  // — Total reps —
  out.push({
    id: 'reps:total',
    category: 'milestone',
    icon: 'chart-line-up',
    accent: 'brass',
    metric: { kind: 'reps' },
    unit: 'reps',
    target: 5000,
    min: 500,
    max: 200000,
    step: 250,
    durations: [30, 90, 180, 365],
    title: (t, n) => t.chRepsTitle(n),
    blurb: (t) => t.chRepsBlurb(),
    keywords: 'reps total repetitions milestone',
  });

  // — Personal records set —
  out.push({
    id: 'prs',
    category: 'strength',
    icon: 'trophy',
    accent: 'brass',
    metric: { kind: 'prs' },
    unit: 'prs',
    target: 10,
    min: 3,
    max: 200,
    step: 1,
    durations: [90, 180, 365],
    title: (t, n) => t.chPrsTitle(n),
    blurb: (t) => t.chPrsBlurb(),
    keywords: 'pr personal record strength progress',
  });

  // — Strength: reach an est-1RM on a big lift —
  for (const p of STRENGTH_PRESETS) {
    out.push({
      id: `strength:${p.discipline}`,
      category: 'strength',
      icon: 'barbell',
      accent: 'brass',
      metric: { kind: 'strength', discipline: p.discipline },
      unit: 'kg',
      target: p.target,
      min: p.min,
      max: p.max,
      step: 2.5,
      durations: [90, 180, 365],
      title: (t, n) => t.chStrengthTitle(liftName(t, p.discipline), n),
      blurb: (t) => t.chStrengthBlurb(liftName(t, p.discipline)),
      keywords: `strength ${p.discipline} one rep max 1rm goal reach`,
    });
  }

  // — Streaks — consecutive training days —
  for (const n of [7, 14, 30, 50, 100, 365]) {
    out.push({
      id: `streak:${n}`,
      category: 'streak',
      icon: 'fire',
      accent: 'brass',
      metric: { kind: 'streak' },
      unit: 'days',
      target: n,
      min: n,
      max: n,
      step: 1,
      durations: [n + Math.max(3, Math.round(n * 0.25))],
      title: (t, x) => t.chStreakTitle(x),
      blurb: (t) => t.chStreakBlurb(),
      keywords: 'streak consecutive days consistency daily',
    });
  }

  // — Consistency — train N×/week for M weeks —
  for (const per of [3, 4, 5]) {
    for (const weeks of CONS_WEEKS) {
      out.push({
        id: `cons:${per}:${weeks}`,
        category: 'consistency',
        icon: 'calendar-check',
        accent: 'ok',
        metric: { kind: 'trainingDays' },
        unit: 'days',
        target: per * weeks,
        min: per * weeks,
        max: per * weeks,
        step: 1,
        durations: [weeks * 7],
        title: (t) => t.chConsistencyTitle(per, weeks),
        blurb: (t) => t.chConsistencyBlurb(per),
        keywords: `consistency ${per} per week ${weeks} weeks routine habit`,
      });
    }
  }

  // — Balance — weeks with every muscle in its productive range —
  for (const weeks of [1, 2, 4, 8]) {
    out.push({
      id: `balance:${weeks}`,
      category: 'balance',
      icon: 'scales',
      accent: 'ok',
      metric: { kind: 'balance' },
      unit: 'weeks',
      target: weeks,
      min: weeks,
      max: weeks,
      step: 1,
      durations: [weeks * 7],
      title: (t, x) => t.chBalanceTitle(x),
      blurb: (t) => t.chBalanceBlurb(),
      keywords: 'balance productive every muscle volume even coverage',
    });
  }

  // — Endurance — distance per activity —
  for (const p of CARDIO_DISTANCE) {
    out.push({
      id: `dist:${p.activity}`,
      category: 'endurance',
      icon: p.icon,
      accent: 'blue',
      metric: { kind: 'distance', activity: p.activity },
      unit: 'km',
      target: p.target,
      min: 5,
      max: p.max,
      step: 5,
      durations: [30, 90, 180, 365],
      title: (t, n) => t.chDistanceTitle(actName(t, p.activity), n),
      blurb: (t) => t.chDistanceBlurb(actName(t, p.activity)),
      keywords: `distance ${p.activity} cardio endurance km`,
    });
  }

  // — Endurance — conditioning minutes —
  out.push({
    id: 'cardio:min',
    category: 'endurance',
    icon: 'heartbeat',
    accent: 'blue',
    metric: { kind: 'minutes' },
    unit: 'min',
    target: 600,
    min: 60,
    max: 20000,
    step: 30,
    durations: [30, 90, 180, 365],
    title: (t, n) => t.chMinutesTitle(n),
    blurb: (t) => t.chMinutesBlurb(),
    keywords: 'cardio minutes conditioning time endurance',
  });

  // — Endurance — number of cardio sessions —
  out.push({
    id: 'cardio:count',
    category: 'endurance',
    icon: 'heartbeat',
    accent: 'blue',
    metric: { kind: 'activityCount' },
    unit: 'sessions',
    target: 25,
    min: 5,
    max: 1000,
    step: 5,
    durations: [30, 90, 180, 365],
    title: (t, n) => t.chActivityCountTitle(n),
    blurb: (t) => t.chActivityCountBlurb(),
    keywords: 'cardio sessions count conditioning endurance',
  });

  // — Calories burned —
  out.push({
    id: 'calories',
    category: 'endurance',
    icon: 'flame',
    accent: 'blue',
    metric: { kind: 'calories' },
    unit: 'kcal',
    target: 50000,
    min: 5000,
    max: 2000000,
    step: 5000,
    durations: [30, 90, 180, 365],
    title: (t, n) => t.chCaloriesTitle(n),
    blurb: (t) => t.chCaloriesBlurb(),
    keywords: 'calories energy burned kcal cardio lifting',
  });

  // — Bodyweight rep grinds —
  for (const p of BODYWEIGHT) {
    out.push({
      id: `bw:${p.key}`,
      category: 'bodyweight',
      icon: 'person-simple',
      accent: 'ok',
      metric: { kind: 'reps', match: p.match },
      unit: 'reps',
      target: p.target,
      min: 100,
      max: p.max,
      step: 50,
      durations: [30, 90, 180, 365],
      title: (t, n) => t.chBwTitle(bwName(t, p.key), n),
      blurb: (t) => t.chBwBlurb(bwName(t, p.key)),
      keywords: `bodyweight ${p.key} reps calisthenics grind`,
    });
  }

  return out;
}

function liftName(t: T, key: string): string {
  return (t.chLift as Record<string, string>)[key] ?? key;
}
function bwName(t: T, key: string): string {
  return (t.chBw as Record<string, string>)[key] ?? key;
}
function actName(t: T, key: string): string {
  return (t.actType as Record<string, string>)[key] ?? key;
}

let CATALOG_CACHE: ChallengeTemplate[] | null = null;
export function challengeCatalog(): ChallengeTemplate[] {
  if (!CATALOG_CACHE) CATALOG_CACHE = catalog();
  return CATALOG_CACHE;
}
export function templateById(id: string): ChallengeTemplate | undefined {
  return challengeCatalog().find((c) => c.id === id);
}

// --- Active challenges (reactive localStorage store) ------------------------

export interface ActiveChallenge {
  id: string;
  templateId: string;
  startedAt: number;
  endsAt: number;
  target: number;
  status: 'active' | 'done' | 'given-up';
  /** When it was completed (status flips to 'done'). */
  completedAt?: number | null;
  /** Whether the completion screen has been acknowledged. */
  celebrated?: boolean;
}

const CH_KEY = 'spotter.challenges';

function loadActive(): ActiveChallenge[] {
  try {
    const raw = localStorage.getItem(CH_KEY);
    return raw ? (JSON.parse(raw) as ActiveChallenge[]) : [];
  } catch {
    return [];
  }
}

let activeList: ActiveChallenge[] = loadActive();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(CH_KEY, JSON.stringify(activeList));
  } catch {
    /* private mode / quota — ignore */
  }
}
function emit(): void {
  listeners.forEach((l) => l());
}
function commit(next: ActiveChallenge[]): void {
  activeList = next;
  persist();
  emit();
}

/** Reactive: the list of started challenges. */
export function useChallenges(): ActiveChallenge[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => activeList,
  );
}

export function startChallenge(
  templateId: string,
  target: number,
  durationDays: number,
  now = Date.now(),
): ActiveChallenge {
  const ac: ActiveChallenge = {
    id: uuid(),
    templateId,
    startedAt: now,
    endsAt: now + durationDays * DAY,
    target,
    status: 'active',
    completedAt: null,
  };
  commit([ac, ...activeList]);
  return ac;
}

export function giveUpChallenge(id: string): void {
  commit(activeList.filter((c) => c.id !== id));
}

/** Persist a computed completion (idempotent). */
export function markChallengeDone(id: string, at: number): void {
  let changed = false;
  const next = activeList.map((c) => {
    if (c.id === id && c.status === 'active') {
      changed = true;
      return { ...c, status: 'done' as const, completedAt: at };
    }
    return c;
  });
  if (changed) commit(next);
}

export function markCelebrated(id: string): void {
  let changed = false;
  const next = activeList.map((c) => {
    if (c.id === id && !c.celebrated) {
      changed = true;
      return { ...c, celebrated: true };
    }
    return c;
  });
  if (changed) commit(next);
}

/** Already-started template ids (so the catalog can hide/curb duplicates). */
export function activeTemplateIds(list: ActiveChallenge[]): Set<string> {
  return new Set(list.filter((c) => c.status === 'active').map((c) => c.templateId));
}

// --- Progress ---------------------------------------------------------------

export interface DayCell {
  ts: number;
  /** 0..1 activity intensity for the shading. */
  intensity: number;
  state: 'past' | 'today' | 'future';
}

export interface ChallengeProgress {
  value: number;
  target: number;
  pct: number; // 0..1
  daysLeft: number; // whole days remaining (0 once ended)
  ended: boolean; // clock ran out
  done: boolean; // target reached
  perDayNeeded: number; // remaining / daysLeft, for the pace hint
  byDay: DayCell[]; // trailing strip for the detail view
}

interface Ctx {
  finished: Workout[];
  activities: Activity[];
  bodyKg: number;
  sex: 'M' | 'F';
  restDays: Set<number>;
  now: number;
}

/** A real (non-warm-up) set: working, drop, reverse-drop or static-dynamic. */
function isWorking(s: SetEntry): boolean {
  return setTypeOf(s) !== 'warmup';
}

/** Events (ts, amount) contributing to a cumulative metric, within [from, to]. */
function metricEvents(
  m: Metric,
  ctx: Ctx,
  from: number,
  to: number,
): { ts: number; amt: number }[] {
  const evs: { ts: number; amt: number }[] = [];
  const inWin = (ts: number) => ts >= from && ts <= to;

  const zoneMembers = (zoneKey: string): MuscleGroup[] =>
    VOLUME_ZONES.find((z) => z.key === zoneKey)?.members ?? [];

  switch (m.kind) {
    case 'zoneSets': {
      const members = zoneMembers(m.zone);
      for (const w of ctx.finished) {
        if (!inWin(w.startedAt)) continue;
        const per = muscleSetsInWorkout(w);
        let amt = 0;
        for (const mm of members) amt += per.get(mm) ?? 0;
        if (amt > 0) evs.push({ ts: w.startedAt, amt });
      }
      break;
    }
    case 'totalSets': {
      for (const w of ctx.finished) {
        if (!inWin(w.startedAt)) continue;
        let amt = 0;
        for (const ex of w.exercises) {
          if (!isStrengthExercise(ex)) continue;
          for (const s of ex.sets) if (isWorking(s)) amt += 1;
        }
        if (amt > 0) evs.push({ ts: w.startedAt, amt });
      }
      break;
    }
    case 'sessions': {
      for (const w of ctx.finished) if (inWin(w.startedAt)) evs.push({ ts: w.startedAt, amt: 1 });
      break;
    }
    case 'tonnage': {
      for (const w of ctx.finished) {
        if (!inWin(w.startedAt)) continue;
        let amt = 0;
        for (const ex of w.exercises) if (isStrengthExercise(ex)) amt += exerciseVolumeKg(ex);
        if (amt > 0) evs.push({ ts: w.startedAt, amt });
      }
      break;
    }
    case 'reps': {
      const re = m.match ? new RegExp(m.match, 'i') : null;
      for (const w of ctx.finished) {
        if (!inWin(w.startedAt)) continue;
        let amt = 0;
        for (const ex of w.exercises) {
          if (!isStrengthExercise(ex)) continue;
          if (re && !re.test(ex.name)) continue;
          for (const s of ex.sets) if (isWorking(s)) amt += setRepsTotal(s);
        }
        if (amt > 0) evs.push({ ts: w.startedAt, amt });
      }
      break;
    }
    case 'prs': {
      for (const ev of prEvents(ctx.finished)) if (inWin(ev.ts)) evs.push({ ts: ev.ts, amt: 1 });
      break;
    }
    case 'distance': {
      for (const a of ctx.activities) {
        if (a.type !== m.activity || a.finishedAt === null) continue;
        if (!inWin(a.startedAt)) continue;
        const km = a.distanceKm ?? 0;
        if (km > 0) evs.push({ ts: a.startedAt, amt: km });
      }
      break;
    }
    case 'minutes': {
      for (const a of ctx.activities) {
        if (a.finishedAt === null || activityCategory(a) !== 'conditioning') continue;
        if (!inWin(a.startedAt)) continue;
        const min = durationMin(a);
        if (min > 0) evs.push({ ts: a.startedAt, amt: min });
      }
      break;
    }
    case 'activityCount': {
      for (const a of ctx.activities) {
        if (a.finishedAt === null) continue;
        if (m.activity ? a.type !== m.activity : activityCategory(a) !== 'conditioning') continue;
        if (inWin(a.startedAt)) evs.push({ ts: a.startedAt, amt: 1 });
      }
      break;
    }
    case 'calories': {
      for (const w of ctx.finished) {
        if (!inWin(w.startedAt)) continue;
        const kcal = workoutCalories(w, ctx.bodyKg) ?? 0;
        if (kcal > 0) evs.push({ ts: w.startedAt, amt: kcal });
      }
      for (const a of ctx.activities) {
        if (a.finishedAt === null || !inWin(a.startedAt)) continue;
        const kcal = activityCalories(a, ctx.bodyKg) ?? 0;
        if (kcal > 0) evs.push({ ts: a.startedAt, amt: kcal });
      }
      break;
    }
    default:
      break;
  }
  return evs;
}

/** Chronological PR events (a session that beat the prior top-set best). */
function prEvents(finished: Workout[]): { ts: number }[] {
  const chron = [...finished].sort((a, b) => a.startedAt - b.startedAt);
  const best = new Map<string, number>();
  const out: { ts: number }[] = [];
  for (const w of chron) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const top = topSet(ex.sets);
      if (!top) continue;
      const wgt = setTopWeight(top);
      if (wgt <= 0) continue;
      const key = ex.name.toLowerCase();
      const prev = best.get(key) ?? 0;
      if (wgt > prev) {
        if (prev > 0) out.push({ ts: top.loggedAt ?? w.finishedAt ?? w.startedAt });
        best.set(key, wgt);
      }
    }
  }
  return out;
}

/** Distinct day-keys with a finished workout or a conditioning activity. */
function activeDays(ctx: Ctx, from: number, to: number): Set<number> {
  const days = new Set<number>();
  for (const w of ctx.finished)
    if (w.startedAt >= from && w.startedAt <= to) days.add(dayKey(w.startedAt));
  for (const a of ctx.activities)
    if (a.finishedAt !== null && a.startedAt >= from && a.startedAt <= to)
      days.add(dayKey(a.startedAt));
  return days;
}

/** Streak (consecutive active-or-rest days) ending today, bounded to the window.
 *  Day-keys are consecutive integers (one per local calendar day), so the walk
 *  never needs to reconstruct timestamps. */
function streakInWindow(ctx: Ctx, startDay: number, todayDay: number): number {
  const active = activeDays(ctx, 0, ctx.now + DAY);
  let count = 0;
  for (let d = todayDay; d >= startDay; d--) {
    if (active.has(d) || ctx.restDays.has(d)) count++;
    else break;
  }
  return count;
}

/** Count of completed 7-day blocks (since start) with every muscle productive+. */
function balanceWeeks(ctx: Ctx, startedAt: number, endsAt: number): number {
  const end = Math.min(ctx.now, endsAt);
  let weeks = 0;
  for (let blockEnd = startedAt + 7 * DAY; blockEnd <= end + 1; blockEnd += 7 * DAY) {
    const per = weeklyMuscleSets(ctx.finished, blockEnd, 7);
    const ok = VOLUME_MUSCLES.every((mm) => {
      const lm = LANDMARKS[mm];
      if (!lm) return true;
      const z = classifyZone(per.get(mm) ?? 0, scaleLandmark(lm, 1));
      return z === 'productive' || z === 'high' || z === 'over';
    });
    if (ok) weeks++;
  }
  return weeks;
}

/** Best est-1RM reached on a discipline (lifetime — a reach goal). */
function strengthBest(ctx: Ctx, discipline: string): number {
  const r = computeStandards(ctx.finished, ctx.bodyKg, ctx.sex).results.find(
    (x) => x.key === discipline,
  );
  return r && r.trained ? r.best : 0;
}

/** Full progress read for one active challenge. */
export function challengeProgress(
  ac: ActiveChallenge,
  tmpl: ChallengeTemplate,
  ctx: Ctx,
): ChallengeProgress {
  const cap = Math.min(ctx.now, ac.endsAt);
  let value = 0;

  if (tmpl.metric.kind === 'streak') {
    value = streakInWindow(ctx, dayKey(ac.startedAt), dayKey(cap));
  } else if (tmpl.metric.kind === 'balance') {
    value = balanceWeeks(ctx, ac.startedAt, ac.endsAt);
  } else if (tmpl.metric.kind === 'strength') {
    value = strengthBest(ctx, tmpl.metric.discipline);
  } else if (tmpl.metric.kind === 'trainingDays') {
    value = activeDays(ctx, ac.startedAt, cap).size;
  } else {
    for (const ev of metricEvents(tmpl.metric, ctx, ac.startedAt, cap)) value += ev.amt;
  }

  const target = ac.target;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const done = value >= target;
  const ended = ctx.now >= ac.endsAt;
  const daysLeft = Math.max(0, Math.ceil((ac.endsAt - ctx.now) / DAY));
  const remaining = Math.max(0, target - value);
  const perDayNeeded = daysLeft > 0 ? remaining / daysLeft : remaining;

  return {
    value,
    target,
    pct,
    daysLeft,
    ended,
    done,
    perDayNeeded,
    byDay: buildByDay(ac, tmpl, ctx),
  };
}

/** Trailing day strip (up to 28 days) for the detail view's BY DAY grid. */
function buildByDay(ac: ActiveChallenge, tmpl: ChallengeTemplate, ctx: Ctx): DayCell[] {
  const span = Math.min(28, Math.max(7, Math.round((ac.endsAt - ac.startedAt) / DAY)));
  const todayDay = dayKey(ctx.now);
  const startDay = dayKey(ac.startedAt);
  const endDay = dayKey(ac.endsAt);
  // Window ends at the challenge end (so upcoming days show as 'future').
  const lastDay = Math.max(todayDay, Math.min(endDay, startDay + span - 1));
  const firstDay = lastDay - span + 1;

  // Per-day contribution (for cumulative metrics) or active-day flag otherwise.
  const perDay = new Map<number, number>();
  if (!isReach(tmpl.metric) && tmpl.metric.kind !== 'trainingDays') {
    for (const ev of metricEvents(tmpl.metric, ctx, ac.startedAt, ac.endsAt))
      perDay.set(dayKey(ev.ts), (perDay.get(dayKey(ev.ts)) ?? 0) + ev.amt);
  } else {
    for (const d of activeDays(ctx, ac.startedAt, ac.endsAt)) perDay.set(d, 1);
  }
  // Normalise intensity against a healthy daily pace.
  const norm = Math.max(
    1,
    perDay.size ? Math.max(...perDay.values()) : 1,
    ac.target / Math.max(1, (ac.endsAt - ac.startedAt) / DAY),
  );

  const cells: DayCell[] = [];
  for (let d = firstDay; d <= lastDay; d++) {
    const v = perDay.get(d) ?? 0;
    const state: DayCell['state'] = d > todayDay ? 'future' : d === todayDay ? 'today' : 'past';
    cells.push({ ts: d * DAY, intensity: Math.min(1, v / norm), state });
  }
  return cells;
}

/** Build the shared context once (progress for many challenges reuses it). */
export function challengeCtx(store: ReturnType<typeof useStore>, now: number): Ctx {
  return {
    finished: store.workouts.filter((w) => w.finishedAt !== null),
    activities: store.activities ?? [],
    bodyKg: latestWeight(store.bodyMetrics)?.weight ?? 0,
    sex: store.bodyMetrics.sex === 'female' ? 'F' : 'M',
    restDays: restDayKeys(store.restPeriods),
    now,
  };
}

// --- Formatting helpers -----------------------------------------------------

/** Format a target/value in its unit for compact display. */
export function fmtChallengeValue(unit: ChallengeUnit, v: number, t: T): string {
  switch (unit) {
    case 'kg':
      return v >= 10000 ? t.chTonnesShort(Math.round((v / 1000) * 10) / 10) : `${Math.round(v)} kg`;
    case 'km':
      return `${Math.round(v)} km`;
    case 'min':
      return `${Math.round(v)} ${t.chMinShort}`;
    case 'kcal':
      return `${Math.round(v).toLocaleString()} kcal`;
    default:
      return `${Math.round(v)}`;
  }
}

/** A localized duration label from a day count ("1 month", "2 weeks", "1 year"). */
export function fmtChallengeDuration(days: number, t: T): string {
  if (days % 365 === 0 && days >= 365) return t.chDurYears(days / 365);
  if (days >= 30 && days % 30 === 0) return t.chDurMonths(days / 30);
  if (days % 7 === 0) return t.chDurWeeks(days / 7);
  return t.chDurDays(days);
}
