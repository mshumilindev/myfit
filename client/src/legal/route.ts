import { useEffect, useState } from 'react';
import { currentHash, setHash } from '../route';

/** Public legal pages: `/privacy`, `/terms` and the DRAFT trainer documents `/trainer-terms`, `/dpa` (the app's router speaks hash routes; `currentHash()` maps the clean URL). */
export type LegalPageId = 'privacy' | 'terms' | 'trainer-terms' | 'dpa';

/** `#/privacy`, `#/terms/`, `#/privacy?x=1` → the page id; anything else → null. */
export function legalRoute(hash: string): LegalPageId | null {
  const m = /^#\/(privacy|terms|trainer-terms|dpa)\/?(?:[?#].*)?$/i.exec(hash);
  return m ? (m[1].toLowerCase() as LegalPageId) : null;
}

/** Name of the browser window the app opens public legal pages in: a page that carries it was opened from inside the app. */
export const LEGAL_WINDOW = 'spotter-legal';

const RETURN_KEY = 'spotter.legalReturn';
/** An in-app address only (letters, digits, `/ _ -`): never a token, a query or a legal page. */
const RETURN_OK = /^#\/[A-Za-z0-9/_-]{0,80}$/;

/**
 * The legal page replaced the screen in the SAME tab (the popup was blocked): remember where the person came from (the
 * coach, say), so Back returns there and not to the app root. Session-only, one route, no personal data.
 */
export function rememberLegalReturn(hash: string = currentHash()): void {
  try {
    if (RETURN_OK.test(hash) && !legalRoute(hash)) sessionStorage.setItem(RETURN_KEY, hash);
  } catch {
    /* storage unavailable: Back falls back to history / the root */
  }
}

/** The remembered return address, once. */
function takeLegalReturn(): string | null {
  try {
    const h = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return h && RETURN_OK.test(h) ? h : null;
  } catch {
    return null;
  }
}

export type LegalBackAction = 'close' | 'back' | 'root';

/**
 * What the "back" control of a public legal page does. `popup`: the page was opened in its own window by the app
 * (it has an opener, or it carries the `LEGAL_WINDOW` name: the app clears `opener` for safety) = close it. `fromApp`: this
 * page was reached by an in-app navigation, so the previous history entry is the app = `history.back()`. Anything else
 * (typed or shared link, reload, another site) has no safe previous entry = the app root.
 */
export function legalBackAction(o: { popup: boolean; fromApp: boolean }): LegalBackAction {
  if (o.popup) return 'close';
  return o.fromApp ? 'back' : 'root';
}

export function isLegalPopup(): boolean {
  return !!window.opener || window.name === LEGAL_WINDOW;
}

/** Runs the action. A window the browser refuses to close falls back to the app root, so the button never does nothing. */
export function performLegalBack(action: LegalBackAction): void {
  if (action !== 'close') {
    const to = takeLegalReturn();
    if (to) {
      setHash(to);
      return;
    }
  }
  if (action === 'back') {
    window.history.back();
    return;
  }
  if (action === 'close') {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) setHash('#/');
    }, 150);
    return;
  }
  setHash('#/');
}

/**
 * The public legal page the URL names, and whether it was reached by an in-app navigation (a `hashchange` while the app
 * runs: the previous history entry is the app, so Back may use `history.back()`).
 */
export function useLegalRoute(): { legalPage: LegalPageId | null; legalFromApp: boolean } {
  const [legalPage, setLegalPage] = useState(() => legalRoute(currentHash()));
  const [legalFromApp, setLegalFromApp] = useState(false);
  useEffect(() => {
    const onNav = () => {
      const p = legalRoute(currentHash());
      setLegalPage(p);
      setLegalFromApp(p !== null);
    };
    window.addEventListener('hashchange', onNav);
    return () => window.removeEventListener('hashchange', onNav);
  }, []);
  return { legalPage, legalFromApp };
}

/**
 * An invite link opened while the app runs (pasted, followed in the same tab) is the same sign-up screen as on a cold load.
 * The legal gate treats `#/join/` as that screen's, so the app must not stay usable behind that exemption.
 */
export function useJoinLinkSync(setJoinToken: (token: string) => void): void {
  useEffect(() => {
    const onJoin = () => {
      const m = /^#\/join\/([A-Za-z0-9-]+)/.exec(currentHash());
      if (m) setJoinToken(m[1]);
    };
    window.addEventListener('hashchange', onJoin);
    return () => window.removeEventListener('hashchange', onJoin);
  }, [setJoinToken]);
}
