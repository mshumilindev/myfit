/**
 * Atlas's own answer base — the first responder in chat. Each intent is a set
 * of keyword groups (all must match, typo-tolerant, en + uk) and an answer
 * built from YOUR data (history, plan, readiness, sleep). Only when nothing
 * here fits does the question go to Gemini. More intents: intentsMore.ts.
 */
import { setTypeOf } from '../store';
import { nextTarget, topHistory } from '../progression';
import {
  findCatalogExercise,
  findExercise,
  findExercises,
  expandSlang,
  findMuscle,
  groupMatches,
  hasCyrillic,
  matchedWords,
  negated,
  normalize,
  wordMatches,
  tokens,
  translitToRu,
  translitToUk,
} from './nlu';
import { DEPTH, DEFAULT_NEXT } from './depth';
import { INTENTS_FOURTH } from './intentsFourth';
import { CHARTS, INTENTS_FIFTH } from './intentsFifth';
import { INTENTS_SIXTH, MORES } from './intentsSixth';
import { INTENTS_NEW } from './intentsNew';
import { INTENTS_APP } from './appTopics';
import { INTENTS_EXTRA } from './intentsExtra';
import { asksIfOk, INTENTS_HEALTH, limitsOf } from './intentsHealth';
import { appChipsFor, INTENTS_APP_MORE, withAppTips } from './appTips';
import { emojiReply, INTENTS_SMALL, SMALLTALK_IDS, SMALL_OVERRIDES } from './smalltalk';
import { parseRange, parseWeekdays } from './when';
import { SORE_CAP } from './memoryPlan';
import { isLiftStatus, nameHits, resolveCatalogLift, resolveMyLift } from './liftNames';
import { taughtFor, teach, wrongFor } from './teach';
import { styled, unsureLine } from './style';
import { aboutSomeoneElse, safetyReply, safetySignal } from './safety';
import { liveAnswer } from './live';
import {
  appCue,
  features,
  type Features,
  routeConfidence,
  topicConfidence,
  type PickRule,
  type Route,
} from './confidence';
import { activityAnswer, activityReport, isComplaint } from './activityReport';
import { parseFrame, type Frame } from './frame';
import { compareAnswer, programAnswer, variantOf, whatIfDays } from './compose';
import { calcAnswer, offTopic, offTopicLine } from './calc';
import {
  continueFlow,
  findStart,
  painNow,
  painStart,
  startFind,
  startPain,
  type Flow,
  type FlowReply,
} from './flows';
import { topicalChips } from './chips';
import { insights, TIP_EVERY } from './insights';
import { hashId } from './voice';
import { aboutMyLog, followQuery, parseQuery, queryChips, runQuery, type Query } from './query';
import { explainLift } from './liftStats';
import { ASKS } from './asks';
import type { Facet } from './kb/types';
import { facetsOf, setFacets } from './facetStore';
import {
  coverage,
  indexReady,
  retrieve,
  setIndex,
  loadKb,
  terms,
  type RetrievalIndex,
} from './retrieve';
import { FACET_CHIP, isPersonal, isStatement, questionType } from './qtype';
import {
  antecedent,
  bareAsk,
  bareFollow,
  resolveAnaphor,
  understand,
  type Understanding,
} from './understand';
import { toKnownLanguage } from './lexicon';
import { detectLang } from './langOffer';
import {
  consistent,
  learn,
  mergeMemory,
  PART_NAME,
  saidKey,
  soreFor,
  type AtlasMemory,
  type SaidRec,
} from './memory';
import { BUILT_IN_CATALOG, richExerciseByName } from '../data/exercises';
import type { MuscleGroup } from '../data/exercises';
import {
  finishedOf,
  loggedLifts,
  type AskCtx,
  type AtlasAction,
  type Chart,
  type Intent,
  type Parsed,
  type Tr,
} from './intentKit';
import { INTENTS_MORE } from './intentsMore';
import { INTENTS_THIRD } from './intentsThird';
import { PAIN_WORDS, INTENTS } from './intentsBase';
import {
  OFF_FRIENDLY,
  PAIN_TOPICS,
  LIFTED_RE,
  STALL_RE,
  REQUEST_RE,
  SPLIT_RE,
  BUMP_RE,
  AVOID_RE,
  CONNECTOR_RE,
  OTHER_LATIN,
  EN_COMMON,
  NO_PAIN_CLAUSE,
  CONTINUER_RE,
  NO_RE,
  ACK_RE,
  ACK_LINE,
  DATA_CHIP,
  MY_DATA,
} from './routeWords';

export { PAIN_WORDS, INTENTS } from './intentsBase';
export type { AskCtx } from './intentKit';

const SMALL_NEW = new Set(INTENTS_SMALL.map((i) => i.id));

export interface LocalAnswer {
  intent: string;
  text: string;
  /** Follow-up questions to offer as chips. */
  chips?: string[];
  /** The base has nothing deeper — hand the thread to Gemini if allowed. */
  escalate?: boolean;
  /** Conversation state to carry into the next message. */
  convo: Convo;
  /** A chart to draw under the text. */
  chart?: Chart;
  /** Something to do — shown as Confirm / Cancel. */
  action?: AtlasAction;
  /** New facts to remember (merge into coach.memory). */
  learned?: AtlasMemory;
  /** The answer to remember for consistency. */
  said?: SaidRec;
  /**
   * How sure Atlas is that it understood the message (0..1). At CONFIDENT or
   * above the answer is almost always on the right topic; below it the app
   * may ask a bigger model instead (see confidence.ts).
   */
  confidence: number;
}

/**
 * From this confidence up an answer is trusted as is: on the evaluation corpus
 * (eval/corpus.ts, 2,521 messages in five languages) and both blind sets every
 * answer at or above it is on the right topic, covering ~89% of messages.
 * Below it the app may hand the message to a bigger model.
 */
export const CONFIDENT = 0.75;

/** An answer being put together: how it was reached, confidence not settled yet. */
type Draft = Omit<LocalAnswer, 'confidence'> & {
  confidence?: number;
  /**
   * The confidence without the clear-lead floor — what choosing between two
   * readings of one message goes by (the floor only settles the answer).
   */
  rank?: number;
  route?: Route;
  /** Which routing rule put a topic first (see answerOne) — weighed by the confidence. */
  pick?: PickRule;
};
/** Mark how a draft was reached (a route set deeper in stays). */
function tag(a: Draft | null, route: Route): Draft | null {
  return a && { ...a, route: a.route ?? route };
}

/** What the conversation is about right now (for follow-ups). */
export interface Convo {
  intent?: string;
  exercise?: string | null;
  muscle?: MuscleGroup | null;
  /** How many "more" layers of this topic were already told. */
  depth?: number;
  /** A question waiting for a lift/muscle ("Which lift?"). */
  pending?: boolean;
  /** How many answers so far (rotates the phrasing). */
  turn?: number;
  /** The question that opened this topic ("my knee hurts") — for follow-ups. */
  q?: string;
  /** Sides of the topic already told (why / how / when…). */
  told?: Facet[];
  /** The last computed question about your log — for "and in July?". */
  query?: Query;
  /** "By the way…" notes already told in this conversation, and when. */
  tips?: string[];
  tipTurn?: number;
  /** How many app tips were told in this conversation ("more tips" goes on from here). */
  appTips?: number;
  /** A guided conversation in progress (pain check-in, finding an exercise). */
  flow?: Flow;
  /** After a hard moment Atlas stays plain (no jokes, no roasting) until this turn. */
  softUntil?: number;
  /** The last answer had a joke (never two in a row). */
  joked?: boolean;
  /** "Did you mean…" was offered for this wording — the pick teaches Atlas. */
  pendingTeach?: { q: string; offered: string[] };
  /** The last plan's pieces — "and 4 days?" changes one of them. */
  frame?: Frame;
  /** Two lifts just compared — for "so which one is better for me?". */
  pair?: [string, string];
  /** Earlier topics, newest first — "and for squat?" can reach back past a detour. */
  prev?: { intent: string; exercise?: string | null; muscle?: MuscleGroup | null; q?: string }[];
}

/** Topics written for one particular pair of lifts. */
const PAIR_TOPICS = new Set([
  'squat_vs_press',
  'incline_flat',
  'k_sumo_conventional',
  'compound_isolation',
  'machines_free',
]);

/** A split named: "push pull legs", "upper lower", "фулбаді"… and its usual days a week. */
const SPLIT_NAME =
  /push pull legs|\bppl\b|upper lower|full ?body|bro split|пуш пул легс|пуш-пул|верх[ -]низ|фул ?баді|фулбоді|фулбади/u;
const SPLIT_DAYS: Record<string, number> = {
  'upper lower': 4,
  'верх низ': 4,
  'верх-низ': 4,
  'bro split': 5,
};

/** The words a pair topic is about — without them it's another pair. */
const PAIR_NAMED: Record<string, RegExp> = {
  squat_vs_press: /leg press|жим ногами|жим ног|ногами/u,
  incline_flat: /inclin|похил|наклон|decline|горизонт|flat/u,
  k_sumo_conventional: /sumo|сумо/u,
  compound_isolation: /compound|isolat|базов|ізолю|изоли|багатосугл/u,
  machines_free: /machine|тренажер|free weight|вільн|свободн|smith|сміт/u,
};

/** A retrieval score this high means a topic was written for the very question. */
const OWN_TOPIC = 0.6;
/** Topics a comparison of two lifts may beat. */
const COMPARE_OK = new Set([
  'compare_lifts',
  'exercise_muscles',
  'act_swap',
  'technique_lift',
  'technique',
  'alternatives',
]);

/** Topics about one lift's technique — "deadlift or RDL?" is a comparison, not that lift's topic. */
const ONE_LIFT_TOPICS = new Set([
  'k_rdl',
  'k_front_squat',
  'k_hip_thrust',
  'k_bulgarian_split',
  'k_lunges',
  'k_dips',
  'k_face_pull',
  'k_lateral_raise',
  'k_good_morning',
  'k_farmer_carry',
  'k_nordic_curl',
  'k_pistol_squat',
]);

/** App how-tos that a bare command ("done", "start workout") must not trigger. */
const APP_HOW_ONLY = new Set(['app_start_session', 'app_finish_session']);
/** A how-to question ("how do I…", "where do I…", "як…", "де…") — about the app when the examples say so. */
const HOW_TO_RE =
  /^(how (do|can|should|would) (i|you|we)|how to|where (do|can|is|are) |як |де |как |где |jak |gdzie |kaip |kur |kuidas |kus )/u;
/** Follow-ups that ask what a lift is good for ("а що це мені дасть?"). */
const WHAT_FOR_RE =
  /((що|шо|что) (це|вона|воно|оно|она|ця вправа) (мені )?(да(сть|є|ст|ет)|кача(є|ет))|навіщо (вона|це|її|ця вправа|мені це)|для чого (вона|це|ця вправа)|what.?s (it|that|this) (good )?for|what (does|will) (it|this|that) (do|give|build|work)|why (do|should) (i|we) (do|even do) (it|this|that))/u;
/** "Something lighter / easier" right after a day's suggestion. */
const LIGHTER_RE =
  /(легш\S*|полегш\S*|легк\S*|попрощ\S*|простіш\S*|простіше|проще|полегче|легче|lighter|easier|simpler|something easy|less intense|too hard|not so hard|lżej\S*|prostsz\S*|lengv\S*|paprastesn\S*|kergem\S*|lihtsam\S*)/u;
/** "Give me an example" / "наприклад?" — one more layer of the topic at hand. */
const EXAMPLE_RE =
  /\s(examples?|for instance|приклад\S*|наприклад|пример\S*|например|przykład\S*|przyklad\S*|pavyzd\S*|näide|naide|näiteks|naiteks|näidet|naidet)\s/u;
/** "Which one is better (for me)?" after a choice between two things. */
const CHOICE_FOLLOW =
  /\s(which|better|best|choose|pick|кращ\S*|вибрат\S*|обрат\S*|який|яку|лучш\S*|выбрать|какой|lepsz\S*|lepiej|wybra\S*|który|ktory|geriau|geresn\S*|rinkt\S*|kuris|kuri|parem\S*|parim\S*|vali\S*|kumb)\s/u;
/** Why-questions that open a follow-up: "а чому лікті…", "but why…". */
const FOLLOW_WHY_RE =
  /^\s*(а|і|и|але|and|but|so)?\s*(чому|чого|навіщо|почему|зачем|why|how come)\s/iu;
/** "Build me a plan" follow-ups right after one: "and 4 days?", "at home?", "30 min?". */
function mergeFrames(a: Frame, b: Frame): Frame {
  return {
    ...a,
    days: b.days ?? a.days,
    minutes: b.minutes ?? a.minutes,
    kit: b.kit.length ? b.kit : a.kit,
    only: b.kit.length ? b.only : a.only,
    without: [...new Set([...a.without, ...b.without])],
    sore: b.sore ?? a.sore,
    goal: b.goal ?? a.goal,
    bar: a.bar || b.bar,
  };
}

const MORE = [
  'more',
  'tell me more',
  'go on',
  'continue',
  'details',
  'detail',
  'elaborate',
  'explain',
  'and',
  'then',
  'what else',
  'ще',
  'детальніше',
  'докладніше',
  'розкажи більше',
  'поясни',
  'продовжуй',
  'далі',
  'і',
  'а далі',
  'що ще',
  'як саме',
  'how exactly',
  'how so',
];
const ASK_WHY = [
  'why',
  'how come',
  'why so',
  'чому',
  'чого',
  'навіщо',
  'з чого',
  'звідки',
  'чому так',
];
/** Words that point back at the lift we were talking about. */
const PRONOUN =
  /\s(it|that lift|this lift|that exercise|this exercise|that one|this one|the same lift|її|його|неї|нього|цю вправу|цієї вправи|ця вправа|цій вправі|ту вправу|ее|его|нее|него|это упражнение|этого упражнения|этом упражнении)\s/u;

const FOLLOW_LEAD = [
  'and',
  'what about',
  'how about',
  'same for',
  'а',
  'і',
  'а як',
  'а що',
  'а для',
  'а на',
  'а про',
  'і на',
];

export const ALL_INTENTS = (): Intent[] => [
  ...INTENTS,
  ...INTENTS_MORE,
  ...INTENTS_THIRD,
  ...INTENTS_FOURTH,
  ...INTENTS_FIFTH,
  ...INTENTS_SIXTH,
  ...INTENTS_NEW,
  ...INTENTS_EXTRA,
  ...INTENTS_APP,
  ...INTENTS_APP_MORE,
  ...INTENTS_SMALL,
  ...INTENTS_HEALTH,
];
// Charts and "more" layers for topics from the earlier parts.
for (const it of ALL_INTENTS()) {
  if (CHARTS[it.id]) it.chart ??= CHARTS[it.id];
  if (MORES[it.id]) it.more ??= MORES[it.id];
  if (SMALL_OVERRIDES[it.id]) it.answer = SMALL_OVERRIDES[it.id].answer;
  // Related app features as chips for the app topics of the earlier rounds.
  it.suggest ??= appChipsFor(it.id);
}
/** Topics by id (the list is fixed once the module has loaded). */
let intentIndex: Map<string, Intent> | null = null;
const byId = (id: string | undefined): Intent | undefined => {
  if (!id) return undefined;
  if (!intentIndex) {
    intentIndex = new Map();
    // (The first of a duplicated id wins, as a search of the list would give.)
    for (const i of ALL_INTENTS()) if (!intentIndex.has(i.id)) intentIndex.set(i.id, i);
  }
  return intentIndex.get(id);
};

/**
 * Follow-up chips. With the question at hand they stay on its subject (the
 * same lift, muscle, related topics — see chips.ts); the generic list is the
 * last resort.
 */
function chipsFor(id: string, L: Tr, x?: { q: string; p: Parsed; c: AskCtx }): string[] {
  const d = DEPTH[id];
  const own = byId(id)?.suggest?.(L) ?? d?.next?.map(([en, uk]) => L(en, uk)) ?? [];
  if (x) {
    const t = topicalChips(id, x.q, x.p, x.c, L, own);
    if (t.length >= 2) return t;
  }
  if (own.length) return own.slice(0, 3);
  return DEFAULT_NEXT.map(([en, uk]) => L(en, uk)).slice(0, 3);
}

