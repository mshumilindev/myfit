/**
 * Client Spotter test double for stories and tests (never imported by app code: `tests/kit-guard.test.ts`). Several
 * ports made over one `store` behave like several devices of the same person: marking read on one reaches the others.
 */
import {
  feedOf,
  type ClientSpotterFeed,
  type ClientSpotterItem,
  type ClientSpotterPort,
} from '../clientSpotterPort';

const H = 3_600_000;

/** The request `rq2` of the schedule fixtures (c2, trainer asks): the card in the thread is drawn from it. */
export const SPOTTER_REQUEST_ID = 'rq2';

/** The matrix of the client's kinds, newest first: one item of each kind. */
export function buildClientSpotterItems(now: number, read = false): ClientSpotterItem[] {
  const u = !read;
  return [
    {
      id: 's1',
      kind: 'move-request',
      who: 'Irina Melnyk',
      createdAt: now - 1 * H,
      unread: u,
      refId: SPOTTER_REQUEST_ID,
    },
    { id: 's2', kind: 'session-done', who: 'Irina Melnyk', createdAt: now - 4 * H, unread: u },
    { id: 's3', kind: 'reminder', who: '', createdAt: now - 9 * H, unread: u, at: now + 15 * H },
    {
      id: 's4',
      kind: 'session-missed',
      who: 'Olena Kovalenko',
      createdAt: now - 30 * H,
      unread: false,
    },
    {
      id: 's5',
      kind: 'session-cancelled',
      who: 'Irina Melnyk',
      createdAt: now - 32 * H,
      unread: false,
    },
    {
      id: 's6',
      kind: 'move-answer',
      who: 'Olena Kovalenko',
      createdAt: now - 50 * H,
      unread: false,
      status: 'accepted',
    },
    { id: 's7', kind: 'team', who: 'Irina Melnyk', createdAt: now - 3 * 24 * H, unread: false },
    { id: 's8', kind: 'access', who: '', createdAt: now - 3 * 24 * H - H, unread: false },
    { id: 's9', kind: 'summary', who: '', createdAt: now - 6 * 24 * H, unread: false },
  ];
}

export interface ClientSpotterStore {
  items: ClientSpotterItem[];
  listeners: Set<() => void>;
  /** ids passed to markRead, in order (assertions) */
  marked: string[][];
}

export function createClientSpotterStore(items: ClientSpotterItem[]): ClientSpotterStore {
  return { items, listeners: new Set(), marked: [] };
}

export interface FixturesClientSpotterOptions {
  now?: number;
  /** start with this store (several ports over one store = several devices) */
  store?: ClientSpotterStore;
  /** items of the default store */
  items?: ClientSpotterItem[];
  /** the feed never arrives (Loading story) */
  cold?: boolean;
  /** the subscription fails (Failed story) */
  fail?: boolean;
  /** markRead rejects (offline) */
  failMark?: boolean;
}

export function createFixturesClientSpotterPort(
  o: FixturesClientSpotterOptions = {},
): ClientSpotterPort & { store: ClientSpotterStore; feed(): ClientSpotterFeed } {
  const store =
    o.store ?? createClientSpotterStore(o.items ?? buildClientSpotterItems(o.now ?? Date.now()));
  const feed = () => feedOf(store.items.map((i) => ({ id: i.id, data: toDoc(i) })));
  return {
    store,
    feed,
    subscribe(on, onError) {
      if (o.fail) {
        queueMicrotask(() => onError(new Error('unavailable')));
        return () => undefined;
      }
      if (o.cold) return () => undefined;
      const push = () => on(feed());
      store.listeners.add(push);
      queueMicrotask(push);
      return () => void store.listeners.delete(push);
    },
    async markRead(ids) {
      if (o.failMark) throw new Error('offline');
      store.marked.push([...ids]);
      store.items = store.items.map((i) => (ids.includes(i.id) ? { ...i, unread: false } : i));
      store.listeners.forEach((f) => f());
    },
  };
}

/** The stored shape of an item (what the server writes), so the double goes through the same parser as the real port. */
function toDoc(i: ClientSpotterItem): Record<string, unknown> {
  return {
    kind: i.kind,
    detail: i.who,
    createdAt: i.createdAt,
    readAt: i.unread ? null : i.createdAt,
    ...(i.refId ? { refId: i.refId } : {}),
    ...(i.status ? { status: i.status } : {}),
    ...(i.at != null ? { start: i.at } : {}),
  };
}
