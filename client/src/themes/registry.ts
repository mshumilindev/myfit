/**
 * Theme registry (SPO-344, ADR 010). A theme is ONE file in this folder (`<id>.css`) that sets
 * the tokens of `contract.ts` on `html[data-theme=<id>]`. This list names it; `npm run theme:new`
 * adds both. The choice lives on `<html data-theme>` and in localStorage (`gym.theme`).
 */
import { useSyncExternalStore } from 'react';
import { glitchTheme } from '../components/appGlitch';
import { activeHoliday, dayOf, skipKey, type HolidayId, type HolidayWindow } from './holidays';

export interface ThemeDef {
  id: string;
  /** Brand name, shown as-is in Settings (not translated). */
  name: string;
  /** Release date (ISO). Orders the announcement; says nothing about what a user has seen. */
  since: string;
  /**
   * `false` = not offered in Themes and never announced: the theme is switched on by the app itself (the
   * holiday themes, SPO-321), so a user cannot pick it by hand. Default: pickable.
   */
  pickable?: boolean;
  /**
   * Makes this a holiday theme (SPO-321): the app puts it on by itself from a week before the holiday through the
   * day itself (schedule: holidays.ts) and takes it off the day after. Never offered, announced or saved.
   */
  holiday?: HolidayId;
}

export const THEMES: readonly ThemeDef[] = [
  { id: 'glass', name: 'Brass Glass', since: '2026-10-01' },
  { id: 'cyberpunk', name: 'Cyberpunk', since: '2026-10-24' },
  // theme:new inserts new themes above this line
];

/** The themes a user may pick by hand (everything the Themes screen and the announcement deal with). */
export const PICKABLE_THEMES: readonly ThemeDef[] = THEMES.filter(
  (t) => t.pickable !== false && t.holiday === undefined,
);

export const DEFAULT_THEME = 'glass';
const KEY = 'gym.theme';
const listeners = new Set<() => void>();
const choiceListeners = new Set<(id: string) => void>();
const commitListeners = new Set<(id: string) => void>();

/** Every time a theme becomes the SAVED one (picked, used after a preview, or arriving from the account). */
export function onThemeCommitted(fn: (id: string) => void): () => void {
  commitListeners.add(fn);
  return () => commitListeners.delete(fn);
}

const isKnown = (id: string | null | undefined): id is string => THEMES.some((t) => t.id === id);

/** The theme the user has chosen (saved). While a preview runs, `<html data-theme>` shows another one. */
let committed: string | null = null;
let previewing: string | null = null;
/**
 * The holiday theme the app is wearing over the saved one, or null. It is never saved: not in `gym.theme`, not in
 * the account, so the person's own theme is simply what shows again when the holiday ends (SPO-321).
 */
let holiday: string | null = null;
const SKIP_KEY = 'gym.holidaySkip';

/** The saved choice — not the look on screen during a preview. */
export function getCommittedTheme(): string {
  // outside a preview and a holiday the attribute IS the saved theme (it is also set directly by older callers and tests)
  return previewing !== null || holiday !== null ? (committed ?? DEFAULT_THEME) : getTheme();
}

export function getTheme(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isKnown(attr) ? attr : DEFAULT_THEME;
}

function apply(id: string): void {
  document.documentElement.setAttribute('data-theme', id);
}

/**
 * Wear `id`. EVERY change of theme after the first paint plays the transition of the theme being switched TO
 * (appGlitch): a pick in Themes, a preview, a choice from another device, and any theme the app puts on by itself
 * (the holiday themes, SPO-321) — route those through `applyRemoteTheme`/`setTheme`, never `apply`. The only quiet
 * ones: the first paint (`initTheme`) and a preview cut short by a workout, a document or a chat (`endPreview` quiet).
 */
function swap(id: string, animate: boolean): void {
  if (document.documentElement.getAttribute('data-theme') === id) return;
  if (animate) glitchTheme(() => apply(id));
  else apply(id);
}

/** Call once before the first render: restores the saved theme, falls back to the default. */
export function initTheme(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage unavailable — default theme */
  }
  committed = isKnown(saved) ? saved : DEFAULT_THEME;
  previewing = null;
  // opening the app reads the holiday schedule: a holiday theme is on from the very first paint
  holiday = holidayNow()?.theme ?? null;
  apply(holiday ?? committed);
  initAxes();
}

export const isKnownTheme = isKnown;

function store(id: string, animate = true): void {
  committed = id;
  previewing = null;
  swap(id, animate);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable — the choice lasts for this session */
  }
  listeners.forEach((fn) => fn());
  commitListeners.forEach((fn) => fn(id));
}

/** The user picked a theme: apply, cache it and tell the account sync (themeSync.ts). */
export function setTheme(id: string): void {
  if (!isKnown(id)) return;
  // a pick during a holiday is the person's own: the holiday theme stays off for the rest of this holiday
  if (holiday !== null) skipHoliday();
  store(id);
  choiceListeners.forEach((fn) => fn(id));
}

