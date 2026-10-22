import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import type { Ctx } from '../../functions/src/coach/service';
import {
  runDaily,
  runSummaries,
  runUnanswered,
  zonesAtSummaryTime,
} from '../../functions/src/coach/reminders';
import { conversationId, DAY } from '../../functions/src/coach/logic';
import { localMinutes, shouldDeliver } from '../../functions/src/coach/pushPolicy';

// SPO-265: "24 h without an answer" and the 08:00 summary, with a fake clock.
const H = 3_600_000;
const PEPPER = new Uint8Array(32);
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
let kv: MemoryKv;
let clock = T0;
const pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => clock,
  pepper: PEPPER,
  newToken: () => 'tok',
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
const cid = conversationId(PEPPER, 'c1', 't1');
const request = (id: string, from: 'client' | 'trainer', createdAt: number, over = {}) =>
  kv.set(`conversations/${cid}/requests/${id}`, {
    id,
    from,
    status: 'pending',
    createdAt,
    expiresAt: createdAt + 5 * DAY,
    ...over,
  });

beforeEach(async () => {
  kv = createMemoryKv();
  clock = T0;
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', firstName: 'Olena' });
  await kv.set('users/c1', { role: 'member', firstName: 'Oleh' });
  await kv.set(`conversations/${cid}`, { clientId: 'c1', trainerId: 't1', active: true });
});

describe('requests unanswered for 24 h', () => {
  it('nothing before 24 h; then ONE reminder to whoever has to answer, with a reminder push', async () => {
    await request('r1', 'client', T0);
    clock = T0 + 23 * H;
    expect(await runUnanswered(ctx())).toBe(0);
    clock = T0 + 24 * H + 60_000;
    expect(await runUnanswered(ctx())).toBe(1);
    expect(pushes).toEqual([['t1', 'reminder']]);
    expect(await kv.get('users/t1/notices/rq-r1-1')).toMatchObject({
      kind: 'reminder',
      refId: 'r1',
      detail: 'Oleh',
      readAt: null,
    });
    // the next cycles of the same day add nothing
    clock += 15 * 60_000;
    expect(await runUnanswered(ctx())).toBe(0);
    expect(pushes).toHaveLength(1);
  });
  it('a trainer or manager request goes to the CLIENT, without a name; the next day reminds once more', async () => {
    await request('r2', 'trainer', T0, { via: 'manager' });
    clock = T0 + 25 * H;
    expect(await runUnanswered(ctx())).toBe(1);
    expect(pushes).toEqual([['c1', 'reminder']]);
    expect((await kv.get('users/c1/notices/rq-r2-1'))?.detail).toBeNull();
    clock = T0 + 49 * H;
    expect(await runUnanswered(ctx())).toBe(1);
    expect(kv.has('users/c1/notices/rq-r2-2')).toBe(true);
  });
  it('skips answered, expired and ended-conversation requests', async () => {
    await request('a', 'client', T0, { status: 'accepted' });
    await request('b', 'client', T0, { expiresAt: T0 + 20 * H });
    clock = T0 + 30 * H;
    expect(await runUnanswered(ctx())).toBe(0);
    await request('c', 'client', T0);
    await kv.merge(`conversations/${cid}`, { active: false });
    expect(await runUnanswered(ctx())).toBe(0);
    expect(pushes).toHaveLength(0);
  });
  it('the notice carries no sealed content', async () => {
    await request('r1', 'client', T0, { enc: { v: 1, iv: 'x', ct: 'secret' } });
    clock = T0 + 25 * H;
    await runUnanswered(ctx());
    expect(JSON.stringify(await kv.get('users/t1/notices/rq-r1-1'))).not.toContain('secret');
  });
  it('the push follows quiet hours and the reminders switch; the Spotter notice is written either way', () => {
    const night = { on: true, from: 22 * 60, to: 7 * 60 };
    const at = Date.UTC(2026, 9, 21, 23, 0);
    expect(shouldDeliver('reminder', { quiet: night, tz: 'UTC' }, at)).toBe(false);
    expect(shouldDeliver('reminder', { quiet: night, tz: 'UTC' }, at + 10 * H)).toBe(true);
    expect(shouldDeliver('reminder', { prefs: { reminders: false }, tz: 'UTC' }, at + 10 * H)).toBe(
      false,
    );
  });
});

