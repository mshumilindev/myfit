/**
 * Polish: closed classes, verb paradigms generated from "infinitive:3sg-present[:imperative[:past]]"
 * by conjugation class (3sg -a / -i / -y / -e / -uje / -nie / -dzie, -em class umieć/rozumieć):
 * present, past with person endings -łem/-łaś/…, conditional -łbym, będę + inf / l-form,
 * imperative, adverbial participles -ąc / -wszy; noun/adjective case guesses by ending and a
 * suffix guesser for unknown verbs. Lookups use diacritic-folded forms.
 */
import { cand, choose, mw, pick, words, type Cand, type LangSpec, type MWE, type T } from '../core';
import { numWord } from '../lex/measure';
import { PL_ADJ, PL_IRR, PL_NOUNS, PL_VERBS } from '../lex/pl';
import { fold } from '../tokenize';
import type { Case, Feats, Modality } from '../types';

const PAST: [string, Feats, 'm' | 'f' | 'pl'][] = [
  ['łem', { person: 1, number: 'sg', gender: 'm' }, 'm'],
  ['łeś', { person: 2, number: 'sg', gender: 'm' }, 'm'],
  ['ł', { person: 3, number: 'sg', gender: 'm' }, 'm'],
  ['łam', { person: 1, number: 'sg', gender: 'f' }, 'f'],
  ['łaś', { person: 2, number: 'sg', gender: 'f' }, 'f'],
  ['ła', { person: 3, number: 'sg', gender: 'f' }, 'f'],
  ['ło', { person: 3, number: 'sg', gender: 'n' }, 'f'],
  ['łyśmy', { person: 1, number: 'pl' }, 'f'],
  ['łyście', { person: 2, number: 'pl' }, 'f'],
  ['ły', { person: 3, number: 'pl' }, 'f'],
  ['liśmy', { person: 1, number: 'pl' }, 'pl'],
  ['liście', { person: 2, number: 'pl' }, 'pl'],
  ['li', { person: 3, number: 'pl' }, 'pl'],
];
const COND: [string, Feats, 'm' | 'f' | 'pl'][] = [
  ['łbym', { person: 1, number: 'sg', gender: 'm' }, 'm'],
  ['łbyś', { person: 2, number: 'sg', gender: 'm' }, 'm'],
  ['łby', { person: 3, number: 'sg', gender: 'm' }, 'm'],
  ['łabym', { person: 1, number: 'sg', gender: 'f' }, 'f'],
  ['łabyś', { person: 2, number: 'sg', gender: 'f' }, 'f'],
  ['łaby', { person: 3, number: 'sg', gender: 'f' }, 'f'],
  ['libyśmy', { person: 1, number: 'pl' }, 'pl'],
  ['liby', { person: 3, number: 'pl' }, 'pl'],
];

interface Lex {
  forms: Map<string, Cand[]>;
  closed: Map<string, Cand[]>;
  nouns: Map<string, string>;
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
        x.feats.tense === c.feats.tense,
    )
  )
    arr.push(c);
  m.set(k, arr);
}

/** 1sg / 3pl stem of an -i/-y verb: musi → musz-, płaci → płac-, siedzi → siedz-, robi → robi-. */
function iStem(p3: string): string {
  if (/y$/.test(p3)) return p3.slice(0, -1);
  if (/ści$/.test(p3)) return p3.slice(0, -3) + 'szcz';
  if (/ździ$/.test(p3)) return p3.slice(0, -4) + 'żdż';
  if (/dzi$/.test(p3)) return p3.slice(0, -1);
  if (/si$/.test(p3)) return p3.slice(0, -2) + 'sz';
  if (/zi$/.test(p3)) return p3.slice(0, -2) + 'ż';
  if (/ci$/.test(p3)) return p3.slice(0, -2) + 'c';
  if (/li$/.test(p3)) return p3.slice(0, -1);
  return p3; // robi → robię, mówi → mówię, dzwoni → dzwonię
}

