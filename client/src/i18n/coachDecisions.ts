/**
 * Decisions (receipts) dictionary (Coach). Separate from `coach.ts` / `coachToday.ts` / `coachRoster.ts` so the
 * parallel screens do not collide. Five locales, `typeof decisionsEn`.
 *
 *   const { d } = useDecisionsT();   d.dcTitle, d.dcCount(42) …
 */
import { useT, type LocaleId } from './index';
import { decisionsEn } from './coachDecisions.en';
import { decisionsUk } from './coachDecisions.uk';
import { decisionsPl } from './coachDecisions.pl';
import { decisionsLt } from './coachDecisions.lt';
import { decisionsEt } from './coachDecisions.et';

export type DecisionsStrings = typeof decisionsEn;

export const DECISIONS_LOCALES: Record<LocaleId, DecisionsStrings> = {
  en: decisionsEn,
  uk: decisionsUk,
  pl: decisionsPl,
  lt: decisionsLt,
  et: decisionsEt,
};

export function useDecisionsT(): { d: DecisionsStrings; locale: LocaleId } {
  const { locale } = useT();
  return { d: DECISIONS_LOCALES[locale], locale };
}
