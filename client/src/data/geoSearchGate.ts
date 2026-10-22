/**
 * The one switch for everything that sends a gym search, a position or a map request to a service outside Spotter
 * (SPO-293, G13). Pure: no React, no Firestore. Off until the person's `geo-search` consent record says on
 * (`optionalConsentOn(records, 'geo-search')`, set by `legal/GeoConsentHost`). Every outgoing call in
 * `gymProviders.ts`, `RouteMap.tsx` and the gym thumbnails asks `isGeoSearchOn()` first, so with no consent no request
 * leaves the device (no prefetch, no autocomplete, no map tiles).
 */

/**
 * The services that actually receive a request once the person consents, as the code calls them today. These ids are
 * recorded as the `engines` of the consent. Google Places and Foursquare are NOT here: they are not enabled (see
 * `KEYED_PLACE_SERVICES_ENABLED` in `gymProviders.ts`) and would need their own consent kind.
 */
export const GEO_ENGINES = [
  'photon',
  'overpass',
  'nominatim',
  'osrm',
  'osm-tiles',
  'wikidata',
  'wikimedia-commons',
  'unpkg',
] as const;

export class GeoConsentError extends Error {
  constructor() {
    super('Gym search and maps are off: no consent');
    this.name = 'GeoConsentError';
  }
}

interface GeoState {
  /** Consent granted at the current version and not withdrawn (with this device's own latest choice applied). */
  on: boolean;
  /** The server (or a cache with data) has answered, so "no record" really means never asked. */
  ready: boolean;
  /** Any `geo-search` record exists (granted or withdrawn): do not pop the prompt again by itself. */
  answered: boolean;
  /** The records came from the server, not only the cache. Settles a local `true` override that the server denies. */
  confirmed?: boolean;
}

/** What the consent records say (set by `legal/GeoConsentHost`). */
let fromRecords: GeoState = { on: false, ready: false, answered: false };
/**
 * What this device just did, before the server-confirmed record arrives: a withdrawal stops every request at once (also
 * offline, or when the write failed). Dropped when the records agree; a `true` is also dropped when the server confirms
 * "off". A `false` survives a stale snapshot, so a withdrawal is never undone by one.
 */
let override: boolean | null = null;
let state: GeoState = { on: false, ready: false, answered: false };
let promptOpen = false;
let declinedThisSession = false;
/** Aborted the moment sending turns off, so a request already in flight is cancelled too. */
let ctl = new AbortController();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function subscribeGeo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const geoSnapshot = (): GeoState => state;
export const isGeoSearchOn = (): boolean => state.on;
export const isGeoPromptOpen = (): boolean => promptOpen;
/** Aborts when gym search is switched off; use for requests that can be cancelled. */
export const geoAbortSignal = (): AbortSignal => ctl.signal;

/** `own` (a caller's signal) plus the gate's: aborts when either does. */
export function geoSignal(own?: AbortSignal): AbortSignal {
  const off = ctl.signal;
  if (!own) return off;
  return 'any' in AbortSignal ? AbortSignal.any([own, off]) : own;
}

function recompute(): void {
  const next: GeoState = { ...fromRecords, on: override ?? fromRecords.on };
  if (next.on === state.on && next.ready === state.ready && next.answered === state.answered)
    return;
  const wasOn = state.on;
  state = next;
  if (wasOn && !next.on) ctl.abort();
  else if (!wasOn && next.on && ctl.signal.aborted) ctl = new AbortController();
  emit();
}

export function setGeoSearchState(next: GeoState): void {
  fromRecords = next;
  if (override !== null && (override === next.on || (override && next.confirmed && !next.on)))
    override = null;
  recompute();
}

/** This device's own choice, effective at once (call it before the withdrawal is written). */
export function setGeoOverride(on: boolean): void {
  override = on;
  recompute();
}

/** Throws `GeoConsentError` unless consent is on. Call before any request to a map or place service. */
export function assertGeoSearchOn(): void {
  if (!state.on) throw new GeoConsentError();
}

export function openGeoPrompt(): void {
  if (promptOpen) return;
  promptOpen = true;
  emit();
}

/** `declined`: the person chose "Not now" (the prompt then does not come back by itself until the next visit). */
export function closeGeoPrompt(declined = false): void {
  if (declined) declinedThisSession = true;
  if (!promptOpen) return;
  promptOpen = false;
  emit();
}

/** The first search surface may ask once per visit when the person was never asked and has not said "Not now". */
export function shouldAutoAskGeo(): boolean {
  return state.ready && !state.on && !state.answered && !declinedThisSession && !promptOpen;
}

/** Tests only. */
export function resetGeoGateForTests(): void {
  fromRecords = { on: false, ready: false, answered: false };
  override = null;
  ctl = new AbortController();
  state = { on: false, ready: false, answered: false };
  promptOpen = false;
  declinedThisSession = false;
  emit();
}
