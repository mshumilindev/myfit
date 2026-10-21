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
import { REPORTED_KINDS, logActivity, type ActivityEntry, type ReportedKind } from './activity';
import { teamInviteUrl } from './inviteLink';
import { DAY, conversationId, isUid } from './logic';
import {
  CoachError,
  coachInvite,
  endRelationship,
  loadCoaching,
  notice,
  type Actor,
  type Ctx,
  type ErrCode,
} from './service';
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

export const nameOf = (u: UserRec | null): string =>
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
  // The e-mail is optional (mail is not connected: the sender passes the link on). When given, only that verified account can join.
  if (email && !EMAIL.test(email)) fail('invalid-argument', 'invalid-email');
  const { teamId } = await myTeam(ctx, actor);
  if (!isCoach(actor) && actor.role !== 'manager') fail('permission-denied', 'not-allowed');
  const asked = body.role;
  if (asked !== undefined && asked !== 'manager' && asked !== 'trainer')
    return fail('invalid-argument', 'invalid-role');
  // Only the team's owner grants the manager role (a manager sees every client's schedule); everyone else adds trainers.
  const isOwner = teamId === actor.uid;
  const role: TeamRole = asked ?? (isOwner ? 'manager' : 'trainer');
  if (role === 'manager' && !isOwner) fail('permission-denied', 'owner-only');
  const kv = ctx.kv;
  const now = ctx.now();
  const mine = (await kv.list('teamInvites', { where: [['teamId', '==', teamId]] })).map(
    (r) => r.data as unknown as InviteRec,
  );
  const open = mine.filter((i) => i.status === 'pending' && i.expiresAt > now);
  if (open.length >= MAX_TEAM_INVITES_PENDING) fail('resource-exhausted', 'too-many-invites');
  if (email && open.some((i) => i.emailLower === email && i.role === role))
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
  // A link written for an e-mail works only for that verified account (a leaked link is useless); without an e-mail it is a plain one-person link.
  if (i.emailLower && actor.email !== i.emailLower) fail('permission-denied', 'wrong-email');
  const kv = ctx.kv;
  const joined = await kv.tx(async (t) => {
    // re-read INSIDE the transaction: two accounts racing one link cannot both join
    const fresh = (await t.get(`teamInvites/${i.id}`)) as InviteRec | null;
    if (!fresh || fresh.status !== 'pending' || fresh.expiresAt <= now)
      fail('failed-precondition', 'invite-closed');
    // an invite outlives neither its sender's membership
    if (i.invitedBy !== i.teamId) {
      const sender = (await t.get(`teams/${i.teamId}/members/${i.invitedBy}`)) as MemberRec | null;
      if (sender?.status !== 'active') fail('failed-precondition', 'invite-closed');
    }
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
    const inviter = (await t.get(`teams/${i.teamId}/members/${i.invitedBy}`)) as MemberRec | null;
    await logActivity(t, i.teamId, now, {
      actorUid: i.invitedBy,
      role: inviter?.role ?? 'trainer',
      kind: 'member-added',
      refId: actor.uid,
    });
    return { teamId: i.teamId, role: i.role };
  });
  // A new manager needs the clients' devices to delegate the schedule keys: a silent `sync` push asks every client of
  // the team to do it now (an improvement, never a guarantee: a client that is offline does it on its next open).
  if (i.role === 'manager') await syncTeamClients(ctx, i.teamId);
  return joined;
}

/** A silent `sync` push to every client of every active trainer of the team (best effort, capped). */
async function syncTeamClients(ctx: Ctx, teamId: string): Promise<void> {
  if (!ctx.notify) return;
  try {
    const members = (await ctx.kv.list(`teams/${teamId}/members`)).map(
      (r) => r.data as unknown as MemberRec,
    );
    for (const m of members) {
      if (m.role !== 'trainer' || m.status !== 'active') continue;
      const rows = await ctx.kv.list('coaching', {
        where: [
          ['trainerId', '==', m.uid],
          ['status', '==', 'active'],
        ],
        limit: 500,
      });
      await Promise.allSettled(rows.map((r) => ctx.notify?.(r.id, 'sync')));
    }
  } catch {
    /* a failed push never fails the invite */
  }
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
    await logActivity(t, teamId, now, {
      actorUid: by,
      role: why === 'removed' ? 'trainer' : target.role,
      kind: why === 'removed' ? 'member-removed' : 'member-left',
      refId: target.uid,
    });
  });
  // what the leaver invited can no longer be accepted (teamAccept also checks the sender is still a member)
  for (const inv of await ctx.kv.list('teamInvites', { where: [['invitedBy', '==', target.uid]] }))
    if (inv.data.status === 'pending' && inv.data.teamId === teamId)
      await ctx.kv.merge(inv.path, { status: 'revoked' });
  await dropDelegations(ctx, teamId, target);
}

