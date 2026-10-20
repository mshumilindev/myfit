/**
 * Team test double for stories and tests (never imported by app code: `tests/kit-guard.test.ts`). The lab team of the
 * Design board: Olena Kovalenko (trainer, owner), Andriy Petrenko (trainer), Irina Melnyk (manager), one open invite.
 */
import { createDemoClock } from '../../data/__fixtures__/demoClock';
import { TeamPortError, type TeamPort } from '../port';
import { inviteeRole, type ActivityScope, type TeamData, type TeamMember } from '../types';

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
  /** managers: how many clients are ready for the schedule key */
  ready?: { ready: number; total: number };
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
            email: 'kateryna@example.com',
            role: 'manager',
            sentAt: now - 2 * DAY,
          }
        : { id: 'inv-pavlo', email: 'pavlo@example.com', role: 'trainer', sentAt: now - DAY },
    ],
    asOf: now,
  };
}

export function createFixturesTeamPort(o: FixturesTeamOptions = {}): TeamPort {
  const viewer = o.viewer ?? 'trainer';
  const clock = o.now ?? createDemoClock();
  let data = buildFixtureTeam(viewer, clock(), o.ready);
  let cold = !!o.cold;
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
    async invite(email) {
      await guard();
      if (data.invites.some((i) => i.email === email)) throw new TeamPortError('exists');
      data = {
        ...data,
        invites: [
          ...data.invites,
          { id: `inv-${email}`, email, role: inviteeRole(viewer), sentAt: clock() },
        ],
      };
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
    async setActivityScope(uid: string, scope: ActivityScope) {
      await guard();
      data = {
        ...data,
        members: data.members.map((m) => (m.uid === uid ? { ...m, activityScope: scope } : m)),
      };
    },
  };
}
