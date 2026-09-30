/**
 * Feature flags — default OFF.
 *
 * Two scopes:
 *  - `device`: persisted in localStorage (`gym.flags`), per browser. Only an
 *    admin, and only on the web (the desktop rail), can toggle them from app
 *    Settings.
 *  - `global`: one Firestore document `config/flags`, read by every signed-in
 *    user, written by admins from the same Settings screen. Turning a global
 *    flag on switches it for the whole app, on every device. The last snapshot
 *    is mirrored to localStorage (`gym.flags.global`) so the app paints with
 *    the right value before Firestore answers.
 *
 * (No global flag is live at the moment; the machinery stays for the next one.)
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

export type FlagScope = 'device' | 'global';

const FLAG_DEFS = [
  { id: 'gymPresence', scope: 'device' },
  { id: 'nutrition', scope: 'device' },
  { id: 'conditions', scope: 'device' },
] as const satisfies readonly { id: string; scope: FlagScope }[];
export type FlagId = (typeof FLAG_DEFS)[number]['id'];
/** Widened so the `global` scope keeps type-checking while no global flag is live. */
export const FEATURE_FLAGS: readonly { id: FlagId; scope: FlagScope }[] = FLAG_DEFS;

const KEY = 'gym.flags';
const GLOBAL_KEY = 'gym.flags.global';
const listeners = new Set<() => void>();

function scopeOf(id: FlagId): FlagScope {
  return FEATURE_FLAGS.find((f) => f.id === id)?.scope ?? 'device';
}

function readJson(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function writeJson(key: string, value: Record<string, boolean>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — nothing to persist */
  }
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

// --- global flags (config/flags) -------------------------------------------

let globalFlags: Record<string, boolean> = readJson(GLOBAL_KEY);
let globalUnsub: Unsubscribe | null = null;

/** Subscribe to `config/flags`. Call once the user is signed in (rules require
 * auth); the returned function stops the listener (call it on sign-out). */
export function startGlobalFlags(): () => void {
  if (globalUnsub) return globalUnsub;
  globalUnsub = onSnapshot(
    doc(db, 'config', 'flags'),
    (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const next: Record<string, boolean> = {};
      for (const f of FEATURE_FLAGS) {
        if (f.scope === 'global' && data[f.id] === true) next[f.id] = true;
      }
      globalFlags = next;
      writeJson(GLOBAL_KEY, next);
      notify();
    },
    () => {
      /* offline or no permission — keep the mirrored value */
    },
  );
  return () => {
    globalUnsub?.();
    globalUnsub = null;
  };
}

// --- public API --------------------------------------------------------------

/** Default OFF: a flag is on only when explicitly stored `true`. */
export function isFlagOn(id: FlagId): boolean {
  if (scopeOf(id) === 'global') return globalFlags[id] === true;
  return readJson(KEY)[id] === true;
}

export function setFlag(id: FlagId, on: boolean): void {
  if (scopeOf(id) === 'global') {
    // Optimistic: paint now, Firestore confirms via the snapshot.
    globalFlags = { ...globalFlags, [id]: on };
    writeJson(GLOBAL_KEY, globalFlags);
    notify();
    setDoc(doc(db, 'config', 'flags'), { [id]: on, updatedAt: Date.now() }, { merge: true }).catch(
      (err: unknown) => {
        // Rules reject non-admins (or the rules are not deployed yet); the
        // snapshot that follows restores the server truth, i.e. the toggle
        // snaps back. Say why in the console so it is not a mystery.
        console.warn(`[flags] could not write config/flags.${id}:`, err);
      },
    );
    return;
  }
  const all = readJson(KEY);
  all[id] = on;
  writeJson(KEY, all);
  notify();
}

function subscribe(update: () => void): () => void {
  listeners.add(update);
  window.addEventListener('storage', update);
  return () => {
    listeners.delete(update);
    window.removeEventListener('storage', update);
  };
}

/** Reactive read of a single flag. */
export function useFlag(id: FlagId): boolean {
  const [on, setOn] = useState(() => isFlagOn(id));
  useEffect(() => subscribe(() => setOn(isFlagOn(id))), [id]);
  return on;
}

/** Re-render on any flag change (for the settings screen). */
export function useFlagsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => subscribe(() => setV((n) => n + 1)), []);
  return v;
}
