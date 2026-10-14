/**
 * The seam under every real coach adapter: a tiny document-store + callable API. `firebaseFs.ts` implements it with
 * the Firestore web SDK and `callFn`; `memoryFs.ts` implements it in memory so each adapter is unit-tested without
 * Firebase. Adapters never import `firebase/*` themselves (plan 2.6: components and adapters talk to ports).
 */
export type Raw = Record<string, unknown>;
export type Unsub = () => void;

/** In an `update` patch: remove this field (Firestore `deleteField()`). */
export const FS_DELETE = Symbol.for('spotter.fs.delete');

export interface FsRow {
  id: string;
  data: Raw;
}
export type FsOp =
  | { k: 'set'; path: string; data: Raw }
  | { k: 'update'; path: string; patch: Raw }
  | { k: 'delete'; path: string };

export interface FsQuery {
  where?: readonly (readonly [field: string, op: '==' | '<' | '<=' | '>' | '>=', value: unknown])[];
  orderBy?: readonly [field: string, dir: 'asc' | 'desc'];
  limit?: number;
}

export interface FsTx {
  get(path: string): Promise<Raw | null>;
  set(path: string, data: Raw): void;
}

export interface FsApi {
  get(path: string): Promise<Raw | null>;
  set(path: string, data: Raw): Promise<void>;
  /** dotted keys allowed ('readUpTo.uid'); values may be `FS_DELETE` */
  update(path: string, patch: Raw): Promise<void>;
  del(path: string): Promise<void>;
  /** all or nothing */
  batch(ops: readonly FsOp[]): Promise<void>;
  /** optimistic transaction (reads first, then writes) */
  transact<T>(fn: (tx: FsTx) => Promise<T>): Promise<T>;
  listenDoc(path: string, on: (d: Raw | null) => void, onError: (e: unknown) => void): Unsub;
  listen(
    collection: string,
    q: FsQuery,
    on: (rows: FsRow[], fromCache: boolean) => void,
    onError: (e: unknown) => void,
  ): Unsub;
  getDocs(collection: string, q: FsQuery): Promise<FsRow[]>;
  /** HTTPS callable; rejects with an `HttpError`-like `{ status, message }` */
  call<T>(name: string, data: Raw): Promise<T>;
  now(): number;
}

/** Document id of a path ('a/b/c' -> 'c'). */
export const idOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
