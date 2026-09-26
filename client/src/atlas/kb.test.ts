import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { KB_TESTS } from './kb/tests';
import { KB_FRESH } from './kb/fresh';
import { KB_TESTS_OTHER } from './kb/testsOther';
import { NEW_TOPICS_TESTS } from './kb/testsNew';
import { richCtx } from './testCtx';

type Set_ = Record<string, { test: string[]; testUk: string[] }>;
function score(set: Set_) {
  let ok = 0;
  let unsure = 0;
  let total = 0;
  for (const [id, e] of Object.entries(set))
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
  return { ok: ok / total, known: (ok + unsure) / total };
}

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('gets most of ~1,350 unseen questions right, en + uk', { timeout: 300_000 }, () => {
    const r = score(KB_TESTS);
    // Right answer, or an honest "did you mean…" — never below these.
    expect(r.ok).toBeGreaterThan(0.75);
    expect(r.known).toBeGreaterThan(0.8);
  });
  it(
    'newer, narrower topics (bench arch, chalk, Smith…) — deliberately tricky wording',
    { timeout: 120_000 },
    () => {
      const r = score(NEW_TOPICS_TESTS);
      expect(r.ok).toBeGreaterThan(0.7);
      expect(r.known).toBeGreaterThan(0.72);
    },
  );
  it('a second set written blind, ~1,860 questions over every topic', { timeout: 300_000 }, () => {
    const r = score(KB_FRESH);
    expect(r.ok).toBeGreaterThan(0.81);
    expect(r.known).toBeGreaterThan(0.83);
  });
});

describe('Polish, Lithuanian, Estonian — held out', () => {
  it(
    'each language above 70% right on questions never used for matching',
    { timeout: 300_000 },
    () => {
      for (const l of ['pl', 'lt', 'et'] as const) {
        let ok = 0;
        let total = 0;
        for (const [id, e] of Object.entries(KB_TESTS_OTHER))
          for (const q of e[l]) {
            total++;
            // The chat runs these in English with placeholders, then translates (translate.ts).
            if (answerLocally(q, richCtx('en'))?.intent === id) ok++;
          }
        expect(ok / total).toBeGreaterThan(0.7);
      }
    },
  );
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