/**
 * After a member leaves or is removed: the delegations that belonged to them are deleted (ADR 005). A manager: their
 * document in every conversation of the team's clients. A trainer who leaves: ALL delegations on their own clients
 * (the managers no longer serve them). Access is already closed by the rules; this removes the wrapped keys too.
 */
async function dropDelegations(ctx: Ctx, teamId: string, target: MemberRec): Promise<void> {
  const members = (await ctx.kv.list(`teams/${teamId}/members`)).map(
    (r) => r.data as unknown as MemberRec,
  );
  const trainers =
    target.role === 'manager'
      ? members.filter((m) => m.role === 'trainer' && m.status === 'active')
      : [target];
  for (const tr of trainers) {
    const rows = await ctx.kv.list('coaching', {
      where: [['trainerId', '==', tr.uid]],
      limit: 500,
    });
    for (const r of rows) {
      const cid = conversationId(ctx.pepper, r.id, tr.uid);
      // the leaver holds the current schedule / requests sub-keys: the client rotates at its next open (ADR 005)
      if (await ctx.kv.get(`conversations/${cid}`))
        await ctx.kv.merge(`conversations/${cid}`, { rotateDue: true });
      if (target.role === 'manager')
        await ctx.kv.del(`conversations/${cid}/delegations/${target.uid}`);
      else
        for (const d of await ctx.kv.list(`conversations/${cid}/delegations`))
          await ctx.kv.del(d.path);
    }
  }
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
    /** managers, owner view: clients whose schedule key the client device already delegated */
    scheduleReady?: { ready: number; total: number };
  }[];
  invites: { id: string; email: string; role: TeamRole; sentAt: number }[];
  asOf: number;
}

async function readyFor(
  kv: Ctx['kv'],
  clients: { cid: string }[],
  managerUid: string,
): Promise<{ ready: number; total: number }> {
  let ready = 0;
  for (const c of clients)
    if (await kv.get(`conversations/${c.cid}/delegations/${managerUid}`)) ready++;
  return { ready, total: clients.length };
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
  /** the owner sees how many team clients already delegated the schedule keys to each manager (SPO-203, board D17) */
  const teamClientIds: { clientId: string; cid: string }[] = [];
  if (owner && active.some((m) => m.role === 'manager')) {
    for (const t of active.filter((m) => m.role === 'trainer')) {
      const cs = await kv.list('coaching', {
        where: [
          ['trainerId', '==', t.uid],
          ['status', '==', 'active'],
        ],
        limit: 500,
      });
      for (const c of cs)
        teamClientIds.push({ clientId: c.id, cid: conversationId(ctx.pepper, c.id, t.uid) });
    }
  }
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
      ...(owner && m.role === 'manager'
        ? { scheduleReady: await readyFor(kv, teamClientIds, m.uid) }
        : {}),
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

/* ---- client removal requests (SPO-239) -------------------------------------------------------------------------- */
export type RemovalStatus = 'pending' | 'approved' | 'declined' | 'cancelled';
interface RemovalRec {
  id: string;
  kind: 'client-removal';
  teamId: string;
  clientId: string;
  trainerId: string;
  requestedBy: string;
  reason: string;
  status: RemovalStatus;
  createdAt: number;
  decidedAt?: number;
}
export const REMOVAL_REASON_MAX = 280;
/** Top-level `teamRequests/{id}` (firestore.rules: the requester and the trainer read their own; functions write). */
const removalPath = (id: string) => `teamRequests/${id}`;
/** One open request per client: the id is derived, so a repeated tap is the same request. */
const removalId = (clientId: string) => `rm-${clientId}`;

/**
 * MANAGER asks the client's trainer to remove a client. Nothing changes until the trainer approves; the client is not told.
 * The trainer gets a notice (the Spotter chat shows it with the buttons).
 */
export async function clientRemovalCreate(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const clientId = body.clientId;
  if (!isUid(clientId)) return fail('invalid-argument', 'invalid-client');
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, REMOVAL_REASON_MAX) : '';
  const { teamId, me } = await myTeam(ctx, actor);
  if (me.role !== 'manager') return fail('permission-denied', 'managers-only');
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    if (c.status !== 'active') return fail('failed-precondition', 'not-active');
    const tm = (await kv.get(`teams/${teamId}/members/${c.trainerId}`)) as MemberRec | null;
    if (!tm || tm.status !== 'active' || tm.role !== 'trainer')
      return fail('permission-denied', 'not-your-team');
    const id = removalId(clientId);
    const open = (await kv.get(removalPath(id))) as RemovalRec | null;
    if (open && open.status === 'pending') return { id };
    await kv.set(removalPath(id), {
      id,
      kind: 'client-removal',
      teamId,
      clientId,
      trainerId: c.trainerId,
      requestedBy: actor.uid,
      reason,
      status: 'pending',
      createdAt: now,
    } satisfies RemovalRec);
    const client = (await kv.get(`users/${clientId}`)) as UserRec | null;
    await kv.set(`users/${c.trainerId}/notices/removal-${id}-${now}`, {
      id: `removal-${id}-${now}`,
      kind: 'removal-request',
      actor: actor.uid,
      detail: nameOf(client) || null,
      clientId,
      refId: id,
      status: 'pending',
      createdAt: now,
      readAt: null,
    });
    await ctx.notify?.(c.trainerId, 'team');
    await logActivity(kv, teamId, now, {
      actorUid: actor.uid,
      role: 'manager',
      kind: 'removal-request',
      clientId,
      refId: id,
      status: 'pending',
    });
    return { id };
  });
}

