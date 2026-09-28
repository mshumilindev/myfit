/**
 * Runs the understanding exam (corpus.ts) through answerLocally and scores it.
 *
 * Every answer lands in one of three bins:
 *  - right   — the intent is one the case accepts (or Atlas held back on an
 *              'unsure' case);
 *  - held    — Atlas held back ("did you mean…", a nudge, a hand-over, or an
 *              answer below CONFIDENT) where a topic was expected;
 *  - wrong   — Atlas answered, sure of itself, with a topic the case does not
 *              accept (the harm we care about: a confident wrong template).
 */
import { answerLocally, CONFIDENT, PICKS, ROUTES, type Convo, type LocalAnswer } from '../intents';
import { richCtx } from '../testCtx';
import { HELD_OUT, type Case } from './corpus';

/** Outcomes that mean "not sure" rather than an answer on a topic. */
const HOLDS = new Set(['did_you_mean', 'nudge']);

export interface Scored {
  c: Case;
  got: string;
  confidence: number;
  /** Answered on a topic (not a question back / nothing). */
  answered: boolean;
  /** The intent itself is acceptable (ignoring confidence). */
  ok: boolean;
  bin: 'right' | 'held' | 'wrong';
  /** How the answer was reached (see confidence.ts). */
  route?: string;
  /** Which routing rule put the topic first (see confidence.ts Pick). */
  pick?: string;
}

export function ask(c: Case): LocalAnswer | null {
  const ctx = richCtx(/[Ѐ-ӿ]/u.test(c.q) ? 'uk' : 'en');
  let convo: Convo = {};
  for (const p of c.prev ?? []) {
    const a = answerLocally(p, ctx, convo);
    if (a) convo = a.convo;
  }
  return answerLocally(c.q, ctx, convo);
}

export function score(c: Case, a: LocalAnswer | null, threshold = CONFIDENT): Scored {
  const accept = typeof c.expect === 'string' ? [c.expect] : [...c.expect];
  const got = a?.intent ?? 'none';
  // Before confidence existed every answer counted as sure (the baseline).
  const confidence = a?.confidence ?? (a ? 1 : 0);
  const answered = !!a && !HOLDS.has(got) && !a.escalate;
  const sure = answered && confidence >= threshold;
  // Holding back is right where no template fits — so is an answer marked unsure.
  const ok = accept.includes(got) || (accept.includes('unsure') && !sure);
  const bin = ok ? 'right' : sure ? 'wrong' : 'held';
  return {
    c,
    got,
    confidence,
    answered,
    ok,
    bin,
    route: a ? ROUTES.get(a) : undefined,
    pick: a ? PICKS.get(a) : undefined,
  };
}

export interface Report {
  n: number;
  /** Intent right (any confidence). */
  accuracy: number;
  /** Answered with an unacceptable intent, whatever the confidence. */
  wrongAnswered: number;
  /** Answered with an unacceptable intent at confidence ≥ threshold. */
  wrongConfident: number;
  /** Of the answers at confidence ≥ threshold, the share that is right. */
  precisionAtConfident: number;
  /** Share of all messages answered at confidence ≥ threshold. */
  coverageAtConfident: number;
  rows: Scored[];
}

export function evaluate(cases: Case[], threshold = CONFIDENT): Report {
  return report(
    cases.map((c) => score(c, ask(c), threshold)),
    threshold,
  );
}

/** The numbers for already scored rows (a subset of a run, another threshold…). */
export function report(rows: Scored[], threshold = CONFIDENT): Report {
  const n = rows.length;
  const sure = rows.filter((r) => r.answered && r.confidence >= threshold);
  return {
    n,
    accuracy: rows.filter((r) => r.ok).length / n,
    wrongAnswered: rows.filter((r) => r.answered && !r.ok).length / n,
    wrongConfident: sure.filter((r) => !r.ok).length / n,
    precisionAtConfident: sure.length ? sure.filter((r) => r.ok).length / sure.length : 1,
    coverageAtConfident: sure.length / n,
    rows,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function describe(r: Report, title: string): string {
  const lines = [
    `${title}: n=${r.n} accuracy=${pct(r.accuracy)} wrong-answered=${pct(r.wrongAnswered)} ` +
      `wrong-confident=${pct(r.wrongConfident)} precision@confident=${pct(r.precisionAtConfident)} ` +
      `coverage@confident=${pct(r.coverageAtConfident)}`,
  ];
  const bad = r.rows.filter((x) => !x.ok);
  if (bad.length) {
    lines.push('  confusions (expected → got [confidence]):');
    for (const x of bad) {
      const exp = typeof x.c.expect === 'string' ? x.c.expect : x.c.expect.join('|');
      const mark = `${x.answered && x.confidence >= CONFIDENT ? '✗' : '·'}${HELD_OUT.includes(x.c) ? 'T' : ' '}`;
      lines.push(
        `  ${mark} ${x.c.prev ? `[${x.c.prev.join(' / ')}] ` : ''}${x.c.q} :: ${exp} → ${x.got} [${x.confidence.toFixed(2)}]`,
      );
    }
  }
  return lines.join('\n');
}
