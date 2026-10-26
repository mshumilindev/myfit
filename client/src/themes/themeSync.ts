/**
 * Cloud sync of the chosen theme (SPO-366): one plain field `theme` on `users/{uid}/meta/prefs`
 * (same doc as the Today layout), written with `{ merge: true }`. No timestamps: Firestore queues
 * offline writes and its snapshots already include pending local ones, so the last write that
 * reaches the server wins.
 *
 * localStorage (`gym.theme`, registry.ts) is only a cache so the first paint, the landing and the
 * sign-in screen have the theme before Firestore is ready; the account value wins once it arrives.
 * Synced values go through `applyRemoteTheme`, which doesn't fire the choice listeners, so nothing
 * echoes. An unknown id (a theme from a newer build) is ignored and never overwritten.
 * A cached non-default theme with no account value yet is pushed once (the choice predates sync).
 *
 * Only the theme — the mode / accent / density axes are not synced.
 * Pure (no Firebase import): store.ts owns the listener and the write.
 */
import { DEFAULT_THEME, applyRemoteTheme, getTheme, isKnownTheme, onThemeChoice } from './registry';

export const THEME_FIELD = 'theme';

export type PrefsWriter = (fields: Record<string, unknown>) => void;

/** Handle a prefs-doc snapshot: adopt the account's theme, or seed it from a non-default local one. */
export function syncThemeFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const remote = data[THEME_FIELD];
  if (remote === undefined || remote === null) {
    const local = getTheme();
    if (local !== DEFAULT_THEME) write({ [THEME_FIELD]: local });
    return;
  }
  if (typeof remote === 'string' && isKnownTheme(remote) && remote !== getTheme()) {
    applyRemoteTheme(remote);
  }
}

/** Push every explicit choice (synced values don't fire this, so nothing echoes). */
export function pushThemeEdits(write: PrefsWriter): () => void {
  return onThemeChoice((id) => write({ [THEME_FIELD]: id }));
}
