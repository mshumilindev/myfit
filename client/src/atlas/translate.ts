/**
 * Atlas in Polish, Lithuanian and Estonian. The answer is built in English
 * with placeholders for names and weights (MARK), then each sentence is looked
 * up in that language's dictionary (written from every sentence Atlas can
 * say) and the placeholders are filled with the person's own formatting.
 * A sentence missing from the dictionary stays in English — never garbled.
 */
import type { Fmt } from './voice';
import { personaLinesEn } from './style';

export type OtherLocale = 'pl' | 'lt' | 'et';
export const isOther = (l: string): l is OtherLocale => l === 'pl' || l === 'lt' || l === 'et';

/** Names and units as placeholders, so a sentence is the same whatever the lift. */
export function markFmt(real: Fmt): Fmt {
  return {
    kg: (n) => `⟦K:${n}⟧`,
    mmss: (s) => `⟦T:${s}⟧`,
    muscle: (m) => `⟦M:${m}⟧`,
    exercise: (e) => `⟦E:${e}⟧`,
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

function fill(v: string, fmt: Fmt, comma: boolean): string {
  const m = /^⟦([KTME]):(.*)⟧$/u.exec(v);
  if (!m) return comma ? v.replace('.', ',') : v;
  const [, k, x] = m;
  if (k === 'K') return fmt.kg(Number(x));
  if (k === 'T') return fmt.mmss(Number(x));
  if (k === 'M') return fmt.muscle(x);
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
                return out.replace(/\{(\d+)\}/gu, (_, i) =>
                  fill(vals[Number(i) - 1] ?? '', fmt, !!tr),
                );
              };
              return [...heads.map(one), body ? one(body) : ''].filter(Boolean).join(' ');
            })
            .join(' '),
    )
    .join('');
}
