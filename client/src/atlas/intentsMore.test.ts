import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, INTENTS, type AskCtx } from './intents';
import { INTENTS_MORE } from './intentsMore';
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
    primaryMuscle: undefined,
    sets: [0, 1, 2].map((i) => ({ id: `s${n++}`, reps, weight, isWarmup: false, position: i })),
  }) as unknown as Exercise;
const session = (daysAgo: number, bench: number): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3600_000,
    gymId: null,
    exercises: [
      lift('Barbell Bench Press - Medium Grip', bench, 8),
      lift('Barbell Squat', 100, 5),
      lift('Barbell Deadlift', 140, 5),
    ],
  }) as unknown as Workout;

const ctx = (locale: 'en' | 'uk', temper: 1 | 3 | 5 = 1): AskCtx => ({
  s: {
    workouts: [
      session(21, 80),
      session(14, 82.5),
      session(10, 82.5),
      session(7, 82.5),
      session(2, 85),
    ],
    coach: { ...COACH_DEFAULT, enabled: true, temper },
    injuries: [],
    sleeps: [],
    bodyMetrics: { weights: [] },
    restPeriods: [],
    exerciseRest: {},
  },
  now: NOW,
  locale,
  temper,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

const cases: [string, 'en' | 'uk', string][] = [
  ['when did I last train chest', 'en', 'muscle_last'],
  ['коли я востаннє тренував груди', 'uk', 'muscle_last'],
  ['when did I last do deadlift', 'en', 'lift_last'],
  ['how often do I bench', 'en', 'lift_count'],
  ['what is my estimated 1rm on squat', 'en', 'e1rm'],
  ['скільки я підняв за тиждень', 'uk', 'tonnage'],
  ['how often should I train chest', 'en', 'muscle_frequency'],
  ['how many times a week should I train', 'en', 'days_per_week'],
  ['how am I doing', 'en', 'how_am_i_doing'],
  ['оціни мій прогрес', 'uk', 'how_am_i_doing'],
  ['any records today', 'en', 'prs_today'],
  ['I hit a plateau', 'en', 'plateau'],
  ['не росте вага, плато', 'uk', 'plateau'],
  ['am I overtraining', 'en', 'overtraining'],
  ['full body or split?', 'en', 'split_choice'],
  ['скільки вправ робити за тренування', 'uk', 'exercises_per_session'],
  ['what is a superset', 'en', 'superset'],
  ['what does rpe mean', 'en', 'rpe'],
  ['should I stretch before lifting', 'en', 'stretch_before'],
  ['how to get abs', 'en', 'abs_daily'],
  ['should I use a belt', 'en', 'belt_straps'],
  ['how deep should I squat', 'en', 'squat_form'],
  ['how to lose fat', 'en', 'fat_loss'],
  ['як схуднути', 'uk', 'fat_loss'],
  ['will lifting make me bulky', 'en', 'myth_bulky'],
  ['does cardio kill gains', 'en', 'cardio_gains'],
  ['I am sick with a cold', 'en', 'sick'],
  ['я захворів', 'uk', 'sick'],
  ['I have a hangover', 'en', 'alcohol'],
  ['morning or evening training?', 'en', 'time_of_day'],
  ['is coffee before gym ok', 'en', 'caffeine'],
  ['when to drink protein shake', 'en', 'protein_timing'],
  ['I am on vacation', 'en', 'travel'],
  ['тренування вдома без залу', 'uk', 'home'],
  ['coming back after a break', 'en', 'comeback'],
  ['what to do on a rest day', 'en', 'rest_day'],
  ['I am a beginner where to start', 'en', 'beginner'],
  ['how to turn on notifications', 'en', 'app_notifications'],
  ['are you a bot', 'en', 'are_you_ai'],
  ['motivate me', 'en', 'motivate'],
  ['розкажи жарт', 'uk', 'joke'],
  ['good night', 'en', 'good_night'],
  ['my knee hurts when I squat', 'en', 'pain'],
];

describe('answer base, part two', () => {
  for (const [q, loc, intent] of cases)
    it(`“${q}” → ${intent}`, () => {
      expect(answerLocally(q, ctx(loc))?.intent).toBe(intent);
    });

  it('has no duplicate intent ids', () => {
    const ids = [...INTENTS, ...INTENTS_MORE].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every intent answers without crashing or leaking undefined', { timeout: 60_000 }, () => {
    for (const q of cases.map((x) => x[0]))
      for (const t of [1, 5] as const) {
        const a = answerLocally(q, ctx('en', t));
        if (a) expect(a.text).not.toMatch(/undefined|NaN/);
      }
  });

  it('knows when you last trained a muscle', () => {
    expect(answerLocally('when did I last train chest', ctx('en'))?.text).toMatch(/2 days ago/);
  });
});
