/**
 * One place for the icons of everything a coach (or the "what your coach sees" preview) is
 * shown: the same effect has the same icon in every block, and each block's header carries the
 * feature's own Lifestyle icon (the one on its Health row and Privacy row). The effect icons
 * match the "Use in calculations" screens.
 */

/** The feature icons: Health › Lifestyle rows, Privacy category rows, coach block headers. */
export const FEATURE_ICON = {
  conditions: 'heartbeat',
  nicotine: 'flame',
  alcohol: 'wine',
  supplements: 'sparkle',
} as const;

/** Every effect a coach block can list (nicotine, alcohol and supplements share some). */
export type CoachEffectIconKey =
  | 'readiness'
  | 'deloadThreshold'
  | 'sleepMin'
  | 'warmupMin'
  | 'restPct'
  | 'progressionStep'
  | 'rpe'
  | 'strength'
  | 'bodyweightKg'
  | 'proteinGrams';

export const COACH_EFFECT_ICON: Record<CoachEffectIconKey, string> = {
  readiness: 'heartbeat',
  deloadThreshold: 'arrows-down-up',
  sleepMin: 'moon',
  warmupMin: 'clock',
  restPct: 'timer',
  progressionStep: 'trend-up',
  rpe: 'gauge',
  strength: 'barbell',
  bodyweightKg: 'scales',
  proteinGrams: 'egg',
};

/** The accent total rows (Full level): the combined load, caffeine. */
export const COACH_TOTAL_ICON = { load: 'gauge', caffeine: 'coffee' } as const;
