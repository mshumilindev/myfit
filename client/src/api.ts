/**
 * Auth + callable-function layer for Spotter.
 *
 * Identity now flows through Firebase Auth: the login/register/claim Cloud
 * Functions verify the password (bcrypt) and return a *custom token*, which we
 * exchange with `signInWithCustomToken`. The role travels as a custom-token
 * claim; we also cache it (and the display name) in localStorage for instant
 * UI gating, refreshing it from the ID token whenever auth state changes.
 *
 * The old `request()`/bearer-token HTTP wrapper is gone — data is read/written
 * straight from Firestore (see store.ts), and privileged operations go through
 * `callFn()` (a thin wrapper over httpsCallable that preserves the old
 * HttpError shape so view-level error handling keeps working).
 */
import { afterSignIn, afterSignOut } from './accounts/deviceSession';
import {
  signInWithCustomToken,
  onAuthStateChanged,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { auth, functions } from './firebase';

const USERNAME_KEY = 'spotter.username';
const ROLE_KEY = 'spotter.role';
const UID_KEY = 'spotter.uid';
const LOGIN_ID_KEY = 'spotter.loginId';

export type Role = 'member' | 'trainer' | 'admin';

/*
 * The callable-read cache that used to live here (plaintext `spotter.cache.*` in localStorage) is gone: reads that should
 * survive a restart go through the sealed, stale-while-revalidate layer in `./offline/offlineCache`.
 */

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}
export function setUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username);
}
export function getRole(): Role {
  const r = localStorage.getItem(ROLE_KEY);
  return r === 'admin' || r === 'trainer' ? r : 'member';
}
export function setRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
}

/** The signed-in user's uid, or null. Also used as the "am I logged in" guard
 *  that the old code expressed as getToken(). */
export function currentUid(): string | null {
  return auth.currentUser?.uid ?? localStorage.getItem(UID_KEY);
}
/** Back-compat: truthy when signed in (old call sites gate on getToken()). */
export function getToken(): string | null {
  return auth.currentUser?.uid ?? null;
}

export interface AuthPayload {
  token: string;
  userId: string;
  username: string;
  name: string;
  role: Role;
}

/** Complete a sign-in from an auth-function payload (custom token + role). */
export async function signInWithPayload(payload: AuthPayload, remember = false): Promise<void> {
  await signInWithCustomToken(auth, payload.token);
  localStorage.setItem(UID_KEY, payload.userId);
  if (payload.username) localStorage.setItem(LOGIN_ID_KEY, payload.username);
  setUsername(payload.name || payload.username);
  setRole(payload.role ?? 'member');
  /* "Remember me": only a ticked box puts the person on this device's landing list (accounts/deviceSession.ts). */
  afterSignIn(localStorage, { uid: payload.userId, name: payload.name || payload.username }, remember, Date.now());
}

