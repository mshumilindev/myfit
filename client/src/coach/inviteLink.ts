/**
 * The ONE place that builds and reads invite links (`<origin>/#/invite/<token>`). The route is the real client route
 * (`client/routes.ts`: `#/invite/<token>`), so a pasted link lands on the invite pages with no redirect.
 *
 * The origin is config-driven: `VITE_APP_ORIGIN` (e.g. `https://spotter-64c3b.web.app` or a custom domain), else the
 * Firebase hosting origin of the project, else the origin the app runs on. The server (`coachInvite`) should return
 * the same shape; the SERVER-SEC helper in `functions/` mirrors it. Nothing here touches the network.
 */

/** Firebase hosting origin of the project (`<projectId>.web.app`); used when `VITE_APP_ORIGIN` is not set. */
export const FIREBASE_HOSTING_ORIGIN = 'https://spotter-64c3b.web.app';

const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

const cleanOrigin = (s: string): string | null => {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
};

/** The public origin invite links point at. Never ends with a slash. */
export function appOrigin(): string {
  const env = (import.meta.env?.VITE_APP_ORIGIN as string | undefined) ?? '';
  const fromEnv = env ? cleanOrigin(env) : null;
  if (fromEnv) return fromEnv;
  if (import.meta.env?.PROD) return FIREBASE_HOSTING_ORIGIN;
  const here = typeof window !== 'undefined' ? window.location?.origin : '';
  return (here && cleanOrigin(here)) || FIREBASE_HOSTING_ORIGIN;
}

/** `<origin>/#/invite/<token>`; throws for a token the route would not accept. */
export function inviteLink(token: string, origin: string = appOrigin()): string {
  if (!TOKEN.test(token)) throw new Error('invalid-invite-token');
  return `${origin.replace(/\/+$/, '')}/#/invite/${token}`;
}

/** The token inside an invite link (or a bare `#/invite/<token>` hash), or null. */
export function inviteTokenOf(link: string): string | null {
  const m = /#\/invite\/([^/?#\s]+)/.exec(link);
  return m && TOKEN.test(m[1]) ? m[1] : null;
}
