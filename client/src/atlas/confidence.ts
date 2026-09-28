/**
 * How sure Atlas is that it understood a message (0..1). Every answer carries
 * it; below CONFIDENT the app may ask a bigger model instead of showing a
 * template that might be about something else.
 *
 * Rule-made answers (safety, a pain check-in, maths, "I ran 5k"…) get the
 * share of right answers that route shows on the evaluation corpus
 * (eval/corpus.ts). A topic picked from keywords + examples gets a logistic
 * score over what backs the pick: is it the examples' first choice, by how
 * much, do its keywords match, how much of the message the topic accounts
 * for, and what the grammar read (understand.ts: a language the examples know
 * less, a focus clause, clauses, a denial, a condition, a report, a request).
 * Fitted on the corpus (held-out quarter excluded). Over it, an agreement
 * rule: when keywords and examples point different ways, or the examples lead
 * by a hair, the answer is never "sure" — so a near-miss goes to the bigger
 * model instead of showing the wrong template. And a clear-lead rule: the
 * examples' first choice, well ahead of the nearest real rival and covering
 * the message, is sure even without keywords (app help and most of the newer
 * topics have none). A rival is "real" only if it could answer this message
 * (its lift / muscle named, a command asked for, the app named) and is not the
 * picked topic's broader parent or twin (topicFamily.ts).
 */
import { groupMatches, matchedWords, normalize, tokens } from './nlu';
import { coverage, retrieve, terms } from './retrieve';
import type { Intent } from './intentKit';
import { isStatement } from './qtype';
import { understand } from './understand';
import { kin, twins } from './topicFamily';

/** A specific topic this close behind its broader parent still leads (the parent says less). */
const KIN_TIE = 0.06;

/** How an answer was reached. */
export type Route =
  | 'safety'
  | 'pain'
  | 'flow'
  | 'activity'
  | 'complaint'
  | 'live'
  | 'calc'
  | 'offtopic'
  | 'compose'
  | 'around'
  | 'queryFollow'
  | 'follow'
  | 'stall'
  | 'avoid'
  | 'bump'
  | 'lifted'
  | 'query'
  | 'main'
  | 'taught'
  | 'needLift'
  | 'dym'
  | 'memo'
  | 'nudge'
  | 'ack'
  | 'rule'
  | 'onboarding'
  | 'emoji';

/**
 * Which rule of the router put a topic first (intents.ts answerOne): the
 * keyword ranking, the examples, a sharper sibling, a narrow topic's own word,
 * a whole-message chat word, a why-topic for a why-question, a ready command,
 * the examples overruling the keywords, your-log / advice reorderings…
 */
export type PickRule =
  | 'keywords'
  | 'examples'
  | 'specialize'
  | 'narrow'
  | 'chat'
  | 'status'
  | 'tie'
  | 'why'
  | 'command'
  | 'veto'
  | 'pastLog'
  | 'advice';

/** Share of right answers per route on the corpus (small routes: a cautious prior). */
const ROUTE: Record<Route, number> = {
  safety: 0.97,
  pain: 0.92,
  flow: 0.9,
  activity: 0.93,
  complaint: 0.88,
  live: 0.9,
  calc: 0.9,
  offtopic: 0.85,
  compose: 0.86,
  around: 0.82,
  queryFollow: 0.8,
  follow: 0.85,
  stall: 0.9,
  avoid: 0.88,
  bump: 0.92,
  lifted: 0.85,
  query: 0.8,
  main: 0.7,
  taught: 0.95,
  // A question back ("which lift?"), not an answer — below CONFIDENT.
  needLift: 0.72,
  dym: 0.2,
  memo: 0.8,
  nudge: 0.3,
  ack: 0.9,
  rule: 0.9,
  onboarding: 0.85,
  emoji: 0.9,
};

export function routeConfidence(r: Route): number {
  return ROUTE[r];
}

/** What backs a topic picked for a message. */
export interface Features {
  /** The examples' first choice. */
  top: number;
  /** Its example score (0..1). */
  ret: number;
  /** Lead over the next topic (negative when another scores higher). */
  margin: number;
  /** Closeness to its single nearest phrasing (0..1). */
  ex: number;
  /** All its keyword groups match. */
  kw: number;
  /** Words its keywords account for. */
  mw: number;
  /** Another topic's keywords match fully while this one's don't. */
  kwOther: number;
  /** Share of the message the topic accounts for. */
  cov: number;
  /** Meaningful words in the message. */
  terms: number;
  /** A "not / не / без" in the message. */
  neg: number;
  /** Told, not asked ("I benched 100 today"). */
  told: number;
  /** An app-help topic for a message that names neither the app nor a how / where. */
  appNoCue: number;
  /** Its only words are ones that name nothing ("thing", "stuff", "щось"). */
  vague: number;
  // ---- what the grammar read (understand.ts) ----
  /** Polish, Lithuanian or Estonian — the examples know them less well. */
  gOther: number;
  /** The question lives in a part of the message (after "but", a kept alternative…). */
  gFocus: number;
  /** Clauses beyond the first (0..3). */
  gClauses: number;
  /** The main clause is negated. */
  gNeg: number;
  /** A condition frames it ("if my knee hurts, …"). */
  gCond: number;
  /** The user reports something done (past tense, first person). */
  gReport: number;
  /** It asks (a question or a request put as one). */
  gAsk: number;
}

