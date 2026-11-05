/**
 * Live store search (design 25–27): starts at 3 characters, case- and diacritic-insensitive. Looks at the name,
 * the category, the parent app's name and the description. Ranking: name starts with · name contains · category ·
 * parent app · description. Hidden keywords land with SPO-500 I4 (they are never shown to people).
 */
import type { Role } from '../api';
import type { AddonStoreStrings } from '../i18n/addonStore';
import { catalogForRole } from './storeCatalog';

export const MIN_QUERY = 3;

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

const CAT_KEY = {
  recovery: 'catRecovery',
  food: 'catFood',
  insights: 'catInsights',
  look: 'catLook',
  coach: 'catCoach',
} as const;

export function searchItems(role: Role, query: string, st: AddonStoreStrings): string[] {
  const q = fold(query.trim());
  if (q.length < MIN_QUERY) return [];
  const scored: Array<{ id: string; score: number }> = [];
  for (const m of catalogForRole(role)) {
    const it = st.items[m.id as keyof typeof st.items];
    if (!it) continue;
    const name = fold(it.name);
    let score = 0;
    if (name.startsWith(q)) score = 5;
    else if (name.includes(q)) score = 4;
    else if (fold(st[CAT_KEY[m.category]]).includes(q)) score = 3;
    else if (m.parent && fold(st.items[m.parent as keyof typeof st.items]?.name ?? '').includes(q))
      score = 2;
    else if (fold(it.desc).includes(q)) score = 1;
    if (score) scored.push({ id: m.id, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.id);
}

/** Split `text` around every occurrence of `query` (diacritic-insensitive) for highlighting. */
export function highlightParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const q = fold(query.trim());
  if (q.length < MIN_QUERY) return [{ text, hit: false }];
  const out: Array<{ text: string; hit: boolean }> = [];
  // fold() keeps lengths for the Latin/Cyrillic text we ship; if it ever does not, show the text plain.
  const f = fold(text);
  if (f.length !== text.length) return [{ text, hit: false }];
  let i = 0;
  for (;;) {
    const j = f.indexOf(q, i);
    if (j < 0) break;
    if (j > i) out.push({ text: text.slice(i, j), hit: false });
    out.push({ text: text.slice(j, j + q.length), hit: true });
    i = j + q.length;
  }
  if (i < text.length) out.push({ text: text.slice(i), hit: false });
  return out.length ? out : [{ text, hit: false }];
}
