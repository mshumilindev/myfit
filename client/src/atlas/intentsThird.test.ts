import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, INTENTS, type AskCtx } from './intents';
import { INTENTS_MORE } from './intentsMore';
import { INTENTS_THIRD } from './intentsThird';
import { COACH_DEFAULT } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 7, 12).getTime();
let n = 0;
const lift = (name: string, weight: number, reps: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: [0, 1, 2].map((i) => ({ id: `s${n++}`, reps, weight, isWarmup: false, position: i })),
  }) as unknown as Exercise;
const session = (daysAgo: number, bench: number, mins = 60): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + mins * 60000,
    gymId: 'g1',
    exercises: [
      lift('Barbell Bench Press - Medium Grip', bench, 8),
      lift('Barbell Deadlift', 140, 5),
    ],
  }) as unknown as Workout;

const ctx = (locale: 'en' | 'uk'): AskCtx => ({
  s: {
    workouts: [session(21, 80, 45), session(14, 82.5, 70), session(7, 85, 60), session(2, 85, 55)],
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: {
      weights: [
        { id: 'a', at: NOW - 30 * DAY, weight: 90 },
        { id: 'b', at: NOW - DAY, weight: 91.5 },
      ],
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

const cases: [string, 'en' | 'uk', string][] = [
  ['what is the heaviest I have lifted', 'en', 'heaviest'],
  ['моя улюблена вправа', 'uk', 'favourite_lift'],
  ['how consistent am I', 'en', 'consistency'],
  ['which day do I usually train', 'en', 'best_weekday'],
  ['how long do I actually rest on average', 'en', 'rest_actual'],
  ['how much cardio did I do this week', 'en', 'cardio_done'],
  ['which gym do I go to', 'en', 'my_gym'],
  ['what is my goal', 'en', 'my_goal'],
  ['am I gaining weight', 'en', 'bw_trend'],
  ['is my bench strong', 'en', 'strength_ratio'],
  ['how many workouts this month', 'en', 'range_count'],
  ['longest workout', 'en', 'longest_session'],
  ['how to grow my chest', 'en', 'grow_muscle'],
  ['як накачати литки', 'uk', 'grow_muscle'],
  ['my arms are not growing', 'en', 'arms'],
  ['when to add weight', 'en', 'add_weight'],
  ['strength or hypertrophy', 'en', 'strength_vs_size'],
  ['I can not do pull ups, cant do pull ups', 'en', 'pullup_zero'],
  ['squat or leg press', 'en', 'squat_vs_press'],
  ['is foam rolling useful', 'en', 'foam_roll'],
  ['ice bath after gym', 'en', 'sauna_cold'],
  ['I am so stressed', 'en', 'stress'],
  ['bench press alone without spotter', 'en', 'bench_alone'],
  ['am I too old to start', 'en', 'age'],
  ['мені соромно в залі', 'uk', 'gym_anxiety'],
  ['I forgot to log yesterday', 'en', 'app_backfill'],
  ['switch to pounds', 'en', 'app_units'],
  ['how to delete a set', 'en', 'app_delete'],
  ['what is playbook', 'en', 'app_playbook'],
  ['do you lift', 'en', 'do_you_lift'],
  ['sorry', 'en', 'sorry'],
];

describe('answer base, part three', () => {
  for (const [q, loc, intent] of cases)
    it(`“${q}” → ${intent}`, () => {
      expect(answerLocally(q, ctx(loc))?.intent).toBe(intent);
    });

  it('keeps ids unique across all parts', () => {
    const ids = [...INTENTS, ...INTENTS_MORE, ...INTENTS_THIRD].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('answers with your numbers, never undefined', () => {
    expect(answerLocally('which gym do I go to', ctx('en'))?.text).toMatch(/Northside Gym \(4/);
    expect(answerLocally('am I gaining weight', ctx('en'))?.text).toMatch(/\+1\.5 kg/);
    for (const [q, loc] of cases)
      expect(answerLocally(q, ctx(loc))?.text ?? '').not.toMatch(/undefined|NaN/);
  });
});
