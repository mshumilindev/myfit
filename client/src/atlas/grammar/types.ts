/** Public types of the Atlas grammar analyser. */

export type Lang = 'en' | 'uk' | 'ru' | 'pl' | 'lt' | 'et';

export type Pos =
  | 'NOUN'
  | 'VERB'
  | 'AUX'
  | 'ADJ'
  | 'ADV'
  | 'PRON'
  | 'DET'
  | 'ADP'
  | 'CONJ'
  | 'SCONJ'
  | 'PART'
  | 'NUM'
  | 'INTJ'
  | 'PUNCT'
  | 'X';

export type Dep =
  | 'nsubj'
  | 'root'
  | 'obj'
  | 'obl'
  | 'advmod'
  | 'amod'
  | 'aux'
  | 'neg'
  | 'mark'
  | 'cc'
  | 'nummod'
  | 'det'
  | 'case'
  | 'conj'
  | 'compound';

export type Tense = 'past' | 'present' | 'future';
export type Case = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'loc' | 'voc';

export interface Feats {
  tense?: Tense;
  person?: 1 | 2 | 3;
  number?: 'sg' | 'pl';
  gender?: 'm' | 'f' | 'n';
  case?: Case;
  aspect?: 'perfective' | 'imperfective';
  degree?: 'pos' | 'cmp' | 'sup';
  /** fin = finite, inf = infinitive, part = participle, ger = gerund / converb, imp = imperative, pred = predicative word */
  form?: 'fin' | 'inf' | 'part' | 'ger' | 'imp' | 'pred';
  /** Morphological negation (Lithuanian ne-, Estonian ei + stem). */
  neg?: boolean;
  /** Conditional mood marker on the verb itself (Estonian -ks-, Lithuanian -čiau). */
  cond?: boolean;
}

export interface Token {
  text: string;
  norm: string;
  lemma: string;
  pos: Pos;
  feats: Feats;
  dep?: Dep;
  /** Index (within the sentence) of the head token. */
  head?: number;
  /** Character offset in the original text. */
  start: number;
}

export type AdverbialSem = 'time' | 'place' | 'manner' | 'duration' | 'frequency' | 'degree';

export interface Phrase {
  text: string;
  /** Head lemma. */
  lemma: string;
  /** Sentence token indices. */
  tokens: number[];
  sem?: AdverbialSem;
}

export type ClauseKind =
  | 'conditional'
  | 'causal'
  | 'temporal'
  | 'concessive'
  | 'purpose'
  | 'relative'
  | 'complement'
  | 'result'
  | 'comparison';

export type Mood = 'indicative' | 'imperative' | 'conditional' | 'subjunctive' | 'interrogative';
export type Modality = 'can' | 'should' | 'must' | 'want' | 'need' | 'may';

export interface Clause {
  text: string;
  role: 'main' | 'subordinate' | 'coordinate';
  kind?: ClauseKind;
  connector?: string;
  tokens: Token[];
  /** Sentence token indices of `tokens` (a clause may be discontinuous). */
  tokenIdx: number[];
  subject?: Phrase;
  predicate?: Phrase;
  objects: Phrase[];
  adverbials: Phrase[];
  tense: Tense | 'none';
  aspect?: 'perfective' | 'imperfective' | 'progressive' | 'perfect';
  mood: Mood;
  modality?: Modality;
  negated: boolean;
  person?: 1 | 2 | 3;
  number?: 'sg' | 'pl';
  subjectIsUser: boolean;
  subjectIsAtlas: boolean;
  /** Interrogative clause (wh-, inversion, particle or '?'). */
  interrogative: boolean;
  whWord?: WhWord;
}

export type WhWord =
  | 'why'
  | 'how'
  | 'what'
  | 'when'
  | 'where'
  | 'which'
  | 'who'
  | 'how_much'
  | 'how_many'
  | 'how_long'
  | 'how_often';

export type SentenceType = 'question' | 'statement' | 'command' | 'exclamation';
export type QuestionKind = 'yesno' | 'wh' | 'choice' | 'tag' | 'rhetorical';

export interface Sentence {
  text: string;
  type: SentenceType;
  questionKind?: QuestionKind;
  whWord?: WhWord;
  clauses: Clause[];
  /** Index of the main clause in `clauses`. */
  mainClause: number;
  /** Index of the clause that carries the question, when the sentence asks one. */
  questionClause?: number;
  tokens: Token[];
}

export interface Analysis {
  lang: Lang;
  /** Latin transliteration of Ukrainian / Russian was detected and converted. */
  translit?: boolean;
  sentences: Sentence[];
}

export type Unit =
  | 'kg'
  | 'lb'
  | 'rep'
  | 'set'
  | 'min'
  | 'h'
  | 'sec'
  | 'km'
  | 'm'
  | 'mi'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | '%'
  | 'kcal'
  | 'g'
  | 'l'
  | 'step'
  | 'time'
  | 'session'
  | 'bpm';

export interface Quantity {
  value: number;
  unit: Unit;
  /** Source text of the quantity. */
  text: string;
  sentence: number;
}

export interface Focus {
  askedAbout: string[];
  action?: string;
  isReportAboutSelf: boolean;
  isComplaint: boolean;
  isRequestForHelp: boolean;
  isQuestion: boolean;
  whWord?: WhWord;
  timeRef?: string;
  timeRefs: string[];
  quantities: Quantity[];
  conditionals: { if: Clause; then: Clause }[];
  negated: boolean;
}
