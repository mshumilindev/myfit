// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  acknowledgeSignal,
  annotateSignals,
  dismissSignal,
  emptyBook,
  openSignals,
  recordProgramDecision,
  signalState,
  snoozeSignal,
  stageOfDecision,
  summarizeDecisions,
  withOutcome,
  DISMISS_REASONS,
  type DecisionBook,
} from './decisions';
import { buildOptions, describeDiff } from './diff';
import { DAY } from './time';
import type { Signal } from './types';
import { NOW } from './testBuilders';

const sig = (o: Partial<Signal> = {}): Signal => ({
  key: 'c1|stall|bench',
  clientId: 'c1',
  kind: 'stall',
  severity: 'urgent',
  confidence: 'high',
  strength: 60,
  exerciseKey: 'bench',
  detectedAt: NOW,
  facts: { exercise: 'Bench press' },
  evidence: [
    {
      category: 'sets',
      level: 'full',
      granular: true,
      rows: Array.from({ length: 20 }, (_, i) => ({
        at: i,
        label: 'x',
        value: i,
        unit: 'kg' as const,
      })),
    },
  ],
  ...o,
});
const programOption = (s = sig()) => buildOptions(s).find((o) => o.kind === 'program')!;

describe('recording a program decision', () => {
  it.each([
    ['stall', 14],
    ['rhythm', 14],
    ['injury', 14],
    ['spike', 7],
    ['ready', 14],
  ] as const)('%s opens a %i day follow-up window', (kind, days) => {
    const s = sig({ kind, key: `c1|${kind}|x` });
    const b = recordProgramDecision(emptyBook(), {
      id: 'd1',
      signal: s,
      option: programOption(s),
      now: NOW,
    });
    expect(b.decisions[0]).toMatchObject({
      kind: 'program',
      status: 'recorded',
      decidedAt: NOW,
      windowEndsAt: NOW + days * DAY,
      outcome: { result: 'measuring' },
    });
  });

  it('snapshots <= 12 evidence rows with the level they were read under', () => {
    const b = recordProgramDecision(emptyBook(), {
      id: 'd1',
      signal: sig(),
      option: programOption(),
      now: NOW,
      message: 'Try paused bench',
    });
    expect(b.decisions[0].evidence[0]).toMatchObject({ level: 'full', category: 'sets' });
    expect(b.decisions[0].evidence[0].rows).toHaveLength(12);
    expect(b.decisions[0].message).toBe('Try paused bench');
  });

  it('is idempotent by id (offline replay) and keeps newest first', () => {
    const op = { id: 'd1', signal: sig(), option: programOption(), now: NOW };
    const once = recordProgramDecision(emptyBook(), op);
    const twice = recordProgramDecision(once, op);
    expect(twice.decisions).toHaveLength(1);
    const two = recordProgramDecision(once, {
      ...op,
      id: 'd2',
      now: NOW + 1000,
      signal: sig({ key: 'c2|spike|legs', clientId: 'c2', kind: 'spike' }),
    });
    expect(two.decisions.map((d) => d.id)).toEqual(['d2', 'd1']);
  });

  it('refuses a non-program option', () => {
    const wait = buildOptions(sig()).find((o) => o.kind === 'wait')!;
    expect(() =>
      recordProgramDecision(emptyBook(), { id: 'x', signal: sig(), option: wait, now: NOW }),
    ).toThrow('not-a-program-option');
  });

  it('a decided signal leaves the open list until measured, then may come back', () => {
    const s = sig();
    let b = recordProgramDecision(emptyBook(), {
      id: 'd1',
      signal: s,
      option: programOption(),
      now: NOW,
    });
    expect(signalState(b, s, NOW + DAY)).toMatchObject({ state: 'decided', decisionId: 'd1' });
    expect(openSignals(b, [s], NOW + DAY)).toEqual([]);
    b = withOutcome(b, 'd1', { result: 'no-clear-change' });
    expect(signalState(b, s, NOW + 15 * DAY).state).toBe('open');
  });
});

describe('snooze ("Wait a week")', () => {
  it('hides the key for exactly 7 days', () => {
    const s = sig();
    const b = snoozeSignal(emptyBook(), 's1', s, NOW);
    expect(signalState(b, s, NOW + 7 * DAY - 1).state).toBe('snoozed');
    expect(signalState(b, s, NOW + 7 * DAY).state).toBe('open');
    expect(b.decisions[0]).toMatchObject({
      kind: 'wait',
      status: 'snoozed',
      windowEndsAt: NOW + 7 * DAY,
    });
  });
  it('reappears early when severity rises or strength grows by the margin', () => {
    const s = sig({ severity: 'watch', strength: 40 });
    const b = snoozeSignal(emptyBook(), 's1', s, NOW);
    expect(signalState(b, { ...s, severity: 'urgent' }, NOW + DAY).state).toBe('open');
    expect(signalState(b, { ...s, strength: 54 }, NOW + DAY).state).toBe('snoozed');
    expect(signalState(b, { ...s, strength: 55 }, NOW + DAY).state).toBe('open');
  });
  it('only mutes its own key', () => {
    const b = snoozeSignal(emptyBook(), 's1', sig(), NOW);
    expect(signalState(b, sig({ key: 'c1|stall|squat' }), NOW).state).toBe('open');
  });
});

