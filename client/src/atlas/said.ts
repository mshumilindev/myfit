/** What Atlas said recently (local copy). Tiny on purpose: the heavy `memory` module stays in the lazy Atlas chunk. */
export const SAID_KEY = 'spotter.atlasSaid';

export function clearSaid(): void {
  try {
    localStorage.removeItem(SAID_KEY);
  } catch {
    /* ignore */
  }
}
