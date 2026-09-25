import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from './intents';
import { richCtx } from './testCtx';

const en = richCtx('en');
const uk = richCtx('uk');

/** Ask a chain of messages, carrying the conversation. */
function chat(c: typeof en, ...qs: string[]) {
  let convo: Convo = {};
  const out = [];
  for (const q of qs) {
    const a = answerLocally(q, c, convo);
    out.push(a);
    if (a) convo = a.convo;
  }
  return out;
}

describe('conversation context — follow-ups change one thing', () => {
  it('a computed question takes a new window, lift, breakdown or measure', () => {
    const [a, b, d, e, f] = chat(
      en,
      'total volume last month',
      'and this year?',
      'by month',
      'and sets?',
      'all time',
    );
    expect(a?.text).toMatch(/last month/i);
    expect(b?.intent).toBe('log_query');
    expect(b?.text).toMatch(/this year/i);
    expect(d?.chart?.points.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(e?.text).toMatch(/sets/i);
    expect(f?.text).toMatch(/all time/i);
  });

  it('works in Ukrainian', () => {
    const [a, b, d] = chat(
      uk,
      'середня кількість повторів у жимі в серпні',
      'а в липні?',
      'а присід?',
    );
    expect(a?.text).toMatch(/серпні/);
    expect(b?.intent).toBe('log_query');
    expect(b?.text).toMatch(/липні/);
    expect(d?.text).toMatch(/Squat/);
    expect(d?.text).toMatch(/липні/);
  });

  it('a lift topic over a new window', () => {
    const [a, b] = chat(en, 'how is my bench going', 'and since june?');
    expect(a?.intent).toBe('progress_lift');
    expect(b?.intent).toBe('range_lift');
    expect(b?.text).toMatch(/since June/i);
  });

  it("'it' / 'цю вправу' means the lift we were talking about", () => {
    const [, b] = chat(en, 'how is my deadlift going', "what's my best on it");
    expect(b?.text).toMatch(/Deadlift/);
    const [, d] = chat(uk, 'як мій присід', 'який рекорд у цій вправі');
    expect(d?.text).toMatch(/Squat/);
  });

  it('a new full question is not swallowed as a follow-up', () => {
    const [, b] = chat(en, 'total volume last month', 'which lift improved most');
    expect(b?.text).toMatch(/most improved/i);
    const [, e] = chat(
      uk,
      'яка вправа виросла найбільше',
      'скільки тонн я підняв за останній місяць',
    );
    expect(e?.text).toMatch(/обʼєм \(усього\), останній місяць/i);
    expect(e?.text).not.toMatch(/Raise|Махи/);
    const [, d] = chat(en, 'total volume last month', 'my knee hurts');
    expect(d?.intent).not.toBe('log_query');
  });
});
