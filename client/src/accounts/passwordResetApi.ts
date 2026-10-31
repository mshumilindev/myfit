import { callFn, HttpError } from '../api';
import { getLocale } from '../i18n';

/** Why a reset request or the new password failed, as a kind the UI maps to a localized sentence. */
export type ResetErrorKind = 'invalid' | 'tooMany' | 'offline' | 'dead' | 'generic';

/** `save`: the client already checked the password length, so a 400 there means the link was used, revoked or expired. */
export function resetErrorKind(err: unknown, step: 'request' | 'save'): ResetErrorKind {
  if (!(err instanceof HttpError)) return 'generic';
  if (err.status === 503 || err.status === 504) return 'offline';
  if (err.status === 429) return 'tooMany';
  if (err.status === 400) return step === 'save' ? 'dead' : 'invalid';
  return 'generic';
}

/** Asks for a letter. The server answers the same whether or not the address belongs to an account. */
export const requestPasswordReset = (email: string): Promise<{ ok: true }> =>
  callFn<{ ok: true }>('requestPasswordReset', { email: email.trim(), locale: getLocale() });

/** Sets the new password with a reset link. The person is NOT signed in here: the screen sends them to sign in. */
export const setNewPassword = (token: string, password: string): Promise<unknown> =>
  callFn('claim', { token, password });
