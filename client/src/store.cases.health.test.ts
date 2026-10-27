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

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const stub = vault as unknown as import('./autoVault').Vault;
const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const open = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Record<string, unknown>>(w.data, stub.material().key);
const snap = (d: Record<string, unknown> | null) => ({
  exists: () => d !== null,
  data: () => d,
  docs: d ? [{ data: () => d }] : [],
  metadata: { fromCache: false, hasPendingWrites: false },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.listeners.clear();
  fs.failWith = null;
  fs.uid = 'u1';
  store.resetLocalData();
});
afterEach(async () => {
  vi.useRealTimers();
  await settle(); // let in-flight sealed writes land before the next test starts
  store.resetLocalData();
});

describe('body metrics', () => {
  it('weigh-ins are kept sorted, edited and removed; the doc is sealed and drops undefined', async () => {
    store.addWeight(82, T0);
    store.addWeight(80, T0 - DAY);
    expect(st().bodyMetrics.weights.map((w) => w.weight)).toEqual([80, 82]);
    const id = st().bodyMetrics.weights[1].id;
    store.editWeight(id, 81.5, T0 - 2 * DAY);
    expect(st().bodyMetrics.weights.map((w) => w.weight)).toEqual([81.5, 80]);
    store.updateBodyMetrics({ heightCm: 180, bodyFatPct: undefined });
    store.dismissWeighInToday('2026-03-04');
    await settle();
    const last = at('users/u1/meta/body').at(-1)!;
    expect(isSealed(last.data)).toBe(true);
    expect(Object.keys(last.data).sort()).toEqual(['enc', 'updatedAt']);
    expect(JSON.stringify(last.data)).not.toContain('81.5');
    const back = await open(last);
    expect(back.heightCm).toBe(180);
    expect('bodyFatPct' in back).toBe(false);
    expect(back.weighInDismissedDay).toBe('2026-03-04');
    store.removeWeight(id);
    expect(st().bodyMetrics.weights).toHaveLength(1);
    expect(store.latestWeight(st().bodyMetrics)?.weight).toBe(80);
  });

  it('latestWeight / bodyMetricsComplete / bmiValue edge cases', () => {
    expect(store.latestWeight(null)).toBeNull();
    expect(store.latestWeight({ weights: [] })).toBeNull();
    expect(
      store.latestWeight({
        weights: [
          { id: 'a', at: 5, weight: 70 },
          { id: 'b', at: 5, weight: 71 },
          { id: 'c', at: 1, weight: 72 },
        ],
      })?.id,
    ).toBe('b');
    expect(store.bodyMetricsComplete({ weights: [] })).toBe(false);
    expect(store.bodyMetricsComplete({ heightCm: 170, weights: [] })).toBe(false);
    expect(
      store.bodyMetricsComplete({ heightCm: 170, weights: [{ id: 'a', at: 1, weight: 60 }] }),
    ).toBe(true);
    expect(store.bmiValue(180, 81)).toBeCloseTo(25, 5);
    expect(store.bmiValue(0, 80)).toBeNull();
    expect(store.bmiValue(180, 0)).toBeNull();
    expect(store.bmiValue(null, 80)).toBeNull();
    expect(store.bmiValue(180, undefined)).toBeNull();
  });

  it('the body snapshot replaces local data, keeps what is on screen when sealed and locked', async () => {
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/body')!(snap({ heightCm: 175 }));
    await settle();
    expect(st().bodyMetrics).toEqual({ heightCm: 175, weights: [] });
    fs.listeners.get('users/u1/meta/body')!(snap(null));
    await settle();
    expect(st().bodyMetrics).toEqual({ weights: [] });
    stop();
  });
});

