/**
 * The seam between the security-code UI and where the code comes from (plan Part C.2 no. 5): the trainer's PUBLIC key,
 * trusted only with the server signature (`data/firestore/trust.ts`), reduced to the 24-digit `securityCode`. Both
 * sides show the same code (it is the trainer's key), so the client can compare it with the trainer out loud.
 *
 * The Firestore port (`data/firestore/trustPort.ts`) is installed together with the other real adapters.
 */
import { coachTestDefault } from '../data/testHooks';

export interface PeerKey {
  /** Six groups of four digits, or null while the key is not known / not signed. Never a guess. */
  code: string | null;
}
export type Unsubscribe = () => void;

export interface TrustPort {
  /** Last known code (sealed cache or memory), or null. Never blocks. */
  peek(trainerUid: string): PeerKey | null;
  subscribe(
    trainerUid: string,
    on: (k: PeerKey) => void,
    onError: (e: unknown) => void,
  ): Unsubscribe;
}

let port: TrustPort | null = null;
/** Install the real adapter (or null to reset to the unavailable one). */
export function configureTrustPort(p: TrustPort | null): void {
  port = p;
}
const unavailableTrust: TrustPort = {
  peek: () => null,
  subscribe: (_uid, _on, onError) => {
    queueMicrotask(() => onError(new Error('unavailable')));
    return () => undefined;
  },
};
export const getTrustPort = (): TrustPort =>
  (port ??= coachTestDefault<TrustPort>('trust')?.() ?? unavailableTrust);