const NEGATION =
  /(^| )(not|no|never|dont|doesnt|isnt|cant|wont|didnt|не|ні|нема|немає|нет|без)( |$)/u;

export function features(
  question: string,
  it: Intent | undefined,
  all: Intent[] = [],
  /** Could this topic answer the message at all (its lift / muscle / window named)? */
  able: (id: string) => boolean = () => true,
): Features {
  const words = tokens(question);
  const phrase = normalize(question);
  // Topics that can't answer this message (no lift named for a lift topic…) are no rivals.
  const hits = retrieve(question, 25).filter((h) => h.id === it?.id || able(h.id));
  const id = it?.id;
  const hit = hits.find((h) => h.id === id);
  const mine = hit?.score ?? 0;
  // A broader parent or a same-question twin is no rival (topicFamily.ts):
  // the lead is measured against the nearest topic that means something else.
  const other = hits.find((h) => h.id !== id && !kin(id, h.id))?.score ?? 0;
  const first = hits[0];
  const meaningful = terms(question).filter((t) => t !== '~you' && t !== '~me');
  const full = (x: Intent) =>
    x.all.length > 0 &&
    (!x.maxWords || words.length <= x.maxWords) &&
    x.all.every((g) => groupMatches(words, phrase, g));
  const kw = !!it && full(it);
  return {
    top:
      !!id &&
      !!first &&
      (first.id === id ||
        twins(id, first.id) ||
        (kin(id, first.id) && mine >= first.score - KIN_TIE))
        ? 1
        : 0,
    ret: mine,
    margin: mine - other,
    ex: hit?.example ?? 0,
    kw: kw ? 1 : 0,
    mw: kw && it ? matchedWords(words, it.all) : 0,
    kwOther: !kw && all.some((x) => x.id !== id && full(x)) ? 1 : 0,
    cov: id ? coverage(question, id) : 0,
    terms: new Set(meaningful).size,
    neg: NEGATION.test(` ${phrase} `) ? 1 : 0,
    told: isStatement(question) ? 1 : 0,
    appNoCue: !!id && id.startsWith('app_') && !APP_CUE.test(phrase) ? 1 : 0,
    vague: meaningful.length > 0 && meaningful.every((t) => VAGUE.test(t)) ? 1 : 0,
    ...grammarFeatures(question),
  };
}

function grammarFeatures(
  question: string,
): Pick<Features, 'gOther' | 'gFocus' | 'gClauses' | 'gNeg' | 'gCond' | 'gReport' | 'gAsk'> {
  const g = understand(question);
  return {
    gOther: g.lang === 'pl' || g.lang === 'lt' || g.lang === 'et' ? 1 : 0,
    gFocus: g.focus ? 1 : 0,
    gClauses: Math.min(3, Math.max(0, g.clauses - 1)),
    gNeg: g.negated ? 1 : 0,
    gCond: g.conditional ? 1 : 0,
    gReport: g.report ? 1 : 0,
    gAsk: g.question || g.command ? 1 : 0,
  };
}

/**
 * Logistic weights over the features, fitted on the corpus's main-route
 * answers (eval/, held-out quarter excluded). The bias is shifted so that
 * CONFIDENT (0.75) sits where the fitted probability is 0.9 — "at or above
 * CONFIDENT" means "almost always right", not "3 in 4". `oneNoKw` is a prior
 * set by hand (a single word that is no topic's keyword is a guess, however
 * well one example matches it: "banana").
 */
export const WEIGHTS = {
  bias: 0.075,
  top: -0.316,
  ret: 0.854,
  margin: 1.612,
  ex: 0.755,
  kw: 0.747,
  mw: 0.591,
  kwOther: -0.898,
  cov: 0.675,
  neg: -1.12,
  told: -0.443,
  /** Picked by keywords against the examples' first choice. */
  kwOnly: -1.486,
  /** How far the example score falls short of 0.4. */
  weakRet: 0.546,
  /** How far the coverage falls short of 0.6. */
  lowCov: 0.267,
  /** A one-word message that names no topic keyword ("banana"). */
  oneNoKw: -2,
  /** A long, rambling message (8+ meaningful words). */
  long: -0.936,
  // What the grammar read (understand.ts) — fitted on top of the weights above
  // on the five-language exam (held-out quarter excluded), with the bias
  // shifted so that no training answer at or above CONFIDENT is wrong.
  gOther: 0.24,
  gFocus: 0.505,
  gClauses: 0.114,
  gNeg: 0.361,
  gCond: -0.522,
  gReport: 0.241,
  gAsk: 0.034,
  gShift: -0.15,
};

/**
 * Below this lead over the next topic, a pick the keywords don't back is a
 * coin toss between near neighbours ("magnesium" vs "electrolytes").
 */
export const CLEAR_LEAD = 0.08;

