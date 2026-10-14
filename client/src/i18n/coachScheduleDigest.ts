import { useT, type LocaleId } from './index';
import { scheduleDigestEn } from './coachScheduleDigest.en';
import { scheduleDigestUk } from './coachScheduleDigest.uk';
import { scheduleDigestPl } from './coachScheduleDigest.pl';
import { scheduleDigestLt } from './coachScheduleDigest.lt';
import { scheduleDigestEt } from './coachScheduleDigest.et';

export type ScheduleDigestStrings = typeof scheduleDigestEn;

export const SCHEDULE_DIGEST_LOCALES: Record<LocaleId, ScheduleDigestStrings> = {
  en: scheduleDigestEn,
  uk: scheduleDigestUk,
  pl: scheduleDigestPl,
  lt: scheduleDigestLt,
  et: scheduleDigestEt,
};

export function useScheduleDigestT(): ScheduleDigestStrings {
  const { locale } = useT();
  return SCHEDULE_DIGEST_LOCALES[locale];
}
