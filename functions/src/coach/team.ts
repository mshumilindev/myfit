/**
 * Team services (SPO-196, spec docs/specs/team-manager.md, ADR 005), written against the `Kv` seam like `service.ts`:
 * every rule below runs in unit tests without an emulator. The Firestore rules (teams / members / acl / teamInvites)
 * are read-only for clients; ALL writes happen here.
 *
 * Model: `teams/{teamId}` (teamId = the owner trainer's uid), `teams/{teamId}/members/{uid}` { role, status },
 * `teams/{teamId}/acl/{uid}` { activityScope }, `teamInvites/{token}`. `users/{uid}.teamId` points a member at the team
 * (default: own uid). A trainer adds MANAGERS, a manager adds TRAINERS; nobody picks a role. An invite is a link
 * (`#/invite/<token>`, the same bearer format as coach invites); the e-mail typed by the inviter is only a label for
 * the pending list, the accepting account is whoever opens the link signed in. Only the owner trainer removes a
 * manager; anyone else may leave. Nothing here handles keys or sealed data (the client device delegates them).
 */
import { teamInviteUrl } from './inviteLink';
import { DAY, conversationId, isUid } from './logic';
import { CoachError, notice, type Actor, type Ctx, type ErrCode } from './service';
import type { Doc } from './kv';

export const TEAM_INVITE_TTL = 7 * DAY;
export const MAX_TEAM_INVITES_PENDING = 20;
export const MAX_MANAGERS = 10;

export type TeamRole = 'trainer' | 'manager';
export type ActivityScope = 'own' | 'all';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const fail = (code: ErrCode, reason: string): never => {
  throw new CoachError(code, reason);
};
const isCoach = (a: Actor) => a.role === 'trainer' || a.role === 'admin';

interface UserRec {
  role?: string;
  status?: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
  teamId?: string | null;
}
interface MemberRec {
  uid: string;
  role: TeamRole;
  status: 'active' | 'removed';
  owner?: boolean;
  addedAt: number;
  addedBy: string | null;
  removedAt?: number;
}
interface InviteRec {
  id: string;
  teamId: string;
  invitedBy: string;
  role: TeamRole;
  emailLower: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  createdAt: number;
  expiresAt: number;
}

const nameOf = (u: UserRec | null): string =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '' : '';

/** The team the signed-in person belongs to and their member record; permission-denied when they have none. */
async function myTeam(
  ctx: Ctx,
  a: Actor,
): Promise<{ teamId: string; me: MemberRec; owner: boolean }> {
  const u = (await ctx.kv.get(`users/${a.uid}`)) as UserRec | null;
  const teamId = u?.teamId || a.uid;
  const m = (await ctx.kv.get(`teams/${teamId}/members/${a.uid}`)) as MemberRec | null;
  if (m && m.status === 'active') return { teamId, me: m, owner: teamId === a.uid };
  // A trainer without a team document yet is the owner of an empty team.
  if (isCoach(a) && teamId === a.uid)
    return {
      teamId,
      me: {
        uid: a.uid,
        role: 'trainer',
        status: 'active',
        owner: true,
        addedAt: ctx.now(),
        addedBy: null,
      },
      owner: true,
    };
  return fail('permission-denied', 'not-in-team');
}

async function ensureTeam(ctx: Ctx, teamId: string): Promise<void> {
  const kv = ctx.kv;
  if (!(await kv.get(`teams/${teamId}`)))
    await kv.set(`teams/${teamId}`, { ownerUid: teamId, createdAt: ctx.now() });
  if (!(await kv.get(`teams/${teamId}/members/${teamId}`)))
    await kv.set(`teams/${teamId}/members/${teamId}`, {
      uid: teamId,
      role: 'trainer',
      status: 'active',
      owner: true,
      addedAt: ctx.now(),
      addedBy: null,
    } satisfies MemberRec);
}

export interface TeamInviteResult {
  inviteId: string;
  url: string;
  sentAt: number;
  expiresAt: number;
}

