/**
 * Gym place-search providers (AC-SEARCH-01…11).
 *
 * Pure client logic — no design/styling here. The UI (provider chips,
 * skeleton rows, merged-row layout) is owned by the design-system layer.
 *
 * Resolution order (venue): local DB → OpenStreetMap. Providers run in PARALLEL, stream results as each answers, and
 * identical venues merge into one row that lists every contributing source.
 */
import { detectAmenities, unionAmenities } from './gymAmenities';
import { GeoConsentError, assertGeoSearchOn, geoSignal, isGeoSearchOn } from './geoSearchGate';
import type { Gym } from '../types';

/**
 * Every request to a place or map service goes through here: no consent, no request (throws `GeoConsentError` before
 * `fetch` is reached).
 */
function geoFetch(input: string, init?: RequestInit): Promise<Response> {
  assertGeoSearchOn();
  // Switching gym search off also cancels a request already on its way.
  const signal = geoSignal(init?.signal ?? undefined);
  return fetch(input, { ...init, signal });
}

export type ProviderId = 'local' | 'osm' | 'overpass' | 'google';

export interface PlaceResult {
  /** Stable within a provider; used only for React keys before merge. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  /** Free-form address/locality line, when the provider gives one. */
  address?: string;
  /** Venue-attached photo URL, if any (AC-IMG-01 step 1). */
  photoUrl?: string;
  /** Google Places photo reference (fetched through our proxy, only with consent). */
  googlePhotoName?: string;
  /** Photo author names Google asks to show next to the photo. */
  googlePhotoBy?: string[];
  /** Provider-native id, used for id-based merge (AC-SEARCH-05b). */
  externalId?: string;
  /** OSM `wikimedia_commons` tag (e.g. "File:Foo.jpg") — lazy photo resolve. */
  wikimediaCommons?: string;
  /** OSM `wikidata` QID of the venue itself — its Wikidata image (P18) is a venue photo. */
  venueWikidata?: string;
  /** OSM `brand:wikidata` QID — brand-logo fallback when no venue photo. */
  brandWikidata?: string;
  /** Detected facilities (gymAmenities ids) from place tags + name. */
  amenities?: string[];
  sources: ProviderId[];
}

export type ProviderState =
  | { status: 'pending' }
  | { status: 'answered'; count: number }
  | { status: 'failed'; reason: string }
  | { status: 'skipped'; reason: string };

export interface Coords {
  lat: number;
  lng: number;
}

// --- geo + string helpers --------------------------------------------------

export function haversineM(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9а-яїієґ ]/gi, '')
    .replace(/\b(gym|fitness|club|center|centre|studio)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance (AC-SEARCH-05a: names within ≤ 2). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * Two places are the same venue when (a) within 60 m AND normalized names
 * differ by ≤ 2 edits, or (b) they share a linked external id (AC-SEARCH-05).
 */
export function sameVenue(a: PlaceResult, b: PlaceResult): boolean {
  if (a.externalId && b.externalId && a.externalId === b.externalId) return true;
  const near = haversineM(a, b) <= 60;
  const alike = levenshtein(normalizeName(a.name), normalizeName(b.name)) <= 2;
  return near && alike;
}

/** Merge b into a: keep a's identity, union sources, fill missing photo. */
function mergeInto(a: PlaceResult, b: PlaceResult): void {
  for (const src of b.sources) if (!a.sources.includes(src)) a.sources.push(src);
  if (!a.photoUrl && b.photoUrl) a.photoUrl = b.photoUrl;
  if (!a.address && b.address) a.address = b.address;
  if (!a.googlePhotoName && b.googlePhotoName) {
    a.googlePhotoName = b.googlePhotoName;
    a.googlePhotoBy = b.googlePhotoBy;
  }
  if (!a.externalId && b.externalId) a.externalId = b.externalId;
  if (!a.wikimediaCommons && b.wikimediaCommons) a.wikimediaCommons = b.wikimediaCommons;
  if (!a.brandWikidata && b.brandWikidata) a.brandWikidata = b.brandWikidata;
  if (!a.venueWikidata && b.venueWikidata) a.venueWikidata = b.venueWikidata;
  if (a.amenities || b.amenities) a.amenities = unionAmenities(a.amenities, b.amenities);
}

/**
 * Fold a new provider's results into the accumulator, merging duplicates.
 * Never reorders existing rows (AC-SEARCH-04): merges in place, appends new.
 */
export function mergeResults(acc: PlaceResult[], incoming: PlaceResult[]): PlaceResult[] {
  for (const r of incoming) {
    const hit = acc.find((x) => sameVenue(x, r));
    if (hit) mergeInto(hit, r);
    else acc.push({ ...r, sources: [...r.sources] });
  }
  return acc;
}

// --- providers -------------------------------------------------------------

interface ProviderCtx {
  query: string;
  coords: Coords | null;
  savedGyms: Gym[];
  signal: AbortSignal;
}

type Provider = (ctx: ProviderCtx) => Promise<PlaceResult[]>;

const localProvider: Provider = async ({ query, savedGyms }) => {
  const q = normalizeName(query);
  if (!q) return [];
  return savedGyms
    .filter((g) => normalizeName(g.name).includes(q))
    .map((g) => ({
      key: `local:${g.id}`,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      externalId: `local:${g.id}`,
      sources: ['local'] as ProviderId[],
    }));
};

/**
 * OpenStreetMap via Photon (photon.komoot.io) — free, keyless, tuned for
 * type-ahead: "Zdro" already suggests "Zdrofit". Photon ranks by text +
 * importance (not distance) and returns OSM nodes with EXACT coordinates, so
 * the caller's nearest-first sort places the closest branch on top. We request
 * a generous limit (40) because a chain's closest branch can sit well below its
 * flagship in importance order — at limit 12 the nearest gym could be missing
 * entirely (the reason a bare "Zdrofit" once hid the 50 m branch).
 */
/** Cyrillic → Latin transliteration so "Здрофіт" also finds "Zdrofit". */
const CYR_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ё: 'e',
  ы: 'y',
  э: 'e',
  ъ: '',
};

