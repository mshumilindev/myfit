/**
 * Lithuanian: verb paradigms generated from "infinitive:3-present:3-past" — present,
 * past, -s- future, conditional -čiau/-tum/-tų, -k imperative, reflexive -si forms
 * (-uosi / -iesi / -si / -amės …, ne-si- negation), ne- negation prefix, half-participles
 * -damas (converbs) and past active participles -ęs; closed classes, noun/adjective case
 * guesses by ending and a suffix guesser for unknown verbs. Diacritic-folded lookups.
 */
import { cand, choose, mw, pick, words, type Cand, type LangSpec, type MWE, type T } from '../core';
import { LT_ADJ, LT_IRR, LT_NOUNS, LT_VERBS } from '../lex/lt';
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
        x.feats.number === c.feats.number &&
        x.feats.tense === c.feats.tense &&
        !!x.feats.cond === !!c.feats.cond,
    )
  )
    arr.push(c);
  m.set(k, arr);
}

function palat(st: string): string {
  return st.replace(/t$/, 'č').replace(/d$/, 'dž');
}

type PN = [1 | 2 | 3, 'sg' | 'pl'];
const P1S: PN = [1, 'sg'];
const P2S: PN = [2, 'sg'];
const P3: PN = [3, 'sg'];
const P1P: PN = [1, 'pl'];
const P2P: PN = [2, 'pl'];

/** Plain (non-reflexive) finite forms: [form, tense, person/number]. */
function plainForms(inf: string, p3: string, q3: string): [string, Feats][] {
  const out: [string, Feats][] = [];
  const F = (form: string, tense: 'present' | 'past' | 'future', [person, number]: PN): void => {
    out.push([form, { tense, person, number, form: 'fin' }]);
  };
  // present
  const last = p3.slice(-1);
  const st = p3.slice(0, -1);
  if (last === 'a') {
    if (/i$/.test(st)) {
      // geria → geriu, geri; jaučia → jaučiu, jauti; spaudžia → spaudžiu, spaudi
      F(st + 'u', 'present', P1S);
      F(st.replace(/či$/, 'ti').replace(/dži$/, 'di'), 'present', P2S);
    } else {
      F(st + 'u', 'present', P1S);
      F(st + 'i', 'present', P2S);
    }
    F(st + 'ame', 'present', P1P);
    F(st + 'ate', 'present', P2P);
  } else if (last === 'o') {
    F(st + 'au', 'present', P1S);
    F(st + 'ai', 'present', P2S);
    F(st + 'ome', 'present', P1P);
    F(st + 'ote', 'present', P2P);
  } else if (last === 'i') {
    F(palat(st) + 'iu', 'present', P1S);
    F(p3, 'present', P2S);
    F(st + 'ime', 'present', P1P);
    F(st + 'ite', 'present', P2P);
  }
  F(p3, 'present', P3);
  // past
  const ql = q3.slice(-1);
  const qs = q3.slice(0, -1);
  if (ql === 'o') {
    F(qs + 'au', 'past', P1S);
    F(qs + 'ai', 'past', P2S);
    F(qs + 'ome', 'past', P1P);
    F(qs + 'ote', 'past', P2P);
  } else {
    F(palat(qs) + 'iau', 'past', P1S);
    F(qs + 'ei', 'past', P2S);
    F(qs + 'ėme', 'past', P1P);
    F(qs + 'ėte', 'past', P2P);
  }
  F(q3, 'past', P3);
  // future
  const fs = inf.slice(0, -2).replace(/[sšzž]$/, '');
  F(fs + 'siu', 'future', P1S);
  F(fs + 'si', 'future', P2S);
  F(fs + 's', 'future', P3);
  F(fs + 'sime', 'future', P1P);
  F(fs + 'site', 'future', P2P);
  // conditional (present / hypothetical)
  const cs = inf.slice(0, -2);
  for (const [e, pn] of [
    ['čiau', P1S],
    ['tum', P2S],
    ['tų', P3],
    ['tume', P1P],
    ['tumėme', P1P],
    ['tute', P2P],
  ] as [string, PN][])
    out.push([cs + e, { tense: 'present', person: pn[0], number: pn[1], form: 'fin', cond: true }]);
  return out;
}

