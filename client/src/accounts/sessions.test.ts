import { afterEach, describe, expect, it, vi } from 'vitest';

const callFn = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ callFn }));

import { checkSession, placeText, relativeTime, sessionDeviceId, watchSession } from './sessions';

afterEach(() => {
  callFn.mockReset();
  vi.useRealTimers();
});

describe('sessions client', () => {
  it('keeps one device id in the shared device key', () => {
    localStorage.removeItem('spotter.pushDevice');
    const a = sessionDeviceId();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(sessionDeviceId()).toBe(a);
    expect(localStorage.getItem('spotter.pushDevice')).toBe(a);
  });

  it('a failed check never signs anyone out', async () => {
    callFn.mockRejectedValueOnce(new Error('offline'));
    expect(await checkSession()).toBe(true);
  });

  it('a revoked answer ends the session once', async () => {
    callFn.mockResolvedValue({ active: false });
    const onRevoked = vi.fn();
    const stop = watchSession(onRevoked);
    await vi.waitFor(() => expect(onRevoked).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onRevoked).toHaveBeenCalledTimes(1);
    stop();
  });

  it('an active answer does nothing', async () => {
    callFn.mockResolvedValue({ active: true });
    const onRevoked = vi.fn();
    const stop = watchSession(onRevoked);
    await vi.waitFor(() => expect(callFn).toHaveBeenCalled());
    expect(onRevoked).not.toHaveBeenCalled();
    stop();
  });

  it('formats the place and the time without inventing anything', () => {
    expect(placeText({ city: 'warsaw', country: 'PL' })).toBe('Warsaw, PL');
    expect(placeText({ city: null, country: 'UA' })).toBe('UA');
    expect(placeText({ city: null, country: null })).toBe('');
    expect(relativeTime(1_000_000 - 3_600_000, 'en', 1_000_000)).toMatch(/hour/);
  });
});
