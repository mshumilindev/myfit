import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { createMemoryFs, type MemoryFs } from './memoryFs';
import type { RingProvider } from './keyRing';
import { createRingBook } from './ringBook';

const ring = (cid: string, epoch: number): ChatKeyRing => ({
  cid,
  epoch,
  key: async () => ({}) as CryptoKey,
});
const conv = (clientId: string, over: Record<string, unknown> = {}) => ({
  clientId,
  trainerId: 't1',
  active: true,
  keyEpoch: 1,
  ck: { epoch: 1 },
  ...over,
});

function provider(over: Partial<RingProvider> = {}): RingProvider & { currentCalls: string[] } {
  const currentCalls: string[] = [];
  return {
    currentCalls,
    forEpoch: async (cid, epoch) => ring(cid, epoch),
    current: async (cid) => {
      currentCalls.push(cid);
      return ring(cid, 1);
    },
    past: async () => new Map(),
    forget: () => undefined,
    ...over,
  };
}
const settle = (ms = 15) => new Promise((r) => setTimeout(r, ms));

let fs: MemoryFs;
afterEach(() => vi.useRealTimers());

describe('what the book listens to (the only list queries the rules allow)', () => {
  it('a trainer sees active conversations of his own; a client sees only his own, active or not', async () => {
    fs = createMemoryFs();
    const seen: unknown[] = [];
    const real = fs.listen.bind(fs);
    fs.listen = (c, q, on, e) => {
      seen.push([c, q.where]);
      return real(c, q, on, e);
    };
    createRingBook({ fs, rings: provider(), uid: 't1', side: 'trainer' }).start()();
    createRingBook({ fs, rings: provider(), uid: 'c1', side: 'client' }).start()();
    expect(seen).toEqual([
      [
        'conversations',
        [
          ['trainerId', '==', 't1'],
          ['active', '==', true],
        ],
      ],
      ['conversations', [['clientId', '==', 'c1']]],
    ]);
  });

  it('never exposes another trainer conversation: rows of an inactive or client-less conversation are ignored', async () => {
    fs = createMemoryFs();
    fs.seed('conversations/a', conv('c1'));
    fs.seed('conversations/b', conv('c2', { active: false }));
    fs.seed('conversations/c', { trainerId: 't1', active: true, ck: { epoch: 1 } });
    const book = createRingBook({ fs, rings: provider(), uid: 't1', side: 'trainer' });
    const stop = book.start();
    await book.ready();
    expect(book.entries().map((e) => e.clientId)).toEqual(['c1']);
    expect(book.cidOf('c2')).toBeNull();
    expect(book.ringFor('c2')).toBeNull();
    stop();
  });
});

describe('rings', () => {
  it('current ring by client id; an epoch lookup finds the current one or a past one, else null', async () => {
    fs = createMemoryFs();
    fs.seed('conversations/a', conv('c1', { keyEpoch: 3, ck: { epoch: 3 } }));
    const rings = provider({
      past: async () =>
        new Map([
          [1, ring('a', 1)],
          [2, ring('a', 2)],
        ]),
    });
    const book = createRingBook({ fs, rings, uid: 't1', side: 'trainer' });
    const watch = vi.fn();
    book.watch(watch);
    const stop = book.start();
    await book.ready();
    expect(book.ringFor('c1')?.epoch).toBe(3);
    expect(book.cidOf('c1')).toBe('a');
    await vi.waitFor(() => expect(book.ringForEpoch('c1', 2)?.epoch).toBe(2));
    expect(book.ringForEpoch('c1', 3)?.epoch).toBe(3);
    expect(book.ringForEpoch('c1', 1)?.epoch).toBe(1);
    expect(book.ringForEpoch('c1', 9)).toBeNull();
    expect(book.ringForEpoch('nobody', 1)).toBeNull();
    expect(watch.mock.calls.length).toBeGreaterThanOrEqual(2); // the snapshot and the history that arrived later
    stop();
  });

  it('a ring this device cannot open stays null (never a fallback), and an unkeyed conversation has no ring', async () => {
    fs = createMemoryFs();
    fs.seed('conversations/a', conv('c1'));
    fs.seed('conversations/b', conv('c2', { ck: undefined, keyEpoch: 0 }));
    const rings = provider({
      forEpoch: async (cid) => {
        if (cid === 'a') throw new Error('refused key');
        return ring(cid, 1);
      },
    });
    const book = createRingBook({ fs, rings, uid: 't1', side: 'trainer' });
    const stop = book.start();
    await book.ready();
    expect(book.ringFor('c1')).toBeNull();
    expect(book.ringFor('c2')).toBeNull();
    expect(book.cidOf('c1')).toBe('a');
    stop();
  });

  it('watchers can be removed', async () => {
    fs = createMemoryFs();
    const book = createRingBook({ fs, rings: provider(), uid: 't1', side: 'trainer' });
    const w = vi.fn();
    const off = book.watch(w);
    off();
    fs.seed('conversations/a', conv('c1'));
    const stop = book.start();
    await book.ready();
    expect(w).not.toHaveBeenCalled();
    stop();
  });

  it('start is idempotent and stop stops listening', async () => {
    fs = createMemoryFs();
    let listens = 0;
    const real = fs.listen.bind(fs);
    fs.listen = (...a) => {
      listens++;
      return real(...a);
    };
    const book = createRingBook({ fs, rings: provider(), uid: 't1', side: 'trainer' });
    const s1 = book.start();
    const s2 = book.start();
    expect(s2).toBe(s1);
    expect(listens).toBe(1);
    s1();
    const again = book.start();
    expect(listens).toBe(2);
    again();
  });
});