function transliterate(q: string): string {
  return q
    .toLowerCase()
    .split('')
    .map((ch) => (ch in CYR_LATIN ? CYR_LATIN[ch] : ch))
    .join('');
}

/** Search variants for a query: itself, plus a Latin transliteration if it has
 *  Cyrillic letters (chains are usually indexed in OSM under their Latin name). */
function queryVariants(query: string): string[] {
  const variants = [query];
  if (/[\u0400-\u04ff]/i.test(query)) {
    const t = transliterate(query);
    if (t && t !== query.toLowerCase()) variants.push(t);
  }
  return variants;
}

const osmProvider: Provider = async ({ query, coords, signal }) => {
  const lists = await Promise.all(queryVariants(query).map((q) => photonOnce(q, coords, signal)));
  const merged: PlaceResult[] = [];
  for (const l of lists) mergeResults(merged, l);
  return merged;
};

export function bboxAround(coords: Coords, radiusM: number): [number, number, number, number] {
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.max(0.1, Math.cos((coords.lat * Math.PI) / 180)));
  return [
    coords.lat - latDelta,
    coords.lng - lngDelta,
    coords.lat + latDelta,
    coords.lng + lngDelta,
  ];
}

/** `sport` values that mean a gym; the tag may hold a `;` list ("fitness;yoga"). */
const GYM_SPORT = 'fitness|gym|weightlifting|crossfit|bodybuilding|powerlifting|calisthenics';
const GYM_SPORT_RE = new RegExp(`(^|;)(${GYM_SPORT})(;|$)`);
/** Overpass answers 429/5xx under load; one polite retry recovers most of them. */
const OVERPASS_RETRY_STATUS = new Set([429, 502, 503, 504]);
/** Delays before each retry: the public instance is often overloaded for a few seconds (502/504 in a row). */
const OVERPASS_RETRY_DELAYS_MS = [700, 2500, 6000];
/** Overpass returns elements in no distance order, so a low cap drops the nearest ones in dense cities. */
const OVERPASS_LIMIT = 300;

/**
 * Whether OSM tags can be a gym. `leisure=sports_centre` is also a pool, a stadium or a tennis hall: those stay out
 * when their `sport` tag names something else, and stay in when it names a gym sport or there is no `sport` tag.
 */
export function isGymLike(tags: Record<string, string | undefined> | undefined): boolean {
  if (!tags) return true;
  if (tags.amenity === 'gym' || tags.leisure === 'fitness_centre') return true;
  if (tags.sport && GYM_SPORT_RE.test(tags.sport)) return true;
  return !(tags.leisure === 'sports_centre' && tags.sport);
}

function overpassQuery(bbox: string): string {
  const sport = `(^|;)(${GYM_SPORT})(;|$)`;
  return `
    [out:json][timeout:12];
    (
      nwr["leisure"~"^(fitness_centre|sports_centre)$"](${bbox});
      nwr["amenity"="gym"](${bbox});
      nwr["sport"~"${sport}"](${bbox});
    );
    out center tags ${OVERPASS_LIMIT};
  `;
}

async function overpassFetch(query: string, signal: AbortSignal): Promise<Response> {
  const send = () =>
    geoFetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }),
    });
  let res = await send();
  for (const delay of OVERPASS_RETRY_DELAYS_MS) {
    if (!OVERPASS_RETRY_STATUS.has(res.status)) return res;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('aborted', 'AbortError'));
        },
        { once: true },
      );
    });
    res = await send();
  }
  return res;
}

