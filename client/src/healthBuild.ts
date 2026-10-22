/**
 * One place that turns everything health-related (injuries + long-term conditions) into
 * the pieces `buildDay` understands. Every call site uses this, so a condition can never
 * be honoured by one builder and forgotten by another.
 */
import { useMemo } from 'react';
import { getStoredLimits, useStore, useStoredLimits, type StoredLimits } from './store';
import type { MuscleGroup } from './data/exercises';
import { conditionLimits, type Limits } from './conditions';
import { loadCaps as injuryLoadCaps, protectedMuscles as injuryProtected } from './injury';

export interface HealthBuild {
  protectedMuscles: MuscleGroup[];
  /** Per-muscle load cap (0..1): the strictest of rehab stages and condition caps. */
  loadCaps: Map<MuscleGroup, number>;
  conditions: Limits;
}

/**
 * RESTRICTION path (SPO-290 owner decision): workout generation always honours the stored injuries and conditions, even
 * when their features are off or the consent is unknown. They only cap and protect; the result names nothing and is
 * never displayed, shared or sent. `limits` defaults to the stored ones (a test or a caller may pass others).
 */
export function healthBuildCtx(
  now: number = Date.now(),
  s: StoredLimits = getStoredLimits(),
): HealthBuild {
  const limits = conditionLimits(s.conditions ?? [], now);
  const caps = new Map(injuryLoadCaps([...s.injuries]));
  for (const [m, c] of Object.entries(limits.effects.muscleCaps ?? {}) as [MuscleGroup, number][])
    caps.set(m, Math.min(caps.get(m) ?? 1, c));
  return {
    protectedMuscles: [...injuryProtected([...s.injuries])],
    loadCaps: caps,
    conditions: limits,
  };
}

/**
 * DISPLAY path: the stacked limits of the conditions the app may show (empty while Chronic conditions is off), for
 * screens that flag exercises or remind the person of a limit. What only restricts uses `useStoredConditionLimits`.
 */
export function useConditionLimits(): Limits {
  const { conditions } = useStore();
  return useMemo(() => conditionLimits(conditions ?? []), [conditions]);
}

/**
 * RESTRICTION path: the same limits from the stored conditions, whatever the consent says. For progression caps (RPE
 * ceiling, no-failure, rest scaling) that must keep protecting, never for anything that shows or sends a condition.
 */
export function useStoredConditionLimits(): Limits {
  const { conditions } = useStoredLimits();
  return useMemo(() => conditionLimits(conditions ?? []), [conditions]);
}
