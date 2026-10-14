/**
 * User-visible "Security code" for a trainer public key (shown to both sides in chat info).
 * `fingerprint()` (vaultGrants) is only 64 bits and is for key pinning; this one is built for
 * people to compare: SHA-256 over a domain-separated canonical key, reduced to 24 decimal
 * digits (about 79.7 bits) in six groups of four, e.g. "0412 9981 3307 5528 1046 7790".
 */
/** @internal planned: format constant of the security-code screen. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export const SECURITY_CODE_DIGITS = 24;

/** @internal planned: security-code screen (Part C) and key-change notice. Re-exported from the barrel (index.ts) and covered by barrel.test.ts. */
export async function securityCode(pub: JsonWebKey): Promise<string> {
  if (pub.kty !== 'EC' || pub.crv !== 'P-256' || !pub.x || !pub.y) throw new Error('bad-key');
  const data = new TextEncoder().encode(`spotter.security-code.v1|${pub.crv}|${pub.x}|${pub.y}`);
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data));
  let n = 0n;
  for (const b of h.slice(0, 12)) n = (n << 8n) | BigInt(b); // 96 bits, reduced below (bias ~ 2^-16)
  const digits = (n % 10n ** BigInt(SECURITY_CODE_DIGITS))
    .toString()
    .padStart(SECURITY_CODE_DIGITS, '0');
  return digits.match(/.{4}/g)!.join(' ');
}
