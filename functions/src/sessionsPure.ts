/** Pure helpers of sessions.ts (no Firebase), so they can be unit-tested from the client suite. */
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function validDeviceId(v: unknown): v is string {
  return typeof v === 'string' && DEVICE_ID_RE.test(v);
}

/** "Chrome · macOS" from a user-agent string; falls back to "Browser". Pure, for tests. */
export function describeClient(ua: unknown): string {
  const s = typeof ua === 'string' ? ua : '';
  const os = /Windows/i.test(s)
    ? 'Windows'
    : /Android/i.test(s)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(s)
        ? 'iOS'
        : /Mac OS X|Macintosh/i.test(s)
          ? 'macOS'
          : /Linux|X11/i.test(s)
            ? 'Linux'
            : '';
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /OPR\/|Opera/.test(s)
      ? 'Opera'
      : /Firefox\//.test(s)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(s)
          ? 'Chrome'
          : /Safari\//.test(s)
            ? 'Safari'
            : 'Browser';
  return os ? `${browser} · ${os}` : browser;
}

function header(h: Record<string, unknown> | undefined, name: string): string | null {
  const v = h?.[name];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() && s.length < 80 ? s.trim() : null;
}

/** Approximate place from edge headers when the host provides them (no IP lookup, nothing stored but the words). */
export function placeFromHeaders(h: Record<string, unknown> | undefined): { city: string | null; country: string | null } {
  const country = header(h, 'x-appengine-country') ?? header(h, 'cf-ipcountry') ?? header(h, 'x-country-code');
  const city = header(h, 'x-appengine-city') ?? header(h, 'cf-ipcity');
  const c = country && country !== 'XX' && country !== 'ZZ' ? country.toUpperCase() : null;
  return { city: city && city !== '?' ? city : null, country: c };
}

