/**
 * Ukrainian and Russian (and surzhyk): closed classes, suffix-based verb
 * morphology (present / past / infinitive / imperative / synthetic future,
 * -ся reflexives, consonant alternations, perfective present = future),
 * noun and adjective declension by reverse suffix matching, contextual POS rules.
 */
import {
  cand,
  choose,
  memo,
  mw,
  pick,
  words,
  wset,
  type Cand,
  type LangSpec,
  type MWE,
  type T,
  type X,
} from '../core';
import { numWord, TIMES_ADV } from '../lex/measure';
import { RU_ADJ, RU_ADV, RU_COGN, RU_IRR, RU_NOUNS, RU_VERBS } from '../lex/ru';
import {
  UK_ADJ,
  UK_ADV,
  UK_COGN,
  UK_IRR,
  UK_NOUNS,
  UK_PAST_CORE,
  UK_SHORT,
  UK_VERBS,
} from '../lex/uk';
import type { Case, Feats, Lang, Modality, Pos, WhWord } from '../types';

type SL = 'uk' | 'ru';

interface Lex {
  verbs: Set<string>;
  pf: Set<string>;
  irr: Map<string, [string, Feats]>;
  nouns: Set<string>;
  adj: Set<string>;
  adv: Set<string>;
  cogn: Set<string>;
  closed: Map<string, Cand[]>;
}

const lexes: Partial<Record<SL, Lex>> = {};

const FK: Record<string, Feats> = {
  pres1: { tense: 'present', person: 1, number: 'sg', form: 'fin' },
  pres2: { tense: 'present', person: 2, number: 'sg', form: 'fin' },
  pres3: { tense: 'present', person: 3, number: 'sg', form: 'fin' },
  pres1pl: { tense: 'present', person: 1, number: 'pl', form: 'fin' },
  pres2pl: { tense: 'present', person: 2, number: 'pl', form: 'fin' },
  pres3pl: { tense: 'present', person: 3, number: 'pl', form: 'fin' },
  pastm: { tense: 'past', gender: 'm', number: 'sg', form: 'fin' },
  pastf: { tense: 'past', gender: 'f', number: 'sg', form: 'fin' },
  pastn: { tense: 'past', gender: 'n', number: 'sg', form: 'fin' },
  pastpl: { tense: 'past', number: 'pl', form: 'fin' },
  fut1: { tense: 'future', person: 1, number: 'sg', form: 'fin' },
  fut2: { tense: 'future', person: 2, number: 'sg', form: 'fin' },
  fut3: { tense: 'future', person: 3, number: 'sg', form: 'fin' },
  fut1pl: { tense: 'future', person: 1, number: 'pl', form: 'fin' },
  fut2pl: { tense: 'future', person: 2, number: 'pl', form: 'fin' },
  fut3pl: { tense: 'future', person: 3, number: 'pl', form: 'fin' },
  imp2: { form: 'imp', person: 2, number: 'sg' },
  imp2pl: { form: 'imp', person: 2, number: 'pl' },
  imp1pl: { form: 'imp', person: 1, number: 'pl' },
  inf: { form: 'inf' },
};

function buildVerbs(src: string): { verbs: Set<string>; pf: Set<string> } {
  const verbs = new Set<string>();
  const pf = new Set<string>();
  for (const w of words(src)) {
    const pfv = w.endsWith('!');
    const v = pfv ? w.slice(0, -1) : w;
    verbs.add(v);
    if (pfv) pf.add(v);
  }
  return { verbs, pf };
}

function buildIrr(src: string): Map<string, [string, Feats]> {
  const m = new Map<string, [string, Feats]>();
  for (const x of words(src)) {
    const [f, l, k] = x.split(':');
    if (!m.has(f)) m.set(f, [l, FK[k]]);
  }
  return m;
}

// ───────────── closed classes ─────────────

function closedUk(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) {
      const c = f(w);
      m.set(w, [...(m.get(w) ?? []), ...(Array.isArray(c) ? c : [c])]);
    }
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c: Case, g?: 'm' | 'f' | 'n'): Cand =>
    cand(
      'PRON',
      lemma,
      { person: p, number: n, case: c, ...(g ? { gender: g } : {}) },
      { pron: { p, n, c } },
    );
  add('я', () => P('я', 1, 'sg', 'nom'));
  add('мене', () => P('я', 1, 'sg', 'gen'));
  add('мені', () => P('я', 1, 'sg', 'dat'));
  add('мною', () => P('я', 1, 'sg', 'ins'));
  add('ти', () => P('ти', 2, 'sg', 'nom'));
  add('тебе', () => P('ти', 2, 'sg', 'gen'));
  add('тобі', () => P('ти', 2, 'sg', 'dat'));
  add('тобою', () => P('ти', 2, 'sg', 'ins'));
  add('він', () => P('він', 3, 'sg', 'nom', 'm'));
  add('вона', () => P('вона', 3, 'sg', 'nom', 'f'));
  add('воно', () => P('воно', 3, 'sg', 'nom', 'n'));
  add('його нього', () => [P('він', 3, 'sg', 'acc'), cand('DET', 'його', { case: 'gen' })]);
  add('йому ньому', () => P('він', 3, 'sg', 'dat'));
  add('ним', () => P('він', 3, 'sg', 'ins'));
  add('її', () => [P('вона', 3, 'sg', 'acc'), cand('DET', 'її', { case: 'gen' })]);
  add('неї', () => P('вона', 3, 'sg', 'gen'));
  add('їй', () => P('вона', 3, 'sg', 'dat'));
  add('нею ній', () => P('вона', 3, 'sg', 'ins'));
  add('ми', () => P('ми', 1, 'pl', 'nom'));
  add('нас', () => P('ми', 1, 'pl', 'gen'));
  add('нам', () => P('ми', 1, 'pl', 'dat'));
  add('нами', () => P('ми', 1, 'pl', 'ins'));
  add('ви', () => P('ви', 2, 'pl', 'nom'));
  add('вас', () => P('ви', 2, 'pl', 'gen'));
  add('вам', () => P('ви', 2, 'pl', 'dat'));
  add('вами', () => P('ви', 2, 'pl', 'ins'));
  add('вони', () => P('вони', 3, 'pl', 'nom'));
  add('їх них', () => [P('вони', 3, 'pl', 'acc'), cand('DET', 'їх', { case: 'gen' })]);
  add('їм', () => P('вони', 3, 'pl', 'dat'));
  add('ними', () => P('вони', 3, 'pl', 'ins'));
  add('себе собі собою', (w) => cand('PRON', 'себе', { case: w === 'собі' ? 'dat' : 'acc' }));
  const D =
    (lemma: string, p?: 1 | 2): ((w: string) => Cand) =>
    (w) =>
      cand('DET', lemma, adjFeatsByEnding(w), p ? { pron: { p, n: 'sg', c: 'gen' } } : undefined);
  add('мій моя моє мої мого моєї моєму моїй моїм моїх моїми мою', D('мій', 1));
  add('твій твоя твоє твої твого твоєї твоєму твоїй твоїм твоїх твоїми твою', D('твій', 2));
  add('наш наша наше наші нашого нашої нашому нашій нашим наших нашими нашу', D('наш', 1));
  add('ваш ваша ваше ваші вашого вашої вашому вашій вашим ваших вашими вашу', D('ваш', 2));
  add('свій своя своє свої свого своєї своєму своїй своїм своїх своїми свою', D('свій'));
  add('їхній їхня їхнє їхні', D('їхній'));
  add('цей ця ці цього цієї цьому цій цим цих цю', D('цей'));
  add('це', () => [
    cand('PRON', 'це', { case: 'nom', person: 3, number: 'sg', gender: 'n' }),
    cand('DET', 'цей', { gender: 'n', case: 'nom' }),
  ]);
  add('той та те ті того тієї тій тих ту', D('той'));
  add('тим', () => cand('DET', 'той', { case: 'ins' }));
  add('то', () => [cand('PART', 'то', {}, { corr: true }), cand('PRON', 'те', { case: 'nom' })]);
  add('хто', () => cand('PRON', 'хто', { case: 'nom', person: 3 }, { wh: 'who', sub: 'relative' }));
  add('кого', () => cand('PRON', 'хто', { case: 'acc' }, { wh: 'who', sub: 'relative' }));
  add('кому', () => cand('PRON', 'хто', { case: 'dat' }, { wh: 'who', sub: 'relative' }));
  add('ким', () => cand('PRON', 'хто', { case: 'ins' }, { wh: 'who' }));
  add('що шо', () => [
    cand('PRON', 'що', { case: 'nom', person: 3 }, { wh: 'what', sub: 'amb' }),
    cand('SCONJ', 'що', {}, { sub: 'amb' }),
  ]);
  add('чого', () => [
    cand('ADV', 'чого', {}, { wh: 'why' }),
    cand('PRON', 'що', { case: 'gen' }, { wh: 'what' }),
  ]);
  add('чим', () => cand('PRON', 'що', { case: 'ins' }, { wh: 'what' }));
  add('чому', () => cand('ADV', 'чому', {}, { wh: 'why' }));
  add('навіщо нащо нафіга', () => cand('ADV', 'навіщо', {}, { wh: 'why' }));
  add('який яка яке які якого якої якому якій яким яких якими яку', (w) =>
    cand('DET', 'який', adjFeatsByEnding(w), { wh: 'which', sub: 'relative' }),
  );
  add('котрий котра котре котрі котрого котрої котру', (w) =>
    cand('DET', 'котрий', adjFeatsByEnding(w), { wh: 'which', sub: 'relative' }),
  );
  add('чий чия чиє чиї', () => cand('DET', 'чий', {}, { wh: 'who' }));
  add('скільки скіки', () => cand('ADV', 'скільки', {}, { wh: 'how_much' }));
  add('де', () => cand('ADV', 'де', {}, { wh: 'where', sub: 'relative' }));
  add('куди звідки', (w) => cand('ADV', w, {}, { wh: 'where', sub: 'relative' }));
  add('коли', () => cand('ADV', 'коли', {}, { wh: 'when', sub: 'temporal' }));
  add('як', () => [
    cand('ADV', 'як', {}, { wh: 'how' }),
    cand('ADP', 'як'),
    cand('SCONJ', 'як', {}, { sub: 'conditional' }),
  ]);
  add('ніхто нікого нікому', () =>
    cand('PRON', 'ніхто', { case: 'nom', person: 3 }, { negq: true }),
  );
  add('нічого ніщо нічим', () =>
    cand('PRON', 'ніщо', { case: 'nom', person: 3, number: 'sg' }, { negq: true }),
  );
  add('ніколи ніде нікуди ніяк', (w) =>
    cand('ADV', w, {}, { negq: true, sem: w === 'ніколи' ? 'frequency' : undefined }),
  );
  add('жоден жодна жодне жодного жодної жодних жодному ніякий ніякої ніякого', (w) =>
    cand('DET', 'жоден', adjFeatsByEnding(w), { negq: true }),
  );
  add('хтось когось комусь', () => cand('PRON', 'хтось', { case: 'nom', person: 3 }));
  add('щось чогось', () => cand('PRON', 'щось', { case: 'nom', person: 3 }));
  add('повинен повинна повинно повинні', (w) =>
    cand(
      'AUX',
      'повинен',
      { tense: 'present', form: 'fin', number: w === 'повинні' ? 'pl' : 'sg' },
      { modal: 'must' },
    ),
  );
  add('все усе', () => [
    cand('PRON', 'все', { case: 'nom', number: 'sg', person: 3, gender: 'n' }),
    cand('ADV', 'все'),
  ]);
  add('всі усі', () => cand('PRON', 'всі', { case: 'nom', number: 'pl', person: 3 }));
  add('весь вся всього всієї всім всіх усього усіх', (w) =>
    cand('DET', 'весь', adjFeatsByEnding(w)),
  );
  add('кожен кожна кожне кожного кожної кожному кожній кожен', (w) =>
    cand('DET', 'кожен', adjFeatsByEnding(w)),
  );
  add('інший інша інше інші іншого іншої', (w) => cand('DET', 'інший', adjFeatsByEnding(w)));
  add('такий така таке такі такого такої', (w) => cand('DET', 'такий', adjFeatsByEnding(w)));
  add('сам сама саме самі', (w) => cand('DET', 'сам', adjFeatsByEnding(w)));
  add('не', () => cand('PART', 'не', {}, { neg: true }));
  add('ні', () => [cand('PART', 'ні', {}, { neg: true }), cand('INTJ', 'ні')]);
  add('ж же', () => cand('PART', 'же'));
  add('б би', () => cand('PART', 'би'));
  add('чи', () => [cand('PART', 'чи', {}, { qp: true }), cand('CONJ', 'чи', {}, { coord: 'or' })]);
  add('хіба невже', (w) => cand('PART', w, {}, { qp: true }));
  add('лише лиш тільки лишень навіть аж ось от якраз', (w) => cand('PART', w));
  add('вже уже ще', (w) => cand('ADV', w, {}, { sem: 'time' }));
  add('так', () => [
    cand('ADV', 'так', {}, { sem: 'degree' }),
    cand('INTJ', 'так', {}, { tag: true }),
  ]);
  add(
    'ну ага угу ой ах ех ого бро лол хах хаха ок окей ладно добро слухай короче типу блін капець',
    (w) => cand('INTJ', w, {}, { disc: true }),
  );
  add('ура вау клас', (w) => cand('INTJ', w, {}, { disc: true, excl: true }));
  add('привіт дякую спасибі дяк', (w) => cand('INTJ', w, {}, { disc: true }));
  add('атлас атласе', () => cand('NOUN', 'атлас', {}, { voc: true, disc: true }));
  add('плз пліз будьласка', () => cand('INTJ', 'будь ласка', {}, { please: true, disc: true }));
  add('хай нехай', () => cand('PART', 'хай', {}, { hort: true }));
  add('давай давайте', () => cand('VERB', 'давати', { form: 'imp', person: 2 }, { hort: true }));
  add('мабуть напевно', (w) => cand('ADV', w));
  add('і й та', (w) => cand('CONJ', 'і', {}, { coord: 'and', ...(w === 'та' ? {} : {}) }));
  add('а', () => [cand('CONJ', 'а', {}, { coord: 'but' }), cand('INTJ', 'а', {}, { disc: true })]);
  add('але проте однак зате но', () => cand('CONJ', 'але', {}, { coord: 'but' }));
  add('або', () => cand('CONJ', 'або', {}, { coord: 'or' }));
  add('тож отже', () => cand('CONJ', 'тож', {}, { coord: 'so' }));
  add('тому', () => [
    cand('CONJ', 'тому', {}, { coord: 'so' }),
    cand('ADV', 'тому', {}, { sem: 'time' }),
    cand('DET', 'той', { case: 'dat' }),
  ]);
  add('тоді', () => [cand('ADV', 'тоді', {}, { sem: 'time', corr: true })]);
  add('щоб щоби аби', () => cand('SCONJ', 'щоб', {}, { sub: 'purpose' }));
  add('якщо якшо якщо', () => cand('SCONJ', 'якщо', {}, { sub: 'conditional' }));
  add('якби', () => cand('SCONJ', 'якби', {}, { sub: 'conditional' }));
  add('бо', () => cand('SCONJ', 'бо', {}, { sub: 'causal' }));
  add('оскільки', () => cand('SCONJ', 'оскільки', {}, { sub: 'causal' }));
  add('хоча хоч', () => cand('SCONJ', 'хоча', {}, { sub: 'concessive' }));
  add('ніби наче мов немов неначе', (w) => cand('SCONJ', w, {}, { sub: 'comparison' }));
  add('ніж', () => cand('SCONJ', 'ніж', {}, { sub: 'comparison' }));
  add('поки доки', (w) => cand('SCONJ', w, {}, { sub: 'temporal' }));
  add('відколи', () => cand('SCONJ', 'відколи', {}, { sub: 'temporal' }));
  add('раз', () => [
    cand('NOUN', 'раз', { number: 'sg' }, { unit: 'time' }),
    cand('SCONJ', 'раз', {}, { sub: 'causal' }),
  ]);
  add(
    'в у на з із зі зо до від од для без під над за перед після через про по при між біля коло крізь серед замість щодо окрім крім поза проти навколо близько протягом впродовж завдяки попри понад поміж о об к',
    (w) => cand('ADP', w),
  );
  // predicatives
  add('можна', () => cand('ADV', 'можна', { form: 'pred' }, { predic: 'can' }));
  add('нема немає нема', () =>
    cand('ADV', 'немає', { form: 'pred' }, { predic: 'eval', neg: true }),
  );
  add('треба потрібно необхідно тре нада надо', (w) =>
    cand(
      'ADV',
      w === 'надо' || w === 'нада' ? 'надо' : w === 'тре' ? 'треба' : w,
      { form: 'pred' },
      { predic: 'need' },
    ),
  );
  add('варто слід', (w) => cand('ADV', w, { form: 'pred' }, { predic: 'should' }));
  add(
    'нормально норм добре погано важко легко боляче холодно спекотно жарко достатньо досить забагато шкода страшно лінь супер класно круто окей ок краще ліпше гірше найкраще цікаво дивно зле важливо корисно шкідливо безпечно пізно рано',
    (w) => cand('ADV', w, { form: 'pred' }, { predic: 'eval' }),
  );
  return m;
}

