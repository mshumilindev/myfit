/**
 * The pending Undo of "Stop sharing" for the four on-device levels (SPO-107). Module-level, not a component ref: the
 * Stop screen can unmount inside the 8 s window (the person goes back) and Undo must still work when it mounts again.
 * Bound to the account and expiring on its own; the grants' own Undo lives in the client store.
 */
import type { Level } from '../domain/types';
import type { LocalCategory } from './shareModel';

export type PendingLocals = Partial<Record<LocalCategory, Level>>;
let pending: { owner: string; until: number; previous: PendingLocals } | null = null;

export function rememberStop(
  owner: string,
  previous: PendingLocals,
  ms: number,
  now = Date.now(),
): void {
  pending = Object.keys(previous).length ? { owner, until: now + ms, previous } : null;
}

/** Takes the pending levels (once): null when none, expired, or of another account. */
export function takePendingStop(owner: string, now = Date.now()): PendingLocals {
  const p = pending;
  pending = null;
  return p && p.owner === owner && now < p.until ? p.previous : {};
}

export const clearPendingStop = (): void => {
  pending = null;
};