/** 1sg / 3pl stem of an -e verb: pisze → pisz-, zacznie → zaczn-, idzie → id-, trenuje → trenuj-. */
function eStem(p3: string): string {
  if (/śnie$/.test(p3)) return p3.slice(0, -4) + 'sn';
  if (/dzie$/.test(p3)) return p3.slice(0, -3);
  if (/[^aeiouyąęó][nm]ie$/.test(p3) || /[aeiouyąęó]nie$/.test(p3)) return p3.slice(0, -2);
  return p3.slice(0, -1);
}

function defaultImp(inf: string, p3: string): string | undefined {
  if (/awać$/.test(inf)) return inf.slice(0, -1) + 'j';
  if (/a$/.test(p3)) return p3 + 'j';
  if (/uje$/.test(p3)) return p3.slice(0, -1);
  if (/[aeiouy]je$/.test(p3)) return p3.slice(0, -1);
  if (/dzie$/.test(p3)) return p3.slice(0, -3) + 'dź';
  if (/[aeiouyąęó]nie$/.test(p3)) return p3.slice(0, -3) + 'ń';
  if (/[nm]ie$/.test(p3)) return p3.slice(0, -2) + 'ij';
  if (/(sze|cze|że|rze|pie|bie)$/.test(p3)) return p3.slice(0, -1).replace(/i$/, '');
  if (/[iy]$/.test(p3)) {
    const st = p3.slice(0, -1);
    if (/[^aeiouyąęó][nm]$/.test(st)) return st + 'ij';
    return st
      .replace(/dz$/, 'dź')
      .replace(/n$/, 'ń')
      .replace(/c$/, 'ć')
      .replace(/s$/, 'ś')
      .replace(/z$/, 'ź');
  }
  return undefined;
}

/** Masculine / feminine past stems (without ł/ła) from the infinitive or the explicit past. */
function pastStems(inf: string, past?: string): { m: string; f: string; pl: string; m12?: string } {
  if (past) {
    const [pm, pf0] = past.split('/');
    const pf = pf0 ?? pm + 'a';
    const f = pf.replace(/ła$/, '');
    const m = pm.replace(/ł$/, '');
    // virile plural: "szli", "mogli", "zaczęli", "jedli"
    return { m, f, pl: f.replace(/jad$/, 'jed'), m12: m.replace(/ó([^ó]*)$/, 'o$1') };
  }
  const st = inf.replace(/ć$/, '');
  if (/ąć$/.test(inf)) {
    const e = inf.slice(0, -2) + 'ę';
    return { m: inf.slice(0, -2) + 'ą', f: e, pl: e };
  }
  if (/eć$/.test(inf)) return { m: st.slice(0, -1) + 'a', f: st.slice(0, -1) + 'a', pl: st };
  return { m: st, f: st, pl: st };
}

