import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  NOTICE_RETENTION_MS,
  onConversationKey,
  rescheduleCreate,
  sweep,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import {
  teamActivity,
  teamInvite,
  teamLeave,
  teamLogActivity,
  teamNotices,
} from '../../functions/src/coach/team';
import { UNMARKED_AFTER, runReminders } from '../../functions/src/coach/reminders';
import {
  REMINDERS_PER_DAY,
  REPORTS_PER_HOUR,
  safeName,
  NAME_MAX,
} from '../../functions/src/coach/guards';
import { DAY } from '../../functions/src/coach/logic';

// Findings of the independent security review, each verified against the code first.
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const H = 3_600_000;
const owner: Actor = { uid: 't1', role: 'trainer' };
const mgr: Actor = { uid: 'm1', role: 'manager' };
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

beforeEach(async () => {
  clock = T0;
  kv = createMemoryKv();
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
  for (const u of ['c1', 't1', 'm1'])
    for (const r of await kv.list(`users/${u}/notices`)) await kv.del(r.path);
  for (const r of await kv.list('teams/t1/activity')) await kv.del(r.path);
  pushes.length = 0;
});

describe('M1: notices expire', () => {
  it('the sweep deletes every notice older than 30 days (any user, any kind) and keeps newer ones', async () => {
    const old = T0 - NOTICE_RETENTION_MS - 1000;
    for (const [u, k] of [
      ['c1', 'team'],
      ['t1', 'unmarked'],
      ['m1', 'access'],
      ['c1', 'program-updated'],
    ])
      await kv.set(`users/${u}/notices/old-${k}`, {
        id: `old-${k}`,
        kind: k,
        createdAt: old,
        readAt: null,
      });
    await kv.set('users/c1/notices/fresh', {
      id: 'fresh',
      kind: 'team',
      createdAt: T0 - DAY,
      readAt: null,
    });
    const r = await sweep(ctx());
    expect(r.noticesPurged).toBe(4);
    expect(kv.paths().filter((p) => p.includes('/notices/'))).toEqual(['users/c1/notices/fresh']);
  });
  it('a reminder (it holds the session start) goes 24 h after that start, not 30 days later', async () => {
    const start = T0 - DAY - H;
    await kv.set('users/c1/notices/rm-old', {
      id: 'rm-old',
      kind: 'reminder',
      start,
      createdAt: start - 18 * H,
      readAt: null,
    });
    await kv.set('users/c1/notices/rm-new', {
      id: 'rm-new',
      kind: 'reminder',
      start: T0 + 5 * H,
      createdAt: T0 - 13 * H,
      readAt: null,
    });
    await kv.set('users/c1/notices/rq-1', {
      id: 'rq-1',
      kind: 'reminder',
      createdAt: T0 - 2 * DAY,
      readAt: null,
    });
    const r = await sweep(ctx());
    expect(r.noticesPurged).toBe(1);
    expect(kv.has('users/c1/notices/rm-old')).toBe(false);
    expect(kv.has('users/c1/notices/rm-new')).toBe(true);
    expect(kv.has('users/c1/notices/rq-1')).toBe(true); // no start in it: the 30-day rule
  });
});

describe('M2: a trainer joining or leaving a team with managers tells their clients', () => {
  it('joins: their clients get a team notice with the trainer name; leaves: again', async () => {
    await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
    await kv.set('users/c2', { role: 'member', status: 'active', firstName: 'Z', trainerId: 't2' });
    await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't2', status: 'active', keyEpoch: 1 });
    const inv = await teamInvite(ctx(), owner, { email: 't2@example.com', role: 'trainer' });
    await acceptWithMail(ctx(), { uid: 't2', role: 'trainer' }, { inviteId: inv.inviteId });
    expect((await kv.list('users/c2/notices')).map((n) => n.data)).toMatchObject([
      { kind: 'team', detail: 'Andriy', actor: 't2' },
    ]);
    expect(await kv.list('users/c1/notices')).toHaveLength(0); // t1's clients are not told about t2
    expect(pushes).toContainEqual(['c2', 'team']);
    clock += H;
    await teamLeave(ctx(), { uid: 't2', role: 'trainer' });
    expect(
      (await kv.list('users/c2/notices')).filter((n) => String(n.id).startsWith('tl-')),
    ).toHaveLength(1);
  });
  it('a team without managers tells nobody', async () => {
    await kv.set('teams/t1/members/m1', { uid: 'm1', role: 'manager', status: 'removed' });
    await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
    await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't2', status: 'active', keyEpoch: 1 });
    const inv = await teamInvite(ctx(), owner, { email: 't2@example.com', role: 'trainer' });
    await acceptWithMail(ctx(), { uid: 't2', role: 'trainer' }, { inviteId: inv.inviteId });
    expect(await kv.list('users/c2/notices')).toHaveLength(0);
  });
});

