import type { LegalDocText } from './legal.types';

/** DRAFT Trainer Terms + DPA texts (SPO-289). Dictionaries: legalTrainer.en.ts, .uk.ts, .pl.ts. Same shapes as the other legal documents. */
export interface LegalTrainerTexts {
  /** Shown on top of both documents (the page `note`): the text is a draft. */
  draftNote: string;
  trainerTerms: LegalDocText;
  dpa: LegalDocText;
}
