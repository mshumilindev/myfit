/**
 * Fatigue model (design FAT-1..W): accumulated fatigue per fine muscle, from
 * signals we already track -- how hard the weekly volume is pushing against the
 * muscle's recoverable max (MRV), plus whether a lift for it has stalled. Turns
 * the vague "try a deload" into a per-muscle read and a targeted suggestion.
 * Pure over the finished-workout history.
 */
import { LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
import { topHistory } from './progression';
import { resolveMuscles, isStrengthExercise } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;

/**
 * Fatigue weights stabilizer (secondary) work LESS than the volume read does.
 * The MRV landmarks are calibrated for DIRECT training volume, but a muscle
 * like the lower back is loaded as a synergist on nearly every squat, hinge and
 * row. Counting that stabilizer work at the volume model's 0.5/set (against a
 * low MRV) makes it read "fried" after a normal leg day, which isn't real
 * systemic fatigue. So for the fatigue read a secondary set counts at a third,
 * and — the firm rule — a muscle worked ONLY as a stabilizer this week (no
 * direct sets) can never read "fried".
 */
const FATIGUE_SECONDARY_WEIGHT = 1 / 3;
/** Ceiling on fatigue score for a muscle with no direct (primary) sets. */
const NO_DIRECT_CEILING = 0.5;

interface WeekSplit {
  primary: number;
  secondary: number;
}

/** Trailing-week sets per muscle, split into direct (primary) vs stabilizer
 *  (secondary) so the fatigue read can weight them differently. */
function weeklyFatigueSplit(
  finished: Workout[],
  now: number,
  days = 7,
): Map<MuscleGroup, WeekSplit> {
  const since = now - days * DAY;
  const out = new Map<MuscleGroup, WeekSplit>();
  const add = (m: MuscleGroup, key: keyof WeekSplit, v: number): void => {
    const cur = out.get(m) ?? { primary: 0, secondary: 0 };
    cur[key] += v;
    out.set(m, cur);
  };
  for (const w of finished) {
    if (w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const n = e.sets.length;
      if (n === 0) continue;
      const { primary, secondary } = resolveMuscles(e);
      if (primary) add(primary, 'primary', n);
      for (const s of secondary) if (s !== primary) add(s, 'secondary', n);
    }
  }
  return out;
}

export type FatigueLevel = 'fresh' | 'moderate' | 'high' | 'fried';

export interface MuscleFatigue {
  muscle: MuscleGroup;
  score: number; // 0..1
  level: FatigueLevel;
  sets: number;
  mrv: number;
  stalled: boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function levelOf(score: number): FatigueLevel {
  if (score >= 0.7) return 'fried';
  if (score >= 0.4) return 'high';
  if (score >= 0.15) return 'moderate';
  return 'fresh';
}

/** Top weight flat (no new high) across the last 3+ loaded sessions. */
function flatTop(history: { weight: number | null; reps: number }[]): boolean {
  const loaded = history.filter((p) => (p.weight ?? 0) > 0);
  if (loaded.length < 3) return false;
  const recent = loaded.slice(0, 3);
  const w = recent[0].weight ?? 0;
  return recent.every((p) => (p.weight ?? 0) <= w) && (recent[2].weight ?? 0) === w;
}

/** Muscles whose main lift has stalled recently (trained in the last ~5 weeks). */
export function stalledMuscles(finished: Workout[], now: number): Set<MuscleGroup> {
  const since = now - 35 * DAY;
  const names = new Map<string, MuscleGroup>();
  for (const w of finished) {
    if (w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const p = resolveMuscles(e).primary;
      if (p && p !== 'cardio') names.set(e.name.trim(), p);
    }
  }
  const out = new Set<MuscleGroup>();
  for (const [name, m] of names) if (flatTop(topHistory(finished, name))) out.add(m);
  return out;
}

/**
 * Per-muscle fatigue. Volume component ramps as the trailing-week sets climb
 * from ~70% of MRV up past it; a stalled main lift adds a fixed bump. A muscle
 * with little volume and no stall reads fresh.
 */
export function muscleFatigue(
  finished: Workout[],
  now: number,
  landmarks?: ReadonlyMap<MuscleGroup, Landmark>,
): Map<MuscleGroup, MuscleFatigue> {
  const split = weeklyFatigueSplit(finished, now);
  const stalled = stalledMuscles(finished, now);
  const out = new Map<MuscleGroup, MuscleFatigue>();
  for (const m of VOLUME_MUSCLES) {
    // Personalised ceiling when available (so a tolerant athlete reads less
    // fatigued at the same volume, and a deload holds off) — else the default.
    const lm = landmarks?.get(m) ?? (LANDMARKS[m] as Landmark);
    const wk = split.get(m) ?? { primary: 0, secondary: 0 };
    // Display set count stays consistent with the volume read (secondary 0.5);
    // the fatigue SCORE weights stabilizer work less (secondary 1/3).
    const sets = wk.primary + wk.secondary * 0.5;
    const fatSets = wk.primary + wk.secondary * FATIGUE_SECONDARY_WEIGHT;
    const volComp = clamp((fatSets / lm.mrv - 0.7) / 0.45, 0, 1);
    const isSt = stalled.has(m);
    let score = clamp(volComp * 0.75 + (isSt ? 0.4 : 0), 0, 1);
    // A muscle only stabilized this week (no direct sets) can't read "fried" —
    // stabilizer load and a stale lift alone don't warrant a deload here.
    if (wk.primary <= 0) score = Math.min(score, NO_DIRECT_CEILING);
    out.set(m, { muscle: m, score, level: levelOf(score), sets, mrv: lm.mrv, stalled: isSt });
  }
  return out;
}

/** CSS colour per fatigue level: fresh (calm green) -> fried (ruby). */
export const FATIGUE_COLOR: Record<FatigueLevel, string> = {
  fresh: 'var(--color-ok)',
  moderate: 'var(--color-accent-600)',
  high: 'var(--color-accent)',
  fried: 'var(--color-danger)',
};

export type DeloadKind = 'none' | 'local' | 'systemic';

export interface DeloadSuggestion {
  kind: DeloadKind;
  muscle: MuscleGroup | null;
  friedCount: number;
  highCount: number;
}

/** Read the fatigue map into a deload suggestion: one fried muscle -> a local
 *  cut; many hot muscles -> a systemic recovery week; otherwise nothing.
 *
 *  `recoveryBias` (design feature 6) lets logged activities feed the model:
 *  recovery-dominant weeks (>0) raise the systemic trigger so a deload holds
 *  off; conditioning piled on top of lifting (<0) lowers it a touch. */
export function deloadSuggestion(
  fat: Map<MuscleGroup, MuscleFatigue>,
  recoveryBias = 0,
): DeloadSuggestion {
  const fried = [...fat.values()].filter((f) => f.level === 'fried');
  const high = [...fat.values()].filter((f) => f.level === 'high' || f.level === 'fried');
  const shift = Math.round(clamp(recoveryBias, -1, 1));
  const friedTrigger = 3 + shift;
  const highTrigger = 5 + shift;
  if (fried.length >= friedTrigger || high.length >= highTrigger) {
    return { kind: 'systemic', muscle: null, friedCount: fried.length, highCount: high.length };
  }
  if (fried.length >= 1) {
    const worst = fried.sort((a, b) => b.score - a.score)[0];
    return {
      kind: 'local',
      muscle: worst.muscle,
      friedCount: fried.length,
      highCount: high.length,
    };
  }
  return { kind: 'none', muscle: null, friedCount: 0, highCount: high.length };
}
