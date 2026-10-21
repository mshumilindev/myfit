import type { SealSource } from '../../coachCrypto/sealOrThrow';
import type { ChatKeyRing } from '../../coachCrypto/conversationKey';
import { openRequest, openSchedule, sealRequest, sealSchedule } from './scheduleCodec';
import {
  SchedulePortError,
  type RawSchedule,
  type ScheduleData,
  type SchedulePort,
  type ScheduleDocStore,
  type Unsubscribe,
} from './port';
import {
  gymIdsOf,
  rememberGymNames,
  scheduleGyms,
  type RescheduleRequest,
  type ScheduleDoc,
} from './types';
import { coachTimeZone, setCoachTimeZone } from '../format';
import { timingOf } from './timing';

/** The on-device snapshot of the schedule (sealed; `data/firestore/scheduleCache.ts`). Never rejects. */
export interface ScheduleCache {
  get(): Promise<ScheduleData | null>;
  set(d: ScheduleData): Promise<void>;
}

export interface SealedScheduleDeps {
  store: ScheduleDocStore;
  vault: SealSource['vault'];
  /** The conversation key ring of one client (the key of that client's schedule and requests). */
  ringFor: (clientId: string) => ChatKeyRing | null;
  /** The ring of an earlier epoch (history after a key rotation); without it only current-epoch documents open. */
  ringForEpoch?: (clientId: string, epoch: number) => ChatKeyRing | null;
  /**
   * The trainer's uid (author of every schedule doc). A team manager writes under the trainer of EACH client (the rules
   * pin `trainerId` to the client's coaching), so it may be a function of the client.
   */
  uid: string | ((clientId: string) => string);
  now?: () => number;
  /**
   * A member's device: read every session in the zone the trainer wrote the schedule in (`ScheduleDoc.tz`), so a
   * 18:00 session is 18:00 at the gym on a phone in any zone. The trainer's device keeps its own zone.
   */
  adoptZone?: boolean;
  /** A team manager's device: every request it creates is marked as proposed by a manager (the server enforces it too). */
  via?: 'manager';
  /** the manager's display name, sealed into the requests it creates */
  viaName?: string;
  /** the signed-in writer, recorded open as `updatedBy` (rules: must equal the caller; required for a manager) */
  writerUid?: string;
  /**
   * Stale-while-revalidate: the last COMPLETE answer is kept on this device (sealed) and shown at once on the next start,
   * before the key rings arrive. A live answer always wins over it.
   */
  cache?: ScheduleCache;
}

/**
 * SchedulePort over a ScheduleDocStore: every write is sealed first (`scheduleCodec`); a locked vault or a missing ring
 * throws BEFORE anything is written (`vault-locked`), so a schedule is never stored in the clear. A document that does not
 * open (wrong key, copied from elsewhere, tampered) is dropped from the data, never shown. The requester seals a request;
 * answering only patches the open `status` / `decidedAt`.
 */
