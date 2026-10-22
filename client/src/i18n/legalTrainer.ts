import { useT, type LocaleId } from './index';
import { legalTrainerEn } from './legalTrainer.en';
import { legalTrainerUk } from './legalTrainer.uk';
import { legalTrainerPl } from './legalTrainer.pl';
import type { LegalTrainerTexts } from './legalTrainer.types';

export type { LegalTrainerTexts } from './legalTrainer.types';

/**
 * DRAFT Trainer Terms and DPA (SPO-289): English (canonical), Ukrainian and Polish (machine drafts). Lithuanian and
 * Estonian read the English text, like the other legal documents (`legal.ts`).
 */
export const LEGAL_TRAINER_LOCALES: Partial<Record<LocaleId, LegalTrainerTexts>> = {
  en: legalTrainerEn,
  uk: legalTrainerUk,
  pl: legalTrainerPl,
};

export const legalTrainerTexts = (locale: LocaleId): LegalTrainerTexts =>
  LEGAL_TRAINER_LOCALES[locale] ?? legalTrainerEn;

export function useLegalTrainerT(): LegalTrainerTexts {
  return legalTrainerTexts(useT().locale);
}