/** Reflexive ending for a plain form: dirbu → dirbuosi, dirbi → dirbiesi, dirba → dirbasi. */
function reflOf(form: string): string {
  if (/me$/.test(form)) return form.slice(0, -2) + 'mės';
  if (/te$/.test(form)) return form.slice(0, -2) + 'tės';
  if (/u$/.test(form)) return form + 'osi';
  if (/i$/.test(form)) return form + 'esi';
  return form + 'si';
}

function buildForms(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  for (const e of words(LT_VERBS)) {
    const [inf0, p30, q30] = e.split(':');
    const pf = inf0.endsWith('!');
    const inf1 = pf ? inf0.slice(0, -1) : inf0;
    const refl = inf1.endsWith('tis');
    const inf = refl ? inf1.slice(0, -1) : inf1; // treniruotis → treniruoti
    const p3 = refl ? p30.replace(/si$/, '') : p30;
    const q3 = refl ? q30.replace(/si$/, '') : q30;
    const aspect = pf ? 'perfective' : 'imperfective';
    const x =
      inf1 === 'skaudėti' || inf1 === 'reikėti' || inf1 === 'nusibosti' || inf1 === 'atsibosti'
        ? { impers: true }
        : undefined;
    const V = (f: Feats, neg = false): Cand =>
      cand('VERB', inf1, { ...f, aspect, ...(neg ? { neg: true } : {}) }, x);
    const both = (form: string, f: Feats): void => {
      put(m, form, V(f));
      put(m, /^[eė]/.test(form) ? 'n' + form : 'ne' + form, V(f, true));
    };
    const plain = plainForms(inf, p3, q3);
    if (refl) {
      put(m, inf1, V({ form: 'inf' }));
      put(m, 'nesi' + inf, V({ form: 'inf' }, true));
      for (const [f, feats] of plain) {
        put(m, reflOf(f), V(feats));
        put(m, 'nesi' + f, V(feats, true));
      }
      const fs = inf.slice(0, -2);
      put(m, fs + 'kis', V({ form: 'imp', person: 2, number: 'sg' }));
      put(m, fs + 'kitės', V({ form: 'imp', person: 2, number: 'pl' }));
      put(m, fs + 'damasis', V({ form: 'ger' }));
      put(m, fs + 'damasi', V({ form: 'ger' }));
    } else {
      both(inf, { form: 'inf' });
      for (const [f, feats] of plain) both(f, feats);
      const fs = inf.slice(0, -2);
      put(m, fs + 'k', V({ form: 'imp', person: 2, number: 'sg' }));
      put(m, fs + 'kite', V({ form: 'imp', person: 2, number: 'pl' }));
      put(m, fs + 'kime', V({ form: 'imp', person: 1, number: 'pl' }));
      put(m, 'ne' + fs + 'k', V({ form: 'imp', person: 2, number: 'sg' }, true));
      for (const g of ['damas', 'dama', 'dami', 'damos']) put(m, fs + g, V({ form: 'ger' }));
      // padalyvis: daro → darant, gali → galint
      const pd = /i$/.test(p3) ? p3.slice(0, -1) + 'int' : p3.slice(0, -1) + 'ant';
      put(m, pd, V({ form: 'ger' }));
      // past active participle: pavargo → pavargęs / pavargusi
      const qs = q3.slice(0, -1);
      for (const pp of [qs + 'ęs', qs + 'usi', qs + 'ę'])
        put(m, pp, cand('ADJ', qs + 'ęs', { case: 'nom', form: 'part', tense: 'past' }));
    }
  }
  const TN: Record<string, 'present' | 'past' | 'future'> = {
    p: 'present',
    q: 'past',
    f: 'future',
  };
  for (const e of words(LT_IRR)) {
    const [f, l, k] = e.split(':');
    const tense = TN[k[0]];
    const person = Number(k[1]) as 1 | 2 | 3;
    const number = k[2] === 's' ? 'sg' : 'pl';
    const isBe = l === 'būti';
    const c = cand(
      isBe ? 'AUX' : 'VERB',
      l,
      { tense, person, number, form: 'fin' },
      isBe ? { cop: true } : undefined,
    );
    put(m, f, c);
    put(
      m,
      /^[eė]/.test(f) ? 'n' + f : 'ne' + f,
      cand(isBe ? 'AUX' : 'VERB', l, { ...c.feats, neg: true }, c.x),
    );
  }
  put(
    m,
    'nėra',
    cand(
      'AUX',
      'būti',
      { tense: 'present', person: 3, number: 'sg', form: 'fin', neg: true },
      { cop: true },
    ),
  );
  return m;
}

