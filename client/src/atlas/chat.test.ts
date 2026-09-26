import { describe, expect, it } from 'vitest';
import { classifyPrompt, parseTopicPick, systemPrompt } from './chat';
import { answerAs, topicMenu } from './intents';
import { richCtx } from './testCtx';
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
      coach: {
        ...COACH_DEFAULT,
        enabled: true,
        yoMama: false,
        swearing: false,
      },
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
    expect(JSON.parse(buildChatFacts(store as never, [], 1, Date.now())).bodyweightKg).toBe(90);
  });
});

describe('chat access', () => {
  it('open to everyone; config/atlas chatOff is the emergency brake', async () => {
    const { chatAllowed } = await import('./chatAccess');
    expect(chatAllowed(null)).toBe(true);
    expect(chatAllowed({})).toBe(true);
    expect(chatAllowed({ chatOff: true })).toBe(false);
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

describe('Gemini as a topic picker (answer stays local)', () => {
  const topics = [
    { id: 'rest', ask: 'How long should I rest?' },
    { id: 'progress_lift', ask: 'How is my bench progressing?' },
  ];
  it('sends only the topic list, reads only our ids', () => {
    expect(classifyPrompt(topics)).toContain('rest: How long should I rest?');
    expect(parseTopicPick('{"id":"rest"}', topics)).toBe('rest');
    expect(parseTopicPick('```json\n{"id": "progress_lift"}\n```', topics)).toBe('progress_lift');
    expect(parseTopicPick('{"id":"hack_the_planet"}', topics)).toBeNull();
    expect(parseTopicPick('nonsense', topics)).toBeNull();
  });
  it('the menu leads with the closest topics; the pick is answered from the log', () => {
    const c = richCtx('en');
    const menu = topicMenu('how heavy on bench this time', c);
    expect(menu.length).toBeGreaterThan(10);
    expect(menu.slice(0, 5).map((x) => x.id)).toContain('next_weight');
    const a = answerAs('next_weight', 'how heavy on bench this time', c);
    expect(a?.intent).toBe('next_weight');
    expect(a?.text).toMatch(/kg/);
    expect(answerAs('progress_lift', 'how is it going', c)).toBeNull();
  });
});
