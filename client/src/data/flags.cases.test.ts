import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

type SnapCb = (snap: { exists: () => boolean; data: () => unknown }) => void;
type ErrCb = (e: unknown) => void;

const fs = vi.hoisted(() => ({
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
}));

vi.mock('firebase/firestore', () => ({
  doc: fs.doc,
  onSnapshot: fs.onSnapshot,
  setDoc: fs.setDoc,
}));
vi.mock('../firebase', () => ({ db: {} }));

async function load() {
  vi.resetModules();
  return import('./flags');
}

beforeEach(() => {
  localStorage.clear();
  fs.onSnapshot.mockReset();
  fs.setDoc.mockReset();
  fs.setDoc.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('device flags', () => {
  it('are off by default', async () => {
    const f = await load();
    expect(f.isFlagOn('nutrition')).toBe(false);
  });

  it('persist per flag in localStorage under gym.flags', async () => {
    const f = await load();
    f.setFlag('nutrition', true);
    expect(JSON.parse(localStorage.getItem('gym.flags')!)).toEqual({ nutrition: true });
    expect(f.isFlagOn('nutrition')).toBe(true);
    f.setFlag('nutrition', false);
    expect(f.isFlagOn('nutrition')).toBe(false);
    expect(JSON.parse(localStorage.getItem('gym.flags')!)).toEqual({ nutrition: false });
  });

  it('a stored non-true value (garbage) reads as off', async () => {
    localStorage.setItem('gym.flags', JSON.stringify({ nutrition: 'yes' }));
    const f = await load();
    expect(f.isFlagOn('nutrition')).toBe(false);
  });

  it('survives corrupted JSON in storage', async () => {
    localStorage.setItem('gym.flags', '{not json');
    const f = await load();
    expect(f.isFlagOn('nutrition')).toBe(false);
    f.setFlag('nutrition', true);
    expect(f.isFlagOn('nutrition')).toBe(true);
  });

  it('keeps working in memory-less fashion when storage throws', async () => {
    const f = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => f.setFlag('nutrition', true)).not.toThrow();
  });

  it('never touches Firestore for a device flag', async () => {
    const f = await load();
    f.setFlag('nutrition', true);
    expect(fs.setDoc).not.toHaveBeenCalled();
  });

  it('declares only device-scoped flags today', async () => {
    const f = await load();
    expect(f.FEATURE_FLAGS.map((x) => [x.id, x.scope])).toEqual([
      ['nutrition', 'device'],
    ]);
  });
});

describe('useFlag / useFlagsVersion', () => {
  it('useFlag reflects the stored value and re-renders on setFlag', async () => {
    const f = await load();
    const { result } = renderHook(() => f.useFlag('nutrition'));
    expect(result.current).toBe(false);
    act(() => f.setFlag('nutrition', true));
    expect(result.current).toBe(true);
    act(() => f.setFlag('nutrition', false));
    expect(result.current).toBe(false);
  });

  it('useFlag follows cross-tab changes via the storage event', async () => {
    const f = await load();
    const { result } = renderHook(() => f.useFlag('nutrition'));
    localStorage.setItem('gym.flags', JSON.stringify({ nutrition: true }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'gym.flags' }));
    });
    expect(result.current).toBe(true);
  });

  it('useFlag starts from the already stored value', async () => {
    localStorage.setItem('gym.flags', JSON.stringify({ nutrition: true }));
    const f = await load();
    expect(renderHook(() => f.useFlag('nutrition')).result.current).toBe(true);
  });

  it('useFlagsVersion bumps on every change and stops after unmount', async () => {
    const f = await load();
    const { result, unmount } = renderHook(() => f.useFlagsVersion());
    expect(result.current).toBe(0);
    act(() => f.setFlag('nutrition', true));
    act(() => f.setFlag('nutrition', true));
    expect(result.current).toBe(2);
    unmount();
    const removed = vi.spyOn(window, 'removeEventListener');
    expect(() => f.setFlag('nutrition', false)).not.toThrow();
    removed.mockRestore();
  });

  it('unmount removes the storage listener', async () => {
    const f = await load();
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => f.useFlag('nutrition'));
    unmount();
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

describe('startGlobalFlags', () => {
  it('subscribes to config/flags once even when started twice', async () => {
    const unsub = vi.fn();
    fs.onSnapshot.mockReturnValue(unsub);
    const f = await load();
    f.startGlobalFlags();
    f.startGlobalFlags();
    expect(fs.onSnapshot).toHaveBeenCalledTimes(1);
    expect(fs.doc.mock.calls.at(-1)!.slice(1)).toEqual(['config', 'flags']);
  });

  it('stopping unsubscribes and allows a fresh subscription', async () => {
    const unsub = vi.fn();
    fs.onSnapshot.mockReturnValue(unsub);
    const f = await load();
    f.startGlobalFlags()();
    expect(unsub).toHaveBeenCalledTimes(1);
    f.startGlobalFlags();
    expect(fs.onSnapshot).toHaveBeenCalledTimes(2);
  });

  it('snapshots only affect global-scoped flags and mirror to gym.flags.global', async () => {
    let onSnap!: SnapCb;
    fs.onSnapshot.mockImplementation((_ref: unknown, ok: SnapCb) => {
      onSnap = ok;
      return vi.fn();
    });
    const f = await load();
    const { result } = renderHook(() => f.useFlagsVersion());
    f.startGlobalFlags();
    act(() => {
      onSnap({ exists: () => true, data: () => ({ nutrition: true }) });
    });
    // the flag is device-scoped, so nothing is turned on globally
    expect(f.isFlagOn('nutrition')).toBe(false);
    expect(JSON.parse(localStorage.getItem('gym.flags.global')!)).toEqual({});
    expect(result.current).toBe(1);
  });

  it('a missing document clears the mirror; an error keeps it', async () => {
    let onSnap!: SnapCb;
    let onErr!: ErrCb;
    fs.onSnapshot.mockImplementation((_ref: unknown, ok: SnapCb, err: ErrCb) => {
      onSnap = ok;
      onErr = err;
      return vi.fn();
    });
    localStorage.setItem('gym.flags.global', JSON.stringify({ stale: true }));
    const f = await load();
    f.startGlobalFlags();
    expect(() => onErr(new Error('permission-denied'))).not.toThrow();
    expect(JSON.parse(localStorage.getItem('gym.flags.global')!)).toEqual({ stale: true });
    onSnap({ exists: () => false, data: () => undefined });
    expect(JSON.parse(localStorage.getItem('gym.flags.global')!)).toEqual({});
  });
});

describe('global flags (machinery, with a global flag injected)', () => {
  // No global flag is declared today; widen FEATURE_FLAGS in place to exercise the global branch.
  async function withGlobal() {
    const f = await load();
    (f.FEATURE_FLAGS as { id: string; scope: string }[]).push({
      id: 'nutrition',
      scope: 'global',
    });
    (f.FEATURE_FLAGS as { id: string; scope: string }[]).splice(0, 1);
    return f;
  }

  it('reads true only for a literal true in the snapshot', async () => {
    let onSnap!: SnapCb;
    fs.onSnapshot.mockImplementation((_ref: unknown, ok: SnapCb) => {
      onSnap = ok;
      return vi.fn();
    });
    const f = await withGlobal();
    f.startGlobalFlags();
    onSnap({ exists: () => true, data: () => ({ nutrition: 'true' }) });
    expect(f.isFlagOn('nutrition')).toBe(false);
    onSnap({ exists: () => true, data: () => ({ nutrition: true }) });
    expect(f.isFlagOn('nutrition')).toBe(true);
    expect(JSON.parse(localStorage.getItem('gym.flags.global')!)).toEqual({ nutrition: true });
  });

  it('paints from the mirrored value before Firestore answers', async () => {
    localStorage.setItem('gym.flags.global', JSON.stringify({ nutrition: true }));
    const f = await withGlobal();
    expect(f.isFlagOn('nutrition')).toBe(true);
  });

  it('setFlag is optimistic and merges into config/flags with a timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
    try {
      const f = await withGlobal();
      f.setFlag('nutrition', true);
      expect(f.isFlagOn('nutrition')).toBe(true);
      expect(fs.setDoc).toHaveBeenCalledWith(
        { path: 'config/flags' },
        { nutrition: true, updatedAt: Date.parse('2026-03-01T12:00:00Z') },
        { merge: true },
      );
      // device storage untouched
      expect(localStorage.getItem('gym.flags')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a rejected write only warns (the snapshot restores the truth)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const boom = new Error('permission-denied');
    fs.setDoc.mockRejectedValue(boom);
    const f = await withGlobal();
    f.setFlag('nutrition', true);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(warn.mock.calls[0][0]).toContain('config/flags.nutrition');
    expect(warn.mock.calls[0][1]).toBe(boom);
  });
});

describe('startGlobalFlags: a second call returns a working stop', () => {
  it('stop from the second call also clears the listener, so the next start subscribes again', async () => {
    const unsub = vi.fn();
    fs.onSnapshot.mockReturnValue(unsub);
    const f = await load();
    f.startGlobalFlags();
    const stop = f.startGlobalFlags();
    expect(fs.onSnapshot).toHaveBeenCalledTimes(1);
    stop();
    expect(unsub).toHaveBeenCalledTimes(1);
    f.startGlobalFlags();
    expect(fs.onSnapshot).toHaveBeenCalledTimes(2);
  });
});
