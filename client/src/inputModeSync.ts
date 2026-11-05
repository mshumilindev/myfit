/**
 * Cloud sync of the set-entry mode (SPO-318): one plain field `inputMode` on `users/{uid}/meta/prefs` (same doc and
 * rules as `theme` / `pushPrefs`: written with `{ merge: true }`, the last write that reaches the server wins).
 * localStorage (`spotter.inputMode`) is the cache the editor reads; the account value wins once it arrives. A device
 * whose person chose a mode before the account had one pushes it once. A default is never pushed as a choice, and an
 * unknown value (from a newer build) is ignored and never overwritten.
 * Pure of Firebase: store.ts owns the listener and the write.
 */
import {
  applyRemoteInputMode,
  hasChosenInputMode,
  loadInputMode,
  onInputModeEdit,
  parseInputMode,
} from './inputModeStore';

export const INPUT_MODE_FIELD = 'inputMode';

export type PrefsWriter = (fields: Record<string, unknown>) => void;

/** Handle a prefs-doc snapshot: adopt the account's mode, or seed it from a mode chosen on this device. */
export function syncInputModeFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const remote = data[INPUT_MODE_FIELD];
  if (remote === undefined || remote === null) {
    if (hasChosenInputMode()) write({ [INPUT_MODE_FIELD]: loadInputMode() });
    return;
  }
  const mode = parseInputMode(remote);
  if (mode) applyRemoteInputMode(mode);
}

/** Push every mode the person picks (synced values don't fire this). */
export function pushInputModeEdits(write: PrefsWriter): () => void {
  return onInputModeEdit((m) => write({ [INPUT_MODE_FIELD]: m }));
}
