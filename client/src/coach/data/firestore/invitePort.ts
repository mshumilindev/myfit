/**
 * The real trainer-side `InvitePort`: the `coachInvite` callable (R-BE-REL-2). The server validates the name, the
 * mode and the requested levels, enforces the invite limits and mints the link; a program-only client without an
 * account is added at once (no link). Nothing is persisted on this device: the new client is part of the roster the
 * next `coachClients` call returns.
 */
import { effectiveRequest } from '../../domain/invite';
import { inviteLink, inviteTokenOf } from '../../inviteLink';
import type { InvitePort, InviteResult } from '../inviteStore';
import { PortError } from '../port';
import { toPortError } from './errors';
import type { FsApi } from './fsApi';

interface InviteResponse {
  inviteId: string;
  name: string;
  mode: InviteResult['mode'];
  url: string | null;
  sentAt: number;
  expiresAt: number | null;
  clientId?: string;
}

export function createFirestoreInvitePort(fs: FsApi): InvitePort {
  return {
    async revoke(inviteId) {
      try {
        await fs.call('coachInviteRevoke', { inviteId });
      } catch (e) {
        throw toPortError(e);
      }
    },
    async create(req) {
      const request = effectiveRequest(req.mode, req.request); // the same cut the server applies
      try {
        const r = await fs.call<InviteResponse>('coachInvite', {
          name: req.name,
          mode: req.mode,
          request,
        });
        return {
          id: r.clientId ?? r.inviteId,
          name: r.name,
          mode: r.mode,
          // one link format for the whole app (`<origin>/#/invite/<token>`): a server that still answers with another
          // shape is normalised here, the token is the invite id
          url: r.url == null ? null : inviteTokenOf(r.url) ? r.url : inviteLink(r.inviteId),
          sentAt: r.sentAt,
          expiresAt: r.expiresAt,
        };
      } catch (e) {
        // the server's reason code ('invalid-name', 'daily-limit' ...) travels as the message; never user text
        const p = toPortError(e);
        const m = (e as { message?: unknown })?.message;
        throw typeof m === 'string' && /^[a-z][a-z-]{1,40}$/.test(m) ? new PortError(p.code, m) : p;
      }
    },
  };
}
