import type { ActivityScope, TeamData } from './types';

export type TeamErrorCode =
  'offline' | 'forbidden' | 'unavailable' | 'invalid-email' | 'exists' | 'not-found';

export class TeamPortError extends Error {
  constructor(readonly code: TeamErrorCode) {
    super(code);
    this.name = 'TeamPortError';
  }
}

/**
 * The seam between the Team screens and the data (callables `team*`, see functions/src/coach). The real adapter is
 * installed with the other coach adapters; tests and stories pass the fixtures one. Every write is idempotent.
 */
export interface TeamPort {
  /** Last good snapshot from the local cache, or null. Never blocks. */
  peek(): TeamData | null;
  load(): Promise<TeamData>;
  /** Invite by email: the role follows the viewer (a trainer invites a manager, a manager a trainer). */
  invite(email: string): Promise<{ url: string }>;
  revokeInvite(id: string): Promise<void>;
  /** Owner trainer only. Access ends at once; the keys are renewed by the clients' apps. */
  removeMember(uid: string): Promise<void>;
  leave(): Promise<void>;
  setActivityScope(uid: string, scope: ActivityScope): Promise<void>;
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
  };
}
