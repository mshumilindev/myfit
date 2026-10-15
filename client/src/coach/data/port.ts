/**
 * The ONE seam between the coach UI and its data (plan 2.6: components never call Firebase or callables).
 * A real adapter (coachRead + sealed caches) and the in-memory fixtures adapter implement the same port.
 *
 * The real adapter is `data/firestore/worldPort.ts` (callables `coachClients` and `coachRead`, plus the sealed decision
 * documents). Their shapes:
 *   coachRead(req: { clientId: string; categories: Category[]; since?: number }):
 *     Promise<Record<Category, { state: 'locked' } | { state: 'not-applicable' } |
 *                              { state: 'ok'; level: Level; docs?: unknown[]; view?: unknown; asOf: number }>>
 *   coachRoster(): Promise<{ clients: { clientId: string; mode: LogMode; consent: Consent; consentVersion: number; ... }[] }>
 *   Decisions + signalState are plain sealed docs (users/{trainer}/decisions, meta/signalState): see decisionDocs.ts.
 */
import type { DecisionBook } from '../domain/decisions';
import type { OutcomeData } from '../domain/outcome';
import type { ClientSignalInput } from '../domain/signalInputs';
import type { ClientHistory } from '../domain/history';
import type { CoachClient, Slot } from '../domain/types';
import type { BookOp } from './bookOps';

/** Everything the dashboard shows, as last read. Plain data, no functions. */
export interface WorldData {
  /** when this data was produced (server / cache time); the UI shows "Updated 14:02" */
  asOf: number;
  trainer: { id: string; name: string };
  clients: CoachClient[];
  /** consent-filtered engine inputs per client (the engine gates again) */
  inputs: ClientSignalInput[];
  slots: Slot[];
  book: DecisionBook;
  /** for outcome measurement, keyed by signal key */
  outcomeData?: Record<string, OutcomeData>;
  /** lifts, last sessions and weekly rhythm per client (Client 360 Overview); consent-gated by the UI via gateHistory */
  history?: Record<string, ClientHistory>;
}

export interface LoadOptions {
  signal: AbortSignal;
}

export type PortErrorCode =
  'offline' | 'timeout' | 'forbidden' | 'not-deployed' | 'unavailable' | 'vault-locked';
export class PortError extends Error {
  constructor(
    readonly code: PortErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'PortError';
  }
}

export interface CoachWorldPort {
  /** Synchronous read of the last good snapshot from the local (sealed) cache, or null. Never blocks. */
  peek(): { data: WorldData; fetchedAt: number } | null;
  /**
   * Optional: finish reading the on-device snapshot (it can wait for the vault key). After it settles `peek()` returns
   * the snapshot. Never rejects and never blocks the screen: the store shows what it has and adopts this when it lands.
   */
  hydrate?(): Promise<void>;
  /** Read from the server. May be slow or fail; the store never waits for it on screen. */
  load(opts: LoadOptions): Promise<WorldData>;
  /** Persist one change (sealed with sealOrThrow by the real adapter). Throws -> the store keeps it queued. */
  save(op: BookOp, book: DecisionBook): Promise<void>;
  /** Optional clock override (the fixtures adapter pins Wed 7 Oct 2026 09:05). */
  now?(): number;
  /** Optional push invalidation (snapshot listener). */
  subscribe?(onChange: () => void): () => void;
  /** End the coaching relationship with one client (`coachEnd`): sharing stops both ways, the client keeps chat and program. */
  endCoaching?(clientId: string): Promise<void>;
}
