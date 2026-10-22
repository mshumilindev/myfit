/** Schedule store over a scriptable port: start/hydrate/online states, optimistic edits with conflict retry and rollback. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY } from '../domain/time';
import { SchedulePortError, type ScheduleData, type SchedulePort } from './port';
import { createScheduleStore } from './scheduleStore';
import { tsOf } from './time';
import { emptyDoc, type RescheduleRequest, type ScheduleDoc, type ScheduleSlot } from './types';

const D0 = Math.floor(Date.UTC(2026, 9, 5) / DAY);
const NOW = Date.UTC(2026, 9, 7, 9, 5);

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => vi.useRealTimers());

interface Fake extends SchedulePort {
  emit(d: ScheduleData): void;
  fail(e: unknown): void;
  subs: number;
  unsubs: number;
  cached: ScheduleData | null;
  saved: ScheduleDoc[];
  statuses: Array<[string, string]>;
  created: RescheduleRequest[];
  saveImpl: (d: ScheduleDoc) => Promise<ScheduleDoc>;
  setStatusImpl: (r: RescheduleRequest, s: string) => Promise<void>;
  createImpl: (r: RescheduleRequest) => Promise<void>;
  hydrateImpl?: () => Promise<void>;
}
function fakePort(cached: ScheduleData | null = null): Fake {
  let on: ((d: ScheduleData) => void) | null = null;
  let onErr: ((e: unknown) => void) | null = null;
  const f: Fake = {
    subs: 0,
    unsubs: 0,
    cached,
    saved: [],
    statuses: [],
    created: [],
    now: () => NOW,
    peek() {
      return f.cached;
    },
    hydrate() {
      return f.hydrateImpl ? f.hydrateImpl() : Promise.resolve();
    },
    subscribe(cb, err) {
      f.subs++;
      on = cb;
      onErr = err;
      return () => void f.unsubs++;
    },
    emit: (d) => on!(d),
    fail: (e) => onErr!(e),
    saveImpl: async (d) => ({ ...d, rev: d.rev + 1 }),
    setStatusImpl: async () => undefined,
    createImpl: async () => undefined,
    async saveDoc(d) {
      f.saved.push(d);
      return f.saveImpl(d);
    },
    async createRequest(r) {
      await f.createImpl(r);
      f.created.push(r);
    },
    async setStatus(r, s) {
      await f.setStatusImpl(r, s);
      f.statuses.push([r.id, s]);
    },
  };
  return f;
}
const data = (docs: ScheduleDoc[] = [], requests: RescheduleRequest[] = []): ScheduleData => ({
  docs,
  requests,
  asOf: NOW,
});
const mkStore = (port: SchedulePort, online = true) => {
  const posted: RescheduleRequest[] = [];
  const store = createScheduleStore(port, {
    isOnline: () => online,
    onRequest: (r) => posted.push(r),
  });
  return { store, posted };
};
const slotFor = (key: string, clientIds: string[], start = tsOf(D0 + 4, 18 * 60)): ScheduleSlot =>
  ({
    id: key,
    key,
    clientId: clientIds[0],
    kind: clientIds.length > 1 ? 'group' : 'solo',
    attendees: clientIds.map((c) => ({ clientId: c, status: 'planned' as const })),
    start,
    durationMin: 60,
    gymId: 'g',
    status: 'planned',
  }) as ScheduleSlot;
describe('start / hydrate / online', () => {
  it('a cached snapshot is painted at once as stale (online) or offline, then live data makes it ready', () => {
    const p = fakePort(data([emptyDoc('c1')]));
    const { store } = mkStore(p);
    store.start();
    expect(store.getState()).toMatchObject({ status: 'stale', asOf: NOW });
    p.emit(data([emptyDoc('c1'), emptyDoc('c2')]));
    expect(store.getState().status).toBe('ready');
    expect(store.getState().docs).toHaveLength(2);
    const off = mkStore(fakePort(data([emptyDoc('c1')])), false);
    off.store.start();
    expect(off.store.getState().status).toBe('offline');
  });

  it('start is idempotent', () => {
    const p = fakePort();
    const { store } = mkStore(p);
    store.start();
    store.start();
    expect(p.subs).toBe(1);
  });

  it('with no snapshot it is loading (online) or offline, and a late on-device snapshot is adopted only while empty', async () => {
    const p = fakePort();
    p.hydrateImpl = async () => {
      p.cached = data([emptyDoc('c7')]);
    };
    const { store } = mkStore(p);
    store.start();
    expect(store.getState().status).toBe('loading');
    await vi.waitFor(() => expect(store.getState().status).toBe('stale'));
    expect(store.getState().docs.map((d) => d.clientId)).toEqual(['c7']);

    // live data that got there first wins over the late snapshot
    const q = fakePort();
    let release!: () => void;
    q.hydrateImpl = () => new Promise<void>((r) => (release = r));
    const second = mkStore(q);
    second.store.start();
    q.emit(data([emptyDoc('live')]));
    q.cached = data([emptyDoc('stale-snapshot')]);
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(second.store.getState().docs.map((d) => d.clientId)).toEqual(['live']);

    const o = fakePort();
    const offline = mkStore(o, false);
    offline.store.start();
    expect(offline.store.getState().status).toBe('offline');
  });

  it('a hydrate that rejects is ignored; a snapshot arriving after stop is not applied', async () => {
    const p = fakePort();
    let reject!: (e: unknown) => void;
    p.hydrateImpl = () => new Promise<void>((_r, j) => (reject = j));
    const a = mkStore(p);
    a.store.start();
    reject(new Error('io'));
    await Promise.resolve();
    expect(a.store.getState().status).toBe('loading');

    const q = fakePort();
    let done!: () => void;
    q.hydrateImpl = () => new Promise<void>((r) => (done = r));
    const b = mkStore(q);
    b.store.start();
    b.store.stop();
    q.cached = data([emptyDoc('late')]);
    done();
    await Promise.resolve();
    await Promise.resolve();
    expect(b.store.getState().docs).toEqual([]);
    expect(q.unsubs).toBe(1);
  });

  it('a feed error: with data stale (online) / offline, without data error / offline', () => {
    const withData = fakePort(data([emptyDoc('c1')]));
    const a = mkStore(withData);
    a.store.start();
    withData.fail(new Error('x'));
    expect(a.store.getState().status).toBe('stale');
    const none = fakePort();
    const b = mkStore(none);
    b.store.start();
    none.fail(new Error('x'));
    expect(b.store.getState().status).toBe('error');
    const offNone = fakePort();
    const c = mkStore(offNone, false);
    c.store.start();
    offNone.fail(new Error('x'));
    expect(c.store.getState().status).toBe('offline');
    const offData = fakePort(data([emptyDoc('c1')]));
    const d = mkStore(offData, false);
    d.store.start();
    offData.fail(new Error('x'));
    expect(d.store.getState().status).toBe('offline');
  });

  it('setOnline(false) shows offline; coming back re-subscribes (once started) and errors then read stale / error', () => {
    const p = fakePort();
    const { store } = mkStore(p);
    store.setOnline(true); // not started: nothing happens
    expect(p.subs).toBe(0);
    store.start();
    expect(p.subs).toBe(1);
    store.setOnline(false);
    expect(store.getState().status).toBe('offline');
    store.setOnline(true);
    expect(p.subs).toBe(2);
    expect(p.unsubs).toBe(1);
    p.fail(new Error('x'));
    expect(store.getState().status).toBe('error');
    p.emit(data([emptyDoc('c1')]));
    p.fail(new Error('x'));
    expect(store.getState().status).toBe('stale');
  });

  it('retry resubscribes only when started: loading without data, stale with data; errors follow', () => {
    const p = fakePort();
    const { store } = mkStore(p);
    store.retry();
    expect(p.subs).toBe(0);
    store.start();
    p.fail(new Error('x'));
    expect(store.getState().status).toBe('error');
    store.retry();
    expect(store.getState().status).toBe('loading');
    expect(p.subs).toBe(2);
    p.fail(new Error('again'));
    expect(store.getState().status).toBe('error');
    p.emit(data([emptyDoc('c1')]));
    store.retry();
    expect(store.getState().status).toBe('stale');
    p.fail(new Error('again'));
    expect(store.getState().status).toBe('stale');
  });

  it('subscribers are notified and can unsubscribe; now() is the port clock', () => {
    const p = fakePort();
    const { store } = mkStore(p);
    const f = vi.fn();
    const off = store.subscribe(f);
    store.start();
    expect(f).toHaveBeenCalled();
    const n = f.mock.calls.length;
    off();
    p.emit(data());
    expect(f.mock.calls.length).toBe(n);
    expect(store.now()).toBe(NOW);
  });
});

describe('edits: optimistic, conflict retry, failures', () => {
  const started = (docs: ScheduleDoc[] = []) => {
    const p = fakePort(data(docs));
    const s = mkStore(p);
    s.store.start();
    return { p, ...s };
  };

  it('markMissed writes the doc with rev and keeps the stored copy; unsynced returns to zero', async () => {
    const { p, store } = started([emptyDoc('c1')]);
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getState().unsynced));
    const ok = await store.markMissed(slotFor('r1:1', ['c1']), 'c1');
    expect(ok).toBe(true);
    expect(p.saved[0].exceptions).toEqual([{ slotKey: 'r1:1', status: 'missed' }]);
    expect(store.getState().docs[0].rev).toBe(1);
    expect(Math.max(...seen)).toBe(1);
    expect(store.getState().unsynced).toBe(0);
  });

  it('markDone and keepOnOldTime write their marks; a doc that does not exist yet starts empty', async () => {
    const { p, store } = started();
    expect(await store.markDone(slotFor('r1:1', ['c9']), 'c9')).toBe(true);
    expect(await store.keepOnOldTime(slotFor('r2:1', ['c9']), 'c9')).toBe(true);
    expect(p.saved.at(-1)!.exceptions).toEqual([
      { slotKey: 'r1:1', status: 'done' },
      { slotKey: 'r2:1', status: 'kept' },
    ]);
  });

  it('a lost race re-reads the newer doc and re-applies the same intent once', async () => {
    const { p, store } = started([emptyDoc('c1')]);
    let n = 0;
    p.saveImpl = async (d) => {
      if (n++ === 0) {
        p.cached = data([{ ...emptyDoc('c1'), rev: 5, cancelled: ['other'] }]);
        throw new SchedulePortError('conflict');
      }
      return { ...d, rev: d.rev + 1 };
    };
    expect(await store.cancelSession(slotFor('r1:1', ['c1']), 'c1')).toBe(true);
    expect(p.saved).toHaveLength(2);
    expect(p.saved[1].rev).toBe(5);
    expect(p.saved[1].cancelled).toEqual(['other', 'r1:1']);
    expect(store.getState().failed).toBeNull();
  });

  it('a second conflict fails with "conflict" and the optimistic edit is rolled back', async () => {
    const { p, store } = started([emptyDoc('c1')]);
    p.saveImpl = async () => {
      throw new SchedulePortError('conflict');
    };
    expect(await store.cancelSession(slotFor('r1:1', ['c1']), 'c1')).toBe(false);
    expect(store.getState().failed).toBe('conflict');
    expect(store.getState().docs[0].cancelled).toEqual([]);
    expect(store.getState().unsynced).toBe(0);
    store.clearFailed();
    expect(store.getState().failed).toBeNull();
  });

  it('a locked vault and other errors are reported as such; nothing stays applied', async () => {
    const { p, store } = started([emptyDoc('c1')]);
    p.saveImpl = async () => {
      throw new SchedulePortError('vault-locked');
    };
    expect(await store.markMissed(slotFor('r1:1', ['c1']), 'c1')).toBe(false);
    expect(store.getState().failed).toBe('vault-locked');
    p.saveImpl = async () => {
      throw new Error('boom');
    };
    expect(await store.markMissed(slotFor('r1:1', ['c1']), 'c1')).toBe(false);
    expect(store.getState().failed).toBe('save');
    p.saveImpl = async () => {
      throw new SchedulePortError('offline');
    };
    expect(await store.markMissed(slotFor('r1:1', ['c1']), 'c1')).toBe(false);
    expect(store.getState().failed).toBe('save');
    expect(store.getState().docs[0].exceptions).toEqual([]);
  });

  it('a conflict with nothing newer to read still retries once with the same base', async () => {
    const { p, store } = started([emptyDoc('c1')]);
    p.cached = null;
    let n = 0;
    p.saveImpl = async (d) => {
      if (n++ === 0) throw new SchedulePortError('conflict');
      return { ...d, rev: d.rev + 1 };
    };
    expect(await store.markMissed(slotFor('r1:1', ['c1']), 'c1')).toBe(true);
    expect(p.saved).toHaveLength(2);
  });

  it('cancelSession without a person cancels for every attendee; with one it only touches that doc', async () => {
    const { p, store } = started([emptyDoc('c1'), emptyDoc('c2')]);
    expect(await store.cancelSession(slotFor('g:1', ['c1', 'c2']))).toBe(true);
    expect(p.saved.map((d) => d.clientId).sort()).toEqual(['c1', 'c2']);
    p.saved.length = 0;
    expect(await store.cancelSession(slotFor('g:2', ['c1', 'c2']), 'c2')).toBe(true);
    expect(p.saved.map((d) => d.clientId)).toEqual(['c2']);
  });

  it('with several docs one failing makes the whole call false but the others are still written', async () => {
    const { p, store } = started([emptyDoc('c1'), emptyDoc('c2')]);
    p.saveImpl = async (d) => {
      if (d.clientId === 'c1') throw new Error('boom');
      return { ...d, rev: d.rev + 1 };
    };
    expect(await store.cancelSession(slotFor('g:1', ['c1', 'c2']))).toBe(false);
    expect(store.getState().docs.find((d) => d.clientId === 'c2')!.cancelled).toEqual(['g:1']);
  });
});