describe('a conversation that ends', () => {
  it('is reported once, with its client, and its ring disappears', async () => {
    fs = createMemoryFs();
    fs.seed('conversations/a', conv('c1'));
    const ended: [string, string][] = [];
    const book = createRingBook({
      fs,
      rings: provider(),
      uid: 't1',
      side: 'trainer',
      onEnded: (cid, c) => ended.push([cid, c]),
    });
    const stop = book.start();
    await book.ready();
    expect(book.ringFor('c1')).not.toBeNull();
    await fs.update('conversations/a', { active: false });
    await vi.waitFor(() => expect(ended).toEqual([['a', 'c1']]));
    expect(book.ringFor('c1')).toBeNull();
    expect(book.entries()).toEqual([]);
    await fs.update('conversations/a', { note: 1 });
    await settle();
    expect(ended).toHaveLength(1);
    stop();
  });

  it('a listener error is reported to the caller', async () => {
    fs = createMemoryFs();
    const onError = vi.fn();
    fs.listen = (_c, _q, _on, e) => {
      queueMicrotask(() => e(new Error('denied')));
      return () => undefined;
    };
    createRingBook({ fs, rings: provider(), uid: 't1', side: 'trainer' }).start(onError)();
    await settle();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'denied' }));
  });
});

describe('client: the key is made as soon as the conversation is active', () => {
  it('creates the key for an active conversation without one, once per snapshot, and not for foreign or keyed ones', async () => {
    fs = createMemoryFs();
    const rings = provider();
    fs.seed('conversations/mine', conv('c1', { ck: undefined, keyEpoch: 0 }));
    fs.seed('conversations/keyed', conv('c1', { ck: { epoch: 1 } }));
    fs.seed('conversations/other', conv('c9', { ck: undefined, keyEpoch: 0 }));
    fs.seed('conversations/off', conv('c1', { ck: undefined, active: false }));
    const book = createRingBook({ fs, rings, uid: 'c1', side: 'client' });
    const stop = book.start();
    await book.ready();
    await settle();
    expect(rings.currentCalls).toEqual(['mine']);
    stop();
  });

  it('a stale key flag asks for a new wrap even though a key exists', async () => {
    fs = createMemoryFs();
    const rings = provider();
    fs.seed('conversations/a', conv('c1', { keyStale: true }));
    const book = createRingBook({ fs, rings, uid: 'c1', side: 'client' });
    const stop = book.start();
    await book.ready();
    await settle();
    expect(rings.currentCalls).toEqual(['a']);
    stop();
  });

  it('a refused key is retried on a back-off schedule and reported each time, then gives up', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fs = createMemoryFs();
    let n = 0;
    const rings = provider({
      current: async () => {
        n++;
        throw new Error('trainer key not signed yet');
      },
    });
    fs.seed('conversations/a', conv('c1', { ck: undefined, keyEpoch: 0 }));
    const errors: unknown[] = [];
    const book = createRingBook({ fs, rings, uid: 'c1', side: 'client' });
    const stop = book.start((e) => errors.push(e));
    await vi.advanceTimersByTimeAsync(10);
    expect(n).toBe(1);
    for (const ms of [300, 1500, 6000, 20000]) await vi.advanceTimersByTimeAsync(ms + 5);
    expect(n).toBe(5); // first try + the four scheduled retries
    await vi.advanceTimersByTimeAsync(120_000);
    expect(n).toBe(5);
    expect(errors).toHaveLength(5);
    stop();
  });

  it('stopping cancels the pending retries', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fs = createMemoryFs();
    let n = 0;
    const rings = provider({
      current: async () => {
        n++;
        throw new Error('no');
      },
    });
    fs.seed('conversations/a', conv('c1', { ck: undefined, keyEpoch: 0 }));
    const book = createRingBook({ fs, rings, uid: 'c1', side: 'client' });
    const stop = book.start();
    await vi.advanceTimersByTimeAsync(10);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(n).toBe(1);
  });

  it('refresh tries a failed key again at once (the vault was unlocked)', async () => {
    fs = createMemoryFs();
    let ok = false;
    const rings = provider({
      current: async (cid) => {
        if (!ok) throw new Error('locked');
        return ring(cid, 1);
      },
    });
    fs.seed('conversations/a', conv('c1', { ck: undefined, keyEpoch: 0 }));
    const book = createRingBook({ fs, rings, uid: 'c1', side: 'client' });
    const stop = book.start(() => undefined);
    await book.ready();
    await settle();
    ok = true;
    const spy = vi.spyOn(rings, 'current');
    await book.refresh();
    await settle();
    expect(spy).toHaveBeenCalledWith('a');
    stop();
  });

  it('refresh with nothing seen yet is a no-op', async () => {
    fs = createMemoryFs();
    const book = createRingBook({ fs, rings: provider(), uid: 'c1', side: 'client' });
    await expect(book.refresh()).resolves.toBeUndefined();
  });
});
