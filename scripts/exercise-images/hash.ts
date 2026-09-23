import crypto from 'node:crypto';
import fs from 'node:fs';

export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
export const short = (h: string) => h.slice(0, 12);

/** Hash of a file's bytes; null when it doesn't exist. */
export function fileHash(p: string | undefined): string | null {
  if (!p || !fs.existsSync(p)) return null;
  return sha256(fs.readFileSync(p));
}

/** Stable JSON (sorted keys) so object key order never changes a hash. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}
