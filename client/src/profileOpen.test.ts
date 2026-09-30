// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));
import { createVault, type VaultHeader } from './vault';
import { ensureCoachKey, ensureGrant, type GrantPorts, type StoredGrant } from './vaultGrants';
import type { CoachKeyRecord } from './vaultShare';
import { sealDoc } from './encryptedDoc';
import {
  deriveGyms,
  deriveSessions,
  deriveTopExercises,
  openProfile,
  type DeriveDeps,
} from './profileOpen';
import type { Exercise, Gym, Workout } from './types';

const deps: DeriveDeps = {
  exerciseVolumeKg: (e) => e.sets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0),
  workoutVolumeKg: (w) =>
    w.exercises.reduce(
      (v, e) => v + e.sets.reduce((x, s) => x + (s.weight ?? 0) * (s.reps ?? 0), 0),
      0,
    ),
};
const set = (weight: number, reps: number, extra = {}) =>
  ({ id: 's', weight, reps, isWarmup: false, position: 0, ...extra }) as Exercise['sets'][number];
const ex = (name: string, sets: Exercise['sets'], extra = {}) =>
  ({ id: name, name, kind: 'strength', position: 0, sets, ...extra }) as unknown as Exercise;
const wk = (id: string, startedAt: number, exercises: Exercise[], extra = {}) =>
  ({ id, startedAt, finishedAt: startedAt + 3_600_000, exercises, ...extra }) as unknown as Workout;
const gym = (id: string, name: string) =>
  ({ id, name, lat: 1, lng: 2, radiusM: 50, favorite: false }) as unknown as Gym;

async function vaultOf() {
  let h: VaultHeader | null = null;
  let c: { key: CryptoKey; salt: string } | null = null;
  const v = createVault({
    remote: { load: async () => h, save: async (x) => void (h = x) },
    cache: {
      get: async () => c,
      set: async (x) => void (c = x),
      clear: async () => void (c = null),
    },
  });
  await v.init();
  await v.create();
  return v;
}

describe('derive', () => {
  const ws = [
    wk('w2', 2000, [ex('Bench Press', [set(100, 5), set(100, 5)])], {
      gymId: 'g1',
      dayName: 'Push',
    }),
    wk('w1', 1000, [ex('Bench Press', [set(90, 8)]), ex('Row', [set(60, 10)])], { gymId: 'g1' }),
  ];
  it('sessions carry names, gym and day', () => {
    const s = deriveSessions(ws, [gym('g1', 'Home')], deps);
    expect(s[0]).toMatchObject({
      id: 'w2',
      gymName: 'Home',
      dayName: 'Push',
      sets: 2,
      volumeKg: 1000,
    });
    expect(s[1].exerciseNames).toEqual(['Bench Press', 'Row']);
  });
  it('gyms and top exercises aggregate', () => {
    expect(deriveGyms(ws, [gym('g1', 'Home')], deps)[0]).toMatchObject({
      sessions: 2,
      name: 'Home',
    });
    const top = deriveTopExercises(ws, deps);
    expect(top[0].name).toBe('Bench Press');
    expect(top[0].sessions).toBe(2);
    expect(top[0].bestE1rm).toBeCloseTo(100 * (1 + 5 / 30));
  });
});

describe('openProfile', () => {
  it('a coach with a grant sees decrypted history and rebuilt summaries', async () => {
    const athlete = await vaultOf();
    const coach = await vaultOf();
    const own = new Map<string, CoachKeyRecord>();
    const pubs = new Map<string, JsonWebKey>();
    const grants = new Map<string, StoredGrant>();
    const ports = (me: string): GrantPorts => ({
      loadOwnCoachKey: async () => own.get(me) ?? null,
      saveOwnCoachKey: async (r) => void own.set(me, r),
      publishCoachPub: async (p) => void pubs.set(me, p),
      loadCoachPub: async (id) => pubs.get(id) ?? null,
      loadGrant: async (id) => grants.get(id) ?? null,
      saveGrant: async (id, g) => void grants.set(id, g),
      listGrantIds: async () => [...grants.keys()],
      deleteGrant: async (id) => void grants.delete(id),
    });
    await ensureCoachKey(coach, ports('c'));
    await ensureGrant(athlete, 'c', ports('a'));

    const { key, salt } = athlete.material();
    const w = wk('w1', 1000, [ex('Squat', [set(140, 5)])], { gymId: 'g1', dayName: 'Legs' });
    const sealedW = await sealDoc(
      'workouts',
      { ...w, updatedAt: 1, stats: { volumeKg: 700, sets: 1 } },
      key,
      salt,
    );
    const sealedG = await sealDoc('gyms', { ...gym('g1', 'Iron Temple'), updatedAt: 1 }, key, salt);
    const payload = {
      grant: grants.get('c'),
      history: { workouts: [sealedW], activities: [], sleeps: [], restPeriods: [] },
      sealedGyms: [sealedG],
      gyms: [],
      summary: { sessions: 1 },
    };
    expect(JSON.stringify(payload)).not.toContain('Squat');

    const out = (await openProfile(payload, coach, ports('c'), deps)) as typeof payload & {
      sessions: { gymName: string; dayName: string }[];
      topExercises: { name: string }[];
    };
    expect(out.history!.workouts![0]).toMatchObject({ id: 'w1' });
    expect((out.sessions as { gymName: string; dayName: string }[])[0]).toMatchObject({
      gymName: 'Iron Temple',
      dayName: 'Legs',
    });
    expect((out.topExercises as { name: string }[])[0].name).toBe('Squat');
    expect((out.gyms as { name: string }[])[0].name).toBe('Iron Temple');
    expect(out.summary).toMatchObject({ sessions: 1, exercises: 1 });
  });

  it('self: opens with the own vault key, no grant needed', async () => {
    const me = await vaultOf();
    const { key, salt } = me.material();
    const sealedW = await sealDoc(
      'workouts',
      { ...wk('w1', 1000, [ex('Deadlift', [set(180, 3)])]), updatedAt: 1 },
      key,
      salt,
    );
    const out = (await openProfile(
      {
        viewer: { relation: 'self' },
        history: { workouts: [sealedW] },
        sealedGyms: [],
        summary: {},
      },
      me,
      { loadOwnCoachKey: async () => null },
      deps,
    )) as unknown as { topExercises: { name: string }[] };
    expect(out.topExercises[0].name).toBe('Deadlift');
  });

  it('no grant or locked vault: unchanged', async () => {
    const coach = await vaultOf();
    const p = { history: { workouts: [{ id: 'x' }] } };
    expect(await openProfile(p, coach, { loadOwnCoachKey: async () => null }, deps)).toBe(p);
    const q = { grant: { v: 1 }, history: { workouts: [{ id: 'x' }] } };
    expect(await openProfile(q, coach, { loadOwnCoachKey: async () => null }, deps)).toBe(q);
  });
});
