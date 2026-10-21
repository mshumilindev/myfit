import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  rescheduleCreate,
  rescheduleRespond,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import {
  CLIENT_SPOTTER_KINDS,
  teamInvite,
  teamLeave,
  teamLogActivity,
  teamRemoveMember,
} from '../../functions/src/coach/team';
import { REMIND_BEFORE, runReminders, runSummaries } from '../../functions/src/coach/reminders';
import { DAY } from '../../functions/src/coach/logic';
import { shouldDeliver } from '../../functions/src/coach/pushPolicy';

// The client's own Spotter (users/{clientId}/notices): which kinds the server writes, metadata only.
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const client: Actor = { uid: 'c1', role: 'member' };
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
const req = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  from: 'trainer',
  status: 'pending',
  createdAt: clock,
  expiresAt: clock + 3 * DAY,
  slotKey: 'slot-1',
  keyEpoch: 1,
  enc: { v: 1, iv: 'A'.repeat(16), ct: 'SECRETSECRET'.repeat(10) },
  ...over,
});
const ALLOWED = [
  'id',
  'kind',
  'actor',
  'detail',
  'createdAt',
  'readAt',
  'refId',
  'status',
  'start',
  'count',
];
/** A client notice is metadata only: known keys, a name in `detail`, no sealed content, no reason, no session time. */
async function notices(uid = 'c1') {
  const rows = (await kv.list(`users/${uid}/notices`)).map((r) => r.data);
  for (const d of rows) {
    expect(Object.keys(d).filter((k) => !ALLOWED.includes(k))).toEqual([]);
    const text = JSON.stringify(d);
    expect(text).not.toContain('enc');
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('reason');
    expect(d.readAt).toBeNull();
    // the only times a notice may hold are its own creation and a reminder's start
    for (const [k, v] of Object.entries(d))
      if (typeof v === 'number') expect(['createdAt', 'start', 'count']).toContain(k);
  }
  return rows;
}

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
  await kv.set('users/c2', {
    role: 'member',
    status: 'active',
    firstName: 'Other',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
  for (const u of ['c1', 'c2', 't1', 'm1'])
    for (const r of await kv.list(`users/${u}/notices`)) await kv.del(r.path);
  pushes.length = 0;
});

it('the client kinds are the ones the client port lists', () => {
  expect([...CLIENT_SPOTTER_KINDS]).toEqual([
    'move-request',
    'move-answer',
    'session-done',
    'session-missed',
    'session-cancelled',
    'team',
    'access',
    'reminder',
    'summary',
  ]);
});

describe('move-request', () => {
  it('a trainer proposal lands in the client notices with the request id and the trainer name', async () => {
    await rescheduleCreate(ctx(), owner, { clientId: 'c1', request: req() });
    expect(await notices()).toMatchObject([
      { id: 'mv-r1', kind: 'move-request', refId: 'r1', detail: 'Olena', actor: 't1' },
    ]);
    expect(pushes).toContainEqual(['c1', 'request']);
  });
  it('a manager proposal names the manager; a resend does not duplicate or re-push', async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req({ via: 'manager' }) });
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req({ via: 'manager' }) });
    expect(await notices()).toMatchObject([{ kind: 'move-request', detail: 'Irina' }]);
    expect(pushes.filter(([u, k]) => u === 'c1' && k === 'request')).toHaveLength(1);
  });
  it("the client's own request writes nothing for the client", async () => {
    await rescheduleCreate(ctx(), client, { clientId: 'c1', request: req({ from: 'client' }) });
    expect(await notices()).toEqual([]);
  });
});

describe('move-answer', () => {
  it('the trainer answering the client request tells the client with the status', async () => {
    await rescheduleCreate(ctx(), client, { clientId: 'c1', request: req({ from: 'client' }) });
    await rescheduleRespond(ctx(), owner, { clientId: 'c1', id: 'r1', status: 'accepted' });
    expect(await notices()).toMatchObject([
      {
        id: 'ma-r1-accepted',
        kind: 'move-answer',
        status: 'accepted',
        refId: 'r1',
        detail: 'Olena',
      },
    ]);
    expect(pushes).toContainEqual(['c1', 'request']);
  });
  it('the client answering a proposal writes nothing for the client', async () => {
    await rescheduleCreate(ctx(), owner, { clientId: 'c1', request: req() });
    await rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'declined' });
    expect((await notices()).map((n) => n.kind)).toEqual(['move-request']);
  });
});

