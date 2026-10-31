/**
 * Daily sync of the refused areas of Ukraine (SPO-408). The edge Worker reads one GeoJSON value from Cloudflare KV
 * (`edge/geo-block`); this job is the only writer. Nothing about the areas lives in the code or the repo, so a freed
 * area opens again with the next accepted version, without a release.
 *
 * Pure: all I/O is in `OccupiedPorts`. A bad or failed fetch never replaces the last good version (the Worker keeps
 * serving it); it only raises an alert line. The source and its terms are the owner's decision (DeepState: API for
 * commercial entities needs the copyright holder's approval, see docs/plans/SPO-408-dev-plan.md).
 */
import { createHash } from 'node:crypto';

type Pos = readonly [number, number];
type Ring = readonly Pos[];
type PolygonRings = readonly Ring[];

/** Largest accepted GeoJSON (bytes). The Worker parses it per isolate; KV itself would take far more. */
export const MAX_BYTES = 1_500_000;
/** A new version may differ from the last accepted one by at most this share (vertices and planar area). */
export const MAX_CHANGE = 0.35;
/** Alert when no version was confirmed for this long. */
export const STALE_DAYS = 3;

export interface Stats {
  polygons: number;
  vertices: number;
  /** Sum of the outer rings' planar area in square degrees: a cheap size signal, not a real area. */
  area: number;
  bytes: number;
}

export type Validation =
  { ok: true; raw: string; hash: string; stats: Stats } | { ok: false; reason: string };

const isPos = (p: unknown): p is Pos =>
  Array.isArray(p) &&
  p.length >= 2 &&
  typeof p[0] === 'number' &&
  typeof p[1] === 'number' &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

const isRing = (r: unknown): r is Ring => {
  if (!Array.isArray(r) || r.length < 4 || !r.every(isPos)) return false;
  const a = r[0] as Pos;
  const b = r[r.length - 1] as Pos;
  return a[0] === b[0] && a[1] === b[1];
};

const isPolygon = (p: unknown): p is PolygonRings =>
  Array.isArray(p) && p.length >= 1 && p.every(isRing);

const ringArea = (ring: Ring): number => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += ring[j]![0] * ring[i]![1] - ring[i]![0] * ring[j]![1];
  }
  return Math.abs(s) / 2;
};

/** Every polygon of a GeoJSON value; `null` when something that looks like an area is malformed. */
export function polygonsOf(json: unknown): PolygonRings[] | null {
  const out: PolygonRings[] = [];
  let bad = false;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: unknown;
      coordinates?: unknown;
      geometry?: unknown;
      features?: unknown;
    };
    if (n.type === 'FeatureCollection' && Array.isArray(n.features)) n.features.forEach(walk);
    else if (n.type === 'Feature') walk(n.geometry);
    else if (n.type === 'Polygon') {
      if (isPolygon(n.coordinates)) out.push(n.coordinates);
      else bad = true;
    } else if (n.type === 'MultiPolygon') {
      if (!Array.isArray(n.coordinates)) bad = true;
      else
        for (const p of n.coordinates) {
          if (isPolygon(p)) out.push(p);
          else bad = true;
        }
    }
  };
  walk(json);
  return bad ? null : out;
}

export function statsOf(polygons: readonly PolygonRings[], bytes: number): Stats {
  let vertices = 0;
  let area = 0;
  for (const p of polygons) {
    for (const ring of p) vertices += ring.length;
    area += ringArea(p[0]!);
  }
  return { polygons: polygons.length, vertices, area, bytes };
}

const change = (a: number, b: number): number =>
  b === 0 ? (a === 0 ? 0 : 1) : Math.abs(a - b) / b;

/**
 * A source answer becomes a version only when it is a non-empty, well-formed, reasonably sized GeoJSON that does not
 * jump away from the last accepted one. `prev` is the stats of that last version (null for the first one).
 */
