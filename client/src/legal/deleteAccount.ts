/**
 * Self-service account deletion (SPO-285), client side of the `deleteMyAccount` callable. The password step-up and the
 * deletion are ONE call: the server verifies the password itself (a client-side "recently confirmed" flag proves nothing
 * to a server), so a wrong password re-prompts inside the existing ReauthDialog and nothing is half-done. The port below is
 * what the dialog talks to; it never keeps the password.
 */
import { callFn, currentUid, HttpError } from '../api';
import { sessionDeviceId } from '../accounts/sessions';
import type { ReauthPort, ReauthResult } from '../coach/security/reauth';
import { pruneConsentsOf } from './signupConsents';

/** Deleting walks a lot of data on the server: far longer than an ordinary write. */
export const DELETE_ACCOUNT_TIMEOUT_MS = 120_000;

const liveCall: typeof callFn = (...a) => callFn(...a);

/**
 * An attempt whose answer may have been lost AFTER the request left the device: a timeout, a 5xx, a network error in
 * the middle of the call. Not that: 400/403/429 (the server answered), and `offline` raised before anything was sent.
 */
function answerMayBeLost(e: unknown): boolean {
  if (!(e instanceof HttpError)) return true; // the SDK threw something that is not a server answer: unknown
  if (e.status === 503 && e.message === 'offline') return false; // callFn refuses before sending
  if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 404) return false;
  if (e.status === 429) return false;
  return true; // 0, 5xx, 504 timeout
}

/** After a lost answer the session is dead: is the account really gone? Only the server saying so counts. */
async function accountIsGone(call: typeof callFn): Promise<boolean> {
  try {
    await call('sessionCheck', { deviceId: sessionDeviceId() }, { quiet: true });
    return false; // the account still answers
  } catch (e) {
    const d = e instanceof HttpError ? (e.details as { reason?: unknown } | undefined) : undefined;
    return e instanceof HttpError && e.status === 404 && d?.reason === 'account-gone';
  }
}

export function createDeleteAccountPort(call: typeof callFn = liveCall): ReauthPort {
  let maybeApplied = false;
  return {
    // the person is the signed-in one: password only, no identifier field
    knowsIdentifier: () => true,
    async check({ password }): Promise<ReauthResult> {
      if (!password) return 'wrong';
      const uid = currentUid();
      try {
        await call(
          'deleteMyAccount',
          { password, confirm: true },
          { timeoutMs: DELETE_ACCOUNT_TIMEOUT_MS },
        );
        pruneConsentsOf(uid); // the account is gone: its queued consents and local-off flags go too
        return 'ok';
      } catch (e) {
        if (answerMayBeLost(e)) maybeApplied = true;
        if (e instanceof HttpError) {
          if (e.status === 403) return 'wrong'; // bad-password
          if (e.status === 429) return 'locked';
          if (e.status === 0 || e.status === 503) return 'offline';
          // 401 = the session is dead. That PROVES nothing about the account unless an earlier attempt may have got through
          // (its answer was lost) AND the server then confirms "account gone". Anything else (expired session, signed out
          // elsewhere) is an error with the device left alone: the person signs in again and tries again.
          if (e.status === 401 && maybeApplied && (await accountIsGone(call))) {
            pruneConsentsOf(uid);
            return 'ok';
          }
        }
        return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error';
      }
    },
  };
}
