/**
 * The Firestore web SDK + callable implementation of `FsApi`. This is the ONLY coach file that imports `firebase/*`.
 * Offline persistence is the app's (firebase.ts: persistentLocalCache), so reads are served from cache offline and
 * writes queue by themselves; callables fail at once when offline (api.ts `callFn`).
 */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { callFn } from '../../../api';
import { db } from '../../../firebase';
import { FS_DELETE, type FsApi, type FsOp, type FsQuery, type FsRow, type Raw } from './fsApi';

const clean = (patch: Raw): DocumentData =>
  Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, v === FS_DELETE ? deleteField() : v]),
  );

function build(coll: string, q: FsQuery): Query {
  let out: Query = collection(db, coll);
  const parts = [
    ...(q.where ?? []).map(([f, op, v]) => where(f, op, v)),
    ...(q.orderBy ? [orderBy(q.orderBy[0], q.orderBy[1])] : []),
    ...(q.limit ? [fsLimit(q.limit)] : []),
  ];
  if (parts.length) out = query(out, ...parts);
  return out;
}

/** The shared `coachClients` answer: in flight, then reused this long (ms). */
const ROSTER_SHARE_MS = 5000;
const READS = new Set(['coachClients', 'coachRead', 'coachMyLink', 'coachLogRead']);

export function createFirebaseFs(): FsApi {
  // per instance (= per signed-in session): another account never sees this one's answer
  const roster = new Map<string, { p: Promise<unknown>; at: number; pending: boolean }>();
  return {
    async get(path) {
      const s = await getDoc(doc(db, path));
      return s.exists() ? (s.data() as Raw) : null;
    },
    set: (path, data) => setDoc(doc(db, path), data),
    update: (path, patch) => updateDoc(doc(db, path), clean(patch)),
    del: (path) => deleteDoc(doc(db, path)),
    async batch(ops: readonly FsOp[]) {
      const b = writeBatch(db);
      for (const o of ops) {
        const ref = doc(db, o.path);
        if (o.k === 'set') b.set(ref, o.data);
        else if (o.k === 'update') b.update(ref, clean(o.patch));
        else b.delete(ref);
      }
      await b.commit();
    },
    transact: (fn) =>
      runTransaction(db, (t) =>
        fn({
          async get(path) {
            const s = await t.get(doc(db, path));
            return s.exists() ? (s.data() as Raw) : null;
          },
          set: (path, data) => void t.set(doc(db, path), data),
        }),
      ),
    listenDoc(path, on, onError) {
      return onSnapshot(doc(db, path), (s) => on(s.exists() ? (s.data() as Raw) : null), onError);
    },
    listen(coll, q, on, onError) {
      return onSnapshot(
        build(coll, q),
        { includeMetadataChanges: false },
        (snap) =>
          on(
            snap.docs.map((d): FsRow => ({ id: d.id, data: d.data() as Raw })),
            snap.metadata.fromCache,
          ),
        onError,
      );
    },
    async getDocs(coll, q) {
      const snap = await getDocs(build(coll, q));
      return snap.docs.map((d): FsRow => ({ id: d.id, data: d.data() as Raw }));
    },
    call: <T>(name: string, data: Raw): Promise<T> => {
      // Anything that changes who is on the roster drops the shared answer.
      if (name !== 'coachClients') {
        if (/^(coach|admin)/.test(name) && !READS.has(name)) roster.clear();
        return callFn<T>(name, data, { quiet: true });
      }
      // The roster is asked for by several parts at once (world, share picker, live, schedule): one request, and its
      // answer for a few seconds, serve them all.
      const key = JSON.stringify(data);
      const hit = roster.get(key);
      if (hit && (hit.pending || Date.now() - hit.at < ROSTER_SHARE_MS)) return hit.p as Promise<T>;
      const p = callFn<T>(name, data, { quiet: true });
      const entry = { p: p as Promise<unknown>, at: Date.now(), pending: true };
      roster.set(key, entry);
      p.then(
        () => {
          entry.pending = false;
          entry.at = Date.now();
        },
        () => roster.delete(key),
      );
      return p;
    },
    now: () => Date.now(),
  };
}
