import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boundaries only: the Firebase app and the Gemini SDK. chat.ts itself runs for real.
const sdk = vi.hoisted(() => ({
  sendMessageStream: vi.fn(),
  generateContent: vi.fn(),
  startChat: vi.fn(),
  getGenerativeModel: vi.fn(),
}));
vi.mock('../firebase', () => ({ app: { name: 'test-app' } }));
vi.mock('firebase/ai', () => ({
  getAI: vi.fn(() => ({ ai: true })),
  GoogleAIBackend: class {},
  getGenerativeModel: sdk.getGenerativeModel,
}));

import {
  DAILY_CHAT_CAP,
  askAtlas,
  classifyTopic,
  geminiPausedUntil,
  isQuotaError,
  nextQuotaReset,
  systemPrompt,
} from './chat';
import { COACH_DEFAULT } from './types';

const NOW = Date.UTC(2026, 9, 7, 12);
const coach = { ...COACH_DEFAULT, enabled: true };

const chunks = (...texts: string[]) => ({
  get stream() {
    return (async function* () {
      for (const t of texts) yield { text: () => t };
    })();
  },
});

const base = (extra: Record<string, unknown> = {}) => ({
  question: 'How is bench?',
  history: [],
  temper: 1 as const,
  coach,
  locale: 'en' as const,
  factsJson: '{"a":1}',
  now: NOW,
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sdk.sendMessageStream.mockReset().mockResolvedValue(chunks('Solid.'));
  sdk.generateContent.mockReset();
  sdk.startChat
    .mockReset()
    .mockImplementation(() => ({ sendMessageStream: sdk.sendMessageStream }));
  sdk.getGenerativeModel
    .mockReset()
    .mockImplementation(() => ({ startChat: sdk.startChat, generateContent: sdk.generateContent }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('nextQuotaReset', () => {
  it('is 08:00 UTC today before 08:00, tomorrow from 08:00 on (strictly in the future)', () => {
    expect(nextQuotaReset(Date.UTC(2026, 9, 7, 7, 59, 59))).toBe(Date.UTC(2026, 9, 7, 8));
    expect(nextQuotaReset(Date.UTC(2026, 9, 7, 8))).toBe(Date.UTC(2026, 9, 8, 8));
    expect(nextQuotaReset(Date.UTC(2026, 11, 31, 23))).toBe(Date.UTC(2027, 0, 1, 8));
  });
});

describe('isQuotaError', () => {
  it('matches status 429, RESOURCE_EXHAUSTED, quota and rate limit wording', () => {
    expect(isQuotaError(new Error('got 429 back'))).toBe(true);
    expect(isQuotaError('RESOURCE_EXHAUSTED')).toBe(true);
    expect(isQuotaError(new Error('Rate limit hit'))).toBe(true);
    expect(isQuotaError(new Error('rate-limit'))).toBe(true);
    expect(isQuotaError(Object.assign(new Error('x'), { name: 'QuotaError' }))).toBe(true);
  });
  it('does not match a 4290 code or an unrelated failure', () => {
    expect(isQuotaError(new Error('code 4290'))).toBe(false);
    expect(isQuotaError('socket hang up')).toBe(false);
  });
});

describe('geminiPausedUntil', () => {
  it('is 0 when unset, expired or equal to now; the stored time while in the future', () => {
    expect(geminiPausedUntil(NOW)).toBe(0);
    localStorage.setItem('spotter.atlasGeminiPausedUntil', String(NOW));
    expect(geminiPausedUntil(NOW)).toBe(0);
    localStorage.setItem('spotter.atlasGeminiPausedUntil', String(NOW + 1));
    expect(geminiPausedUntil(NOW)).toBe(NOW + 1);
  });
  it('is 0 when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(geminiPausedUntil(NOW)).toBe(0);
  });
});

describe('systemPrompt variants', () => {
  const p = (o: Record<string, unknown>) =>
    systemPrompt({ temper: 3, coach, locale: 'pl', factsJson: '{"x":2}', ...o } as never);
  it('names the language, temper persona and embeds the facts last', () => {
    const s = p({});
    expect(s).toMatch(/Always answer in Polish/);
    expect(s).toMatch(/Neutral: straight talk/);
    expect(s.split('\n').at(-1)).toContain('{"x":2}');
  });
  it('describes the role: main owns the programme, extra only observes', () => {
    expect(p({ coach: { ...coach, role: 'main' } })).toMatch(/main coach — you own the programme/);
    expect(p({ coach: { ...coach, role: 'extra' } })).toMatch(/extra coach — another coach/);
  });
  it('allows mom jokes and swearing only for temper 5 with the switches on', () => {
    const on = p({ temper: 5, coach: { ...coach, yoMama: true, swearing: true } });
    expect(on).toMatch(/"Your mom" jokes about effort are allowed/);
    expect(on).toMatch(/Swearing is allowed/);
    const soft = p({ temper: 3, coach: { ...coach, yoMama: true, swearing: true } });
    expect(soft).toMatch(/No "your mom" jokes/);
    expect(soft).toMatch(/No swearing/);
    expect(soft).toMatch(/Never comment on body shape or looks/);
    expect(soft).not.toMatch(/Hard rules/);
  });
});

describe('askAtlas', () => {
  it('streams, trims and returns the reply; sends the last 10 turns as user/model parts', async () => {
    sdk.sendMessageStream.mockResolvedValue(chunks(' Sol', 'id. '));
    const seen: string[] = [];
    const history = Array.from({ length: 12 }, (_, i) => ({
      from: i % 2 ? ('atlas' as const) : ('me' as const),
      text: `t${i}`,
    }));
    const r = await askAtlas(base({ history, onText: (t: string) => seen.push(t) }));
    expect(r).toEqual({ ok: true, text: 'Solid.' });
    expect(seen).toEqual([' Sol', ' Solid. ']);
    const h = sdk.startChat.mock.calls[0][0].history;
    expect(h).toHaveLength(10);
    expect(h[0]).toEqual({ role: 'user', parts: [{ text: 't2' }] });
    expect(h[1]).toEqual({ role: 'model', parts: [{ text: 't3' }] });
    expect(sdk.sendMessageStream).toHaveBeenCalledWith('How is bench?');
    const cfg = sdk.getGenerativeModel.mock.calls[0][1];
    expect(cfg.generationConfig).toEqual({ maxOutputTokens: 220, temperature: 0.8 });
    expect(cfg.systemInstruction).toContain('{"a":1}');
  });
  it('works without onText', async () => {
    expect(await askAtlas(base())).toEqual({ ok: true, text: 'Solid.' });
  });
  it('is offline without touching the SDK', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'offline' });
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
  });
  it('is paused while the quota pause is in force', async () => {
    localStorage.setItem('spotter.atlasGeminiPausedUntil', String(NOW + 5000));
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'quota', until: NOW + 5000 });
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
  });
  it('allows exactly DAILY_CHAT_CAP messages a day, then the cap; a new day resets it', async () => {
    for (let i = 0; i < DAILY_CHAT_CAP; i++) expect((await askAtlas(base())).ok).toBe(true);
    sdk.getGenerativeModel.mockClear();
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'cap' });
    expect(sdk.getGenerativeModel).not.toHaveBeenCalled();
    expect((await askAtlas(base({ now: NOW + 2 * 86_400_000 }))).ok).toBe(true);
  });
  it('lets a message through when the cap counter is unreadable', async () => {
    localStorage.setItem('spotter.atlasChatCap', '{bad');
    expect((await askAtlas(base())).ok).toBe(true);
  });
  it('an empty reply is an error', async () => {
    sdk.sendMessageStream.mockResolvedValue(chunks('  ', ''));
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'error' });
  });
  it('a body remark to a hard temper is blocked, the same line to a bro passes', async () => {
    const line = 'You are fat, cupcake.';
    sdk.sendMessageStream.mockImplementation(async () => chunks(line));
    expect(await askAtlas(base({ temper: 5 }))).toEqual({ ok: false, reason: 'blocked' });
    expect((await askAtlas(base({ temper: 1 }))).ok).toBe(true);
  });
  it('a 429 pauses Gemini until the next 08:00 UTC and reports it', async () => {
    sdk.sendMessageStream.mockRejectedValue(new Error('[429] RESOURCE_EXHAUSTED'));
    const until = Date.UTC(2026, 9, 8, 8);
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'quota', until });
    expect(geminiPausedUntil(NOW)).toBe(until);
  });
  it('a quota error still reports when the pause cannot be stored', async () => {
    sdk.sendMessageStream.mockRejectedValue(new Error('quota'));
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (k === 'spotter.atlasGeminiPausedUntil') throw new Error('full');
      return real.call(this, k, v);
    });
    expect(await askAtlas(base())).toMatchObject({ ok: false, reason: 'quota' });
  });
  it('any other failure is a plain error and does not pause', async () => {
    sdk.sendMessageStream.mockRejectedValue(new Error('network down'));
    expect(await askAtlas(base())).toEqual({ ok: false, reason: 'error' });
    expect(geminiPausedUntil(NOW)).toBe(0);
  });
});

