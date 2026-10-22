import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FS_DELETE } from './fsApi';

// Only the Firebase SDK boundary is faked: the adapter's own mapping is the unit under test.
const sdk = vi.hoisted(() => {
  const log: [string, ...unknown[]][] = [];
  const store = new Map<string, Record<string, unknown>>();
  const snapDocs: { id: string; data: Record<string, unknown> }[] = [];
  const listeners: {
    next: (s: unknown) => void;
    err: (e: unknown) => void;
    target: unknown;
    opts?: unknown;
  }[] = [];
  const batchOps: unknown[][] = [];
  return { log, store, snapDocs, listeners, batchOps, txSets: [] as unknown[][] };
});

vi.mock('../../../api', () => ({ callFn: vi.fn() }));
vi.mock('../../../firebase', () => ({ db: { name: 'db' } }));
vi.mock('firebase/firestore', () => {
  const snap = (path: string) => {
    const d = sdk.store.get(path);
    return { exists: () => d !== undefined, data: () => d };
  };
  return {
    collection: (_db: unknown, c: string) => ({ kind: 'collection', c }),
    doc: (_db: unknown, path: string) => ({ kind: 'doc', path }),
    where: (...a: unknown[]) => ({ kind: 'where', a }),
    orderBy: (...a: unknown[]) => ({ kind: 'orderBy', a }),
    limit: (n: number) => ({ kind: 'limit', n }),
    query: (base: unknown, ...parts: unknown[]) => ({ kind: 'query', base, parts }),
    deleteField: () => ({ kind: 'deleteField' }),
    getDoc: async (ref: { path: string }) => snap(ref.path),
    setDoc: async (ref: { path: string }, data: unknown) =>
      void sdk.log.push(['set', ref.path, data]),
    updateDoc: async (ref: { path: string }, patch: unknown) =>
      void sdk.log.push(['update', ref.path, patch]),
    deleteDoc: async (ref: { path: string }) => void sdk.log.push(['del', ref.path]),
    getDocs: async () => ({
      docs: sdk.snapDocs.map((d) => ({ id: d.id, data: () => d.data })),
    }),
    writeBatch: () => {
      const ops: unknown[][] = [];
      sdk.batchOps.push(ops);
      return {
        set: (r: { path: string }, d: unknown) => ops.push(['set', r.path, d]),
        update: (r: { path: string }, p: unknown) => ops.push(['update', r.path, p]),
        delete: (r: { path: string }) => ops.push(['delete', r.path]),
        commit: async () => void ops.push(['commit']),
      };
    },
    runTransaction: async (
      _db: unknown,
      fn: (t: {
        get: (r: { path: string }) => Promise<unknown>;
        set: (r: { path: string }, d: unknown) => void;
      }) => Promise<unknown>,
    ) =>
      fn({
        get: async (r) => snap(r.path),
        set: (r, d) => void sdk.txSets.push([r.path, d]),
      }),
    onSnapshot: (target: unknown, a: unknown, b: unknown, c?: unknown) => {
      const hasOpts = typeof a !== 'function';
      const l = {
        target,
        opts: hasOpts ? a : undefined,
        next: (hasOpts ? b : a) as (s: unknown) => void,
        err: (hasOpts ? c : b) as (e: unknown) => void,
      };
      sdk.listeners.push(l);
      return () => void sdk.log.push(['unsub']);
    },
  };
});

import { callFn } from '../../../api';
import { createFirebaseFs } from './firebaseFs';

beforeEach(() => {
  sdk.log.length = 0;
  sdk.store.clear();
  sdk.snapDocs.length = 0;
  sdk.listeners.length = 0;
  sdk.batchOps.length = 0;
  sdk.txSets.length = 0;
  vi.mocked(callFn).mockReset();
});

describe('firebaseFs documents', () => {
  it('get returns the stored data or null for a missing document', async () => {
    sdk.store.set('chats/c1', { sealed: 'x' });
    const fs = createFirebaseFs();
    expect(await fs.get('chats/c1')).toEqual({ sealed: 'x' });
    expect(await fs.get('chats/none')).toBeNull();
  });

  it('writes the object it was given unchanged (sealed payloads are not rewritten)', async () => {
    const fs = createFirebaseFs();
    const sealed = { v: 1, ct: 'AAAA', iv: 'BBBB' };
    await fs.set('coachNotes/n1', sealed);
    expect(sdk.log).toEqual([['set', 'coachNotes/n1', sealed]]);
    expect(sdk.log[0][2]).toBe(sealed);
    await fs.del('coachNotes/n1');
    expect(sdk.log[1]).toEqual(['del', 'coachNotes/n1']);
  });

  it('update turns FS_DELETE into deleteField and keeps dotted keys and plain values', async () => {
    const fs = createFirebaseFs();
    await fs.update('chats/c1', { 'readUpTo.u1': 5, gone: FS_DELETE, name: 'a' });
    expect(sdk.log[0]).toEqual([
      'update',
      'chats/c1',
      { 'readUpTo.u1': 5, gone: { kind: 'deleteField' }, name: 'a' },
    ]);
  });

  it('batch applies set, update and delete in order and commits once, all in one batch', async () => {
    const fs = createFirebaseFs();
    await fs.batch([
      { k: 'set', path: 'a/1', data: { x: 1 } },
      { k: 'update', path: 'a/2', patch: { y: FS_DELETE, z: 2 } },
      { k: 'delete', path: 'a/3' },
    ]);
    expect(sdk.batchOps).toHaveLength(1);
    expect(sdk.batchOps[0]).toEqual([
      ['set', 'a/1', { x: 1 }],
      ['update', 'a/2', { y: { kind: 'deleteField' }, z: 2 }],
      ['delete', 'a/3'],
      ['commit'],
    ]);
  });

  it('transact exposes read and set through the transaction and returns the callback result', async () => {
    sdk.store.set('k/a', { n: 1 });
    const fs = createFirebaseFs();
    const out = await fs.transact(async (tx) => {
      const a = await tx.get('k/a');
      const none = await tx.get('k/none');
      tx.set('k/b', { n: ((a as { n: number }).n ?? 0) + 1 });
      return { a, none };
    });
    expect(out).toEqual({ a: { n: 1 }, none: null });
    expect(sdk.txSets).toEqual([['k/b', { n: 2 }]]);
  });
});

