/**
 * What the device does around a sign-in and a sign-out (SPO-210 batch 3).
 *
 *  sign-in   "Remember me" ticked -> the person goes on the landing list; not ticked -> nothing is stored (see rememberedPeople).
 *  sign-out  the person's personal localStorage keys are wiped (the rest of the wipe is deviceWipe.ts); with `forget` the
 *            person also leaves the landing list ("Remember me" unticked in the sign-out dialog). Without `forget` the list
 *            entry stays, so the landing can offer the person again.
 */
import { recordSignIn, removeRemembered } from './rememberedPeople';
import { isValidUid, wipeAccountKeys, type StorageBackend } from './scopedStorage';

/** The Firebase app that holds every session (one app per window; sessions end at sign-out). */
export const APP_NAME = '[DEFAULT]';

export function afterSignIn(
  backend: StorageBackend,
  person: { uid: string; name: string; login?: string; avatar?: string },
  remember: boolean,
  now: number,
): void {
  if (!isValidUid(person.uid)) return; // an unusable uid is never stored
  recordSignIn(backend, { ...person, appName: APP_NAME }, remember, now);
}

const signOutHooks = new Set<() => void>();
/** Runs `cb` at every sign-out (in-memory per-session state that must not outlive the session, e.g. the re-auth recency). */
export function onAfterSignOut(cb: () => void): void {
  signOutHooks.add(cb);
}

export function afterSignOut(backend: StorageBackend, uid: string | null, forget: boolean): void {
  if (forget && uid !== null && isValidUid(uid)) removeRemembered(backend, uid);
  wipeAccountKeys(backend);
  for (const cb of signOutHooks) cb();
}
