/**
 * The member's side of the Live feed (plan-backend section 9, R-BE-LIVE-1..6): ONE small doc `liveSessions/{me}` that
 * the trainer's Live widget reads. Open: `id, trainerId, startedAt, updatedAt (heartbeat), finishedAt?, expireAt?,
 * keyEpoch`. Sealed with the conversation `live` sub-key (`sealOrThrow('liveSessions')`): `athleteName, gymName,
 * exerciseCount, sessionName`, the previous session's `last*` context and, only after the session ended, `finalSets` /
 * `finalTonnageKg`. NEVER in it: exercise names, sets, loads, notes (rules: a write with another key is refused).
 *
 *   consent   written only while the relationship is active and `totals != off` (mode `program` has all categories off).
 *             Lowered mid-session: the next sync deletes the doc. `last*` follow the same level: the day name of the last
 *             session only at totals `full`; its sets and tonnage at `effects`.
 *   beat      every 45 s only `{ updatedAt }` is updated (`fs.update`); the sealed part is rewritten only when it changed.
 *   finish    `finishedAt`, `expireAt = +10 min` and the final totals; the doc is overwritten, not deleted, so the trainer
 *             sees "Finished". The next start overwrites it. A TTL policy / the UI filter drop it later.
 *   fail      closed: a locked vault or a missing key ring throws before anything is written.
 *
 * The caller (`installFirestoreClient`) feeds `sync` from the store and a 45 s timer; it never runs for a member without
 * an in-app trainer. It is the ONLY writer of the doc while installed: `bootstrap.ts` switches the legacy presence-only
 * writer of `store.ts` off (`setLegacyLiveWriter(false)`) and back on at teardown, and feeds it the open workout too.
 */
import type { Vault } from '../../../autoVault';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import { sealOrThrow } from '../../../coachCrypto/sealOrThrow';
import type { Workout } from '../../../types';
import type { Level } from '../../domain/types';
import type { FsApi } from './fsApi';

export const LIVE_BEAT_MS = 45_000;
/** how long the finished doc stays before its TTL */
export const LIVE_FINISH_TTL_MS = 10 * 60_000;
/** a workout finished longer ago than this is no longer announced */
const FINISH_WINDOW_MS = 10 * 60_000;

export interface LiveWriterInput {
  /** The relationship is active and this is an in-app trainer. */
  active: boolean;
  trainerId: string | null;
  cid: string | null;
  /** consent level of `totals`; `off` removes the doc */
  totals: Level;
  workouts: readonly Workout[];
  athleteName: string;
  gymName: (gymId: string | null | undefined) => string | null;
}

export interface LiveWriter {
  /** Idempotent: call on every change of the workouts, the link or the consent. */
  sync(i: LiveWriterInput): Promise<void>;
  /** The 45 s timer: heartbeat (or nothing) for the last input. */
  beat(): Promise<void>;
}

const working = (w: Workout) =>
  (w.exercises ?? [])
    .filter((e) => (e.kind ?? 'strength') === 'strength')
    .flatMap((e) => (e.sets ?? []).filter((s) => !(s.isWarmup || s.type === 'warmup')));

export const finalOf = (w: Workout): { sets: number; tonnageKg: number } => {
  const sets = working(w);
  return {
    sets: sets.length,
    tonnageKg: Math.round(sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)),
  };
};