async function overpassNearbyGyms(
  coords: Coords,
  radiusM: number,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const [south, west, north, east] = bboxAround(coords, radiusM);
  const res = await overpassFetch(overpassQuery(`${south},${west},${north},${east}`), signal);
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = (await res.json()) as {
    elements?: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, string | undefined>;
    }>;
  };
  return (data.elements ?? [])
    .map((el): PlaceResult | null => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      // A venue tagged only with its chain (`brand`/`operator`) still has a usable name.
      const name = (el.tags?.name ?? el.tags?.brand ?? el.tags?.operator)?.trim();
      if (!name || lat === undefined || lng === undefined || !isGymLike(el.tags)) return null;
      const address = [
        [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' '),
        el.tags?.['addr:city'],
      ]
        .filter(Boolean)
        .join(', ');
      return {
        key: `overpass:${el.type}${el.id}`,
        name,
        lat,
        lng,
        address: address || undefined,
        externalId: `osm:${el.type}${el.id}`,
        wikimediaCommons: el.tags?.wikimedia_commons,
        venueWikidata: el.tags?.wikidata,
        brandWikidata: el.tags?.['brand:wikidata'],
        amenities: detectAmenities({ tags: el.tags, name }),
        sources: ['overpass'] as ProviderId[],
      };
    })
    .filter((r): r is PlaceResult => !!r)
    .filter((r) => haversineM(coords, r) <= radiusM)
    .sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
}

export async function searchNearbyGyms(
  coords: Coords,
  radiusM: number,
  savedGyms: Gym[],
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const local = savedGyms
    .filter((g) => haversineM(coords, g) <= radiusM)
    .map((g) => ({
      key: `local:${g.id}`,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      externalId: `local:${g.id}`,
      sources: ['local'] as ProviderId[],
    }));
  const merged = [...local];
  // No consent: the saved gyms only, nothing asked of Overpass.
  if (!isGeoSearchOn()) return merged.sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  mergeResults(merged, await overpassNearbyGyms(coords, radiusM, signal));
  return merged.sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
}

/** Photon names OSM element types N/W/R; Overpass says node/way/relation. One vocabulary lets the ids merge a venue. */
const PHOTON_OSM_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

/**
 * Nearby gyms from two independent sources at once: Overpass (every OSM place tagged as a gym, by tag) and Photon
 * (text search with a location bias, which also finds venues Overpass lacks a tag for). Streams the merged list,
 * nearest first, as each answers; one source failing never hides the other (a failure is logged, not thrown).
 */
export async function searchNearbyGymsMerged(
  coords: Coords,
  radiusM: number,
  query: string,
  savedGyms: Gym[],
  signal: AbortSignal,
  onResults: (merged: PlaceResult[]) => void,
): Promise<PlaceResult[]> {
  const acc: PlaceResult[] = [];
  const nearestFirst = () => [...acc].sort((a, b) => haversineM(coords, a) - haversineM(coords, b));
  // Gyms around here seen in the last day show at once (stale-while-revalidate), then the services refresh the list.
  const cacheQuery = `nearby:${radiusM}:${query}`;
  const seen = readCache(cacheQuery, coords);
  if (seen?.length && !signal.aborted) onResults(seen);
  const fold = (rows: PlaceResult[]) => {
    if (signal.aborted) return;
    mergeResults(acc, rows);
    onResults(nearestFirst());
  };
  const guarded = async (name: string, job: Promise<PlaceResult[]>) => {
    try {
      fold(await job);
    } catch (err) {
      if (signal.aborted || err instanceof GeoConsentError) return;
      console.warn(`[gym-nearby] ${name} failed:`, err instanceof Error ? err.message : 'failed');
    }
  };
  await Promise.all([
    guarded('overpass', searchNearbyGyms(coords, radiusM, savedGyms, signal)),
    guarded('photon', photonNearby(query, coords, radiusM, signal)),
    guarded('google', googleNearby(coords, radiusM)),
  ]);
  const fresh = nearestFirst();
  if (!signal.aborted && fresh.length > 0) writeCache(cacheQuery, coords, fresh);
  return fresh;
}

/** Words that find gyms in Photon when Overpass is down; the same host and consent as the plain search. */
const PHOTON_NEARBY_TERMS = ['fitness', 'fitness club', 'siłownia', 'crossfit', 'sports centre'];

/**
 * Photon ranks by text, not distance, so one query returns only a few gyms near the person. Several gym words (one
 * request each, same host) fill the list when Overpass is overloaded; a failed word never hides the others.
 */
async function photonNearby(
  query: string,
  coords: Coords,
  radiusM: number,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const terms = [...new Set([query, ...PHOTON_NEARBY_TERMS])];
  const lists = await Promise.all(
    terms.map((t) =>
      osmProvider({ query: t, coords, savedGyms: [], signal }).catch((err) => {
        if (signal.aborted || err instanceof GeoConsentError) throw err;
        return [] as PlaceResult[];
      }),
    ),
  );
  const merged: PlaceResult[] = [];
  for (const l of lists) mergeResults(merged, l);
  return merged.filter((r) => haversineM(coords, r) <= radiusM);
}

