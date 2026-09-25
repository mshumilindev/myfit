import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { richCtx } from './testCtx';

const QS: [string, 'en' | 'uk'][] = [
  ['how is my bench going', 'en'],
  ['squat technique', 'en'],
  ['how many sets for chest this week', 'en'],
  ['how long should i rest between sets', 'en'],
  ['how much protein do i need', 'en'],
  ['як мій жим', 'uk'],
  ['скільки сетів на спину цього тижня', 'uk'],
  ['що тренувати сьогодні', 'uk'],
  ['як покращити сон', 'uk'],
];

describe('follow-up chips stay on the subject', () => {
  it('a lift answer offers more about that lift', () => {
    const a = answerLocally('how is my bench going', richCtx('en'));
    expect(a?.chips?.filter((x) => /Bench/.test(x)).length).toBeGreaterThanOrEqual(2);
    const u = answerLocally('як мій присід', richCtx('uk'));
    expect(u?.chips?.filter((x) => /Squat/.test(x)).length).toBeGreaterThanOrEqual(2);
  });

  it('a muscle answer offers more about that muscle', () => {
    const a = answerLocally('how many sets for chest this week', richCtx('en'));
    expect(a?.chips?.some((x) => /chest/i.test(x))).toBe(true);
  });

  it('chips are not the generic list', () => {
    const generic = /What should I train today\?|Що тренувати сьогодні\?/;
    const withGeneric = QS.filter(([q, loc]) => {
      const a = answerLocally(q, richCtx(loc));
      return a?.intent !== 'today' && a?.chips?.some((x) => generic.test(x));
    });
    expect(withGeneric.length).toBeLessThanOrEqual(1);
  });

  it('every chip is itself understood', () => {
    for (const [q, loc] of QS) {
      const c = richCtx(loc);
      const a = answerLocally(q, c);
      for (const chip of a?.chips ?? []) {
        const b = answerLocally(chip, c, a!.convo);
        expect(b, `${q} → ${chip}`).toBeTruthy();
        expect(b!.intent, `${q} → ${chip}`).not.toBe('did_you_mean');
      }
    }
  });
});
