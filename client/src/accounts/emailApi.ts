import { callFn, HttpError } from '../api';
import { auth } from '../firebase';
import { getLocale } from '../i18n';

/** What Firebase Auth knows about the account's email (SPO-283). `verified` only after the link in the letter was opened. */
export interface EmailState {
  email: string | null;
  verified: boolean;
  /** `config/auth.requireVerifiedEmail` (gate switch). Only `emailStatus` fills it. */
  required?: boolean;
}

/** Why a link/resend attempt failed, as a kind the UI maps to a localized sentence (never the raw server text). */
export type EmailErrorKind =
  'offline' | 'invalid' | 'taken' | 'password' | 'tooMany' | 'signedOut' | 'generic';

export function emailErrorKind(err: unknown): EmailErrorKind {
  if (!(err instanceof HttpError)) return 'generic';
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.status === 503) return 'offline';
  if (err.status === 429) return 'tooMany';
  if (err.status === 401) return 'signedOut';
  if (err.status === 403) return 'password';
  if (err.status === 409 || reason === 'taken') return 'taken';
  if (err.status === 400) return 'invalid';
  return 'generic';
}

export const emailStatus = (): Promise<EmailState> => callFn<EmailState>('emailStatus');

/** Links (or changes) the email. The current password is the fresh proof; the account stays unconfirmed until the letter. */
export const attachEmail = (email: string, password: string): Promise<EmailState> =>
  callFn<EmailState>('attachEmail', { email, password });

/**
 * Asks the server to send the confirmation letter to the email already on the signed-in user. The server mailer sends it
 * (same sender as every other letter) and rate-limits repeats (429).
 */
export async function sendConfirmation(): Promise<void> {
  if (!auth.currentUser) throw new HttpError(401, 'signed-out');
  await callFn('sendConfirmationMail', { locale: getLocale() });
}

/** Re-reads the confirmation state from the server (and nudges the sign-in token so the new state is visible everywhere). */
export async function refreshEmailState(): Promise<EmailState> {
  const s = await emailStatus();
  if (s.verified) await auth.currentUser?.getIdToken(true).catch(() => undefined);
  return s;
}
