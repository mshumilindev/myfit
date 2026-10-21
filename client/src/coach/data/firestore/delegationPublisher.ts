/**
 * CLIENT device: keeps the key delegations of one conversation in line with the managers of the trainer's team
 * (SPO-196, ADR 005). For every ACTIVE manager whose SIGNED key it can verify it publishes
 * `conversations/{cid}/delegations/{managerUid}` (the `schedule` and `requests` sub-keys of the CURRENT epoch, wrapped
 * for that manager's key); for everybody who is no longer a manager it deletes the document. Idempotent: a document
 * that already carries this epoch and this key fingerprint is left alone. The trainer cannot do this (their keys are
 * non-extractable); only this device holds the raw conversation key, and it never leaves it.
 *
 * A manager who has not opened the app yet (no signed key) is reported as `pending`: the state "Waiting for client's app"
 * on the manager's side is the mirror image of "Waiting for the manager's app" here. Nothing is ever written in plain.
 */
import { createDelegation, isDelegation } from '../../../coachCrypto/delegation';
import { isChatWrap } from '../../../coachCrypto/conversationKey';
import { fingerprint } from '../../../vaultGrants';
import type { FsApi, Raw } from './fsApi';
import type { RingProvider } from './keyRing';
import type { RingBook } from './ringBook';
import { trustedCoachPub, type ServerSigning } from './trust';

export interface DelegationDeps {
  fs: FsApi;
  uid: string;
  rings: RingProvider;
  signing: () => Promise<ServerSigning | null>;
}

export interface DelegationResult {
  /** managers that hold a delegation of the current epoch after this run */
  ready: string[];
  /** managers whose signed key is not there yet (they have not opened the app) */
  pending: string[];
  /** documents removed (managers who left the team) */
  removed: string[];
}

export interface DelegationPublisher {
  sync(cid: string): Promise<DelegationResult>;
}

const path = (cid: string, uid: string) => `conversations/${cid}/delegations/${uid}`;

export function createDelegationPublisher(d: DelegationDeps): DelegationPublisher {
  async function sync(cid: string): Promise<DelegationResult> {
    const out: DelegationResult = { ready: [], pending: [], removed: [] };
    const conv = await d.fs.get(`conversations/${cid}`);
    if (!conv || conv.clientId !== d.uid || conv.active !== true || !isChatWrap(conv.ck))
      return out;
    const epoch = Number(conv.keyEpoch ?? 0);
    if (!Number.isInteger(epoch) || epoch < 1) return out;

    const { managers } = await d.fs.call<{ managers: string[] }>('teamManagersForClient', {});
    const want = new Set(managers);
    const have = new Map(
      (await d.fs.getDocs(`conversations/${cid}/delegations`, {})).map((r) => [r.id, r.data]),
    );

    for (const id of have.keys()) {
      if (want.has(id)) continue;
      await d.fs.del(path(cid, id));
      out.removed.push(id);
    }
    const signing = await d.signing();
    for (const uid of managers) {
      const pub = await trustedCoachPub(await d.fs.get(`coachKeys/${uid}`), uid, signing);
      if (!pub) {
        out.pending.push(uid);
        continue;
      }
      const fp = await fingerprint(pub);
      const cur = have.get(uid);
      if (cur && isDelegation(cur) && cur.epoch === epoch && cur.fp === fp) {
        out.ready.push(uid);
        continue;
      }
      const at = d.fs.now();
      const doc = await d.rings.withRawKey?.(cid, epoch, (raw) =>
        createDelegation(raw, cid, epoch, pub, at),
      );
      if (!doc) {
        out.pending.push(uid); // this device does not hold the key of the published epoch
        continue;
      }
      await d.fs.set(path(cid, uid), doc as unknown as Raw);
      out.ready.push(uid);
    }
    return out;
  }

  /** one run per conversation at a time (the book fires on every snapshot) */
  const running = new Map<string, Promise<DelegationResult>>();
  return {
    sync(cid) {
      const r = running.get(cid);
      if (r) return r;
      const p = sync(cid).finally(() => running.delete(cid));
      running.set(cid, p);
      return p;
    },
  };
}

/**
 * Runs the publisher for every active conversation this device holds a ring for: when the book changes (a new epoch, a
 * new conversation) and then every `everyMs` (a manager joined or left the team, a manager opened the app and
 * published a key). A snapshot burst (every chat message touches the conversation) does not call the server again
 * within `minGapMs` unless the epoch moved. Errors are swallowed: the next run tries again.
 */
export function keepDelegated(
  book: Pick<RingBook, 'entries' | 'watch'>,
  pub: DelegationPublisher,
  o: { everyMs?: number; minGapMs?: number; now?: () => number } = {},
): () => void {
  const every = o.everyMs ?? 10 * 60_000;
  const gap = o.minGapMs ?? 60_000;
  const now = o.now ?? Date.now;
  const last = new Map<string, { at: number; epoch: number }>();
  const run = (force: boolean) => {
    for (const e of book.entries()) {
      if (!e.ring) continue;
      const prev = last.get(e.cid);
      if (!force && prev && prev.epoch === e.ring.epoch && now() - prev.at < gap) continue;
      last.set(e.cid, { at: now(), epoch: e.ring.epoch });
      void pub.sync(e.cid).catch(() => last.delete(e.cid));
    }
  };
  const off = book.watch(() => run(false));
  const timer = setInterval(() => run(true), every);
  // The server's silent `sync` push (a manager joined the team): the service worker hands it to the open page.
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  const onMessage = (e: Event) => {
    const data = (e as MessageEvent).data as { type?: unknown } | null;
    if (data && data.type === 'coach-sync') run(true);
  };
  sw?.addEventListener?.('message', onMessage);
  run(false);
  return () => {
    off();
    clearInterval(timer);
    sw?.removeEventListener?.('message', onMessage);
  };
}