function closedRu(): Map<string, Cand[]> {
  const m = new Map<string, Cand[]>();
  const add = (ws: string, f: (w: string) => Cand | Cand[]): void => {
    for (const w of words(ws)) {
      const c = f(w);
      m.set(w, [...(m.get(w) ?? []), ...(Array.isArray(c) ? c : [c])]);
    }
  };
  const P = (lemma: string, p: 1 | 2 | 3, n: 'sg' | 'pl', c: Case): Cand =>
    cand('PRON', lemma, { person: p, number: n, case: c }, { pron: { p, n, c } });
  add('я', () => P('я', 1, 'sg', 'nom'));
  add('меня', () => P('я', 1, 'sg', 'gen'));
  add('мне', () => P('я', 1, 'sg', 'dat'));
  add('мной', () => P('я', 1, 'sg', 'ins'));
  add('ты', () => P('ты', 2, 'sg', 'nom'));
  add('тебя', () => P('ты', 2, 'sg', 'gen'));
  add('тебе', () => P('ты', 2, 'sg', 'dat'));
  add('он', () => P('он', 3, 'sg', 'nom'));
  add('она', () => P('она', 3, 'sg', 'nom'));
  add('оно', () => P('оно', 3, 'sg', 'nom'));
  add('мы', () => P('мы', 1, 'pl', 'nom'));
  add('нас', () => P('мы', 1, 'pl', 'gen'));
  add('нам', () => P('мы', 1, 'pl', 'dat'));
  add('вы', () => P('вы', 2, 'pl', 'nom'));
  add('вас', () => P('вы', 2, 'pl', 'gen'));
  add('вам', () => P('вы', 2, 'pl', 'dat'));
  add('они', () => P('они', 3, 'pl', 'nom'));
  add('его ее её их', (w) => [P('он', 3, 'sg', 'acc'), cand('DET', w, { case: 'gen' })]);
  add('ему ей им', () => P('он', 3, 'sg', 'dat'));
  const D =
    (lemma: string, p?: 1 | 2): ((w: string) => Cand) =>
    (w) =>
      cand('DET', lemma, adjFeatsRu(w), p ? { pron: { p, n: 'sg', c: 'gen' } } : undefined);
  add('мой моя мое мои моего моей моему моим моих мою', D('мой', 1));
  add('твой твоя твое твои твоего твоей твоему твоим твоих твою', D('твой', 2));
  add('наш наша наше наши нашего нашей нашим наших нашу', D('наш', 1));
  add('этот эта эти этого этой этому этим этих эту', D('этот'));
  add('это', () => [
    cand('PRON', 'это', { case: 'nom', person: 3, number: 'sg', gender: 'n' }),
    cand('DET', 'этот', { case: 'nom' }),
  ]);
  add('тот та те того той тем тех ту', D('тот'));
  add('кто', () => cand('PRON', 'кто', { case: 'nom', person: 3 }, { wh: 'who', sub: 'relative' }));
  add('кому кого', () => cand('PRON', 'кто', { case: 'dat' }, { wh: 'who' }));
  add('что', () => [
    cand('PRON', 'что', { case: 'nom', person: 3 }, { wh: 'what', sub: 'amb' }),
    cand('SCONJ', 'что', {}, { sub: 'amb' }),
  ]);
  add('чего', () => [
    cand('ADV', 'чего', {}, { wh: 'why' }),
    cand('PRON', 'что', { case: 'gen' }, { wh: 'what' }),
  ]);
  add('почему зачем отчего', () => cand('ADV', 'почему', {}, { wh: 'why' }));
  add('какой какая какое какие какого какой какую каким каких', (w) =>
    cand('DET', 'какой', adjFeatsRu(w), { wh: 'which', sub: 'relative' }),
  );
  add('который которая которое которые которого которой которую', (w) =>
    cand('DET', 'который', adjFeatsRu(w), { wh: 'which', sub: 'relative' }),
  );
  add('сколько', () => cand('ADV', 'сколько', {}, { wh: 'how_much' }));
  add('где куда откуда', (w) => cand('ADV', w, {}, { wh: 'where', sub: 'relative' }));
  add('когда', () => cand('ADV', 'когда', {}, { wh: 'when', sub: 'temporal' }));
  add('как', () => [cand('ADV', 'как', {}, { wh: 'how' }), cand('ADP', 'как')]);
  add('никто', () => cand('PRON', 'никто', { case: 'nom', person: 3 }, { negq: true }));
  add('ничего', () => cand('PRON', 'ничто', { case: 'nom', person: 3 }, { negq: true }));
  add('никогда нигде никуда', (w) => cand('ADV', w, {}, { negq: true }));
  add('все всё', () => [cand('PRON', 'все', { case: 'nom', person: 3 }), cand('ADV', 'все')]);
  add('должен должна должно должны', (w) =>
    cand(
      'AUX',
      'должен',
      { tense: 'present', form: 'fin', number: w === 'должны' ? 'pl' : 'sg' },
      { modal: 'must' },
    ),
  );
  add('не', () => cand('PART', 'не', {}, { neg: true }));
  add('нет', () => [cand('PART', 'нет', {}, { neg: true }), cand('INTJ', 'нет')]);
  add('ли', () => cand('PART', 'ли', {}, { qp: true }));
  add('разве неужели', (w) => cand('PART', w, {}, { qp: true }));
  add('же ж', () => cand('PART', 'же'));
  add('бы б', () => cand('PART', 'бы'));
  add('да', () => [
    cand('INTJ', 'да', {}, { tag: true }),
    cand('CONJ', 'да', {}, { coord: 'and' }),
  ]);
  add('ну ок окей короче типа блин капец лол ладно', (w) => cand('INTJ', w, {}, { disc: true }));
  add('ура вау', (w) => cand('INTJ', w, {}, { disc: true, excl: true }));
  add('привет спасибо', (w) => cand('INTJ', w, {}, { disc: true }));
  add('пожалуйста плиз', () => cand('INTJ', 'пожалуйста', {}, { please: true, disc: true }));
  add('давай давайте', () => cand('VERB', 'давать', { form: 'imp', person: 2 }, { hort: true }));
  add('и', () => cand('CONJ', 'и', {}, { coord: 'and' }));
  add('а', () => [cand('CONJ', 'а', {}, { coord: 'but' }), cand('INTJ', 'а', {}, { disc: true })]);
  add('но однако зато', () => cand('CONJ', 'но', {}, { coord: 'but' }));
  add('или либо', () => cand('CONJ', 'или', {}, { coord: 'or' }));
  add('поэтому потому итак значит', () => cand('CONJ', 'поэтому', {}, { coord: 'so' }));
  add('чтобы чтоб', () => cand('SCONJ', 'чтобы', {}, { sub: 'purpose' }));
  add('если', () => cand('SCONJ', 'если', {}, { sub: 'conditional' }));
  add('хотя', () => cand('SCONJ', 'хотя', {}, { sub: 'concessive' }));
  add('пока', () => cand('SCONJ', 'пока', {}, { sub: 'temporal' }));
  add('чем', () => cand('SCONJ', 'чем', {}, { sub: 'comparison' }));
  add('будто словно', (w) => cand('SCONJ', w, {}, { sub: 'comparison' }));
  add('то', () => [cand('PART', 'то', {}, { corr: true }), cand('PRON', 'то', { case: 'nom' })]);
  add(
    'в во на с со к ко до от из для без под над за перед после через про по при между около у о об вместо кроме против',
    (w) => cand('ADP', w),
  );
  add('можно', () => cand('ADV', 'можно', { form: 'pred' }, { predic: 'can' }));
  add('нельзя', () => cand('ADV', 'нельзя', { form: 'pred' }, { predic: 'can', neg: true }));
  add('нету', () => cand('ADV', 'нет', { form: 'pred' }, { predic: 'eval', neg: true }));
  add('надо нужно необходимо нада', (w) =>
    cand('ADV', w === 'нада' ? 'надо' : w, { form: 'pred' }, { predic: 'need' }),
  );
  add('стоит следует', (w) => cand('ADV', w, { form: 'pred' }, { predic: 'should' }));
  add(
    'нормально норм хорошо плохо тяжело легко больно лучше хуже достаточно страшно жарко холодно',
    (w) => cand('ADV', w, { form: 'pred' }, { predic: 'eval' }),
  );
  return m;
}

