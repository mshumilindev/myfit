import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// Loading intents again must not re-initialise Firebase.
vi.mock('../firebase', () => ({
  app: {},
  auth: {},
  db: {},
  functions: {},
  storage: {},
  analytics: null,
}));

import { KB, facetsTable } from './kb';
import { buildIndex } from './retrieve';

// warmUpAtlas keeps module state (one warm-up per page load), so every case loads a fresh copy of
// intents + retrieve. The only fake is the browser's Worker; the knowledge base and index are real.
let payload: { index: ReturnType<typeof buildIndex>; facets: ReturnType<typeof facetsTable> };
beforeAll(() => {
  payload = { index: buildIndex(KB), facets: facetsTable(KB) };
}, 60_000);

class FakeWorker {
  static all: FakeWorker[] = [];
  static throwOnCreate = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor(public url: URL) {
    if (FakeWorker.throwOnCreate) throw new Error('workers blocked');
    FakeWorker.all.push(this);
  }
  postMessage(m: unknown) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
}

async function fresh() {
  vi.resetModules();
  const intents = await import('./intents');
  const retrieve = await import('./retrieve');
  return { ...intents, indexReady: retrieve.indexReady };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.all = [];
  FakeWorker.throwOnCreate = false;
});

describe('atlasReady / warmUpAtlas', () => {
  it('is ready at once when the index is already in, and starts no worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, indexReady } = await import('./intents').then(async (m) => ({
      atlasReady: m.atlasReady,
      indexReady: (await import('./retrieve')).indexReady,
    }));
    expect(indexReady()).toBe(true);
    await expect(atlasReady()).resolves.toBeUndefined();
    expect(FakeWorker.all).toHaveLength(0);
  });

  it('builds the index in a worker, applies what it posts back and releases waiters', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, indexReady } = await fresh();
    expect(indexReady()).toBe(false);
    const ready = atlasReady(60_000);
    expect(FakeWorker.all).toHaveLength(1);
    const w = FakeWorker.all[0];
    expect(w.posted).toEqual(['build']);
    expect(String(w.url)).toMatch(/retrieve\.worker/);
    expect(indexReady()).toBe(false);
    w.onmessage!({ data: payload });
    await ready;
    expect(indexReady()).toBe(true);
    expect(w.terminated).toBe(true);
  });

  it('starts only one warm-up however many callers wait, and releases them all', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, warmUpAtlas } = await fresh();
    const a = atlasReady(60_000);
    const b = atlasReady(60_000);
    warmUpAtlas();
    expect(FakeWorker.all).toHaveLength(1);
    FakeWorker.all[0].onmessage!({ data: payload });
    await expect(Promise.all([a, b])).resolves.toEqual([undefined, undefined]);
  });

  it('stops waiting after the timeout when the worker never answers', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, indexReady } = await fresh();
    vi.useFakeTimers();
    let done = false;
    const p = atlasReady(6000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(5999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    expect(indexReady()).toBe(false);
  });

  it('a worker that fails is dropped and the index is built in place instead', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, indexReady } = await fresh();
    const ready = atlasReady(60_000);
    const w = FakeWorker.all[0];
    w.onerror!();
    expect(w.terminated).toBe(true);
    await ready;
    expect(indexReady()).toBe(true);
  }, 60_000);

  it('a browser that refuses to create workers builds in place too', async () => {
    FakeWorker.throwOnCreate = true;
    vi.stubGlobal('Worker', FakeWorker);
    const { atlasReady, indexReady } = await fresh();
    await atlasReady(60_000);
    expect(indexReady()).toBe(true);
  }, 60_000);

  it('without Worker support it builds in place', async () => {
    vi.stubGlobal('Worker', undefined);
    const { atlasReady, indexReady } = await fresh();
    await atlasReady(60_000);
    expect(indexReady()).toBe(true);
  }, 60_000);
});
