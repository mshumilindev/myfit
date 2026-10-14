/** Programs list dictionary: `const { pg } = useProgramsT()`. */
import { useT, type LocaleId } from './index';
import { programsEn, type ProgramsStrings } from './coachPrograms.en';
import { programsUk } from './coachPrograms.uk';
import { programsPl } from './coachPrograms.pl';
import { programsLt } from './coachPrograms.lt';
import { programsEt } from './coachPrograms.et';

export type { ProgramsStrings };

export const PROGRAMS_LOCALES: Record<LocaleId, ProgramsStrings> = {
  en: programsEn,
  uk: programsUk,
  pl: programsPl,
  lt: programsLt,
  et: programsEt,
};

export function programsStrings(locale: LocaleId): ProgramsStrings {
  return PROGRAMS_LOCALES[locale];
}

export function useProgramsT(): { pg: ProgramsStrings; locale: LocaleId } {
  const { locale } = useT();
  return { pg: PROGRAMS_LOCALES[locale], locale };
}