describe('M3: reminder timing is bounded and capped per person', () => {
  const sched = (id: string, timing: Record<string, unknown>) =>
    kv.set(`schedules/${id}`, { clientId: id, trainerId: 't1', rev: 1, enc: {}, timing });
  it('ignores moments far in the past or future', async () => {
    const e = T0 - 40 * DAY; // an "unmarked" session 40 days old
    await sched('c1', { starts: [T0 + 90 * DAY], unmarked: [e, T0 + 5 * DAY], dueAt: T0 - 1 });
    const r = await runReminders(ctx());
    expect(r).toMatchObject({ reminders: 0, unmarked: 0 });
    expect(await kv.list('users/t1/notices')).toHaveLength(0);
  });
  it('still sends for a moment inside the window', async () => {
    const e = T0 - UNMARKED_AFTER - H;
    await sched('c1', { starts: [], unmarked: [e], dueAt: T0 - 1 });
    expect((await runReminders(ctx())).unmarked).toBeGreaterThan(0);
  });
  it(`one person gets at most ${REMINDERS_PER_DAY} reminder/unmarked notices and pushes a day`, async () => {
    const e = T0 - UNMARKED_AFTER - H;
    for (let i = 0; i < REMINDERS_PER_DAY + 10; i++) {
      await kv.set(`users/x${i}`, { role: 'member', status: 'active', firstName: 'X' });
      await kv.set(`coaching/x${i}`, {
        clientId: `x${i}`,
        trainerId: 't1',
        status: 'active',
        keyEpoch: 1,
      });
      await kv.set(`schedules/x${i}`, {
        clientId: `x${i}`,
        trainerId: 't1',
        rev: 1,
        enc: {},
        timing: { starts: [], unmarked: [e + i], dueAt: T0 - 1 },
      });
    }
    const batches = [await runReminders(ctx()), await runReminders(ctx())];
    expect(batches.length).toBe(2);
    const mine = (await kv.list('users/t1/notices')).filter((n) => n.data.kind === 'unmarked');
    expect(mine).toHaveLength(REMINDERS_PER_DAY);
    expect(pushes.filter(([u]) => u === 't1')).toHaveLength(REMINDERS_PER_DAY);
    // the next UTC day starts a new allowance
    clock += DAY;
    await kv.set('schedules/x0', {
      clientId: 'x0',
      trainerId: 't1',
      rev: 1,
      enc: {},
      timing: { starts: [], unmarked: [clock - UNMARKED_AFTER - H], dueAt: clock - 1 },
    });
    await runReminders(ctx());
    expect(
      (await kv.list('users/t1/notices')).filter((n) => n.data.kind === 'unmarked'),
    ).toHaveLength(REMINDERS_PER_DAY + 1);
  });
});