export function validateAreas(raw: string, prev: Stats | null): Validation {
  const bytes = Buffer.byteLength(raw);
  if (bytes === 0) return { ok: false, reason: 'empty' };
  if (bytes > MAX_BYTES) return { ok: false, reason: 'too-large' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  const polygons = polygonsOf(json);
  if (polygons === null) return { ok: false, reason: 'bad-geometry' };
  if (polygons.length === 0) return { ok: false, reason: 'no-polygons' };
  const stats = statsOf(polygons, bytes);
  if (
    prev &&
    (change(stats.vertices, prev.vertices) > MAX_CHANGE ||
      change(stats.area, prev.area) > MAX_CHANGE)
  ) {
    return { ok: false, reason: 'sudden-change' };
  }
  return { ok: true, raw, hash: createHash('sha256').update(raw).digest('hex'), stats };
}

/**
 * The source may wrap the map (DeepState answers with an object that holds a GeoJSON under `map`; format not verified
 * until API access is granted). Only areas are kept (points, lines and labels are dropped); an optional name pattern
 * keeps just the features whose `name` matches. Returns the GeoJSON text to validate, or `null` when unreadable.
 */
export function areasFromSource(body: string, namePattern?: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const root = (json as { map?: unknown } | null)?.map ?? json;
  const re = namePattern ? new RegExp(namePattern, 'i') : null;
  const features: unknown[] = [];
  const take = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: unknown;
      features?: unknown;
      geometry?: { type?: unknown } | null;
      properties?: { name?: unknown } | null;
    };
    if (n.type === 'FeatureCollection' && Array.isArray(n.features)) n.features.forEach(take);
    else if (n.type === 'Feature') {
      const t = n.geometry?.type;
      const name = typeof n.properties?.name === 'string' ? n.properties.name : '';
      if ((t === 'Polygon' || t === 'MultiPolygon') && (!re || re.test(name))) features.push(n);
    } else if (n.type === 'Polygon' || n.type === 'MultiPolygon') {
      features.push({ type: 'Feature', properties: {}, geometry: n });
    }
  };
  take(root);
  return JSON.stringify({ type: 'FeatureCollection', features });
}

export interface JournalEntry {
  at: number;
  /** `accepted`, `unchanged` or `rejected`. */
  outcome: 'accepted' | 'unchanged' | 'rejected';
  hash?: string;
  stats?: Stats;
  reason?: string;
}

export interface OccupiedPorts {
  /** The source answer, as text. Throws when unreachable. */
  fetchSource(): Promise<string>;
  /** The last accepted version (hash and stats), or null before the first one. */
  current(): Promise<{ hash: string; stats: Stats } | null>;
  /** Writes the GeoJSON where the edge reads it (Cloudflare KV). Throws on failure. */
  publish(raw: string): Promise<void>;
  /** Appends to the version log (date, hash, outcome); remembers the last confirmation time. */
  record(entry: JournalEntry): Promise<void>;
  /** When a version was last accepted or confirmed unchanged, or null. */
  lastOk(): Promise<number | null>;
  /** Alert line sink: `console.error` in production (Cloud Logging severity ERROR). */
  alert(message: string): void;
  namePattern?: string;
}

export interface SyncResult {
  outcome: JournalEntry['outcome'] | 'failed';
  reason?: string;
}

export const isStale = (lastOk: number | null, now: number): boolean =>
  lastOk === null || now - lastOk > STALE_DAYS * 86_400_000;

/** One run. Never throws: a failure keeps the last good version in KV and raises an alert. */
export async function syncOccupied(ports: OccupiedPorts, now: number): Promise<SyncResult> {
  let result: SyncResult;
  try {
    const body = await ports.fetchSource();
    const text = areasFromSource(body, ports.namePattern);
    if (text === null) {
      await ports.record({ at: now, outcome: 'rejected', reason: 'not-json' });
      ports.alert('[occupied] rejected: source is not json');
      result = { outcome: 'rejected', reason: 'not-json' };
    } else {
      const cur = await ports.current();
      const v = validateAreas(text, cur?.stats ?? null);
      if (!v.ok) {
        await ports.record({ at: now, outcome: 'rejected', reason: v.reason });
        ports.alert(`[occupied] rejected: ${v.reason}`);
        result = { outcome: 'rejected', reason: v.reason };
      } else if (cur && cur.hash === v.hash) {
        await ports.record({ at: now, outcome: 'unchanged', hash: v.hash, stats: v.stats });
        result = { outcome: 'unchanged' };
      } else {
        await ports.publish(v.raw);
        await ports.record({ at: now, outcome: 'accepted', hash: v.hash, stats: v.stats });
        result = { outcome: 'accepted' };
      }
    }
  } catch (e) {
    ports.alert(`[occupied] failed: ${e instanceof Error ? e.name : 'error'}`);
    result = { outcome: 'failed' };
  }
  if (result.outcome === 'failed' || result.outcome === 'rejected') {
    if (isStale(await ports.lastOk().catch(() => null), now)) {
      ports.alert(`[occupied] stale: no version confirmed for over ${STALE_DAYS} days`);
    }
  }
  return result;
}
