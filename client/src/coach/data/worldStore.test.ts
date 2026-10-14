// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyBook } from '../domain/decisions';
import { buildOptions } from '../domain/diff';
import type { BookOp } from './bookOps';
import { buildFixtureWorld, createFixturesPort, FIXTURE_NOW } from './__fixtures__/fixtures';
import { PortError, type CoachWorldPort, type WorldData } from './port';
import { createWorldStore } from './worldStore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A port whose load() is resolved by the test. */
function manualPort(initial: { data: WorldData; fetchedAt: number } | null = null) {
  const pending: { res: (d: WorldData) => void; rej: (e: unknown) => void; signal: AbortSignal }[] =
    [];
  const saves: BookOp[] = [];
  let failSave = false;
  const port: CoachWorldPort = {
    now: () => FIXTURE_NOW,
    peek: () => initial,
    load: ({ signal }) => new Promise<WorldData>((res, rej) => pending.push({ res, rej, signal })),
    async save(op) {
      if (failSave) throw new Error('offline');
      saves.push(op);
    },
  };
  return { port, pending, saves, setFailSave: (v: boolean) => (failSave = v) };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

describe('never blocking', () => {
  it('start() returns synchronously; with no cache the state is `loading` (skeletons), world null', () => {
    const m = manualPort();
    const s = createWorldStore(m.port);
    s.start();
    expect(s.getState()).toMatchObject({ status: 'loading', world: null, refreshing: true });
    expect(m.pending).toHaveLength(1);
  });

  it('with a warm cache the app paints at once, `stale`, and refreshes behind it', async () => {
    const m = manualPort({ data: buildFixtureWorld(), fetchedAt: FIXTURE_NOW - 14 * 60_000 });
    const s = createWorldStore(m.port);
    s.start();
    const st = s.getState();
    expect(st.status).toBe('stale');
    expect(st.world?.counts.clients).toBe(14);
    expect(st.updatedAt).toBe(FIXTURE_NOW - 14 * 60_000);
    expect(st.refreshing).toBe(true);
    m.pending[0].res(buildFixtureWorld());
    await flush();
    expect(s.getState()).toMatchObject({
      status: 'ready',
      refreshing: false,
      error: null,
      updatedAt: FIXTURE_NOW,
    });
  });

  it('a server that never answers times out into error (no data) without ever throwing at the UI', async () => {
    const m = manualPort();
    const s = createWorldStore(m.port, { timeoutMs: 5000 });
    s.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(m.pending[0].signal.aborted).toBe(true);
    expect(s.getState()).toMatchObject({
      status: 'error',
      error: 'timeout',
      world: null,
      refreshing: false,
    });
  });

  it('the same timeout WITH data keeps the data, quietly `stale` with the error code', async () => {
    const m = manualPort({ data: buildFixtureWorld(), fetchedAt: 1 });
    const s = createWorldStore(m.port, { timeoutMs: 1000 });
    s.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.getState()).toMatchObject({ status: 'stale', error: 'timeout' });
    expect(s.getState().world).not.toBeNull();
  });
});

describe('states', () => {
  it('error without data, retry recovers', async () => {
    const m = manualPort();
    const s = createWorldStore(m.port);
    s.start();
    m.pending[0].rej(new PortError('unavailable'));
    await flush();
    expect(s.getState()).toMatchObject({ status: 'error', error: 'unavailable' });
    const retry = s.retry();
    expect(s.getState().refreshing).toBe(true);
    m.pending[1].res(buildFixtureWorld());
    await retry;
    expect(s.getState()).toMatchObject({ status: 'ready', error: null });
  });

  it('forbidden is surfaced as such (access revoked is a state, not a crash)', async () => {
    const m = manualPort();
    const s = createWorldStore(m.port);
    s.start();
    m.pending[0].rej(new PortError('forbidden'));
    await flush();
    expect(s.getState().error).toBe('forbidden');
  });

  it('offline: with data shows data + `offline`; without data `offline` and empty; coming back refreshes', async () => {
    const m = manualPort({ data: buildFixtureWorld(), fetchedAt: 5 });
    let online = false;
    const s = createWorldStore(m.port, { isOnline: () => online });
    s.start();
    expect(s.getState()).toMatchObject({ status: 'offline' });
    expect(s.getState().world).not.toBeNull();
    m.pending[0].rej(new Error('network'));
    await flush();
    expect(s.getState()).toMatchObject({ status: 'offline', error: 'offline' });
    expect(s.getState().world).not.toBeNull();
    online = true;
    s.setOnline(true);
    expect(s.getState().status).toBe('stale');
    m.pending[1].res(buildFixtureWorld());
    await flush();
    expect(s.getState().status).toBe('ready');

    const cold = manualPort();
    const c = createWorldStore(cold.port, { isOnline: () => false });
    c.start();
    expect(c.getState()).toMatchObject({ status: 'offline', world: null });
  });

  it('losing the connection later flips to offline and keeps data', async () => {
    const m = manualPort();
    const s = createWorldStore(m.port);
    s.start();
    m.pending[0].res(buildFixtureWorld());
    await flush();
    s.setOnline(false);
    expect(s.getState().status).toBe('offline');
    expect(s.getState().world?.counts.clients).toBe(14);
  });

  it('never two loads at once; background refresh on the interval; stop() ends it', async () => {
    const m = manualPort();
    const s = createWorldStore(m.port, { refreshEveryMs: 1000 });
    s.start();
    void s.refresh();
    void s.refresh();
    expect(m.pending).toHaveLength(1);
    m.pending[0].res(buildFixtureWorld());
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.pending).toHaveLength(2);
    s.stop();
    m.pending[1].res(buildFixtureWorld());
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(m.pending).toHaveLength(2);
  });

  it('push invalidation triggers a refresh', async () => {
    let fire = () => undefined as void;
    const base = manualPort();
    const port: CoachWorldPort = {
      ...base.port,
      subscribe: (cb) => {
        fire = cb;
        return () => undefined;
      },
    };
    const s = createWorldStore(port, { refreshEveryMs: 0 });
    s.start();
    base.pending[0].res(buildFixtureWorld());
    await flush();
    fire();
    expect(base.pending).toHaveLength(2);
  });
});

