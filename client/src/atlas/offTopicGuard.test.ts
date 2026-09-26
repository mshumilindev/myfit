import { describe, expect, it } from 'vitest';
import {
  alwaysAnswered,
  blockedUntil,
  BLOCK_MS,
  strike,
  STRIKE_WINDOW,
  type GuardState,
} from './offTopicGuard';
import { answerLocally } from './intents';
import { richCtx } from './testCtx';
import { uk } from '../i18n/uk';
import { en } from '../i18n/en';

const empty: GuardState = { strikes: [], blockedUntil: 0 };
const T = 1_800_000_000_000;

describe('off-topic guard', () => {
  it('two warnings, the third blocks for 30 minutes and wipes the slate', () => {
    const a = strike(empty, T);
    expect(a.n).toBe(1);
    expect(blockedUntil(a.state, T)).toBe(0);
    const b = strike(a.state, T + 60_000);
    expect(b.n).toBe(2);
    const c = strike(b.state, T + 120_000);
    expect(c.n).toBe(3);
    expect(blockedUntil(c.state, T + 120_001)).toBe(T + 120_000 + BLOCK_MS);
    expect(c.state.strikes).toEqual([]);
    expect(blockedUntil(c.state, T + 120_000 + BLOCK_MS + 1)).toBe(0);
  });
  it('old warnings are forgiven after a day', () => {
    const a = strike(empty, T);
    const b = strike(a.state, T + STRIKE_WINDOW + 1);
    expect(b.n).toBe(1);
  });
  it('safety and pain are answered even while blocked', () => {
    expect(alwaysAnswered('safety_cardiac')).toBe(true);
    expect(alwaysAnswered('pain')).toBe(true);
    expect(alwaysAnswered('rest')).toBe(false);
  });
  it('every temper warns, names ChatGPT, and the third says until when', () => {
    for (const s of [uk, en])
      for (const t of [0, 1, 2]) {
        expect(s.atlasOffWarn(1, t, '14:30')).toMatch(/ChatGPT/);
        expect(s.atlasOffWarn(1, t, '14:30')).toMatch(/30|пів години|half an hour/);
        expect(s.atlasOffWarn(3, t, '14:30')).toMatch(/14:30/);
      }
  });
});

describe('what counts as off-topic', () => {
  const c = richCtx('uk');
  it.each([
    'розкажи про космос',
    'яка гра краща, dota чи fortnite',
    'в чому сенс життя',
    'допоможи з домашнім завданням з математики',
  ])('%s → off_topic', (q) => expect(answerLocally(q, c)?.intent).toBe('off_topic'));
  it.each([
    'скільки відпочивати між підходами',
    'чи можна тренуватися після футболу',
    'як тренуватись у подорожі',
    'бігати в космосі не буду, але скільки кардіо робити',
  ])('%s is not a strike', (q) => expect(answerLocally(q, c)?.intent).not.toBe('off_topic'));
  it('a training question with the weather tacked on: answered, the rest declined', () => {
    const a = answerLocally('скільки відпочивати між підходами і яка завтра погода', c)!;
    expect(a.intent).not.toBe('off_topic');
    expect(a.text).toMatch(/2:30/);
    expect(a.text).toMatch(/ChatGPT/);
  });
});
