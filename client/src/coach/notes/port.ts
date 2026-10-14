/**
 * The seams of notes. Components never touch Firestore or the vault (plan 2.6):
 *   NotesPort       what the UI store calls (list one client's notes, add, edit, change visibility, delete).
 *   NotesDocStore   the raw document seam under the SEALED adapter (`sealedPort.ts`): subscribe to the two collections,
 *                   apply writes atomically. The in-memory store (`fixtures.ts`) implements it for tests and stories.
 *
 * The real adapter (done): `data/firestore/notesDocStore.ts`, a Firestore NotesDocStore under the sealed port:
 *   subscribe  onSnapshot(users/{trainer}/clientNotes where clientId == X) and onSnapshot(conversations/{cid}/notes),
 *              both ordered by `at` desc; tombstones (`del`) are filtered out; each document goes through
 *              `noteCodec.open*`, a document that fails to open is dropped from the list (never shown as text).
 *   write      ONE writeBatch: "make shared" = set conversations/{cid}/notes/{id} + delete users/{trainer}/clientNotes/{id};
 *              "make private" is the inverse; "delete" = set `del: true` and clear `enc` (the client's copy disappears at
 *              once). Rules: only the trainer of the conversation writes `notes`; the client may read, never write (6.2).
 *   The conversation key ring comes from `coachCrypto/conversationKey` (the same ring the chat adapter holds).
 */
import type { Note, NoteDraft } from './types';

export type Unsubscribe = () => void;

export interface NotesPort {
  now(): number;
  /** Live notes of one client, newest first. Calls `on` again on every change. */
  subscribe(
    clientId: string,
    on: (notes: Note[]) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
  add(draft: NoteDraft): Promise<Note>;
  edit(clientId: string, id: string, text: string): Promise<void>;
  setVis(clientId: string, id: string, vis: Note['vis']): Promise<void>;
  /** Hard delete (called after the undo window). */
  remove(clientId: string, id: string): Promise<void>;
}

export type RawDoc = Record<string, unknown>;
export interface RawNotes {
  priv: RawDoc[];
  shared: RawDoc[];
}
export type NoteWrite =
  | { coll: 'clientNotes' | 'notes'; id: string; set: RawDoc; clientId?: string }
  | { coll: 'clientNotes' | 'notes'; id: string; remove: true; clientId?: string };

export interface NotesDocStore {
  subscribe(
    clientId: string,
    on: (d: RawNotes) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
  /** All or nothing. */
  write(ops: readonly NoteWrite[]): Promise<void>;
}
