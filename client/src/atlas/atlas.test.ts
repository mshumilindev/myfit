import { describe, expect, it } from 'vitest';
import type { Exercise, Injury, SleepNight, Workout } from '../types';
import { dayFacts, sessionFacts, setFact, weekFact } from './facts';
import { effectiveTemper, lineAllowed, softenReason } from './guard';
import { say, type Fmt } from './voice';
import { COACH_DEFAULT, TEMPERS, type CoachFact, type Temper } from './types';
import { EN } from '../i18n/atlas.en';
import { UK } from '../i18n/atlas.uk';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 17); // a Monday evening
let n = 0;

const lift = (
  name: string,
  weight: number,
  reps: number[],
  rest?: { planned: number; gapSec: number },
): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: reps.map((r, i) => ({
      id: `s${n++}`,
      reps: r,
      weight,
      isWarmup: false,
      position: i,
      loggedAt: rest ? T0 + i * rest.gapSec * 1000 : undefined,
      restTargetSec: rest ? rest.planned : undefined,
    })),
  }) as unknown as Exercise;

const session = (at: number, exs: Exercise[]): Workout =>
  ({
    id: `W${n++}`,
    startedAt: at,
    finishedAt: at + 3600_000,
    gymId: null,
    exercises: exs,
  }) as unknown as Workout;

const fmt: Fmt = {
  kg: (k) => `${k} kg`,
  mmss: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
  muscle: (m) => m,
  exercise: (e) => e,
};

describe('sessionFacts', () => {
  it('finds a PR against earlier sessions only', () => {
    const old = session(T0 - 7 * DAY, [lift('Bench', 90, [6, 6])]);
    const now = session(T0, [lift('Bench', 92.5, [5])]);
    const facts = sessionFacts(now, [old, now]);
    const pr = facts.find((f) => f.kind === 'pr');
    expect(pr).toMatchObject({ exercise: 'Bench', weight: 92.5, prevWeight: 90 });
  });

  it('calls a stall after the same top weight three sessions running', () => {
    const a = session(T0 - 14 * DAY, [lift('Squat', 140, [5])]);
    const b = session(T0 - 7 * DAY, [lift('Squat', 140, [5])]);
    const c = session(T0, [lift('Squat', 140, [5])]);
    expect(sessionFacts(c, [a, b, c]).some((f) => f.kind === 'stall')).toBe(true);
    // …and only once: a fourth session at the same weight is not news again.
    const d = session(T0 + 7 * DAY, [lift('Squat', 140, [5])]);
    expect(sessionFacts(d, [a, b, c, d]).some((f) => f.kind === 'stall')).toBe(false);
    // No history → neither a PR nor a stall.
    expect(sessionFacts(c, [c]).filter((f) => f.kind !== 'session')).toEqual([]);
  });

  it('flags rest well under the athlete’s own plan, not a fixed number', () => {
    // 60 s gaps minus ~30 s of set work ≈ 30 s rest vs 150 s planned.
    const w = session(T0, [lift('Row', 80, [8, 8, 8, 8], { planned: 150, gapSec: 60 })]);
    const f = sessionFacts(w, [w]).find((x) => x.kind === 'restShort');
    expect(f).toMatchObject({ exercise: 'Row', targetSec: 150 });
    const ok = session(T0, [lift('Row', 80, [8, 8, 8, 8], { planned: 150, gapSec: 190 })]);
    expect(sessionFacts(ok, [ok]).some((x) => x.kind === 'restShort')).toBe(false);
  });

  it('marks a comeback after a long gap', () => {
    const old = session(T0 - 20 * DAY, [lift('Bench', 80, [8])]);
    const now = session(T0, [lift('Bench', 80, [8])]);
    expect(sessionFacts(now, [old, now]).find((f) => f.kind === 'comeback')).toMatchObject({
      daysOff: 20,
    });
  });
});

describe('highlights', () => {
  it('keeps at most two lift notes per session, records first', () => {
    const lifts = ['A', 'B', 'C', 'D'];
    const old = session(
      T0 - 7 * DAY,
      lifts.map((x) => lift(x, 50, [8])),
    );
    const now = session(
      T0,
      lifts.map((x, i) => lift(x, 55 + i, [8])),
    );
    const facts = sessionFacts(now, [old, now]);
    const liftNotes = facts.filter((f) => f.kind !== 'session' && f.kind !== 'comeback');
    expect(liftNotes).toHaveLength(2);
    expect(liftNotes.map((f) => (f as { exercise: string }).exercise)).toEqual(['D', 'C']);
  });
});

describe('dayFacts / weekFact', () => {
  it('reports a short night and neutral bodyweight change', () => {
    const night = {
      id: 'n1',
      date: '2026-10-05',
      bedtime: T0 - 10 * 3600_000,
      wake: T0 - 5 * 3600_000,
    } as unknown as SleepNight;
    const body = {
      weights: [
        { id: 'a', at: T0 - 30 * DAY, weight: 100 },
        { id: 'b', at: T0 - DAY, weight: 102.5 },
      ],
    };
    const facts = dayFacts({
      finished: [],
      plays: [],
      sleeps: [night],
      body: body as never,
      now: T0,
    });
    expect(facts.find((f) => f.kind === 'shortSleep')).toMatchObject({ hours: 5 });
    expect(facts.find((f) => f.kind === 'bodyweight')).toMatchObject({ kg: 102.5, deltaPct: 2.5 });
  });

  it('compares the week with the usual number of sessions', () => {
    const hist: Workout[] = [];
    for (let w = 1; w <= 8; w++)
      for (let d = 0; d < 3; d++) hist.push(session(T0 - w * 7 * DAY - (d + 1) * DAY, []));
    hist.push(session(T0 - DAY, []));
    expect(weekFact(hist, T0)).toMatchObject({ sessions: 1, planned: 3 });
  });
});

