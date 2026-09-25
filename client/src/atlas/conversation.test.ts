import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { ALL_INTENTS, answerLocally, INTENTS, type AskCtx } from './intents';
import { INTENTS_MORE } from './intentsMore';
import { INTENTS_THIRD } from './intentsThird';
import { INTENTS_FOURTH } from './intentsFourth';
import { DEPTH } from './depth';
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
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    gymId: 'g1',
    exercises: [
      lift('Barbell Bench Press - Medium Grip', bench, 8),
      lift('Barbell Deadlift', 140, 5),
    ],
  }) as unknown as Workout;

const ctx = (locale: 'en' | 'uk'): AskCtx => ({
  s: {
    workouts: [session(14, 82.5), session(7, 85), session(2, 85)],
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: { weights: [] },
    restPeriods: [],
    exerciseRest: {},
    activities: [],
    gyms: [{ id: 'g1', name: 'Northside Gym' } as never],
    goals: {},
  },
  now: NOW,
  locale,
  temper: 1,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

describe('a conversation, not a FAQ', () => {
  const c = ctx('en');

  it('goes deeper on “why?” and “more”, layer by layer', () => {
    const a = answerLocally('how long should I rest', c)!;
    const why = answerLocally('why?', c, a.convo)!;
    expect(why.intent).toBe('rest');
    expect(why.text).not.toBe(a.text);
    const m1 = answerLocally('tell me more', c, a.convo)!;
    const m2 = answerLocally('more', c, m1.convo)!;
    expect(m1.convo.depth).toBe(1);
    expect(m2.convo.depth).toBe(2);
    expect(new Set([a.text, m1.text, m2.text]).size).toBe(3);
  });

  it('carries the topic to a new lift (“and deadlift?”)', () => {
    const a = answerLocally('what weight next time on bench', c)!;
    const b = answerLocally('and deadlift?', c, a.convo)!;
    expect(b.intent).toBe('next_weight');
    expect(b.convo.exercise).toBe('Barbell Deadlift');
  });

  it('offers follow-up chips with every answer', () => {
    expect(answerLocally('how long should I rest', c)?.chips?.length).toBeGreaterThan(0);
  });

  it('answers several questions in one message', () => {
    const a = answerLocally('how long should I rest? and how much protein do I need?', c)!;
    expect(a.text.split('\n\n')).toHaveLength(2);
  });

  it('reads Ukrainian typed in Latin letters', () => {
    expect(answerLocally('skilky vidpochyvaty mizh pidkhodamy', c)?.intent).toBe('rest');
  });

  it('hears “not” — no pain answer when nothing hurts', () => {
    expect(answerLocally('my back does not hurt, what should I train today', c)?.intent).toBe(
      'today',
    );
  });

  it('every depth entry points at a real intent', () => {
    const all = [...INTENTS, ...INTENTS_MORE, ...INTENTS_THIRD, ...INTENTS_FOURTH].map((i) => i.id);
    expect(new Set(all).size).toBe(all.length);
    const every = ALL_INTENTS().map((i) => i.id);
    expect(new Set(every).size).toBe(every.length);
    for (const id of Object.keys(DEPTH)) expect(every).toContain(id);
  });
});

describe('answer base, part four (calculators, exercise knowledge, time)', () => {
  const c = ctx('en');
  const cases: [string, string, RegExp][] = [
    ['how to load 100 kg', 'plate_math', /25 \+ 15/],
    ['what is 80% of my bench', 'percent_max', /80%/],
    ['how many reps can I do with 70 kg bench', 'reps_at_weight', /70 kg/],
    ['warm up sets for deadlift', 'warmup_lift', /bar × 10/],
    ['what muscles does deadlift work', 'exercise_muscles', /mainly/],
    ['alternative to bench press', 'alternatives', /Instead of/],
    ['I only have 30 minutes', 'short_on_time', /30 minutes/],
    ['what can I ask you', 'what_can_i_ask', /Anything/],
  ];
  for (const [q, intent, re] of cases)
    it(`“${q}” → ${intent}`, () => {
      const a = answerLocally(q, c);
      expect(a?.intent).toBe(intent);
      expect(a?.text).toMatch(re);
      expect(a?.text).not.toMatch(/undefined|NaN/);
    });

  it('muscle word alone is not a lift (“train chest” stays a muscle question)', () => {
    expect(answerLocally('how often should I train chest', c)?.convo.exercise).toBeNull();
  });

  it('football alone is not a lifting question', () => {
    const a = answerLocally('хто виграв чемпіонат світу з футболу', ctx('uk'));
    expect(!a || a.intent === 'did_you_mean' || a.intent === 'off_topic').toBe(true);
  });
});
