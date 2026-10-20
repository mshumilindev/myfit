/**
 * The real `TeamPort`: the `team*` callables (functions/src/coach/team.ts). The server decides who sees what (the
 * owner trainer sees managers' settings and every pending invite); the last good snapshot is kept for the next
 * start so the page never opens on a spinner. Nothing sealed is read or written here.
 */
import { teamInviteLink } from '../../inviteLink';
import { TeamPortError, type TeamErrorCode, type TeamPort } from '../../team/port';
import type { TeamData } from '../../team/types';
import type { FsApi } from './fsApi';

interface Snapshot extends Omit<TeamData, 'invites'> {
  invites: {
    id: string;
    email: string;
    role: TeamData['invites'][number]['role'];
    sentAt: number;
  }[];
}

const REASONS: Record<string, TeamErrorCode> = {
  'invalid-email': 'invalid-email',
  'invite-exists': 'exists',
  'no-invite': 'not-found',
  'no-member': 'not-found',
};

function toTeamError(e: unknown): TeamPortError {
  if (e instanceof TeamPortError) return e;
  const x = e as { code?: unknown; message?: unknown; details?: { reason?: unknown } } | null;
  const reason =
    typeof x?.details?.reason === 'string'
      ? x.details.reason
      : typeof x?.message === 'string'
        ? x.message
        : '';
  if (REASONS[reason]) return new TeamPortError(REASONS[reason]);
  const code = typeof x?.code === 'string' ? x.code.replace(/^functions\//, '') : '';
  if (code === 'permission-denied') return new TeamPortError('forbidden');
  if (code === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return new TeamPortError('offline');
  return new TeamPortError('unavailable');
}

export function createFirestoreTeamPort(fs: FsApi): TeamPort {
  let last: TeamData | null = null;
  const call = async <T>(name: string, data: Record<string, unknown> = {}): Promise<T> => {
    try {
      return await fs.call<T>(name, data);
    } catch (e) {
      throw toTeamError(e);
    }
  };
  return {
    peek: () => last,
    async load() {
      const s = await call<Snapshot>('teamRead');
      last = { ...s, invites: s.invites.map((i) => ({ ...i, url: teamInviteLink(i.id) })) };
      return last;
    },
    async invite(email) {
      const r = await call<{ inviteId: string; url: string }>('teamInvite', { email });
      return { url: r.url || teamInviteLink(r.inviteId) };
    },
    async revokeInvite(id) {
      await call('teamInviteRevoke', { inviteId: id });
    },
    async removeMember(uid) {
      await call('teamRemoveMember', { uid });
    },
    async leave() {
      await call('teamLeave');
    },
    async setActivityScope(uid, scope) {
      await call('teamSetActivityScope', { uid, scope });
    },
  };
}
