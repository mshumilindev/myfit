import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import { CoachError, type Actor, type Ctx } from '../../functions/src/coach/service';
import {
  teamAccept,
  teamDecline,
  teamInvite,
  teamInvitePreview,
  teamInviteRevoke,
  teamLeave,
  teamRead,
  teamRemoveMember,
  teamSetActivityScope,
} from '../../functions/src/coach/team';
import { DAY } from '../../functions/src/coach/logic';

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const trainer2: Actor = { uid: 't2', role: 'trainer' };
const mgr: Actor = { uid: 'm1', role: 'member' }; // a plain member account until it accepts
const mgrNow: Actor = { uid: 'm1', role: 'manager' };
const stranger: Actor = { uid: 'x9', role: 'member' };

let kv: MemoryKv;
let t = T0;
let n = 0;
const ctx = (): Ctx => ({
  kv,
  now: () => t,
  pepper: new Uint8Array(32),
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
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
async function seed() {
  await kv.set('users/t1', {
    role: 'trainer',
    status: 'active',
    firstName: 'Olena',
    lastName: 'Kovalenko',
  });
  await kv.set('users/t2', {
    role: 'trainer',
    status: 'active',
    firstName: 'Andriy',
    lastName: 'Petrenko',
  });
  await kv.set('users/m1', {
    role: 'member',
    status: 'active',
    firstName: 'Irina',
    lastName: 'Melnyk',
  });
  await kv.set('users/x9', { role: 'member', status: 'active', firstName: 'Stranger' });
}
const inviteManager = async (email = 'irina@example.com') => teamInvite(ctx(), owner, { email });
async function joined() {
  const inv = await inviteManager();
  await teamAccept(ctx(), mgr, { inviteId: inv.inviteId });
  return inv;
}

beforeEach(async () => {
  kv = createMemoryKv();
  t = T0;
  n = 0;
  await seed();
});

describe('team invites', () => {
  it('a trainer invites a MANAGER; the link has its own route (never the coaching one) and the team is created lazily', async () => {
    const r = await inviteManager();
    expect(r.url).toContain('#/team-invite/');
    expect(r.expiresAt).toBe(T0 + 7 * DAY);
    const s = await teamRead(ctx(), owner);
    expect(s.invites).toEqual([
      { id: r.inviteId, email: 'irina@example.com', role: 'manager', sentAt: T0 },
    ]);
    expect(s.me).toEqual({ uid: 't1', role: 'trainer', isOwner: true });
    expect(s.members.map((m) => m.name)).toEqual(['Olena Kovalenko']);
  });

  it('validates the e-mail, refuses a duplicate and caps pending invites', async () => {
    expect(await code(teamInvite(ctx(), owner, { email: 'nope' }))).toBe(
      'invalid-argument:invalid-email',
    );
    await inviteManager();
    expect(await code(inviteManager())).toBe('already-exists:invite-exists');
    for (let i = 0; i < 9; i++) await inviteManager(`m${i}@example.com`);
    expect(await code(inviteManager('over@example.com'))).toBe(
      'resource-exhausted:too-many-managers',
    );
  });

  it('a plain member cannot invite anyone', async () => {
    expect(await code(teamInvite(ctx(), stranger, { email: 'a@example.com' }))).toBe(
      'permission-denied:not-in-team',
    );
  });

  it('revoke: only the inviter or the owner; the link then closes', async () => {
    const r = await inviteManager();
    expect(await code(teamInviteRevoke(ctx(), stranger, { inviteId: r.inviteId }))).toBe(
      'permission-denied:not-your-invite',
    );
    await teamInviteRevoke(ctx(), owner, { inviteId: r.inviteId });
    expect(await code(teamAccept(ctx(), mgr, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:invite-closed',
    );
    expect((await teamRead(ctx(), owner)).invites).toEqual([]);
  });

  it('expires after seven days', async () => {
    const r = await inviteManager();
    t += 7 * DAY + 1;
    expect(await code(teamAccept(ctx(), mgr, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:invite-closed',
    );
    expect(await code(teamInvitePreview(ctx(), r.inviteId))).toBe(
      'failed-precondition:invite-closed',
    );
  });

  it('preview shows the role and names only', async () => {
    const r = await inviteManager();
    expect(await teamInvitePreview(ctx(), r.inviteId)).toEqual({
      role: 'manager',
      teamOwnerName: 'Olena Kovalenko',
      invitedByName: 'Olena Kovalenko',
      expiresAt: T0 + 7 * DAY,
    });
  });
});

describe('accepting', () => {
  it('a plain account becomes a manager of the team; the owner is told', async () => {
    const inv = await joined();
    const u = await kv.get('users/m1');
    expect(u).toMatchObject({ role: 'manager', teamId: 't1' });
    expect(await kv.get('teams/t1/members/m1')).toMatchObject({
      role: 'manager',
      status: 'active',
      addedBy: 't1',
    });
    expect(await kv.get('teams/t1/acl/m1')).toEqual({ activityScope: 'own' });
    expect(await kv.get(`teamInvites/${inv.inviteId}`)).toMatchObject({
      status: 'accepted',
      acceptedBy: 'm1',
    });
    expect(kv.has(`users/t1/notices/team-join-${inv.inviteId}`)).toBe(true);
    // the link cannot be reused
    expect(await code(teamAccept(ctx(), stranger, { inviteId: inv.inviteId }))).toBe(
      'failed-precondition:invite-closed',
    );
  });

  it('a manager invites a TRAINER; only a trainer account may accept, a member may not', async () => {
    await joined();
    const r = await teamInvite(ctx(), mgrNow, { email: 'andriy@example.com' });
    expect((await teamRead(ctx(), mgrNow)).invites[0].role).toBe('trainer');
    expect(await code(teamAccept(ctx(), stranger, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:account-not-eligible',
    );
    await teamAccept(ctx(), trainer2, { inviteId: r.inviteId });
    expect(await kv.get('users/t2')).toMatchObject({ role: 'trainer', teamId: 't1' });
    expect(await kv.get('teams/t1/members/t2')).toMatchObject({
      role: 'trainer',
      status: 'active',
    });
  });

  it('refuses a manager invite for an account that coaches or is coached; the inviter cannot join their own team', async () => {
    const r = await inviteManager();
    expect(await code(teamAccept(ctx(), owner, { inviteId: r.inviteId }))).toBe(
      'invalid-argument:cannot-join-own-team',
    );
    expect(await code(teamAccept(ctx(), trainer2, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:account-not-eligible',
    );
    await kv.set('coaching/m1', { status: 'active', trainerId: 't2' });
    expect(await code(teamAccept(ctx(), mgr, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:account-not-eligible',
    );
  });

  it('decline closes the invite and tells the inviter', async () => {
    const r = await inviteManager();
    await teamDecline(ctx(), mgr, { inviteId: r.inviteId });
    expect(await code(teamAccept(ctx(), mgr, { inviteId: r.inviteId }))).toBe(
      'failed-precondition:invite-closed',
    );
    expect(kv.has(`users/t1/notices/team-decline-${r.inviteId}`)).toBe(true);
  });
});

describe('removing and leaving', () => {
  it('only the owner trainer removes a manager; access ends at once', async () => {
    await joined();
    expect(await code(teamRemoveMember(ctx(), mgrNow, { uid: 'm1' }))).toBe(
      'permission-denied:owner-only',
    );
    expect(await code(teamRemoveMember(ctx(), owner, { uid: 't1' }))).toBe(
      'permission-denied:managers-only',
    );
    await teamRemoveMember(ctx(), owner, { uid: 'm1' });
    expect(await kv.get('teams/t1/members/m1')).toMatchObject({ status: 'removed' });
    expect(await kv.get('teams/t1/acl/m1')).toBeNull();
    expect(await kv.get('users/m1')).toMatchObject({ teamId: 'm1' });
    // the removed manager is no longer in the team and can read nothing of it
    expect(await code(teamRead(ctx(), mgrNow))).toBe('permission-denied:not-in-team');
    expect((await teamRead(ctx(), owner)).members.map((m) => m.uid)).toEqual(['t1']);
    expect(await code(teamRemoveMember(ctx(), owner, { uid: 'm1' }))).toBe('not-found:no-member');
  });

  it('anyone but the owner may leave on their own; the owner may not', async () => {
    await joined();
    expect(await code(teamLeave(ctx(), owner))).toBe('failed-precondition:owner-cannot-leave');
    await teamLeave(ctx(), mgrNow);
    expect(await kv.get('teams/t1/members/m1')).toMatchObject({ status: 'removed' });
    expect(kv.paths().some((p) => p.startsWith('users/t1/notices/team-left-m1'))).toBe(true);
  });

  it('can be invited again after removal', async () => {
    await joined();
    await teamRemoveMember(ctx(), owner, { uid: 'm1' });
    const r = await inviteManager('irina2@example.com');
    await teamAccept(ctx(), mgrNow, { inviteId: r.inviteId });
    expect(await kv.get('teams/t1/members/m1')).toMatchObject({
      status: 'active',
      role: 'manager',
    });
  });
});

describe('activity scope and the page data', () => {
  it("only the owner sets a manager's activity scope; the snapshot shows it to the owner only", async () => {
    await joined();
    expect(await code(teamSetActivityScope(ctx(), mgrNow, { uid: 'm1', scope: 'all' }))).toBe(
      'permission-denied:owner-only',
    );
    expect(await code(teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'wide' }))).toBe(
      'invalid-argument:invalid-scope',
    );
    expect(await code(teamSetActivityScope(ctx(), owner, { uid: 't1', scope: 'all' }))).toBe(
      'not-found:no-member',
    );
    await teamSetActivityScope(ctx(), owner, { uid: 'm1', scope: 'all' });
    const own = await teamRead(ctx(), owner);
    expect(own.members.find((m) => m.uid === 'm1')?.activityScope).toBe('all');
    const theirs = await teamRead(ctx(), mgrNow);
    expect(theirs.members.every((m) => m.activityScope === undefined)).toBe(true);
    expect(theirs.me).toEqual({ uid: 'm1', role: 'manager', isOwner: false });
    expect(theirs.ownerName).toBe('Olena Kovalenko');
  });

  it('a manager sees only the invites they sent; the owner sees all', async () => {
    await joined();
    await inviteManager('second@example.com');
    await teamInvite(ctx(), mgrNow, { email: 'trainer@example.com' });
    expect((await teamRead(ctx(), mgrNow)).invites.map((i) => i.email)).toEqual([
      'trainer@example.com',
    ]);
    expect((await teamRead(ctx(), owner)).invites).toHaveLength(2);
  });
});
