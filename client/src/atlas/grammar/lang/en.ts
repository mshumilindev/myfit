/** English: contractions, lexicon + morphology (-s/-ed/-ing, ~150 irregulars), contextual POS rules. */
import {
  EN_ADJ,
  EN_ADV,
  EN_COGN,
  EN_DISC,
  EN_INTJ,
  EN_IRREGULAR,
  EN_NOUNS,
  EN_VERBS,
} from '../lex/en';
import { TIMES_ADV, numWord } from '../lex/measure';
import {
  cand,
  choose,
  memo,
  mw,
  pick,
  ux,
  words,
  wset,
  type Cand,
  type LangSpec,
  type MWE,
  type T,
  type X,
} from '../core';
import type { RawTok } from '../tokenize';
import type { AdverbialSem, Pos } from '../types';

interface Lex {
  verbs: Set<string>;
  past: Map<string, string>;
  pp: Map<string, string>;
  adj: Set<string>;
  adv: Set<string>;
  nouns: Set<string>;
  cogn: Set<string>;
  intj: Set<string>;
  disc: Set<string>;
  closed: Map<string, Cand[]>;
}

let L: Lex | null = null;

const SEM: [AdverbialSem, string][] = [
  [
    'time',
    'today tomorrow yesterday tonight now then soon later early late already still yet recently lately again ago before finally currently',
  ],
  [
    'frequency',
    'always never often sometimes usually rarely seldom daily weekly twice once thrice regularly occasionally constantly ever',
  ],
  [
    'place',
    'here there home outside inside everywhere somewhere anywhere upstairs downstairs indoors outdoors away back',
  ],
  [
    'manner',
    'properly correctly slowly quickly well badly hard fast carefully gently easily deliberately straight together alone',
  ],
  [
    'degree',
    'very really so too quite pretty extremely totally completely super kinda rather almost nearly barely fairly slightly just only even',
  ],
];
const semOf = new Map<string, AdverbialSem>();
for (const [s, ws] of SEM) for (const w of words(ws)) if (!semOf.has(w)) semOf.set(w, s);

