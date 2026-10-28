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
 * The mode / accent / density axes and the language ride in the same doc as plain fields (SPO-389), same rules.
 * Pure (no Firebase import): store.ts owns the listener and the write.
 */
import {
  AXES,
  DEFAULT_THEME,
  applyRemoteAxis,
  applyRemoteTheme,
  getCommittedTheme,
  isKnownTheme,
  onAxisChoice,
  onThemeChoice,
  savedAxis,
  type AxisName,
} from './registry';
import { applyRemoteLocale, getLocale, hasSavedLocale, onLocaleChoice } from '../i18n';
import { bindSeenWriter, syncSeenFromDoc } from './seen';

export const THEME_FIELD = 'theme';

export type PrefsWriter = (fields: Record<string, unknown>) => void;

/** Handle a prefs-doc snapshot: adopt the account's theme, or seed it from a non-default local one. */
export function syncThemeFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const remote = data[THEME_FIELD];
  if (remote === undefined || remote === null) {
    const local = getCommittedTheme();
    if (local !== DEFAULT_THEME) write({ [THEME_FIELD]: local });
    return;
  }
  if (typeof remote === 'string' && isKnownTheme(remote) && remote !== getCommittedTheme()) {
    applyRemoteTheme(remote);
  }
}

export const LOCALE_FIELD = 'locale';
/** Prefs-doc field of each look axis. */
export const AXIS_FIELD: Record<AxisName, string> = {
  mode: 'themeMode',
  accent: 'themeAccent',
  density: 'themeDensity',
};

/**
 * Handle a prefs-doc snapshot for the look axes and the language: the account's value wins; with none yet, a value
 * the person chose on this device is sent once (the choice predates sync). A default axis value is never sent.
 */
export function syncAxesAndLocaleFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  for (const axis of Object.keys(AXES) as AxisName[]) {
    const field = AXIS_FIELD[axis];
    const remote = data[field];
    if (remote === undefined || remote === null) {
      const local = savedAxis(axis);
      if (local !== null && local !== AXES[axis].default) write({ [field]: local });
    } else if (typeof remote === 'string') {
      applyRemoteAxis(axis, remote);
    }
  }
  const remoteLocale = data[LOCALE_FIELD];
  if (remoteLocale === undefined || remoteLocale === null) {
    if (hasSavedLocale()) write({ [LOCALE_FIELD]: getLocale() });
  } else if (typeof remoteLocale === 'string') {
    applyRemoteLocale(remoteLocale);
  }
}

/** Push every explicit choice (synced values don't fire this, so nothing echoes). */
export function pushThemeEdits(write: PrefsWriter): () => void {
  bindSeenWriter(write);
  const offs = [
    onThemeChoice((id) => write({ [THEME_FIELD]: id })),
    onAxisChoice((axis, value) => write({ [AXIS_FIELD[axis]]: value })),
    onLocaleChoice((id) => write({ [LOCALE_FIELD]: id })),
  ];
  return () => offs.forEach((off) => off());
}

/** The theme AND the list of themes already shown (SPO-355) live in the same prefs doc: one entry point for store.ts. */
export function syncThemePrefsFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  syncThemeFromDoc(data, write);
  syncSeenFromDoc(data, write);
  syncAxesAndLocaleFromDoc(data, write);
}
