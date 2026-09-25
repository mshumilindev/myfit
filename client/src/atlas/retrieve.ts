/**
 * Understanding by example. Every topic has 14–20 real phrasings per language
 * (kb/). A question is compared with all of them: words are stemmed (so
 * «відпочивати / відпочинок / відпочиваю» meet), typo-tolerant, weighted by
 * how rare they are across the base (IDF — "bench" says more than "my"), and
 * scored cosine-style. The best topic wins when it's clearly ahead.
 * Pure and offline; the index is built once, lazily.
 */
import { editDistance, normalize } from './nlu';
import { KB } from './kb';
import { SYNONYMS } from './kb/synonyms';

const STOP = new Set(
  (
    'i me my mine you your yours we our us he she it its they them the a an to of in on for from by with at as ' +
    'and or but so if then than is are am was were be been being do does did done have has had having ' +
    'this that these those there here what which who whom whose how why when where can could should would will shall ' +
    'may might must just about some any all very really please pls ok okay hey yo tell me know want need get got ' +
    'not no yes also too more much many lot bit kind sort like um uh ' +
    'я мені мене мій моя моє мої мною ти тобі тебе твій твоя твоє твої ми нам нас наш він вона воно вони їх їм ' +
    'в у на з із зі до по за від для про при над під між через а і й та але чи що як чому коли де хто який яка яке які ' +
    'це той та те ті цей ця ці то ж же би б бо ну ось от вже ще теж також лише тільки просто дуже трохи можна треба ' +
    'мабуть скажи розкажи підкажи будь ласка є був була були буде мати маю маєш мене ' +
    'я мне меня мой моя мое мои ты тебе тебя твой мы нам нас он она оно они их им в во на с со к ко по за от для о об ' +
    'при над под между через а и но или что как почему когда где кто какой какая какое какие это тот та то эти ' +
    'же бы ну вот уже еще тоже также только просто очень немного можно надо нужно скажи подскажи пожалуйста есть был была'
  ).split(' '),
);

// Longest first. Ukrainian/Russian inflections, then English suffixes.
const CYR_ENDINGS = [
  'ування',
  'ювання',
  'ення',
  'ання',
  'іння',
  'ість',
  'ості',
  'ами',
  'ями',
  'ові',
  'еві',
  'ому',
  'ому',
  'ого',
  'ими',
  'ій',
  'ий',
  'ій',
  'ої',
  'ою',
  'ею',
  'ах',
  'ях',
  'ам',
  'ям',
  'ів',
  'ей',
  'ти',
  'ть',
  'ся',
  'сь',
  'ую',
  'юю',
  'ать',
  'ять',
  'ить',
  'еть',
  'ешь',
  'ишь',
  'ет',
  'ит',
  'ют',
  'ут',
  'ую',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ый',
  'ой',
  'ом',
  'ем',
  'а',
  'я',
  'у',
  'ю',
  'о',
  'е',
  'и',
  'і',
  'ї',
  'ь',
  'й',
];
const EN_ENDINGS = ['ations', 'ation', 'ings', 'ing', 'ness', 'ies', 'ied', 'ed', 'ly', 's'];

export function stem(w: string): string {
  if (w.length <= 3) return w;
  const cyr = /[а-яіїєґ]/.test(w);
  const list = cyr ? CYR_ENDINGS : EN_ENDINGS;
  for (const e of list)
    if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, w.length - e.length);
  return w;
}

// Words too common to carry meaning on their own, even if a group lists them.
const RISKY = new Set([
  'раз',
  'так',
  'all',
  'what',
  'when',
  'time',
  'down',
  'hit',
  'how many',
  'how much',
]);

/** Word or its stem → concept id ("~12"); phrases handled first. */
let concepts: { word: Map<string, string>; phrases: [string, string][] } | null = null;
function conceptIndex() {
  const word = new Map<string, string>();
  const phrases: [string, string][] = [];
  SYNONYMS.forEach((g, i) => {
    const id = `~${i}`;
    for (const raw of g) {
      const w = normalize(raw);
      if (!w || RISKY.has(w) || STOP.has(w)) continue;
      if (w.includes(' ')) phrases.push([` ${w} `, id]);
      else {
        word.set(w, id);
        if (w.length >= 5) word.set(stem(w), id);
      }
    }
  });
  phrases.sort((a, b) => b[0].length - a[0].length);
  return { word, phrases };
}