function build(): Lex {
  const verbs = wset(EN_VERBS);
  const past = new Map<string, string>();
  const pp = new Map<string, string>();
  for (const row of EN_IRREGULAR.split('|')) {
    const [b, p, q] = words(row);
    if (!b) continue;
    verbs.add(b);
    past.set(p, b);
    pp.set(q ?? p, b);
  }
  const closed = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) {
      const c = f(w);
      const arr = closed.get(w) ?? [];
      arr.push(...(Array.isArray(c) ? c : [c]));
      closed.set(w, arr);
    }
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c?: 'nom' | 'acc'): Cand =>
    cand('PRON', lemma, { person: p, number: n, case: c }, { pron: { p, n, c } });
  add('i', () => P('i', 1, 'sg', 'nom'));
  add('me', () => P('i', 1, 'sg', 'acc'));
  add('myself', () => P('myself', 1, 'sg', 'acc'));
  add('you u ya ye', () => P('you', 2, 'sg'));
  add('yourself yourselves', () => P('yourself', 2, 'sg', 'acc'));
  add('he she', (w) => P(w, 3, 'sg', 'nom'));
  add('him', () => P('he', 3, 'sg', 'acc'));
  add('it', () => P('it', 3, 'sg'));
  add('we', () => P('we', 1, 'pl', 'nom'));
  add('us', () => P('we', 1, 'pl', 'acc'));
  add('they', () => P('they', 3, 'pl', 'nom'));
  add('them', () => P('they', 3, 'pl', 'acc'));
  add('himself herself itself themselves ourselves', (w) => cand('PRON', w, {}));
  const poss = (lemma: string, p: 1 | 2 | 3): Cand =>
    cand('DET', lemma, { person: p, case: 'gen' }, { pron: { p, n: 'sg', c: 'gen' } });
  add('my', () => poss('my', 1));
  add('your ur yur', () => poss('your', 2));
  add('his its their', (w) => poss(w, 3));
  add('her', () => [P('she', 3, 'sg', 'acc'), poss('her', 3)]);
  add('our', () => poss('our', 1));
  add('mine yours ours theirs hers', (w) => cand('PRON', w, {}));
  add('this these', (w) => [cand('DET', w), cand('PRON', w, { person: 3 })]);
  add('those', (w) => [cand('DET', w), cand('PRON', w, { person: 3, number: 'pl' })]);
  add('that', (w) => [
    cand('PRON', w, { person: 3 }),
    cand('DET', w),
    cand('SCONJ', w, {}, { sub: 'amb' }),
  ]);
  add('something anything everything someone anyone everyone everybody somebody anybody one', (w) =>
    cand('PRON', w, { person: 3, number: 'sg' }),
  );
  add('nothing nobody noone none', (w) =>
    cand('PRON', w, { person: 3, number: 'sg' }, { negq: true }),
  );
  add('no', () => [cand('DET', 'no', {}, { negq: true }), cand('INTJ', 'no')]);
  add('never', () => cand('ADV', 'never', {}, { negq: true, sem: 'frequency' }));
  add('neither nor', (w) => cand('CONJ', w, {}, { negq: true }));
  add('what wat wut waht wht', () => [
    cand('PRON', 'what', { person: 3 }, { wh: 'what', sub: 'amb' }),
    cand('DET', 'what', {}, { wh: 'what' }),
  ]);
  add('which', () => [
    cand('DET', 'which', {}, { wh: 'which' }),
    cand('PRON', 'which', { person: 3 }, { wh: 'which', sub: 'relative' }),
  ]);
  add('who whom', () => cand('PRON', 'who', { person: 3 }, { wh: 'who', sub: 'relative' }));
  add('whose', () => cand('DET', 'whose', {}, { wh: 'who', sub: 'relative' }));
  add('where', () => cand('ADV', 'where', {}, { wh: 'where', sub: 'relative' }));
  add('when', () => cand('ADV', 'when', {}, { wh: 'when', sub: 'temporal' }));
  add('why', () => cand('ADV', 'why', {}, { wh: 'why' }));
  add('how hwo hw', () => cand('ADV', 'how', {}, { wh: 'how' }));
  add('whenever', () => cand('SCONJ', 'whenever', {}, { sub: 'temporal' }));
  add('wherever', () => cand('SCONJ', 'wherever', {}, { sub: 'relative' }));
  add('whatever whichever whoever', (w) => cand('PRON', w, {}));
  add('a an the', (w) => cand('DET', w === 'an' ? 'a' : w));
  add('some any every each all both either another other such several', (w) => cand('DET', w));
  add('much many more most less least few little enough', (w) => [
    cand('DET', w),
    cand('ADV', w, {}, { sem: 'degree' }),
  ]);
  // Auxiliaries.
  const BE: [string, Partial<Cand['feats']>][] = [
    ['am', { tense: 'present', person: 1, number: 'sg' }],
    ['is', { tense: 'present', person: 3, number: 'sg' }],
    ['are', { tense: 'present' }],
    ['was', { tense: 'past', number: 'sg' }],
    ['were', { tense: 'past' }],
    ['be', {}],
    ['been', { form: 'part' }],
    ['being', { form: 'ger' }],
  ];
  for (const [w, f] of BE) {
    add(w, () =>
      cand(
        'AUX',
        'be',
        { form: w === 'be' || w === 'been' || w === 'being' ? f.form : 'fin', ...f },
        { aux: 'be', cop: true },
      ),
    );
  }
  add('have', () => [
    cand('AUX', 'have', { tense: 'present', form: 'fin' }, { aux: 'have' }),
    cand('VERB', 'have', {}, { vf: 'base' }),
  ]);
  add('has', () => [
    cand(
      'AUX',
      'have',
      { tense: 'present', person: 3, number: 'sg', form: 'fin' },
      { aux: 'have' },
    ),
    cand('VERB', 'have', { tense: 'present', person: 3, number: 'sg', form: 'fin' }, { vf: 's' }),
  ]);
  add('had', () => [
    cand('AUX', 'have', { tense: 'past', form: 'fin' }, { aux: 'have' }),
    cand('VERB', 'have', { tense: 'past' }, { vf: 'pastpp' }),
  ]);
  add('having', () => cand('VERB', 'have', { form: 'ger' }, { vf: 'ing' }));
  add('do', () => [
    cand('AUX', 'do', { tense: 'present', form: 'fin' }, { aux: 'do' }),
    cand('VERB', 'do', {}, { vf: 'base' }),
  ]);
  add('does', () => [
    cand('AUX', 'do', { tense: 'present', person: 3, number: 'sg', form: 'fin' }, { aux: 'do' }),
    cand('VERB', 'do', { tense: 'present', person: 3, number: 'sg', form: 'fin' }, { vf: 's' }),
  ]);
  add('did', () => [
    cand('AUX', 'do', { tense: 'past', form: 'fin' }, { aux: 'do' }),
    cand('VERB', 'do', { tense: 'past', form: 'fin' }, { vf: 'past' }),
  ]);
  add('will shall', (w) =>
    cand(
      'AUX',
      'will',
      { tense: 'future', form: 'fin' },
      { aux: 'will', modal: w === 'shall' ? 'should' : undefined },
    ),
  );
  add('would', () => cand('AUX', 'would', { form: 'fin' }, { aux: 'would' }));
  add('can', () => cand('AUX', 'can', { tense: 'present', form: 'fin' }, { modal: 'can' }));
  add('could', () => cand('AUX', 'can', { form: 'fin' }, { modal: 'can', aux: 'would' }));
  add('may might', (w) =>
    cand(
      'AUX',
      'may',
      { tense: 'present', form: 'fin' },
      { modal: 'may', aux: w === 'might' ? 'would' : undefined },
    ),
  );
  add('must', () => cand('AUX', 'must', { tense: 'present', form: 'fin' }, { modal: 'must' }));
  add('should', () =>
    cand('AUX', 'should', { tense: 'present', form: 'fin' }, { modal: 'should' }),
  );
  add('ought', () =>
    cand('AUX', 'should', { tense: 'present', form: 'fin' }, { modal: 'should', modalTo: true }),
  );
  add('not', () => cand('PART', 'not', {}, { neg: true }));
  add('to', () => [cand('PART', 'to'), cand('ADP', 'to')]);
  add("'s", () => cand('PART', "'s"));
  add(
    'about above across against along among around at behind below beneath beside besides between beyond by despite down during except from in inside into near of off on onto out outside over past per through throughout toward towards under up upon via with within without vs versus',
    (w) => cand('ADP', w),
  );
  add('for', () => cand('ADP', 'for'));
  add('before after until till since once', (w) => [
    cand('ADP', w),
    cand('SCONJ', w, {}, { sub: w === 'since' ? 'causal' : 'temporal' }),
    ...(w === 'before' || w === 'once'
      ? [cand('ADV', w, {}, { sem: 'time' as AdverbialSem })]
      : []),
  ]);
  add('like', () => [
    cand('ADP', 'like'),
    cand('VERB', 'like', {}, { vf: 'base' }),
    cand('SCONJ', 'like', {}, { sub: 'complement' }),
  ]);
  add('as', () => [cand('ADP', 'as'), cand('SCONJ', 'as', {}, { sub: 'comparison' })]);
  add('than', () => [cand('ADP', 'than'), cand('SCONJ', 'than', {}, { sub: 'comparison' })]);
  add('and plus &', () => cand('CONJ', 'and', {}, { coord: 'and' }));
  add('or', () => cand('CONJ', 'or', {}, { coord: 'or' }));
  add('but yet', () => cand('CONJ', 'but', {}, { coord: 'but' }));
  add('so', () => [
    cand('CONJ', 'so', {}, { coord: 'so' }),
    cand('ADV', 'so', {}, { sem: 'degree' }),
  ]);
  add('therefore thus hence', () => cand('CONJ', 'so', {}, { coord: 'so' }));
  add('if', () => cand('SCONJ', 'if', {}, { sub: 'conditional' }));
  add('unless', () => cand('SCONJ', 'unless', {}, { sub: 'conditional' }));
  add('because cause cuz coz bc bcs becuz becoz', () =>
    cand('SCONJ', 'because', {}, { sub: 'causal' }),
  );
  add('although though tho altho', () => cand('SCONJ', 'although', {}, { sub: 'concessive' }));
  add('while whereas', () => cand('SCONJ', 'while', {}, { sub: 'temporal' }));
  add('whether', () => cand('SCONJ', 'whether', {}, { sub: 'complement' }));
  add('please pls plz pleas', () => cand('INTJ', 'please', {}, { please: true, disc: true }));
  add('thanks thx ty cheers', () => cand('INTJ', 'thanks', {}, { disc: true }));
  add(
    'ok okay okey yes yeah yep yup nope nah lol haha lmao hmm oh ah bro dude yo hey hi hello',
    (w) => cand('INTJ', w, {}, { disc: true }),
  );
  add('atlas', () => cand('NOUN', 'atlas', {}, { voc: true, disc: true }));
  add('right correct', (w) => [cand('ADJ', w), cand('ADV', w), cand('INTJ', w, {}, { tag: true })]);
  add('there', () => [
    cand('PRON', 'there', { person: 3 }),
    cand('ADV', 'there', {}, { sem: 'place' }),
  ]);
  add('wow omg yay whoa hooray hurray', (w) => cand('INTJ', w, {}, { excl: true, disc: true }));
  add('let', () => cand('VERB', 'let', {}, { vf: 'base' }));
  return {
    verbs,
    past,
    pp,
    adj: wset(EN_ADJ),
    adv: wset(EN_ADV),
    nouns: wset(EN_NOUNS),
    cogn: wset(EN_COGN),
    intj: wset(EN_INTJ),
    disc: wset(EN_DISC),
    closed,
  };
}

function lex(): Lex {
  return (L ??= build());
}

const VOW = /[aeiou]/;
const EXCL = wset(
  'please pls plz thanks thx ty ok okay yes yeah yep no nope lol haha atlas so that there right can will would should must may might could',
);

