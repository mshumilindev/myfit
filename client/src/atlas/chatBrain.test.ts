import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { answerLocally, didYouMean, type AskCtx } from './intents';
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
  temper: 1,
  fmt: { kg: (k) => `${k} kg`, mmss: (s) => `${s}s`, muscle: (m) => m, exercise: (e) => e },
});

const c = ctx('en');

describe('memory — learns from what you say', () => {
  it('remembers a sore knee, a goal, a banned lift, time, age', () => {
    expect(answerLocally('my knee hurts', c)?.learned?.sore?.knee).toBe(NOW);
    expect(answerLocally('I want to lose fat', c)?.learned?.goal?.v).toBe('fat_loss');
    expect(answerLocally('I hate lunges', c)?.learned?.avoid).toEqual(['Dumbbell Lunges']);
    expect(answerLocally('I only have 40 minutes', c)?.learned?.minutes?.v).toBe(40);
    expect(answerLocally('I am 52 years old', c)?.learned?.age).toBe(52);
  });
  it('forgets the knee when you say it’s fine', () => {
    const m = { ...c, mem: { sore: { knee: NOW - 1000 } } };
    const a = answerLocally('my knee is fine now', m);
    expect(a?.learned?.sore?.knee).toBeUndefined();
  });
  it('never mistakes a question for a statement', () => {
    expect(answerLocally('am I stronger than 3 months ago', c)?.learned).toBeUndefined();
  });
  it('weaves memory into advice (sore knee on squats)', () => {
    const m = { ...c, mem: { sore: { knee: NOW - 1000 } } };
    expect(answerLocally('what weight next time on squat', m)?.text).toMatch(
      /knee is still on my list/,
    );
    // With history, the number itself is the lighter one the plan uses.
    const b = answerLocally('what weight next time on bench', {
      ...c,
      mem: { sore: { shoulder: NOW - 1000 } },
    });
    expect(b?.text).toMatch(/take 67\.5 kg instead/);
  });
  it('tells what it knows', () => {
    const m = {
      ...c,
      mem: { goal: { v: 'muscle' as const, at: NOW }, minutes: { v: 45, at: NOW } },
    };
    expect(answerLocally('what do you know about me', m)?.text).toMatch(/goal: muscle; ~45 min/);
  });
});

describe('consistency — no contradictions', () => {
  it('same data → "As I said", same advice', () => {
    const a = answerLocally('what weight next time on bench', c)!;
    const b = answerLocally('what weight next time on bench', {
      ...c,
      now: NOW + 60_000,
      said: [a.said!],
    })!;
    expect(b.text).toMatch(/^As I said: /);
    expect(b.text).toContain(a.said!.text);
  });
  it('new data → says it changed instead of flipping silently', () => {
    const a = answerLocally('what weight next time on bench', c)!;
    const more = {
      ...c,
      s: { ...c.s, workouts: [...c.s.workouts, session(0, 87.5, 50)] },
      now: NOW + 3_600_000,
    };
    const b = answerLocally('what weight next time on bench', { ...more, said: [a.said!] })!;
    expect(b.text).toMatch(/logged something since I last answered/);
  });
});

describe('follow-ups never swallow a new question', () => {
  it('“squat technique” after a nutrition answer is technique', () => {
    const a = answerLocally('when should I drink a protein shake', c)!;
    expect(answerLocally('squat technique', c, a.convo)?.intent).toBe('technique_lift');
    expect(answerLocally('bench vs squat', c, a.convo)?.intent).toBe('compare_lifts');
  });
  it('“and deadlift?” still carries a lift topic', () => {
    const a = answerLocally('what weight next time on bench', c)!;
    expect(answerLocally('and deadlift?', c, a.convo)?.intent).toBe('next_weight');
  });
});

describe('actions — offered, never done without a tap', () => {
  const cases: [string, string, string][] = [
    ['set rest for bench to 3 min', 'act_rest', 'rest'],
    ['swap bench for dumbbell press', 'act_swap', 'swap'],
    ['remove deadlift from my plan', 'act_avoid', 'avoid'],
    ['start workout', 'act_start', 'start'],
    ['be nicer', 'act_temper', 'temper'],
    ['mute notifications today', 'act_mute', 'mute'],
    ['I weigh 88 kg', 'act_bodyweight', 'bodyweight'],
    ['forget everything', 'memory_forget', 'forget'],
  ];
  for (const [q, intent, type] of cases)
    it(`“${q}” → ${type}`, () => {
      const a = answerLocally(q, c);
      expect(a?.intent).toBe(intent);
      expect(a?.action?.type).toBe(type);
    });
  it('swap goes the right way round with “instead of”', () => {
    const a = answerLocally('dumbbell press instead of bench', c);
    expect(a?.action).toEqual({
      type: 'swap',
      from: 'Barbell Bench Press - Medium Grip',
      to: 'Dumbbell Bench Press',
    });
  });
});