describe.each(['session-done', 'session-missed', 'session-cancelled'] as const)(
  '%s by a manager',
  (kind) => {
    it('tells the client and the trainer (names only, no times)', async () => {
      await teamLogActivity(ctx(), mgr, { kind, clientId: 'c1' });
      expect(await notices('c1')).toMatchObject([{ kind, detail: 'Irina', actor: 'm1' }]);
      expect(await notices('t1')).toMatchObject([{ kind, detail: 'Oleh', actor: 'm1' }]);
      expect(pushes.sort()).toEqual([
        ['c1', 'team'],
        ['t1', 'team'],
      ]);
    });
  },
);
it('session-edited is not announced to the client', async () => {
  await teamLogActivity(ctx(), mgr, { kind: 'session-edited', clientId: 'c1' });
  expect(await notices()).toEqual([]);
});

describe('team', () => {
  it('a manager joining tells every active client of the trainer (once each, name only); other trainers clients are not in the team', async () => {
    await kv.set('users/m2', { role: 'member', status: 'active', firstName: 'Second' });
    await kv.set('coaching/c3', { clientId: 'c3', trainerId: 'zz', status: 'active' });
    await kv.set('coaching/c4', { clientId: 'c4', trainerId: 't1', status: 'ended' });
    const inv = await teamInvite(ctx(), owner, { email: 'second@example.com' });
    await acceptWithMail(ctx(), { uid: 'm2', role: 'member' }, { inviteId: inv.inviteId });
    for (const c of ['c1', 'c2'])
      expect(await notices(c)).toMatchObject([{ kind: 'team', detail: 'Second', actor: 'm2' }]);
    expect(kv.paths().filter((p) => /^users\/c[34]\/notices/.test(p))).toEqual([]);
    expect(pushes.filter(([, k]) => k === 'team').map(([u]) => u)).toEqual(
      expect.arrayContaining(['c1', 'c2']),
    );
  });
  it('a manager leaving or being removed tells the clients', async () => {
    clock += 1000;
    await teamLeave(ctx(), mgr);
    expect(await notices('c1')).toMatchObject([{ kind: 'team', detail: 'Irina', actor: 'm1' }]);
    const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
    await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
    clock += 1000;
    await teamRemoveMember(ctx(), owner, { uid: 'm1' });
    expect((await notices('c2')).filter((n) => n.kind === 'team')).toHaveLength(3);
  });
  it('the team push follows the switch and is not held by quiet hours', () => {
    const quiet = { on: true, from: 0, to: 23 * 60 };
    expect(shouldDeliver('team', { quiet, tz: 'UTC' }, T0)).toBe(true);
    expect(shouldDeliver('team', { prefs: { team: false } }, T0)).toBe(false);
  });
});

describe('reminder', () => {
  it('the 18 h reminder also lands in the client notices with the session start and the trainer name, once', async () => {
    const start = T0 + REMIND_BEFORE + 3_600_000;
    await kv.set('schedules/c1', {
      clientId: 'c1',
      trainerId: 't1',
      rev: 1,
      enc: {},
      timing: { starts: [start], unmarked: [], dueAt: start - REMIND_BEFORE },
    });
    clock = start - REMIND_BEFORE + 60_000;
    await runReminders(ctx());
    await runReminders(ctx());
    expect(await notices()).toMatchObject([
      { id: `rm-c1-${start}`, kind: 'reminder', start, detail: 'Olena' },
    ]);
    expect(pushes.filter(([u, k]) => u === 'c1' && k === 'reminder')).toHaveLength(1);
  });
});

describe('summary', () => {
  it('a client with unread Spotter notices gets the 08:00 summary (count of client kinds), no push', async () => {
    await kv.set('users/c1/push/d1', { token: 'x', tz: 'Europe/Warsaw', updatedAt: T0 });
    await rescheduleCreate(ctx(), owner, { clientId: 'c1', request: req() });
    pushes.length = 0;
    clock = Date.UTC(2026, 9, 21, 6, 5);
    expect(await runSummaries(ctx())).toBe(1);
    expect(await notices()).toMatchObject([
      { kind: 'move-request' },
      { kind: 'summary', count: 1 },
    ]);
    expect(pushes).toEqual([]);
  });
});
