import { useT, type LocaleId } from './index';
import { safeEn } from './coachSafe.en';
import { safeUk } from './coachSafe.uk';
import { safePl } from './coachSafe.pl';
import { safeLt } from './coachSafe.lt';
import { safeEt } from './coachSafe.et';

export type SafeStrings = typeof safeEn;

export const SAFE_LOCALES: Record<LocaleId, SafeStrings> = {
  en: safeEn,
  uk: safeUk,
  pl: safePl,
  lt: safeLt,
  et: safeEt,
};

export const safeStrings = (locale: LocaleId): SafeStrings => SAFE_LOCALES[locale];

export function useSafeT(): { sf: SafeStrings; locale: LocaleId } {
  const { locale } = useT();
  return { sf: SAFE_LOCALES[locale], locale };
}
