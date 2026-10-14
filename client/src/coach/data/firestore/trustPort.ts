/**
 * The real `TrustPort`: the trainer's public key from `coachKeys/{uid}`, trusted ONLY with the server signature
 * (`trust.ts`), reduced to the 24-digit security code. An unsigned, foreign or malformed key yields `code: null`
 * (the UI says "no code yet"), never a code for a key we would not wrap a conversation key to.
 */
import { securityCode } from '../../../coachCrypto/securityCode';
import type { PeerKey, TrustPort } from '../../security/trustPort';
import type { FsApi } from './fsApi';
import { trustedCoachPub, type ServerSigning } from './trust';

export function createFirestoreTrustPort(
  fs: FsApi,
  signing: () => Promise<ServerSigning | null>,
): TrustPort {
  const last = new Map<string, PeerKey>();
  return {
    peek: (uid) => last.get(uid) ?? null,
    subscribe(uid, on, onError) {
      let seq = 0;
      let live = true;
      const off = fs.listenDoc(
        `coachKeys/${uid}`,
        (rec) => {
          const mine = ++seq;
          void (async () => {
            try {
              const pub = await trustedCoachPub(rec, uid, await signing());
              const k: PeerKey = { code: pub ? await securityCode(pub) : null };
              if (!live || mine !== seq) return; // a newer document already answered
              last.set(uid, k);
              on(k);
            } catch (e) {
              if (live) onError(e);
            }
          })();
        },
        (e) => live && onError(e),
      );
      return () => {
        live = false;
        off();
      };
    },
  };
}
