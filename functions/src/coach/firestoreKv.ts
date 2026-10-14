/**
 * Firestore Admin implementation of the `Kv` seam. Transactions buffer their writes and apply them after the
 * callback, so every read happens before the first write (a Firestore transaction requirement) while the service
 * code stays free to interleave reads and writes.
 */
import {
  FieldPath,
  type Firestore,
  type Query as FsQuery,
  type Transaction,
} from 'firebase-admin/firestore';
import type { Doc, Kv, Query, Row } from './kv';

type Write =
  | { k: 'set'; path: string; data: Doc }
  | { k: 'merge'; path: string; data: Doc }
  | { k: 'del'; path: string };

function applyQuery(base: FsQuery, q?: Query): FsQuery {
  let out = base;
  for (const [f, op, v] of q?.where ?? []) out = out.where(f, op === 'in' ? 'in' : op, v);
  // '' = from the start: Firestore rejects an empty document id as a cursor
  if (q?.after !== undefined) {
    out = out.orderBy(FieldPath.documentId());
    if (q.after !== '') out = out.startAfter(q.after);
  } else if (q?.orderBy) out = out.orderBy(q.orderBy[0], q.orderBy[1]);
  if (q?.limit) out = out.limit(q.limit);
  return out;
}

export function firestoreKv(db: Firestore): Kv {
  const rows = (snap: FirebaseFirestore.QuerySnapshot): Row[] =>
    snap.docs.map((d) => ({ id: d.id, path: d.ref.path, data: d.data() as Doc }));

  const base: Kv = {
    async get(path) {
      const s = await db.doc(path).get();
      return s.exists ? (s.data() as Doc) : null;
    },
    async set(path, data) {
      await db.doc(path).set(data);
    },
    async merge(path, patch) {
      await db.doc(path).update(patch);
    },
    async del(path) {
      await db.doc(path).delete();
    },
    async list(coll, q) {
      return rows(await applyQuery(db.collection(coll), q).get());
    },
    async group(id, q) {
      return rows(await applyQuery(db.collectionGroup(id), q).get());
    },
    async tx<T>(fn: (kv: Kv) => Promise<T>): Promise<T> {
      return db.runTransaction(async (tx: Transaction) => {
        const writes: Write[] = [];
        const kv: Kv = {
          async get(path) {
            const s = await tx.get(db.doc(path));
            return s.exists ? (s.data() as Doc) : null;
          },
          async set(path, data) {
            writes.push({ k: 'set', path, data });
          },
          async merge(path, data) {
            writes.push({ k: 'merge', path, data });
          },
          async del(path) {
            writes.push({ k: 'del', path });
          },
          async list(coll, q) {
            return rows(await tx.get(applyQuery(db.collection(coll), q)));
          },
          async group(id, q) {
            return rows(await tx.get(applyQuery(db.collectionGroup(id), q)));
          },
          tx: (inner) => inner(kv), // already inside a transaction
        };
        const result = await fn(kv);
        for (const w of writes) {
          const ref = db.doc(w.path);
          if (w.k === 'set') tx.set(ref, w.data);
          else if (w.k === 'merge') tx.update(ref, w.data);
          else tx.delete(ref);
        }
        return result;
      });
    },
  };
  return base;
}
