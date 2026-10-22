import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  CoachError,
  coachEnd,
  rescheduleCreate,
  rescheduleRespond,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import {
  teamForClient,
  inviteClientForTrainer,
  teamInvite,
  teamLogActivity,
  teamNotices,
  teamNoticesRead,
  teamLeave,
  teamRead,
  teamRemoveMember,
} from '../../functions/src/coach/team';
import { DAY, conversationId } from '../../functions/src/coach/logic';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const client: Actor = { uid: 'c1', role: 'member' };
const mgr: Actor = { uid: 'm1', role: 'manager' };
const outsider: Actor = { uid: 'm2', role: 'manager' };

let kv: MemoryKv;
const pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => T0,
  pepper: new Uint8Array(32),
  newToken: () => 'tok',
  notify: async (uid, kind) => void pushes.push([uid, kind]),
});
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CoachError) return `${e.code}:${e.reason}`;
    throw e;
  }
  return 'ok';
}
const req = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  from: 'trainer',
  via: 'manager',
  status: 'pending',
  createdAt: T0,
  expiresAt: T0 + 3 * DAY,
  slotKey: 'slot-1',
  keyEpoch: 1,
  enc: { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) },
  ...over,
});

beforeEach(async () => {
  kv = createMemoryKv();
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/m2', { role: 'manager', status: 'active', firstName: 'Other' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Oleh',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
  pushes.length = 0;
});

describe('manager reschedule requests', () => {
  it('a team manager proposes on the trainer side; the CLIENT is notified and answers; the action is logged', async () => {
    expect(await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() })).toEqual({
      id: 'r1',
      already: false,
    });
    expect(pushes).toEqual([
      ['t1', 'team'],
      ['c1', 'request'],
    ]);
    const log = (await kv.list('teams/t1/activity')).filter((l) => l.data.actorUid === 'm1');
    expect(log.map((l) => l.data)).toMatchObject([
      { actorUid: 'm1', role: 'manager', kind: 'move-request', clientId: 'c1', refId: 'r1' },
    ]);
    expect(
      await rescheduleRespond(ctx(), client, { clientId: 'c1', id: 'r1', status: 'accepted' }),
    ).toEqual({
      id: 'r1',
      status: 'accepted',
    });
  });

  it('the manager must mark the proposal `via: manager`; nobody else may; a manager outside the team is refused', async () => {
    expect(
      await code(
        rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req({ via: undefined }) }),
      ),
    ).toBe('invalid-argument:bad-request');
    expect(await code(rescheduleCreate(ctx(), owner, { clientId: 'c1', request: req() }))).toBe(
      'invalid-argument:bad-request',
    );
    expect(await code(rescheduleCreate(ctx(), outsider, { clientId: 'c1', request: req() }))).toBe(
      'permission-denied:not-allowed',
    );
  });

  it('a manager only withdraws a manager proposal; the trainer can withdraw it too; neither may answer for the client', async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    expect(
      await code(rescheduleRespond(ctx(), mgr, { clientId: 'c1', id: 'r1', status: 'accepted' })),
    ).toBe('permission-denied:not-allowed');
    expect(
      await code(rescheduleRespond(ctx(), owner, { clientId: 'c1', id: 'r1', status: 'accepted' })),
    ).toBe('failed-precondition:cannot-decide');
    expect(
      await rescheduleRespond(ctx(), mgr, { clientId: 'c1', id: 'r1', status: 'cancelled' }),
    ).toMatchObject({
      status: 'cancelled',
    });
    await rescheduleCreate(ctx(), mgr, {
      clientId: 'c1',
      request: req({ id: 'r2', slotKey: 's2' }),
    });
    expect(
      await rescheduleRespond(ctx(), owner, { clientId: 'c1', id: 'r2', status: 'cancelled' }),
    ).toMatchObject({ status: 'cancelled' });
  });

  it('a manager cannot answer or cancel a request the client made', async () => {
    await rescheduleCreate(ctx(), client, {
      clientId: 'c1',
      request: req({ from: 'client', via: undefined, id: 'rc' }),
    });
    expect(
      await code(rescheduleRespond(ctx(), mgr, { clientId: 'c1', id: 'rc', status: 'cancelled' })),
    ).toBe('permission-denied:not-allowed');
  });

  it('the manager reports an edit of the schedule for the log; only a manager, only own team, only known kinds', async () => {
    await teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1' });
    expect((await kv.list('teams/t1/activity')).map((l) => l.data.kind)).toContain('session-done');
    expect(await code(teamLogActivity(ctx(), mgr, { kind: 'drop-table', clientId: 'c1' }))).toBe(
      'invalid-argument:invalid-kind',
    );
    expect(
      await code(teamLogActivity(ctx(), owner, { kind: 'session-done', clientId: 'c1' })),
    ).toBe('permission-denied:managers-only');
    await kv.set('coaching/c9', { clientId: 'c9', trainerId: 'zz', status: 'active' });
    expect(await code(teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c9' }))).toBe(
      'permission-denied:not-your-team',
    );
  });
});

