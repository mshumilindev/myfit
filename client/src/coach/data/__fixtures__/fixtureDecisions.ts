import type { DecisionRecord, OutcomeResult } from '../../domain/decisions';
import { DAY } from '../../domain/time';
import type { DiffOp } from '../../domain/diff';
import { ROWS } from './fixtureRows';
import { D } from './fixtureTime';

/* ---- decisions: 26 improved + 10 no clear change + 4 declined + 2 measuring = 42 ----------------------------------- */
export function fixtureDecisions(): DecisionRecord[] {
  const named: [string, string, string, OutcomeResult, string][] = [
    ['r1', 'c2', 'ready', 'improved', 'weight'],
    ['r2', 'c1', 'stall', 'no-clear-change', 'sets'],
    ['r3', 'c9', 'rhythm', 'declined', 'deload'],
    ['r4', 'c4', 'machine', 'improved', 'sets'],
    ['r5', 'c11', 'spike', 'improved', 'deload'],
    ['r6', 'c13', 'injury', 'measuring', 'swap'],
  ];
  const when: Record<string, number> = {
    r1: D(9, 30, 10),
    r2: D(9, 16, 10),
    r3: D(9, 12, 10),
    r4: D(9, 9, 10),
    r5: D(9, 5, 10),
    r6: D(10, 2, 10),
  };
  const fill: OutcomeResult[] = [
    ...Array<OutcomeResult>(23).fill('improved'),
    ...Array<OutcomeResult>(9).fill('no-clear-change'),
    ...Array<OutcomeResult>(3).fill('declined'),
    'measuring',
  ];
  const LIFTS = ['Bench press', 'Back squat', 'Deadlift', 'Overhead press', 'Barbell row'];
  /** A readable, varied diff per decision (the receipts list shows its first op as the title). */
  const diffFor = (optionId: string, id: string): DiffOp => {
    const n = Number(id.replace(/\D/g, '')) || 0;
    const lift = LIFTS[n % LIFTS.length];
    if (optionId === 'sets') return { op: 'sets', exercise: lift, from: 3, to: 4 };
    if (optionId === 'weight') return { op: 'weight', exercise: lift, fromKg: 100, toKg: 102.5 };
    if (optionId === 'swap') return { op: 'swap', from: lift, to: 'Leg press' };
    if (optionId === 'add') return { op: 'add', exercise: lift, sets: 1, reps: 5 };
    return { op: 'deload', pct: n % 2 ? 20 : 30, weeks: 1 };
  };
  /** The evidence snapshot saved with a decision ("as it was when you decided"). */
  const savedEvidence = (
    id: string,
    kind: DecisionRecord['signal']['kind'],
    at: number,
  ): DecisionRecord['evidence'] => {
    const n = Number(id.replace(/\D/g, '')) || 0;
    if (kind === 'rhythm')
      return [
        {
          category: 'totals',
          level: 'full',
          granular: false,
          rows: [2, 1, 1].map((v, i) => ({
            at: at - (2 - i) * 7 * DAY,
            label: 'Sessions per week',
            value: v,
            unit: 'sessions' as const,
          })),
        },
      ];
    const lift = LIFTS[n % LIFTS.length];
    return [
      {
        category: 'sets',
        level: 'full',
        granular: true,
        rows: [114, 115, 116].map((v, i) => ({
          at: at - (2 - i) * 7 * DAY,
          label: lift,
          value: v,
          unit: 'kg' as const,
        })),
      },
    ];
  };
  const cids = ROWS.map((r) => r[0]);
  const OPTS = ['deload', 'sets', 'weight', 'swap', 'add'];
  const kinds = ['stall', 'spike', 'ready', 'rhythm'] as const;
  const mk = (
    id: string,
    clientId: string,
    kind: DecisionRecord['signal']['kind'],
    result: OutcomeResult,
    at: number,
    optionId: string,
  ): DecisionRecord => ({
    id,
    clientId,
    kind: 'program',
    status: 'recorded',
    decidedAt: at,
    windowEndsAt: at + 14 * DAY,
    signal: {
      key: `${clientId}|${kind}|x${id}`,
      kind,
      exerciseKey: null,
      severity: 'watch',
      strength: 50,
    },
    optionId,
    diff: { ops: [diffFor(optionId, id)] },
    message: '',
    reason: null,
    outcome:
      result === 'measuring'
        ? { result }
        : {
            result,
            noiseKg: 2.5,
            measuredAt: at + 14 * DAY,
            ...(kind !== 'rhythm' && kind !== 'spike'
              ? result === 'improved'
                ? { before: 114, after: 118 }
                : result === 'declined'
                  ? { before: 116, after: 112 }
                  : { before: 115, after: 116 }
              : {}),
          },
    evidence: savedEvidence(id, kind, at),
  });
  const out = named.map(([id, cid, kind, res, opt]) =>
    mk(id, cid, kind as DecisionRecord['signal']['kind'], res, when[id], opt),
  );
  fill.forEach((res, i) => {
    const at = res === 'measuring' ? D(10, 5, 10) : D(9, 1, 10) - i * 3 * DAY;
    out.push(
      mk(
        `f${i + 1}`,
        cids[i % cids.length],
        kinds[i % kinds.length],
        res,
        at,
        OPTS[i % OPTS.length],
      ),
    );
  });
  return out;
}
