/**
 * Account-scoped `localStorage` (SPO-210; model: SPO-208 "Кілька акаунтів на пристрої").
 *
 * Several people can share one device, so a stored value belongs to ONE account unless it is explicitly a device
 * setting. Account values live under `u:<uid>:<key>`; the device list below is the only set of keys stored as-is.
 * Unsure means scoped: the worst case is a preference that starts empty for a second account, never data that
 * one person can read from another's scope.
 *
 *  - no active account -> reads are empty and writes are dropped (fail closed: nothing lands in a scope that the
 *    next sign-in could pick up);
 *  - `adoptLegacyKeys` moves the pre-existing unscoped keys into the first account once (migration);
 *  - `forgetAccountKeys` removes everything of one account and nothing else ("Forget this account").
 */

/** The subset of `Storage` used here (a plain object in tests). */
export interface StorageBackend {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SCOPE_PREFIX = 'u:';

/** Stored once the legacy keys were adopted; value = the uid that adopted them. */
export const ADOPTED_FLAG = 'spotter.scopedAdopted';

/**
 * Keys that describe the DEVICE, not a person: needed before anyone signs in, or tied to this browser install.
 * Keep it short; add a key only with a reason.
 */
export const DEVICE_KEYS: ReadonlySet<string> = new Set([
  ADOPTED_FLAG,
  'spotter.activeAccount', // which account the window opens (read before the Firebase app is created)
  'spotter.accounts', // the device's account list
  'gym.locale', // the login screen needs a language before anyone is known
  'spotter.pushDevice', // one id per browser install, shared by every account's push document
  'spotter.pushOn', // notification permission is per install
  'spotter.forceLayout', // dev/QA layout override
  'spotter.wipeFs', // pending Firestore wipe, honoured before the SDK opens its database
  'spotter.crashRecovery', // reload-loop guard of this window
]);

/** Keys owned by other libraries on this origin (Firebase Auth fallback persistence, FCM, heartbeat). */
export const DEVICE_PREFIXES: readonly string[] = ['firebase:', 'firebase-', 'FCM_', SCOPE_PREFIX];

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** Firebase uids are alphanumeric; a `:` in a uid would make `u:<uid>:` ambiguous, so anything else is refused. */
export function isValidUid(uid: unknown): uid is string {
  return typeof uid === 'string' && UID_RE.test(uid);
}

export function isDeviceKey(key: string): boolean {
  return DEVICE_KEYS.has(key) || DEVICE_PREFIXES.some((p) => key.startsWith(p));
}

export function scopedKey(uid: string, key: string): string {
  if (!isValidUid(uid)) throw new Error('bad-uid');
  return `${SCOPE_PREFIX}${uid}:${key}`;
}

function allKeys(backend: StorageBackend): string[] {
  const out: string[] = [];
  for (let i = 0; i < backend.length; i++) {
    const k = backend.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

export interface ScopedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Keys of the active account (unprefixed) plus the device keys that exist. */
  keys(): string[];
}

/** The active uid is read on every call: switching accounts reloads the window, but a stale closure must never write. */
export function createScopedStorage(d: {
  backend: StorageBackend;
  activeUid: () => string | null;
}): ScopedStorage {
  const resolve = (key: string): string | null => {
    if (isDeviceKey(key)) return key;
    const uid = d.activeUid();
    return isValidUid(uid) ? scopedKey(uid, key) : null;
  };
  return {
    getItem(key) {
      const k = resolve(key);
      return k === null ? null : d.backend.getItem(k);
    },
    setItem(key, value) {
      const k = resolve(key);
      if (k !== null) d.backend.setItem(k, value);
    },
    removeItem(key) {
      const k = resolve(key);
      if (k !== null) d.backend.removeItem(k);
    },
    keys() {
      const uid = d.activeUid();
      const prefix = isValidUid(uid) ? scopedKey(uid, '') : null;
      const out: string[] = [];
      for (const k of allKeys(d.backend)) {
        if (prefix !== null && k.startsWith(prefix)) out.push(k.slice(prefix.length));
        else if (isDeviceKey(k) && !k.startsWith(SCOPE_PREFIX)) out.push(k);
      }
      return out;
    },
  };
}

/**
 * Migration, once per device: every key that is neither a device key nor already scoped becomes the first account's.
 * An existing scoped value wins (a crash half-way and a re-run must not overwrite newer data); the legacy copy is
 * removed either way. Returns how many keys were moved.
 */
export function adoptLegacyKeys(backend: StorageBackend, uid: string): number {
  if (!isValidUid(uid)) throw new Error('bad-uid');
  if (backend.getItem(ADOPTED_FLAG) !== null) return 0;
  let moved = 0;
  for (const k of allKeys(backend)) {
    if (isDeviceKey(k)) continue;
    const target = scopedKey(uid, k);
    const value = backend.getItem(k);
    if (value !== null && backend.getItem(target) === null) backend.setItem(target, value);
    backend.removeItem(k);
    moved++;
  }
  backend.setItem(ADOPTED_FLAG, uid);
  return moved;
}

/** "Forget this account": removes only `u:<uid>:*`. Returns how many keys were removed. */
export function forgetAccountKeys(backend: StorageBackend, uid: string): number {
  const prefix = scopedKey(uid, '');
  const mine = allKeys(backend).filter((k) => k.startsWith(prefix));
  mine.forEach((k) => backend.removeItem(k));
  return mine.length;
}
