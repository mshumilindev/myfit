/** Same shape check as the server (`normalizeEmail`, functions/src/emailAuthCore.ts): a dotted domain, no spaces, ≤254. */
const EMAIL_MAX = 254;

export function looksLikeEmail(raw: string): boolean {
  const e = raw.trim().toLowerCase();
  if (e.length < 5 || e.length > EMAIL_MAX) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(e)) return false;
  return !e.includes('..') && !e.startsWith('.') && !e.split('@')[0]!.endsWith('.');
}
