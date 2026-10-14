/**
 * The Firestore `NotesDocStore` under the sealed notes port (plan 10.2). Two collections, both sealed on this device:
 *   users/{trainer}/clientNotes/{id}      private notes, sealed with the trainer's vault key (rules: own read/write)
 *   conversations/{cid}/notes/{id}        shared notes, sealed with the conversation key (rules: only the conversation's
 *                                         trainer writes while the relationship is active; the client may read)
 *
 * `subscribe` waits until the conversation key ring of the client is primed (the sealed port opens shared notes with a
 * synchronous `ringFor`) and re-emits when the ring changes. A move between private and shared is ONE atomic batch.
 * Nothing here opens, logs or interprets a note.
 */
import type { NotesDocStore, NoteWrite, RawDoc, RawNotes, Unsubscribe } from '../../notes/port';
import type { FsApi, FsOp } from './fsApi';
import type { RingBook } from './ringBook';

export interface NotesDocStoreDeps {
  fs: FsApi;
  book: RingBook;
  /** the trainer's uid (owner of the private notes) */
  uid: string;
}

export function createFirestoreNotesStore(d: NotesDocStoreDeps): NotesDocStore {
  const priv = (id: string) => `users/${d.uid}/clientNotes/${id}`;

  return {
    subscribe(clientId, on, onError): Unsubscribe {
      let stop = false;
      let rawPriv: RawDoc[] = [];
      let rawShared: RawDoc[] = [];
      let sharedOff: (() => void) | null = null;
      let sharedCid: string | null = null;
      let havePriv = false;

      const emit = () => {
        if (stop || !havePriv) return;
        const out: RawNotes = { priv: rawPriv, shared: rawShared };
        on(out);
      };

      // private: one query by client id (no orderBy: a composite index is not needed, the port sorts)
      const privOff = d.fs.listen(
        `users/${d.uid}/clientNotes`,
        { where: [['clientId', '==', clientId]] },
        (rows) => {
          rawPriv = rows.map((r) => ({ ...r.data, id: r.data.id ?? r.id }));
          havePriv = true;
          emit();
        },
        onError,
      );

      // shared: follows the conversation of this client (appears once the pair is linked, moves on a re-link)
      const follow = () => {
        if (stop) return;
        const cid = d.book.cidOf(clientId);
        if (cid === sharedCid) {
          emit(); // same conversation, but the ring may have arrived
          return;
        }
        sharedOff?.();
        sharedOff = null;
        sharedCid = cid;
        rawShared = [];
        if (!cid) {
          emit();
          return;
        }
        sharedOff = d.fs.listen(
          `conversations/${cid}/notes`,
          { orderBy: ['at', 'desc'] },
          (rows) => {
            rawShared = rows.map((r) => ({ ...r.data, id: r.data.id ?? r.id }));
            emit();
          },
          onError,
        );
      };
      const unwatch = d.book.watch(follow);
      void d.book.ready().then(follow, onError);

      return () => {
        stop = true;
        privOff();
        sharedOff?.();
        unwatch();
      };
    },

    async write(ops: readonly NoteWrite[]) {
      const batch: FsOp[] = ops.map((o) => {
        if (o.coll === 'clientNotes')
          return 'remove' in o
            ? { k: 'delete', path: priv(o.id) }
            : { k: 'set', path: priv(o.id), data: o.set };
        const cid = o.clientId ? d.book.cidOf(o.clientId) : null;
        if (!cid) throw new Error('chat-key-missing');
        const path = `conversations/${cid}/notes/${o.id}`;
        return 'remove' in o ? { k: 'delete', path } : { k: 'set', path, data: o.set };
      });
      await d.fs.batch(batch);
    },
  };
}
