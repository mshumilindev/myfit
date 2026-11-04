/**
 * "This person confirmed this version of the document on THIS device" (policy / terms update sheet, SPO-295 N8).
 * The confirmation is sent to the server through the consent queue, but the queue drops a send the server refuses for good,
 * and the person must not be asked again on every start while that is being sorted out. So the answer is also kept here the
 * moment it is given: one small device-level localStorage map, account id -> kind -> version. Kinds and versions only, no
 * personal data; it outlives sign-out like the other consent bookkeeping and leaves with the account's deletion.
 */
export const UPDATE_ACKED_KEY = 'spotter.consentAcked';

type Map2 = Record<string, Record<string, string>>;

function read(): Map2 {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(UPDATE_ACKED_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Map2) : {};
  } catch {
    return {};
  }
}

/** The newest version of `kind` this account confirmed on this device ('' = none). */
export function ackedVersion(uid: string, kind: string): string {
  const v = read()[uid]?.[kind];
  return typeof v === 'string' ? v : '';
}

/** True when a confirmation of `version` (or a newer one) is stored. Versions are `YYYY-MM-DD`, so text order is date order. */
export function wasAcked(uid: string, kind: string, version: string): boolean {
  return ackedVersion(uid, kind) >= version && ackedVersion(uid, kind) !== '';
}

export function markAcked(uid: string, kind: string, version: string): void {
  try {
    const all = read();
    if (ackedVersion(uid, kind) >= version) return;
    localStorage.setItem(
      UPDATE_ACKED_KEY,
      JSON.stringify({ ...all, [uid]: { ...all[uid], [kind]: version } }),
    );
  } catch {
    /* storage unavailable: the server record is the only memory */
  }
}

/** The account was deleted: nothing is left to remember. */
export function clearAcked(uid: string): void {
  try {
    const all = read();
    if (!(uid in all)) return;
    delete all[uid];
    localStorage.setItem(UPDATE_ACKED_KEY, JSON.stringify(all));
  } catch {
    /* nothing to undo */
  }
}
