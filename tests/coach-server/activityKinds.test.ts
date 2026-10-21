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
  clientRemovalCancel,
  clientRemovalCreate,
  clientRemovalRespond,
  inviteClientForTrainer,
  SPOTTER_KINDS,
  teamActivity,
  teamInvite,
  teamLeave,
  teamLogActivity,
  teamNotices,
  teamRemoveMember,
  teamSetActivityScope,
} from '../../functions/src/coach/team';
import { ACTIVITY_RETENTION_MS, type ActivityKind } from '../../functions/src/coach/activity';
import { sweep } from '../../functions/src/coach/service';
import { DAY } from '../../functions/src/coach/logic';

// SPO-203 / SPO-238: one test per activity kind, the access change, the cursor and the 90-day retention.
let clock = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const client: Actor = { uid: 'c1', role: 'member' };
const mgr: Actor = { uid: 'm1', role: 'manager' };

let kv: MemoryKv;
const pushes: [string, string, string | undefined][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => clock,
  pepper: new Uint8Array(32),
  newToken: () => 'tok',
  notify: async (uid, kind, topic) => void pushes.push([uid, kind, topic]),
});
const req = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  from: 'trainer',
  via: 'manager',
  status: 'pending',
  createdAt: clock,
  expiresAt: clock + 3 * DAY,
  slotKey: 'slot-1',
  keyEpoch: 1,
  enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
  ...over,
});
const kinds = async () => (await kv.list('teams/t1/activity')).map((e) => e.data.kind);

beforeEach(async () => {
  clock = Date.UTC(2026, 9, 20, 9, 0, 0);
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
  await kv.list('teams/t1/activity').then((rows) => Promise.all(rows.map((r) => kv.del(r.path))));
  pushes.length = 0;
});

// A Record over every ActivityKind: adding a kind without a case here fails the type check.
const CASES: Record<ActivityKind, () => Promise<unknown>> = {
  'session-done': () => teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1' }),
  'session-missed': () => teamLogActivity(ctx(), mgr, { kind: 'session-missed', clientId: 'c1' }),
  'session-cancelled': () =>
    teamLogActivity(ctx(), mgr, { kind: 'session-cancelled', clientId: 'c1' }),
  'session-edited': () => teamLogActivity(ctx(), mgr, { kind: 'session-edited', clientId: 'c1' }),
  'move-request': () => rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() }),
  'move-cancel': async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    return rescheduleRespond(ctx(), mgr, { clientId: 'c1', id: 'r1', status: 'cancelled' });
  },
  'move-answer': async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    return rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'accepted' });
  },
  'removal-request': () => clientRemovalCreate(ctx(), mgr, { clientId: 'c1', reason: 'x' }),
  'removal-approved': async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1', reason: 'x' });
    return clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true });
  },
  'removal-declined': async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1', reason: 'x' });
    return clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false });
  },
  'removal-cancelled': async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1', reason: 'x' });
    return clientRemovalCancel(ctx(), mgr, { id: 'rm-c1' });
  },
  'member-added': async () => {
    await kv.set('users/m3', { role: 'member', status: 'active', firstName: 'Third' });
    const inv = await teamInvite(ctx(), owner, { email: 'third@example.com' });
    return acceptWithMail(ctx(), { uid: 'm3', role: 'member' }, { inviteId: inv.inviteId });
  },
  'member-removed': () => teamRemoveMember(ctx(), owner, { uid: 'm1' }),
  'member-left': () => teamLeave(ctx(), mgr),
  'client-invite': () =>
    inviteClientForTrainer(ctx(), mgr, { trainerId: 't1', name: 'New', mode: 'app' }),
  'access-change': () => teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' }),
};

describe('every activity kind is written by its function', () => {
  for (const [kind, run] of Object.entries(CASES))
    it(`${kind}`, async () => {
      await run();
      expect(await kinds()).toContain(kind);
      // metadata only: no sealed envelope, no free text, in any entry
      const text = JSON.stringify((await kv.list('teams/t1/activity')).map((e) => e.data));
      expect(text).not.toContain('"enc"');
      expect(text).not.toContain('"reason"');
    });
});

describe('access change (SPO-238)', () => {
  it('tells the manager in Spotter and by a content-free team push, once; logs who changed what', async () => {
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' });
    expect(pushes).toEqual([['m1', 'team', 'access']]);
    const log = (await kv.list('teams/t1/activity')).map((e) => e.data);
    expect(log).toMatchObject([
      { kind: 'access-change', actorUid: 't1', role: 'trainer', refId: 'm1', status: 'all' },
    ]);
    const n = await teamNotices(ctx(), mgr);
    expect(n.items).toMatchObject([{ kind: 'access', subjectName: 'all', unread: true }]);
    // the same position again changes nothing
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' });
    expect(pushes).toHaveLength(1);
    expect(await kinds()).toHaveLength(1);
    // and back
    clock += 1000;
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'own' });
    expect((await teamNotices(ctx(), mgr)).items).toHaveLength(2);
  });
});

