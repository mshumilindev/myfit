/**
 * Small text helpers for the supplement surfaces outside Health (Today check-in, session
 * summary, coach view): localized item names, doses and name lists, from the `supFx*` keys.
 * Pure; the catalog stays English-only data (see supplementCatalog.ts).
 */
import { supplementItem } from './supplementCatalog';
import type { Strings } from './i18n/en';
import type { SupplementEntry, SupplementId, SupplementUnit } from './types';

type T = Strings;

/** Localized short name of an item (the catalog's English short name as a fallback). */
export const supName = (t: T, id: SupplementId): string =>
  t.supFxName[id] ?? supplementItem(id).short;

const trim = (n: number): string => String(Math.round(n * 100) / 100);

/** "5 g", "1 × scoop": a dose in the item's unit, localized. */
export function supDoseText(t: T, dose: number, unit: SupplementUnit): string {
  const u = t.supFxUnit[unit] ?? unit;
  return unit === 'scoop' || unit === 'serving' ? `${trim(dose)} × ${u}` : `${trim(dose)} ${u}`;
}

/** "Creatine + Whey + 2 more": distinct names in the order saved, at most two, then a count. */
export function supNamesLine(t: T, entries: readonly SupplementEntry[]): string {
  const names: string[] = [];
  for (const e of entries) {
    const n = supName(t, e.itemId);
    if (!names.includes(n)) names.push(n);
  }
  const shown = names.slice(0, 2);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(' + ')} ${t.supTdMore(rest)}` : shown.join(' + ');
}