/** A trainer or a manager invites one person as a MANAGER or a TRAINER (the sender picks; no body role = the opposite of the sender's own). */
export async function teamInvite(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<TeamInviteResult> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : '';
  if (!EMAIL.test(email)) fail('invalid-argument', 'invalid-email');
  const { teamId, me } = await myTeam(ctx, actor);
  if (!isCoach(actor) && actor.role !== 'manager') fail('permission-denied', 'not-allowed');
  const asked = body.role;
  if (asked !== undefined && asked !== 'manager' && asked !== 'trainer')
    return fail('invalid-argument', 'invalid-role');
  const role: TeamRole = asked ?? (me.role === 'trainer' ? 'manager' : 'trainer');
  const kv = ctx.kv;
  const now = ctx.now();
  const mine = (await kv.list('teamInvites', { where: [['teamId', '==', teamId]] })).map(
    (r) => r.data as unknown as InviteRec,
  );
  const open = mine.filter((i) => i.status === 'pending' && i.expiresAt > now);
  if (open.length >= MAX_TEAM_INVITES_PENDING) fail('resource-exhausted', 'too-many-invites');
  if (open.some((i) => i.emailLower === email && i.role === role))
    fail('already-exists', 'invite-exists');
  if (role === 'manager') {
    const members = await kv.list(`teams/${teamId}/members`);
    const managers = members.filter(
      (m) =>
        (m.data as unknown as MemberRec).role === 'manager' &&
        (m.data as unknown as MemberRec).status === 'active',
    ).length;
    if (managers + open.filter((i) => i.role === 'manager').length >= MAX_MANAGERS)
      fail('resource-exhausted', 'too-many-managers');
  }
  await ensureTeam(ctx, teamId);
  const id = ctx.newToken();
  const rec: InviteRec = {
    id,
    teamId,
    invitedBy: actor.uid,
    role,
    emailLower: email,
    status: 'pending',
    createdAt: now,
    expiresAt: now + TEAM_INVITE_TTL,
  };
  await kv.set(`teamInvites/${id}`, rec as unknown as Doc);
  return {
    inviteId: id,
    url: teamInviteUrl(ctx.baseUrl, id),
    sentAt: now,
    expiresAt: rec.expiresAt,
  };
}

async function loadInvite(ctx: Ctx, id: unknown): Promise<InviteRec> {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
    return fail('invalid-argument', 'invalid-invite');
  const i = (await ctx.kv.get(`teamInvites/${id}`)) as InviteRec | null;
  if (!i) return fail('not-found', 'no-invite');
  return i;
}

export async function teamInviteRevoke(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const i = await loadInvite(ctx, body.inviteId);
  if (i.invitedBy !== actor.uid && i.teamId !== actor.uid)
    fail('permission-denied', 'not-your-invite');
  if (i.status === 'pending') await ctx.kv.merge(`teamInvites/${i.id}`, { status: 'revoked' });
  return { ok: true };
}

export interface TeamInvitePreview {
  role: TeamRole;
  teamOwnerName: string;
  invitedByName: string;
  expiresAt: number;
}

/** What the person sees before accepting. Open invites only; nothing else about the team. */
export async function teamInvitePreview(ctx: Ctx, token: unknown): Promise<TeamInvitePreview> {
  const i = await loadInvite(ctx, token);
  if (i.status !== 'pending' || i.expiresAt <= ctx.now())
    fail('failed-precondition', 'invite-closed');
  const owner = (await ctx.kv.get(`users/${i.teamId}`)) as UserRec | null;
  const by = (await ctx.kv.get(`users/${i.invitedBy}`)) as UserRec | null;
  return {
    role: i.role,
    teamOwnerName: nameOf(owner),
    invitedByName: nameOf(by),
    expiresAt: i.expiresAt,
  };
}

export async function teamAccept(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ teamId: string; role: TeamRole }> {
  const i = await loadInvite(ctx, body.inviteId);
  const now = ctx.now();
  if (i.status !== 'pending' || i.expiresAt <= now) fail('failed-precondition', 'invite-closed');
  if (i.invitedBy === actor.uid || i.teamId === actor.uid)
    fail('invalid-argument', 'cannot-join-own-team');
  const kv = ctx.kv;
  return kv.tx(async (t) => {
    const u = (await t.get(`users/${actor.uid}`)) as UserRec | null;
    if (!u || u.status === 'suspended') return fail('permission-denied', 'not-allowed');
    if (i.role === 'manager') {
      // A manager is an account with no coaching of its own: a plain member (or an existing manager moving teams).
      if (u.role !== 'member' && u.role !== 'manager')
        fail('failed-precondition', 'account-not-eligible');
      const own = (await t.get(`coaching/${actor.uid}`)) as { status?: string } | null;
      if (own?.status === 'active' || own?.status === 'pending')
        fail('failed-precondition', 'account-not-eligible');
    } else if (u.role !== 'trainer' && u.role !== 'admin') {
      fail('failed-precondition', 'account-not-eligible');
    }
    if (u.teamId && u.teamId !== actor.uid) {
      const cur = (await t.get(`teams/${u.teamId}/members/${actor.uid}`)) as MemberRec | null;
      if (cur?.status === 'active') fail('already-exists', 'already-in-team');
    }
    await ensureTeamTx(t, i.teamId, now);
    await t.set(`teams/${i.teamId}/members/${actor.uid}`, {
      uid: actor.uid,
      role: i.role,
      status: 'active',
      addedAt: now,
      addedBy: i.invitedBy,
    } satisfies MemberRec);
    if (i.role === 'manager')
      await t.set(`teams/${i.teamId}/acl/${actor.uid}`, { activityScope: 'own' });
    await t.merge(`users/${actor.uid}`, {
      teamId: i.teamId,
      ...(i.role === 'manager' ? { role: 'manager' } : {}),
      updatedAt: now,
    });
    await t.merge(`teamInvites/${i.id}`, {
      status: 'accepted',
      acceptedBy: actor.uid,
      acceptedAt: now,
    });
    await notice(t, i.invitedBy, 'team', actor.uid, now, `team-join-${i.id}`, i.role);
    return { teamId: i.teamId, role: i.role };
  });
}

