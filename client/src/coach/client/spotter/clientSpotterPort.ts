/**
 * ClientSpotterPort (SPO-236, SPO-205 boards C4 / C5). Design, in ten lines:
 *  1. Spotter is a VIEW over the client's own `users/{uid}/notices`; there is no chat store behind it.
 *  2. Rules (firestore.rules `notices`): a user reads only their own notices and may change only `readAt`; creating and
 *     deleting are server-only. So this port can read and mark read, and nothing else.
 *  3. A notice carries metadata only: `kind`, `detail` (a name), `createdAt`, `readAt`, `refId`, `status`, `start`.
 *     Session times are sealed: a move request is drawn from the schedule store by `refId`, never from the notice.
 *  4. Kinds the client shows: move-request, move-answer, session-done, session-missed, session-cancelled, team, access,
 *     reminder, summary. Other kinds in the same collection (program-updated, ...) belong to other screens and are skipped.
 *  5. The list is a live query, newest first, capped at SPOTTER_LIMIT: one small read, then only the changes (deltas).
 *  6. Read state is the notice's own `readAt`, so every device of the person sees the same unread count.
 *  7. markRead is a batch of `readAt` updates; offline it queues in Firestore's own persistence and is safe to repeat.
 *  8. The card's buttons (Accept / Decline / Propose another) are the schedule store's `respond`, the same call as
 *     My trainer and the chat card; this port never writes a request.
 *  9. The row in My trainer and the push deep link `#/trainer/spotter` open the same screen.
 * 10. The server writes the client kinds above (functions/src/coach: service.ts, team.ts, reminders.ts; tests/coach-server/clientSpotter.test.ts).
 */
import type { FsApi, FsRow, Raw, Unsub } from '../../data/firestore/fsApi';

export const SPOTTER_LIMIT = 50;

export type ClientSpotterKind =
  | 'move-request'
  | 'move-answer'
  | 'session-done'
  | 'session-missed'
  | 'session-cancelled'
  | 'team'
  | 'access'
  | 'reminder'
  | 'summary';

export const CLIENT_SPOTTER_KINDS: readonly ClientSpotterKind[] = [
  'move-request',
  'move-answer',
  'session-done',
  'session-missed',
  'session-cancelled',
  'team',
  'access',
  'reminder',
  'summary',
];

export interface ClientSpotterItem {
  id: string;
  kind: ClientSpotterKind;
  /** the name the server put in `detail` (the trainer, a manager, a new member); may be empty */
  who: string;
  createdAt: number;
  unread: boolean;
  /** move-request: the id of the request in the schedule store */
  refId?: string;
  /** move-answer: accepted / declined */
  status?: string;
  /** reminder: when the session starts (epoch ms) */
  at?: number;
}

export interface ClientSpotterFeed {
  items: ClientSpotterItem[];
  unread: number;
}

export interface ClientSpotterPort {
  /** Live feed. The first call delivers the cache at once when there is one; errors are reported, never thrown. */
  subscribe(on: (feed: ClientSpotterFeed) => void, onError: (e: unknown) => void): Unsub;
  /** Mark notices read (the only write the rules allow). Idempotent. */
  markRead(ids: readonly string[]): Promise<void>;
}

const KINDS = new Set<string>(CLIENT_SPOTTER_KINDS);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One stored notice to an item; `null` for another screen's kind or a broken document (never shown, never thrown). */
export function parseSpotterNotice(id: string, d: Raw): ClientSpotterItem | null {
  const kind = str(d.kind);
  if (!KINDS.has(kind)) return null;
  const createdAt = num(d.createdAt) ?? num(d.ts);
  if (createdAt == null) return null;
  const refId = str(d.refId);
  const status = str(d.status);
  const at = num(d.start);
  return {
    id,
    kind: kind as ClientSpotterKind,
    who: str(d.detail),
    createdAt,
    unread: d.readAt == null,
    ...(refId ? { refId } : {}),
    ...(status ? { status } : {}),
    ...(at != null ? { at } : {}),
  };
}

export function feedOf(rows: readonly FsRow[]): ClientSpotterFeed {
  const items = rows
    .map((r) => parseSpotterNotice(r.id, r.data))
    .filter((i): i is ClientSpotterItem => i !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
  return { items, unread: items.filter((i) => i.unread).length };
}

export function createFirestoreClientSpotterPort(fs: FsApi, uid: string): ClientSpotterPort {
  const coll = `users/${uid}/notices`;
  return {
    subscribe: (on, onError) =>
      fs.listen(
        coll,
        { orderBy: ['createdAt', 'desc'], limit: SPOTTER_LIMIT },
        (rows) => on(feedOf(rows)),
        onError,
      ),
    async markRead(ids) {
      if (ids.length === 0) return;
      const now = fs.now();
      await fs.batch(
        ids.map((id) => ({ k: 'update', path: `${coll}/${id}`, patch: { readAt: now } })),
      );
    },
  };
}

/** Before the real adapter is installed: reports an error (the screen shows Retry), never sample messages. */
export function createUnavailableClientSpotterPort(): ClientSpotterPort {
  return {
    subscribe: (_on, onError) => {
      queueMicrotask(() => onError(new Error('unavailable')));
      return () => undefined;
    },
    markRead: () => Promise.reject(new Error('unavailable')),
  };
}
