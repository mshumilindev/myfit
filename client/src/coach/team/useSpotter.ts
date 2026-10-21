import { useCallback, useEffect, useState } from 'react';
import type { TeamPort } from './port';
import type { SpotterFeed } from './types';
import { getTeamPort } from './useTeam';
import { teamRequestsStoreFor } from './useTeamRequests';

export interface SpotterApi {
  feed: SpotterFeed | null;
  failed: boolean;
  reload: () => void;
  /** answer a removal request, then refresh; true when the server took it */
  answer: (refId: string, approve: boolean) => Promise<boolean>;
  markRead: () => void;
}

/** Spotter's team messages. A failed load is `failed` (the screen offers Retry); a failed read-mark is silent. */
export function useSpotter(port?: TeamPort): SpotterApi {
  const p = port ?? getTeamPort();
  const [feed, setFeed] = useState<SpotterFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    p.notices().then(
      (f) => live && (setFeed(f), setFailed(false)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [p, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const answer = useCallback(
    async (refId: string, approve: boolean) => {
      // the same action as the Agenda card: its store sends the answer and drops the request there too
      const ok = await teamRequestsStoreFor(p).answer(refId, approve);
      if (ok) setAttempt((n) => n + 1);
      return ok;
    },
    [p],
  );
  const markRead = useCallback(() => {
    p.markNoticesRead().then(
      () =>
        setFeed((f) =>
          f ? { items: f.items.map((i) => ({ ...i, unread: false })), unread: 0 } : f,
        ),
      () => undefined,
    );
  }, [p]);
  return { feed, failed, reload, answer, markRead };
}
