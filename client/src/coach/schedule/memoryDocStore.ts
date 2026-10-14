/** In-memory `ScheduleDocStore` (tests, stories): holds RAW sealed documents, so a test can prove nothing is plaintext. */
import type { RawDoc, RawSchedule, ScheduleDocStore } from './port';
import type { ReqStatus } from './types';

export interface MemoryDocStore extends ScheduleDocStore {
  /** Every stored document as JSON text (for "no plaintext" assertions). */
  dumpText(): string;
  raw(): RawSchedule;
}

export function createMemoryDocStore(): MemoryDocStore {
  const schedules = new Map<string, RawDoc>();
  const requests = new Map<string, { clientId: string; raw: RawDoc }>();
  const subs = new Set<(d: RawSchedule) => void>();
  const raw = (): RawSchedule => ({
    schedules: [...schedules.values()].map((x) => ({ ...x })),
    requests: [...requests.values()].map((x) => ({ clientId: x.clientId, raw: { ...x.raw } })),
  });
  const emit = () => subs.forEach((f) => f(raw()));
  return {
    subscribe(on) {
      subs.add(on);
      on(raw());
      return () => void subs.delete(on);
    },
    async setSchedule(clientId, doc, expectedRev) {
      const cur = schedules.get(clientId);
      if (Number(cur?.rev ?? 0) !== expectedRev) return false;
      schedules.set(clientId, doc);
      emit();
      return true;
    },
    async setRequest(clientId, id, doc) {
      requests.set(id, { clientId, raw: doc });
      emit();
    },
    async patchRequest(clientId, id, patch: { status: ReqStatus; decidedAt: number }) {
      const cur = requests.get(id);
      if (!cur) return;
      requests.set(id, { clientId, raw: { ...cur.raw, ...patch } });
      emit();
    },
    dumpText: () => JSON.stringify(raw()),
    raw,
  };
}
