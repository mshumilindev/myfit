/**
 * Coach notes (M5, plan 10.2). ONE note entity per client, written by the trainer. Visibility is where it lives:
 *   private -> users/{trainer}/clientNotes/{id}   sealed with the trainer's vault key ('dek'), only the trainer reads it
 *   shared  -> conversations/{cid}/notes/{id}      sealed with the conversation key ('ck', purpose notes, AAD kind 'note'),
 *                                                  so the client reads it read-only and no one else can
 * Plain data, no display strings (copy lives in i18n/coachNotes*), times are epoch ms.
 */
export const MAX_NOTE = 2000;
/** The delete window: the same 8 s as the chat (decision 11). */
export const NOTE_UNDO_MS = 8000;

export type NoteVis = 'private' | 'shared';
export type AnchorKind = 'message' | 'decision' | 'day' | 'exercise' | 'none';

/** What a note hangs on. `text` is the short name of that thing at the time ("Upper A . Fri"); the words around it are i18n. */
export interface NoteAnchor {
  kind: AnchorKind;
  /** Message id (jumps inside the thread), decision id, "program:index" day id or exercise id. */
  id?: string;
  text?: string;
  /** For `message`: the message time, so the label does not need the message to be loaded. */
  at?: number;
}

export interface Note {
  id: string;
  clientId: string;
  text: string;
  vis: NoteVis;
  anchor: NoteAnchor;
  /** Created / last edited, ms. */
  at: number;
  updatedAt: number;
}

export interface NoteDraft {
  clientId: string;
  text: string;
  vis: NoteVis;
  anchor: NoteAnchor;
}

export const isAnchorKind = (v: unknown): v is AnchorKind =>
  v === 'message' || v === 'decision' || v === 'day' || v === 'exercise' || v === 'none';

/** Untrusted anchor (from a decrypted document) -> a safe one. */
export function parseAnchor(v: unknown): NoteAnchor {
  if (!v || typeof v !== 'object') return { kind: 'none' };
  const a = v as Record<string, unknown>;
  if (!isAnchorKind(a.kind)) return { kind: 'none' };
  return {
    kind: a.kind,
    ...(typeof a.id === 'string' ? { id: a.id.slice(0, 120) } : {}),
    ...(typeof a.text === 'string' ? { text: a.text.slice(0, 160) } : {}),
    ...(typeof a.at === 'number' && Number.isFinite(a.at) ? { at: a.at } : {}),
  };
}

export const noteEdited = (n: Note): boolean => n.updatedAt - n.at >= 1000;