/** The identifier the person signed in with (username), kept so a re-authentication asks only for the password. */
export function getLoginId(): string | null {
  return localStorage.getItem(LOGIN_ID_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(LOGIN_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(UID_KEY);
}

/**
 * `forget`: the person also leaves this device's landing list ("Remember me" unticked in the sign-out dialog). Either way
 * the person's own localStorage keys are wiped here and the rest of their data by deviceWipe.ts.
 */
export async function signOut(opts: { forget?: boolean } = {}): Promise<void> {
  const uid = currentUid();
  clearAuth();
  afterSignOut(localStorage, uid, opts.forget === true);
  await firebaseSignOut(auth).catch(() => undefined);
  /* The account's data leaves the device: sealed coach stores, caches and Firestore's offline cache (deviceWipe.ts). */
  try {
    const { wipeAfterSignOut } = await import('./deviceWipe');
    await wipeAfterSignOut();
  } catch {
    /* best effort: the flag it sets is honoured at the next start */
  }
}

/** Subscribe to sign-in / sign-out. Fires with the current user (or null). */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/** Keep the cached role in sync with the ID token's `role` claim. */
export function watchRoleClaim(): () => void {
  return onIdTokenChanged(auth, async (user) => {
    if (!user) return;
    try {
      const res = await user.getIdTokenResult();
      const role = res.claims.role;
      if (role === 'admin' || role === 'trainer' || role === 'member') setRole(role);
      localStorage.setItem(UID_KEY, user.uid);
    } catch {
      /* offline / token refresh failed — keep cached role */
    }
  });
}

// --- Callable functions -----------------------------------------------------

/** HTTP-status-shaped error, so existing `err.status` / `err.details` handling
 *  in the views keeps working against callable-function errors. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function codeToStatus(code: string): number {
  const c = code.replace(/^functions\//, '');
  switch (c) {
    case 'invalid-argument':
    case 'failed-precondition':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'permission-denied':
      return 403;
    case 'not-found':
      return 404;
    case 'already-exists':
      return 409;
    case 'resource-exhausted':
      return 429;
    case 'unavailable':
      return 503;
    case 'deadline-exceeded':
      return 504;
    default:
      return 500;
  }
}

/**
 * Mutations (create/update/delete) raise the small "Saving…" sync chip while in
 * flight (never a blocking scrim). Read-only callables stay quiet so lists and
 * profiles don't flash an indicator on load.
 */
const QUIET_CALLABLES = new Set([
  'authStatus',
  'invitePreview',
  'profileUser',
  'adminPeople',
  'adminUserDetail',
  'trainerClients',
  'trainerClientDetail',
  'programMine',
  'profileMe',
  'athleteExerciseHistory',
  'athleteWorkout',
]);

/** A callable that has not answered by then fails (504), so a dead network never hangs a screen. */
export const READ_TIMEOUT_MS = 15_000;
export const WRITE_TIMEOUT_MS = 30_000;
/** The "Saving…" chip never stays up longer than this for a request that cannot finish (offline). */
export const SAVING_CHIP_MAX_MS = 15_000;

let mutationPending = 0;
const mutationListeners = new Set<() => void>();

function emitMutation(): void {
  for (const l of mutationListeners) l();
}

export function beginMutation(): void {
  mutationPending += 1;
  emitMutation();
}

export function endMutation(): void {
  mutationPending = Math.max(0, mutationPending - 1);
  emitMutation();
}

export function getMutationPending(): number {
  return mutationPending;
}

export function subscribeMutation(cb: () => void): () => void {
  mutationListeners.add(cb);
  return () => {
    mutationListeners.delete(cb);
  };
}

/**
 * Wrap a direct Firestore/Storage write so it shares the "Saving…" sync chip.
 * A Firestore write only settles once the server acks it, so offline it can stay
 * pending for a long time: the chip is dropped after SAVING_CHIP_MAX_MS while the
 * write itself stays queued (and is flushed by the SDK when the network is back).
 */
export async function trackMutation<T>(promise: Promise<T>): Promise<T> {
  beginMutation();
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    endMutation();
  };
  const timer = setTimeout(end, SAVING_CHIP_MAX_MS);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
    end();
  }
}

export type CallFnOptions = {
  /** Skip the "Saving…" chip (default for known read callables). */
  quiet?: boolean;
  /** Override the request timeout (default: 15 s for quiet reads, 30 s for mutations). */
  timeoutMs?: number;
};

/** Call a Cloud Function by name. Throws HttpError (status + details) on failure. */
export async function callFn<T = unknown>(
  name: string,
  data?: unknown,
  opts?: CallFnOptions,
): Promise<T> {
  const quiet = opts?.quiet ?? QUIET_CALLABLES.has(name);
  // Offline: fail at once instead of waiting for the SDK's long network timeout.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new HttpError(503, 'offline');
  }
  const timeout = opts?.timeoutMs ?? (quiet ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  if (!quiet) beginMutation();
  try {
    const fn = httpsCallable(functions, name, { timeout });
    const res = (await fn(data ?? {})) as HttpsCallableResult<T>;
    return res.data;
  } catch (err) {
    const e = err as {
      code?: string;
      message?: string;
      details?: unknown;
      customData?: { message?: string };
    };
    // Firebase sometimes wraps the server message as "Firebase: Error (functions/…)."
    // Prefer the HttpsError text when the SDK exposes it.
    const raw = e.message ?? '';
    const detailsMsg =
      typeof e.details === 'string'
        ? e.details
        : e.details && typeof e.details === 'object' && 'message' in e.details
          ? String((e.details as { message?: unknown }).message ?? '')
          : '';
    const message =
      detailsMsg ||
      e.customData?.message ||
      (/^Firebase: Error \(functions\//.test(raw) ? raw.replace(/^Firebase:\s*/, '') : raw) ||
      'Request failed';
    throw new HttpError(codeToStatus(e.code ?? ''), message, e.details ?? e);
  } finally {
    if (!quiet) endMutation();
  }
}
