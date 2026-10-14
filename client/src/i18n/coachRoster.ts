/**
 * Roster / signals / Client 360 dictionary (Coach, M1 UI). Separate from `coach.ts` on purpose: the Today and
 * Decision screens add their own strings in parallel. Same contract: five locales, `typeof rosterEn`.
 *
 *   const { r } = useRosterT();   r.roTitle, r.roSubtitle(14, 5) …
 */
import { useT, type LocaleId } from './index';
import { rosterEn } from './coachRoster.en';
import { rosterUk } from './coachRoster.uk';
import { rosterPl } from './coachRoster.pl';
import { rosterLt } from './coachRoster.lt';
import { rosterEt } from './coachRoster.et';

export type RosterStrings = typeof rosterEn;

export const ROSTER_LOCALES: Record<LocaleId, RosterStrings> = {
  en: rosterEn,
  uk: rosterUk,
  pl: rosterPl,
  lt: rosterLt,
  et: rosterEt,
};

export function rosterStrings(locale: LocaleId): RosterStrings {
  return ROSTER_LOCALES[locale];
}

export function useRosterT(): { r: RosterStrings; locale: LocaleId } {
  const { locale } = useT();
  return { r: ROSTER_LOCALES[locale], locale };
}