async function photonOnce(
  query: string,
  coords: Coords | null,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q: query, limit: '40' });
  if (coords) {
    params.set('lat', String(coords.lat));
    params.set('lon', String(coords.lng));
  }
  const res = await geoFetch(`https://photon.komoot.io/api/?${params}`, {
    signal,
    headers: { 'Accept-Language': navigator.language || 'en' },
  });
  if (!res.ok) throw new Error(`osm ${res.status}`);
  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        osm_id?: number;
        osm_type?: string;
        name?: string;
        street?: string;
        housenumber?: string;
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
      };
    }>;
  };
  return (data.features ?? [])
    .filter((f) => f.properties?.name && f.geometry?.coordinates)
    .map((f) => {
      const pr = f.properties!;
      const c = f.geometry!.coordinates!;
      const addr = [
        [pr.street, pr.housenumber].filter(Boolean).join(' '),
        pr.city,
        pr.state,
        pr.country,
      ]
        .filter(Boolean)
        .join(', ');
      const osmType = PHOTON_OSM_TYPE[pr.osm_type ?? ''] ?? pr.osm_type ?? '';
      return {
        key: `osm:${osmType}${pr.osm_id ?? Math.round(c[0] * 1e6)}`,
        name: pr.name!,
        lat: c[1],
        lng: c[0],
        address: addr || undefined,
        externalId: pr.osm_id ? `osm:${osmType}${pr.osm_id}` : undefined,
        amenities: detectAmenities({ name: pr.name }),
        sources: ['osm'] as ProviderId[],
      };
    });
}

/** A provider that can't run (missing key) throws this → chip state 'skipped'. */
class SkipError extends Error {}

interface GooglePlacesRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  photoName?: string;
  photoBy?: string[];
}

/**
 * Google Places through our own Cloud Function (the key stays on the server; the function re-checks the consent record
 * that names Google). Needs the same gym-search consent on the client; not configured / no consent → skipped, not failed.
 */
/** Loaded on first use: the Firebase client is not pulled into every module that only reads gym data. */
const loadCallFn = async () => (await import('../api')).callFn;

async function callGoogle(payload: Record<string, unknown>): Promise<GooglePlacesRow[]> {
  assertGeoSearchOn();
  try {
    const callFn = await loadCallFn();
    const res = await callFn<{ places?: GooglePlacesRow[] }>('gymPlaces', payload, { quiet: true });
    return res?.places ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Consent not recorded for Google / key not configured / not signed in: nothing to show, not an error.
    if (/no-consent|not-configured|unauthenticated|permission-denied/.test(msg))
      throw new SkipError(msg);
    throw err;
  }
}

function googleToPlace(r: GooglePlacesRow): PlaceResult {
  return {
    key: `google:${r.id}`,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    externalId: `google:${r.id}`,
    googlePhotoName: r.photoName,
    googlePhotoBy: r.photoBy,
    amenities: detectAmenities({ name: r.name }),
    sources: ['google'],
  };
}

const googleProvider: Provider = async ({ query, coords }) => {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await callGoogle(
    coords ? { op: 'search', q, lat: coords.lat, lng: coords.lng } : { op: 'search', q },
  );
  return rows.map(googleToPlace);
};

async function googleNearby(coords: Coords, radiusM: number): Promise<PlaceResult[]> {
  const rows = await callGoogle({ op: 'nearby', lat: coords.lat, lng: coords.lng, radiusM });
  return rows.map(googleToPlace);
}

async function googlePhoto(r: PlaceResult): Promise<GymPhoto | null> {
  if (!r.googlePhotoName) return null;
  const callFn = await loadCallFn();
  const res = await callFn<{ photo?: string | null }>(
    'gymPlaces',
    { op: 'photo', name: r.googlePhotoName },
    { quiet: true },
  );
  if (!res?.photo) return null;
  const by = r.googlePhotoBy?.filter(Boolean).join(', ');
  return { url: res.photo, credit: { author: by ? `${by} (Google)` : 'Google' } };
}

/**
 * A saved gym carries no Google reference, so its photo is found the way a person would: search Google by its name near
 * its coordinates and accept only a hit that is the same place (within 250 m). Only the reference (photo name + authors)
 * is remembered, for a day, so a list of gyms does not search again on every card; the image itself is not stored.
 */
const GLOOKUP_PREFIX = 'gym.glookup.';
const GLOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const GLOOKUP_MISS_TTL_MS = 10 * 60_000;
const GLOOKUP_MAX_M = 250;
const GLOOKUP_RETRY_MS = 60_000;
const GLOOKUP_FAILED = new Map<string, number>();

function glookupKey(r: PlaceResult): string {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `${GLOOKUP_PREFIX}${normalizeName(r.name)}|${round(r.lat)},${round(r.lng)}`;
}

