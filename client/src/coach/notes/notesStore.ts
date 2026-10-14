/**
 * Notes store: one subscription per client (reference counted), the add / edit / visibility / delete actions and the
 * single pending delete with an 8 s Undo. Never throws and never blocks: until the first snapshot the list is empty
 * and `status` is 'loading'; a failed listener keeps the last known notes ('error' is a state of the data).
 * A delete hides the note at once and writes only when the window closes (leaving the screen closes it now).
 */
import type { NotesPort } from './port';
import { MAX_NOTE, NOTE_UNDO_MS, type Note, type NoteDraft } from './types';

export type NotesStatus = 'loading' | 'ready' | 'error';
export interface ClientNotes {
  notes: readonly Note[];
  status: NotesStatus;
}
export interface PendingNote {
  note: Note;
  until: number;
}
export interface NotesState {
  byClient: Readonly<Record<string, ClientNotes>>;
  pending: PendingNote | null;
  /** The last write that failed (the UI says "Could not save. Try again."). */
  failed: 'add' | 'edit' | 'vis' | 'remove' | null;
}

export interface NotesStore {
  readonly port: NotesPort;
  getState(): NotesState;
  subscribe(f: () => void): () => void;
  retain(clientId: string): void;
  release(clientId: string): void;
  restart(clientId: string): void;
  add(draft: NoteDraft): Promise<Note | null>;
  edit(clientId: string, id: string, text: string): Promise<boolean>;
  setVis(clientId: string, id: string, vis: Note['vis']): Promise<boolean>;
  remove(note: Note): void;
  undo(): void;
  clearFailed(): void;
}

export const EMPTY_NOTES: ClientNotes = { notes: [], status: 'loading' };

export function createNotesStore(port: NotesPort, undoMs: number = NOTE_UNDO_MS): NotesStore {
  let state: NotesState = { byClient: {}, pending: null, failed: null };
  const subs = new Set<() => void>();
  const users = new Map<string, number>();
  const offs = new Map<string, () => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let commit: (() => Promise<void>) | null = null;

  const set = (p: Partial<NotesState>) => {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  };
  const patch = (clientId: string, p: Partial<ClientNotes>) =>
    set({
      byClient: {
        ...state.byClient,
        [clientId]: { ...(state.byClient[clientId] ?? EMPTY_NOTES), ...p },
      },
    });

  function settle() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const c = commit;
    commit = null;
    if (state.pending) set({ pending: null });
    if (c) void c().catch(() => set({ failed: 'remove' }));
  }

  function listen(clientId: string) {
    offs.get(clientId)?.();
    offs.set(
      clientId,
      port.subscribe(
        clientId,
        (notes) => patch(clientId, { notes, status: 'ready' }),
        () => patch(clientId, { status: 'error' }),
      ),
    );
  }

  return {
    port,
    getState: () => state,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
    retain(clientId) {
      const n = (users.get(clientId) ?? 0) + 1;
      users.set(clientId, n);
      if (n === 1 || !offs.has(clientId)) listen(clientId);
    },
    release(clientId) {
      const n = Math.max(0, (users.get(clientId) ?? 0) - 1);
      users.set(clientId, n);
      if (n === 0) {
        offs.get(clientId)?.();
        offs.delete(clientId);
        settle();
      }
    },
    restart(clientId) {
      patch(clientId, { status: 'loading' });
      listen(clientId);
    },
    async add(draft) {
      const text = draft.text.trim();
      if (!text || text.length > MAX_NOTE) return null;
      try {
        return await port.add({ ...draft, text });
      } catch {
        set({ failed: 'add' });
        return null;
      }
    },
    async edit(clientId, id, text) {
      const t = text.trim();
      if (!t || t.length > MAX_NOTE) return false;
      try {
        await port.edit(clientId, id, t);
        return true;
      } catch {
        set({ failed: 'edit' });
        return false;
      }
    },
    async setVis(clientId, id, vis) {
      try {
        await port.setVis(clientId, id, vis);
        return true;
      } catch {
        set({ failed: 'vis' });
        return false;
      }
    },
    remove(note) {
      settle();
      commit = () => port.remove(note.clientId, note.id);
      const cur = state.byClient[note.clientId] ?? EMPTY_NOTES;
      patch(note.clientId, { notes: cur.notes.filter((x) => x.id !== note.id) });
      set({ pending: { note, until: Date.now() + undoMs } });
      timer = setTimeout(settle, undoMs);
    },
    undo() {
      const p = state.pending;
      if (!p) return;
      if (timer) clearTimeout(timer);
      timer = undefined;
      commit = null;
      const cur = state.byClient[p.note.clientId] ?? EMPTY_NOTES;
      patch(p.note.clientId, { notes: [...cur.notes, p.note].sort((a, b) => b.at - a.at) });
      set({ pending: null });
    },
    clearFailed: () => set({ failed: null }),
  };
}
