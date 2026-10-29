/**
 * Cloudflare Worker in front of myspotter.fit (SPO-184 / SPO-220). Runs on the Free plan.
 *
 * The country comes only from `request.cf`, which Cloudflare fills from the connecting IP at its edge. A client cannot
 * set it, and a `CF-IPCountry` header sent by the client is never read. Unknown location (no `cf`, `XX`, `T1`) is let
 * through: the block is a compliance gate, not a security boundary, and VPN / unlocated traffic is a documented limit.
 * Nothing is logged or stored here; the IP is never read.
 */
import { BLOCK_JSON, blockPageHtml, pickLocale } from './blockPage';
import { parseCountries, type EdgeEnv } from './config';
import { inAnyArea, parseAreas } from './polygon';

export interface EdgeCf {
  country?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}
type OriginFetch = (request: Request) => Promise<Response>;

export type Verdict = 'allow' | 'country' | 'area';

export function decide(cf: EdgeCf | undefined, env: EdgeEnv): Verdict {
  const country = cf?.country?.toUpperCase();
  if (country && parseCountries(env.BLOCKED_COUNTRIES).has(country)) return 'country';
  const lat = Number(cf?.latitude);
  const lon = Number(cf?.longitude);
  if (cf?.latitude && cf?.longitude && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (inAnyArea(lon, lat, parseAreas(env.OCCUPIED_GEOJSON))) return 'area';
  }
  return 'allow';
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
export function blockedResponse(request: Request): Response {
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
  return new Response(headBody ? null : blockPageHtml(locale), {
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
  if (decide(cf, env) !== 'allow') return blockedResponse(request);
  return origin(request);
}

export default {
  fetch: (request: Request, env: EdgeEnv): Promise<Response> =>
    handle(request, env, (r) => fetch(r)),
};
