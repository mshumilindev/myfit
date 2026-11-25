/** Typed maxes sync: a write builds on what is stored, and a failed write is not shown as saved. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  stored: null as null | Record<string, unknown>,
  writes: [] as Record<string, unknown>[],
  failSet: false,
  getFails: false,
  snap: null as null | ((s: unknown) => void),
}));

vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
vi.mock('firebase/firestore', () => ({
  doc: (_d: unknown, ...p: string[]) => ({ path: p.join('/') }),
  getDoc: vi.fn(async () => {
    if (fs.getFails) throw new Error('offline');
    return { exists: () => fs.stored !== null, data: () => fs.stored };
  }),
  setDoc: vi.fn(async (_r: unknown, data: Record<string, unknown>) => {
    if (fs.failSet) throw new Error('denied');
    fs.writes.push(data);
  }),
  onSnapshot: (_r: unknown, cb: (s: unknown) => void) => {
    fs.snap = cb;
    return () => undefined;
  },
}));
// The vault is covered by maxesData.test.ts: here the "sealed" form is the document itself.
vi.mock('./maxesData', async (orig) => ({
  ...(await orig<typeof import('./maxesData')>()),
  sealMaxes: async (d: Record<string, unknown>, now: number) => ({ ...d, updatedAt: now }),
  openMaxes: async (raw: Record<string, unknown>) => raw,
}));

import { EMPTY_MAXES } from './maxesData';
import { clearMax, getTypedMaxes, saveMax, seedMaxes, startMaxesSync } from './maxesSync';

const stored = {
  updatedAt: 5,
  maxes: { squat: { name: 'Squat', kg: 150, at: 5 } },
};

beforeEach(() => {
  fs.stored = null;
  fs.writes = [];
  fs.failSet = false;
  fs.getFails = false;
  startMaxesSync('u1')(); // resets the store and the loaded flag
  seedMaxes(EMPTY_MAXES);
  startMaxesSync('u1')();
});

describe('typed maxes writes', () => {
  it('a save before the first snapshot keeps the maxes that are already stored', async () => {
    fs.stored = stored;
    await saveMax('Bench', 100);
    expect(Object.keys(getTypedMaxes().maxes).sort()).toEqual(['bench', 'squat']);
    expect(Object.keys((fs.writes[0] as typeof stored).maxes).sort()).toEqual(['bench', 'squat']);
  });
  it('a clear also builds on the stored document', async () => {
    fs.stored = stored;
    await clearMax('Squat');
    expect(getTypedMaxes().maxes).toEqual({});
    expect(fs.writes).toHaveLength(1);
  });
  it('offline with nothing cached: writes on what is here and does not throw', async () => {
    fs.getFails = true;
    await saveMax('Bench', 100);
    expect(Object.keys(getTypedMaxes().maxes)).toEqual(['bench']);
    expect(fs.writes).toHaveLength(1);
  });
  it('a rejected write is rolled back in the store and rethrown', async () => {
    fs.failSet = true;
    await expect(saveMax('Bench', 100)).rejects.toThrow('denied');
    expect(getTypedMaxes().maxes).toEqual({});
  });
  it('an unusable input writes nothing', async () => {
    await saveMax('Bench', -5);
    expect(fs.writes).toHaveLength(0);
  });
  it('a snapshot of another device fills the store', async () => {
    fs.snap?.({ exists: () => true, data: () => stored });
    await vi.waitFor(() => expect(getTypedMaxes().maxes.squat?.kg).toBe(150));
  });
});
