/**
 * Late-bound runtime of the Conditions add-on (SPO-500 I8, same pattern as `alcoholRt`). The planner, picker, Atlas and the
 * store call the engine through these wrappers; they answer with a NEUTRAL value (no limits, no flags, no effects) until
 * `conditions.ts` is imported (a lazy chunk fetched only while the add-on is installed) and `provide`s the real functions.
 * Owner 11.11: an add-on that is not installed counts for nothing anywhere, limits included, so the code is not even loaded.
 */
import type { ChronicCondition } from './types';
import type { ConditionCategory, ConditionEffects } from './data/conditionCatalog';
import type { RichExercise } from './data/exercises';
import type { CoachView, EffectLine, ExerciseFlag, GeneralShare, Limits } from './conditions';
import { provide } from './trackerRt';

export const NO_LIMITS: Limits = { effects: {}, avoidBy: {}, cautionBy: {}, capBy: {}, keys: [] };

const NEUTRAL_FLAG: ExerciseFlag = { level: 'ok', tags: [], because: [], cap: 1 };

interface Impl {
  exerciseFlag(name: string, limits: Limits, rich?: RichExercise | null): ExerciseFlag;
  conditionLimits(conditions: readonly ChronicCondition[], now?: number): Limits;
  effectLines(e: ConditionEffects): EffectLine[];
  coachView(
    conditions: readonly ChronicCondition[],
    general: GeneralShare,
    now?: number,
  ): CoachView;
  deidentifiedEffects(
    conditions: readonly ChronicCondition[],
    general?: GeneralShare,
  ): EffectLine[];
  effectiveKey(c: ChronicCondition, now: number): string;
  pregnancyKeyAt(start: number, now: number): string;
  suggestedEnd(key: string, start: number): number | undefined;
}

/** What `conditions.ts` fills in. Neutral until then. */
export const cndRt: Impl = {
  exerciseFlag: () => NEUTRAL_FLAG,
  conditionLimits: () => NO_LIMITS,
  effectLines: () => [],
  coachView: () => ({ full: [], effects: [] }),
  deidentifiedEffects: () => [],
  effectiveKey: (c) => c.key,
  pregnancyKeyAt: () => 'preg_first',
  suggestedEnd: () => undefined,
};
export const provideConditions = (impl: Partial<Impl>): void => provide(cndRt, impl);

export const exerciseFlag: Impl['exerciseFlag'] = (n, l, r) => cndRt.exerciseFlag(n, l, r);
export const conditionLimits: Impl['conditionLimits'] = (c, now) => cndRt.conditionLimits(c, now);
export const effectLines: Impl['effectLines'] = (e) => cndRt.effectLines(e);
export const coachView: Impl['coachView'] = (c, g, now) => cndRt.coachView(c, g, now);
export const deidentifiedEffects: Impl['deidentifiedEffects'] = (c, g) =>
  cndRt.deidentifiedEffects(c, g);
export const effectiveKey: Impl['effectiveKey'] = (c, now) => cndRt.effectiveKey(c, now);
export const pregnancyKeyAt: Impl['pregnancyKeyAt'] = (s, n) => cndRt.pregnancyKeyAt(s, n);
export const suggestedEnd: Impl['suggestedEnd'] = (k, s) => cndRt.suggestedEnd(k, s);

/** Auto-builder filter: drops only 'avoid'. */
export const isAutoExcluded = (name: string, limits: Limits): boolean =>
  exerciseFlag(name, limits).level === 'avoid';

/** Not started yet, or past its end: no effects. Permanent conditions are always active. */
export function isActive(c: ChronicCondition, now: number): boolean {
  if (c.startedAt != null && c.startedAt > now) return false;
  return !(c.endsAt != null && c.endsAt <= now);
}

/** Older builds stored a free-text `note` on a condition; it no longer exists. Drop it on read. */
export function stripLegacyCondition<T extends object>(c: T): T {
  if (!('note' in c)) return c;
  const rest: Record<string, unknown> = { ...c };
  delete rest.note;
  return rest as T;
}
export const stripLegacyConditions = <T extends object>(list: readonly T[]): T[] =>
  list.map(stripLegacyCondition);

/** Body map "Other" tab: what cannot be pinned to a body part (see `conditions.ts` for the full story). */
export const OTHER_TAB_CATEGORIES: ConditionCategory[] = [
  'neuro',
  'cardio',
  'respiratory',
  'metabolic',
  'pregnancy',
  'other',
];
export const isOtherTab = (c: { region: string; category: ConditionCategory }): boolean =>
  c.region === 'whole' || OTHER_TAB_CATEGORIES.includes(c.category);
