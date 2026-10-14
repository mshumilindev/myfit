import { useSyncExternalStore } from 'react';

/** Chat dock state: session-only (never persisted). `who` is the client whose thread is open, null = the list. */
export interface DockState {
  open: boolean;
  who: string | null;
}

let state: DockState = { open: false, who: null };
const subs = new Set<() => void>();

function set(next: DockState) {
  if (next.open === state.open && next.who === state.who) return;
  state = next;
  subs.forEach((f) => f());
}

export const dock = {
  get: () => state,
  open: (who: string | null = state.who) => set({ open: true, who }),
  close: () => set({ ...state, open: false }),
  toggle: () => set({ ...state, open: !state.open }),
  showList: () => set({ ...state, who: null }),
  reset: () => set({ open: false, who: null }),
};

export function useDock(): DockState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => state,
    () => state,
  );
}
