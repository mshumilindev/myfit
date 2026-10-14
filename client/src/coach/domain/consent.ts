import type { Category, Consent, Level, LogMode } from './types';
import { CATEGORIES } from './types';

const RANK: Record<Level, number> = { off: 0, effects: 1, full: 2 };

export const levelRank = (l: Level): number => RANK[l];
/** Is `have` at least `need`? */
export const atLeast = (have: Level, need: Level): boolean => RANK[have] >= RANK[need];

export const ALL_OFF: Consent = Object.freeze(
  Object.fromEntries(CATEGORIES.map((c) => [c, 'off'])) as Record<Category, Level>,
);

/** Program-only clients do not use the app: every category is forced `off` (plan 15). */
export function effectiveConsent(mode: LogMode, consent: Consent): Consent {
  return mode === 'program' ? ALL_OFF : consent;
}

/** Can the trainer see anything of this category? */
export const sees = (consent: Consent, cat: Category): boolean => consent[cat] !== 'off';
/** Can the trainer see every entry of this category? */
export const seesFull = (consent: Consent, cat: Category): boolean => consent[cat] === 'full';

/** Categories the trainer could ask the client to share: not program-only, not already Full. */
export function askable(mode: LogMode, consent: Consent): Category[] {
  if (mode === 'program') return [];
  return CATEGORIES.filter((c) => consent[c] !== 'full');
}

/** Short summary: "Sets and weights, injuries" | "Totals only" (words are codes, the UI localises). */
export function sharingSummary(consent: Consent): 'sets+injury' | 'sets' | 'totals' | 'none' {
  if (consent.sets === 'full') return consent.injury !== 'off' ? 'sets+injury' : 'sets';
  return consent.totals !== 'off' ? 'totals' : 'none';
}
