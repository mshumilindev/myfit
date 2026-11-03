/**
 * Calls dictionary (SPO-441 / SPO-445). Separate from the other dictionaries so parallel agents never collide.
 *
 *   const { cl } = useCallsT();   cl.callMute, cl.callTo('Anna'), cl.callLogVideo(12) ...
 */
import { useT, type LocaleId } from './index';
import { callsEn } from './calls.en';
import { callsUk } from './calls.uk';
import { callsPl } from './calls.pl';
import { callsLt } from './calls.lt';
import { callsEt } from './calls.et';

export type CallStrings = typeof callsEn;

export const CALL_LOCALES: Record<LocaleId, CallStrings> = {
  en: callsEn,
  uk: callsUk,
  pl: callsPl,
  lt: callsLt,
  et: callsEt,
};

export const callStrings = (locale: LocaleId): CallStrings => CALL_LOCALES[locale];

export function useCallsT(): { cl: CallStrings; locale: LocaleId } {
  const { locale } = useT();
  return { cl: CALL_LOCALES[locale], locale };
}
