/**
 * Personalised volume landmarks (next-version "trust the numbers"): the generic
 * MEV/MAV/MRV are population averages, but recoverable volume is individual.
 * This nudges each muscle's ceiling toward what the athlete's OWN history proves
 * — how much weekly volume they sustain while still progressing (tolerant → the
 * ceiling is at least that high) versus stalling under a big load (at/over the
 * ceiling). It is deliberately conservative and honest:
 *
 *   • nothing moves until there are ≥6 weeks of data for that muscle;
 *   • evidence is only ever BLENDED with the default (never a full override);
 *   • the result is bounded to ±30–35% of the generic landmark;
 *   • every landmark carries `source` + `confidence` so the UI can say plainly
 *     whether a range is "tuned to you" or still a "starting estimate".
 *
 * Pure over the finished-workout history. No store/React imports beyond the
 * fractional set counter and the stall read it reuses.
 */
import { LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
import { stalledMuscles } from './fatigue';
import { muscleSetsInWorkout } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;
/** Weeks of history considered when learning a personal ceiling. */
export const PERSONALIZE_WEEKS = 12;
/** Below this many trained weeks we don't deviate from the generic landmark. */
export const MIN_WEEKS = 6;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface PersonalLandmark extends Landmark {
  /** The generic, population-average landmark this was tuned from. */
  base: Landmark;
  /** 'tuned' once the athlete's history has moved the range, else 'default'. */
  source: 'default' | 'tuned';
  /** 0..1 — how much history backs the tuning (weeks of data). */
  confidence: number;
  weeksTrained: number;
}

/**
 * The pure core: tune one muscle's landmark from its weekly set series and
 * whether its main lift is currently stalled. Exported for direct unit testing.
 */
export function tuneLandmark(
  base: Landmark,
  weekly: number[],
  isStalled: boolean,
): PersonalLandmark {
  const trained = weekly.filter((s) => s > 0);
  const weeksTrained = trained.length;
  const asDefault = (): PersonalLandmark => ({
    ...base,
    base,
    source: 'default',
    confidence: 0,
    weeksTrained,
  });
  if (weeksTrained < MIN_WEEKS || base.mrv <= 0) return asDefault();

  // Robust recent peak: the 2nd-highest trained week, so one outlier week can't
  // set the ceiling on its own.
  const sorted = [...trained].sort((a, b) => b - a);
  const sustainedPeak = sorted[1] ?? sorted[0];

  let evidenceMrv: number;
  if (isStalled && sustainedPeak >= base.mav) {
    // Carrying high volume AND the main lift has stalled → at/over the ceiling
    // here; pull the personal MRV down toward that volume.
    evidenceMrv = clamp(sustainedPeak, base.mrv * 0.7, base.mrv);
  } else if (!isStalled && sustainedPeak >= base.mrv * 0.9) {
    // Sustaining near/above the generic ceiling while still progressing → they
    // tolerate more; the ceiling is a bit above what's already proven.
    evidenceMrv = sustainedPeak * 1.1;
  } else {
    return asDefault(); // no strong signal either way
  }

  // Confidence from weeks of data (0 at MIN_WEEKS, 1 at ~14 weeks). Evidence is
  // blended at most 60% of the way, so the default always anchors the estimate.
  const confidence = clamp((weeksTrained - MIN_WEEKS) / 8, 0, 1);
  const blended = base.mrv * (1 - confidence * 0.6) + evidenceMrv * (confidence * 0.6);
  const mrv = clamp(Math.round(blended), Math.round(base.mrv * 0.7), Math.round(base.mrv * 1.35));

  const ratio = mrv / base.mrv;
  // The floor (MEV) is far more universal than the ceiling (MRV), so it moves
  // least; MAV rides most of the way with MRV.
  let mev = Math.round(base.mev * lerp(1, ratio, 0.6));
  let mav = Math.round(base.mav * lerp(1, ratio, 0.85));
  mav = Math.min(mav, mrv);
  mev = Math.min(mev, mav);

  const tuned = Math.abs(mrv - base.mrv) >= 1;
  return {
    mev,
    mav,
    mrv,
    base,
    source: tuned ? 'tuned' : 'default',
    confidence: tuned ? confidence : 0,
    weeksTrained,
  };
}

/** Per-muscle weekly working-set counts for the last `weeks` weeks (oldest→newest). */
export function weeklyMuscleSeries(
  finished: Workout[],
  now: number,
  weeks = PERSONALIZE_WEEKS,
): Map<MuscleGroup, number[]> {
  const out = new Map<MuscleGroup, number[]>();
  const since = now - weeks * WEEK;
  for (const w of finished) {
    if (w.startedAt < since || w.startedAt > now) continue;
    const idx = Math.min(weeks - 1, Math.max(0, Math.floor((w.startedAt - since) / WEEK)));
    for (const [m, n] of muscleSetsInWorkout(w)) {
      let arr = out.get(m);
      if (!arr) {
        arr = new Array(weeks).fill(0);
        out.set(m, arr);
      }
      arr[idx] += n;
    }
  }
  return out;
}

/** Personalised landmarks for every landmarked muscle, from real history. */
export function personalLandmarks(
  finished: Workout[],
  now: number,
): Map<MuscleGroup, PersonalLandmark> {
  const series = weeklyMuscleSeries(finished, now);
  const stalled = stalledMuscles(finished, now);
  const out = new Map<MuscleGroup, PersonalLandmark>();
  for (const m of VOLUME_MUSCLES) {
    const base = LANDMARKS[m];
    if (!base) continue;
    out.set(m, tuneLandmark(base, series.get(m) ?? [], stalled.has(m)));
  }
  return out;
}

/** Sum member personal landmarks into one landmark for a zone. */
export function personalZoneLandmark(
  pmap: Map<MuscleGroup, PersonalLandmark>,
  members: MuscleGroup[],
): Landmark {
  const out: Landmark = { mev: 0, mav: 0, mrv: 0 };
  for (const m of members) {
    const lm = pmap.get(m);
    if (!lm) continue;
    out.mev += lm.mev;
    out.mav += lm.mav;
    out.mrv += lm.mrv;
  }
  return out;
}

export interface TuneSummary {
  tunedCount: number;
  confidence: number; // mean confidence across tuned muscles, 0..1
}

/** How much of the volume read is personalised — for an honest UI indicator. */
export function tuneSummary(pmap: Map<MuscleGroup, PersonalLandmark>): TuneSummary {
  const tuned = [...pmap.values()].filter((l) => l.source === 'tuned');
  const confidence = tuned.length ? tuned.reduce((s, l) => s + l.confidence, 0) / tuned.length : 0;
  return { tunedCount: tuned.length, confidence };
}