function verbCands(w: string, l: Lex): Cand[] {
  const out: Cand[] = [];
  const V = (lemma: string, vf: X['vf'], feats: Cand['feats'] = {}): void => {
    if (!out.some((c) => c.lemma === lemma && c.x?.vf === vf))
      out.push(cand('VERB', lemma, feats, { vf }));
  };
  if (l.verbs.has(w)) V(w, 'base');
  const pb = l.past.get(w);
  const qb = l.pp.get(w);
  if (pb && qb) V(pb, 'pastpp', { tense: 'past' });
  else if (pb) V(pb, 'past', { tense: 'past', form: 'fin' });
  else if (qb) V(qb, 'pp', { tense: 'past', form: 'part' });
  const s3 = {
    tense: 'present' as const,
    person: 3 as const,
    number: 'sg' as const,
    form: 'fin' as const,
  };
  if (w === 'goes') V('go', 's', s3);
  if (w.endsWith('s') && w.length > 2) {
    const c = [w.slice(0, -1)];
    if (w.endsWith('es')) c.push(w.slice(0, -2));
    if (w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
    for (const b of c) if (l.verbs.has(b)) V(b, 's', s3);
  }
  if (w.endsWith('ed') && w.length > 3) {
    const st = w.slice(0, -2);
    const c = [st, w.slice(0, -1)];
    if (/(.)\1$/.test(st)) c.push(st.slice(0, -1));
    if (w.endsWith('ied')) c.push(w.slice(0, -3) + 'y');
    for (const b of c) if (l.verbs.has(b)) V(b, 'pastpp', { tense: 'past' });
  }
  if (w.endsWith('ing') && w.length > 4) {
    const st = w.slice(0, -3);
    const c = [st, st + 'e'];
    if (/(.)\1$/.test(st)) c.push(st.slice(0, -1));
    if (st.endsWith('y')) c.push(st.slice(0, -1) + 'ie');
    for (const b of c) if (l.verbs.has(b)) V(b, 'ing', { form: 'ger' });
  }
  return out;
}

const IRR_ADJ: Record<string, [string, 'cmp' | 'sup']> = {
  better: ['good', 'cmp'],
  best: ['good', 'sup'],
  worse: ['bad', 'cmp'],
  worst: ['bad', 'sup'],
  further: ['far', 'cmp'],
  farther: ['far', 'cmp'],
};

function adjCands(w: string, l: Lex): Cand[] {
  if (IRR_ADJ[w]) return [cand('ADJ', IRR_ADJ[w][0], { degree: IRR_ADJ[w][1] })];
  if (l.adj.has(w)) return [cand('ADJ', w, { degree: 'pos' })];
  for (const [suf, deg] of [
    ['er', 'cmp'],
    ['est', 'sup'],
  ] as const) {
    if (!w.endsWith(suf) || w.length < suf.length + 3) continue;
    const st = w.slice(0, -suf.length);
    const c = [st, st + 'e'];
    if (/(.)\1$/.test(st)) c.push(st.slice(0, -1));
    if (st.endsWith('i')) c.push(st.slice(0, -1) + 'y');
    for (const b of c) if (l.adj.has(b)) return [cand('ADJ', b, { degree: deg })];
  }
  return [];
}

const IRR_PL: Record<string, string> = {
  feet: 'foot',
  teeth: 'tooth',
  men: 'man',
  women: 'woman',
  people: 'person',
  children: 'child',
  calves: 'calf',
  mice: 'mouse',
};

function nounCands(w: string, l: Lex, force: boolean): Cand[] {
  if (IRR_PL[w]) return [cand('NOUN', IRR_PL[w], { number: 'pl' })];
  if (l.nouns.has(w)) {
    const pl = /[^s]s$/.test(w) && l.nouns.has(w.slice(0, -1));
    return [
      cand('NOUN', pl ? w.slice(0, -1) : w, {
        number:
          pl ||
          /^(abs|glutes|quads|lats|delts|traps|hamstrings|gains|stats|carbs|calves|legs|arms|reps|sets)$/.test(
            w,
          )
            ? 'pl'
            : 'sg',
      }),
    ];
  }
  if (w.length > 3 && /[^su]s$/.test(w)) {
    const c = [w.slice(0, -1)];
    if (w.endsWith('es')) c.push(w.slice(0, -2));
    if (w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
    for (const b of c) if (l.nouns.has(b)) return [cand('NOUN', b, { number: 'pl' })];
  }
  if (!force) return [];
  if (w.length > 3 && /[^su]s$/.test(w)) return [cand('NOUN', w.slice(0, -1), { number: 'pl' })];
  return [cand('NOUN', w, { number: 'sg' })];
}

function analyze(w: string): Cand[] {
  const l = lex();
  const out: Cand[] = [];
  const cl = l.closed.get(w);
  if (cl) out.push(...cl);
  if (/^\d/.test(w)) return [cand('NUM', w, {}, { num: Number(w) })];
  const nw = numWord('en', w);
  if (nw !== undefined) out.push(cand('NUM', w, {}, { num: nw }));
  if (TIMES_ADV[w])
    out.push(cand('ADV', w, {}, { num: TIMES_ADV[w], sem: 'frequency', unit: 'time' }));
  if (cl && (EXCL.has(w) || (!l.verbs.has(w) && !l.adj.has(w) && !l.nouns.has(w)))) return out;
  const v = verbCands(w, l);
  const a = adjCands(w, l);
  const nn = nounCands(w, l, false);
  const adv = l.adv.has(w) || semOf.has(w) ? [cand('ADV', w, {}, { sem: semOf.get(w) })] : [];
  // Default preference: base form that is also a known noun → noun first.
  const vFirst = v.some((c) => c.x?.vf !== 'base') || (v.length && !nn.length);
  out.push(...(vFirst ? [...v, ...nn] : [...nn, ...v]), ...a, ...adv);
  if (l.intj.has(w) && !out.some((c) => c.pos === 'INTJ'))
    out.push(cand('INTJ', w, {}, { disc: true }));
  if (out.length) return out;
  // Unknown word: suffix guesses.
  if (w.endsWith('ly') && w.length > 4) return [cand('ADV', w, {}, { sem: 'manner' })];
  if (w.endsWith('ing') && w.length > 4)
    return [cand('VERB', w.slice(0, -3), { form: 'ger' }, { vf: 'ing' })];
  if (w.endsWith('ed') && w.length > 4 && VOW.test(w.slice(0, -2)))
    return [cand('VERB', w.slice(0, -2), { tense: 'past' }, { vf: 'pastpp' })];
  if (/(ous|ful|less|ive|able|ible|al|ic)$/.test(w) && w.length > 5)
    return [cand('ADJ', w, { degree: 'pos' })];
  return nounCands(w, l, true);
}

// ───────────── contractions ─────────────

const NT_BASE: Record<string, string> = {
  do: 'do',
  does: 'does',
  did: 'did',
  is: 'is',
  are: 'are',
  was: 'was',
  were: 'were',
  have: 'have',
  has: 'has',
  had: 'had',
  wo: 'will',
  ca: 'can',
  could: 'could',
  should: 'should',
  would: 'would',
  must: 'must',
  need: 'need',
  ai: 'is',
  might: 'might',
};
const WHOLE: Record<string, string> = {
  gonna: 'going to',
  wanna: 'want to',
  gotta: 'got to',
  hafta: 'have to',
  lemme: 'let me',
  gimme: 'give me',
  dunno: 'do not know',
  idk: 'i do not know',
  tryna: 'trying to',
  kinda: 'kind of',
  im: 'i am',
  ive: 'i have',
  "i'm": 'i am',
  "i've": 'i have',
  "i'd": 'i would',
  "i'll": 'i will',
  youre: 'you are',
  "you're": 'you are',
  "u're": 'you are',
  theyre: 'they are',
  "they're": 'they are',
  "we're": 'we are',
  "we've": 'we have',
  "you've": 'you have',
  "they've": 'they have',
  "you'll": 'you will',
  "we'll": 'we will',
  "it'll": 'it will',
  "that'll": 'that will',
  "you'd": 'you would',
  "we'd": 'we would',
  "they'd": 'they would',
  "he'd": 'he would',
  "she'd": 'she would',
  "let's": 'let us',
  lets: 'let us',
  whats: 'what is',
  thats: 'that is',
  theres: 'there is',
  hows: 'how is',
  wheres: 'where is',
  whos: 'who is',
  cant: 'can not',
  wont: 'will not',
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  isnt: 'is not',
  arent: 'are not',
  wasnt: 'was not',
  werent: 'were not',
  havent: 'have not',
  hasnt: 'has not',
  hadnt: 'had not',
  couldnt: 'could not',
  shouldnt: 'should not',
  wouldnt: 'would not',
  aint: 'is not',
  thx: 'thanks',
  ty: 'thanks',
  tmrw: 'tomorrow',
  tmr: 'tomorrow',
  tmrrw: 'tomorrow',
  '2moro': 'tomorrow',
  ppl: 'people',
  bout: 'about',
  cos: 'because',
  r: 'are',
  "should've": 'should have',
  "could've": 'could have',
  "would've": 'would have',
};
const S_IS = wset(
  'it that what there here he she who how where when why everything nothing something this',
);

function split(t: RawTok, parts: string[]): RawTok[] {
  const out: RawTok[] = [];
  let off = 0;
  const surf = t.text;
  parts.forEach((p, k) => {
    const last = k === parts.length - 1;
    let text = p;
    // Keep the surface where it lines up ("do" + "n't").
    if (k === 0 && surf.toLowerCase().startsWith(p)) text = surf.slice(0, p.length);
    else if (last && off < surf.length) text = surf.slice(off);
    out.push({ text, norm: p, start: t.start + Math.min(off, surf.length), kind: 'w' });
    off += text.length;
  });
  return out;
}

function expand(toks: RawTok[]): RawTok[] {
  const out: RawTok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== 'w') {
      out.push(t);
      continue;
    }
    const w = t.norm;
    if (WHOLE[w] && !(w === 'r' && i === 0)) {
      out.push(...split(t, words(WHOLE[w])));
      continue;
    }
    // "ur" = your / you are.
    if (w === 'ur') {
      const n = toks[i + 1]?.norm ?? '';
      const are =
        /ing$/.test(n) || lex().adj.has(n) || /^(so|not|the|a|right|wrong|welcome)$/.test(n);
      out.push(...split(t, are ? ['you', 'are'] : ['your']));
      continue;
    }
    let m = /^(.+?)n'?t$/.exec(w);
    if (m && NT_BASE[m[1]] && /n'?t$/.test(w) && (w.includes("'") || NT_BASE[m[1]])) {
      if (w.includes("'") || ['didnt', 'dont'].includes(w)) {
        out.push(...split(t, [NT_BASE[m[1]], 'not']));
        continue;
      }
    }
    m = /^(.+)'(s|m|re|ve|d|ll)$/.exec(w);
    if (m) {
      const [, b, s] = m;
      if (s === 's') {
        const nx = toks[i + 1]?.norm ?? '';
        const nxPP = nx === 'been' || nx === 'got' || nx === 'gone' || lex().pp.has(nx);
        if (S_IS.has(b) && nxPP && !lex().past.has(nx)) out.push(...split(t, [b, 'has']));
        else if (S_IS.has(b) && (nx === 'been' || nx === 'got')) out.push(...split(t, [b, 'has']));
        else if (S_IS.has(b)) out.push(...split(t, [b, 'is']));
        else out.push(...split(t, [b, "'s"]));
      } else {
        const full = { m: 'am', re: 'are', ve: 'have', d: 'would', ll: 'will' }[s] as string;
        out.push(...split(t, [b, full]));
      }
      continue;
    }
    // "y" alone at start = why.
    if (w === 'y' && (i === 0 || toks[i - 1].kind === 'p') && toks[i + 1]?.kind === 'w') {
      out.push({ ...t, norm: 'why' });
      continue;
    }
    out.push(t);
  }
  return out;
}