async function googleLookup(r: PlaceResult): Promise<PlaceResult | null> {
  if (!r.name.trim() || (r.lat === 0 && r.lng === 0)) return null;
  const k = glookupKey(r);
  try {
    const raw = localStorage.getItem(k);
    if (raw) {
      const hit = JSON.parse(raw) as { at: number; photoName?: string; photoBy?: string[] };
      // A miss is remembered only briefly: the place may get a photo (or the backend be fixed) soon.
      if (Date.now() - hit.at < (hit.photoName ? GLOOKUP_TTL_MS : GLOOKUP_MISS_TTL_MS))
        return hit.photoName
          ? { ...r, googlePhotoName: hit.photoName, googlePhotoBy: hit.photoBy }
          : null;
    }
  } catch {
    /* unreadable cache: look it up again */
  }
  // A lookup that just failed (backend down, no consent record, not signed in) is not repeated for every card at once.
  const failedAt = GLOOKUP_FAILED.get(k);
  if (failedAt && Date.now() - failedAt < GLOOKUP_RETRY_MS) return null;
  let rows: GooglePlacesRow[];
  try {
    rows = await callGoogle({ op: 'search', q: r.name.trim(), lat: r.lat, lng: r.lng });
  } catch (e) {
    GLOOKUP_FAILED.set(k, Date.now());
    throw e;
  }
  const best = rows
    .filter((x) => x.photoName && haversineM(r, x) <= GLOOKUP_MAX_M)
    .sort((a, b) => haversineM(r, a) - haversineM(r, b))[0];
  try {
    localStorage.setItem(
      k,
      JSON.stringify({ at: Date.now(), photoName: best?.photoName, photoBy: best?.photoBy }),
    );
  } catch {
    /* quota: fine */
  }
  return best ? { ...r, googlePhotoName: best.photoName, googlePhotoBy: best.photoBy } : null;
}

const PROVIDERS: { id: ProviderId; run: Provider }[] = [
  { id: 'local', run: localProvider },
  { id: 'osm', run: osmProvider },
  { id: 'google', run: googleProvider },
];

export interface SearchHandlers {
  /** Called whenever a provider answers, with the full merged list so far. */
  onResults: (merged: PlaceResult[]) => void;
  /** Called on every provider state transition (for the chips). */
  onProvider: (id: ProviderId, state: ProviderState) => void;
}

// --- 24 h cache per (query, rounded 100 m) — AC-SEARCH-11 ------------------

const CACHE_PREFIX = 'gym.search.';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(query: string, coords: Coords | null): string {
  const round = (n: number) => Math.round(n * 1000) / 1000; // ~100 m
  const loc = coords ? `${round(coords.lat)},${round(coords.lng)}` : 'noloc';
  return `${CACHE_PREFIX}${normalizeName(query)}|${loc}`;
}

export function readCache(query: string, coords: Coords | null): PlaceResult[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(query, coords));
    if (!raw) return null;
    const { at, results } = JSON.parse(raw) as { at: number; results: PlaceResult[] };
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return results;
  } catch {
    return null;
  }
}

