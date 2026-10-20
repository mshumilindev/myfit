/**
 * Team test double for stories and tests (never imported by app code: `tests/kit-guard.test.ts`). The lab team of the
 * Design board: Olena Kovalenko (trainer, owner), Andriy Petrenko (trainer), Irina Melnyk (manager), one open invite.
 */
import { createDemoClock } from '../../data/__fixtures__/demoClock';
import { TeamPortError, type TeamPort } from '../port';
import { teamInviteLink } from '../../inviteLink';
import {
  type TeamRole,
  type ActivityScope,
  type TeamData,
  type TeamMember,
  type TeamRequest,
} from '../types';

const DAY = 86_400_000;

export type TeamViewer = 'trainer' | 'manager';

export interface FixturesTeamOptions {
  /** who is looking: the owner trainer (default) or the manager */
  viewer?: TeamViewer;
  delayMs?: number;
  now?: () => number;
  /** every load fails with this code (offline / error stories) */
  failWith?: () => TeamPortError['code'] | null;
  /** start without the cached snapshot (Loading story) */
  cold?: boolean;
  /** the invite behind `#/team-invite/<token>`: who is invited (default manager) and whether it is still open */
  invite?: { role?: TeamRole; closed?: boolean; notEligible?: boolean };
  /** managers: how many clients are ready for the schedule key */
  ready?: { ready: number; total: number };
  /** open manager requests the trainer sees in the Agenda (default none, so other screens' tests stay as they are) */
  withRequests?: boolean;
}

export function buildFixtureTeam(
  viewer: TeamViewer,
  now: number,
  ready = { ready: 9, total: 14 },
): TeamData {
  const olena: TeamMember = {
    uid: 'trainer-olena',
    name: 'Olena Kovalenko',
    role: 'trainer',
    you: viewer === 'trainer',
    addedAt: null,
    lastActiveAt: viewer === 'trainer' ? now : now - 2 * 3_600_000,
  };
  const andriy: TeamMember = {
    uid: 'trainer-andriy',
    name: 'Andriy Petrenko',
    role: 'trainer',
    you: false,
    addedAt: now - 60 * DAY,
    lastActiveAt: now - DAY,
    email: 'andriy.p@example.com',
  };
  const irina: TeamMember = {
    uid: 'manager-irina',
    name: 'Irina Melnyk',
    role: 'manager',
    you: viewer === 'manager',
    addedAt: now - 25 * DAY,
    lastActiveAt: viewer === 'manager' ? now : now - 40 * 60_000,
    email: 'irina.m@example.com',
    activityScope: 'own',
    scheduleReady: ready,
  };
  const members = viewer === 'trainer' ? [olena, andriy, irina] : [irina, olena, andriy];
  return {
    me: { uid: members[0].uid, role: viewer, isOwner: viewer === 'trainer' },
    ownerName: olena.name,
    members,
    invites: [
      viewer === 'trainer'
        ? {
            id: 'inv-kateryna',
            url: teamInviteLink('inv-kateryna'),
            email: 'kateryna@example.com',
            role: 'manager',
            sentAt: now - 2 * DAY,
          }
        : {
            id: 'inv-pavlo',
            url: teamInviteLink('inv-pavlo'),
            email: 'pavlo@example.com',
            role: 'trainer',
            sentAt: now - DAY,
          },
    ],
    asOf: now,
  };
}

export function createFixturesTeamPort(o: FixturesTeamOptions = {}): TeamPort {
  const viewer = o.viewer ?? 'trainer';
  const clock = o.now ?? createDemoClock();
  let data = buildFixtureTeam(viewer, clock(), o.ready);
  let cold = !!o.cold;
  let reqs: TeamRequest[] = o.withRequests
    ? [
        {
          id: 'rm-c4',
          kind: 'client-removal',
          clientId: 'c4',
          clientName: 'Sofiia Hnatiuk',
          managerName: 'Irina Melnyk',
          reason: 'Moved to another city and asked to pause.',
          createdAt: clock() - 3 * 3_600_000,
        },
      ]
    : [];
  const wait = () => (o.delayMs ? new Promise((r) => setTimeout(r, o.delayMs)) : Promise.resolve());
  const guard = async () => {
    await wait();
    const f = o.failWith?.();
    if (f) throw new TeamPortError(f);
  };
  return {
    peek: () => (cold ? null : data),
    now: clock,
    async load() {
      await guard();
      cold = false;
      return data;
    },
    async invite(email, role) {
      await guard();
      if (data.invites.some((i) => i.email === email)) throw new TeamPortError('exists');
      const url = teamInviteLink(`inv-${email.replace(/[^a-z0-9]/g, '')}`);
      data = {
        ...data,
        invites: [...data.invites, { id: `inv-${email}`, email, role, sentAt: clock(), url }],
      };
      return { url };
    },
    async previewInvite() {
      await guard();
      if (o.invite?.closed) throw new TeamPortError('closed');
      return {
        role: o.invite?.role ?? 'manager',
        ownerName: 'Olena Kovalenko',
        inviterName: 'Olena Kovalenko',
        expiresAt: clock() + 5 * DAY,
      };
    },
    async acceptInvite() {
      await guard();
      if (o.invite?.notEligible) throw new TeamPortError('not-eligible');
    },
    async declineInvite() {
      await guard();
    },
    async revokeInvite(id) {
      await guard();
      data = { ...data, invites: data.invites.filter((i) => i.id !== id) };
    },
    async removeMember(uid) {
      await guard();
      data = { ...data, members: data.members.filter((m) => m.uid !== uid) };
    },
    async leave() {
      await guard();
    },
    async requests() {
      await guard();
      return reqs;
    },
    async answerRequest(id) {
      await guard();
      reqs = reqs.filter((r) => r.id !== id);
    },
    async requestRemoval() {
      await guard();
    },
    async cancelRemoval() {
      await guard();
    },
    async setActivityScope(uid: string, scope: ActivityScope) {
      await guard();
      data = {
        ...data,
        members: data.members.map((m) => (m.uid === uid ? { ...m, activityScope: scope } : m)),
      };
    },
  };
}
