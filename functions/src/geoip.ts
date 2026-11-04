/**
 * Approximate place of a sign-in (SPO-436): "city, country" from the caller's IP, looked up in an offline database
 * (DB-IP Lite, CC BY 4.0, shipped as an npm package) inside the function. The IP is used for this one lookup and then
 * dropped: it is never stored, logged or sent to any other service. The database loads on first use and stays cached.
 */
import { readFileSync } from 'node:fs';
import { Reader, type CityResponse } from 'mmdb-lib';

interface DbipCity {
  city?: string;
  country_code?: string;
}

const readers: { v4?: Reader<DbipCity & CityResponse>; v6?: Reader<DbipCity & CityResponse> } = {};

function reader(v6: boolean): Reader<DbipCity & CityResponse> | null {
  const key = v6 ? 'v6' : 'v4';
  if (readers[key]) return readers[key] ?? null;
  try {
    const file = require.resolve(
      `@ip-location-db/dbip-city-mmdb/dbip-city-ip${v6 ? 'v6' : 'v4'}.mmdb`,
    );
    readers[key] = new Reader<DbipCity & CityResponse>(readFileSync(file));
    return readers[key] ?? null;
  } catch {
    return null; // no database in this build: the place stays empty, nothing breaks
  }
}

/** The caller's address from the proxy header (the LAST entry is the one the platform's front end saw; earlier ones are client-supplied). */
export function clientIp(
  headers: Record<string, unknown> | undefined,
  rawIp?: string,
): string | null {
  const x = headers?.['x-forwarded-for'];
  const list = (Array.isArray(x) ? x.join(',') : typeof x === 'string' ? x : '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = (list.at(-1) ?? rawIp ?? '').replace(/^::ffff:/i, '');
  return /^[0-9a-f:.]{3,45}$/i.test(ip) ? ip : null;
}

/** City and country code for an address, or nothing when unknown. */
export function placeFromIp(ip: string | null): { city: string | null; country: string | null } {
  const none = { city: null, country: null };
  if (!ip) return none;
  try {
    const rec = reader(ip.includes(':'))?.get(ip);
    const country = rec?.country_code?.trim();
    if (!country) return none;
    return { city: rec?.city?.trim() || null, country: country.toUpperCase() };
  } catch {
    return none;
  }
}
