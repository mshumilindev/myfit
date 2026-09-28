/**
 * Atlas in Polish, Lithuanian and Estonian. The answer is built in English
 * with placeholders for names and weights (MARK), then each sentence is looked
 * up in that language's dictionary (written from every sentence Atlas can
 * say) and the placeholders are filled with the person's own formatting.
 * A sentence missing from the dictionary stays in English — never garbled.
 */
import type { Fmt } from './voice';
import { personaLinesEn } from './style';
import * as N from './num';

export type OtherLocale = 'pl' | 'lt' | 'et';
export const isOther = (l: string): l is OtherLocale => l === 'pl' || l === 'lt' || l === 'et';

/** Names and units as placeholders, so a sentence is the same whatever the lift. */
export function markFmt(real: Fmt): Fmt {
  return {
    kg: (n) => `⟦K:${n}⟧`,
    mmss: (s) => `⟦T:${s}⟧`,
    muscle: (m) => `⟦M:${m}⟧`,
    exercise: (e) => `⟦E:${e}⟧`,
    // Spans: the words (and plural rules) are the target language's, filled in after.
    span: (ms) => `⟦D:${Math.round(ms)}⟧`,
    ago: (ms) => `⟦A:${Math.round(ms)}⟧`,
    daysAgo: (d) => `⟦Y:${Math.round(d)}⟧`,
    shown: real.exercise,
  };
}

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?…])\s+(?=[^a-z])/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** "Bench: ⟦K:80⟧ × 8" → key "Bench: {1} × {2}" + the values in order. */
export function template(s: string): { key: string; vals: string[] } {
  const vals: string[] = [];
  const key = s.replace(/⟦[^⟧]*⟧|\d+(?:[.,]\d+)?/gu, (m) => {
    vals.push(m);
    return `{${vals.length}}`;
  });
  return { key, vals };
}

/**
 * A placeholder → the person's formatting. `l` is the language of the
 * sentence around it: a sentence the dictionary lacks stays English, and so do
 * its spans ("3 weeks ago", not "3 tygodnie temu" inside English).
 */
function fill(v: string, fmt: Fmt, comma: boolean, l: OtherLocale | 'en'): string {
  const m = /^⟦([KTMEDAY]):(.*)⟧$/u.exec(v);
  if (!m) return comma ? v.replace('.', ',') : v;
  const [, k, x] = m;
  if (k === 'K') return fmt.kg(Number(x));
  if (k === 'T') return fmt.mmss(Number(x));
  if (k === 'M') return fmt.muscle(x);
  if (k === 'D') return N.span(l, Number(x));
  if (k === 'A') return N.ago(l, Number(x));
  if (k === 'Y') return N.daysAgo(l, Number(x));
  return fmt.exercise(x);
}

export type Dict = Record<string, string>;

let persona: string[] | null = null;
/** Persona openers at the start of a sentence, longest first; the rest capitalised. */
function stripPersona(s: string): [string[], string] {
  persona ??= personaLinesEn().sort((a, b) => b.length - a.length);
  const heads: string[] = [];
  let rest = s;
  for (let guard = 0; guard < 3; guard++) {
    const p = persona.find(
      (x) => x.length >= 3 && rest.startsWith(x) && rest.length > x.length + 1,
    );
    if (!p) break;
    heads.push(p);
    rest = rest.slice(p.length).trimStart();
  }
  if (!heads.length) return [[], s];
  return [heads, rest ? rest[0].toUpperCase() + rest.slice(1) : ''];
}
const dicts: Partial<Record<OtherLocale, Dict>> = {};

/** Load a language's dictionary (split into its own chunk). */
export async function loadDict(l: OtherLocale): Promise<void> {
  if (dicts[l]) return;
  const mod =
    l === 'pl'
      ? await import('../i18n/atlasDict.pl')
      : l === 'lt'
        ? await import('../i18n/atlasDict.lt')
        : await import('../i18n/atlasDict.et');
  dicts[l] = mod.DICT;
}
export function setDict(l: OtherLocale, d: Dict): void {
  dicts[l] = d;
}

/** Text built with markFmt → the person's language (sentence by sentence). */
export function translateOut(text: string, l: OtherLocale, fmt: Fmt): string {
  const d = dicts[l] ?? {};
  return text
    .split(/(\n+)/u)
    .map((block) =>
      /^\n+$/u.test(block)
        ? block
        : splitSentences(block)
            .map((s) => {
              // "Yo bro! " / "Real talk: " in front — translated on its own, then the answer.
              const [heads, body] = stripPersona(s);
              const one = (t: string) => {
                const { key, vals } = template(t);
                const tr = d[key];
                const out = tr ?? key;
                const res = out.replace(/\{(\d+)\}/gu, (_, i) =>
                  fill(vals[Number(i) - 1] ?? '', fmt, !!tr, tr ? l : 'en'),
                );
                // A span opening the sentence ("mniej więcej 3 tygodnie…") starts it upper-case.
                const lead = /^\{(\d+)\}/u.exec(out);
                return lead && /^⟦[DAY]:/u.test(vals[Number(lead[1]) - 1] ?? '') ? N.cap(res) : res;
              };
              return [...heads.map(one), body ? one(body) : ''].filter(Boolean).join(' ');
            })
            .join(' '),
    )
    .join('');
}
