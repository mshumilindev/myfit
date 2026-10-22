import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
  failWith: null as null | { code: string },
  uid: 'u1' as string | null,
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => fs.uid,
  callFn: vi.fn(async () => {
    throw new Error('offline');
  }),
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => ({ union: a }),
    arrayRemove: (...a: unknown[]) => ({ remove: a }),
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => {
      if (fs.failWith) throw fs.failWith;
      fs.deletes.push(r.path);
    }),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>, opts?: unknown) => {
      if (fs.failWith) throw fs.failWith;
      fs.writes.push({ path: r.path, data, opts });
    }),
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      return () => fs.listeners.delete(r.path);
    },
  };
});
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  const { readyVault } = await import('./testVault');
  const v = await readyVault();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import type { SetEntry, Workout } from './types';

const T0 = new Date('2026-03-04T10:00:00Z').getTime(); // a Wednesday
const stub = vault as unknown as import('./autoVault').Vault;
const st = () => store.__getStateForTests();
const wk = (id: string) => st().workouts.find((w) => w.id === id)!;
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const wDeletes = () => fs.deletes.filter((p) => p.startsWith('users/u1/workouts/'));
const wWrites = (id?: string) =>
  fs.writes.filter((w) => w.path.startsWith('users/u1/workouts/') && (!id || w.path.endsWith(id)));
const plain = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Workout & Record<string, unknown>>(w.data, stub.material().key);
const setIn = (over: Partial<SetEntry> = {}) => ({ reps: 8, weight: 80, isWarmup: false, ...over });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.listeners.clear();
  fs.failWith = null;
  fs.uid = 'u1';
  store.resetLocalData();
  // the per-test consent reset (legal/testSetup) republishes the coach view asynchronously: let it land, then start clean
  await settle();
  fs.writes.length = 0;
});
afterEach(async () => {
  vi.useRealTimers();
  await settle(); // let in-flight sealed writes land before the next test starts
  store.resetLocalData();
});

describe('live session vs history: what reaches Firestore', () => {
  it('a live workout stays on the device; finishing writes it once, sealed, under its own id', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Bench Press');
    const ex = wk(w.id).exercises[0];
    store.upsertSet(w.id, ex.id, setIn());
    await settle();
    expect(fs.writes).toEqual([]); // nothing sealed or plain while live

    vi.setSystemTime(T0 + 3_600_000);
    store.finishWorkout(w.id);
    await settle();
    const ws = wWrites(w.id);
    expect(ws).toHaveLength(1);
    expect(ws[0].path).toBe(`users/u1/workouts/${w.id}`);
    expect(isSealed(ws[0].data)).toBe(true);
    const text = JSON.stringify(ws[0].data);
    expect(text).not.toContain('Bench');
    expect(text).not.toContain('"weight"');
    // readable fields only: id, times, stats
    expect(ws[0].data.id).toBe(w.id);
    expect(ws[0].data.finishedAt).toBe(T0 + 3_600_000);
    expect(ws[0].data.stats).toEqual({ volumeKg: 640, sets: 1 });
    const back = await plain(ws[0]);
    expect(back.exercises[0].name).toBe('Bench Press');
    expect(back.exercises[0].sets[0].weight).toBe(80);
  });

  it('editing a finished workout re-writes the SAME document (upsert, idempotent)', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    store.finishWorkout(w.id);
    await settle();
    const exId = wk(w.id).exercises[0].id;
    store.upsertSet(w.id, exId, setIn({ reps: 5, weight: 100 }));
    await settle();
    store.upsertSet(w.id, exId, setIn({ reps: 5, weight: 100 }));
    await settle();
    const paths = new Set(wWrites().map((x) => x.path));
    expect([...paths]).toEqual([`users/u1/workouts/${w.id}`]);
    expect(wWrites().length).toBeGreaterThanOrEqual(3);
  });

  it('nothing is written while signed out', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Deadlift');
    fs.uid = null;
    store.finishWorkout(w.id);
    store.deleteWorkout(w.id);
    store.upsertGym({ name: 'Gym', lat: 0, lng: 0, radiusM: 100 });
    await settle();
    expect(fs.writes).toEqual([]);
    expect(wDeletes()).toEqual([]);
  });

  it('a permission-denied write flips the sync chip to failed; transient errors do not', async () => {
    const a = store.startWorkout()!;
    store.addExercise(a.id, 'Row');
    fs.failWith = { code: 'unavailable' };
    store.finishWorkout(a.id);
    await settle();
    expect(st().syncStatus).not.toBe('failed');
    expect(st().syncError).toBeNull();

    const b = store.startWorkout()!;
    store.addExercise(b.id, 'Row');
    fs.failWith = { code: 'permission-denied' };
    store.finishWorkout(b.id);
    await settle();
    expect(st().syncStatus).toBe('failed');
    expect(st().syncError?.status).toBe(403);
    store.discardBlockingChange();
    expect(st().syncError).toBeNull();
  });

  it('deleting a synced workout deletes its document; a never-synced live one only locally', async () => {
    const live = store.startWorkout()!;
    store.addExercise(live.id, 'Curl');
    store.deleteWorkout(live.id);
    expect(wDeletes()).toEqual([]);

    const done = store.startWorkout()!;
    store.addExercise(done.id, 'Curl');
    store.finishWorkout(done.id);
    store.deleteWorkout(done.id);
    await settle();
    expect(wDeletes()).toEqual([`users/u1/workouts/${done.id}`]);
    expect(st().workouts).toEqual([]);
  });
});

