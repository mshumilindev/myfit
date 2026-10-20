import { useEffect, type MutableRefObject } from 'react';
import { watchSession } from './sessions';

/** A device signed out from Profile → Sessions ends itself at its next check (start, focus, back online). */
export function useSessionWatch(
  authed: boolean,
  signOutRef: MutableRefObject<(opts?: { forget?: boolean }) => void>,
): void {
  useEffect(() => {
    if (!authed) return;
    return watchSession(() => signOutRef.current({ forget: false }));
  }, [authed, signOutRef]);
}
