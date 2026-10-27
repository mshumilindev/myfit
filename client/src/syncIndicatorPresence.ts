/**
 * Which pages currently show the header sync icon (SPO-375). The floating sync pill is the fallback
 * for pages without it, so it hides while at least one icon is on screen.
 */
import { useEffect, useSyncExternalStore } from 'react';

let mounted = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Call from the component that renders the header icon. */
export function useRegisterSyncIndicator(): void {
  useEffect(() => {
    mounted += 1;
    emit();
    return () => {
      mounted -= 1;
      emit();
    };
  }, []);
}

/** True while a header sync icon is mounted. */
export function useHasSyncIndicator(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => mounted > 0,
    () => false,
  );
}
