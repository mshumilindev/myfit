/**
 * Delta reads end to end: the REAL server (`coachRead` with `changedSince`) on the shared store, the REAL world port of the
 * trainer device with a delta cache, against the ordinary world port of the same trainer without one. After every kind of
 * change the delta world must deep-equal the full-read world, or the port must have fallen back to a full read.
 */
import { describe, expect, it } from 'vitest';
import { sealDoc } from '../../../encryptedDoc';
import { createFirestoreWorldPort } from './worldPort';
import type { FsApi, Raw } from './fsApi';
import type { SnapshotCache } from './snapshotCache';
import { INVALID_ENTRY, type DeltaEntry } from './deltaSync';
import { C, NOW } from './parity/harness';
import { linkUp, settle } from './parity/flow';

const HOUR = 3_600_000;
const ac = () => ({ signal: new AbortController().signal });

const workout = (id: string, startedAt: number, updatedAt: number | undefined, weight = 100) => ({
  id,
  startedAt,
  finishedAt: startedAt + HOUR,
  autoFinished: false,
  gymId: null,
  dayName: 'Lower A',
  targetMuscles: [],
  kind: null,
  homeSetId: null,
  ...(updatedAt === undefined ? {} : { updatedAt }),
  stats: { volumeKg: weight * 5, sets: 1 },
  exercises: [
    {
      id: 'e1',
      name: 'Barbell Squat',
      kind: 'strength',
      position: 0,
      primaryMuscle: 'quads',
      secondaryMuscles: [],
      measure: 'reps',
      sets: [{ id: `s-${id}`, position: 0, reps: 5, weight, isWarmup: false, type: 'working' }],
    },
  ],
});

interface Seen {
  name: string;
  data: Raw;
  res: { results: Record<string, { delta?: boolean; docs?: Raw[]; level?: string }> };
}

async function setup(consent = { totals: 'full', sets: 'full' } as const) {
  const w = await linkUp({ ...consent });
  const seen: Seen[] = [];
  const spy: FsApi = {
    ...w.tr.fs,
    call: async <X>(name: string, data: Raw) => {
      const res = await w.tr.fs.call<X>(name, data);
      if (name === 'coachRead') seen.push({ name, data, res: res as never });
      return res;
    },
  };
  const store = new Map<string, DeltaEntry>();
  const cache = (id: string): SnapshotCache<DeltaEntry> => ({
    get: async () =>
      store.has(id) ? { value: structuredClone(store.get(id)!), savedAt: 0 } : null,
    set: async (v) => void store.set(id, structuredClone(v)),
  });
  const deltaWorld = createFirestoreWorldPort({
    fs: spy,
    vault: w.tr.vault,
    trainer: { id: 'trainer-1', name: 'Iryna Melnyk' },
    loadOwnCoachKey: async () => w.tr.rec,
    deltaCache: cache,
    schedule: async () => null,
  });
  const plainWorld = createFirestoreWorldPort({
    fs: w.tr.fs,
    vault: w.tr.vault,
    trainer: { id: 'trainer-1', name: 'Iryna Melnyk' },
    loadOwnCoachKey: async () => w.tr.rec,
    schedule: async () => null,
  });
  let at = NOW;
  const put = async (wk: ReturnType<typeof workout>) => {
    const m = w.cl.vault.materialOrNull()!;
    await w.cl.fs.set(
      `users/${C}/workouts/${wk.id}`,
      (await sealDoc('workouts', wk as never, m.key, m.salt)) as never,
    );
  };
  const tick = (ms: number) => w.s.fs.setNow((at += ms));
  /** both worlds read now; returns the delta world's calls of this load */
  const compare = async () => {
    seen.length = 0;
    const d = await deltaWorld.load(ac());
    await settle(10); // the cache write is not awaited
    const calls = [...seen];
    const p = await plainWorld.load(ac());
    expect(d).toEqual(p);
    return { data: d, calls, store };
  };
  return { w, at: () => at, put, tick, compare, store, seen, deltaWorld };
}

const first = (c: Seen[]) => c[0];

