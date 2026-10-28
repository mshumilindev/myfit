/**
 * Server backstop for the kept Atlas chat copy (SPO-392). When a person withdraws the `atlas-history` consent and chooses
 * "keep for now", the client marks `withdrawnAt` inside the sealed `users/{uid}/meta/atlasChatState` and deletes the copy
 * itself after RETENTION_DAYS the next time the app opens. This job does the same for people who never open the app again.
 *
 * The state is sealed with the account's data key (AES-GCM, the envelope of `client/src/vaultCrypto.ts`); the server derives
 * that key from VAULT_MASTER (`vault.ts`), so it can read exactly this one small document. It reads nothing else of the chat:
 * the messages are only deleted, never opened. Pure: all I/O is in `AtlasRetentionPorts`.
 */
import { createDecipheriv } from 'node:crypto';

/** MUST equal RETENTION_DAYS in `client/src/atlas/chatSyncCore.ts` (`tests/coach-server/atlasChatRetention.test.ts` checks). */
export const RETENTION_DAYS = 30;

export interface Envelope {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

export const isEnvelope = (x: unknown): x is Envelope => {
  const e = x as Partial<Envelope> | null;
  return (
    !!e &&
    e.v === 1 &&
    typeof e.salt === 'string' &&
    typeof e.iv === 'string' &&
    typeof e.ct === 'string'
  );
};

/** Opens a WebCrypto AES-GCM envelope (ciphertext followed by the 16-byte tag) with a raw 32-byte key (base64). Throws on a wrong key. */
export function openEnvelope(env: Envelope, keyB64: string): unknown {
  const key = Buffer.from(keyB64, 'base64');
  const ct = Buffer.from(env.ct, 'base64');
  if (key.length !== 32 || ct.length < 16) throw new Error('bad-envelope');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return JSON.parse(pt.toString('utf8'));
}

/** The moment of withdrawal inside an opened state, or null (not withdrawn / not a number / not in the past of `now`). */
export function withdrawnAtOf(state: unknown): number | null {
  const v = (state as { withdrawnAt?: unknown } | null)?.withdrawnAt;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Due when the whole period is over; a stamp from the future (a wrong clock) is never due. */
export const retentionExpired = (withdrawnAt: number, now: number): boolean =>
  now - withdrawnAt >= RETENTION_DAYS * 86_400_000;

export interface ConsentMark {
  action: string;
  at: number;
}

export interface AtlasRetentionPorts {
  /** every account id (ids only) */
  userIds(): Promise<string[]>;
  /** the raw `meta/atlasChatState` of each account that has one (missing ones are absent from the map) */
  readStates(uids: string[]): Promise<Map<string, Record<string, unknown>>>;
  /** the newest `atlas-history` consent record of the account, or null */
  latestConsent(uid: string): Promise<ConsentMark | null>;
  /** opens the envelope with this account's key; throws when the key does not fit */
  open(uid: string, env: Envelope): Promise<unknown>;
  /** deletes every `atlasChat` message and the state document of the account */
  deleteChat(uid: string): Promise<void>;
}

export interface RetentionResult {
  checked: number;
  deleted: number;
  failed: number;
}

const CHUNK = 200;

/**
 * Deletes the kept copy of every account whose period is over AND whose newest `atlas-history` record is still a withdrawal
 * (a person who turned the consent on again on another device, offline, is never deleted by a stale mark). One account's
 * failure never stops the others. `limit` bounds the deletions of one run.
 */
export async function sweepAtlasChat(
  ports: AtlasRetentionPorts,
  now: number,
  limit = 200,
): Promise<RetentionResult> {
  const res: RetentionResult = { checked: 0, deleted: 0, failed: 0 };
  const ids = await ports.userIds();
  for (let i = 0; i < ids.length && res.deleted < limit; i += CHUNK) {
    const states = await ports.readStates(ids.slice(i, i + CHUNK));
    for (const [uid, raw] of states) {
      if (res.deleted >= limit) break;
      res.checked++;
      try {
        if (!isEnvelope(raw.enc)) continue;
        const at = withdrawnAtOf(await ports.open(uid, raw.enc));
        if (at === null || !retentionExpired(at, now)) continue;
        const last = await ports.latestConsent(uid);
        if (!last || last.action !== 'withdraw') continue;
        await ports.deleteChat(uid);
        res.deleted++;
      } catch {
        res.failed++; // no uid and no content in logs
      }
    }
  }
  return res;
}