function parse(question: string, c: AskCtx): Parsed {
  const words = tokens(question);
  const phrase = normalize(question);
  const logged = loggedLifts(c);
  return {
    words,
    phrase,
    // Your own lifts (any name/language), keyword aliases, then the library (aliases, then any language).
    exercise: pickLift(question, words, phrase, logged),
    muscle: findMuscle(words, phrase),
    exercises: findExercises(words, logged, CATALOG_NAMES()),
    range: parseRange(phrase, c.now),
    weekdays: parseWeekdays(words),
  };
}

/** Does the question carry what the intent needs? */
function hasNeeds(it: Intent, p: Parsed): boolean {
  if (!it.needs) return true;
  if (it.needs === 'exercise') return !!p.exercise;
  if (it.needs === 'muscle') return !!p.muscle;
  if (it.needs === 'range') return !!p.range;
  return (p.exercises?.length ?? 0) >= 2;
}

/** The data an answer is built from — changes when you log something. */
export function stampOf(c: AskCtx): string {
  const f = finishedOf(c);
  const w = c.s.bodyMetrics.weights ?? [];
  return `${f.length}:${f[0]?.id ?? ''}:${w.length}:${c.s.injuries.length}:${c.s.coach.plan?.createdAt ?? 0}`;
}

const LOAD_INTENTS = new Set([
  'next_weight',
  'add_weight',
  'today',
  'tomorrow',
  'next_session',
  'warmup_lift',
  'percent_max',
  'reps_at_weight',
  'sets_for_lift',
  'plateau',
  'failure',
  'alternatives',
  'plan',
  'technique',
  'why_weight',
  'why_today',
  'range_lift',
]);
const TIME_INTENTS = new Set([
  'today',
  'next_session',
  'plan',
  'session_length',
  'exercises_per_session',
  'tomorrow',
]);

/**
 * What Atlas remembers, woven into the answer — so advice never ignores a
 * sore knee, a lift you banned, your goal or your time.
 */
function memoryLine(id: string, p: Parsed, c: AskCtx, core: string, L: Tr): string | null {
  const mem = c.mem;
  if (!mem) return null;
  const out: string[] = [];
  if (LOAD_INTENTS.has(id)) {
    const sore = soreFor(mem, c.now, `${p.exercise ?? ''} ${p.muscle ?? ''} ${core}`);
    const tg =
      p.exercise && ['next_weight', 'add_weight', 'why_weight'].includes(id)
        ? nextTarget(topHistory(finishedOf(c), p.exercise, c.now), {})
        : null;
    if (sore.length && tg?.weight) {
      // Same number the plan uses — never "stay at 100" and "go lighter" at once.
      const names = sore.map((x) => L(PART_NAME[x][0], PART_NAME[x][1])).join(', ');
      const w = Math.max(2.5, Math.round((tg.weight * SORE_CAP) / 2.5) * 2.5);
      out.push(
        L(
          `But your ${names} comes first: take ${c.fmt.kg(w)} instead (20% lighter), pain-free, until you tell me it’s fine — your plan uses the same.`,
          `Але спершу ${names}: бери ${c.fmt.kg(w)} (на 20% легше), без болю, доки не скажеш, що минуло, — у плані так само.`,
        ),
      );
    } else if (sore.length) {
      const names = sore.map((x) => L(PART_NAME[x][0], PART_NAME[x][1])).join(', ');
      out.push(
        L(
          `Your ${names} is still on my list: keep this pain-free and 20% lighter until you tell me it’s fine.`,
          `Пам’ятаю про ${names}: без болю й на 20% легше, доки не скажеш, що минуло.`,
        ),
      );
    }
  }
  const banned = (mem.avoid ?? []).filter(
    (x) => core.includes(c.fmt.exercise(x)) || core.includes(x),
  );
  if (banned.length) {
    const b = banned[0];
    const to = mem.prefer?.find((x) => x.from === b)?.to;
    out.push(
      to
        ? L(
            `You swapped ${c.fmt.exercise(b)} for ${c.fmt.exercise(to)} — do that instead.`,
            `Ти замінив ${c.fmt.exercise(b)} на ${c.fmt.exercise(to)} — роби її.`,
          )
        : L(
            `You told me to skip ${c.fmt.exercise(b)} — take another lift for the same muscle.`,
            `Ти просив без ${c.fmt.exercise(b)} — візьми іншу вправу на той самий м’яз.`,
          ),
    );
  }
  const g = mem.goal?.v;
  if (g === 'fat_loss' && ['muscle_gain_rate', 'grow_muscle', 'arms', 'bulk'].includes(id))
    out.push(
      L(
        'You’re cutting, though — expect slow growth; heavy lifting and high protein keep what you have.',
        'Але ти на схудненні — ріст буде повільним; важкі ваги й білок збережуть м’язи.',
      ),
    );
  if (g === 'muscle' && ['fat_loss', 'cut_deficit', 'cardio'].includes(id))
    out.push(
      L(
        'Your goal is muscle, so keep any deficit small and cardio moderate.',
        'Твоя мета — м’язи, тож дефіцит мінімальний, кардіо помірне.',
      ),
    );
  if (g === 'strength' && ['reps', 'strength_vs_size'].includes(id))
    out.push(
      L(
        'For your strength goal: the big lifts in 3–6 reps come first.',
        'Для твоєї мети — сили: базові вправи в 3–6 повторах першими.',
      ),
    );
  if (mem.minutes && TIME_INTENTS.has(id))
    out.push(
      L(
        `You have ~${mem.minutes.v} min: do the first lifts properly, superset the rest.`,
        `У тебе ~${mem.minutes.v} хв: перші вправи — як слід, решту суперсетами.`,
      ),
    );
  if (
    mem.level === 'beginner' &&
    ['next_weight', 'add_weight', 'failure', 'rpe', 'plateau'].includes(id)
  )
    out.push(
      L(
        'As a beginner you can add weight almost every session while form holds.',
        'Як новачок, додавай вагу майже кожне тренування, поки техніка тримається.',
      ),
    );
  if (
    (mem.age ?? 0) >= 50 &&
    ['warmup', 'recovery', 'deload', 'rest_day', 'overtraining'].includes(id)
  )
    out.push(
      L(
        `At ${mem.age}, a longer warm-up and an extra rest day pay off.`,
        `У ${mem.age} довша розминка й зайвий день відпочинку окупаються.`,
      ),
    );
  if (mem.home && ['alternatives', 'swap', 'today'].includes(id))
    out.push(
      L(
        'At home: dumbbells, bands and bodyweight versions work fine.',
        'Вдома: гантелі, резинки й вправи з власною вагою — цілком.',
      ),
    );
  return out.length ? out.join(' ') : null;
}

let catalogNames: string[] | null = null;
const CATALOG_NAMES = () => (catalogNames ??= BUILT_IN_CATALOG.map((e) => e.names[0]));

/** Build a full answer for an intent: flavour, memory, consistency, extras. */
/** Other sides of the topic as chips ("Why?", "When?") — first two not yet told. */
function withFacetChips(id: string, told: Facet[], rest: string[], L: Tr): string[] {
  const f = facetsOf(id) ?? {};
  const order: Facet[] = ['why', 'how', 'when', 'howMuch', 'should', 'what', 'who', 'where'];
  // One "why / how" side when there are subject follow-ups, two otherwise.
  const sides = order
    .filter((x) => f[x] && !told.includes(x))
    .slice(0, rest.length >= 2 ? 1 : 2)
    .map((x) => L(...FACET_CHIP[x]));
  return [...sides, ...rest].slice(0, 3);
}

/**
 * Answer the side of the topic the question asks for. A general question
 * ("why rest longer?") gets the facet; a personal one ("why is MY bench
 * stuck?") keeps your numbers and adds the reason.
 */
function faceted(
  id: string,
  core: string,
  question: string,
  L: Tr,
): { text: string; facet?: Facet } {
  const qt = questionType(question);
  const f = qt ? facetsOf(id)?.[qt] : undefined;
  if (!qt || !f) return { text: core };
  const ft = L(f[0], f[1]);
  // Numbers in the answer = it was computed for you (your lifts, the plates
  // for 100 kg…). Keep that; only a "why" adds the reason next to it.
  const computed = /\d/.test(core);
  if (computed || isPersonal(question))
    return qt === 'why' ? { text: `${core} ${ft}`, facet: qt } : { text: core };
  return { text: ft, facet: qt };
}

function build(
  it: Intent,
  core: string,
  c: AskCtx,
  p: Parsed,
  question: string,
  L: Tr,
  convo: Convo,
  q = question,
  facet?: Facet,
): Draft {
  const turn = (convo.turn ?? 0) + 1;
  // Small talk speaks for itself: no "As I said", no memory notes, no opener.
  if (SMALLTALK_IDS.has(it.id))
    return {
      intent: it.id,
      text: core,
      chips: chipsFor(it.id, L),
      convo: { intent: it.id, depth: 0, turn, q },
    };
  // Consistency: the same topic on the same data gets the same answer.
  const key = saidKey(
    facet ? `${it.id}:${facet}` : it.id,
    p.exercise,
    p.muscle,
    p.range?.from ?? null,
  );
  const stamp = stampOf(c);
  const prev = c.said?.find((r) => r.key === key);
  const kept = consistent(prev, core, stamp, c.now, L);
  const extra = memoryLine(it.id, p, c, kept.keep, L);
  const body = extra ? `${kept.text} ${extra}` : kept.text;
  const action = it.action?.(c, p) ?? undefined;
  // The temper's manner: opener, reaction, a joke now and then, closer.
  // "As I said…" / "this changed…" already frame the reply; actions stay crisp.
  const dressed =
    it.neutral || action || kept.text !== kept.keep
      ? { text: body, joked: false }
      : dress(body, c, it.id, question + it.id, turn, convo);
  return {
    intent: it.id,
    text: dressed.text,
    chips: action
      ? undefined
      : withFacetChips(it.id, facet ? [facet] : [], chipsFor(it.id, L, { q: question, p, c }), L),
    chart: it.chart?.(c, p, L) ?? undefined,
    action,
    said: { key, text: kept.keep, stamp, at: c.now },
    convo: {
      intent: it.id,
      exercise: p.exercise,
      muscle: p.muscle,
      depth: 0,
      turn,
      q,
      told: facet ? [facet] : [],
      joked: dressed.joked,
    },
  };
}

/** Dress an answer in the temper's voice (see style.ts). */
function dress(
  text: string,
  c: AskCtx,
  topic: string,
  seed: string,
  turn: number,
  convo: Convo,
  neutral = false,
) {
  return styled(text, {
    temper: c.temper,
    locale: c.locale,
    yoMama: !!c.s.coach.yoMama,
    swearing: !!c.s.coach.swearing,
    topic,
    // Right after a hard moment (safety net) he stays plain for a few answers.
    neutral: neutral || (convo.softUntil !== undefined && turn <= convo.softUntil),
    seed: `${seed}#${turn}`,
    jokedLast: !!convo.joked,
    followUp: !!convo.intent && convo.intent === topic,
  });
}

