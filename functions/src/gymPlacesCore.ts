/**
 * Gym search through Google Places (SPO-360), as a PROXY: the browser never talks to Google, so Google sees the server
 * (no IP, no user id, no cookies), only the search text and an approximate area. Pure logic: input rules, the request
 * to Google, the minimal answer, the consent check. No secrets or Firebase here (see `gymPlaces.ts`).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { currentVersionOf } from './consentRecordsPure';

/** The engine id recorded in the person's `geo-search` consent when Google Places is disclosed (copy in the client). */
export const GOOGLE_ENGINE = 'google-places';
const NEARBY_MAX_RADIUS_M = 5000;
const SEARCH_MAX_RADIUS_M = 50000;
const MAX_RESULTS = 20;
/** Photo tokens from Places are long (several hundred characters and growing); the charset, not the length, is the guard. */
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{1,300}\/photos\/[A-Za-z0-9_-]{1,2000}$/;
const PHOTO_WIDTH_PX = 640;
/** An image larger than this is not sent back through a callable (the limit is 10 MB; a card needs far less). */
export const PHOTO_MAX_BYTES = 600_000;

export type PlacesRequest =
  | { op: 'search'; q: string; lat?: number; lng?: number }
  | { op: 'nearby'; lat: number; lng: number; radiusM: number }
  | { op: 'photo'; name: string };

export interface PlacesResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /** Opaque reference to fetch the first photo through this proxy (`op: 'photo'`). */
  photoName?: string;
  /** Photo author names, shown next to the photo as Google's terms require. */
  photoBy?: string[];
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Throws `Error(<code>)`: `bad-input`, `bad-op`, `bad-query`, `bad-position`, `bad-photo`. */
export function parseRequest(data: unknown): PlacesRequest {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad-input');
  const d = data as Record<string, unknown>;
  if (d.op === 'photo') {
    if (typeof d.name !== 'string' || !PHOTO_NAME_RE.test(d.name)) throw new Error('bad-photo');
    return { op: 'photo', name: d.name };
  }
  const hasPos = d.lat !== undefined || d.lng !== undefined;
  if (hasPos && (!finite(d.lat) || !finite(d.lng) || Math.abs(d.lat) > 90 || Math.abs(d.lng) > 180))
    throw new Error('bad-position');
  if (d.op === 'search') {
    const q = typeof d.q === 'string' ? d.q.trim() : '';
    if (q.length < 2 || q.length > 80) throw new Error('bad-query');
    return hasPos
      ? { op: 'search', q, lat: d.lat as number, lng: d.lng as number }
      : { op: 'search', q };
  }
  if (d.op === 'nearby') {
    if (!hasPos) throw new Error('bad-position');
    const r = finite(d.radiusM) ? d.radiusM : 3000;
    return {
      op: 'nearby',
      lat: d.lat as number,
      lng: d.lng as number,
      radiusM: Math.min(NEARBY_MAX_RADIUS_M, Math.max(100, Math.round(r))),
    };
  }
  throw new Error('bad-op');
}

/** The consent the person gave: the newest `geo-search` record must be a grant of the current version naming Google. */
export function googleConsentOn(
  records: ReadonlyArray<{
    kind?: unknown;
    action?: unknown;
    version?: unknown;
    at?: unknown;
    engines?: unknown;
  }>,
  currentVersion: string,
): boolean {
  let latest: (typeof records)[number] | null = null;
  for (const r of records) {
    if (r.kind !== 'geo-search' || !finite(r.at)) continue;
    if (!latest || (r.at as number) > (latest.at as number)) latest = r;
  }
  return (
    !!latest &&
    latest.action === 'grant' &&
    latest.version === currentVersion &&
    Array.isArray(latest.engines) &&
    latest.engines.includes(GOOGLE_ENGINE)
  );
}

const FIELDS = 'places.id,places.displayName,places.location,places.formattedAddress,places.photos';

