import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { richCtx } from './testCtx';

describe('question types — why / how / when / how much…', () => {
  const c = richCtx('en');
  it('answers the side of the topic that was asked', () => {
    const why = answerLocally('why do i need to rest between sets', c)!;
    const plain = answerLocally('how long should i rest between sets', c)!;
    expect(why.intent).toBe('rest');
    expect(why.text).not.toBe(plain.text);
  });
  it('offers the other sides as chips and answers them as follow-ups', () => {
    const a = answerLocally('how much protein do i need', c)!;
    expect(a.chips?.some((x) => /\?$/.test(x))).toBe(true);
    const side = a.chips!.find((x) => ['Why?', 'How?', 'When?', 'Should I?'].includes(x));
    expect(side).toBeTruthy();
    const f = answerLocally(side!, c, a.convo)!;
    expect(f.intent).toBe('protein');
    expect(f.text).not.toBe(a.text);
  });
  it('keeps your numbers for personal questions', () => {
    expect(answerLocally('what weight next time on bench', c)?.text).toMatch(/kg/);
  });
});
