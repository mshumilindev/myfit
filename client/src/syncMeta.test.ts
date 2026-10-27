import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuerySnapshot } from 'firebase/firestore';
import { getSyncMeta, setSyncMeta, snapMeta, subscribeSyncMeta, syncStatusOf } from './syncMeta';

afterEach(() => setSyncMeta(0, false));

describe('syncMeta', () => {
  it('syncStatusOf: pending goes out online and waits offline; cached offline reads offline', () => {
    expect(syncStatusOf(true, false, true)).toBe('pending');
    expect(syncStatusOf(true, true, false)).toBe('offline');
    expect(syncStatusOf(false, true, false)).toBe('offline');
    expect(syncStatusOf(false, true, true)).toBe('synced');
    expect(syncStatusOf(false, false, false)).toBe('synced');
  });

  it('snapMeta counts only documents with unconfirmed writes', () => {
    const doc = (p: boolean) => ({ metadata: { hasPendingWrites: p } });
    const snap = {
      metadata: { fromCache: true, hasPendingWrites: true },
      docs: [doc(true), doc(false), doc(true)],
    } as unknown as QuerySnapshot;
    expect(snapMeta(snap)).toEqual({ fromCache: true, pending: true, pendingCount: 2 });
  });

  it('setSyncMeta stores the count and the locked flag, and notifies only on a real change', () => {
    const cb = vi.fn();
    const off = subscribeSyncMeta(cb);
    setSyncMeta(3, 2);
    expect(getSyncMeta()).toEqual({ pendingWrites: 3, dataLocked: true });
    setSyncMeta(3, true);
    expect(cb).toHaveBeenCalledTimes(1);
    setSyncMeta(0, 0);
    expect(getSyncMeta()).toEqual({ pendingWrites: 0, dataLocked: false });
    off();
    setSyncMeta(1, false);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
