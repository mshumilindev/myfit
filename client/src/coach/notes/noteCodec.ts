/**
 * Note <-> sealed document (plan 10.2, Part C: sub-key `notes`). The ONLY place a note is sealed or opened.
 * Both go through `sealOrThrow`, so a locked vault throws `vault-locked` and never writes plaintext. A shared note is
 * bound by AAD to cid | epoch | note id | author uid | created time | 'note', so a ciphertext copied to another
 * conversation, note id, author or time does not open. Nothing here logs.
 */
import { openSealed, sealOrThrow, type SealSource } from '../../coachCrypto/sealOrThrow';
import { MAX_NOTE, parseAnchor, type Note, type NoteAnchor } from './types';

const roundSecond = (ms: number) => Math.floor(ms / 1000) * 1000;

function checkText(raw: string): string {
  const text = raw.trim();
  if (!text) throw new Error('empty-note');
  if (text.length > MAX_NOTE) throw new Error('too-long');
  return text;
}

/** users/{trainer}/clientNotes/{id}: open id, clientId, at, updatedAt, del; enc text, anchor. */
export async function sealPrivateNote(
  src: Omit<SealSource, 'ctx' | 'ring'>,
  n: Pick<Note, 'id' | 'clientId' | 'text' | 'anchor' | 'at' | 'updatedAt'>,
): Promise<Record<string, unknown>> {
  return sealOrThrow(
    'clientNotes',
    {
      id: n.id,
      clientId: n.clientId,
      at: n.at,
      updatedAt: n.updatedAt,
      text: checkText(n.text),
      anchor: n.anchor,
    },
    src,
  );
}

export async function openPrivateNote(
  src: Omit<SealSource, 'ctx' | 'ring'>,
  docId: string,
  raw: Record<string, unknown>,
): Promise<Note> {
  if (raw.id !== docId || typeof raw.clientId !== 'string') throw new Error('bad-note');
  const d = await openSealed<Record<string, unknown>>('clientNotes', raw, src);
  return toNote(d, 'private', raw.clientId);
}

/** conversations/{cid}/notes/{id}: open id, by, at, updatedAt, keyEpoch, del; enc text, anchor. `at` is rounded to the second (AAD). */
export async function sealSharedNote(
  src: Omit<SealSource, 'ctx'>,
  n: Pick<Note, 'id' | 'text' | 'anchor' | 'at' | 'updatedAt'>,
  byUid: string,
): Promise<Record<string, unknown>> {
  const at = roundSecond(n.at);
  return sealOrThrow(
    'notes',
    {
      id: n.id,
      by: byUid,
      at,
      updatedAt: Math.max(at, n.updatedAt),
      text: checkText(n.text),
      anchor: n.anchor,
    },
    { ...src, ctx: { messageId: n.id, fromUid: byUid, at } },
  );
}

export async function openSharedNote(
  src: Omit<SealSource, 'ctx'>,
  docId: string,
  raw: Record<string, unknown>,
  clientId: string,
): Promise<Note> {
  if (raw.id !== docId || typeof raw.by !== 'string' || !Number.isSafeInteger(raw.at))
    throw new Error('bad-note');
  const d = await openSealed<Record<string, unknown>>('notes', raw, {
    ...src,
    ctx: { messageId: docId, fromUid: raw.by, at: raw.at as number },
  });
  return toNote(d, 'shared', clientId);
}

function toNote(d: Record<string, unknown>, vis: Note['vis'], clientId: string): Note {
  if (typeof d.id !== 'string' || typeof d.text !== 'string' || typeof d.at !== 'number')
    throw new Error('bad-note');
  const anchor: NoteAnchor = parseAnchor(d.anchor);
  return {
    id: d.id,
    clientId,
    text: d.text,
    vis,
    anchor,
    at: d.at,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : d.at,
  };
}
