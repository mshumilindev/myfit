import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { getShareSourcePort } from './config';
import type { ShareSourcePort } from './port';
import { loadingView, resolveShare } from './resolve';
import type { ShareRef, ShareSource, ShareView, Viewer } from './types';

export type ShareStatus = 'loading' | 'ready' | 'error';
interface Entry {
  source: ShareSource | null;
  status: ShareStatus;
  ctl?: AbortController;
  /** read from the server in this tab (not just the cache) */
  fresh?: boolean;
}

/**
 * One store per port: every card in a thread reads the same snapshot, and the first reader starts ONE load per client.
 * The cached snapshot (peek) shows at once; a failed refresh keeps it (an error is a state of the data, not a blocker).
 */
interface Store {
  get(clientId: string): Entry;
  subscribe(f: () => void): () => void;
  load(clientId: string): void;
}
const stores = new WeakMap<ShareSourcePort, Store>();
const EMPTY: Entry = { source: null, status: 'loading' };

function storeFor(port: ShareSourcePort): Store {
  const s = stores.get(port);
  if (s) return s;
  const entries = new Map<string, Entry>();
  const subs = new Set<() => void>();
  const set = (id: string, e: Entry) => {
    entries.set(id, e);
    subs.forEach((f) => f());
  };
  const store: Store = {
    get(id) {
      let e = entries.get(id);
      if (!e) {
        const cached = port.peek(id);
        e = cached ? { source: cached, status: 'ready' } : EMPTY;
        if (cached) entries.set(id, e);
      }
      return e;
    },
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    load(id) {
      const cur = entries.get(id);
      if (cur?.ctl) return;
      const ctl = new AbortController();
      const base = store.get(id);
      set(id, { ...base, ctl });
      port
        .load(id, { signal: ctl.signal })
        .then((source) => set(id, { source, status: 'ready', fresh: true }))
        .catch(() =>
          set(id, {
            source: store.get(id).source,
            status: store.get(id).source ? 'ready' : 'error',
          }),
        );
    },
  };
  stores.set(port, store);
  return store;
}

export interface UseShareSource {
  source: ShareSource | null;
  status: ShareStatus;
  /** A cached snapshot is showing while a refresh failed. */
  stale: boolean;
  retry: () => void;
}

export function useShareSource(clientId: string | null, port?: ShareSourcePort): UseShareSource {
  const p = port ?? getShareSourcePort();
  const store = storeFor(p);
  const entry = useSyncExternalStore(
    store.subscribe,
    () => (clientId ? store.get(clientId) : EMPTY),
    () => EMPTY,
  );
  useEffect(() => {
    if (clientId && !entry.ctl && !entry.fresh) store.load(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, store]);
  const retry = useCallback(() => {
    if (!clientId) return;
    const e = store.get(clientId);
    if (e.ctl) e.ctl.abort();
    store.load(clientId);
  }, [clientId, store]);
  return { source: entry.source, status: entry.status, stale: entry.status === 'error', retry };
}

/** The card for a ref, resolved with the reader's access. `loading` until the source arrives. */
export function useResolvedShare(
  ref: ShareRef,
  viewer: Viewer,
  port?: ShareSourcePort,
): { view: ShareView; status: ShareStatus; retry: () => void } {
  const { source, status, retry } = useShareSource(viewer.clientId, port);
  const view = useMemo(
    () => (source ? resolveShare(ref, viewer, source) : loadingView(ref)),
    [source, ref, viewer],
  );
  return { view, status, retry };
}