describe('time windows, comparisons, charts, reasons', () => {
  const cases: [string, string][] = [
    ['how many workouts in the last 3 months', 'range_count'],
    ['summary of last month', 'range_summary'],
    ['bench progress since june', 'range_lift'],
    ['bodyweight last 2 months', 'range_bw'],
    ['am I stronger than 3 months ago', 'then_vs_now'],
    ['bench vs deadlift', 'compare_lifts'],
    ['why this workout today', 'why_today'],
    ['why this weight on bench', 'why_weight'],
    ['why this programme', 'why_plan'],
    ['скільки тренувань за останні 2 тижні', 'range_count'],
    ['прогрес жиму з червня', 'range_lift'],
  ];
  for (const [q, intent] of cases)
    it(`“${q}” → ${intent}`, () => {
      const a = answerLocally(q, ctx(/[а-я]/.test(q) ? 'uk' : 'en'));
      expect(a?.intent).toBe(intent);
      expect(a?.text ?? '').not.toMatch(/undefined|NaN/);
    });
  it('draws a chart for lift progress', () => {
    const a = answerLocally('bench progress since june', c);
    expect(a?.chart?.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe('depth — technique, injuries, nutrition', () => {
  it('technique: cues → mistakes → deeper, and why', () => {
    const a = answerLocally('squat technique', c)!;
    expect(a.intent).toBe('technique_lift');
    const m = answerLocally('more', c, a.convo)!;
    expect(m.text).toMatch(/Common mistakes/);
    expect(answerLocally('why?', c, a.convo)!.text).toMatch(/Knees out/);
  });
  it('pain goes deeper by body part', () => {
    // A pain check-in: the part is known → straight to "when does it hurt?"
    const a = answerLocally('my knee hurts', c)!;
    expect(a.intent).toBe('pain');
    expect(a.text).toMatch(/Don't train through it.*\?$/);
    expect(a.convo.flow?.kind).toBe('pain');
  });
  it('calories come from your bodyweight and goal', () => {
    const m = { ...c, mem: { goal: { v: 'fat_loss' as const, at: NOW } } };
    expect(answerLocally('how many calories do I need', m)?.text).toMatch(
      /91\.5 kg.*fat-loss goal/,
    );
  });
  for (const [q, intent] of [
    ['what to eat before the gym', 'pre_meal'],
    ['what to eat after training', 'post_meal'],
    ['is sugar bad', 'sugar'],
    ['my hand goes numb', 'numbness'],
    ['ice or heat', 'ice_heat'],
  ] as const)
    it(`“${q}” → ${intent}`, () => expect(answerLocally(q, c)?.intent).toBe(intent));
});

describe('other languages and did-you-mean', () => {
  for (const q of [
    'ile odpoczywać między seriami',
    'сколько отдыхать между подходами',
    'kiek ilsėtis',
    'kui kaua puhata',
  ])
    it(`understands “${q}”`, () => expect(answerLocally(q, c)?.intent).toMatch(/^rest/));
  it('offers close topics when unsure', () => {
    const g = didYouMean('protein shake timing blah', c);
    expect(g.length).toBeGreaterThan(0);
  });
});

describe('small talk', () => {
  const cases: [string, string][] = [
    ['Hey', 'greeting'],
    ['what s up', 'whats_up'],
    ['good night', 'good_night'],
    ['I am so tired', 'tired'],
    ['I am bored', 'bored'],
    ['challenge me', 'challenge'],
    ['tell me a fun fact', 'fun_fact'],
    ['haha', 'laugh'],
    ['I feel sad', 'mood_down'],
    ['lets go', 'lets_go'],
    ['are you better than chatgpt', 'rival_ai'],
    ['what time is it', 'clock'],
    ['you are dumb', 'you_dumb'],
    ['як справи', 'how_are_you'],
  ];
  for (const [q, intent] of cases)
    it(`“${q}” → ${intent}`, () => {
      const a = answerLocally(q, ctx(/[а-я]/.test(q) ? 'uk' : 'en'));
      expect(a?.intent).toBe(intent);
      expect(a?.text).not.toMatch(/As I said|undefined/);
    });
  it('a greeting is a greeting, not a workout dump', () => {
    expect(answerLocally('Hey', c)?.text).not.toMatch(/^Here\./);
  });
  it('bored → something concrete to beat from your log', () => {
    expect(answerLocally('I am bored', c)?.text).toMatch(/× \d+/);
  });
  it('emoji-only messages get a reply', () => {
    expect(answerLocally('💪', c)?.intent).toBe('emoji');
  });
  it('small talk does not hijack training questions', () => {
    expect(answerLocally('what time of day should I train', c)?.intent).toBe('time_of_day');
    expect(answerLocally('how far down should I squat', c)?.intent).not.toBe('mood_down');
  });
});