describe('answers to a manager proposal (SPO-236)', () => {
  it('the proposing manager gets a move-answer notice with the status and a team push; the trainer is not re-notified', async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    pushes.length = 0;
    await rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'declined' });
    expect(pushes).toEqual([['m1', 'team', undefined]]);
    const n = await teamNotices(ctx(), mgr);
    expect(n.items).toMatchObject([
      { kind: 'move-answer', status: 'declined', refId: 'r1', subjectName: 'Oleh' },
    ]);
    const e = (await kv.list('teams/t1/activity')).find((x) => x.data.kind === 'move-answer')!;
    expect(e.data).toMatchObject({ actorUid: 'c1', role: 'client', status: 'declined' });
  });
  it('a request the client made itself writes nothing for managers', async () => {
    await rescheduleCreate(ctx(), client, {
      clientId: 'c1',
      request: req({ from: 'client', via: undefined }),
    });
    await rescheduleRespond(ctx(), owner, { clientId: 'c1', id: 'r1', status: 'accepted' });
    expect(await kinds()).not.toContain('move-answer');
  });
});

describe('Spotter kinds', () => {
  it('lists the kinds the decision names, and every one is readable through teamNotices', async () => {
    for (const k of ['move-answer', 'access', 'summary', 'reminder', 'unmarked', 'team'])
      expect(SPOTTER_KINDS).toContain(k);
    for (const k of SPOTTER_KINDS)
      await kv.set(`users/m1/notices/n-${k}`, {
        id: `n-${k}`,
        kind: k,
        actor: null,
        detail: null,
        createdAt: clock,
        readAt: null,
      });
    expect((await teamNotices(ctx(), mgr)).items.map((i) => i.kind).sort()).toEqual(
      [...SPOTTER_KINDS].sort(),
    );
  });
  it('time-bound kinds (unmarked, reminder, summary) are forgotten after 30 days; others stay', async () => {
    for (const k of ['unmarked', 'reminder', 'summary', 'team'])
      await kv.set(`users/m1/notices/old-${k}`, {
        id: `old-${k}`,
        kind: k,
        createdAt: clock - 31 * DAY,
        readAt: null,
      });
    expect((await teamNotices(ctx(), mgr)).items.map((i) => i.kind)).toEqual(['team']);
    expect(kv.has('users/m1/notices/old-summary')).toBe(false);
  });
});

describe('journal cursor and retention', () => {
  const seed = async () => {
    for (let i = 0; i < 5; i++) {
      clock += 60_000;
      await teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1' });
    }
    for (let i = 0; i < 3; i++) {
      clock += 60_000;
      await kv.set(`teams/t1/activity/o${i}`, {
        id: `o${i}`,
        actorUid: 't1',
        role: 'trainer',
        kind: 'member-added',
        refId: 'x',
        ts: clock,
      });
    }
  };
  it('pages newest first with a keyset cursor and never returns the whole journal', async () => {
    await seed();
    const p1 = await teamActivity(ctx(), owner, { limit: 3 });
    expect(p1.entries).toHaveLength(3);
    expect(p1.next).toBe(p1.entries[2].ts);
    const p2 = await teamActivity(ctx(), owner, { limit: 3, before: p1.next });
    const p3 = await teamActivity(ctx(), owner, { limit: 3, before: p2.next });
    const ids = [...p1.entries, ...p2.entries, ...p3.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(8);
    expect(p3.entries).toHaveLength(2);
    expect(p3.next).toBeNull();
    const ts = [...p1.entries, ...p2.entries, ...p3.entries].map((e) => e.ts);
    expect(ts).toEqual([...ts].sort((a, b) => b - a));
  });
  it('a manager with own scope pages only their own entries; all scope widens it', async () => {
    await seed();
    const own = await teamActivity(ctx(), mgr, { limit: 2 });
    expect(own.scope).toBe('own');
    expect(own.entries.every((e) => e.actorUid === 'm1')).toBe(true);
    const o2 = await teamActivity(ctx(), mgr, { limit: 10, before: own.next });
    expect(own.entries.length + o2.entries.length).toBe(5);
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' });
    expect((await teamActivity(ctx(), mgr, { limit: 50 })).entries.length).toBeGreaterThanOrEqual(
      8,
    );
  });
  it('the scheduled sweep deletes entries older than 90 days and keeps newer ones', async () => {
    await kv.set('teams/t1/activity/old', {
      id: 'old',
      kind: 'x',
      ts: clock - ACTIVITY_RETENTION_MS - 1,
    });
    await kv.set('teams/t1/activity/new', {
      id: 'new',
      kind: 'x',
      ts: clock - ACTIVITY_RETENTION_MS + DAY,
    });
    const r = await sweep(ctx());
    expect(r.activityPurged).toBe(1);
    expect(kv.has('teams/t1/activity/old')).toBe(false);
    expect(kv.has('teams/t1/activity/new')).toBe(true);
    expect(ACTIVITY_RETENTION_MS).toBe(90 * DAY);
  });
});
