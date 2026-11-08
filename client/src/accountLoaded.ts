/** Tracks which parts of the account have delivered a first server snapshot (what one-time migrations wait for). */
const loaded = { prefs: false, workouts: false };
/** Collections the one-time role migration counts (`getStoredUsage`) that must deliver a first snapshot. */
export const USAGE_SOURCES = ['sleeps', 'restPeriods', 'injuries', 'conditions'] as const;
let usageLoaded = new Set<string>();
const loadedListeners = new Set<() => void>();
const prefsListeners = new Set<() => void>();

function ready(): boolean {
  return loaded.prefs && loaded.workouts && USAGE_SOURCES.every((n) => usageLoaded.has(n));
}
function check(): void {
  if (ready()) for (const f of [...loadedListeners]) f();
}
export function markPrefsLoaded(): void {
  loaded.prefs = true;
  for (const f of [...prefsListeners]) f();
  check();
}
export function markWorkoutsLoaded(): void {
  loaded.workouts = true;
  check();
}
export function markUsage(name: (typeof USAGE_SOURCES)[number]): void {
  if (usageLoaded.has(name)) return;
  usageLoaded.add(name);
  check();
}
export function resetAccountLoaded(): void {
  loaded.prefs = false;
  loaded.workouts = false;
  usageLoaded = new Set();
}
/** Runs `cb` once the account's synced preferences have arrived from the server (not the cache). */
export function whenPrefsLoaded(cb: () => void): () => void {
  if (loaded.prefs) {
    cb();
    return () => undefined;
  }
  prefsListeners.add(cb);
  return () => prefsListeners.delete(cb);
}
/** Runs `cb` once prefs, workouts and nights/rest periods/injuries/conditions have arrived. Returns a cancel function. */
export function whenAccountLoaded(cb: () => void): () => void {
  if (ready()) {
    cb();
    return () => undefined;
  }
  loadedListeners.add(cb);
  return () => loadedListeners.delete(cb);
}
