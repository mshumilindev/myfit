/**
 * An `FsApi` that enforces `firestore.rules` (through `rulesEngine.ts`) in front of the in-memory store, for ONE
 * signed-in user. Hand it to the real client adapters and every read / write they make is checked against the rules
 * file, exactly as the emulator would: a write shape the rules refuse throws `permission-denied`, which is how the
 * suite catches "the client writes something the rules do not accept" without a Java emulator.
 *
 * Callables (`fs.call`) pass through: they are Cloud Functions and run with the Admin SDK (rules do not apply).
 * Queries are checked per returned document (a model: the real engine also needs the query itself to be provably
 * inside the rules, which only the emulator can prove).
 */
import {
  FS_DELETE,
  type FsApi,
  type FsOp,
  type FsQuery,
  type FsRow,
  type Raw,
} from '../../../client/src/coach/data/firestore/fsApi';
import {
  FsError,
  patchDeep,
  type MemoryFs,
} from '../../../client/src/coach/data/firestore/memoryFs';
import { decide, type Doc, type Op, type Rules } from './rulesEngine';

export interface Denial {
  op: Op;
  path: string;
  tried: string[];
}
export interface EnforcedFs extends FsApi {
  /** every refused operation, in order */
  denied: Denial[];
  /** every allowed write path, in order */
  allowedWrites: string[];
}

const clone = <T>(x: T): T => structuredClone(x);

export function enforceRules(
  rules: Rules,
  store: MemoryFs,
  who: { uid: string; role: 'member' | 'trainer' | 'admin' },
): EnforcedFs {
  const denied: Denial[] = [];
  const allowedWrites: string[] = [];
  const db = async (): Promise<Record<string, Doc>> => {
    const out: Record<string, Doc> = {};
    for (const k of store.keys()) out[k] = (await store.get(k)) as Doc;
    return out;
  };
  const ctx = (d: Record<string, Doc>, data?: Doc) => ({
    auth: { uid: who.uid, token: { role: who.role } },
    db: d,
    data,
    time: store.now(),
  });
  const check = (op: Op, path: string, d: Record<string, Doc>, data?: Doc) => {
    const r = decide(rules, op, path, ctx(d, data));
    if (!r.allowed) {
      denied.push({
        op,
        path,
        tried: r.tried.map((t) => t.line.slice(0, 80) + (t.error ? ` [${t.error}]` : '')),
      });
      throw new FsError('permission-denied', `${op} ${path}`);
    }
  };

  /** the document a write would leave behind (rules see it as request.resource.data) */
  const after = (op: FsOp, d: Record<string, Doc>): Doc | undefined => {
    if (op.k === 'set') return clone(op.data) as Doc;
    if (op.k === 'delete') return undefined;
    const cur = d[op.path];
    if (!cur) throw new FsError('not-found', op.path);
    const next = clone(cur);
    for (const [k, v] of Object.entries(op.patch))
      patchDeep(next as Raw, k, v === FS_DELETE ? FS_DELETE : v);
    return next;
  };
  const checkWrite = (op: FsOp, d: Record<string, Doc>) => {
    const kind: Op = op.k === 'delete' ? 'delete' : d[op.path] ? 'update' : 'create';
    if (op.k === 'update' && !d[op.path]) throw new FsError('not-found', op.path);
    check(kind, op.path, d, after(op, d));
    allowedWrites.push(`${kind}:${op.path}`);
  };
  const rowsOk = async (coll: string, rows: FsRow[]) => {
    const d = await db();
    for (const r of rows) check('list', `${coll}/${r.id}`, d);
  };

  return {
    denied,
    allowedWrites,
    now: () => store.now(),
    call: (n, data) => store.call(n, data),
    async get(path) {
      const d = await db();
      check('get', path, d);
      return store.get(path);
    },
    async set(path, data) {
      checkWrite({ k: 'set', path, data }, await db());
      return store.set(path, data);
    },
    async update(path, patch) {
      checkWrite({ k: 'update', path, patch }, await db());
      return store.update(path, patch);
    },
    async del(path) {
      checkWrite({ k: 'delete', path }, await db());
      return store.del(path);
    },
    async batch(ops) {
      // all or nothing: later ops see the earlier ones
      const d = await db();
      for (const op of ops) {
        checkWrite(op, d);
        const next = after(op, d);
        if (next) d[op.path] = next;
        else delete d[op.path];
      }
      return store.batch(ops);
    },
    async transact(fn) {
      const d = await db();
      return store.transact(async (tx) => {
        const writes: [string, Raw][] = [];
        const out = await fn({
          get: async (p) => {
            check('get', p, d);
            return tx.get(p);
          },
          set: (p, data) => {
            writes.push([p, data]);
            tx.set(p, data);
          },
        });
        for (const [p, data] of writes) checkWrite({ k: 'set', path: p, data }, d);
        return out;
      });
    },
    listenDoc(path, on, onError) {
      return store.listenDoc(
        path,
        (doc) => {
          void db().then((d) => {
            try {
              check('get', path, d);
            } catch (e) {
              onError(e);
              return;
            }
            on(doc);
          });
        },
        onError,
      );
    },
    listen(coll, q: FsQuery, on, onError) {
      return store.listen(
        coll,
        q,
        (rows, fromCache) => {
          void rowsOk(coll, rows).then(
            () => on(rows, fromCache),
            (e) => onError(e),
          );
        },
        onError,
      );
    },
    async getDocs(coll, q) {
      const rows = await store.getDocs(coll, q);
      await rowsOk(coll, rows);
      return rows;
    },
  };
}
