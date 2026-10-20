/**
 * Key rings of a TEAM MANAGER (SPO-196, ADR 005). A manager never holds a conversation key: the client device wraps the
 * `schedule` and `requests` sub-keys of the current epoch for the manager's signed public key into
 * `conversations/{cid}/delegations/{managerUid}`; this provider opens that document with the manager's own key pair.
 * The ring it returns serves ONLY those two purposes (`not-delegated` for the rest) and only the delegated epoch: a
 * document of any other epoch has no ring here and the adapters drop it, exactly as for a trainer without a key.
 *
 * `ManagerBook` is the manager's counterpart of the ring book: the clients of the team (the server lists them, rules
 * cannot) and, per client, the ring when its delegation exists. A client whose device has not delegated yet stays in
 * the list with `ring: null` ("Waiting for the client's app"); the delegation document is listened to, so the ring
 * appears the moment the client's device publishes it and disappears when it is removed.
 */
import type { Vault } from '../../../autoVault';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { isDelegation, openDelegation } from '../../../coachCrypto/delegation';
import { VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import type { CoachKeyRecord } from '../../../vaultShare';
import type { FsApi, Raw } from './fsApi';
import type { RingProvider } from './keyRing';
import type { BookEntry, RingBook } from './ringBook';

export interface ManagerRingDeps {
  fs: FsApi;
  vault: Vault;
  uid: string;
  /** the manager's own key pair record (private half sealed with the vault key) */
  loadOwnCoachKey: () => Promise<CoachKeyRecord | null>;
}

const delegationPath = (cid: string, uid: string) => `conversations/${cid}/delegations/${uid}`;

export function createManagerRings(d: ManagerRingDeps): RingProvider & {
  /** Open an already read delegation document (the book listens to it). */
  fromDelegation(cid: string, doc: Raw | null): Promise<ChatKeyRing | null>;
} {
  const cache = new Map<string, Promise<ChatKeyRing | null>>();

  async function open(cid: string, doc: Raw | null): Promise<ChatKeyRing | null> {
    if (!isDelegation(doc)) return null;
    const mark = `${cid}:${doc.epoch}:${doc.fp}:${doc.at}`;
    const hit = cache.get(mark);
    if (hit) return hit;
    const p = (async () => {
      const m = d.vault.materialOrNull();
      if (!m) throw new VaultLockedError();
      const rec = await d.loadOwnCoachKey();
      if (!rec) return null;
      try {
        return await openDelegation(doc, cid, rec, m.key);
      } catch {
        return null; // another key pair (rotated), another conversation, tampered: the client device re-wraps
      }
    })();
    cache.set(mark, p);
    p.then((r) => {
      if (!r) cache.delete(mark);
    }).catch(() => cache.delete(mark));
    return p;
  }

  return {
    fromDelegation: open,
    async forEpoch(cid, epoch) {
      const ring = await open(cid, await d.fs.get(delegationPath(cid, d.uid)));
      return ring && ring.epoch === epoch ? ring : null;
    },
    async current(cid) {
      const ring = await open(cid, await d.fs.get(delegationPath(cid, d.uid)));
      if (!ring) throw new Error('delegation-pending'); // "Waiting for the client's app"
      return ring;
    },
    async past() {
      return new Map();
    },
    forget() {
      cache.clear();
    },
  };
}

/** One client of the team as the server lists it (no content). */
export interface TeamClientRow {
  clientId: string;
  cid: string;
  trainerId: string;
  trainerName: string;
  name: string;
}

export interface ManagerClient extends TeamClientRow {
  /** the schedule of this client can be read and written (the client's device delegated the keys) */
  ready: boolean;
}

export interface ManagerBook extends RingBook {
  clients(): readonly ManagerClient[];
}

export function createManagerBook(d: {
  fs: FsApi;
  rings: ReturnType<typeof createManagerRings>;
  uid: string;
  /** re-read the client list this often (a trainer took a new client); default 5 minutes */
  everyMs?: number;
}): ManagerBook {
  const by = new Map<string, BookEntry & { row: TeamClientRow }>();
  const watchers = new Set<() => void>();
  const listens = new Map<string, () => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;
  let report: ((e: unknown) => void) | undefined;
  let firstDone: (() => void) | null = null;
  const first = new Promise<void>((res) => (firstDone = res));

  const tell = () => watchers.forEach((f) => f());

  async function setRing(clientId: string, doc: Raw | null) {
    const e = by.get(clientId);
    if (!e) return;
    const ring = await d.rings.fromDelegation(e.cid, doc).catch(() => null);
    if (stopped || by.get(clientId) !== e || e.ring === ring) return;
    e.ring = ring;
    tell();
  }

  async function load(): Promise<void> {
    const { clients } = await d.fs.call<{ clients: TeamClientRow[] }>('teamClients', {});
    if (stopped) return;
    const seen = new Set(clients.map((c) => c.clientId));
    for (const id of [...by.keys()]) {
      const cur = by.get(id)!;
      const now = clients.find((c) => c.clientId === id);
      if (seen.has(id) && now?.cid === cur.cid) continue;
      listens.get(id)?.();
      listens.delete(id);
      by.delete(id);
    }
    await Promise.all(
      clients.map(async (row) => {
        if (by.has(row.clientId)) return;
        const entry = {
          clientId: row.clientId,
          cid: row.cid,
          ring: null,
          past: new Map(),
          conv: { clientId: row.clientId, trainerId: row.trainerId } as Raw,
          row,
        } satisfies BookEntry & { row: TeamClientRow };
        by.set(row.clientId, entry);
        const doc = await d.fs.get(delegationPath(row.cid, d.uid)).catch(() => null);
        await setRing(row.clientId, doc);
        if (stopped || by.get(row.clientId) !== entry) return;
        listens.set(
          row.clientId,
          d.fs.listenDoc(
            delegationPath(row.cid, d.uid),
            (next) => void setRing(row.clientId, next),
            (e) => report?.(e),
          ),
        );
      }),
    );
    tell();
  }

  return {
    ringFor: (clientId) => by.get(clientId)?.ring ?? null,
    ringForEpoch(clientId, epoch) {
      const r = by.get(clientId)?.ring;
      return r && r.epoch === epoch ? r : null;
    },
    cidOf: (clientId) => by.get(clientId)?.cid ?? null,
    entries: () => [...by.values()],
    clients: () => [...by.values()].map((e) => ({ ...e.row, ready: !!e.ring })),
    ready: () => first,
    watch(f) {
      watchers.add(f);
      return () => void watchers.delete(f);
    },
    start(onError) {
      if (!stopped) return () => undefined;
      stopped = false;
      report = onError;
      void load()
        .catch((e) => onError?.(e))
        .finally(() => firstDone?.());
      timer = setInterval(() => void load().catch((e) => onError?.(e)), d.everyMs ?? 5 * 60_000);
      return () => {
        stopped = true;
        if (timer) clearInterval(timer);
        timer = null;
        listens.forEach((off) => off());
        listens.clear();
        by.clear();
      };
    },
    async refresh() {
      if (!stopped) await load();
    },
  };
}
