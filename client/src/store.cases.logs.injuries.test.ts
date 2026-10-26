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
import {
  isHealthWriteDenied,
  resetHealthGateForTests,
  type HealthWriteDenied,
} from './data/healthConsentGate';
import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const stub = vault as unknown as import('./autoVault').Vault;
/** The test grants every health consent (setup), so a write here is never denied; narrows the union. */
function granted<T>(x: T): Exclude<T, HealthWriteDenied> {
  if (isHealthWriteDenied(x)) throw new Error(`health write denied: ${x.feature}`);
  return x as Exclude<T, HealthWriteDenied>;
}

const startInjury = (...a: Parameters<typeof store.startInjury>) =>
  granted(store.startInjury(...a));
const logRehabCheckin = (...a: Parameters<typeof store.logRehabCheckin>) =>
  granted(store.logRehabCheckin(...a));

const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const open = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Record<string, unknown>>(w.data, stub.material().key);
const snap = (docs: Record<string, unknown>[], fromCache = false) => ({
  exists: () => docs.length > 0,
  data: () => docs[0],
  docs: docs.map((d) => ({ data: () => d })),
  metadata: { fromCache, hasPendingWrites: false },
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

describe('injuries and rehab', () => {
  it('without the injuries consent a write is refused and nothing is stored', async () => {
    resetHealthGateForTests();
    const denied = { ok: false, reason: 'consent', feature: 'injuries' };
    expect(
      store.startInjury({ reason: 'injury', bodyPart: 'knee', muscles: [], stage: 'protect' }),
    ).toEqual(denied);
    expect(store.logRehabCheckin('any', 'fine')).toEqual(denied);
    await settle();
    expect(st().injuries).toEqual([]);
    expect(fs.writes.filter((w) => w.path.includes('/injuries/'))).toEqual([]);
  });
  const D = store.dayKey(T0);
  const hurt = () =>
    startInjury({
      reason: 'injury',
      bodyPart: 'shoulder',
      side: 'left',
      muscles: ['shoulders'],
      stage: 'protect',
      note: 'secret-note',
    });

  it('a new injury is sealed (no body part or note in clear) and stored under its id', async () => {
    const inj = hurt();
    expect(inj.startDay).toBe(D);
    expect(store.activeInjury()?.id).toBe(inj.id);
    await settle();
    const w = at(`users/u1/injuries/${inj.id}`);
    expect(w).toHaveLength(1);
    expect(isSealed(w[0].data)).toBe(true);
    const text = JSON.stringify(w[0].data);
    expect(text).not.toContain('shoulder');
    expect(text).not.toContain('secret-note');
    expect((await open(w[0])).bodyPart).toBe('shoulder');
  });

  it('a backfilled start day cannot lie in the future', () => {
    const inj = startInjury({
      reason: 'injury',
      bodyPart: 'elbow',
      muscles: [],
      stage: 'protect',
      startDay: D + 5,
    });
    expect(inj.startDay).toBe(D);
    const old = startInjury({
      reason: 'surgery',
      bodyPart: 'elbow',
      muscles: [],
      stage: 'protect',
      startDay: D - 9,
      fullRestUntil: T0,
    });
    expect(old.startDay).toBe(D - 9);
    expect(old.fullRestUntil).toBe(T0);
  });

  it('muscles, stage and timeframe edits patch the same injury and re-write it', async () => {
    const inj = hurt();
    store.setInjuryMuscles(inj.id, ['chest']);
    store.setInjuryStage(inj.id, 'rebuild');
    store.setInjuryTimeframe(inj.id, T0 + DAY);
    store.setInjuryStage('missing', 'rebuild');
    await settle();
    const cur = st().injuries[0];
    expect(cur).toMatchObject({ muscles: ['chest'], stage: 'rebuild', fullRestUntil: T0 + DAY });
    const last = at(`users/u1/injuries/${inj.id}`).at(-1)!;
    expect((await open(last)).stage).toBe('rebuild');
    expect(new Set(fs.writes.map((w) => w.path).filter((x) => x.includes('/injuries/')))).toEqual(
      new Set([`users/u1/injuries/${inj.id}`]),
    );
  });

  it('check-ins: pain eases back a stage, sore holds, three fine offers the step up which the user confirms', () => {
    const inj = hurt();
    store.setInjuryStage(inj.id, 'reintroduce');
    expect(logRehabCheckin('missing', 'fine')).toBeNull();
    expect(logRehabCheckin(inj.id, 'pain', T0)).toMatchObject({
      outcome: 'regress',
      stage: 'protect',
    });
    expect(st().injuries[0].stage).toBe('protect');
    expect(logRehabCheckin(inj.id, 'pain', T0)).toMatchObject({ outcome: 'hold' });
    expect(logRehabCheckin(inj.id, 'sore', T0)).toMatchObject({ outcome: 'hold' });
    let last = logRehabCheckin(inj.id, 'fine', T0);
    for (let i = 0; i < 6 && last?.outcome !== 'ready'; i++)
      last = logRehabCheckin(inj.id, 'fine', T0);
    expect(last?.outcome).toBe('ready');
    expect(st().injuries[0].pendingAdvance).toBe(true);
    expect(st().injuries[0].checkins.at(-1)).toMatchObject({ day: D, at: T0, feel: 'fine' });
    store.dismissAdvance(inj.id);
    expect(st().injuries[0].pendingAdvance).toBe(false);
    store.advanceInjury(inj.id);
    expect(st().injuries[0].stage).toBe('reintroduce');
  });

  it('healing makes it history; delete removes the document', async () => {
    const a = hurt();
    const b = hurt();
    store.healInjury(a.id, T0);
    expect(store.activeInjuryList().map((i) => i.id)).toEqual([b.id]);
    store.deleteInjury(b.id);
    await settle();
    expect(fs.deletes).toEqual([`users/u1/injuries/${b.id}`]);
  });

  it('logPastInjury / updateInjury validate dates and fall back to known muscles', () => {
    expect(
      store.logPastInjury(
        { bodyPart: 'shoulder', side: 'left', startDay: D + 1, healedDay: D + 2 },
        T0,
      ),
    ).toEqual({
      ok: false,
      reason: 'future',
    });
    expect(
      store.logPastInjury(
        { bodyPart: 'shoulder', side: 'left', startDay: D - 1, healedDay: D - 3 },
        T0,
      ),
    ).toEqual({
      ok: false,
      reason: 'healed-before-start',
    });
    const r = store.logPastInjury(
      { bodyPart: 'shoulder', side: 'left', startDay: D - 9, healedDay: D - 3 },
      T0,
    );
    expect(r.ok && r.injury).toMatchObject({
      stage: 'return',
      healedDay: D - 3,
      muscles: ['shoulders', 'chest', 'triceps'],
    });
    const id = r.ok ? r.injury.id : '';
    expect(
      store.updateInjury(
        'missing',
        { bodyPart: 'elbow', side: 'both', startDay: D, healedDay: null },
        T0,
      ),
    ).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect(
      store.updateInjury(
        id,
        { bodyPart: 'elbow', side: 'both', startDay: D - 9, healedDay: D + 4 },
        T0,
      ),
    ).toEqual({
      ok: false,
      reason: 'future',
    });
    const up = store.updateInjury(
      id,
      { bodyPart: 'elbow', side: 'both', startDay: D - 9, healedDay: null },
      T0,
    );
    expect(up.ok && up.injury).toMatchObject({
      bodyPart: 'elbow',
      muscles: ['biceps', 'triceps', 'forearms'],
      healedDay: null,
    });
    // unknown body part keeps the muscles it had
    const up2 = store.updateInjury(
      id,
      { bodyPart: 'mystery', side: 'both', startDay: D - 9, healedDay: null },
      T0,
    );
    expect(up2.ok && up2.injury.muscles).toEqual(['biceps', 'triceps', 'forearms']);
  });

  it('streaks are protected by injury and surgery rehab days', () => {
    startInjury({
      reason: 'surgery',
      bodyPart: 'elbow',
      muscles: [],
      stage: 'protect',
      startDay: D - 4,
    });
    const prot = store.streakProtectedPredicate(T0);
    expect(prot(D - 4)).toBe(true);
    expect(prot(D)).toBe(true);
    expect(prot(D - 5)).toBe(false);
  });

  it('the injuries snapshot replaces the list', async () => {
    const inj = hurt();
    await settle();
    const sealed = at(`users/u1/injuries/${inj.id}`)[0].data;
    store.resetLocalData();
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/injuries')!(snap([sealed]));
    await settle();
    expect(st().injuries.map((i) => i.id)).toEqual([inj.id]);
    stop();
  });
});

describe('activities', () => {
  it('a live activity stays on the device; pausing banks the segment; finishing writes it sealed once', async () => {
    await settle(); // the beforeEach reset republishes the coach view (SPO-219): let that land, then count only this test's writes
    fs.writes.length = 0;
    const a = store.startActivity('Running', 'conditioning')!;
    expect(store.liveActivity()?.id).toBe(a.id);
    vi.setSystemTime(T0 + 10 * 60_000);
    store.pauseActivity(a.id);
    store.pauseActivity(a.id); // already paused: no change
    expect(st().activities[0].accumulatedMs).toBe(10 * 60_000);
    expect(st().activities[0].runningSince).toBeNull();
    vi.setSystemTime(T0 + 20 * 60_000);
    store.resumeActivity(a.id);
    store.resumeActivity(a.id);
    store.updateActivity(a.id, { effort: 'hard', distanceKm: 4.2, note: 'felt great' });
    vi.setSystemTime(T0 + 25 * 60_000);
    await settle();
    expect(fs.writes).toEqual([]); // nothing synced while live

    const done = store.finishActivity(a.id, { calories: 300 })!;
    expect(done.durationMin).toBe(15);
    expect(done.calories).toBe(300);
    expect(done.finishedAt).toBe(T0 + 25 * 60_000);
    await settle();
    const w = at(`users/u1/activities/${a.id}`);
    expect(w).toHaveLength(1);
    expect(isSealed(w[0].data)).toBe(true);
    expect(JSON.stringify(w[0].data)).not.toContain('felt great');
    expect(w[0].data.startedAt).toBe(T0);
    expect((await open(w[0])).distanceKm).toBe(4.2);
    expect(store.finishActivity('missing')).toBeNull();
    expect(store.liveActivity()).toBeNull();
    // finished: pause/resume are ignored
    store.pauseActivity(a.id);
    store.resumeActivity(a.id);
  });

  it('only one live mode at a time: no activity during a workout, no workout during an activity', () => {
    const w = store.startWorkout()!;
    expect(store.startActivity('Run', 'conditioning')).toBeNull();
    store.deleteWorkout(w.id);
    const a = store.startActivity('Run', 'conditioning')!;
    expect(store.startWorkout()).toBeNull();
    store.discardActivity(a.id);
    expect(store.liveActivity()).toBeNull();
  });

  it('logActivity upserts a finished one; editActivity patches; delete removes the document', async () => {
    const a = store.logActivity({
      type: 'Cycling',
      category: 'conditioning',
      startedAt: T0 - DAY,
      finishedAt: T0 - DAY + 3_600_000,
      durationMin: 60.04,
      calories: 500,
      distanceKm: 20,
      note: 'ride',
    });
    expect(a.durationMin).toBe(60);
    expect(a.effort).toBe('moderate');
    store.editActivity(a.id, {
      startedAt: T0 - DAY,
      finishedAt: T0 - DAY + 1_800_000,
      durationMin: 30.06,
      effort: 'light',
      note: null,
    });
    const cur = st().activities[0];
    expect(cur).toMatchObject({
      durationMin: 30.1,
      effort: 'light',
      note: null,
      calories: null,
      distanceKm: null,
    });
    await settle();
    expect(at(`users/u1/activities/${a.id}`).length).toBe(2);
    store.deleteActivity(a.id);
    store.deleteActivity('missing');
    await settle();
    expect(fs.deletes).toEqual([`users/u1/activities/${a.id}`]);
  });

  it('activitiesOnDay and trainedDayKeys only count finished activities; the activities snapshot keeps the live one', async () => {
    const done = store.logActivity({
      type: 'Swim',
      category: 'conditioning',
      startedAt: T0,
      finishedAt: T0 + 1000,
      durationMin: 10,
    });
    expect(store.activitiesOnDay(store.dayKey(T0)).map((x) => x.id)).toEqual([done.id]);
    expect(store.activitiesOnDay(store.dayKey(T0) + 1)).toEqual([]);
    expect([...store.trainedDayKeys()]).toEqual([store.dayKey(T0)]);
    await settle();
    const sealed = at(`users/u1/activities/${done.id}`)[0].data;

    store.resetLocalData();
    const live = store.startActivity('Run', 'conditioning')!;
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/activities')!(snap([sealed]));
    await settle();
    expect(
      st()
        .activities.map((x) => x.id)
        .sort(),
    ).toEqual([done.id, live.id].sort());
    stop();
  });
});
