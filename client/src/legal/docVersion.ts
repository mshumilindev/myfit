import type { LocaleId } from '../i18n';
import { LEGAL_VERSIONS } from './consents';
import type { LegalPageId } from './route';

const DATE_LOCALE: Record<LocaleId, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

/** The version of a page's document: the privacy page shows `policy`, the terms page `terms`, the trainer documents `trainer-terms`. */
export function docVersion(page: LegalPageId): string {
  if (page === 'trainer-terms' || page === 'dpa') return LEGAL_VERSIONS['trainer-terms'];
  return page === 'privacy' ? LEGAL_VERSIONS.policy : LEGAL_VERSIONS.terms;
}

/** "2026-10-21" → "21 October 2026" (locale-natural). The version IS the date, so it is never typed twice. */
export function fmtVersionDate(version: string, locale: LocaleId): string {
  const [y, m, d] = version.split('-').map(Number);
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
