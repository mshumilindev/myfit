/**
 * Shared helpers of the Coach e2e specs (smoke + axe). Not a spec (no `.e2e.ts` suffix).
 *
 * The Coach specs run against a PRODUCTION build made with `VITE_COACH_BACKEND=fixtures` (the sample clients: Oleh, Iryna
 * ...), served by `vite preview` (see playwright.config.ts and docs/COACH-STATUS.md). Firebase is unreachable on purpose:
 * every request to its hosts is aborted, the signed-in state and the role come from the same localStorage keys the app
 * reads at start (`spotter.uid`, `spotter.role`, `gym.flags.global`), so the dashboard opens like for a returning trainer.
 */
import { expect, type ConsoleMessage, type Page } from '@playwright/test';

/** Every Coach route the dashboard has, with fixture ids (c1 = Oleh Bondar). */
export const COACH_ROUTES: readonly string[] = [
  '#/c/today',
  '#/c/clients',
  '#/c/clients/c1',
  '#/c/clients/c1/workouts',
  '#/c/clients/c1/program',
  '#/c/schedule',
  '#/c/week',
  '#/c/decisions',
  '#/c/programs',
  '#/c/programs/prg-c1/edit',
  '#/c/programs/prg-c1/check',
  '#/c/chat',
  '#/c/signals',
  '#/c/live',
];

/** The Firebase web API key baked into the built bundle (the signed-in user is stored under it). */
async function bundleApiKey(page: Page, origin: string): Promise<string> {
  const html = await (await page.request.get(origin + '/')).text();
  const scripts = [...html.matchAll(/src="([^"]*\.js)"/g)].map((m) => m[1]);
  for (const src of scripts) {
    const js = await (await page.request.get(new URL(src, origin + '/').toString())).text();
    const m = js.match(/AIza[0-9A-Za-z_-]{35}/);
    if (m) return m[0];
  }
  return 'e2e-api-key';
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/**
 * Open the dashboard like a returning trainer, without Firebase: a signed-in user is restored from localStorage (the same
 * record the SDK writes; its token is an unsigned JWT with `role: trainer`, which the client only reads, never verifies),
 * the global `coach` flag is on, and every request that leaves localhost is aborted.
 */
export async function seedTrainer(
  page: Page,
  origin: string,
  who: { role?: 'trainer' | 'member'; scenario?: string; name?: string; locale?: string } = {},
): Promise<void> {
  const role = who.role ?? 'trainer';
  const uid = `e2e-${role}`;
  const apiKey = await bundleApiKey(page, origin);
  const now = Math.floor(Date.now() / 1000);
  const jwt = [
    b64url({ alg: 'none', typ: 'JWT' }),
    b64url({
      iss: 'e2e',
      aud: 'e2e',
      sub: uid,
      user_id: uid,
      role,
      iat: now,
      exp: now + 86_400 * 30,
    }),
    'sig',
  ].join('.');
  await page.addInitScript(
    ({ apiKey, jwt, uid, role, name, scenario, locale }) => {
      localStorage.setItem('gym.locale', locale);
      localStorage.setItem('spotter.uid', uid);
      localStorage.setItem('spotter.role', role);
      localStorage.setItem('spotter.username', name);
      // the member-side sample world (fixtures build): active | waiting | revoked | none | migrated
      if (scenario) localStorage.setItem('spotter.clientCoach', scenario);
      localStorage.setItem('gym.flags.global', JSON.stringify({ coach: true }));
      localStorage.setItem(
        `firebase:authUser:${apiKey}:[DEFAULT]`,
        JSON.stringify({
          uid,
          email: null,
          emailVerified: false,
          isAnonymous: false,
          providerData: [],
          stsTokenManager: {
            refreshToken: 'e2e-refresh',
            accessToken: jwt,
            expirationTime: Date.now() + 30 * 86_400_000,
          },
          createdAt: String(Date.now()),
          lastLoginAt: String(Date.now()),
          apiKey,
          appName: '[DEFAULT]',
        }),
      );
    },
    {
      apiKey,
      jwt,
      uid,
      role,
      name: who.name ?? 'Iryna Melnyk',
      scenario: who.scenario ?? '',
      locale: who.locale ?? 'en',
    },
  );
  // Nothing leaves the machine: the sandbox has no network and a spec must not depend on one.
  await page.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname),
    (r) => r.abort('blockedbyclient'),
  );
}

/** Console errors that are NOT the blocked backend (those are expected offline noise). */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  const blocked =
    /googleapis|cloudfunctions|firebaseapp|firebaseio|gstatic|google\.com|googletagmanager|ERR_BLOCKED_BY_CLIENT|ERR_TUNNEL|Failed to fetch|Could not reach Cloud Firestore backend|@firebase\/firestore.*transport errored/;
  // Allowlist (SPO-337), all of it "the network is not there": the Firestore SDK logs an unreachable backend at error
  // level. The app is offline-first and handles that state, so on a runner without Firebase access it is expected.
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const where = m.location().url ?? '';
    const text = m.text();
    if (blocked.test(where) || blocked.test(text)) return;
    if (/Failed to load resource/.test(text) && !where) return;
    // The build watch (src/pwaUpdate.ts) polls /version.json on its own timers; offline that request is refused and the
    // browser logs it. It is the same "network is not there" noise, so only that one file is let through.
    if (/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(text) && /\/version\.json(\?|$)/.test(text + where)) return;
    errors.push(`${text} (${where})`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function openCoach(page: Page, hash: string): Promise<void> {
  await page.goto('/' + hash);
  // The shell is up when the Coach landmark exists; screens load lazily behind it (non-blocking).
  await page.waitForSelector('#root *', { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('body')).not.toContainText('Coach is not configured');
}

/** Visible buttons / links / role=button without an accessible name. */
export async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const nameOf = (el: Element): string => {
      const label = el.getAttribute('aria-label');
      if (label?.trim()) return label.trim();
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      const txt = (el.textContent ?? '').trim();
      if (txt) return txt;
      const img = el.querySelector('img[alt]:not([alt=""])');
      if (img) return img.getAttribute('alt') ?? '';
      return (el.getAttribute('title') ?? '').trim();
    };
    const out: string[] = [];
    document
      .querySelectorAll('button, [role="button"], a[href], [role="tab"], [role="menuitem"]')
      .forEach((el) => {
        if (!visible(el) || el.closest('[aria-hidden="true"], [inert]')) return;
        if (!nameOf(el)) out.push(el.outerHTML.slice(0, 160));
      });
    return out;
  });
}

/** Pixels the page is wider than the viewport (0 = fits). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, Math.max(d.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  });
}