const LT_PREFIXES = [
  'ap',
  'at',
  'į',
  'iš',
  'nu',
  'pa',
  'par',
  'per',
  'pra',
  'pri',
  'su',
  'už',
  'api',
  'ati',
];

/** Verb prefix + a known unprefixed verb: "įskaitei" → įskaityti, "neišbėgau" → išbėgti (perfective). */
function prefixed(norm: string, l: Lex): Cand[] {
  const neg = /^ne/.test(norm) && norm.length > 6;
  for (const w of neg ? [norm.slice(2), norm] : [norm]) {
    for (const p of LT_PREFIXES) {
      if (!w.startsWith(p) || w.length - p.length < 3) continue;
      const rest = w.slice(p.length);
      const cs = (l.forms.get('=' + rest) ?? []).filter(
        (c) => c.pos === 'VERB' && !/^(ap|at|į|iš|nu|pa|par|per|pra|pri|su|už)/.test(c.lemma),
      );
      if (cs.length)
        return cs.map((c) =>
          cand(
            'VERB',
            p + c.lemma,
            { ...c.feats, aspect: 'perfective', ...(neg && w !== norm ? { neg: true } : {}) },
            c.x,
          ),
        );
    }
  }
  return [];
}

/** Suffix guesses for a verb form missing from the lexicon. */
function guessVerb(norm: string): Cand[] {
  const neg = /^ne/.test(norm) && norm.length > 6;
  const w = neg ? norm.slice(2) : norm;
  const N = neg ? { neg: true } : {};
  const V = (lemma: string, f: Feats): Cand[] => [cand('VERB', lemma, { ...f, ...N })];
  let m = /^(.{3,})(siu|siuosi)$/.exec(w);
  if (m) return V(m[1] + 'ti', { tense: 'future', person: 1, number: 'sg', form: 'fin' });
  m = /^(.{3,})(oju|uoju|iuosi|uosi)$/.exec(w);
  if (m) return V(w, { tense: 'present', person: 1, number: 'sg', form: 'fin' });
  m = /^(.{3,})(avau|iau|ėjau|ausi)$/.exec(w);
  if (m) return V(w, { tense: 'past', person: 1, number: 'sg', form: 'fin' });
  m = /^(.{3,})(avai|ei|ėjai)$/.exec(w);
  if (m) return V(w, { tense: 'past', person: 2, number: 'sg', form: 'fin' });
  m = /^(.{3,})(čiau)$/.exec(w);
  if (m)
    return V(m[1] + 'ti', { tense: 'present', person: 1, number: 'sg', form: 'fin', cond: true });
  if (/[^aeiouyąęėįųū](yti|ėti|oti|uoti|inti|auti|ti)$/.test(w) && w.length > 5)
    return V(w, { form: 'inf' });
  return [];
}

function lex(): Lex {
  if (L) return L;
  L = {
    forms: buildForms(),
    closed: closed(),
    nouns: new Set(words(LT_NOUNS).map(fold)),
    adj: new Set(words(LT_ADJ).map(fold)),
  };
  return L;
}

