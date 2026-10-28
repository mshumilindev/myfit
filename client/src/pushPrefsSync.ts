/**
 * Cloud sync of the push switches (SPO-386): one plain field `pushPrefs` on `users/{uid}/meta/prefs` (same doc and same
 * rules as `theme`: written with `{ merge: true }`, the last write that reaches the server wins). Until now the switches
 * lived only in `localStorage`, which sign-out wipes, so every sign-in turned everything back on.
 *
 * localStorage (`spotter.pushPrefs`) stays as the cache the push code reads. The account value wins once it arrives;
 * a device whose switches differ from the defaults and whose account has no value yet pushes them once. A value taken
 * from the account never fires the edit listeners, so nothing echoes. The per-device copy in `users/{uid}/push/{deviceId}`
 * (what the server reads when it sends) is refreshed whenever the switches change here.
 * Pure of Firebase: store.ts owns the listener and the write.
 */
import {
  DEFAULT_PREFS,
  applyRemotePrefs,
  loadPrefs,
  onPrefsEdit,
  parsePrefs,
  type PushPrefs,
} from './pushPrefsStore';

export const PUSH_PREFS_FIELD = 'pushPrefs';

export type PrefsWriter = (fields: Record<string, unknown>) => void;

const same = (a: PushPrefs, b: PushPrefs) =>
  a.requests === b.requests && a.reminders === b.reminders && a.team === b.team;

/** Handle a prefs-doc snapshot: adopt the account's switches, or seed them from a non-default local choice. */
export function syncPushPrefsFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const remote = data[PUSH_PREFS_FIELD];
  const local = loadPrefs();
  if (remote === undefined || remote === null) {
    if (!same(local, DEFAULT_PREFS)) write({ [PUSH_PREFS_FIELD]: local });
    return;
  }
  if (typeof remote !== 'object') return;
  const next = parsePrefs(remote);
  if (same(next, local)) return;
  applyRemotePrefs(next);
  void import('./push').then((m) => m.syncPrefsToServer(next)).catch(() => undefined);
}

/** Push every switch the person flips (synced values don't fire this). */
export function pushPushPrefsEdits(write: PrefsWriter): () => void {
  return onPrefsEdit((p) => write({ [PUSH_PREFS_FIELD]: p }));
}
