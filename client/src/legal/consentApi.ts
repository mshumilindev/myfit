/**
 * Legal consent records, client side (SPO-296). Thin and typed, no UI.
 * Write: the `recordConsent` callable only (rules forbid direct writes). Read: the person's own
 * `users/{uid}/consentRecords`, live from Firestore's persistent cache (offline-first, deltas only; never blocks).
 */
import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { HttpError, callFn, currentUid, getRole } from '../api';
import { canUseCoach, type CoachRoleInput } from '../coach/access';
import { db } from '../firebase';
import { wasVerifiedClear } from './gateVerified';
import {
  currentVersion,
  isConsentKind,
  needsLegalGate,
  type ConsentAction,
  type ConsentKind,
  type ConsentRecord,
} from './consents';
import { trainerTermsMissing } from './trainerTerms';

export interface RecordConsentInput {
  kind: ConsentKind;
  /** Defaults to the current version of the kind's document. */
  version?: string;
  textHash?: string;
  categories?: string[];
  engines?: string[];
}

export interface ConsentWrite {
  id: string;
  at: number;
}

async function send(action: ConsentAction, input: RecordConsentInput): Promise<ConsentWrite> {
  try {
    // The callable SDK encodes `undefined` as `null`, which the server rejects (`bad-textHash`): send only the fields we have.
    const body = Object.fromEntries(
      Object.entries({
        ...input,
        action,
        version: input.version ?? currentVersion(input.kind),
      }).filter(([, v]) => v !== undefined && v !== null),
    );
    return await callFn<ConsentWrite>('recordConsent', body);
  } catch (e) {
    // The record is already there (a retried or concurrent identical write): that is success, not an error.
    if (e instanceof HttpError && e.status === 409) return { id: '', at: 0 };
    if (e instanceof HttpError && (e.status === 404 || e.status === 403)) {
      console.error(DEPLOY_HINT, `recordConsent -> ${e.status}`);
    }
    throw e;
  }
}

export function grantConsent(input: RecordConsentInput): Promise<ConsentWrite> {
  return send('grant', input);
}

export function withdrawConsent(input: RecordConsentInput): Promise<ConsentWrite> {
  return send('withdraw', input);
}

/** Maps a stored doc to a record; anything malformed is dropped rather than trusted. */
export function toConsentRecord(id: string, data: unknown): ConsentRecord | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isConsentKind(d.kind)) return null;
  if (d.action !== 'grant' && d.action !== 'withdraw') return null;
  if (typeof d.version !== 'string' || typeof d.at !== 'number') return null;
  const rec: ConsentRecord = { id, kind: d.kind, action: d.action, version: d.version, at: d.at };
  if (typeof d.textHash === 'string') rec.textHash = d.textHash;
  if (Array.isArray(d.categories))
    rec.categories = d.categories.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(d.engines))
    rec.engines = d.engines.filter((x): x is string => typeof x === 'string');
  return rec;
}

/** Shown in the console when the backend refuses the consent records: almost always a missing deploy, not the network. */
export const DEPLOY_HINT =
  'Consent records are not reachable: firestore.rules / functions with consentRecords not deployed? (firebase deploy --only firestore:rules,functions:recordConsent)';

/** Firestore error codes that mean "the backend does not know / allow consentRecords" (as opposed to a network problem). */
const DEPLOY_CODES = new Set([
  'permission-denied',
  'not-found',
  'unimplemented',
  'failed-precondition',
]);

/** The SDK's error code ("permission-denied", ...) when it has one; never a message (messages can carry paths). */
export function errorCode(err: Error | null): string | null {
  const c = (err as { code?: unknown } | null)?.code;
  return typeof c === 'string' && c ? c.replace(/^firestore\//, '') : null;
}

export interface SnapshotMeta {
  /** True when the snapshot came from the local cache only (the server has not confirmed it yet). */
  fromCache: boolean;
}

/**
 * Live subscription to the person's own records. Metadata changes are included so the server-confirmed snapshot is
 * delivered even when it equals the cached one. Errors surface through `onError`, never as a throw.
 */
export function subscribeConsentRecords(
  uid: string,
  onRecords: (records: ConsentRecord[], meta: SnapshotMeta) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'consentRecords'),
    { includeMetadataChanges: true },
    (snap) => {
      const out: ConsentRecord[] = [];
      for (const d of snap.docs) {
        const r = toConsentRecord(d.id, d.data());
        if (r) out.push(r);
      }
      onRecords(out, { fromCache: snap.metadata.fromCache });
    },
    (err) => {
      const code = errorCode(err);
      if (code && DEPLOY_CODES.has(code)) console.error(DEPLOY_HINT, code);
      onError(err);
    },
  );
}

