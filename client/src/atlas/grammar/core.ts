/** Internal token model shared by the language modules, the segmenter and the parser. */
import type {
  AdverbialSem,
  Case,
  ClauseKind,
  Feats,
  Lang,
  Modality,
  Pos,
  Token,
  Unit,
  WhWord,
} from './types';
import type { RawTok } from './tokenize';

/** Lexical flags a word (or multi-word expression) carries into parsing. */
export interface X {
  wh?: WhWord;
  /** Subordinator; 'amb' = that / що (relative or complement by context). */
  sub?: ClauseKind | 'amb';
  coord?: 'and' | 'but' | 'or' | 'so';
  /** Correlative "то"/"then" opening the main clause after a conditional. */
  corr?: boolean;
  /** Question particle: чи, czy, ar, kas, ли, хіба, невже. */
  qp?: boolean;
  neg?: boolean;
  /** Negative quantifier / pronoun / adverb: nothing, never, нічого, ніколи. */
  negq?: boolean;
  modal?: Modality;
  /** Modal that needs "to" before the verb (want to, need to, have to). */
  modalTo?: boolean;
  aux?: 'be' | 'have' | 'do' | 'will' | 'would' | 'fut' | 'going' | 'used';
  cop?: boolean;
  pron?: { p: 1 | 2 | 3; n: 'sg' | 'pl'; c?: Case };
  /** Predicative word (можна, треба, варто, нормально); modality when modal. */
  predic?: Modality | 'eval';
  /** Impersonal verb taking a dative experiencer (хочеться, здається, skauda). */
  impers?: boolean;
  /** Verb / adjective that takes a complement clause (think, know, впевнений). */
  cogn?: boolean;
  /** Discourse marker skipped at clause start (so, ok, короче, ну). */
  disc?: boolean;
  time?: string;
  unit?: Unit;
  num?: number;
  /** Tag-question word (right, так, prawda, eks). */
  tag?: boolean;
  please?: boolean;
  sem?: AdverbialSem;
  /** Hortative: let's, давай, давайте. */
  hort?: boolean;
  /** Continuation token of a multi-word expression (skip in parsing). */
  cont?: boolean;
  /** "what about", "як щодо". */
  about?: boolean;
  rhet?: boolean;
  /** "or not" / "чи ні" closing a yes/no question. */
  orNot?: boolean;
  /** Possessive / locative "in me" — "в мене", "у меня" (possession construction). */
  poss?: boolean;
  /** Interjection-like exclamation opener (wow, ура). */
  excl?: boolean;
  /** Countable noun (for скільки/how many). */
  count?: boolean;
  /** English verb form: base / 3sg / past / past participle / -ing. */
  vf?: 'base' | 's' | 'past' | 'pp' | 'pastpp' | 'ing';
  /** Vocative "atlas". */
  voc?: boolean;
  /** Attributive participle / adjective inside a participial phrase (not a zero-copula predicate). */
  attr?: boolean;
}

export interface Cand {
  pos: Pos;
  lemma: string;
  feats: Feats;
  x?: X;
}

export interface T extends Token {
  i: number;
  x: X;
  /** Flags from multi-word expressions / units / time (survive candidate choice). */
  mx: X;
  cands: Cand[];
  /** Diacritic-folded norm used for lexicon lookups (Latin languages). */
  lk: string;
  /** Token belongs to punctuation / emoji. */
  kind: RawTok['kind'];
}

export interface MWE {
  words: string[];
  pos?: Pos;
  lemma?: string;
  x: X;
  /** Only when followed by a word satisfying this test (checked on the raw next token). */
  cond?: (next: T | undefined) => boolean;
}

export interface LangSpec {
  lang: Lang;
  prodrop: boolean;
  /** Language-specific pre-pass on raw tokens (contractions, transliteration). */
  expand?(toks: RawTok[]): RawTok[];
  analyze(norm: string, lk: string): Cand[];
  mwe: MWE[];
  /** Contextual disambiguation: sets pos/lemma/feats/x on each token. */
  disambig(ts: T[]): void;
  /** Can this (noun / pronoun / adjective) token be in the nominative? */
  nomCapable(t: T): boolean;
  /** Verb / adjective taking a complement clause (think, know, знати, впевнений). */
  cogn?(t: T): boolean;
}

export const words = (s: string): string[] => s.split(/\s+/).filter(Boolean);
export const wset = (s: string): Set<string> => new Set(words(s));

export function cand(pos: Pos, lemma: string, feats: Feats = {}, x?: X): Cand {
  return x ? { pos, lemma, feats, x } : { pos, lemma, feats };
}

/** Apply a candidate to the token (the final choice). */
export function choose(t: T, c: Cand): void {
  t.pos = c.pos;
  t.lemma = c.lemma;
  t.feats = { ...c.feats };
  t.x = { ...(c.x ?? {}), ...t.mx };
}