describe('team activity log', () => {
  it('records team events and the removal flow; the owner reads all, a manager only own until the owner widens it', async () => {
    const { clientRemovalCreate, clientRemovalRespond, teamActivity, teamSetActivityScope } =
      await import('../../functions/src/coach/team');
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1', reason: 'x' });
    await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false });
    await teamLogActivity(ctx(), mgr, { kind: 'session-done', clientId: 'c1' });
    const all = await teamActivity(ctx(), owner);
    expect(all.scope).toBe('owner');
    expect(all.entries.map((e) => e.kind).sort()).toEqual(
      ['member-added', 'removal-declined', 'removal-request', 'session-done'].sort(),
    );
    expect(all.entries.find((e) => e.kind === 'removal-request')?.liveStatus).toBe('declined');
    const added = all.entries.find((e) => e.kind === 'member-added')!;
    expect(added).toMatchObject({ actorName: 'Olena', subjectName: 'Irina', role: 'trainer' });
    const own = await teamActivity(ctx(), mgr);
    expect(own.scope).toBe('own');
    expect(own.entries.map((e) => e.actorUid)).toEqual(['m1', 'm1']);
    expect(own.entries.every((e) => e.actorName === 'Irina')).toBe(true);
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' });
    // the four earlier entries plus the owner's own `access-change` (SPO-238)
    expect((await teamActivity(ctx(), mgr)).entries).toHaveLength(5);
    expect(await code(teamActivity(ctx(), client))).toBe('permission-denied:not-in-team');
  });
});

describe('manager schedule access on the Team page', () => {
  it('the owner sees how many team clients delegated the schedule key to each manager; a manager does not', async () => {
    const mgrOf = async () =>
      (await teamRead(ctx(), owner)).members.find((m) => m.uid === 'm1')?.scheduleReady;
    expect(await mgrOf()).toEqual({ ready: 0, total: 1 });
    const { teamClients } = await import('../../functions/src/coach/team');
    const { clients } = await teamClients(ctx(), mgr);
    await kv.set(`conversations/${clients[0]!.cid}/delegations/m1`, { keyEpoch: 1 });
    expect(await mgrOf()).toEqual({ ready: 1, total: 1 });
    const asMgr = await teamRead(ctx(), mgr);
    expect(asMgr.members.every((m) => m.scheduleReady === undefined)).toBe(true);
  });
});

describe('Spotter service messages', () => {
  it('a manager proposal and a joining manager reach the trainer; read marks them; a client sees none', async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    const s = await teamNotices(ctx(), owner);
    const kinds = s.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['manager-move', 'team']);
    const mv = s.items.find((i) => i.kind === 'manager-move')!;
    expect(mv).toMatchObject({ actorName: 'Irina', subjectName: 'Oleh', unread: true });
    expect(s.unread).toBe(2);
    await teamNoticesRead(ctx(), owner);
    expect((await teamNotices(ctx(), owner)).unread).toBe(0);
    // a client sees none of the staff messages; only its own "a manager joined" notice (SPO-236 client Spotter)
    expect((await teamNotices(ctx(), client)).items.map((i) => i.kind)).toEqual(['team']);
    expect(pushes).toContainEqual(['t1', 'team']);
  });
});

