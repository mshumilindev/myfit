/**
 * Share dictionary (Coach, M5). Separate from `coach.ts` / `coachChat.ts` so parallel agents never collide.
 *
 *   const { sh, locale } = useShareT();   sh.kind.program, sh.pickTitle('Oleh') ...
 */
import { useT, type LocaleId } from './index';
import { shareEn } from './coachShare.en';
import { shareUk } from './coachShare.uk';
import { sharePl } from './coachShare.pl';
import { shareLt } from './coachShare.lt';
import { shareEt } from './coachShare.et';

export type ShareStrings = typeof shareEn;

export const SHARE_LOCALES: Record<LocaleId, ShareStrings> = {
  en: shareEn,
  uk: shareUk,
  pl: sharePl,
  lt: shareLt,
  et: shareEt,
};

export const shareStrings = (locale: LocaleId): ShareStrings => SHARE_LOCALES[locale];

export function useShareT(): { sh: ShareStrings; locale: LocaleId } {
  const { locale } = useT();
  return { sh: SHARE_LOCALES[locale], locale };
}
