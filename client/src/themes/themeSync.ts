/**
 * Cloud sync of the chosen theme (SPO-366) — same pattern and doc as the Today layout
 * (today/layoutSync.ts): the choice rides on `users/{uid}/meta/prefs` as its own
 * last-write-wins field pair
 *
 *   theme          — a theme id
 *   themeUpdatedAt — when the user chose it (ms)
 *
 * written with `{ merge: true }`. localStorage (registry.ts) stays the working copy, so the
 * first paint never waits for the network. Only an explicit choice is stamped: a device where
 * the user never picked anything has stamp 0 and can't overwrite the account's theme.
 * Synced values go through `applyRemoteTheme`, which doesn't fire the choice listeners, so
 * nothing echoes. An unknown id (a theme from a newer build) is ignored.
 *
 * Only the theme — the mode / accent / density axes are not synced.
 * Pure (no Firebase import): store.ts owns the listener and the write.
 */
import { applyRemoteTheme, getTheme, getThemeStamp, isKnownTheme, onThemeChoice } from './registry';

export const THEME_FIELD = 'theme';
export const THEME_STAMP_FIELD = 'themeUpdatedAt';

export interface SyncedTheme {
  id: string;
  at: number;
}

/** Clock-skew guard: a stamp from the far future would freeze the sync for every device. */
const SKEW_MS = 5 * 60 * 1000;
const stampFrom = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, Date.now() + SKEW_MS) : 0;

/** Read the synced theme off the prefs doc (null when missing or unusable). */
export function themeFromDoc(data: Record<string, unknown>): SyncedTheme | null {
  const id = data[THEME_FIELD];
  if (typeof id !== 'string' || !isKnownTheme(id)) return null;
  const at = data[THEME_STAMP_FIELD];
  return { id, at: stampFrom(at) };
}

export const themeToDoc = (id: string, at: number): Record<string, unknown> => ({
  [THEME_FIELD]: id,
  [THEME_STAMP_FIELD]: at,
});

/**
 * Last-write-wins by stamp. `apply` → adopt the account's theme; `push` → the local choice is
 * newer (made offline or before sign-in). On a tie the synced copy wins for stability.
 */
export function reconcileTheme(
  local: SyncedTheme,
  remote: SyncedTheme | null,
): { apply: SyncedTheme | null; push: boolean } {
  if (!remote) return { apply: null, push: local.at > 0 };
  if (remote.at > local.at) return { apply: remote, push: false };
  if (local.at > remote.at) return { apply: null, push: true };
  return { apply: remote.id === local.id ? null : remote, push: false };
}

export type PrefsWriter = (fields: Record<string, unknown>) => void;

/** Handle a prefs-doc snapshot: apply a newer account theme, or push a newer local choice. */
export function syncThemeFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const local = { id: getTheme(), at: getThemeStamp() };
  const remote = themeFromDoc(data);
  if (!remote && typeof data[THEME_FIELD] === 'string') {
    // A theme this build doesn't know (written by a newer one): never overwrite it with an older
    // local choice, or two builds would ping-pong. Push only if our choice is really newer.
    if (local.at > stampFrom(data[THEME_STAMP_FIELD])) write(themeToDoc(local.id, local.at));
    return;
  }
  const { apply, push } = reconcileTheme(local, remote);
  if (apply) applyRemoteTheme(apply.id, apply.at);
  if (push) write(themeToDoc(local.id, local.at));
}

/** Push every explicit choice (synced values don't fire this, so nothing echoes). */
export function pushThemeEdits(write: PrefsWriter): () => void {
  return onThemeChoice((id, at) => write(themeToDoc(id, at)));
}
