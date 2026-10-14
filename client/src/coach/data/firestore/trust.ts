/**
 * Key pinning (plan-security C.2 no. 5 and 7). A coach public key (`coachKeys/{uid}`) and a device signing key
 * (`signKeys/{uid}/keys/{kid}`) are trusted ONLY with a server signature (Ed25519, `config/coachSigning` holds the
 * public half). A client refuses to wrap a conversation key to an unsigned or foreign key, and a receiver refuses to
 * verify a message against an unsigned directory entry. The signed strings must equal functions/src/coach/service.ts
 * (`coachKeySigPayload`, `signKeySigPayload`); tests/coach-server/parity.test.ts checks it.
 */
import { fingerprint } from '../../../vaultGrants';
import { unb64 } from '../../../vaultCrypto';
import { importVerifyKey, type SignerDirectory } from '../../chat/chatSignature';
import type { FsApi, Raw } from './fsApi';
import {
  buildPins,
  isProductionBuild,
  rotationPayload,
  type SigningPin,
} from '../../../coachCrypto/signingPins';

export interface ServerSigning {
  kid: string;
  key: CryptoKey;
}

export const coachKeySigPayload = (uid: string, fp: string, updatedAt: number, kid: string) =>
  `coachkey|1|${kid}|${uid}|${fp}|${updatedAt}`;
export const signKeySigPayload = (srvKid: string, uid: string, kid: string, publicRaw: string) =>
  `signkey|1|${srvKid}|${uid}|${kid}|${publicRaw}`;

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is not available');
  return s;
};

const pemToDer = (pem: string): Uint8Array =>
  unb64(pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, ''));

const importEd = (pub: string): Promise<CryptoKey> =>
  subtle().importKey(
    'spki',
    pemToDer(
      pub.includes('BEGIN') ? pub : `-----BEGIN PUBLIC KEY-----${pub}-----END PUBLIC KEY-----`,
    ) as BufferSource,
    { name: 'Ed25519' },
    false,
    ['verify'],
  );

/**
 * The server verification key, per session. With pins in the build (iteration 14 item 9) the key is ALWAYS one of the
 * pins, or a key announced in `config/coachSigning.next` and signed by a pin; the document's own `pub` is never
 * trusted. With no pins a production build trusts nobody; development and tests keep the document (emulator).
 * Null when nothing can be trusted, or Ed25519 is not available.
 */
export function createServerSigningLoader(
  fs: FsApi,
  pins: SigningPin[] = buildPins(),
  production: boolean = isProductionBuild(),
): () => Promise<ServerSigning | null> {
  let cached: Promise<ServerSigning | null> | null = null;
  const fromDoc = async (): Promise<ServerSigning | null> => {
    const d = await fs.get('config/coachSigning');
    if (!d || d.alg !== 'Ed25519' || typeof d.pub !== 'string' || typeof d.kid !== 'string')
      return null;
    return { kid: d.kid, key: await importEd(d.pub) };
  };
  const pinned = async (): Promise<ServerSigning | null> => {
    const doc = await fs.get('config/coachSigning').catch(() => null);
    const next = doc?.next as
      { kid?: unknown; pub?: unknown; by?: unknown; sig?: unknown } | undefined;
    // a rotation announcement signed by a pinned key wins (so a fleet moves to the new key without a rebuild)
    if (
      next &&
      typeof next.kid === 'string' &&
      typeof next.pub === 'string' &&
      typeof next.by === 'string' &&
      typeof next.sig === 'string'
    ) {
      const signer = pins.find((p) => p.kid === next.by);
      if (signer) {
        try {
          const ok = await verifyEd(
            { kid: signer.kid, key: await importEd(signer.pub) },
            rotationPayload(next.kid, next.pub),
            next.sig,
          );
          if (ok) return { kid: next.kid, key: await importEd(next.pub) };
        } catch {
          /* fall through to the pins */
        }
      }
    }
    // otherwise the pin the document names (kid match), else the newest pin
    const named = typeof doc?.kid === 'string' ? pins.find((p) => p.kid === doc.kid) : undefined;
    const pick = named ?? pins[pins.length - 1];
    return { kid: pick.kid, key: await importEd(pick.pub) };
  };
  return () =>
    (cached ??= (async () => {
      try {
        if (pins.length) return await pinned();
        return production ? null : await fromDoc();
      } catch {
        return null;
      }
    })().then((r) => {
      if (!r) cached = null; // retry next time (offline start)
      return r;
    }));
}

const verifyEd = async (s: ServerSigning, payload: string, sigB64: string): Promise<boolean> => {
  try {
    return await subtle().verify(
      { name: 'Ed25519' },
      s.key,
      unb64(sigB64) as BufferSource,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
};

/** The coach public key, or null when it is missing, malformed or not signed for THIS uid and fingerprint. */
export async function trustedCoachPub(
  rec: Raw | null,
  uid: string,
  signing: ServerSigning | null,
): Promise<JsonWebKey | null> {
  if (!rec || !signing) return null;
  const pub = rec.pub as JsonWebKey | undefined;
  if (!pub || pub.kty !== 'EC' || pub.crv !== 'P-256') return null;
  if (typeof rec.sig !== 'string' || typeof rec.kid !== 'string' || rec.kid !== signing.kid)
    return null;
  if (!Number.isFinite(rec.updatedAt)) return null;
  const fp = await fingerprint(pub);
  const ok = await verifyEd(
    signing,
    coachKeySigPayload(uid, fp, rec.updatedAt as number, rec.kid),
    rec.sig,
  );
  return ok ? pub : null;
}

/** Directory of device signing keys, read from `signKeys` and trusted only with a valid server signature. */
export function createSignerDirectory(
  fs: FsApi,
  signing: () => Promise<ServerSigning | null>,
): SignerDirectory {
  const cache = new Map<string, CryptoKey | null>();
  return {
    async key(uid, kid) {
      const k = `${uid}|${kid}`;
      if (cache.has(k) && cache.get(k)) return cache.get(k) ?? null;
      const s = await signing();
      const rec = await fs.get(`signKeys/${uid}/keys/${kid}`);
      if (!s || !rec || rec.uid !== uid || rec.kid !== kid || typeof rec.publicRaw !== 'string')
        return null;
      if (typeof rec.sig !== 'string' || rec.srvKid !== s.kid) return null;
      if (!(await verifyEd(s, signKeySigPayload(s.kid, uid, kid, rec.publicRaw), rec.sig)))
        return null;
      try {
        const key = await importVerifyKey(rec.publicRaw);
        cache.set(k, key);
        return key;
      } catch {
        return null;
      }
    },
  };
}
