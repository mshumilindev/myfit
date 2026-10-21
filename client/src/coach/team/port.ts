import type {
  ActivityPage,
  ActivityScope,
  SpotterFeed,
  TeamActivity,
  TeamData,
  TeamRequest,
  TeamRole,
} from './types';

export type TeamErrorCode =
  | 'offline'
  | 'forbidden'
  | 'unavailable'
  | 'invalid-email'
  | 'exists'
  | 'not-found'
  | 'closed'
  | 'not-eligible';

export class TeamPortError extends Error {
  constructor(readonly code: TeamErrorCode) {
    super(code);
    this.name = 'TeamPortError';
  }
}

/** What the person sees before joining (an open invite only; a closed one rejects with `closed`). */
export interface InvitePreview {
  role: TeamRole;
  ownerName: string;
  inviterName: string;
  expiresAt: number;
}

/**
 * The seam between the Team screens and the data (callables `team*`, see functions/src/coach). The real adapter is
 * installed with the other coach adapters; tests and stories pass the fixtures one. Every write is idempotent.
 */
export interface TeamPort {
  /** Last good snapshot from the local cache, or null. Never blocks. */
  peek(): TeamData | null;
  load(): Promise<TeamData>;
  /** Invite one person by email as a manager or a trainer (the sender picks the type). */
  invite(email: string, role: TeamRole): Promise<{ url: string }>;
  revokeInvite(id: string): Promise<void>;
  /** Owner trainer only. Access ends at once; the keys are renewed by the clients' apps. */
  removeMember(uid: string): Promise<void>;
  leave(): Promise<void>;
  setActivityScope(uid: string, scope: ActivityScope): Promise<void>;
  /**
   * The activity log as the caller may read it (owner: all; manager: own or all), one page at a time, newest first.
   * No page = the first one. TODO(server, functions/src/coach/team.ts `teamActivity`): honour `before` (return only
   * entries with ts < before); until then the adapter drops pages that bring nothing new.
   */
  activity(page?: ActivityPage): Promise<TeamActivity>;
  /** Spotter: the caller's service messages about the team, newest first. */
  notices(): Promise<SpotterFeed>;
  markNoticesRead(): Promise<void>;
  /** TRAINER: open requests from managers about their clients (Agenda "Team requests"). */
  requests(): Promise<TeamRequest[]>;
  /** TRAINER: approve (runs the usual end-of-coaching) or decline. */
  answerRequest(id: string, approve: boolean): Promise<void>;
  /** MANAGER: invite a client for one of the team's trainers; the link is handed over like any trainer invite. */
  inviteClient(trainerId: string, name: string): Promise<{ url: string }>;
  /** MANAGER: ask the client's trainer to remove a client. Nothing changes until the trainer approves. */
  requestRemoval(clientId: string, reason: string): Promise<void>;
  cancelRemoval(id: string): Promise<void>;
  /** The invitee side (`#/team-invite/<token>`). */
  previewInvite(token: string): Promise<InvitePreview>;
  acceptInvite(token: string): Promise<void>;
  declineInvite(token: string): Promise<void>;
  /** Clock override (fixtures). */
  now?(): number;
}

/** Before the real adapter is installed: reports `unavailable`, never sample people. */
export function createUnavailableTeamPort(): TeamPort {
  const fail = (): never => {
    throw new TeamPortError('unavailable');
  };
  return {
    peek: () => null,
    load: () => Promise.reject(new TeamPortError('unavailable')),
    invite: fail,
    revokeInvite: fail,
    removeMember: fail,
    leave: fail,
    setActivityScope: fail,
    activity: () => Promise.reject(new TeamPortError('unavailable')),
    inviteClient: () => Promise.reject(new TeamPortError('unavailable')),
    notices: () => Promise.reject(new TeamPortError('unavailable')),
    markNoticesRead: () => Promise.reject(new TeamPortError('unavailable')),
    requests: () => Promise.reject(new TeamPortError('unavailable')),
    answerRequest: fail,
    requestRemoval: fail,
    cancelRemoval: fail,
    previewInvite: () => Promise.reject(new TeamPortError('unavailable')),
    acceptInvite: fail,
    declineInvite: fail,
  };
}
