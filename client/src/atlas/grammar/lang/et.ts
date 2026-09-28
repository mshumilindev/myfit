/**
 * Estonian: verb paradigms from "ma-inf:da-inf:present stem:past stem:past 3sg:nud-participle"
 * (present -n/-d/-b/-me/-te/-vad, past -sin…, "ei" + stem negation, imperative),
 * closed classes, nominative vs. oblique case guesses by ending. Diacritic-folded lookups.
 */
import { cand, choose, mw, pick, words, type Cand, type LangSpec, type MWE, type T } from '../core';
import { ET_ADJ, ET_NOUNS, ET_VERBS } from '../lex/et';
import { numWord } from '../lex/measure';
import { fold } from '../tokenize';
import type { Case, Feats, Modality } from '../types';

interface Lex {
  forms: Map<string, Cand[]>;
  closed: Map<string, Cand[]>;
  nouns: Set<string>;
  adj: Set<string>;
}
let L: Lex | null = null;

function put(m: Map<string, Cand[]>, form: string, c: Cand): void {
  for (const k of [fold(form), '=' + form]) putK(m, k, c);
}

function putK(m: Map<string, Cand[]>, k: string, c: Cand): void {
  const arr = m.get(k) ?? [];
  if (
    !arr.some(
      (x) =>
        x.pos === c.pos &&
        x.lemma === c.lemma &&
        x.feats.form === c.feats.form &&
        x.feats.person === c.feats.person &&
        x.feats.tense === c.feats.tense &&
        x.feats.neg === c.feats.neg,
    )
  )
    arr.push(c);
  m.set(k, arr);
}

/** Forms that follow "ei" (negated): marked as `neg` candidates. */
function buildForms(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  for (const e of words(ET_VERBS)) {
    const parts = e.split(':');
    const ma = parts[0];
    const S = ma.slice(0, -2);
    const da = parts[1] || S + 'da';
    const pr = parts[2] || S;
    const ps = parts[3] || S + 'si';
    const p3 = parts[4] || S + 's';
    const nud = parts[5] || S + 'nud';
    const V = (f: Feats): Cand => cand('VERB', ma, f);
    const F = (tense: 'present' | 'past', person: 1 | 2 | 3, number: 'sg' | 'pl'): Feats => ({
      tense,
      person,
      number,
      form: 'fin',
    });
    put(m, ma, V({ form: 'inf' }));
    put(m, da, V({ form: 'inf' }));
    put(m, pr + 'n', V(F('present', 1, 'sg')));
    put(m, pr + 'd', V(F('present', 2, 'sg')));
    put(m, pr + 'b', V(F('present', 3, 'sg')));
    put(m, pr + 'me', V(F('present', 1, 'pl')));
    put(m, pr + 'te', V(F('present', 2, 'pl')));
    put(m, pr + 'vad', V(F('present', 3, 'pl')));
    put(m, ps + 'n', V(F('past', 1, 'sg')));
    put(m, ps + 'd', V(F('past', 2, 'sg')));
    put(m, p3, V(F('past', 3, 'sg')));
    put(m, ps + 'me', V(F('past', 1, 'pl')));
    put(m, ps + 'te', V(F('past', 2, 'pl')));
    put(m, (/i$/.test(ps) ? ps.slice(0, -1) + 'i' : ps) + 'd', V(F('past', 3, 'pl')));
    // negated present: "ei tee" (bare stem), negated past: "ei teinud"
    put(m, pr, V({ tense: 'present', form: 'fin', neg: true }));
    put(m, nud, V({ tense: 'past', form: 'fin', neg: true }));
    // imperative (2sg = present stem, 2pl -ge/-ke, 1pl -me handled by present)
    put(m, pr, V({ form: 'imp', person: 2, number: 'sg' }));
    put(m, pr + 'ge', V({ form: 'imp', person: 2, number: 'pl' }));
    put(m, pr + 'ke', V({ form: 'imp', person: 2, number: 'pl' }));
    // conditional -ksin / -ksid / -ks / -ksime / -ksite
    put(m, pr + 'ksin', V({ form: 'fin', tense: 'present', person: 1, number: 'sg', cond: true }));
    put(m, pr + 'ksid', V({ form: 'fin', tense: 'present', person: 2, number: 'sg', cond: true }));
    put(m, pr + 'ks', V({ form: 'fin', tense: 'present', cond: true }));
    put(m, pr + 'ksime', V({ form: 'fin', tense: 'present', person: 1, number: 'pl', cond: true }));
    // gerund -des: teha → tehes, joosta → joostes
    if (/a$/.test(da)) put(m, da.slice(0, -1) + 'es', V({ form: 'ger' }));
    // ma-infinitive cases: jooksmas, jooksmast, jooksmaks
    put(m, S + 'mas', V({ form: 'inf' }));
  }
  const be: [string, Feats][] = [
    ['olen', { tense: 'present', person: 1, number: 'sg' }],
    ['oled', { tense: 'present', person: 2, number: 'sg' }],
    ['on', { tense: 'present', person: 3 }],
    ['oleme', { tense: 'present', person: 1, number: 'pl' }],
    ['olete', { tense: 'present', person: 2, number: 'pl' }],
    ['olin', { tense: 'past', person: 1, number: 'sg' }],
    ['olid', { tense: 'past', person: 2, number: 'sg' }],
    ['oli', { tense: 'past', person: 3, number: 'sg' }],
    ['olime', { tense: 'past', person: 1, number: 'pl' }],
    ['ole', { tense: 'present', neg: true }],
    ['olnud', { tense: 'past', neg: true }],
    ['pole', { tense: 'present', neg: true }],
    ['polnud', { tense: 'past', neg: true }],
    ['oleks', { tense: 'present', cond: true }],
    ['oleksin', { tense: 'present', person: 1, number: 'sg', cond: true }],
    ['olema', { form: 'inf' }],
    ['olla', { form: 'inf' }],
  ];
  for (const [f, feats] of be)
    put(m, f, cand('AUX', 'olema', { form: 'fin', ...feats }, { cop: true }));
  return m;
}

