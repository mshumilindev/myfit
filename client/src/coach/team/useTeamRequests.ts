import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { TeamPort } from './port';
import type { TeamRequest } from './types';
import { getTeamPort } from './useTeam';

export interface TeamRequestsApi {
  requests: readonly TeamRequest[];
  /** resolves true when the server took the answer */
  answer: (id: string, approve: boolean) => Promise<boolean>;
}

const NONE: readonly TeamRequest[] = [];

interface RequestsStore {
  get: () => readonly TeamRequest[];
  subscribe: (cb: () => void) => () => void;
  load: () => void;
  answer: (id: string, approve: boolean) => Promise<boolean>;
}

function createStore(p: TeamPort): RequestsStore {
  let list: readonly TeamRequest[] = NONE;
  let loading = false;
  const subs = new Set<() => void>();
  const set = (next: readonly TeamRequest[]) => {
    list = next;
    subs.forEach((f) => f());
  };
  return {
    get: () => list,
    subscribe: (cb) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    load: () => {
      if (loading) return;
      loading = true;
      p.requests().then(
        (r) => {
          loading = false;
          set(r);
        },
        () => {
          loading = false;
        },
      );
    },
    answer: async (id, approve) => {
      try {
        await p.answerRequest(id, approve);
        set(list.filter((r) => r.id !== id));
        return true;
      } catch {
        return false;
      }
    },
  };
}

const stores = new WeakMap<TeamPort, RequestsStore>();
const storeFor = (p: TeamPort): RequestsStore => {
  let s = stores.get(p);
  if (!s) stores.set(p, (s = createStore(p)));
  return s;
};

/**
 * The trainer's open team requests, ONE list per port, so the Agenda section and the nav badge always agree. A failed load is
 * an empty list (the section simply is not there): the Agenda must never break on a team feature. Answered requests leave the
 * list at once. `enabled: false` (a manager) neither loads nor shows anything.
 */
export function useTeamRequests(port?: TeamPort, enabled = true): TeamRequestsApi {
  const p = port ?? getTeamPort();
  const s = storeFor(p);
  const requests = useSyncExternalStore(
    s.subscribe,
    () => (enabled ? s.get() : NONE),
    () => NONE,
  );
  useEffect(() => {
    if (enabled) s.load();
  }, [s, enabled]);
  const answer = useCallback((id: string, approve: boolean) => s.answer(id, approve), [s]);
  return { requests, answer };
}
