import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import type { Ctx } from '../../functions/src/coach/service';
import {
  REMIND_BEFORE,
  UNMARKED_AFTER,
  dueAtOf,
  runReminders,
} from '../../functions/src/coach/reminders';
import { teamInvite, teamNotices } from '../../functions/src/coach/team';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
let kv: MemoryKv;
let clock = T0;
const pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => clock,
  pepper: new Uint8Array(32),
  newToken: () => 'tok',
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
const sched = (timing: Record<string, unknown>) =>
  kv.set('schedules/c1', { clientId: 'c1', trainerId: 't1', rev: 1, enc: {}, timing });

beforeEach(async () => {
  kv = createMemoryKv();
  clock = T0;
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: 't1',
  });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), { uid: 't1', role: 'trainer' }, { email: 'i@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
  pushes.length = 0;
});

describe('runReminders', () => {
  it('does nothing before the moment, reminds the client at start - 18 h, once', async () => {
    const start = T0 + REMIND_BEFORE + 2 * H;
    await sched({ starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    expect(await runReminders(ctx())).toEqual({ schedules: 0, reminders: 0, unmarked: 0 });
    clock = start - REMIND_BEFORE + 60_000;
    expect(await runReminders(ctx())).toEqual({ schedules: 1, reminders: 1, unmarked: 0 });
    expect(pushes).toEqual([['c1', 'reminder']]);
    expect((await kv.get('schedules/c1'))?.timing).toMatchObject({ dueAt: 0 });
    clock += 20 * 60_000;
    expect(await runReminders(ctx())).toEqual({ schedules: 0, reminders: 0, unmarked: 0 });
    expect(pushes).toHaveLength(1);
  });

  it('is idempotent if the dueAt advance is lost (deterministic notice id)', async () => {
    const start = T0 + 20 * H;
    await sched({ starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE;
    await runReminders(ctx());
    await kv.merge('schedules/c1', { 'timing.dueAt': start - REMIND_BEFORE });
    expect(await runReminders(ctx())).toMatchObject({ reminders: 0 });
    expect(pushes).toHaveLength(1);
  });

  it('drops a reminder the job was too late for and keeps the next one', async () => {
    const s1 = T0 + 19 * H;
    const s2 = T0 + 48 * H;
    await sched({ starts: [s1, s2], unmarked: [], dueAt: s1 - REMIND_BEFORE });
    clock = s1 - REMIND_BEFORE + 6 * H; // 6 h late
    expect(await runReminders(ctx())).toMatchObject({ reminders: 0 });
    expect((await kv.get('schedules/c1'))?.timing).toMatchObject({ dueAt: s2 - REMIND_BEFORE });
  });

  it('tells the trainer and the manager about an unmarked session 2 h after it ended', async () => {
    const end = T0 - 3 * H;
    await sched({ starts: [], unmarked: [end], dueAt: end + UNMARKED_AFTER });
    clock = end + UNMARKED_AFTER;
    expect(await runReminders(ctx())).toMatchObject({ unmarked: 2 });
    expect(pushes.sort()).toEqual([
      ['m1', 'team'],
      ['t1', 'team'],
    ]);
    const mine = await teamNotices(ctx(), { uid: 't1', role: 'trainer' });
    expect(mine.items.filter((i) => i.kind === 'unmarked')).toMatchObject([
      { subjectName: 'Oleh', at: end, unread: true },
    ]);
  });

  it('a finished relationship gets nothing and the timer is cleared', async () => {
    await kv.merge('coaching/c1', { status: 'ended' });
    const start = T0 + 19 * H;
    await sched({ starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE;
    expect(await runReminders(ctx())).toEqual({ schedules: 1, reminders: 0, unmarked: 0 });
    expect(pushes).toEqual([]);
    expect((await kv.get('schedules/c1'))?.timing).toMatchObject({ dueAt: 0 });
  });

  it('forgets reminder log entries older than a month', async () => {
    await kv.set('users/c1/reminderLog/old', { start: 1, sentAt: T0 - 31 * 24 * H });
    const start = T0 + 20 * H;
    await sched({ starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE });
    clock = start - REMIND_BEFORE;
    await runReminders(ctx());
    expect(await kv.get('users/c1/reminderLog/old')).toBeNull();
  });

  it('"not marked" notices disappear after 30 days', async () => {
    await kv.set('users/t1/notices/um-c1-1', {
      id: 'um-c1-1',
      kind: 'unmarked',
      detail: 'Oleh',
      start: 1,
      createdAt: T0 - 31 * 24 * H,
      readAt: null,
    });
    const r = await teamNotices(ctx(), { uid: 't1', role: 'trainer' });
    expect(r.items.filter((i) => i.kind === 'unmarked')).toEqual([]);
    expect(await kv.get('users/t1/notices/um-c1-1')).toBeNull();
  });

  it('dueAtOf matches the client formula', () => {
    expect(dueAtOf({ starts: [REMIND_BEFORE + 10], unmarked: [] }, 0)).toBe(10);
    expect(dueAtOf({ starts: [], unmarked: [5] }, 0)).toBe(5 + UNMARKED_AFTER);
  });
});