function lex(l: SL): Lex {
  const ex = lexes[l];
  if (ex) return ex;
  const v = buildVerbs(l === 'uk' ? UK_VERBS : RU_VERBS);
  const out: Lex = {
    ...v,
    irr: buildIrr(l === 'uk' ? UK_IRR : RU_IRR),
    nouns: wset(l === 'uk' ? UK_NOUNS : RU_NOUNS),
    adj: wset(l === 'uk' ? UK_ADJ : RU_ADJ),
    adv: wset(l === 'uk' ? UK_ADV : RU_ADV),
    cogn: wset(l === 'uk' ? UK_COGN : RU_COGN),
    closed: l === 'uk' ? closedUk() : closedRu(),
  };
  lexes[l] = out;
  return out;
}

// ───────────── adjectives ─────────────

function adjFeatsByEnding(w: string): Feats {
  if (/^(мою|твою|свою|нашу|вашу|цю|ту|яку|кожну|всю|таку)$/.test(w))
    return { case: 'acc', number: 'sg', gender: 'f' };
  if (/(ого|ього)$/.test(w)) return { case: 'gen', number: 'sg' };
  if (/(ому|ьому)$/.test(w)) return { case: 'dat', number: 'sg' };
  if (/(ими|іми)$/.test(w)) return { case: 'ins', number: 'pl' };
  if (/(их|іх)$/.test(w)) return { case: 'gen', number: 'pl' };
  if (/(ої|ьої|єї)$/.test(w)) return { case: 'gen', number: 'sg', gender: 'f' };
  if (/(ою|ьою)$/.test(w)) return { case: 'ins', number: 'sg', gender: 'f' };
  if (/(им|ім)$/.test(w)) return { case: 'ins', number: 'sg' };
  if (/(ий|ій|ей|ій)$/.test(w) || /(ій|ен|ів|ш|ас|ам|ой)$/.test(w))
    return { case: 'nom', number: 'sg', gender: 'm' };
  if (/[ая]$/.test(w)) return { case: 'nom', number: 'sg', gender: 'f' };
  if (/[еєо]$/.test(w)) return { case: 'nom', number: 'sg', gender: 'n' };
  if (/[іїи]$/.test(w)) return { case: 'nom', number: 'pl' };
  if (/[ую]$/.test(w)) return { case: 'acc', number: 'sg', gender: 'f' };
  return {};
}

function adjFeatsRu(w: string): Feats {
  if (/(ого|его)$/.test(w)) return { case: 'gen', number: 'sg' };
  if (/(ому|ему)$/.test(w)) return { case: 'dat', number: 'sg' };
  if (/(ыми|ими)$/.test(w)) return { case: 'ins', number: 'pl' };
  if (/(ых|их)$/.test(w)) return { case: 'gen', number: 'pl' };
  if (/(ую|юю)$/.test(w)) return { case: 'acc', number: 'sg', gender: 'f' };
  if (/(ый|ий|ой)$/.test(w)) return { case: 'nom', number: 'sg', gender: 'm' };
  if (/(ая|яя)$/.test(w)) return { case: 'nom', number: 'sg', gender: 'f' };
  if (/(ое|ее)$/.test(w)) return { case: 'nom', number: 'sg', gender: 'n' };
  if (/(ые|ие)$/.test(w)) return { case: 'nom', number: 'pl' };
  if (/(ым|им)$/.test(w)) return { case: 'ins', number: 'sg' };
  return {};
}

const UK_ADJ_END = [
  'ього',
  'ього',
  'ьому',
  'ого',
  'ому',
  'ими',
  'іми',
  'ьої',
  'ьою',
  'ої',
  'ою',
  'их',
  'іх',
  'им',
  'ім',
  'ий',
  'ій',
  'а',
  'я',
  'е',
  'є',
  'і',
  'ї',
  'у',
  'ю',
];
const RU_ADJ_END = [
  'ого',
  'его',
  'ому',
  'ему',
  'ыми',
  'ими',
  'ых',
  'их',
  'ую',
  'юю',
  'ый',
  'ий',
  'ой',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ым',
  'им',
  'ей',
];
const PART_RE =
  /(аний|ений|єний|ований|йований|итий|утий|ятий|отий|бутий|лений|жений|шений|чений|щений|нутий|ваний)$/;

function adjCands(w: string, l: SL, L: Lex): Cand[] {
  if (l === 'uk' && UK_SHORT[w])
    return [cand('ADJ', UK_SHORT[w], { form: 'pred', case: 'nom', number: 'sg', gender: 'm' })];
  if (l === 'ru') {
    const sh = /^(нужен|нужна|нужны|готов|готова|уверен|уверена|должен|должна|рад|рада)$/.exec(w);
    if (sh) return [cand('ADJ', w, { form: 'pred', case: 'nom' })];
  }
  const ends = l === 'uk' ? UK_ADJ_END : RU_ADJ_END;
  const out: Cand[] = [];
  for (const e of ends) {
    if (!w.endsWith(e) || w.length - e.length < 2) continue;
    const st = w.slice(0, -e.length);
    const lemmas = l === 'uk' ? [st + 'ий', st + 'ій'] : [st + 'ый', st + 'ий', st + 'ой'];
    for (const lm of lemmas) {
      if (L.adj.has(lm) || (PART_RE.test(lm) && lm.length > 6 && !L.nouns.has(w))) {
        const f = l === 'uk' ? adjFeatsByEnding(w) : adjFeatsRu(w);
        const deg =
          /(ший|щий|іший|ейший)$/.test(lm) ||
          /^(кращий|гірший|більший|менший|найкращий|лучший)$/.test(lm)
            ? 'cmp'
            : undefined;
        out.push(cand('ADJ', lm, { ...f, ...(deg ? { degree: deg as 'cmp' } : {}) }));
        return out;
      }
    }
  }
  return out;
}

// ───────────── nouns ─────────────

interface NE {
  s: string;
  lemma: string[];
  c: Case;
  n: 'sg' | 'pl';
}
const UK_NE: NE[] = [
  { s: 'ями', lemma: ['я', 'ь', 'й', 'і'], c: 'ins', n: 'pl' },
  { s: 'ами', lemma: ['а', 'о', '', 'и', 'і'], c: 'ins', n: 'pl' },
  { s: 'ях', lemma: ['я', 'ь', 'й', 'і'], c: 'loc', n: 'pl' },
  { s: 'ах', lemma: ['а', 'о', '', 'и', 'і'], c: 'loc', n: 'pl' },
  { s: 'ям', lemma: ['я', 'ь', 'й'], c: 'ins', n: 'sg' },
  { s: 'ам', lemma: ['а', 'о', ''], c: 'dat', n: 'pl' },
  { s: 'ів', lemma: ['', 'а', 'о', 'и', 'і', 'ь'], c: 'gen', n: 'pl' },
  { s: 'їв', lemma: ['й', 'я', 'ї'], c: 'gen', n: 'pl' },
  { s: 'ей', lemma: ['ь', 'е', 'і', 'и'], c: 'gen', n: 'pl' },
  { s: 'ові', lemma: [''], c: 'dat', n: 'sg' },
  { s: 'еві', lemma: ['ь', 'й'], c: 'dat', n: 'sg' },
  { s: 'ою', lemma: ['а'], c: 'ins', n: 'sg' },
  { s: 'ею', lemma: ['я', 'ь', 'а'], c: 'ins', n: 'sg' },
  { s: 'єю', lemma: ['я'], c: 'ins', n: 'sg' },
  { s: 'ом', lemma: ['', 'о'], c: 'ins', n: 'sg' },
  { s: 'ем', lemma: ['ь', 'е', 'й'], c: 'ins', n: 'sg' },
  { s: 'у', lemma: ['а', '', 'о'], c: 'acc', n: 'sg' },
  { s: 'ю', lemma: ['я', 'ь', 'й'], c: 'acc', n: 'sg' },
  { s: 'і', lemma: ['а', 'я', 'ь', '', 'о', 'е', 'і', 'я'], c: 'loc', n: 'sg' },
  { s: 'и', lemma: ['а', '', 'и'], c: 'nom', n: 'pl' },
  { s: 'ї', lemma: ['я', 'й'], c: 'nom', n: 'pl' },
  { s: 'а', lemma: ['а', '', 'о'], c: 'nom', n: 'sg' },
  { s: 'я', lemma: ['я', 'ь', 'й', 'е'], c: 'nom', n: 'sg' },
  { s: 'о', lemma: ['о'], c: 'nom', n: 'sg' },
  { s: 'е', lemma: ['е'], c: 'nom', n: 'sg' },
  { s: 'ь', lemma: ['ня', 'я'], c: 'gen', n: 'pl' },
  { s: 'й', lemma: ['я'], c: 'gen', n: 'pl' },
  { s: '', lemma: ['', 'а', 'о', 'я'], c: 'nom', n: 'sg' },
];
const RU_NE: NE[] = [
  { s: 'ями', lemma: ['я', 'ь', 'е'], c: 'ins', n: 'pl' },
  { s: 'ами', lemma: ['а', 'о', ''], c: 'ins', n: 'pl' },
  { s: 'ях', lemma: ['я', 'ь', 'е'], c: 'loc', n: 'pl' },
  { s: 'ах', lemma: ['а', 'о', ''], c: 'loc', n: 'pl' },
  { s: 'ям', lemma: ['я', 'ь'], c: 'dat', n: 'pl' },
  { s: 'ам', lemma: ['а', 'о', ''], c: 'dat', n: 'pl' },
  { s: 'ов', lemma: ['', 'о'], c: 'gen', n: 'pl' },
  { s: 'ев', lemma: ['й', 'ь'], c: 'gen', n: 'pl' },
  { s: 'ей', lemma: ['ь', 'я', 'е'], c: 'gen', n: 'pl' },
  { s: 'ой', lemma: ['а'], c: 'ins', n: 'sg' },
  { s: 'ом', lemma: ['', 'о'], c: 'ins', n: 'sg' },
  { s: 'ем', lemma: ['ь', 'е', 'й'], c: 'ins', n: 'sg' },
  { s: 'у', lemma: ['а', ''], c: 'acc', n: 'sg' },
  { s: 'ю', lemma: ['я', 'ь'], c: 'acc', n: 'sg' },
  { s: 'е', lemma: ['а', '', 'о', 'е', 'я'], c: 'loc', n: 'sg' },
  { s: 'и', lemma: ['а', 'я', 'ь', 'и', ''], c: 'nom', n: 'pl' },
  { s: 'ы', lemma: ['а', '', 'ы'], c: 'nom', n: 'pl' },
  { s: 'а', lemma: ['а', '', 'о'], c: 'nom', n: 'sg' },
  { s: 'я', lemma: ['я', 'ь', 'е'], c: 'nom', n: 'sg' },
  { s: 'о', lemma: ['о'], c: 'nom', n: 'sg' },
  { s: '', lemma: ['', 'а', 'о'], c: 'nom', n: 'sg' },
];

