/**
 * Keep an installed PWA on the freshest build.
 *
 * An iOS home-screen app resumes the same suspended page for days. The service
 * worker picks up a deploy in the background, but the page keeps running the
 * bundle it started with, so shipped fixes stay invisible until the user kills
 * the app twice. We ask the worker for a fresh check whenever the app returns
 * to the foreground, and reload as soon as a replacement worker takes control.
 */

const SW_URL = '/sw.js';
const SW_SCOPE = '/';
/** Foreground checks are cheap but not free — one per minute is plenty. */
export const FOREGROUND_CHECK_MS = 60_000;

export interface PwaUpdateDeps {
  container: Pick<ServiceWorkerContainer, 'register' | 'addEventListener' | 'controller'>;
  doc: Pick<Document, 'addEventListener' | 'visibilityState'>;
  reload: () => void;
  now: () => number;
}

export async function startAutoUpdate(deps: PwaUpdateDeps): Promise<void> {
  const { container, doc, reload, now } = deps;

  // A first-ever install claims the page too. Only a *replacement* worker means
  // the page is running an outdated bundle and has to be reloaded.
  let hadController = container.controller !== null;
  let reloading = false;
  container.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    reload();
  });

  let registration: ServiceWorkerRegistration;
  try {
    // updateViaCache: 'none' — the worker and its imports must never come from
    // the HTTP cache, or a deploy stays invisible until the cache expires.
    registration = await container.register(SW_URL, {
      scope: SW_SCOPE,
      updateViaCache: 'none',
    });
  } catch (err) {
    console.error('service worker registration failed', err);
    return;
  }

  let lastCheck = now();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return;
    if (now() - lastCheck < FOREGROUND_CHECK_MS) return;
    lastCheck = now();
    registration.update().catch((err) => {
      console.error('service worker update check failed', err);
    });
  });
}
