/** Live screen dictionary: `const { lv } = useLiveT()`. Same locale rules as `coach.ts`. */
import { useT, type LocaleId } from './index';
import { liveEn, type LiveStrings } from './coachLive.en';
import { liveUk } from './coachLive.uk';
import { livePl } from './coachLive.pl';
import { liveLt } from './coachLive.lt';
import { liveEt } from './coachLive.et';

export type { LiveStrings };

export const LIVE_LOCALES: Record<LocaleId, LiveStrings> = {
  en: liveEn,
  uk: liveUk,
  pl: livePl,
  lt: liveLt,
  et: liveEt,
};

export function liveStrings(locale: LocaleId): LiveStrings {
  return LIVE_LOCALES[locale];
}

export function useLiveT(): { lv: LiveStrings; locale: LocaleId } {
  const { locale } = useT();
  return { lv: LIVE_LOCALES[locale], locale };
}
