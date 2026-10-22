/**
 * `recordConsent` on the `Kv` seam (SPO-296), so it is unit tested without an emulator. Rules, in order:
 * signed-in, input valid (grants only for the CURRENT version), the live user document exists and is not suspended,
 * then one transaction: throttle, no-op detection, strictly increasing `at` per kind, create.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Kv } from './coach/kv';
import {
  buildConsentRecord,
  isNoOp,
  parseConsentInput,
  type ConsentInput,
  type ConsentRecordDoc,
} from './consentRecordsPure';

/** At most this many NEW records per person per window (no-ops do not count). Registration writes about 4 at once. */
export const THROTTLE_MAX = 30;
export const THROTTLE_WINDOW_MS = 60_000;

export interface RecordConsentArgs {
  uid: string | undefined;
  data: unknown;
  now: number;
  /** random suffix for the doc id (injected for tests) */
  rand: () => string;
}

const latestOf = (rows: { data: Record<string, unknown> }[]): ConsentRecordDoc | null => {
  let best: ConsentRecordDoc | null = null;
  for (const r of rows) {
    const d = r.data as unknown as ConsentRecordDoc;
    if (typeof d.at !== 'number') continue;
    if (!best || d.at > best.at || (d.at === best.at && d.id > best.id)) best = d;
  }
  return best;
};

export async function recordConsentHandler(
  kv: Kv,
  a: RecordConsentArgs,
): Promise<{ id: string; at: number }> {
  if (!a.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = a.uid;
  let input: ConsentInput;
  try {
    input = parseConsentInput(a.data);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'bad-input');
  }
  const coll = `users/${uid}/consentRecords`;
  return kv.tx(async (t) => {
    // A deleted account has no user document; a valid ID token must not bring records back to life. Read INSIDE the
    // transaction so a deletion that lands between the check and the write cannot be raced (SPO-285).
    const user = await t.get(`users/${uid}`);
    if (!user) throw new HttpsError('not-found', 'User not found.');
    if (user.status === 'suspended')
      throw new HttpsError('permission-denied', 'Account suspended.');
    const recent = await t.list(coll, {
      where: [['at', '>=', a.now - THROTTLE_WINDOW_MS]],
      limit: THROTTLE_MAX + 1,
    });
    const latest = latestOf(await t.list(coll, { where: [['kind', '==', input.kind]] }));
    if (isNoOp(latest, input) && latest) return { id: latest.id, at: latest.at };
    if (recent.length >= THROTTLE_MAX)
      throw new HttpsError('resource-exhausted', 'Too many requests.');
    const at = Math.max(a.now, (latest?.at ?? 0) + 1);
    const rec = buildConsentRecord(input, at, a.rand());
    await t.set(`${coll}/${rec.id}`, rec as unknown as Record<string, unknown>);
    return { id: rec.id, at: rec.at };
  });
}
