/**
 * Re-authentication before the actions that cannot be taken back or that move a client's data out (plan 2.7 "Session
 * safety"): CSV export, end a relationship, withdraw an invite. It is the SAME sign-in the app already uses (the
 * `login` callable with the person's own identifier), so there is no new password and no new factor. The check
 * only verifies the password; it never replaces the session.
 *
 * The port is the seam: the real one calls `login`; the stories / tests double (`__fixtures__/reauth.ts`) accepts any
 * non-empty password because there is nothing real to protect.
 */
import { onAfterSignOut } from '../../accounts/deviceSession';
import { callFn, currentUid, getLoginId, HttpError, type AuthPayload } from '../../api';
import { coachTestDefault } from '../data/testHooks';

export type ReauthResult = 'ok' | 'wrong' | 'locked' | 'offline' | 'error';

export interface ReauthPort {
  /** `identifier` only when the app does not know the sign-in name of this person yet. */
  check(input: { password: string; identifier?: string }): Promise<ReauthResult>;
  /** The app already knows who signed in (no identifier field needed). */
  knowsIdentifier(): boolean;
}

export type ReauthAction = 'export' | 'end' | 'revoke-invite' | 'delete-account' | 'my-export';

/** The real thing: the sign-in callable, accepted only when it names THIS signed-in user. */
export function createAuthReauthPort(): ReauthPort {
  return {
    knowsIdentifier: () => !!getLoginId(),
    async check({ password, identifier }) {
      const id = identifier?.trim() || getLoginId();
      if (!id || !password) return 'wrong';
      try {
        const res = await callFn<AuthPayload>('login', { identifier: id, password });
        return res.userId === currentUid() ? 'ok' : 'wrong';
      } catch (e) {
        if (e instanceof HttpError) {
          if (e.status === 401) return 'wrong';
          if (e.status === 429) return 'locked';
          if (e.status === 0 || e.status === 503) return 'offline';
        }
        return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
      }
    },
  };
}

let port: ReauthPort | null = null;
export function configureReauth(p: ReauthPort | null): void {
  port = p;
}
export const getReauthPort = (): ReauthPort =>
  port ?? coachTestDefault<ReauthPort>('reauth')?.() ?? createAuthReauthPort();

/* ---- recency: one successful check covers the next few minutes -------------------------------------------- */

export const REAUTH_FRESH_MS = 5 * 60 * 1000;
let okAt = 0;
/** Whose password was checked: the recency never carries over to another account. */
let okUid: string | null = null;
export const markReauthed = (now = Date.now()): void => {
  okAt = now;
  okUid = currentUid();
};
export const reauthFresh = (now = Date.now(), ms = REAUTH_FRESH_MS): boolean =>
  okAt > 0 && okUid === currentUid() && now - okAt < ms;
/** Sign-out (registered below), tests. */
export const forgetReauth = (): void => {
  okAt = 0;
  okUid = null;
};
onAfterSignOut(forgetReauth);
