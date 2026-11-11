/**
 * Looks load on demand (SPO-500 I8, owner 11.11): Studio is the base and ships with the app; every other look keeps its
 * CSS, tokens and fonts in a bundle (`bundles/<id>.ts`) fetched only when the look is installed and about to be worn. The
 * registry puts `data-theme` on only after the bundle is in, so a half-styled frame is never shown.
 */
type Loader = () => Promise<unknown>;

const LOADERS: Record<string, Loader> = {
  glass: () => import('./bundles/glass'),
  cyberpunk: () => import('./bundles/cyberpunk'),
  halloween: () => import('./bundles/halloween'),
  christmas: () => import('./bundles/christmas'),
  // theme:new inserts new looks above this line
};

const ready = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** Looks that ship as a bundle (everything but the base). */
export const lazyThemeIds = (): string[] => Object.keys(LOADERS);

/** True when the look's styles are in the page (the base look and any look without a bundle always are). */
export const themeCssReady = (id: string): boolean => !(id in LOADERS) || ready.has(id);

/** Tests and Storybook ship every look up front: mark them in so nothing waits. */
export function markAllThemeCssReady(): void {
  for (const id of Object.keys(LOADERS)) ready.add(id);
}

/** Fetches the look's bundle once; a failed fetch is reported and tried again the next time the device is online. */
export function loadThemeCss(id: string): Promise<void> {
  if (themeCssReady(id)) return Promise.resolve();
  let p = pending.get(id);
  if (!p) {
    p = LOADERS[id]()
      .then(() => {
        ready.add(id);
      })
      .catch((e: unknown) => {
        pending.delete(id);
        console.warn(`[themes] could not load "${id}" styles`, e);
        if (typeof window !== 'undefined')
          window.addEventListener('online', () => void loadThemeCss(id).then(retryHooks), {
            once: true,
          });
        throw e;
      });
    pending.set(id, p);
  }
  return p;
}

const retryHooks = (): void => {
  afterLateLoad?.();
};
let afterLateLoad: (() => void) | null = null;
/** The registry registers here to re-dress the app when a retried bundle finally arrives. */
export function onThemeCssRetried(fn: () => void): void {
  afterLateLoad = fn;
}
