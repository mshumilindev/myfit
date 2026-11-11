import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPack, packState, PACK_CACHE, removePack, resetPacks } from './packs';

const store = new Map<string, Response>();
const cache = {
  keys: async () => [...store.keys()].map((u) => new Request(u)),
  put: async (u: string, r: Response) => void store.set(new URL(u, 'http://x').href, r),
  delete: async (u: string) => store.delete(new URL(u, 'http://x').href),
};
const manifest = {
  gym: [
    ['exercise-img/a.webp', 10],
    ['exercise-img/b.webp', 20],
  ],
};

function mockFetch(okImages = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string) =>
      String(u).includes('addon-packs.json')
        ? new Response(JSON.stringify(manifest), { status: 200 })
        : new Response('x', {
            status: 200,
            headers: { 'content-type': okImages ? 'image/webp' : 'text/html' },
          }),
    ),
  );
}

beforeEach(() => {
  store.clear();
  resetPacks();
  vi.stubGlobal('caches', { open: async (n: string) => (n === PACK_CACHE ? cache : cache) });
  Object.defineProperty(navigator, 'connection', {
    value: { saveData: false },
    configurable: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('media packs', () => {
  it('downloads every file and reports ready', async () => {
    mockFetch();
    await installPack('gym');
    expect(packState('gym')).toEqual({ status: 'ready', done: 30, total: 30 });
    expect(store.size).toBe(2);
  });

  it('does not keep an HTML fallback answer as a picture', async () => {
    mockFetch(false);
    await installPack('gym');
    expect(packState('gym').status).toBe('error');
    expect(store.size).toBe(0);
  });

  it('waits under Data Saver unless forced', async () => {
    mockFetch();
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    await installPack('gym');
    expect(packState('gym').status).toBe('paused');
    await installPack('gym', true);
    expect(packState('gym').status).toBe('ready');
  });

  it('removal drops only that pack files', async () => {
    mockFetch();
    await installPack('gym');
    store.set(new URL('/atlas/z.webp', 'http://x').href, new Response('x'));
    await removePack('gym');
    expect(store.size).toBe(1);
    expect(packState('gym').status).toBe('idle');
  });
});
