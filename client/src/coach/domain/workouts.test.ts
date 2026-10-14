import { describe, expect, it } from 'vitest';
import { ALL_OFF } from './consent';
import { csvText, decisionsCsv, setsCsv, strengthCsv, workoutsCsv } from './csv';
import {
  gateStrength,
  gateWorkouts,
  groupByWeek,
  liftRow,
  liftRows,
  type ClientWorkouts,
  type ExerciseResult,
  type WorkoutEntry,
} from './workouts';
import { DAY } from './time';
import type { Consent } from './types';

const T0 = Date.UTC(2026, 9, 6, 18, 0); // Tue 6 Oct 2026
const entry = (i: number, over: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  id: `e${i}`,
  at: T0 - i * 3 * DAY,
  title: 'Upper A',
  minutes: 50,
  sets: 15,
  tonnageKg: 4700,
  withTrainer: false,
  pr: i === 1,
  compliance: 100,
  ...over,
});
const sess = (n: number, e1: (i: number) => number, step = 7) =>
  Array.from({ length: n }, (_, i) => ({
    at: T0 - (n - 1 - i) * step * DAY,
    sets: 3,
    top: '100x5',
    e1rm: e1(i),
    rpe: 8,
  }));
const data: ClientWorkouts = {
  entries: Array.from({ length: 6 }, (_, i) => entry(i)),
  exercises: [
    { id: 'a', name: 'Bench press', sessions: sess(8, () => 116) },
    { id: 'b', name: 'Row', sessions: sess(8, (i) => 80 + i * 1.5) },
    { id: 'c', name: 'Curl', sessions: sess(8, (i) => 40 + i * 0.2) },
  ],
};
const consent = (o: Partial<Consent>): Consent => ({ ...ALL_OFF, ...o });

describe('gateWorkouts', () => {
  it('program-only clients never reach the data', () => {
    const g = gateWorkouts(data, 'program', consent({ totals: 'full', sets: 'full' }));
    expect(g).toEqual({ state: 'program', entries: [], detail: false });
  });
  it('no totals consent is locked and empty', () => {
    expect(gateWorkouts(data, 'app', ALL_OFF).entries).toHaveLength(0);
    expect(gateWorkouts(data, 'app', ALL_OFF).state).toBe('locked');
  });
  it('totals only: rows keep date, title and minutes, nothing from the sets', () => {
    const g = gateWorkouts(data, 'app', consent({ totals: 'full' }));
    expect(g.state).toBe('totals');
    expect(g.detail).toBe(false);
    for (const e of g.entries) {
      expect(e.minutes).toBe(50);
      expect([e.sets, e.tonnageKg, e.compliance, e.pr]).toEqual([0, 0, 0, false]);
    }
  });
  it('sets at Full shows everything', () => {
    const g = gateWorkouts(data, 'app', consent({ totals: 'full', sets: 'full' }));
    expect(g.state).toBe('full');
    expect(g.entries[1].pr).toBe(true);
  });
  it('missing data is locked, not a crash', () => {
    expect(gateWorkouts(undefined, 'app', consent({ totals: 'full' })).state).toBe('locked');
  });
});

describe('gateStrength', () => {
  it('needs sets at Full (effects only is not enough: 1RM needs the sets)', () => {
    expect(gateStrength(data, 'app', consent({ sets: 'effects' })).state).toBe('locked');
    expect(gateStrength(data, 'app', consent({ totals: 'full' })).exercises).toHaveLength(0);
    expect(gateStrength(data, 'app', consent({ sets: 'full' })).exercises).toHaveLength(3);
    expect(gateStrength(data, 'program', consent({ sets: 'full' })).state).toBe('program');
  });
});

describe('groupByWeek', () => {
  it('groups newest first by Monday and sums sets and tonnage', () => {
    const g = groupByWeek(data.entries);
    expect(g.length).toBeGreaterThan(1);
    expect(g[0].start).toBeGreaterThan(g[1].start);
    expect(g.reduce((a, x) => a + x.items.length, 0)).toBe(6);
    expect(g[0].sets).toBe(g[0].items.length * 15);
  });
});

