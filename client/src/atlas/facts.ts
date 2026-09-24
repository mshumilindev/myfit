/**
 * What Atlas knows — pure functions from history to CoachFacts. No thresholds
 * tied to a person or a date: every fact is a comparison against the athlete's
 * own past (their best, their usual weekday, their planned rest).
 */
import type { BodyMetrics, SleepNight, Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';
import {
  dayKey,
  isStrengthExercise,
  restBeforeSetInWorkout,
  setTopWeight,
  setTypeOf,
  topSet,
} from '../store';
import { VOLUME_MUSCLES, weeklyMuscleSets } from '../volume';
import { finishedNights, nightDurationMin } from '../sleep';
import { playForWeekday, type Play } from '../playbook';
import type { CoachFact } from './types';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** A lift's top weight is "stuck" after this many sessions at the same number. */
export const STALL_SESSIONS = 3;
/** Rest counts as short when the median is under this share of the plan. */
export const SHORT_REST_SHARE = 0.75;
/** A muscle is behind when it gets under this share of the most-trained one. */
export const IMBALANCE_SHARE = 1 / 3;
/** A gap this long makes the next session a comeback. */
export const COMEBACK_DAYS = 10;
/** Below this, a night is short (adults need 7 h+; 6 h is the clear miss). */
export const SHORT_SLEEP_H = 6;
/** Bodyweight change worth a note, over ~30 days. */
export const BODYWEIGHT_NOTE_PCT = 2;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function workingSets(w: Workout) {
  return w.exercises.flatMap((e) => e.sets.filter((s) => setTypeOf(s) !== 'warmup'));
}

/** Top working weight of an exercise per earlier session, newest first. */
function priorTops(name: string, history: Workout[], before: number): number[] {
  return history
    .filter((w) => w.finishedAt !== null && w.startedAt < before)
    .sort((a, b) => b.startedAt - a.startedAt)
    .flatMap((w) => {
      const ex = w.exercises.find((e) => e.name === name);
      const top = ex ? topSet(ex.sets) : undefined;
      return top ? [setTopWeight(top)] : [];
    });
}

/** Facts about one finished session, measured against everything before it. */
export function sessionFacts(w: Workout, history: Workout[]): CoachFact[] {
  const at = w.finishedAt ?? w.startedAt;
  const sets = workingSets(w);
  const out: CoachFact[] = [
    {
      kind: 'session',
      id: `session:${w.id}`,
      at,
      workoutId: w.id,
      sets: sets.length,
      volumeKg: Math.round(sets.reduce((a, s) => a + (s.weight ?? 0) * s.reps, 0)),
      minutes: Math.max(0, Math.round((at - w.startedAt) / 60000)),
    },
  ];

  const gapDays = (() => {
    const prev = history
      .filter((x) => x.finishedAt !== null && x.id !== w.id && x.startedAt < w.startedAt)
      .reduce((m, x) => Math.max(m, x.startedAt), 0);
    return prev > 0 ? Math.floor((w.startedAt - prev) / DAY) : 0;
  })();
  if (gapDays >= COMEBACK_DAYS)
    out.push({ kind: 'comeback', id: `comeback:${w.id}`, at, daysOff: gapDays });

  for (const ex of w.exercises) {
    if (!isStrengthExercise(ex)) continue;
    const top = topSet(ex.sets);
    if (!top) continue;
    const weight = setTopWeight(top);
    if (weight <= 0) continue;
    const tops = priorTops(ex.name, history, w.startedAt);
    if (tops.length > 0 && weight > Math.max(...tops)) {
      out.push({
        kind: 'pr',
        id: `pr:${w.id}:${ex.name}`,
        at,
        exercise: ex.name,
        weight,
        reps: top.reps,
        prevWeight: Math.max(...tops),
      });
    } else if (
      // Reported once, when the stall begins — not again every session after.
      tops.length >= STALL_SESSIONS - 1 &&
      tops.slice(0, STALL_SESSIONS - 1).every((t) => t === weight) &&
      tops[STALL_SESSIONS - 1] !== weight
    ) {
      out.push({
        kind: 'stall',
        id: `stall:${w.id}:${ex.name}`,
        at,
        exercise: ex.name,
        weight,
        sessions: STALL_SESSIONS,
      });
    }

    // Rest vs the athlete's own plan for this lift (only where a plan existed).
    // restTargetSec sits on the set that ENDS a rest (the plan for the rest before it).
    const pairs = ex.sets
      .filter((s) => setTypeOf(s) !== 'warmup')
      .map((s) => ({ s, planned: s.restTargetSec ?? null }))
      .filter((p) => p.planned && p.planned > 0)
      .map((p) => ({ rest: restBeforeSetInWorkout(w, p.s), planned: p.planned as number }))
      .filter((p): p is { rest: number; planned: number } => p.rest !== null);
    if (pairs.length >= 2) {
      const rest = median(pairs.map((p) => p.rest));
      const planned = median(pairs.map((p) => p.planned));
      if (rest < planned * SHORT_REST_SHARE)
        out.push({
          kind: 'restShort',
          id: `rest:${w.id}:${ex.name}`,
          at,
          exercise: ex.name,
          restSec: Math.round(rest),
          targetSec: Math.round(planned),
        });
    }
  }
  return pickHighlights(out);
}

/** Per session: at most this many notes about individual lifts. */
export const MAX_LIFT_NOTES = 2;

/**
 * Keep a session's notes readable: the summary, a comeback, then the lifts
 * that matter most — records first (biggest jump), then the worst short rest,
 * then the heaviest stall.
 */
function pickHighlights(facts: CoachFact[]): CoachFact[] {
  const head = facts.filter((f) => f.kind === 'session' || f.kind === 'comeback');
  const prs = facts
    .filter((f): f is Extract<CoachFact, { kind: 'pr' }> => f.kind === 'pr')
    .sort((a, b) => b.weight / b.prevWeight - a.weight / a.prevWeight);
  const rests = facts
    .filter((f): f is Extract<CoachFact, { kind: 'restShort' }> => f.kind === 'restShort')
    .sort((a, b) => a.restSec / a.targetSec - b.restSec / b.targetSec);
  const stalls = facts
    .filter((f): f is Extract<CoachFact, { kind: 'stall' }> => f.kind === 'stall')
    .sort((a, b) => b.weight - a.weight);
  const lifts = [...prs, ...rests.slice(0, 1), ...stalls.slice(0, 1)].slice(0, MAX_LIFT_NOTES);
  return [...head, ...lifts];
}

export interface DayContext {
  finished: Workout[];
  plays: Play[];
  sleeps: SleepNight[];
  body: BodyMetrics | null | undefined;
  now: number;
}

/** Hour of day (local) the athlete usually starts on a weekday, from history. */
export function usualStartHour(finished: Workout[], dow: number): number | null {
  const hours = finished
    .filter((w) => new Date(w.startedAt).getDay() === dow)
    .map((w) => {
      const d = new Date(w.startedAt);
      return d.getHours() + d.getMinutes() / 60;
    });
  return hours.length >= 2 ? median(hours) : null;
}

/** Facts about today and the recent past (Today strip, pushes). */
const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function dayFacts(ctx: DayContext): CoachFact[] {
  const { finished, plays, sleeps, body, now } = ctx;
  const out: CoachFact[] = [];
  const today = dayKey(now);
  const dow = new Date(now).getDay();

  // Skipped: a day you reliably train, well past your usual start, nothing logged.
  const play = playForWeekday(plays, dow);
  const trainedToday = finished.some((w) => dayKey(w.startedAt) === today);
  const usual = usualStartHour(finished, dow);
  const hourNow = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  if (play && !trainedToday && usual !== null && hourNow >= usual + 2)
    out.push({
      kind: 'skipped',
      id: `skipped:${today}`,
      // A fixed moment (usual start + 2 h), not "now" — so it can be read.
      at: dayStart(now) + Math.round((usual + 2) * 3_600_000),
      dayName: play.name,
    });

  // Imbalance over the last week, among muscles you actually train.
  const trainedRecently = weeklyMuscleSets(finished, now, 28);
  const week = weeklyMuscleSets(finished, now, 7);
  const pool = VOLUME_MUSCLES.filter((m) => (trainedRecently.get(m) ?? 0) > 0);
  if (pool.length >= 2) {
    const ranked = pool
      .map((m) => [m, week.get(m) ?? 0] as [MuscleGroup, number])
      .sort((a, b) => b[1] - a[1]);
    const [high, highSets] = ranked[0];
    const [low, lowSets] = ranked[ranked.length - 1];
    if (highSets >= 9 && lowSets < highSets * IMBALANCE_SHARE)
      out.push({
        kind: 'imbalance',
        id: `imbalance:${Math.floor(now / WEEK)}:${low}:${high}`,
        // When it became true (your latest session), not "now" — a note whose
        // time moves with the clock could never be marked read.
        at: Math.max(
          Math.floor(now / WEEK) * WEEK,
          ...finished.map((w) => w.finishedAt ?? w.startedAt).filter((t) => t <= now),
        ),
        low,
        high,
        lowSets,
        highSets,
      });
  }

  // Last night's sleep.
  const night = finishedNights(sleeps, now)[0];
  if (night && now - (night.wake ?? 0) < 12 * 3600 * 1000) {
    const hours = Math.round((nightDurationMin(night, now) / 60) * 10) / 10;
    if (hours > 0 && hours < SHORT_SLEEP_H)
      out.push({ kind: 'shortSleep', id: `sleep:${night.id}`, at: night.wake ?? now, hours });
  }

  // Bodyweight over ~30 days — reported neutrally in every temper.
  const weights = [...(body?.weights ?? [])].sort((a, b) => b.at - a.at);
  if (weights.length >= 2) {
    const last = weights[0];
    const base = weights.find((x) => last.at - x.at >= 25 * DAY);
    if (base) {
      const deltaPct = Math.round(((last.weight - base.weight) / base.weight) * 1000) / 10;
      if (Math.abs(deltaPct) >= BODYWEIGHT_NOTE_PCT)
        out.push({
          kind: 'bodyweight',
          id: `bw:${last.id}`,
          at: last.at,
          kg: last.weight,
          deltaPct,
          days: Math.round((last.at - base.at) / DAY),
        });
    }
  }
  return out;
}

/** Sessions per week you usually do (median of the last 8 full weeks). */
export function usualSessionsPerWeek(finished: Workout[], now: number): number {
  const counts: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const end = now - (i - 1) * WEEK;
    const start = end - WEEK;
    counts.push(finished.filter((w) => w.startedAt >= start && w.startedAt < end).length);
  }
  return Math.round(median(counts.filter((c) => c > 0)));
}

