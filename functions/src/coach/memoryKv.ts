/** In-memory Kv for tests (single-threaded: `tx` simply runs and rolls back by snapshot when the callback throws). */
import { getPath, type Doc, type Kv, type Query, type Row } from './kv';

const clone = <T>(x: T): T => structuredClone(x);

function setDeep(o: Doc, dotted: string, value: unknown): void {
  const ks = dotted.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Doc;
  }
  cur[ks[ks.length - 1]] = value;
}

function applyQuery(rows: Row[], q?: Query): Row[] {
  let out = rows;
  for (const [f, op, v] of q?.where ?? []) {
    out = out.filter((r) => {
      const x = getPath(r.data, f) as number | null | undefined;
      if (op === '==') return x === v;
      if (x === undefined || x === null) return false;
      if (op === 'in') return (v as unknown[]).includes(x);
      if (op === '<') return x < (v as number);
      if (op === '<=') return x <= (v as number);
      if (op === '>') return x > (v as number);
      return x >= (v as number);
    });
  }
  if (q?.after !== undefined) {
    out = [...out].filter((r) => r.id > q.after!).sort((a, b) => (a.id < b.id ? -1 : 1));
  } else if (q?.orderBy) {
    const [f, dir] = q.orderBy;
    out = [...out].sort((a, b) => {
      const x = getPath(a.data, f) as number;
      const y = getPath(b.data, f) as number;
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1);
    });
  }
  return q?.limit ? out.slice(0, q.limit) : out;
}

export interface MemoryKv extends Kv {
  /** every stored document as JSON text (for "no plaintext" assertions) */
  dump(): string;
  has(path: string): boolean;
  paths(): string[];
}

export function createMemoryKv(): MemoryKv {
  let docs = new Map<string, Doc>();
  const idOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
  const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const kv: MemoryKv = {
    async get(p) {
      const d = docs.get(p);
      return d ? clone(d) : null;
    },
    async set(p, data) {
      docs.set(p, clone(data));
    },
    async merge(p, patch) {
      const cur = docs.get(p);
      if (!cur) throw new Error('not-found');
      const next = clone(cur);
      for (const [k, v] of Object.entries(patch)) setDeep(next, k, clone(v));
      docs.set(p, next);
    },
    async del(p) {
      docs.delete(p);
    },
    async list(coll, q) {
      const rows: Row[] = [];
      for (const [p, d] of docs)
        if (parent(p) === coll) rows.push({ id: idOf(p), path: p, data: clone(d) });
      return applyQuery(rows, q);
    },
    async aggregate(coll, q, sumField) {
      const rows = await kv.list(coll, { where: q?.where });
      const sum = sumField
        ? rows.reduce((a, r) => {
            const x = getPath(r.data, sumField);
            return typeof x === 'number' && Number.isFinite(x) ? a + x : a;
          }, 0)
        : 0;
      return { count: rows.length, sum };
    },
    async group(id, q) {
      const rows: Row[] = [];
      for (const [p, d] of docs)
        if (parent(p).split('/').pop() === id) rows.push({ id: idOf(p), path: p, data: clone(d) });
      return applyQuery(rows, q);
    },
    async tx(fn) {
      const snap = new Map([...docs].map(([k, v]) => [k, clone(v)]));
      try {
        return await fn(kv);
      } catch (e) {
        docs = snap;
        throw e;
      }
    },
    dump: () => JSON.stringify([...docs]),
    has: (p) => docs.has(p),
    paths: () => [...docs.keys()].sort(),
  };
  return kv;
}
