import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { richCtx } from './testCtx';

const en = richCtx('en');
const uk = richCtx('uk');
const ask = (q: string, c = en) => answerLocally(q, c);

describe('free questions about your log — computed, not canned', () => {
  const cases: [string, 'en' | 'uk', RegExp][] = [
    ['average reps on bench in august', 'en', /reps per set.*august: 8/i],
    ['середня кількість повторів у жимі в серпні', 'uk', /повторів за сет.*серпні: 8/i],
    ['which lift improved most', 'en', /most improved/i],
    ['яка вправа виросла найбільше', 'uk', /найбільше виросла/i],
    ['какое упражнение выросло больше всего', 'uk', /найбільше виросла/i],
    ['which lift improved the most in the last 3 months', 'en', /the last 3 months/i],
    ['how many tonnes did I lift this year', 'en', /total volume, this year: \d+ t/i],
    ['скільки тонн я підняв цього року', 'uk', /обʼєм.*цього року: \d+ т/i],
    ['total volume last month', 'en', /total volume, last month/i],
    ['which day do I train most', 'en', /most: \w+day/i],
    ['в який день тижня я тренуюсь найчастіше', 'uk', /найбільше: \p{L}+/u],
    ['which muscle did I train least this month', 'en', /least/i],
    ['який мʼяз я тренував найменше цього місяця', 'uk', /найменше/i],
    ['how many reps of squat did I do in total', 'en', /reps, barbell full squat, all time: \d+/i],
    ['did my volume go up this month', 'en', /this month vs .* the period before/i],
    ['which lift dropped the most', 'en', /dropped|nothing dropped/i],
  ];
  it.each(cases)('%s', (q, loc, re) => {
    const a = ask(q, loc === 'uk' ? uk : en);
    expect(a?.intent, a?.text).toBe('log_query');
    expect(a?.text).toMatch(re);
    expect(a?.text).not.toMatch(/undefined|NaN|Infinity/);
  });

  it('ranks the top N you ask for', () => {
    const a = ask('top 5 lifts by volume');
    expect(a?.intent).toBe('log_query');
    expect(a?.text.match(/\d\. /g)?.length).toBe(5);
  });

  it('draws a chart for a breakdown over time', () => {
    for (const q of ['volume by month', 'обʼєм по місяцях']) {
      const a = ask(q, q.startsWith('о') ? uk : en);
      expect(a?.intent, q).toBe('log_query');
      expect(a?.chart?.points.length ?? 0, q).toBeGreaterThanOrEqual(2);
    }
  });

  it('leaves advice, knowledge and other topics alone', () => {
    for (const q of [
      'how many sets per week should I do',
      'what is the best rep range',
      'which muscles does squatting build',
      'best lifts for better posture',
      'what weekday is it',
      'how long ago did i squat',
      "what's the reason my bench number went down",
      'how often should I train chest',
    ])
      expect(ask(q)?.intent, q).not.toBe('log_query');
    for (const q of ['скільки годин я проспав учора', 'скільки підходів треба на груди'])
      expect(ask(q, uk)?.intent, q).not.toBe('log_query');
  });

  it('offers next questions as chips', () => {
    expect(ask('total volume last month')?.chips?.length).toBeGreaterThan(0);
  });
});