export function topicConfidence(f: Features, pick?: PickRule, final = false): number {
  void pick;
  const one = f.terms <= 1 ? 1 : 0;
  const z =
    WEIGHTS.bias +
    WEIGHTS.top * f.top +
    WEIGHTS.ret * f.ret +
    WEIGHTS.margin * f.margin +
    WEIGHTS.ex * f.ex +
    WEIGHTS.kw * f.kw +
    WEIGHTS.mw * Math.min(f.mw, 4) +
    WEIGHTS.kwOther * f.kwOther +
    WEIGHTS.cov * f.cov +
    WEIGHTS.neg * f.neg +
    WEIGHTS.told * f.told +
    WEIGHTS.kwOnly * f.kw * (1 - f.top) +
    WEIGHTS.weakRet * Math.max(0, 0.4 - f.ret) +
    WEIGHTS.lowCov * Math.max(0, 0.6 - f.cov) +
    WEIGHTS.oneNoKw * one * (1 - f.kw) +
    WEIGHTS.long * (f.terms >= 8 ? 1 : 0) +
    WEIGHTS.gOther * f.gOther +
    WEIGHTS.gFocus * f.gFocus +
    WEIGHTS.gClauses * f.gClauses +
    WEIGHTS.gNeg * f.gNeg +
    WEIGHTS.gCond * f.gCond +
    WEIGHTS.gReport * f.gReport +
    WEIGHTS.gAsk * f.gAsk +
    WEIGHTS.gShift;
  const p0 = 1 / (1 + Math.exp(-z));
  // A clear lead: the examples' first choice, well ahead of the nearest real
  // rival, close to its phrasings and accounting for the whole message, with
  // no "not" and no "if" to twist it — sure, whatever the keywords say (many
  // topics have no keywords at all: the app help, the hundred newer ones).
  // (Only on the message as the user wrote it, when its answer is settled —
  // choosing between readings of it goes by the fitted score alone.)
  const clear =
    final &&
    f.top === 1 &&
    f.margin >= CLEAR_MARGIN &&
    f.ret >= CLEAR_RET &&
    f.cov >= CLEAR_COV &&
    // A "not" may turn the question around — unless the examples say it too, closely.
    ((f.neg === 0 && f.gNeg === 0) || (f.ret >= CLEAR_NEG_RET && f.margin >= CLEAR_NEG_MARGIN)) &&
    f.gCond === 0 &&
    // "the thing with the stuff" — words that name nothing.
    f.vague === 0 &&
    // One word is clear only as the topic's keyword, or when it belongs to one
    // topic alone ("przepraszam", "dobranoc") — "banana" is neither.
    (f.terms >= 2 || f.kw === 1 || f.margin >= CLEAR_ONE_MARGIN) &&
    // App help with no word of the app and no "how / where" in it
    // ("kas teha superseeriaid" asks about training) — only a near-verbatim match.
    (f.appNoCue === 0 || f.ret >= CLEAR_APP_RET);
  const p = clear ? Math.max(p0, CLEAR_SURE) : p0;
  // Agreement: keywords picked against the examples' first choice, or the
  // examples alone lead by a hair — never "sure", whatever the rest says.
  const split = f.top === 0 || (f.kw === 0 && f.margin < CLEAR_LEAD);
  return split ? Math.min(p, CONFIDENT_CAP) : p;
}

/**
 * The clear-lead band (see topicConfidence), set on the exam's training rows
 * (held-out quarter and blind sets excluded): at these bars no training
 * answer is wrong.
 */
const CLEAR_MARGIN = 0.08;
const CLEAR_RET = 0.45;
const CLEAR_COV = 0.7;
const CLEAR_NEG_RET = 0.6;
const CLEAR_NEG_MARGIN = 0.15;
const CLEAR_ONE_MARGIN = 0.3;
/** Above CONFIDENT (0.75), with room for the small discounts of a detour reading. */
const CLEAR_SURE = 0.8;
const CLEAR_APP_RET = 0.65;
/** Words that name nothing (stems as retrieve.terms gives them). */
const VAGUE =
  /^(thing|stuff|someth|anyth|whatev|штук|щос|шос|щот|чтот|что-т|штуч|cos|coś|kazk|kažk|midag|asi|asja)/u;

/** Does the message name the app or ask how / where (see APP_CUE)? */
export function appCue(question: string): boolean {
  return APP_CUE.test(normalize(question));
}

/** The app named, or a how-to / where-is question (en, uk, ru, pl, lt, et; folded). */
const APP_CUE =
  /(^|\s)(app\S*|spotter\S*|спотер\S*|додат\S*|застосун\S*|апк\S*|апці|приложен\S*|aplikac\S*|apk\S*|apce|programel\S*|rakendus\S*|äpp\S*|äpi\S*|how (do|can|should|would) (i|you|we)|how to|where|як|де|как|где|jak|gdzie|kaip|kur|kuidas|kus)(\s|$)/u;

/** Just under CONFIDENT (intents.ts): a guess the app may hand to a bigger model. */
const CONFIDENT_CAP = 0.74;
