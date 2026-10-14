/**
 * The schedule store seen as a feed for the world store (`data/worldStore.ts`). The schedule store is the ONE place that
 * knows the sessions: when a reschedule is accepted there, the world (Today, Roster, Week counts, Client 360) follows
 * through this feed in the same session. Pure wiring, no state of its own.
 */
import type { ScheduleFeed } from '../data/worldStore';
import type { ScheduleStore } from './scheduleStore';

export function scheduleFeedOf(store: ScheduleStore): ScheduleFeed {
  let memo: { docs: unknown; requests: unknown; out: ReturnType<ScheduleFeed['peek']> } | null =
    null;
  return {
    peek() {
      const s = store.getState();
      if (s.status === 'loading' && !s.docs.length) return null;
      if (memo && memo.docs === s.docs && memo.requests === s.requests) return memo.out;
      const out = { docs: [...s.docs], requests: [...s.requests], asOf: s.asOf ?? store.now() };
      memo = { docs: s.docs, requests: s.requests, out };
      return out;
    },
    subscribe: (f) => store.subscribe(f),
    start: () => store.start(),
  };
}
