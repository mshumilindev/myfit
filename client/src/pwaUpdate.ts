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

  // An open, focused tab never fires `visibilitychange`: look for a new worker on a timer as well.
  setInterval(() => {
    registration.update().catch(() => undefined);
  }, 5 * 60_000);

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

// --- Build check: independent of the service worker ------------------------------------------------------------

declare const __BUILD_ID__: string | undefined;
const RUNNING_BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null;

/**
 * Ask the server which build is live (`/version.json`, never cached) and raise the update plate when it is not the one
 * this page runs. The worker's `controllerchange` is a one-shot event that a suspended iOS page can miss or that never
 * fires when the worker cannot install; this check does not depend on the worker at all.
 */
export async function checkBuild(
  fetchFn: typeof fetch = (...a) => fetch(...a),
  running: string | null = RUNNING_BUILD,
  onNewer: () => void = markUpdateReady,
): Promise<boolean> {
  if (!running) return false;
  // Offline: no request at all (the browser would log the failed fetch itself); the `online` event runs the check again.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const res = await fetchFn(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const body = (await res.json()) as { build?: unknown };
    if (typeof body.build === 'string' && body.build !== running) {
      onNewer();
      return true;
    }
  } catch {
    /* offline — try again later */
  }
  return false;
}

/** A fresh page can still report `onLine` from before an offline switch for a moment; let it settle before asking. */
const BUILD_CHECK_SETTLE_MS = 1500;

/**
 * Wraps a check so that the triggers which fire together on a page load (start, `pageshow`, `online`, visible) become
 * one check, run after the connection state has settled. Offline the check then sends no request at all, so the
 * browser has no failed fetch to log.
 */
export function settledBuildCheck(
  check: () => void,
  settleMs: number = BUILD_CHECK_SETTLE_MS,
): () => void {
  let pending: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (pending !== null) return;
    pending = setTimeout(() => {
      pending = null;
      check();
    }, settleMs);
  };
}

/** Check at start, whenever the app comes back to the foreground and every few minutes while it stays open. */
export function startBuildWatch(
  doc: Pick<Document, 'addEventListener' | 'visibilityState'> = document,
): void {
  if (!RUNNING_BUILD) return;
  const run = settledBuildCheck(() => void checkBuild());
  run();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') run();
  });
  window.addEventListener('pageshow', run);
  window.addEventListener('online', run);
  setInterval(run, 5 * 60_000);
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

/**
 * Reload into the NEWEST build. A plain reload serves whatever worker is active now; when several deploys landed since
 * the page started, that can be an intermediate build and the plate would come back once per deploy. So first let the
 * worker pick up the latest build (bounded wait, offline-safe), then reload exactly once.
 */
export async function reloadToLatest(
  update: (
    container: undefined,
    reload: () => void,
    timeoutMs: number,
  ) => Promise<UpdateResult> = updateNow,
  reload: () => void = () => window.location.reload(),
  timeoutMs = 4_000,
): Promise<void> {
  try {
    await update(undefined, () => undefined, timeoutMs);
  } catch {
    /* reload anyway */
  }
  reload();
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
