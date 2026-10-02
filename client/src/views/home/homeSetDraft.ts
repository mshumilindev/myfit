/**
 * Home set screen — what survives hops between its pages (set page → moves picker →
 * own-move form): the unsaved draft of a set (keyed by set id, or NEW for a new set) and
 * the moves ticked in the picker. Module-level so it outlives each page's mount; App
 * prunes it whenever the overlay stack changes, so leaving the screen clears it.
 * Nothing here is persisted — saving goes through the store's saveHomeSet.
 */
import { useSyncExternalStore } from 'react';

export interface SetDraft {
  name: string;
  moves: string[];
}

export const NEW_SET = 'new';

interface DraftState {
  drafts: Record<string, SetDraft>;
  picks: string[];
}

let state: DraftState = { drafts: {}, picks: [] };
const subs = new Set<() => void>();

function commit(next: DraftState): void {
  state = next;
  subs.forEach((fn) => fn());
}
function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => void subs.delete(fn);
}

export function useSetDraft(key: string): SetDraft | undefined {
  return useSyncExternalStore(subscribe, () => state.drafts[key]);
}

export function usePicks(): string[] {
  return useSyncExternalStore(subscribe, () => state.picks);
}

export function putSetDraft(key: string, draft: SetDraft): void {
  commit({ ...state, drafts: { ...state.drafts, [key]: draft } });
}

export function dropSetDraft(key: string): void {
  if (!(key in state.drafts)) return;
  const drafts = { ...state.drafts };
  delete drafts[key];
  commit({ ...state, drafts });
}

export function setPicks(picks: string[]): void {
  commit({ ...state, picks });
}

/** A deleted own move leaves every draft and the picker selection. */
export function forgetMove(id: string): void {
  const drafts: Record<string, SetDraft> = {};
  for (const [k, d] of Object.entries(state.drafts))
    drafts[k] = { ...d, moves: d.moves.filter((x) => x !== id) };
  commit({ drafts, picks: state.picks.filter((x) => x !== id) });
}

interface NavOverlay {
  screen?: string;
  page?: string;
  id?: string;
}

/** Keep only what the open overlay stack still needs; the rest of the screen is gone. */
export function pruneHomeSetDrafts(overlays: ReadonlyArray<NavOverlay | null>): void {
  const homes = overlays.filter((o): o is NavOverlay => o?.screen === 'home-set');
  const keys = new Set(homes.filter((o) => o.page === 'set').map((o) => o.id ?? NEW_SET));
  const keepPicks = homes.some((o) => o.page === 'add');
  const drafts: Record<string, SetDraft> = {};
  for (const k of Object.keys(state.drafts)) if (keys.has(k)) drafts[k] = state.drafts[k];
  const same =
    Object.keys(drafts).length === Object.keys(state.drafts).length &&
    (keepPicks || state.picks.length === 0);
  if (same) return;
  commit({ drafts, picks: keepPicks ? state.picks : [] });
}
