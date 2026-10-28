/**
 * Firestore wiring of the Atlas chat in the account (SPO-392): `users/{uid}/atlasChat/{id}` (one sealed document per
 * message; `id`, `at`, `updatedAt` open) and `users/{uid}/meta/atlasChatState` (sealed `{ clearedAt }`).
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { mirrorCollection, prepareWrite, readDocs } from '../vaultIO';
import { stampedCopy, watchSealedMeta, writeSealedMeta } from '../storeMeta';
import { onChatEdit, getChatLog, replaceChatFromAccount } from './chatLog';
import {
  ATLAS_WINDOW,
  EMPTY_STATE,
  fromWire,
  stateFromWire,
  toWire,
  type AtlasState,
} from './chatSyncCore';
import type { RetentionPorts } from './chatRetention';
import type { HistoryPorts } from './chatSyncService';

export function firestoreHistoryPorts(uid: string, onError: (e: unknown) => void): HistoryPorts {
  const col = collection(db, 'users', uid, 'atlasChat');
  return {
    watchDocs(apply) {
      const mirror = mirrorCollection<Record<string, unknown>>((items, { locked }) => {
        apply(
          items.map(fromWire).filter((m): m is NonNullable<typeof m> => m !== null),
          { locked },
        );
      });
      // One more than the window: the extra one is how a device knows the account holds too many.
      const off = onSnapshot(
        query(col, orderBy('at', 'desc'), limit(ATLAS_WINDOW + 1)),
        (snap) => mirror.push(snap.docs.map((d) => d.data())),
        onError,
      );
      return () => {
        off();
        mirror.dispose();
      };
    },
    watchState(apply) {
      return watchSealedMeta<Record<string, unknown>>(
        uid,
        'atlasChatState',
        (items, { locked }) => apply(stateFromWire(items[0]), { locked }),
        onError,
      );
    },
    async put(m) {
      const sealed = await prepareWrite('atlasChat', { ...toWire(m), updatedAt: Date.now() });
      await setDoc(doc(col, m.id), sealed);
    },
    del: (id) => deleteDoc(doc(col, id)),
    async deleteAll() {
      const snap = await getDocs(col);
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    },
    async putState(st) {
      writeSealedMeta(uid, 'atlasChatState', stampedCopy({ ...st }, Date.now()), onError);
    },
    getLocal: getChatLog,
    replaceLocal: replaceChatFromAccount,
    onLocalEdit: onChatEdit,
    now: () => Date.now(),
    onError,
  };
}

export function firestoreRetentionPorts(
  uid: string,
  onError: (e: unknown) => void,
): RetentionPorts {
  const base = firestoreHistoryPorts(uid, onError);
  return {
    async readState(): Promise<AtlasState> {
      const snap = await getDoc(doc(db, 'users', uid, 'meta', 'atlasChatState'));
      if (!snap.exists()) return EMPTY_STATE;
      const { items, locked } = await readDocs<Record<string, unknown>>([snap.data()]);
      if (locked || !items[0]) throw new Error('atlas-state-locked');
      return stateFromWire(items[0]);
    },
    putState: base.putState,
    deleteAll: base.deleteAll,
    now: base.now,
  };
}
