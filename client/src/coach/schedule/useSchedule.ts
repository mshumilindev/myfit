import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useMinuteClock } from '../../components/ui/NowLine';
import { getChatPort } from '../data/config';
import { getClientChatPort } from '../client/data/config';
import { coachAdapter } from '../data/backend';
import { createUnavailableSchedulePort } from '../data/unavailable';
import { generateSlots, ghostsOf, conflictIds, type Ghost } from './model';
import type { SchedulePort } from './port';
import { createScheduleStore, type ScheduleState, type ScheduleStore } from './scheduleStore';
import { dayOfTs, weekStartDay } from './time';
import type { RescheduleRequest, ScheduleSlot } from './types';

let configured: SchedulePort | null = null;
/** The app's schedule port (the sealed adapter once installed, see port.ts). Tests and stories pass their own. */
export function configureSchedule(p: SchedulePort | null): void {
  configured = p;
}
export const getSchedulePort = (): SchedulePort =>
  (configured ??= coachAdapter('schedule', createUnavailableSchedulePort));

/**
 * The chat card of a request goes through the chat port of the device that made it, as a sealed `request` body: the
 * trainer's request through the trainer port, the client's (new request or counter) through the client port (the sealed
 * Firestore adapters). The card id is derived from the request id, so a
 * second post of the same request is the same message.
 */
export function postRequestCard(r: RescheduleRequest): void {
  try {
    const chat = r.from === 'client' ? getClientChatPort() : getChatPort();
    void chat
      .send(`cid-${r.clientId}`, {
        id: `msg-${r.id}`,
        text: '',
        at: chat.now(),
        body: { kind: 'request', reqId: r.id },
      })
      .catch(() => undefined);
  } catch {
    /* no chat for this client: the request still exists */
  }
}

const stores = new WeakMap<SchedulePort, ScheduleStore>();
export function scheduleStoreFor(port: SchedulePort): ScheduleStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createScheduleStore(port, { onRequest: postRequestCard })));
  return s;
}
export const useScheduleStore = (port?: SchedulePort): ScheduleStore =>
  scheduleStoreFor(port ?? getSchedulePort());

/** Weeks generated before / after the current one (the calendar pages inside this window). */
export const WINDOW_WEEKS = { before: 14, after: 30 };

export interface ScheduleApi {
  store: ScheduleStore;
  state: ScheduleState;
  loading: boolean;
  /** every session in the window, moved-away ghosts ("Moved to Tue") included */
  slots: ScheduleSlot[];
  /** pending requests as proposed-time ghost blocks */
  ghosts: Ghost[];
  /** ids of sessions that overlap another (one trainer cannot be in two places) */
  conflicts: Set<string>;
  now: number;
  /** Monday of the current week (day key) */
  thisWeek: number;
  requests: readonly RescheduleRequest[];
}

/**
 * `focus` = a day the calendar is browsing (the schedule screen passes the shown day): the window of generated sessions
 * is centred on that week instead of today, so paging far into the past or the future never shows a blank grid.
 * Everything is derived on the device from the live docs, so paging is instant: no per-week fetch, no stale flash.
 */
export function useSchedule(port?: SchedulePort, focus?: number): ScheduleApi {
  const store = useScheduleStore(port);
  useEffect(() => {
    store.start();
    const on = () => store.setOnline(true);
    const off = () => store.setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useMinuteClock(() => store.now()); // re-renders on each minute of the app clock, so "now" moves
  const now = store.now();
  const thisWeek = weekStartDay(dayOfTs(now));
  const day = dayOfTs(now);
  const minute = Math.floor(now / 60_000);
  const derived = useMemo(() => {
    const centre = weekStartDay(focus ?? day);
    const slots = generateSlots(state.docs, state.requests, {
      fromDay: centre - WINDOW_WEEKS.before * 7,
      toDay: centre + WINDOW_WEEKS.after * 7,
      now,
    });
    return {
      slots,
      ghosts: ghostsOf(slots, state.requests, now),
      conflicts: conflictIds(slots),
    };
    // `now` moves every render in test doubles; the minute is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.docs, state.requests, day, minute, focus]);
  return {
    store,
    state,
    loading: state.status === 'loading',
    now,
    thisWeek,
    requests: state.requests,
    ...derived,
  };
}

/** Just the store state (chat cards): starts the store, no slot generation. */
export function useScheduleState(port?: SchedulePort): {
  store: ScheduleStore;
  state: ScheduleState;
  now: number;
} {
  const store = useScheduleStore(port);
  useEffect(() => {
    store.start();
  }, [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { store, state, now: store.now() };
}