function closed(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) for (const x of [f(w)].flat()) put(m, w, x);
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c: Case): Cand =>
    cand('PRON', lemma, { person: p, number: n, case: c }, { pron: { p, n, c } });
  add('ma mina', () => P('mina', 1, 'sg', 'nom'));
  add('mind', () => P('mina', 1, 'sg', 'acc'));
  add('mulle minule', () => P('mina', 1, 'sg', 'dat'));
  add('mul minul', () => P('mina', 1, 'sg', 'loc'));
  add('sa sina', () => P('sina', 2, 'sg', 'nom'));
  add('sind', () => P('sina', 2, 'sg', 'acc'));
  add('sulle sinule', () => P('sina', 2, 'sg', 'dat'));
  add('sul sinul', () => P('sina', 2, 'sg', 'loc'));
  add('ta tema', () => P('tema', 3, 'sg', 'nom'));
  add('teda', () => P('tema', 3, 'sg', 'acc'));
  add('talle', () => P('tema', 3, 'sg', 'dat'));
  add('me meie', () => P('meie', 1, 'pl', 'nom'));
  add('meile', () => P('meie', 1, 'pl', 'dat'));
  add('meil', () => P('meie', 1, 'pl', 'loc'));
  add('te teie', () => P('teie', 2, 'pl', 'nom'));
  add('nad nemad', () => P('nemad', 3, 'pl', 'nom'));
  add('mu minu', () => cand('DET', 'minu', { case: 'gen' }, { pron: { p: 1, n: 'sg', c: 'gen' } }));
  add('su sinu', () => cand('DET', 'sinu', { case: 'gen' }, { pron: { p: 2, n: 'sg', c: 'gen' } }));
  add('selle see seda sel sellel', (w) =>
    w === 'seda'
      ? cand('PRON', 'see', { case: 'acc' })
      : cand('DET', 'see', { case: w === 'see' ? 'nom' : 'gen' }),
  );
  add('mis', () =>
    cand('PRON', 'mis', { case: 'nom', person: 3 }, { wh: 'what', sub: 'relative' }),
  );
  add('mida', () => cand('PRON', 'mis', { case: 'acc' }, { wh: 'what', sub: 'amb' }));
  add('mille millest millega milles millele millel', () =>
    cand('PRON', 'mis', { case: 'gen' }, { wh: 'what', sub: 'relative' }),
  );
  add('kust kuhu', () => cand('ADV', 'kus', {}, { wh: 'where', sub: 'relative' }));
  add('keda kelle kellele kellega', () =>
    cand('PRON', 'kes', { case: 'acc' }, { wh: 'who', sub: 'relative' }),
  );
  add('miks', () => cand('ADV', 'miks', {}, { wh: 'why' }));
  add('kuidas', () => cand('ADV', 'kuidas', {}, { wh: 'how' }));
  add('millal', () => cand('ADV', 'millal', {}, { wh: 'when', sub: 'temporal' }));
  add('kus', () => cand('ADV', 'kus', {}, { wh: 'where', sub: 'relative' }));
  add('kes', () => cand('PRON', 'kes', { case: 'nom', person: 3 }, { wh: 'who', sub: 'relative' }));
  add('kumb milline missugune', () => cand('DET', 'milline', {}, { wh: 'which', sub: 'relative' }));
  add('mitu', () => cand('ADV', 'mitu', {}, { wh: 'how_many' }));
  add('kas', () => cand('PART', 'kas', {}, { qp: true }));
  add('ei', () => [cand('PART', 'ei', {}, { neg: true }), cand('INTJ', 'ei', {}, { tag: true })]);
  add('ära', () => cand('PART', 'ära', {}, { neg: true }));
  add('mitte', () => cand('PART', 'mitte', {}, { neg: true }));
  add('keegi midagi kunagi', (w) => cand(w === 'kunagi' ? 'ADV' : 'PRON', w, { case: 'nom' }));
  add('ja ning', () => cand('CONJ', 'ja', {}, { coord: 'and' }));
  add('aga kuid', () => cand('CONJ', 'aga', {}, { coord: 'but' }));
  add('või ehk', () => cand('CONJ', 'või', {}, { coord: 'or' }));
  add('seega niisiis', () => cand('CONJ', 'seega', {}, { coord: 'so' }));
  add('et', () => cand('SCONJ', 'et', {}, { sub: 'amb' }));
  add('kui', () => cand('SCONJ', 'kui', {}, { sub: 'conditional' }));
  add('sest kuna', () => cand('SCONJ', 'sest', {}, { sub: 'causal' }));
  add('kuigi ehkki', () => cand('SCONJ', 'kuigi', {}, { sub: 'concessive' }));
  add('kuni', () => cand('SCONJ', 'kuni', {}, { sub: 'temporal' }));
  add('nagu', () => cand('SCONJ', 'nagu', {}, { sub: 'comparison' }));
  add('pärast enne ilma üle läbi koos jaoks eest järel peale kohta', (w) => cand('ADP', w));
  add('vaja', () => cand('ADV', 'vaja', { form: 'pred' }, { predic: 'need' }));
  add('parem hea halb raske kerge parim', (w) => cand('ADJ', w, { case: 'nom' }));
  add('eks jah ju onju', (w) => cand('INTJ', w, {}, { tag: true }));
  add('väga natuke liiga', (w) => cand('ADV', w, {}, { sem: 'degree' }));
  add('järjest tihti sageli alati harva', (w) => cand('ADV', w, {}, { sem: 'frequency' }));
  add('alla', () => cand('ADV', 'alla'));
  add('palun', () => cand('INTJ', 'palun', {}, { please: true, disc: true }));
  add('tere tänan aitäh ok hei', (w) => cand('INTJ', w, {}, { disc: true }));
  add('juba veel ainult ka isegi', (w) => cand('PART', w));
  add('ikka jälle uuesti kohe siis nüüd alles endiselt', (w) =>
    cand('ADV', w, {}, { sem: 'time' }),
  );
  add(
    'lihtsalt tegelikult kindlasti vist eriti päris üsna rohkem vähem kauem paremini halvemini hästi halvasti kiiresti aeglaselt õigesti valesti korralikult',
    (w) => cand('ADV', w, {}, { sem: 'manner' }),
  );
  return m;
}

