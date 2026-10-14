import { securityCode } from '../../../coachCrypto/securityCode';
import type { PeerKey, TrustPort } from '../trustPort';

const b64u = (s: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** A P-256-shaped JWK from a seed (fixtures only: the point is not on the curve, `securityCode` only reads x and y). */
export const fixtureJwk = (seed: string): JsonWebKey => ({
  kty: 'EC',
  crv: 'P-256',
  x: b64u(`x|${seed}`),
  y: b64u(`y|${seed}`),
});

export interface FixturesTrustPort extends TrustPort {
  /** Stories / tests: the trainer gets a new key (a new device); every subscriber hears the new code. */
  rotate(trainerUid: string): Promise<void>;
}

export function createFixturesTrustPort(
  opts: { epochs?: Record<string, number> } = {},
): FixturesTrustPort {
  const epoch = new Map<string, number>(Object.entries(opts.epochs ?? {}));
  const codes = new Map<string, string>();
  const subs = new Map<string, Set<(k: PeerKey) => void>>();
  const compute = async (uid: string): Promise<string> => {
    const k = `${uid}#${epoch.get(uid) ?? 0}`;
    let c = codes.get(k);
    if (!c) {
      c = await securityCode(fixtureJwk(k));
      codes.set(k, c);
    }
    return c;
  };
  return {
    peek(uid) {
      const c = codes.get(`${uid}#${epoch.get(uid) ?? 0}`);
      return c ? { code: c } : null;
    },
    subscribe(uid, on, onError) {
      let live = true;
      const set = subs.get(uid) ?? new Set();
      subs.set(uid, set);
      const f = (k: PeerKey) => live && on(k);
      set.add(f);
      compute(uid).then((code) => f({ code }), onError);
      return () => {
        live = false;
        set.delete(f);
      };
    },
    async rotate(uid) {
      epoch.set(uid, (epoch.get(uid) ?? 0) + 1);
      const code = await compute(uid);
      subs.get(uid)?.forEach((f) => f({ code }));
    },
  };
}