/** Union of the flags of all candidates (for look-ahead before a token is resolved). */
export function ux(t: T | undefined): X {
  if (!t) return {};
  let o: X = { ...t.mx };
  for (const c of t.cands) if (c.x) o = { ...o, ...c.x };
  return { ...o, ...t.x };
}

export function pick(t: T, pos: Pos | Pos[], pred?: (c: Cand) => boolean): boolean {
  const ps = Array.isArray(pos) ? pos : [pos];
  const c = t.cands.find((k) => ps.includes(k.pos) && (!pred || pred(k)));
  if (!c) return false;
  choose(t, c);
  return true;
}

export const has = (t: T | undefined, pos: Pos): boolean =>
  !!t && t.cands.some((c) => c.pos === pos);

const mweIndex = new WeakMap<MWE[], Map<string, MWE[]>>();

function indexOf(list: MWE[]): Map<string, MWE[]> {
  let m = mweIndex.get(list);
  if (m) return m;
  m = new Map();
  for (const e of list) {
    const w = e.words[0];
    const k = w.endsWith('*') ? '*' : w;
    const arr = m.get(k) ?? [];
    arr.push(e);
    m.set(k, arr);
  }
  mweIndex.set(list, m);
  return m;
}

/** Multi-word expressions: longest match first; first token gets flags, the rest `cont`. */
export function applyMwe(ts: T[], list: MWE[], keyOf: (t: T) => string = (t) => t.norm): void {
  const idx = indexOf(list);
  const stars = idx.get('*') ?? [];
  for (let i = 0; i < ts.length; i++) {
    if (ts[i].x.cont || ts[i].kind !== 'w') continue;
    const cands = idx.get(keyOf(ts[i]));
    if (!cands && !stars.length) continue;
    let best: MWE | undefined;
    for (const m of cands ? [...cands, ...stars] : stars) {
      if (best && m.words.length <= best.words.length) continue;
      if (i + m.words.length > ts.length) continue;
      let ok = true;
      for (let k = 0; k < m.words.length; k++) {
        const w = m.words[k];
        const key = keyOf(ts[i + k]);
        if (w.endsWith('*') ? !key.startsWith(w.slice(0, -1)) : key !== w) {
          ok = false;
          break;
        }
      }
      if (ok && m.cond && !m.cond(ts[i + m.words.length])) ok = false;
      if (ok) best = m;
    }
    if (!best) continue;
    const t = ts[i];
    const mpos = best.pos ?? (best.x.wh && !best.x.rhet ? 'ADV' : undefined);
    if (mpos) {
      t.pos = mpos;
      t.cands = [cand(mpos, best.lemma ?? (best.pos ? best.words.join(' ') : t.norm), {}, best.x)];
    }
    t.lemma = best.lemma ?? t.lemma;
    t.x = { ...t.x, ...best.x };
    t.mx = { ...t.mx, ...best.x };
    for (let k = 1; k < best.words.length; k++) {
      const c = ts[i + k];
      c.x = { ...c.x, cont: true };
      c.mx = { ...c.mx, cont: true };
      if (best.pos) {
        c.pos = best.pos === 'SCONJ' || best.pos === 'CONJ' ? best.pos : c.pos;
        c.cands = [cand(c.pos, c.norm, {}, { cont: true })];
      }
    }
    i += best.words.length - 1;
  }
}

const memos: Map<string, unknown>[] = [];

/** Drop all per-word caches (cold-start benchmarks). */
export function clearMemos(): void {
  for (const m of memos) m.clear();
}

/** Small bounded memo for pure per-word functions (morphological analysis). */
export function memo<V>(fn: (k: string) => V, cap = 20000): ((k: string) => V) & { clear(): void } {
  const m = new Map<string, V>();
  memos.push(m as Map<string, unknown>);
  const f = ((k: string): V => {
    const hit = m.get(k);
    if (hit !== undefined) return hit;
    const v = fn(k);
    if (m.size >= cap) m.clear();
    m.set(k, v);
    return v;
  }) as ((k: string) => V) & { clear(): void };
  f.clear = () => m.clear();
  return f;
}

/** Build MWE entries from a compact "a b c=flag" style map. */
export function mw(words_: string, x: X, pos?: Pos, cond?: MWE['cond']): MWE {
  return { words: words(words_), x, pos, cond };
}

export const isPunct = (t: T | undefined): boolean => !!t && t.pos === 'PUNCT';
export const isWord = (t: T | undefined): boolean => !!t && t.kind === 'w';
export const isVerbal = (t: T | undefined): boolean => !!t && (t.pos === 'VERB' || t.pos === 'AUX');

/** Intransitive verbs that take a post-verbal subject ("пішов дощ", "болить коліно"). */
export const INTRANS =
  /^(піти|прийти|початися|статися|закінчитися|з'явитися|пройти|минути|пойти|начаться|случиться|прийти|боліти|болеть|хрустіти|клацати|впасти)$/;
