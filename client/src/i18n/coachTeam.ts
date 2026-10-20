/**
 * Team dictionary (Coach, SPO-196). Separate from `coach.ts` so parallel work never collides.
 *
 *   const { tm } = useTeamT();   tm.tmTitle, tm.tmSubTrainer(3) ...
 */
import { useT, type LocaleId } from './index';
import { teamEn } from './coachTeam.en';
import { teamUk } from './coachTeam.uk';
import { teamPl } from './coachTeam.pl';
import { teamLt } from './coachTeam.lt';
import { teamEt } from './coachTeam.et';

export type TeamStrings = typeof teamEn;

export const TEAM_LOCALES: Record<LocaleId, TeamStrings> = {
  en: teamEn,
  uk: teamUk,
  pl: teamPl,
  lt: teamLt,
  et: teamEt,
};

export function teamStrings(locale: LocaleId): TeamStrings {
  return TEAM_LOCALES[locale];
}

export function useTeamT(): { tm: TeamStrings; locale: LocaleId } {
  const { locale } = useT();
  return { tm: TEAM_LOCALES[locale], locale };
}
