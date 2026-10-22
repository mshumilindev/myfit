import { useT, type LocaleId } from './index';
import { legalEn } from './legal.en';
import { legalUk } from './legal.uk';
import { legalPl } from './legal.pl';
import type { LegalTexts } from './legal.types';

export type { DocBlock, DocSectionText, LegalDocText, LegalTexts, LegalUi } from './legal.types';

/**
 * The legal documents exist in English (canonical), Ukrainian and Polish. Lithuanian and Estonian are being dropped
 * as app languages, so no texts are written for them: they read the English document (`isLegalFallback`).
 */
export const LEGAL_LOCALES: Partial<Record<LocaleId, LegalTexts>> = {
  en: legalEn,
  uk: legalUk,
  pl: legalPl,
};

export const legalTexts = (locale: LocaleId): LegalTexts => LEGAL_LOCALES[locale] ?? legalEn;

export const isLegalFallback = (locale: LocaleId): boolean => !LEGAL_LOCALES[locale];

export function useLegalT(): { lg: LegalTexts; locale: LocaleId; fallback: boolean } {
  const { locale } = useT();
  return { lg: legalTexts(locale), locale, fallback: isLegalFallback(locale) };
}
