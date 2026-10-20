import { useCallback, useEffect, useState } from 'react';
import type { TeamPort } from './port';
import type { TeamRequest } from './types';
import { getTeamPort } from './useTeam';

export interface TeamRequestsApi {
  requests: readonly TeamRequest[];
  /** resolves true when the server took the answer */
  answer: (id: string, approve: boolean) => Promise<boolean>;
}

/**
 * The trainer's open team requests. A failed load is an empty list (the section simply is not there): the Agenda must never
 * break on a team feature. Answered requests leave the list at once.
 */
export function useTeamRequests(port?: TeamPort): TeamRequestsApi {
  const p = port ?? getTeamPort();
  const [requests, setRequests] = useState<readonly TeamRequest[]>([]);
  useEffect(() => {
    let live = true;
    p.requests().then(
      (r) => live && setRequests(r),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [p]);
  const answer = useCallback(
    async (id: string, approve: boolean) => {
      try {
        await p.answerRequest(id, approve);
        setRequests((l) => l.filter((r) => r.id !== id));
        return true;
      } catch {
        return false;
      }
    },
    [p],
  );
  return { requests, answer };
}
