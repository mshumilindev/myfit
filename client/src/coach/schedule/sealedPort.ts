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

export interface SealedScheduleDeps {
  store: ScheduleDocStore;
  vault: SealSource['vault'];
  /** The conversation key ring of one client (the key of that client's schedule and requests). */
  ringFor: (clientId: string) => ChatKeyRing | null;
  /** The ring of an earlier epoch (history after a key rotation); without it only current-epoch documents open. */
  ringForEpoch?: (clientId: string, epoch: number) => ChatKeyRing | null;
  /** The trainer's uid (author of every schedule doc). */
  uid: string;
  now?: () => number;
  /**
   * A member's device: read every session in the zone the trainer wrote the schedule in (`ScheduleDoc.tz`), so a
   * 18:00 session is 18:00 at the gym on a phone in any zone. The trainer's device keeps its own zone.
   */
  adoptZone?: boolean;
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

  /** The ring that opens a document sealed in `epoch`: the current one, or a past one when this device holds it. */
  const ringAt = (clientId: string, epoch: unknown): ChatKeyRing | null => {
    const cur = d.ringFor(clientId);
    if (!Number.isInteger(epoch) || cur?.epoch === epoch) return cur;
    return d.ringForEpoch?.(clientId, epoch as number) ?? null;
  };

  async function open(raw: RawSchedule): Promise<ScheduleData> {
    const docs: ScheduleDoc[] = [];
    const requests: RescheduleRequest[] = [];
    for (const s of raw.schedules) {
      const ring = ringAt(String(s.clientId), s.keyEpoch);
      if (!ring) continue;
      try {
        docs.push(await openSchedule({ vault: d.vault, ring }, String(s.clientId), s));
      } catch {
        /* does not open: never shown */
      }
    }
    for (const r of raw.requests) {
      const ring = ringAt(r.clientId, r.raw.keyEpoch);
      if (!ring) continue;
      try {
        const req = await openRequest({ vault: d.vault, ring }, String(r.raw.id), r.raw);
        requests.push({ ...req, clientId: r.clientId });
        raws.set(req.id, r.raw);
      } catch {
        /* does not open: never shown */
      }
    }
    rememberGymNames(docs);
    if (d.adoptZone) {
      const tz = docs.find((x) => x.tz)?.tz;
      if (tz) setCoachTimeZone(tz);
    }
    return { docs, requests, asOf: now() };
  }

  return {
    now,
    peek: () => last,
    subscribe(on, onError): Unsubscribe {
      let stop = false;
      const off = d.store.subscribe((raw) => {
        void open(raw).then((data) => {
          if (stop) return;
          last = data;
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
      const raw = await sealSchedule({ vault: d.vault, ring }, next, d.uid, now());
      if (!(await d.store.setSchedule(doc.clientId, raw, doc.rev)))
        throw new SchedulePortError('conflict');
      return next;
    },
    async createRequest(r) {
      const ring = d.ringFor(r.clientId);
      if (!ring) throw new SchedulePortError('vault-locked', 'chat-key-missing');
      const raw = await sealRequest({ vault: d.vault, ring }, r);
      raws.set(r.id, raw);
      await d.store.setRequest(r.clientId, r.id, raw);
    },
    async setStatus(r, status, decidedAt) {
      await d.store.patchRequest(r.clientId, r.id, { status, decidedAt });
    },
  };
}