describe('delta reads: the world equals the full-read world after every kind of change', () => {
  it('first read primes (full via changedSince 0); no change; add; update; each equals a full read', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 3 * 86_400_000, NOW - 3 * 86_400_000 + 5, 80));
    await t.put(workout('w2', NOW - 2 * 86_400_000, NOW - 2 * 86_400_000 + 5, 90));
    await t.put(workout('w3', NOW - 86_400_000, NOW - 86_400_000 + 5, 100));

    let r = await t.compare();
    expect(first(r.calls).data.changedSince).toBe(0);
    expect(first(r.calls).res.results.sets.delta).toBe(true);
    expect(r.calls).toHaveLength(1);
    expect(r.data.history?.[C]).toBeDefined();

    t.tick(10 * 60_000); // nothing changed
    r = await t.compare();
    expect(first(r.calls).data.changedSince).toBeGreaterThan(0);
    expect(first(r.calls).res.results.sets).toMatchObject({ delta: true });
    expect(first(r.calls).res.results.sets.docs).toHaveLength(0);
    expect(r.calls).toHaveLength(1);

    t.tick(10 * 60_000); // added
    await t.put(workout('w4', NOW + 1000, t.at(), 110));
    r = await t.compare();
    expect(first(r.calls).res.results.sets.docs!.map((x) => x.id)).toEqual(['w4']);
    expect(r.calls).toHaveLength(1);

    t.tick(10 * 60_000); // updated (heavier set, updatedAt bumped)
    await t.put(workout('w2', NOW - 2 * 86_400_000, t.at(), 120));
    r = await t.compare();
    // w4 is sent again too: the 1 h margin overlaps the previous read, harmless (upsert by id)
    expect(
      first(r.calls)
        .res.results.sets.docs!.map((x) => x.id)
        .sort(),
    ).toEqual(['w2', 'w4']);
    expect(r.calls).toHaveLength(1);
    expect(JSON.stringify(r.data.history)).toContain('120');
  });

  it('a deleted workout is caught by the count: delta answer discarded, a plain full read follows, still equal', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 3 * 86_400_000, NOW - 5));
    await t.put(workout('w2', NOW - 2 * 86_400_000, NOW - 4));
    await t.compare();
    t.tick(10 * 60_000);
    await t.w.cl.fs.del(`users/${C}/workouts/w1`);
    const r = await t.compare();
    expect(r.calls).toHaveLength(2);
    expect(r.calls[0].data.changedSince).toBeGreaterThan(0);
    expect(r.calls[1].data).not.toHaveProperty('changedSince');
    expect(r.calls[1].data.categories).toEqual(expect.arrayContaining(['totals', 'sets']));
    // the cache was dropped: the next read primes again with a full delta (changedSince 0), then incremental again
    t.tick(60_000);
    const r2 = await t.compare();
    expect(r2.calls[0].data.changedSince).toBe(0);
    t.tick(60_000);
    const r3 = await t.compare();
    expect(r3.calls[0].data.changedSince).toBeGreaterThan(0);
    expect(r3.calls).toHaveLength(1);
  });

  it('a deletion together with an addition is caught as well', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 3 * 86_400_000, NOW - 5));
    await t.put(workout('w2', NOW - 2 * 86_400_000, NOW - 4));
    await t.compare();
    t.tick(10 * 60_000);
    await t.w.cl.fs.del(`users/${C}/workouts/w1`);
    await t.put(workout('w3', NOW + 5, t.at()));
    const r = await t.compare();
    expect(r.calls).toHaveLength(2); // delta + the full read it fell back to
  });

  it('an older updatedAt that arrives after our read (offline device) is caught by the sum, not skipped', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 3 * 86_400_000, NOW - 5, 80));
    await t.compare();
    t.tick(5 * 3_600_000);
    // edited offline 4 h before the last read, synced only now: updatedAt is older than changedSince but newer than before
    await t.put(workout('w1', NOW - 3 * 86_400_000, NOW - 2 * 3_600_000, 130));
    const r = await t.compare();
    expect(r.calls).toHaveLength(2);
    expect(JSON.stringify(r.data.history)).toContain('130');
  });

  it('a consent change (grant version) forces a full read', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5));
    await t.compare();
    t.tick(60_000);
    await t.w.cl.fs.call('setConsent', { category: 'sets', level: 'effects' });
    await t.w.cl.fs.call('setConsent', { category: 'sets', level: 'full' });
    t.tick(60_000);
    const r = await t.compare();
    expect(r.calls[0].data.changedSince).toBe(0);
  });

  it('a full read is forced once the last full read is 24 h old', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5));
    await t.compare();
    t.tick(23 * HOUR);
    expect((await t.compare()).calls[0].data.changedSince).toBeGreaterThan(0);
    t.tick(2 * HOUR);
    expect((await t.compare()).calls[0].data.changedSince).toBe(0);
  });

  it('a legacy workout without updatedAt: the server answers delta:false, the plain answer is used, nothing is cached', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5));
    await t.put(workout('old', NOW - 9 * 86_400_000, undefined));
    for (let i = 0; i < 2; i++) {
      t.tick(60_000);
      const r = await t.compare();
      expect(r.calls).toHaveLength(1);
      expect(r.calls[0].res.results.sets.delta).toBe(false);
      expect(r.calls[0].res.results.sets.docs).toHaveLength(2);
      expect(r.store.values().next().value).toEqual(INVALID_ENTRY);
    }
  });

  it('effects consent: no delta (the small view is always sent whole) and still equal', async () => {
    const t = await setup({ totals: 'effects', sets: 'effects' } as never);
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5));
    const r = await t.compare();
    expect(r.calls[0].data).not.toHaveProperty('changedSince');
  });

  it('documented limit: an edit that does not move updatedAt is only picked up by the daily full read', async () => {
    const t = await setup();
    t.tick(HOUR);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5, 80));
    await t.compare();
    t.tick(60_000);
    await t.put(workout('w1', NOW - 86_400_000, NOW - 5, 140)); // same updatedAt
    const d = await t.deltaWorld.load(ac());
    expect(JSON.stringify(d.history)).not.toContain('140');
    t.tick(25 * HOUR);
    const r = await t.compare();
    expect(JSON.stringify(r.data.history)).toContain('140');
  });
});
