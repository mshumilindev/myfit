/**
 * Atlas's programme (main-coach role): a block of weeks with fixed training
 * weekdays. Each weekday has a split; the actual lifts of the day are built on
 * the day by the session builder, so they follow recovery, injuries, the gym
 * and progression exactly like a hand-built day. Nothing is hardcoded to a
 * person: weekdays, day length and splits come from your own history when it
 * exists, and from a textbook split when it doesn't.
 */
import type { Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';
import { playForWeekday, type Play } from '../playbook';
import { NOVICE_SESSIONS, SPLIT_SLOTS, type SplitDay } from '../starterPlan';
import {
  buildDay,
  type BuildContext,
  type GeneratedDay,
  type SessionIntent,
} from '../sessionBuilder';
import { isCardioExerciseName } from '../data/exercises';
import { usualSessionsPerWeek } from './facts';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export const BLOCK_WEEKS = 6;
/** The last week of a block is lighter (a deload): sets × this share. */
export const DELOAD_SHARE = 0.6;

export interface CoachPlanDay {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  split: SplitDay;
  muscles: MuscleGroup[];
  /** Your own name for the day, when it comes from a playbook day. */
  name: string | null;
}

export interface CoachPlan {
  createdAt: number;
  /** Local midnight of the Monday the block started. */
  blockStart: number;
  weeks: number;
  days: CoachPlanDay[];
  lengthMin: number;
  /** Rep-range focus, read from how you actually train (median reps). */
  intent: SessionIntent;
  warmup: boolean;
  cardio: boolean;
  cooldown: boolean;
}

/** Textbook weekdays for N sessions (Mon-first, spread for recovery). */
const SPREAD: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};
/** Textbook splits for N sessions. */
const SPLITS: Record<number, SplitDay[]> = {
  1: ['full'],
  2: ['full', 'full'],
  3: ['full', 'full', 'full'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  7: ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'full'],
};

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mondayOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() + 6) % 7;
  return d.getTime() - back * DAY;
}

/** Weekdays you actually train, most frequent first (last 8 weeks). */
function habitualWeekdays(finished: Workout[], now: number, n: number): number[] {
  const counts = new Array(7).fill(0) as number[];
  for (const w of finished)
    if (now - w.startedAt < 8 * WEEK) counts[new Date(w.startedAt).getDay()]++;
  const ranked = [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => counts[d] >= 2)
    .sort((a, b) => counts[b] - counts[a]);
  return ranked.slice(0, n);
}

function splitFromMuscles(muscles: MuscleGroup[]): SplitDay {
  const set = new Set(muscles);
  let best: SplitDay = 'full';
  let bestScore = -1;
  for (const d of Object.keys(SPLIT_SLOTS) as SplitDay[]) {
    const slots = [...new Set(SPLIT_SLOTS[d])];
    const hit = slots.filter((m) => set.has(m)).length;
    const score = hit / slots.length - (set.size - hit) / Math.max(1, set.size) / 2;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export interface ProposeInput {
  finished: Workout[];
  plays: Play[];
  now: number;
  /** Override: sessions per week (else your usual, else 3). */
  daysPerWeek?: number;
  /** Override: weekdays (0 = Sunday). */
  weekdays?: number[];
  lengthMin?: number;
}

export function proposePlan(p: ProposeInput): CoachPlan {
  const { finished, plays, now } = p;
  const usual = usualSessionsPerWeek(finished, now);
  const n = Math.min(
    7,
    Math.max(1, p.weekdays?.length ?? p.daysPerWeek ?? (usual >= 2 ? usual : 3)),
  );
  const habit = habitualWeekdays(finished, now, n);
  const weekdays = (
    p.weekdays ?? (habit.length === n ? habit : [...new Set([...habit, ...SPREAD[n]])].slice(0, n))
  ).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

  const novice = finished.length < NOVICE_SESSIONS;
  const days: CoachPlanDay[] = weekdays.map((weekday, i) => {
    const play = novice ? null : playForWeekday(plays, weekday);
    if (play) {
      const muscles = [
        ...new Set(play.coverage.filter((c) => c.primary).map((c) => c.muscle)),
      ] as MuscleGroup[];
      if (muscles.length)
        return { weekday, split: splitFromMuscles(muscles), muscles, name: play.name };
    }
    const split = novice ? 'full' : SPLITS[n][i];
    return { weekday, split, muscles: [...new Set(SPLIT_SLOTS[split])], name: null };
  });

  const recent = finished.filter((w) => now - w.startedAt < 8 * WEEK && w.finishedAt);
  const lengths = recent.map((w) => ((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000);
  const lengthMin =
    p.lengthMin ?? (lengths.length >= 3 ? Math.round(median(lengths) / 15) * 15 || 60 : 60);
  const has = (pred: (name: string, kind?: string) => boolean) =>
    recent.filter((w) => w.exercises.some((e) => pred(e.name, e.kind))).length >= recent.length / 3;
  const reps = recent.flatMap((w) =>
    w.exercises.flatMap((e) => e.sets.filter((x) => !x.isWarmup && x.reps > 0).map((x) => x.reps)),
  );
  const mr = median(reps);
  const intent: SessionIntent =
    reps.length < 12 ? 'muscle' : mr <= 5 ? 'strength' : mr > 12 ? 'endurance' : 'muscle';
  return {
    intent,
    createdAt: now,
    blockStart: mondayOf(now),
    weeks: BLOCK_WEEKS,
    days,
    lengthMin: Math.min(120, Math.max(30, lengthMin)),
    warmup:
      recent.length === 0 || has((_, k) => k === 'warmup') || plays.some((x) => x.opensWithWarmup),
    cardio: recent.length > 0 && has((name, k) => k === 'cardio' || isCardioExerciseName(name)),
    cooldown: recent.length > 0 && has((_, k) => k === 'cooldown'),
  };
}

/** 1-based week of the block (> weeks = the block is over). */
export function blockWeek(plan: CoachPlan, now: number): number {
  return Math.floor((now - plan.blockStart) / WEEK) + 1;
}

export function isDeloadWeek(plan: CoachPlan, now: number): boolean {
  return blockWeek(plan, now) === plan.weeks;
}

/** The planned day for a date's weekday, if it is a training day. */
export function planDayFor(plan: CoachPlan, now: number): CoachPlanDay | null {
  const dow = new Date(now).getDay();
  return plan.days.find((d) => d.weekday === dow) ?? null;
}

/**
 * Build today's session from the plan with the regular session builder;
 * `ctx` supplies history, gym, injuries… A deload week trims the sets.
 */
export function buildPlanDay(
  plan: CoachPlan,
  day: CoachPlanDay,
  ctx: Omit<BuildContext, 'targetMuscles' | 'lengthMin' | 'warmup' | 'cardio' | 'cooldown'>,
): GeneratedDay {
  const built = buildDay({
    ...ctx,
    intent: plan.intent ?? ctx.intent,
    targetMuscles: day.muscles,
    lengthMin: plan.lengthMin,
    warmup: plan.warmup,
    cardio: plan.cardio,
    cooldown: plan.cooldown,
  });
  const named = day.name ? { ...built, dayName: day.name } : built;
  if (!isDeloadWeek(plan, ctx.now)) return named;
  return {
    ...named,
    main: named.main.map((e) => ({ ...e, sets: Math.max(1, Math.round(e.sets * DELOAD_SHARE)) })),
  };
}