/** One message → one answer (no splitting). */
function answerOne(
  question: string,
  c: AskCtx,
  convo: Convo,
  /** The grammar of the message as written, when this is a reading of it (a translation…). */
  written?: Understanding,
): Draft | null {
  const p = parse(question, c);
  const { words, phrase } = p;
  if (!words.length) return null;
  // The grammar's reading: who says what, in which tense, and which clause asks.
  const g = written ?? understand(question);
  // A time window named only in the story around the question ("I lifted 5 years
  // ago, where do I start now?") is not the window the question asks about.
  if (p.range && g.qText && (g.report || g.plan) && !parseRange(normalize(g.qText), c.now))
    p.range = null;
  // "What did I do 3 days ago?" — one day: that weekday.
  if (p.range?.ago && !p.weekdays?.length) {
    const days = Math.round((c.now - p.range.from) / 86_400_000);
    if (days >= 1 && days <= 6) {
      p.weekdays = [new Date(p.range.from).getDay()];
      p.range = null;
    }
  }
  // "I'm going to swim tomorrow, does that count as cardio?" — the day belongs
  // to the story, not to the question.
  const timeOutside =
    !!g.qText &&
    (g.report || g.plan) &&
    TIME_WORD.test(` ${phrase} `) &&
    !TIME_WORD.test(` ${normalize(g.qText)} `);
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const short = words.length <= 5;
  const turn = (convo.turn ?? 0) + 1;

  // "It / that lift / її / цю вправу" → the lift we were just talking about.
  if (!p.exercise && convo.exercise && words.length <= 9 && PRONOUN.test(` ${phrase} `))
    p.exercise = convo.exercise;
  // "а скільки підходів?" right after a lift → that lift.
  if (
    !p.exercise &&
    !p.muscle &&
    !p.range &&
    convo.exercise &&
    words.length <= 6 &&
    CONNECTOR_RE.test(question)
  )
    p.exercise = convo.exercise;

  // ---- the safety net: checked before anything else, in every temper ----
  const danger = safetySignal(question);
  if (danger) {
    const r = safetyReply(danger, L);
    return {
      route: 'safety',
      intent: `safety_${danger}`,
      text: r.text,
      chips: r.chips,
      action: danger === 'lifecrisis' ? { type: 'pause', days: 7 } : undefined,
      convo: { turn, softUntil: turn + 3 },
    };
  }

  // ---- guided conversations: a pain check-in, finding an exercise ----
  const flowOut = (r: FlowReply, route: Route = 'flow'): Draft => ({
    route,
    intent: r.intent,
    text: r.text,
    chips: r.chips,
    action: r.action,
    convo: {
      turn,
      flow: r.flow ?? undefined,
      exercise: r.flow?.kind === 'pain' ? (r.flow.lift ?? null) : p.exercise,
      softUntil: convo.softUntil,
    },
  });
  if (convo.flow) {
    // Short replies and tapped options belong to the flow; a new long
    // question on another subject ends it.
    const belongs =
      words.length <= (convo.flow.kind === 'pain' ? 12 : 7) ||
      (convo.flow.kind === 'find' && !painStart(question)) ||
      (convo.flow.kind === 'pain' && painStart(question));
    if (belongs) {
      const r = continueFlow(convo.flow, question, c, p.exercise, L);
      if (r) return flowOut(r);
    }
  }
  if (findStart(question)) return flowOut(startFind(question, c, L));
  // A question ABOUT pain topics (logging an injury, coming back, painkillers,
  // tendons…) is that topic — the check-in is for "it hurts".
  const painTopic = () => {
    const [h1, h2] = retrieve(question);
    return (
      !!h1 &&
      PAIN_TOPICS.has(h1.id) &&
      h1.score >= RET_MIN &&
      h1.score - (h2?.score ?? 0) >= RET_MARGIN
    );
  };
  if (
    painStart(question) &&
    !aboutSomeoneElse(question) &&
    !negated(words, [...PAIN_WORDS, 'sore']) &&
    !g.painNegated &&
    (!painTopic() || painNow(question))
  ) {
    // Remember the sore spot (it shapes later plans) — no note, the flow talks.
    const sore = learn(words, phrase, c.mem, c.now, p.exercise, c.fmt.exercise, {
      raw: question,
    }).patch;
    const out = flowOut(startPain(question, c, p.exercise, L), 'pain');
    return Object.keys(sore).length ? { ...out, learned: sore } : out;
  }

  // ---- "can I squat today?" with long-term limits: they decide, before any generic topic ----
  if (asksIfOk(phrase) && (p.exercise || p.muscle) && limitsOf(c).keys.length) {
    const a = answerAsDraft('ok_with_limits', question, c, convo);
    if (a) return { ...a, route: 'rule' };
  }

  // ---- told, not asked: "I danced for 2 hours today", "пробіг 5 км зранку" ----
  // A report is told, not asked or planned: "30 min cardio after lifting, good or
  // bad?" and "if I skipped a workout…" are questions, not sessions to log.
  const grammar = {
    told: g.report,
    asked: (g.question || g.command) && !g.report,
    hypothetical: g.conditional && !g.report,
  };
  const act =
    activityReport(question, c.now, grammar) ??
    (!hasCyrillic(question) && /[a-z]/i.test(question)
      ? activityReport(translitToUk(question), c.now, grammar)
      : null);
  if (act) {
    const r = activityAnswer(act, c, L);
    const d = r.action
      ? { text: r.text, joked: false }
      : dress(r.text, c, 'activity_report', question, turn, convo);
    return {
      route: 'activity',
      intent: 'activity_report',
      text: d.text,
      chips: r.action ? undefined : r.chips,
      action: r.action,
      convo: { intent: 'activity_report', depth: 0, turn, q: question, joked: d.joked },
    };
  }
  // ---- a complaint about the conversation, not a topic ----
  if (words.length <= 12 && (isComplaint(question) || g.complaint)) {
    const a = answerAsDraft('you_dumb', question, c, convo);
    if (a) return { ...a, route: 'complaint' };
  }
  // ---- "I benched 100 today!" — told a lift / a record: today's records ----
  if (PR_TOLD.test(` ${phrase} `) && !questionType(question) && !/\?/u.test(question)) {
    const a = answerAsDraft('prs_today', question, c, convo);
    if (a) return { ...a, route: 'rule' };
  }

  // ---- "why do you (always) suggest squats?" — Atlas's reasons for its pick ----
  if (g.whyAtlas) {
    const a =
      (p.exercise ? answerAsDraft('why_lift', question, c, convo) : null) ??
      answerAsDraft('why_plan', question, c, convo);
    if (a) return { ...a, route: 'rule' };
  }

  // ---- mid-session: the workout that's open right now ----
  const live = liveAnswer(c, question, L);
  if (live)
    return {
      route: 'live',
      intent: live.id,
      text: live.text,
      chips: [
        L('What weight next set?', 'Яку вагу на наступний підхід?'),
        L('How many sets left?', 'Скільки ще підходів?'),
        L('What’s next?', 'Що далі?'),
      ],
      convo: { ...convo, turn },
    };

  // ---- numbers in the question: answered straight, no "which lift?" ----
  const calcIn = (text: string) => calcAnswer(text, L, c.fmt.kg);
  const calc =
    calcIn(question) ??
    // "а якщо я важу 100?" right after protein → the same maths with the topic.
    (convo.q && /\d/.test(question) && words.length <= 6 ? calcIn(`${convo.q} ${question}`) : null);
  if (calc) {
    // Known topics keep their name, so "and on a cut?" follows on from protein.
    const id = /(білк|белк|protein|протеїн)/iu.test(question)
      ? 'protein'
      : /(1\s?пм|1\s?rm|max|максим|на раз)/iu.test(question)
        ? 'e1rm'
        : 'calc';
    return {
      route: 'calc',
      intent: id,
      text: calc,
      convo: { ...convo, intent: id === 'calc' ? convo.intent : id, turn, q: question },
    };
  }

  // ---- clearly not about training: a line in character, then back ----
  // (Unless a topic of Atlas's own clearly fits — "a lifting plan for football season".)
  const offFits = () => {
    const [h1, h2] = retrieve(question);
    return (
      !!h1 &&
      OFF_FRIENDLY.has(h1.id) &&
      h1.score >= RET_MIN &&
      h1.score - (h2?.score ?? 0) >= RET_MARGIN
    );
  };
  if (offTopic(question) && !offFits())
    return {
      route: 'offtopic',
      intent: 'off_topic',
      text: offTopicLine(c.temper, L),
      escalate: false,
      chips: [
        L('What should I train today?', 'Що тренувати сьогодні?'),
        L('How am I progressing?', 'Як я прогресую?'),
      ],
      convo: { ...convo, turn },
    };

  // ---- put together on the spot: a plan, a comparison, a what-if ----
  const composed = compose(question, p, c, convo, L, turn);
  if (composed) return { ...composed, route: composed.route ?? 'compose' };

  // ---- follow-ups that lean on the lift we were talking about ----
  const around = aroundLift(question, p, c, convo, L, turn);
  if (around) return { ...around, route: around.route ?? 'around' };

  // ---- follow-ups on a computed question ("and last month?", "а присід?") ----
  if (convo.query) {
    if (questionType(question) === 'why' && words.length <= 4 && convo.query.exercise) {
      const ex = explainLift(c, convo.query.exercise, L);
      if (ex)
        return { intent: 'log_query', text: ex, convo: { ...convo, turn }, route: 'queryFollow' };
    }
    const fq = followQuery(convo.query, question, p);
    const res = fq && runQuery(c, fq, L);
    const d = res && dress(res.text, c, 'log_query', question, turn, convo);
    if (fq && res && d)
      return {
        route: 'queryFollow',
        intent: 'log_query',
        text: d.text,
        chart: res.chart,
        chips: queryChips(fq, L),
        convo: {
          intent: 'log_query',
          exercise: fq.exercise,
          muscle: fq.muscle,
          depth: 0,
          turn,
          q: question,
          query: fq,
          joked: d.joked,
        },
      };
  }

  // ---- follow-ups on the current topic ----
  const cur = byId(convo.intent);
  // (A follow-up that names nothing new may run a little longer: "which one is better for me".)
  if (cur && (short || (words.length <= 7 && bareFollow(question)))) {
    const base = convo.q ? parse(convo.q, c) : p;
    const topic: Parsed = {
      ...base,
      exercise: convo.exercise ?? base.exercise,
      muscle: convo.muscle ?? base.muscle,
    };
    // A pending "which lift?" answered with just the lift/muscle — or
    // "and deadlift?" carrying the topic (and its time window) over.
    const entityOnly =
      (p.exercise || p.muscle) &&
      (convo.pending || groupMatches(words, phrase, FOLLOW_LEAD) || words.length <= 3);
    // Answering "which lift?" keeps the rest of the original question (numbers, window).
    const carried: Parsed = convo.pending
      ? {
          ...base,
          exercise: p.exercise ?? base.exercise,
          muscle: p.muscle ?? base.muscle,
          range: p.range ?? base.range,
        }
      : { ...p, range: p.range ?? base.range };
    // Only topics about a lift/muscle carry over — and never when the message
    // is a question of its own ("squat technique", "bench vs squat").
    const [r1, r2] = retrieve(question);
    const ownQuestion =
      ALL_INTENTS().some(
        (it) =>
          it.id !== cur.id &&
          it.all.length > 0 &&
          it.all.every((g) => groupMatches(words, phrase, g)) &&
          // (Chat words say nothing new: "why do you think so" is no "thanks".)
          !SMALLTALK_IDS.has(it.id) &&
          it.id !== 'thanks' &&
          hasNeeds(it, p),
      ) ||
      // "…and what about carbs?" — the examples clearly name another topic.
      (!!r1 &&
        r1.id !== cur.id &&
        r1.score >= RET_HIGH + 0.15 &&
        r1.score - (r2?.score ?? 0) >= 0.1 &&
        !!byId(r1.id) &&
        hasNeeds(byId(r1.id)!, p));
    // "And last month?" — the same topic over a new window. A lift topic
    // without windows (progress, best) moves to the lift-over-a-window one.
    if (
      p.range &&
      !p.exercise &&
      !p.muscle &&
      (!ownQuestion || CONNECTOR_RE.test(question)) &&
      words.length <= 5
    ) {
      const target =
        cur.needs === 'range'
          ? cur
          : topic.exercise && (cur.id === 'progress_lift' || cur.id === 'best' || cur.id === 'e1rm')
            ? byId('range_lift')
            : topic.muscle && cur.needs === 'muscle'
              ? byId('range_muscle')
              : undefined;
      const tp: Parsed = { ...topic, range: p.range };
      const core = target && hasNeeds(target, tp) ? target.answer(c, tp, L) : null;
      if (target && core)
        return tag(build(target, core, c, tp, question, L, convo, convo.q ?? question), 'follow');
    }
    if (entityOnly && cur.needs && (convo.pending || !ownQuestion) && hasNeeds(cur, carried)) {
      const core = cur.answer(c, carried, L);
      if (core)
        return tag(build(cur, core, c, carried, question, L, convo, convo.q ?? question), 'follow');
    }
    // "а на присіді?" / "a przy przysiadach?" right after a topic that takes no
    // lift of its own (rest, warm-up, reps…) → the same topic, for that lift.
    if (
      entityOnly &&
      !cur.needs &&
      !ownQuestion &&
      !cur.action &&
      !SMALLTALK_IDS.has(cur.id) &&
      !LOG_TOPICS.has(cur.id) &&
      !DAY_TOPICS.has(cur.id) &&
      !cur.id.startsWith('app_')
    ) {
      const core = cur.answer(c, carried, L);
      if (core)
        return tag(build(cur, core, c, carried, question, L, convo, convo.q ?? question), 'follow');
    }
    // "And for squat?" after a detour — the last topic that takes a lift / muscle.
    if (entityOnly && !cur.needs && !ownQuestion)
      for (const pr of convo.prev ?? []) {
        const it = byId(pr.intent);
        if (!it?.needs || it.needs === 'range' || it.needs === 'twoLifts') continue;
        const tp: Parsed = { ...p, exercise: p.exercise, muscle: p.muscle };
        if (!hasNeeds(it, tp)) continue;
        const core = it.answer(c, tp, L);
        if (core)
          return tag(
            build(it, core, c, tp, question, L, { ...convo, intent: pr.intent }, pr.q ?? question),
            'follow',
          );
      }
    // "Why?" / "How?" / "When?"… on the current topic → that side of it.
    const fq = questionType(question);
    // The topic's own "why" (e.g. the lift-specific reason) beats the general one.
    const ownWhy = fq === 'why' && words.length <= 4 ? cur.why?.(c, topic, L) : null;
    const side =
      fq && words.length <= 4 && !ownQuestion && !ownWhy ? facetsOf(cur.id)?.[fq] : undefined;
    if (fq && side) {
      const told = [...(convo.told ?? []), fq];
      return {
        route: 'follow',
        intent: cur.id,
        text: L(side[0], side[1]),
        chips: withFacetChips(
          cur.id,
          told,
          chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
          L,
        ),
        convo: { ...convo, told, turn },
      };
    }
    if (
      !ownQuestion &&
      ((words.length <= 3 && groupMatches(words, phrase, ASK_WHY)) ||
        // "why do you think so?", "а чому так вважаєш?" — nothing new named.
        (fq === 'why' && words.length <= 7 && bareFollow(question)))
    ) {
      const d = DEPTH[cur.id];
      const cp = topic;
      const fw = facetsOf(cur.id)?.why;
      const why =
        cur.why?.(c, cp, L) ?? (d?.why ? L(d.why[0], d.why[1]) : fw ? L(fw[0], fw[1]) : null);
      if (why)
        return {
          route: 'follow',
          intent: cur.id,
          text: why,
          chips: chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
          convo: { ...convo, turn },
        };
      return {
        route: 'follow',
        intent: cur.id,
        text: L(
          'That part is past what I know by heart.',
          'Тут я вже за межами того, що знаю напам’ять.',
        ),
        escalate: true,
        convo: { ...convo, turn },
      };
    }
    // "Which one is better for me?" right after a choice → that choice's advice.
    if (
      !ownQuestion &&
      fq !== 'why' &&
      words.length <= 7 &&
      CHOICE_FOLLOW.test(` ${phrase} `) &&
      bareFollow(question)
    ) {
      const should = facetsOf(cur.id)?.should;
      const core = should ? L(should[0], should[1]) : cur.answer(c, topic, L);
      if (core)
        return tag(
          build(
            cur,
            core,
            c,
            topic,
            question,
            L,
            convo,
            convo.q ?? question,
            should ? 'should' : undefined,
          ),
          'follow',
        );
    }
    if (
      // "Give me an example" / "наприклад?" — one more layer of the same topic.
      (words.length <= 6 && EXAMPLE_RE.test(` ${phrase} `)) ||
      (!ownQuestion &&
        groupMatches(words, phrase, MORE) &&
        !ALL_INTENTS().some(
          (it) =>
            it.id !== cur.id &&
            it.all.every((g) => groupMatches(words, phrase, g)) &&
            it.all.length > 0 &&
            matchedWords(words, it.all) >= 2,
        ))
    ) {
      const d = DEPTH[cur.id];
      const depth = convo.depth ?? 0;
      const cp = topic;
      const own = cur.more?.(c, cp, L, depth) ?? null;
      const layer = own ?? (d?.more[depth] ? L(d.more[depth][0], d.more[depth][1]) : null);
      if (layer)
        return {
          route: 'follow',
          intent: cur.id,
          text: layer,
          chips: withFacetChips(
            cur.id,
            convo.told ?? [],
            chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
            L,
          ),
          convo: { ...convo, depth: depth + 1, turn },
        };
      // Out of layers → the sides of the topic not told yet.
      const order: Facet[] = ['why', 'how', 'when', 'howMuch', 'should', 'what', 'who', 'where'];
      const next = order.find((x) => facetsOf(cur.id)?.[x] && !(convo.told ?? []).includes(x));
      if (next) {
        const f = facetsOf(cur.id)![next]!;
        const told = [...(convo.told ?? []), next];
        return {
          route: 'follow',
          intent: cur.id,
          text: L(f[0], f[1]),
          chips: withFacetChips(
            cur.id,
            told,
            chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
            L,
          ),
          convo: { ...convo, told, depth: depth + 1, turn },
        };
      }
      return {
        route: 'follow',
        intent: cur.id,
        text: L(
          'That’s the core of it. Pick where to go next — or ask me something specific.',
          'Це суть. Обери, куди далі, — або спитай щось конкретне.',
        ),
        chips: chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
        escalate: true,
        convo: { ...convo, depth: depth + 1, turn },
      };
    }
  }

  // ---- what you just told me (a sore knee, your goal, a lift you hate…) ----
  // Facts about someone else ("my dad is 65") are never filed under you.
  const learned = aboutSomeoneElse(question)
    ? { patch: {} as AtlasMemory, note: null }
    : learn(words, phrase, c.mem, c.now, p.exercise, c.fmt.exercise, { raw: question });
  const hasLearned = Object.keys(learned.patch).length > 0;
  const cm: AskCtx = hasLearned ? { ...c, mem: mergeMemory(c.mem, learned.patch) } : c;
  const withLearned = (a: Draft | null): Draft | null => {
    if (!hasLearned) return a;
    const note = learned.note ? L(learned.note[0], learned.note[1]) : '';
    if (!a)
      return {
        route: 'memo',
        intent: 'memory_note',
        text: note,
        learned: learned.patch,
        chips: [
          L('What do you know about me?', 'Що ти про мене знаєш?'),
          L('What should I train today?', 'Що тренувати сьогодні?'),
        ],
        convo: { intent: 'memory_note', depth: 0, turn },
      };
    return {
      ...a,
      text: note ? `${a.text}\n\n${note}` : a.text,
      learned: learned.patch,
    };
  };

  // ---- a fresh question ----
  const negatedPain = negated(words, [...PAIN_WORDS, 'sick', 'ill', 'хвор*', 'захвор*']);
  const weight = (it: Intent) =>
    matchedWords(words, it.all) +
    (it.needs ? (it.needs === 'range' || it.needs === 'twoLifts' ? 4 : 2) : 0) +
    (it.action ? 3 : 0) +
    (it.id.startsWith('why_') ? 3 : 0) +
    (SMALL_NEW.has(it.id) ? 2 : 0) +
    // The hundred narrow topics' keywords are narrow on purpose (intentsExtra.ts):
    // "AMRAP", "bouldering", "nusibodo" name them outright — over a broad word.
    (EXTRA_IDS.has(it.id) ? 2 : 0) +
    (it.priority ? 100 : 0);
  // "70% of my squat", "100 kg" — the numbers are amounts, not an age ("I'm 70").
  const numbersAreAmounts =
    g.f.quantities.some((q) => q.unit !== 'year') &&
    !g.f.quantities.some((q) => q.unit === 'year') &&
    !AGE_WORD.test(` ${phrase} `);
  // "I can train 3 days a week" tells, it doesn't ask.
  const told = isStatement(question);
  const qType = questionType(question);
  /** Out of the running: a "why this…" topic without a why; a topic you just said "not" to. */
  const ruledOut = (it: Intent) =>
    (it.id.startsWith('why_') && qType !== 'why') ||
    // A topic whose own idea is missing from the message ("cardio or weights
    // for fat loss" is no question of order).
    (!!KEY_IDEA[it.id] && !KEY_IDEA[it.id].test(` ${phrase} `)) ||
    // "How much did I bench…" is no "when did I last…".
    (WHEN_TOPICS.has(it.id) &&
      !!g.f.whWord &&
      g.f.whWord !== 'when' &&
      g.f.whWord !== 'how_long') ||
    (numbersAreAmounts && AGE_TOPICS.has(it.id)) ||
    // "I just want to get big" wants the growth, it doesn't fear it.
    (g.wantsGrowth && it.id === 'myth_bulky') ||
    (timeOutside && DAY_TOPICS.has(it.id)) ||
    // "Will I be sore tomorrow (after heavy squats)?" asks about the body — not
    // that day's plan or the next load.
    ((it.id === 'today' || it.id === 'tomorrow' || it.id === 'next_weight') &&
      !!g.qText &&
      BODY_STATE.test(` ${normalize(g.qText)} `)) ||
    (told && negatedTopic(it, words)) ||
    // "baigta" / "workout done" reports a workout; "how do I finish one?" asks about the app.
    (APP_HOW_ONLY.has(it.id) && words.length <= 2 && !HOW_TO_RE.test(phrase));
  const matchesGroups = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords) &&
    !(it.negatable && negatedPain) &&
    !ruledOut(it) &&
    it.all.every((g) => groupMatches(words, phrase, g));
  const candidates = ALL_INTENTS().filter(matchesGroups);
  const ranked = candidates.filter((it) => hasNeeds(it, p)).sort((a, b) => weight(b) - weight(a));
  // "Як правильно веслувати на тренажері" — the how-to phrase is only the frame;
  // a narrow topic that names the thing goes before the generic technique one.
  const named = ranked[0]?.id === 'technique' && ranked.find((it) => EXTRA_IDS.has(it.id));
  if (named) ranked.splice(0, ranked.length, named, ...ranked.filter((it) => it !== named));

  // Understanding by example: the closest topic among ~7,000 real phrasings.
  // It leads when keywords found nothing, or only a weak, single-word hit.
  const allowed = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords + 3) &&
    !(it.negatable && negatedPain) &&
    !ruledOut(it);
  // What you taught me: your wording → your topic; 👎 topics are out.
  const wrong = wrongFor(question, c.mem);
  const taughtId = taughtFor(question, c.mem);
  const hits = retrieve(question).filter((h) => {
    const it = byId(h.id);
    return it && allowed(it) && !wrong.has(h.id);
  });
  for (let i = ranked.length - 1; i >= 0; i--) if (wrong.has(ranked[i].id)) ranked.splice(i, 1);
  const top = hits[0];
  const second = hits[1];
  const margin = top ? top.score - (second?.score ?? 0) : 0;
  // Clearly ahead — or far above the bar with any lead at all.
  const confident =
    !!top &&
    top.score >= RET_MIN &&
    (margin >= RET_MARGIN || (top.score >= RET_HIGH && margin >= RET_HIGH_MARGIN));
  const taughtIt = taughtId ? byId(taughtId) : undefined;
  // Examples point at a topic of their own (not the log calculator) → it beats a loose log query.
  const topFits =
    !!top &&
    top.score >= RET_MIN &&
    top.id !== 'log_query' &&
    !!byId(top.id) &&
    hasNeeds(byId(top.id)!, p);
  const kwTop = ranked[0];
  const byExample0 =
    taughtIt && hasNeeds(taughtIt, p) ? taughtIt : confident ? byId(top.id) : undefined;
  // Keywords and examples disagree → the topic that accounts for more of the
  // message ("is creatin safe": creatine, not a lookalike of "created").
  const byExample =
    byExample0 &&
    kwTop &&
    byExample0 !== kwTop &&
    byExample0 !== taughtIt &&
    !kwTop.action &&
    coverage(question, kwTop.id) - coverage(question, byExample0.id) >= COVER_GAP
      ? kwTop
      : byExample0;
  const kwStrong =
    !!kwTop &&
    (!!kwTop.priority ||
      !!kwTop.action ||
      kwTop.needs === 'range' ||
      kwTop.needs === 'twoLifts' ||
      (POLICY.mode === 'mix' && matchedWords(words, kwTop.all) >= 2));
  // Understood by example → that topic leads. Unsure → only a strong keyword
  // hit may answer; otherwise we ask "did you mean…" instead of guessing.
  let order: Intent[] = [];
  // A keyword command with all its details ("move legs to thursday") still wins;
  // so does a "why…" topic for a why-question, and a solid keyword hit that the
  // examples also rank near the top.
  const qt = qType;
  // …but "how do I start a session?" asks how the app works, not to start one.
  const howToApp = !!byExample?.id.startsWith('app_') && HOW_TO_RE.test(phrase);
  const commandReady = !!kwTop?.action && kwTop !== byExample && !howToApp && !!kwTop.action(cm, p);
  // …unless the examples clearly know better ("why am I weaker today" is not "why this workout").
  const whyTopic =
    qt === 'why' &&
    !!kwTop?.id.startsWith('why_') &&
    !(confident && margin >= 0.1 && top.id !== kwTop.id && !top.id.startsWith('why_'));
  // Near-tie between the two closest topics → the keyword hit breaks it.
  const agreed = !!kwTop && hits[1]?.id === kwTop.id && margin < 0.05;
  // "Why is my bench stuck?" — the reasons your log shows.
  // (Also told: "my deadlift is stuck", "стою на 80 в жимі, що міняти".)
  if (
    (qt === 'why' || qt === 'what' || !qt) &&
    p.exercise &&
    loggedLifts(c).some((l) => l.name === p.exercise) &&
    STALL_RE.test(` ${phrase} `) &&
    // "…stuck halfway up / посередині" is a point in the rep, not a stalled lift.
    !REP_POINT.test(` ${phrase} `) &&
    // "afraid of getting stuck under the bar" — a worry, not a stalled lift.
    !g.fear
  ) {
    const ex = explainLift(cm, p.exercise, L);
    const it = byId('progress_lift');
    if (ex && it)
      return tag(withLearned(build(it, ex, cm, p, question, L, convo, question, 'why')), 'stall');
  }
  // "I hate lunges" / "не хочу більше випади" — a lift you want gone (asked to confirm).
  if (
    p.exercise &&
    AVOID_RE.test(` ${phrase} `) &&
    !/(сьогодні|today|сегодня|зараз|now)/u.test(phrase) &&
    !wrong.has('act_avoid')
  ) {
    const it = byId('act_avoid');
    const core = it && hasNeeds(it, p) ? it.answer(cm, p, L) : null;
    if (it && core) {
      const out = build(it, core, cm, p, question, L, convo, question);
      return tag(withLearned({ ...out, action: it.action?.(cm, p) ?? out.action }), 'avoid');
    }
  }
  // "Додай 5 кг на жим" — the next target, from your last session of that lift.
  const bump = BUMP_RE.exec(` ${phrase} `);
  if (bump && p.exercise) {
    const add = Number(bump[3].replace(',', '.'));
    const last = finishedOf(c).find((w) => w.exercises.some((e) => e.name === p.exercise));
    const sets = last?.exercises
      .filter((e) => e.name === p.exercise)
      .flatMap((e) => e.sets)
      .filter((st) => setTypeOf(st) !== 'warmup' && (st.weight ?? 0) > 0);
    const top = sets?.length
      ? sets.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a))
      : null;
    if (top && add > 0 && add <= 50) {
      const nm = c.fmt.exercise(p.exercise);
      const next = (top.weight ?? 0) + add;
      return withLearned({
        route: 'bump',
        intent: 'next_weight',
        text: L(
          `${nm} next time: ${c.fmt.kg(next)} × ${top.reps} on the first working set (last time ${c.fmt.kg(top.weight ?? 0)} × ${top.reps}). If the reps drop by 2 or more — go back to ${c.fmt.kg(top.weight ?? 0)} and add a rep instead.`,
          `${nm} наступного разу: ${c.fmt.kg(next)} × ${top.reps} на першому робочому підході (минулого разу ${c.fmt.kg(top.weight ?? 0)} × ${top.reps}). Якщо повторів стане на 2+ менше — повернись до ${c.fmt.kg(top.weight ?? 0)} і додай повтор.`,
        ),
        chips: [
          L(`${nm}: warm-up sets?`, `${nm}: розминочні підходи?`),
          L(`How is my ${nm} going?`, `Як прогресує ${nm}?`),
        ],
        convo: { intent: 'next_weight', exercise: p.exercise, depth: 0, turn, q: question },
      });
    }
  }
  // "How much did I lift this year / on bench?" — kilos moved, in that window.
  if (
    !taughtIt &&
    !wrong.has('tonnage') &&
    LIFTED_RE.test(` ${phrase} `) &&
    !/(heaviest|max|best|record|most|ever|найбільше|колись|volume|tons?|tonnes?|тонн\S*|обʼєм\S*|обєм\S*|найважч\S*|максим\S*|рекорд\S*|найкращ\S*|тяжел\S*)/u.test(
      phrase,
    )
  ) {
    const it = byId('tonnage');
    const core = it?.answer(cm, p, L);
    if (it && core)
      return tag(withLearned(build(it, core, cm, p, question, L, convo, question)), 'lifted');
  }
  // "How are my pull-ups?" — your own lift + nothing but how-is-it-going.
  const status =
    !taughtIt &&
    !wrong.has('progress_lift') &&
    p.exercise &&
    loggedLifts(c).some((l) => l.name === p.exercise) &&
    isLiftStatus(question, p.exercise)
      ? byId('progress_lift')
      : null;
  // Free questions about your log ("average reps on bench in August",
  // "which lift improved most") — computed, not looked up.
  // "If I quit for two months, how much will I lose?" — what would happen, not
  // what the log shows.
  const whatIf = !!g.cond && g.hypothetical && g.cond.kind !== 'neg';
  // "How much muscle WILL I lose…" asks about what would happen, not about the log.
  const lq = whatIf || (g.plan && !g.pastAsk && !g.report) ? null : parseQuery(question, p);
  const myLog =
    !!lq &&
    aboutMyLog(question, lq, !!p.exercise && loggedLifts(c).some((l) => l.name === p.exercise));
  const queryAnswer = (): Draft | null => {
    const res = lq && runQuery(cm, lq, L);
    if (!lq || !res) return null;
    const d = dress(res.text, cm, 'log_query', question, turn, convo);
    // Computed while the examples clearly name a topic of their own — right
    // often enough, but not sure.
    const split = !!byExample && byExample.id !== 'log_query' && margin >= 0.1;
    return withLearned({
      ...(split ? { confidence: 0.74 } : {}),
      route: 'query',
      intent: 'log_query',
      text: d.text,
      chart: res.chart,
      chips: queryChips(lq, L),
      convo: {
        intent: 'log_query',
        exercise: p.exercise,
        muscle: p.muscle,
        depth: 0,
        turn,
        q: question,
        query: lq,
        joked: d.joked,
      },
    });
  };
  // Examples know the topic for sure → they lead; otherwise a clearly
  // analytic question is computed before keyword guesses.
  // (A window named next to a topic about your record makes the question a
  // computed one — next to advice, "in 3 weeks off" is the advice's own story.)
  const specific =
    !!lq &&
    (lq.signals >= 3 ||
      (!!p.range &&
        !!byExample &&
        byExample.needs !== 'range' &&
        (LOG_TOPICS.has(byExample.id) || !!byExample.needs)));
  // A narrow topic's own words, three or more of them, name the question
  // ("lose fat and gain muscle") — no loose computed reading goes before it.
  // (Not a broad topic's: "how many reps" is any question's frame.)
  const kwFirm =
    !!kwTop && EXTRA_IDS.has(kwTop.id) && matchedWords(words, kwTop.all) >= 3 && !kwTop.action;
  // A lift you never logged may be a misread word — then topics go first.
  const unknownLift = !!p.exercise && !loggedLifts(c).some((l) => l.name === p.exercise);
  // "I can train 3 days a week" tells, it doesn't ask for a count from the log.
  if (taughtId === 'log_query' && lq && !wrong.has('log_query')) {
    const a = queryAnswer();
    if (a) return a;
  }
  // "Which split is best?" asks for advice — not a number from the log.
  const adviceAsked = g.advice && !g.pastAsk;
  if (
    lq?.strong &&
    myLog &&
    !told &&
    !adviceAsked &&
    !unknownLift &&
    !wrong.has('log_query') &&
    !taughtIt &&
    (!byExample || specific) &&
    (!topFits || specific) &&
    !commandReady &&
    !status &&
    !whyTopic &&
    !kwFirm
  ) {
    const a = queryAnswer();
    if (a) return a;
  }
  // Two topics neck and neck: the one that uses the lift you named ("how heavy
  // on squats tomorrow" → the weight, not tomorrow's plan).
  const near = hits
    .filter((h) => h.score >= (top?.score ?? 0) - 0.05)
    .slice(0, 2)
    .map((h) => byId(h.id)!)
    .filter((it) => hasNeeds(it, p) && !it.action);
  // (Not the plain lift-knowledge answers — "heels lift in my squat" is ankle mobility, not squat depth.)
  const usesLift = near.filter(
    (it) => it.needs === 'exercise' && !!p.exercise && !GENERIC_LIFT_TOPICS.has(it.id),
  );
  const tie = near.length === 2 && usesLift.length === 1 ? usesLift[0] : null;
  // "Good morning" — a short message a chat keyword accounts for word by word is that.
  const wholeChat = ranked.find(
    (it) =>
      (SMALLTALK_IDS.has(it.id) || it.id === 'greeting' || it.id === 'ack') &&
      words.length <= 4 &&
      matchedWords(words, it.all) + words.filter((w) => CHAT_FILLER.has(w)).length >= words.length,
  );
  // A narrow topic's own words ("skipping leg day", "AMRAP", "massage gun") name
  // it outright — over a broader neighbour the examples lean to ("skip a day"),
  // unless that neighbour's words are said too or the examples are far apart.
  const narrow =
    kwTop &&
    byExample &&
    kwTop !== byExample &&
    EXTRA_IDS.has(kwTop.id) &&
    !EXTRA_IDS.has(byExample.id) &&
    !byExample.all.every((g) => groupMatches(words, phrase, g)) &&
    (hits.find((h) => h.id === kwTop.id)?.score ?? 0) >= (top?.score ?? 0) - 0.2
      ? kwTop
      : null;
  const lead =
    (taughtIt && hasNeeds(taughtIt, p) ? taughtIt : null) ??
    wholeChat ??
    status ??
    tie ??
    narrow ??
    (byExample && SPECIALIZE[byExample.id]?.(p) ? byId(SPECIALIZE[byExample.id]!(p)!) : byExample);
  let pick: PickRule = 'keywords';
  if (
    lead &&
    hasNeeds(lead, p) &&
    !commandReady &&
    !whyTopic &&
    (lead === taughtIt || lead === tie || lead === wholeChat || !(agreed && kwTop !== lead))
  ) {
    order = [lead, ...ranked.filter((x) => x !== lead)];
    pick =
      lead === wholeChat
        ? 'chat'
        : lead === status
          ? 'status'
          : lead === tie
            ? 'tie'
            : lead === narrow
              ? 'narrow'
              : lead !== byExample
                ? 'specialize'
                : 'examples';
  } else if (kwStrong || POLICY.mode === 'kw' || (POLICY.mode === 'mix' && !byExample))
    order = ranked;
  else if (byExample) order = ranked;
  if (commandReady) pick = 'command';
  else if (whyTopic) pick = 'why';
  // Actions (swap, move, avoid…) only when asked for — not from a long story.
  const asking = REQUEST_RE.test(` ${phrase} `) || words.length <= 8;
  // A command missing its lift ("set rest to 3 min") → ask which lift first.
  const cmdNeedsLift =
    REQUEST_RE.test(` ${phrase} `) &&
    candidates.find((it) => it.action && it.needs === 'exercise' && !hasNeeds(it, p));
  if (cmdNeedsLift && !hasLearned)
    return {
      route: 'needLift',
      intent: cmdNeedsLift.id,
      text: L('For which lift?', 'Для якої вправи?'),
      chips: loggedLifts(c)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((x) => c.fmt.exercise(x.name)),
      convo: { intent: cmdNeedsLift.id, pending: true, depth: 0, turn, q: question },
    };
  // The examples clearly disagree with the keyword pick → trust the examples.
  const kwSure =
    whyTopic ||
    (order[0] === kwTop && !!kwTop && (!!kwTop.priority || matchedWords(words, kwTop.all) >= 3));
  if (
    order.length &&
    top &&
    !commandReady &&
    !status &&
    !taughtIt &&
    !kwSure &&
    !(wholeChat && order[0] === wholeChat) &&
    !(narrow && order[0] === narrow) &&
    order[0].id !== top.id
  ) {
    const mine = hits.find((h) => h.id === order[0].id)?.score ?? 0;
    const alt = byId(SPECIALIZE[top.id]?.(p) ?? top.id);
    if (
      alt &&
      top.score >= RET_VETO &&
      top.score - mine >= RET_VETO_GAP &&
      hasNeeds(alt, p) &&
      !(alt.action && !asking)
    ) {
      order = [alt, ...order.filter((x) => x !== alt)];
      pick = 'veto';
    }
  }
  // "Did I train legs this week?" asks the log, not for advice: a topic about
  // your own record that the examples also rank near the top goes first.
  if (g.pastAsk && order.length && !LOG_TOPICS.has(order[0].id) && !commandReady && !taughtIt) {
    const lead0 = hits.find((h) => h.id === order[0].id)?.score ?? top?.score ?? 0;
    const mine = hits
      .slice(0, 6)
      .filter((h) => LOG_TOPICS.has(h.id) && h.score >= lead0 - 0.12)
      .map((h) => byId(h.id))
      .find((it): it is Intent => !!it && hasNeeds(it, p) && !it.action);
    if (mine) {
      order = [mine, ...order.filter((x) => x !== mine)];
      pick = 'pastLog';
    }
  }
  // "Do I really need to warm up?" asks for advice — not what my log says.
  if (
    g.advice &&
    !g.pastAsk &&
    order.length &&
    LOG_TOPICS.has(order[0].id) &&
    !commandReady &&
    !taughtIt &&
    !status
  ) {
    const lead0 = hits.find((h) => h.id === order[0].id)?.score ?? top?.score ?? 0;
    const advice = hits
      .slice(0, 4)
      .filter((h) => !LOG_TOPICS.has(h.id) && h.score >= lead0 - 0.05)
      .map((h) => byId(h.id))
      .find((it): it is Intent => !!it && hasNeeds(it, p) && !it.action);
    if (advice) {
      order = [advice, ...order.filter((x) => x !== advice)];
      pick = 'advice';
    }
  }
  // Told a fact, asked nothing a topic clearly answers → just the note.
  const leadSure = !!lead && (hits.find((h) => h.id === lead.id)?.score ?? 0) >= 0.55;
  // (Not when the grammar hears a question in it: "…I just want to get big, what do you think?")
  if (hasLearned && told && !g.question && !kwSure && !leadSure)
    return tag(withLearned(null), 'memo');
  for (const it0 of order) {
    // A sharper sibling for this very question ("… this week" → the week's volume).
    // (Never for a topic you taught for these very words.)
    const sharper = it0 === taughtIt ? undefined : byId(SPECIALIZE[it0.id]?.(p) ?? undefined);
    const it = sharper && hasNeeds(sharper, p) && !wrong.has(sharper.id) ? sharper : it0;
    if (it.action && !asking) continue;
    const core = it.answer(cm, p, L);
    if (!core) continue;
    const f = SMALLTALK_IDS.has(it.id) ? { text: core } : faceted(it.id, core, question, L);
    const d = tag(
      withLearned(build(it, f.text, cm, p, question, L, convo, question, f.facet)),
      it === taughtIt ? 'taught' : 'main',
    );
    // (A sharper sibling, or a later topic when the first had no answer, is its own pick.)
    return d && { ...d, pick: it === order[0] ? pick : sharper === it ? 'specialize' : 'keywords' };
  }
  // Understood by example but misses the lift/muscle → ask for it.
  if (
    byExample &&
    !hasNeeds(byExample, p) &&
    (byExample.needs === 'exercise' || byExample.needs === 'muscle')
  )
    candidates.unshift(byExample);
  // Knows the topic, misses the lift/muscle → ask, with your lifts as chips.
  const needy = candidates
    .filter(
      (it) =>
        (it.needs === 'exercise' || it.needs === 'muscle') && !hasNeeds(it, p) && !wrong.has(it.id),
    )
    .sort((a, b) => weight(b) - weight(a))[0];
  if (needy && !hasLearned) {
    const chips =
      needy.needs === 'exercise'
        ? loggedLifts(c)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4)
            .map((x) => c.fmt.exercise(x.name))
        : (['chest', 'lats', 'shoulders', 'quads'] as MuscleGroup[]).map((m) => c.fmt.muscle(m));
    return {
      route: 'needLift',
      intent: needy.id,
      text:
        needy.needs === 'exercise'
          ? L('Which lift?', 'Яка вправа?')
          : L('Which muscle?', 'Який м’яз?'),
      chips,
      convo: { intent: needy.id, pending: true, depth: 0, turn },
    };
  }
  // No topic fits, but it's a question about your numbers → compute it.
  if (lq?.strong && myLog && !told && !adviceAsked && !wrong.has('log_query')) {
    const a = queryAnswer();
    if (a) return a;
  }
  // Close, but not sure enough to answer → offer the closest topics (a
  // question that also told a fact keeps the fact, but still asks back).
  if ((!hasLearned || g.question) && top && top.score >= RET_NEAR) {
    const near = hits.filter((h) => h.score >= RET_NEAR * 0.8 && ASKS[h.id]).slice(0, 3);
    if (near.length)
      return {
        ...(hasLearned ? { learned: learned.patch } : {}),
        route: 'dym',
        intent: 'did_you_mean',
        text: unsureLine(c.temper, c.locale, question),
        chips: near.map((h) => L(ASKS[h.id][0], ASKS[h.id][1])),
        escalate: true,
        convo: {
          ...convo,
          turn,
          pendingTeach: { q: question, offered: near.map((h) => h.id) },
        },
      };
  }
  return withLearned(null);
}

