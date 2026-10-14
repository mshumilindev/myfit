import { afterEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ del: [] as string[], set: [] as string[] }));

vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => 'u1',
}));
vi.mock('firebase/firestore', async (orig) => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    ...(await orig<typeof import('firebase/firestore')>()),
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => void calls.del.push(r.path)),
    setDoc: vi.fn(async (r: { path: string }) => void calls.set.push(r.path)),
    onSnapshot: () => () => undefined,
  };
});

import * as store from './store';

afterEach(() => {
  store.setLegacyLiveWriter(true);
  calls.del.length = 0;
  calls.set.length = 0;
});

describe('single live-session writer', () => {
  it('the legacy presence writer writes by default (no Coach backend)', () => {
    expect(store.legacyLiveWriterOn()).toBe(true);
    store.finishLiveSession();
    expect(calls.del).toEqual(['liveSessions/u1']);
  });

  it('is silent once the sealed Coach writer owns the doc, and writes again after teardown', () => {
    store.setLegacyLiveWriter(false);
    store.finishLiveSession();
    store.writeLiveSession({ id: 'w', startedAt: 1, finishedAt: null, exercises: [] } as never);
    expect(calls.del).toEqual([]);
    expect(calls.set).toEqual([]);
    store.setLegacyLiveWriter(true);
    store.finishLiveSession();
    expect(calls.del).toEqual(['liveSessions/u1']);
  });
});
