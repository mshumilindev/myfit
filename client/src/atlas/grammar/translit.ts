/**
 * Latin transliteration of Ukrainian / Russian → Cyrillic. Informal spellings
 * are ambiguous (y = и/і/й, h = г/х, the soft sign is dropped), so each word is
 * matched first against a "skeleton" index of the lexicon, then converted by
 * rules with a few variants (soft sign, и/і, г/х) that the analyser sorts out.
 */
import type { RawTok } from './tokenize';
import type { Lang } from './types';
import { knownWord, lexWords } from './lang/slav';
import { TIME } from './lex/measure';

const CYR2LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'h',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ы: 'i',
  э: 'e',
  ъ: '',
  "'": '',
};

/** Skeleton of a Cyrillic word. */
function skelCyr(w: string): string {
  let o = '';
  for (const ch of w) o += CYR2LAT[ch] ?? ch;
  return o;
}

/** Skeleton of an informal Latin spelling. */
function skelLat(w: string): string {
  return w
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/sch/g, 'shch')
    .replace(/shh/g, 'shch')
    .replace(/kh/g, 'h')
    .replace(/g/g, 'h')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/tc|c(?!h)/g, 'ts')
    .replace(/[yj]([aueo])/g, 'i$1')
    .replace(/yi|ji/g, 'i')
    .replace(/[yj]/g, 'i');
}

const indexes: Partial<Record<Lang, Map<string, string>>> = {};

function index(lang: 'uk' | 'ru'): Map<string, string> {
  let m = indexes[lang];
  if (m) return m;
  m = new Map();
  const add = (w: string): void => {
    const k = skelCyr(w);
    if (!m!.has(k)) m!.set(k, w);
  };
  for (const w of lexWords(lang)) add(w);
  for (const part of TIME[lang].split('|')) {
    const ws = part.split('=')[0].trim();
    for (const w of ws.split(/\s+/)) if (w && !w.includes('*')) add(w);
  }
  indexes[lang] = m;
  return m;
}

const MULTI_UK: [RegExp, string][] = [
  [/shch|sch/g, 'щ'],
  [/zh/g, 'ж'],
  [/kh/g, 'х'],
  [/ch/g, 'ч'],
  [/sh/g, 'ш'],
  [/ts|tc/g, 'ц'],
  [/ya|ja|ia/g, 'я'],
  [/yu|ju|iu/g, 'ю'],
  [/ye|je|ie/g, 'є'],
  [/yi|ji/g, 'ї'],
  [/yo|jo/g, 'йо'],
];
const MULTI_RU: [RegExp, string][] = [
  [/shch|sch/g, 'щ'],
  [/zh/g, 'ж'],
  [/kh/g, 'х'],
  [/ch/g, 'ч'],
  [/sh/g, 'ш'],
  [/ts|tc/g, 'ц'],
  [/ya|ja|ia/g, 'я'],
  [/yu|ju|iu/g, 'ю'],
  [/ye|je/g, 'е'],
  [/yo|jo/g, 'ё'],
];
const SINGLE_UK: Record<string, string> = {
  a: 'а',
  b: 'б',
  v: 'в',
  w: 'в',
  h: 'г',
  g: 'г',
  d: 'д',
  e: 'е',
  z: 'з',
  y: 'и',
  i: 'і',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  f: 'ф',
  c: 'ц',
  x: 'кс',
  q: 'к',
  "'": 'ь',
};
const SINGLE_RU: Record<string, string> = { ...SINGLE_UK, y: 'ы', i: 'и', h: 'х', "'": 'ь' };

function rule(w: string, lang: 'uk' | 'ru'): string {
  let s = w.toLowerCase();
  if (lang === 'uk') {
    s = s
      .replace(/tysia$/, 'тися')
      .replace(/tys$/, 'тись')
      .replace(/tsia$/, 'ться')
      .replace(/yi$|yy$/, 'ий');
  } else {
    s = s.replace(/tsya$|tsa$/, 'ться').replace(/yy$|iy$/, 'ый');
  }
  for (const [re, r] of lang === 'uk' ? MULTI_UK : MULTI_RU) s = s.replace(re, r);
  const single = lang === 'uk' ? SINGLE_UK : SINGLE_RU;
  let o = '';
  for (const ch of s) o += single[ch] ?? ch;
  return o;
}

/** Variants for lost letters: soft sign, и/і, г/х. */
function variants(c: string, lang: 'uk' | 'ru'): string[] {
  const out = new Set<string>([c]);
  const add = (x: string): void => {
    out.add(x);
  };
  for (const v of [...out]) {
    if (/[нтлсцдзр]$/.test(v)) add(v + 'ь');
    if (/т[иі]с[ья]?$/.test(v)) add(v.replace(/т[иі]с[ья]?$/, 'тись'));
  }
  for (const v of [...out]) {
    if (lang === 'uk') {
      if (/[аеоуи]і$/.test(v)) {
        add(v.slice(0, -1) + 'й');
        add(v.slice(0, -1) + 'ї');
      }
      const m = /^(.*)([иі])([^иі]*)$/.exec(v);
      if (m) add(m[1] + (m[2] === 'и' ? 'і' : 'и') + m[3]);
      if (v.includes('г')) add(v.replace(/г/g, 'х'));
    } else {
      if (v.includes('х')) add(v.replace(/х/g, 'г'));
      if (v.includes('щ')) add(v.replace(/щ/g, 'сч')); // "zaschital" = засчитал
      const m = /^(.*)ы(.*)$/.exec(v);
      if (m) add(m[1] + 'и' + m[2]);
    }
  }
  return [...out];
}

export function detransliterate(toks: RawTok[], lang: Lang): RawTok[] {
  const l = lang === 'ru' ? 'ru' : 'uk';
  const idx = index(l);
  return toks.map((t) => {
    if (t.kind !== 'w' || !/[a-z]/.test(t.norm)) return t;
    const hit = idx.get(skelLat(t.norm));
    const base = rule(t.norm, l);
    const vs = knownWord(base, l)
      ? [base]
      : variants(base, l)
          .filter((v) => knownWord(v, l))
          .slice(0, 2);
    const norm = hit ?? vs[0] ?? base;
    const alt = [...new Set([...(hit ? [hit] : []), ...vs])].filter((v) => v !== norm);
    return { ...t, norm, ...(alt.length ? { alt } : {}) };
  });
}
