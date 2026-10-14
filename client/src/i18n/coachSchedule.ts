/**
 * Schedule dictionary (Coach, M6). Separate from `coach.ts` / `coachChat.ts` so parallel agents never collide.
 *
 *   const { s, locale } = useScheduleT();   s.scTitle, s.scSummary(14) ...
 */
import { useT, type LocaleId } from './index';
import { scheduleEn } from './coachSchedule.en';
import { scheduleUk } from './coachSchedule.uk';
import { schedulePl } from './coachSchedule.pl';
import { scheduleLt } from './coachSchedule.lt';
import { scheduleEt } from './coachSchedule.et';

export type ScheduleStrings = typeof scheduleEn;

export const SCHEDULE_LOCALES: Record<LocaleId, ScheduleStrings> = {
  en: scheduleEn,
  uk: scheduleUk,
  pl: schedulePl,
  lt: scheduleLt,
  et: scheduleEt,
};

export function scheduleStrings(locale: LocaleId): ScheduleStrings {
  return SCHEDULE_LOCALES[locale];
}

export function useScheduleT(): { s: ScheduleStrings; locale: LocaleId } {
  const { locale } = useT();
  return { s: SCHEDULE_LOCALES[locale], locale };
}
