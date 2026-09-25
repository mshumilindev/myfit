import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, type AskCtx } from './intents';
import { resolveCatalogLift, resolveMyLift } from './liftNames';
import { buildChatFacts } from './chatFacts';
import { COACH_DEFAULT } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 23, 18).getTime();
let n = 0;
const lift = (name: string, weight: number | null, reps: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: [0, 1, 2].map((i) => ({ id: `s${n++}`, reps, weight, isWarmup: false, position: i })),
  }) as unknown as Exercise;
const workout = (daysAgo: number, ex: Exercise[]): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    gymId: 'g1',
    exercises: ex,
  }) as unknown as Workout;

// Pull-ups (no belt) only 70–120 days ago — far outside the last 8 sessions;
// lots of recent bench/pulldown sessions on top.
const workouts: Workout[] = [
  ...Array.from({ length: 12 }, (_, i) =>
    workout(2 + i * 3, [
      lift('Barbell Bench Press - Medium Grip', 80 + (12 - i), 6),
      lift('Wide-Grip Lat Pulldown', 60, 10),
    ]),
  ),
  ...Array.from({ length: 6 }, (_, i) => workout(70 + i * 10, [lift('Pullups', null, 10 - i)])),
];

const ctx = (locale: 'en' | 'uk'): AskCtx => ({
  s: {
    workouts,
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: { weights: [] },
    restPeriods: [],
    exerciseRest: {},
    activities: [],
    gyms: [{ id: 'g1', name: 'Gym' } as never],
    goals: {},
  },
  now: NOW,
  locale,
  temper: 2,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

const logged = [
  { name: 'Barbell Bench Press - Medium Grip', count: 12 },
  { name: 'Wide-Grip Lat Pulldown', count: 12 },
  { name: 'Pullups', count: 6 },
];

describe('lift names — however you call them', () => {
  it('maps spellings, languages and slang to your logged lift', () => {
    for (const q of [
      'how are my pull ups going',
      'how are my pullups',
      'pull-up progress',
      'як мої підтягування',
      'прогрес підтягувань',
      'как мои подтягивания',
    ])
      expect(resolveMyLift(q, logged), q).toBe('Pullups');
    for (const q of ['how is my lat pulldown', 'тяга верхнього блоку прогрес'])
      expect(resolveMyLift(q, logged), q).toBe('Wide-Grip Lat Pulldown');
    for (const q of ['how is my bench', 'жим лежачи прогрес'])
      expect(resolveMyLift(q, logged), q).toBe('Barbell Bench Press - Medium Grip');
  });
  it('does not invent a lift from generic words', () => {
    expect(resolveMyLift('how am I doing this week', logged)).toBeNull();
    expect(resolveCatalogLift('how am I doing this week')).toBeNull();
  });
});

describe('lift progress — whole history, bodyweight in reps', () => {
  it('answers pull-ups done months ago, in reps, oldest → newest', () => {
    for (const [q, loc] of [
      ['how are my pull ups going', 'en'],
      ['як мої підтягування', 'uk'],
      ['прогрес підтягувань', 'uk'],
    ] as const) {
      const a = answerLocally(q, ctx(loc));
      expect(a?.intent, q).toBe('progress_lift');
      expect(a?.text, q).toMatch(/Pullups: 5 → 10 (reps|повт)/);
      expect(a?.text, q).not.toMatch(/too little|замало|not enough|недостатньо/i);
      expect(a?.text, q).not.toMatch(/kg/);
    }
  });
  it('gives bodyweight lifts a reps-based "best" and chart', () => {
    const a = answerLocally('my best pull ups', ctx('en'));
    expect(a?.text).toMatch(/10 reps/);
    const p = answerLocally('how are my pull ups going', ctx('en'));
    expect(p?.chart?.unit).toBe('');
  });
  it('loaded lifts go up when the newest session is heaviest', () => {
    const a = answerLocally('how is my bench going', ctx('en'));
    expect(a?.intent).toBe('progress_lift');
    expect(a?.text).toMatch(/\(\+\d+%\)/);
  });
  it('tells Gemini about every lift over the whole history', () => {
    const f = JSON.parse(buildChatFacts(ctx('en').s as never, [], 2, NOW));
    const pu = f.allLifts.find((x: { name: string }) => x.name === 'Pullups');
    expect(pu).toMatchObject({
      measuredIn: 'reps (bodyweight)',
      sessions: 6,
      first: 5,
      last: 10,
      best: 10,
    });
    expect(
      f.recentSessions.some((s: { lifts: { name: string }[] }) =>
        s.lifts.some((l) => l.name === 'Pullups'),
      ),
    ).toBe(false);
  });
});
