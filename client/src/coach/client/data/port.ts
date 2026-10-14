/**
 * The ONE seam between the client-side trainer screens and their data (plan 2.6: components never call Firebase or
 * callables). The fixtures adapter (`fixtures.ts`) implements it for stories, tests and the dev server.
 *
 * The real adapter (done): `data/firestore/clientPort.ts`. Calls:
 *   getInvite(token)        callable `coachInvitePreview` -> { state, trainerName, org, expiresAt }; the token is a server secret.
 *   acceptInvite / decline  callables `coachAccept` / `coachDecline`; accept writes the grants through the existing
 *                           ECDH grants flow (coachCrypto/vaultWrap createWrap) and the sealed `grants` doc; "waiting"
 *                           until the trainer's app completes the key exchange (S-34).
 *   setLevel                one sealed grant write, applies at once; a downgrade deletes evidence server-side.
 *   revoke / restore        revoke = grants off + relationship stays; restore = rewrite the previous grants while the keys
 *                           are still held (Undo, 8 s).
 *   leave                   ends the relationship (chat and program stay with the client).
 *   accessLog               list of the trainer's `logRead` entries about me (90 days), newest first.
 * Everything user-written goes through `sealOrThrow` (new collections `grants`, `invites` to register by the SERVER agent).
 */
import type { Consent } from '../../domain/types';
import type { AccessEntry, ClientSnapshot, InviteInfo } from './types';

export type Unsubscribe = () => void;

export interface ClientCoachPort {
  now(): number;
  /** Last good snapshot from the local sealed cache, or null. Never blocks. */
  peek(): ClientSnapshot | null;
  subscribe(on: (s: ClientSnapshot) => void, onError: (e: unknown) => void): Unsubscribe;
  getInvite(token: string): Promise<InviteInfo>;
  /** Writes the grants; nothing is written before this call (S-25 AC). */
  acceptInvite(token: string, grants: Consent): Promise<void>;
  declineInvite(token: string): Promise<void>;
  setLevel(category: keyof Consent, level: Consent[keyof Consent]): Promise<void>;
  /** Resolves with the grants that existed, for Undo. */
  revoke(): Promise<{ previous: Consent }>;
  restore(previous: Consent): Promise<void>;
  leave(): Promise<void>;
  accessLog(): Promise<AccessEntry[]>;
  ackProgram(version: number): Promise<void>;
  setSelfCoachDays(days: readonly string[]): Promise<void>;
}
