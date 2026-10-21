/** Pure helpers of passkeys.ts (no Firebase), so they can be unit-tested from the client suite. */

/** Exact production hosts of the app's own Firebase project (never a wildcard: any *.web.app site could otherwise be a relying party). */
const OWN_HOSTS = ['spotter-64c3b.web.app', 'spotter-64c3b.firebaseapp.com'];

/**
 * The relying party is the page's own origin: an https origin of this project, one listed in PASSKEY_ORIGINS, or
 * localhost (http allowed) only when `allowLocalhost` (the emulator / local dev). Null = not allowed.
 */
export function allowedRelyingParty(
  origin: unknown,
  extra: string[] = [],
  allowLocalhost = true,
): { rpID: string; origin: string } | null {
  if (typeof origin !== 'string') return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const host = url.hostname;
  const local = allowLocalhost && host === 'localhost' && url.protocol === 'http:';
  const own = url.protocol === 'https:' && (OWN_HOSTS.includes(host) || extra.includes(url.origin));
  return local || own ? { rpID: host, origin: url.origin } : null;
}
