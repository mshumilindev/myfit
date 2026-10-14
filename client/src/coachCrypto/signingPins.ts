/**
 * Server signing-key PIN (plan-security C.2 no. 5, iteration 14 item 9).
 *
 * The Ed25519 public key that vouches for every coach key and device signing key is shipped IN THE BUILD, not read
 * from Firestore: a hacker (or a rogue admin) who can write `config/coachSigning` can no longer swap in their own
 * signer. Build config: `VITE_COACH_SIGNING_PINS` = JSON array `[{ "kid": "...", "pub": "<SPKI PEM or base64>" }]`.
 * The list has more than one entry during a rotation (old + new), so installed apps keep working.
 *
 * `config/coachSigning` still exists, but only for ROTATION ANNOUNCEMENTS: `{ kid, pub, alg, next: { kid, pub, by,
 * sig } }` where `sig` is made by the pinned key `by` over `rotationPayload(next.kid, next.pub)`. A client accepts the
 * announced key only when that signature verifies against a pin. Generate pins and announcements with
 * `scripts/pin-coach-signing.mjs` and `scripts/coach-signing-rotate.mjs`.
 *
 * With no pins: development and tests fall back to the Firestore document (so local emulators keep working); a
 * PRODUCTION build fails closed (nobody is trusted, coach chat shows "not verified").
 */
export interface SigningPin {
  kid: string;
  /** SPKI public key, PEM or bare base64 */
  pub: string;
}

export const rotationPayload = (kid: string, pub: string): string =>
  `signrot|1|${kid}|${pub.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '')}`;

export function parsePins(raw: unknown): SigningPin[] {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (p): p is SigningPin =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as SigningPin).kid === 'string' &&
        (p as SigningPin).kid.length > 0 &&
        typeof (p as SigningPin).pub === 'string' &&
        (p as SigningPin).pub.length > 0,
    )
    .slice(0, 8);
}

/** Pins compiled into this build. */
export function buildPins(): SigningPin[] {
  try {
    return parsePins(
      (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_COACH_SIGNING_PINS,
    );
  } catch {
    return [];
  }
}

export const isProductionBuild = (): boolean => {
  try {
    return (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD === true;
  } catch {
    return false;
  }
};
