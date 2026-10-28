/**
 * Daily job: deletes the kept Atlas chat copy 30 days after a withdrawal (SPO-392; logic and rules in
 * `atlasChatRetentionCore.ts`). Cost: one document read per account per day (`meta/atlasChatState`, missing ones included);
 * if the account count grows into the tens of thousands, an open `withdrawnAt` field on the state would let a query replace
 * the scan (needs a rules change, so not done now).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './lib';
import { VAULT_KV, VAULT_MASTER, MAX_KEY_VERSION, vaultKeyFor } from './vault';
import {
  isEnvelope,
  openEnvelope,
  sweepAtlasChat,
  type AtlasRetentionPorts,
  type Envelope,
} from './atlasChatRetentionCore';

const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Opens with the key version whose salt matches the envelope (newest first), so a rotated key still opens old state. */
export function openWithMaster(
  master: string,
  current: number,
  uid: string,
  env: Envelope,
): unknown {
  const top = Math.min(Math.max(Math.floor(current) || 1, 1), MAX_KEY_VERSION);
  for (let kv = top; kv >= 1; kv--) {
    const { key, salt } = vaultKeyFor(master, uid, kv);
    if (salt === env.salt) return openEnvelope(env, key);
  }
  throw new Error('no-key-for-salt');
}

export function firestoreRetentionPorts(
  master: string,
  current: number,
  now: number,
): AtlasRetentionPorts {
  return {
    async userIds() {
      return (await db.collection('users').listDocuments()).map((r) => r.id);
    },
    async readStates(uids) {
      const out = new Map<string, Record<string, unknown>>();
      const refs = uids.map((u) => db.doc(`users/${u}/meta/atlasChatState`));
      if (!refs.length) return out;
      const snaps = await db.getAll(...refs);
      snaps.forEach((s, i) => {
        if (s.exists) out.set(uids[i], s.data() as Record<string, unknown>);
      });
      return out;
    },
    async latestConsent(uid) {
      const q = await db
        .collection(`users/${uid}/consentRecords`)
        .where('kind', '==', 'atlas-history')
        .get();
      let best: { action: string; at: number } | null = null;
      for (const d of q.docs) {
        const x = d.data() as { action?: unknown; at?: unknown };
        if (typeof x.at !== 'number' || typeof x.action !== 'string') continue;
        if (!best || x.at > best.at) best = { action: x.action, at: x.at };
      }
      return best;
    },
    async open(uid, env) {
      if (!isEnvelope(env)) throw new Error('bad-envelope');
      const opened = openWithMaster(master, current, uid, env);
      // The key-access log shows the person that the server used their key, like a key fetch does (vault.ts).
      const id = `${dayOf(now)}-retention`;
      await db
        .doc(`users/${uid}/keyLog/${id}`)
        .set({ id, by: 'atlas-retention', at: now, lastAt: now }, { merge: true });
      return opened;
    },
    async deleteChat(uid) {
      await db.recursiveDelete(db.collection(`users/${uid}/atlasChat`));
      await db.doc(`users/${uid}/meta/atlasChatState`).delete();
    },
  };
}

export const sweepAtlasChatRetention = onSchedule(
  { schedule: 'every 24 hours', secrets: [VAULT_MASTER] },
  async () => {
    const now = Date.now();
    try {
      const r = await sweepAtlasChat(
        firestoreRetentionPorts(VAULT_MASTER.value(), Number(VAULT_KV.value()), now),
        now,
      );
      console.log(
        `[maintenance] atlas chat retention checked=${r.checked} deleted=${r.deleted} failed=${r.failed}`,
      );
    } catch (e) {
      console.error(
        '[maintenance] atlas chat retention failed',
        e instanceof Error ? e.name : 'error',
      );
    }
  },
);
