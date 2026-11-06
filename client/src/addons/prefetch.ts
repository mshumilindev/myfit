/**
 * Offline prefetch for an add-on (SPO-515 / I4): its chunk URLs go into their own cache
 * `spotter-addon-<id>-<build>`, apart from the LRU `spotter-assets`, so an installed add-on opens offline for sure.
 * Pure Cache API + `navigator.storage`; no add-on lists chunks yet (the code split lands with the stripping, I7/I8),
 * so for now every add-on has nothing to fetch and `prefetchChunks` resolves at once.
 */
export const ADDON_CACHE_PREFIX = 'spotter-addon-';

export class PrefetchError extends Error {
  constructor(readonly reason: 'offline' | 'quota' | 'fetch') {
    super(reason);
  }
}

export const addonCacheName = (id: string, build: string): string =>
  `${ADDON_CACHE_PREFIX}${id}-${build}`;

/** Free bytes the browser will give this origin; null when it can't say. */
async function freeBytes(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota == null || est.usage == null) return null;
    return est.quota - est.usage;
  } catch {
    return null;
  }
}

/**
 * Put every chunk into the add-on's cache, reporting 0..100. Idempotent: chunks already cached are skipped, so a
 * retry after a failure continues. `sizeHint` (bytes) is checked against the free quota before fetching.
 */
export async function prefetchChunks(
  id: string,
  build: string,
  urls: readonly string[],
  onProgress: (pct: number) => void,
  sizeHint = 0,
): Promise<void> {
  if (urls.length === 0) {
    onProgress(100);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new PrefetchError('offline');
  const free = await freeBytes();
  if (free !== null && sizeHint > free) throw new PrefetchError('quota');
  const cache = await caches.open(addonCacheName(id, build));
  let done = 0;
  for (const url of urls) {
    if (!(await cache.match(url))) {
      try {
        await cache.add(url);
      } catch (e) {
        throw new PrefetchError(
          e instanceof DOMException && e.name === 'QuotaExceededError' ? 'quota' : 'fetch',
        );
      }
    }
    done += 1;
    onProgress(Math.round((done / urls.length) * 100));
  }
}

/** Drop the caches of older builds (and of removed add-ons when `keepIds` is given). */
export async function pruneAddonCaches(
  build: string,
  keepIds?: ReadonlySet<string>,
): Promise<string[]> {
  const removed: string[] = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith(ADDON_CACHE_PREFIX)) continue;
    const rest = name.slice(ADDON_CACHE_PREFIX.length);
    const at = rest.lastIndexOf('-');
    const id = rest.slice(0, at);
    const b = rest.slice(at + 1);
    if (b !== build || (keepIds && !keepIds.has(id))) {
      await caches.delete(name);
      removed.push(name);
    }
  }
  return removed;
}