/** The requesting manager withdraws a pending request. */
export async function clientRemovalCancel(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const id = body.id;
  if (typeof id !== 'string' || !/^rm-[A-Za-z0-9_-]{1,128}$/.test(id))
    return fail('invalid-argument', 'invalid-id');
  const { teamId } = await myTeam(ctx, actor);
  return ctx.kv.tx(async (kv) => {
    const r = (await kv.get(removalPath(id))) as RemovalRec | null;
    if (!r || r.teamId !== teamId) return fail('not-found', 'no-request');
    if (r.requestedBy !== actor.uid) return fail('permission-denied', 'not-yours');
    if (r.status !== 'pending') return { ok: true as const };
    const at = ctx.now();
    await kv.merge(removalPath(id), { status: 'cancelled', decidedAt: at });
    await logActivity(kv, teamId, at, {
      actorUid: actor.uid,
      role: 'manager',
      kind: 'removal-cancelled',
      clientId: r.clientId,
      refId: id,
    });
    return { ok: true as const };
  });
}

/**
 * The client's TRAINER answers. Approve runs the existing end-of-relationship body (the same as "remove client" on the roster);
 * Decline changes nothing but the request. The manager is told the decision either way.
 */
export async function clientRemovalRespond(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ status: RemovalStatus }> {
  const id = body.id;
  if (typeof id !== 'string' || !/^rm-[A-Za-z0-9_-]{1,128}$/.test(id))
    return fail('invalid-argument', 'invalid-id');
  if (typeof body.approve !== 'boolean') return fail('invalid-argument', 'invalid-approve');
  const { teamId } = await myTeam(ctx, actor);
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const r = (await kv.get(removalPath(id))) as RemovalRec | null;
    if (!r || r.teamId !== teamId) return fail('not-found', 'no-request');
    if (!isCoach(actor) || r.trainerId !== actor.uid)
      return fail('permission-denied', 'not-your-client');
    if (r.status !== 'pending') return { status: r.status };
    const status: RemovalStatus = body.approve ? 'approved' : 'declined';
    if (body.approve) {
      const c = await loadCoaching(kv, r.clientId);
      if (c.status === 'active' && c.trainerId === actor.uid)
        await endRelationship(ctx, kv, c, 'trainer', actor.uid, now);
    }
    await kv.merge(removalPath(id), { status, decidedAt: now });
    await logActivity(kv, teamId, now, {
      actorUid: actor.uid,
      role: 'trainer',
      kind: body.approve ? 'removal-approved' : 'removal-declined',
      clientId: r.clientId,
      refId: id,
    });
    const client = (await kv.get(`users/${r.clientId}`)) as UserRec | null;
    await kv.set(`users/${r.requestedBy}/notices/removal-answer-${id}-${now}`, {
      id: `removal-answer-${id}-${now}`,
      kind: 'removal-answer',
      actor: actor.uid,
      detail: nameOf(client) || null,
      clientId: r.clientId,
      refId: id,
      status,
      createdAt: now,
      readAt: null,
    });
    await ctx.notify?.(r.requestedBy, 'team');
    return { status };
  });
}

