import { useSyncExternalStore } from 'react';

/**
 * The signed-in session's sign-out, shared with every app's account block. App.tsx owns the
 * sign-out (it resets its own overlay / tab / auth state) and registers it here; the account block
 * (`useSuiteAccount`) reads it, so no app needs to thread `onSignOut` through its props. Without a
 * registered session (stories, unit tests of a single app) the block simply has no Sign out row.
 */
export interface SuiteSession {
  signOut: (opts?: { forget?: boolean }) => void;
  /** Unsynced entries: the confirmation warns that signing out discards them. */
  queueLength: number;
}

let session: SuiteSession | null = null;
const listeners = new Set<() => void>();

/** Register (or clear with `null`) the session; returns an unregister function. */
export function setSuiteSession(next: SuiteSession | null): () => void {
  const same = session && next && session.queueLength === next.queueLength;
  session = next;
  // `signOut` is read at call time through the object, so only a changed queue re-renders readers.
  if (!same) listeners.forEach((l) => l());
  return () => {
    if (session === next) setSuiteSession(null);
  };
}

export function useSuiteSession(): SuiteSession | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
  );
}
