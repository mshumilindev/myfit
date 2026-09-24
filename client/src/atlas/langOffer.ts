/**
 * "You wrote in another language — switch the app?" Atlas understands the
 * question in whatever language it came in, answers in the app's language,
 * and offers the switch once — again only after the question language changes.
 */
import type { LocaleId } from '../i18n';

/** Best guess at the language a message is written in (null = can't tell). */
export function detectLang(text: string): LocaleId | null {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return null;
  const cyr = (letters.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  if (cyr / letters.length > 0.5) return 'uk';
  if (/[ąęłńśźż]/i.test(text)) return 'pl';
  if (/[ėįųūčš]/i.test(text)) return 'lt';
  if (/[õäöü]/i.test(text)) return 'et';
  return /^[a-z]+$/i.test(letters) ? 'en' : null;
}

export interface LangOfferState {
  /** The question language we last offered to switch to (null = none pending). */
  offered: LocaleId | null;
}

/**
 * Decide whether to offer a switch for this message. Returns the language to
 * offer (or null) and the next state. Writing in the app's own language resets
 * the memory, so a later change of language gets one fresh offer.
 */
export function langOffer(
  text: string,
  app: LocaleId,
  state: LangOfferState,
): { offer: LocaleId | null; state: LangOfferState } {
  const q = detectLang(text);
  if (!q) return { offer: null, state };
  if (q === app) return { offer: null, state: { offered: null } };
  if (q === state.offered) return { offer: null, state };
  return { offer: q, state: { offered: q } };
}

const KEY = 'spotter.atlasLangOffer';
export function loadOfferState(): LangOfferState {
  try {
    const v = localStorage.getItem(KEY);
    return { offered: (v as LocaleId | null) || null };
  } catch {
    return { offered: null };
  }
}
export function saveOfferState(s: LangOfferState): void {
  try {
    if (s.offered) localStorage.setItem(KEY, s.offered);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode — the offer may repeat next visit, harmless */
  }
}
