import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const listeners = new Map<string, (snap: unknown) => void>();
  return { writes, listeners, docs: new Map<string, Record<string, unknown>>(), failNext: false };
});

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => 'u1',
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => a,
    arrayRemove: (...a: unknown[]) => a,
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => void fs.docs.delete(r.path)),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      if (fs.failNext) {
        fs.failNext = false;
        throw new Error('offline');
      }
      fs.writes.push({ path: r.path, data });
      fs.docs.set(r.path, data);
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
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import { newSupplementEntry } from './supplements';
import type { CoachView } from './conditions';

const tick = () => new Promise((r) => setTimeout(r, 30));
const PATH = 'users/u1/meta/coachShare';
const stub = vault as unknown as import('./autoVault').Vault;
const shareWrites = () => fs.writes.filter((w) => w.path === PATH);

async function lastView(): Promise<CoachView> {
  const w = shareWrites().at(-1)!;
  expect(isSealed(w.data)).toBe(true);
  const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
  return plain.view;
}

const DAY = 7 * 24 * 3600 * 1000;

describe('supplements in the sealed coach share', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteSupplementData();
    store.setSupplementSharing('off');
    stop = store.startSyncLoop();
    await tick();
    store.saveSupplementEntry(newSupplementEntry('creatine', 'e-c', Date.now() - 10 * DAY));
    store.saveSupplementEntry({
      ...newSupplementEntry('preWorkout', 'e-p', Date.now() - 10 * DAY),
      schedule: 'daily',
    });
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => {
    stop();
    store.deleteSupplementData();
  });

  it('Off (the default) never carries supplements', async () => {
    store.saveSupplementEntry(newSupplementEntry('whey', 'e-w'));
    store.setSupplementUseInCalculations(false);
    await tick();
    for (const w of shareWrites()) {
      const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
      expect(plain.view.supplements).toBeUndefined();
    }
  });

  it('Effects publishes only ranges: no names, no doses; sealed on the wire', async () => {
    store.setSupplementSharing('effects');
    await tick();
    const v = await lastView();
    expect(v.supplements!.mode).toBe('effects');
    expect(v.supplements!.full).toBeUndefined();
    expect(v.supplements!.effects.length).toBeGreaterThan(0);
    expect(JSON.stringify(v.supplements)).not.toMatch(
      /creatine|preWorkout|itemId|dose|schedule|timing|entries|startedAt/i,
    );
    for (const w of shareWrites())
      expect(JSON.stringify(w.data)).not.toMatch(/creatine|preWorkout|supplement/i);
  });

  it('Full adds names, doses, schedules, timings and totals', async () => {
    store.setSupplementSharing('full');
    await tick();
    const v = await lastView();
    expect(v.supplements!.mode).toBe('full');
    const items = v.supplements!.full!.items;
    expect(items.map((i) => i.itemId).sort()).toEqual(['creatine', 'preWorkout']);
    expect(items[0]).toHaveProperty('dose');
    expect(items[0]).toHaveProperty('schedule');
    expect(items[0]).toHaveProperty('timing');
    expect(v.supplements!.full!.caffeineMgPerDay).toBeGreaterThan(0);
    for (const w of shareWrites())
      expect(JSON.stringify(w.data)).not.toMatch(/creatine|preWorkout/i);
  });

  it('a change republishes; Off or deleting the data removes it', async () => {
    store.setSupplementSharing('full');
    await tick();
    store.saveSupplementEntry(newSupplementEntry('whey', 'e-w'));
    await tick();
    expect((await lastView()).supplements!.full!.items.map((i) => i.itemId)).toContain('whey');
    store.setSupplementSharing('off');
    await tick();
    expect((await lastView()).supplements).toBeUndefined();
    store.setSupplementSharing('full');
    await tick();
    store.deleteSupplementData();
    await tick();
    expect((await lastView()).supplements).toBeUndefined();
  });

  it('check-ins never reach the coach: no days, no answers', async () => {
    store.setSupplementSharing('full');
    store.answerSupplementDay('2026-10-02', { kind: 'all' });
    await tick();
    const v = await lastView();
    expect(JSON.stringify(v.supplements)).not.toMatch(/checkin|taken|2026-10|checkinsOn/i);
    for (const w of shareWrites()) expect(JSON.stringify(w.data)).not.toMatch(/2026-10|taken/);
  });
});