function writeCache(query: string, coords: Coords | null, results: PlaceResult[]): void {
  try {
    localStorage.setItem(cacheKey(query, coords), JSON.stringify({ at: Date.now(), results }));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Run all providers in parallel; stream merged results and per-provider state.
 * The caller owns debounce (350 ms) and passes a fresh AbortController per
 * query so a new query cancels the previous one (AC-SEARCH-06).
 */
export async function searchGyms(
  query: string,
  coords: Coords | null,
  savedGyms: Gym[],
  signal: AbortSignal,
  handlers: SearchHandlers,
): Promise<PlaceResult[]> {
  const merged: PlaceResult[] = [];
  const ctx: ProviderCtx = { query, coords, savedGyms, signal };

  for (const p of PROVIDERS) handlers.onProvider(p.id, { status: 'pending' });

  await Promise.all(
    PROVIDERS.map(async (p) => {
      try {
        const rows = await p.run(ctx);
        if (signal.aborted) return;
        mergeResults(merged, rows);
        handlers.onProvider(p.id, { status: 'answered', count: rows.length });
        handlers.onResults([...merged]);
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof SkipError || err instanceof GeoConsentError) {
          handlers.onProvider(p.id, { status: 'skipped', reason: err.message });
        } else {
          const reason = err instanceof Error ? err.message : 'failed';
          // AC-SEARCH-10: log, never toast. A failed provider never blocks others.
          console.warn(`[gym-search] ${p.id} failed:`, reason);
          handlers.onProvider(p.id, { status: 'failed', reason });
        }
      }
    }),
  );

  if (!signal.aborted && merged.length > 0) writeCache(query, coords, merged);
  return merged;
}

// --- keyless gym imagery (AC-IMG): Wikimedia only, with attribution --------

/** Who to credit for an image and under what licence (Commons requires attribution for CC BY / CC BY-SA). */
export interface PhotoCredit {
  author?: string;
  license?: string;
  licenseUrl?: string;
  /** The image's own page on Commons. */
  pageUrl?: string;
}

/** An image URL plus the credit its licence asks for. */
export interface GymPhoto {
  url: string;
  credit?: PhotoCredit;
}

/** Commons metadata values are HTML (`<a href>Name</a>`): keep the text only, short enough for a caption. */
export function plainCreditText(html: string | undefined, max = 60): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Resolve a Commons "File:Name.jpg" (or bare "Name.jpg") to a thumb URL and its credit. */
async function commonsPhoto(fileTag: string, signal: AbortSignal): Promise<GymPhoto | null> {
  // A `Category:` tag names a folder of files, not one image.
  if (/^category:/i.test(fileTag.trim())) return null;
  const title = fileTag.startsWith('File:') ? fileTag : `File:${fileTag}`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
    iiurlwidth: '640',
    format: 'json',
    origin: '*',
  });
  const res = await geoFetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: Array<{
            thumburl?: string;
            url?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string } | undefined>;
          }>;
        }
      >;
    };
  };
  const pages = data.query?.pages ?? {};
  for (const k of Object.keys(pages)) {
    const info = pages[k].imageinfo?.[0];
    const url = info?.thumburl ?? info?.url;
    if (!url) continue;
    const meta = info?.extmetadata;
    const credit: PhotoCredit = {
      author: plainCreditText(meta?.Artist?.value),
      license: plainCreditText(meta?.LicenseShortName?.value, 40),
      licenseUrl: meta?.LicenseUrl?.value,
      pageUrl: info?.descriptionurl,
    };
    return { url, ...(credit.author || credit.license || credit.pageUrl ? { credit } : {}) };
  }
  return null;
}

/** The first Commons file a Wikidata entity lists under `property` (P18 image, P154 logo), resolved to a photo. */
async function wikidataImage(
  qid: string,
  property: 'P18' | 'P154',
  signal: AbortSignal,
): Promise<GymPhoto | null> {
  const params = new URLSearchParams({
    action: 'wbgetclaims',
    entity: qid,
    property,
    format: 'json',
    origin: '*',
  });
  const res = await geoFetch(`https://www.wikidata.org/w/api.php?${params}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }> | undefined>;
  };
  const file = data.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  return file ? commonsPhoto(file, signal) : null;
}

/**
 * Best-effort real image for a result with the credit its licence asks for, tried cheapest → richest and all keyless
 * (Wikimedia only): venue photo URL → the venue's own Wikidata image → Commons file tag → brand logo. Returns null
 * when nothing is found; the UI then shows the bundled neutral gym picture, never a map tile.
 */
export async function resolvePhotoInfo(
  r: PlaceResult,
  signal: AbortSignal,
): Promise<GymPhoto | null> {
  // No consent: no photo lookup, and no third-party image URL (even a remembered one) is handed to an <img>.
  if (!isGeoSearchOn()) return null;
  if (r.photoUrl) return { url: r.photoUrl };
  try {
    if (r.googlePhotoName) {
      const photo = await googlePhoto(r).catch(() => null);
      if (photo) return photo;
    }
    if (r.venueWikidata) {
      const photo = await wikidataImage(r.venueWikidata, 'P18', signal);
      if (photo) return photo;
    }
    if (r.wikimediaCommons) {
      const photo = await commonsPhoto(r.wikimediaCommons, signal);
      if (photo) return photo;
    }
    if (r.brandWikidata) {
      const photo = await wikidataImage(r.brandWikidata, 'P154', signal);
      if (photo) return photo;
    }
    // A saved gym has no Google reference yet: find the place by name and coordinates, then its photo.
    if (!r.googlePhotoName) {
      const found = await googleLookup(r).catch(() => null);
      if (found) {
        const photo = await googlePhoto(found).catch(() => null);
        if (photo) return photo;
      }
    }
    // No venue photo anywhere — fall back to the brand/chain logo. Applies to every network, not a special case.
    const logo = await brandLogoInfo(r.name, signal);
    if (logo) return logo;
  } catch (e) {
    if (signal.aborted) throw e;
  }
  return null;
}

/** The image URL alone (see `resolvePhotoInfo`). */
export async function resolvePhoto(r: PlaceResult, signal: AbortSignal): Promise<string | null> {
  return (await resolvePhotoInfo(r, signal))?.url ?? null;
}

/**
 * Brand/chain logo for a gym name, keyless and universal, cached per brand
 * (in-flight dedup + 30-day localStorage) so a chain with 40 branches resolves
 * once. Wikidata logo only (P154, a real wordmark, e.g. McFit). Clearbit and
 * DuckDuckGo icons were dropped (SPO-293): they are not among the services the
 * gym-search consent names. Returns null when nothing is found, and with no
 * consent (nothing cached then, so a later consent still resolves).
 */
const LOGO_PREFIX = 'gym.logo.';
const LOGO_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const logoInflight = new Map<string, Promise<GymPhoto | null>>();

function readLogoCache(brand: string): GymPhoto | null | undefined {
  try {
    const raw = localStorage.getItem(LOGO_PREFIX + brand);
    if (!raw) return undefined;
    const { at, url, credit } = JSON.parse(raw) as {
      at: number;
      url: string | null;
      credit?: PhotoCredit;
    };
    if (Date.now() - at > LOGO_TTL_MS) return undefined;
    return url ? { url, ...(credit ? { credit } : {}) } : null;
  } catch {
    return undefined;
  }
}

function writeLogoCache(brand: string, photo: GymPhoto | null): void {
  try {
    localStorage.setItem(
      LOGO_PREFIX + brand,
      JSON.stringify({ at: Date.now(), url: photo?.url ?? null, credit: photo?.credit }),
    );
  } catch {
    /* quota — ignore */
  }
}

export async function brandLogo(name: string, signal: AbortSignal): Promise<string | null> {
  return (await brandLogoInfo(name, signal))?.url ?? null;
}

function brandLogoInfo(name: string, signal: AbortSignal): Promise<GymPhoto | null> {
  const brand = name.trim().toLowerCase();
  if (!brand || !isGeoSearchOn()) return Promise.resolve(null);
  const cached = readLogoCache(brand);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = logoInflight.get(brand);
  if (existing) return existing;
  const job = resolveBrandLogo(name, signal)
    .then((photo) => {
      writeLogoCache(brand, photo);
      return photo;
    })
    .catch((e) => {
      if (signal.aborted || e instanceof GeoConsentError) throw e; // don't cache aborts or a refused call — allow a later retry
      writeLogoCache(brand, null);
      return null;
    })
    .finally(() => {
      logoInflight.delete(brand);
    });
  logoInflight.set(brand, job);
  return job;
}

async function resolveBrandLogo(name: string, signal: AbortSignal): Promise<GymPhoto | null> {
  // 1) Wikidata entity for the brand → its logo (P154).
  const search = new URLSearchParams({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    type: 'item',
    limit: '1',
    format: 'json',
    origin: '*',
  });
  try {
    const sr = await geoFetch(`https://www.wikidata.org/w/api.php?${search}`, { signal });
    if (sr.ok) {
      const sd = (await sr.json()) as { search?: Array<{ id: string }> };
      const qid = sd.search?.[0]?.id;
      if (qid) {
        const logo = await wikidataImage(qid, 'P154', signal);
        if (logo) return logo;
      }
    }
  } catch (e) {
    if (signal.aborted || e instanceof GeoConsentError) throw e;
  }
  return null;
}