function closed(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) for (const x of [f(w)].flat()) put(m, w, x);
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c: Case): Cand =>
    cand('PRON', lemma, { person: p, number: n, case: c }, { pron: { p, n, c } });
  add('aš', () => P('aš', 1, 'sg', 'nom'));
  add('mane', () => P('aš', 1, 'sg', 'acc'));
  add('man', () => P('aš', 1, 'sg', 'dat'));
  add('manęs', () => P('aš', 1, 'sg', 'gen'));
  add('tu', () => P('tu', 2, 'sg', 'nom'));
  add('tave', () => P('tu', 2, 'sg', 'acc'));
  add('tau', () => P('tu', 2, 'sg', 'dat'));
  add('jis', () => P('jis', 3, 'sg', 'nom'));
  add('ji', () => P('ji', 3, 'sg', 'nom'));
  add('jį ją', () => P('jis', 3, 'sg', 'acc'));
  add('jam jai', () => P('jis', 3, 'sg', 'dat'));
  add('mes', () => P('mes', 1, 'pl', 'nom'));
  add('mus', () => P('mes', 1, 'pl', 'acc'));
  add('mums', () => P('mes', 1, 'pl', 'dat'));
  add('jūs', () => P('jūs', 2, 'pl', 'nom'));
  add('jums', () => P('jūs', 2, 'pl', 'dat'));
  add('jie jos', () => P('jie', 3, 'pl', 'nom'));
  add('mano', () => cand('DET', 'mano', { case: 'gen' }, { pron: { p: 1, n: 'sg', c: 'gen' } }));
  add('tavo', () => cand('DET', 'tavo', { case: 'gen' }, { pron: { p: 2, n: 'sg', c: 'gen' } }));
  add('jo jų mūsų jūsų', (w) => cand('DET', w, { case: 'gen' }));
  add('šis ši šį šią šiai šiam šios šio šie', (w) =>
    cand('DET', 'šis', {
      case: /[ąį]$/.test(w) ? 'acc' : w === 'šiai' || w === 'šiam' ? 'dat' : 'nom',
    }),
  );
  add('tas ta tą tai to', (w) => cand('DET', 'tas', { case: /ą$/.test(w) ? 'acc' : 'nom' }));
  add('kas', () =>
    cand('PRON', 'kas', { case: 'nom', person: 3 }, { wh: 'what', sub: 'relative' }),
  );
  add('ką', () => cand('PRON', 'kas', { case: 'acc' }, { wh: 'what', sub: 'amb' }));
  add('ko kam kuo', () => cand('PRON', 'kas', { case: 'gen' }, { wh: 'what' }));
  add('kodėl', () => cand('ADV', 'kodėl', {}, { wh: 'why' }));
  add('kaip', () => [
    cand('ADV', 'kaip', {}, { wh: 'how' }),
    cand('SCONJ', 'kaip', {}, { sub: 'comparison' }),
  ]);
  add('kada', () => cand('ADV', 'kada', {}, { wh: 'when', sub: 'temporal' }));
  add('kur', () => cand('ADV', 'kur', {}, { wh: 'where', sub: 'relative' }));
  add('kuris kuri kurie kurį kurią kurio kurios', (w) =>
    cand(
      'DET',
      'kuris',
      { case: /[ąį]$/.test(w) ? 'acc' : 'nom' },
      { wh: 'which', sub: 'relative' },
    ),
  );
  add('kiek', () => cand('ADV', 'kiek', {}, { wh: 'how_much' }));
  add('ar', () => [cand('PART', 'ar', {}, { qp: true }), cand('CONJ', 'ar', {}, { coord: 'or' })]);
  add('ne', () => [cand('PART', 'ne', {}, { neg: true }), cand('INTJ', 'ne', {}, { tag: true })]);
  add('niekas nieko', () => cand('PRON', 'niekas', { case: 'nom', person: 3 }, { negq: true }));
  add('niekada niekur', (w) => cand('ADV', w, {}, { negq: true }));
  add('ir', () => cand('CONJ', 'ir', {}, { coord: 'and' }));
  add('o', () => cand('CONJ', 'o', {}, { coord: 'but' }));
  add('bet tačiau', () => cand('CONJ', 'bet', {}, { coord: 'but' }));
  add('arba', () => cand('CONJ', 'arba', {}, { coord: 'or' }));
  add('todėl tad', () => cand('CONJ', 'todėl', {}, { coord: 'so' }));
  add('kad', () => cand('SCONJ', 'kad', {}, { sub: 'amb' }));
  add('jei jeigu', () => cand('SCONJ', 'jei', {}, { sub: 'conditional' }));
  add('nes kadangi', () => cand('SCONJ', 'nes', {}, { sub: 'causal' }));
  add('nors', () => cand('SCONJ', 'nors', {}, { sub: 'concessive' }));
  add('kai kol', () => cand('SCONJ', 'kai', {}, { sub: 'temporal' }));
  add('negu nei', () => cand('SCONJ', 'negu', {}, { sub: 'comparison' }));
  add('į iš su be po prieš per už ant apie pas prie nuo iki dėl tarp link pagal virš', (w) =>
    cand('ADP', w),
  );
  add('galima', () => cand('ADV', 'galima', { form: 'pred' }, { predic: 'can' }));
  add('verta', () => cand('ADV', 'verta', { form: 'pred' }, { predic: 'should' }));
  add('geriausia geriau gerai blogai sunku lengva normalu', (w) =>
    cand('ADV', w, { form: 'pred' }, { predic: 'eval' }),
  );
  add('tiesa taip', (w) => cand('INTJ', w, {}, { tag: true }));
  add('labai šiek', (w) => cand('ADV', w, {}, { sem: 'degree' }));
  add('dažnai kasdien visada retai', (w) => cand('ADV', w, {}, { sem: 'frequency' }));
  add('prašau', () => cand('INTJ', 'prašau', {}, { please: true, disc: true }));
  add('labas sveikas ačiū ok gerai', (w) => cand('INTJ', w, {}, { disc: true }));
  add(
    'daugiau mažiau labiau greičiau ilgiau trumpiau dažniau rečiau anksčiau vėliau sunkiau lengviau stipriau silpniau aukščiau žemiau toliau arčiau lėčiau',
    (w) => cand('ADV', w, {}, { sem: 'degree' }),
  );
  add('jau dar tik irgi net', (w) => cand('PART', w));
  add('vis vėl visada', (w) => cand('ADV', w, {}, { sem: 'frequency' }));
  add('pagaliau jau', (w) => cand('ADV', w, {}, { sem: 'time' }));
  add('savo', () => cand('DET', 'savo', { case: 'gen' }));
  add(
    'kuriuo kuria kuriame kurioje kuriam kuriai kuriuos kurias kurių kuriems kuriais kuriose',
    (w) =>
      cand(
        'DET',
        'kuris',
        { case: /[ąį]$/.test(w) ? 'acc' : 'loc' },
        { wh: 'which', sub: 'relative' },
      ),
  );
  return m;
}

