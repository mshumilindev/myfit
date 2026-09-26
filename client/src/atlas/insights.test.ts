import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from './intents';
import { insights, TIP_EVERY } from './insights';
import { richCtx } from './testCtx';

const c = richCtx('en');
const L = (en: string) => en;

describe('“by the way…” — things Atlas noticed', () => {
  it('finds something real in the log', () => {
    const found = insights(c, L);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) expect(f.text).toMatch(/^By the way/);
  });

  it('brings it up now and then, never twice, never on pain', { timeout: 60_000 }, () => {
    const qs = [
      'how is my bench going',
      'how long should i rest',
      'how much protein do i need',
      'what should i train today',
      'how is my squat going',
      'how is my deadlift going',
      'how many sets for chest this week',
      'how do i sleep better',
      'how is my row going',
      'how is my curl going',
    ];
    let convo: Convo = {};
    const told: number[] = [];
    const ids: string[] = [];
    qs.forEach((q, i) => {
      const a = answerLocally(q, c, convo)!;
      if (/By the way/.test(a.text)) {
        told.push(i);
        expect(a.chips?.length).toBeGreaterThan(0);
      }
      convo = a.convo;
    });
    for (const t of convo.tips ?? []) {
      expect(ids).not.toContain(t);
      ids.push(t);
    }
    expect(told.length).toBeGreaterThan(0);
    for (let i = 1; i < told.length; i++)
      expect(told[i] - told[i - 1]).toBeGreaterThanOrEqual(TIP_EVERY);
    expect(answerLocally('my knee hurts', c)?.text).not.toMatch(/By the way/);
  });
});
