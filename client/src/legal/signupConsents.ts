/**
 * Recording the three required consents at registration (SPO-295 N3): `terms`, `policy-ack`, `age-18`.
 * Written to a small local queue FIRST, then sent: an offline or failed call never blocks sign-up and never drops a
 * consent; the queue is flushed again when the connection returns and on the next app start (`usePendingConsentFlush`).
 * The queue holds only kinds, versions and text hashes (no personal data), bound to the account's uid. Because of that
 * it is a DEVICE-level key (`accounts/scopedStorage` DEVICE_KEYS): sign-out and the device wipe keep it, so a withdrawal
 * that could not be sent before sign-out is still sent at that account's next sign-in. It is pruned for an account
 * that was deleted (`pruneConsentsOf`).
 */
import { clearGateDraft } from './gateDraft';
import { useEffect } from 'react';
import { currentUid } from '../api';
import { legalTexts } from '../i18n/legal';
import type { LocaleId } from '../i18n';
import { currentVersion, type ConsentAction, type ConsentKind, type LegalCtx } from './consents';
import { grantConsent, withdrawConsent } from './consentApi';
import { clearVerified } from './gateVerified';
import { clearLocalOff, forgetLocalOff } from './localOff';
import { docPlainText, sha256Hex } from './textHash';
import { trainerTermsHashInput } from './trainerTerms';
import { pruneRevokesOf } from '../coach/client/revokeQueue';

export interface QueuedConsent {
  kind: ConsentKind;
  /** Absent = a grant (items queued before withdrawals existed). A withdrawal is sent in order with the grants. */
  action?: ConsentAction;
  /** Set when queued: tells one entry from an identical one, so the right entry leaves after it is sent. */
  qid?: string;
  version: string;
  textHash?: string;
  /** Optional consents only (the gate's choices): what the consent covered. Never personal data. */
  categories?: string[];
  engines?: string[];
  /** Withdrawals only: how many passes the server answered 403/404 (see `WITHDRAW_REFUSAL_LIMIT`). */
  refused?: number;
}
interface Queue {
  uid: string;
  items: QueuedConsent[];
}

export const CONSENT_QUEUE_KEY = 'spotter.consentQueue';

function load(): Queue[] {
  try {
    const raw = localStorage.getItem(CONSENT_QUEUE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as Queue[]) : [];
  } catch {
    return [];
  }
}
function save(q: Queue[]): void {
  try {
    if (q.length) localStorage.setItem(CONSENT_QUEUE_KEY, JSON.stringify(q));
    else localStorage.removeItem(CONSENT_QUEUE_KEY);
  } catch {
    /* storage unavailable: the in-memory attempt in flushPendingConsents still runs */
  }
}

async function hashOrUndefined(text: string): Promise<string | undefined> {
  try {
    return await sha256Hex(text);
  } catch {
    return undefined; // no WebCrypto: the server refuses the grant (400) and it is dropped, so the gate asks again, visibly
  }
}

/** What was shown: the version of each kind, and the hash of the document text in the shown language. */
export async function buildSignupGrants(locale: LocaleId): Promise<QueuedConsent[]> {
  const lg = legalTexts(locale);
  const [terms, policy] = await Promise.all([
    hashOrUndefined(docPlainText(lg.terms)),
    hashOrUndefined(docPlainText(lg.privacy)),
  ]);
  return [
    { kind: 'terms', version: currentVersion('terms'), textHash: terms },
    { kind: 'policy-ack', version: currentVersion('policy-ack'), textHash: policy },
    { kind: 'age-18', version: currentVersion('age-18') },
  ];
}

/** One document's grant at `version` (a policy update, N8): the version shown and the hash of its text in `locale`. */
export async function buildUpdateGrant(
  kind: 'terms' | 'policy-ack',
  version: string,
  locale: LocaleId,
): Promise<QueuedConsent> {
  const lg = legalTexts(locale);
  const doc = kind === 'terms' ? lg.terms : lg.privacy;
  return { kind, version, textHash: await hashOrUndefined(docPlainText(doc)) };
}

/** The Trainer Terms + DPA acceptance (SPO-289): the current version and the hash of both documents as shown in `locale`. */
export async function buildTrainerTermsGrant(locale: LocaleId): Promise<QueuedConsent> {
  return {
    kind: 'trainer-terms',
    version: currentVersion('trainer-terms'),
    textHash: await hashOrUndefined(trainerTermsHashInput(locale)),
  };
}

/**
 * The kinds whose GRANT is still waiting to be sent for this account (a consent given moments ago may not be on the
 * server yet). Only grants of the CURRENT version count: a queued older version can never be accepted by the server, so
 * it must not hide the gate.
 */
export function pendingConsentKinds(uid: string, versions?: LegalCtx['versions']): ConsentKind[] {
  return (load().find((x) => x.uid === uid)?.items ?? [])
    .filter(
      (i) => (i.action ?? 'grant') === 'grant' && i.version === currentVersion(i.kind, versions),
    )
    .map((i) => i.kind);
}

