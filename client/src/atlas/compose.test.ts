import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from './intents';
import { parseFrame } from './frame';
import { richCtx } from './testCtx';

/** A conversation: each message answered with the state the last one left. */
function talk(locale: 'en' | 'uk', ...qs: string[]) {
  const c = richCtx(locale);
  let convo: Convo = {};
  return qs.map((q) => {
    const a = answerLocally(q, c, convo)!;
    convo = a.convo;
    return a;
  });
}

describe('the message taken apart (frame)', () => {
  it('reads days, minutes, kit, what is ruled out and what hurts', () => {
    const f = parseFrame('склади програму на 3 дні без штанги, 45 хв, болить коліно');
    expect(f.wantsPlan).toBe(true);
    expect(f.days).toBe(3);
    expect(f.minutes).toBe(45);
    expect(f.without).toContain('barbell');
    expect(f.sore).toBe('knee');
  });
  it('reads "twice a week", "at home with just dumbbells", a pull-up bar', () => {
    expect(parseFrame('what if I only train twice a week').days).toBe(2);
    const f = parseFrame('make me a 4 day plan at home with just dumbbells');
    expect(f.kit).toEqual(expect.arrayContaining(['dumbbell', 'home']));
    expect(f.only).toBe(true);
    expect(parseFrame('в мене тільки турнік').bar).toBe(true);
  });
  it('a question about today is not a request for a week plan', () => {
    const [a] = talk('uk', 'дай план тренування на зараз');
    expect(a.intent).not.toBe('plan_build');
  });
});

describe('a programme built on the spot', () => {
  it('respects kit and a sore knee, and offers to save it', () => {
    const [a] = talk('uk', 'склади мені програму на 3 дні без штанги, болить коліно');
    expect(a.intent).toBe('plan_build');
    expect(a.text).toMatch(/День 3/);
    expect(a.text).not.toMatch(/Barbell|Squat|Lunge|Leg Press/);
    expect(a.action).toEqual({ type: 'plan', days: 3, lengthMin: 60 });
  });
  it('follow-ups change one thing and keep the rest', () => {
    const [, b, c] = talk(
      'uk',
      'склади програму на 4 дні вдома з гантелями',
      'а на 3 дні?',
      'а якщо 30 хвилин?',
    );
    expect(b.action).toMatchObject({ days: 3 });
    expect(c.action).toMatchObject({ days: 3, lengthMin: 30 });
    expect(c.text).toMatch(/домашній/);
  });
  it('at home without a bar there are no pull-ups; with one there are', () => {
    const [a] = talk('en', 'make me a 3 day plan at home with just dumbbells');
    expect(a.text).not.toMatch(/Pullups|Chin-Up/);
    const [b] = talk('uk', 'в мене є тільки турнік і резинки, склади тренування на 3 дні');
    expect(b.text).toMatch(/Pullups|Chin-Up/);
  });
});

describe('two exercises side by side, "what if…"', () => {
  it('compares from the library and the log, and answers "which one for me"', () => {
    const [a, b] = talk('en', 'bench vs dips for chest', 'which one is better for me');
    expect(a.intent).toBe('compare_ex');
    expect(a.text).toMatch(/In your log/);
    expect(b.intent).toBe('compare_ex');
    expect(b.text.length).toBeLessThan(a.text.length);
  });
  it('a topic written for the pair still wins', () => {
    expect(talk('en', 'squat or leg press')[0].intent).toBe('squat_vs_press');
  });
  it('what if I train 5 times a week — from your usual week', () => {
    const [a] = talk('uk', 'що буде якщо я тренуватимусь 5 разів на тиждень');
    expect(a.intent).toBe('what_if_days');
    expect(a.text).toMatch(/Зараз ти тренуєшся/);
  });
  it('"and if 3 times a week?" after a muscle keeps the muscle', () => {
    const [, b] = talk('uk', 'як часто тренувати груди', 'а якщо 3 рази на тиждень?');
    expect(b.intent).toBe('what_if_days');
    expect(b.text).toMatch(/сетів на тиждень/);
  });
});

describe('follow-ups on the lift just discussed', () => {
  it('"and with dumbbells?" → the dumbbell version of the same lift', () => {
    const [, b] = talk('uk', 'як правильно робити жим лежачи', 'а з гантелями?');
    expect(b.intent).toBe('technique_lift');
    expect(b.text).toMatch(/Dumbbell Bench Press/);
  });
  it('"how many sets?" and "what does it give me?" keep the lift', () => {
    const [, b, c] = talk('uk', 'як робити тягу', 'а що це мені дасть?', 'а скільки підходів?');
    expect(b.intent).toBe('exercise_muscles');
    expect(c.text).toMatch(/Bent Over Barbell Row/);
  });
  it('"and for squat?" reaches back past a detour', () => {
    const [, , c] = talk('en', 'how do I bench', 'what about with dumbbells', 'and for squat?');
    expect(c.intent).toBe('technique_lift');
    expect(c.text).toMatch(/Squat/);
  });
  it('"and last month?" after a lift → that lift over the month', () => {
    const [, b] = talk('en', 'how is my bench going', 'and last month?');
    expect(b.intent).toBe('range_lift');
  });
  it('"something lighter?" after today → the same day dialled down', () => {
    const [, b] = talk('uk', 'що тренувати сьогодні', 'а щось легше?');
    expect(b.intent).toBe('today_light');
  });
});

describe('several questions in one message', () => {
  it('answers each one, in order', () => {
    const [a] = talk(
      'en',
      'how long should I rest and how much protein do I need and should I do cardio',
    );
    expect(a.text.split('\n\n').length).toBeGreaterThanOrEqual(3);
  });
  it('commas between two questions split; "sore quads, squat or skip" does not', () => {
    const [a] = talk('uk', 'скільки спати, коли пити протеїн');
    expect(a.text).toMatch(/7\+/);
    expect(a.text).toMatch(/білк|Білк/);
    const [b] = talk('en', 'sore quads today, squat or skip');
    expect(b.text.split('\n\n').length).toBe(1);
  });
  it('an answer, then the pain check-in', () => {
    const [a] = talk(
      'uk',
      'скільки відпочивати між підходами і чи можна тренуватись коли болить плече',
    );
    expect(a.text).toMatch(/2:30/);
    expect(a.convo.flow?.kind).toBe('pain');
  });
  it('one part unclear → answers the clear one and asks about the other', () => {
    const [a] = talk('uk', 'скільки відпочивати і фывапр олдж');
    expect(a.text).toMatch(/2:30/);
    expect(a.text).toMatch(/фывапр/);
  });
  it('danger still stops everything', () => {
    const [a] = talk('uk', 'скільки відпочивати і болить у грудях і задишка');
    expect(a.intent).toBe('safety_cardiac');
  });
});
