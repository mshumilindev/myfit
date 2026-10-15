/**
 * Delta (incremental) reads of a client's workouts for the trainer's dashboard: pure merge + verification logic.
 *
 * `coachRead` can answer `totals` / `sets` at consent `full` as "only the workouts changed since T" plus a token for the
 * whole window (`{ count, sum of updatedAt }`). This device keeps the previous raw answer per client (sealed, see
 * `deltaCache.ts`), upserts the delta by id and checks the result against the token. The rule is: a merged result is
 * used ONLY when it is provably what a full read would have returned; ANY doubt (no cache, old cache, other consent /
 * grant / key, wrong shape, token mismatch) is a full read, so a delta can never show something a full read would not.
 * Deleted workouts are caught by the count, edits we did not receive by the sum, and the daily full resync is the net
 * under everything the token cannot see (a content change that kept `updatedAt`).
 */
import type { Category, Consent } from '../../domain/types';
import type { Raw } from './fsApi';
import type { ReadCategory } from './worldMap';

export type DeltaCat = 'totals' | 'sets';
export const DELTA_CATS: readonly DeltaCat[] = ['totals', 'sets'];

/** The cache is rebuilt from a full read at least this often. */
export const FULL_RESYNC_MS = 24 * 60 * 60 * 1000;
/**
 * Device clocks write `updatedAt`: ask for changes from a little before the last read so a write from a slightly slow
 * clock is still in the delta (anything older is caught by the token and becomes a full read).
 */
export const DELTA_MARGIN_MS = 60 * 60 * 1000;
/** Bump when `DeltaEntry` changes shape: older entries are dropped. */
export const DELTA_SCHEMA = 1;

export interface DeltaEntry {
  /** server time of the last FULL read (`changedSince: 0`) */
  fullAt: number;
  /** server time of the last read (full or delta) */
  lastAt: number;
  /** grant version and key epoch the data was read under: a change of either invalidates the entry */
  consentVersion: number;
  keyEpoch: number;
  /** the raw documents per category, newest first (totals: with `updatedAt`, which the world never sees) */
  docs: Partial<Record<DeltaCat, Raw[]>>;
}

/** Written instead of removing the entry (the snapshot cache has no remove): never usable (`fullAt` 0 is past the resync age). */
export const INVALID_ENTRY: DeltaEntry = {
  fullAt: 0,
  lastAt: 0,
  consentVersion: -1,
  keyEpoch: -1,
  docs: {},
};

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export const isDeltaEntry = (e: unknown): e is DeltaEntry => {
  const x = e as Partial<DeltaEntry> | null;
  return (
    !!x &&
    num(x.fullAt) &&
    num(x.lastAt) &&
    num(x.consentVersion) &&
    num(x.keyEpoch) &&
    !!x.docs &&
    typeof x.docs === 'object' &&
    DELTA_CATS.every((k) => x.docs![k] === undefined || Array.isArray(x.docs![k]))
  );
};

/** The categories of this read a delta applies to: workout-based ones, at `full` only (below it the answer is a small view). */
export function deltaCats(consent: Consent, wanted: readonly Category[]): DeltaCat[] {
  return DELTA_CATS.filter((k) => wanted.includes(k) && consent[k] === 'full');
}

/**
 * The `changedSince` to send: the changes since the last read (minus a margin) when the cache may be used, else 0, which
 * the server answers with every workout (a full read that also primes the cache).
 */
export function changedSinceFor(
  entry: DeltaEntry | null,
  now: number,
  cur: { consentVersion: number; keyEpoch: number },
  cats: readonly DeltaCat[],
): number {
  if (!entry || !cats.length) return 0;
  const fresh = now - entry.fullAt >= 0 && now - entry.fullAt < FULL_RESYNC_MS;
  const sameCats =
    Object.keys(entry.docs).sort().join() === [...cats].sort().join() &&
    cats.every((k) => Array.isArray(entry.docs[k]));
  if (
    !fresh ||
    entry.lastAt > now ||
    entry.consentVersion !== cur.consentVersion ||
    entry.keyEpoch !== cur.keyEpoch ||
    !sameCats
  )
    return 0;
  return Math.max(0, entry.lastAt - DELTA_MARGIN_MS);
}

const byNewest = (a: Raw, b: Raw): number =>
  (b.startedAt as number) - (a.startedAt as number) ||
  ((b.id as string) < (a.id as string) ? -1 : (b.id as string) > (a.id as string) ? 1 : 0);

