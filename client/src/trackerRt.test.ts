import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTrackerReady, loadTracker, onTrackerReady, trackerReady } from './trackerRt';

describe('trackerRt readiness', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records readiness and notifies listeners', () => {
    const seen: string[] = [];
    const off = onTrackerReady((id) => seen.push(id));
    expect(isTrackerReady('zz')).toBe(false);
    trackerReady('zz');
    expect(isTrackerReady('zz')).toBe(true);
    expect(seen).toEqual(['zz']);
    off();
  });

  it('loadTracker logs a failed import and retries once when back online', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const importer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
    loadTracker('t', importer);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));
    expect(importer).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