/** The request to Google Places (New). Only what is needed: the text and an area, never anything about the person. */
export function googleRequest(req: PlacesRequest & { op: 'search' | 'nearby' }): {
  url: string;
  body: Record<string, unknown>;
  fieldMask: string;
} {
  if (req.op === 'nearby') {
    return {
      url: 'https://places.googleapis.com/v1/places:searchNearby',
      fieldMask: FIELDS,
      body: {
        includedTypes: ['gym', 'fitness_center'],
        maxResultCount: MAX_RESULTS,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: { center: { latitude: req.lat, longitude: req.lng }, radius: req.radiusM },
        },
      },
    };
  }
  const body: Record<string, unknown> = { textQuery: req.q, maxResultCount: MAX_RESULTS };
  if (req.lat !== undefined && req.lng !== undefined) {
    body.locationBias = {
      circle: {
        center: { latitude: req.lat, longitude: req.lng },
        radius: SEARCH_MAX_RADIUS_M,
      },
    };
  }
  return { url: 'https://places.googleapis.com/v1/places:searchText', fieldMask: FIELDS, body };
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  photos?: Array<{ name?: string; authorAttributions?: Array<{ displayName?: string }> }>;
}

/** Google's answer reduced to the minimum the client shows; rows without a name or a position are dropped. */
export function mapPlaces(data: unknown): PlacesResult[] {
  const places = (data as { places?: GooglePlace[] } | null)?.places;
  if (!Array.isArray(places)) return [];
  const out: PlacesResult[] = [];
  for (const p of places) {
    const name = p.displayName?.text?.trim();
    const { latitude, longitude } = p.location ?? {};
    if (!p.id || !name || !finite(latitude) || !finite(longitude)) continue;
    const row: PlacesResult = { id: p.id, name, lat: latitude, lng: longitude };
    if (p.formattedAddress) row.address = p.formattedAddress;
    const photo = p.photos?.[0];
    if (photo?.name && !PHOTO_NAME_RE.test(photo.name))
      console.warn(`gymPlaces: photo reference rejected (length ${photo.name.length})`);
    if (photo?.name && PHOTO_NAME_RE.test(photo.name)) {
      row.photoName = photo.name;
      const by = (photo.authorAttributions ?? [])
        .map((a) => a.displayName?.trim())
        .filter((s): s is string => !!s)
        .slice(0, 3);
      if (by.length) row.photoBy = by;
    }
    out.push(row);
  }
  return out;
}

export function photoUrl(name: string): string {
  return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${PHOTO_WIDTH_PX}`;
}

export type GymPlacesAnswer = { places: PlacesResult[] } | { photo: string | null };

export interface GymPlacesPorts {
  key: string;
  /** The person's consent records (any order). */
  records: () => Promise<Array<Record<string, unknown>>>;
  fetch: typeof fetch;
}

/** Testable body of the callable: no Firebase, no secrets. Throws `HttpsError` with a code the client can act on. */
export async function gymPlacesHandler(
  data: unknown,
  ports: GymPlacesPorts,
): Promise<GymPlacesAnswer> {
  let req: PlacesRequest;
  try {
    req = parseRequest(data);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'bad-input');
  }
  if (!googleConsentOn(await ports.records(), currentVersionOf('geo-search'))) {
    throw new HttpsError('permission-denied', 'no-consent');
  }
  if (!ports.key) throw new HttpsError('failed-precondition', 'not-configured');

  if (req.op === 'photo') {
    const res = await ports.fetch(photoUrl(req.name), { headers: { 'X-Goog-Api-Key': ports.key } });
    if (!res.ok) return { photo: null };
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return { photo: null };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > PHOTO_MAX_BYTES) return { photo: null };
    return { photo: `data:${type};base64,${buf.toString('base64')}` };
  }

  const g = googleRequest(req);
  const res = await ports.fetch(g.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': ports.key,
      'X-Goog-FieldMask': g.fieldMask,
    },
    body: JSON.stringify(g.body),
  });
  if (!res.ok) throw new HttpsError('unavailable', `google-${res.status}`);
  return { places: mapPlaces(await res.json()) };
}