const isWorkoutDoc = (d: unknown): d is Raw => {
  const x = d as Raw | null;
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.id === 'string' &&
    x.id !== '' &&
    num(x.startedAt) &&
    num(x.updatedAt)
  );
};

/** Upserts `delta` into `prev` by id; newest first (the order of the full read). null when any document is not what we expect. */
export function mergeDelta(
  prev: readonly Raw[] | undefined,
  delta: readonly unknown[],
): Raw[] | null {
  const byId = new Map<string, Raw>();
  for (const d of prev ?? []) {
    if (!isWorkoutDoc(d)) return null;
    byId.set(d.id as string, d);
  }
  for (const d of delta) {
    if (!isWorkoutDoc(d)) return null;
    byId.set(d.id as string, d);
  }
  return [...byId.values()].sort(byNewest);
}

export const tokenOf = (docs: readonly Raw[]): { count: number; sum: number } => ({
  count: docs.length,
  sum: docs.reduce((a, d) => a + (d.updatedAt as number), 0),
});

const validToken = (t: unknown): t is { count: number; sum: number } => {
  const x = t as { count?: unknown; sum?: unknown } | null;
  return (
    !!x &&
    Number.isInteger(x.count) &&
    (x.count as number) >= 0 &&
    Number.isInteger(x.sum) &&
    (x.sum as number) >= 0
  );
};

type Ok = Extract<ReadCategory, { state: 'ok' }>;
const stripMeta = (r: ReadCategory): ReadCategory => {
  if (r.state !== 'ok') return r;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { delta, token, ...rest } = r as Ok & { delta?: unknown; token?: unknown };
  return rest as ReadCategory;
};

export interface SettleArgs {
  results: Partial<Record<Category, ReadCategory>>;
  /** the categories the delta was asked for */
  cats: readonly DeltaCat[];
  entry: DeltaEntry | null;
  /** what was sent (0 = a full read: the cache is ignored and rebuilt) */
  changedSince: number;
  serverTime: number;
  /** the consent version in the answer */
  resConsentVersion: number;
  /** the key epoch of the roster row the request was made under */
  keyEpoch: number;
}

export interface Settled {
  /** the results as a full read would have returned them (delta fields removed, `updatedAt` off the totals documents) */
  results: Partial<Record<Category, ReadCategory>>;
  /** categories whose delta could not be verified: they must be read in full (and are NOT in `results`) */
  failed: DeltaCat[];
  /** the entry to store, or null when nothing may be cached */
  entry: DeltaEntry | null;
}

/** Turns the answer of a (delta) read into the answer of a full read, or says which categories need a real full read. */
export function settleDelta(a: SettleArgs): Settled {
  const results: Partial<Record<Category, ReadCategory>> = {};
  const failed: DeltaCat[] = [];
  const docs: Partial<Record<DeltaCat, Raw[]>> = {};
  for (const [k, r] of Object.entries(a.results) as [Category, ReadCategory][]) {
    const cat = k as DeltaCat;
    const asked = a.cats.includes(cat);
    if (!asked || r.state !== 'ok' || r.level !== 'full') {
      results[k] = stripMeta(r);
      continue;
    }
    const x = r as Ok & { delta?: unknown; token?: unknown };
    if (x.delta !== true) {
      // the server could not (or did not know how to) prove a delta: this IS the plain full answer, but not cacheable
      results[k] = stripMeta(r);
      continue;
    }
    const base = a.changedSince === 0 ? [] : a.entry?.docs[cat];
    const merged =
      Array.isArray(x.docs) && base && validToken(x.token) ? mergeDelta(base, x.docs) : null;
    const t = merged ? tokenOf(merged) : null;
    if (
      !merged ||
      !t ||
      t.count !== (x.token as { count: number }).count ||
      t.sum !== (x.token as { sum: number }).sum
    ) {
      failed.push(cat);
      continue;
    }
    docs[cat] = merged;
    const out =
      cat === 'totals' ? merged.map(({ updatedAt, ...rest }) => (void updatedAt, rest)) : merged;
    results[k] = { ...stripMeta(r), docs: out } as ReadCategory;
  }
  const complete = !failed.length && a.cats.every((k) => docs[k]);
  return {
    results,
    failed,
    entry:
      complete && a.cats.length
        ? {
            fullAt: a.changedSince === 0 ? a.serverTime : (a.entry?.fullAt ?? 0),
            lastAt: a.serverTime,
            consentVersion: a.resConsentVersion,
            keyEpoch: a.keyEpoch,
            docs,
          }
        : null,
  };
}