// ───────────── multi-word expressions ─────────────

const atEnd = (n: T | undefined): boolean => !n || n.kind === 'p';
const verbNext = (n: T | undefined): boolean =>
  !!n && n.cands.some((c) => c.pos === 'VERB' && c.x?.vf === 'base');

const MWES: MWE[] = [
  mw('how much', { wh: 'how_much' }),
  mw('how many', { wh: 'how_many' }),
  mw('how long', { wh: 'how_long' }),
  mw('how often', { wh: 'how_often' }),
  mw('how heavy', { wh: 'how_much' }),
  mw('how far', { wh: 'how_much' }),
  mw('how fast', { wh: 'how_much' }),
  mw('how big', { wh: 'how_much' }),
  mw('how come', { wh: 'why' }),
  mw('what time', { wh: 'when' }),
  mw('what about', { wh: 'what', about: true }),
  mw('how about', { wh: 'what', about: true }),
  mw('what if', { wh: 'what', about: true }),
  mw('even though', { sub: 'concessive' }, 'SCONJ'),
  mw('even if', { sub: 'concessive' }, 'SCONJ'),
  mw('so that', { sub: 'purpose' }, 'SCONJ'),
  mw('in order to', { sub: 'purpose' }, 'SCONJ'),
  mw('so as to', { sub: 'purpose' }, 'SCONJ'),
  mw('as soon as', { sub: 'temporal' }, 'SCONJ'),
  mw('as long as', { sub: 'conditional' }, 'SCONJ'),
  mw('in case', { sub: 'conditional' }, 'SCONJ'),
  mw('as if', { sub: 'comparison' }, 'SCONJ'),
  mw('as though', { sub: 'comparison' }, 'SCONJ'),
  mw('rather than', { sub: 'comparison' }, 'ADP'),
  mw('because of', {}, 'ADP'),
  mw('instead of', {}, 'ADP'),
  mw('due to', {}, 'ADP'),
  mw('have to', { modal: 'must', modalTo: true }),
  mw('has to', { modal: 'must', modalTo: true }),
  mw('had to', { modal: 'must', modalTo: true }),
  mw('got to', { modal: 'must', modalTo: true }, undefined, verbNext),
  mw('ought to', { modal: 'should', modalTo: true }),
  mw('supposed to', { modal: 'should', modalTo: true }),
  mw('able to', { modal: 'can', modalTo: true }),
  mw('would like to', { modal: 'want', modalTo: true }),
  mw('would like', { modal: 'want' }),
  mw('would love to', { modal: 'want', modalTo: true }),
  mw('going to', { aux: 'going' }, undefined, verbNext),
  mw('used to', { aux: 'used' }, undefined, verbNext),
  mw('a bit', { sem: 'degree' }, 'ADV'),
  mw(
    'a little',
    { sem: 'degree' },
    'ADV',
    (n) => !!n && n.kind === 'w' && !n.cands.some((c) => c.pos === 'NOUN' && !c.x?.vf),
  ),
  mw('every time', { sub: 'temporal' }, 'SCONJ', (n) => !!n && n.kind === 'w'),
  mw('each time', { sub: 'temporal' }, 'SCONJ', (n) => !!n && n.kind === 'w'),
  mw('any time', { sub: 'temporal' }, 'SCONJ', (n) => !!n && n.kind === 'w'),
  mw('let us', { hort: true }),
  mw('no one', { negq: true }, 'PRON'),
  mw('kind of', { sem: 'degree' }, 'ADV'),
  mw('a lot', { sem: 'degree' }, 'ADV'),
  mw('at all', { sem: 'degree' }, 'ADV'),
  mw('or not', { orNot: true }),
  mw('to be honest', { disc: true }, 'INTJ'),
  mw('according to', {}, 'ADP'),
  mw('is not it', { tag: true }, undefined, atEnd),
  mw('are not you', { tag: true }, undefined, atEnd),
  mw('do not i', { tag: true }, undefined, atEnd),
  mw('did not i', { tag: true }, undefined, atEnd),
  mw('do not you', { tag: true }, undefined, atEnd),
  mw('did not you', { tag: true }, undefined, atEnd),
  mw('is it not', { tag: true }, undefined, atEnd),
];

// ───────────── contextual disambiguation ─────────────

const SUBJ_ADV = wset(
  'usually always never just also still only really even already often sometimes rarely actually honestly literally basically probably definitely constantly ever totally',
);
const COP_LIKE = wset('be feel get look seem become stay sound keep');
const COMP_ADJ = wset(
  'sure normal possible true likely afraid glad happy worried aware certain okay ok fine bad good weird strange',
);

function isSubjPron(t: T | undefined): boolean {
  return !!t && t.pos === 'PRON' && !!t.x.pron && t.x.pron.c !== 'acc';
}

