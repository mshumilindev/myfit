/**
 * Program tab / editor / Check before sending dictionary (Coach, M3). Same contract as the other coach dictionaries: five
 * locales, `typeof pgEn`.   const { p } = usePgT();   p.edTitle, p.edCheck(2) ...
 */
import { useT, type LocaleId } from './index';
import { pgEn } from './coachProgram.en';
import { pgUk } from './coachProgram.uk';
import { pgPl } from './coachProgram.pl';
import { pgLt } from './coachProgram.lt';
import { pgEt } from './coachProgram.et';

export type PgStrings = typeof pgEn;

export const PG_LOCALES: Record<LocaleId, PgStrings> = {
  en: pgEn,
  uk: pgUk,
  pl: pgPl,
  lt: pgLt,
  et: pgEt,
};

export function usePgT(): { p: PgStrings; locale: LocaleId } {
  const { locale } = useT();
  return { p: PG_LOCALES[locale], locale };
}