// --- reverse geocode: coordinates → street address (AC saved-gym address) ----
// The Gym object is replaced by the server on every sync, so an address can't
// live on it. Instead we resolve it from coordinates and cache it separately
// (keyed by rounded coords), which survives sync and unifies picked + manual
// gyms. Picked results seed the cache with their known address (no fetch).

const ADDR_PREFIX = 'gym.addr.';
const ADDR_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function addrKey(lat: number, lng: number): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${ADDR_PREFIX}${r(lat)},${r(lng)}`;
}

function readAddrCache(lat: number, lng: number): string | null | undefined {
  try {
    const raw = localStorage.getItem(addrKey(lat, lng));
    if (!raw) return undefined;
    const { at, addr } = JSON.parse(raw) as { at: number; addr: string | null };
    if (Date.now() - at > ADDR_TTL_MS) return undefined;
    return addr;
  } catch {
    return undefined;
  }
}

function writeAddrCache(lat: number, lng: number, addr: string | null): void {
  try {
    localStorage.setItem(addrKey(lat, lng), JSON.stringify({ at: Date.now(), addr }));
  } catch {
    /* quota — ignore */
  }
}

/** Seed the address cache with an already-known address (from a picked venue). */
export function cacheAddress(lat: number, lng: number, addr: string | undefined): void {
  if (addr) writeAddrCache(lat, lng, addr);
}

function formatAddr(p: {
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}): string | null {
  const line = [p.street, p.housenumber].filter(Boolean).join(' ');
  // Same shape as forward-search rows: street, city, region, country.
  const out = [line, p.city || p.district, p.state, p.country].filter(Boolean).join(', ');
  return out || null;
}

/** Street address for a coordinate, cached; Photon reverse geocoder, keyless. */
const addrInflight = new Map<string, Promise<string | null>>();

export function resolveAddress(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<string | null> {
  const cached = readAddrCache(lat, lng);
  if (cached !== undefined) return Promise.resolve(cached);
  const key = addrKey(lat, lng);
  const existing = addrInflight.get(key);
  if (existing) return existing;
  const job = fetchAddress(lat, lng, signal).finally(() => addrInflight.delete(key));
  addrInflight.set(key, job);
  return job;
}

async function fetchAddress(lat: number, lng: number, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await geoFetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ properties?: Parameters<typeof formatAddr>[0] }>;
    };
    const addr = formatAddr(data.features?.[0]?.properties ?? {});
    writeAddrCache(lat, lng, addr);
    return addr;
  } catch (e) {
    if (signal.aborted) throw e;
    return null;
  }
}

/** ~distance for a row: "240 m" / "1.2 km". */
export function fmtDistance(m: number): string {
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

// --- gym metadata: hours / website / phone (OSM via Nominatim, keyless) -----
// Overpass is too slow/rate-limited for an on-open call; Nominatim reverse with
// extratags is reliable and carries the same tags. Coverage varies — many gyms
// simply have no opening_hours in OSM, in which case the UI says so.

export interface GymMeta {
  openingHours?: string;
  website?: string;
  phone?: string;
  category?: string;
  /** Structured hours when available — preferred over raw. */
  hours?: ParsedHours;
  openNow?: boolean;
}

const META_PREFIX = 'gym.meta.';
const META_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const metaInflight = new Map<string, Promise<GymMeta | null>>();

export function resolveGymMeta(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<GymMeta | null> {
  return fetchGymMetaCached(lat, lng, signal);
}

function fetchGymMetaCached(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<GymMeta | null> {
  const key = `${META_PREFIX}${Math.round(lat * 1e5) / 1e5},${Math.round(lng * 1e5) / 1e5}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { at, meta } = JSON.parse(raw) as { at: number; meta: GymMeta | null };
      if (Date.now() - at <= META_TTL_MS) return Promise.resolve(meta);
    }
  } catch {
    /* ignore */
  }
  const existing = metaInflight.get(key);
  if (existing) return existing;
  const job = fetchGymMeta(lat, lng, signal)
    .then((meta) => {
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), meta }));
      } catch {
        /* quota */
      }
      return meta;
    })
    .catch((e) => {
      if (signal.aborted) throw e;
      return null;
    })
    .finally(() => metaInflight.delete(key));
  metaInflight.set(key, job);
  return job;
}