function lex(): Lex {
  if (L) return L;
  L = {
    forms: buildForms(),
    closed: closed(),
    nouns: new Set(words(ET_NOUNS).map(fold)),
    adj: new Set(words(ET_ADJ).map(fold)),
  };
  return L;
}

function analyze(norm: string, lk: string): Cand[] {
  const l = lex();
  if (/^\d/.test(norm)) return [cand('NUM', norm, {}, { num: Number(norm) })];
  const out: Cand[] = [];
  const nw = numWord('et', lk);
  if (nw !== undefined) out.push(cand('NUM', norm, {}, { num: nw }));
  out.push(...(l.closed.get('=' + norm) ?? l.closed.get(lk) ?? []));
  // a word typed with diacritics must match exactly ("kelį" is not "keli")
  out.push(...(l.forms.get('=' + norm) ?? (norm === lk ? l.forms.get(lk) : undefined) ?? []));
  if (
    out.length &&
    l.nouns.has(lk) &&
    !out.some((c) => c.pos !== 'VERB' || (!c.feats.neg && c.feats.form !== 'imp'))
  )
    out.push(cand('NOUN', norm, { case: 'nom', number: /(ad|ed|id)$/.test(lk) ? 'pl' : 'sg' }));
  if (out.length) return out;
  if (l.adj.has(lk))
    return [cand('ADJ', norm, { case: 'nom', number: /d$/.test(lk) ? 'pl' : 'sg' })];
  if (l.nouns.has(lk))
    return [cand('NOUN', norm, { case: 'nom', number: /(ad|ed|id)$/.test(lk) ? 'pl' : 'sg' })];
  // partitive of a known noun: "lõuga", "jalga", "kätt"
  for (const e of ['a', 'u', 'i', 'e', 't', 'd']) {
    if (lk.endsWith(e) && lk.length > 3 && l.nouns.has(lk.slice(0, -1)))
      return [cand('NOUN', lk.slice(0, -1), { case: 'acc' })];
  }
  // oblique case endings
  const m = /(sse|st|lt|le|ga|ks|ni|na|ta|s|l|t|d|u|i|e)$/.exec(lk);
  if (m) {
    const st = lk.slice(0, -m[1].length);
    for (const n of l.nouns)
      if (n.startsWith(st) && st.length >= 3 && n.length - st.length <= 2)
        return [cand('NOUN', n, { case: m[1] === 'd' ? 'nom' : 'acc' })];
  }
  return [
    cand('NOUN', norm, {
      case: /(sse|st|lt|le|ga|ks|ni|na|ta|te|de|s|l|t)$/.test(lk) ? 'acc' : 'nom',
    }),
  ];
}