export interface ConsentRecordsState {
  records: ConsentRecord[];
  /**
   * True until a snapshot we can trust arrives: from the server, or from the cache WITH data. An empty cache-only first
   * snapshot (cold start, offline) is not an answer. Callers must not block the app on it.
   */
  loading: boolean;
  /** True once the server has confirmed the records (not just the cache). */
  confirmed: boolean;
  error: Error | null;
}

export type ConsentRecordsHook = ConsentRecordsState & {
  /** Drops the failed / stuck listener and subscribes again (state goes back to "loading"). */
  retry: () => void;
};

const IDLE: ConsentRecordsState = { records: [], loading: false, confirmed: false, error: null };
const LOADING: ConsentRecordsState = { ...IDLE, loading: true };

/** Folds a snapshot into the state (pure, tested). */
export function applySnapshot(records: ConsentRecord[], meta: SnapshotMeta): ConsentRecordsState {
  const empty = records.length === 0;
  return {
    records,
    loading: meta.fromCache && empty,
    confirmed: !meta.fromCache,
    error: null,
  };
}

/** The signed-in person's consent records. Starts empty and not blocking; fills from the cache, then the server. */
export function useConsentRecords(enabled = true): ConsentRecordsHook {
  // `enabled` false: no listener at all (a member's screen that only needs the answer for trainers); reads as idle
  const uid = enabled ? currentUid() : null;
  // The state is keyed by uid: after an account switch, account B never reads account A's records, not even for one
  // render (it shows "loading" until B's own first snapshot).
  const [keyed, setKeyed] = useState<{ uid: string | null; state: ConsentRecordsState }>({
    uid,
    state: { ...IDLE, loading: !!uid },
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setKeyed((k) => ({ uid: k.uid, state: { ...IDLE, loading: !!k.uid } }));
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    if (!uid) return;
    return subscribeConsentRecords(
      uid,
      (records, meta) => setKeyed({ uid, state: applySnapshot(records, meta) }),
      (error) =>
        setKeyed((k) => ({
          uid,
          state: {
            ...(k.uid === uid ? k.state : LOADING),
            loading: false,
            confirmed: false,
            error,
          },
        })),
    );
  }, [uid, attempt]);
  const state = !uid ? IDLE : keyed.uid === uid ? keyed.state : LOADING;
  return { ...state, retry };
}

export type LegalGate = 'unknown' | 'unverified' | 'needed' | 'clear';

/** What the blocking gate still asks for: the Terms / Privacy Policy / 18+ part, the Trainer Terms + DPA part, or both. */
export interface GateNeeds {
  base: boolean;
  trainer: boolean;
}

/**
 * What the records lack. `trainer` only for a trainer, manager or admin (`role`, the real role source `getRole()`):
 * a member never needs the Trainer Terms + DPA. One drawer shows exactly what is missing (SPO-295, owner decision 22.10).
 */
export function gateNeedsOf(records: readonly ConsentRecord[], role: CoachRoleInput): GateNeeds {
  return { base: needsLegalGate(records), trainer: trainerTermsMissing(records, role) };
}

/**
 * The blocking legal gate for an existing user. `needed` only when the SERVER confirmed the records and a required
 * consent is missing, withdrawn or stale, or (trainer, manager, admin) the Trainer Terms + DPA are missing / stale.
 * `clear` as soon as the records we do have already satisfy the gate.
 * While loading, on error, or offline without server confirmation the answer is not known yet: `unknown` (fail open) when
 * this device holds an earlier server-confirmed "clear" for the current document versions (`cachedClear`), otherwise
 * `unverified` (cannot verify: the app waits for the server, with Sign out available). `cachedClear` defaults to true so
 * callers that only need the server-confirmed answer keep the old reading. `role` defaults to a member (no Trainer Terms).
 */
export function legalGateOf(
  s: ConsentRecordsState,
  cachedClear = true,
  role: CoachRoleInput = 'member',
): LegalGate {
  const needs = gateNeedsOf(s.records, role);
  if (!needs.base && !needs.trainer) return 'clear';
  if (s.loading || s.error || !s.confirmed) return cachedClear ? 'unknown' : 'unverified';
  return 'needed';
}

export function useLegalGate(): LegalGate {
  const uid = currentUid();
  const role = getRole();
  return legalGateOf(
    useConsentRecords(),
    uid ? wasVerifiedClear(uid, canUseCoach(role)) : true,
    role,
  );
}
