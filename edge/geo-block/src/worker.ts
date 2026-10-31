/**
 * Cloudflare Worker in front of myspotter.fit (SPO-184 / SPO-220). Runs on the Free plan.
 *
 * The country comes only from `request.cf`, which Cloudflare fills from the connecting IP at its edge. A client cannot
 * set it, and a `CF-IPCountry` header sent by the client is never read. Unknown location (no `cf`, `XX`, `T1`) is let
 * through: the block is a compliance gate, not a security boundary, and VPN / unlocated traffic is a documented limit.
 * Nothing is logged or stored here; the IP is never read.
 */
import { BLOCK_JSON, blockPageHtml, pickLocale, type BlockVariant } from './blockPage';
import { OCCUPIED_KEY, parseCountries, type EdgeEnv } from './config';
import { inAnyArea, parseAreas, type PolygonRings } from './polygon';

export interface EdgeCf {
  country?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}
type OriginFetch = (request: Request) => Promise<Response>;

export type Verdict = 'allow' | 'country' | 'area';

export function decide(
  cf: EdgeCf | undefined,
  env: EdgeEnv,
  areas: readonly PolygonRings[] = parseAreas(env.OCCUPIED_GEOJSON),
): Verdict {
  const country = cf?.country?.toUpperCase();
  if (country && parseCountries(env.BLOCKED_COUNTRIES).has(country)) return 'country';
  const lat = Number(cf?.latitude);
  const lon = Number(cf?.longitude);
  if (cf?.latitude && cf?.longitude && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (inAnyArea(lon, lat, areas)) return 'area';
  }
  return 'allow';
}

/** How long an isolate keeps the areas read from KV: a freed area opens again within this time, no deploy needed. */
export const AREAS_TTL_MS = 5 * 60_000;
let areasCache: { at: number; areas: PolygonRings[] } | null = null;
export function resetAreasCache(): void {
  areasCache = null;
}

/**
 * The refused areas: KV first (dynamic, SPO-408), then the `OCCUPIED_GEOJSON` variable. Unreadable or empty data blocks
 * nobody (fail open); a failing KV keeps the last good read instead of switching the block off or on.
 */
export async function loadAreas(env: EdgeEnv, now: number = Date.now()): Promise<PolygonRings[]> {
  if (!env.OCCUPIED_KV) return parseAreas(env.OCCUPIED_GEOJSON);
  if (areasCache && now - areasCache.at < AREAS_TTL_MS) return areasCache.areas;
  try {
    const raw = await env.OCCUPIED_KV.get(OCCUPIED_KEY);
    const areas = raw === null ? parseAreas(env.OCCUPIED_GEOJSON) : parseAreas(raw);
    areasCache = { at: now, areas };
    return areas;
  } catch {
    return areasCache?.areas ?? parseAreas(env.OCCUPIED_GEOJSON);
  }
}

const COMMON: Record<string, string> = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  vary: 'accept-language, accept',
};

/** 451 Unavailable For Legal Reasons: no redirect, nothing for the service worker to keep (`no-store`). */
export function blockedResponse(request: Request, variant: BlockVariant = 'country'): Response {
  const accept = request.headers.get('accept') ?? '';
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html');
  const headBody = request.method === 'HEAD';
  if (wantsJson) {
    return new Response(headBody ? null : BLOCK_JSON, {
      status: 451,
      headers: { ...COMMON, 'content-type': 'application/json; charset=utf-8' },
    });
  }
  const locale = pickLocale(request.headers.get('accept-language'));
  return new Response(headBody ? null : blockPageHtml(locale, variant), {
    status: 451,
    headers: { ...COMMON, 'content-type': 'text/html; charset=utf-8', 'content-language': locale },
  });
}

export async function handle(
  request: Request,
  env: EdgeEnv,
  origin: OriginFetch,
): Promise<Response> {
  const cf = (request as Request & { cf?: EdgeCf }).cf;
  const verdict = decide(cf, env, await loadAreas(env));
  if (verdict !== 'allow') return blockedResponse(request, verdict === 'area' ? 'area' : 'country');
  return origin(request);
}

export default {
  fetch: (request: Request, env: EdgeEnv): Promise<Response> =>
    handle(request, env, (r) => fetch(r)),
};