const YOU = new Set([
  'you',
  'your',
  'yours',
  'u',
  'ти',
  'тобі',
  'тебе',
  'твій',
  'твоя',
  'твоє',
  'твої',
  'ты',
  'тебя',
  'тебе',
  'твой',
  'твоя',
]);
const ME = new Set([
  'i',
  'my',
  'me',
  'mine',
  'im',
  'я',
  'мій',
  'моя',
  'моє',
  'мої',
  'мене',
  'мені',
  'мой',
  'мое',
  'мои',
  'меня',
  'мне',
]);
const STOP_EXTRA = new Set([
  'im',
  'ive',
  'id',
  'ill',
  'dont',
  'cant',
  'doesnt',
  'didnt',
  'isnt',
  'wont',
  'whats',
  'hows',
  'thats',
  'не',
  'ні',
  'нет',
]);

export function terms(text: string): string[] {
  concepts ??= conceptIndex();
  let p = ` ${normalize(text)} `;
  // Multi-word concepts ("work out", "жим лежачи") become one token.
  for (const [ph, id] of concepts.phrases) if (p.includes(ph)) p = p.split(ph).join(` ${id} `);
  const out: string[] = [];
  for (const w of p.split(' ')) {
    // Who it's about matters: "do YOU lift" (chat) vs "do I…" (your log).
    if (YOU.has(w)) {
      out.push('~you');
      continue;
    }
    if (ME.has(w)) {
      out.push('~me');
      continue;
    }
    if (!w || STOP.has(w) || STOP_EXTRA.has(w)) continue;
    if (w.startsWith('~')) {
      out.push(w);
      continue;
    }
    const st = stem(w);
    if (STOP.has(st) || STOP_EXTRA.has(st)) continue;
    out.push(concepts.word.get(w) ?? concepts.word.get(st) ?? st);
  }
  return out;
}

function same(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  // One is the other plus an ending ("присід" / "присіда"), or a single typo.
  if (s.length >= 5 && l.startsWith(s) && l.length - s.length <= 3) return true;
  return s.length >= 6 && Math.abs(a.length - b.length) <= 1 && editDistance(a, b, 1) <= 1;
}

interface Example {
  id: string;
  terms: string[];
  weight: number;
}
interface Topic {
  id: string;
  tf: Map<string, number>;
  len: number;
}
interface Index {
  grams: { id: string; v: Map<string, number>; norm: number }[];
  gidf: Map<string, number>;
  exGrams: { id: string; v: Map<string, number>; norm: number }[];
  examples: Example[];
  idf: Map<string, number>;
  n: number;
  topics: Topic[];
  tidf: Map<string, number>;
  avgLen: number;
  vocab: string[];
}
let index: Index | null = null;

function build(): Index {
  const examples: Example[] = [];
  const topics: Topic[] = [];
  for (const [id, e] of Object.entries(KB)) {
    const tf = new Map<string, number>();
    let len = 0;
    for (const q of [...e.ex, ...e.exUk]) {
      const t = [...new Set(terms(q))];
      if (!t.length) continue;
      examples.push({ id, terms: t, weight: 0 });
      for (const x of t) tf.set(x, (tf.get(x) ?? 0) + 1);
      len += t.length;
    }
    topics.push({ id, tf, len });
  }
  const df = new Map<string, number>();
  for (const ex of examples) for (const t of ex.terms) df.set(t, (df.get(t) ?? 0) + 1);
  const n = examples.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / d));
  for (const ex of examples)
    ex.weight = Math.sqrt(ex.terms.reduce((s, t) => s + (idf.get(t) ?? 0) ** 2, 0));
  const tdf = new Map<string, number>();
  for (const tp of topics) for (const t of tp.tf.keys()) tdf.set(t, (tdf.get(t) ?? 0) + 1);
  const tidf = new Map<string, number>();
  const T = topics.length;
  for (const [t, d] of tdf) tidf.set(t, Math.log(1 + (T - d + 0.5) / (d + 0.5)));
  const avgLen = topics.reduce((s, t) => s + t.len, 0) / Math.max(1, T);
  // Character 4-grams of the meaningful words — sturdy against Ukrainian
  // endings and typos where word stems fall short.
  const topicGrams = new Map<string, Map<string, number>>();
  const exGramsRaw: { id: string; g: Map<string, number> }[] = [];
  for (const [id, e] of Object.entries(KB)) {
    const acc = new Map<string, number>();
    for (const q of [...e.ex, ...e.exUk]) {
      const g = gramsOf(q);
      exGramsRaw.push({ id, g });
      for (const [k, v] of g) acc.set(k, (acc.get(k) ?? 0) + v);
    }
    topicGrams.set(id, acc);
  }
  const gdf = new Map<string, number>();
  for (const acc of topicGrams.values())
    for (const k of acc.keys()) gdf.set(k, (gdf.get(k) ?? 0) + 1);
  const gidf = new Map<string, number>();
  for (const [k, d] of gdf) gidf.set(k, Math.log(1 + topics.length / d));
  const vec = (g: Map<string, number>) => {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [k, c] of g) {
      const w = (1 + Math.log(c)) * (gidf.get(k) ?? 0);
      v.set(k, w);
      norm += w * w;
    }
    return { v, norm: Math.sqrt(norm) || 1 };
  };
  const grams = [...topicGrams].map(([id, g]) => ({ id, ...vec(g) }));
  const exGrams = exGramsRaw.map(({ id, g }) => ({ id, ...vec(g) }));
  return { grams, gidf, exGrams, examples, idf, n, topics, tidf, avgLen, vocab: [...tdf.keys()] };
}