async function ensureTeamTx(t: Ctx['kv'], teamId: string, now: number): Promise<void> {
  if (!(await t.get(`teams/${teamId}`)))
    await t.set(`teams/${teamId}`, { ownerUid: teamId, createdAt: now });
  if (!(await t.get(`teams/${teamId}/members/${teamId}`)))
    await t.set(`teams/${teamId}/members/${teamId}`, {
      uid: teamId,
      role: 'trainer',
      status: 'active',
      owner: true,
      addedAt: now,
      addedBy: null,
    } satisfies MemberRec);
}

export async function teamDecline(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const i = await loadInvite(ctx, body.inviteId);
  if (i.status === 'pending') {
    await ctx.kv.merge(`teamInvites/${i.id}`, { status: 'declined' });
    await notice(
      ctx.kv,
      i.invitedBy,
      'team',
      actor.uid,
      ctx.now(),
      `team-decline-${i.id}`,
      'declined',
    );
  }
  return { ok: true };
}

/** Access ends HERE and now (rules read `members/{uid}.status`); the clients' apps renew the keys when next opened. */
async function endMembership(
  ctx: Ctx,
  teamId: string,
  target: MemberRec,
  by: string,
  why: 'removed' | 'left',
): Promise<void> {
  const now = ctx.now();
  await ctx.kv.tx(async (t) => {
    await t.merge(`teams/${teamId}/members/${target.uid}`, { status: 'removed', removedAt: now });
    await t.del(`teams/${teamId}/acl/${target.uid}`);
    // the person's default team is their own again; a manager keeps the role but has no team (no access anywhere)
    await t.merge(`users/${target.uid}`, { teamId: target.uid, updatedAt: now });
    await notice(
      t,
      why === 'removed' ? target.uid : teamId,
      'team',
      by,
      now,
      `team-${why}-${target.uid}-${now}`,
      why,
    );
  });
}

export async function teamRemoveMember(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const uid = body.uid;
  if (!isUid(uid)) return fail('invalid-argument', 'invalid-uid');
  const { teamId, owner } = await myTeam(ctx, actor);
  if (!owner) fail('permission-denied', 'owner-only');
  const target = (await ctx.kv.get(`teams/${teamId}/members/${uid}`)) as MemberRec | null;
  if (!target || target.status !== 'active') return fail('not-found', 'no-member');
  if (target.role !== 'manager') fail('permission-denied', 'managers-only');
  await endMembership(ctx, teamId, target, actor.uid, 'removed');
  return { ok: true };
}

export async function teamLeave(ctx: Ctx, actor: Actor): Promise<{ ok: true }> {
  const { teamId, me, owner } = await myTeam(ctx, actor);
  if (owner) fail('failed-precondition', 'owner-cannot-leave');
  await endMembership(ctx, teamId, me, actor.uid, 'left');
  return { ok: true };
}

export async function teamSetActivityScope(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const uid = body.uid;
  const scope = body.scope;
  if (!isUid(uid)) return fail('invalid-argument', 'invalid-uid');
  if (scope !== 'own' && scope !== 'all') return fail('invalid-argument', 'invalid-scope');
  const { teamId, owner } = await myTeam(ctx, actor);
  if (!owner) fail('permission-denied', 'owner-only');
  const target = (await ctx.kv.get(`teams/${teamId}/members/${uid}`)) as MemberRec | null;
  if (!target || target.status !== 'active' || target.role !== 'manager')
    return fail('not-found', 'no-member');
  await ctx.kv.set(`teams/${teamId}/acl/${uid}`, { activityScope: scope });
  return { ok: true };
}

export interface TeamSnapshot {
  me: { uid: string; role: TeamRole; isOwner: boolean };
  ownerName: string;
  members: {
    uid: string;
    name: string;
    role: TeamRole;
    you: boolean;
    addedAt: number | null;
    lastActiveAt: number | null;
    activityScope?: ActivityScope;
  }[];
  invites: { id: string; email: string; role: TeamRole; sentAt: number }[];
  asOf: number;
}