const MWES: MWE[] = [
  mw('kui palju', { wh: 'how_much' }),
  mw('kui kaua', { wh: 'how_long' }),
  mw('kui tihti', { wh: 'how_often' }),
  mw('kui sageli', { wh: 'how_often' }),
  mw('mis ajal', { wh: 'when' }),
  mw('voi mitte', { orNot: true }),
  mw('enne kui', { sub: 'temporal' }, 'SCONJ'),
];

const MODAL: Record<string, Modality> = {
  võima: 'can',
  saama: 'can',
  tahtma: 'want',
  pidama: 'must',
  suutma: 'can',
  oskama: 'can',
  jaksama: 'can',
  tohtima: 'may',
  viitsima: 'want',
};

function disambig(ts: T[]): void {
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.kind === 'p' || t.kind === 'e') {
      t.pos = t.kind === 'e' ? 'X' : 'PUNCT';
      continue;
    }
    if (t.mx.time) {
      t.pos = 'ADV';
      t.x = { ...t.mx, sem: 'time' };
      continue;
    }
    if (!t.cands.length) continue;
    const prev = ts
      .slice(0, i)
      .reverse()
      .find((u) => u.kind === 'w');
    const next = ts[i + 1];
    if (t.lk === 'ei') {
      pick(t, prev && ts[i - 1]?.kind === 'p' && (!next || next.kind === 'p') ? 'INTJ' : 'PART');
      continue;
    }
    // "ära anna…": negative imperative
    if (prev && prev.lk === 'ara') {
      const ic = t.cands.find((c) => c.feats.form === 'imp');
      if (ic) {
        choose(t, ic);
        continue;
      }
    }
    // after "ei": the negated form
    const negPrev = ts.slice(Math.max(0, i - 3), i).some((u) => u.lk === 'ei' || u.lk === 'ara');
    const neg = t.cands.find((c) => c.feats.neg);
    if (neg && negPrev) {
      choose(t, neg);
      continue;
    }
    const imp = t.cands.find((c) => c.feats.form === 'imp');
    const firstW = !prev || ts[i - 1]?.kind === 'p';
    if (imp && firstW && !negPrev) {
      choose(t, imp);
      continue;
    }
    const nonNeg = t.cands.find((c) => !c.feats.neg && c.feats.form !== 'imp');
    choose(t, nonNeg ?? t.cands[0]);
    if (t.feats.neg && !negPrev && !/^(pole|polnud)$/.test(t.lk))
      t.feats = { ...t.feats, neg: undefined };
  }
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.lemma !== 'olema' || t.pos !== 'AUX') continue;
    const p = ts
      .slice(i + 1, i + 5)
      .find((u) => u.pos === 'VERB' && /nud$/.test(u.lk) && u.feats.tense === 'past');
    if (!p || lex().adj.has(p.lk)) continue; // "olen väsinud" is a state, not a perfect
    const neg = !!t.feats.neg || /^(pole|polnud)$/.test(t.lk);
    p.feats = {
      ...p.feats,
      tense: 'past',
      form: 'fin',
      person: t.feats.person,
      number: t.feats.number,
      neg: neg || undefined,
    };
    t.pos = 'PART';
    t.x = { ...t.x, cop: undefined, neg: neg || undefined };
    t.feats = {};
  }
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.pos !== 'VERB') continue;
    const inf = ts.slice(i + 1, i + 6).some((u) => u.pos === 'VERB' && u.feats.form === 'inf');
    if (MODAL[t.lemma] && inf) t.x = { ...t.x, modal: MODAL[t.lemma] };
    if (t.feats.neg) t.feats = { ...t.feats, neg: undefined };
  }
}

/** Is this (folded) word known to the Estonian lexicon? */
export function etKnows(lk: string): boolean {
  const l = lex();
  return l.closed.has(lk) || l.forms.has(lk) || l.nouns.has(lk) || l.adj.has(lk);
}

export const ET: LangSpec = {
  lang: 'et',
  prodrop: true,
  analyze,
  mwe: MWES,
  disambig,
  nomCapable: (t) =>
    (t.pos === 'PRON' || t.pos === 'NOUN' || t.pos === 'ADJ') &&
    (!t.feats.case || t.feats.case === 'nom'),
  cogn: (t) =>
    /^(teadma|arvama|ütlema|selgitama|küsima|tundma|näitama|arvutama|meenutama|mäletama|unustama|nägema|kuulma|mõtlema|uskuma|lootma|kartma|rääkima|kirjutama|vastama|kontrollima|loendama|lugema|normaalne|kindel|huvitav|imelik|panema)$/.test(
      t.lemma,
    ),
};