function buildForms(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  for (const e of words(PL_VERBS)) {
    const [inf0, p3, imp0, past] = e.split(':');
    const pf = inf0.endsWith('!');
    const inf = pf ? inf0.slice(0, -1) : inf0;
    const aspect = pf ? 'perfective' : 'imperfective';
    const isBe = inf === 'być';
    const V = (f: Feats): Cand =>
      cand(isBe ? 'AUX' : 'VERB', inf, { ...f, aspect }, isBe ? { cop: true } : undefined);
    put(m, inf, V({ form: 'inf' }));
    const pres = (form: string, person: 1 | 2 | 3, number: 'sg' | 'pl'): void =>
      put(m, form, V({ tense: 'present', person, number, form: 'fin' }));
    let pl3 = '';
    if (!isBe) {
      if (p3 === inf.slice(0, -1) && /e$/.test(p3)) {
        // umie / rozumie: -em class
        pres(p3 + 'm', 1, 'sg');
        pres(p3 + 'sz', 2, 'sg');
        pres(p3, 3, 'sg');
        pres(p3 + 'my', 1, 'pl');
        pres(p3 + 'cie', 2, 'pl');
        pres((pl3 = p3 + 'ją'), 3, 'pl');
      } else if (p3.endsWith('a')) {
        pres(p3 + 'm', 1, 'sg');
        pres(p3 + 'sz', 2, 'sg');
        pres(p3, 3, 'sg');
        pres(p3 + 'my', 1, 'pl');
        pres(p3 + 'cie', 2, 'pl');
        pres((pl3 = p3 + 'ją'), 3, 'pl');
      } else if (/[iy]$/.test(p3)) {
        const st = iStem(p3);
        pres(st + 'ę', 1, 'sg');
        pres(p3 + 'sz', 2, 'sg');
        pres(p3, 3, 'sg');
        pres(p3 + 'my', 1, 'pl');
        pres(p3 + 'cie', 2, 'pl');
        pres((pl3 = st + 'ą'), 3, 'pl');
      } else if (p3.endsWith('e')) {
        const st = eStem(p3);
        pres(st + 'ę', 1, 'sg');
        pres(p3 + 'sz', 2, 'sg');
        pres(p3, 3, 'sg');
        pres(p3 + 'my', 1, 'pl');
        pres(p3 + 'cie', 2, 'pl');
        pres((pl3 = st + 'ą'), 3, 'pl');
      }
    }
    // past, conditional, anterior adverbial participle
    const ps = pastStems(inf, past);
    const hasPast = !(/c$/.test(inf) && !past);
    if (hasPast) {
      for (const [e2, f, k] of PAST) {
        const stem =
          k === 'm' ? (f.person !== 3 && ps.m12 ? ps.m12 : ps.m) : k === 'f' ? ps.f : ps.pl;
        put(m, stem + e2, V({ tense: 'past', form: 'fin', ...f }));
      }
      for (const [e2, f, k] of COND) {
        const stem = k === 'm' ? (ps.m12 ?? ps.m) : k === 'f' ? ps.f : ps.pl;
        put(m, stem + e2, V({ tense: 'present', form: 'fin', cond: true, ...f }));
      }
      if (pf && /[aeiouy]$/.test(ps.m)) put(m, ps.m + 'wszy', V({ form: 'ger', tense: 'past' }));
    }
    if (pl3 && !pf) put(m, pl3 + 'c', V({ form: 'ger' }));
    // imperative
    const im = imp0 || defaultImp(inf, p3);
    if (im) {
      put(m, im, V({ form: 'imp', person: 2, number: 'sg' }));
      put(m, im + 'cie', V({ form: 'imp', person: 2, number: 'pl' }));
      put(m, im + 'my', V({ form: 'imp', person: 1, number: 'pl' }));
    }
  }
  const PN: Record<string, [1 | 2 | 3, 'sg' | 'pl']> = {
    '1s': [1, 'sg'],
    '2s': [2, 'sg'],
    '3s': [3, 'sg'],
    '1p': [1, 'pl'],
    '2p': [2, 'pl'],
    '3p': [3, 'pl'],
  };
  for (const e of words(PL_IRR)) {
    const [f, l, pn, fut] = e.split(':');
    const [person, number] = PN[pn];
    const isBe = l === 'być';
    const feats: Feats = { tense: fut ? 'future' : 'present', person, number, form: 'fin' };
    put(
      m,
      f,
      cand(
        isBe ? 'AUX' : 'VERB',
        l,
        feats,
        isBe ? { cop: true, ...(fut ? { aux: 'fut' as const } : {}) } : undefined,
      ),
    );
  }
  return m;
}

const PL_PREFIXES = [
  'prze',
  'przy',
  'roz',
  'pod',
  'od',
  'wy',
  'za',
  'na',
  'po',
  'do',
  'ob',
  'u',
  'z',
  's',
  'w',
];

