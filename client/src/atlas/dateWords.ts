/**
 * Weekday and month names that `Intl` already wrote in the person's language inside an English
 * sentence ("You train most on niedziela, poniedziałek", "since lip"). The dictionary lookup needs the
 * sentence to be the same whatever the day, so each name becomes a ⟦Z:name⟧ placeholder that is
 * filled back unchanged — it is already the right word.
 */
type OtherLocale = 'pl' | 'lt' | 'et';

const cache = new Map<OtherLocale, { words: RegExp; short: RegExp }>();

function names(l: OtherLocale) {
  const long = new Set<string>();
  const short = new Set<string>();
  for (let m = 0; m < 12; m++) {
    const d = new Date(2026, m, 15);
    long.add(d.toLocaleDateString(l, { month: 'long' }));
    // "21 września" — the genitive form the day-and-month format uses.
    for (const w of d.toLocaleDateString(l, { day: 'numeric', month: 'long' }).split(/[^\p{L}]+/u))
      if (w.length >= 4) long.add(w);
    short.add(d.toLocaleDateString(l, { month: 'short' }).replace(/\./gu, ''));
    short.add(
      d
        .toLocaleDateString(l, { day: 'numeric', month: 'short' })
        .replace(/[\d.\s\u00a0]+/gu, ' ')
        .replace(/\./gu, '')
        .trim(),
    );
  }
  for (let w = 0; w < 7; w++) {
    const d = new Date(2026, 0, 4 + w); // 4 Jan 2026 is a Sunday
    long.add(d.toLocaleDateString(l, { weekday: 'long' }));
  }
  const alt = (s: Set<string>) =>
    [...s]
      .filter((x) => x.length >= 3)
      .sort((a, b) => b.length - a.length)
      .map((x) => x.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('|');
  return {
    words: new RegExp(`(?<!\\p{L})(${alt(long)})(?!\\p{L})`, 'giu'),
    // Short months only right after a number ("12 sie"): "lip", "lie" are words elsewhere.
    short: new RegExp(`(?<=\\d[\\s\\u00a0])(${alt(short)})(?!\\p{L})`, 'giu'),
  };
}

export function neutralDates(s: string, l: OtherLocale): string {
  let r = cache.get(l);
  if (!r) cache.set(l, (r = names(l)));
  return s.replace(r.short, (m) => `⟦Z:${m}⟧`).replace(r.words, (m) => `⟦Z:${m}⟧`);
}