async function fetchGymMeta(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<GymMeta | null> {
  const res = await geoFetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&extratags=1&zoom=18`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as {
    category?: string;
    type?: string;
    extratags?: Record<string, string>;
  };
  const x = j.extratags ?? {};
  return {
    openingHours: x.opening_hours,
    website: x.website || x.url || x['contact:website'],
    phone: x.phone || x['contact:phone'],
    category: j.type || j.category,
  };
}

// --- opening_hours parser (best-effort, common syntaxes) --------------------
// Returns 7 weekday buckets (Mon..Sun) of [openMinute, closeMinute] ranges.
// Falls back to null when it can't make sense of the string (UI shows raw).

const OH_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface ParsedHours {
  week: Array<Array<[number, number]>>;
}

function parseDayTokens(part: string): number[] {
  const out = new Set<number>();
  for (const tokRaw of part.split(',')) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map((x) => OH_DAYS.indexOf(x.trim().slice(0, 2)));
      if (a >= 0 && b >= 0) {
        for (let i = a; ; i = (i + 1) % 7) {
          out.add(i);
          if (i === b) break;
        }
      }
    } else {
      const i = OH_DAYS.indexOf(tok.slice(0, 2));
      if (i >= 0) out.add(i);
    }
  }
  return [...out];
}

export function parseOpeningHours(raw: string | undefined): ParsedHours | null {
  if (!raw) return null;
  const week: Array<Array<[number, number]>> = Array.from({ length: 7 }, () => []);
  const s = raw.trim();
  if (/^24\s*\/\s*7$/.test(s) || /\b00:00-24:00\b/.test(s)) {
    for (let i = 0; i < 7; i++) week[i] = [[0, 1440]];
    return { week };
  }
  let matched = false;
  for (const ruleRaw of s.split(';')) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    const timeRe = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*/;
    const tm = rule.match(timeRe);
    const dayPart = (tm ? rule.slice(0, tm.index) : rule.replace(/\b(off|closed)\b/i, '')).trim();
    const days = parseDayTokens(dayPart);
    const idx = days.length ? days : [0, 1, 2, 3, 4, 5, 6];
    if (!tm) continue; // "off"/"closed" → leave those days empty
    const ranges = tm[0].split(',').map((t) => {
      const [a, b] = t.split('-').map((x) => {
        const [h, mi] = x.trim().split(':').map(Number);
        return h * 60 + (mi || 0);
      });
      return [a, b] as [number, number];
    });
    for (const di of idx) week[di] = ranges;
    matched = true;
  }
  return matched ? { week } : null;
}
