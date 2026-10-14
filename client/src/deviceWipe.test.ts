import { describe, expect, it, vi } from 'vitest';
import {
  COACH_IDB_NAMES,
  FS_WIPE_FLAG,
  runPendingWipe,
  wipeAfterRelationshipEnd,
  wipeAfterSignOut,
  wipeCoachCaches,
} from './deviceWipe';

function store(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    api: {
      get length() {
        return m.size;
      },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    },
  };
}
function fakeIdb(names: string[]) {
  const deleted: string[] = [];
  return {
    deleted,
    idb: {
      databases: async () => names.map((name) => ({ name })),
      deleteDatabase: (name: string) => {
        deleted.push(name);
        const r: { onsuccess: null | (() => void) } = { onsuccess: null };
        queueMicrotask(() => r.onsuccess?.());
        return r;
      },
    },
  };
}
const FS = 'firestore/[DEFAULT]/proj/main';

describe('device wipe', () => {
  it('relationship end: read caches and the last coach route go at once', () => {
    const s = store({
      'spotter.cache.roster': '1',
      'spotter.cache.clients': '2',
      'coach:last': '#/c',
      keep: 'x',
    });
    wipeCoachCaches({ storage: s.api, idb: null });
    expect([...s.m.keys()]).toEqual(['keep']);
  });

  it('relationship end: Firestore cache is scheduled only when every write has reached the server', async () => {
    const a = store();
    const ok = await wipeAfterRelationshipEnd({
      storage: a.api,
      idb: null,
      pendingWritesDone: async () => undefined,
    });
    expect(ok).toBe(true);
    expect(a.m.get(FS_WIPE_FLAG)).toBe('1');

    const b = store();
    const stuck = await wipeAfterRelationshipEnd({
      storage: b.api,
      idb: null,
      waitMs: 10,
      pendingWritesDone: () => new Promise<void>(() => undefined),
    });
    expect(stuck).toBe(false);
    expect(b.m.has(FS_WIPE_FLAG)).toBe(false); // unsynced work is never discarded
  });

  it('sign-out: coach IndexedDB stores, Firestore persistence, caches and the route are removed, then it reloads', async () => {
    const s = store({ 'spotter.cache.x': '1', 'coach:last': 'y', other: 'z' });
    const f = fakeIdb([FS, 'unrelated', ...COACH_IDB_NAMES]);
    const reload = vi.fn();
    await wipeAfterSignOut({ storage: s.api, idb: f.idb, reload });
    expect(f.deleted.sort()).toEqual([...COACH_IDB_NAMES, FS].sort());
    expect(s.m.has('spotter.cache.x')).toBe(false);
    expect(s.m.has('coach:last')).toBe(false);
    expect(s.m.get('other')).toBe('z');
    expect(s.m.get(FS_WIPE_FLAG)).toBe('1'); // kept until the next start deletes the (possibly blocked) database
    expect(reload).toHaveBeenCalled();
  });

  it('the next start deletes Firestore databases before the SDK opens one, then clears the flag', async () => {
    const s = store({ [FS_WIPE_FLAG]: '1' });
    const f = fakeIdb([FS, 'spotter.vault']);
    expect(await runPendingWipe({ storage: s.api, idb: f.idb })).toBe(true);
    expect(f.deleted).toEqual([FS]);
    expect(s.m.has(FS_WIPE_FLAG)).toBe(false);
    expect(await runPendingWipe({ storage: s.api, idb: f.idb })).toBe(false);
  });

  it('never throws without storage or IndexedDB', async () => {
    await expect(wipeAfterSignOut({ storage: null, idb: null })).resolves.toBeUndefined();
    await expect(runPendingWipe({ storage: null, idb: null })).resolves.toBe(false);
  });
});
