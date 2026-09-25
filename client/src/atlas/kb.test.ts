import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { KB_TESTS } from './kb/tests';
import { richCtx } from './testCtx';

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('gets most of ~1,350 unseen questions right, en + uk', { timeout: 300_000 }, () => {
    let ok = 0;
    let unsure = 0;
    let total = 0;
    for (const [id, e] of Object.entries(KB_TESTS))
      for (const [qs, loc] of [
        [e.test, 'en'],
        [e.testUk, 'uk'],
      ] as const)
        for (const q of qs) {
          total++;
          const a = answerLocally(q, richCtx(loc));
          if (a?.intent === id) ok++;
          else if (a?.intent === 'did_you_mean') unsure++;
        }
    // Right answer, or an honest "did you mean…" — never below these.
    expect(ok / total).toBeGreaterThan(0.75);
    expect((ok + unsure) / total).toBeGreaterThan(0.8);
  });
});

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