/** Suffix guesses for a verb form missing from the lexicon (lemma approximate). */
function guessVerb(norm: string): Cand[] {
  const w = norm;
  const past = /^(.{2,}?)(łem|łam|łeś|łaś|liśmy|łyśmy|liście)$/.exec(w);
  if (past) {
    const f = PAST.find(([e]) => e === past[2]);
    if (f) return [cand('VERB', past[1] + 'ć', { tense: 'past', form: 'fin', ...f[1] })];
  }
  const cond = /^(.{2,}?)(łbym|łabym|łbyś|łabyś)$/.exec(w);
  if (cond) {
    const f = COND.find(([e]) => e === cond[2]);
    if (f)
      return [cand('VERB', cond[1] + 'ć', { tense: 'present', form: 'fin', cond: true, ...f[1] })];
  }
  const uj = /^(.{2,})(uję|ujesz|ujemy|ujecie|ują)$/.exec(w);
  if (uj) {
    const pn: Record<string, [1 | 2 | 3, 'sg' | 'pl']> = {
      uję: [1, 'sg'],
      ujesz: [2, 'sg'],
      ujemy: [1, 'pl'],
      ujecie: [2, 'pl'],
      ują: [3, 'pl'],
    };
    const [person, number] = pn[uj[2]];
    return [
      cand('VERB', uj[1] + 'ować', {
        tense: 'present',
        person,
        number,
        form: 'fin',
        aspect: 'imperfective',
      }),
    ];
  }
  if (/[^aeiouy](ować|ywać|iwać|ać|ić|yć|eć|ąć|nąć)$/.test(w) && w.length > 4)
    return [cand('VERB', w, { form: 'inf' })];
  return [];
}

