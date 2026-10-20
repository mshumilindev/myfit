/** Pure helpers of passkeys.ts (no Firebase), so they can be unit-tested from the client suite. */

/** The relying party is the page's own origin: localhost, Firebase hosting, or one listed in PASSKEY_ORIGINS. Null = not allowed. */
export function allowedRelyingParty(origin: unknown, extra: string[] = []): { rpID: string; origin: string } | null {
  if (typeof origin !== 'string') return null;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  const host = url.hostname;
  const ok =
    host === 'localhost' ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    extra.includes(url.origin);
  return ok ? { rpID: host, origin: url.origin } : null;
}
