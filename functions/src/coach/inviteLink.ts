/**
 * The ONE invite link format: `<origin>/#/invite/<token>` (a hash route of the client, parsed by
 * `parseClientRoute`). The origin comes from configuration (`APP_ORIGIN`, a deploy-time parameter), never from a
 * hard-coded foreign domain. Pure and import-free so the unit tests and the client mirror
 * (`client/src/coach/inviteLink.ts`, parity asserted in tests/coach-server/inviteLink.test.ts)
 * can exercise it without Firebase.
 */

/** The real Firebase Hosting origin of this project (FIREBASE.md); used when no custom origin is configured. */
export const DEFAULT_APP_ORIGIN = 'https://spotter-64c3b.web.app';

/** Tokens are 32 hex characters on the server; the client route accepts the wider `[A-Za-z0-9_-]{1,64}`. */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

/** Normalises a configured origin: https only (http only for localhost), no path, no trailing slash. */
export function normalizeOrigin(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_APP_ORIGIN;
  try {
    const u = new URL(raw.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return DEFAULT_APP_ORIGIN;
    return u.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export function inviteUrl(origin: unknown, token: string): string {
  if (!INVITE_TOKEN.test(token)) throw new Error('bad-invite-token');
  return `${normalizeOrigin(origin)}/#/invite/${token}`;
}

/** The token of an invite link (hash route only, any origin the caller already trusts), else null. */
export function inviteTokenOf(link: string): string | null {
  const m = /#\/invite\/([A-Za-z0-9_-]{1,64})\/?$/.exec(link);
  return m ? m[1] : null;
}