function closed(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) {
      const c = f(w);
      for (const x of Array.isArray(c) ? c : [c]) put(m, w, x);
    }
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c: Case): Cand =>
    cand('PRON', lemma, { person: p, number: n, case: c }, { pron: { p, n, c } });
  add('ja', () => P('ja', 1, 'sg', 'nom'));
  add('mnie', () => P('ja', 1, 'sg', 'acc'));
  add('mi', () => P('ja', 1, 'sg', 'dat'));
  add('mną', () => P('ja', 1, 'sg', 'ins'));
  add('ty', () => P('ty', 2, 'sg', 'nom'));
  add('cię ciebie', () => P('ty', 2, 'sg', 'acc'));
  add('ci', () => P('ty', 2, 'sg', 'dat'));
  add('on', () => P('on', 3, 'sg', 'nom'));
  add('ona', () => P('ona', 3, 'sg', 'nom'));
  add('ono', () => P('ono', 3, 'sg', 'nom'));
  add('go jego niego', () => P('on', 3, 'sg', 'acc'));
  add('mu jemu', () => P('on', 3, 'sg', 'dat'));
  add('jej niej', () => P('ona', 3, 'sg', 'gen'));
  add('my', () => P('my', 1, 'pl', 'nom'));
  add('nas', () => P('my', 1, 'pl', 'acc'));
  add('nam', () => P('my', 1, 'pl', 'dat'));
  add('wy', () => P('wy', 2, 'pl', 'nom'));
  add('was', () => P('wy', 2, 'pl', 'acc'));
  add('oni one', () => P('oni', 3, 'pl', 'nom'));
  add('ich nich', () => P('oni', 3, 'pl', 'acc'));
  add('im', () => P('oni', 3, 'pl', 'dat'));
  add('się', () => cand('PRON', 'się', { case: 'acc' }));
  const D =
    (lemma: string, p?: 1 | 2): ((w: string) => Cand) =>
    (w) =>
      cand('DET', lemma, adjFeats(w), p ? { pron: { p, n: 'sg', c: 'gen' } } : undefined);
  add('mój moja moje moi mojego mojej moim moich moją mojemu', D('mój', 1));
  add('twój twoja twoje twoi twojego twojej twoim twoich twoją', D('twój', 2));
  add('nasz nasza nasze nasi naszego naszej naszym naszych', D('nasz', 1));
  add('swój swoja swoje swoich swojego swojej', D('swój'));
  add('ten ta to te tego tej tym tych tę', D('ten'));
  add('co', () => cand('PRON', 'co', { case: 'nom', person: 3 }, { wh: 'what', sub: 'amb' }));
  add('czego czym', () => cand('PRON', 'co', { case: 'gen' }, { wh: 'what' }));
  add('kto', () => cand('PRON', 'kto', { case: 'nom', person: 3 }, { wh: 'who', sub: 'relative' }));
  add('kogo komu', () => cand('PRON', 'kto', { case: 'acc' }, { wh: 'who' }));
  add('dlaczego czemu', () => cand('ADV', 'dlaczego', {}, { wh: 'why' }));
  add('jak', () => [cand('ADV', 'jak', {}, { wh: 'how' }), cand('ADP', 'jak')]);
  add('kiedy', () => cand('ADV', 'kiedy', {}, { wh: 'when', sub: 'temporal' }));
  add('gdzie dokąd skąd', () => cand('ADV', 'gdzie', {}, { wh: 'where', sub: 'relative' }));
  add('który która które którzy którego której których którym', (w) =>
    cand('DET', 'który', adjFeats(w), { wh: 'which', sub: 'relative' }),
  );
  add('jaki jaka jakie jakiego jakiej', (w) => cand('DET', 'jaki', adjFeats(w), { wh: 'which' }));
  add('ile', () => cand('ADV', 'ile', {}, { wh: 'how_much' }));
  add('czy', () => [
    cand('PART', 'czy', {}, { qp: true }),
    cand('CONJ', 'czy', {}, { coord: 'or' }),
  ]);
  add('nie', () => [
    cand('PART', 'nie', {}, { neg: true }),
    cand('INTJ', 'nie', {}, { tag: true }),
  ]);
  add('nic nikt', (w) => cand('PRON', w, { case: 'nom', person: 3 }, { negq: true }));
  add('nigdy nigdzie', (w) => cand('ADV', w, {}, { negq: true }));
  add('żaden żadna żadne żadnego', (w) => cand('DET', 'żaden', adjFeats(w), { negq: true }));
  add('i oraz', () => cand('CONJ', 'i', {}, { coord: 'and' }));
  add('a', () => cand('CONJ', 'a', {}, { coord: 'but' }));
  add('ale lecz jednak', () => cand('CONJ', 'ale', {}, { coord: 'but' }));
  add('albo lub', () => cand('CONJ', 'albo', {}, { coord: 'or' }));
  add('więc dlatego zatem', () => cand('CONJ', 'więc', {}, { coord: 'so' }));
  add('że', () => cand('SCONJ', 'że', {}, { sub: 'amb' }));
  add('żeby aby', () => cand('SCONJ', 'żeby', {}, { sub: 'purpose' }));
  add('jeśli jeżeli jak', (w) =>
    w === 'jak' ? [] : cand('SCONJ', 'jeśli', {}, { sub: 'conditional' }),
  );
  add('gdyby', () => cand('SCONJ', 'gdyby', {}, { sub: 'conditional' }));
  add('bo ponieważ', () => cand('SCONJ', 'bo', {}, { sub: 'causal' }));
  add('chociaż choć', () => cand('SCONJ', 'chociaż', {}, { sub: 'concessive' }));
  add('gdy zanim dopóki odkąd', () => cand('SCONJ', 'gdy', {}, { sub: 'temporal' }));
  add('niż jakby', () => cand('SCONJ', 'niż', {}, { sub: 'comparison' }));
  add(
    'w we na z ze do od dla bez pod nad za przed po przez o u przy między obok około zamiast wokół koło ku oprócz',
    (w) => cand('ADP', w),
  );
  add('można', () => cand('ADV', 'można', { form: 'pred' }, { predic: 'can' }));
  add('trzeba potrzeba należy', (w) => cand('ADV', w, { form: 'pred' }, { predic: 'need' }));
  add('warto', () => cand('ADV', 'warto', { form: 'pred' }, { predic: 'should' }));
  add('najlepiej lepiej dobrze źle ciężko trudno łatwo normalnie', (w) =>
    cand('ADV', w, { form: 'pred' }, { predic: 'eval' }),
  );
  add('prawda tak', (w) => cand('INTJ', w, {}, { tag: true }));
  add('dziennie codziennie często czasem rzadko zawsze', (w) =>
    cand('ADV', w, {}, { sem: 'frequency' }),
  );
  add('bardzo trochę za zbyt', (w) => (w === 'za' ? [] : cand('ADV', w, {}, { sem: 'degree' })));
  add('proszę', () => cand('INTJ', 'proszę', {}, { please: true, disc: true }));
  add('hej cześć ok okej no dzięki', (w) => cand('INTJ', w, {}, { disc: true }));
  add('już jeszcze tylko też także nawet', (w) => cand('PART', w));
  add('bym byś by byśmy', (w) => cand('PART', w, {}, { disc: false }));
  add('dalej wciąż ciągle nadal', (w) => cand('ADV', w, {}, { sem: 'time' }));
  return m;
}