/** Is there a clause (subject + finite verb) starting at j? */
function clauseAhead(ts: T[], j: number): boolean {
  const t = ts[j];
  if (!t) return false;
  const pr = t.cands.find((c) => c.pos === 'PRON' && c.x?.pron && c.x.pron.c !== 'acc');
  if (pr) return true;
  if (!t.cands.some((c) => c.pos === 'DET' || c.pos === 'NOUN' || c.pos === 'NUM')) return false;
  let noun = t.cands.some((c) => c.pos === 'NOUN');
  for (let k = j + 1; k < Math.min(ts.length, j + 6); k++) {
    const u = ts[k];
    if (u.kind === 'p') return false;
    if (
      u.cands.some(
        (c) =>
          c.pos === 'AUX' ||
          (c.pos === 'VERB' && (c.x?.vf === 's' || c.x?.vf === 'past' || c.x?.vf === 'pastpp')),
      )
    )
      return true;
    if (
      noun &&
      u.cands.some((c) => c.pos === 'VERB' && c.x?.vf === 'base') &&
      ts[k - 1].cands.some((c) => c.pos === 'NOUN' && c.feats.number === 'pl')
    )
      return true;
    if (u.cands.some((c) => c.pos === 'NOUN')) noun = true;
  }
  return false;
}