describe('guard', () => {
  const ctx = { injuries: [] as Injury[], restPeriods: [], sleeps: [], finished: [], now: T0 };
  it('keeps the chosen temper on a normal day', () => {
    expect(effectiveTemper({ ...COACH_DEFAULT, temper: 5 }, ctx)).toBe(5);
  });
  it('softens to Steady when injured or ill', () => {
    const inj = { id: 'i', stage: 'rebuild', muscles: ['chest'] } as unknown as Injury;
    expect(softenReason({ ...ctx, injuries: [inj] })).toBe('injury');
    expect(effectiveTemper({ ...COACH_DEFAULT, temper: 5 }, { ...ctx, injuries: [inj] })).toBe(2);
    const ill = { id: 'r', mode: 'illness', startDay: 0, endDay: 0, open: true, createdAt: 0 };
    expect(
      effectiveTemper({ ...COACH_DEFAULT, temper: 4 }, { ...ctx, restPeriods: [ill] as never }),
    ).toBe(2);
  });
  it('never lets a hard temper talk about the body', () => {
    expect(lineAllowed('You look fat', 5)).toBe(false);
    expect(lineAllowed('Ти товстий', 4)).toBe(false);
    expect(lineAllowed('You look fat', 2)).toBe(true);
    expect(lineAllowed('Pathetic. 5 reps.', 5)).toBe(true);
  });
});

describe('voice', () => {
  const facts: CoachFact[] = [
    { kind: 'session', id: 'a', at: 0, workoutId: 'w', sets: 16, volumeKg: 9800, minutes: 62 },
    { kind: 'pr', id: 'b', at: 0, exercise: 'Bench', weight: 92.5, reps: 5, prevWeight: 90 },
    { kind: 'stall', id: 'c', at: 0, exercise: 'Squat', weight: 140, sessions: 3 },
    { kind: 'restShort', id: 'd', at: 0, exercise: 'Row', restSec: 70, targetSec: 150 },
    { kind: 'setDrop', id: 'd2', at: 0, exercise: 'Row', reps: 5, prevReps: 8 },
    { kind: 'skipped', id: 'e', at: 0, dayName: 'Legs' },
    { kind: 'imbalance', id: 'f', at: 0, low: 'quads', high: 'chest', lowSets: 6, highSets: 18 },
    { kind: 'week', id: 'g', at: 0, sessions: 3, planned: 4 },
    { kind: 'comeback', id: 'h', at: 0, daysOff: 12 },
    { kind: 'shortSleep', id: 'i', at: 0, hours: 5.2 },
    { kind: 'streak', id: 'j', at: 0, days: 14 },
    { kind: 'bodyweight', id: 'k', at: 0, kg: 102.5, deltaPct: 2, days: 30 },
  ];

  it('has a line for every fact × temper in en and uk', () => {
    for (const book of [EN, UK])
      for (const f of facts)
        for (const t of TEMPERS) {
          const list = (book[f.kind] as unknown as Record<Temper, unknown[]>)[t];
          expect(list?.length ?? 0, `${f.kind} ${t}`).toBeGreaterThan(0);
        }
    for (const locale of ['en', 'uk', 'pl'] as const)
      for (const f of facts)
        for (const t of TEMPERS) expect(say(f, t, { locale, fmt, yoMama: true })).not.toBe('');
  });

  it('says the same event the same way, and bodyweight neutrally', () => {
    const f = facts[0];
    expect(say(f, 5, { locale: 'en', fmt, yoMama: true })).toBe(
      say(f, 5, { locale: 'en', fmt, yoMama: true }),
    );
    const bw = facts.find((f) => f.kind === 'bodyweight')!;
    expect(say(bw, 5, { locale: 'en', fmt, yoMama: true })).toBe(
      say(bw, 2, { locale: 'en', fmt, yoMama: true }),
    );
  });

  it('keeps “your mom” out when it is switched off', () => {
    for (let i = 0; i < 40; i++) {
      const f: CoachFact = { ...facts[2], id: `stall${i}` } as CoachFact;
      expect(say(f, 5, { locale: 'en', fmt, yoMama: false })).not.toMatch(/mom/i);
    }
    const any = Array.from({ length: 40 }, (_, i) =>
      say({ ...facts[2], id: `s${i}` } as CoachFact, 5, { locale: 'en', fmt, yoMama: true }),
    );
    expect(any.some((l) => /mom/i.test(l))).toBe(true);
  });
});

describe('setFact', () => {
  const base = { workoutId: 'w', setId: 's', exercise: 'Bench', reps: 8, weight: 80, at: 0 };
  it('jabs at rest well under the plan', () => {
    expect(setFact({ ...base, prev: null, restSec: 60, restTargetSec: 150 })?.kind).toBe(
      'restShort',
    );
  });
  it('jabs at reps falling off at the same weight', () => {
    const f = setFact({
      ...base,
      reps: 5,
      prev: { reps: 8, weight: 80 },
      restSec: 160,
      restTargetSec: 150,
    });
    expect(f).toMatchObject({ kind: 'setDrop', reps: 5, prevReps: 8 });
  });
  it('stays quiet on a normal set', () => {
    expect(
      setFact({
        ...base,
        reps: 7,
        prev: { reps: 8, weight: 80 },
        restSec: 150,
        restTargetSec: 150,
      }),
    ).toBeNull();
  });
});