export interface TeamRequestRow {
  id: string;
  kind: 'client-removal';
  clientId: string;
  clientName: string;
  managerName: string;
  reason: string;
  createdAt: number;
}

/** TRAINER: the open requests about their own clients (Agenda "Team requests"). */
export async function teamRequests(
  ctx: Ctx,
  actor: Actor,
): Promise<{ requests: TeamRequestRow[] }> {
  await myTeam(ctx, actor);
  if (!isCoach(actor)) return fail('permission-denied', 'trainers-only');
  const rows = await ctx.kv.list('teamRequests', {
    where: [
      ['trainerId', '==', actor.uid],
      ['status', '==', 'pending'],
    ],
    limit: 100,
  });
  const out: TeamRequestRow[] = [];
  for (const r of rows) {
    const d = r.data as unknown as RemovalRec;
    const [client, mgr] = await Promise.all([
      ctx.kv.get(`users/${d.clientId}`) as Promise<UserRec | null>,
      ctx.kv.get(`users/${d.requestedBy}`) as Promise<UserRec | null>,
    ]);
    out.push({
      id: d.id,
      kind: d.kind,
      clientId: d.clientId,
      clientName: nameOf(client),
      managerName: nameOf(mgr),
      reason: d.reason,
      createdAt: d.createdAt,
    });
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return { requests: out };
}

/**
 * MANAGER's device reports an edit it just made to a client's sealed schedule (done / missed / cancelled / edited). The server
 * cannot see inside the document, so this is the manager's own note for the activity log: metadata only, own scope, and only for
 * a client of the team's trainers.
 */
export async function teamLogActivity(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const kind = body.kind;
  const clientId = body.clientId;
  if (!REPORTED_KINDS.includes(kind as ReportedKind))
    return fail('invalid-argument', 'invalid-kind');
  if (!isUid(clientId)) return fail('invalid-argument', 'invalid-client');
  const { teamId, me } = await myTeam(ctx, actor);
  if (me.role !== 'manager') return fail('permission-denied', 'managers-only');
  const c = (await ctx.kv.get(`coaching/${clientId}`)) as {
    status?: string;
    trainerId?: string;
  } | null;
  if (!c || c.status !== 'active' || !c.trainerId) return fail('not-found', 'no-relationship');
  const tm = (await ctx.kv.get(`teams/${teamId}/members/${c.trainerId}`)) as MemberRec | null;
  if (!tm || tm.status !== 'active') return fail('permission-denied', 'not-your-team');
  await logActivity(ctx.kv, teamId, ctx.now(), {
    actorUid: actor.uid,
    role: 'manager',
    kind: kind as ReportedKind,
    clientId,
  });
  return { ok: true };
}

export interface ActivityRow extends Omit<ActivityEntry, 'actorUid'> {
  actorUid: string;
  actorName: string;
  /** client name for entries about a client; for member entries the member's name */
  subjectName: string;
  /** where a request stands NOW (pending / accepted / declined / cancelled / expired / approved), for request entries */
  liveStatus?: string;
}

/**
 * The activity log as the caller may read it: the owner trainer reads everything; a manager reads own entries, or all when the
 * owner turned on "See all team activity" for them. Names are resolved here (metadata only; session times stay in the
 * sealed schedule). Newest first.
 */
export async function teamActivity(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown> = {},
): Promise<{ entries: ActivityRow[]; scope: ActivityScope | 'owner' }> {
  const { teamId, me, owner } = await myTeam(ctx, actor);
  if (!owner && me.role !== 'manager') return fail('permission-denied', 'not-allowed');
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 200);
  const acl = owner
    ? null
    : ((await ctx.kv.get(`teams/${teamId}/acl/${actor.uid}`)) as {
        activityScope?: ActivityScope;
      } | null);
  const scope: ActivityScope | 'owner' = owner
    ? 'owner'
    : acl?.activityScope === 'all'
      ? 'all'
      : 'own';
  const rows = await ctx.kv.list(`teams/${teamId}/activity`, { limit: 500 });
  const names = new Map<string, string>();
  const nameFor = async (uid: string | undefined): Promise<string> => {
    if (!uid) return '';
    if (!names.has(uid))
      names.set(uid, nameOf((await ctx.kv.get(`users/${uid}`)) as UserRec | null));
    return names.get(uid) ?? '';
  };
  const entries: ActivityRow[] = [];
  const all = rows
    .map((r) => r.data as unknown as ActivityEntry)
    .filter((e) => scope !== 'own' || e.actorUid === actor.uid)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
  const liveStatusOf = async (e: ActivityEntry): Promise<string | undefined> => {
    if (e.kind === 'removal-request' && e.refId) {
      const r = await ctx.kv.get(`teamRequests/${e.refId}`);
      return typeof r?.status === 'string' ? r.status : undefined;
    }
    if (e.kind === 'move-request' && e.refId && e.clientId) {
      const c = (await ctx.kv.get(`coaching/${e.clientId}`)) as { trainerId?: string } | null;
      if (!c?.trainerId) return undefined;
      const cid = conversationId(ctx.pepper, e.clientId, c.trainerId);
      const r = await ctx.kv.get(`conversations/${cid}/requests/${e.refId}`);
      return typeof r?.status === 'string' ? r.status : undefined;
    }
    return undefined;
  };
  for (const e of all) {
    const live = await liveStatusOf(e);
    entries.push({
      ...e,
      actorName: await nameFor(e.actorUid),
      subjectName: await nameFor(e.clientId ?? e.refId),
      ...(live ? { liveStatus: live } : {}),
    });
  }
  return { entries, scope };
}

