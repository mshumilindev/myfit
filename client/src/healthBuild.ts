/**
 * One place that turns everything health-related (injuries + long-term conditions) into
 * the pieces `buildDay` understands. Every call site uses this, so a condition can never
 * be honoured by one builder and forgotten by another.
 */
import { useMemo } from 'react';
import { useStore } from './store';
import type { MuscleGroup } from './data/exercises';
import { conditionLimits, type Limits } from './conditions';
import { loadCaps as injuryLoadCaps, protectedMuscles as injuryProtected } from './injury';
import type { ChronicCondition, Injury } from './types';

export interface HealthBuild {
  protectedMuscles: MuscleGroup[];
  /** Per-muscle load cap (0..1): the strictest of rehab stages and condition caps. */
  loadCaps: Map<MuscleGroup, number>;
  conditions: Limits;
}

export function healthBuildCtx(
  s: { injuries: readonly Injury[]; conditions: readonly ChronicCondition[] },
  now: number = Date.now(),
): HealthBuild {
  const limits = conditionLimits(s.conditions, now);
  const caps = new Map(injuryLoadCaps([...s.injuries]));
  for (const [m, c] of Object.entries(limits.effects.muscleCaps ?? {}) as [MuscleGroup, number][])
    caps.set(m, Math.min(caps.get(m) ?? 1, c));
  return {
    protectedMuscles: [...injuryProtected([...s.injuries])],
    loadCaps: caps,
    conditions: limits,
  };
}

/** The stacked limits of the signed-in person's active conditions, for screens that flag exercises. */
export function useConditionLimits(): Limits {
  const { conditions } = useStore();
  return useMemo(() => conditionLimits(conditions), [conditions]);
}