/** A theme that arrived from the account (another device): applied, but not echoed back. */
export function applyRemoteTheme(id: string): void {
  if (!isKnown(id)) return;
  if (previewing !== null) {
    // a preview is on screen: the account's choice is remembered, the look stays until the user decides
    committed = id;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  if (holiday !== null) {
    // the holiday theme is on: the account's choice is remembered and shows when the holiday ends
    committed = id;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((fn) => fn());
    return;
  }
  store(id);
}

/** Subscribe to the user's own choices only (remote ones don't fire it). */
export function onThemeChoice(fn: (id: string) => void): () => void {
  choiceListeners.add(fn);
  return () => choiceListeners.delete(fn);
}

/**
 * Preview (SPO-355): wear a theme on `<html>` WITHOUT saving it — no localStorage, no account write, no
 * choice listener. Ends with `endPreview(true)` (= the user's choice, `setTheme`) or `endPreview(false)`
 * (back to the saved one). Nothing survives a reload: `initTheme` starts from the saved theme.
 */
export function startPreview(id: string): void {
  if (!isKnown(id)) return;
  if (previewing === null && holiday === null) committed = getTheme(); // what to go back to
  previewing = id;
  swap(id, true);
  listeners.forEach((fn) => fn());
}

/** `quiet`: the preview is cut short (the person entered a workout, a document…): the look goes back without a show. */
export function endPreview(keep: boolean, quiet = false): void {
  const id = previewing;
  if (id === null) return;
  if (keep) {
    setTheme(id);
    return;
  }
  const back = holiday ?? committed ?? DEFAULT_THEME;
  previewing = null;
  swap(back, !quiet);
  listeners.forEach((fn) => fn());
}

export function getPreview(): string | null {
  return previewing;
}

export function usePreview(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getPreview,
    () => null,
  );
}

/** The saved theme, for screens that say which one is "applied" (not the one a preview is wearing). */
export function useCommittedTheme(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getCommittedTheme,
    () => DEFAULT_THEME,
  );
}

export function useTheme(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getTheme,
    () => DEFAULT_THEME,
  );
}

/**
 * Independent look axes next to the theme (SPO-344). Each one is an attribute on `<html>`; a value
 * is just a CSS block that overrides tokens, so a new accent / density / colour mode is: one entry
 * here + one block in `_axes.css` (or a `[data-mode=...]` block inside a theme file). Today every
 * axis has only its default value, so nothing changes visually until a value is added.
 * `data-sleep=night` (the automatic night dimming) is a separate runtime state and stays as is.
 */
export const AXES = {
  mode: { attr: 'data-mode', key: 'gym.mode', values: ['dark'], default: 'dark' },
  accent: { attr: 'data-accent', key: 'gym.accent', values: ['brass'], default: 'brass' },
  density: { attr: 'data-density', key: 'gym.density', values: ['regular'], default: 'regular' },
} as const satisfies Record<
  string,
  { attr: string; key: string; values: readonly string[]; default: string }
>;
export type AxisName = keyof typeof AXES;

const axisKnown = (axis: AxisName, v: string | null | undefined): v is string =>
  (AXES[axis].values as readonly string[]).includes(v ?? '');

export function getAxis(axis: AxisName): string {
  if (typeof document === 'undefined') return AXES[axis].default;
  const attr = document.documentElement.getAttribute(AXES[axis].attr);
  return axisKnown(axis, attr) ? attr : AXES[axis].default;
}

/** Call once before the first render (initTheme does): restores each saved axis value. */
export function initAxes(): void {
  for (const axis of Object.keys(AXES) as AxisName[]) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(AXES[axis].key);
    } catch {
      /* storage unavailable — default value */
    }
    document.documentElement.setAttribute(
      AXES[axis].attr,
      axisKnown(axis, saved) ? saved : AXES[axis].default,
    );
  }
}

export function setAxis(axis: AxisName, value: string): void {
  if (!axisKnown(axis, value)) return;
  document.documentElement.setAttribute(AXES[axis].attr, value);
  try {
    localStorage.setItem(AXES[axis].key, value);
  } catch {
    /* storage unavailable — the choice lasts for this session */
  }
  listeners.forEach((fn) => fn());
}

export function useAxis(axis: AxisName): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => getAxis(axis),
    () => AXES[axis].default,
  );
}

/**
 * Holiday themes (SPO-321). The schedule is read ON THE DEVICE when the app opens (`initTheme`), when the tab comes
 * back and at each local midnight (holidayWatch.ts): nothing here talks to a server.
 */
function skipped(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SKIP_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** The holiday theme that should be on today, if any (a holiday without a theme in the registry never comes on). */
function holidayNow(now: Date = new Date()): { theme: string; window: HolidayWindow } | null {
  const have = new Map(
    THEMES.filter((t) => t.holiday !== undefined).map((t) => [t.holiday as HolidayId, t.id]),
  );
  if (have.size === 0) return null;
  const lang = typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en';
  const w = activeHoliday(dayOf(now), lang, (id) => have.has(id));
  if (!w || skipped().includes(skipKey(w))) return null;
  return { theme: have.get(w.id) as string, window: w };
}

/** The person chose their own theme during a holiday: leave it off until this holiday has passed. */
function skipHoliday(): void {
  const w = holidayNow()?.window;
  holiday = null;
  if (!w) return;
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...skipped(), skipKey(w)].slice(-12)));
  } catch {
    /* storage unavailable — the choice lasts for this session */
  }
}

/**
 * Put the holiday theme on or take it off to match today's date, with the transition of the theme being switched TO.
 * Returns false when it did nothing, including while a preview is open (the caller tries again when it ends).
 */
export function syncHolidayTheme(now: Date = new Date()): boolean {
  if (previewing !== null) return false;
  const next = holidayNow(now)?.theme ?? null;
  if (next === holiday) return false;
  holiday = next;
  swap(holiday ?? committed ?? DEFAULT_THEME, true);
  listeners.forEach((fn) => fn());
  return true;
}

/** True when today's schedule wants another theme than the one on screen (a switch is waiting). */
export function holidaySwitchPending(now: Date = new Date()): boolean {
  return (holidayNow(now)?.theme ?? null) !== holiday;
}

/** The holiday theme on screen right now, or null. */
export function getHolidayTheme(): string | null {
  return holiday;
}

export function useHolidayTheme(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getHolidayTheme,
    () => null,
  );
}