function gramsOf(text: string): Map<string, number> {
  const g = new Map<string, number>();
  for (const w of normalize(text).split(' ')) {
    if (!w || STOP.has(w) || STOP_EXTRA.has(w)) continue;
    const x = `_${w}_`;
    if (x.length <= 4) g.set(x, (g.get(x) ?? 0) + 1);
    for (let i = 0; i + 4 <= x.length; i++) {
      const k = x.slice(i, i + 4);
      g.set(k, (g.get(k) ?? 0) + 1);
    }
  }
  return g;
}

export interface Match {
  id: string;
  score: number;
}

const K1 = 1.2;
const B = 0.5;

/** Topics ranked by how close the question is to their examples. */
export function retrieve(question: string, limit = 5): Match[] {
  index ??= build();
  const ix = index;
  const q = [...new Set(terms(question))];
  if (!q.length) return [];
  // Each query word → the known words it matches (exact, ending, one typo).
  const near = q.map((t) => (ix.tidf.has(t) ? [t] : ix.vocab.filter((v) => same(t, v))));
  const qidf = near.map((vs) => Math.max(0, ...vs.map((v) => ix.tidf.get(v) ?? 0)));
  const maxPossible = qidf.reduce((s, w) => s + w * (K1 + 1), 0) || 1;

  // 1) Topic as a whole (BM25 over all its phrasings).
  const topic = new Map<string, number>();
  for (const tp of ix.topics) {
    let sc = 0;
    for (let i = 0; i < q.length; i++) {
      let tf = 0;
      for (const v of near[i]) tf += tp.tf.get(v) ?? 0;
      if (!tf) continue;
      sc += (qidf[i] * (tf * (K1 + 1))) / (tf + K1 * (1 - B + (B * tp.len) / ix.avgLen));
    }
    if (sc) topic.set(tp.id, sc / maxPossible);
  }
  // 2) The single closest phrasing (cosine over IDF weights).
  const qw = near.map((vs) => Math.max(0, ...vs.map((v) => ix.idf.get(v) ?? 0)));
  const qNorm = Math.sqrt(qw.reduce((s, w) => s + w * w, 0)) || 1;
  const best = new Map<string, number>();
  for (const ex of ix.examples) {
    let dot = 0;
    for (let i = 0; i < q.length; i++)
      if (near[i].some((v) => ex.terms.includes(v))) dot += qw[i] * qw[i];
    if (!dot) continue;
    const sc = dot / (qNorm * (ex.weight || 1));
    if (sc > (best.get(ex.id) ?? 0)) best.set(ex.id, sc);
  }
  // 3) Character-level closeness to the topic and to its closest phrasing.
  const qg = gramsOf(question);
  const qv = new Map<string, number>();
  let qn = 0;
  for (const [k, c] of qg) {
    const w = (1 + Math.log(c)) * (ix.gidf.get(k) ?? 0);
    if (!w) continue;
    qv.set(k, w);
    qn += w * w;
  }
  qn = Math.sqrt(qn) || 1;
  const cos = (t: { v: Map<string, number>; norm: number }) => {
    let d = 0;
    for (const [k, w] of qv) {
      const x = t.v.get(k);
      if (x) d += w * x;
    }
    return d / (qn * t.norm);
  };
  const gram = new Map<string, number>();
  for (const t of ix.grams) {
    const c = cos(t);
    if (c > 0) gram.set(t.id, c);
  }
  const gramEx = new Map<string, number>();
  for (const t of ix.exGrams) {
    const c = cos(t);
    if (c > (gramEx.get(t.id) ?? 0)) gramEx.set(t.id, c);
  }
  const ids = new Set([...topic.keys(), ...best.keys(), ...gram.keys()]);
  return [...ids]
    .map((id) => ({
      id,
      score:
        MIX.topic * (topic.get(id) ?? 0) +
        MIX.example * (best.get(id) ?? 0) +
        MIX.gram * (gram.get(id) ?? 0) +
        MIX.gramEx * (gramEx.get(id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Blend of the four signals — tuned on the held-out set (kb/tests.ts). */
export const MIX = { topic: 0.4, example: 0.1, gram: 0.3, gramEx: 0.2 };
export function __setTopicWeight(w: number) {
  MIX.topic = w;
}