function adjFeats(w: string): Feats {
  const f = fold(w);
  if (/(ego)$/.test(f)) return { case: 'gen', number: 'sg' };
  if (/(emu)$/.test(f)) return { case: 'dat', number: 'sg' };
  if (/(ych|ich)$/.test(f)) return { case: 'gen', number: 'pl' };
  if (/(ymi|imi)$/.test(f)) return { case: 'ins', number: 'pl' };
  if (/(ym|im)$/.test(f)) return { case: 'ins', number: 'sg' };
  if (/ej$/.test(f)) return { case: 'gen', number: 'sg', gender: 'f' };
  if (/a$/.test(w) && !/ą$/.test(w)) return { case: 'nom', number: 'sg', gender: 'f' };
  if (/ą$/.test(w)) return { case: 'acc', number: 'sg', gender: 'f' };
  if (/[yi]$/.test(f)) return { case: 'nom', number: 'sg', gender: 'm' };
  if (/e$/.test(f)) return { case: 'nom', number: 'pl' };
  return {};
}

function lex(): Lex {
  if (L) return L;
  const nouns = new Map<string, string>();
  for (const n of words(PL_NOUNS)) nouns.set(fold(n), n);
  L = { forms: buildForms(), closed: closed(), nouns, adj: new Set(words(PL_ADJ).map(fold)) };
  return L;
}