describe('classifyTopic', () => {
  const topics = [
    { id: 'rest', ask: 'How long should I rest?' },
    { id: 'bench', ask: 'How is bench?' },
  ];
  const run = (extra: Record<string, unknown> = {}) =>
    classifyTopic({ question: 'скільки відпочивати', topics, now: NOW, ...extra });
  const reply = (text: string) => ({ response: { text: () => text } });

  it('returns the picked topic and asks for cheap deterministic JSON', async () => {
    sdk.generateContent.mockResolvedValue(reply('{"id":"rest"}'));
    expect(await run()).toBe('rest');
    expect(sdk.generateContent).toHaveBeenCalledWith('скільки відпочивати');
    const cfg = sdk.getGenerativeModel.mock.calls[0][1];
    expect(cfg.generationConfig).toEqual({
      maxOutputTokens: 40,
      temperature: 0,
      responseMimeType: 'application/json',
    });
    expect(cfg.systemInstruction).toContain('bench: How is bench?');
  });
  it('null for an id that is not ours or "none"', async () => {
    sdk.generateContent.mockResolvedValue(reply('{"id":"none"}'));
    expect(await run()).toBeNull();
  });
  it('null offline, while paused and over the cap — without calling Gemini', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(false);
    expect(await run()).toBeNull();
    localStorage.setItem('spotter.atlasGeminiPausedUntil', String(NOW + 1));
    expect(await run()).toBeNull();
    localStorage.clear();
    localStorage.setItem(
      'spotter.atlasChatCap',
      JSON.stringify({ day: new Date(NOW).toDateString(), n: DAILY_CHAT_CAP }),
    );
    expect(await run()).toBeNull();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });
  it('a failure gives null; a quota failure also pauses Gemini', async () => {
    sdk.generateContent.mockRejectedValue(new Error('boom'));
    expect(await run()).toBeNull();
    expect(geminiPausedUntil(NOW)).toBe(0);
    sdk.generateContent.mockRejectedValue(new Error('429 quota'));
    expect(await run()).toBeNull();
    expect(geminiPausedUntil(NOW)).toBe(Date.UTC(2026, 9, 8, 8));
  });
  it('a quota failure with unwritable storage still returns null', async () => {
    sdk.generateContent.mockRejectedValue(new Error('429'));
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      if (k === 'spotter.atlasGeminiPausedUntil') throw new Error('full');
      return real.call(this, k, v);
    });
    expect(await run()).toBeNull();
  });
});
