// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyBook, recordProgramDecision, type DecisionRecord } from './decisions';
import { buildOptions } from './diff';
import { measureDecision, measureLift, measureRhythm } from './outcome';
import type { LiftSession } from './signalInputs';
import { DAY } from './time';
import type { Signal } from './types';

const T0 = Date.UTC(2026, 8, 16, 10); // decision day
const sig = (kind: Signal['kind'] = 'stall'): Signal => ({
  key: `c1|${kind}|bench`,
  clientId: 'c1',
  kind,
  severity: 'urgent',
  confidence: 'high',
  strength: 60,
  exerciseKey: 'bench',
  detectedAt: T0,
  facts: { exercise: 'Bench press' },
  evidence: [],
});
const decision = (kind: Signal['kind'] = 'stall'): DecisionRecord => {
  const s = sig(kind);
  return recordProgramDecision(emptyBook(), {
    id: 'd',
    signal: s,
    option: buildOptions(s).find((o) => o.kind === 'program')!,
    now: T0,
  }).decisions[0];
};
const s = (days: number, e1rm: number, variant = 'v1'): LiftSession => ({
  at: T0 + days * DAY,
  variant,
  e1rm,
  workingSets: 3,
  rpe: 8,
  allRepsDone: true,
});
const BEFORE = [s(-12, 100), s(-8, 100), s(-3, 100)]; // median 100
const END = T0 + 14 * DAY;

describe('lift outcome', () => {
  it('is measuring on day 13 and measurable on day 14', () => {
    const d = decision();
    const data = { sessions: [...BEFORE, s(3, 103), s(9, 103)] };
    expect(measureLift(d, data, T0 + 13 * DAY).outcome.result).toBe('measuring');
    expect(measureLift(d, data, END - 1).outcome.result).toBe('measuring');
    expect(measureLift(d, data, END).outcome.result).toBe('improved');
  });

  it.each([
    [102.49, 'no-clear-change'],
    [102.5, 'improved'],
    [97.51, 'no-clear-change'],
    [97.5, 'declined'],
    [100, 'no-clear-change'],
    [101, 'no-clear-change'],
    [96, 'declined'],
  ])('delta boundary: after %f -> %s', (after, expected) => {
    const r = measureLift(decision(), { sessions: [...BEFORE, s(2, after), s(9, after)] }, END);
    expect(r.outcome.result).toBe(expected);
    expect(r.outcome).toMatchObject({ before: 100, noiseKg: 2.5 });
  });

  it('uses medians of 3 before sessions and the window sessions', () => {
    const r = measureLift(
      decision(),
      {
        sessions: [s(-30, 90), ...BEFORE.slice(0, 2), s(-3, 130), s(2, 101), s(5, 110), s(9, 104)],
      },
      END,
    );
    // before = median of the last 3 before (100, 100, 130) = 100; after = median (101, 110, 104) = 104
    expect(r.outcome).toMatchObject({ before: 100, after: 104, result: 'improved' });
  });

  it('too few sessions: extends once by 7 days, then "no clear change / not enough sessions"', () => {
    const d = decision();
    const data = { sessions: [...BEFORE, s(5, 108)] };
    const first = measureLift(d, data, END);
    expect(first.outcome).toMatchObject({ result: 'measuring', extended: true });
    expect(first.windowEndsAt).toBe(END + 7 * DAY);
    const extended: DecisionRecord = {
      ...d,
      windowEndsAt: first.windowEndsAt,
      outcome: first.outcome,
    };
    expect(measureLift(extended, data, END + 7 * DAY - 1).outcome.result).toBe('measuring');
    const second = measureLift(extended, data, END + 7 * DAY);
    expect(second.outcome).toMatchObject({
      result: 'no-clear-change',
      reason: 'not-enough-sessions',
    });
    // with enough sessions in the extension the real result is used
    const more = { sessions: [...data.sessions, s(18, 108)] };
    expect(measureLift(extended, more, END + 7 * DAY).outcome.result).toBe('improved');
  });

  it('a variant change mid-window: only sessions of the same variant count', () => {
    const d = decision();
    const mixed = {
      sessions: [
        ...BEFORE,
        s(2, 120, 'other-machine'),
        s(4, 120, 'other-machine'),
        s(6, 104),
        s(9, 104),
      ],
    };
    expect(measureLift(d, mixed, END).outcome).toMatchObject({ result: 'improved', after: 104 });
    const allOther = {
      sessions: [...BEFORE, s(2, 130, 'other-machine'), s(9, 130, 'other-machine')],
    };
    expect(measureLift(d, allOther, END).outcome).toMatchObject({
      result: 'measuring',
      extended: true,
    });
  });

  it('never words +-1 kg as good or bad', () => {
    for (const after of [101, 99, 100.9, 99.1]) {
      expect(
        measureLift(decision(), { sessions: [...BEFORE, s(2, after), s(9, after)] }, END).outcome
          .result,
      ).toBe('no-clear-change');
    }
  });

  it('informational decisions (no window) are not measured', () => {
    const d = { ...decision(), windowEndsAt: null, outcome: null };
    expect(measureLift(d, { sessions: [] }, END + 99 * DAY).windowEndsAt).toBeNull();
  });
});

describe('rhythm outcome', () => {
  const d = decision('rhythm');
  const at = (days: number) => T0 + days * DAY;
  it.each([
    ['from 1 to 3 sessions a week', [-13, -2], [1, 2, 4, 5, 8, 10], 'improved'],
    ['same pace', [-13, -6, -2, -1], [2, 4, 9, 11], 'no-clear-change'],
    ['one more per week is the threshold', [-13, -6, -2, -1], [1, 3, 5, 8, 10, 12], 'improved'],
    ['drop of two a week', [-13, -12, -6, -5, -2, -1, -3, -4], [3, 9], 'declined'],
  ])('%s', (_n, before, after, expected) => {
    const r = measureRhythm(d, { sessions: [], sessionDates: [...before, ...after].map(at) }, END);
    expect(r.outcome.result).toBe(expected);
  });
  it('dispatch by kind and measuring before the window ends', () => {
    expect(measureDecision(d, { sessions: [], sessionDates: [] }, END - 1).outcome.result).toBe(
      'measuring',
    );
    expect(measureDecision(decision('stall'), { sessions: [] }, END).outcome.result).toBe(
      'measuring',
    );
  });
});