function analyze(norm: string, lk: string): Cand[] {
  const l = lex();
  const out: Cand[] = [];
  if (/^\d/.test(norm)) return [cand('NUM', norm, {}, { num: Number(norm) })];
  const nw = numWord('pl', lk);
  if (nw !== undefined) out.push(cand('NUM', norm, {}, { num: nw }));
  out.push(...(l.closed.get('=' + norm) ?? l.closed.get(lk) ?? []));
  // a word typed with diacritics must match exactly ("kelį" is not "keli")
  out.push(...(l.forms.get('=' + norm) ?? (norm === lk ? l.forms.get(lk) : undefined) ?? []));
  if (out.some((c) => c.pos !== 'NOUN')) return out;
  // adjectives
  for (const e of [
    'ego',
    'emu',
    'ych',
    'ich',
    'ymi',
    'imi',
    'ym',
    'im',
    'ej',
    'a',
    'e',
    'y',
    'i',
    'ą',
  ]) {
    if (!lk.endsWith(fold(e))) continue;
    const st = lk.slice(0, lk.length - fold(e).length);
    for (const lm of [st + 'y', st + 'i'])
      if (l.adj.has(lm)) return [cand('ADJ', lm, adjFeats(norm))];
  }
  const n = l.nouns.get(lk);
  if (n)
    return [
      cand('NOUN', n, {
        case: 'nom',
        number: /[yi]$/.test(lk) && !/(dzien)$/.test(lk) ? 'pl' : 'sg',
      }),
    ];
  for (const p of PL_PREFIXES) {
    if (!lk.startsWith(p) || lk.length - p.length < 4) continue;
    const rest = norm.slice(p.length);
    const cs = (l.forms.get('=' + rest) ?? []).filter(
      (c) => c.pos === 'VERB' && c.feats.aspect !== 'perfective',
    );
    if (cs.length)
      return cs.map((c) => cand('VERB', p + c.lemma, { ...c.feats, aspect: 'perfective' }, c.x));
  }
  const gv = guessVerb(norm);
  if (gv.length) return gv;
  // passive / past participles used as adjectives: zamknięta, zmęczony, przerwany
  if (
    /(ony|ona|one|eni|iony|iona|ione|ięty|ięta|ięte|ęci|any|ana|ane|ani|yty|yta|yte|ity|ita|ite)$/.test(
      norm,
    ) &&
    norm.length > 5
  )
    return [cand('ADJ', norm.replace(/[ae]$/, 'y'), adjFeats(norm))];
  // oblique noun endings
  const obl = /(ow|om|ami|ach|em|iem|owi|ie|u|a|e|ę|ą)$/.exec(lk);
  if (obl && lk.length > 4) {
    const st = lk.slice(0, -obl[1].length);
    for (const [k, v] of l.nouns)
      if (k.startsWith(st) && k.length - st.length <= 2)
        return [
          cand('NOUN', v, {
            case: obl[1] === 'ow' ? 'gen' : 'acc',
            number: /ow|om|ami|ach/.test(obl[1]) ? 'pl' : 'sg',
          }),
        ];
  }
  return [cand('NOUN', norm, { case: /(ow|om|ami|ach|ę|ą|u)$/.test(lk) ? 'acc' : 'nom' })];
}

const MWES: MWE[] = [
  mw('jak dlugo', { wh: 'how_long' }),
  mw('jak czesto', { wh: 'how_often' }),
  mw('ile czasu', { wh: 'how_long' }),
  mw('o ktorej', { wh: 'when' }),
  mw('mimo ze', { sub: 'concessive' }, 'SCONJ'),
  mw('mimo , ze', { sub: 'concessive' }, 'SCONJ'),
  mw('po tym , jak', { sub: 'temporal' }, 'SCONJ'),
  mw('po tym jak', { sub: 'temporal' }, 'SCONJ'),
  mw('przed tym , jak', { sub: 'temporal' }, 'SCONJ'),
  mw('od kiedy', { sub: 'temporal' }, 'SCONJ'),
  mw('odkad', { sub: 'temporal' }, 'SCONJ'),
  mw('dlatego , ze', { sub: 'causal' }, 'SCONJ'),
  mw('dlatego ze', { sub: 'causal' }, 'SCONJ'),
  mw('czy nie', { orNot: true }),
  mw('z rzedu', { sem: 'manner' }, 'ADV'),
  mw('u mnie', { poss: true }),
  mw('szczerze mowiac', { disc: true }, 'INTJ'),
];