/** Topics that say something general about the lift named — no data of yours in them. */
const GENERIC_LIFT_TOPICS = new Set(['squat_form', 'technique_lift', 'exercise_muscles']);

/** Topics about an age, whose keywords include bare numbers ("70"). */
const AGE_TOPICS = new Set(['k_older_lifter', 'k_teen_lifting', 'k_teen_supplements', 'age']);
const AGE_WORD =
  /\s(years?|yo|old|age|aged|років|рік|роки|вік|лет|год|года|возраст|lat|lata|wiek|metu|metų|metai|amzius|amžius|aastane|aastat|vanus)\s/u;

/** "No longer" — a pain that used to be there. */
const NO_LONGER_RE =
  /(^|\s)(anymore|any more|no longer|вже|уже|більше не|już|juz|jau|nebe\S*|enam)(\s|$|[,.!?])/iu;

/** Words around a chat line that add nothing ("YOU suck", "ти відстій", "so good"). */
const CHAT_FILLER = new Set(
  'you u ur youre are is so really such a ти ты ты ви вы такий такой ty jesteś jestes jestem tu esi sa oled olete'.split(
    ' ',
  ),
);

/** A point inside a rep (a sticking point), not weeks without progress. */
const REP_POINT =
  /\s(halfway|midway|middle|bottom|lockout|off the chest|посередині|на середині|внизу|вгорі|знизу|у низу|посередине|внизу|w połowie|w polowie|na dole|viduryje|apacioje|apačioje|keskel|pool teed)\s/u;

