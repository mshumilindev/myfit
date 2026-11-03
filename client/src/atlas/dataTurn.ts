/**
 * SPO-35: one chat turn about the chat itself (metaTurn.ts) or the log of a single lift — answer it from the log, ask "Which lift?" when only the
 * metric is known, or hand the turn back (null). Kept out of intents.ts (file-size ratchet); the few helpers that live
 * there are passed in, so this file does not import intents.ts at all.
 */
import { toKnownLanguage } from './lexicon';
import { INTENTS_MORE } from './intentsMore';
import { INTENTS_FIFTH } from './intentsFifth';
import { repairTypos } from './typos';
import { metaTurn, type Said } from './metaTurn';
import {
  answerDataQuestion,
  lookupSignal,
  type DataMemo,
  readDataFollowUp,
  readDataQuestion,
} from './dataQuestion';
import { followTurn } from './followTurn';
import type { Frame } from './frame';
import type { AskCtx, Parsed, Tr } from './intentKit';
import type { Route } from './confidence';

interface Deps {
  parse: (q: string, c: AskCtx) => Parsed;
  chipsFor: (id: string, L: Tr, x?: { q: string; p: Parsed; c: AskCtx }) => string[];
  loggedLifts: (c: AskCtx) => { name: string; count: number }[];
}
/** The slice of Convo this turn reads; the caller's full Convo flows through untouched (no import of intents.ts). */
interface DConvo {
  said?: Said[];
  pending?: boolean;
  intent?: string;
  exercise?: string | null;
  dq?: DataMemo;
  frame?: Frame;
}
interface Out<C> {
  route: Route;
  intent: string;
  text: string;
  chips: string[];
  convo: C;
}

/** A word-mapped question is trusted only when it names what is wanted (a metric or the record) — not "yesterday I cycled". */
/** An order to write sets down ("log 3 sets of …", "залогуй 3 підходи"), not a question about them. */
const LOG_CMD_RE =
  /^\s*(please\s+)?(log|record|add|залогуй\p{L}*|запиши|додай|zapisz|dodaj)\s+\d+\s+(sets?|підход\p{L}*|сет\p{L}*|serii?)/iu;

const asLookup = <T extends { metric: unknown; which: string }>(q: T | null) =>
  q && (q.metric || q.which === 'best' || q.which === 'first') ? q : null;

const TWO_QUESTIONS_RE =
  /^\s*(what|how|when|which|where|скільки|що|коли|який|яка|яке|які)(?!\p{L})(\s+\S+){2,}\s+(and|і|та)\s+(what|how|when|which|where|скільки|що|коли|який|яка|яке|які)(?!\p{L})(\s+\S+){2,}\s*\??\s*$/iu;

const CMP_THAT_RE =
  /^\s*(?:and |so |а |і )?(?:compare|порівняй|how does)\s+(?:that|it|this|це|його|її)\s+(?:compare\s+)?(?:to|with|vs|against|з|до)\s+(?:my |мій |мою |моє )?(.+?)\s*\??\s*$/iu;

export function dataTurn<C extends DConvo>(
  question: string,
  c: AskCtx,
  convo: C,
  turn: number,
  L: Tr,
  d: Deps,
): Out<C & { turn: number; q: string }> | null {
  // Two questions in one message ("what is my bench max and how many sets this week"): each gets its own answer
  // (answerParts), not one data lookup that swallows the first.
  if (TWO_QUESTIONS_RE.test(question)) return null;
  const meta = metaTurn(question, convo, turn, L, c.fmt.echo);
  if (meta) return meta;
  const follow = followTurn(question, c, convo, turn, L);
  if (follow) return follow;
  // "compare that to my bench" right after talking about a lift: the lift in play against the one named.
  const cmp = CMP_THAT_RE.exec(question);
  if (cmp && convo.exercise) {
    const other = d.parse(cmp[1], c).exercise;
    const a = INTENTS_FIFTH.find((i) => i.id === 'compare_lifts');
    const text =
      other && other !== convo.exercise && a
        ? a.answer(c, { ...d.parse(question, c), exercises: [convo.exercise, other] }, L)
        : null;
    if (text)
      return {
        route: 'ack',
        intent: 'compare_lifts',
        text,
        chips: [],
        convo: { ...convo, turn, q: question },
      };
  }
  // Polish one-letter prepositions ("rekord w przysiadzie") would otherwise be read as a lift.
  const text = repairTypos(question)
    .replace(/(^|\s)[wzou](?=\s|$)/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "log 3 sets of pullups" is about the app, not about training pull-ups: the app's own how-to answers it.
  if (LOG_CMD_RE.test(text)) {
    const how = INTENTS_MORE.find((i) => i.id === 'app_log_set')?.answer(c, d.parse(text, c), L);
    if (how)
      return {
        route: 'ack',
        intent: 'app_log_set',
        text: how,
        chips: [],
        convo: { ...convo, turn, q: question },
      };
  }
  const pq = d.parse(text, c);
  const prevDq =
    convo.dq ?? (convo.intent === 'best' ? { metric: null, which: 'best' as const } : null);
  // pl / lt / et ask through the word map (lexicon.ts): "mój rekord w przysiadzie" reads as "record squat".
  const mapped = readDataQuestion(text, pq, c) ? null : toKnownLanguage(text);
  // (one-letter leftovers like Polish "w" would be read as a lift)
  const known =
    mapped
      ?.replace(/(^|\s)\p{L}(?=\s|$)/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? null;
  const kpq = known ? d.parse(known, c) : null;
  const dq =
    readDataQuestion(text, pq, c) ??
    (known && kpq && lookupSignal(known) ? asLookup(readDataQuestion(known, kpq, c)) : null) ??
    (convo.pending && convo.dq && pq.exercise
      ? { ...convo.dq, exercise: pq.exercise }
      : prevDq
        ? readDataFollowUp(text, pq, prevDq, convo.exercise)
        : null);
  if (!dq) return null;
  const intent = dq.which === 'best' ? 'best' : 'lift_last';
  const keep = {
    ...convo,
    turn,
    intent,
    q: question,
    dq: { metric: dq.metric, which: dq.which, skip: dq.skip },
  };
  if (dq.exercise) {
    const text = answerDataQuestion(dq, c, (kpq ?? pq).range, L);
    if (!text) return null;
    const chips = d.chipsFor('lift_last', L, {
      q: question,
      p: { ...pq, exercise: dq.exercise },
      c,
    });
    return { route: 'query', intent, text, chips, convo: { ...keep, exercise: dq.exercise } };
  }
  if (!dq.metric || dq.which !== 'last') return null;
  // Which lift? — ask, with the lifts you do most as chips, instead of guessing.
  const lifts = d
    .loggedLifts(c)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  if (!lifts.length) return null;
  return {
    route: 'needLift',
    intent,
    text: L('Which lift?', 'Яка вправа?'),
    chips: lifts.map((l) => c.fmt.exercise(l.name)),
    convo: { ...keep, pending: true },
  };
}