describe('server snapshots round-trip what the store wrote', () => {
  const snap = (
    docs: Record<string, unknown>[],
    meta = { fromCache: false, hasPendingWrites: false },
  ) => ({
    docs: docs.map((d) => ({ data: () => d })),
    metadata: meta,
  });

  it('a sealed workout coming back from Firestore is opened; local-only live drafts survive the snapshot', async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Bench Press');
    store.upsertSet(w.id, wk(w.id).exercises[0].id, setIn());
    store.finishWorkout(w.id);
    await settle();
    const sealed = wWrites(w.id)[0].data;

    store.resetLocalData();
    const live = store.startWorkout()!;
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/workouts')!(snap([sealed]));
    await settle();
    const ids = st().workouts.map((x) => x.id);
    expect(ids).toContain(w.id);
    expect(ids).toContain(live.id); // not on the server, still live => kept
    expect(wk(w.id).exercises[0].sets[0].weight).toBe(80);
    expect(st().syncStatus).toBe('synced');
    stop();
  });

  it('pending writes keep the chip pending; cache-only offline snapshot reads as offline', async () => {
    const stop = store.startSyncLoop();
    const onLine = vi.spyOn(navigator, 'onLine', 'get');
    onLine.mockReturnValue(true);
    fs.listeners.get('users/u1/workouts')!(snap([], { fromCache: true, hasPendingWrites: true }));
    await settle();
    expect(st().syncStatus).toBe('pending');
    onLine.mockReturnValue(false);
    fs.listeners.get('users/u1/workouts')!(snap([], { fromCache: true, hasPendingWrites: false }));
    await settle();
    expect(st().syncStatus).toBe('offline');
    onLine.mockReturnValue(true);
    fs.listeners.get('users/u1/workouts')!(snap([]));
    await settle();
    expect(st().syncStatus).toBe('synced');
    expect(st().lastSyncAt).toBe(T0);
    stop();
  });

  it('a sealed doc the vault cannot open is skipped rather than shown or crashing the listener', async () => {
    const stop = store.startSyncLoop();
    const { readyVault } = await import('./testVault');
    const { sealDoc } = await import('./encryptedDoc');
    const other = await readyVault();
    const foreign = await sealDoc(
      'workouts',
      { id: 'x', startedAt: 1, finishedAt: 2, exercises: [] },
      other.material().key,
      other.material().salt,
    );
    fs.listeners.get('users/u1/workouts')!(snap([foreign]));
    await settle();
    expect(st().workouts).toEqual([]);
    stop();
  });

  it('mergeServerWorkoutsWithLocalDrafts keeps an open past-edit over the server copy and sorts newest first', () => {
    const base = (
      id: string,
      startedAt: number,
      finishedAt: number | null,
      notes = '',
    ): Workout => ({
      id,
      startedAt,
      finishedAt,
      autoFinished: false,
      gymId: null,
      exercises: [],
      ...(notes ? { dayName: notes } : {}),
    });
    const server = [base('a', 100, 200), base('b', 300, 400)];
    const local = [base('a', 100, 200, 'edited'), base('c', 500, null), base('d', 50, 60)];
    // no drafts registered: server wins for a, live c is kept, finished d (not on server) dropped
    let merged = store.mergeServerWorkoutsWithLocalDrafts(server, local);
    expect(merged.map((w) => w.id)).toEqual(['c', 'b', 'a']);
    expect(merged.find((w) => w.id === 'a')!.dayName).toBeUndefined();
    // a registered draft keeps the local edit
    store.__replaceStateForTests({ ...st(), workouts: [base('a', 100, 200)] });
    store.beginPastEdit('a');
    merged = store.mergeServerWorkoutsWithLocalDrafts(server, local);
    expect(merged.find((w) => w.id === 'a')!.dayName).toBe('edited');
  });

  it('mergeServerActivitiesWithLocalLive keeps only unfinished local activities the server lacks', () => {
    const a = (id: string, startedAt: number, finishedAt: number | null) =>
      ({ id, startedAt, finishedAt }) as never;
    const out = store.mergeServerActivitiesWithLocalLive(
      [a('s1', 10, 20)],
      [a('s1', 10, null), a('l1', 30, null), a('l2', 5, 9)],
    );
    expect((out as { id: string }[]).map((x) => x.id)).toEqual(['l1', 's1']);
  });
});

