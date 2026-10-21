/**
 * Clean-URL routing: the address bar shows `/today`, `/coach/chat?with=ab`, never `/#/today`.
 *
 * The app still thinks in "hash routes" (`#/today`, `#/c/chat?with=ab`; see `fromHash` in App.tsx and the coach
 * route parsers), so this module is the one adapter between those strings and the real URL:
 *   - `currentHash()` is what `window.location.hash` used to be: `#` + the path + the query.
 *   - `setHash(h)` navigates (push) and notifies the `hashchange` listeners, like assigning `location.hash` did.
 *   - `pushHash` / `replaceHash` change the URL silently, like `history.pushState` / `replaceState` did.
 * Old links keep working: a `/#/…` URL (bookmarks, invite e-mails, push notifications) is rewritten to the clean
 * path on load and on every later `hashchange`. Firebase Hosting rewrites every path to index.html, and the
 * service worker's navigate fallback does the same offline, so a reload on any route loads the app.
 */

/** `#/today?x=1`, `/today?x=1` or `today` → `/today?x=1`; empty / `#` / `#/` → `/`. */
export function hashToUrl(h: string): string {
  let s = h.startsWith('#') ? h.slice(1) : h;
  if (!s.startsWith('/')) s = `/${s}`;
  return s;
}

/** Route in the legacy `#/…` shape ('' for the home page, like an empty `location.hash`). */
export function currentHash(): string {
  if (typeof window === 'undefined') return '';
  const { hash, pathname, search } = window.location;
  // A legacy `/#/…` URL (or a test that sets the hash) wins until it is rewritten to the clean path.
  if (hash.startsWith('#/')) return hash;
  if (pathname === '/' || pathname === '') return search ? `#/${search}` : hash;
  return `#${pathname}${search}`;
}

function canon(h: string): string {
  const url = hashToUrl(h);
  return url === '/' ? '' : `#${url}`;
}

function notify(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Navigate to a route and tell the `hashchange` listeners (adds a history entry unless `replace`). */
export function setHash(h: string, replace = false): void {
  if (canon(currentHash()) === canon(h)) return;
  const url = hashToUrl(h);
  try {
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  } catch {
    window.location.hash = h.startsWith('#') ? h : `#${url}`;
    return;
  }
  notify();
}

/** Change the URL without a history entry and without notifying (the old `history.replaceState`). */
export function replaceHash(h: string): void {
  window.history.replaceState(null, '', hashToUrl(h));
}

/** Add a history entry without notifying (the old `history.pushState`). */
export function pushHash(h: string): void {
  window.history.pushState(null, '', hashToUrl(h));
}

/** Rewrite a legacy `/#/route` URL to `/route`. Safe to call repeatedly. */
export function normalizeLegacyHash(): void {
  if (typeof window === 'undefined') return;
  const { hash } = window.location;
  if (!hash.startsWith('#/')) return;
  try {
    window.history.replaceState(null, '', hashToUrl(hash));
  } catch {
    /* keep the legacy URL; currentHash() still understands it */
  }
}

let installed = false;
/** Idempotent: clean up a legacy URL now and after every later `hashchange`; map back/forward to `hashchange`. */
export function installCleanUrls(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  normalizeLegacyHash();
  window.addEventListener('hashchange', normalizeLegacyHash);
  // Back / forward between clean URLs fires `popstate`, not `hashchange`: the app listens to the latter.
  window.addEventListener('popstate', () => notify());
}