/** The Team page's data. Managers' settings and pending invites are shown to the owner trainer only. */
export async function teamRead(ctx: Ctx, actor: Actor): Promise<TeamSnapshot> {
  const { teamId, me, owner } = await myTeam(ctx, actor);
  const kv = ctx.kv;
  const now = ctx.now();
  const rows = (await kv.list(`teams/${teamId}/members`)).map(
    (r) => r.data as unknown as MemberRec,
  );
  const active = rows.filter((m) => m.status === 'active');
  if (!active.some((m) => m.uid === teamId))
    active.unshift({
      uid: teamId,
      role: 'trainer',
      status: 'active',
      owner: true,
      addedAt: now,
      addedBy: null,
    });
  const members: TeamSnapshot['members'] = [];
  for (const m of active) {
    const u = (await kv.get(`users/${m.uid}`)) as UserRec | null;
    const scope =
      owner && m.role === 'manager'
        ? ((
            (await kv.get(`teams/${teamId}/acl/${m.uid}`)) as {
              activityScope?: ActivityScope;
            } | null
          )?.activityScope ?? 'own')
        : undefined;
    members.push({
      uid: m.uid,
      name: nameOf(u),
      role: m.role,
      you: m.uid === actor.uid,
      addedAt: m.owner ? null : m.addedAt,
      lastActiveAt: null,
      ...(scope ? { activityScope: scope } : {}),
    });
  }
  const invs = (await kv.list('teamInvites', { where: [['teamId', '==', teamId]] }))
    .map((r) => r.data as unknown as InviteRec)
    .filter(
      (i) => i.status === 'pending' && i.expiresAt > now && (owner || i.invitedBy === actor.uid),
    )
    .map((i) => ({ id: i.id, email: i.emailLower, role: i.role, sentAt: i.createdAt }))
    .sort((a, b) => b.sentAt - a.sentAt);
  const ownerRec = (await kv.get(`users/${teamId}`)) as UserRec | null;
  return {
    me: { uid: actor.uid, role: me.role, isOwner: owner },
    ownerName: nameOf(ownerRec),
    members,
    invites: invs,
    asOf: now,
  };
}

/**
 * CLIENT: the active managers of my trainer's team (uids only). The client device wraps the schedule and request keys
 * for each of them (ADR 005); it cannot look the team up itself because the trainer's user document is not readable.
 */
export async function teamManagersForClient(
  ctx: Ctx,
  actor: Actor,
): Promise<{ managers: string[] }> {
  const c = (await ctx.kv.get(`coaching/${actor.uid}`)) as {
    status?: string;
    trainerId?: string;
  } | null;
  if (!c || c.status !== 'active' || !c.trainerId) return { managers: [] };
  const trainer = (await ctx.kv.get(`users/${c.trainerId}`)) as UserRec | null;
  const teamId = trainer?.teamId || c.trainerId;
  const rows = await ctx.kv.list(`teams/${teamId}/members`);
  const managers = rows
    .map((r) => r.data as unknown as MemberRec)
    .filter((m) => m.role === 'manager' && m.status === 'active')
    .map((m) => m.uid)
    .sort();
  return { managers };
}

export interface TeamClient {
  clientId: string;
  /** the conversation id (opaque, server pepper): the manager reads `conversations/{cid}/delegations/{me}` with it */
  cid: string;
  trainerId: string;
  trainerName: string;
  name: string;
}

/**
 * MANAGER: every client of the team with an active coaching relationship, with the conversation id and the trainer.
 * The roster of the trainer is the trainer's; this is the manager's list (names and ids only, no content).
 */
export async function teamClients(ctx: Ctx, actor: Actor): Promise<{ clients: TeamClient[] }> {
  const { teamId, me } = await myTeam(ctx, actor);
  if (me.role !== 'manager') return fail('permission-denied', 'managers-only');
  const members = (await ctx.kv.list(`teams/${teamId}/members`)).map(
    (r) => r.data as unknown as MemberRec,
  );
  const clients: TeamClient[] = [];
  for (const m of members) {
    if (m.role !== 'trainer' || m.status !== 'active') continue;
    const trainer = (await ctx.kv.get(`users/${m.uid}`)) as UserRec | null;
    const rows = await ctx.kv.list('coaching', {
      where: [
        ['trainerId', '==', m.uid],
        ['status', '==', 'active'],
      ],
      limit: 500,
    });
    for (const r of rows) {
      const u = (await ctx.kv.get(`users/${r.id}`)) as UserRec | null;
      clients.push({
        clientId: r.id,
        cid: conversationId(ctx.pepper, r.id, m.uid),
        trainerId: m.uid,
        trainerName: nameOf(trainer),
        name: nameOf(u),
      });
    }
  }
  clients.sort((a, b) => a.name.localeCompare(b.name) || a.clientId.localeCompare(b.clientId));
  return { clients };
}