describe('08:00 summary', () => {
  const device = (uid: string, tz: string) =>
    kv.set(`users/${uid}/push/d1`, { token: 'x', tz, updatedAt: T0 });
  const unread = (uid: string, n = 2) =>
    Promise.all(
      Array.from({ length: n }, (_, i) =>
        kv.set(`users/${uid}/notices/u${i}`, {
          id: `u${i}`,
          kind: 'team',
          createdAt: T0,
          readAt: null,
        }),
      ),
    );

  it('at 08:00 local (not before, not after the grace window) a summary with the unread count, no push', async () => {
    await device('t1', 'Europe/Warsaw'); // UTC+2 in October
    await unread('t1', 3);
    clock = Date.UTC(2026, 9, 21, 5, 30); // 07:30 local
    expect(await runSummaries(ctx())).toBe(0);
    clock = Date.UTC(2026, 9, 21, 6, 5); // 08:05 local
    expect(await runSummaries(ctx())).toBe(1);
    expect(await kv.get('users/t1/notices/sum-t1-2026-10-21')).toMatchObject({
      kind: 'summary',
      count: 3,
      readAt: null,
    });
    expect(pushes).toEqual([]);
    clock = Date.UTC(2026, 9, 21, 6, 20); // the next cycle: once per local day
    expect(await runSummaries(ctx())).toBe(0);
    clock = Date.UTC(2026, 9, 21, 7, 0); // 09:00 local: window closed
    expect(await runSummaries(ctx())).toBe(0);
  });
  it('nothing unread or only a summary: no summary; two devices of one person: one summary', async () => {
    await device('t1', 'UTC');
    await kv.set('users/t1/push/d2', { token: 'y', tz: 'UTC', updatedAt: T0 });
    clock = Date.UTC(2026, 9, 21, 8, 1);
    expect(await runSummaries(ctx())).toBe(0);
    await unread('t1', 1);
    expect(await runSummaries(ctx())).toBe(1);
    expect(await runSummaries(ctx())).toBe(0);
    expect(
      (await kv.list('users/t1/notices')).filter((n) => n.data.kind === 'summary'),
    ).toHaveLength(1);
  });
  it('each person gets it in their own zone', async () => {
    await device('t1', 'Europe/Warsaw');
    await device('c1', 'America/New_York');
    await unread('t1');
    await unread('c1');
    clock = Date.UTC(2026, 9, 21, 6, 0); // 08:00 Warsaw, 02:00 New York
    expect(await runSummaries(ctx())).toBe(1);
    expect(kv.has('users/t1/notices/sum-t1-2026-10-21')).toBe(true);
    clock = Date.UTC(2026, 9, 21, 12, 0); // 08:00 New York (EDT)
    expect(await runSummaries(ctx())).toBe(1);
    expect(kv.has('users/c1/notices/sum-c1-2026-10-21')).toBe(true);
  });
  it.each([
    ['Europe/Warsaw', Date.UTC(2026, 9, 25), '2026-10-25'], // falls back at 03:00 local
    ['Europe/Warsaw', Date.UTC(2026, 9, 26), '2026-10-26'], // the day after: 08:00 is 07:00 UTC now
    ['Europe/Warsaw', Date.UTC(2026, 2, 29), '2026-03-29'], // springs forward at 02:00 local
    ['America/New_York', Date.UTC(2026, 10, 1), '2026-11-01'], // falls back at 02:00 local
  ])(
    'DST: %s on %s: exactly one summary, dated that local day, sent at 08:00 local',
    async (tz, day, date) => {
      await device('t1', tz);
      await unread('t1');
      let made = 0;
      // 34 h from the afternoon before: contains the 08:00 local of `day` and of no other day
      for (let min = 0; min < 34 * 60; min += 15) {
        clock = day - 10 * H + min * 60_000;
        made += await runSummaries(ctx());
      }
      expect(made).toBe(1);
      const n = (await kv.list('users/t1/notices')).find((x) => x.data.kind === 'summary')!;
      expect(n.id).toBe(`sum-t1-${date}`);
      const m = localMinutes(Number(n.data.createdAt), tz);
      expect(m).toBeGreaterThanOrEqual(8 * 60);
      expect(m).toBeLessThan(8 * 60 + 30);
    },
  );
  it('the zone list follows the zone database: 08:00 in Kyiv is 05:00 UTC in summer, 06:00 in winter', () => {
    expect(zonesAtSummaryTime(Date.UTC(2026, 6, 1, 5, 0))).toContain('Europe/Kyiv');
    expect(zonesAtSummaryTime(Date.UTC(2026, 6, 1, 6, 0))).not.toContain('Europe/Kyiv');
    expect(zonesAtSummaryTime(Date.UTC(2026, 11, 1, 6, 0))).toContain('Europe/Kyiv');
    expect(localMinutes(Date.UTC(2026, 11, 1, 6, 0), 'Europe/Kyiv')).toBe(8 * 60);
  });
  it('runDaily reports both counts', async () => {
    expect(await runDaily(ctx())).toEqual({ unanswered: 0, summaries: 0 });
  });
});
