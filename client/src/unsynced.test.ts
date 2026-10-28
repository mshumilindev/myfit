import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSyncMeta } from './syncMeta';
import {
  drainUnsynced,
  registerFirestoreDrain,
  registerUnsynced,
  unsyncedCount,
  DRAIN_MS,
} from './unsynced';

// SPO-384: what has not reached the server yet is counted and waited for BEFORE sign-out wipes the device.
const TOMB = 'spotter.sleepTombstones.v1';
let outbox = 0;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setSyncMeta(0, false);
  outbox = 0;
  registerUnsynced('chat', { count: () => outbox });
  registerFirestoreDrain(null);
});
afterEach(() => vi.useRealTimers());

describe('unsyncedCount: every place a change can be waiting', () => {
  it('nothing waiting: 0', () => {
    expect(unsyncedCount()).toBe(0);
  });
  it('sums unconfirmed workouts, chat outbox messages and sleep deletes not yet confirmed', () => {
    setSyncMeta(2, false);
    outbox = 3;
    localStorage.setItem(TOMB, JSON.stringify(['a', 'b']));
    expect(unsyncedCount()).toBe(7);
  });
  it('an unreadable tombstone value counts as nothing (never throws)', () => {
    localStorage.setItem(TOMB, '{oops');
    expect(unsyncedCount()).toBe(0);
  });
});

describe('drainUnsynced', () => {
  it('nothing waiting: ok at once', async () => {
    await expect(drainUnsynced()).resolves.toEqual({ ok: true, remaining: 0 });
  });
  it('waits while a queue empties, then is ok', async () => {
    outbox = 2;
    const p = drainUnsynced();
    await vi.advanceTimersByTimeAsync(1000);
    outbox = 0;
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toEqual({ ok: true, remaining: 0 });
  });
  it('gives up after the limit and says how many are still waiting', async () => {
    outbox = 2;
    setSyncMeta(1, false);
    const p = drainUnsynced();
    await vi.advanceTimersByTimeAsync(DRAIN_MS + 100);
    await expect(p).resolves.toEqual({ ok: false, remaining: 3 });
  });
  it('waits for Firestore to confirm its writes', async () => {
    let done!: () => void;
    registerFirestoreDrain(() => new Promise<void>((r) => (done = r)));
    const p = drainUnsynced();
    await vi.advanceTimersByTimeAsync(1000);
    done();
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toEqual({ ok: true, remaining: 0 });
  });
  it('Firestore never confirming is NOT ok, even though no queue is counted (at least 1 is reported)', async () => {
    registerFirestoreDrain(() => new Promise<void>(() => undefined));
    const p = drainUnsynced();
    await vi.advanceTimersByTimeAsync(DRAIN_MS + 100);
    await expect(p).resolves.toEqual({ ok: false, remaining: 1 });
  });
  it('Firestore refusing (rejecting) is NOT ok', async () => {
    registerFirestoreDrain(() => Promise.reject(new Error('network')));
    const p = drainUnsynced();
    await vi.advanceTimersByTimeAsync(DRAIN_MS + 100);
    await expect(p).resolves.toMatchObject({ ok: false });
  });
});