function disambig(ts: T[]): void {
  const l = lex();
  const pastTime = ts.some((t) =>
    /^(yesterday|last_|day_before|this_morning)/.test(t.mx.time ?? ''),
  );
  let segStart = 0; // index of first token of current segment
  let finite = false;
  let invAux: T | null = null; // do/modal at segment start awaiting subject + verb
  const prevW = (i: number, skipAdv = false): T | undefined => {
    for (let k = i - 1; k >= segStart; k--) {
      const t = ts[k];
      if (t.x.cont && t.pos === 'X') continue;
      if (skipAdv && t.pos === 'ADV' && (SUBJ_ADV.has(t.norm) || t.x.sem === 'degree')) continue;
      return t;
    }
    return undefined;
  };
  const atStart = (i: number): boolean => {
    for (let k = segStart; k < i; k++) {
      const t = ts[k];
      if (t.x.cont) continue;
      if (
        t.x.disc ||
        t.x.please ||
        t.x.voc ||
        t.pos === 'INTJ' ||
        (t.pos === 'ADV' && /^(just|now|then|also|pls|please|maybe|really)$/.test(t.norm))
      )
        continue;
      if (t.x.time) continue;
      return false;
    }
    return true;
  };
  const newSeg = (i: number): void => {
    segStart = i;
    finite = false;
    invAux = null;
  };
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.kind === 'p' || t.kind === 'e') {
      t.pos = t.kind === 'e' ? 'X' : 'PUNCT';
      t.lemma = t.norm;
      if (t.kind === 'p' && /[,;:()–—-]/.test(t.text)) newSeg(i + 1);
      continue;
    }
    if (t.x.cont) {
      if (t.cands.length && t.pos === 'X') {
        const c =
          t.cands.find((k) => k.pos === 'DET' || k.pos === 'ADV' || k.pos === 'ADP') ?? t.cands[0];
        choose(t, c);
      }
      continue;
    }
    const next = ts[i + 1];
    if (t.x.time) {
      if (t.cands.length)
        choose(
          t,
          t.cands.find(
            (c) => c.pos === 'ADV' || c.pos === 'NOUN' || c.pos === 'ADJ' || c.pos === 'DET',
          ) ?? t.cands[0],
        );
      if (t.pos === 'VERB') t.pos = 'ADJ';
      t.x.sem = 'time';
      continue;
    }
    if (
      t.x.wh &&
      (t.x.wh === 'how_much' ||
        t.x.wh === 'how_many' ||
        t.x.wh === 'how_long' ||
        t.x.wh === 'how_often' ||
        t.x.about ||
        t.x.wh === 'why' ||
        t.x.wh === 'when') &&
      t.norm !== 'when' &&
      t.norm !== 'what' &&
      t.norm !== 'which'
    ) {
      t.pos = 'ADV';
      t.lemma = t.x.wh === 'why' && t.norm === 'how' ? 'how' : t.norm;
      if (i > segStart) newSeg(i);
      continue;
    }
    // "the warm up you gave me": a phrasal-verb noun after a determiner
    if (
      (t.norm === 'warm' || t.norm === 'cool') &&
      prevW(i)?.pos === 'DET' &&
      next &&
      (next.norm === 'up' || next.norm === 'down')
    ) {
      t.pos = 'NOUN';
      t.lemma = t.norm + next.norm;
      t.feats = { number: 'sg' };
      t.x = { ...t.mx };
      next.cands = [cand('NOUN', t.lemma, { number: 'sg' })];
      continue;
    }
    if (t.cands.length === 1) {
      choose(t, t.cands[0]);
      // zero derivation: a bare verb after a determiner / possessive is a noun ("my last set", "the push")
      const pv = prevW(i);
      const pvv = pv ? prevW(pv.i) : undefined;
      if (t.pos === 'VERB' && t.x.vf === 'base' && !invAux && npOpen(i) && nounSlotNext(next)) {
        t.pos = 'NOUN';
        t.feats = { number: 'sg' };
      }
      // "my resting heart rate": an -ing form between a determiner and a noun is attributive
      if (
        t.pos === 'VERB' &&
        t.x.vf === 'ing' &&
        pv &&
        pv.pos === 'DET' &&
        next &&
        next.kind === 'w' &&
        next.cands.some((c) => c.pos === 'NOUN')
      ) {
        t.pos = 'ADJ';
        t.lemma = t.norm;
        t.feats = {};
      }
      if (
        t.pos === 'VERB' &&
        t.x.vf === 'base' &&
        pv &&
        (((pv.pos === 'DET' || (pv.pos === 'ADJ' && pv.lemma !== 'able')) && !pv.x.wh) ||
          // object compound "recommended band pull aparts"
          (pv.pos === 'NOUN' && pvv?.pos === 'VERB' && pvv.lemma !== 'be'))
      ) {
        t.pos = 'NOUN';
        t.feats = { number: 'sg' };
      }
    } else if (t.cands.length === 0) {
      t.pos = 'X';
      t.lemma = t.norm;
    } else {
      resolve(t, i);
    }
    // Segment bookkeeping.
    if (t.pos === 'CONJ' || t.pos === 'SCONJ' || (t.x.wh && i > segStart && t.pos !== 'DET')) {
      newSeg(i + 1);
      if (t.x.wh) segStart = i;
    }
    if (
      t.pos === 'AUX' &&
      atStart(i) &&
      next &&
      (isSubjPronCand(next) ||
        next.cands.some(
          (c) => c.pos === 'NOUN' || c.pos === 'DET' || (c.pos === 'VERB' && c.x?.vf === 'ing'),
        ))
    )
      invAux = t;
    if (
      t.pos === 'AUX' &&
      ts.slice(segStart, i).some((u) => !!u.x.wh) &&
      next &&
      (isSubjPronCand(next) || next.cands.some((c) => c.pos === 'DET' || c.pos === 'NOUN'))
    )
      invAux = t;
    // run-on "…the next day does that mean…": do-support + subject starts an inverted clause
    if (t.pos === 'AUX' && t.lemma === 'do' && !invAux && next && isSubjPronCand(next)) invAux = t;
    if ((t.pos === 'VERB' && t.feats.form === 'fin') || (t.pos === 'AUX' && t.feats.form === 'fin'))
      finite = true;
    if (t.pos === 'VERB' && invAux && t.i > invAux.i + 1) invAux = null;
  }

  /**
   * Token i continues a noun phrase opened by a determiner ("the 12 km bike ride"), and a verb
   * reading would not agree with the preceding noun ("my knees hurt" stays a verb).
   */
  function npOpen(i: number): boolean {
    const t = ts[i];
    const prev = prevW(i);
    if (!prev || !(prev.pos === 'NOUN' || prev.pos === 'NUM' || prev.x.unit)) return false;
    const vfs = t.cands.filter((c) => c.pos === 'VERB').map((c) => c.x?.vf);
    if (vfs.includes('s') || vfs.includes('past') || vfs.includes('pastpp')) return false;
    if (prev.pos === 'NOUN' && prev.feats.number === 'pl') return false;
    for (let q = i - 1; q >= Math.max(segStart, i - 6); q--) {
      const u = ts[q];
      if (u.pos === 'DET' && !u.x.wh) return true;
      if (!(u.pos === 'NOUN' || u.pos === 'ADJ' || u.pos === 'NUM' || !!u.x.unit || u.norm === 'k'))
        return false;
    }
    return false;
  }

  /** The next token fits after a noun, not after a transitive verb. */
  function nounSlotNext(next: T | undefined): boolean {
    return (
      !next ||
      next.kind === 'p' ||
      next.cands.some((c) => c.pos === 'ADP') ||
      (isSubjPronCand(next) && next.norm !== 'that' && next.norm !== 'it')
    );
  }

  /** A finite verb / auxiliary candidate later in the segment. */
  function laterFinite(i: number): boolean {
    for (let k = i + 1; k < ts.length; k++) {
      const u = ts[k];
      if (u.kind === 'p' || u.cands.some((c) => c.pos === 'CONJ' || c.pos === 'SCONJ'))
        return false;
      if (u.cands.some((c) => c.pos === 'AUX' && c.feats.form === 'fin')) return true;
    }
    return false;
  }

  function isSubjPronCand(n: T): boolean {
    return (
      n.cands.some((c) => c.pos === 'PRON' && !!c.x?.pron && c.x.pron.c !== 'acc') ||
      /^(everyone|everybody|someone|somebody|anyone|anybody|nobody|noone|people|everything|something|nothing)$/.test(
        n.norm,
      ) ||
      n.norm === 'there' ||
      n.norm === 'it' ||
      n.norm === 'this' ||
      n.norm === 'that'
    );
  }

  function resolve(t: T, i: number): void {
    const next = ts[i + 1];
    const prev = prevW(i);
    const prevA = prevW(i, true);
    const w = t.norm;
    const P = (p: Pos | Pos[], f?: (c: Cand) => boolean): boolean => pick(t, p, f);
    if (w === 'that') {
      // "the reason is that I…": copula + clause
      if (
        prev &&
        prev.lemma === 'be' &&
        prev.pos === 'AUX' &&
        clauseAhead(ts, i + 1) &&
        i - segStart > 1
      )
        return void P('SCONJ');
      if (
        prev &&
        (l.cogn.has(prev.lemma) || COMP_ADJ.has(prev.lemma) || prev.norm === 'so') &&
        clauseAhead(ts, i + 1)
      )
        return void P('SCONJ');
      if (
        prev &&
        (prev.pos === 'NOUN' || prev.pos === 'PRON') &&
        next &&
        (next.cands.some(
          (c) => c.pos === 'AUX' || (c.pos === 'VERB' && c.x?.vf !== 'base' && c.x?.vf !== 'ing'),
        ) ||
          clauseAhead(ts, i + 1)) &&
        prev.norm !== 'on'
      )
        return void P('SCONJ');
      if (
        next &&
        !next.cands.some((c) => c.pos === 'AUX' || c.pos === 'VERB') &&
        (next.cands.some((c) => c.pos === 'NOUN') ||
          (next.cands.some((c) => c.pos === 'ADJ') &&
            ts[i + 2]?.cands.some((c) => c.pos === 'NOUN')))
      )
        return void P('DET');
      return void P('PRON');
    }
    if (w === 'what' || w === 'which') {
      if (
        next &&
        next.cands.some((c) => c.pos === 'NOUN') &&
        !next.cands.some((c) => c.pos === 'AUX' || c.pos === 'PRON')
      )
        return void P('DET');
      return void P('PRON');
    }
    if (w === 'so') {
      if (
        next &&
        next.cands.some((c) => c.pos === 'ADJ' || c.pos === 'ADV') &&
        !isSubjPronCand(next)
      )
        return void P('ADV');
      if (next && /^(much|many|far|long|hard|sore|tired)$/.test(next.norm)) return void P('ADV');
      return void P('CONJ');
    }
    if (w === 'like') {
      if (prev && /^(feel|look|seem|sound|felt|feels|looks|seems|sounds)$/.test(prev.norm)) {
        if (clauseAhead(ts, i + 1)) return void P('SCONJ');
        return void P('ADP');
      }
      if (next && next.pos !== 'PUNCT' && next.cands.some((c) => c.pos === 'NUM')) {
        t.pos = 'ADV';
        t.lemma = 'like';
        t.x = { ...t.x, disc: true, sem: 'degree' };
        return;
      }
      if (
        isSubjPron(prevA) ||
        (prev && (prev.norm === 'would' || prev.norm === 'do' || prev.norm === 'not'))
      )
        return void P('VERB');
      if (i === segStart) {
        t.pos = 'INTJ';
        t.x = { ...t.x, disc: true };
        return;
      }
      return void P('ADP');
    }
    if (/^(before|after|until|till|since|once|as|than)$/.test(w)) {
      // "before running", "after finishing my set": a gerund phrase, not a clause
      if (
        next &&
        next.cands.some((c) => c.pos === 'VERB' && c.x?.vf === 'ing') &&
        w !== 'as' &&
        w !== 'than'
      )
        return void P('ADP');
      if (clauseAhead(ts, i + 1)) return void P('SCONJ');
      if (!next || next.kind === 'p') return void (P('ADV') || P('ADP'));
      return void P('ADP');
    }
    if (w === 'there') {
      if (next && next.lemma === 'be') return void P('PRON');
      if (prev && prev.pos === 'AUX' && prev.lemma === 'be') return void P('PRON');
      return void P('ADV');
    }
    if (w === 'right' || w === 'correct') {
      if (ts[i - 1] && ts[i - 1].kind === 'p' && (!next || next.kind === 'p'))
        return void P('INTJ');
      if (next && /^(now|away|after|before|here|there)$/.test(next.norm)) return void P('ADV');
      return void P(['ADJ', 'ADV']);
    }
    if (w === 'no') {
      if (i === segStart || !next || next.kind === 'p') return void P('INTJ');
      return void P('DET');
    }
    if (/^(much|more|most|less|least|many|few|little|enough)$/.test(w)) {
      if (
        next &&
        next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'ADJ') &&
        !next.cands.some((c) => c.pos === 'ADP')
      )
        return void P('DET');
      return void P('ADV');
    }
    if (w === 'to') {
      if (
        next &&
        next.cands.some((c) => c.pos === 'VERB' && c.x?.vf === 'base') &&
        !next.cands.some((c) => c.pos === 'DET')
      )
        return void P('PART');
      return void P('ADP');
    }
    // Auxiliary vs main verb: have / do.
    if (t.cands.some((c) => c.pos === 'AUX') && t.cands.some((c) => c.pos === 'VERB')) {
      const lemma = t.cands[0].lemma;
      let k = i + 1;
      while (
        ts[k] &&
        (ux(ts[k]).neg || (ts[k].cands.some((c) => c.pos === 'ADV') && SUBJ_ADV.has(ts[k].norm)))
      )
        k++;
      const nn = ts[k];
      if (lemma === 'have') {
        const isPP = (u: T | undefined): boolean =>
          (!!u &&
            u.cands.some((c) => c.pos === 'VERB' && (c.x?.vf === 'pp' || c.x?.vf === 'pastpp'))) ||
          u?.norm === 'been';
        if (isPP(nn)) return void P('AUX');
        if (nn && isSubjPronCand(nn) && isPP(ts[k + 1])) return void P('AUX');
        // "Has my resting heart rate gone down…": aux + subject NP + participle
        const whB = ts.slice(segStart, i).some((u) => !!u.x.wh);
        if (
          (atStart(i) || whB) &&
          nn &&
          nn.cands.some((c) => c.pos === 'DET' || c.pos === 'NOUN')
        ) {
          for (let q = k + 1; q < Math.min(ts.length, k + 7); q++) {
            const u = ts[q];
            if (u.kind === 'p' || u.cands.some((c) => c.pos === 'AUX')) break;
            if (isPP(u) && !u.cands.some((c) => c.pos === 'NOUN')) return void P('AUX');
          }
        }
        return void P('VERB');
      }
      if (lemma === 'do') {
        if (nn && nn !== next) return void P('AUX'); // do not …
        if (next && ux(next).neg) return void P('AUX');
        const whBefore = ts.slice(segStart, i).some((u) => !!u.x.wh);
        if (
          next &&
          (isSubjPronCand(next) ||
            (next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'DET' || c.x?.vf === 'ing') &&
              (atStart(i) || whBefore)))
        ) {
          // do + subject + verb later → auxiliary.
          for (let q = i + 2; q < Math.min(ts.length, i + 7); q++) {
            const u = ts[q];
            if (u.kind === 'p') break;
            if (
              u.cands.some(
                (c) => c.pos === 'VERB' && (c.x?.vf === 'base' || c.x?.vf === undefined),
              ) ||
              u.norm === 'need' ||
              u.norm === 'think'
            )
              return void P('AUX');
          }
        }
        return void P('VERB');
      }
    }
    const hasV = posSet(t).has('VERB');
    const hasN = posSet(t).has('NOUN');
    const hasA = posSet(t).has('ADJ');
    const hasAdv = posSet(t).has('ADV');
    const vc = t.cands.find((c) => c.pos === 'VERB');
    const vf = vc?.x?.vf;
    if (hasV) {
      // 1. after "to" / modal / aux / negation → verb.
      if (prev && (prev.norm === 'to' || prev.x.modalTo || prev.x.aux === 'going'))
        return void P('VERB');
      if (
        prevA &&
        (prevA.pos === 'AUX' || prevA.x.neg) &&
        !(prevA.lemma === 'be' && vf === 'base') &&
        vf !== 's'
      ) {
        if (hasA && prevA.lemma === 'be') return void P('ADJ');
        if (!(invAux && prevA === invAux && !isSubjPron(prevA))) return void P('VERB');
      }
      if (prevA && prevA.lemma === 'let' && prevA.x.hort) return void P('VERB');
      if (
        prev &&
        (prev.x.hort ||
          (prev.pos === 'PRON' &&
            prev.x.pron?.c === 'acc' &&
            ts[i - 2] &&
            /^(let|help|make|made|lets|watch|see|saw)$/.test(ts[i - 2].norm)))
      )
        return void P('VERB');
      // 2. after a subject pronoun → verb.
      if (isSubjPron(prevA) && !(prevA && prevA.norm === 'it' && prev?.pos === 'VERB')) {
        if (hasA && vf !== 's' && vf !== 'past' && !(vf === 'pastpp' && !finite))
          return void P('ADJ');
        if (!invAux && pastTime && t.cands.some((c) => c.x?.vf === 'pastpp' || c.x?.vf === 'past'))
          return void P('VERB', (c) => c.x?.vf === 'pastpp' || c.x?.vf === 'past');
        return void P('VERB');
      }
      // Inversion: aux + subject NP + verb.
      if (
        invAux &&
        prev &&
        prev !== invAux &&
        (prev.pos === 'NOUN' ||
          prev.pos === 'PRON' ||
          (prev.pos === 'VERB' && prev.x.vf === 'ing')) &&
        invAux.lemma !== 'be'
      ) {
        // "Has my heart rate gone…": a compound noun when a participle / verb still follows
        if (
          hasN &&
          prev.pos === 'NOUN' &&
          next &&
          next.kind === 'w' &&
          next.cands.some(
            (c) =>
              c.pos === 'VERB' && (c.x?.vf === 'pp' || c.x?.vf === 'pastpp' || c.x?.vf === 'ing'),
          ) &&
          !next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'DET' || c.pos === 'PRON')
        )
          return void P('NOUN');
        return void P('VERB');
      }
      // inside a noun phrase opened by a determiner ("the 12 km bike ride"): a noun
      const npo = !invAux && npOpen(i);
      if (npo && hasN) return void P('NOUN');
      if (npo && vf === 'base' && nounSlotNext(next)) {
        t.pos = 'NOUN'; // zero derivation: "the bike ride I did"
        t.lemma = vc ? vc.lemma : w;
        t.feats = { number: 'sg' };
        t.x = { ...t.mx };
        return;
      }
      // "a 5k run": number (+ unit) inside a noun phrase opened by an article
      if (
        prev &&
        (prev.pos === 'NUM' || prev.x.unit || (prev.norm === 'k' && ts[i - 2]?.kind === 'n')) &&
        ts.slice(Math.max(0, i - 4), i).some((u) => u.pos === 'DET')
      ) {
        if (hasN) return void P('NOUN');
      }
      // 3. after determiners / adjectives / prepositions → noun.
      if (
        prev &&
        (prev.pos === 'DET' ||
          prev.pos === 'ADJ' ||
          prev.pos === 'NUM' ||
          prev.pos === 'ADP' ||
          prev.norm === "'s")
      ) {
        if (hasA && next && next.cands.some((c) => c.pos === 'NOUN')) return void P('ADJ');
        if (hasN) return void P('NOUN');
        if (hasA) return void P('ADJ');
        // "my resting heart rate": an -ing form between a determiner and a noun is attributive
        if (vf === 'ing' && next && next.cands.some((c) => c.pos === 'NOUN') && next.kind === 'w') {
          t.pos = 'ADJ';
          t.lemma = w;
          t.feats = {};
          t.x = { ...t.mx };
          return;
        }
        if (vf === 'ing') return void P('VERB');
        if (prev.pos === 'DET' && vc) {
          t.pos = 'NOUN';
          t.lemma = vc.lemma;
          t.feats = { number: 'sg' };
          t.x = { ...t.mx };
          return;
        }
      }
      // 4. imperative position.
      if (atStart(i) && (vf === 'base' || vf === undefined)) {
        const nx = next;
        if (
          !nx ||
          nx.kind === 'p' ||
          nx.cands.some(
            (c) =>
              c.pos === 'DET' ||
              c.pos === 'NUM' ||
              c.pos === 'ADP' ||
              (c.pos === 'PRON' && c.x?.pron?.c === 'acc'),
          ) ||
          nx.norm === 'it' ||
          nx.x.time
        ) {
          if (!nx || !nx.cands.some((c) => c.pos === 'AUX')) return void P('VERB');
        }
        if (nx && nx.cands.some((c) => c.pos === 'AUX' || (c.pos === 'VERB' && c.x?.vf === 's')))
          return void P('NOUN');
        if (nx && nx.cands.some((c) => c.pos === 'NOUN') && !hasN) return void P('VERB');
        if (nx && nx.cands[0]?.pos === 'NOUN' && !nx.cands.some((c) => c.pos === 'VERB'))
          return void P('VERB');
      }
      // object of a gerund: "I pulled a muscle doing lunges"
      if (
        hasN &&
        prev &&
        prev.pos === 'VERB' &&
        prev.x.vf === 'ing' &&
        prev.i !== segStart &&
        !isSubjPron(prevW(prev.i))
      )
        return void P('NOUN');
      // object compound "do pistol squats", "doing squats with…": a noun after a verb's bare-noun object
      if (
        hasN &&
        prev &&
        ((prev.pos === 'NOUN' && prevW(prev.i)?.pos === 'VERB' && prevW(prev.i)?.lemma !== 'be') ||
          (prev.pos === 'VERB' && prev.x.vf === 'ing' && prev.i === segStart && laterFinite(i)))
      )
        return void P('NOUN');
      // 5. after a noun: agreement decides verb vs compound noun.
      if (
        prev &&
        (prev.pos === 'NOUN' ||
          (prev.pos === 'VERB' && prev.x.vf === 'ing' && prev.i === segStart)) &&
        !finite
      ) {
        if (
          prev.feats.number !== 'pl' &&
          t.cands.some((c) => c.pos === 'VERB' && c.x?.vf !== 'base' && c.x?.vf !== 'ing')
        )
          return void P('VERB', (c) => c.x?.vf !== 'base' && c.x?.vf !== 'ing');
        if (vf === 's' || vf === 'past' || vf === 'pastpp') return void P('VERB');
        if (vf === 'base' && prev.feats.number === 'pl') return void P('VERB');
        if (hasN) return void P('NOUN');
      }
      if (finite && prev && (prev.pos === 'VERB' || prev.pos === 'AUX') && hasN && vf !== 'ing')
        return void P('NOUN');
      if (hasA && prev && prev.pos === 'AUX' && prev.lemma === 'be') return void P('ADJ');
      if (hasA && prev && COP_LIKE.has(prev.lemma)) return void P('ADJ');
      if (vf === 'ing') return void P('VERB');
      if ((vf === 'past' || vf === 'pastpp' || vf === 's') && !finite) return void P('VERB');
      if (hasN) return void P('NOUN');
      if (hasA) return void P('ADJ');
      return void P('VERB');
    }
    if (hasA && hasAdv) {
      if (prev && (prev.pos === 'VERB' || (prev.pos === 'NOUN' && finite))) return void P('ADV');
      if (next && next.cands.some((c) => c.pos === 'NOUN') && !next.x.time) return void P('ADJ');
      if (prevA && (prevA.lemma === 'be' || COP_LIKE.has(prevA.lemma))) return void P('ADJ');
      if (prev && prev.x.neg && prevW(i - 1, true)?.lemma === 'be') return void P('ADJ');
      return void P('ADV');
    }
    if (hasA && hasN) {
      if (next && next.cands.some((c) => c.pos === 'NOUN') && next.kind === 'w')
        return void P('ADJ');
      if (prev && (prev.lemma === 'be' || COP_LIKE.has(prev.lemma))) return void P('ADJ');
      return void P('NOUN');
    }
    if (hasN && posSet(t).has('INTJ')) {
      if (i === segStart && (!next || next.kind === 'p')) return void P('INTJ');
      return void P('NOUN');
    }
    choose(t, t.cands[0]);
  }
}

