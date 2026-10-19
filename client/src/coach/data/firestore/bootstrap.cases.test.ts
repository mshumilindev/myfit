import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  state: {
    gyms: [] as unknown[],
    workouts: [] as unknown[],
    activities: undefined as unknown[] | undefined,
  },
  installs: [] as { role: string; deps: Record<string, unknown>; stop: ReturnType<typeof vi.fn> }[],
  legacy: [] as boolean[],
  keyExchange: vi.fn(async () => undefined),
  signStop: vi.fn(),
  startFail: false,
}));

vi.mock('./firebaseFs', async () => {
  const { createMemoryFs } = await import('./memoryFs');
  return { createFirebaseFs: () => createMemoryFs() };
});
vi.mock('./install', () => ({
  installFirestoreCoach: (deps: Record<string, unknown>) => {
    if (h.startFail) throw new Error('install failed');
    const stop = vi.fn();
    h.installs.push({ role: 'trainer', deps, stop });
    return stop;
  },
  installFirestoreClient: (deps: Record<string, unknown>) => {
    const stop = vi.fn();
    h.installs.push({ role: 'client', deps, stop });
    return stop;
  },
}));
vi.mock('./coachKeySigned', () => ({ keepCoachKeySigned: () => h.signStop }));
vi.mock('./signerStore', () => ({ createDeviceSigner: () => async () => null }));
vi.mock('../../../vaultIO', () => ({
  vault: { tag: 'vault' },
  loadOwnCoachKey: async () => null,
  runKeyExchange: h.keyExchange,
}));
vi.mock('../../../store', () => ({
  getStoreState: () => h.state,
  subscribeStore: () => () => undefined,
  setLegacyLiveWriter: (on: boolean) => void h.legacy.push(on),
}));

import { hasGymSource, scheduleGyms } from '../../schedule/types';
import { acquireBackend } from './bootstrap';

const gym = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Gym ${id}`,
  ...extra,
});

beforeEach(() => {
  h.installs.length = 0;
  h.legacy.length = 0;
  h.startFail = false;
  h.state.gyms = [];
  h.state.workouts = [];
  h.state.activities = undefined;
  h.keyExchange.mockClear();
  h.signStop.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('acquireBackend', () => {
  it('a signed-out user installs nothing and gets a harmless release function', async () => {
    const release = await acquireBackend('trainer', { id: null, name: '' });
    expect(h.installs).toHaveLength(0);
    expect(() => release()).not.toThrow();
  });

  it('trainer: installs once for any number of screens, offers only the trainer own gyms, tears down on the last release', async () => {
    h.state.gyms = [
      gym('g1', { lat: 50.4, lng: 30.5 }),
      gym('g2', { lat: NaN, lng: 1 }),
      gym('g3'),
    ];
    const [r1, r2] = await Promise.all([
      acquireBackend('trainer', { id: 'tr1', name: 'Iryna' }),
      acquireBackend('trainer', { id: 'tr1', name: 'Iryna' }),
    ]);
    expect(h.installs.filter((i) => i.role === 'trainer')).toHaveLength(1);
    const deps = h.installs[0].deps as {
      trainer: unknown;
      gyms: () => { id: string; shareable: boolean }[];
    };
    expect(deps.trainer).toEqual({ id: 'tr1', name: 'Iryna' });
    // the gyms handed to the share cards: no equipment of others, `shareable` only with an external id
    h.state.gyms = [gym('g1', { equipmentItems: ['a', 'b'], externalId: 'x' }), gym('g2')];
    expect(deps.gyms().map((g) => [g.id, g.shareable])).toEqual([
      ['g1', true],
      ['g2', false],
    ]);
    // the schedule offers the trainer's own gyms with a place only when both coordinates are numbers
    expect(hasGymSource()).toBe(true);
    h.state.gyms = [gym('g1', { lat: 50.4, lng: 30.5 }), gym('g2', { lat: NaN, lng: 1 })];
    expect(scheduleGyms()).toEqual([
      { id: 'g1', name: 'Gym g1', short: 'Gym g1', place: { lat: 50.4, lng: 30.5 } },
      { id: 'g2', name: 'Gym g2', short: 'Gym g2', place: undefined },
    ]);
    r1();
    r1(); // a second call of the same release does not count twice
    expect(h.installs[0].stop).not.toHaveBeenCalled();
    r2();
    expect(h.installs[0].stop).toHaveBeenCalledTimes(1);
    expect(h.signStop).toHaveBeenCalledTimes(1);
    expect(hasGymSource()).toBe(false);
    // after the last release the next screen installs again
    const r3 = await acquireBackend('trainer', { id: 'tr1', name: 'Iryna' });
    expect(h.installs.filter((i) => i.role === 'trainer')).toHaveLength(2);
    r3();
  });

  it('the same user as client and as trainer are two installs; another user is not served by this one', async () => {
    const a = await acquireBackend('client', { id: 'u1', name: 'A' });
    const b = await acquireBackend('trainer', { id: 'u1', name: 'A' });
    const c = await acquireBackend('client', { id: 'u2', name: 'B' });
    expect(h.installs.map((i) => i.role)).toEqual(['client', 'trainer', 'client']);
    a();
    b();
    c();
    expect(h.installs.every((i) => i.stop.mock.calls.length === 1)).toBe(true);
  });

  it('client: only finished workouts reach the share cards, the Live writer also sees the open one, the legacy writer yields', async () => {
    const done = { id: 'w1', finishedAt: 5, exercises: [] };
    const open = { id: 'w2', finishedAt: null, exercises: [{ id: 'e' }] };
    const emptyOpen = { id: 'w3', finishedAt: null, exercises: [] };
    const noExercises = { id: 'w4', finishedAt: undefined };
    h.state.workouts = [done, open, emptyOpen, noExercises];
    const release = await acquireBackend('client', { id: 'u1', name: 'Oleh' });
    const deps = h.installs[0].deps as {
      uid: string;
      name: () => string;
      workouts: () => unknown[];
      liveWorkouts: () => unknown[];
      activities: () => unknown[];
      afterLink: (t: string | null) => Promise<void>;
      gyms: () => unknown[];
    };
    expect(deps.uid).toBe('u1');
    expect(deps.name()).toBe('Oleh');
    expect(deps.workouts()).toEqual([done]);
    expect(deps.liveWorkouts()).toEqual([done, open]);
    expect(deps.activities()).toEqual([]);
    h.state.activities = [{ id: 'a1' }];
    expect(deps.activities()).toEqual([{ id: 'a1' }]);
    expect(deps.gyms()).toEqual([]);
    await deps.afterLink('tr1');
    // the key exchange runs as a client (isCoach = false), never as the coach
    expect(h.keyExchange).toHaveBeenCalledWith('tr1', false);
    expect(h.legacy).toEqual([false]);
    release();
    expect(h.legacy).toEqual([false, true]);
    expect(h.installs[0].stop).toHaveBeenCalledTimes(1);
  });

  it('a failed install is forgotten: the error reaches the caller and a retry installs again', async () => {
    h.startFail = true;
    await expect(acquireBackend('trainer', { id: 'tr9', name: 'X' })).rejects.toThrow(
      'install failed',
    );
    await Promise.resolve();
    h.startFail = false;
    const r = await acquireBackend('trainer', { id: 'tr9', name: 'X' });
    expect(h.installs.filter((i) => i.role === 'trainer')).toHaveLength(1);
    r();
  });
});