export function createSealedSchedulePort(d: SealedScheduleDeps): SchedulePort {
  const now = d.now ?? (() => Date.now());
  let last: ScheduleData | null = null;
  const raws = new Map<string, Record<string, unknown>>(); // request id -> raw (kept for status patches)

  /** What an adopted answer changes outside the data itself: the gym names and (member side) the schedule's zone. */
  function settle(docs: ScheduleDoc[]) {
    rememberGymNames(docs);
    if (d.adoptZone) {
      const tz = docs.find((x) => x.tz)?.tz;
      if (tz) setCoachTimeZone(tz);
    }
  }

  // the on-device snapshot: read once, in the background; `hydrate` lets the store adopt it when it lands
  const hydrated: Promise<void> = d.cache
    ? d.cache
        .get()
        .then((c) => {
          if (c && !last) {
            last = c;
            settle(c.docs);
          }
        })
        .catch(() => undefined)
    : Promise.resolve();

  /** The ring that opens a document sealed in `epoch`: the current one, or a past one when this device holds it. */
  const ringAt = (clientId: string, epoch: unknown): ChatKeyRing | null => {
    const cur = d.ringFor(clientId);
    if (!Number.isInteger(epoch) || cur?.epoch === epoch) return cur;
    return d.ringForEpoch?.(clientId, epoch as number) ?? null;
  };

  async function open(raw: RawSchedule): Promise<{ data: ScheduleData; complete: boolean }> {
    // `complete` = every document had its key ring. An answer that skipped one only because the ring has not arrived yet
    // must not replace a good snapshot on disk (the rings arrive late).
    let complete = true;
    const docs: ScheduleDoc[] = [];
    const requests: RescheduleRequest[] = [];
    for (const s of raw.schedules) {
      const ring = ringAt(String(s.clientId), s.keyEpoch);
      if (!ring) {
        complete = false;
        continue;
      }
      try {
        docs.push(await openSchedule({ vault: d.vault, ring }, String(s.clientId), s));
      } catch {
        /* does not open: never shown */
      }
    }
    for (const r of raw.requests) {
      const ring = ringAt(r.clientId, r.raw.keyEpoch);
      if (!ring) {
        complete = false;
        continue;
      }
      try {
        const req = await openRequest({ vault: d.vault, ring }, String(r.raw.id), r.raw);
        requests.push({ ...req, clientId: r.clientId });
        raws.set(req.id, r.raw);
      } catch {
        /* does not open: never shown */
      }
    }
    settle(docs);
    return { data: { docs, requests, asOf: now() }, complete };
  }

  return {
    now,
    peek: () => last,
    hydrate: () => hydrated,
    subscribe(on, onError): Unsubscribe {
      let stop = false;
      const off = d.store.subscribe((raw) => {
        void open(raw).then(({ data, complete }) => {
          if (stop) return;
          last = data;
          if (complete) void d.cache?.set(data).catch(() => undefined);
          on(data);
        }, onError);
      }, onError);
      return () => {
        stop = true;
        off();
      };
    },
    async saveDoc(doc) {
      const ring = d.ringFor(doc.clientId);
      if (!ring) throw new SchedulePortError('vault-locked', 'chat-key-missing');
      // names of the gyms this document uses: the trainer's current list wins, an earlier name is kept for an id it lacks
      const names: Record<string, string> = {};
      for (const id of gymIdsOf(doc)) {
        const n = scheduleGyms().find((g) => g.id === id)?.name ?? doc.gymNames?.[id];
        if (n) names[id] = n;
      }
      const { gymNames: _old, ...rest } = doc;
      void _old;
      const next: ScheduleDoc = {
        ...rest,
        rev: doc.rev + 1,
        tz: coachTimeZone(),
        ...(Object.keys(names).length ? { gymNames: names } : {}),
      };
      const sealed = await sealSchedule(
        { vault: d.vault, ring },
        next,
        typeof d.uid === 'function' ? d.uid(doc.clientId) : d.uid,
        now(),
      );
      // the one open field: moments only (SPO-265), see timing.ts
      const raw = {
        ...sealed,
        timing: timingOf(next, now()),
        ...(d.writerUid ? { updatedBy: d.writerUid } : {}),
      };
      if (!(await d.store.setSchedule(doc.clientId, raw, doc.rev)))
        throw new SchedulePortError('conflict');
      return next;
    },
    async createRequest(r) {
      const ring = d.ringFor(r.clientId);
      if (!ring) throw new SchedulePortError('vault-locked', 'chat-key-missing');
      const raw = await sealRequest(
        { vault: d.vault, ring },
        d.via ? { ...r, via: d.via, byName: d.viaName } : r,
      );
      raws.set(r.id, raw);
      await d.store.setRequest(r.clientId, r.id, raw);
    },
    async setStatus(r, status, decidedAt) {
      await d.store.patchRequest(r.clientId, r.id, { status, decidedAt });
    },
  };
}