function posSet(t: T): Set<Pos> {
  return new Set(t.cands.map((c) => c.pos));
}

/** Final verb-form pass: finite / infinitive / imperative / participle for English verbs. */
export function enForms(ts: T[]): void {
  const isBoundary = (t: T): boolean =>
    (t.kind === 'p' && /[,;:()–—-]/.test(t.text)) || t.pos === 'CONJ' || t.pos === 'SCONJ';
  // "could I have avoided", "I'll be doing", "should have been": have / be after a modal are non-finite
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (!((t.pos === 'AUX' || t.pos === 'VERB') && (t.lemma === 'have' || t.lemma === 'be')))
      continue;
    if (t.norm !== 'have' && t.norm !== 'be') continue;
    for (let k = i - 1; k >= 0; k--) {
      const p = ts[k];
      if (isBoundary(p)) break;
      if (p.x.neg || p.pos === 'ADV' || p.x.cont) continue;
      if (p.pos === 'PRON' || p.pos === 'NOUN' || p.pos === 'DET' || p.pos === 'ADJ') continue;
      if (
        p.pos === 'AUX' &&
        (!!p.x.modal || p.x.aux === 'will' || p.x.aux === 'would' || p.lemma === 'do')
      ) {
        t.feats = { ...t.feats, form: 'inf' };
        delete t.feats.tense;
      }
      break;
    }
  }
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.pos !== 'VERB') continue;
    const vf = t.x.vf;
    if (vf === 'ing') {
      t.feats.form = 'ger';
      continue;
    }
    if (vf === 's' || vf === 'past') {
      t.feats.form = 'fin';
      continue;
    }
    // scan left inside the segment
    let sawNP = false;
    let res: 'inf' | 'part' | 'fin' | 'imp' | undefined;
    let k = i - 1;
    for (; k >= 0; k--) {
      const p = ts[k];
      if (isBoundary(p)) break;
      if (p.x.cont && !p.x.modalTo && !p.x.aux) continue;
      if (p.x.neg || (p.pos === 'ADV' && (SUBJ_ADV.has(p.norm) || p.x.sem === 'degree'))) continue;
      if (p.norm === 'to' || p.x.modalTo || p.x.aux === 'going' || p.x.hort) {
        res = 'inf';
        break;
      }
      if (p.pos === 'AUX') {
        res =
          vf === 'pp' || vf === 'pastpp'
            ? p.lemma === 'have' || p.lemma === 'be'
              ? 'part'
              : sawNP
                ? 'part'
                : 'part'
            : 'inf';
        if ((vf === 'pastpp' || vf === 'pp') && p.lemma !== 'have' && p.lemma !== 'be')
          res = sawNP ? 'fin' : 'part';
        break;
      }
      if (
        (vf === 'pp' || vf === 'pastpp') &&
        (p.lemma === 'get' || COP_LIKE.has(p.lemma)) &&
        p.pos === 'VERB'
      ) {
        res = 'part';
        break;
      }
      if (p.pos === 'PRON' && p.x.pron?.c === 'acc' && !sawNP) {
        res = vf === 'pastpp' ? 'fin' : 'inf';
        break;
      }
      if (
        p.pos === 'VERB' &&
        p.x.vf === 'ing' &&
        (p.lemma === 'have' || p.lemma === 'be') &&
        !sawNP
      ) {
        res = 'part'; // "having slept", "being hogged"
        break;
      }
      if (p.pos === 'ADP' && sawNP) continue; // "my run from this morning saved"
      if (
        sawNP &&
        p.pos === 'VERB' &&
        /^(make|let|help|watch|see|hear|feel)$/.test(p.lemma) &&
        vf === 'base'
      ) {
        res = 'inf'; // "makes my calves burn"
        break;
      }
      if (
        ['PRON', 'NOUN', 'DET', 'ADJ', 'NUM'].includes(p.pos) ||
        p.norm === "'s" ||
        (p.pos === 'VERB' && p.x.vf === 'ing')
      ) {
        if (p.x.voc || p.x.disc) continue;
        sawNP = true;
        continue;
      }
      if (p.x.disc || p.x.please || p.pos === 'INTJ' || p.x.time) continue;
      break;
    }
    if (!res) {
      if (sawNP) res = 'fin';
      else if (vf === 'pp') res = 'part';
      else if (vf === 'pastpp') res = 'fin';
      else {
        // "…and want to cut": verb-phrase coordination shares the earlier finite verb
        const b = ts[k];
        const earlierFin = ts
          .slice(0, Math.max(0, k))
          .some((u) => (u.pos === 'VERB' || u.pos === 'AUX') && u.feats.form === 'fin');
        res = b && b.pos === 'CONJ' && earlierFin ? 'fin' : 'imp';
      }
    }
    t.feats.form = res;
    if (res === 'fin' && !t.feats.tense) t.feats.tense = vf === 'pastpp' ? 'past' : 'present';
    if (res === 'fin' && vf === 'pastpp') t.feats.tense = 'past';
    if (res === 'part') t.feats.tense = 'past';
    if (res === 'inf' || res === 'imp') delete t.feats.tense;
  }
}

const enMemo = memo(analyze);

export const EN: LangSpec = {
  lang: 'en',
  prodrop: false,
  expand,
  analyze: (w) => enMemo(w),
  mwe: MWES,
  disambig: (ts) => {
    disambig(ts);
    enForms(ts);
  },
  nomCapable: (t) =>
    t.pos === 'NOUN' ||
    (t.pos === 'PRON' && t.x.pron?.c !== 'acc') ||
    (t.pos === 'VERB' && t.x.vf === 'ing'),
};

export const enLex = (): { cogn: Set<string>; adj: Set<string>; disc: Set<string> } => {
  const l = lex();
  return { cogn: l.cogn, adj: l.adj, disc: l.disc };
};
