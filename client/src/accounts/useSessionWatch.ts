import { useEffect, type MutableRefObject } from 'react';
import { refreshRememberedAvatar } from './refreshAvatar';
import { watchSession } from './sessions';

/** Also keeps the landing photo of the remembered person filled in (refreshAvatar.ts).
 * A device signed out from Profile → Sessions ends itself at its next check (start, focus, back online). */
export function useSessionWatch(
  authed: boolean,
  signOutRef: MutableRefObject<(opts?: { forget?: boolean }) => void>,
): void {
  useEffect(() => {
    if (!authed) return;
    void refreshRememberedAvatar();
    return watchSession(() => signOutRef.current({ forget: false }));
  }, [authed, signOutRef]);
}
