/**
 * Who is in which conversation, and the key ring of each one, for the adapters that must look a ring up
 * SYNCHRONOUSLY (notes and schedule: their sealed ports take `ringFor(clientId)`; the ring provider is async).
 *
 * The book listens to the user's conversations (trainer: `trainerId == uid && active == true`, the only list query the
 * rules allow; client: `clientId == uid`), maps client id -> cid and primes the ring of the CURRENT epoch of each one.
 * A key rotation, a re-link or a conversation that ends changes the snapshot and the book follows. A conversation that
 * is no longer active is reported through `onEnded` once (the caller wipes its local cache and keys).
 *
 * Nothing here writes. A ring that this device does not hold stays `null` (the adapters then drop the document or throw
 * `chat-key-missing`; they never fall back to plaintext).
 */
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import type { FsApi, FsRow, Raw } from './fsApi';
import type { RingProvider } from './keyRing';

export interface BookEntry {
  clientId: string;
  cid: string;
  ring: ChatKeyRing | null;
  /** rings of earlier epochs this device can open (history after a rotation); filled shortly after the current one */
  past: ReadonlyMap<number, ChatKeyRing>;
  /** conversation document (open fields only) */
  conv: Raw;
}

export interface RingBook {
  /** The ring to read or write this client's sealed documents with, or null (not primed / not held). */
  ringFor(clientId: string): ChatKeyRing | null;
  /** The ring that opens documents of this epoch (the current one or a past one); null when this device holds none. */
  ringForEpoch(clientId: string, epoch: number): ChatKeyRing | null;
  cidOf(clientId: string): string | null;
  /** Active entries as last seen. */
  entries(): readonly BookEntry[];
  /** Resolves when the first conversation snapshot has been processed and its rings primed (or failed). */
  ready(): Promise<void>;
  /** Called after every change of the set of conversations or of a ring. Returns the unsubscribe. */
  watch(f: () => void): () => void;
  /** Start listening (idempotent). Returns the stop function. */
  start(onError?: (e: unknown) => void): () => void;
  /** Re-resolve the rings of the last snapshot (after the client device published a key). */
  refresh(): Promise<void>;
}

export interface RingBookDeps {
  fs: FsApi;
  rings: RingProvider;
  uid: string;
  side: 'client' | 'trainer';
  /** A conversation went from active to inactive (or disappeared): the relationship ended. */
  onEnded?: (cid: string, clientId: string) => void;
}

