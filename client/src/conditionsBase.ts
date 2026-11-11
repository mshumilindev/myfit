/**
 * Pure, dependency-free parts of the Conditions add-on that the engine (`conditions.ts`) and its late-bound facade
 * (`conditionsRt.ts`) both need; lives apart so the two do not import each other (SPO-500 I8).
 */
import type { ChronicCondition } from './types';
import type { ConditionCategory, ConditionEffects, RiskTag } from './data/conditionCatalog';
import type { MuscleGroup } from './data/exercises';

export interface Limits {
  /** Stricter-wins merge of every condition's effects at its severity. */
  effects: ConditionEffects;
  /** Condition keys behind each restriction (for "why" lines; never sent off-device). */
  avoidBy: Partial<Record<RiskTag, string[]>>;
  cautionBy: Partial<Record<RiskTag, string[]>>;
  capBy: Partial<Record<MuscleGroup, string[]>>;
  keys: string[];
}

export const NO_LIMITS: Limits = { effects: {}, avoidBy: {}, cautionBy: {}, capBy: {}, keys: [] };

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
