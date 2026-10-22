/**
 * Hash of the exact legal text a person was shown (SPO-295 N3). The server requires a 64-hex `textHash` for `terms` and
 * `policy-ack` grants, so the record proves WHICH wording was accepted. Pure apart from WebCrypto; no storage.
 */
import type { LegalDocText } from '../i18n/legal.types';

/** The document as plain text, in reading order: title, then each section's title and blocks (rows/cells joined). */
export function docPlainText(doc: LegalDocText): string {
  const lines: string[] = [doc.title];
  for (const s of doc.sections) {
    lines.push(s.title);
    for (const b of s.body) {
      if ('p' in b) lines.push(b.p);
      else if ('ul' in b) lines.push(...b.ul);
      else {
        lines.push(b.table.head.join('\t'));
        for (const row of b.table.rows) lines.push(row.join('\t'));
      }
    }
  }
  return lines.join('\n');
}

/** SHA-256 of the UTF-8 text as 64 lowercase hex characters (WebCrypto). Rejects where WebCrypto is unavailable. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('webcrypto-unavailable');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
