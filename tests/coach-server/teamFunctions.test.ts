import { acceptWithMail } from './acceptHelper';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import { CoachError, coachEnd, type Actor, type Ctx } from '../../functions/src/coach/service';
import {
  MAX_TEAM_INVITES_PENDING,
  clientRemovalCancel,
  clientRemovalCreate,
  clientRemovalRespond,
  inviteClientForTrainer,
  teamAccept,
  teamDecline,
  teamInvite,
  teamInvitePreview,
  teamInviteRevoke,
  teamLeave,
  teamRead,
  teamRemoveMember,
  teamRequests,
  teamSetActivityScope,
} from '../../functions/src/coach/team';
import { DAY } from '../../functions/src/coach/logic';

// SPO-199: the cells of the function x outcome matrix (allowed / forbidden / duplicate / expired / wrong role) that the
// feature tests (team*.test.ts) do not already pin, plus the open-request-vs-inactive-client rule.
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const owner: Actor = { uid: 't1', role: 'trainer' };
const trainer2: Actor = { uid: 't2', role: 'trainer' };
const mgr: Actor = { uid: 'm1', role: 'manager' };
const client: Actor = { uid: 'c1', role: 'member' };
const stranger: Actor = { uid: 'x9', role: 'member' };

let kv: MemoryKv;
let t = T0;
let n = 0;
const pushes: [string, string][] = [];
const ctx = (): Ctx => ({
  kv,
  now: () => t,
  pepper: new Uint8Array(32),
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
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

beforeEach(async () => {
  kv = createMemoryKv();
  t = T0;
  n = 0;
  pushes.length = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active', firstName: 'Olena' });
  await kv.set('users/t2', { role: 'trainer', status: 'active', firstName: 'Andriy' });
  await kv.set('users/m1', { role: 'member', status: 'active', firstName: 'Irina' });
  await kv.set('users/x9', { role: 'member', status: 'active', firstName: 'Stranger' });
  await kv.set('users/c1', {
    role: 'member',
    status: 'active',
    firstName: 'Sofiia',
    trainerId: 't1',
  });
  await kv.set('coaching/c1', { clientId: 'c1', trainerId: 't1', status: 'active', keyEpoch: 1 });
  const inv = await teamInvite(ctx(), owner, { email: 'irina@example.com' });
  await acceptWithMail(ctx(), { uid: 'm1', role: 'member' }, { inviteId: inv.inviteId });
  pushes.length = 0;
});

describe('teamInvite / teamInviteRevoke / teamInvitePreview', () => {
  it('caps the open invites of a team (rate limit like coachInvite) and counts only live ones', async () => {
    for (let i = 0; i < MAX_TEAM_INVITES_PENDING; i++)
      await teamInvite(ctx(), owner, { email: `t${i}@example.com`, role: 'trainer' });
    expect(
      await code(teamInvite(ctx(), owner, { email: 'over@example.com', role: 'trainer' })),
    ).toBe('resource-exhausted:too-many-invites');
    t += 7 * DAY + 1; // all expired: room again
    expect(
      await code(teamInvite(ctx(), owner, { email: 'over@example.com', role: 'trainer' })),
    ).toBe('ok');
  });

  it('a client, a trainer outside any team and a manager of nobody invite nobody', async () => {
    expect(await code(teamInvite(ctx(), client, { role: 'trainer' }))).toBe(
      'permission-denied:not-in-team',
    );
    // a removed manager keeps the role but has no team
    await teamRemoveMember(ctx(), owner, { uid: 'm1' });
    expect(await code(teamInvite(ctx(), mgr, { role: 'trainer' }))).toBe(
      'permission-denied:not-in-team',
    );
  });

  it('malformed or unknown links: invalid-invite / no-invite for preview, accept, decline and revoke', async () => {
    for (const fn of [
      (id: unknown) => teamInvitePreview(ctx(), id),
      (id: unknown) => teamAccept(ctx(), stranger, { inviteId: id }),
      (id: unknown) => teamDecline(ctx(), stranger, { inviteId: id }),
      (id: unknown) => teamInviteRevoke(ctx(), owner, { inviteId: id }),
    ]) {
      expect(await code(fn('../users/t1'))).toBe('invalid-argument:invalid-invite');
      expect(await code(fn(undefined))).toBe('invalid-argument:invalid-invite');
      expect(await code(fn('nosuchinvite'))).toBe('not-found:no-invite');
    }
  });

  it('revoking twice is safe and a closed invite stays closed', async () => {
    const inv = await teamInvite(ctx(), owner, { role: 'trainer' });
    await teamInviteRevoke(ctx(), owner, { inviteId: inv.inviteId });
    await teamInviteRevoke(ctx(), owner, { inviteId: inv.inviteId });
    expect((await kv.get(`teamInvites/${inv.inviteId}`))?.status).toBe('revoked');
    expect(await code(teamInvitePreview(ctx(), inv.inviteId))).toBe(
      'failed-precondition:invite-closed',
    );
  });
});

describe('teamAccept / teamDecline', () => {
  it('an account that is already in a team cannot join another one (duplicate membership)', async () => {
    const inv = await teamInvite(ctx(), owner, { role: 'trainer' });
    await teamAccept(ctx(), { uid: 't2', role: 'trainer' }, { inviteId: inv.inviteId });
    // t2 now belongs to t1's team; a second team's link must be refused, not silently move them
    await kv.set('users/t9x', { role: 'trainer', status: 'active' });
    await kv.set('teams/t9x', { ownerUid: 't9x', createdAt: T0 });
    await kv.set('teams/t9x/members/t9x', {
      uid: 't9x',
      role: 'trainer',
      status: 'active',
      owner: true,
    });
    const other = await teamInvite(ctx(), { uid: 't9x', role: 'trainer' }, { role: 'trainer' });
    expect(
      await code(teamAccept(ctx(), { uid: 't2', role: 'trainer' }, { inviteId: other.inviteId })),
    ).toBe('already-exists:already-in-team');
    expect((await kv.get('users/t2'))?.teamId).toBe('t1');
  });

  it('a suspended account cannot join', async () => {
    await kv.set('users/t2', { role: 'trainer', status: 'suspended' });
    const inv = await teamInvite(ctx(), owner, { role: 'trainer' });
    expect(await code(teamAccept(ctx(), trainer2, { inviteId: inv.inviteId }))).toBe(
      'permission-denied:not-allowed',
    );
    expect((await kv.get(`teamInvites/${inv.inviteId}`))?.status).toBe('pending');
  });

  it('accepting twice by the same person is refused (the link is single-use), nothing is added twice', async () => {
    const inv = await teamInvite(ctx(), owner, { role: 'trainer' });
    await teamAccept(ctx(), trainer2, { inviteId: inv.inviteId });
    expect(await code(teamAccept(ctx(), trainer2, { inviteId: inv.inviteId }))).toBe(
      'failed-precondition:invite-closed',
    );
    expect((await kv.list('teams/t1/members')).filter((m) => m.id === 't2')).toHaveLength(1);
  });

  it('declining an invite that was already accepted or declined changes nothing and tells nobody', async () => {
    const inv = await teamInvite(ctx(), owner, { role: 'trainer' });
    await teamAccept(ctx(), trainer2, { inviteId: inv.inviteId });
    pushes.length = 0;
    await teamDecline(ctx(), trainer2, { inviteId: inv.inviteId });
    expect((await kv.get(`teamInvites/${inv.inviteId}`))?.status).toBe('accepted');
    expect(pushes).toEqual([]);
  });
});

describe('teamRemoveMember / teamLeave / teamSetActivityScope: wrong role and bad input', () => {
  it('invalid or foreign uids', async () => {
    expect(await code(teamRemoveMember(ctx(), owner, { uid: '../x' }))).toBe(
      'invalid-argument:invalid-uid',
    );
    expect(await code(teamSetActivityScope(ctx(), owner, { uid: '', scope: 'all' }))).toBe(
      'invalid-argument:invalid-uid',
    );
    expect(await code(teamRemoveMember(ctx(), stranger, { uid: 'm1' }))).toBe(
      'permission-denied:not-in-team',
    );
    expect(await code(teamSetActivityScope(ctx(), client, { uid: 'm1', scope: 'all' }))).toBe(
      'permission-denied:not-in-team',
    );
  });

  it('a person outside the team cannot leave it; leaving twice is refused and changes nothing more', async () => {
    expect(await code(teamLeave(ctx(), stranger))).toBe('permission-denied:not-in-team');
    await teamLeave(ctx(), mgr);
    const log = (await kv.list('teams/t1/activity')).length;
    expect(await code(teamLeave(ctx(), mgr))).toBe('permission-denied:not-in-team');
    expect((await kv.list('teams/t1/activity')).length).toBe(log);
  });

  it('a trainer who leaves keeps their clients: the relationship, the conversation and the trainer link stay', async () => {
    const inv = await teamInvite(ctx(), mgr, { role: 'trainer' });
    await teamAccept(ctx(), trainer2, { inviteId: inv.inviteId });
    await kv.set('users/c2', { role: 'member', status: 'active', trainerId: 't2' });
    await kv.set('coaching/c2', { clientId: 'c2', trainerId: 't2', status: 'active', keyEpoch: 1 });
    await teamLeave(ctx(), trainer2);
    expect(await kv.get('coaching/c2')).toMatchObject({ status: 'active', trainerId: 't2' });
    expect(await kv.get('users/c2')).toMatchObject({ trainerId: 't2' });
    expect(await kv.get('users/t2')).toMatchObject({ role: 'trainer', teamId: 't2' });
    expect((await teamRead(ctx(), trainer2)).members.map((m) => m.uid)).toEqual(['t2']);
  });
});

describe('a manager has no way to end a relationship or to add people', () => {
  it('coachEnd refuses a manager, even for a client of their team', async () => {
    expect(await code(coachEnd(ctx(), mgr, { clientId: 'c1' }))).toBe(
      'permission-denied:not-allowed',
    );
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active' });
  });

  it('the handler lists keep managers out of coachEnd and coachInvite and let them into the team calls', async () => {
    const src = (await import('node:fs')).readFileSync('functions/src/coach/handlers.ts', 'utf8');
    const roles = (name: string) =>
      new RegExp(
        `export const ${name} = onCall\\([^)]*\\)?[^;]*?run\\(req, ([A-Z_\\[\\]', a-z]+),`,
        's',
      ).exec(src)?.[1];
    expect(roles('coachEnd')).toBe('ANY');
    expect(roles('coachInvite')).toBe('COACH');
    expect(roles('teamAccept')).toBe('ANY_TEAM');
    expect(roles('teamRemoveMember')).toBe('COACH');
    expect(roles('teamSetActivityScope')).toBe('COACH');
    expect(roles('clientRemovalCreate')).toBe("['manager']");
    expect(roles('inviteClientForTrainer')).toBe("['manager']");
    expect(roles('teamClients')).toBe("['manager']");
    expect(src).toContain("const ANY: Role[] = ['member', 'trainer', 'admin'];");
  });

  it('inviteClientForTrainer: managers only, own team only, app invites only', async () => {
    expect(await code(inviteClientForTrainer(ctx(), owner, { trainerId: 't1', mode: 'app' }))).toBe(
      'permission-denied:managers-only',
    );
    expect(await code(inviteClientForTrainer(ctx(), mgr, { trainerId: '../', mode: 'app' }))).toBe(
      'invalid-argument:invalid-trainer',
    );
    expect(await code(inviteClientForTrainer(ctx(), mgr, { trainerId: 't2', mode: 'app' }))).toBe(
      'permission-denied:not-your-team',
    );
    expect(
      await code(inviteClientForTrainer(ctx(), mgr, { trainerId: 't1', mode: 'program' })),
    ).toBe('permission-denied:app-invite-only');
  });
});

describe('client removal requests: input, roles, duplicates and an inactive client', () => {
  it('validates ids and booleans; only a manager asks, only the trainer answers, only the asker withdraws', async () => {
    expect(await code(clientRemovalCreate(ctx(), mgr, { clientId: '../c1' }))).toBe(
      'invalid-argument:invalid-client',
    );
    expect(await code(clientRemovalCreate(ctx(), stranger, { clientId: 'c1' }))).toBe(
      'permission-denied:not-in-team',
    );
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    for (const bad of ['nope', 'rm-', 'rm-../x', 7, undefined])
      expect(await code(clientRemovalRespond(ctx(), owner, { id: bad, approve: true }))).toBe(
        'invalid-argument:invalid-id',
      );
    expect(await code(clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: 'yes' }))).toBe(
      'invalid-argument:invalid-approve',
    );
    expect(await code(clientRemovalRespond(ctx(), mgr, { id: 'rm-c1', approve: true }))).toBe(
      'permission-denied:not-your-client',
    );
    expect(await code(clientRemovalRespond(ctx(), client, { id: 'rm-c1', approve: true }))).toBe(
      'permission-denied:not-in-team',
    );
    expect(await code(clientRemovalCancel(ctx(), mgr, { id: 'bad' }))).toBe(
      'invalid-argument:invalid-id',
    );
    expect(await code(clientRemovalCancel(ctx(), mgr, { id: 'rm-nobody' }))).toBe(
      'not-found:no-request',
    );
    expect(await code(teamRequests(ctx(), mgr))).toBe('permission-denied:trainers-only');
  });

  it('answering twice is safe: the second answer returns the first decision and tells nobody again', async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false })).toEqual({
      status: 'declined',
    });
    pushes.length = 0;
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true })).toEqual({
      status: 'declined',
    });
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active' });
    expect(pushes).toEqual([]);
  });

  it('a request is closed when the client leaves the trainer: it is no longer listed and cannot be approved', async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    await coachEnd(ctx(), client, { clientId: 'c1' });
    expect(await kv.get('teamRequests/rm-c1')).toMatchObject({ status: 'cancelled' });
    expect((await teamRequests(ctx(), owner)).requests).toEqual([]);
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true })).toEqual({
      status: 'cancelled',
    });
    // a fresh request after the client came back is a new one
    await kv.merge('coaching/c1', { status: 'active' });
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    expect((await teamRequests(ctx(), owner)).requests).toHaveLength(1);
  });

  it('a request whose client was ended some other way (older data) is cancelled when it is listed or answered', async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    await kv.merge('coaching/c1', { status: 'ended' }); // no end-of-relationship body ran
    expect((await teamRequests(ctx(), owner)).requests).toEqual([]);
    expect(await kv.get('teamRequests/rm-c1')).toMatchObject({ status: 'cancelled' });
    await kv.merge('coaching/c1', { status: 'active' });
    await kv.merge('teamRequests/rm-c1', { status: 'pending' });
    await kv.merge('coaching/c1', { status: 'ended' });
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: false })).toEqual({
      status: 'cancelled',
    });
  });

  it('a client who moved to another trainer cannot be removed by the old one', async () => {
    await clientRemovalCreate(ctx(), mgr, { clientId: 'c1' });
    await kv.merge('coaching/c1', { trainerId: 't2' });
    expect(await clientRemovalRespond(ctx(), owner, { id: 'rm-c1', approve: true })).toEqual({
      status: 'cancelled',
    });
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active', trainerId: 't2' });
  });

  it('asking for a client whose relationship is not active is refused', async () => {
    await kv.merge('coaching/c1', { status: 'ended' });
    expect(await code(clientRemovalCreate(ctx(), mgr, { clientId: 'c1' }))).toBe(
      'failed-precondition:not-active',
    );
    expect(await code(clientRemovalCreate(ctx(), mgr, { clientId: 'nobody' }))).toBe(
      'not-found:no-relationship',
    );
  });
});

describe('the team is created lazily and repeatedly asking is harmless (migration-free rollout)', () => {
  it('a trainer with no team document reads an empty team; the first invite creates it once; later calls keep it', async () => {
    await kv.set('users/t3', { role: 'trainer', status: 'active', firstName: 'Fresh' });
    const solo: Actor = { uid: 't3', role: 'trainer' };
    expect(await kv.get('teams/t3')).toBeNull();
    const before = await teamRead(ctx(), solo);
    expect(before.members.map((m) => m.uid)).toEqual(['t3']);
    expect(before.invites).toEqual([]);
    expect(await kv.get('teams/t3')).toBeNull(); // reading creates nothing
    await teamInvite(ctx(), solo, { role: 'trainer', email: 'a@example.com' });
    const created = await kv.get('teams/t3');
    expect(created).toMatchObject({ ownerUid: 't3', createdAt: T0 });
    t += DAY;
    await teamInvite(ctx(), solo, { role: 'trainer', email: 'b@example.com' });
    expect(await kv.get('teams/t3')).toEqual(created);
    expect((await kv.list('teams/t3/members')).map((m) => m.id)).toEqual(['t3']);
    // nothing of coaching is touched by the team
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'active', trainerId: 't1' });
  });
});
