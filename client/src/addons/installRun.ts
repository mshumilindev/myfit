/**
 * The install run (SPO-500 I3): picked items are installed one after another (apps before their add-ons). It lives
 * outside React, so leaving the Installing screen does not stop it ("It continues in the background"). Each item is
 * first prepared (`prepareAddon`: the hook where the offline prefetch lands, I4), then turned on. Undo turns the
 * just-installed items off again; data stays.
 */
import { useSyncExternalStore } from 'react';
import { getRole, type Role } from '../api';
import { addonById } from './manifest';
import { prefetchChunks } from './prefetch';

declare const __BUILD_ID__: string | undefined;
const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
import {
  disableAddons,
  enableAddons,
  isAddonAllowed,
  resolveEnabled,
  addonsPref,
} from './enabledSet';
import { addonsQueuePref, queueAdd, queueClear, resolveQueue } from './queue';

export type RunStatus = 'idle' | 'running' | 'done' | 'partial';
export type StepResult = 'pending' | 'active' | 'done' | 'failed';
export interface RunState {
  status: RunStatus;
  /** Items of this run, in install order. */
  ids: readonly string[];
  /** Where each item stands. */
  result: Readonly<Record<string, StepResult>>;
  /** 0..100 for the item being installed. */
  progress: number;
}

const IDLE: RunState = { status: 'idle', ids: [], result: {}, progress: 0 };
let state: RunState = IDLE;
const listeners = new Set<() => void>();
function set(next: RunState): void {
  state = next;
  listeners.forEach((l) => l());
}
const mark = (id: string, r: StepResult, progress = 0) =>
  set({ ...state, result: { ...state.result, [id]: r }, progress });

/** Apps first, so an add-on never starts before the app it needs. */
export function installOrder(ids: readonly string[]): string[] {
  const rank = (id: string) => (addonById(id)?.kind === 'app' ? 0 : 1);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

const STEP_PAUSE_MS = 130;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Get one item ready: its chunks go into the add-on's own offline cache (prefetch.ts). An add-on with no chunks yet
 * (still inside the core bundle) only needs the network to be there and shows a short progress. Throws when it cannot.
 */
export async function prepareAddon(id: string, onProgress: (pct: number) => void): Promise<void> {
  const m = addonById(id);
  if (m?.chunks?.length) {
    await prefetchChunks(id, BUILD, m.chunks, onProgress, m.sizeHint);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  for (const p of [25, 60, 100]) {
    onProgress(p);
    await sleep(STEP_PAUSE_MS);
  }
}

/** Install the given ids in order; an add-on whose app failed fails with it. Ends in done or partial. */
async function runIds(ids: readonly string[], role: Role): Promise<void> {
  set({ ...state, status: 'running' });
  for (const id of ids) {
    const parent = addonById(id)?.parent;
    if (parent && state.result[parent] === 'failed') {
      mark(id, 'failed');
      continue;
    }
    mark(id, 'active');
    try {
      await prepareAddon(id, (progress) => set({ ...state, progress }));
      enableAddons([id], role);
      mark(id, 'done');
    } catch {
      mark(id, 'failed');
    }
  }
  const failed = state.ids.some((i) => state.result[i] === 'failed');
  if (!failed) queueClear();
  set({ ...state, status: failed ? 'partial' : 'done', progress: 0 });
}

/** Start installing the picked list. A run already in progress is left alone. */
export function startInstall(role: Role = getRole()): Promise<void> {
  if (state.status === 'running') return Promise.resolve();
  const enabled = resolveEnabled(addonsPref.snapshot(), role);
  const ids = installOrder(
    resolveQueue(addonsQueuePref.get(), enabled, role).filter((id) => isAddonAllowed(id, role)),
  );
  if (!ids.length) return Promise.resolve();
  set({
    status: 'running',
    ids,
    result: Object.fromEntries(ids.map((id) => [id, 'pending' as StepResult])),
    progress: 0,
  });
  return runIds(ids, role);
}

/** Try the items that failed again (e.g. once the connection is back). */
export function retryInstall(role: Role = getRole()): Promise<void> {
  if (state.status !== 'partial') return Promise.resolve();
  return runIds(
    state.ids.filter((id) => state.result[id] === 'failed'),
    role,
  );
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
