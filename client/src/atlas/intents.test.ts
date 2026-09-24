import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, type AskCtx } from './intents';
import { editDistance, normalize, wordMatches } from './nlu';
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
const session = (daysAgo: number, bench: number): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3600_000,
    gymId: null,
    exercises: [lift('Barbell Bench Press - Medium Grip', bench, 8), lift('Barbell Squat', 100, 5)],
  }) as unknown as Workout;

const ctx = (locale: 'en' | 'uk', temper: 1 | 2 | 3 | 4 | 5 = 2): AskCtx => ({
  s: {
    workouts: [session(21, 80), session(14, 82.5), session(7, 85)],
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

describe('nlu', () => {
  it('normalises and tolerates typos', () => {
    expect(normalize('Скільки   ВІДПОЧИВАТИ?!')).toBe('скільки відпочивати');
    expect(editDistance('recieve', 'receive')).toBe(1);
    expect(wordMatches('shuold', 'should')).toBe(true);
    expect(wordMatches('відпочивтаи', 'відпоч*')).toBe(true);
    expect(wordMatches('cat', 'car')).toBe(false); // short words: exact only
  });
});

describe('answerLocally', () => {
  const cases: [string, 'en' | 'uk', string][] = [
    ['how long should I rest between sets', 'en', 'rest'],
    ['how lng shuold i rest', 'en', 'rest'],
    ['скільки відпочивати між підходами', 'uk', 'rest'],
    ['скільки відпочивтаи', 'uk', 'rest'],
    ['what weight next time on bench?', 'en', 'next_weight'],
    ['яку вагу ставити на жим лежачи наступного разу', 'uk', 'next_weight'],
    ['what is my best bench', 'en', 'best'],
    ['мій рекорд у присіданні', 'uk', 'best'],
    ['how is my bench progressing', 'en', 'progress_lift'],
    ['what should I train today', 'en', 'today'],
    ['що сьогодні тренувати', 'uk', 'today'],
    ['my shoulder hurts', 'en', 'pain'],
    ['болить коліно після присідань', 'uk', 'pain'],
    ['how many sets for chest', 'en', 'volume_muscle'],
    ['скільки сетів на груди', 'uk', 'volume_muscle'],
    ['am I recovered', 'en', 'recovery'],
    ['how did I sleep', 'en', 'sleep'],
    ['не хочу сьогодні', 'uk', 'motivation'],
    ['should I take creatine', 'en', 'supplements'],
    ['привіт', 'uk', 'greeting'],
    ['дякую', 'uk', 'thanks'],
    ['how was my week', 'en', 'week'],
  ];
  for (const [q, loc, intent] of cases)
    it(`“${q}” → ${intent}`, () => {
      expect(answerLocally(q, ctx(loc))?.intent).toBe(intent);
    });

  it('answers with your numbers', () => {
    const a = answerLocally('what is my best bench', ctx('en'));
    expect(a?.text).toMatch(/85 kg × 8/);
  });

  it('never leaks “undefined” into a reply', () => {
    for (const t of [1, 2, 3, 4, 5] as const)
      for (const q of ['how long should I rest', 'what is my best bench', 'how was my week'])
        expect(answerLocally(q, ctx('en', t))?.text).not.toMatch(/undefined/);
  });

  it('hands unknown questions to Gemini (null)', () => {
    expect(answerLocally('what is the capital of France', ctx('en'))).toBeNull();
    expect(answerLocally('розкажи анекдот про космос', ctx('uk'))).toBeNull();
  });

  it('pain stays calm even for Merciless', () => {
    const a = answerLocally('my back hurts', ctx('en', 5));
    expect(a?.text.startsWith('Pain')).toBe(true);
    expect(a?.text).not.toMatch(/keep up|disappoint/);
  });
});
