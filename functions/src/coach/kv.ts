/**
 * Minimal document-store seam under the coaching services. The Firestore Admin implementation lives in
 * `firestoreKv.ts`; `memoryKv.ts` is the in-memory one the unit tests run on (no emulator needed).
 * Paths are 'a/b/c' (collection/doc/collection/...). Field paths in `where` / `orderBy` may be dotted ('del.state').
 */
export type Doc = Record<string, unknown>;
export type Op = '==' | '<' | '<=' | '>' | '>=' | 'in';
export interface Query {
  where?: readonly (readonly [field: string, op: Op, value: unknown])[];
  orderBy?: readonly [field: string, dir: 'asc' | 'desc'];
  limit?: number;
  /** keyset pagination by DOCUMENT ID: orders by id ascending and returns ids strictly after this one */
  after?: string;
}
export interface Row {
  id: string;
  path: string;
  data: Doc;
}
export interface Kv {
  get(path: string): Promise<Doc | null>;
  /** replace the whole document */
  set(path: string, data: Doc): Promise<void>;
  /** update the given fields (dotted keys allowed); throws `not-found` when the document does not exist */
  merge(path: string, patch: Doc): Promise<void>;
  del(path: string): Promise<void>;
  /** documents of ONE collection path */
  list(collection: string, q?: Query): Promise<Row[]>;
  /**
   * Server-side aggregate over ONE collection path (`where` only): how many documents match and the sum of `sumField`
   * over the matching ones (documents where it is not a number add nothing). Cheap: no document is transferred.
   */
  aggregate(
    collection: string,
    q?: Pick<Query, 'where'>,
    sumField?: string,
  ): Promise<{ count: number; sum: number }>;
  /** collection group: every collection with this id, any depth */
  group(collectionId: string, q?: Query): Promise<Row[]>;
  /** all-or-nothing section; reads inside see a consistent view */
  tx<T>(fn: (kv: Kv) => Promise<T>): Promise<T>;
}

export const getPath = (o: Doc, p: string): unknown =>
  p
    .split('.')
    .reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Doc)[k] : undefined), o);
