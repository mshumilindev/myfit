import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatTurn } from './chat';

// Importing the module afresh each time must not re-initialise Firebase.
vi.mock('../firebase', () => ({ app: {}, db: {} }));

type Chunk = { text?: string };
interface FakePuter {
  ai: { chat: ReturnType<typeof vi.fn> };
  auth: { isSignedIn: ReturnType<typeof vi.fn>; signIn: ReturnType<typeof vi.fn> };
}

const stream = (parts: Chunk[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const p of parts) yield p;
  },
});

function fakePuter(parts: Chunk[] = [{ text: 'Hi' }], signed = true): FakePuter {
  return {
    ai: { chat: vi.fn().mockResolvedValue(stream(parts)) },
    auth: {
      isSignedIn: vi.fn().mockReturnValue(signed),
      signIn: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const g = globalThis as unknown as { puter?: FakePuter };

async function fresh() {
  vi.resetModules();
  return import('./puter');
}

const ask = (m: typeof import('./puter'), extra: Record<string, unknown> = {}) =>
  m.askPuter({ system: 'SYS', history: [], question: 'Q?', temper: 1, ...extra });

describe('puter loader', () => {
  beforeEach(() => {
    delete g.puter;
    document.head.innerHTML = '';
  });
  afterEach(() => {
    delete g.puter;
    vi.restoreAllMocks();
  });

  it('returns the SDK straight away when it is already on the page, adding no script', async () => {
    const p = fakePuter();
    g.puter = p;
    const m = await fresh();
    expect(await m.loadPuter()).toBe(p);
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('adds one async script tag, shares the pending load and resolves with the SDK on load', async () => {
    const m = await fresh();
    const a = m.loadPuter();
    const b = m.loadPuter();
    const tags = document.head.querySelectorAll('script');
    expect(tags).toHaveLength(1);
    expect(tags[0].src).toBe('https://js.puter.com/v2/');
    expect(tags[0].async).toBe(true);
    const p = fakePuter();
    g.puter = p;
    tags[0].onload?.(new Event('load'));
    expect(await a).toBe(p);
    expect(await b).toBe(p);
  });

  it('resolves null when the script loads but defines no SDK', async () => {
    const m = await fresh();
    const a = m.loadPuter();
    document.head.querySelector('script')!.onload?.(new Event('load'));
    expect(await a).toBeNull();
  });

  it('resolves null on a load error and lets the next call try again', async () => {
    const m = await fresh();
    const a = m.loadPuter();
    document.head.querySelector('script')!.onerror?.(new Event('error'));
    expect(await a).toBeNull();
    const again = m.loadPuter();
    expect(document.head.querySelectorAll('script')).toHaveLength(2);
    g.puter = fakePuter();
    document.head.querySelectorAll('script')[1].onload?.(new Event('load'));
    expect(await again).toBe(g.puter);
  });

  it('resolves null when there is no document at all', async () => {
    const m = await fresh();
    vi.stubGlobal('document', undefined);
    try {
      expect(await m.loadPuter()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('puterReady / puterSignIn', () => {
  beforeEach(() => {
    delete g.puter;
  });
  afterEach(() => {
    delete g.puter;
    vi.restoreAllMocks();
  });

  it('is ready only when loaded and signed in', async () => {
    g.puter = fakePuter([], true);
    expect(await (await fresh()).puterReady()).toBe(true);
    g.puter = fakePuter([], false);
    expect(await (await fresh()).puterReady()).toBe(false);
  });

  it('is not ready when the sign-in check throws', async () => {
    const p = fakePuter();
    p.auth.isSignedIn.mockImplementation(() => {
      throw new Error('boom');
    });
    g.puter = p;
    expect(await (await fresh()).puterReady()).toBe(false);
  });

  it('is not ready when the SDK could not be loaded', async () => {
    const m = await fresh();
    const r = m.puterReady();
    document.head.querySelector('script')!.onerror?.(new Event('error'));
    expect(await r).toBe(false);
    document.head.innerHTML = '';
  });

  it('signIn reports whether the account ends up signed in', async () => {
    const p = fakePuter([], false);
    let signed = false;
    p.auth.isSignedIn.mockImplementation(() => signed);
    p.auth.signIn.mockImplementation(async () => {
      signed = true;
    });
    g.puter = p;
    expect(await (await fresh()).puterSignIn()).toBe(true);
    expect(p.auth.signIn).toHaveBeenCalledTimes(1);
    // the user closes the window without signing in
    signed = false;
    p.auth.signIn.mockResolvedValue(undefined);
    expect(await (await fresh()).puterSignIn()).toBe(false);
  });

  it('signIn is false when the window is closed (throws) or the SDK is missing', async () => {
    const p = fakePuter();
    p.auth.signIn.mockRejectedValue(new Error('closed'));
    g.puter = p;
    expect(await (await fresh()).puterSignIn()).toBe(false);
    delete g.puter;
    const m = await fresh();
    const r = m.puterSignIn();
    document.head.querySelector('script')!.onerror?.(new Event('error'));
    expect(await r).toBe(false);
    document.head.innerHTML = '';
  });
});

describe('askPuter', () => {
  beforeEach(() => {
    delete g.puter;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    delete g.puter;
    vi.restoreAllMocks();
  });

  it('is unavailable offline without even loading the SDK', async () => {
    const p = fakePuter();
    g.puter = p;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await ask(await fresh())).toEqual({ ok: false, reason: 'unavailable' });
    expect(p.auth.isSignedIn).not.toHaveBeenCalled();
  });

  it('is unavailable when the SDK cannot load', async () => {
    const m = await fresh();
    const r = ask(m);
    await Promise.resolve();
    document.head.querySelector('script')!.onerror?.(new Event('error'));
    expect(await r).toEqual({ ok: false, reason: 'unavailable' });
    document.head.innerHTML = '';
  });

  it('asks for a sign-in before spending anything', async () => {
    const p = fakePuter([{ text: 'x' }], false);
    g.puter = p;
    expect(await ask(await fresh())).toEqual({ ok: false, reason: 'signin' });
    expect(p.ai.chat).not.toHaveBeenCalled();
  });

  it('streams the growing text, trims the result and sends system + last 10 turns + question', async () => {
    const p = fakePuter([{ text: ' Hel' }, {}, { text: 'lo ' }]);
    g.puter = p;
    const history: ChatTurn[] = Array.from({ length: 12 }, (_, i) => ({
      from: i % 2 ? 'atlas' : 'me',
      text: `t${i}`,
    }));
    const seen: string[] = [];
    const m = await fresh();
    const r = await ask(m, { history, onText: (t: string) => seen.push(t) });
    expect(r).toEqual({ ok: true, text: 'Hello' });
    expect(seen).toEqual([' Hel', ' Hel', ' Hello ']);
    const [msgs, opts] = p.ai.chat.mock.calls[0];
    expect(msgs).toHaveLength(12);
    expect(msgs[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(msgs[1]).toEqual({ role: 'user', content: 't2' });
    expect(msgs[2]).toEqual({ role: 'assistant', content: 't3' });
    expect(msgs[11]).toEqual({ role: 'user', content: 'Q?' });
    expect(opts).toEqual({ model: m.PUTER_MODEL, stream: true, max_tokens: 220, temperature: 0.8 });
  });

  it('works without an onText callback', async () => {
    g.puter = fakePuter([{ text: 'ok' }]);
    expect(await ask(await fresh())).toEqual({ ok: true, text: 'ok' });
  });

  it('an empty or whitespace-only stream is an error', async () => {
    g.puter = fakePuter([{ text: '   ' }]);
    expect(await ask(await fresh())).toEqual({ ok: false, reason: 'error' });
  });

  it('a failing stream or request is an error, logged', async () => {
    const p = fakePuter();
    p.ai.chat.mockRejectedValue(new Error('429'));
    g.puter = p;
    expect(await ask(await fresh())).toEqual({ ok: false, reason: 'error' });
    expect(console.warn).toHaveBeenCalled();
  });

  it('a hard temper never gets a line about the body: blocked', async () => {
    g.puter = fakePuter([{ text: 'You are fat, cupcake. Your weight is the problem.' }]);
    const m = await fresh();
    expect(await ask(m, { temper: 5 })).toEqual({ ok: false, reason: 'blocked' });
    expect(await ask(m, { temper: 1 })).toMatchObject({ ok: true });
  });
});