const MODAL: Record<string, Modality> = {
  móc: 'can',
  chcieć: 'want',
  musieć: 'must',
  mieć: 'must',
  potrzebować: 'need',
  powinien: 'should',
  umieć: 'can',
  potrafić: 'can',
  zdołać: 'can',
  zamierzać: 'want',
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
    if (t.norm === 'ze') {
      pick(
        t,
        next &&
          (next.kind === 'n' ||
            next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'NUM' || c.pos === 'DET'))
          ? 'ADP'
          : 'SCONJ',
      );
      continue;
    }
    if (
      t.lk === 'ile' &&
      next &&
      (next.mx.unit ||
        (/(ek|ow|an|en|ii|yi|ych|ich)$/.test(next.lk) && !/^(bialek)$/.test(next.lk)))
    ) {
      choose(t, t.cands[0]);
      t.x = { ...t.x, wh: 'how_many' };
      continue;
    }
    if (t.lk === 'czy') {
      pick(t, 'PART');
      continue;
    }
    if (t.lk === 'nie') {
      pick(t, prev && prev.kind === 'p' && (!next || next.kind === 'p') ? 'INTJ' : 'PART');
      continue;
    }
    if (t.lk === 'tak' || t.lk === 'prawda') {
      choose(t, t.cands[0]);
      continue;
    }
    if (t.lk === 'jak') {
      // comparison "głodny jak wilk", "silny jak koń": no finite verb follows
      const finAhead = ts
        .slice(i + 1)
        .some((u) =>
          u.kind === 'p'
            ? false
            : u.cands.some((c) => (c.pos === 'VERB' || c.pos === 'AUX') && c.feats.form === 'fin'),
        );
      pick(
        t,
        prev &&
          (prev.pos === 'NOUN' ||
            prev.pos === 'ADJ' ||
            prev.pos === 'ADV' ||
            prev.pos === 'VERB') &&
          next &&
          next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'PRON') &&
          !next.cands.some((c) => c.pos === 'VERB') &&
          !finAhead
          ? 'ADP'
          : 'ADV',
      );
      continue;
    }
    choose(
      t,
      t.cands.find((c) => c.pos === 'VERB' || c.pos === 'AUX') &&
        t.cands.some((c) => c.pos === 'NOUN')
        ? (t.cands.find((c) => c.pos === 'NOUN') as Cand)
        : t.cands[0],
    );
  }
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.pos !== 'VERB' && t.pos !== 'AUX') continue;
    const inf = ts.slice(i + 1, i + 4).some((u) => u.pos === 'VERB' && u.feats.form === 'inf');
    if (MODAL[t.lemma] && inf) t.x = { ...t.x, modal: MODAL[t.lemma] };
    if (t.lemma === 'być' && t.feats.tense === 'future') {
      // "będę robić" / "będę robił": analytic future
      const lf = ts
        .slice(i + 1, i + 4)
        .find((u) => u.pos === 'VERB' && u.feats.tense === 'past' && u.feats.form === 'fin');
      if (inf) t.x = { ...t.x, aux: 'fut' };
      else if (lf) {
        t.x = { ...t.x, aux: 'fut' };
        lf.feats = { ...lf.feats, form: 'inf', tense: undefined };
      }
    }
    if (
      /^(wydawać)$/.test(t.lemma) &&
      ts.slice(Math.max(0, i - 2), i + 3).some((u) => u.lk === 'mi' || u.lk === 'ci')
    )
      t.x = { ...t.x, impers: true };
  }
}

/** Is this (folded) word known to the Polish lexicon? */
export function plKnows(lk: string): boolean {
  const l = lex();
  return l.closed.has(lk) || l.forms.has(lk) || l.nouns.has(lk) || l.adj.has(lk);
}

export const PL: LangSpec = {
  lang: 'pl',
  prodrop: true,
  analyze,
  mwe: MWES,
  disambig,
  nomCapable: (t) =>
    (t.pos === 'PRON' || t.pos === 'NOUN' || t.pos === 'ADJ') &&
    (!t.feats.case || t.feats.case === 'nom'),
  cogn: (t) =>
    /^(wiedzieć|myśleć|mówić|powiedzieć|wyjaśnić|wyjaśniać|pokazać|pokazywać|pytać|zapytać|rozumieć|zrozumieć|czuć|poczuć|pamiętać|pewny|sądzić|uważać|wierzyć|zapisać|policzyć|sprawdzić|sprawdzać|napisać|odpowiedzieć|przypomnieć|zapomnieć|widzieć|zobaczyć|słyszeć|obiecać|tłumaczyć|wytłumaczyć|martwić|bać|wydawać|dowiedzieć|zauważyć|powtórzyć|podpowiedzieć|doradzić|poradzić|ciekawy|normalny|dziwny|możliwy|wierzyć|uwierzyć)$/.test(
      t.lemma,
    ),
};