describe('goals, mastery, home, coach settings: synced docs', () => {
  it('goals write and reset; a server copy merges over the empty defaults', async () => {
    store.setPhysiqueTarget('lean' as never);
    store.setBlockFocus('strength' as never);
    expect(st().goals.physique).toBe('lean');
    expect(st().goals.focus).toBe('strength');
    await settle();
    const w = at('users/u1/meta/goals').at(-1)!;
    // sealed (SPO-217): only the stamp is readable in the database
    expect(isSealed(w.data)).toBe(true);
    expect(w.data.physique).toBeUndefined();
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    const o = await open(w);
    expect(o.physique).toBe('lean');
    expect(typeof o.updatedAt).toBe('number');
    store.resetGoals();
    expect(st().goals.physique).toBeUndefined();
    const stop = store.startSyncLoop();
    // a legacy (not yet migrated) plaintext document is still read
    fs.listeners.get('users/u1/meta/goals')!(snap({ physique: 'bulk' }));
    await settle();
    expect(st().goals.physique).toBe('bulk');
    // and so is the sealed one
    fs.listeners.get('users/u1/meta/goals')!(snap(w.data));
    await settle();
    expect(st().goals.physique).toBe('lean');
    fs.listeners.get('users/u1/meta/goals')!(snap(null));
    await settle();
    expect(st().goals.physique).toBeUndefined();
    stop();
  });

  it('mastery: pre-sync local data is pushed up once; newer local edits beat stale server copies', async () => {
    store.setMasteryHistory(2019, 'continuous');
    store.setMasterySeenRating(61);
    await settle();
    expect(isSealed(at('users/u1/meta/mastery').at(-1)!.data)).toBe(true);
    expect(await open(at('users/u1/meta/mastery').at(-1)!)).toMatchObject({
      sinceYear: 2019,
      pattern: 'continuous',
      seenRating: 61,
    });
    fs.writes.length = 0;
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/mastery')!(snap(null)); // no server copy: push local
    await settle();
    expect(at('users/u1/meta/mastery')).toHaveLength(1);

    const localAt = st().mastery.updatedAt!;
    fs.listeners.get('users/u1/meta/mastery')!(
      snap({ sinceYear: 2000, pattern: 'occasional', seenRating: 1, updatedAt: localAt - 10 }),
    );
    await settle();
    expect(st().mastery.sinceYear).toBe(2019); // stale server copy ignored
    fs.listeners.get('users/u1/meta/mastery')!(
      snap({ sinceYear: 2000, pattern: 'occasional', updatedAt: localAt + 10 }),
    );
    await settle();
    expect(st().mastery).toEqual({
      sinceYear: 2000,
      pattern: 'occasional',
      seenRating: null,
      updatedAt: localAt + 10,
    });
    stop();
  });

  it('coach settings write is debounced to one sealed write holding only the changed fields over the server copy', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/coach')!(snap({ memory: ['m'], updatedAt: 1 }));
    await vi.advanceTimersByTimeAsync(1);
    store.setCoach({ enabled: true });
    store.setCoach({ temper: 5 });
    await vi.advanceTimersByTimeAsync(3999);
    expect(at('users/u1/meta/coach')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(at('users/u1/meta/coach')).toHaveLength(1));
    const w = at('users/u1/meta/coach');
    // sealed (SPO-217): a whole document, no partial merge-write; only the stamp is readable
    expect(w[0].opts).toBeUndefined();
    expect(isSealed(w[0].data)).toBe(true);
    expect(Object.keys(w[0].data).sort()).toEqual(['enc', 'updatedAt']);
    expect(Object.keys(await open(w[0])).sort()).toEqual([
      'enabled',
      'memory',
      'temper',
      'updatedAt',
    ]);
    expect(st().coach.temper).toBe(5);

    // leaving the page flushes a pending change at once; the earlier fields are kept (the server copy is remembered)
    store.setCoach({ enabled: false });
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(at('users/u1/meta/coach')).toHaveLength(2));
    const second = await open(at('users/u1/meta/coach')[1]);
    expect(second.enabled).toBe(false);
    expect(second.temper).toBe(5);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(at('users/u1/meta/coach')).toHaveLength(2);
  });

  it('coach: a signed-out edit is never written; a stale server copy does not undo a pending edit; a newer one wins', async () => {
    // the consent reset in beforeEach republishes the (empty) coach view, since a reset forgets the last one (SPO-219): let it land first
    await settle();
    fs.writes.length = 0;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    fs.uid = null;
    store.setCoach({ enabled: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fs.writes).toEqual([]);

    fs.uid = 'u1';
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/coach')!(snap(null)); // enabled locally, none on server: push everything
    await vi.advanceTimersByTimeAsync(4000);
    await vi.waitFor(() => expect(at('users/u1/meta/coach').length).toBe(1));
    expect(Object.keys(await open(at('users/u1/meta/coach')[0])).length).toBeGreaterThan(3);

    store.setCoach({ temper: 5 });
    fs.listeners.get('users/u1/meta/coach')!(snap({ temper: 1, updatedAt: 1 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(st().coach.temper).toBe(5);
    await vi.advanceTimersByTimeAsync(4000);
    fs.listeners.get('users/u1/meta/coach')!(snap({ temper: 3, updatedAt: Date.now() + 100_000 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(st().coach.temper).toBe(3);
    stop();
  });

  it('coach: an edit made before the first snapshot waits for it and keeps the fields of the server copy (SPO-217)', async () => {
    fs.writes.length = 0;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    fs.uid = 'u1';
    const stop = store.startSyncLoop();
    store.setCoach({ temper: 5 });
    await vi.advanceTimersByTimeAsync(5000);
    // nothing was written over a server copy this device has not read yet
    expect(at('users/u1/meta/coach')).toHaveLength(0);

    fs.listeners.get('users/u1/meta/coach')!(
      snap({ temper: 1, memory: ['likes squats'], updatedAt: 1 }),
    );
    await vi.advanceTimersByTimeAsync(4000);
    await vi.waitFor(() => expect(at('users/u1/meta/coach')).toHaveLength(1));
    const written = await open(at('users/u1/meta/coach')[0]);
    expect(written.temper).toBe(5);
    expect(written.memory).toEqual(['likes squats']);
    stop();
  });

  it('exercise display prefs persist per exercise and fall back to the account default', () => {
    expect(store.globalWeightUnit()).toBe('kg');
    store.setGlobalWeightUnit('lb');
    expect(store.globalWeightUnit()).toBe('lb');
    expect(store.exerciseUnit('Squat')).toBe('lb');
    store.setExerciseUnit('Squat', 'kg');
    expect(store.exerciseUnit('Squat')).toBe('kg');
    expect(store.exerciseUnit('Bench Press')).toBe('lb');
    store.setExerciseRestSec('Squat', 180);
    expect(store.exerciseRestSec('Squat')).toBe(180);
    expect(store.exerciseRestSec('Curl')).toBeNull();
    store.setExerciseLoadType('Squat', 'assist');
    store.setExerciseSides('Squat', 'one');
    expect(st().exerciseLoadTypes).toEqual({ squat: 'assist' });
    expect(st().exerciseSides).toEqual({ squat: 'one' });
    expect(store.restPrefs()).toEqual({
      vibrate: true,
      sound: true,
      keepAwake: true,
      notify: false,
    });
    store.setRestPrefs({ notify: true, sound: false });
    expect(store.restPrefs()).toEqual({
      vibrate: true,
      sound: false,
      keepAwake: true,
      notify: true,
    });
  });
});

describe('rest periods', () => {
  const D = store.dayKey(T0);

  it('startRestPeriod orders the range, seals the doc and upserts under the same id', async () => {
    const p = store.startRestPeriod({ mode: 'off', startDay: D + 3, endDay: D + 1, note: 'trip' });
    expect([p.startDay, p.endDay]).toEqual([D + 1, D + 3]);
    await settle();
    const w = at(`users/u1/restPeriods/${p.id}`);
    expect(w).toHaveLength(1);
    expect(isSealed(w[0].data)).toBe(true);
    expect(JSON.stringify(w[0].data)).not.toContain('trip');
    const ill = store.startRestPeriod({
      mode: 'illness',
      startDay: D,
      endDay: D,
      open: true,
      illnessKind: 'virus',
    });
    expect(ill.open).toBe(true);
    expect(ill.illnessKind).toBe('virus');
  });

  it('endRestPeriod: a running period stops yesterday; one starting today or later is removed; unknown ids ignored', async () => {
    const run = store.startRestPeriod({ mode: 'off', startDay: D - 5, endDay: D + 5 });
    const future = store.startRestPeriod({ mode: 'off', startDay: D + 2, endDay: D + 4 });
    store.endRestPeriod('missing');
    store.endRestPeriod(run.id);
    store.endRestPeriod(future.id);
    await settle();
    expect(st().restPeriods.map((r) => [r.id, r.endDay, r.open])).toEqual([[run.id, D - 1, false]]);
    expect(fs.deletes).toContain(`users/u1/restPeriods/${future.id}`);
    expect(store.activeRestPeriod()).toBeNull();
  });

  it('logRestPeriod validates the range', () => {
    expect(store.logRestPeriod({ mode: 'off', startDay: D, endDay: D - 1 }, T0)).toEqual({
      ok: false,
      reason: 'end-before-start',
    });
    expect(store.logRestPeriod({ mode: 'off', startDay: D + 1, endDay: D + 2 }, T0)).toEqual({
      ok: false,
      reason: 'future',
    });
    expect(
      store.logRestPeriod(
        { mode: 'illness', startDay: D + 1, endDay: D + 2, allowFuture: true },
        T0,
      ),
    ).toEqual({ ok: false, reason: 'future' }); // illness never reaches into the future
    const ok = store.logRestPeriod(
      { mode: 'off', startDay: D + 1, endDay: D + 2, allowFuture: true },
      T0,
    );
    expect(ok.ok).toBe(true);
    expect(store.updateRestPeriod('nope', { mode: 'off', startDay: D, endDay: D }, T0)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('overlaps are refused unless merge/replace is chosen; merge needs the same mode', async () => {
    const a = store.logRestPeriod(
      { mode: 'off', startDay: D - 10, endDay: D - 5, name: '  Trip  ' },
      T0,
    );
    expect(a.ok && a.period.name).toBe('Trip');
    const aId = a.ok ? a.period.id : '';
    expect(store.logRestPeriod({ mode: 'off', startDay: D - 7, endDay: D - 3 }, T0)).toEqual({
      ok: false,
      reason: 'overlap',
    });
    // different modes never conflict
    expect(store.logRestPeriod({ mode: 'active', startDay: D - 7, endDay: D - 3 }, T0).ok).toBe(
      true,
    );

    const merged = store.logRestPeriod(
      { mode: 'off', startDay: D - 7, endDay: D - 3, overlap: 'merge' },
      T0,
    );
    expect(merged.ok && [merged.period.startDay, merged.period.endDay]).toEqual([D - 10, D - 3]);
    await settle();
    expect(fs.deletes).toContain(`users/u1/restPeriods/${aId}`);
    expect(st().restPeriods.filter((r) => r.mode === 'off')).toHaveLength(1);
  });

  it('replace cuts the new dates out of the old period (both halves kept) and can drop a fully covered one', async () => {
    const big = store.logRestPeriod({ mode: 'off', startDay: D - 20, endDay: D - 10 }, T0);
    const bigId = big.ok ? big.period.id : '';
    const small = store.logRestPeriod({ mode: 'off', startDay: D - 4, endDay: D - 3 }, T0);
    const smallId = small.ok ? small.period.id : '';
    const r = store.logRestPeriod(
      { mode: 'off', startDay: D - 16, endDay: D - 14, overlap: 'replace' },
      T0,
    );
    expect(r.ok).toBe(true);
    const offs = st()
      .restPeriods.filter((p) => p.mode === 'off')
      .sort((a, b) => a.startDay - b.startDay);
    expect(offs.map((p) => [p.startDay, p.endDay])).toEqual([
      [D - 20, D - 17],
      [D - 16, D - 14],
      [D - 13, D - 10],
      [D - 4, D - 3],
    ]);
    expect(offs.some((p) => p.id === bigId)).toBe(true);

    const cover = store.logRestPeriod(
      { mode: 'off', startDay: D - 5, endDay: D - 2, overlap: 'replace' },
      T0,
    );
    expect(cover.ok).toBe(true);
    await settle();
    expect(fs.deletes).toContain(`users/u1/restPeriods/${smallId}`);
    // every piece written under its own id is an upsert
    const paths = fs.writes.map((w) => w.path);
    expect(new Set(paths).size).toBeLessThanOrEqual(paths.length);
  });

  it('merging with another mode is refused; editing keeps the id; removeWorkoutIds deletes those sessions', async () => {
    store.__replaceStateForTests({ ...st(), restPeriods: [] });
    const a = store.logRestPeriod(
      { mode: 'illness', startDay: D - 3, endDay: D - 2, illnessKind: 'cold' },
      T0,
    );
    const id = a.ok ? a.period.id : '';
    const wk = store.startWorkout()!;
    store.addExercise(wk.id, 'Squat');
    store.finishWorkout(wk.id);
    const e = store.updateRestPeriod(
      id,
      { mode: 'illness', startDay: D - 4, endDay: D - 1, removeWorkoutIds: [wk.id] },
      T0,
    );
    expect(e.ok && e.period.id).toBe(id);
    expect(e.ok && e.period.illnessKind).toBeUndefined();
    expect(st().workouts.find((w) => w.id === wk.id)).toBeUndefined();
    const refuse = store.logRestPeriod(
      { mode: 'off', startDay: D - 3, endDay: D - 3, overlap: 'merge' },
      T0,
    );
    expect(refuse.ok).toBe(true); // off vs illness do not conflict
  });

  it('activeRestPeriod picks the newest covering period (open ones included); restDayKeys expands open ones to today', () => {
    const old = store.startRestPeriod({ mode: 'off', startDay: D - 2, endDay: D + 2 });
    vi.setSystemTime(T0 + 1000);
    const open = store.startRestPeriod({
      mode: 'illness',
      startDay: D - 1,
      endDay: D - 1,
      open: true,
    });
    expect(store.activeRestPeriod(T0 + 2000)?.id).toBe(open.id);
    expect(store.activeRestPeriod(T0 + 10 * DAY)?.id).toBe(open.id);
    expect(store.activeRestPeriod(T0 - 30 * DAY)).toBeNull();
    const keys = store.restDayKeys(st().restPeriods, T0);
    expect([...keys].sort((a, b) => a - b)).toEqual([D - 2, D - 1, D, D + 1, D + 2]);
    expect(old.id).toBeTruthy();
    store.deleteRestPeriod(old.id);
    expect(st().restPeriods).toHaveLength(1);
  });

  it('streak is protected by rest periods and by rehab (injury) days', () => {
    store.startRestPeriod({ mode: 'off', startDay: D - 3, endDay: D - 3 });
    const prot = store.streakProtectedPredicate(T0);
    expect(prot(D - 3)).toBe(true);
    expect(prot(D - 2)).toBe(false);
    expect(store.consistencyStreak(T0)).toBe(0);
    expect(store.trainedDayKeys([], []).size).toBe(0);
  });
});
