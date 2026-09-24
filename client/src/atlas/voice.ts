/**
 * Fact → a line in Atlas's voice. Phrase books live in i18n/atlas.<lang>.ts:
 * per fact kind, per temper, a few variants (picked by the fact id, so the same
 * event reads the same everywhere and consecutive events vary). Languages
 * without a book fall back to English.
 */
import type { LocaleId } from '../i18n';
import type { CoachFact, FactKind, FactOf, Temper } from './types';
import { lineAllowed, neutralFact, SOFT_TEMPER } from './guard';
import { EN } from '../i18n/atlas.en';
import { UK } from '../i18n/atlas.uk';

export interface Fmt {
  kg: (n: number) => string;
  mmss: (sec: number) => string;
  muscle: (m: string) => string;
  exercise: (name: string) => string;
}

export type Line<K extends FactKind> = (f: FactOf<K>, x: Fmt) => string;
export type PhraseBook = {
  [K in FactKind]: Record<Temper, Line<K>[]>;
} & {
  /** "Your mom…" variants, mixed in for Drill/Merciless when enabled. */
  mom: { [K in FactKind]?: Line<K>[] };
};

const BOOKS: Partial<Record<LocaleId, PhraseBook>> = { en: EN, uk: UK };

export function phraseBook(locale: LocaleId): PhraseBook {
  return BOOKS[locale] ?? EN;
}

/** Stable small hash (FNV-1a) for picking a variant. */
export function hashId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface SayOptions {
  locale: LocaleId;
  fmt: Fmt;
  yoMama: boolean;
}

type AnyLine = (f: CoachFact, x: Fmt) => string;

function variants(book: PhraseBook, kind: FactKind, temper: Temper, mom: boolean): AnyLine[] {
  const byTemper = book[kind] as unknown as Record<Temper, AnyLine[]>;
  const extra =
    mom && temper >= 4 ? ((book.mom[kind] as unknown as AnyLine[] | undefined) ?? []) : [];
  return [...(byTemper[temper] ?? []), ...extra];
}

/** One line for a fact in the given (already guarded) temper. */
export function say(fact: CoachFact, temper: Temper, opts: SayOptions): string {
  const t: Temper = neutralFact(fact) ? (Math.min(temper, SOFT_TEMPER) as Temper) : temper;
  const book = phraseBook(opts.locale);
  const pick = (tt: Temper, mom: boolean): string | null => {
    const list = variants(book, fact.kind, tt, mom);
    if (list.length === 0) return null;
    return list[hashId(fact.id) % list.length](fact, opts.fmt);
  };
  const text = pick(t, opts.yoMama) ?? pick(SOFT_TEMPER, false) ?? '';
  return lineAllowed(text, t) ? text : (pick(SOFT_TEMPER, false) ?? '');
}