/* ---- Spotter: the service messages of the team (SPO-236) -------------------------------------------------------- */
export const SPOTTER_KINDS = [
  'removal-request',
  'removal-answer',
  'manager-move',
  'team',
  'unmarked',
] as const;
export interface SpotterItem {
  id: string;
  kind: (typeof SPOTTER_KINDS)[number];
  /** the other person's name (actor), when known */
  actorName: string;
  /** the client's / the member's name */
  subjectName: string;
  createdAt: number;
  unread: boolean;
  /** removal-request: where it stands now; removal-answer: approved / declined */
  status?: string;
  /** removal-request: the id the Agenda answers with */
  refId?: string;
  /** unmarked: when the unmarked session ended (epoch ms) */
  at?: number;
}

/** The caller's own service messages about the team, newest first. Metadata only: names, never client content. */
export async function teamNotices(
  ctx: Ctx,
  actor: Actor,
): Promise<{ items: SpotterItem[]; unread: number }> {
  const rows = await ctx.kv.list(`users/${actor.uid}/notices`, { limit: 200 });
  const kinds = new Set<string>(SPOTTER_KINDS);
  // "not marked" notices carry a session time: they are forgotten after 30 days
  const stale = ctx.now() - 30 * 86_400_000;
  for (const r of rows)
    if (r.data.kind === 'unmarked' && Number(r.data.createdAt) < stale) await ctx.kv.del(r.path);
  const mine = rows
    .filter((r) => !(r.data.kind === 'unmarked' && Number(r.data.createdAt) < stale))
    .map((r) => r.data as Record<string, unknown>)
    .filter((n) => kinds.has(String(n.kind)))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 50);
  const items: SpotterItem[] = [];
  for (const n of mine) {
    const actorRec = n.actor ? ((await ctx.kv.get(`users/${n.actor}`)) as UserRec | null) : null;
    let status = typeof n.status === 'string' ? n.status : undefined;
    if (n.kind === 'removal-request' && typeof n.refId === 'string') {
      const r = await ctx.kv.get(`teamRequests/${n.refId}`);
      if (typeof r?.status === 'string') status = r.status;
    }
    items.push({
      id: String(n.id),
      kind: n.kind as SpotterItem['kind'],
      actorName: nameOf(actorRec),
      subjectName: typeof n.detail === 'string' ? n.detail : '',
      createdAt: Number(n.createdAt),
      unread: n.readAt == null,
      ...(status ? { status } : {}),
      ...(typeof n.refId === 'string' ? { refId: n.refId } : {}),
      ...(n.kind === 'unmarked' && typeof n.start === 'number' ? { at: n.start } : {}),
    });
  }
  return { items, unread: items.filter((i) => i.unread).length };
}

/** Mark the caller's team service messages read. */
export async function teamNoticesRead(ctx: Ctx, actor: Actor): Promise<{ ok: true }> {
  const now = ctx.now();
  const kinds = new Set<string>(SPOTTER_KINDS);
  for (const r of await ctx.kv.list(`users/${actor.uid}/notices`, { limit: 200 }))
    if (kinds.has(String(r.data.kind)) && r.data.readAt == null)
      await ctx.kv.merge(r.path, { readAt: now });
  return { ok: true };
}

