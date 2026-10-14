/** Coach Today + Decision dictionary: `const { t } = useTodayT()`. Same locale rules as `coach.ts`. */
import { useT, type LocaleId } from './index';
import { todayEn, type TodayStrings } from './coachToday.en';
import { todayUk } from './coachToday.uk';
import { todayPl } from './coachToday.pl';
import { todayLt } from './coachToday.lt';
import { todayEt } from './coachToday.et';

export type { TodayStrings };

export const TODAY_LOCALES: Record<LocaleId, TodayStrings> = {
  en: todayEn,
  uk: todayUk,
  pl: todayPl,
  lt: todayLt,
  et: todayEt,
};

export function useTodayT(): { t: TodayStrings; locale: LocaleId } {
  const { locale } = useT();
  return { t: TODAY_LOCALES[locale], locale };
}