/** Topics that need their one idea in the message (folded, all languages). */
const KEY_IDEA: Record<string, RegExp> = {
  // The next weight is about a load: "will I be sore after heavy squats" is not.
  next_weight:
    /\s(weig\S*|heav\S*|kg|kgs|kilo\S*|lbs?|pounds?|load|plates?|heavier|increase|add|adding|go up|bump|how much|how many|progress\S*|ваг\S*|кг|кіло\S*|навантаж\S*|млинц\S*|важч\S*|додат\S*|додав\S*|збільш\S*|скільки|яку|вес\S*|сколько|тяжелее|добав\S*|ciężar\S*|ciezar\S*|obciąż\S*|obciaz\S*|dodać|dodac|zwiększ\S*|zwieksz\S*|ile|svor\S*|pridėt\S*|pridet\S*|padidint\S*|kiek|raskus\S*|kaal\S*|lisada|lisa|tõsta|tosta|kui palju|mitu|weight\S*)\s/u,
  k_cardio_order:
    /\s(before|after|first|then|order|перед|після|до|спочатку|потім|порядок|перед|после|сначала|przed|po|najpierw|kolejnosc|kolejność|pries|prieš|po|pirma|tvarka|enne|parast|pärast|kõigepealt|koigepealt|jarjekord|järjekord)\s/u,
};
/** Topics that answer "when did I last…". */
const WHEN_TOPICS = new Set(['lift_last', 'muscle_last']);

/** Topics about one day's workout — asked with that day in the question. */
const DAY_TOPICS = new Set(['today', 'tomorrow', 'next_session', 'last_session', 'day_lookup']);
/** How the body feels (en, uk, ru, pl, lt, et; folded). */
const BODY_STATE =
  /\s(sore|stiff|tired|exhausted|hurt|hurts|ache|aching|крепатур\S*|болітим\S*|болить|болітиму|втомлен\S*|болеть|болит|устал\S*|zakwas\S*|boli|bolec|zmeczon\S*|skaudes|skauda|pavarg\S*|valutab|valus|vasinud|väsinud)\s/u;
/** Day words (en, uk, ru, pl, lt, et; folded). */
const TIME_WORD =
  /\s(today|tonight|tomorrow|tmrw|yesterday|сьогодні|сьодні|завтра|вчора|учора|сегодня|вчера|dzis|dzisiaj|jutro|wczoraj|siandien|rytoj|vakar|tana|täna|homme|eile)\s/u;

/** Topics that read your own record (what you did), not advice. */
const LOG_TOPICS = new Set([
  ...MY_DATA,
  'heaviest',
  'last_session',
  'week',
  'streak',
  'total',
  'month',
  'muscle_last',
  'lift_last',
  'lift_count',
  'prs_today',
  'bodyweight',
  'bw_trend',
  'best_weekday',
  'rest_actual',
  'warmup_habit',
  'cardio_done',
  'longest_session',
  'compare_weeks',
  'then_vs_now',
  'range_summary',
  'range_bw',
  'day_lookup',
  'consistency',
  'favourite_lift',
  'my_gym',
  'volume_muscle',
  'weak',
]);

/** A general topic that has a sharper sibling when the question names a lift. */
const SPECIALIZE: Record<string, (p: Parsed) => string | null> = {
  // "Czym zastąpić przysiady?" — a named lift wants its alternatives, not the app's swap button.
  swap: (p) => (p.exercise ? 'alternatives' : null),
  // "My chest isn't growing" — the muscle's own topic, not the arms one.
  arms: (p) =>
    p.muscle && !['biceps', 'triceps', 'forearms'].includes(p.muscle) ? 'grow_muscle' : null,
  technique: (p) => (p.exercise ? 'technique_lift' : null),
  squat_form: (p) => (p.exercise && !/squat|присід/i.test(p.exercise) ? 'technique_lift' : null),
  range_muscle: (p) => (p.muscle && p.range?.label[0] === 'this week' ? 'volume_muscle' : null),
  // "How did Friday's session go?" names the day — that day's workout, not "which day do I train".
  best_weekday: (p) =>
    p.weekdays?.length === 1 &&
    !/(usually|most|often|always|every|зазвичай|найчастіш\S*|часто|завжди|обычно|чаще|zwykle|najczęściej|najczesciej|dažniausiai|dazniausiai|paprastai|tavaliselt|kõige|koige)/u.test(
      p.phrase,
    )
      ? 'day_lookup'
      : null,
};

/** A lift or a record told, not asked ("benched 100 today", "пожав сьогодні 100", "new PR"). */
const PR_TOLD =
  /\s((i )?(just )?(benched|squatted|deadlifted|pressed|repped|pulled) (\S+ )?\d+\S*|(hit|got|set|smashed|broke|crushed) (a |my )?(new )?(pr|pb|record|personal best)|new (pr|pb|personal best|record)|(пожав|вижав|присів|пожала|вижала|присіла|пожал|выжал|присел) (\S+ )?\d+\S*|(новий|новый) (рекорд|пр)|(побив|поставив|побила|поставила|побил|поставил) (\S+ )?рекорд)\s/u;

/** How much more of the message the keyword pick must cover to overrule the examples. */
const COVER_GAP = 0.25;

/** Skipped between a "not" and the word it negates ("don't WANT TO lose weight"). */
const NEG_FILLER = new Set(
  'want to a an the really very that so too be being am is are i m хочу хочеться треба мені я вже ще'.split(
    ' ',
  ),
);
const NEG_WORDS = new Set([
  'not',
  'no',
  'never',
  'dont',
  'doesnt',
  'isnt',
  'arent',
  'не',
  'ні',
  'ни',
  'нет',
  'ніколи',
]);

/** Topics whose own words carry the "not" ("no time", "нема сил") — a "not" is their point. */
const SELF_NEG = /(^|\s)(no|not|dont|don.?t|cant|can.?t|never|не|нема|немає|без)(\s|$)/u;

/** Every word the topic matched is said with a "not" ("I'm not a beginner", "не хочу схуднути"). */
function negatedTopic(it: Intent, words: string[]): boolean {
  if (it.all.some((g) => g.some((k) => SELF_NEG.test(k)))) return false;
  let any = false;
  for (let i = 0; i < words.length; i++) {
    const starts = (k: string) => {
      const parts = k.split(' ');
      return parts.every((x, j) => words[i + j] !== undefined && wordMatches(words[i + j], x));
    };
    if (!it.all.some((g) => g.some(starts))) continue;
    any = true;
    let j = i - 1;
    while (j >= 0 && NEG_FILLER.has(words[j])) j--;
    // "i'm not a beginner": im · NOT · a · beginner
    if (!(j >= 0 && NEG_WORDS.has(words[j]))) return false;
  }
  return any;
}

/** Retrieval thresholds (0..1). */
let RET_MIN = 0.3;
let RET_VETO = 0.4;
let RET_VETO_GAP = 0.05;
let RET_HIGH = 0.45;
let RET_HIGH_MARGIN = 0.005;
let RET_MARGIN = 0.025;
let RET_NEAR = 0.2;
export const POLICY: { mode: 'mix' | 'ret' | 'kw' } = { mode: 'mix' };
export function __tune(t: {
  min?: number;
  margin?: number;
  near?: number;
  high?: number;
  highMargin?: number;
  veto?: number;
  vetoGap?: number;
}) {
  RET_VETO = t.veto ?? RET_VETO;
  RET_VETO_GAP = t.vetoGap ?? RET_VETO_GAP;
  RET_HIGH = t.high ?? RET_HIGH;
  RET_HIGH_MARGIN = t.highMargin ?? RET_HIGH_MARGIN;
  RET_MIN = t.min ?? RET_MIN;
  RET_MARGIN = t.margin ?? RET_MARGIN;
  RET_NEAR = t.near ?? RET_NEAR;
}

/**
 * "Did you mean…": the closest topics when nothing fits for sure — scored by
 * how many keyword groups match (partially) and how specific the words are.
 */
export function didYouMean(
  question: string,
  c: AskCtx,
  exclude: string[] = [],
): { id: string; ask: string }[] {
  const out = didYouMeanAll(question, c).filter((x) => !exclude.includes(x.id));
  return out.slice(0, 3);
}