describe('the client sees the team and the manager actions about them', () => {
  it('lists the team (names and roles) and only manager actions about this client', async () => {
    await rescheduleCreate(ctx(), mgr, { clientId: 'c1', request: req() });
    await teamLogActivity(ctx(), mgr, { clientId: 'c1', kind: 'session-done' });
    await kv.set('users/c2', {
      role: 'member',
      status: 'active',
      firstName: 'Other',
      trainerId: 't1',
    });
    await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't1', status: 'active', keyEpoch: 1 });
    await teamLogActivity(ctx(), mgr, { clientId: 'c2', kind: 'session-missed' });
    const v = await teamForClient(ctx(), client);
    expect(v.trainerName).toBe('Olena');
    expect(v.members).toEqual([
      { name: 'Irina', role: 'manager' },
      { name: 'Olena', role: 'trainer' },
    ]);
    expect(v.actions.map((a) => a.kind).sort()).toEqual(['move-request', 'session-done']);
    expect(v.actions.every((a) => a.actorName === 'Irina')).toBe(true);
  });
  it('a client of a trainer with no manager sees no team', async () => {
    await kv.set('users/t9', { role: 'trainer', status: 'active', firstName: 'Solo' });
    await kv.set('users/c9', { role: 'member', status: 'active', firstName: 'X', trainerId: 't9' });
    await kv.set('coaching/c9', { clientId: 'c9', trainerId: 't9', status: 'active', keyEpoch: 1 });
    expect((await teamForClient(ctx(), { uid: 'c9', role: 'member' })).members).toEqual([]);
  });
});

describe('a manager invites a client for a team trainer', () => {
  it('creates the trainer invite, logs it, tells the trainer; outsiders and non-managers are refused', async () => {
    const r = await inviteClientForTrainer(ctx(), mgr, {
      trainerId: 't1',
      name: 'New Client',
      mode: 'app',
    });
    expect(r.url).toContain('tok');
    expect(await kv.get('invites/tok')).toMatchObject({
      trainerId: 't1',
      displayName: 'New Client',
    });
    expect(pushes).toContainEqual(['t1', 'team']);
    const log = (await kv.list('teams/t1/activity')).map((e) => e.data.kind);
    expect(log).toContain('client-invite');
    await kv.set('users/t7', { role: 'trainer', status: 'active', firstName: 'Far' });
    expect(
      await code(
        inviteClientForTrainer(ctx(), mgr, { trainerId: 't7', name: 'Zed Zed', mode: 'app' }),
      ),
    ).toBe('permission-denied:not-your-team');
    expect(
      await code(
        inviteClientForTrainer(ctx(), owner, { trainerId: 't1', name: 'Zed Zed', mode: 'app' }),
      ),
    ).toBe('permission-denied:managers-only');
    for (const extra of [{ mode: 'program' }, { mode: 'chat', username: 'someone' }])
      expect(
        await code(
          inviteClientForTrainer(ctx(), mgr, { trainerId: 't1', name: 'Zed Zed', ...extra }),
        ),
      ).toBe('permission-denied:app-invite-only');
  });
});

describe('delegations follow the team (ADR 005)', () => {
  const cid = conversationId(new Uint8Array(32), 'c1', 't1');
  const seedDelegations = async () => {
    await kv.set(`conversations/${cid}`, { clientId: 'c1', active: true, keyEpoch: 1 });
    await kv.set(`conversations/${cid}/delegations/m1`, { keyEpoch: 1 });
    await kv.set(`conversations/${cid}/delegations/m3`, { keyEpoch: 1 });
  };
  const has = async (uid: string) => !!(await kv.get(`conversations/${cid}/delegations/${uid}`));

  it('a manager who joins asks every client of the team to delegate, with a silent sync push', async () => {
    await kv.set('users/m3', { role: 'member', status: 'active', firstName: 'Third' });
    const inv = await teamInvite(ctx(), owner, { email: 'third@example.com' });
    pushes.length = 0;
    await acceptWithMail(ctx(), { uid: 'm3', role: 'member' }, { inviteId: inv.inviteId });
    expect(pushes).toContainEqual(['c1', 'sync']);
    // a trainer joining the team does not (nothing to delegate)
    await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
    const inv2 = await teamInvite(
      ctx(),
      { uid: 'm3', role: 'manager' },
      { email: 'a@example.com' },
    );
    pushes.length = 0;
    await acceptWithMail(ctx(), { uid: 't2', role: 'trainer' }, { inviteId: inv2.inviteId });
    expect(pushes.filter(([, k]) => k === 'sync')).toEqual([]);
  });

  it("removing a manager deletes their delegations and nobody else's", async () => {
    await seedDelegations();
    await teamRemoveMember(ctx(), owner, { uid: 'm1' });
    expect(await has('m1')).toBe(false);
    expect(await has('m3')).toBe(true);
  });

  it('a manager who leaves deletes their own delegations', async () => {
    await seedDelegations();
    await teamLeave(ctx(), mgr);
    expect(await has('m1')).toBe(false);
    expect(await has('m3')).toBe(true);
  });

  it('a client who leaves the trainer takes every delegation of the conversation with the key', async () => {
    await seedDelegations();
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await has('m1')).toBe(false);
    expect(await has('m3')).toBe(false);
  });
});
