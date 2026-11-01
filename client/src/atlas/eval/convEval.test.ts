import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from '../intents';
import { richCtx } from '../testCtx';
import { CONV_CASES } from './corpusConv';

// Floors only grow (SPO-35 P0): raise them when cases are added or gaps are fixed, never lower.
const MIN_CASES = 54;
const MAX_GAPS = 6;

const run = (loc: (typeof CONV_CASES)[number]['loc'], turns: string[]) => {
  const ctx = richCtx(loc);
  let convo: Convo = {};
  let text = '';
  for (const q of turns) {
    const a = answerLocally(q, ctx, convo);
    if (a) convo = a.convo;
    text = a?.text ?? '';
  }
  return text;
};

describe('conversational exam (own-data dialogues)', () => {
  it('has not shrunk', () => expect(CONV_CASES.length).toBeGreaterThanOrEqual(MIN_CASES));

  const solid = CONV_CASES.filter((k) => !k.gap);
  it.each(solid.map((k) => [k.turns.join(' → '), k] as const))('%s', (_n, k) => {
    const text = run(k.loc, k.turns);
    expect(text, text).toMatch(k.expect);
    if (k.forbid) expect(text, text).not.toMatch(k.forbid);
  });

  it('known gaps only shrink, and a "gap" that now passes must lose its flag', () => {
    const gaps = CONV_CASES.filter((k) => k.gap);
    expect(gaps.length).toBeLessThanOrEqual(MAX_GAPS);
    const fixed = gaps.filter((k) => {
      const t = run(k.loc, k.turns);
      return k.expect.test(t) && !(k.forbid?.test(t) ?? false);
    });
    expect(fixed.map((k) => k.turns.join(' → '))).toEqual([]);
  });
});