describe('firebaseFs listeners and queries', () => {
  it('listenDoc maps an existing and a missing snapshot and forwards errors', () => {
    const fs = createFirebaseFs();
    const on = vi.fn();
    const onErr = vi.fn();
    const off = fs.listenDoc('chats/c1', on, onErr);
    const l = sdk.listeners[0];
    l.next({ exists: () => true, data: () => ({ a: 1 }) });
    l.next({ exists: () => false, data: () => undefined });
    l.err(new Error('perm'));
    expect(on.mock.calls).toEqual([[{ a: 1 }], [null]]);
    expect(onErr).toHaveBeenCalledWith(expect.objectContaining({ message: 'perm' }));
    off();
    expect(sdk.log).toContainEqual(['unsub']);
  });

  it('listen builds where/orderBy/limit in that order and reports rows with the cache flag', () => {
    const fs = createFirebaseFs();
    const on = vi.fn();
    fs.listen(
      'messages',
      {
        where: [
          ['cid', '==', 'c1'],
          ['at', '>', 5],
        ],
        orderBy: ['at', 'desc'],
        limit: 20,
      },
      on,
      vi.fn(),
    );
    const l = sdk.listeners[0];
    expect(l.opts).toEqual({ includeMetadataChanges: false });
    expect(l.target).toEqual({
      kind: 'query',
      base: { kind: 'collection', c: 'messages' },
      parts: [
        { kind: 'where', a: ['cid', '==', 'c1'] },
        { kind: 'where', a: ['at', '>', 5] },
        { kind: 'orderBy', a: ['at', 'desc'] },
        { kind: 'limit', n: 20 },
      ],
    });
    l.next({
      docs: [{ id: 'm1', data: () => ({ t: 1 }) }],
      metadata: { fromCache: true },
    });
    expect(on).toHaveBeenCalledWith([{ id: 'm1', data: { t: 1 } }], true);
  });

  it('an empty query is the bare collection, getDocs maps rows', async () => {
    const fs = createFirebaseFs();
    fs.listen('messages', {}, vi.fn(), vi.fn());
    expect(sdk.listeners[0].target).toEqual({ kind: 'collection', c: 'messages' });
    sdk.snapDocs.push({ id: 'r1', data: { v: 1 } }, { id: 'r2', data: { v: 2 } });
    expect(await fs.getDocs('messages', {})).toEqual([
      { id: 'r1', data: { v: 1 } },
      { id: 'r2', data: { v: 2 } },
    ]);
  });

  it('limit 0 adds no limit clause', () => {
    const fs = createFirebaseFs();
    fs.listen('m', { limit: 0 }, vi.fn(), vi.fn());
    expect(sdk.listeners[0].target).toEqual({ kind: 'collection', c: 'm' });
  });
});

describe('firebaseFs callables', () => {
  it('non-roster calls go straight to callFn, quietly; coach writes drop the shared roster answer', async () => {
    vi.mocked(callFn).mockResolvedValue({ ok: true });
    const fs = createFirebaseFs();
    await fs.call('coachClients', {});
    await fs.call('coachRemoveClient', { id: 'x' });
    await fs.call('coachClients', {});
    expect(callFn).toHaveBeenNthCalledWith(2, 'coachRemoveClient', { id: 'x' }, { quiet: true });
    expect(vi.mocked(callFn).mock.calls.filter((c) => c[0] === 'coachClients')).toHaveLength(2);
  });

  it('read-style coach/admin callables and other names keep the roster answer', async () => {
    vi.mocked(callFn).mockResolvedValue({});
    const fs = createFirebaseFs();
    await fs.call('coachClients', {});
    for (const n of ['coachRead', 'coachMyLink', 'coachLogRead', 'vaultKey']) await fs.call(n, {});
    await fs.call('coachClients', {});
    expect(vi.mocked(callFn).mock.calls.filter((c) => c[0] === 'coachClients')).toHaveLength(1);
    await fs.call('adminSetRole', {});
    await fs.call('coachClients', {});
    expect(vi.mocked(callFn).mock.calls.filter((c) => c[0] === 'coachClients')).toHaveLength(2);
  });

  it('roster answers are keyed by arguments and never shared between instances (sessions)', async () => {
    vi.mocked(callFn).mockResolvedValue({});
    const a = createFirebaseFs();
    const b = createFirebaseFs();
    await a.call('coachClients', { q: 1 });
    await a.call('coachClients', { q: 2 });
    await b.call('coachClients', { q: 1 });
    expect(callFn).toHaveBeenCalledTimes(3);
  });

  it('now follows the wall clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    expect(createFirebaseFs().now()).toBe(Date.parse('2026-03-01T10:00:00Z'));
    vi.useRealTimers();
  });
});