export function createLiveWriter(d: {
  fs: FsApi;
  vault: Vault;
  uid: string;
  /** current key ring of the member's conversation */
  ring: (cid: string) => Promise<ChatKeyRing>;
}): LiveWriter {
  const path = `liveSessions/${d.uid}`;
  /** what this device last wrote: null = nothing (or unknown) */
  let wrote: { startedAt: number; sealed: string; finished: boolean } | null = null;
  let lastBeat = 0;
  let lastInput: LiveWriterInput | null = null;
  let busy: Promise<void> = Promise.resolve();

  async function sealDoc(
    i: LiveWriterInput,
    startedAt: number,
    open: Record<string, unknown>,
    secret: Record<string, unknown>,
  ) {
    const ring = await d.ring(i.cid as string);
    return sealOrThrow(
      'liveSessions',
      { id: d.uid, trainerId: i.trainerId, startedAt, ...open, ...secret },
      { vault: d.vault, ring, ctx: { messageId: d.uid, fromUid: d.uid, at: startedAt } },
    );
  }

  /** the previous finished session of the member, as the banner's context line (consent-cut at the source) */
  function lastContext(i: LiveWriterInput, before: number): Record<string, unknown> {
    const prev = i.workouts
      .filter((w) => w.finishedAt != null && w.startedAt < before)
      .sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!prev) return {};
    const f = finalOf(prev);
    return {
      lastSets: f.sets,
      lastTonnageKg: f.tonnageKg,
      lastAt: prev.startedAt,
      ...(i.totals === 'full' && prev.dayName ? { lastName: prev.dayName } : {}),
    };
  }

  async function run(i: LiveWriterInput): Promise<void> {
    lastInput = i;
    const eligible = i.active && !!i.trainerId && !!i.cid && i.totals !== 'off';
    if (!eligible) {
      if (wrote) {
        await d.fs.del(path);
        wrote = null;
      }
      return;
    }
    const now = d.fs.now();
    const open = i.workouts
      .filter((w) => w.finishedAt == null)
      .sort((a, b) => b.startedAt - a.startedAt)[0];
    if (open) {
      const secret = {
        athleteName: i.athleteName,
        ...(i.gymName(open.gymId) ? { gymName: i.gymName(open.gymId) } : {}),
        exerciseCount: (open.exercises ?? []).filter((e) => (e.kind ?? 'strength') === 'strength')
          .length,
        ...(open.dayName ? { sessionName: open.dayName } : {}),
        ...lastContext(i, open.startedAt),
      };
      const sealedKey = JSON.stringify(secret);
      if (
        wrote &&
        wrote.startedAt === open.startedAt &&
        !wrote.finished &&
        wrote.sealed === sealedKey
      ) {
        if (now - lastBeat >= LIVE_BEAT_MS) {
          await d.fs.update(path, { updatedAt: now });
          lastBeat = now;
        }
        return;
      }
      const doc = await sealDoc(i, open.startedAt, { updatedAt: now }, secret);
      await d.fs.set(path, doc);
      wrote = { startedAt: open.startedAt, sealed: sealedKey, finished: false };
      lastBeat = now;
      return;
    }
    const done = i.workouts
      .filter((w) => w.finishedAt != null && now - (w.finishedAt as number) < FINISH_WINDOW_MS)
      .sort((a, b) => (b.finishedAt as number) - (a.finishedAt as number))[0];
    if (!done) return; // nothing running, nothing just finished: the doc (if any) expires on its own
    if (wrote && wrote.startedAt === done.startedAt && wrote.finished) return;
    const fin = finalOf(done);
    const secret = {
      athleteName: i.athleteName,
      ...(i.gymName(done.gymId) ? { gymName: i.gymName(done.gymId) } : {}),
      exerciseCount: (done.exercises ?? []).filter((e) => (e.kind ?? 'strength') === 'strength')
        .length,
      ...(done.dayName ? { sessionName: done.dayName } : {}),
      // sets and weights exist only after the session ended (and only here, at totals effects / full)
      finalSets: fin.sets,
      finalTonnageKg: fin.tonnageKg,
    };
    const doc = await sealDoc(
      i,
      done.startedAt,
      {
        updatedAt: now,
        finishedAt: done.finishedAt as number,
        expireAt: (done.finishedAt as number) + LIVE_FINISH_TTL_MS,
      },
      secret,
    );
    await d.fs.set(path, doc);
    wrote = { startedAt: done.startedAt, sealed: JSON.stringify(secret), finished: true };
  }

  const queue = (i: LiveWriterInput) => {
    busy = busy.then(
      () => run(i),
      () => run(i),
    );
    return busy;
  };
  return {
    sync: queue,
    beat: () => (lastInput ? queue(lastInput) : Promise.resolve()),
  };
}