function didYouMeanAll(question: string, c: AskCtx): { id: string; ask: string }[] {
  const words = tokens(question);
  const phrase = normalize(question);
  if (!words.length) return [];
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  // Closest by example first; keyword overlap fills in.
  const near = retrieve(question, 8).filter(
    (h) => h.score >= 0.2 && ASKS[h.id] && !byId(h.id)?.maxWords,
  );
  if (near.length)
    return near.slice(0, 5).map((h) => ({ id: h.id, ask: L(ASKS[h.id][0], ASKS[h.id][1]) }));
  const scored: { id: string; score: number }[] = [];
  for (const it of ALL_INTENTS()) {
    const ask = ASKS[it.id];
    if (!ask || it.maxWords) continue;
    const hit = it.all.filter((g) => groupMatches(words, phrase, g)).length;
    if (!hit) continue;
    const mw = matchedWords(words, it.all);
    scored.push({ id: it.id, score: hit / it.all.length + mw * 0.3 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => ({ id: x.id, ask: L(ASKS[x.id][0], ASKS[x.id][1]) }));
}

/**
 * Answer from Atlas's own base, following the conversation. Null → nothing
 * fits: hand over to Gemini (or say so). Two questions in one message get two
 * answers; Latin-typed Ukrainian gets a second try in Cyrillic; Polish,
 * Lithuanian, Estonian and Russian are mapped onto known words first.
 */
/** Where to start: from your log if there is one, the basics if not. */
export function startChips(c: AskCtx, L: Tr): string[] {
  const lifts = loggedLifts(c).sort((a, b) => b.count - a.count);
  if (!lifts.length)
    return [
      L('Make me a plan', 'Склади мені план'),
      L('How to squat properly?', 'Як правильно присідати?'),
      L('Find an exercise', 'Знайди вправу'),
    ];
  const top = c.fmt.exercise(lifts[0].name);
  return [
    L('What should I train today?', 'Що тренувати сьогодні?'),
    L(`How is my ${top} going?`, `Як прогресує ${top}?`),
    L('How was my week?', 'Як мій тиждень?'),
  ];
}

export function answerLocally(question0: string, c: AskCtx, convo: Convo = {}): LocalAnswer | null {
  const question = expandSlang(question0);
  askingCtx = c;
  parsedHere.clear();
  featuresHere.clear();
  try {
    const d = answerDraft(question, c, convo);
    return d && settle(d, question);
  } finally {
    askingCtx = null;
  }
}
/**
 * The context of the message being answered (answering is synchronous): a
 * topic's confidence weighs it only against rivals that could answer this
 * very message — "when did I last squat" has no rival in "when did I last
 * train <a muscle>" when no muscle is named.
 */
let askingCtx: AskCtx | null = null;
/** Readings of this message parsed / weighed for the confidence (one message at a time). */
const parsedHere = new Map<string, Parsed>();
const featuresHere = new Map<string, Features>();

/** The draft's confidence settled (see confidence.ts); the route stays inside. */
function settle(d: Draft, question: string): LocalAnswer {
  const { route, confidence, pick, rank: _rank, ...rest } = d;
  void _rank;
  const out = {
    ...rest,
    // (The clear-lead floor only for the message as written — a reading of a
    // part or a translation was settled on its own text already.)
    confidence: confidence ?? confidenceOf(route, rest.intent, question, pick, true),
  };
  if (route) ROUTES.set(out, route);
  if (pick) PICKS.set(out, pick);
  return out;
}
/** Which routing rule put the topic first (for the evaluation and calibration only). */
export const PICKS = new WeakMap<LocalAnswer, PickRule>();
/** How each answer was reached (for the evaluation and calibration only). */
export const ROUTES = new WeakMap<LocalAnswer, Route>();

/**
 * Settle a draft's confidence on the text it actually answered (a reading in
 * Cyrillic, a mapped language), a little lower for the detour.
 */
function settleAt(d: Draft | null, text: string, factor = 1, whole = false): Draft | null {
  if (!d || d.confidence !== undefined) return d;
  const confidence = confidenceOf(d.route, d.intent, text, d.pick, whole) * factor;
  return {
    ...d,
    confidence,
    rank: whole ? confidenceOf(d.route, d.intent, text, d.pick) * factor : confidence,
  };
}

/** How sure: the route's own record, or — for a topic — what backs the pick. */
function confidenceOf(
  route: Route | undefined,
  intent: string,
  question: string,
  pick?: PickRule,
  final = false,
): number {
  if (route && route !== 'main') return routeConfidence(route);
  const it = byId(intent);
  if (!it) return routeConfidence(route ?? 'main');
  const c = askingCtx;
  // (Parsed only when a rival needs a lift / muscle — parsing is the costly part.)
  const parsed = (): Parsed => {
    let p = parsedHere.get(question);
    if (!p) {
      p = parse(question, c!);
      parsedHere.set(question, p);
    }
    return p;
  };
  // A command topic ("set rest to 3 min") is no rival to a question that asks
  // nothing to be done; app help is no rival to a message that names neither
  // the app nor a how / where.
  const command = REQUEST_RE.test(` ${normalize(question)} `) || understand(question).command;
  const cue = appCue(question);
  const able = c
    ? (id: string) => {
        const x = byId(id);
        if (!x) return true;
        if (x.action && !command) return false;
        if (x.id.startsWith('app_') && !cue && !it.id.startsWith('app_')) return false;
        // (Only a missing lift / muscle rules a rival out — two lifts or a
        // window may just be read less well than the rival was meant.)
        return (x.needs !== 'exercise' && x.needs !== 'muscle') || hasNeeds(x, parsed());
      }
    : undefined;
  // (One message weighs the same reading more than once: choosing, then settling.)
  const key = `${intent}\u0000${question}\u0000${c ? 1 : 0}`;
  let f = featuresHere.get(key);
  if (!f) {
    f = features(question, it, ALL_INTENTS(), able);
    featuresHere.set(key, f);
  }
  return topicConfidence(f, pick, final);
}

function answerDraft(question0: string, c: AskCtx, convo: Convo = {}): Draft | null {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  // "Nothing hurts, what should I train?" — the "nothing hurts" is context, the question is the rest.
  // (Not "it doesn't hurt ANYMORE, when can I deadlift again?" — that is a way back from an injury.)
  const np = NO_LONGER_RE.test(question0) ? null : NO_PAIN_CLAUSE.exec(question0);
  const rest = np ? question0.replace(np[0], ' ').trim() : '';
  const question = np && tokens(rest).length >= 2 ? rest : question0;
  const turn = (convo.turn ?? 0) + 1;
  if (!convo.flow && CONTINUER_RE.test(question)) {
    if (convo.intent && convo.intent !== 'did_you_mean')
      return answerDraft(L('tell me more', 'розкажи більше'), c, convo);
    return {
      route: 'nudge',
      intent: 'nudge',
      text: L(
        'Ask me anything about your training — or tap one of these.',
        'Питай про тренування — або тапни щось із цього.',
      ),
      chips: startChips(c, L),
      convo: { ...convo, turn },
    };
  }
  // "Ні" / "no" — fine, the door stays open.
  // "…and what do I do about it?" right after a lift's progress → that lift's fixes.
  if (
    !convo.flow &&
    convo.exercise &&
    (convo.intent === 'progress_lift' || convo.intent === 'log_query') &&
    (/^\s*(а |і |и |and |so )?(що|шо|что|what)\s+(мені\s+)?(робити|делать|to do|do i do|should i do|now)/iu.test(
      question,
    ) ||
      // "how do I fix it?", "як це виправити?", "jak to poprawić?" — the same lift's fixes.
      (tokens(question).length <= 7 &&
        /(how (do|can|should) i (fix|improve|break|get past|push through|unstick)|fix (it|this|that)|як (це |його |її )?(виправити|зрушити|покращити|пробити)|що з (цим|ним|цим робити)|как (это |его )?(исправить|сдвинуть|пробить)|что с этим|jak (to |go )?(naprawić|naprawic|poprawić|poprawic|przełamać|przelamac)|kaip (tai |ją |jį )?(pataisyti|pagerinti|pajudinti)|kuidas (seda )?(parandada|parendada|edasi))/iu.test(
          question,
        )))
  ) {
    const fix = explainLift(c, convo.exercise, L);
    if (fix)
      return {
        route: 'follow',
        intent: 'progress_lift',
        text: fix,
        chips: chipsFor('plateau', L, {
          q: convo.q ?? question,
          p: { ...parse(question, c), exercise: convo.exercise },
          c,
        }),
        convo: { ...convo, turn },
      };
  }
  if (!convo.flow && NO_RE.test(question))
    return {
      route: 'ack',
      intent: 'ack',
      text: L('Fine. Ask when you need me.', 'Гаразд. Треба буде — питай.'),
      chips:
        convo.intent && convo.q
          ? chipsFor(convo.intent, L, { q: convo.q, p: parse(convo.q, c), c })
          : startChips(c, L),
      convo: { ...convo, turn },
    };
  if (
    !convo.flow &&
    !convo.intent &&
    ACK_RE.test(question) &&
    !/^(ok|ок|окей|добре|гаразд)/iu.test(question.trim())
  )
    return {
      route: 'nudge',
      intent: 'nudge',
      text: L(
        'Yes — to what? Ask away, or tap one of these.',
        'Так — а що саме? Питай, або тапни щось із цього.',
      ),
      chips: startChips(c, L),
      convo: { ...convo, turn },
    };
  if (
    !convo.flow &&
    convo.intent &&
    ACK_RE.test(question) &&
    !convo.pending &&
    convo.intent !== 'did_you_mean'
  ) {
    const lines = ACK_LINE[c.temper]?.[c.locale === 'uk' ? 1 : 0] ?? ACK_LINE[3][1];
    const topic = convo.q ? parse(convo.q, c) : parse(question, c);
    if (convo.exercise && !topic.exercise) topic.exercise = convo.exercise;
    return {
      route: 'ack',
      intent: 'ack',
      text: lines[turn % lines.length],
      chips: chipsFor(convo.intent, L, { q: convo.q ?? question, p: topic, c }),
      convo: { ...convo, turn },
    };
  }
  // Two-word questions made only of "small" words ("ти хто") — the retrieval can't see them.
  const bare = normalize(question);
  const raw1 =
    /^(ти хто|хто ти|ти хто такий|хто ти такий|кто ты|ты кто|who are you|who r u)$/u.test(bare)
      ? tag(answerAsDraft('who', question, c, convo), 'rule')
      : answerRaw(question, c, convo);
  // "Is it safe?", "а він не шкідливий?", "how do I know I'm in it?" — the
  // pronoun stands for what the last message was about: read the message with
  // that put in its place, and keep the reading that is surer.
  const raw0 = backReading(question, raw1, c, convo) ?? raw1;
  // "How's my progress?" with no lift named → the overall picture, not "Which lift?".
  const overall =
    raw0?.intent === 'progress_lift' && raw0.convo.pending && finishedOf(c).length
      ? answerAsDraft('how_am_i_doing', question, c, convo)
      : null;
  const raw = overall ?? raw0;
  // "ааааа", "asdfgh", "хз" — nothing to hand on; a way back in instead of silence.
  const a0: Draft | null =
    raw ??
    (tokens(question).length <= 2 && question.trim().length <= 14
      ? {
          route: 'nudge',
          intent: 'nudge',
          text: L(
            "Didn't catch that. Ask me anything about training — or tap one of these.",
            'Не зовсім зрозумів. Питай про тренування — або тапни щось із цього.',
          ),
          chips: startChips(c, L),
          convo: { ...convo, turn },
        }
      : null);
  // No workouts yet → questions about "my numbers" get a way in, not "Which lift?".
  const a: Draft | null =
    a0 &&
    !finishedOf(c).length &&
    (MY_DATA.has(a0.intent) ||
      (a0.convo.pending && !byId(a0.intent)?.action) ||
      (a0.intent === 'did_you_mean' &&
        /(^|\s)(my|мій|мої|моя|моє|мого|мене|мой|мои|моя)(\s|$)/iu.test(question)))
      ? {
          route: 'onboarding',
          intent: 'onboarding',
          text: L(
            "There's nothing in your log yet — log your first workout and I'll track every lift from it: progress, records, what to change. Until then I can help with technique, a plan, rest and recovery.",
            'У журналі ще порожньо — запиши перше тренування, і я відстежуватиму кожну вправу: прогрес, рекорди, що змінити. А поки можу допомогти з технікою, планом, відпочинком і відновленням.',
          ),
          chips: startChips(c, L),
          convo: { turn },
        }
      : a0;
  if (!a) return a;
  const empty = !finishedOf(c).length;
  let a1 = a;
  // First workout still ahead → "what today?" gets a starter, not "all fresh".
  if (empty && a1.intent === 'today')
    a1 = {
      ...a1,
      text: L(
        "First workout? Go full-body: a squat, a press, a row or pull-down, a hip hinge — 3 sets of 8–12 each, light enough that every rep is clean. Log it, and from then on I'll pick what's fresh.",
        'Перше тренування? Роби все тіло: присід, жим, тяга до себе чи зверху, нахил із прямою спиною — по 3 підходи на 8–12, з вагою, де кожен повтор чистий. Запиши — і далі я підказуватиму, що свіже.',
      ),
    };
  // No log → chips about "my progress / my week" lead nowhere.
  if (empty && a1.chips?.some((x) => DATA_CHIP.test(x)))
    a1 = {
      ...a1,
      chips: [
        ...new Set([...a1.chips.filter((x) => !DATA_CHIP.test(x)), ...startChips(c, L)]),
      ].slice(0, 3),
    };
  // "Thanks" / "ok" after a topic → that topic's next steps, not the generic menu.
  if ((a1.intent === 'thanks' || a1.intent === 'ack') && convo.intent && convo.q && !convo.flow) {
    const topic = parse(convo.q, c);
    if (convo.exercise && !topic.exercise) topic.exercise = convo.exercise;
    a1 = {
      ...a1,
      chips: chipsFor(convo.intent, L, { q: convo.q, p: topic, c }),
      convo: { ...convo, turn },
    };
  }
  // Picked one of the "did you mean…" options → remember that wording.
  const pt = convo.pendingTeach;
  let out = a1;
  // Only when the first wording carries what that topic needs (a lift, a
  // window…) — otherwise the same words could never answer it on their own.
  const picked = byId(a1.intent);
  if (
    pt &&
    pt.offered.includes(a1.intent) &&
    a1.intent !== 'did_you_mean' &&
    picked &&
    hasNeeds(picked, parse(pt.q, c))
  ) {
    const base = a1.learned ? mergeMemory(c.mem, a1.learned) : c.mem;
    out = { ...a1, learned: { ...(a1.learned ?? {}), ...teach(base, pt.q, a1.intent, c.now) } };
  }
  // Ill → offer to log it (plan pauses, streak kept), unless already logged.
  if (out.intent === 'sick' && !out.action && !activeIllness(c))
    out = { ...out, action: { type: 'illness' }, chips: undefined };
  // "By the way…" — something noticed in the log, now and then (not in a soft spell).
  const softTill = convo.softUntil ?? out.convo.softUntil;
  const soft = softTill !== undefined && (out.convo.turn ?? 0) <= softTill;
  // Mid-set answers stay short — no side notes while the bar is loaded.
  if (!soft && !out.intent.startsWith('live_')) out = withInsight(out, question, c, convo);
  if (soft && out.convo.softUntil === undefined)
    out = { ...out, convo: { ...out.convo, softUntil: softTill } };
  // The offer holds for the very next message only.
  if (out.intent !== 'did_you_mean' && out.convo.pendingTeach) {
    const { pendingTeach: _drop, ...rest } = out.convo;
    void _drop;
    out = { ...out, convo: rest };
  }
  // Topic stack: a new topic pushes the last one down (three kept).
  const was = convo.intent;
  const topicLike = (id?: string) =>
    !!id && !!byId(id) && !SMALLTALK_IDS.has(id) && id !== 'did_you_mean';
  if (topicLike(was) && out.convo.intent !== was && topicLike(out.convo.intent))
    out = {
      ...out,
      convo: {
        ...out.convo,
        prev: [
          { intent: was!, exercise: convo.exercise, muscle: convo.muscle, q: convo.q },
          ...(convo.prev ?? []),
        ].slice(0, 3),
      },
    };
  else if (convo.prev && !out.convo.prev)
    out = { ...out, convo: { ...out.convo, prev: convo.prev } };
  // App tips go on where this conversation left off ("more tips").
  return withAppTips(out, convo.appTips, L);
}

/** How sure a draft is (0 for "did you mean…" and nudges). */
function sureOfDraft(d: Draft | null | undefined, text: string): number {
  return d && d.intent !== 'did_you_mean' && d.intent !== 'nudge'
    ? (d.rank ?? d.confidence ?? confidenceOf(d.route, d.intent, text))
    : 0;
}

/**
 * A short follow-up whose pronoun points back at the last topic ("is it
 * safe?", "а він не шкідливий для нирок?", "czy to bezpieczne?"): the message
 * read with the thing it points at in the pronoun's place — when that reading
 * is sure and surer than the message alone.
 */
function backReading(question: string, raw: Draft | null, c: AskCtx, convo: Convo): Draft | null {
  if (convo.flow || !convo.q || !convo.intent || convo.intent === 'did_you_mean') return null;
  if (!byId(convo.intent) || SMALLTALK_IDS.has(convo.intent)) return null;
  if (tokens(question).length > 10 || safetySignal(question)) return null;
  const ante = antecedent(convo.q);
  const text = ante && resolveAnaphor(question, ante);
  if (!text) return null;
  // Read as a question of its own: the thing is named now.
  const alt = settleAt(
    answerRaw(text, c, { turn: convo.turn, softUntil: convo.softUntil }),
    text,
    0.97,
  );
  const a = sureOfDraft(alt, text);
  return alt && a >= CONFIDENT && a > sureOfDraft(raw, question) ? alt : null;
}

/** A focus reading answers on its own when at least this sure. */
const FOCUS_SURE = CONFIDENT;

/**
 * The grammar's reading first: when the question lives in one part of the
 * message (after "but", the kept side of "not X, Y", a question embedded under
 * "asks", the condition of "what should I do?"), that part is routed — the
 * whole message only when the part alone is unsure.
 */
function answerRaw(question: string, c: AskCtx, convo: Convo = {}): Draft | null {
  const u = !convo.flow && !safetySignal(question) ? understand(question) : null;
  if (!u?.focus) return answerRawText(question, c, convo);
  const sure = (d: Draft | null, text: string) =>
    d && d.intent !== 'did_you_mean' && d.intent !== 'nudge'
      ? (d.rank ?? d.confidence ?? confidenceOf(d.route, d.intent, text))
      : 0;
  const fd = settleAt(answerRawText(u.focus, c, convo), u.focus);
  const fs = sure(fd, u.focus);
  if (fd && fs >= FOCUS_SURE) return fd;
  // What the message set aside ("I don't want to lose weight, …", "forget
  // cardio, …") must not come back through the whole message.
  if ((u.focusWhy === 'alternative' || u.focusWhy === 'dismiss') && fd) return fd;
  // The part the grammar found asking is the question: the whole message only
  // when that part alone finds no topic at all.
  if (fd && fs > 0) return fd;
  return answerRawText(question, c, convo) ?? fd;
}

function answerRawText(question: string, c: AskCtx, convo: Convo = {}): Draft | null {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const emoji = emojiReply(c, question, L);
  if (emoji)
    return {
      route: 'emoji',
      intent: 'emoji',
      text: emoji,
      convo: { ...convo, turn: (convo.turn ?? 0) + 1 },
    };
  // Several questions in one message — each answered, in order.
  const multi = !convo.flow && !safetySignal(question) ? answerParts(question, c, convo, L) : null;
  if (multi) return multi;
  const direct = answerOne(question, c, convo);
  // Latin letters may be Ukrainian ("shcho trenuvaty sohodni") — the reading
  // whose examples fit better wins.
  if (!hasCyrillic(question) && /[a-z]/i.test(question)) {
    const tr = translitToUk(question);
    const fit = (q: string) => retrieve(q)[0]?.score ?? 0;
    const english = tokens(question).some((t) => EN_COMMON.has(t));
    // Polish / Lithuanian / Estonian aren't transliterated Ukrainian.
    const foreign =
      /^(pl|lt|et)$/.test(detectLang(question) ?? '') ||
      /^(pl|lt|et)$/.test(understand(question).lang) ||
      tokens(question).some((t) => OTHER_LATIN.has(t));
    // The Cyrillic reading can only win for non-foreign text, and for English
    // only when the direct reading found nothing — else don't spend on it.
    const ukUseful =
      tr !== question && !foreign && (!english || !direct || direct.intent === 'did_you_mean');
    // (A transliteration or a translation is the whole message in other letters or words.)
    const uk = ukUseful
      ? settleAt(answerOne(tr, c, convo, understand(question)), tr, 0.95, true)
      : null;
    // …or Russian typed in Latin ("skolko otdyhat") — read through the Russian word map.
    const ruText = !english && !foreign ? toKnownLanguage(translitToRu(question)) : null;
    const ru = ruText
      ? settleAt(answerOne(ruText, c, convo, understand(question)), ruText, 0.9, true)
      : null;
    const sure = (a: Draft | null) =>
      a && a.intent !== 'did_you_mean'
        ? (a.rank ?? a.confidence ?? confidenceOf(a.route, a.intent, question))
        : 0;
    if (ru && sure(ru) >= CONFIDENT && sure(ru) > sure(direct) && sure(ru) > sure(uk)) return ru;
    if (
      uk &&
      !foreign &&
      uk.intent !== 'did_you_mean' &&
      // English words in it ("feeling sore…") → only a sure Ukrainian reading.
      (!english || (uk.rank ?? uk.confidence ?? 0) >= CONFIDENT) &&
      (!direct || direct.intent === 'did_you_mean' || (!english && fit(tr) > fit(question) + 0.05))
    )
      return uk;
  }
  // Polish / Lithuanian / Estonian the examples only half-know: their words
  // mapped onto the English ones the base knows may read surer.
  const lang = understand(question).lang;
  // (Russian too: the Ukrainian examples only half-know it.)
  const other = lang === 'pl' || lang === 'lt' || lang === 'et' || lang === 'ru';
  const sureOf = (d: Draft | null, text: string) =>
    d && d.intent !== 'did_you_mean' && d.intent !== 'nudge'
      ? (d.rank ?? d.confidence ?? confidenceOf(d.route, d.intent, text))
      : 0;
  if (direct && !(other && sureOf(direct, question) < CONFIDENT)) return direct;
  const known = toKnownLanguage(question);
  if (known && known !== question && known !== normalize(question)) {
    const a = settleAt(answerOne(known, c, convo, understand(question)), known, 0.95, true);
    if (a && (!direct || sureOf(a, known) > sureOf(direct, question))) {
      // The two readings name different topics — whichever wins, it's a guess.
      const split =
        !!direct &&
        direct.intent !== 'did_you_mean' &&
        direct.intent !== 'nudge' &&
        direct.intent !== a.intent &&
        // (A follow-up on the topic at hand — "kodėl?" — against a stray
        // reading of one foreign word is no disagreement.)
        !(a.route === 'follow' && sureOf(direct, question) < 0.5);
      return split ? { ...a, confidence: Math.min(sureOf(a, known), 0.74) } : a;
    }
  }
  if (direct) return direct;
  if (!hasCyrillic(question) && /[a-z]/i.test(question)) {
    const tr = translitToUk(question);
    const uk = settleAt(
      answerOne(tr, { ...c, locale: c.locale }, convo, understand(question)),
      tr,
      0.9,
    );
    if (uk) return uk;
  }
  return null;
}

/** Topics to offer an outside classifier: the closest by meaning first. */
export function topicMenu(question: string, c: AskCtx): { id: string; ask: string }[] {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const near = retrieve(question, 25).map((h) => h.id);
  const ids = [...new Set([...near, ...Object.keys(ASKS)])].filter((id) => ASKS[id]).slice(0, 60);
  return ids.map((id) => ({ id, ask: L(ASKS[id][0], ASKS[id][1]) }));
}

/**
 * Answer as a given topic (picked by the classifier or elsewhere). Null when
 * the topic needs a lift/window the question doesn't carry, or has nothing.
 */
export function answerAs(
  id: string,
  question: string,
  c: AskCtx,
  convo: Convo = {},
): LocalAnswer | null {
  const d = answerAsDraft(id, question, c, convo);
  return d && settle(d, question);
}

function answerAsDraft(id: string, question: string, c: AskCtx, convo: Convo = {}): Draft | null {
  const it = byId(id);
  if (!it) return null;
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const p = parse(question, c);
  if (!hasNeeds(it, p)) return null;
  const core = it.answer(c, p, L);
  if (!core) return null;
  const f = faceted(it.id, core, question, L);
  return build(it, f.text, c, p, question, L, convo, question, f.facet);
}

/** Answers that never get a "by the way" (pain, small talk, questions back). */
const NO_TIP = new Set([
  'did_you_mean',
  'emoji',
  'memory_note',
  'pain',
  'pain_check',
  'injury_status',
  'find_exercise',
  'flow_cancel',
  'sick',
]);

function withInsight(a: Draft, question: string, c: AskCtx, convo: Convo): Draft {
  const turn = a.convo.turn ?? 0;
  const keep = { tips: convo.tips, tipTurn: convo.tipTurn };
  const base = {
    ...a,
    convo: {
      ...keep,
      ...a.convo,
      tips: a.convo.tips ?? convo.tips,
      tipTurn: a.convo.tipTurn ?? convo.tipTurn,
    },
  };
  const it = byId(a.intent);
  if (
    NO_TIP.has(a.intent) ||
    SMALLTALK_IDS.has(a.intent) ||
    it?.neutral ||
    a.action ||
    a.convo.pending
  )
    return base;
  if (convo.tipTurn !== undefined && turn - convo.tipTurn < TIP_EVERY) return base;
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const told = new Set(convo.tips ?? []);
  const all = insights(c, L).filter((x) => !told.has(x.id));
  if (!all.length) return base;
  const subject = a.convo.exercise ?? a.convo.muscle ?? '';
  const onSubject = all.find((x) => x.about && x.about === subject);
  // About what we're discussing → always; otherwise about one answer in three.
  const pick =
    onSubject ?? (hashId(question) % 3 === 0 ? all[hashId(question) % all.length] : null);
  if (!pick) return base;
  return {
    ...base,
    text: `${a.text}\n\n${pick.text}`,
    chips: [pick.chip, ...(a.chips ?? []).filter((x) => x !== pick.chip)].slice(0, 3),
    convo: { ...base.convo, tips: [...told, pick.id], tipTurn: turn },
  };
}

/** An open illness period covering today. */
function activeIllness(c: AskCtx): boolean {
  const today = Math.floor(c.now / 86_400_000);
  return c.s.restPeriods.some(
    (r) => r.mode === 'illness' && r.startDay <= today && (r.open || r.endDay >= today),
  );
}

/** Places to split "X and Y" into two questions (both halves 2+ words). */
/** A plan, two lifts side by side, or "what if…" — built from the pieces of the message. */
function compose(
  question: string,
  p: Parsed,
  c: AskCtx,
  convo: Convo,
  L: Tr,
  turn: number,
): Draft | null {
  const f = parseFrame(question, c.mem, c.now);
  const done = (
    intent: string,
    r: { text: string; chips?: string[]; action?: AtlasAction },
    extra: Partial<Convo> = {},
  ): Draft => {
    const learned = learn(p.words, p.phrase, c.mem, c.now, p.exercise, c.fmt.exercise, {
      raw: question,
    }).patch;
    return {
      intent,
      text: r.text,
      chips: r.chips,
      action: r.action,
      ...(Object.keys(learned).length ? { learned } : {}),
      convo: {
        ...convo,
        intent,
        turn,
        q: question,
        exercise: p.exercise,
        muscle: p.muscle,
        depth: 0,
        told: [],
        ...extra,
      },
    };
  };
  // "So which one is better for me?" right after a comparison → the verdict alone.
  if (
    convo.intent === 'compare_ex' &&
    convo.pair &&
    p.words.length <= 8 &&
    /(better|best|choose|pick|which|what should|краще|кращ|лучше|обрати|вибрати|выбрать|яку|яка|який|какую|какой)/u.test(
      p.phrase,
    )
  ) {
    const r = compareAnswer(c, convo.pair[0], convo.pair[1], L);
    if (r?.verdict)
      return { intent: 'compare_ex', text: r.verdict, chips: r.chips, convo: { ...convo, turn } };
  }
  // "Make me a 3-day plan without a barbell" — and its follow-ups ("and 4 days?", "at home?").
  const planFollow =
    (convo.intent === 'plan_build' || convo.intent === 'plan') &&
    !!convo.frame &&
    p.words.length <= 7 &&
    (f.days !== null ||
      f.minutes !== null ||
      f.kit.length > 0 ||
      f.without.length > 0 ||
      f.sore !== null);
  // A plan for today / now is today's workout, not a week.
  const todayish =
    /(сьогодн|зараз|на завтра|завтра|today|tonight|right now|tomorrow|сегодня|dzisiaj|šiandien|täna)/u.test(
      p.phrase,
    );
  const split = SPLIT_NAME.exec(p.phrase);
  if (split && f.days === null) f.days = SPLIT_DAYS[split[0]] ?? 3;
  const specific =
    !!split ||
    f.days !== null ||
    f.minutes !== null ||
    f.kit.length > 0 ||
    f.without.length > 0 ||
    f.sore !== null ||
    f.goal !== null ||
    f.bar;
  const planTopic = () => {
    const [h1] = retrieve(question);
    return !!h1 && (h1.id === 'plan' || h1.id === 'why_plan') && h1.score >= RET_MIN;
  };
  if ((f.wantsPlan && !todayish && (specific || planTopic())) || planFollow) {
    const frame = planFollow ? mergeFrames(convo.frame!, f) : f;
    const r = programAnswer(c, frame, L);
    // Nothing specific asked → it's the programme topic, written out for you.
    return done(specific || planFollow ? 'plan_build' : 'plan', r, {
      frame,
      q: planFollow ? (convo.q ?? question) : question,
    });
  }
  // "Bench or push-ups?", "RDL vs good morning" — from the library and your log.
  // (Progress between two of YOUR lifts stays with compare_lifts.)
  // "Dumbbell or barbell bench?" — one lift named, two kits.
  const kits = f.kit.filter((k) => k !== 'home');
  const kitPair =
    f.compares && p.exercise && kits.length >= 2 && (p.exercises?.length ?? 0) < 2
      ? [variantOf(p.exercise, kits[0]) ?? p.exercise, variantOf(p.exercise, kits[1]) ?? p.exercise]
      : null;
  const two = kitPair && kitPair[0] !== kitPair[1] ? kitPair : (p.exercises ?? []);
  const better =
    /(better|best|choose|pick|краще|кращ|ефективніш|лучше|обрати|вибрати|выбрать|lepsz|geriau|parem)/u.test(
      p.phrase,
    );
  const mine = new Set(loggedLifts(c).map((x) => x.name));
  // A topic written for this very pair ("squat or leg press") knows it best.
  // A topic written for this question (a pair, or a narrow one like "swing: squat or hinge?") knows it best.
  const pairTopic = () => {
    const [h1] = retrieve(question);
    return (
      !!h1 &&
      ((PAIR_TOPICS.has(h1.id) && h1.score >= RET_MIN && PAIR_NAMED[h1.id].test(p.phrase)) ||
        (h1.score >= OWN_TOPIC && !COMPARE_OK.has(h1.id) && !ONE_LIFT_TOPICS.has(h1.id)))
    );
  };
  if (
    f.compares &&
    two.length >= 2 &&
    // Two of YOUR lifts, "vs" → how they compare in your log (compare_lifts).
    // A choice is asked ("which is better", "… for chest"), or two lifts for the same muscle.
    (better || !!p.muscle || sameMuscle(two[0], two[1])) &&
    (better || !two.slice(0, 2).every((x) => mine.has(x) || !!resolveMyLift(x, loggedLifts(c)))) &&
    !/(прогрес|progress|рост|grow|сильніш|stronger|weaker|слабш|ratio|співвідн)/u.test(p.phrase) &&
    !pairTopic()
  ) {
    const r = compareAnswer(c, two[0], two[1], L);
    if (r) return done('compare_ex', r, { exercise: two[0], pair: [two[0], two[1]] });
  }
  // "How do I bench?" — plain "how do I <lift>" is the technique, not the warm-up or the weights.
  const HOW_DO =
    /^(how (do|should|would|can) (i|you|we|one) (do |perform )?|how to (do |perform )?|як (правильно |треба )?(робити|виконувати|робиться|роблять|жати|присідати|тягнути|тягти)|как (правильно )?(делать|выполнять))\s*/u;
  // (When the rest is only the lift's own name, no other topic can be meant.)
  const howRest = p.phrase.replace(HOW_DO, '');
  const onlyLift =
    !!p.exercise &&
    !/(^|\s)(more|less|first|faster|heavier|longer|більше|перш\S*|больше|więcej|daugiau|rohkem)(\s|$)/u.test(
      howRest,
    ) &&
    terms(howRest).filter((t) => t !== '~me').length <= nameHits(howRest, p.exercise);
  if (
    p.exercise &&
    HOW_DO.test(p.phrase) &&
    tokens(howRest).length <= 3 &&
    (onlyLift ||
      !((h) => !!h && h.score >= OWN_TOPIC && !COMPARE_OK.has(h.id))(retrieve(question)[0])) &&
    !/(warm|розмин|weight|ваг|вес|sets?\b|підход|сет|reps?\b|повтор|muscle|м.?яз|often|часто|much|скільки|long|довго|heavy|важк|replace|замін|instead|progress|прогрес|breath|дих|grip|хват)/u.test(
      p.phrase,
    )
  ) {
    const it = byId('technique_lift')!;
    const core = it.answer(c, p, L);
    if (core) return build(it, core, c, p, question, L, convo);
  }
  // "What if I train 5 times a week?" / "а якщо 3 рази на тиждень?"
  if (f.whatIf && f.days !== null && !f.wantsPlan) {
    const r = whatIfDays(c, f.days, p.muscle ?? convo.muscle ?? null, L);
    return done('what_if_days', r, { muscle: p.muscle ?? convo.muscle ?? null });
  }
  return null;
}

/** Follow-ups on the lift just discussed: other kit, "what's it for", "why…", "something lighter". */
function aroundLift(
  question: string,
  p: Parsed,
  c: AskCtx,
  convo: Convo,
  L: Tr,
  turn: number,
): Draft | null {
  const cur = byId(convo.intent);
  const words = p.words;
  const lift = convo.exercise;
  const followish =
    CONNECTOR_RE.test(question) || groupMatches(words, p.phrase, FOLLOW_LEAD) || words.length <= 4;
  // "а з гантелями?" / "what about with dumbbells" → the same movement with that kit.
  if (lift && followish && words.length <= 6 && (!p.exercise || p.exercise === lift)) {
    const f = parseFrame(question, c.mem, c.now);
    const kit = f.kit.find((k) => k !== 'home');
    if (kit && !f.wantsPlan) {
      const alt = variantOf(lift, kit);
      if (alt && alt !== lift) {
        const it = cur?.needs === 'exercise' ? cur : byId('technique_lift')!;
        const tp: Parsed = { ...p, exercise: alt };
        const core = it.answer(c, tp, L);
        if (core) {
          // The answer opens with the lift's name — the lead only says which kit.
          const lead = L(
            `With ${kit === 'body' ? 'bodyweight' : kit === 'dumbbell' ? 'dumbbells' : kit} →`,
            `${kitLead(kit)} →`,
          );
          const a = build(it, core, c, tp, question, L, convo, question);
          return { ...a, text: `${lead} ${a.text}` };
        }
      }
    }
  }
  // "а що це мені дасть?" → what the lift works, and why it's in a programme.
  if (lift && WHAT_FOR_RE.test(p.phrase)) {
    const it = byId('exercise_muscles')!;
    const tp: Parsed = { ...p, exercise: lift };
    const core = it.answer(c, tp, L);
    const tech = byId('technique_lift')?.why?.(c, tp, L);
    if (core) {
      const a = build(it, core, c, tp, question, L, convo, question);
      return { ...a, text: tech ? `${a.text} ${tech}` : a.text };
    }
  }
  // "а чому лікті не можна розводити?" right after the lift's technique → its own reason.
  if (
    lift &&
    cur?.why &&
    FOLLOW_WHY_RE.test(question) &&
    words.length <= 10 &&
    (!p.exercise || p.exercise === lift)
  ) {
    const why = cur.why(c, { ...p, exercise: lift }, L);
    if (why)
      return {
        intent: cur.id,
        text: why,
        chips: chipsFor(cur.id, L, { q: convo.q ?? question, p: { ...p, exercise: lift }, c }),
        convo: { ...convo, turn },
      };
  }
  // "а щось легше?" after today's suggestion → the same day, dialled down.
  if (
    (convo.intent === 'today' || convo.intent === 'tomorrow') &&
    LIGHTER_RE.test(p.phrase) &&
    words.length <= 6
  )
    return {
      intent: 'today_light',
      text: L(
        'Lighter version of the same day: the same lifts, 2 working sets instead of 3–4, about 20% less weight, stop 3–4 reps before failure. Or swap it for 30–40 min of easy cardio and mobility — it still counts.',
        'Легший варіант того ж дня: ті самі вправи, 2 робочі підходи замість 3–4, вага десь на 20% менша, зупиняйся за 3–4 повтори до відмови. Або заміни на 30–40 хв легкого кардіо й мобільності — це теж зараховується.',
      ),
      chips: [
        L('Am I recovered?', 'Я відновився?'),
        L('When should I deload?', 'Коли розвантаження?'),
      ],
      convo: { ...convo, turn },
    };
  return null;
}

function sameMuscle(a: string, b: string): boolean {
  const ma = richExerciseByName(a)?.primaryMuscles[0];
  const mb = richExerciseByName(b)?.primaryMuscles[0];
  return !!ma && ma === mb;
}

function kitLead(kit: string): string {
  return (
    (
      {
        dumbbell: 'З гантелями',
        barbell: 'Зі штангою',
        machine: 'У тренажері',
        cable: 'На блоці',
        body: 'Без обладнання',
        kettlebell: 'З гирею',
        bands: 'З резинкою',
      } as Record<string, string>
    )[kit] ?? kit
  );
}

/**
 * A message cut into its questions: at "?", "and also", then at "і / та /
 * and" (both sides 2+ words) and at commas (both sides 2+ words).
 */
function splitParts(q: string): { text: string; joint: boolean }[] {
  const out: { text: string; joint: boolean }[] = [];
  const cut = (text: string, re: RegExp, min: number): string[] => {
    const bits = text
      .split(re)
      .map((x) => x.trim())
      .filter(Boolean);
    const merged: string[] = [];
    for (const b of bits) {
      if (
        merged.length &&
        (tokens(b).length < min || tokens(merged[merged.length - 1]).length < min)
      )
        merged[merged.length - 1] = `${merged[merged.length - 1]} ${b}`;
      else merged.push(b);
    }
    return merged;
  };
  for (const chunk of q
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter((x) => tokens(x).length >= 1)) {
    // Commas only between two questions ("скільки спати, коли пити протеїн") —
    // not "sore quads today, squat or skip", which is one question with context.
    const commas = cut(chunk, /,\s+/u, 2);
    const byComma =
      commas.length >= 2 && commas.every((x) => QUESTION_HEAD.test(normalize(x)))
        ? commas
        : [chunk];
    for (const a of byComma)
      out.push(
        ...cut(a, /\s(?:і|та|й|и|and|а також|а ещё|а еще|also|plus|плюс)\s/iu, 2).map(
          (text, k) => ({
            text,
            joint: k > 0,
          }),
        ),
      );
  }
  // A lone word left over belongs to its neighbour.
  return out.filter((x) => tokens(x.text).length >= 2).slice(0, 4);
}

/** How a question starts — "how / what / скільки / чи / дай…" (en, uk, ru, pl, lt, et). */
const QUESTION_HEAD =
  /^(\S+\s+)?(скільки|як|коли|що|шо|чи|який|яка|яке|які|де|навіщо|нащо|чому|куди|сколько|как|когда|что|какой|какая|где|зачем|почему|how|what|what.?s|when|which|should|can|could|do|does|is|are|why|where|will|дай|скажи|покажи|порадь|tell|give|show|jak|ile|czy|kiedy|co|kaip|kiek|ar|kada|kas|kuidas|palju|millal|mis)(?=\s|$)/u;

/** A part of a message answered below this is a guess — asked about, not answered. */
const PART_SURE = 0.5;

/** Composed answers that already read the whole message (a plan with its constraints…). */
const WHOLE_MESSAGE = new Set(['plan_build', 'compare_ex', 'what_if_days']);
const EXTRA_IDS = new Set(INTENTS_EXTRA.map((i) => i.id));
/** Keyword phrases with an "and" inside ("fat and gain muscle", "back to back"). */
let jointKeys: string[] | null = null;
const JOINT_KEYS = (): string[] =>
  (jointKeys ??= ALL_INTENTS().flatMap((it) =>
    it.all.flat().filter((k) => /\s(and|і|та|й|и|plus|плюс|ir|ja|oraz)\s/u.test(` ${k} `)),
  ));

function answerParts(question: string, c: AskCtx, convo: Convo, L: Tr): Draft | null {
  const parts: string[] = [];
  for (const x of splitParts(question)) {
    const prev = parts[parts.length - 1];
    // "Siła czy masa, co wybrać?" — a tail with no topic of its own is the
    // same question, finished (the grammar sees no noun, no content verb).
    if (prev !== undefined && bareAsk(x.text)) {
      parts[parts.length - 1] = `${prev} ${x.text}`;
      continue;
    }
    // "compare this week | and last week", "can I run | and lift at the same time":
    // a tail after "and" that is no question of its own and that the first
    // part's topic already covers only finishes that part.
    if (prev !== undefined && x.joint && !QUESTION_HEAD.test(normalize(x.text))) {
      const pa = answerOne(prev, c, convo);
      if (pa && byId(pa.intent) && coverage(x.text, pa.intent) >= 0.5) {
        parts[parts.length - 1] = `${prev} ${x.text}`;
        continue;
      }
    }
    parts.push(x.text);
  }
  if (parts.length < 2) return null;
  // "lose fat AND gain muscle", "два дні поспіль і…" — one topic's own words
  // run across the "and": one question, not two.
  if (JOINT_KEYS().some((k) => groupMatches(tokens(question), normalize(question), [k])))
    return null;
  const whole = answerOne(question, c, convo);
  if (whole && WHOLE_MESSAGE.has(whole.intent)) return whole;
  // "Can I build muscle and lose fat together?", "pilates plus lifting?" — one
  // of the narrower topics names the whole thing, and surely: one answer.
  if (
    whole &&
    EXTRA_IDS.has(whole.intent) &&
    // (Not when the grammar hears two separate questions.)
    understand(question).asks < 2 &&
    (whole.confidence ?? confidenceOf(whole.route, whole.intent, question)) >= CONFIDENT
  )
    return whole;
  const turn = (convo.turn ?? 0) + 1;
  const got = parts.map((x, k) => {
    const text = k ? x.replace(CONNECTOR_RE, '') : x;
    // Later answers come plain — one voice flourish per message is enough.
    const a = answerOne(text, c, k ? { turn, softUntil: turn + 1 } : convo);
    return { part: x, a: settleAt(a, text) };
  });
  /** A combined answer is as sure as its least sure part. */
  const least = (xs: { a: Draft | null }[]) =>
    Math.min(...xs.map((g) => g.a?.confidence ?? routeConfidence('dym')));
  const seen = new Set<string>();
  const good = got.filter(({ a }) => {
    if (!standalone(a) || seen.has(a!.intent)) return false;
    seen.add(a!.intent);
    return true;
  });
  const pain = got.find(({ a }) => a?.convo.flow?.kind === 'pain')?.a;
  const unsure = got.filter(({ a }) => !a || a.intent === 'did_you_mean' || a.intent === 'nudge');
  const learned = got.reduce<AtlasMemory | undefined>(
    (m, g) => (g.a?.learned ? mergeMemory(m, g.a.learned) : m),
    undefined,
  );
  const last = good[good.length - 1]?.a;
  // "How long to rest, and can I train with a sore shoulder?" → the answer, then the check-in.
  if (pain && good.length)
    return {
      ...pain,
      confidence: least(good),
      text: [...good.map((g) => g.a!.text), pain.text].join('\n\n'),
      learned: learned ?? pain.learned,
    };
  if (good.length >= 2)
    return {
      ...last!,
      confidence: least(good),
      text: good.map((g) => g.a!.text).join('\n\n'),
      escalate: false,
      learned,
      action: good.find((g) => g.a!.action)?.a!.action,
      chart: good.find((g) => g.a!.chart)?.a!.chart,
      convo: { ...last!.convo, softUntil: convo.softUntil },
    };
  // A training question with something off-topic tacked on → answer the training
  // part, decline the rest in one line (no warning — it wasn't a chat attempt).
  const off = got.filter(({ a }) => a?.intent === 'off_topic');
  if (good.length && off.length)
    return {
      ...last!,
      confidence: least(good),
      text: `${good.map((g) => g.a!.text).join('\n\n')}\n\n${L('The rest isn’t my area — that’s one for ChatGPT.', 'А решта — не до мене, це до ChatGPT.')}`,
      escalate: false,
      learned,
      convo: { ...last!.convo, softUntil: convo.softUntil },
    };
  // One part is clear, another isn't → answer it, then ask about the other.
  if (good.length === 1 && unsure.length) {
    const u = unsure[0].part;
    const guess = didYouMean(u, c);
    const ask = guess.length
      ? L(`And about “${u}” — which of these do you mean?`, `А щодо «${u}» — ти про що саме?`)
      : L(
          `And “${u}” — say it another way and I’ll take it.`,
          `А «${u}» — скажи інакше, і я відповім.`,
        );
    return {
      ...good[0].a!,
      confidence: least(good) * 0.9,
      text: `${good[0].a!.text}\n\n${ask}`,
      chips: guess.length ? guess.map((g) => g.ask) : good[0].a!.chips,
      learned,
      convo: guess.length
        ? { ...good[0].a!.convo, pendingTeach: { q: u, offered: guess.map((g) => g.id) } }
        : good[0].a!.convo,
    };
  }
  return null;
}

/** A confident answer to a question on its own (not "did you mean", small talk, a question back, a guess). */
function standalone(a: Draft | null | undefined): boolean {
  return (
    !!a &&
    (a.confidence ?? 1) >= PART_SURE &&
    a.intent !== 'did_you_mean' &&
    a.intent !== 'off_topic' &&
    !a.intent.startsWith('safety_') &&
    !SMALLTALK_IDS.has(a.intent) &&
    !a.convo.pending &&
    !a.convo.flow
  );
}

/**
 * Which lift the question names. Your own lifts first — unless the library
 * has a more specific match ("stiff-leg deadlift" is not your "deadlift").
 */
function pickLift(
  question: string,
  words: string[],
  phrase: string,
  logged: { name: string; count: number }[],
): string | null {
  const mine = resolveMyLift(question, logged) ?? findExercise(words, phrase, logged);
  const lib = findCatalogExercise(words, phrase, CATALOG_NAMES()) ?? resolveCatalogLift(question);
  if (mine && lib && lib !== mine && nameHits(question, lib) > nameHits(question, mine)) return lib;
  return mine ?? lib;
}

/**
 * Build the understanding index ahead of the first question. It takes a few
 * seconds on a phone, so a Web Worker does it; without workers — right here,
 * a moment after the chat opens.
 */
let warming = false;
let readyWaiters: (() => void)[] = [];
function markReady(): void {
  for (const f of readyWaiters) f();
  readyWaiters = [];
}
/** Without a worker: load the base here (its own chunk) and build on the spot. */
function buildHere(): void {
  void import('./kb').then(({ KB, facetsTable }) => {
    loadKb(KB);
    setFacets(facetsTable(KB));
    retrieve('warm up');
    markReady();
  });
}
export function warmUpAtlas(): void {
  if (warming) return;
  warming = true;
  if (typeof Worker === 'undefined') return buildHere();
  try {
    const w = new Worker(new URL('./retrieve.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (
      e: MessageEvent<{ index: RetrievalIndex; facets: Parameters<typeof setFacets>[0] }>,
    ) => {
      setIndex(e.data.index);
      setFacets(e.data.facets);
      w.terminate();
      markReady();
    };
    w.onerror = () => {
      w.terminate();
      buildHere();
    };
    w.postMessage('build');
  } catch {
    buildHere();
  }
}
/**
 * Resolves once Atlas understands questions (the index is in), or after `ms`
 * — so a question typed in the first seconds waits a moment instead of being
 * answered by keywords alone.
 */
export function atlasReady(ms = 6000): Promise<void> {
  if (indexReady()) return Promise.resolve();
  warmUpAtlas();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    readyWaiters.push(() => {
      clearTimeout(t);
      resolve();
    });
  });
}
