/**
 * The small interface switches that ride in `users/{uid}/meta/prefs` as plain fields, wired into store.ts through one
 * pair of calls: the push switches (`pushPrefs`, SPO-386) and the set-entry mode (`inputMode`, SPO-318).
 * Each keeps its own rules (pushPrefsSync.ts, inputModeSync.ts); this only fans the calls out.
 */
import { pushInputModeEdits, syncInputModeFromDoc } from './inputModeSync';
import { pushPushPrefsEdits, syncPushPrefsFromDoc, type PrefsWriter } from './pushPrefsSync';

/** Handle a prefs-doc snapshot for every switch in this group. */
export function syncUiPrefsFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  syncPushPrefsFromDoc(data, write);
  syncInputModeFromDoc(data, write);
}

/** Write each switch the person flips (values taken from the account never fire this). */
export function pushUiPrefsEdits(write: PrefsWriter): void {
  pushPushPrefsEdits(write);
  pushInputModeEdits(write);
}