export function createRingBook(d: RingBookDeps): RingBook {
  const by = new Map<string, BookEntry>();
  const known = new Map<string, string>(); // cid -> clientId, for ended detection
  const watchers = new Set<() => void>();
  let stop: (() => void) | null = null;
  let firstDone: (() => void) | null = null;
  const first = new Promise<void>((res) => (firstDone = res));
  let seq = 0;
  let lastRows: FsRow[] = [];
  let report: ((e: unknown) => void) | undefined;
  const ensuring = new Set<string>();
  const attempts = new Map<string, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /** A refused key (the trainer's new key is published but not signed yet, offline) is tried again a few times. */
  const RETRY_MS = [300, 1500, 6000, 20000];
  const tried = new Map<string, string>(); // cid -> snapshot signature the last attempt failed on

  const epochOf = (c: Raw): number => {
    const ck = c.ck as { epoch?: unknown } | undefined;
    return typeof ck?.epoch === 'number' ? ck.epoch : Number(c.keyEpoch ?? 0);
  };

  /**
   * CLIENT: an active conversation of mine without a published key gets one NOW (idempotent: `current` reuses a key
   * this device already made, and a second run for the same cid waits for the first). The trainer can then chat,
   * load the program, save a schedule or add a shared note before the client ever writes. A failure (vault locked,
   * trainer key not published/signed yet, offline) is retried on the next snapshot, never in a loop.
   */
  function ensureKeys(rows: FsRow[]): void {
    for (const r of rows) {
      // no key yet, or the server says the trainer's key changed (`keyStale`): this device wraps it for the current key
      if (r.data.active !== true || r.data.clientId !== d.uid) continue;
      if (r.data.ck && r.data.keyStale !== true) continue;
      const sig = `${String(r.data.keyEpoch ?? 0)}:${String(r.data.updatedAt ?? '')}:${String(r.data.keyStale ?? '')}`;
      if (ensuring.has(r.id) || tried.get(r.id) === sig) continue;
      ensuring.add(r.id);
      void d.rings
        .current(r.id)
        .then(() => {
          attempts.delete(r.id);
          tried.set(r.id, sig); // not again for this very snapshot (the server clears the flag on the next one)
          return apply(lastRows);
        })
        .catch((e) => {
          tried.set(r.id, sig);
          report?.(e);
          const n = attempts.get(r.id) ?? 0;
          if (n < RETRY_MS.length && stop) {
            attempts.set(r.id, n + 1);
            const t = setTimeout(() => {
              timers.delete(t);
              tried.delete(r.id);
              ensureKeys(lastRows);
            }, RETRY_MS[n]);
            timers.add(t);
          }
        })
        .finally(() => ensuring.delete(r.id));
    }
  }

  async function apply(rows: FsRow[]): Promise<void> {
    const mine = ++seq;
    const next = new Map<string, BookEntry>();
    await Promise.all(
      rows.map(async (r) => {
        const clientId = String(r.data.clientId ?? '');
        if (!clientId || r.data.active !== true) return;
        let ring: ChatKeyRing | null = null;
        if (r.data.ck && epochOf(r.data) > 0)
          ring = await d.rings.forEpoch(r.id, epochOf(r.data)).catch(() => null);
        // keep the past rings already resolved for this conversation and epoch while the new snapshot loads them
        const prev = by.get(clientId);
        const keep =
          prev && prev.cid === r.id && prev.ring?.epoch === ring?.epoch ? prev.past : new Map();
        next.set(clientId, { clientId, cid: r.id, ring, past: keep, conv: r.data });
      }),
    );
    if (mine !== seq) return; // a newer snapshot overtook this one
    if (d.side === 'client') ensureKeys(rows);
    for (const [cid, clientId] of [...known]) {
      if (![...next.values()].some((e) => e.cid === cid)) {
        known.delete(cid);
        d.onEnded?.(cid, clientId);
      }
    }
    for (const e of next.values()) known.set(e.cid, e.clientId);
    by.clear();
    next.forEach((v, k) => by.set(k, v));
    firstDone?.();
    watchers.forEach((f) => f());
    // history of earlier epochs: never blocks the first paint; watchers run again when it arrived
    for (const e of next.values()) {
      const cur = e.ring?.epoch ?? 0;
      if (cur <= 1) continue;
      void d.rings
        .past(e.cid, cur)
        .then((m) => {
          if (mine !== seq || by.get(e.clientId) !== e) return;
          if (m.size === e.past.size && [...m.keys()].every((k) => e.past.has(k))) return;
          e.past = m;
          watchers.forEach((f) => f());
        })
        .catch(() => undefined);
    }
  }

  const where =
    d.side === 'trainer'
      ? ([
          ['trainerId', '==', d.uid],
          ['active', '==', true],
        ] as const)
      : ([['clientId', '==', d.uid]] as const);

  return {
    ringFor: (clientId) => by.get(clientId)?.ring ?? null,
    ringForEpoch(clientId, epoch) {
      const e = by.get(clientId);
      if (!e) return null;
      if (e.ring?.epoch === epoch) return e.ring;
      return e.past.get(epoch) ?? null;
    },
    cidOf: (clientId) => by.get(clientId)?.cid ?? null,
    entries: () => [...by.values()],
    ready: () => first,
    watch(f) {
      watchers.add(f);
      return () => void watchers.delete(f);
    },
    start(onError) {
      if (stop) return stop;
      report = onError;
      const off = d.fs.listen(
        'conversations',
        { where },
        (rows) => {
          lastRows = rows;
          void apply(rows).catch((e) => onError?.(e));
        },
        (e) => onError?.(e),
      );
      stop = () => {
        off();
        stop = null;
        seq++;
        timers.forEach(clearTimeout);
        timers.clear();
      };
      return stop;
    },
    async refresh() {
      tried.clear(); // the caller says something changed (vault unlocked, key published): try again
      if (lastRows.length) await apply(lastRows);
    },
  };
}
