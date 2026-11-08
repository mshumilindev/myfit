/** Cached position and the one-shot location read (moved out of store.ts; store re-exports it for its callers). */
type PosFix = { lat: number; lng: number; accuracy: number; at: number };
const POS_CACHE_KEY = 'spotter.lastPos';

/** Last known position, cached in localStorage so we can reuse it without asking
 * the browser for permission again (see getCurrentPositionOnce). */
export function readPosCache(): PosFix | null {
  try {
    const raw = localStorage.getItem(POS_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PosFix;
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number' && typeof p?.at === 'number') {
      return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}
function writePosCache(fix: { lat: number; lng: number; accuracy: number }): void {
  try {
    localStorage.setItem(POS_CACHE_KEY, JSON.stringify({ ...fix, at: Date.now() }));
  } catch {
    /* quota */
  }
}
/** True only when the browser already granted geolocation — so we can read a
 * fresh fix without popping a permission prompt. */
export async function geolocationGranted(): Promise<boolean> {
  try {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!perms?.query) return false;
    const status = await perms.query({ name: 'geolocation' as PermissionName });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * One location read, designed so the app asks for permission at most once.
 *  - maxAgeMs: if the cached fix is younger than this, return it with NO
 *    geolocation call (no permission prompt, no GPS spin-up).
 *  - cacheFirst: if ANY cached fix exists, return it immediately and never
 *    prompt; when permission is already granted, refresh the cache silently in
 *    the background. Only when there is no cached fix at all do we do a real
 *    read (which may prompt). Used at session start so opening the app reuses
 *    the location it already has instead of re-asking every time.
 * Every successful fresh read is cached in localStorage for later reuse.
 */
export function getCurrentPositionOnce(opts?: {
  maxAgeMs?: number;
  cacheFirst?: boolean;
}): Promise<{ lat: number; lng: number; accuracy: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? 0;
  const cached = readPosCache();
  const fromCache = cached ? { lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy } : null;
  // Only fall back to a cached fix for callers that opted into cache behaviour;
  // a plain getCurrentPositionOnce() keeps its original resolve/reject contract.
  const canUseCache = maxAgeMs > 0 || !!opts?.cacheFirst;

  // Fresh enough cache → instant, no geolocation call at all.
  if (cached && maxAgeMs > 0 && Date.now() - cached.at <= maxAgeMs) {
    return Promise.resolve({ lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy });
  }

  // Have a fix already → reuse it and never prompt; quietly refresh if allowed.
  if (fromCache && opts?.cacheFirst) {
    if ('geolocation' in navigator) {
      void geolocationGranted().then((granted) => {
        if (!granted) return;
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            writePosCache({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          () => {
            /* ignore background refresh errors */
          },
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: maxAgeMs },
        );
      });
    }
    return Promise.resolve(fromCache);
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      if (fromCache && canUseCache) return resolve(fromCache);
      return reject(new Error('Геолокація недоступна в цьому браузері'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        writePosCache(fix);
        resolve(fix);
      },
      (err) => {
        if (fromCache && canUseCache) return resolve(fromCache);
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Доступ до геолокації заборонено. Дозволь його в налаштуваннях браузера.'
              : 'Не вдалося визначити локацію',
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: maxAgeMs },
    );
  });
}
