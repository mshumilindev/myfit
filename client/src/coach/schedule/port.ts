/**
 * The seams of the schedule. Components never touch Firestore or the vault (plan 2.6):
 *   SchedulePort      what the UI store calls: live schedule docs + requests, save a doc (optimistic concurrency), create /
 *                     answer a request. The in-memory adapter (`fixtures.ts`) and the sealed adapter (`sealedPort.ts`) implement it.
 *   ScheduleDocStore  the raw document seam under the SEALED adapter (in-memory for tests and stories).
 *
 * The real adapter (done): `data/firestore/scheduleDocStore.ts` under the sealed port; the callables are `rescheduleCreate` / `rescheduleRespond`. It does:
 *   ScheduleDocStore over Firestore:  schedules/{clientId} (trainer writes, client reads, `rev` checked in a transaction)
 *     and conversations/{cid}/requests/{rid} (the REQUESTER creates through the `rescheduleCreate` callable, the OTHER party
 *     changes only `status` / `decidedAt` through `rescheduleRespond`; both validate the open fields only: one open request
 *     per `slotKey`, `createdAt < expiresAt <= createdAt + 14 d`, active relationship). The hourly job flips expired requests.
 *   The conversation key ring comes from `coachCrypto/conversationKey` (sub-keys `schedule` and `requests`).
 *   `slotKey` is an opaque id (see `opaqueSlotKey` in `ids.ts`: unique and opaque, not a MAC; a purpose-key HMAC is an open hardening item).
 */
import type { ReqStatus, RescheduleRequest, ScheduleDoc } from './types';

export type Unsubscribe = () => void;

export interface ScheduleData {
  docs: ScheduleDoc[];
  requests: RescheduleRequest[];
  asOf: number;
}

export type SchedulePortErrorCode =
  'conflict' | 'offline' | 'vault-locked' | 'unavailable' | 'forbidden';
export class SchedulePortError extends Error {
  constructor(
    readonly code: SchedulePortErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'SchedulePortError';
  }
}

export interface SchedulePort {
  now(): number;
  /** The last good snapshot from the local (sealed) cache, or null. Never blocks. */
  peek(): ScheduleData | null;
  /**
   * Resolves once the on-device snapshot has been read (so `peek()` may now return it). Never rejects, never blocks the
   * screen: the store shows what it has and adopts the snapshot when it lands, unless live data got there first.
   */
  hydrate?(): Promise<void>;
  /** Live data; calls `on` at once with the cached snapshot when there is one. */
  subscribe(on: (d: ScheduleData) => void, onError: (e: unknown) => void): Unsubscribe;
  /** Write one client's doc when its stored `rev` equals `doc.rev`; resolves with the stored doc (rev + 1), rejects `conflict`. */
  saveDoc(doc: ScheduleDoc): Promise<ScheduleDoc>;
  /** The requester creates a request (sealed content). Idempotent by `id`. */
  createRequest(r: RescheduleRequest): Promise<void>;
  /** The other party answers (or the creator cancels): only `status` and `decidedAt` change. */
  setStatus(r: RescheduleRequest, status: ReqStatus, decidedAt: number): Promise<void>;
}

export type RawDoc = Record<string, unknown>;
export interface RawSchedule {
  schedules: RawDoc[];
  /** `clientId` = the conversation the document lives in (its key ring opens it) */
  requests: { clientId: string; raw: RawDoc }[];
}
export interface ScheduleDocStore {
  subscribe(on: (d: RawSchedule) => void, onError: (e: unknown) => void): Unsubscribe;
  /** Set a schedule doc if its stored `rev` is `expectedRev` (0 = new); false = lost the race. */
  setSchedule(clientId: string, raw: RawDoc, expectedRev: number): Promise<boolean>;
  setRequest(clientId: string, id: string, raw: RawDoc): Promise<void>;
  /** Only the open status fields. */
  patchRequest(
    clientId: string,
    id: string,
    patch: { status: ReqStatus; decidedAt: number },
  ): Promise<void>;
}