function altVowel(stem: string): string[] {
  const out: string[] = [];
  const m = /^(.*)([ієо])([^аеєиіїоуюяь']*)$/.exec(stem);
  if (m) {
    for (const v of ['і', 'о', 'е']) if (v !== m[2]) out.push(m[1] + v + m[3]);
  }
  // fleeting е/о: "тижня" → "тиждень", "дня" → "день"
  const f = /^(.*[^аеєиіїоуюя])([^аеєиіїоуюя]ь?)$/.exec(stem);
  if (f) out.push(f[1] + 'е' + f[2], f[1] + 'о' + f[2]);
  return out;
}

const NOM_BY_LEMMA = (lemma: string, form: string, e: NE, l: SL): { c: Case; n: 'sg' | 'pl' }[] => {
  // Resolve the case of an ending given the lemma type.
  const lastL = lemma.slice(-1);
  const fem = lastL === 'а' || lastL === 'я';
  const neut =
    lastL === 'о' || lastL === 'е' || (lastL === 'я' && /ння$|ття$|сся$|лля$/.test(lemma));
  const masc = !fem && !neut;
  const s = e.s;
  if (form === lemma)
    return [
      {
        c: 'nom',
        n:
          (/[иі]$/.test(lemma) && l === 'uk') || (l === 'ru' && /(ия|ы|и)$/.test(lemma))
            ? 'pl'
            : 'sg',
      },
    ];
  if (s === 'а' || s === 'я') {
    if (masc) return [{ c: 'gen', n: 'sg' }];
    if (neut)
      return [
        { c: 'nom', n: 'pl' },
        { c: 'gen', n: 'sg' },
      ];
    return [{ c: 'nom', n: 'sg' }];
  }
  if (s === 'и' || s === 'і' || s === 'ї' || s === 'ы') {
    if (fem)
      return [
        { c: 'nom', n: 'pl' },
        { c: 'gen', n: 'sg' },
      ];
    if (masc && (s === 'и' || s === 'і' || s === 'ы'))
      return [
        { c: 'nom', n: 'pl' },
        { c: 'loc', n: 'sg' },
      ];
    if (neut && s === 'і' && /е$/.test(lemma))
      return [
        { c: 'nom', n: 'pl' },
        { c: 'loc', n: 'sg' },
      ];
    return [{ c: 'loc', n: 'sg' }];
  }
  if (s === 'у' || s === 'ю') return fem ? [{ c: 'acc', n: 'sg' }] : [{ c: 'gen', n: 'sg' }];
  if (s === '') return [{ c: 'gen', n: 'pl' }];
  return [{ c: e.c, n: e.n }];
};

function nounCands(w: string, l: SL, L: Lex): Cand[] {
  const table = l === 'uk' ? UK_NE : RU_NE;
  const out: Cand[] = [];
  for (const e of table) {
    if (!w.endsWith(e.s) || w.length - e.s.length < 2) continue;
    const st = w.slice(0, w.length - e.s.length);
    for (const le of e.lemma) {
      for (const stem of [st, ...altVowel(st)]) {
        const lm = stem + le;
        if (!L.nouns.has(lm)) continue;
        const res = NOM_BY_LEMMA(lm, w, e, l);
        const gender =
          /[ая]$/.test(lm) && !/ння$|ття$/.test(lm) ? 'f' : /[оеє]$|ння$|ття$/.test(lm) ? 'n' : 'm';
        for (const r of res) {
          const nom = res.some((x) => x.c === 'nom');
          out.push(
            cand('NOUN', lm, { case: r.c, number: r.n, gender }, nom ? { count: true } : undefined),
          );
        }
        if (out.length) return prefNom(out);
      }
    }
  }
  return out;
}

function prefNom(cs: Cand[]): Cand[] {
  return [...cs.filter((c) => c.feats.case === 'nom'), ...cs.filter((c) => c.feats.case !== 'nom')];
}

/** Case / number guess for an unknown noun by its ending. */
function guessNoun(w: string, l: SL): Cand {
  const obl =
    l === 'uk'
      ? /(ою|ею|єю|ом|ем|ам|ами|ах|ях|ям|ями|ів|ові|еві|у|ю)$/
      : /(ой|ей|ом|ем|ам|ами|ах|ях|ям|ями|ов|ев|у|ю)$/;
  if (obl.test(w))
    return cand('NOUN', w, {
      case: /(у|ю)$/.test(w) ? 'acc' : 'gen',
      number: /(ам|ами|ах|ях|ів|ов|ями|ям)$/.test(w) ? 'pl' : 'sg',
    });
  const pl = /[иіїы]$/.test(w);
  return cand('NOUN', w, {
    case: 'nom',
    number: pl ? 'pl' : 'sg',
    gender: /[ая]$/.test(w) ? 'f' : /[оеє]$/.test(w) ? 'n' : 'm',
  });
}

// ───────────── verbs ─────────────

const PREFIXES = [
  'пере',
  'недо',
  'від',
  'роз',
  'під',
  'над',
  'при',
  'про',
  'об',
  'за',
  'на',
  'по',
  'ви',
  'до',
  'зі',
  'з',
  'с',
  'у',
  'в',
  'вы',
  'от',
  'рас',
  'раз',
  'пред',
];
const PREF: Record<SL, string[]> = {
  uk: [
    'пере',
    'недо',
    'від',
    'роз',
    'під',
    'над',
    'при',
    'про',
    'об',
    'за',
    'на',
    'по',
    'ви',
    'до',
    'зі',
    'з',
    'с',
    'у',
    'в',
  ],
  ru: [
    'пере',
    'недо',
    'под',
    'над',
    'при',
    'про',
    'об',
    'за',
    'на',
    'по',
    'вы',
    'до',
    'от',
    'рас',
    'раз',
    'пред',
    'с',
    'у',
    'в',
  ],
};
const IMPF_BASES = new Set([
  'сідати',
  'ходити',
  'бігати',
  'їжджати',
  'лягати',
  'ставати',
  'давати',
  'кидати',
  'пускати',
  'водити',
  'носити',
  'возити',
  'літати',
  'плавати',
  'бегать',
  'ходить',
  'давать',
  'садиться',
  'ложиться',
  'вставать',
  'їздити',
  'сідатися',
]);

const allVerbs = new WeakMap<Lex, Set<string>>();

/** Known verb lemma, directly or as prefix + known verb (precomputed once per language). */
function known(lemma: string, L: Lex): boolean {
  let all = allVerbs.get(L);
  if (!all) {
    all = new Set(L.verbs);
    const pref = L === lexes.uk ? PREF.uk : PREF.ru;
    for (const v of L.verbs) {
      if (v.length < 4 && v !== 'йти') continue;
      for (const p of pref) {
        all.add(p + v);
        if (/^[єюяї]/.test(v)) all.add(p + "'" + v);
      }
    }
    allVerbs.set(L, all);
  }
  if (all.has(lemma)) return true;
  const base = lemma.replace(/(ся|сь)$/, '');
  return base !== lemma && all.has(base);
}

function aspectOf(lemma: string, L: Lex): 'perfective' | 'imperfective' {
  const b = lemma.replace(/(ся|сь)$/, '');
  if (L.pf.has(lemma) || L.pf.has(b)) return 'perfective';
  if (L.verbs.has(lemma) || L.verbs.has(b)) return 'imperfective';
  if (/нути$|нуть$/.test(b) && !/тягнути|тянуть|гнути|гнуть/.test(b)) return 'perfective';
  for (const p of PREFIXES) {
    if (b.startsWith(p) && b.length - p.length > 3) {
      const rest = b.slice(p.length).replace(/^'/, '');
      if (IMPF_BASES.has(rest)) return p === 'по' ? 'perfective' : 'imperfective';
      if (L.verbs.has(rest)) {
        if (/(увати|ювати|ивати|ывать|ивать|овывать)$/.test(b) && !L.verbs.has(rest))
          return 'imperfective';
        return 'perfective';
      }
      if (/(увати|ювати|ивати|ати|яти|ывать|ивать|ать|ять)$/.test(b)) return 'imperfective';
      return 'perfective';
    }
  }
  return 'imperfective';
}

/** Reverse consonant alternations at the end of a present stem. */
function alts(stem: string): string[] {
  const out = [stem];
  const r = (re: RegExp, subs: string[]): void => {
    if (re.test(stem)) for (const s of subs) out.push(stem.replace(re, s));
  };
  r(/дж$/, ['д']);
  r(/жч$/, ['зк']);
  r(/ж$/, ['з', 'г', 'д']);
  r(/ш$/, ['с', 'х']);
  r(/ч$/, ['к', 'т']);
  r(/щ$/, ['ст', 'ск', 'т']);
  r(/([бпвмф])л$/, ['$1']);
  return out;
}

const VOWEL = /[аеєиіїоуюяы]$/;

function infFromStem(stem: string, l: SL, imp = false, sg1 = false): string[] {
  const c: string[] = [];
  // "поставу" is not 1sg of поставити (that is "поставлю"): labial stems need л
  const labialNoL = sg1 && /[бпвмф]$/.test(stem);
  if (l === 'uk') {
    if (VOWEL.test(stem)) {
      if (/(да|ста|зна)$/.test(stem) && !imp) c.push(stem + 'вати');
      c.push(stem + 'ти');
      if (/[ую]$/.test(stem)) c.push(stem + 'вати');
      if (/[ая]$/.test(stem)) c.push(stem + 'вати');
      if (/о$/.test(stem)) c.push(stem + 'яти');
      if (/і$/.test(stem)) c.push(stem.slice(0, -1) + 'іти');
    } else {
      const as = alts(stem);
      if (!labialNoL) for (const v of as) c.push(v + 'ити', v + 'іти', v + 'їти');
      for (const v of as.slice(1)) c.push(v + 'ати', v + 'яти', v + 'ти');
      if (!labialNoL) c.push(stem + 'ати', stem + 'яти');
      c.push(stem + 'ти');
      for (const v of as) {
        if (/[дт]$/.test(v)) c.push(v.slice(0, -1) + 'сти');
        if (/н$/.test(v)) c.push(v + 'ути');
      }
    }
  } else {
    if (VOWEL.test(stem)) {
      c.push(stem + 'ть');
      if (/у$/.test(stem)) c.push(stem.slice(0, -1) + 'овать', stem.slice(0, -1) + 'евать');
      if (/ю$/.test(stem)) c.push(stem.slice(0, -1) + 'евать', stem.slice(0, -1) + 'овать');
      if (/[ая]$/.test(stem)) c.push(stem + 'вать');
      if (/о$/.test(stem)) c.push(stem + 'ять');
    } else {
      const as = alts(stem);
      if (!labialNoL) for (const v of as) c.push(v + 'ить', v + 'еть');
      for (const v of as.slice(1)) c.push(v + 'ать', v + 'ять', v + 'ти');
      c.push(stem + 'ать', stem + 'ять', stem + 'ти', stem + 'ть');
      if (/[гк]$/.test(stem)) c.push(stem.slice(0, -1) + 'чь');
      for (const v of as) {
        if (/[дт]$/.test(v)) c.push(v.slice(0, -1) + 'сть');
        if (/н$/.test(v)) c.push(v + 'уть');
      }
    }
  }
  return c;
}

/** Infinitive candidates for an imperative stem ("зроби" → зробити, "покажи" → показати, "склади" → скласти). */
function impInf(stem: string, l: SL): string[] {
  if (VOWEL.test(stem)) return infFromStem(stem, l, true);
  const as = alts(stem);
  const c: string[] = [];
  if (l === 'uk') {
    for (const v of as) c.push(v + 'ити', v + 'іти');
    for (const v of as) if (/[дт]$/.test(v)) c.push(v.slice(0, -1) + 'сти');
    for (const v of as.slice(1)) c.push(v + 'ати', v + 'ти');
    c.push(stem + 'ти');
  } else {
    for (const v of as) c.push(v + 'ить', v + 'еть');
    for (const v of as.slice(1)) c.push(v + 'ать', v + 'ти');
    if (/[гк]$/.test(stem)) c.push(stem.slice(0, -1) + 'чь');
    c.push(stem + 'ти');
  }
  return c;
}

const P1 = (p: 1 | 2 | 3, n: 'sg' | 'pl' = 'sg'): Feats => ({
  tense: 'present',
  person: p,
  number: n,
  form: 'fin',
});
const UK_PRES: [string, Feats][] = [
  ['ємо', P1(1, 'pl')],
  ['емо', P1(1, 'pl')],
  ['имо', P1(1, 'pl')],
  ['їмо', P1(1, 'pl')],
  ['єте', P1(2, 'pl')],
  ['ете', P1(2, 'pl')],
  ['ите', P1(2, 'pl')],
  ['їте', P1(2, 'pl')],
  ['ють', P1(3, 'pl')],
  ['уть', P1(3, 'pl')],
  ['ять', P1(3, 'pl')],
  ['ать', P1(3, 'pl')],
  ['єш', P1(2)],
  ['еш', P1(2)],
  ['иш', P1(2)],
  ['їш', P1(2)],
  ['ить', P1(3)],
  ['їть', P1(3)],
  ['є', P1(3)],
  ['е', P1(3)],
  ['ю', P1(1)],
  ['у', P1(1)],
];
const RU_PRES: [string, Feats][] = [
  ['ем', P1(1, 'pl')],
  ['им', P1(1, 'pl')],
  ['ете', P1(2, 'pl')],
  ['ите', P1(2, 'pl')],
  ['ют', P1(3, 'pl')],
  ['ут', P1(3, 'pl')],
  ['ят', P1(3, 'pl')],
  ['ат', P1(3, 'pl')],
  ['ешь', P1(2)],
  ['ишь', P1(2)],
  ['ет', P1(3)],
  ['ит', P1(3)],
  ['ю', P1(1)],
  ['у', P1(1)],
];

function verbCands(w0: string, l: SL, L: Lex): Cand[] {
  const out: Cand[] = [];
  let w = w0;
  let refl = '';
  if (/(ся|сь)$/.test(w) && w.length > 4) {
    refl = 'ся';
    w = w.slice(0, -2);
  }
  const lemmaOf = (inf: string): string => (refl ? inf + 'ся' : inf);
  // "здається" = здає + ться: drop the inserted т
  const ws = refl && /[еє]ть$/.test(w) ? [w, w.slice(0, -2)] : [w];
  const add = (inf: string, f: Feats, x?: X): boolean => {
    const lm = lemmaOf(inf);
    if (!known(lm, L) && !(refl && known(inf, L))) return false;
    if (
      out.some(
        (c) =>
          c.lemma === lm &&
          c.feats.form === f.form &&
          c.feats.person === f.person &&
          c.feats.tense === f.tense,
      )
    )
      return true;
    out.push(cand('VERB', lm, { ...f, aspect: aspectOf(lm, L) }, x));
    return true;
  };
  if (l === 'uk') {
    // дієприслівники: "виконуючи" (3pl виконують), "розминаючись", "зробивши", "принісши"
    const g = /^(.{2,})(ючи|учи|ачи|ячи)$/.exec(w);
    if (g) {
      for (const c of verbCands(w.slice(0, -2) + 'ть' + (refl ? 'ся' : ''), l, L))
        if (c.feats.person === 3 && c.feats.number === 'pl' && c.feats.tense === 'present')
          out.push(cand('VERB', c.lemma, { form: 'ger', aspect: c.feats.aspect }));
      if (out.length) return out;
    }
    const gp = /^(.{2,}(?:в|[^аеєиіїоуюя]))ши$/.exec(w);
    if (gp) {
      for (const c of verbCands(gp[1] + (refl ? 'ся' : ''), l, L))
        if (c.feats.tense === 'past')
          out.push(cand('VERB', c.lemma, { form: 'ger', tense: 'past', aspect: c.feats.aspect }));
      if (out.length) return out;
    }
    // impersonal -но/-то: "зараховано", "зроблено", "пропущено", "зайнято"
    if (!refl) {
      const ip = /^(.{2,}?)(ьовано|овано|ано|яно|ено|єно|то)$/.exec(w);
      if (ip) {
        const b = ip[1];
        const lemmas =
          ip[2] === 'овано'
            ? [b + 'увати']
            : ip[2] === 'ьовано'
              ? [b + 'ювати']
              : ip[2] === 'ано'
                ? [b + 'ати']
                : ip[2] === 'яно'
                  ? [b + 'яти']
                  : ip[2] === 'то'
                    ? [b + 'ти']
                    : [
                        ...alts(b.replace(/([бпвмф])л$/, '$1')).flatMap((v) => [
                          v + 'ити',
                          v + 'іти',
                        ]),
                        b.replace(/щ$/, 'ст') + 'ити',
                      ];
        for (const lm of lemmas)
          if (known(lm, L)) {
            out.push(
              cand(
                'VERB',
                lm,
                { tense: 'past', form: 'fin', aspect: aspectOf(lm, L) },
                { impers: true },
              ),
            );
            return out;
          }
      }
    }
  }
  // irregular table (whole form incl. reflexive)
  const irr = L.irr.get(w0) ?? (refl ? L.irr.get(w) : undefined);
  if (irr) {
    const [lm, f] = irr;
    const lemma = L.irr.get(w0) ? lm : lemmaOf(lm);
    const isBe = lm === 'бути' || lm === 'быть';
    out.push(
      cand(
        isBe ? 'AUX' : 'VERB',
        lemma,
        { ...f, aspect: aspectOf(lemma, L) },
        isBe ? { cop: true, ...(f.tense === 'future' ? { aux: 'fut' as const } : {}) } : undefined,
      ),
    );
  }
  // prefixed irregular: "прибіжу", "прийшов", "пройшли", "з'їла"
  if (!irr) {
    for (const p of PREFIXES) {
      if (!w0.startsWith(p) || w0.length - p.length < 2) continue;
      const rest = w0.slice(p.length).replace(/^'/, '');
      const ir = L.irr.get(rest);
      if (ir && ir[0] !== 'бути' && ir[0] !== 'быть') {
        const lm = p + (w0[p.length] === "'" ? "'" : '') + ir[0];
        if (known(lm, L)) out.push(cand('VERB', lm, { ...ir[1], aspect: 'perfective' }));
      }
    }
  }
  // past: consonant cores (пробіг, допоміг, вийшов)
  if (l === 'uk') {
    for (const [core, inf] of Object.entries(UK_PAST_CORE)) {
      const m = new RegExp(`^(.*?)${core}$`).exec(w);
      if (m) {
        const pre = m[1] === 'пі' && core === 'йшов' ? 'пі' : m[1];
        const lm = core === 'йшов' ? (pre === 'пі' ? 'піти' : pre + 'йти') : pre + inf;
        add(lm, { tense: 'past', gender: 'm', number: 'sg', form: 'fin' });
      }
    }
    // past of -нути verbs without the suffix: "схуд", "схудла", "засох"
    const nm = /^(.+[^аеєиіїоуюяв])(ла|ли|ло)?$/.exec(w);
    if (nm && w.length > 3)
      add(nm[1] + 'нути', {
        tense: 'past',
        form: 'fin',
        number: nm[2] === 'ли' ? 'pl' : 'sg',
        gender: nm[2] === 'ла' ? 'f' : nm[2] === 'ло' ? 'n' : nm[2] ? undefined : 'm',
      });
    const jm = /^(.*)йш(ла|ли|ло)$/.exec(w);
    if (jm)
      add(jm[1] + 'йти', {
        tense: 'past',
        number: jm[2] === 'ли' ? 'pl' : 'sg',
        gender: jm[2] === 'ла' ? 'f' : jm[2] === 'ло' ? 'n' : undefined,
        form: 'fin',
      });
  }
  if (l === 'uk') {
    if (/(ти|чи)$/.test(w)) add(w, { form: 'inf' });
    if (/ть$/.test(w) && VOWEL.test(w.slice(0, -2)))
      add(w.slice(0, -1) + 'и', { form: 'inf' }, { cont: false });
    const fut = /^(.*ти)(му|меш|ме|мемо|мете|муть)$/.exec(w);
    if (fut) {
      const pn: Record<string, Feats> = {
        му: { person: 1, number: 'sg' },
        меш: { person: 2, number: 'sg' },
        ме: { person: 3, number: 'sg' },
        мемо: { person: 1, number: 'pl' },
        мете: { person: 2, number: 'pl' },
        муть: { person: 3, number: 'pl' },
      };
      add(fut[1], { tense: 'future', form: 'fin', ...pn[fut[2]] });
    }
    // past
    const pm = /^(.+)в$/.exec(w);
    if (pm) {
      add(pm[1] + 'ти', { tense: 'past', gender: 'm', number: 'sg', form: 'fin' });
      add(pm[1] + 'сти', { tense: 'past', gender: 'm', number: 'sg', form: 'fin' });
    }
    const pf = /^(.+)(ла|ло|ли)$/.exec(w);
    if (pf) {
      const g: Feats =
        pf[2] === 'ла'
          ? { gender: 'f', number: 'sg' }
          : pf[2] === 'ло'
            ? { gender: 'n', number: 'sg' }
            : { number: 'pl' };
      for (const inf of [pf[1] + 'ти', pf[1] + 'сти', pf[1].replace(/[дт]$/, '') + 'сти'])
        add(inf, { tense: 'past', form: 'fin', ...g });
    }
  } else {
    if (/(ть|ти|чь)$/.test(w)) add(w, { form: 'inf' });
    const pm = /^(.+)л$/.exec(w);
    if (pm) add(pm[1] + 'ть', { tense: 'past', gender: 'm', number: 'sg', form: 'fin' });
    const pf = /^(.+)л(а|о|и)$/.exec(w);
    if (pf) {
      const g: Feats =
        pf[2] === 'а'
          ? { gender: 'f', number: 'sg' }
          : pf[2] === 'о'
            ? { gender: 'n', number: 'sg' }
            : { number: 'pl' };
      add(pf[1] + 'ть', { tense: 'past', form: 'fin', ...g });
    }
  }
  // present / perfective future
  for (const wv of ws) {
    for (const [e, f] of l === 'uk' ? UK_PRES : RU_PRES) {
      if (!wv.endsWith(e) || wv.length - e.length < 2) continue;
      const st = wv.slice(0, -e.length);
      const sg1 =
        (f.person === 1 && f.number === 'sg') ||
        (f.person === 3 && f.number === 'pl' && /^[яа]/.test(e));
      for (const inf of infFromStem(st, l, false, sg1)) if (add(inf, f)) break;
    }
  }
  // imperative
  const imp: [RegExp, 'sg' | 'pl' | '1pl'][] =
    l === 'uk'
      ? [
          [/^(.+[аеєиіїоуюя])йте$/, 'pl'],
          [/^(.+[^аеєиіїоуюя])іть$/, 'pl'],
          [/^(.+[аеєиіїоуюя])ймо$/, '1pl'],
          [/^(.+[^аеєиіїоуюя])імо$/, '1pl'],
          [/^(.+[аеєиіїоуюя])й$/, 'sg'],
          [/^(.+[^аеєиіїоуюя])и$/, 'sg'],
          [/^(.*ста)нь$/, 'sg'],
          [/^(.*бу)дь$/, 'sg'],
          [/^(.+[дтзслн])ь$/, 'sg'],
        ]
      : [
          [/^(.+[аеиоуюяы])йте$/, 'pl'],
          [/^(.+[^аеиоуюяы])ите$/, 'pl'],
          [/^(.+[аеиоуюяы])й$/, 'sg'],
          [/^(.+[^аеиоуюяы])и$/, 'sg'],
          [/^(.+[^аеиоуюяы])ь$/, 'sg'],
          [/^(.*ста)нь$/, 'sg'],
        ];
  for (const [re, n] of imp) {
    const m = re.exec(w);
    if (!m) continue;
    const st = m[1];
    const f: Feats = { form: 'imp', person: n === '1pl' ? 1 : 2, number: n === 'sg' ? 'sg' : 'pl' };
    const cs = /(ста|бу)$/.test(st)
      ? [l === 'uk' ? st + 'ти' : st + 'ть']
      : /ь$/.test(w) && l === 'uk'
        ? [st + 'ити', st + 'іти', ...(/н$/.test(st) ? [st + 'ути'] : [])]
        : impInf(st, l);
    for (const inf of cs) if (add(inf, f)) break;
  }
  return out;
}

// ───────────── analysis entry ─────────────

function analyzeOne(w: string, l: SL): Cand[] {
  const L = lex(l);
  const out: Cand[] = [];
  const cl = L.closed.get(w);
  if (cl) out.push(...cl);
  if (/^\d/.test(w)) return [cand('NUM', w, {}, { num: Number(w) })];
  const nw = numWord(l, w);
  if (nw !== undefined && !cl) return [cand('NUM', w, {}, { num: nw })];
  if (nw !== undefined) out.push(cand('NUM', w, {}, { num: nw }));
  if (TIMES_ADV[w])
    return [cand('ADV', w, {}, { num: TIMES_ADV[w], unit: 'time', sem: 'frequency' })];
  if (cl && cl.some((c) => c.pos !== 'NOUN' && c.pos !== 'VERB' && c.pos !== 'ADJ')) {
    if (w !== 'їм' && w !== 'раз' && w !== 'все' && w !== 'тому') return out;
  }
  const v = verbCands(w, l, L);
  const a = adjCands(w, l, L);
  const n = L.nouns.has(w) ? prefNom([...nounCands(w, l, L)]) : nounCands(w, l, L);
  const adv = L.adv.has(w) ? [cand('ADV', w, {}, advX(w))] : [];
  if (w === 'їм') out.push(...v);
  else out.push(...adv, ...v, ...a, ...n);
  if (out.length) return out;
  return [];
}

function advX(w: string): X {
  if (
    /^(зараз|потім|тепер|вже|уже|ще|раніше|пізніше|скоро|давно|недавно|нещодавно|досі|тоді|сейчас|потом|теперь|уже|еще|раньше|позже|зранку|ввечері|вночі|вдень)$/.test(
      w,
    )
  )
    return { sem: 'time' };
  if (
    /^(завжди|ніколи|часто|іноді|інколи|рідко|постійно|щодня|щоранку|щовечора|щоразу|зазвичай|всегда|никогда|часто|иногда|редко|постоянно|ежедневно|обычно|двічі|тричі)$/.test(
      w,
    )
  )
    return { sem: 'frequency' };
  if (/^(вдома|додому|тут|там|всередину|назовні|дома)$/.test(w)) return { sem: 'place' };
  if (
    /^(дуже|трохи|занадто|надто|забагато|досить|очень|немного|слишком|майже|зовсім|цілком)$/.test(w)
  )
    return { sem: 'degree' };
  return { sem: 'manner' };
}

function analyze(w: string, primary: SL): Cand[] {
  const other: SL = primary === 'uk' ? 'ru' : 'uk';
  // "отжиманий", "упражнений": genitive plural of -ание / -ение nouns (not -нний adjectives)
  if (
    primary === 'ru' &&
    /[аея]ний$/.test(w) &&
    !/нний$/.test(w) &&
    w.length > 6 &&
    !lex('ru').closed.has(w)
  )
    return [cand('NOUN', w.slice(0, -2) + 'ие', { case: 'gen', number: 'pl', gender: 'n' })];
  let out = analyzeOne(w, primary);
  if (!out.length || (out.every((c) => c.pos === 'NOUN') && !lex(primary).nouns.has(w))) {
    // a 1sg "-у/-ю" guess of the other language does not beat a known noun form ("сну", "перерву")
    const o = analyzeOne(w, other).filter(
      (c) =>
        !out.length ||
        !(c.pos === 'VERB' && c.feats.person === 1 && c.feats.number === 'sg' && /[уюu]$/.test(w)),
    );
    if (o.length && (!out.length || o.some((c) => c.pos !== 'NOUN'))) out = [...o, ...out];
  }
  if (out.length) return out;
  // "непогано", "неправильно": не- + known adverb
  if (/^не/.test(w) && w.length > 5) {
    const base = analyzeOne(w.slice(2), primary).filter((c) => c.pos === 'ADV');
    if (base.length) return base.map((c) => cand('ADV', w, c.feats, c.x));
  }
  // unknown: suffix guesses
  if (/(ий|ій|ого|ому|ими|их|ої|ый|ая|ое|ые)$/.test(w) && w.length > 4) {
    const f = primary === 'uk' ? adjFeatsByEnding(w) : adjFeatsRu(w);
    return [cand('ADJ', w, f)];
  }
  if (primary === 'uk' && /[аяеєиіу](ється|еться|иться|іться|ються|уться|яться|аться)$/.test(w)) {
    const m = /^(.*?)(ється|еться|иться|іться|ються|уться|яться|аться)$/.exec(w) as RegExpExecArray;
    const pl = /(ються|уться|яться|аться)$/.test(w);
    return [
      cand(
        'VERB',
        m[1] +
          (m[2].startsWith('є') || m[2].startsWith('ю')
            ? 'тися'
            : m[2].startsWith('и') || m[2].startsWith('я')
              ? 'итися'
              : 'тися'),
        { tense: 'present', person: 3, number: pl ? 'pl' : 'sg', form: 'fin' },
      ),
    ];
  }
  if (/(вши|вшись)$/.test(w)) return [cand('VERB', w, { form: 'ger', tense: 'past' })];
  if (primary === 'uk' && /[^аеєиіїоуюя](ючи|учи|ачи|ячи)(сь)?$/.test(w) && w.length > 6)
    return [cand('VERB', w, { form: 'ger' })];
  if (/(тися|тись|ться|вся|лася|лися)$/.test(w))
    return [cand('VERB', w, { form: /тися|тись|ться$/.test(w) ? 'inf' : 'fin' })];
  // an unknown word in -ити/-ати/-іти/… is an infinitive
  if (
    primary === 'uk'
      ? /[^аеєиіїоуюя](ити|ати|іти|яти|ути|оти)$|(сти|зти|гти|кти)$/.test(w)
      : /[^аеиоуюяы](ить|ать|еть|ять|уть|оть)$/.test(w)
  )
    return [
      cand('VERB', primary === 'uk' ? w : w, {
        form: 'inf',
        aspect: /^(з|с|по|про|за|на|ви|від|до|пере|роз|під|при|у|в)/.test(w)
          ? 'perfective'
          : 'imperfective',
      }),
    ];
  return [guessNoun(w, primary)];
}

// ───────────── multi-word expressions ─────────────

const UK_MWE: MWE[] = [
  mw('тому що', { sub: 'causal' }, 'SCONJ'),
  mw('тому шо', { sub: 'causal' }, 'SCONJ'),
  mw('через те що', { sub: 'causal' }, 'SCONJ'),
  mw('для того щоб', { sub: 'purpose' }, 'SCONJ'),
  mw('так щоб', { sub: 'purpose' }, 'SCONJ'),
  mw('після того як', { sub: 'temporal' }, 'SCONJ'),
  mw('після того , як', { sub: 'temporal' }, 'SCONJ'),
  mw('перед тим , як', { sub: 'temporal' }, 'SCONJ'),
  mw('до того , як', { sub: 'temporal' }, 'SCONJ'),
  mw('відтоді , як', { sub: 'temporal' }, 'SCONJ'),
  mw('відтоді як', { sub: 'temporal' }, 'SCONJ'),
  mw('з тих пір , як', { sub: 'temporal' }, 'SCONJ'),
  mw('з того часу , як', { sub: 'temporal' }, 'SCONJ'),
  mw('тому , що', { sub: 'causal' }, 'SCONJ'),
  mw('через те , що', { sub: 'causal' }, 'SCONJ'),
  mw('для того , щоб', { sub: 'purpose' }, 'SCONJ'),
  mw('замість того , щоб', { sub: 'purpose' }, 'SCONJ'),
  mw('незважаючи на те , що', { sub: 'concessive' }, 'SCONJ'),
  mw('перед тим як', { sub: 'temporal' }, 'SCONJ'),
  mw('перш ніж', { sub: 'temporal' }, 'SCONJ'),
  mw('до того як', { sub: 'temporal' }, 'SCONJ'),
  mw('як тільки', { sub: 'temporal' }, 'SCONJ'),
  mw('незважаючи на те що', { sub: 'concessive' }, 'SCONJ'),
  mw('попри те що', { sub: 'concessive' }, 'SCONJ'),
  mw('навіть якщо', { sub: 'concessive' }, 'SCONJ'),
  mw('коли б', { sub: 'conditional' }, 'SCONJ'),
  mw('як часто', { wh: 'how_often' }),
  mw('як довго', { wh: 'how_long' }),
  mw('скільки часу', { wh: 'how_long' }),
  mw('о котрій', { wh: 'when' }),
  mw('в який час', { wh: 'when' }),
  mw('з якої причини', { wh: 'why' }),
  mw('для чого', { wh: 'why' }),
  mw('як щодо', { wh: 'what', about: true }),
  mw('що таке', { wh: 'what' }),
  mw('будь ласка', { please: true, disc: true }, 'INTJ'),
  mw('чи ні', { orNot: true }),
  mw('або ні', { orNot: true }),
  mw('чи не так', { tag: true }),
  mw('не можна', { predic: 'can', neg: true }),
  mw('в мене', { poss: true }),
  mw('у мене', { poss: true }),
  mw('в тебе', { poss: true }),
  mw('у тебе', { poss: true }),
  mw('в нас', { poss: true }),
  mw('у нас', { poss: true }),
  mw('у меня', { poss: true }),
  mw('у тебя', { poss: true }),
  mw('так само', { sem: 'manner' }, 'ADV'),
  mw('шоб', { sub: 'purpose' }, 'SCONJ'),
  mw('шобы', { sub: 'purpose' }, 'SCONJ'),
  mw('якщо чесно', { disc: true }, 'INTJ'),
  mw('чесно кажучи', { disc: true }, 'INTJ'),
  mw('по правді', { disc: true }, 'INTJ'),
  mw('шо правда', { disc: true }, 'INTJ'),
];
const RU_MWE: MWE[] = [
  mw('потому что', { sub: 'causal' }, 'SCONJ'),
  mw('так как', { sub: 'causal' }, 'SCONJ'),
  mw('для того чтобы', { sub: 'purpose' }, 'SCONJ'),
  mw('после того как', { sub: 'temporal' }, 'SCONJ'),
  mw('после того , как', { sub: 'temporal' }, 'SCONJ'),
  mw('перед тем , как', { sub: 'temporal' }, 'SCONJ'),
  mw('до того , как', { sub: 'temporal' }, 'SCONJ'),
  mw('с тех пор , как', { sub: 'temporal' }, 'SCONJ'),
  mw('с тех пор как', { sub: 'temporal' }, 'SCONJ'),
  mw('потому , что', { sub: 'causal' }, 'SCONJ'),
  mw('для того , чтобы', { sub: 'purpose' }, 'SCONJ'),
  mw('несмотря на то , что', { sub: 'concessive' }, 'SCONJ'),
  mw('перед тем как', { sub: 'temporal' }, 'SCONJ'),
  mw('как только', { sub: 'temporal' }, 'SCONJ'),
  mw('несмотря на то что', { sub: 'concessive' }, 'SCONJ'),
  mw('как часто', { wh: 'how_often' }),
  mw('как долго', { wh: 'how_long' }),
  mw('сколько времени', { wh: 'how_long' }),
  mw('во сколько', { wh: 'when' }),
  mw('в какое время', { wh: 'when' }),
  mw('не так ли', { tag: true }),
  mw('или нет', { orNot: true }),
  mw('у меня', { poss: true }),
  mw('у тебя', { poss: true }),
  mw('у нас', { poss: true }),
  mw('что такое', { wh: 'what' }),
  mw('если честно', { disc: true }, 'INTJ'),
  mw('честно говоря', { disc: true }, 'INTJ'),
];

// ───────────── contextual disambiguation ─────────────

const COUNTABLE =
  /^(підхід|повторення|раз|калорія|день|крок|тренування|хвилина|година|кілограм|серія|сет|вправа|подход|повторение|калория|шаг|тренировка|минута|час|серия|упражнение|км|кг|кілометр|рік|тиждень|місяць)$/;

function disambig(ts: T[], l: SL): void {
  const L = lex(l);
  const Lo = lex(l === 'uk' ? 'ru' : 'uk');
  const isBoundary = (t: T): boolean =>
    (t.kind === 'p' && /[,;:()–—-]/.test(t.text)) || t.pos === 'CONJ' || t.pos === 'SCONJ';
  const segStartOf = (i: number): number => {
    let k = i - 1;
    while (k >= 0 && !isBoundary(ts[k])) k--;
    return k + 1;
  };
  const words_ = ts.filter((t) => t.kind === 'w');
  const firstWord = words_[0];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.kind === 'p' || t.kind === 'e') {
      t.pos = t.kind === 'e' ? 'X' : 'PUNCT';
      continue;
    }
    if (t.kind === 'n') {
      choose(t, t.cands[0]);
      continue;
    }
    if (t.x.cont) {
      if (t.cands.length) {
        const c =
          t.cands.find((k) => k.pos === 'ADP' || k.pos === 'PRON' || k.pos === 'DET') ?? t.cands[0];
        choose(t, c);
      }
      continue;
    }
    if (t.mx.time) {
      const c =
        t.cands.find(
          (k) => k.pos === 'ADV' || k.pos === 'NOUN' || k.pos === 'ADJ' || k.pos === 'DET',
        ) ?? t.cands[0];
      if (c) choose(t, c);
      const single = !(
        ts[i + 1] &&
        ts[i + 1].mx.cont &&
        ts[i + 1].mx.time === undefined &&
        ts[i + 1].x.cont
      );
      if (t.pos === 'VERB' || (single && !ts[i + 1]?.x.cont)) {
        t.pos = 'ADV';
        t.lemma = t.norm;
        t.feats = {};
      }
      t.x.sem = 'time';
      continue;
    }
    if (!t.cands.length) {
      t.pos = 'X';
      continue;
    }
    const next = ts[i + 1];
    const prev = ts[i - 1];
    const ss = segStartOf(i);
    const atStart = (): boolean => {
      for (let k = ss; k < i; k++) {
        const u = ts[k];
        if (
          u.pos === 'INTJ' ||
          u.x.disc ||
          u.x.voc ||
          u.x.please ||
          u.x.time ||
          u.pos === 'PUNCT' ||
          (u.pos === 'ADV' && u.x.sem === 'time') ||
          u.pos === 'PART'
        )
          continue;
        return false;
      }
      return true;
    };
    const has = (p: Pos): boolean => t.cands.some((c) => c.pos === p);
    const P = (p: Pos | Pos[], f?: (c: Cand) => boolean): boolean => pick(t, p, f);
    const w = t.norm;
    const segEnd = (() => {
      let k = i + 1;
      while (k < ts.length && !(ts[k].kind === 'p' && /[,;:()–—.!?-]/.test(ts[k].text))) k++;
      return k;
    })();
    const ahead = ts.slice(i + 1, segEnd);
    const aheadInf = ahead.some((u) =>
      u.cands.some((c) => c.pos === 'VERB' && c.feats.form === 'inf'),
    );
    const aheadFin = ahead.some(
      (u) =>
        u.cands.some((c) => (c.pos === 'VERB' || c.pos === 'AUX') && c.feats.form === 'fin') &&
        !u.cands.some(
          (c) =>
            c.pos === 'NOUN' || c.pos === 'ADJ' || (c.pos === 'VERB' && c.feats.form === 'inf'),
        ),
    );
    const behind = ts.slice(ss, i);
    const prevW = [...behind].reverse().find((u) => u.kind === 'w' && !u.x.neg);
    const pw = [...ts.slice(0, i)].reverse().find((u) => u.kind === 'w' && !u.x.neg);
    if (w === 'що' || w === 'шо' || w === 'что') {
      const cognPrev =
        !!pw &&
        pw.i < i &&
        (L.cogn.has(pw.lemma) || Lo.cogn.has(pw.lemma) || !!pw.x.predic || pw.pos === 'ADJ');
      // "…не можна робити станову": an infinitive with its own direct object → complementizer
      const infK = ahead.findIndex((u) =>
        u.cands.some((c) => c.pos === 'VERB' && c.feats.form === 'inf'),
      );
      let infObj = false;
      if (infK >= 0) {
        const infT = ahead[infK];
        // intransitive / reflexive infinitive ("…мені треба більше спати"): a clause, not "what to …"
        const intr = infT.cands.some(
          (c) =>
            c.pos === 'VERB' &&
            c.feats.form === 'inf' &&
            (/(ся|сь)$/.test(c.lemma) || INTR_INF.test(c.lemma)),
        );
        let inPP = false;
        for (const u of ahead.slice(infK + 1)) {
          if (u.cands.some((c) => c.pos === 'ADP')) {
            inPP = true;
            continue;
          }
          const isN = u.cands.some(
            (c) => c.pos === 'NOUN' && (c.feats.case === 'acc' || c.feats.case === 'nom'),
          );
          if (isN && !inPP && !u.cands.some((c) => c.pos === 'VERB')) infObj = true;
          if (u.cands.some((c) => c.pos === 'NOUN')) inPP = false;
        }
        if (intr) infObj = true;
      }
      const subjPronAhead = ahead.some((u) =>
        u.cands.some((c) => c.pos === 'PRON' && !!c.x?.pron && c.feats.case === 'nom'),
      );
      if (cognPrev && !(aheadInf && !aheadFin)) {
        P('SCONJ');
        continue;
      }
      const reportPrev =
        !!pw &&
        /^(казати|сказати|говорити|сказать|говорить|писати|написати|писать|написать)$/.test(
          pw.lemma,
        );
      const predAhead = ahead.some((u) =>
        u.cands.some((c) => !!c.x?.predic && c.x.predic !== 'eval'),
      );
      if (cognPrev) {
        P(infObj || (reportPrev && predAhead) ? 'SCONJ' : 'PRON');
        continue;
      }
      if (atStart()) {
        // "Запиши, що я…", "Мені набридло, що ти…": a finite clause with its own subject after a predicate
        const predBefore =
          !!pw &&
          prev?.kind === 'p' &&
          (pw.pos === 'VERB' || pw.pos === 'AUX' || !!pw.x.predic) &&
          pw.feats.form !== 'inf';
        P(predBefore && !aheadInf && (subjPronAhead || aheadFin) ? 'SCONJ' : 'PRON');
        continue;
      }
      if (pw && pw.pos === 'NOUN' && !aheadFin) {
        P('PRON');
        continue;
      }
      P(aheadFin || (pw && (pw.pos === 'VERB' || pw.pos === 'AUX')) ? 'SCONJ' : 'PRON');
      continue;
    }
    if (w === 'як' || w === 'как') {
      if (ts[i + 1] && ts[i + 1].norm === 'тільки') {
        P('SCONJ');
        continue;
      }
      if (
        prevW &&
        (prevW.pos === 'NOUN' || prevW.pos === 'VERB') &&
        !atStart() &&
        next &&
        next.cands.some((c) => c.pos === 'NOUN') &&
        !aheadFin &&
        !aheadInf &&
        !L.cogn.has(prevW.lemma)
      ) {
        P('ADP');
        continue;
      }
      // colloquial conditional "як …, то …"
      if (atStart() && ts.slice(i + 1).some((u) => u.norm === 'то' && ts[u.i - 1]?.kind === 'p')) {
        P('SCONJ');
        continue;
      }
      P('ADV');
      continue;
    }
    if (w === 'чи') {
      P('PART');
      continue;
    }
    if (
      (w === 'й' || w === 'і') &&
      prevW &&
      prevW.pos === 'PRON' &&
      prevW.feats.case === 'nom' &&
      next &&
      (next.cands.some((c) => c.pos === 'VERB') || /^(так|ж|же|ще|теж|досі)$/.test(next.norm))
    ) {
      t.pos = 'PART';
      t.lemma = w;
      t.x = {};
      continue;
    }
    if (w === 'а' || w === 'та') {
      if (i === firstWord?.i || (prev && prev.kind === 'p' && /[.!?]/.test(prev.text))) {
        t.pos = 'INTJ';
        t.lemma = w;
        t.x = { disc: true };
        continue;
      }
      P('CONJ');
      continue;
    }
    if (w === 'так') {
      if (prev && prev.kind === 'p' && (!next || next.kind === 'p')) {
        P('INTJ');
        continue;
      }
      P('ADV');
      continue;
    }
    if (w === 'тому') {
      if (next && next.norm === 'що') {
        P('SCONJ');
        continue;
      }
      if (
        prevW &&
        (prevW.x.unit ||
          prevW.pos === 'NUM' ||
          /^(день|дні|днів|тиждень|тижні|місяць|рік|роки|років|годину|години|хвилин)$/.test(
            prevW.norm,
          ))
      ) {
        P('ADV');
        continue;
      }
      if (atStart() || (prev && prev.kind === 'p')) {
        P('CONJ');
        continue;
      }
      P('DET');
      continue;
    }
    if (w === 'то') {
      const subBefore = ts
        .slice(0, i)
        .some((u) => u.pos === 'SCONJ' || (u.x.sub && u.pos !== 'DET'));
      if (subBefore && next && next.kind === 'w') {
        P('PART');
        continue;
      }
      P('PRON');
      continue;
    }
    if (w === 'раз') {
      if (prevW && (prevW.pos === 'NUM' || prevW.x.num !== undefined)) {
        P('NOUN');
        continue;
      }
      if (
        atStart() &&
        i === (firstWord?.i ?? -1) &&
        next &&
        next.cands.some((c) => c.pos === 'PRON')
      ) {
        P('SCONJ');
        continue;
      }
      P('NOUN');
      continue;
    }
    if (w === 'все' || w === 'всё') {
      if (aheadFin || ahead.some((u) => u.cands.some((c) => c.pos === 'VERB'))) {
        P('PRON');
        continue;
      }
      P('ADV');
      continue;
    }
    if (w === 'це' || w === 'это') {
      if (
        next &&
        next.cands.some((c) => c.pos === 'NOUN') &&
        !next.cands.some((c) => c.pos === 'VERB' || c.pos === 'ADV')
      ) {
        P('DET');
        continue;
      }
      P('PRON');
      continue;
    }
    if (w === 'їм') {
      if (prevW && prevW.norm === 'я') {
        P('VERB');
        continue;
      }
      P('PRON');
      continue;
    }
    if ((w === 'скільки' || w === 'сколько') && !t.mx.wh) {
      P('ADV');
      const isCount = (n: T): boolean =>
        n.cands.some(
          (c) =>
            c.pos === 'NOUN' &&
            c.feats.case === 'gen' &&
            (!!n.mx.unit ||
              COUNTABLE.test(c.lemma) ||
              (c.feats.number === 'pl' && c.lemma !== 'вуглеводи')),
        ) ||
        (!!n.mx.unit &&
          !n.cands.some(
            (c) =>
              c.pos === 'NOUN' && c.feats.case && c.feats.case !== 'gen' && c.feats.case !== 'nom',
          ));
      const nn = ahead.find(
        (u) =>
          !u.mx.time &&
          !u.cands.some((c) => c.pos === 'PRON' || c.pos === 'VERB' || c.pos === 'ADV') &&
          u.cands.some((c) => c.pos === 'NOUN'),
      );
      const nnAfterPrep =
        nn && ts.slice(i + 1, nn.i).some((u) => u.cands.some((c) => c.pos === 'ADP'));
      if (nn && !nnAfterPrep && isCount(nn)) t.x = { ...t.x, wh: 'how_many' };
      continue;
    }
    // "зробити перерву": a 1sg verb-only reading right after an infinitive is its object noun
    if (
      prevW &&
      prevW === ts[i - 1] &&
      prevW.pos === 'VERB' &&
      prevW.feats.form === 'inf' &&
      t.cands.length &&
      t.cands.every((c) => c.pos === 'VERB' && c.feats.person === 1 && c.feats.number === 'sg')
    ) {
      choose(t, cand('NOUN', w, { case: 'acc', number: 'sg' }));
      continue;
    }
    // "к забегу", "до залу": right after a preposition a verb-only reading is a noun
    if (
      prevW &&
      prevW.pos === 'ADP' &&
      prevW === ts[i - 1] &&
      t.cands.length &&
      t.cands.every((c) => c.pos === 'VERB') &&
      !t.cands.some((c) => c.feats.form === 'inf')
    ) {
      choose(t, guessNoun(w, l));
      continue;
    }
    if (t.cands.length === 1) {
      choose(t, t.cands[0]);
      continue;
    }
    if (w === 'есть' && behind.some((u) => u.x.wh || u.x.modal || u.x.predic)) {
      P('VERB', (c) => c.feats.form === 'inf');
      continue;
    }
    // copula / future auxiliary
    if (t.cands[0].pos === 'AUX') {
      choose(t, t.cands[0]);
      if (t.x.aux === 'fut' && !aheadInf) t.x = { ...t.x, aux: undefined };
      continue;
    }
    // predicative vs adverb: keep ADV (predic flag decided in parsing)
    {
      const infC = t.cands.find((c) => c.pos === 'VERB' && c.feats.form === 'inf');
      if (
        infC &&
        behind.some(
          (u) =>
            u.x.modal ||
            u.x.aux === 'fut' ||
            u.x.predic ||
            /^(хотіти|могти|хотеть|мочь|бути|быть)$/.test(u.lemma),
        )
      ) {
        choose(t, infC);
        continue;
      }
    }
    if (has('VERB') && has('ADJ') && prevW && prevW.pos === 'NOUN' && prevW.feats.case === 'nom') {
      const a = t.cands.find(
        (c) => c.pos === 'ADJ' && (!c.feats.number || c.feats.number === prevW.feats.number),
      );
      if (a) {
        choose(t, a);
        continue;
      }
    }
    if (has('VERB') && has('NOUN')) {
      const nb = [ts[i + 1], ts[i - 1]].find((u) => u && /^(чи|або|или)$/.test(u.norm));
      const other = nb && ts[nb.i + (nb.i > i ? 1 : -1)];
      if (
        other &&
        other.cands.some((c) => c.pos === 'NOUN') &&
        !other.cands.some((c) => c.pos === 'VERB')
      ) {
        P('NOUN');
        continue;
      }
    }
    if (has('VERB') && (has('NOUN') || has('ADJ') || has('ADV'))) {
      const otherFin = [...behind, ...ahead].some(
        (u) =>
          u !== t &&
          u.cands.length > 0 &&
          u.cands.every((c) => c.pos === 'VERB' || c.pos === 'AUX' || c.pos === 'PART') &&
          u.cands.some((c) => c.pos === 'VERB' || c.pos === 'AUX'),
      );
      const impC = t.cands.find((c) => c.pos === 'VERB' && c.feats.form === 'imp');
      if (impC && atStart() && !otherFin) {
        choose(t, impC);
        continue;
      }
      const prevNonAdj =
        prevW &&
        (prevW.pos === 'ADJ' || prevW.pos === 'DET' || prevW.pos === 'ADP' || prevW.pos === 'NUM');
      if (prevNonAdj && (has('NOUN') || has('ADJ'))) {
        P(has('NOUN') ? 'NOUN' : 'ADJ');
        continue;
      }
      if (otherFin && (has('NOUN') || has('ADV') || has('ADJ'))) {
        P(has('ADV') ? 'ADV' : has('NOUN') ? 'NOUN' : 'ADJ');
        continue;
      }
      if (has('ADV') && t.cands.find((c) => c.pos === 'ADV')?.x?.sem !== 'manner') {
        P('ADV');
        continue;
      }
      P('VERB');
      continue;
    }
    if (has('VERB')) {
      // infinitive vs finite ("робить", "качать") after modal / predicative / wh-word
      const infC = t.cands.find((c) => c.pos === 'VERB' && c.feats.form === 'inf');
      const finC = t.cands.find((c) => c.pos === 'VERB' && c.feats.form !== 'inf');
      if (infC && finC) {
        const modalBefore = behind.some(
          (u) =>
            u.x.modal ||
            u.x.predic ||
            u.x.aux === 'fut' ||
            (u.x.wh && u.x.wh !== 'why' && u.x.wh !== 'who') ||
            u.lemma === 'хотіти' ||
            u.lemma === 'хотеть',
        );
        const nb = [ts[i + 1], prevW].find(
          (u) =>
            u &&
            u.cands.some(
              (c) =>
                c.pos === 'NOUN' &&
                c.feats.case === 'nom' &&
                (!c.feats.number || c.feats.number === finC.feats.number),
            ),
        );
        choose(t, modalBefore && !nb ? infC : finC);
        continue;
      }
      // perfective present vs imperative etc: prefer finite
      const fc = t.cands.find((c) => c.pos === 'VERB' && c.feats.form === 'fin');
      const ic = t.cands.find((c) => c.pos === 'VERB' && c.feats.form === 'imp');
      if (ic && atStart() && (!fc || !behind.some((u) => u.x.pron))) {
        choose(t, ic);
        continue;
      }
      choose(t, fc ?? t.cands[0]);
      continue;
    }
    if (has('ADJ') && has('NOUN')) {
      const n = next && next.cands.find((c) => c.pos === 'NOUN');
      if (n && next.kind === 'w') {
        P('ADJ');
        continue;
      }
      P('NOUN');
      continue;
    }
    if (has('DET') && has('PRON')) {
      if (next && next.cands.some((c) => c.pos === 'NOUN' || c.pos === 'ADJ')) {
        P('DET');
        continue;
      }
      P('PRON');
      continue;
    }
    if (has('ADV') && has('ADJ')) {
      if (
        next &&
        next.cands.some((c) => c.pos === 'NOUN') &&
        t.cands.some((c) => c.pos === 'ADJ' && c.feats.gender === 'n')
      ) {
        P('ADJ');
        continue;
      }
      P('ADV');
      continue;
    }
    choose(t, t.cands[0]);
  }
  // modal / hortative / aux flags on verbs
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.pos !== 'VERB' && t.pos !== 'AUX') continue;
    const m = MODAL[t.lemma];
    const hasInf =
      ts.slice(i + 1, i + 5).some((u) => u.pos === 'VERB' && u.feats.form === 'inf') ||
      ts.slice(Math.max(0, i - 3), i).some((u) => u.pos === 'VERB' && u.feats.form === 'inf');
    if (m && hasInf) t.x = { ...t.x, modal: m };
    if (t.lemma === 'мати' && hasInf) t.x = { ...t.x, modal: 'must' };
    if (
      (t.lemma === 'бути' || t.lemma === 'быть') &&
      t.feats.tense === 'future' &&
      ts.slice(i + 1, i + 4).some((u) => u.pos === 'VERB' && u.feats.form === 'inf')
    )
      t.x = { ...t.x, aux: 'fut' };
    if (/^(хотітися|здаватися|хотеться|казаться|вдаватися)$/.test(t.lemma))
      t.x = { ...t.x, impers: true };
    if (L.cogn.has(t.lemma) || Lo.cogn.has(t.lemma)) t.x = { ...t.x };
  }
  // hortative "давай зробимо"
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.x.hort) {
      const nv = ts.slice(i + 1).find((u) => u.pos === 'VERB');
      if (!nv) {
        t.x = { ...t.x, hort: false };
        t.feats.form = 'imp';
      }
    }
  }
}

