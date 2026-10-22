import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import type { Kv } from '../../functions/src/coach/kv';
import type { Ctx } from '../../functions/src/coach/service';
import {
  MAX_PAGES,
  REMIND_BEFORE,
  UNMARKED_AFTER,
  runReminders,
  runUnanswered,
} from '../../functions/src/coach/reminders';
import { DAY, conversationId } from '../../functions/src/coach/logic';

// SPO-265 (sessions marked by the other side, cost) and the security review's L8 (order / limit / cursor in the schedulers).
const H = 3_600_000;
const PEPPER = new Uint8Array(32);
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
let kv: MemoryKv;
let clock = T0;
const pushes: [string, string][] = [];
const mk = (store: Kv): Ctx => ({
  kv: store,
  now: () => clock,
  pepper: PEPPER,
  newToken: () => 'tok',
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
const ctx = () => mk(kv);

beforeEach(async () => {
  kv = createMemoryKv();
  clock = T0;
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
});
afterEach(() => vi.restoreAllMocks());

async function client(id: string, timing: Record<string, unknown>, rev = 1) {
  await kv.set(`users/${id}`, { role: 'member', status: 'active', firstName: id });
  await kv.set(`coaching/${id}`, { clientId: id, trainerId: 't1', status: 'active', keyEpoch: 1 });
  await kv.set(`schedules/${id}`, { clientId: id, trainerId: 't1', rev, enc: {}, timing });
}

describe('a session the other side already marked gets no notice', () => {
  const e1 = T0 - 5 * H;
  const e2 = T0 - 4 * H;

  it('the schedule is read as it is NOW: the mark saved by the manager removes the session from `unmarked`', async () => {
    await client('c1', { starts: [], unmarked: [e1, e2], dueAt: e1 + UNMARKED_AFTER });
    // the manager's device marks the first session and saves (rev 2): its timing no longer lists it
    await kv.set('schedules/c1', {
      clientId: 'c1',
      trainerId: 't1',
      rev: 2,
      enc: {},
      timing: { starts: [], unmarked: [e2], dueAt: e2 + UNMARKED_AFTER },
    });
    clock = T0;
    expect(await runReminders(ctx())).toMatchObject({ unmarked: 1 });
    const notices = (await kv.list('users/t1/notices')).map((n) => n.id);
    expect(notices).toEqual([`um-c1-${e2}`]);
    expect(notices).not.toContain(`um-c1-${e1}`);
  });

  it('a mark saved AFTER the query but before the row is handled is respected too (no stale list)', async () => {
    await client('c1', { starts: [], unmarked: [e1], dueAt: e1 + UNMARKED_AFTER });
    const racing: Kv = {
      ...kv,
      list: async (coll, q) => {
        const rows = await kv.list(coll, q);
        if (coll === 'schedules')
          await kv.set('schedules/c1', {
            clientId: 'c1',
            trainerId: 't1',
            rev: 2,
            enc: {},
            timing: { starts: [], unmarked: [], dueAt: 0 },
          });
        return rows;
      },
    };
    expect(await runReminders(mk(racing))).toMatchObject({ unmarked: 0, reminders: 0 });
    expect((await kv.list('users/t1/notices')).length).toBe(0);
    expect(pushes).toEqual([]);
    // their fresher save is left alone: the job does not overwrite it with its own timer
    expect((await kv.get('schedules/c1'))?.timing).toMatchObject({ dueAt: 0 });
  });

  it('a session cancelled meanwhile gets no reminder either', async () => {
    const start = T0 + 10 * H;
    await client('c1', { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE + 1000;
    const racing: Kv = {
      ...kv,
      list: async (coll, q) => {
        const rows = await kv.list(coll, q);
        if (coll === 'schedules')
          await kv.merge('schedules/c1', {
            rev: 2,
            timing: { starts: [], unmarked: [], dueAt: 0 },
          });
        return rows;
      },
    };
    expect(await runReminders(mk(racing))).toMatchObject({ reminders: 0 });
    expect(pushes).toEqual([]);
  });
});

describe('L8: the schedulers walk their backlog in order, in bounded pages', () => {
  it('450 schedules due at the same moment are all handled in one run, oldest first, none twice', async () => {
    const start = T0 + 30 * H;
    for (let i = 0; i < 450; i++)
      await client(`c${i}`, { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE + 60_000;
    const r = await runReminders(ctx());
    expect(r).toEqual({ schedules: 450, reminders: 450, unmarked: 0 });
    expect(pushes).toHaveLength(450);
    expect(new Set(pushes.map((p) => p[0])).size).toBe(450);
    expect(await runReminders(ctx())).toEqual({ schedules: 0, reminders: 0, unmarked: 0 });
  });

  it(`a backlog beyond ${MAX_PAGES} pages is worked off over the next runs, never in one unbounded read`, async () => {
    const start = T0 + 30 * H;
    const total = 200 * MAX_PAGES + 30;
    for (let i = 0; i < total; i++)
      await client(`c${i}`, { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE + 60_000;
    expect((await runReminders(ctx())).schedules).toBe(200 * MAX_PAGES);
    expect((await runReminders(ctx())).schedules).toBe(30);
    expect(pushes).toHaveLength(total);
  }, 60_000);

  it('a schedule that keeps failing moves behind the healthy ones and cannot block them; nothing identifying is logged', async () => {
    const start = T0 + 30 * H;
    for (let i = 0; i < 3; i++)
      await client(`c${i}`, { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE + 60_000;
    const failing: Kv = {
      ...kv,
      get: async (p) => {
        if (p === 'coaching/c0') throw new Error('boom c0 secret');
        return kv.get(p);
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await runReminders(mk(failing));
    expect(r.reminders).toBe(2);
    expect((await kv.get('schedules/c0'))?.timing).toMatchObject({ dueAt: clock + 30 * 60_000 });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/c0|secret/);
    // healthy rows were handled and cleared; the failing one is not due again before its retry time
    expect(await runReminders(mk(failing))).toEqual({ schedules: 0, reminders: 0, unmarked: 0 });
  });

  it('requests unanswered for a day: a backlog of already-reminded old ones does not hide a newer one', async () => {
    await kv.set('users/c1', { role: 'member', firstName: 'Oleh' });
    const cid = conversationId(PEPPER, 'c1', 't1');
    await kv.set(`conversations/${cid}`, { clientId: 'c1', trainerId: 't1', active: true });
    clock = T0 + 2 * DAY;
    const day = (createdAt: number) => Math.floor((clock - createdAt) / DAY);
    for (let i = 0; i < 300; i++) {
      const createdAt = T0 - 10 * DAY + i;
      await kv.set(`conversations/${cid}/requests/q${i}`, {
        id: `q${i}`,
        from: 'client',
        status: 'pending',
        createdAt,
        expiresAt: clock + DAY,
      });
      // these were reminded today already
      await kv.set(`users/t1/notices/rq-q${i}-${day(createdAt)}`, { id: 'x', readAt: null });
    }
    const fresh = T0 - DAY;
    await kv.set(`conversations/${cid}/requests/qnew`, {
      id: 'qnew',
      from: 'client',
      status: 'pending',
      createdAt: fresh,
      expiresAt: clock + DAY,
    });
    expect(await runUnanswered(ctx())).toBe(1);
    expect(await kv.get(`users/t1/notices/rq-qnew-${day(fresh)}`)).toMatchObject({
      kind: 'reminder',
      refId: 'qnew',
    });
    expect(await runUnanswered(ctx())).toBe(0);
  });
});
