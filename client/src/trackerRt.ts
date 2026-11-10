/**
 * Late-bound runtime of the health trackers (SPO-500 I8). The store, the calc engines and the sealed caches call a tracker
 * through its `*Rt` facade, which answers with a NEUTRAL value (nothing applies, state passes through untouched) until the
 * tracker's real modules are loaded; those modules `provide` their functions into the facade when they are imported, and the
 * boot module announces `trackerReady` so the store re-normalises its copy and re-renders. The tracker code is therefore a
 * lazy chunk fetched only while its add-on is installed; nothing is dropped or rewritten while it is not loaded (the store
 * state is the stored data as it was, and a tracker that is off persists nothing — see `mayPersist`).
 */
type Listener = (id: string) => void;
const listeners = new Set<Listener>();

/** Put the real functions into a facade. Called by the tracker's own modules at import time. */
export function provide<T extends object>(rt: T, impl: Partial<T>): void {
  Object.assign(rt, impl);
}

/** The store listens: re-normalise the tracker's state and notify subscribers. */
export function onTrackerReady(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const readyIds = new Set<string>();

/** Has the tracker's real code arrived? (Before that the facade answers neutral and must not be published as data.) */
export function isTrackerReady(id: string): boolean {
  return readyIds.has(id);
}

/** The boot module of a tracker finished importing all its modules. */
export function trackerReady(id: string): void {
  readyIds.add(id);
  listeners.forEach((l) => l(id));
}

/**
 * Fetch a tracker's lazy chunk. A failed import (offline, stale deploy) is logged and retried once when the
 * connection returns; the facade stays neutral meanwhile, and the coach share is held back (see `isTrackerReady`).
 */
export function loadTracker(id: string, importer: () => Promise<unknown>): void {
  const attempt = (retry: boolean): void => {
    importer().catch((e: unknown) => {
      console.warn(`[tracker:${id}] chunk failed to load`, e);
      if (retry && typeof window !== 'undefined')
        window.addEventListener('online', () => attempt(false), { once: true });
    });
  };
  attempt(true);
}