/** Intransitive infinitives: after "що" they make a complement clause, not "what to …". */
const INTR_INF =
  /^(спати|бігати|бігти|ходити|йти|іти|їхати|сидіти|стояти|лежати|відпочивати|відпочити|жити|плавати|гуляти|прокидатися|спать|бегать|ходить|идти|ехать|сидеть|стоять|лежать|отдыхать|жить|плавать|гулять)$/;

const MODAL: Record<string, Modality> = {
  могти: 'can',
  змогти: 'can',
  мочь: 'can',
  смочь: 'can',
  вміти: 'can',
  уметь: 'can',
  хотіти: 'want',
  хотеть: 'want',
  захотіти: 'want',
  хотітися: 'want',
  хотеться: 'want',
  бажати: 'want',
  мусити: 'must',
};

function nomCapable(t: T): boolean {
  if (t.pos === 'PRON') return !t.feats.case || t.feats.case === 'nom';
  if (t.pos === 'NOUN')
    return (
      !t.feats.case ||
      t.feats.case === 'nom' ||
      t.cands.some((c) => c.pos === 'NOUN' && c.feats.case === 'nom')
    );
  if (t.pos === 'ADJ') return !t.feats.case || t.feats.case === 'nom';
  return false;
}

/** Is this Cyrillic word known to the lexicon / morphology (for transliteration variants)? */
const knownMemo = { uk: memo((w) => knownRaw(w, 'uk')), ru: memo((w) => knownRaw(w, 'ru')) };
export function knownWord(w: string, l: SL): boolean {
  return knownMemo[l](w);
}
function knownRaw(w: string, l: SL): boolean {
  const L = lex(l);
  return (
    L.closed.has(w) ||
    L.nouns.has(w) ||
    L.adv.has(w) ||
    L.irr.has(w) ||
    numWord(l, w) !== undefined ||
    verbCands(w, l, L).length > 0 ||
    nounCands(w, l, L).length > 0 ||
    adjCands(w, l, L).length > 0
  );
}

/** All lexicon entries (for the transliteration skeleton index). */
export function lexWords(l: SL): string[] {
  const L = lex(l);
  return [...L.closed.keys(), ...L.irr.keys(), ...L.verbs, ...L.nouns, ...L.adj, ...L.adv];
}

const anMemo = { uk: memo((w) => analyze(w, 'uk')), ru: memo((w) => analyze(w, 'ru')) };

function mkSpec(l: SL): LangSpec {
  return {
    lang: l as Lang,
    prodrop: true,
    analyze: (w) => anMemo[l](w),
    mwe: l === 'uk' ? [...UK_MWE, ...RU_MWE] : [...RU_MWE, ...UK_MWE],
    disambig: (ts) => disambig(ts, l),
    nomCapable,
    cogn: (t) => lex('uk').cogn.has(t.lemma) || lex('ru').cogn.has(t.lemma),
  };
}

export const UK = mkSpec('uk');
export const RU = mkSpec('ru');
export type { WhWord };
