/**
 * Coach (trainer dashboard) dictionary — R-KIT-30. Kept apart from the 5000-line
 * app dictionaries so the Coach feature (behind its flag) adds strings without
 * touching them; the contract is the same: every key exists in all five
 * locales, enforced by the `typeof coachEn` type on each file.
 *
 *   const { c } = useCoachT();   c.navAgenda, c.unread(3) …
 *
 * Plural-sensitive strings are functions of the count; `plural()` picks the
 * form with `Intl.PluralRules` (uk / pl / lt have one-few-many, en / et one-other).
 */
import { useT, type LocaleId } from './index';
import { coachEn } from './coach.en';
import { coachUk } from './coach.uk';
import { coachPl } from './coach.pl';
import { coachLt } from './coach.lt';
import { coachEt } from './coach.et';

export type CoachStrings = typeof coachEn;

export const COACH_LOCALES: Record<LocaleId, CoachStrings> = {
  en: coachEn,
  uk: coachUk,
  pl: coachPl,
  lt: coachLt,
  et: coachEt,
};

export function coachStrings(locale: LocaleId): CoachStrings {
  return COACH_LOCALES[locale];
}

/** The Coach dictionary for the active app locale (re-renders on locale change). */
export function useCoachT(): { c: CoachStrings; locale: LocaleId } {
  const { locale } = useT();
  return { c: COACH_LOCALES[locale], locale };
}

export { plural, pluralCategory, type PluralForms } from './coachPlural';