function nounFeats(lk: string): Feats {
  if (/(as|is|ys|us|a|e)$/.test(lk) && !/(ą|į|ų)$/.test(lk))
    return { case: 'nom', number: /(ai|os|es|ys)$/.test(lk) ? 'pl' : 'sg' };
  if (/(ai|iai|os|es)$/.test(lk)) return { case: 'nom', number: 'pl' };
  return { case: 'acc' };
}

function analyze(norm: string, lk: string): Cand[] {
  const l = lex();
  if (/^\d/.test(norm)) return [cand('NUM', norm, {}, { num: Number(norm) })];
  const out: Cand[] = [];
  const nw = numWord('lt', lk);
  if (nw !== undefined) out.push(cand('NUM', norm, {}, { num: nw }));
  out.push(...(l.closed.get('=' + norm) ?? l.closed.get(lk) ?? []));
  // a word typed with diacritics must match exactly ("kelį" is not "keli")
  out.push(...(l.forms.get('=' + norm) ?? (norm === lk ? l.forms.get(lk) : undefined) ?? []));
  if (out.length) return out;
  if (l.adj.has(lk)) return [cand('ADJ', lk, { case: 'nom', number: 'sg', gender: 'm' })];
  const pd = l.nouns.has(lk) ? [] : prefixed(norm, l);
  if (pd.length) return pd;
  if (!l.nouns.has(lk)) {
    const gv = guessVerb(norm);
    if (gv.length) return gv;
  }
  for (const e of ['o', 'a', 'ą', 'u', 'ai', 'os', 'ų', 'us', 'ų']) {
    const fe = fold(e);
    if (lk.endsWith(fe)) {
      const st = lk.slice(0, -fe.length);
      for (const a of l.adj)
        if (a.startsWith(st) && a.length - st.length <= 3)
          return [cand('ADJ', a, { case: /(ą|u|ų)$/.test(norm) ? 'acc' : 'nom' })];
    }
  }
  // unknown: noun with a case guess
  const st = lk.replace(/(ą|į|ų|as|is|ys|us|a|e|ę|o|os|ės|ai|iai|ui|ams|oms|ose|ėse|uose)$/, '');
  for (const n of l.nouns)
    if (n.startsWith(st) && st.length > 2 && n.length - st.length <= 3)
      return [
        cand(
          'NOUN',
          n,
          nounFeats(norm.replace(/[ąįų]$/, 'ą')) && /[ąįų]$/.test(norm)
            ? { case: 'acc' }
            : nounFeats(lk),
        ),
      ];
  return [cand('NOUN', norm, /[ąįų]$/.test(norm) ? { case: 'acc' } : nounFeats(lk))];
}

