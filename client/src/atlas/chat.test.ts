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

describe('chat access (closed testing)', () => {
  it('lets in only listed accounts; no config → nobody', async () => {
    const { chatAllowed } = await import('./chatAccess');
    expect(chatAllowed(null, 'u1', 'mykola')).toBe(false);
    expect(chatAllowed({ chatUsers: ['Mykola'] }, 'u1', 'mykola ')).toBe(true);
    expect(chatAllowed({ chatUids: ['u1'] }, 'u1', null)).toBe(true);
    expect(chatAllowed({ chatUsers: ['mykola'] }, 'u2', 'anna')).toBe(false);
  });
});

describe('Gemini quota', () => {
  it('recognises quota errors and pauses until the daily reset', async () => {
    const { isQuotaError, nextQuotaReset, geminiPausedUntil } = await import('./chat');
    expect(isQuotaError(new Error('[429] RESOURCE_EXHAUSTED: quota exceeded'))).toBe(true);
    expect(isQuotaError(new Error('network down'))).toBe(false);
    const now = Date.UTC(2026, 9, 7, 20);
    expect(nextQuotaReset(now)).toBe(Date.UTC(2026, 9, 8, 8));
    expect(geminiPausedUntil(now)).toBe(0);
  });
});
