/**
 * The offline reading decorator: replays the sealed copy first, the live snapshot replaces it, the write-back is
 * debounced and sealed, a locked vault or storage failure never breaks the live feed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_MESSAGES, withLocalCache } from './cachedPort';
import type { ChatPort } from './port';
import type { ChatMessage, ChatThread } from './types';
import { createSealedLocal, memoryBackend, type SealedLocal } from './sealedLocal';
import { readyVault } from '../../testVault';

const msg = (id: number, state: ChatMessage['state'] = 'sent'): ChatMessage =>
  ({
    id: `m${id}`,
    text: `secret text ${id}`,
    at: id,
    state,
    from: 'trainer',
  }) as unknown as ChatMessage;
const thread = (id: string): ChatThread => ({ cid: id, clientId: id }) as unknown as ChatThread;

interface Stub extends ChatPort {
  emitThreads(t: ChatThread[]): void;
  emitMessages(m: ChatMessage[], meta?: { hasMore: boolean }): void;
  unsubs: number;
  lastOpts?: { limit?: number };
}
function stubPort(): Stub {
  let th: ((t: ChatThread[]) => void) | null = null;
  let ms: ((m: ChatMessage[], meta?: { hasMore: boolean }) => void) | null = null;
  const s: Stub = {
    unsubs: 0,
    subscribeThreads(_u: string, on: (t: ChatThread[]) => void) {
      th = on;
      return () => void s.unsubs++;
    },
    subscribeMessages(
      _c: string,
      on: (m: ChatMessage[], meta?: { hasMore: boolean }) => void,
      _e: unknown,
      opts?: { limit?: number },
    ) {
      ms = on;
      s.lastOpts = opts;
      return () => void s.unsubs++;
    },
    send: async () => undefined,
    markRead: async () => undefined,
    softDelete: async () => undefined,
    undoDelete: async () => undefined,
    commitDelete: async () => undefined,
    clearChat: async () => ({ previous: 0 }),
    undoClear: async () => undefined,
    now: () => 4242,
    emitThreads: (t: ChatThread[]) => th!(t),
    emitMessages: (m: ChatMessage[], meta?: { hasMore: boolean }) => ms!(m, meta),
  };
  return s;
}

let backend: ReturnType<typeof memoryBackend>;
let local: SealedLocal;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  backend = memoryBackend();
  local = createSealedLocal({ vault: await readyVault(), backend });
});
afterEach(() => vi.useRealTimers());

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('withLocalCache', () => {
  it('passes the rest of the port through and forwards the clock', async () => {
    const p = stubPort();
    const c = withLocalCache(p, local);
    expect(c.now()).toBe(4242);
    await expect(c.clearChat('x')).resolves.toEqual({ previous: 0 });
  });

  it('replays the cached thread list at once, then the live list replaces it and is written back sealed after the delay', async () => {
    await local.set('threads:t1', [thread('cached')]);
    const p = stubPort();
    const c = withLocalCache(p, Promise.resolve(local));
    const seen: string[][] = [];
    c.subscribeThreads(
      't1',
      (t) => seen.push(t.map((x) => x.cid)),
      () => undefined,
    );
    await vi.waitFor(() => expect(seen).toEqual([['cached']]));
    p.emitThreads([thread('live')]);
    expect(seen).toEqual([['cached'], ['live']]);
    // not yet written: the write is debounced
    expect(await local.get('threads:t1')).toEqual([thread('cached')]);
    await vi.advanceTimersByTimeAsync(399);
    expect(await local.get('threads:t1')).toEqual([thread('cached')]);
    await vi.advanceTimersByTimeAsync(2);
    await vi.waitFor(async () => expect(await local.get('threads:t1')).toEqual([thread('live')]));
    expect(JSON.stringify(await backend.get('threads:t1'))).not.toContain('live');
  });

  it('a cached copy that arrives AFTER the first live snapshot is dropped (live wins)', async () => {
    let release!: (v: ChatThread[]) => void;
    const slow = {
      ...local,
      get: () => new Promise((r) => (release = r as never)),
    } as unknown as SealedLocal;
    const p = stubPort();
    const c = withLocalCache(p, slow);
    const seen: string[][] = [];
    c.subscribeThreads(
      't',
      (t) => seen.push(t.map((x) => x.cid)),
      () => undefined,
    );
    await settle();
    p.emitThreads([thread('live')]);
    release([thread('stale')]);
    await settle();
    expect(seen).toEqual([['live']]);
  });

  it('after unsubscribe a late cached copy is not delivered and the port is unsubscribed', async () => {
    let release!: (v: unknown) => void;
    const slow = {
      ...local,
      get: () => new Promise((r) => (release = r)),
    } as unknown as SealedLocal;
    const p = stubPort();
    const c = withLocalCache(p, slow);
    const seen: unknown[] = [];
    const off = c.subscribeThreads(
      't',
      (t) => seen.push(t),
      () => undefined,
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    off();
    release([thread('late')]);
    await settle();
    expect(seen).toEqual([]);
    expect(p.unsubs).toBe(1);
  });

  it('a non-array cached value or a failing store is ignored; the live feed still works', async () => {
    await local.set('threads:t1', { not: 'a list' });
    const p = stubPort();
    const c = withLocalCache(p, local);
    const seen: unknown[] = [];
    c.subscribeThreads(
      't1',
      (t) => seen.push(t),
      () => undefined,
    );
    await settle();
    expect(seen).toEqual([]);

    const broken = {
      ...local,
      get: vi.fn(async () => Promise.reject(new Error('io'))),
      set: vi.fn(async () => Promise.reject(new Error('io'))),
    } as unknown as SealedLocal;
    const p2 = stubPort();
    const c2 = withLocalCache(p2, broken);
    const offMessages = c2.subscribeMessages(
      'c',
      (m) => seen.push(m.length),
      () => undefined,
    );
    c2.subscribeThreads(
      't',
      () => seen.push(-1),
      () => undefined,
    );
    await vi.waitFor(() => expect(broken.get).toHaveBeenCalledTimes(2));
    p2.emitMessages([msg(1)]);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(broken.set).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(seen).toEqual([1]);
    offMessages();
    expect(p2.unsubs).toBe(1);
  });

  it('messages: replays the cache, forwards meta and options, writes only sent messages, newest 50', async () => {
    const cached = [msg(1)];
    await local.set('msgs:cid-1', cached);
    const p = stubPort();
    const c = withLocalCache(p, local);
    const got: Array<{ n: number; meta?: unknown }> = [];
    c.subscribeMessages(
      'cid-1',
      (m, meta) => got.push({ n: m.length, meta }),
      () => undefined,
      { limit: 7 },
    );
    await vi.waitFor(() => expect(got).toEqual([{ n: 1, meta: undefined }]));
    expect(p.lastOpts).toEqual({ limit: 7 });
    const many = Array.from({ length: 60 }, (_, i) => msg(i + 1));
    p.emitMessages([...many, msg(99, 'sending'), msg(98, 'failed')], { hasMore: true });
    expect(got[1]).toEqual({ n: 62, meta: { hasMore: true } });
    await vi.advanceTimersByTimeAsync(500);
    let stored: ChatMessage[] = [];
    await vi.waitFor(async () => {
      stored = (await local.get<ChatMessage[]>('msgs:cid-1'))!;
      expect(stored).toHaveLength(CACHE_MESSAGES);
    });
    expect(stored.every((m) => m.state === 'sent')).toBe(true);
    expect(stored[stored.length - 1]!.id).toBe('m60');
    expect(stored[0]!.id).toBe('m11');
  });

  it('rapid snapshots write once, with the last one', async () => {
    const p = stubPort();
    const set = vi.spyOn(local, 'set');
    const c = withLocalCache(p, local);
    c.subscribeMessages(
      'cid-1',
      () => undefined,
      () => undefined,
    );
    p.emitMessages([msg(1)]);
    await vi.advanceTimersByTimeAsync(200);
    p.emitMessages([msg(1), msg(2)]);
    await vi.advanceTimersByTimeAsync(399);
    expect(set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(set).toHaveBeenCalledTimes(1);
    await vi.waitFor(async () =>
      expect((await local.get<ChatMessage[]>('msgs:cid-1'))?.map((m) => m.id)).toEqual([
        'm1',
        'm2',
      ]),
    );
  });

  it('while the vault is locked nothing is stored and no cached copy is replayed', async () => {
    const locked = createSealedLocal({
      vault: {
        materialOrNull: () => null,
        subscribe: () => () => undefined,
        status: () => 'unknown',
      } as never,
      backend,
    });
    const p = stubPort();
    const c = withLocalCache(p, locked);
    const got: number[] = [];
    c.subscribeMessages(
      'cid-1',
      (m) => got.push(m.length),
      () => undefined,
    );
    p.emitMessages([msg(1)]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(got).toEqual([1]);
    expect(await backend.keys()).toEqual([]);
  });
});
