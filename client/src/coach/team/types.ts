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

export type ActivityKind =
  | 'move-request'
  | 'move-cancel'
  | 'removal-request'
  | 'removal-approved'
  | 'removal-declined'
  | 'removal-cancelled'
  | 'session-done'
  | 'session-missed'
  | 'session-cancelled'
  | 'session-edited'
  | 'member-added'
  | 'member-removed'
  | 'member-left'
  | 'client-invite';

/** One line of the activity log (metadata only; names are resolved by the server). */
export interface ActivityRow {
  id: string;
  actorUid: string;
  actorName: string;
  role: TeamRole;
  kind: ActivityKind;
  /** the client's name, or the member's name for team entries */
  subjectName: string;
  ts: number;
  /** where a request stands now (pending / accepted / declined / cancelled / expired / approved) */
  liveStatus?: string;
  /** a detail the entry carries (an invited e-mail) */
  detail?: string;
}

export interface TeamActivity {
  entries: ActivityRow[];
  /** `owner` reads all; a manager reads `own` or `all` (the owner's setting) */
  scope: ActivityScope | 'owner';
}

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
