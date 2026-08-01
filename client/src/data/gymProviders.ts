/**
 * Gym place-search providers (AC-SEARCH-01…11).
 *
 * Pure client logic — no design/styling here. The UI (provider chips,
 * skeleton rows, merged-row layout) is owned by the design-system layer.
 *
 * Resolution order (venue): local DB → OpenStreetMap → Google Places →
 * Foursquare. Providers run in PARALLEL, stream results as each answers, and
 * identical venues merge into one row that lists every contributing source.
 */
import type { Gym } from '../types';

export type ProviderId = 'local' | 'osm' | 'google' | 'foursquare';

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

/** Runtime config: keys come from validated runtime config, never hardcoded. */
export interface ProviderKeys {
  googlePlaces?: string;
  foursquare?: string;
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
  keys: ProviderKeys;
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
 * entirely (the reason a bare "Zdrofit" once hid the 150 m branch).
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
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
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
        sources: ['osm'] as ProviderId[],
      };
    });
}

const googleProvider: Provider = async ({ query, coords, keys, signal }) => {
  if (!keys.googlePlaces) throw new SkipError('no Google Places key');
  const body = {
    textQuery: `${query} gym`,
    ...(coords
      ? {
          locationBias: {
            circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: 5000 },
          },
        }
      : {}),
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': keys.googlePlaces,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.location,places.formattedAddress,places.photos',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      location?: { latitude: number; longitude: number };
      formattedAddress?: string;
      photos?: Array<{ name: string }>;
    }>;
  };
  return (data.places ?? []).map((p) => ({
    key: `google:${p.id}`,
    name: p.displayName?.text ?? query,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    address: p.formattedAddress,
    photoUrl: p.photos?.[0]
      ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxWidthPx=1600&key=${keys.googlePlaces}`
      : undefined,
    externalId: `google:${p.id}`,
    sources: ['google'] as ProviderId[],
  }));
};

const foursquareProvider: Provider = async ({ query, coords, keys, signal }) => {
  if (!keys.foursquare) throw new SkipError('no Foursquare key');
  const params = new URLSearchParams({ query, categories: '18021', limit: '8' });
  if (coords) params.set('ll', `${coords.lat},${coords.lng}`);
  const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
    signal,
    headers: { Authorization: keys.foursquare, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`foursquare ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{
      fsq_id: string;
      name: string;
      geocodes?: { main?: { latitude: number; longitude: number } };
      location?: { formatted_address?: string };
    }>;
  };
  return (data.results ?? []).map((r) => ({
    key: `fsq:${r.fsq_id}`,
    name: r.name,
    lat: r.geocodes?.main?.latitude ?? 0,
    lng: r.geocodes?.main?.longitude ?? 0,
    address: r.location?.formatted_address,
    externalId: `fsq:${r.fsq_id}`,
    sources: ['foursquare'] as ProviderId[],
  }));
};

/** A provider that can't run (missing key) throws this → chip state 'skipped'. */
class SkipError extends Error {}

const PROVIDERS: { id: ProviderId; run: Provider }[] = [
  { id: 'local', run: localProvider },
  { id: 'osm', run: osmProvider },
  { id: 'google', run: googleProvider },
  { id: 'foursquare', run: foursquareProvider },
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
  keys: ProviderKeys,
  savedGyms: Gym[],
  signal: AbortSignal,
  handlers: SearchHandlers,
): Promise<PlaceResult[]> {
  const merged: PlaceResult[] = [];
  const ctx: ProviderCtx = { query, coords, keys, savedGyms, signal };

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
        if (err instanceof SkipError) {
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
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
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
  const res = await fetch(`https://www.wikidata.org/w/api.php?${params}`, { signal });
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
 * once. Order: Wikidata logo (P154, a real wordmark, e.g. McFit) → Clearbit
 * name→domain → DuckDuckGo brand icon (works where Wikidata has no logo, e.g.
 * Zdrofit). Returns null when nothing is found.
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
  if (!brand) return Promise.resolve(null);
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
      if (signal.aborted) throw e; // don't cache aborts — allow a later retry
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
    const sr = await fetch(`https://www.wikidata.org/w/api.php?${search}`, { signal });
    if (sr.ok) {
      const sd = (await sr.json()) as { search?: Array<{ id: string }> };
      const qid = sd.search?.[0]?.id;
      if (qid) {
        const logo = await wikidataLogo(qid, signal);
        if (logo) return logo;
      }
    }
  } catch (e) {
    if (signal.aborted) throw e;
  }
  // 2) Clearbit name→domain suggestion, then the domain's brand icon.
  try {
    const cr = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
      { signal },
    );
    if (cr.ok) {
      const cd = (await cr.json()) as Array<{ domain?: string }>;
      const domain = cd[0]?.domain;
      if (domain) return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    }
  } catch (e) {
    if (signal.aborted) throw e;
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
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, { signal });
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
