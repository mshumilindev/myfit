/**
 * The install run (SPO-500 I3): picked items are installed one after another (apps before their add-ons). It lives
 * outside React, so leaving the Installing screen does not stop it ("It continues in the background"). Each item is
 * first prepared (`prepareAddon`: the hook where the offline prefetch lands, I4), then turned on. Undo turns the
 * just-installed items off again; data stays.
 */
import { useSyncExternalStore } from 'react';
import { getRole, type Role } from '../api';
import { addonById } from './manifest';
import {
  disableAddons,
  enableAddons,
  isAddonAllowed,
  resolveEnabled,
  addonsPref,
} from './enabledSet';
import { addonsQueuePref, queueAdd, queueClear, resolveQueue } from './queue';

export type RunStatus = 'idle' | 'running' | 'done';
export interface RunState {
  status: RunStatus;
  /** Items of this run, in install order. */
  ids: readonly string[];
  /** Index of the item being installed (== ids.length when finished). */
  current: number;
  /** 0..100 for the item being installed. */
  progress: number;
}

const IDLE: RunState = { status: 'idle', ids: [], current: 0, progress: 0 };
let state: RunState = IDLE;
const listeners = new Set<() => void>();
function set(next: RunState): void {
  state = next;
  listeners.forEach((l) => l());
}

/** Apps first, so an add-on never starts before the app it needs. */
export function installOrder(ids: readonly string[]): string[] {
  const rank = (id: string) => (addonById(id)?.kind === 'app' ? 0 : 1);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

const STEP_PAUSE_MS = 130;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Get one item ready. Nothing to download yet, so it only reports progress; the prefetch (I4) replaces the body. */
export async function prepareAddon(_id: string, onProgress: (pct: number) => void): Promise<void> {
  for (const p of [25, 60, 100]) {
    onProgress(p);
    await sleep(STEP_PAUSE_MS);
  }
}

/** Start installing the picked list. A run already in progress is left alone. */
export function startInstall(role: Role = getRole()): Promise<void> {
  if (state.status === 'running') return Promise.resolve();
  const enabled = resolveEnabled(addonsPref.snapshot(), role);
  const ids = installOrder(
    resolveQueue(addonsQueuePref.get(), enabled, role).filter((id) => isAddonAllowed(id, role)),
  );
  if (!ids.length) return Promise.resolve();
  set({ status: 'running', ids, current: 0, progress: 0 });
  return (async () => {
    for (let i = 0; i < ids.length; i += 1) {
      set({ ...state, current: i, progress: 0 });
      await prepareAddon(ids[i], (progress) => set({ ...state, progress }));
      enableAddons([ids[i]], role);
    }
    queueClear();
    set({ ...state, status: 'done', current: ids.length, progress: 0 });
  })();
}

/** Turn the items of the finished run off again; they go back to the Selected list. */
export function undoInstall(role: Role = getRole()): void {
  if (state.status !== 'done') return;
  const ids = [...state.ids];
  disableAddons(ids, role);
  queueAdd(ids, role);
  set(IDLE);
}

/** Leave the finished screen. */
export function resetInstall(): void {
  if (state.status !== 'running') set(IDLE);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useInstallRun(): RunState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
