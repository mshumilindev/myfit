/**
 * People this device remembers (SPO-210 batch 2; model: SPO-207 "Запам'ятати мене").
 *
 * The landing shows these as the Locker Wall. A person is stored ONLY after a sign-in with "Remember me" ticked; a
 * sign-in without the tick stores nothing and drops a previous entry of that person (shared-device mode: the last
 * choice wins). Read synchronously (plain `localStorage`, not IndexedDB) so the first render of the landing already
 * knows who to show. Nothing secret lives here: uid, display name, avatar reference, whether a passkey exists.
 */
import type { StorageBackend } from './scopedStorage';
import { isValidUid } from './scopedStorage';

/** Same string as the `spotter.accounts` entry of `DEVICE_KEYS` in scopedStorage. */
export const REMEMBERED_KEY = 'spotter.accounts';

export interface RememberedPerson {
  uid: string;
  name: string;
  /** The identifier the person signs in with (username), so the landing can ask for the password only. */
  login?: string;
  /** Reference to the avatar (url or id), if the person has one. */
  avatar?: string;
  /** A passkey was registered on this device for this person (SPO-211); false/absent -> the landing asks for the password. */
  passkey?: boolean;
  /** Name of the Firebase app that holds this person's session (`[DEFAULT]` for the first). */
  appName: string;
  /** ms since epoch of the last sign-in on this device. */
  lastUsed: number;
}

function isPerson(v: unknown): v is RememberedPerson {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    isValidUid(p.uid) &&
    typeof p.name === 'string' &&
    typeof p.appName === 'string' &&
    typeof p.lastUsed === 'number' &&
    Number.isFinite(p.lastUsed) &&
    (p.login === undefined || typeof p.login === 'string') &&
    (p.avatar === undefined || typeof p.avatar === 'string') &&
    (p.passkey === undefined || typeof p.passkey === 'boolean')
  );
}

/** Newest first. Corrupt storage reads as "nobody remembered" (the landing then shows the plain form). */
export function readRemembered(backend: StorageBackend): RememberedPerson[] {
  let raw: string | null;
  try {
    raw = backend.getItem(REMEMBERED_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: RememberedPerson[] = [];
  for (const v of parsed) {
    if (isPerson(v) && !seen.has(v.uid)) {
      seen.add(v.uid);
      out.push(v);
    }
  }
  return out.sort((a, b) => b.lastUsed - a.lastUsed);
}

function write(backend: StorageBackend, people: RememberedPerson[]): void {
  if (people.length === 0) backend.removeItem(REMEMBERED_KEY);
  else backend.setItem(REMEMBERED_KEY, JSON.stringify(people));
}

/**
 * Called after a successful sign-in. `remember` is the state of the "Remember me" checkbox.
 * ticked -> the person is added or refreshed; not ticked -> nothing is written and an older entry is removed.
 */
export function recordSignIn(
  backend: StorageBackend,
  person: Omit<RememberedPerson, 'lastUsed' | 'passkey'> & { passkey?: boolean },
  remember: boolean,
  now: number,
): void {
  if (!isValidUid(person.uid)) throw new Error('bad-uid');
  const rest = readRemembered(backend).filter((p) => p.uid !== person.uid);
  if (!remember) {
    if (rest.length !== readRemembered(backend).length) write(backend, rest);
    return;
  }
  const prev = readRemembered(backend).find((p) => p.uid === person.uid);
  write(backend, [{ ...person, passkey: person.passkey ?? prev?.passkey, lastUsed: now }, ...rest]);
}

/** A passkey was registered (true) or turned out to be unusable (false) for this person. No-op for unknown uids. */
export function setPasskey(backend: StorageBackend, uid: string, passkey: boolean): void {
  const all = readRemembered(backend);
  if (!all.some((p) => p.uid === uid)) return;
  write(
    backend,
    all.map((p) => (p.uid === uid ? { ...p, passkey } : p)),
  );
}

/** Removes one person from the device list (sign-out with "Remember me" unticked). Returns whether anything changed. */
export function removeRemembered(backend: StorageBackend, uid: string): boolean {
  const all = readRemembered(backend);
  const rest = all.filter((p) => p.uid !== uid);
  if (rest.length === all.length) return false;
  write(backend, rest);
  return true;
}

/** The person's small avatar picture (a data: URL), kept so the landing can show the face before anyone is signed in. */
export function setAvatar(backend: StorageBackend, uid: string, avatar: string | undefined): void {
  const all = readRemembered(backend);
  if (!all.some((p) => p.uid === uid)) return;
  write(
    backend,
    all.map((p) => (p.uid === uid ? { ...p, avatar } : p)),
  );
}
