/**
 * Theme registry (SPO-344, ADR 010). A theme is ONE file in this folder (`<id>.css`) that sets
 * the tokens of `contract.ts` on `html[data-theme=<id>]`. This list names it; `npm run theme:new`
 * adds both. The choice lives on `<html data-theme>` and in localStorage (`gym.theme`).
 */
import { useSyncExternalStore } from 'react';

export interface ThemeDef {
  id: string;
  /** Brand name, shown as-is in Settings (not translated). */
  name: string;
}

export const THEMES: readonly ThemeDef[] = [
  { id: 'glass', name: 'Brass Glass' },
  { id: 'cyberpunk', name: 'Cyberpunk' },
  // theme:new inserts new themes above this line
];

export const DEFAULT_THEME = 'glass';
const KEY = 'gym.theme';
const listeners = new Set<() => void>();
const choiceListeners = new Set<(id: string) => void>();

const isKnown = (id: string | null | undefined): id is string => THEMES.some((t) => t.id === id);

export function getTheme(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isKnown(attr) ? attr : DEFAULT_THEME;
}

function apply(id: string): void {
  document.documentElement.setAttribute('data-theme', id);
}

/** Call once before the first render: restores the saved theme, falls back to the default. */
export function initTheme(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* storage unavailable — default theme */
  }
  apply(isKnown(saved) ? saved : DEFAULT_THEME);
  initAxes();
}

export const isKnownTheme = isKnown;

function store(id: string): void {
  apply(id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable — the choice lasts for this session */
  }
  listeners.forEach((fn) => fn());
}

/** The user picked a theme: apply, cache it and tell the account sync (themeSync.ts). */
export function setTheme(id: string): void {
  if (!isKnown(id)) return;
  store(id);
  choiceListeners.forEach((fn) => fn(id));
}

/** A theme that arrived from the account (another device): applied, but not echoed back. */
export function applyRemoteTheme(id: string): void {
  if (isKnown(id)) store(id);
}

/** Subscribe to the user's own choices only (remote ones don't fire it). */
export function onThemeChoice(fn: (id: string) => void): () => void {
  choiceListeners.add(fn);
  return () => choiceListeners.delete(fn);
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
