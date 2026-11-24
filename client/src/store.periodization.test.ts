import { addonsPref } from './addons/enabledSet';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { setProgramMemory } from './data/programMemory';
import { periodizationHost } from './periodizationApi';
import { activeWeekPlan } from './periodization/cycle';

afterEach(() => {
  addonsPref.reset();
  periodizationHost.weekPlan = null;
  setProgramMemory(null);
});

const plan = (week: number) =>
  ({
    week,
    program: {
      dayNames: { '1': 'Squat' },
      targetMuscles: {},
      items: [{ day: 1 }],
      cycle: {
        length: 2,
        weeks: [
          { dayNames: { '3': 'Light' }, targetMuscles: { '3': ['chest'] }, items: [{ day: 5 }] },
        ],
      },
    },
  }) as never;

describe('what the assigned program prescribes in a cycle week', () => {
  it('module on: the days of the current cycle week', () => {
    addonsPref.set(['periodization']);
    periodizationHost.weekPlan = activeWeekPlan as never;
    setProgramMemory(plan(2));
    expect([...store.prescribedTrainingDays()].sort()).toEqual([3, 5]);
    expect(store.programDayNameForWeekday(3)).toBe('Light');
    expect(store.programDayNameForWeekday(1)).toBeNull();
    setProgramMemory(plan(3)); // week 3 is cycle week 1 again
    expect([...store.prescribedTrainingDays()]).toEqual([1]);
    expect(store.programDayNameForWeekday(1)).toBe('Squat');
  });
  it('module off: always the program\u2019s own week', () => {
    setProgramMemory(plan(2));
    expect([...store.prescribedTrainingDays()]).toEqual([1]);
    expect(store.programDayNameForWeekday(1)).toBe('Squat');
    expect(store.programDayNameForWeekday(3)).toBeNull();
  });
});
