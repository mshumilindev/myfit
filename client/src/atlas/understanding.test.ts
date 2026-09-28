/**
 * Understanding contracts: statements vs questions, activities told, complaints,
 * fuzzy matching that never invents words, memory that learns only what you
 * actually said about yourself, and a confidence on every answer.
 */
import { describe, expect, it } from 'vitest';
import { answerLocally, CONFIDENT } from './intents';
import { exactGroupMatches, expandSlang, tokens, wordMatches } from './nlu';
import { learn } from './memory';
import { activityReport, isComplaint } from './activityReport';
import { isStatement } from './qtype';
import { richCtx } from './testCtx';

const en = () => ({ ...richCtx('en'), temper: 5 as const });
const uk = () => richCtx('uk');
const NOW = richCtx('en').now;
const learnFrom = (q: string, mem = {}) =>
  learn(tokens(q), tokens(q).join(' '), mem, NOW, null, (x) => x, { raw: q }).patch;

describe('a statement about an activity is not a "why today" question', () => {
  it('the dance message from the field', () => {
    const a = answerLocally('I danced for 2 hours today, why not commenting on that?', en())!;
    expect(a.intent).toBe('activity_report');
    expect(a.text).toMatch(/Fair/);
    expect(a.text).toMatch(/Dancing/);
    expect(a.text).toMatch(/2 h/);
    // Nothing about "experienced lifter" — "danced" is not "advanced".
    expect(a.learned).toBeUndefined();
    expect(a.text).not.toMatch(/experienced/i);
    expect(a.action).toMatchObject({ type: 'activity', kind: 'dance', minutes: 120 });
    expect(a.confidence).toBeGreaterThanOrEqual(CONFIDENT);
  });
  it('reads activities in English, Ukrainian, Russian-style and Latin-typed', () => {
    expect(activityReport('ran 5k this morning', NOW)).toMatchObject({ kind: 'run', km: 5 });
    expect(activityReport('пробіг 5 км зранку', NOW)).toMatchObject({ kind: 'run', km: 5 });
    expect(activityReport('вчора годину плавав', NOW)).toMatchObject({
      kind: 'swim',
      minutes: 60,
      daysAgo: 1,
    });
    expect(activityReport('танцевал 2 часа', NOW)).toMatchObject({ kind: 'dance', minutes: 120 });
    expect(answerLocally('ya tantsiuvav 2 hodyny', en())?.intent).toBe('activity_report');
    expect(answerLocally('була на йозі 45 хвилин', uk())?.intent).toBe('activity_report');
  });
  it('questions about a sport or about logging it stay their own topics', () => {
    expect(activityReport('can i run and lift at the same time', NOW)).toBeNull();
    expect(activityReport('how do i log a run in the app', NOW)).toBeNull();
    expect(activityReport('how much cardio did i do this week', NOW)).toBeNull();
    expect(activityReport('скільки кардіо я зробив цього тижня', NOW)).toBeNull();
    expect(activityReport('i play football, how should i lift', NOW)).toBeNull();
    expect(activityReport('10k steps a day enough?', NOW)).toBeNull();
    expect(activityReport('хто виграв чемпіонат світу з футболу', NOW)).toBeNull();
  });
  it('recovery work is recovery, and an activity already logged is not offered again', () => {
    expect(answerLocally('i was in the sauna for 30 min', en())?.text).toMatch(/recovery/i);
    const c = en();
    const logged = {
      ...c,
      s: {
        ...c.s,
        activities: [
          {
            id: 'a1',
            type: 'run',
            category: 'conditioning' as const,
            startedAt: NOW - 3_600_000,
            finishedAt: NOW,
            durationMin: 40,
          },
        ],
      },
    };
    const a = answerLocally('ran for 40 minutes today', logged)!;
    expect(a.intent).toBe('activity_report');
    expect(a.action).toBeUndefined();
    expect(a.text).toMatch(/in your log/);
  });
});

describe('told activities come out translated in pl / lt / et', () => {
  it('every sentence of the answer is in the dictionaries', async () => {
    const { markFmt, translateOut, setDict } = await import('./translate');
    for (const loc of ['pl', 'lt', 'et'] as const) {
      const { DICT } = await import(`../i18n/atlasDict.${loc}.ts`);
      setDict(loc, DICT);
      const c0 = richCtx('en');
      const c = { ...c0, fmt: markFmt(c0.fmt) };
      for (const q of [
        'I danced for 2 hours today, why not commenting on that?',
        'ran 5k this morning',
        'did 45 min of yoga today',
        'went swimming for an hour yesterday',
      ]) {
        const out = translateOut(answerLocally(q, c)!.text, loc, c0.fmt);
        expect(out).not.toMatch(
          /that counts|Time:|Distance:|Want me to log|recovery work|conditioning/,
        );
      }
    }
  });
});

