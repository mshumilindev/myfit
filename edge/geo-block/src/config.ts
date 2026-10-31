/**
 * Which countries the edge refuses (SPO-184 / SPO-220). The list is configuration (`BLOCKED_COUNTRIES` in
 * `wrangler.toml` or the Cloudflare dashboard), never a literal in the code path. A missing, blank or unreadable value
 * falls back to the owner's list instead of turning the block off: a typo must not open the app.
 */
export const DEFAULT_BLOCKED_COUNTRIES = ['RU', 'BY', 'KP', 'IR'] as const;

/** The part of a Workers KV namespace the edge uses. */
export interface KvLike {
  get(key: string): Promise<string | null>;
}

/** KV key of the current GeoJSON of the refused areas; written by the scheduled sync (SPO-408), never by the edge. */
export const OCCUPIED_KEY = 'occupied-geojson';

export interface EdgeEnv {
  /** KV namespace holding the refused areas, so they change without a deploy (SPO-408). Falls back to `OCCUPIED_GEOJSON`. */
  OCCUPIED_KV?: KvLike;
  /** Comma / space separated ISO 3166-1 alpha-2 codes, e.g. "RU, BY, KP, IR". */
  BLOCKED_COUNTRIES?: string;
  /** Optional GeoJSON (Polygon / MultiPolygon / Feature / FeatureCollection) of areas to refuse by coordinates. */
  OCCUPIED_GEOJSON?: string;
}

export function parseCountries(raw: string | undefined): ReadonlySet<string> {
  const codes = (raw ?? '')
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return new Set(codes.length > 0 ? codes : DEFAULT_BLOCKED_COUNTRIES);
}