let qidSeq = 0;

/** Appends to the persisted queue (order is kept) and returns the stored items. */
export function enqueueConsents(uid: string, items: readonly QueuedConsent[]): QueuedConsent[] {
  const stored = items.map((i) => ({
    ...i,
    qid: i.qid ?? `${Date.now().toString(36)}-${(qidSeq++).toString(36)}`,
  }));
  const q = load();
  const own = q.find((x) => x.uid === uid);
  if (own) own.items.push(...stored);
  else q.push({ uid, items: [...stored] });
  save(q);
  return stored;
}

/** The server refused this for good (a malformed, stale or unknown request): retrying can never succeed. */
function refusedForGood(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status !== 'number' || status < 400 || status >= 500) return false;
  // 409 is "already recorded" (success, handled by the caller); 429 and 408 are "later"; 401 is a token not ready yet.
  return ![401, 408, 409, 429].includes(status);
}

const isItem = (a: QueuedConsent, b: QueuedConsent): boolean =>
  a.qid && b.qid
    ? a.qid === b.qid
    : a.kind === b.kind &&
      (a.action ?? 'grant') === (b.action ?? 'grant') &&
      a.version === b.version &&
      a.textHash === b.textHash;

function removeItem(uid: string, item: QueuedConsent): void {
  const q = load();
  const own = q.find((x) => x.uid === uid);
  if (!own) return;
  const i = own.items.findIndex((x) => isItem(x, item));
  if (i >= 0) own.items.splice(i, 1);
  save(q.filter((x) => x.items.length));
}

/**
 * `sendConsentDurably` callers waiting for an answer (qid -> delivered?). Only those are tracked, and each entry is
 * deleted by its caller, so nothing accumulates for items queued by other paths.
 */
const watched = new Map<string, boolean>();

/**
 * A withdrawal answered 403/404 is retried this many passes before it is dropped. 403/404 can be a token or account
 * state that is not ready yet (not "malformed"), and a dropped withdrawal is a consent record that never reaches the
 * server, so it gets some more tries; after that it is dropped like any permanent refusal. The local-off flag is
 * kept either way (the feature stays off on this device).
 */
export const WITHDRAW_REFUSAL_LIMIT = 5;

/** Counts one more 403/404 for a queued withdrawal; true while it should still be retried. */
function noteRefusal(uid: string, item: QueuedConsent): boolean {
  const q = load();
  const stored = q.find((x) => x.uid === uid)?.items.find((x) => isItem(x, item));
  if (!stored) return false;
  stored.refused = (stored.refused ?? 0) + 1;
  save(q);
  return stored.refused < WITHDRAW_REFUSAL_LIMIT;
}

async function pass(uid: string): Promise<void> {
  const failedKinds = new Set<ConsentKind>(); // later items of a kind that failed wait: the order of a kind is kept
  for (const item of [...(load().find((x) => x.uid === uid)?.items ?? [])]) {
    if (currentUid() !== uid) return; // the account changed mid-pass: the rest is not this account's to send
    if (failedKinds.has(item.kind)) continue;
    const withdraw = item.action === 'withdraw';
    try {
      const input = {
        kind: item.kind,
        version: item.version,
        textHash: item.textHash,
        ...(item.categories && { categories: item.categories }),
        ...(item.engines && { engines: item.engines }),
      };
      await (withdraw ? withdrawConsent(input) : grantConsent(input));
    } catch (e) {
      const status = (e as { status?: unknown } | null)?.status;
      if (status !== 409) {
        if (withdraw && (status === 403 || status === 404) && noteRefusal(uid, item))
          failedKinds.add(item.kind); // maybe not ready yet: retried on the next passes, up to the limit
        else if (refusedForGood(e)) {
          if (item.qid) droppedQids.add(item.qid);
          removeItem(uid, item);
          dropListeners.forEach((cb) => cb(uid, item.kind)); // never succeeds: drop it, never block the gate forever
        } else failedKinds.add(item.kind); // offline or busy: keep it
        continue;
      }
    }
    if (item.qid && watched.has(item.qid)) watched.set(item.qid, true);
    removeItem(uid, item);
    if (withdraw) clearLocalOff(uid, item.kind); // the record exists now: the local flag has done its job
  }
}

/** One flush runner per account: an account switch must not swallow (or be swallowed by) the other account's flush. */
const runners = new Map<string, { running: Promise<void>; again: boolean }>();
/** qids of items the server refused for good and that were dropped from the queue (read by `recordGateConsents`). */
const droppedQids = new Set<string>();
type DropListener = (uid: string, kind: ConsentKind) => void;
const dropListeners = new Set<DropListener>();
/** Tells when a queued consent was permanently refused and dropped (the legal gate asks again and says so). */
export function onConsentDropped(cb: DropListener): () => void {
  dropListeners.add(cb);
  return () => void dropListeners.delete(cb);
}

