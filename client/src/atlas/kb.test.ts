import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, type AskCtx } from './intents';
import { KB_TESTS } from './kb/tests';
import { COACH_DEFAULT } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 23, 18).getTime();
let n = 0;
const lift = (name: string, weight: number, reps: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: [0, 1, 2].map((i) => ({ id: `s${n++}`, reps, weight, isWarmup: false, position: i })),
  }) as unknown as Exercise;
const LIFTS: [string, number, number][] = [
  ['Barbell Bench Press - Medium Grip', 85, 8],
  ['Barbell Full Squat', 110, 6],
  ['Barbell Deadlift', 140, 5],
  ['Standing Military Press', 50, 8],
  ['Pullups', 10, 8],
  ['Bent Over Barbell Row', 70, 8],
  ['Barbell Curl', 35, 10],
];
const session = (daysAgo: number, k: number): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    gymId: 'g1',
    exercises: LIFTS.filter((_, i) => (i + k) % 2 === 0 || i < 3).map(([nm, w, r]) =>
      lift(nm, w - k, r),
    ),
  }) as unknown as Workout;

export const richCtx = (locale: 'en' | 'uk'): AskCtx => ({
  s: {
    workouts: Array.from({ length: 30 }, (_, i) => session(2 + i * 4, i % 3)),
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: {
      weights: Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        at: NOW - i * 9 * DAY,
        weight: 90 - i * 0.3,
      })),
    },
    restPeriods: [],
    exerciseRest: {},
    activities: [],
    gyms: [{ id: 'g1', name: 'Northside Gym' } as never],
    goals: {},
  },
  now: NOW,
  locale,
  temper: 2,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('gets most of ~1,350 unseen questions right, en + uk', { timeout: 300_000 }, () => {
    let ok = 0;
    let unsure = 0;
    let total = 0;
    for (const [id, e] of Object.entries(KB_TESTS))
      for (const [qs, loc] of [
        [e.test, 'en'],
        [e.testUk, 'uk'],
      ] as const)
        for (const q of qs) {
          total++;
          const a = answerLocally(q, richCtx(loc));
          if (a?.intent === id) ok++;
          else if (a?.intent === 'did_you_mean') unsure++;
        }
    // Right answer, or an honest "did you mean…" — never below these.
    expect(ok / total).toBeGreaterThan(0.75);
    expect((ok + unsure) / total).toBeGreaterThan(0.8);
  });
});

describe('question types — why / how / when / how much…', () => {
  const c = richCtx('en');
  it('answers the side of the topic that was asked', () => {
    const why = answerLocally('why do i need to rest between sets', c)!;
    const plain = answerLocally('how long should i rest between sets', c)!;
    expect(why.intent).toBe('rest');
    expect(why.text).not.toBe(plain.text);
  });
  it('offers the other sides as chips and answers them as follow-ups', () => {
    const a = answerLocally('how much protein do i need', c)!;
    expect(a.chips?.some((x) => /\?$/.test(x))).toBe(true);
    const side = a.chips!.find((x) => ['Why?', 'How?', 'When?', 'Should I?'].includes(x));
    expect(side).toBeTruthy();
    const f = answerLocally(side!, c, a.convo)!;
    expect(f.intent).toBe('protein');
    expect(f.text).not.toBe(a.text);
  });
  it('keeps your numbers for personal questions', () => {
    expect(answerLocally('what weight next time on bench', c)?.text).toMatch(/kg/);
  });
});
