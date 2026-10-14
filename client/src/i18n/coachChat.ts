/**
 * Chat dictionary (Coach, M4). Separate from `coach.ts` / `coachRoster.ts` so parallel agents never collide.
 *
 *   const { ch } = useChatT();   ch.chTitle, ch.chClearWho(12) ...
 */
import { useT, type LocaleId } from './index';
import { chatEn } from './coachChat.en';
import { chatUk } from './coachChat.uk';
import { chatPl } from './coachChat.pl';
import { chatLt } from './coachChat.lt';
import { chatEt } from './coachChat.et';

export type ChatStrings = typeof chatEn;

export const CHAT_LOCALES: Record<LocaleId, ChatStrings> = {
  en: chatEn,
  uk: chatUk,
  pl: chatPl,
  lt: chatLt,
  et: chatEt,
};

export function chatStrings(locale: LocaleId): ChatStrings {
  return CHAT_LOCALES[locale];
}

export function useChatT(): { ch: ChatStrings; locale: LocaleId } {
  const { locale } = useT();
  return { ch: CHAT_LOCALES[locale], locale };
}
