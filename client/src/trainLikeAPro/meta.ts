import type { CatalogEntry } from './catalog/types';
import type { TlStrings } from './strings';

/** The one facts line of a card: "3 d/wk · 12 wk · Beginner" (weeks only when the program has more than one). */
export function metaLine(e: CatalogEntry, s: TlStrings): string {
  const parts = [`${e.daysPerWeek} ${s.perWeek}`];
  if (e.weeks > 1) parts.push(`${e.weeks} ${s.weeksShort}`);
  parts.push(s.level[e.levels[0]]);
  return parts.join(' · ');
}
