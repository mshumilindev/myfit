/**
 * Feature flags — client-side, persisted in localStorage, default OFF.
 *
 * Everything shipped under the "Ex feature" hides behind `exerciseFeature`.
 * Only an admin, and only on the web (the desktop rail), can toggle flags from
 * app Settings. A fresh install has every flag off.
 */
import { useEffect, useState } from 'react';

export const FEATURE_FLAGS = [{ id: 'gymPresence' }, { id: 'nutrition' }] as const;
export type FlagId = (typeof FEATURE_FLAGS)[number]['id'];

const KEY = 'gym.flags';
const listeners = new Set<() => void>();

function readAll(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Default OFF: a flag is on only when explicitly stored `true`. */
export function isFlagOn(id: FlagId): boolean {
  return readAll()[id] === true;
}

export function setFlag(id: FlagId, on: boolean): void {
  const all = readAll();
  all[id] = on;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — nothing to persist */
  }
  listeners.forEach((fn) => fn());
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
