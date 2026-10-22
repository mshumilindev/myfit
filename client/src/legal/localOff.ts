/**
 * "This device stopped it" flags for withdrawn optional consents (health features, Atlas AI / Puter, gym search).
 * A withdrawal stops the feature at once on this device, and the record follows through the persisted consent queue
 * (`signupConsents`). The flag is persisted too (per account, kinds only, no personal data), so after a reload while
 * still offline the feature stays off even though the cached records still say "on". Cleared once the withdrawal is
 * recorded on the server, or when the person grants the consent again. A device-level key (kept by sign-out and the device
 * wipe, like the queue): it must outlive the session so the feature stays off until the withdrawal is recorded.
 */
import type { ConsentKind } from './consents';

export const LOCAL_OFF_KEY = 'spotter.consentLocalOff';

type Store = Record<string, ConsentKind[]>;

function load(): Store {
  try {
    const raw = localStorage.getItem(LOCAL_OFF_KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Store) : {};
  } catch {
    return {};
  }
}
function save(s: Store): void {
  try {
    if (Object.keys(s).length) localStorage.setItem(LOCAL_OFF_KEY, JSON.stringify(s));
    else localStorage.removeItem(LOCAL_OFF_KEY);
  } catch {
    /* storage unavailable: the in-memory flag of the caller still holds for this visit */
  }
}

/** The kinds this account withdrew on this device and whose record is not confirmed yet. */
export function localOffKinds(uid: string | null): readonly ConsentKind[] {
  if (!uid) return [];
  const own = load()[uid];
  return Array.isArray(own) ? own : [];
}

export function markLocalOff(uid: string | null, kind: ConsentKind): void {
  if (!uid) return;
  const s = load();
  const own = Array.isArray(s[uid]) ? s[uid] : [];
  if (own.includes(kind)) return;
  s[uid] = [...own, kind];
  save(s);
}

export function clearLocalOff(uid: string | null, kind: ConsentKind): void {
  if (!uid) return;
  const s = load();
  if (!Array.isArray(s[uid]) || !s[uid].includes(kind)) return;
  const rest = s[uid].filter((k) => k !== kind);
  if (rest.length) s[uid] = rest;
  else delete s[uid];
  save(s);
}

/** The account was deleted: its flags have nothing to guard any more. */
export function forgetLocalOff(uid: string): void {
  const s = load();
  if (!(uid in s)) return;
  delete s[uid];
  save(s);
}