describe('M5: the published conversation epoch is mirrored onto coaching for the schedule rules', () => {
  it('a new epoch is written to coaching.convEpoch; an unchanged one and a missing coaching are no-ops', async () => {
    const conv = (keyEpoch: number) => ({ clientId: 'c1', trainerId: 't1', keyEpoch });
    await kv.set('conversations/cid1', conv(2));
    await onConversationKey(ctx(), 'cid1', conv(1), conv(2));
    expect(await kv.get('coaching/c1')).toMatchObject({ keyEpoch: 1, convEpoch: 2 });
    await kv.merge('coaching/c1', { convEpoch: 9 });
    await onConversationKey(ctx(), 'cid1', conv(2), conv(2)); // a pointer change, same epoch
    expect((await kv.get('coaching/c1'))?.convEpoch).toBe(9);
    await kv.set('conversations/cid3', { clientId: 'ghost', trainerId: 't1', keyEpoch: 1 });
    await onConversationKey(ctx(), 'cid3', null, {
      clientId: 'ghost',
      trainerId: 't1',
      keyEpoch: 1,
    });
    expect(kv.has('coaching/ghost')).toBe(false);
  });
});

describe('L2: activity reports are idempotent, validated and rate limited', () => {
  it('the same opId is one entry, one set of notices and one push; a different opId is another', async () => {
    const body = { kind: 'session-done', clientId: 'c1', opId: 'op-AAAAAAAA1' };
    await teamLogActivity(ctx(), mgr, body);
    pushes.length = 0;
    await teamLogActivity(ctx(), mgr, body);
    clock += 5000; // a retry arriving later is still the same report
    await teamLogActivity(ctx(), mgr, body);
    expect(pushes).toEqual([]);
    expect(await kv.list('teams/t1/activity')).toHaveLength(1);
    expect(await kv.list('users/c1/notices')).toHaveLength(1);
    await teamLogActivity(ctx(), mgr, { ...body, opId: 'op-BBBBBBBB2' });
    expect(await kv.list('teams/t1/activity')).toHaveLength(2);
  });
  it('rejects a malformed opId and an unknown kind; no opId still works (older apps)', async () => {
    const code = async (p: Promise<unknown>) =>
      p.then(
        () => 'ok',
        (e) => `${e.code}:${e.reason}`,
      );
    expect(
      await code(teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1', opId: 'x' })),
    ).toBe('invalid-argument:invalid-op');
    expect(
      await code(
        teamLogActivity(ctx(), mgr, {
          kind: 'session-done',
          clientId: 'c1',
          opId: 'a/b/c/d/e/f/g/h',
        }),
      ),
    ).toBe('invalid-argument:invalid-op');
    expect(
      await code(teamLogActivity(ctx(), mgr, { kind: 'delete-everything', clientId: 'c1' })),
    ).toBe('invalid-argument:invalid-kind');
    expect(
      await code(teamLogActivity(ctx(), mgr, { kind: 'session-edited', clientId: 'c1' })),
    ).toBe('ok');
  });
  it(`a manager can send ${REPORTS_PER_HOUR} reports an hour; the next hour starts over`, async () => {
    for (let i = 0; i < REPORTS_PER_HOUR; i++)
      await teamLogActivity(ctx(), mgr, {
        kind: 'session-edited',
        clientId: 'c1',
        opId: `op-${String(i).padStart(8, '0')}`,
      });
    const over = teamLogActivity(ctx(), mgr, {
      kind: 'session-edited',
      clientId: 'c1',
      opId: 'op-overflow1',
    });
    await expect(over).rejects.toMatchObject({
      code: 'resource-exhausted',
      reason: 'too-many-reports',
    });
    clock += H;
    await expect(
      teamLogActivity(ctx(), mgr, { kind: 'session-edited', clientId: 'c1', opId: 'op-overflow1' }),
    ).resolves.toEqual({ ok: true });
  });
});

const hasBad = (t: string) => [...t].some((c) => c.charCodeAt(0) < 32 || c === '\u202e');

describe('L4: names copied into notices are cleaned', () => {
  it('control characters, bidi overrides and zero-width marks go; the length is capped', () => {
    expect(safeName('Ol\u0000e‮h​\n\tK')).toBe('Ol e h K');
    expect(safeName('x'.repeat(500))).toHaveLength(NAME_MAX);
    expect(safeName(['😀'.repeat(100)].join(''))).toBe('😀'.repeat(NAME_MAX));
    expect(safeName(42)).toBe('');
  });
  it('a hostile profile name arrives in a notice cleaned', async () => {
    await kv.merge('users/c1', { firstName: `Ol‮eh\u0007${'z'.repeat(200)}` });
    await rescheduleCreate(ctx(), owner, {
      clientId: 'c1',
      request: {
        id: 'r1',
        from: 'trainer',
        status: 'pending',
        createdAt: clock,
        expiresAt: clock + DAY,
        slotKey: 's',
        keyEpoch: 1,
        enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
      },
    });
    await kv.merge('users/t1', { lastName: 'Q\u0000' });
    const n = (await teamNotices(ctx(), owner)).items;
    expect(n.every((i) => !hasBad(i.subjectName + i.actorName))).toBe(true);
    const c1 = await kv.get('users/c1/notices/mv-r1');
    expect(hasBad(String(c1?.detail))).toBe(false);
    expect(String(c1?.detail).length).toBeLessThanOrEqual(NAME_MAX);
  });
});

describe('L7: the journal cursor does not skip rows that share a millisecond', () => {
  it('(ts, id) paging returns every row exactly once, newest first', async () => {
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5'])
      await kv.set(`teams/t1/activity/${id}`, {
        id,
        actorUid: 't1',
        role: 'trainer',
        kind: 'member-added',
        refId: 'x',
        ts: T0,
      });
    await kv.set('teams/t1/activity/newer', {
      id: 'newer',
      actorUid: 't1',
      role: 'trainer',
      kind: 'member-added',
      refId: 'x',
      ts: T0 + 1,
    });
    await kv.set('teams/t1/activity/older', {
      id: 'older',
      actorUid: 't1',
      role: 'trainer',
      kind: 'member-added',
      refId: 'x',
      ts: T0 - 1,
    });
    const seen: string[] = [];
    let cur: { before?: number; beforeId?: string } = {};
    for (let i = 0; i < 10; i++) {
      const p = await teamActivity(ctx(), owner, { limit: 2, ...cur });
      seen.push(...p.entries.map((e) => e.id));
      if (p.next === null) break;
      cur = { before: p.next, beforeId: p.nextId ?? undefined };
    }
    expect(seen).toEqual(['newer', 'a5', 'a4', 'a3', 'a2', 'a1', 'older']);
  });
  it('an older caller that sends only `before` still works (it just may skip same-millisecond rows)', async () => {
    for (const id of ['a1', 'a2', 'a3'])
      await kv.set(`teams/t1/activity/${id}`, {
        id,
        actorUid: 't1',
        role: 'trainer',
        kind: 'member-added',
        ts: T0,
      });
    const p1 = await teamActivity(ctx(), owner, { limit: 2 });
    expect(p1.entries.map((e) => e.id)).toEqual(['a3', 'a2']);
    expect(p1.next).toBe(T0);
    expect(p1.nextId).toBe('a2');
    const p2 = await teamActivity(ctx(), owner, { limit: 2, before: p1.next! });
    expect(p2.entries).toEqual([]);
  });
});

describe('SPO-267 L11 / L6 follow-ups', () => {
  it('L11: writing the same notice again keeps it read', async () => {
    const { notice } = await import('../../functions/src/coach/service');
    const store = new Map<string, unknown>();
    const kv = {
      get: async (p: string) => store.get(p) ?? null,
      set: async (p: string, v: unknown) => void store.set(p, v),
    } as never;
    await notice(kv, 'u1', 'team', 'a', 1000, 'n1');
    const path = 'users/u1/notices/n1';
    store.set(path, { ...(store.get(path) as object), readAt: 1500 });
    await notice(kv, 'u1', 'team', 'a', 2000, 'n1');
    expect(store.get(path)).toMatchObject({ createdAt: 1000, readAt: 1500 });
  });

  it('L6: localDate follows the zone and falls back to UTC for an unknown one', async () => {
    const { localDate } = await import('../../functions/src/coach/pushPolicy');
    const at = Date.UTC(2026, 9, 21, 23, 30);
    expect(localDate(at, 'Europe/Warsaw')).toBe('2026-10-22');
    expect(localDate(at, 'Not/AZone')).toBe('2026-10-21');
    expect(localDate(at, undefined)).toBe('2026-10-21');
  });
});
