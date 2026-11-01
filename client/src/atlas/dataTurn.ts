/**
 * SPO-35: one chat turn about the chat itself (metaTurn.ts) or the log of a single lift — answer it from the log, ask "Which lift?" when only the
 * metric is known, or hand the turn back (null). Kept out of intents.ts (file-size ratchet); the few helpers that live
 * there are passed in, so this file does not import intents.ts at all.
 */
import { metaTurn, type Said } from './metaTurn';
import {
  answerDataQuestion,
  type DataMemo,
  readDataFollowUp,
  readDataQuestion,
} from './dataQuestion';
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
}
interface Out<C> {
  route: Route;
  intent: string;
  text: string;
  chips: string[];
  convo: C;
}

export function dataTurn<C extends DConvo>(
  question: string,
  c: AskCtx,
  convo: C,
  turn: number,
  L: Tr,
  d: Deps,
): Out<C & { turn: number; q: string }> | null {
  const meta = metaTurn(question, convo, turn, L);
  if (meta) return meta;
  const pq = d.parse(question, c);
  const prevDq =
    convo.dq ?? (convo.intent === 'best' ? { metric: null, which: 'best' as const } : null);
  const dq =
    readDataQuestion(question, pq, c) ??
    (convo.pending && convo.dq && pq.exercise
      ? { ...convo.dq, exercise: pq.exercise }
      : prevDq
        ? readDataFollowUp(question, pq, prevDq, convo.exercise)
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
    const text = answerDataQuestion(dq, c, pq.range, L);
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
