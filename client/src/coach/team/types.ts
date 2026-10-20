/**
 * Team domain (SPO-196, ADR 005). Plain data, no functions, no Firebase: the screens read it through the `TeamPort`.
 * A trainer owns a team and adds MANAGERS; a manager adds TRAINERS. There is no role picker anywhere.
 */
export type TeamRole = 'trainer' | 'manager';

export type ActivityScope = 'own' | 'all';

export interface TeamMember {
  uid: string;
  name: string;
  role: TeamRole;
  /** the signed-in person */
  you: boolean;
  /** ms; null = unknown (the team owner has no "added" date) */
  addedAt: number | null;
  lastActiveAt: number | null;
  /** only what the viewer may see: the owner trainer sees a manager's email and settings */
  email?: string;
  activityScope?: ActivityScope;
  /** managers: clients whose schedule key the client's app already delegated, of all clients of the team */
  scheduleReady?: { ready: number; total: number };
}

export interface TeamInvite {
  id: string;
  email: string;
  /** the role the invitee gets */
  role: TeamRole;
  sentAt: number;
  /** the link to hand over (the inviter only); absent on a snapshot cached without it */
  url?: string;
}

export interface TeamData {
  me: { uid: string; role: TeamRole; /** the trainer who owns the team */ isOwner: boolean };
  ownerName: string;
  members: TeamMember[];
  invites: TeamInvite[];
  /** server / cache time of this snapshot (the UI shows relative times against it) */
  asOf: number;
}

/** The type the add sheet starts on: a trainer usually adds a manager, a manager a trainer. Either can pick the other. */
export const defaultInviteeRole = (viewer: TeamRole): TeamRole =>
  viewer === 'trainer' ? 'manager' : 'trainer';

/** Only the team owner removes a manager; anyone leaves on their own. */
export const canRemoveMembers = (me: TeamData['me']): boolean =>
  me.role === 'trainer' && me.isOwner;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim());

/** A request from a manager the trainer answers (SPO-239). Today only: remove a client. */
export interface TeamRequest {
  id: string;
  kind: 'client-removal';
  clientId: string;
  clientName: string;
  managerName: string;
  /** the manager's reason (may be empty) */
  reason: string;
  createdAt: number;
}
