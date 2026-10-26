// @vitest-environment node
/**
 * SPO-364 / SPO-365: a slow-but-working Coach backend (cold function start, one read per client) must not end in
 * "Coach is taking too long". The first load used to be capped at 8 s while one callable may take 15 s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFixtureWorld, FIXTURE_NOW } from './__fixtures__/fixtures';
import { PortError, type CoachWorldPort, type WorldData } from './port';
import { createWorldStore, WORLD_LOAD_TIMEOUT_MS } from './worldStore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** load() answers after `delayMs` (the real adapter ignores the abort between client reads); `fail` first N loads reject. */
function slowPort(
  delayMs: number,
  failFirst = 0,
  cached: { data: WorldData; fetchedAt: number } | null = null,
) {
  let calls = 0;
  const port: CoachWorldPort = {
    now: () => FIXTURE_NOW,
    peek: () => cached,
    load: () => {
      const n = ++calls;
      return new Promise<WorldData>((res, rej) =>
        setTimeout(
          () => (n <= failFirst ? rej(new PortError('unavailable')) : res(buildFixtureWorld())),
          delayMs,
        ),
      );
    },
    async save() {},
  };
  return { port, calls: () => calls };
}

describe('slow backend is not "too long"', () => {
  it('a 10 s load (slower than the old 8 s cap, faster than the 15 s callable bound) ends ready, never error/timeout', async () => {
    const { port } = slowPort(10_000);
    const s = createWorldStore(port); // default options: what the app uses
    s.start();
    expect(s.getState().status).toBe('loading'); // skeleton meanwhile
    await vi.advanceTimersByTimeAsync(9_000);
    expect(s.getState().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(s.getState()).toMatchObject({ status: 'ready', error: null });
    expect(s.getState().world).not.toBeNull();
  });

  it('the default cap sits above the callable read timeout', () => {
    expect(WORLD_LOAD_TIMEOUT_MS).toBeGreaterThan(15_000);
  });

  it('a load that lands after its cap is shown (not thrown away) and joins the next refresh instead of doubling it', async () => {
    const { port, calls } = slowPort(5_000);
    const s = createWorldStore(port, { timeoutMs: 1_000, retryBaseMs: 0 });
    s.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(s.getState()).toMatchObject({ status: 'error', error: 'timeout' });
    void s.retry(); // joins the in-flight one
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(4_100);
    expect(s.getState()).toMatchObject({ status: 'ready', error: null });
  });
});

describe('automatic retry with backoff', () => {
  it('retries by itself after 2 s then 4 s and recovers without a tap on Retry', async () => {
    const { port, calls } = slowPort(10, 2);
    const s = createWorldStore(port, { refreshEveryMs: 0 });
    s.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(s.getState()).toMatchObject({ status: 'error', error: 'unavailable' });
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(2_010);
    expect(calls()).toBe(2);
    expect(s.getState().status).toBe('error');
    await vi.advanceTimersByTimeAsync(3_900);
    expect(calls()).toBe(2); // second delay is 4 s, not 2
    await vi.advanceTimersByTimeAsync(200);
    expect(calls()).toBe(3);
    await vi.advanceTimersByTimeAsync(20);
    expect(s.getState()).toMatchObject({ status: 'ready', error: null });
  });

  it('with cached data a failure keeps the data (stale) and still retries quietly', async () => {
    const { port, calls } = slowPort(10, 1, { data: buildFixtureWorld(), fetchedAt: 1 });
    const s = createWorldStore(port, { refreshEveryMs: 0 });
    s.start();
    expect(s.getState().world).not.toBeNull(); // cache at once
    await vi.advanceTimersByTimeAsync(20);
    expect(s.getState()).toMatchObject({ status: 'stale', error: 'unavailable' });
    expect(s.getState().world).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2_100);
    expect(calls()).toBe(2);
    expect(s.getState()).toMatchObject({ status: 'ready', error: null });
  });

  it('does not hammer a backend that cannot get better (forbidden) and stops with the store', async () => {
    let n = 0;
    const port: CoachWorldPort = {
      now: () => FIXTURE_NOW,
      peek: () => null,
      load: () => {
        n++;
        return Promise.reject(new PortError('forbidden'));
      },
      async save() {},
    };
    const s = createWorldStore(port, { refreshEveryMs: 0 });
    s.start();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(n).toBe(1);
    const q = slowPort(10, 99);
    const s2 = createWorldStore(q.port, { refreshEveryMs: 0 });
    s2.start();
    await vi.advanceTimersByTimeAsync(20);
    s2.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(q.calls()).toBe(1);
  });

  it('backoff is capped', async () => {
    const { port, calls } = slowPort(1, 99);
    const s = createWorldStore(port, { refreshEveryMs: 0, retryBaseMs: 1_000, retryMaxMs: 4_000 });
    s.start();
    await vi.advanceTimersByTimeAsync(30_000);
    // 1,2,4,4,4,... s after each failure: far more than log2 attempts but bounded
    expect(calls()).toBeGreaterThan(6);
    expect(calls()).toBeLessThan(13);
    s.stop();
  });
});
