/** Schedule store over a scriptable port: the undoable builder save and the request lifecycle (create, answer, counter, cancel group), failures rolled back. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY } from '../domain/time';
import { opaqueSlotKey } from './ids';
import { keyOf } from './model';
import type { ScheduleData, SchedulePort } from './port';
import { createScheduleStore } from './scheduleStore';
import { tsOf } from './time';
import { emptyDoc, type RescheduleRequest, type ScheduleDoc } from './types';

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
const row = (id: string, dow = 4) => ({ id, dow, start: '18:00', dur: 60, gymId: 'g' });
const rq = (id: string, over: Partial<RescheduleRequest> = {}): RescheduleRequest => ({
  id,
  clientId: 'c1',
  from: 'client',
  slotKey: opaqueSlotKey('r1:1'),
  fromStart: tsOf(D0 + 4, 18 * 60),
  toStart: tsOf(D0 + 5, 18 * 60),
  status: 'pending',
  createdAt: NOW - 1000,
  expiresAt: NOW + DAY,
  scope: 'all',
  ...over,
});

describe('builder save and undo', () => {
  const pattern = { id: 'pn', fromDay: D0 + 7, weeks: 3, rows: [row('a', 0), row('b', 3)] };

  it('save writes every attendee, counts the created sessions of the first and shows an undo that expires after 8 s', async () => {
    const p = fakePort(data());
    const { store } = mkStore(p);
    store.start();
    const ok = await store.save({ clientIds: ['c1', 'c2'], label: 'Pair', pattern });
    expect(ok).toBe(true);
    expect(p.saved.map((d) => d.clientId)).toEqual(['c1', 'c2']);
    const ps = store.getState().pendingSave!;
    expect(ps).toMatchObject({
      label: 'Pair',
      count: 6,
      patternIds: ['pn'],
      oneOffIds: [],
      clientIds: ['c1', 'c2'],
    });
    expect(ps.until).toBe(NOW + 8000);
    expect(ps.token).toMatch(/^sv-/);
    await vi.advanceTimersByTimeAsync(8001);
    expect(store.getState().pendingSave).toBeNull();
    // the written docs stay
    expect(store.getState().docs.every((d) => d.patterns.length === 1)).toBe(true);
  });

  it('a one-off counts as one; undo removes exactly what the save added and keeps older content', async () => {
    const old = {
      ...emptyDoc('c1'),
      patterns: [{ id: 'keep', fromDay: D0, weeks: 1, rows: [row('k')] }],
    };
    const p = fakePort(data([old]));
    const { store } = mkStore(p);
    store.start();
    const oneOff = { id: 'o1', day: D0 + 2, start: '10:00', dur: 30, gymId: 'g' };
    expect(await store.save({ clientIds: ['c1'], label: 'One', oneOff })).toBe(true);
    expect(store.getState().pendingSave!.count).toBe(1);
    expect(store.getState().pendingSave!.oneOffIds).toEqual(['o1']);
    expect(store.getState().docs[0].oneOffs).toHaveLength(1);
    await store.undoSave();
    expect(store.getState().pendingSave).toBeNull();
    expect(store.getState().docs[0].oneOffs).toEqual([]);
    expect(store.getState().docs[0].patterns.map((x) => x.id)).toEqual(['keep']);
  });

  it('undoSave with nothing pending does nothing; a second save replaces the pending undo', async () => {
    const p = fakePort(data());
    const { store } = mkStore(p);
    store.start();
    await store.undoSave();
    expect(p.saved).toEqual([]);
    await store.save({ clientIds: ['c1'], label: 'A', pattern });
    await store.save({
      clientIds: ['c1'],
      label: 'B',
      pattern: { ...pattern, id: 'pn2', rows: [row('z', 1)] },
    });
    expect(store.getState().pendingSave!.label).toBe('B');
    store.settleSave();
    expect(store.getState().pendingSave).toBeNull();
  });

  it('exceeding the row limit fails with "limit" and writes nothing; a failed write returns false', async () => {
    const p = fakePort(data());
    const { store } = mkStore(p);
    store.start();
    const many = { ...pattern, rows: Array.from({ length: 9 }, (_, i) => row(`r${i}`, i % 7)) };
    expect(await store.save({ clientIds: ['c1'], label: 'Too many', pattern: many })).toBe(false);
    expect(store.getState().failed).toBe('limit');
    expect(p.saved).toEqual([]);
    store.clearFailed();
    p.saveImpl = async () => {
      throw new Error('boom');
    };
    expect(await store.save({ clientIds: ['c1'], label: 'x', pattern })).toBe(false);
    expect(store.getState().failed).toBe('save');
    expect(store.getState().pendingSave).toBeNull();
  });
});

describe('requests', () => {
  const draft = (over = {}) => ({
    clientId: 'c1',
    from: 'trainer' as const,
    slot: { key: keyOf('r1', D0 + 4), start: tsOf(D0 + 4, 18 * 60) },
    toStart: tsOf(D0 + 5, 18 * 60),
    ...over,
  });
  const started = (requests: RescheduleRequest[] = []) => {
    const p = fakePort(data([emptyDoc('c1')], requests));
    const s = mkStore(p);
    s.store.start();
    return { p, ...s };
  };

  it('creates one pending request per draft, posts each to the chat after the write, and returns them', async () => {
    const { p, store, posted } = started();
    const made = await store.request([
      draft(),
      draft({ clientId: 'c2', groupKey: 'gk', scope: 'one' }),
    ]);
    expect(made).toHaveLength(2);
    expect(p.created.map((r) => r.clientId)).toEqual(['c1', 'c2']);
    expect(made![0].id).toMatch(/^rq-/);
    expect(made![0].slotKey).toBe(opaqueSlotKey(keyOf('r1', D0 + 4)));
    expect(made![1]).toMatchObject({
      groupKey: 'gk',
      scope: 'one',
      status: 'pending',
      createdAt: NOW,
    });
    expect(posted.map((r) => r.id)).toEqual(made!.map((r) => r.id));
    expect(store.getState().requests).toHaveLength(2);
    expect(store.getState().unsynced).toBe(0);
  });

  it('an invalid draft throws the request error (the form shows why) and changes nothing', async () => {
    const { store, posted } = started();
    await expect(store.request([draft({ toStart: NOW - 1 })])).rejects.toMatchObject({
      code: 'past',
    });
    await store.request([draft()]);
    await expect(store.request([draft()])).rejects.toMatchObject({ code: 'open-request' });
    expect(store.getState().requests).toHaveLength(1);
    expect(posted).toHaveLength(1);
  });

  it('a failed write rolls the requests back, flags "request" and posts nothing', async () => {
    const { p, store, posted } = started();
    p.createImpl = async () => {
      throw new Error('offline');
    };
    expect(await store.request([draft()])).toBeNull();
    expect(store.getState().requests).toEqual([]);
    expect(store.getState().failed).toBe('request');
    expect(posted).toEqual([]);
    expect(store.getState().unsynced).toBe(0);
  });

  describe('respond', () => {
    it('an unknown request is not answered', async () => {
      const { store } = started();
      expect(await store.respond('nope', 'accepted')).toBe(false);
    });

    it('the other side accepts: applied at once, written with the decision time', async () => {
      const { p, store } = started([rq('q1', { from: 'client' })]);
      expect(await store.respond('q1', 'accepted')).toBe(true);
      expect(store.getState().requests[0]).toMatchObject({ status: 'accepted', decidedAt: NOW });
      expect(p.statuses).toEqual([['q1', 'accepted']]);
    });

    it('answering the same way again is idempotent and writes nothing', async () => {
      const { p, store } = started([rq('q1', { from: 'client', status: 'accepted' })]);
      expect(await store.respond('q1', 'accepted')).toBe(true);
      expect(p.statuses).toEqual([]);
    });

    it('the creator cannot answer their own request; a closed request cannot be re-opened', async () => {
      const { store } = started([
        rq('q1', { from: 'trainer' }),
        rq('q2', { from: 'client', status: 'declined' }),
      ]);
      expect(await store.respond('q1', 'accepted', 'trainer')).toBe(false);
      expect(store.getState().failed).toBe('answer');
      store.clearFailed();
      expect(await store.respond('q2', 'accepted')).toBe(false);
      expect(store.getState().failed).toBe('answer');
    });

    it('the creator may cancel their own request', async () => {
      const { p, store } = started([rq('q1', { from: 'trainer' })]);
      expect(await store.respond('q1', 'cancelled', 'trainer')).toBe(true);
      expect(p.statuses).toEqual([['q1', 'cancelled']]);
    });

    it('a late answer says "expired" whatever the stored status is, and writes nothing', async () => {
      const { p, store } = started([rq('q1', { from: 'client', expiresAt: NOW })]);
      expect(await store.respond('q1', 'accepted')).toBe(false);
      expect(store.getState().failed).toBe('expired');
      expect(p.statuses).toEqual([]);
    });

    it('a write refused as expired by the server (code, reason or message) rolls back with "expired"; other errors "answer"', async () => {
      const { p, store } = started([rq('q1', { from: 'client' })]);
      for (const err of [
        { code: 'expired' },
        { reason: 'expired' },
        new Error('request expired at server'),
      ]) {
        p.setStatusImpl = async () => {
          throw err;
        };
        expect(await store.respond('q1', 'accepted')).toBe(false);
        expect(store.getState().failed).toBe('expired');
        expect(store.getState().requests[0].status).toBe('pending');
        store.clearFailed();
      }
      p.setStatusImpl = async () => {
        throw new Error('network');
      };
      expect(await store.respond('q1', 'declined')).toBe(false);
      expect(store.getState().failed).toBe('answer');
      expect(store.getState().requests[0].status).toBe('pending');
      expect(store.getState().unsynced).toBe(0);
    });
  });

  describe('counter', () => {
    const counterDraft = {
      clientId: 'c1',
      slot: { key: 'r1:1', start: tsOf(D0 + 4, 18 * 60) },
      toStart: tsOf(D0 + 6, 18 * 60),
      scope: 'all' as const,
    };

    it('an unknown request cannot be countered', async () => {
      const { store } = started();
      expect(await store.counter('nope', counterDraft)).toBeNull();
    });

    it('the old request becomes countered and a new one from the other side supersedes it; both are written, the chat card is posted', async () => {
      const { p, store, posted } = started([rq('q1', { from: 'client' })]);
      const fresh = await store.counter('q1', counterDraft);
      expect(fresh).toMatchObject({
        from: 'trainer',
        supersedes: 'q1',
        status: 'pending',
        toStart: counterDraft.toStart,
      });
      expect(store.getState().requests.map((r) => r.status)).toEqual(['countered', 'pending']);
      expect(p.statuses).toEqual([['q1', 'countered']]);
      expect(p.created).toHaveLength(1);
      expect(posted).toEqual([fresh]);
    });

    it('a request that started with the trainer is countered by the client side', async () => {
      const { store } = started([rq('q1', { from: 'trainer' })]);
      const fresh = await store.counter('q1', counterDraft);
      expect(fresh!.from).toBe('client');
    });

    it('an expired request cannot be countered', async () => {
      const { p, store } = started([rq('q1', { from: 'client', expiresAt: NOW })]);
      expect(await store.counter('q1', counterDraft)).toBeNull();
      expect(store.getState().failed).toBe('expired');
      expect(p.created).toEqual([]);
    });

    it('a request already closed throws "not-open" and a proposal that is invalid throws its own error (the form shows why); nothing changes', async () => {
      const { store } = started([
        rq('q1', { from: 'client', status: 'declined' }),
        rq('q2', { from: 'client' }),
      ]);
      await expect(store.counter('q1', counterDraft)).rejects.toMatchObject({ code: 'not-open' });
      await expect(
        store.counter('q2', { ...counterDraft, toStart: NOW - 5 }),
      ).rejects.toMatchObject({ code: 'past' });
      expect(store.getState().requests.map((r) => r.status)).toEqual(['declined', 'pending']);
      expect(store.getState().failed).toBeNull();
    });

    it('a failing write rolls both changes back ("expired" when the server says so, else "request")', async () => {
      const { p, store, posted } = started([rq('q1', { from: 'client' })]);
      p.createImpl = async () => {
        throw new Error('offline');
      };
      expect(await store.counter('q1', counterDraft)).toBeNull();
      expect(store.getState().failed).toBe('request');
      expect(store.getState().requests.map((r) => r.status)).toEqual(['pending']);
      p.setStatusImpl = async () => {
        throw { code: 'expired' };
      };
      expect(await store.counter('q1', counterDraft)).toBeNull();
      expect(store.getState().failed).toBe('expired');
      expect(posted).toEqual([]);
      expect(store.getState().unsynced).toBe(0);
    });
  });

  describe('cancelGroup', () => {
    const reqs = [
      rq('a', { groupKey: 'g', from: 'trainer' }),
      rq('b', { groupKey: 'g', from: 'trainer', clientId: 'c2', status: 'accepted' }),
      rq('c', { groupKey: 'g', from: 'trainer', clientId: 'c3', expiresAt: NOW - 1 }),
      rq('d', { groupKey: 'other', from: 'trainer', clientId: 'c4' }),
    ];

    it('withdraws only the open requests of that group; an accepted answer is never auto-cancelled', async () => {
      const { p, store } = started(reqs);
      expect(await store.cancelGroup('g')).toBe(true);
      expect(p.statuses).toEqual([['a', 'cancelled']]);
      const by = Object.fromEntries(store.getState().requests.map((r) => [r.id, r.status]));
      expect(by).toEqual({ a: 'cancelled', b: 'accepted', c: 'pending', d: 'pending' });
      expect(store.getState().requests.find((r) => r.id === 'a')!.decidedAt).toBe(NOW);
    });

    it('a failed write is rolled back for that request, flagged, and the call is false', async () => {
      const { p, store } = started(reqs);
      p.setStatusImpl = async () => {
        throw new Error('offline');
      };
      expect(await store.cancelGroup('g')).toBe(false);
      expect(store.getState().failed).toBe('answer');
      expect(store.getState().requests.find((r) => r.id === 'a')!.status).toBe('pending');
    });

    it('an unknown group is a no-op that succeeds', async () => {
      const { p, store } = started(reqs);
      expect(await store.cancelGroup('zzz')).toBe(true);
      expect(p.statuses).toEqual([]);
    });
  });
});
