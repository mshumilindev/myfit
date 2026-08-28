/**
 * Fatigue model (design FAT-1..W): accumulated fatigue per fine muscle, from
 * signals we already track -- how hard the weekly volume is pushing against the
 * muscle's recoverable max (MRV), plus whether a lift for it has stalled. Turns
 * the vague "try a deload" into a per-muscle read and a targeted suggestion.
 * Pure over the finished-workout history.
 */
import { weeklyMuscleSets, LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
import { topHistory } from './progression';
import { resolveMuscles, isStrengthExercise } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;

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
export function muscleFatigue(finished: Workout[], now: number): Map<MuscleGroup, MuscleFatigue> {
  const per = weeklyMuscleSets(finished, now);
  const stalled = stalledMuscles(finished, now);
  const out = new Map<MuscleGroup, MuscleFatigue>();
  for (const m of VOLUME_MUSCLES) {
    const lm = LANDMARKS[m] as Landmark;
    const sets = per.get(m) ?? 0;
    const volComp = clamp((sets / lm.mrv - 0.7) / 0.45, 0, 1);
    const isSt = stalled.has(m);
    const score = clamp(volComp * 0.75 + (isSt ? 0.4 : 0), 0, 1);
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
 *  cut; many hot muscles -> a systemic recovery week; otherwise nothing. */
export function deloadSuggestion(fat: Map<MuscleGroup, MuscleFatigue>): DeloadSuggestion {
  const fried = [...fat.values()].filter((f) => f.level === 'fried');
  const high = [...fat.values()].filter((f) => f.level === 'high' || f.level === 'fried');
  if (fried.length >= 3 || high.length >= 5) {
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