describe('past-session drafts', () => {
  const finished = async () => {
    const w = store.startWorkout()!;
    store.addExercise(w.id, 'Squat');
    store.upsertSet(w.id, wk(w.id).exercises[0].id, setIn());
    store.finishWorkout(w.id);
    await settle();
    fs.writes.length = 0;
    return w.id;
  };

  it('edits stay local until saved; dirty tracks the snapshot; save writes once', async () => {
    const id = await finished();
    store.beginPastEdit(id);
    store.beginPastEdit(id); // second call is a no-op
    expect(store.isPastDirty(id)).toBe(false);
    store.renameExercise(id, wk(id).exercises[0].id, 'Front Squat');
    await settle();
    expect(fs.writes).toEqual([]);
    expect(store.isPastDirty(id)).toBe(true);
    store.savePastWorkout(id);
    await settle();
    expect(wWrites(id)).toHaveLength(1);
    expect((await plain(wWrites(id)[0])).exercises[0].name).toBe('Front Squat');
    expect(store.isPastDirty(id)).toBe(true); // no snapshot any more => counts as changed
  });

  it('discard reverts an edited session without any write', async () => {
    const id = await finished();
    store.beginPastEdit(id);
    store.renameExercise(id, wk(id).exercises[0].id, 'Hack Squat');
    store.discardPastWorkout(id);
    await settle();
    expect(wk(id).exercises[0].name).toBe('Squat');
    expect(fs.writes).toEqual([]);
    store.discardPastWorkout(id); // not a draft any more: no-op
    expect(wk(id).exercises[0].name).toBe('Squat');
  });

  it('a fresh backfill is dropped locally on discard and never reaches the server', async () => {
    const w = store.backfillWorkout(T0 - 86_400_000, 3_600_000, null);
    expect(store.isPastDirty(w.id)).toBe(true);
    store.discardPastWorkout(w.id);
    await settle();
    expect(st().workouts.find((x) => x.id === w.id)).toBeUndefined();
    expect(fs.writes).toEqual([]);
    expect(wDeletes()).toEqual([]);
  });

  it('deletePastWorkout removes an edited existing session on the server, a fresh backfill only locally', async () => {
    const id = await finished();
    store.beginPastEdit(id);
    store.deletePastWorkout(id);
    await settle();
    expect(wDeletes()).toEqual([`users/u1/workouts/${id}`]);

    const fresh = store.backfillWorkout(T0 - 2 * 86_400_000, 1_800_000, null);
    fs.deletes.length = 0;
    store.deletePastWorkout(fresh.id);
    await settle();
    expect(wDeletes()).toEqual([]);
    expect(st().workouts).toEqual([]);
  });

  it('commitWorkout is a no-op for non-drafts and for still-live sessions', async () => {
    const live = store.startWorkout()!;
    store.commitWorkout(live.id);
    const id = await finished();
    store.commitWorkout(id);
    await settle();
    expect(fs.writes).toEqual([]);
  });
});
