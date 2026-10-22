/**
 * Trainer Terms + DPA acceptance (SPO-289). Pure: no React, no Firestore.
 *
 * ONE consent kind, `trainer-terms`, covers BOTH documents: the DPA is part of the Trainer Terms (the gate makes the
 * trainer open both and accept them together), so there is one record per acceptance. Its `textHash` is the SHA-256 of
 * the two documents as shown in the trainer's language, joined in a fixed order (Trainer Terms, then DPA): see
 * `trainerTermsHashInput`. The version line is `RELEASED_VERSIONS['trainer-terms']`; any new version asks again in full
 * (the changelog mechanism of the Terms / Privacy Policy is typed for those two documents only).
 */
import { canUseCoach, type CoachRoleInput } from '../coach/access';
import { legalTrainerTexts } from '../i18n/legalTrainer';
import type { LocaleId } from '../i18n';
import { LEGAL_VERSIONS, hasCurrentConsent, type ConsentRecord, type LegalCtx } from './consents';
import { docPlainText } from './textHash';

/** The two documents of the acceptance, as public page ids (`#/trainer-terms`, `#/dpa`). */
export const TRAINER_DOC_IDS = ['trainer-terms', 'dpa'] as const;

/** Version of both documents (they share one version line). */
export const TRAINER_VERSIONS: Readonly<Record<string, string>> = {
  'trainer-terms': LEGAL_VERSIONS['trainer-terms'],
  dpa: LEGAL_VERSIONS['trainer-terms'],
};

/** The trainer has not accepted the CURRENT version (never answered, withdrawn, or an older version). */
export function trainerTermsNeeded(
  records: readonly ConsentRecord[],
  versions?: LegalCtx['versions'],
): boolean {
  return !hasCurrentConsent(records, 'trainer-terms', versions);
}

/**
 * Must this signed-in person accept the Trainer Terms + DPA before using the app (SPO-295 owner decision 22.10)? Trainers,
 * managers and admins (the same set as `canUseCoach`); a member never does. The legal gate (drawer 1) asks for it together
 * with the Terms / Privacy Policy, so the app is unusable after login until everything is accepted.
 */
export function trainerTermsMissing(
  records: readonly ConsentRecord[],
  role: CoachRoleInput,
  versions?: LegalCtx['versions'],
): boolean {
  return canUseCoach(role) && trainerTermsNeeded(records, versions);
}

/** What is hashed: the Trainer Terms then the DPA, plain text in `locale`, separated by a blank line. */
export function trainerTermsHashInput(locale: LocaleId): string {
  const t = legalTrainerTexts(locale);
  return `${docPlainText(t.trainerTerms)}\n\n${docPlainText(t.dpa)}`;
}