const MWES: MWE[] = [
  mw('kaip daznai', { wh: 'how_often' }),
  mw('kiek laiko', { wh: 'how_long' }),
  mw('kiek kartu', { wh: 'how_many' }),
  mw('kiek kartų', { wh: 'how_many' }),
  mw('kokiu laiku', { wh: 'when' }),
  mw('del ko', { wh: 'why' }),
  mw('kaip ilgai', { wh: 'how_long' }),
  mw('ar ne', { tag: true }, undefined, (n) => !n || n.kind === 'p'),
  mw('is eiles', { sem: 'manner' }, 'ADV'),
  mw('sporto sale', {}, 'NOUN'),
  mw('sporto sale', {}, 'NOUN'),
];

const MODAL: Record<string, Modality> = {
  galėti: 'can',
  norėti: 'want',
  reikėti: 'need',
  turėti: 'must',
  gebėti: 'can',
  sugebėti: 'can',
  ketinti: 'want',
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
    const prev = ts[i - 1];
    const next = ts[i + 1];
    if (t.lk === 'ar') {
      pick(t, 'PART');
      continue;
    }
    if (t.lk === 'ne') {
      pick(t, prev && prev.kind === 'p' && (!next || next.kind === 'p') ? 'INTJ' : 'PART');
      continue;
    }
    if (
      t.lk === 'kiek' &&
      next &&
      (next.mx.unit ||
        (/u$/.test(next.lk) &&
          /ų$/.test(next.norm) &&
          !/^(baltymu|angliavandeniu|riebalu|skysciu)$/.test(next.lk)))
    ) {
      choose(t, t.cands[0]);
      t.x = { ...t.x, wh: 'how_many' };
      continue;
    }
    if (
      t.lk === 'per' &&
      next &&
      next.cands.some((c) => c.pos === 'ADJ' || (c.pos === 'ADV' && c.feats.form === 'pred'))
    ) {
      t.pos = 'ADV';
      t.lemma = 'per';
      t.x = { sem: 'degree' };
      continue;
    }
    if (t.lk === 'kaip') {
      pick(t, 'ADV');
      continue;
    }
    choose(t, t.cands[0]);
  }
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.pos !== 'VERB') continue;
    const inf = ts.slice(i + 1, i + 5).some((u) => u.pos === 'VERB' && u.feats.form === 'inf');
    // "neturiu jėgų treniruotis": turėti + object noun is possession, not "must"
    const nounBetween = (() => {
      for (let k = i + 1; k < Math.min(ts.length, i + 5); k++) {
        if (ts[k].pos === 'VERB' && ts[k].feats.form === 'inf') return false;
        if (ts[k].pos === 'NOUN') return true;
      }
      return false;
    })();
    if (MODAL[t.lemma] && inf && !(t.lemma === 'turėti' && nounBetween))
      t.x = { ...t.x, modal: MODAL[t.lemma] };
  }
}

/** Is this (folded) word known to the Lithuanian lexicon? */
export function ltKnows(lk: string): boolean {
  const l = lex();
  return l.closed.has(lk) || l.forms.has(lk) || l.nouns.has(lk) || l.adj.has(lk);
}

export const LT: LangSpec = {
  lang: 'lt',
  prodrop: true,
  analyze,
  mwe: MWES,
  disambig,
  nomCapable: (t) =>
    (t.pos === 'PRON' || t.pos === 'NOUN' || t.pos === 'ADJ') &&
    (!t.feats.case || t.feats.case === 'nom'),
  cogn: (t) =>
    /^(žinoti|manyti|sakyti|pasakyti|paaiškinti|aiškinti|klausti|paklausti|jausti|tikras|rodyti|parodyti|skaičiuoti|suskaičiuoti|paskaičiuoti|apskaičiuoti|užrašyti|įrašyti|atsakyti|priminti|patikrinti|tikrinti|suprasti|galvoti|pagalvoti|atsiminti|prisiminti|pastebėti|matyti|pamatyti|girdėti|nusibosti|atsibosti|normalu|keista|įdomu|gerai|blogai|nerimauti|bijoti|tikėtis|tikėti|patikėti|pamiršti|atrodyti)$/.test(
      t.lemma,
    ),
};
