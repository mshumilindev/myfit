import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from './intents';
import { richCtx } from './testCtx';

// SPO-35 · P1: questions about the user's own log must name the metric asked (weight vs reps vs sets) and the lift.
const ask = (loc: 'en' | 'uk', turns: string[]) => {
  const ctx = richCtx(loc);
  let convo: Convo = {};
  return turns.map((q) => {
    const a = answerLocally(q, ctx, convo);
    if (a) convo = a.convo;
    return a?.text ?? '';
  });
};

describe('Atlas · own-data questions', () => {
  it('weight vs reps vs sets for the last pullups session', () => {
    const [w, r, s] = ask('en', [
      'what weight did I use for pullups last time',
      'how many reps of pullups did I do last time',
      'how many sets of pullups did I do last time',
    ]);
    expect(w).toMatch(/10 kg/);
    expect(r).toMatch(/8, 8, 8/);
    expect(s).toMatch(/3/);
  });

  it('"how heavy" asks for weight, not a count of sets', () => {
    const [t] = ask('en', ['how heavy was my last pullup set']);
    expect(t).toMatch(/10 kg/);
  });

  it('asks which lift when only the metric is known, then answers', () => {
    const [q, a] = ask('en', ['what weight last time', 'pullups']);
    expect(q).toBe('Which lift?');
    expect(a).toMatch(/10 kg/);
  });

  it('keeps metric and lift in a follow-up', () => {
    const [, b] = ask('en', ['what is my bench pr', 'and for pullups?']);
    expect(b).toMatch(/Pullups/);
  });

  it('understands Ukrainian, including the lone "я"', () => {
    const [a, b] = ask('uk', ['вага на підтягуваннях', 'з яким обтяженням я робив підтягування']);
    expect(a).toMatch(/10 kg/);
    expect(b).toMatch(/10 kg/);
  });

  it('leaves advice questions to the planning topics', () => {
    const [t] = ask('en', ['what weight should I use for pullups next time']);
    expect(t).not.toMatch(/2 days ago/);
  });
});
