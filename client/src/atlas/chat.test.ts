import { describe, expect, it } from 'vitest';
import { systemPrompt } from './chat';
import { buildChatFacts } from './chatFacts';
import { COACH_DEFAULT } from './types';

describe('Atlas chat prompt', () => {
  it('pins language, temper and the no-body rule for hard tempers', () => {
    const p = systemPrompt({
      temper: 5,
      coach: { ...COACH_DEFAULT, enabled: true },
      locale: 'uk',
      factsJson: '{}',
    });
    expect(p).toMatch(/Ukrainian/);
    expect(p).toMatch(/merciless/);
    expect(p).toMatch(/Never comment on body weight/);
    expect(p).toMatch(/only numbers that appear in FACTS/);
  });
  it('drops “your mom” and swearing unless switched on', () => {
    const off = systemPrompt({
      temper: 5,
      coach: { ...COACH_DEFAULT, enabled: true, yoMama: false, swearing: false },
      locale: 'en',
      factsJson: '{}',
    });
    expect(off).toMatch(/No "your mom" jokes/);
    expect(off).toMatch(/No swearing/);
  });
});

describe('chat facts', () => {
  const store = {
    workouts: [],
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: {
      weights: [{ id: 'a', at: 1, weight: 90 }],
      dob: '1990-07-01',
      sex: 'male' as const,
    },
  };
  it('never sends the birth date, and no bodyweight to hard tempers', () => {
    const hard = buildChatFacts(store as never, [], 5, Date.now());
    expect(hard).not.toMatch(/1990/);
    expect(JSON.parse(hard).bodyweightKg).toBeUndefined();
    expect(JSON.parse(buildChatFacts(store as never, [], 2, Date.now())).bodyweightKg).toBe(90);
  });
});
