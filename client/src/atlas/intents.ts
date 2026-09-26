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
  findMuscle,
  groupMatches,
  hasCyrillic,
  matchedWords,
  negated,
  normalize,
  tokens,
  translitToUk,
} from './nlu';
import { DEPTH, DEFAULT_NEXT } from './depth';
import { INTENTS_FOURTH } from './intentsFourth';
import { CHARTS, INTENTS_FIFTH } from './intentsFifth';
import { INTENTS_SIXTH, MORES } from './intentsSixth';
import { INTENTS_NEW } from './intentsNew';
import { INTENTS_APP } from './appTopics';
import { emojiReply, INTENTS_SMALL, SMALLTALK_IDS, SMALL_OVERRIDES } from './smalltalk';
import { parseRange, parseWeekdays } from './when';
import { SORE_CAP } from './memoryPlan';
import { isLiftStatus, nameHits, resolveCatalogLift, resolveMyLift } from './liftNames';
import { taughtFor, teach, wrongFor } from './teach';
import { styled, unsureLine } from './style';
import { aboutSomeoneElse, safetyReply, safetySignal } from './safety';
import { liveAnswer } from './live';
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
import { KB, type Facet } from './kb';
import { retrieve, setIndex, type RetrievalIndex } from './retrieve';
import { FACET_CHIP, isPersonal, questionType } from './qtype';
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
import { BUILT_IN_CATALOG } from '../data/exercises';
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
  /** A guided conversation in progress (pain check-in, finding an exercise). */
  flow?: Flow;
  /** After a hard moment Atlas stays plain (no jokes, no roasting) until this turn. */
  softUntil?: number;
  /** The last answer had a joke (never two in a row). */
  joked?: boolean;
  /** "Did you mean…" was offered for this wording — the pick teaches Atlas. */
  pendingTeach?: { q: string; offered: string[] };
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
  ...INTENTS_APP,
  ...INTENTS_SMALL,
];
// Charts and "more" layers for topics from the earlier parts.
for (const it of ALL_INTENTS()) {
  if (CHARTS[it.id]) it.chart ??= CHARTS[it.id];
  if (MORES[it.id]) it.more ??= MORES[it.id];
  if (SMALL_OVERRIDES[it.id]) it.answer = SMALL_OVERRIDES[it.id].answer;
}
const byId = (id: string | undefined) => (id ? ALL_INTENTS().find((i) => i.id === id) : undefined);

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
  const f = KB[id]?.facets ?? {};
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
  const f = qt ? KB[id]?.facets?.[qt] : undefined;
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
): LocalAnswer {
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
  });
}