describe('optimistic decisions', () => {
  async function ready() {
    const m = manualPort();
    const s = createWorldStore(m.port, { refreshEveryMs: 0 });
    s.start();
    m.pending[0].res(buildFixtureWorld());
    await flush();
    return { m, s };
  }
  const oleh = (s: ReturnType<typeof createWorldStore>) =>
    s.getState().world!.signals.find((x) => x.signal.clientId === 'c1')!.signal;

  it('recording updates Today at once ("Decided"), persists in the background', async () => {
    const { m, s } = await ready();
    const sig = oleh(s);
    const option = buildOptions(sig).find((o) => o.suggested)!;
    s.dispatch({
      t: 'record',
      id: 'd-new',
      signal: sig,
      option,
      message: 'Try paused bench',
      now: FIXTURE_NOW,
    });
    const w = s.getState().world!;
    expect(w.signals.find((x) => x.signal.key === sig.key)!.state).toBe('decided');
    expect(w.counts.needDecision).toBe(1);
    expect(w.summary.total).toBe(43);
    await flush();
    expect(m.saves.map((o) => o.t)).toEqual(['record']);
    expect(s.getState().unsynced).toBe(0);
  });

  it('a failed save keeps the op queued (unsynced) and the next refresh flushes it', async () => {
    const { m, s } = await ready();
    m.setFailSave(true);
    s.dispatch({ t: 'snooze', id: 's1', signal: oleh(s), now: FIXTURE_NOW });
    await flush();
    expect(s.getState().unsynced).toBe(1);
    expect(s.getState().world!.counts.needDecision).toBe(1); // still hidden locally
    m.setFailSave(false);
    const r = s.refresh();
    m.pending[1].res(buildFixtureWorld()); // the server has not seen it yet
    await r;
    await flush();
    expect(m.saves.map((o) => o.t)).toEqual(['snooze']);
    expect(s.getState().unsynced).toBe(0);
    expect(s.getState().world!.counts.needDecision).toBe(1);
  });

  it('dismiss without a valid reason throws and is never queued', async () => {
    const { s } = await ready();
    expect(() =>
      s.dispatch({
        t: 'dismiss',
        id: 'x',
        signal: oleh(s),
        reason: 'nope' as never,
        now: FIXTURE_NOW,
      }),
    ).toThrow();
    expect(s.getState().unsynced).toBe(0);
  });

  it('measures due decisions when the app opens after windowEndsAt and saves the outcome', async () => {
    const m = manualPort();
    const data = buildFixtureWorld();
    const sig = buildFixtureWorld();
    void sig;
    const s = createWorldStore(m.port, {
      refreshEveryMs: 0,
      now: () => FIXTURE_NOW + 20 * 86_400_000,
    });
    // a measuring decision with a window already ended and no data to measure: extended once
    const d = data.book.decisions.find((x) => x.outcome?.result === 'measuring')!;
    const ended = {
      ...d,
      windowEndsAt: FIXTURE_NOW - 1000,
      decidedAt: FIXTURE_NOW - 15 * 86_400_000,
    };
    data.book = { ...emptyBook(), decisions: [ended] };
    data.outcomeData = { [ended.signal.key]: { sessions: [] } };
    s.start();
    m.pending[0].res(data);
    await flush();
    await flush();
    expect(m.saves.map((o) => o.t)).toEqual(['outcome']);
    const rec = s.getState().world!.decisions[0];
    expect(rec.outcome).toMatchObject({ result: 'measuring', extended: true });
    expect(rec.windowEndsAt).toBe(FIXTURE_NOW - 1000 + 7 * 86_400_000);
  });
});

describe('fixtures port end to end', () => {
  it('loads through the store with simulated latency', async () => {
    const port = createFixturesPort({ delayMs: 250 });
    const s = createWorldStore(port, { refreshEveryMs: 0 });
    s.start();
    expect(s.getState().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(250);
    expect(s.getState().status).toBe('ready');
    expect(s.getState().world!.trainer.name).toBe('Iryna Melnyk');
  });
  it('a failing fixtures port is an error state', async () => {
    const s = createWorldStore(createFixturesPort({ failWith: () => 'unavailable' }), {
      refreshEveryMs: 0,
    });
    s.start();
    await flush();
    expect(s.getState()).toMatchObject({ status: 'error', error: 'unavailable' });
  });
});
