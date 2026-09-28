/**
 * Tokenizer and sentence splitter. Language-neutral: words (with inner
 * apostrophes / hyphens — "з'їв", "pull-up", "kg-ga"), numbers split from a glued
 * unit ("5км" → 5 + км, "3x10" → 3 x 10, "10k" → 10 k), emoji runs, punctuation runs.
 */

export interface RawTok {
  text: string;
  /** Lower-cased, apostrophes unified to ', ё → е. */
  norm: string;
  start: number;
  kind: 'w' | 'n' | 'p' | 'e';
  /** Alternative normalisations (transliteration variants). */
  alt?: string[];
}

const APOS = /[’ʼ`′‘´]/g;

export function normWord(s: string): string {
  return s.toLowerCase().replace(APOS, "'").replace(/ё/g, 'е');
}

/** Strip Latin diacritics (Polish, Lithuanian, Estonian) — typing without them is common. */
export function fold(s: string): string {
  return s.replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// One regex pass. Order matters: emoji, number(+glued unit), word, punctuation.
const RE =
  /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)|(\d+(?:[.,]\d+)?)|([\p{L}\p{M}](?:[\p{L}\p{M}\d]|['’ʼ`](?=[\p{L}])|-(?=[\p{L}\d]))*)|(\.{2,}|…|[?!]+|[.,;:()\-–—"«»“”/+=*#%&@[\]{}<>|~^_\\]|\S)/gu;

export function tokenize(text: string): RawTok[] {
  const out: RawTok[] = [];
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text))) {
    const t = m[0];
    const start = m.index;
    if (m[1]) out.push({ text: t, norm: t, start, kind: 'e' });
    else if (m[2]) {
      // Glued "3x10" / "5х5": number x number.
      out.push({ text: t, norm: t.replace(',', '.'), start, kind: 'n' });
    } else if (m[3]) {
      const prev = out[out.length - 1];
      // "5км", "100kg", "2h", "10k": a word glued right after a number.
      if (prev && prev.kind === 'n' && prev.start + prev.text.length === start) {
        const xm = /^([xх×])(\d.*)?$/iu.exec(t);
        if (xm) {
          out.push({ text: xm[1], norm: 'x', start, kind: 'w' });
          if (xm[2]) {
            out.push({ text: xm[2], norm: xm[2], start: start + 1, kind: 'n' });
          }
          continue;
        }
      }
      // Word glued with digits inside ("x10" handled above) — split trailing digits off.
      const dm = /^(\p{L}+)(\d+)$/u.exec(t);
      if (dm && /^[xх×]$/iu.test(dm[1])) {
        out.push({ text: dm[1], norm: 'x', start, kind: 'w' });
        out.push({ text: dm[2], norm: dm[2], start: start + dm[1].length, kind: 'n' });
        continue;
      }
      out.push({ text: t, norm: normWord(t), start, kind: 'w' });
    } else out.push({ text: t, norm: t, start, kind: 'p' });
  }
  return out;
}

const ABBR = new Set([
  'e',
  'g',
  'i',
  'eg',
  'ie',
  'etc',
  'vs',
  'approx',
  'min',
  'max',
  'sec',
  'hr',
  'hrs',
  'kg',
  'km',
  'mr',
  'mrs',
  'dr',
  'st',
  'т',
  'д',
  'п',
  'ч',
  'напр',
  'див',
  'тис',
  'хв',
  'год',
  'сек',
  'мин',
  'ок',
  'np',
  'tj',
  'itd',
  'pvz',
  'nt',
  'jne',
  'nt',
]);

/** Split a message into sentences (token index ranges). */
export function splitSentences(text: string, toks: RawTok[]): [number, number][] {
  const out: [number, number][] = [];
  let s = 0;
  const upperNext = (j: number): boolean => {
    const n = toks[j];
    if (!n) return true;
    if (n.kind === 'e') return true;
    return /^[\p{Lu}\d]/u.test(n.text) || n.kind === 'p';
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    // Newline between tokens ends a sentence.
    if (i > s) {
      const prev = toks[i - 1];
      const gap = text.slice(prev.start + prev.text.length, t.start);
      if (/\n/.test(gap)) {
        out.push([s, i]);
        s = i;
      }
    }
    if (t.kind !== 'p') continue;
    let end = false;
    if (/[?!]/.test(t.text)) end = true;
    else if (t.text === '.') {
      const prev = toks[i - 1];
      const abbr = prev && prev.kind === 'w' && ABBR.has(prev.norm);
      end = !abbr || upperNext(i + 1);
      // "e.g." in the middle: single letters with dots.
      if (abbr && prev.norm.length === 1 && !upperNext(i + 1)) end = false;
    } else if (t.text === '…' || /^\.{2,}$/.test(t.text)) {
      const n = toks[i + 1];
      end = !n || /^[\p{Lu}]/u.test(n.text) || n.kind === 'e';
    }
    if (!end) continue;
    let j = i + 1;
    // Closing brackets / emoji / further punctuation attach to the finished sentence.
    while (j < toks.length && (toks[j].kind === 'e' || /^[)"»”\]]+$/.test(toks[j].text))) j++;
    out.push([s, j]);
    s = j;
    i = j - 1;
  }
  if (s < toks.length) out.push([s, toks.length]);
  return out.filter(([a, b]) => b > a && toks.slice(a, b).some((t) => t.kind !== 'p'));
}
