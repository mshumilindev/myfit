/**
 * Keep an installed PWA on the freshest build.
 *
 * An iOS home-screen app resumes the same suspended page for days. The service
 * worker picks up a deploy in the background, but the page keeps running the
 * bundle it started with, so shipped fixes stay invisible until the user kills
 * the app twice. We ask the worker for a fresh check whenever the app returns
 * to the foreground; as soon as a replacement worker takes control we raise the
 * "update ready" signal so the UI can show a plate — the user reloads when they
 * are ready, rather than the page yanking itself out from under them mid-set.
 */

const SW_URL = '/sw.js';
const SW_SCOPE = '/';
/** Foreground checks are cheap but not free — one per minute is plenty. */
export const FOREGROUND_CHECK_MS = 60_000;

// --- Update-ready signal (module store the app subscribes to) --------------
let updatePending = false;
const updateListeners = new Set<() => void>();

/** A fresh build is in control — the running page is stale. Idempotent. */
export function markUpdateReady(): void {
  if (updatePending) return;
  updatePending = true;
  for (const l of updateListeners) l();
}

/** Snapshot for useSyncExternalStore. */
export function isUpdateReady(): boolean {
  return updatePending;
}

/** Subscribe to the update-ready signal; returns an unsubscribe fn. */
export function subscribeUpdateReady(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => {
    updateListeners.delete(listener);
  };
}

export interface PwaUpdateDeps {
  container: Pick<ServiceWorkerContainer, 'register' | 'addEventListener' | 'controller'>;
  doc: Pick<Document, 'addEventListener' | 'visibilityState'>;
  onUpdateReady: () => void;
  now: () => number;
}

export async function startAutoUpdate(deps: PwaUpdateDeps): Promise<void> {
  const { container, doc, onUpdateReady, now } = deps;

  // A first-ever install claims the page too. Only a *replacement* worker means
  // the page is running an outdated bundle and should offer a reload.
  let hadController = container.controller !== null;
  let signalled = false;
  container.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (signalled) return;
    signalled = true;
    onUpdateReady();
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
    // The dev server has no sw.js (it answers with index.html), so a failed registration there is expected.
    if (import.meta.env.MODE === 'development') return;
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

// --- Recovery: look for a new version and switch to it right now ------------------------------------------------

export type UpdateResult = 'updated' | 'current' | 'failed';

/**
 * Ask the server for a newer build and, if there is one, switch to it AT ONCE (the page reloads when the new worker
 * takes control). Used where waiting is pointless: the app crashed or a chunk of the old build is gone. Resolves
 * `current` when this already is the newest build, `failed` when the check could not run (offline, no worker).
 */
export async function updateNow(
  container:
    | Pick<ServiceWorkerContainer, 'getRegistration' | 'addEventListener'>
    | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
  reload: () => void = () => window.location.reload(),
  timeoutMs = 15_000,
): Promise<UpdateResult> {
  if (!container) return 'failed';
  try {
    const reg = await container.getRegistration();
    if (!reg) return 'failed';
    const takeover = new Promise<UpdateResult>((resolve) => {
      container.addEventListener('controllerchange', () => resolve('updated'), { once: true });
    });
    await reg.update();
    const next = reg.waiting ?? reg.installing;
    if (!next) return 'current';
    if (next.state === 'installed') next.postMessage({ type: 'SKIP_WAITING' });
    const result = await Promise.race([
      takeover,
      new Promise<UpdateResult>((resolve) => setTimeout(() => resolve('failed'), timeoutMs)),
    ]);
    if (result === 'updated') reload();
    return result;
  } catch {
    return 'failed';
  }
}

/** The last resort: drop every worker and every cache, then load the app fresh from the network. */
export async function resetApp(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* nothing to drop */
  }
  try {
    const keys = typeof caches === 'undefined' ? [] : await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* nothing to drop */
  }
  window.location.reload();
}
