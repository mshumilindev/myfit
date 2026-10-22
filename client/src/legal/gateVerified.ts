/**
 * "This device has seen the server confirm that this account's required consents are in order" (SPO-295, offline rule).
 * One small localStorage map (a device-level key: it outlives sign-out, leaves with the account's deletion): account id -> the required kinds with the document versions that were current. No personal
 * data. With it, a later offline / errored / unconfirmed start keeps working (fail open); without it, or after a
 * version bump, the app cannot verify the consents and the gate blocks until the server answers.
 */
import { REQUIRED_KINDS, currentVersion, type ConsentKind } from './consents';

export const GATE_VERIFIED_KEY = 'spotter.consentVerified';

/**
 * The kinds (with versions) a "clear" vouches for. A trainer / manager / admin's also include `trainer-terms`, so a member
 * promoted to trainer (or the reverse) no longer matches the stored signature: the gate re-verifies with the server.
 */
function signature(coach: boolean): string {
  const kinds: readonly ConsentKind[] = coach
    ? [...REQUIRED_KINDS, 'trainer-terms']
    : REQUIRED_KINDS;
  return kinds.map((k) => `${k}@${currentVersion(k)}`).join(',');
}

function read(): Record<string, string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(GATE_VERIFIED_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** A server-confirmed "clear" for the CURRENT document versions was stored for this account on this device. */
export function wasVerifiedClear(uid: string, coach = false): boolean {
  return read()[uid] === signature(coach);
}

export function markVerifiedClear(uid: string, coach = false): void {
  try {
    const all = read();
    if (all[uid] === signature(coach)) return;
    localStorage.setItem(GATE_VERIFIED_KEY, JSON.stringify({ ...all, [uid]: signature(coach) }));
  } catch {
    /* storage unavailable: offline starts will ask the person to connect once */
  }
}

/** The server says a required consent is missing / withdrawn / stale: the earlier "clear" no longer holds. */
export function clearVerified(uid: string): void {
  try {
    const all = read();
    if (!(uid in all)) return;
    delete all[uid];
    localStorage.setItem(GATE_VERIFIED_KEY, JSON.stringify(all));
  } catch {
    /* nothing to undo */
  }
}