describe('complaints are about the chat, not a topic', () => {
  it('recognises them', () => {
    expect(isComplaint("why aren't you answering my question")).toBe(true);
    expect(isComplaint('чому ти не відповідаєш на моє питання')).toBe(true);
    expect(isComplaint('how long should i rest')).toBe(false);
    expect(answerLocally("why aren't you answering my question", en())?.intent).toBe('you_dumb');
  });
});

describe('fuzzy matching never invents words', () => {
  it('different first letter or two edits apart in length → no match', () => {
    expect(wordMatches('danced', 'advanced')).toBe(false);
    expect(wordMatches('fast', 'last')).toBe(false);
    // Real typos still land.
    expect(wordMatches('protien', 'protein')).toBe(true);
    expect(wordMatches('shuold', 'should')).toBe(true);
    expect(wordMatches('deadlfit', 'deadlift*')).toBe(true);
  });
  it('memory matching is exact', () => {
    expect(exactGroupMatches(['danced'], 'danced', ['advanced'])).toBe(false);
    expect(exactGroupMatches(['beginner'], 'beginner', ['beginner'])).toBe(true);
  });
});

describe('memory learns only what you state about yourself', () => {
  it('no facts from fuzzy lookalikes, questions, negations or somebody else', () => {
    expect(learnFrom('I danced for 2 hours today').level).toBeUndefined();
    expect(learnFrom("what's the best split for a beginner?").level).toBeUndefined();
    expect(learnFrom("I'm not a beginner").level).toBeUndefined();
    expect(learnFrom('я не новачок').level).toBeUndefined();
    expect(learnFrom('my friend is a beginner, what should he do').level).toBeUndefined();
    expect(learnFrom('workout at home no equipment').home).toBeUndefined();
    expect(learnFrom('can i train 3 days a week?').days).toBeUndefined();
    expect(learnFrom("i don't want to lose weight, i want to get big").goal?.v).toBe('muscle');
  });
  it('still learns plain statements', () => {
    expect(learnFrom("I'm a beginner, where do I start?").level).toBe('beginner');
    expect(learnFrom('я новачок').level).toBe('beginner');
    expect(learnFrom('I train at home').home).toBe(true);
    expect(learnFrom('i can train 3 days a week').days?.v).toBe(3);
    expect(learnFrom('мені 35 років').age).toBe(35);
    expect(learnFrom("i've got years of training behind me, i'm experienced").level).toBe(
      'advanced',
    );
  });
});

describe('statements, slang and negation', () => {
  it('tells a statement from a question', () => {
    expect(isStatement('i can train 3 days a week')).toBe(true);
    expect(isStatement('тиждень не ходив у зал')).toBe(true);
    expect(isStatement('can i train 3 days a week')).toBe(false);
    expect(isStatement('how many workouts did i do')).toBe(false);
  });
  it('spells out chat shorthand and drops "bro"', () => {
    expect(expandSlang('tmrw workout?')).toBe('tomorrow workout?');
    expect(expandSlang('bro what do i hit 2day')).toBe('what do i hit today');
    expect(expandSlang('bro')).toBe('bro');
  });
  it('"I\'m not a beginner" is not the beginner topic', () => {
    expect(answerLocally("i'm not a beginner", en())?.intent).not.toBe('beginner');
  });
  it('"why am I weaker today" is not "why this workout"', () => {
    expect(answerLocally('why am i weaker today', en())?.intent).toBe('weaker_today');
  });
});

describe('every answer carries a confidence', () => {
  it('in 0..1, high for clear questions, low for noise', () => {
    for (const q of [
      'how long should i rest between sets',
      'що тренувати сьогодні',
      'asdfgh',
      'hi',
    ])
      expect(answerLocally(q, /[а-я]/u.test(q) ? uk() : en())?.confidence).toBeGreaterThanOrEqual(
        0,
      );
    expect(
      answerLocally('how long should i rest between sets', en())!.confidence,
    ).toBeGreaterThanOrEqual(CONFIDENT);
    expect(answerLocally('asdfgh', en())!.confidence).toBeLessThan(CONFIDENT);
  });
});
