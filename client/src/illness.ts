/**
 * Illness → what to do about it. One pure module: everything that reacts to
 * "unwell" (Today card, Start warning, session coach, RPE, rest timer) reads
 * `illnessState`, never the raw periods.
 *
 * Two phases matter: SICK (an illness period covers today — rest up, the plan
 * waits) and RETURNING (the last illness ended; ease back in over a number of
 * sessions that depends on the kind and how long it lasted). `mental` (low
 * mood, burnout, anxiety) never asks to rest up or ramp: it goes by feel.
 *
 * The thresholds are general return-to-training orientation, not medical
 * advice: afebrile / no lower-body symptoms before training, ~48 h after the
 * last stomach symptom, ~72 h symptom-free plus a graded week after a systemic
 * virus (sources in docs/specs/unwell-return-plan.md). Tune them here only.
 */
import type { IllnessKind, RestPeriod, Workout } from './types';

export const ILLNESS_KINDS: IllnessKind[] = ['cold', 'virus', 'stomach', 'mental', 'other'];

const DAY_MS = 86_400_000;
/** The return plan lapses this many days after recovery even if not finished. */
export const RETURN_WINDOW_DAYS = 21;
/** Days out beyond which we suggest seeing a doctor. */
export const DOCTOR_HINT_DAYS = 28;

const dayOf = (ts: number): number => {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
};

/** How many sessions to ease back in over, by kind and days out. 0 = no ritual. */
export function returnStepCount(kind: IllnessKind, daysOut: number): number {
  switch (kind) {
    case 'mental':
      return 0;
    case 'cold':
      return daysOut <= 1 ? 0 : daysOut <= 3 ? 1 : 2;
    case 'stomach':
      return daysOut <= 2 ? 1 : daysOut <= 6 ? 2 : 3;
    case 'virus':
      return daysOut <= 1 ? 1 : daysOut <= 3 ? 2 : daysOut <= 7 ? 4 : daysOut <= 14 ? 6 : 8;
    default:
      return daysOut <= 1 ? 0 : daysOut <= 3 ? 2 : daysOut <= 7 ? 3 : daysOut <= 14 ? 5 : 6;
  }
}

export interface IllnessCaps {
  /** Share of the normal training volume (1 = normal). */
  volume: number;
  /** Effort ceiling (RPE), null = none. */
  rpeMax: number | null;
  /** Extra rest between sets, seconds. */
  restAddSec: number;
}

export const NO_CAPS: IllnessCaps = { volume: 1, rpeMax: null, restAddSec: 0 };

/** The caps of step `step` (1-based) of `of`: from ~60% up to ~90%, then normal. */
export function stepCaps(step: number, of: number): IllnessCaps {
  const frac = of <= 1 ? 0 : (step - 1) / of;
  return {
    volume: Math.round((0.6 + 0.35 * frac) * 100) / 100,
    rpeMax: frac < 0.5 ? 7 : frac < 0.75 ? 8 : null,
    restAddSec: frac < 0.5 ? 20 : frac < 0.75 ? 10 : 0,
  };
}

export type IllnessPhase = 'clear' | 'sick' | 'mental' | 'returning';

export interface IllnessState {
  phase: IllnessPhase;
  kind: IllnessKind;
  periodId: string | null;
  /** SICK/MENTAL: which day of it today is (1-based). RETURNING: days the illness lasted. */
  days: number;
  /** RETURNING: the current step (1-based) and how many there are. */
  step: number;
  steps: number;
  caps: IllnessCaps;
  /** Readiness haircut for the RPE estimate (0…). */
  rpeCut: number;
  /** A long illness — suggest a doctor. */
  needsDoctor: boolean;
}

const CLEAR: IllnessState = {
  phase: 'clear',
  kind: 'other',
  periodId: null,
  days: 0,
  step: 0,
  steps: 0,
  caps: NO_CAPS,
  rpeCut: 0,
  needsDoctor: false,
};

export function kindOf(p: RestPeriod): IllnessKind {
  return p.illnessKind ?? 'other';
}

/** The current illness situation from the periods + finished workouts. */
export function illnessState(
  periods: RestPeriod[],
  workouts: Workout[],
  now: number = Date.now(),
): IllnessState {
  const today = dayOf(now);
  const ill = periods.filter((r) => r.mode === 'illness');
  const current = ill
    .filter((r) => r.startDay <= today && (r.open === true || today <= r.endDay))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (current) {
    const kind = kindOf(current);
    const days = today - current.startDay + 1;
    const needsDoctor = days >= DOCTOR_HINT_DAYS;
    if (kind === 'mental')
      return { ...CLEAR, phase: 'mental', kind, periodId: current.id, days, needsDoctor };
    return {
      ...CLEAR,
      phase: 'sick',
      kind,
      periodId: current.id,
      days,
      caps: { volume: 0.6, rpeMax: 7, restAddSec: 20 },
      rpeCut: 0.06,
      needsDoctor,
    };
  }
  const last = ill
    .filter((r) => !r.open && r.endDay < today && kindOf(r) !== 'mental')
    .sort((a, b) => b.endDay - a.endDay)[0];
  if (!last || today - last.endDay > RETURN_WINDOW_DAYS) return CLEAR;
  const kind = kindOf(last);
  const days = last.endDay - last.startDay + 1;
  const steps = returnStepCount(kind, days);
  if (steps === 0) return CLEAR;
  const done = workouts.filter(
    (w) => w.finishedAt !== null && dayOf(w.startedAt) > last.endDay,
  ).length;
  if (done >= steps) return CLEAR;
  const step = done + 1;
  return {
    phase: 'returning',
    kind,
    periodId: last.id,
    days,
    step,
    steps,
    caps: stepCaps(step, steps),
    rpeCut: Math.round(0.06 * ((steps - done) / steps) * 1000) / 1000,
    needsDoctor: days >= DOCTOR_HINT_DAYS,
  };
}