describe('lift rows', () => {
  const by = (id: string) => liftRow(data.exercises.find((x) => x.id === id) as ExerciseResult)!;
  it('flat estimated 1RM over 4+ weeks is Stalled and not coloured as rising', () => {
    expect(by('a').stalled).toBe(true);
    expect(by('a').tone).toBe('stalled');
  });
  it('a gain of at least the noise threshold is rising', () => {
    expect(by('b').change).toBeGreaterThanOrEqual(2.5);
    expect(by('b').tone).toBe('rising');
  });
  it('a change under the threshold is neutral, never green (+-1 kg)', () => {
    const r = by('c');
    expect(Math.abs(r.change)).toBeLessThan(2.5);
    expect(r.tone === 'neutral' || r.tone === 'stalled').toBe(true);
    expect(r.tone).not.toBe('rising');
  });
  it('an exercise without sessions has no row', () => {
    expect(liftRow({ id: 'x', name: 'x', sessions: [] })).toBeNull();
  });
  it('search and sort: stalled first, biggest change first, newest first', () => {
    expect(liftRows(data.exercises, '', 'stalled').rows[0].id).toBe('a');
    expect(liftRows(data.exercises, '', 'change').rows[0].id).toBe('b');
    expect(liftRows(data.exercises, 'cur', 'recent').rows.map((r) => r.id)).toEqual(['c']);
    const all = liftRows(data.exercises, 'cur', 'recent');
    expect(all.total).toBe(3);
    expect(all.stalled).toBe(2); // a slow gain under the threshold is a stall too
  });
});

describe('CSV', () => {
  it('workouts: unshared columns are left out and named', () => {
    const totals = gateWorkouts(data, 'app', consent({ totals: 'full' }));
    const spec = workoutsCsv(totals.entries, totals.detail);
    expect(spec.columns).toEqual(['date', 'session', 'minutes', 'trainer']);
    expect(spec.omitted).toEqual(['sets', 'tonnage', 'pr', 'compliance']);
    expect(spec.rows[0]).toHaveLength(4);
    const full = gateWorkouts(data, 'app', consent({ totals: 'full', sets: 'full' }));
    const f = workoutsCsv(full.entries, full.detail);
    expect(f.omitted).toEqual([]);
    expect(f.rows).toHaveLength(6);
    expect(f.rows[0][0]).toBe('2026-10-06');
  });
  it('strength: one row per exercise session', () => {
    const spec = strengthCsv(liftRows(data.exercises, '', 'recent').rows);
    expect(spec.rows).toHaveLength(24);
    expect(spec.columns).toHaveLength(6);
  });
  it('quotes commas and neutralises formulas', () => {
    expect(
      csvText(
        ['a', 'b'],
        [
          ['x,y', '=SUM(A1)'],
          ['"q"', '+1'],
        ],
      ),
    ).toBe('a,b\r\n"x,y",\'=SUM(A1)\r\n"""q""",\'+1');
  });
  it('decisions: columns and rows line up', () => {
    const spec = decisionsCsv([
      {
        rec: { decidedAt: T0 } as never,
        client: 'Oleh',
        title: 'Deload',
        result: 'improved',
        resultLabel: 'Improved',
        followupLabel: 'Closed',
      },
    ]);
    expect(spec.rows).toEqual([['2026-10-06', 'Oleh', 'Deload', 'Improved', 'Closed']]);
    expect(spec.columns).toHaveLength(spec.rows[0].length);
  });
});

describe('per-set detail (recap grid)', () => {
  const withEx = (i: number): WorkoutEntry =>
    entry(i, {
      exercises: [
        {
          name: 'Bench press',
          sets: [
            { kg: 80, reps: 5, rpe: 8 },
            { kg: 80, reps: 5 },
          ],
        },
        { name: 'Row', sets: [{ kg: 60, reps: 8, rpe: 7.5 }] },
      ],
    });
  const d: ClientWorkouts = { entries: [withEx(0), withEx(1)], exercises: [] };
  const consent = (sets: Consent['sets']): Consent => ({ ...ALL_OFF, totals: 'full', sets });

  it('a client who shares sets at Full keeps the exercises', () => {
    const g = gateWorkouts(d, 'app', consent('full'));
    expect(g.state).toBe('full');
    expect(g.entries[0].exercises).toHaveLength(2);
  });

  it('any lower level removes every set before a component can see it', () => {
    const g = gateWorkouts(d, 'app', consent('off'));
    expect(g.state).toBe('totals');
    expect(g.entries.every((e) => e.exercises === undefined)).toBe(true);
    expect(JSON.stringify(g)).not.toContain('Bench press');
    expect(setsCsv(g.entries).rows).toEqual([]);
  });

  it('program-only and locked give nothing', () => {
    expect(gateWorkouts(d, 'program', consent('full')).entries).toEqual([]);
    expect(gateWorkouts(d, 'app', ALL_OFF).entries).toEqual([]);
  });

  it('the sets CSV has one row per set with the set number and a blank unlogged RPE', () => {
    const spec = setsCsv(gateWorkouts(d, 'app', consent('full')).entries);
    expect(spec.columns).toEqual(['date', 'session', 'exercise', 'set', 'kg', 'reps', 'rpe']);
    expect(spec.omitted).toEqual([]);
    expect(spec.rows).toHaveLength(6);
    expect(spec.rows[0]).toEqual(['2026-10-06', 'Upper A', 'Bench press', '1', '80', '5', '8']);
    expect(spec.rows[1][3]).toBe('2');
    expect(spec.rows[1][6]).toBe('');
  });
});
