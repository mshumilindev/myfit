/**
 * Shared-account auth. Nutrition reuses My Fit's `login` Cloud Function
 * (bcrypt verify → Firebase custom token), so the same Spotter credentials and
 * the same uid work here — no separate account.
 */
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import type { Role } from './types';

export interface AuthPayload {
  token: string;
  userId: string;
  username: string;
  name: string;
  role: Role;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/** Sign in with Spotter credentials via the shared `login` callable. */
export async function login(identifier: string, password: string): Promise<AuthPayload> {
  try {
    const fn = httpsCallable(functions, 'login');
    const res = await fn({ identifier: identifier.trim(), password });
    const payload = res.data as AuthPayload;
    await signInWithCustomToken(auth, payload.token);
    return payload;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e.code ?? '';
    if (code.includes('unauthenticated') || code.includes('permission-denied'))
      throw new AuthError(401, 'wrong-credentials');
    if (code.includes('resource-exhausted')) throw new AuthError(429, 'too-many');
    throw new AuthError(0, (e.message ?? 'error').replace(/^Firebase:\s*/, ''));
  }
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/** Track the role claim from the ID token (member | trainer | admin). */
export function watchRole(cb: (role: Role) => void): () => void {
  return onIdTokenChanged(auth, async (user) => {
    if (!user) return;
    try {
      const res = await user.getIdTokenResult();
      const role = res.claims.role;
      if (role === 'admin' || role === 'trainer' || role === 'member') cb(role);
    } catch {
      /* offline — keep last known role */
    }
  });
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth).catch(() => undefined);
}