describe('dismiss', () => {
  it('needs a reason from the closed set at the function boundary', () => {
    expect(DISMISS_REASONS).toEqual(['not-useful', 'already-handled', 'wrong-data']);
    // @ts-expect-error missing reason
    expect(() => dismissSignal(emptyBook(), 'x', sig(), undefined, NOW)).toThrow(
      'dismiss-reason-required',
    );
    // @ts-expect-error not in the set
    expect(() => dismissSignal(emptyBook(), 'x', sig(), 'because', NOW)).toThrow(
      'dismiss-reason-required',
    );
  });
  it('suppresses the key for 30 days unless the evidence strengthens', () => {
    const s = sig({ strength: 60 });
    const b = dismissSignal(emptyBook(), 'x1', s, 'not-useful', NOW);
    expect(signalState(b, s, NOW + 29 * DAY).state).toBe('dismissed');
    expect(signalState(b, s, NOW + 30 * DAY).state).toBe('open');
    expect(signalState(b, { ...s, strength: 74 }, NOW + DAY).state).toBe('dismissed');
    expect(signalState(b, { ...s, strength: 75 }, NOW + DAY).state).toBe('open');
    const lower = dismissSignal(
      emptyBook(),
      'x2',
      sig({ severity: 'watch' }),
      'already-handled',
      NOW,
    );
    expect(signalState(lower, sig({ severity: 'urgent' }), NOW + DAY).state).toBe('open');
    expect(b.decisions[0]).toMatchObject({
      kind: 'dismiss',
      reason: 'not-useful',
      status: 'dismissed',
    });
  });
  it('"Wrong data" also flags the client locally', () => {
    const b = dismissSignal(emptyBook(), 'x', sig(), 'wrong-data', NOW);
    expect(b.dataQuality).toEqual({ c1: NOW });
    expect(dismissSignal(emptyBook(), 'x', sig(), 'not-useful', NOW).dataQuality).toEqual({});
  });
  it('informational signals can be acknowledged (same suppression, no reason)', () => {
    const pr = sig({ kind: 'pr', key: 'c7|pr|dl', severity: 'good' });
    const b = acknowledgeSignal(emptyBook(), pr, NOW);
    expect(signalState(b, pr, NOW + DAY).state).toBe('dismissed');
    expect(b.decisions).toHaveLength(0);
  });
  it('book operations never mutate the previous book', () => {
    const b0: DecisionBook = emptyBook();
    const frozen = JSON.stringify(b0);
    dismissSignal(b0, 'x', sig(), 'not-useful', NOW);
    snoozeSignal(b0, 'y', sig(), NOW);
    expect(JSON.stringify(b0)).toBe(frozen);
  });
});

describe('derived views', () => {
  it('annotates every signal; stage is derived, not stored', () => {
    const a = sig();
    const b = sig({ key: 'c2|spike|legs', clientId: 'c2', kind: 'spike' });
    let book = recordProgramDecision(emptyBook(), {
      id: 'd1',
      signal: a,
      option: programOption(a),
      now: NOW,
    });
    book = dismissSignal(book, 'd2', b, 'not-useful', NOW);
    expect(annotateSignals(book, [a, b], NOW).map((x) => x.state)).toEqual([
      'decided',
      'dismissed',
    ]);
    expect(stageOfDecision(book.decisions.find((d) => d.id === 'd1')!)).toBe('measuring');
    expect(
      stageOfDecision(
        withOutcome(book, 'd1', { result: 'improved' }).decisions.find((d) => d.id === 'd1')!,
      ),
    ).toBe('result');
    expect(stageOfDecision(book.decisions.find((d) => d.id === 'd2')!)).toBe('decided');
  });
  it('summary counts reconcile with the total', () => {
    let book = emptyBook();
    const results = ['improved', 'improved', 'no-clear-change', 'declined', 'measuring'] as const;
    results.forEach((r, i) => {
      const s = sig({ key: `c${i}|stall|x`, clientId: `c${i}` });
      book = recordProgramDecision(book, {
        id: `d${i}`,
        signal: s,
        option: programOption(s),
        now: NOW + i,
      });
      if (r !== 'measuring') book = withOutcome(book, `d${i}`, { result: r });
    });
    book = dismissSignal(book, 'dx', sig({ key: 'zz' }), 'not-useful', NOW);
    const sum = summarizeDecisions(book.decisions);
    expect(sum).toEqual({ total: 5, improved: 2, noChange: 1, declined: 1, measuring: 1 });
    expect(sum.improved + sum.noChange + sum.declined + sum.measuring).toBe(sum.total);
  });
});

describe('options (real diffs)', () => {
  it('every program option label IS describeDiff(diff); message is never an option', () => {
    for (const kind of [
      'stall',
      'spike',
      'ready',
      'injury',
      'rhythm',
      'machine',
      'pr',
      'nodata',
    ] as const) {
      const opts = buildOptions(sig({ kind }), { currentSets: 3, currentKg: 85 });
      for (const o of opts) {
        if (o.kind === 'program') expect(o.label).toBe(describeDiff(o.diff!));
        else expect(o.diff).toBeNull();
        expect(['program', 'wait', 'dismiss']).toContain(o.kind);
      }
      expect(opts.map((o) => o.kind).slice(-2)).toEqual(['wait', 'dismiss']);
      expect(opts.filter((o) => o.suggested).length).toBeLessThanOrEqual(1);
    }
  });
  it('the stall suggestion is "+1 set and a paused variation" as an actual diff', () => {
    const o = buildOptions(sig(), { currentSets: 3 })[0];
    expect(o.suggested).toBe(true);
    expect(o.diff!.ops).toEqual([
      { op: 'sets', exercise: 'Bench press', from: 3, to: 4 },
      { op: 'add', exercise: 'Paused bench press', sets: 3, reps: 5 },
    ]);
    expect(o.label).toBe('Bench press: 3 -> 4 sets; add Paused bench press 3x5');
  });
  it('informational kinds only wait or dismiss', () => {
    for (const kind of ['pr', 'nodata', 'machine'] as const)
      expect(buildOptions(sig({ kind })).map((o) => o.kind)).toEqual(['wait', 'dismiss']);
  });
});
