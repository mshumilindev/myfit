/**
 * Client 360 tabs / exports / Decision record dictionary (Coach, M2). Same contract as the other coach
 * dictionaries: five locales, `typeof c360En`.
 *
 *   const { c } = useC360T();   c.wkHistory, c.exDone('a.csv', 3) ...
 */
import { useT, type LocaleId } from './index';
import { c360En } from './coachClient360.en';
import { c360Uk } from './coachClient360.uk';
import { c360Pl } from './coachClient360.pl';
import { c360Lt } from './coachClient360.lt';
import { c360Et } from './coachClient360.et';

export type C360Strings = typeof c360En;

export const C360_LOCALES: Record<LocaleId, C360Strings> = {
  en: c360En,
  uk: c360Uk,
  pl: c360Pl,
  lt: c360Lt,
  et: c360Et,
};

export function useC360T(): { c: C360Strings; locale: LocaleId } {
  const { locale } = useT();
  return { c: C360_LOCALES[locale], locale };
}