/**
 * Sends the signed-in person's queued consents and withdrawals in order. Each success leaves the queue (409 counts as
 * success), a transient failure (offline, 5xx, 429) stays for the next try, a permanent refusal (any other 4xx) is dropped;
 * a withdrawal refused with 403/404 is tried `WITHDRAW_REFUSAL_LIMIT` times first. A pass stops if the signed-in account changes.
 * Callers that arrive while a pass runs wait for it and for one more pass.
 */
export function flushPendingConsents(): Promise<void> {
  const uid = currentUid();
  if (!uid) return Promise.resolve();
  const own = runners.get(uid);
  if (own) {
    own.again = true; // something was queued while a pass runs: run once more afterwards
    return own.running;
  }
  const entry = { running: Promise.resolve(), again: false };
  entry.running = (async () => {
    try {
      do {
        entry.again = false;
        await pass(uid);
      } while (entry.again);
    } finally {
      runners.delete(uid);
    }
  })();
  runners.set(uid, entry);
  return entry.running;
}

/**
 * Queues one item, sends it, and says whether the server has it (a 409 counts). False = it stays queued (offline) or was
 * refused for good. Used for withdrawals: they survive a reload offline like a grant does.
 */
export async function sendConsentDurably(item: QueuedConsent): Promise<boolean> {
  const uid = currentUid();
  if (!uid) return false;
  const [stored] = enqueueConsents(uid, [item]);
  const qid = stored.qid as string;
  watched.set(qid, false);
  try {
    await flushPendingConsents();
    return watched.get(qid) === true;
  } finally {
    watched.delete(qid);
  }
}

/**
 * Call before a direct (not queued) grant of an optional kind: sends what is queued first. Returns `commit`, to be called
 * ONLY after the grant succeeded: it drops the withdrawals of the same kind that could not be sent, so they can never
 * arrive later and undo this newer grant. If the grant fails, nothing is dropped: the withdrawal stays queued (and the
 * local-off flag stays), so the person's earlier choice is not lost.
 */
export async function prepareDirectGrant(kind: ConsentKind): Promise<() => void> {
  const uid = currentUid();
  if (!uid) return () => undefined;
  await flushPendingConsents();
  const stale = (load().find((x) => x.uid === uid)?.items ?? []).filter(
    (i) => i.kind === kind && i.action === 'withdraw',
  );
  return () => stale.forEach((i) => removeItem(uid, i));
}

/**
 * The account was deleted on the server: its queued consents and local-off flags have nothing left to attach to, so
 * they leave this device (the queue is device-level and survives sign-out, so this is the only place they are removed).
 */
export function pruneConsentsOf(uid: string | null): void {
  if (!uid) return;
  const q = load();
  save(q.filter((x) => x.uid !== uid));
  forgetLocalOff(uid);
  clearVerified(uid);
  clearGateDraft(uid);
  pruneRevokesOf(uid); // a waiting "Stop sharing" revoke has no account left to act on
}

/** Registration just created the account: queue the three grants, then try to send them (never throws, never blocks). */
export async function recordSignupConsents(locale: LocaleId): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  enqueueConsents(uid, await buildSignupGrants(locale));
  await flushPendingConsents();
}

/**
 * The legal gate's Continue (SPO-295, owner decision 22.10): everything the drawer showed, in ONE queued go, then sent.
 * `base` = terms + policy-ack + age-18 (each with the hash of the text shown); `trainer` = trainer-terms (the hash of the
 * Trainer Terms + DPA). Durable and offline-safe like registration: the queue is written before anything is sent.
 * Resolves false when the server permanently refused one of the grants (it was dropped: neither queued nor recorded),
 * so the gate can say so and ask again; true otherwise (sent, or still queued for a later try).
 */
export async function recordGateConsents(
  locale: LocaleId,
  need: { base: boolean; trainer: boolean },
): Promise<boolean> {
  const uid = currentUid();
  if (!uid) return true;
  const [base, trainer] = await Promise.all([
    need.base ? buildSignupGrants(locale) : Promise.resolve([]),
    need.trainer ? buildTrainerTermsGrant(locale) : Promise.resolve(null),
  ]);
  const grants = trainer ? [...base, trainer] : base;
  if (!grants.length) return true;
  const stored = enqueueConsents(uid, grants);
  await flushPendingConsents();
  const lost = stored.filter((i) => i.qid !== undefined && droppedQids.delete(i.qid));
  return lost.length === 0;
}

/** Retries queued consents when the app opens signed in and whenever the connection returns. */
export function usePendingConsentFlush(authed: boolean): void {
  useEffect(() => {
    if (!authed) return;
    void flushPendingConsents();
    const on = () => void flushPendingConsents();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [authed]);
}
