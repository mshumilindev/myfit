/**
 * Invites made in this session + the port that creates them. The real adapter is `data/firestore/invitePort.ts` over the `coachInvite` and `coachInviteRevoke` callables
 * (`coachInvite({username?|newClient?, mode}) -> {inviteId, url}`); the default port is a local one that mints a
 * link (`inviteLink.ts`) and never touches the network. Nothing is persisted here:
 * a created invite is part of the world the server returns on the next load.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { effectiveRequest, INVITE_VALID_DAYS, nameProblem } from '../domain/invite';
import { inviteLink } from '../inviteLink';
import type { Consent, LogMode } from '../domain/types';
import { PortError } from './port';

export interface InviteRequest {
  name: string;
  mode: LogMode;
  /** Requested consent levels (all off for program-only). The client decides at accept. */
  request: Consent;
}
export interface InviteResult {
  id: string;
  name: string;
  mode: LogMode;
  /** null for program-only: no link, the client is added at once. */
  url: string | null;
  sentAt: number;
  expiresAt: number | null;
}
export interface InvitePort {
  create(req: InviteRequest): Promise<InviteResult>;
  /** Withdraw an unclaimed invite: its link stops working for everybody (`coachInviteRevoke`). */
  revoke(inviteId: string): Promise<void>;
}

const token = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    : Math.random().toString(36).slice(2, 22).padEnd(20, '0');

/** Local port: validates like the server will, then mints a link. `now` / `fail` are for stories and tests. */
export function createLocalInvitePort(
  opts: { now?: () => number; delayMs?: number; fail?: 'offline' | 'unavailable' } = {},
): InvitePort {
  const now = opts.now ?? Date.now;
  return {
    async revoke() {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new PortError(opts.fail);
    },
    async create(req) {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new PortError(opts.fail);
      if (nameProblem(req.name)) throw new PortError('unavailable', 'invalid-name');
      const sentAt = now();
      const id = token();
      effectiveRequest(req.mode, req.request); // the request travels with the invite on the real path
      return req.mode === 'program'
        ? { id, name: req.name.trim(), mode: req.mode, url: null, sentAt, expiresAt: null }
        : {
            id,
            name: req.name.trim(),
            mode: req.mode,
            url: inviteLink(id),
            sentAt,
            expiresAt: sentAt + INVITE_VALID_DAYS * 86_400_000,
          };
    },
  };
}

let port: InvitePort = createLocalInvitePort();
export function configureInvitePort(p: InvitePort): void {
  port = p;
}

/* ---- the session list (module store, tiny) ----------------------------------------------------------------- */
let created: readonly InviteResult[] = [];
/** Invites withdrawn in this session (the roster hides them until the next load drops them for good). */
let withdrawn: ReadonlySet<string> = new Set();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function resetCreatedInvites(): void {
  created = [];
  withdrawn = new Set();
  emit();
}

export interface InviteApi {
  /** Invites and program-only clients created in this session, newest first. */
  created: readonly InviteResult[];
  create(req: InviteRequest): Promise<InviteResult>;
  /** Ids withdrawn in this session. */
  withdrawn: ReadonlySet<string>;
  /** Throws `PortError` like `create`; the invite leaves the list only after the server confirmed. */
  revoke(inviteId: string): Promise<void>;
}

/** Throws `PortError` (offline / unavailable); the panel shows it and keeps the typed name. */
export function useCoachInvites(override?: InvitePort): InviteApi {
  const sub = useCallback((f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  const list = useSyncExternalStore(
    sub,
    () => created,
    () => created,
  );
  const gone = useSyncExternalStore(
    sub,
    () => withdrawn,
    () => withdrawn,
  );
  const create = useCallback(
    async (req: InviteRequest) => {
      const res = await (override ?? port).create(req);
      created = [res, ...created.filter((c) => c.id !== res.id)];
      emit();
      return res;
    },
    [override],
  );
  const revoke = useCallback(
    async (id: string) => {
      await (override ?? port).revoke(id);
      withdrawn = new Set([...withdrawn, id]);
      created = created.filter((c) => c.id !== id);
      emit();
    },
    [override],
  );
  return { created: list, create, withdrawn: gone, revoke };
}
