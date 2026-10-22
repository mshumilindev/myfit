/**
 * Localized, content-free push texts (SPO-263 / SPO-237). The push says only that something happened; it never carries a
 * name, a time or a message. The language is the one the device stored in its push doc (`locale`); unknown means English.
 * Same five locales as the client (en uk pl lt et); a parity test keeps the table complete.
 */
export const PUSH_LOCALES = ['en', 'uk', 'pl', 'lt', 'et'] as const;
export type PushLocale = (typeof PUSH_LOCALES)[number];

export const PUSH_TEXT_KEYS = [
  'message',
  'invite',
  'program',
  'team',
  'reminder',
  'request',
  'access',
] as const;
export type PushTextKey = (typeof PUSH_TEXT_KEYS)[number];

export const PUSH_TEXTS: Record<PushLocale, Record<PushTextKey, string>> = {
  en: {
    message: 'New message',
    invite: 'New invitation',
    program: 'Program updated',
    team: 'Team update',
    reminder: 'Reminder',
    request: 'New request',
    access: 'Access updated',
  },
  uk: {
    message: 'Нове повідомлення',
    invite: 'Нове запрошення',
    program: 'Програму оновлено',
    team: 'Оновлення команди',
    reminder: 'Нагадування',
    request: 'Новий запит',
    access: 'Доступ оновлено',
  },
  pl: {
    message: 'Nowa wiadomość',
    invite: 'Nowe zaproszenie',
    program: 'Program zaktualizowany',
    team: 'Aktualizacja zespołu',
    reminder: 'Przypomnienie',
    request: 'Nowa prośba',
    access: 'Dostęp zaktualizowany',
  },
  lt: {
    message: 'Nauja žinutė',
    invite: 'Naujas kvietimas',
    program: 'Programa atnaujinta',
    team: 'Komandos naujiena',
    reminder: 'Priminimas',
    request: 'Nauja užklausa',
    access: 'Prieiga atnaujinta',
  },
  et: {
    message: 'Uus sõnum',
    invite: 'Uus kutse',
    program: 'Programm uuendatud',
    team: 'Meeskonna uudis',
    reminder: 'Meeldetuletus',
    request: 'Uus taotlus',
    access: 'Juurdepääs uuendatud',
  },
};

/** 'uk-UA' / 'PL' / 'et_EE' -> 'uk' / 'pl' / 'et'; anything unknown (or not a string) -> 'en'. */
export function pushLocaleOf(v: unknown): PushLocale {
  const base = typeof v === 'string' ? v.toLowerCase().split(/[-_]/)[0] : '';
  return (PUSH_LOCALES as readonly string[]).includes(base) ? (base as PushLocale) : 'en';
}

export const pushTextFor = (key: PushTextKey, locale: unknown): string =>
  PUSH_TEXTS[pushLocaleOf(locale)][key];

/** The text a notice kind shows by default (a more specific `topic` such as `access` overrides it). */
export const defaultTextKey = (kind: string): PushTextKey =>
  kind === 'message' ||
  kind === 'invite' ||
  kind === 'program' ||
  kind === 'team' ||
  kind === 'reminder'
    ? kind
    : 'request';
