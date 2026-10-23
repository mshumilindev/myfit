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

export type ProviderId = 'local' | 'osm' | 'overpass';

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
  /** Provider-native id, used for id-based merge (AC-SEARCH-05b). */
  externalId?: string;
  /** OSM `wikimedia_commons` tag (e.g. "File:Foo.jpg") — lazy photo resolve. */
  wikimediaCommons?: string;
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
  if (!a.externalId && b.externalId) a.externalId = b.externalId;
  if (!a.wikimediaCommons && b.wikimediaCommons) a.wikimediaCommons = b.wikimediaCommons;
  if (!a.brandWikidata && b.brandWikidata) a.brandWikidata = b.brandWikidata;
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

async function overpassNearbyGyms(
  coords: Coords,
  radiusM: number,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const [south, west, north, east] = bboxAround(coords, radiusM);
  const bbox = `${south},${west},${north},${east}`;
  const query = `
    [out:json][timeout:8];
    (
      node["name"]["leisure"~"^(fitness_centre|sports_centre)$"](${bbox});
      way["name"]["leisure"~"^(fitness_centre|sports_centre)$"](${bbox});
      relation["name"]["leisure"~"^(fitness_centre|sports_centre)$"](${bbox});
      node["name"]["amenity"="gym"](${bbox});
      way["name"]["amenity"="gym"](${bbox});
      relation["name"]["amenity"="gym"](${bbox});
      node["name"]["sport"~"^(fitness|gym|weightlifting|crossfit)$"](${bbox});
      way["name"]["sport"~"^(fitness|gym|weightlifting|crossfit)$"](${bbox});
      relation["name"]["sport"~"^(fitness|gym|weightlifting|crossfit)$"](${bbox});
    );
    out center tags 50;
  `;
  const res = await geoFetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }),
  });
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
      const name = el.tags?.name?.trim();
      if (!name || lat === undefined || lng === undefined) return null;
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
      return {
        key: `osm:${pr.osm_type ?? ''}${pr.osm_id ?? Math.round(c[0] * 1e6)}`,
        name: pr.name!,
        lat: c[1],
        lng: c[0],
        address: addr || undefined,
        externalId: pr.osm_id ? `osm:${pr.osm_type ?? ''}${pr.osm_id}` : undefined,
        amenities: detectAmenities({ name: pr.name }),
        sources: ['osm'] as ProviderId[],
      };
    });
}

/** A provider that can't run (missing key) throws this → chip state 'skipped'. */
class SkipError extends Error {}

const PROVIDERS: { id: ProviderId; run: Provider }[] = [
  { id: 'local', run: localProvider },
  { id: 'osm', run: osmProvider },
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

// --- keyless gym imagery (AC-IMG) ------------------------------------------

/**
 * A guaranteed, keyless thumbnail: the OSM map tile the venue sits on. Not a
 * photo, but it always renders and shows the venue's surroundings — the last
 * resort when no real photo or brand logo is available.
 */
export function staticMapThumb(lat: number, lng: number, zoom = 16): string {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

/** Resolve a Commons "File:Name.jpg" (or bare "Name.jpg") to a thumb URL. */
async function commonsThumb(fileTag: string, signal: AbortSignal): Promise<string | null> {
  const title = fileTag.startsWith('File:') ? fileTag : `File:${fileTag}`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '320',
    format: 'json',
    origin: '*',
  });
  const res = await geoFetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
  };
  const pages = data.query?.pages ?? {};
  for (const k of Object.keys(pages)) {
    const info = pages[k].imageinfo?.[0];
    if (info?.thumburl || info?.url) return info.thumburl ?? info.url ?? null;
  }
  return null;
}

/** Resolve a brand's Wikidata QID to its logo (P154) on Commons. */
async function wikidataLogo(qid: string, signal: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'wbgetclaims',
    entity: qid,
    property: 'P154',
    format: 'json',
    origin: '*',
  });
  const res = await geoFetch(`https://www.wikidata.org/w/api.php?${params}`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    claims?: { P154?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> };
  };
  const file = data.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
  return file ? commonsThumb(file, signal) : null;
}

/**
 * Best-effort real image for a result, tried cheapest → richest and all
 * keyless: venue photo tag → Commons file tag → brand logo. Returns null when
 * nothing is found (the UI then falls back to the map-tile thumbnail).
 */
export async function resolvePhoto(r: PlaceResult, signal: AbortSignal): Promise<string | null> {
  // No consent: no photo lookup, and no third-party image URL (even a remembered one) is handed to an <img>.
  if (!isGeoSearchOn()) return null;
  if (r.photoUrl) return r.photoUrl;
  try {
    if (r.wikimediaCommons) {
      const url = await commonsThumb(r.wikimediaCommons, signal);
      if (url) return url;
    }
    if (r.brandWikidata) {
      const url = await wikidataLogo(r.brandWikidata, signal);
      if (url) return url;
    }
    // No venue photo anywhere — fall back to the brand/chain logo. Applies to
    // every network, not a special case: a recognizable logo beats a map tile.
    const logo = await brandLogo(r.name, signal);
    if (logo) return logo;
  } catch (e) {
    if (signal.aborted) throw e;
  }
  return null;
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
const logoInflight = new Map<string, Promise<string | null>>();

function readLogoCache(brand: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(LOGO_PREFIX + brand);
    if (!raw) return undefined;
    const { at, url } = JSON.parse(raw) as { at: number; url: string | null };
    if (Date.now() - at > LOGO_TTL_MS) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function writeLogoCache(brand: string, url: string | null): void {
  try {
    localStorage.setItem(LOGO_PREFIX + brand, JSON.stringify({ at: Date.now(), url }));
  } catch {
    /* quota — ignore */
  }
}

export function brandLogo(name: string, signal: AbortSignal): Promise<string | null> {
  const brand = name.trim().toLowerCase();
  if (!brand || !isGeoSearchOn()) return Promise.resolve(null);
  const cached = readLogoCache(brand);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = logoInflight.get(brand);
  if (existing) return existing;
  const job = resolveBrandLogo(name, signal)
    .then((url) => {
      writeLogoCache(brand, url);
      return url;
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

async function resolveBrandLogo(name: string, signal: AbortSignal): Promise<string | null> {
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
        const logo = await wikidataLogo(qid, signal);
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
