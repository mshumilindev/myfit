import { useCallback, useEffect, useState } from 'react';
import type { ClientCoachPort } from '../data/port';
import type { ClientTeam } from '../data/types';

/** The trainer's team as the client may see it. `null` while loading; a port without `team` or a failed call is `failed`. */
export function useClientTeam(port: ClientCoachPort): {
  team: ClientTeam | null;
  failed: boolean;
  retry: () => void;
} {
  const [team, setTeam] = useState<ClientTeam | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    if (!port.team) {
      Promise.resolve().then(() => live && setFailed(true));
      return () => {
        live = false;
      };
    }
    port.team().then(
      (t) => live && (setTeam(t), setFailed(false)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [port, attempt]);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);
  return { team, failed, retry };
}
