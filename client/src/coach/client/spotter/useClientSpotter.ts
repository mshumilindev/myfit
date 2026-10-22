import { useCallback, useEffect, useState } from 'react';
import { getClientSpotterPort } from './config';
import type { ClientSpotterFeed, ClientSpotterPort } from './clientSpotterPort';

export interface ClientSpotterApi {
  feed: ClientSpotterFeed | null;
  failed: boolean;
  retry: () => void;
  /** mark these messages read (the screen passes the unread ones while it is open) */
  markRead: (ids: readonly string[]) => void;
}

/**
 * The client's Spotter feed, live. Another device marking messages read arrives as a change of the same feed, so the
 * unread count is the same on every device. A failed read-mark is silent: the messages simply stay unread.
 */
export function useClientSpotter(port?: ClientSpotterPort): ClientSpotterApi {
  const p = port ?? getClientSpotterPort();
  const [feed, setFeed] = useState<ClientSpotterFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    return p.subscribe(
      (f) => {
        setFeed(f);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [p, attempt]);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);
  const markRead = useCallback(
    (ids: readonly string[]) => {
      if (ids.length) p.markRead(ids).catch(() => undefined);
    },
    [p],
  );
  return { feed, failed: failed && !feed, retry, markRead };
}
