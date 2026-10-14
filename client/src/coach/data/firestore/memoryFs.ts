/** In-memory `FsApi` (unit tests, stories): documents, queries, live listeners, transactions, scripted callables. */
import {
  FS_DELETE,
  idOf,
  type FsApi,
  type FsOp,
  type FsQuery,
  type FsRow,
  type Raw,
} from './fsApi';

const clone = <T>(x: T): T => structuredClone(x);
const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/'));

function getDeep(o: Raw, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Raw)[k] : undefined), o);
}
/** Apply one `update` entry (dotted key, `FS_DELETE` removes) to a document copy; the rules test layer reuses it. */
export function patchDeep(o: Raw, dotted: string, value: unknown): void {
  const ks = dotted.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Raw;
  }
  if (value === FS_DELETE) delete cur[ks[ks.length - 1]];
  else cur[ks[ks.length - 1]] = clone(value);
}

export class FsError extends Error {
  constructor(
    readonly code: string,
    message: string = code,
  ) {
    super(message);
  }
}

export interface MemoryFs extends FsApi {
  /** scripted callable results; throw to simulate failure */
  calls: { name: string; data: Raw }[];
  onCall(name: string, fn: (data: Raw) => unknown): void;
  /** every document as JSON text, for "no plaintext" assertions */
  dump(): string;
  has(path: string): boolean;
  /** paths of every stored document that starts with the prefix */
  keys(prefix?: string): string[];
  /** raw access that bypasses listeners-less bookkeeping (test seeding) */
  seed(path: string, data: Raw): void;
  setNow(t: number): void;
  /** make writes fail like an offline/permission error */
  failWrites(code: string | null): void;
  /** every write path in order */
  writes: string[];
}

export function createMemoryFs(startNow = 1_800_000_000_000): MemoryFs {
  const docs = new Map<string, Raw>();
  const docL = new Map<string, Set<(d: Raw | null) => void>>();
  const queryL = new Set<() => void>();
  const handlers = new Map<string, (data: Raw) => unknown>();
  const calls: { name: string; data: Raw }[] = [];
  const writes: string[] = [];
  let t = startNow;
  let failCode: string | null = null;

  const rows = (coll: string, q: FsQuery): FsRow[] => {
    let out: FsRow[] = [];
    for (const [p, d] of docs) if (parentOf(p) === coll) out.push({ id: idOf(p), data: clone(d) });
    for (const [f, op, v] of q.where ?? []) {
      out = out.filter((r) => {
        const x = getDeep(r.data, f) as number | string | boolean | undefined | null;
        if (op === '==') return x === v;
        if (x === undefined || x === null) return false;
        const a = x as number;
        const b = v as number;
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      });
    }
    if (q.orderBy) {
      const [f, dir] = q.orderBy;
      out.sort((a, b) => {
        const x = getDeep(a.data, f) as number;
        const y = getDeep(b.data, f) as number;
        return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1);
      });
    }
    return q.limit ? out.slice(0, q.limit) : out;
  };
  const notify = (path: string) => {
    docL.get(path)?.forEach((f) => f(docs.has(path) ? clone(docs.get(path)!) : null));
    queryL.forEach((f) => f());
  };
  const guard = () => {
    if (failCode) throw new FsError(failCode);
  };
  const apply = (o: FsOp) => {
    writes.push(`${o.k}:${o.path}`);
    if (o.k === 'set') docs.set(o.path, clone(o.data));
    else if (o.k === 'delete') docs.delete(o.path);
    else {
      const cur = docs.get(o.path);
      if (!cur) throw new FsError('not-found', o.path);
      const next = clone(cur);
      for (const [k, v] of Object.entries(o.patch)) patchDeep(next, k, v);
      docs.set(o.path, next);
    }
  };

  const fs: MemoryFs = {
    calls,
    writes,
    onCall: (n, f) => void handlers.set(n, f),
    dump: () => JSON.stringify([...docs]),
    has: (p) => docs.has(p),
    keys: (prefix = '') => [...docs.keys()].filter((k) => k.startsWith(prefix)),
    seed(p, d) {
      docs.set(p, clone(d));
      notify(p);
    },
    setNow: (n) => void (t = n),
    failWrites: (c) => void (failCode = c),
    now: () => t,
    async get(p) {
      const d = docs.get(p);
      return d ? clone(d) : null;
    },
    async set(p, d) {
      guard();
      apply({ k: 'set', path: p, data: d });
      notify(p);
    },
    async update(p, patch) {
      guard();
      apply({ k: 'update', path: p, patch });
      notify(p);
    },
    async del(p) {
      guard();
      apply({ k: 'delete', path: p });
      notify(p);
    },
    async batch(ops) {
      guard();
      const snap = new Map([...docs].map(([k, v]) => [k, clone(v)]));
      try {
        ops.forEach(apply);
      } catch (e) {
        docs.clear();
        snap.forEach((v, k) => docs.set(k, v));
        throw e;
      }
      new Set(ops.map((o) => o.path)).forEach(notify);
    },
    async transact(fn) {
      guard();
      const pending: [string, Raw][] = [];
      const out = await fn({
        get: async (p) => {
          const d = docs.get(p);
          return d ? clone(d) : null;
        },
        set: (p, d) => void pending.push([p, d]),
      });
      for (const [p, d] of pending) {
        apply({ k: 'set', path: p, data: d });
        notify(p);
      }
      return out;
    },
    listenDoc(p, on) {
      const set = docL.get(p) ?? new Set();
      docL.set(p, set);
      set.add(on);
      queueMicrotask(() => on(docs.has(p) ? clone(docs.get(p)!) : null));
      return () => void set.delete(on);
    },
    listen(coll, q, on) {
      let last = '';
      const run = () => {
        const r = rows(coll, q);
        const s = JSON.stringify(r);
        if (s === last) return;
        last = s;
        on(r, false);
      };
      queryL.add(run);
      queueMicrotask(run);
      return () => void queryL.delete(run);
    },
    async getDocs(coll, q) {
      return rows(coll, q);
    },
    async call<T>(name: string, data: Raw): Promise<T> {
      calls.push({ name, data: clone(data) });
      const h = handlers.get(name);
      if (!h) throw new FsError('unimplemented', name);
      return (await h(data)) as T;
    },
  };
  return fs;
}