/** The weekly review fact (Sunday). `planned` = the coach plan's days, else your usual. */
export function weekFact(finished: Workout[], now: number, planned?: number): CoachFact {
  const since = now - WEEK;
  const sessions = finished.filter((w) => w.startedAt >= since && w.startedAt <= now).length;
  return {
    kind: 'week',
    id: `week:${Math.floor(now / WEEK)}`,
    at: dayStart(now),
    sessions,
    planned: planned ?? usualSessionsPerWeek(finished, now - WEEK),
  };
}

/**
 * A comment on the set just logged (mid-session jab): rest cut well short of
 * the plan, or reps falling off a cliff at the same weight. Null = say nothing.
 */
export function setFact(p: {
  workoutId: string;
  setId: string;
  exercise: string;
  reps: number;
  weight: number | null;
  prev: { reps: number; weight: number | null } | null;
  restSec: number | null;
  restTargetSec: number | null;
  at: number;
}): CoachFact | null {
  if (p.restSec != null && p.restTargetSec && p.restSec < p.restTargetSec * SHORT_REST_SHARE)
    return {
      kind: 'restShort',
      id: `set-rest:${p.setId}`,
      at: p.at,
      exercise: p.exercise,
      restSec: Math.max(0, Math.round(p.restSec)),
      targetSec: p.restTargetSec,
    };
  if (p.prev && (p.prev.weight ?? 0) === (p.weight ?? 0) && p.reps <= p.prev.reps - 2)
    return {
      kind: 'setDrop',
      id: `set-drop:${p.setId}`,
      at: p.at,
      exercise: p.exercise,
      reps: p.reps,
      prevReps: p.prev.reps,
    };
  return null;
}
