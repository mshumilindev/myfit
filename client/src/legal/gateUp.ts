/**
 * "A legal gate page is on screen right now." The email gate (SPO-423) reads it to wait its turn: the agreement is asked
 * first, and two full pages must never stack (the later-mounted portal would otherwise cover the earlier one).
 */
import { useSyncExternalStore } from 'react';

let up = false;
const listeners = new Set<() => void>();

export function setLegalGateUp(next: boolean): void {
  if (up === next) return;
  up = next;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useLegalGateUp = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => up,
    () => false,
  );
