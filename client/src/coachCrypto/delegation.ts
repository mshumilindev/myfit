/**
 * Key delegation to a team manager (SPO-196, ADR 005).
 *
 * A manager may read and write the schedule and the requests of a client, nothing else. The CLIENT device (the only
 * holder of the raw CK; the trainer's keys are non-extractable) derives exactly the `schedule` and `requests` sub-keys
 * and wraps each for the manager's SIGNED public key. The root and the `chat | notes | plan | live` sub-keys never
 * leave the client's devices, so a manager cannot read them however the rules are bent.
 *
 * Every wrap is AAD-bound to `deleg|1|cid|epoch|purpose|managerFp`: it cannot be moved to another conversation, epoch,
 * purpose or manager key. The manager checks the fingerprint on open and refuses a wrap made for a different key.
 */
import { fingerprint } from '../vaultGrants';
import { createWrap, openWrap, type CoachKeyRecord, type Wrap } from '../vaultShare';
import { subKeyBytes, type ChatKeyRing, type Purpose } from './conversationKey';

export const DELEGATED_PURPOSES = ['schedule', 'requests'] as const satisfies readonly Purpose[];
export type DelegatedPurpose = (typeof DELEGATED_PURPOSES)[number];

/** What is stored at conversations/{cid}/delegations/{managerUid}. */
export interface Delegation {
  epoch: number;
  /** Fingerprint of the manager public key the wraps were made for. */
  fp: string;
  schedule: Wrap;
  requests: Wrap;
  at: number;
}

const enc = (s: string) => new TextEncoder().encode(s);
const INFO = 'spotter.delegation.v1';
const aad = (cid: string, epoch: number, purpose: DelegatedPurpose, fp: string) =>
  enc(`deleg|1|${cid}|${epoch}|${purpose}|${fp}`);

/** Client: wrap the schedule and requests sub-keys of CK `raw` for a manager. Does NOT zero `raw` (caller owns it). */
export async function createDelegation(
  raw: Uint8Array,
  cid: string,
  epoch: number,
  managerPub: JsonWebKey,
  at: number,
): Promise<Delegation> {
  const fp = await fingerprint(managerPub);
  const out = {} as Record<DelegatedPurpose, Wrap>;
  for (const p of DELEGATED_PURPOSES) {
    const bytes = await subKeyBytes(raw, p, cid, epoch);
    try {
      out[p] = await createWrap(bytes, managerPub, { info: INFO, aad: aad(cid, epoch, p, fp) });
    } finally {
      bytes.fill(0);
    }
  }
  return { epoch, fp, schedule: out.schedule, requests: out.requests, at };
}

const isWrap = (w: unknown): w is Wrap => {
  const x = w as Partial<Wrap> | null;
  return !!x && x.v === 1 && typeof x.iv === 'string' && typeof x.ct === 'string' && !!x.epk;
};

export function isDelegation(x: unknown): x is Delegation {
  const d = x as Partial<Delegation> | null;
  return (
    !!d &&
    typeof d.epoch === 'number' &&
    typeof d.fp === 'string' &&
    typeof d.at === 'number' &&
    isWrap(d.schedule) &&
    isWrap(d.requests)
  );
}

/**
 * Manager: open a delegation into a ring that serves ONLY `schedule` and `requests` (any other purpose rejects with
 * `not-delegated`). Refuses a wrap for a different manager key (fingerprint), another conversation, epoch or purpose
 * (AAD), or a tampered one.
 */
export async function openDelegation(
  d: Delegation,
  cid: string,
  manager: CoachKeyRecord,
  ownKey: CryptoKey,
): Promise<ChatKeyRing> {
  if (!isDelegation(d)) throw new Error('bad-delegation');
  if ((await fingerprint(manager.pub)) !== d.fp) throw new Error('fingerprint-mismatch');
  const keys = {} as Record<DelegatedPurpose, CryptoKey>;
  for (const p of DELEGATED_PURPOSES) {
    keys[p] = await openWrap(d[p], manager, ownKey, ['encrypt', 'decrypt'], {
      info: INFO,
      aad: aad(cid, d.epoch, p, d.fp),
    });
  }
  return {
    cid,
    epoch: d.epoch,
    key(purpose) {
      const k = (keys as Partial<Record<Purpose, CryptoKey>>)[purpose];
      return k ? Promise.resolve(k) : Promise.reject(new Error('not-delegated'));
    },
  };
}
