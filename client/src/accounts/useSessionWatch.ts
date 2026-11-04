import { useEffect, type MutableRefObject } from 'react';
import { refreshRememberedAvatar } from './refreshAvatar';
import { auth } from '../firebase';
import { sessionDeviceId, watchSession } from './sessions';
import { watchRevokedFlag } from './sessionState';

/** Also keeps the landing photo of the remembered person filled in (refreshAvatar.ts).
 * A device signed out from Profile → Sessions ends itself at once through its revoked flag (sessionState.ts), and at the
 * latest at its next check (start, focus, back online). */
export function useSessionWatch(
  authed: boolean,
  signOutRef: MutableRefObject<(opts?: { forget?: boolean }) => void>,
): void {
  useEffect(() => {
    if (!authed) return;
    void refreshRememberedAvatar();
    const out = () => signOutRef.current({ forget: false });
    const stopCheck = watchSession(out);
    const uid = auth.currentUser?.uid;
    const stopFlag = uid ? watchRevokedFlag(uid, sessionDeviceId(), out) : () => undefined;
    return () => {
      stopCheck();
      stopFlag();
    };
  }, [authed, signOutRef]);
}
