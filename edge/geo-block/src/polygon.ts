/**
 * Point-in-polygon for the "occupied territories" check (SPO-221 prototype). Pure functions over GeoJSON positions
 * `[longitude, latitude]`. No boundary data ships with the code: the areas come from `OCCUPIED_GEOJSON`, so the
 * source and its licence stay an owner decision (see docs/research/SPO-221-occupied-areas-spike.md).
 */
export type Position = readonly [number, number];
/** One polygon: the outer ring first, then holes. */
export type PolygonRings = readonly (readonly Position[])[];

const isPosition = (p: unknown): p is Position =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

const isRing = (r: unknown): r is readonly Position[] =>
  Array.isArray(r) && r.length >= 4 && r.every(isPosition);

const isPolygon = (p: unknown): p is PolygonRings =>
  Array.isArray(p) && p.length >= 1 && p.every(isRing);

function inRing(lon: number, lat: number, ring: readonly Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygon(lon: number, lat: number, polygon: PolygonRings): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !inRing(lon, lat, outer)) return false;
  return !holes.some((hole) => inRing(lon, lat, hole));
}

/** Every polygon found in a GeoJSON value; anything malformed is skipped (an unreadable file blocks nobody). */
export function parseAreas(raw: string | undefined): PolygonRings[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: PolygonRings[] = [];
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
    else if (n.type === 'Polygon' && isPolygon(n.coordinates)) out.push(n.coordinates);
    else if (n.type === 'MultiPolygon' && Array.isArray(n.coordinates)) {
      for (const p of n.coordinates) if (isPolygon(p)) out.push(p);
    }
  };
  walk(json);
  return out;
}

export function inAnyArea(lon: number, lat: number, areas: readonly PolygonRings[]): boolean {
  return areas.some((a) => inPolygon(lon, lat, a));
}
