/**
 * Media packs (SPO-556 I6): an installed app or add-on keeps its pictures (exercise photos, muscle maps, look backgrounds)
 * in its own cache, downloaded when it is installed and dropped when it is removed. The list of files comes from the
 * build (`addon-packs.json`, from `sizeEntries.json` assets); the service worker serves the cache first.
 * Everything here is best-effort: a missing cache, an offline phone or Data Saver only means the pictures load when used.
 */
import { useSyncExternalStore } from 'react';
import entries from './sizeEntries.json';

export const PACK_CACHE = 'spotter-packs';
const CONCURRENCY = 6;

type Manifest = Record<string, [string, number][]>;
export interface PackState {
  status: 'idle' | 'loading' | 'ready' | 'paused' | 'error';
  /** Bytes already in the cache / bytes in the whole pack. */
  done: number;
  total: number;
}
const IDLE: PackState = { status: 'idle', done: 0, total: 0 };

/** Ids that have a pack at all (known without the manifest). */
export const PACK_IDS: readonly string[] = Object.entries(
  entries as Record<string, { assets?: string[] }>,
)
  .filter(([, p]) => (p.assets?.length ?? 0) > 0)
  .map(([id]) => id);

const states = new Map<string, PackState>();
const listeners = new Set<() => void>();
const aborts = new Map<string, AbortController>();
let manifest: Promise<Manifest | null> | null = null;

function set(id: string, s: PackState) {
  states.set(id, s);
  listeners.forEach((l) => l());
}
export function packState(id: string): PackState {
  return states.get(id) ?? IDLE;
}
export function usePackState(id: string): PackState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => packState(id),
    () => IDLE,
  );
}

const base = () => import.meta.env.BASE_URL ?? '/';
const urlOf = (path: string) => `${base()}${path}`;

function loadManifest(): Promise<Manifest | null> {
  manifest ??= fetch(`${base()}addon-packs.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null)
    .then((m) => {
      if (m === null) manifest = null; // ask again next time
      return m;
    });
  return manifest;
}

const hasCaches = () => typeof caches !== 'undefined';
function dataSaver(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}

/**
 * Download a pack into its cache. Idempotent: files already there are skipped, a running download is not started twice.
 * `force` ignores Data Saver (an explicit tap).
 */
export async function installPack(id: string, force = false): Promise<void> {
  if (!hasCaches() || aborts.has(id)) return;
  const files = (await loadManifest())?.[id];
  if (!files?.length) return;
  const total = files.reduce((a, f) => a + f[1], 0);
  if (!force && dataSaver()) {
    set(id, { status: 'paused', done: packState(id).done, total });
    return;
  }
  const ctl = new AbortController();
  aborts.set(id, ctl);
  try {
    const cache = await caches.open(PACK_CACHE);
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    let done = 0;
    const todo = files.filter((f) => {
      const there = have.has(new URL(urlOf(f[0]), location.href).pathname);
      if (there) done += f[1];
      return !there;
    });
    set(id, { status: todo.length ? 'loading' : 'ready', done, total });
    let failed = 0;
    let last = 0;
    const next = async (): Promise<void> => {
      for (;;) {
        const f = todo.shift();
        if (!f || ctl.signal.aborted) return;
        try {
          const r = await fetch(urlOf(f[0]), { signal: ctl.signal });
          // Hosting answers a missing picture with index.html and 200: keep only what really is a picture (or data).
          if (
            r.ok &&
            /^(image|video|application\/json)/i.test(r.headers.get('content-type') ?? '')
          ) {
            await cache.put(urlOf(f[0]), r);
            done += f[1];
          } else failed++;
        } catch {
          if (ctl.signal.aborted) return;
          failed++;
        }
        const now = Date.now();
        if (now - last > 250) {
          last = now;
          if (!ctl.signal.aborted) set(id, { status: 'loading', done, total });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, next));
    if (ctl.signal.aborted) return;
    set(id, { status: failed ? 'error' : 'ready', done, total });
    if (failed) {
      // Offline or a flaky network: try again once the phone is back online.
      window.addEventListener('online', () => void installPack(id), { once: true });
    }
  } catch {
    set(id, { status: 'error', done: packState(id).done, total });
  } finally {
    aborts.delete(id);
  }
}

/** Drop a pack's files from the cache (an app was removed); stops a download in progress. */
export async function removePack(id: string): Promise<void> {
  aborts.get(id)?.abort();
  aborts.delete(id);
  set(id, IDLE);
  if (!hasCaches()) return;
  const files = (await loadManifest())?.[id];
  if (!files?.length) return;
  try {
    const cache = await caches.open(PACK_CACHE);
    await Promise.all(files.map((f) => cache.delete(urlOf(f[0]))));
  } catch {
    /* best effort */
  }
}

/** Test hook. */
export function resetPacks(): void {
  states.clear();
  aborts.forEach((a) => a.abort());
  aborts.clear();
  manifest = null;
}
