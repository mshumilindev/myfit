/**
 * Opaque conversation id: cid = base32(HMAC-SHA256(serverPepper, clientUid ':' trainerUid))[0..26].
 *
 * Not guessable and does not leak uids in paths or logs. The pepper lives on the server only,
 * so the browser asks a callable (`ConversationIdPort`) and never computes it. The pure
 * function below is what that callable runs (it is exported so the function and the tests
 * share one definition; the callable itself ships with the relationship step).
 */
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** @internal planned: contract constant shared with the server-side definition. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const CID_LENGTH = 26;
const CID_RE = /^[a-z2-7]{26}$/;

/** @internal planned: used by the real conversation-id adapter (server pieces not wired yet). Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const isConversationId = (s: unknown): s is string =>
  typeof s === 'string' && CID_RE.test(s);

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

/** Server-side definition. `pepper` is the secret HMAC key (>= 32 bytes). */
/** @internal planned: server-side definition kept here so client and functions share one; the real callable adapter will use it. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export async function computeConversationId(
  pepper: Uint8Array,
  clientUid: string,
  trainerUid: string,
): Promise<string> {
  if (pepper.length < 32) throw new Error('weak-pepper');
  if (!clientUid || !trainerUid || clientUid.includes(':') || trainerUid.includes(':')) {
    throw new Error('bad-uid');
  }
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey(
    'raw',
    pepper as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(
    await subtle.sign('HMAC', key, new TextEncoder().encode(`${clientUid}:${trainerUid}`)),
  );
  return base32(mac).slice(0, CID_LENGTH);
}

/** Client-side port: the callable `conversationId` (not implemented yet). */
export interface ConversationIdPort {
  conversationId(clientUid: string, trainerUid: string): Promise<string>;
}

/** Asks the port and refuses anything that is not a well-formed opaque id. */
/** @internal planned: used by the real relationship adapter once the resolve callable ships. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export async function resolveConversationId(
  port: ConversationIdPort,
  clientUid: string,
  trainerUid: string,
): Promise<string> {
  const cid = await port.conversationId(clientUid, trainerUid);
  if (!isConversationId(cid)) throw new Error('bad-cid');
  return cid;
}
