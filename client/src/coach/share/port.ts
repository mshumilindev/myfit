/**
 * The seam between the share UI and its data (plan 2.6: components never call Firebase or callables). The fixtures
 * adapter (`fixtures.ts`) and the real adapter implement the same port.
 *
 * The real adapter (done): `data/firestore/shareSource.ts`. It does:
 *   library     the bundled catalogues (`library.ts`: exercises, equipment, no network) + `sharedGyms/{externalId}` for gyms.
 *   programs    `programs/{id}` the trainer authored or the client is assigned to (plaintext per rules, plan 6.2), mapped to
 *               `ProgramSource` (bare rows have sets 0). `assignedTo` comes from `plans/{clientId}.programId`.
 *   clients     only the thread's client: `coachRead({ clientId, categories: ['totals','sets'] })` results, already cut by
 *               the client's consent level on the server (the resolver gates again). Sealed local cache, never plaintext
 *               in storage. For a CLIENT viewer: the client's own decrypted data and the assigned program only.
 * A share message stores only the `ShareRef`; resolution always runs with the READER's source, so a card can never
 * widen access (locked / removed / limited).
 */
import type { ShareSource } from './types';

export interface ShareSourcePort {
  /** Last good snapshot from the local (sealed) cache, or null. Never blocks. */
  peek(clientId: string): ShareSource | null;
  /** Fresh read. May be slow or fail; the UI keeps showing the cached snapshot. */
  load(clientId: string, opts: { signal: AbortSignal }): Promise<ShareSource>;
}
