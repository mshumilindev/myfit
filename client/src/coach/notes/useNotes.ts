import { useEffect, useSyncExternalStore } from 'react';
import { coachAdapter } from '../data/backend';
import { createUnavailableNotesPort } from '../data/unavailable';
import {
  createNotesStore,
  EMPTY_NOTES,
  type ClientNotes,
  type NotesState,
  type NotesStore,
} from './notesStore';
import type { NotesPort } from './port';

let configured: NotesPort | null = null;
/** The app's notes port (the sealed adapter once installed, see port.ts). Tests and stories pass their own. */
export function configureNotes(p: NotesPort | null): void {
  configured = p;
}
export const getNotesPort = (): NotesPort =>
  (configured ??= coachAdapter('notes', createUnavailableNotesPort));

const stores = new WeakMap<NotesPort, NotesStore>();
export function notesStoreFor(port: NotesPort): NotesStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createNotesStore(port)));
  return s;
}

export function useNotesStore(port?: NotesPort): NotesStore {
  return notesStoreFor(port ?? getNotesPort());
}

export function useNotesState(store: NotesStore): NotesState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** One client's notes (newest first), live. The subscription lives while a component reads it. */
export function useClientNotes(
  clientId: string | null,
  port?: NotesPort,
): ClientNotes & { store: NotesStore; state: NotesState } {
  const store = useNotesStore(port);
  const state = useNotesState(store);
  useEffect(() => {
    if (!clientId) return;
    store.retain(clientId);
    return () => store.release(clientId);
  }, [store, clientId]);
  const c = clientId ? (state.byClient[clientId] ?? EMPTY_NOTES) : EMPTY_NOTES;
  return { ...c, store, state };
}
