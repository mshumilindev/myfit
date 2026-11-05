/**
 * How a set's reps and weight are entered in the session editor (SPO-318): the scroll wheel or the classic − / +.
 * A per-account choice (`meta/prefs.inputMode`, inputModeSync.ts), cached in `localStorage` so the first paint has it.
 * Default: `stepper` (− / +) — the wheel is something the person switches on in the set sheet › More › Input.
 */
import { useSyncExternalStore } from 'react';
import { onAfterSignOut } from './accounts/deviceSession';

export type InputMode = 'stepper' | 'wheel';
export const DEFAULT_INPUT_MODE: InputMode = 'stepper';
const KEY = 'spotter.inputMode';

/** Untrusted value (storage / account doc) to a known mode, or null when it is not one. */
export function parseInputMode(v: unknown): InputMode | null {
  return v === 'wheel' || v === 'stepper' ? v : null;
}

let cache: InputMode | null = null;
const subs = new Set<() => void>();
const edits = new Set<(m: InputMode) => void>();

export function loadInputMode(): InputMode {
  if (cache) return cache;
  try {
    cache = parseInputMode(localStorage.getItem(KEY)) ?? DEFAULT_INPUT_MODE;
  } catch {
    cache = DEFAULT_INPUT_MODE;
  }
  return cache;
}

function persist(m: InputMode): void {
  cache = m;
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* private mode: kept for this session */
  }
  subs.forEach((f) => f());
}

// The cache must not outlive the account on a shared device (SPO-207): after a sign-out the next person starts from
// their own account value, or the default, not from the previous person's choice.
onAfterSignOut(() => {
  cache = null;
  subs.forEach((f) => f());
});

/** The person's own change: kept here and written to the account by store.ts. */
export function storeInputMode(m: InputMode): void {
  if (m === loadInputMode()) return;
  persist(m);
  edits.forEach((f) => f(m));
}

/** A value taken from the account: stored like an edit, but it does not fire the edit listeners (no echo). */
export function applyRemoteInputMode(m: InputMode): void {
  if (m !== loadInputMode()) persist(m);
}

export function onInputModeEdit(f: (m: InputMode) => void): () => void {
  edits.add(f);
  return () => void edits.delete(f);
}

/** The person has chosen a mode on this device at some point (so a default value is never pushed as a choice). */
export function hasChosenInputMode(): boolean {
  try {
    return parseInputMode(localStorage.getItem(KEY)) !== null;
  } catch {
    return false;
  }
}

export function useInputMode(): InputMode {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    loadInputMode,
    () => DEFAULT_INPUT_MODE,
  );
}

/** Test seam. */
export function resetInputModeForTests(): void {
  cache = null;
}