/** One message → one answer (no splitting). */
function answerOne(question: string, c: AskCtx, convo: Convo): LocalAnswer | null {
  const p = parse(question, c);
  const { words, phrase } = p;
  if (!words.length) return null;
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const short = words.length <= 5;
  const turn = (convo.turn ?? 0) + 1;

  // "It / that lift / її / цю вправу" → the lift we were just talking about.
  if (!p.exercise && convo.exercise && words.length <= 9 && PRONOUN.test(` ${phrase} `))
    p.exercise = convo.exercise;

  // ---- the safety net: checked before anything else, in every temper ----
  const danger = safetySignal(question);
  if (danger) {
    const r = safetyReply(danger, L);
    return {
      intent: `safety_${danger}`,
      text: r.text,
      chips: r.chips,
      action: danger === 'lifecrisis' ? { type: 'pause', days: 7 } : undefined,
      convo: { turn, softUntil: turn + 3 },
    };
  }

  // ---- guided conversations: a pain check-in, finding an exercise ----
  const flowOut = (r: FlowReply): LocalAnswer => ({
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
    (!painTopic() || painNow(question))
  ) {
    // Remember the sore spot (it shapes later plans) — no note, the flow talks.
    const sore = learn(words, phrase, c.mem, c.now, p.exercise, c.fmt.exercise).patch;
    const out = flowOut(startPain(question, c, p.exercise, L));
    return Object.keys(sore).length ? { ...out, learned: sore } : out;
  }

  // ---- mid-session: the workout that's open right now ----
  const live = liveAnswer(c, question, L);
  if (live)
    return {
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
      intent: 'off_topic',
      text: offTopicLine(c.temper, L),
      escalate: true,
      chips: [
        L('What should I train today?', 'Що тренувати сьогодні?'),
        L('How am I progressing?', 'Як я прогресую?'),
      ],
      convo: { ...convo, turn },
    };

  // ---- follow-ups on a computed question ("and last month?", "а присід?") ----
  if (convo.query) {
    if (questionType(question) === 'why' && words.length <= 4 && convo.query.exercise) {
      const ex = explainLift(c, convo.query.exercise, L);
      if (ex) return { intent: 'log_query', text: ex, convo: { ...convo, turn } };
    }
    const fq = followQuery(convo.query, question, p);
    const res = fq && runQuery(c, fq, L);
    const d = res && dress(res.text, c, 'log_query', question, turn, convo);
    if (fq && res && d)
      return {
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
  if (cur && short) {
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
    const ownQuestion = ALL_INTENTS().some(
      (it) =>
        it.id !== cur.id &&
        it.all.length > 0 &&
        it.all.every((g) => groupMatches(words, phrase, g)) &&
        hasNeeds(it, p),
    );
    // "And last month?" — the same topic over a new window. A lift topic
    // without windows (progress, best) moves to the lift-over-a-window one.
    if (p.range && !p.exercise && !p.muscle && !ownQuestion && words.length <= 5) {
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
        return build(target, core, c, tp, question, L, convo, convo.q ?? question);
    }
    if (entityOnly && cur.needs && (convo.pending || !ownQuestion) && hasNeeds(cur, carried)) {
      const core = cur.answer(c, carried, L);
      if (core) return build(cur, core, c, carried, question, L, convo, convo.q ?? question);
    }
    // "Why?" / "How?" / "When?"… on the current topic → that side of it.
    const fq = questionType(question);
    // The topic's own "why" (e.g. the lift-specific reason) beats the general one.
    const ownWhy = fq === 'why' && words.length <= 4 ? cur.why?.(c, topic, L) : null;
    const side =
      fq && words.length <= 4 && !ownQuestion && !ownWhy ? KB[cur.id]?.facets?.[fq] : undefined;
    if (fq && side) {
      const told = [...(convo.told ?? []), fq];
      return {
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
    if (words.length <= 3 && groupMatches(words, phrase, ASK_WHY)) {
      const d = DEPTH[cur.id];
      const cp = topic;
      const why = cur.why?.(c, cp, L) ?? (d?.why ? L(d.why[0], d.why[1]) : null);
      if (why)
        return {
          intent: cur.id,
          text: why,
          chips: chipsFor(cur.id, L, { q: convo.q ?? question, p: topic, c }),
          convo: { ...convo, turn },
        };
      return {
        intent: cur.id,
        text: L(
          'That part is past what I know by heart.',
          'Тут я вже за межами того, що знаю напам’ять.',
        ),
        escalate: true,
        convo: { ...convo, turn },
      };
    }
    if (
      groupMatches(words, phrase, MORE) &&
      !ALL_INTENTS().some(
        (it) =>
          it.id !== cur.id &&
          it.all.every((g) => groupMatches(words, phrase, g)) &&
          it.all.length > 0 &&
          matchedWords(words, it.all) >= 2,
      )
    ) {
      const d = DEPTH[cur.id];
      const depth = convo.depth ?? 0;
      const cp = topic;
      const own = cur.more?.(c, cp, L, depth) ?? null;
      const layer = own ?? (d?.more[depth] ? L(d.more[depth][0], d.more[depth][1]) : null);
      if (layer)
        return {
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
      const next = order.find((x) => KB[cur.id]?.facets?.[x] && !(convo.told ?? []).includes(x));
      if (next) {
        const f = KB[cur.id]!.facets![next]!;
        const told = [...(convo.told ?? []), next];
        return {
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
    : learn(words, phrase, c.mem, c.now, p.exercise, c.fmt.exercise);
  const hasLearned = Object.keys(learned.patch).length > 0;
  const cm: AskCtx = hasLearned ? { ...c, mem: mergeMemory(c.mem, learned.patch) } : c;
  const withLearned = (a: LocalAnswer | null): LocalAnswer | null => {
    if (!hasLearned) return a;
    const note = learned.note ? L(learned.note[0], learned.note[1]) : '';
    if (!a)
      return {
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
    (it.priority ? 100 : 0);
  const matchesGroups = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords) &&
    !(it.negatable && negatedPain) &&
    it.all.every((g) => groupMatches(words, phrase, g));
  const candidates = ALL_INTENTS().filter(matchesGroups);
  const ranked = candidates.filter((it) => hasNeeds(it, p)).sort((a, b) => weight(b) - weight(a));

  // Understanding by example: the closest topic among ~7,000 real phrasings.
  // It leads when keywords found nothing, or only a weak, single-word hit.
  const allowed = (it: Intent) =>
    (!it.maxWords || words.length <= it.maxWords + 3) && !(it.negatable && negatedPain);
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
  const byExample =
    taughtIt && hasNeeds(taughtIt, p) ? taughtIt : confident ? byId(top.id) : undefined;
  const kwTop = ranked[0];
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
  const qt = questionType(question);
  const commandReady = !!kwTop?.action && kwTop !== byExample && !!kwTop.action(cm, p);
  const whyTopic = qt === 'why' && !!kwTop?.id.startsWith('why_');
  // Near-tie between the two closest topics → the keyword hit breaks it.
  const agreed = !!kwTop && hits[1]?.id === kwTop.id && margin < 0.05;
  // "Why is my bench stuck?" — the reasons your log shows.
  if (
    qt === 'why' &&
    p.exercise &&
    loggedLifts(c).some((l) => l.name === p.exercise) &&
    STALL_RE.test(` ${phrase} `)
  ) {
    const ex = explainLift(cm, p.exercise, L);
    const it = byId('progress_lift');
    if (ex && it) return withLearned(build(it, ex, cm, p, question, L, convo, question, 'why'));
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
      return withLearned({ ...out, action: it.action?.(cm, p) ?? out.action });
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
    if (it && core) return withLearned(build(it, core, cm, p, question, L, convo, question));
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
  const lq = parseQuery(question, p);
  const myLog =
    !!lq &&
    aboutMyLog(question, lq, !!p.exercise && loggedLifts(c).some((l) => l.name === p.exercise));
  const queryAnswer = (): LocalAnswer | null => {
    const res = lq && runQuery(cm, lq, L);
    if (!lq || !res) return null;
    const d = dress(res.text, cm, 'log_query', question, turn, convo);
    return withLearned({
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
  const specific =
    !!lq && (lq.signals >= 3 || (!!p.range && !!byExample && byExample.needs !== 'range'));
  // A lift you never logged may be a misread word — then topics go first.
  const unknownLift = !!p.exercise && !loggedLifts(c).some((l) => l.name === p.exercise);
  if (taughtId === 'log_query' && lq && !wrong.has('log_query')) {
    const a = queryAnswer();
    if (a) return a;
  }
  if (
    lq?.strong &&
    myLog &&
    !unknownLift &&
    !wrong.has('log_query') &&
    !taughtIt &&
    (!byExample || specific) &&
    (!topFits || specific) &&
    !commandReady &&
    !status &&
    !whyTopic
  ) {
    const a = queryAnswer();
    if (a) return a;
  }
  const lead =
    (taughtIt && hasNeeds(taughtIt, p) ? taughtIt : null) ??
    status ??
    (byExample && SPECIALIZE[byExample.id]?.(p) ? byId(SPECIALIZE[byExample.id]!(p)!) : byExample);
  if (
    lead &&
    hasNeeds(lead, p) &&
    !commandReady &&
    !whyTopic &&
    (lead === taughtIt || !(agreed && kwTop !== lead))
  )
    order = [lead, ...ranked.filter((x) => x !== lead)];
  else if (kwStrong || POLICY.mode === 'kw' || (POLICY.mode === 'mix' && !byExample))
    order = ranked;
  else if (byExample) order = ranked;
  // Actions (swap, move, avoid…) only when asked for — not from a long story.
  const asking = REQUEST_RE.test(` ${phrase} `) || words.length <= 8;
  // A command missing its lift ("set rest to 3 min") → ask which lift first.
  const cmdNeedsLift =
    REQUEST_RE.test(` ${phrase} `) &&
    candidates.find((it) => it.action && it.needs === 'exercise' && !hasNeeds(it, p));
  if (cmdNeedsLift && !hasLearned)
    return {
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
    )
      order = [alt, ...order.filter((x) => x !== alt)];
  }
  for (const it of order) {
    if (it.action && !asking) continue;
    const core = it.answer(cm, p, L);
    if (!core) continue;
    const f = SMALLTALK_IDS.has(it.id) ? { text: core } : faceted(it.id, core, question, L);
    return withLearned(build(it, f.text, cm, p, question, L, convo, question, f.facet));
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
  if (lq?.strong && myLog && !wrong.has('log_query')) {
    const a = queryAnswer();
    if (a) return a;
  }
  // Close, but not sure enough to answer → offer the closest topics.
  if (!hasLearned && top && top.score >= RET_NEAR) {
    const near = hits.filter((h) => h.score >= RET_NEAR * 0.8 && ASKS[h.id]).slice(0, 3);
    if (near.length)
      return {
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

/** A general topic that has a sharper sibling when the question names a lift. */
const SPECIALIZE: Record<string, (p: Parsed) => string | null> = {
  technique: (p) => (p.exercise ? 'technique_lift' : null),
  squat_form: (p) => (p.exercise && !/squat|присід/i.test(p.exercise) ? 'technique_lift' : null),
};

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
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  // "Nothing hurts, what should I train?" — the "nothing hurts" is context, the question is the rest.
  const np = NO_PAIN_CLAUSE.exec(question0);
  const rest = np ? question0.replace(np[0], ' ').trim() : '';
  const question = np && tokens(rest).length >= 2 ? rest : question0;
  const turn = (convo.turn ?? 0) + 1;
  if (!convo.flow && CONTINUER_RE.test(question)) {
    if (convo.intent && convo.intent !== 'did_you_mean')
      return answerLocally(L('tell me more', 'розкажи більше'), c, convo);
    return {
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
    /^\s*(а |і |и |and |so )?(що|шо|что|what)\s+(мені\s+)?(робити|делать|to do|do i do|should i do|now)/iu.test(
      question,
    )
  ) {
    const fix = explainLift(c, convo.exercise, L);
    if (fix)
      return {
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
      intent: 'ack',
      text: lines[turn % lines.length],
      chips: chipsFor(convo.intent, L, { q: convo.q ?? question, p: topic, c }),
      convo: { ...convo, turn },
    };
  }
  // Two-word questions made only of "small" words ("ти хто") — the retrieval can't see them.
  const bare = normalize(question);
  const raw0 =
    /^(ти хто|хто ти|ти хто такий|хто ти такий|кто ты|ты кто|who are you|who r u)$/u.test(bare)
      ? answerAs('who', question, c, convo)
      : answerRaw(question, c, convo);
  // "How's my progress?" with no lift named → the overall picture, not "Which lift?".
  const overall =
    raw0?.intent === 'progress_lift' && raw0.convo.pending && finishedOf(c).length
      ? answerAs('how_am_i_doing', question, c, convo)
      : null;
  const raw = overall ?? raw0;
  // "ааааа", "asdfgh", "хз" — nothing to hand on; a way back in instead of silence.
  const a0: LocalAnswer | null =
    raw ??
    (tokens(question).length <= 2 && question.trim().length <= 14
      ? {
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
  const a =
    a0 &&
    !finishedOf(c).length &&
    (MY_DATA.has(a0.intent) ||
      (a0.convo.pending && !byId(a0.intent)?.action) ||
      (a0.intent === 'did_you_mean' &&
        /(^|\s)(my|мій|мої|моя|моє|мого|мене|мой|мои|моя)(\s|$)/iu.test(question)))
      ? {
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
  return out;
}

function answerRaw(question: string, c: AskCtx, convo: Convo = {}): LocalAnswer | null {
  const L: Tr = (en, uk) => (c.locale === 'uk' ? uk : en);
  const emoji = emojiReply(c, question, L);
  if (emoji)
    return {
      intent: 'emoji',
      text: emoji,
      convo: { ...convo, turn: (convo.turn ?? 0) + 1 },
    };
  const parts = question
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter((x) => tokens(x).length >= 2);
  if (parts.length >= 2) {
    let state = convo;
    const got: LocalAnswer[] = [];
    for (const [k, part0] of parts.slice(0, 3).entries()) {
      // "…, а ще скільки спати" — the second question stands on its own.
      const part = k ? part0.replace(CONNECTOR_RE, '') : part0;
      const a = answerOne(part, c, k ? { turn: state.turn, softUntil: state.softUntil } : state);
      if (a) {
        got.push(a);
        state = a.convo;
      }
    }
    if (got.length >= 2) {
      const last = got[got.length - 1];
      const learned = got.reduce<AtlasMemory | undefined>(
        (m, g) => (g.learned ? mergeMemory(m, g.learned) : m),
        undefined,
      );
      return {
        ...last,
        text: got.map((g) => g.text).join('\n\n'),
        escalate: false,
        learned,
        action: got.find((g) => g.action)?.action,
        chart: got.find((g) => g.chart)?.chart,
      };
    }
  }
  // "How long to rest and what's tomorrow" — two questions joined by "and".
  if (!convo.flow)
    for (const [x, y] of andSplits(question)) {
      const a1 = answerOne(x, c, convo);
      // The second answer comes plain — one voice flourish per message is enough.
      const a2 =
        a1 &&
        answerOne(y.replace(CONNECTOR_RE, ''), c, {
          turn: a1.convo.turn,
          softUntil: (a1.convo.turn ?? 0) + 1,
        });
      if (a2 && !a2.intent.startsWith('safety'))
        a2.convo = { ...a2.convo, softUntil: convo.softUntil };
      if (standalone(a1) && standalone(a2) && a1!.intent !== a2!.intent)
        return {
          ...a2!,
          text: `${a1!.text}\n\n${a2!.text}`,
          escalate: false,
          learned:
            a1!.learned || a2!.learned ? mergeMemory(a1!.learned, a2!.learned ?? {}) : undefined,
          action: a2!.action ?? a1!.action,
          chart: a2!.chart ?? a1!.chart,
        };
    }
  const direct = answerOne(question, c, convo);
  // Latin letters may be Ukrainian ("shcho trenuvaty sohodni") — the reading
  // whose examples fit better wins.
  if (!hasCyrillic(question) && /[a-z]/i.test(question)) {
    const tr = translitToUk(question);
    const uk = tr !== question ? answerOne(tr, c, convo) : null;
    const fit = (q: string) => retrieve(q)[0]?.score ?? 0;
    const english = tokens(question).some((t) => EN_COMMON.has(t));
    // Polish / Lithuanian / Estonian aren't transliterated Ukrainian.
    const foreign =
      /^(pl|lt|et)$/.test(detectLang(question) ?? '') ||
      tokens(question).some((t) => OTHER_LATIN.has(t));
    if (
      uk &&
      !foreign &&
      uk.intent !== 'did_you_mean' &&
      (!direct || direct.intent === 'did_you_mean' || (!english && fit(tr) > fit(question) + 0.05))
    )
      return uk;
  }
  if (direct) return direct;
  const known = toKnownLanguage(question);
  if (known && known !== question) {
    const a = answerOne(known, c, convo);
    if (a) return a;
  }
  if (!hasCyrillic(question) && /[a-z]/i.test(question)) {
    const uk = answerOne(translitToUk(question), { ...c, locale: c.locale }, convo);
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

function withInsight(a: LocalAnswer, question: string, c: AskCtx, convo: Convo): LocalAnswer {
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
function andSplits(q: string): [string, string][] {
  const out: [string, string][] = [];
  const re = /\s(?:і|та|й|и|and|а також|а ещё|а еще|also)\s/giu;
  for (const m of q.matchAll(re)) {
    const x = q.slice(0, m.index).trim();
    const y = q.slice((m.index ?? 0) + m[0].length).trim();
    if (tokens(x).length >= 2 && tokens(y).length >= 2) out.push([x, y]);
    if (out.length >= 2) break;
  }
  return out;
}

/** A confident answer to a question on its own (not "did you mean", small talk, a question back). */
function standalone(a: LocalAnswer | null | undefined): boolean {
  return (
    !!a &&
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
export function warmUpAtlas(): void {
  if (warming) return;
  warming = true;
  if (typeof Worker === 'undefined') {
    retrieve('warm up');
    return;
  }
  try {
    const w = new Worker(new URL('./retrieve.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<RetrievalIndex>) => {
      setIndex(e.data);
      w.terminate();
    };
    w.onerror = () => {
      w.terminate();
      retrieve('warm up');
    };
    w.postMessage('build');
  } catch {
    retrieve('warm up');
  }
}