/* ---- the client's view of the trainer's team (SPO-205) ------------------------------------------------------------ */
export interface ClientTeamView {
  trainerName: string;
  /** everyone who works with the trainer's clients (names and roles only) */
  members: { name: string; role: TeamRole }[];
  /** what team managers did that concerns THIS client, newest first (metadata only) */
  actions: { id: string; kind: string; actorName: string; ts: number }[];
}
const CLIENT_VISIBLE_KINDS = new Set([
  'move-request',
  'move-cancel',
  'session-done',
  'session-missed',
  'session-cancelled',
  'session-edited',
]);

/**
 * CLIENT: who is in my trainer's team and what managers did with my schedule. Names and roles only; nothing about other
 * clients and no activity of the trainers themselves (those are in "Who saw your data" as before).
 */
export async function teamForClient(ctx: Ctx, actor: Actor): Promise<ClientTeamView> {
  const c = (await ctx.kv.get(`coaching/${actor.uid}`)) as {
    status?: string;
    trainerId?: string;
  } | null;
  if (!c || c.status !== 'active' || !c.trainerId)
    return { trainerName: '', members: [], actions: [] };
  const trainer = (await ctx.kv.get(`users/${c.trainerId}`)) as UserRec | null;
  const teamId = trainer?.teamId || c.trainerId;
  const rows = (await ctx.kv.list(`teams/${teamId}/members`))
    .map((r) => r.data as unknown as MemberRec)
    .filter((m) => m.status === 'active');
  const hasManager = rows.some((m) => m.role === 'manager');
  const members: ClientTeamView['members'] = [];
  if (hasManager) {
    const uids = new Set(rows.map((m) => m.uid));
    uids.add(teamId);
    for (const uid of uids) {
      const role = rows.find((m) => m.uid === uid)?.role ?? 'trainer';
      members.push({ name: nameOf((await ctx.kv.get(`users/${uid}`)) as UserRec | null), role });
    }
    members.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  }
  const log = await ctx.kv.list(`teams/${teamId}/activity`, {
    where: [['clientId', '==', actor.uid]],
    limit: 200,
  });
  const actions: ClientTeamView['actions'] = [];
  for (const e of log
    .map(
      (r) =>
        r.data as unknown as {
          id: string;
          role: string;
          actorUid: string;
          kind: string;
          ts: number;
        },
    )
    .filter((e) => e.role === 'manager' && CLIENT_VISIBLE_KINDS.has(e.kind))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50))
    actions.push({
      id: e.id,
      kind: e.kind,
      ts: e.ts,
      actorName: nameOf((await ctx.kv.get(`users/${e.actorUid}`)) as UserRec | null),
    });
  return { trainerName: nameOf(trainer), members, actions };
}

/* ---- a manager invites a client for one of the team's trainers (SPO-202) ---------------------------------------- */
/**
 * MANAGER: the same invite a trainer sends, issued for a trainer of the manager's team (`trainerId`). The client then
 * accepts it like any trainer invite and becomes that trainer's client; the manager gets no access to the client's data
 * beyond the schedule delegation. Logged as `client-invite`; the trainer is told by a content-free push.
 */
export async function inviteClientForTrainer(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof coachInvite>>> {
  const { teamId, me } = await myTeam(ctx, actor);
  if (me.role !== 'manager') return fail('permission-denied', 'managers-only');
  const trainerId = typeof body.trainerId === 'string' ? body.trainerId : '';
  if (!isUid(trainerId)) return fail('invalid-argument', 'invalid-trainer');
  const tm = (await ctx.kv.get(`teams/${teamId}/members/${trainerId}`)) as MemberRec | null;
  const ownerOk = trainerId === teamId;
  if (!ownerOk && !(tm && tm.status === 'active' && tm.role === 'trainer'))
    return fail('permission-denied', 'not-your-team');
  // A manager only starts the ordinary app invite: the client accepts it and decides what to share. No instant program-only
  // client, no consent levels chosen for the client, no push to a named user (SPO-267).
  if (body.mode !== 'app') return fail('permission-denied', 'app-invite-only');
  const r = await coachInvite(
    ctx,
    { uid: trainerId, role: 'trainer' },
    { name: body.name, mode: 'app' },
  );
  await logActivity(ctx.kv, teamId, ctx.now(), {
    actorUid: actor.uid,
    role: 'manager',
    kind: 'client-invite',
    refId: r.inviteId.slice(0, 24),
  });
  await ctx.notify?.(trainerId, 'team');
  return r;
}
