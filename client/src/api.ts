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

export type Role = 'member' | 'trainer' | 'admin';

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
export async function signInWithPayload(payload: AuthPayload): Promise<void> {
  await signInWithCustomToken(auth, payload.token);
  localStorage.setItem(UID_KEY, payload.userId);
  setUsername(payload.name || payload.username);
  setRole(payload.role ?? 'member');
}

export function clearAuth(): void {
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(UID_KEY);
}

export async function signOut(): Promise<void> {
  clearAuth();
  await firebaseSignOut(auth).catch(() => undefined);
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
    default:
      return 500;
  }
}

/** Call a Cloud Function by name. Throws HttpError (status + details) on failure. */
export async function callFn<T = unknown>(name: string, data?: unknown): Promise<T> {
  try {
    const fn = httpsCallable(functions, name);
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
  }
}
