/**
 * The colour-mode PREFERENCE of the Studio settings: Auto (by the sun), Light or Dark. The `mode` axis itself stays
 * `light | dark` (it is what the CSS reads and what the account syncs); Auto only decides which of the two to put on
 * <html>, now and at every sunrise / sunset. The preference is kept on this device.
 */
import { applyRemoteAxis, getAxis, getTheme, setAxis } from './registry';
import { isDaylight } from './sun';

export type ModePref = 'auto' | 'light' | 'dark';
export const MODE_PREFS: readonly ModePref[] = ['auto', 'light', 'dark'];
const KEY = 'gym.modePref';
const CHECK_MS = 5 * 60_000;

export function getModePref(): ModePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'auto' || v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** The mode a preference means right now. */
export function resolveMode(pref: ModePref, now: Date = new Date()): 'light' | 'dark' {
  return pref === 'auto' ? (isDaylight(now) ? 'light' : 'dark') : pref;
}

/** Put the mode of `pref` on <html> without saving anything (a draft on the settings page). */
export function previewModePref(pref: ModePref): void {
  const m = resolveMode(pref);
  if (getAxis('mode') !== m) applyRemoteAxis('mode', m);
}

/** Save the preference and apply it; a manual choice is the person's own (it syncs), the sun's is not echoed. */
export function setModePref(pref: ModePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable: the choice lasts for this session */
  }
  const m = resolveMode(pref);
  if (pref === 'auto') previewModePref(pref);
  else setAxis('mode', m);
}

let timer: number | undefined;
/** Call once at start (after initTheme): follows the sun while the saved preference is Auto. */
export function initModePref(): () => void {
  const tick = () => {
    // only Studio follows the sun; other looks keep the mode the person set
    if (getTheme() === 'studio' && getModePref() === 'auto') previewModePref('auto');
  };
  tick();
  window.clearInterval(timer);
  timer = window.setInterval(tick, CHECK_MS);
  document.addEventListener('visibilitychange', tick);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
  };
}
