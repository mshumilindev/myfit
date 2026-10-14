import type { SealSource } from '../../coachCrypto/sealOrThrow';
import type { ChatKeyRing } from '../../coachCrypto/conversationKey';
import { openPrivateNote, openSharedNote, sealPrivateNote, sealSharedNote } from './noteCodec';
import type { NotesDocStore, NotesPort, Unsubscribe } from './port';
import type { Note, NoteDraft } from './types';

export interface SealedPortDeps {
  store: NotesDocStore;
  vault: SealSource['vault'];
  /** The conversation key ring of one client (the shared notes' key). */
  ringFor: (clientId: string) => ChatKeyRing | null;
  /** The ring of an earlier epoch (history after a key rotation); without it only current-epoch notes open. */
  ringForEpoch?: (clientId: string, epoch: number) => ChatKeyRing | null;
  /** The trainer's uid (author of every note). */
  uid: string;
  now?: () => number;
}

/**
 * NotesPort over a NotesDocStore: every write is sealed first (`noteCodec`), a locked vault or a missing ring throws
 * before anything is written, and a move between private and shared is ONE atomic batch (set the new copy, remove the old).
 */
export function createSealedNotesPort(d: SealedPortDeps): NotesPort {
  const now = d.now ?? (() => Date.now());
  const newId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `n-${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const cache = new Map<string, Note>();
  const key = (clientId: string, id: string) => `${clientId}/${id}`;

  async function sealFor(n: Note): Promise<Record<string, unknown>> {
    if (n.vis === 'private') return sealPrivateNote({ vault: d.vault }, n);
    const ring = d.ringFor(n.clientId);
    if (!ring) throw new Error('chat-key-missing');
    return sealSharedNote({ vault: d.vault, ring }, n, d.uid);
  }
  const coll = (v: Note['vis']): 'clientNotes' | 'notes' =>
    v === 'private' ? 'clientNotes' : 'notes';

  return {
    now,
    subscribe(clientId, on, onError): Unsubscribe {
      let stop = false;
      const off = d.store.subscribe(
        clientId,
        (raw) => {
          void (async () => {
            const out: Note[] = [];
            const cur = d.ringFor(clientId);
            const ringAt = (epoch: unknown): ChatKeyRing | null =>
              !Number.isInteger(epoch) || cur?.epoch === epoch
                ? cur
                : (d.ringForEpoch?.(clientId, epoch as number) ?? null);
            for (const r of raw.priv) {
              if (r.del) continue;
              try {
                out.push(await openPrivateNote({ vault: d.vault }, String(r.id), r));
              } catch {
                /* does not open: never shown */
              }
            }
            for (const r of raw.shared) {
              const ring = ringAt(r.keyEpoch);
              if (r.del || !ring) continue;
              try {
                out.push(await openSharedNote({ vault: d.vault, ring }, String(r.id), r, clientId));
              } catch {
                /* does not open: never shown */
              }
            }
            if (stop) return;
            out.sort((a, b) => b.at - a.at);
            out.forEach((n) => cache.set(key(clientId, n.id), n));
            on(out);
          })();
        },
        onError,
      );
      return () => {
        stop = true;
        off();
      };
    },
    async add(draft: NoteDraft) {
      const t = now();
      const n: Note = {
        id: newId(),
        clientId: draft.clientId,
        text: draft.text.trim(),
        vis: draft.vis,
        anchor: draft.anchor,
        at: t,
        updatedAt: t,
      };
      const set = await sealFor(n);
      await d.store.write([{ coll: coll(n.vis), id: n.id, set, clientId: n.clientId }]);
      cache.set(key(n.clientId, n.id), n);
      return n;
    },
    async edit(clientId, id, text) {
      const old = cache.get(key(clientId, id));
      if (!old) throw new Error('not-found');
      const n: Note = { ...old, text: text.trim(), updatedAt: Math.max(now(), old.at) };
      await d.store.write([{ coll: coll(n.vis), id, set: await sealFor(n), clientId: n.clientId }]);
      cache.set(key(clientId, id), n);
    },
    async setVis(clientId, id, vis) {
      const old = cache.get(key(clientId, id));
      if (!old) throw new Error('not-found');
      if (old.vis === vis) return;
      const n: Note = { ...old, vis, updatedAt: Math.max(now(), old.at) };
      const set = await sealFor(n);
      await d.store.write([
        { coll: coll(vis), id, set, clientId },
        { coll: coll(old.vis), id, remove: true, clientId },
      ]);
      cache.set(key(clientId, id), n);
    },
    async remove(clientId, id) {
      const old = cache.get(key(clientId, id));
      if (!old) return;
      await d.store.write([{ coll: coll(old.vis), id, remove: true, clientId }]);
      cache.delete(key(clientId, id));
    },
  };
}
