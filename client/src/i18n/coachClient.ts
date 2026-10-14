/**
 * Client-side trainer dictionary (Coach, M7): invite, sharing, My trainer, client chat, Today / Programs / Session
 * additions, notifications. Separate from `coach.ts` / `coachChat.ts` so parallel agents never collide.
 *
 *   const { cc } = useClientT();   cc.invTitle('Iryna'), cc.shSince('2 Jun 2026') ...
 */
import { useT, type LocaleId } from './index';
import { clientEn } from './coachClient.en';
import { clientUk } from './coachClient.uk';
import { clientPl } from './coachClient.pl';
import { clientLt } from './coachClient.lt';
import { clientEt } from './coachClient.et';

export type ClientStrings = typeof clientEn;

export const CLIENT_LOCALES: Record<LocaleId, ClientStrings> = {
  en: clientEn,
  uk: clientUk,
  pl: clientPl,
  lt: clientLt,
  et: clientEt,
};

export const clientStrings = (locale: LocaleId): ClientStrings => CLIENT_LOCALES[locale];

export function useClientT(): { cc: ClientStrings; locale: LocaleId } {
  const { locale } = useT();
  return { cc: CLIENT_LOCALES[locale], locale };
}
