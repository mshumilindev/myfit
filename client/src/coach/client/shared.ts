/**
 * What the lazy client bridge publishes for the eager parts of the real app (nav badge, Today tile count, calendar
 * markers, notification rows). A tiny external store with no heavy imports, so the Gym bundle does not pull the coach
 * code: when the `coach` flag is off nothing ever writes here and every reader sees the empty state.
 */
import { useSyncExternalStore } from 'react';
import type { Notif } from '../../notifications';

export interface ClientShared {
  hasTrainer: boolean;
  trainerFirst: string;
  /** unread messages from my trainer: the ONE number behind badge, tile and the chat divider (R-KIT-23) */
  unread: number;
  /** the spoken form of `unread` in the active locale ("3 unread messages") for badge labels */
  unreadLabel: string;
  /** day keys (calendarDays encoding) with a session with my trainer */
  trainerDays: ReadonlySet<number>;
  /** words for the calendar marker (legend, and the day's spoken label), in the active locale */
  markerLegend: string;
  markerDay: string;
  notifs: readonly Notif[];
}
const EMPTY: ClientShared = Object.freeze({
  hasTrainer: false,
  trainerFirst: '',
  unread: 0,
  unreadLabel: '',
  trainerDays: new Set<number>(),
  markerLegend: '',
  markerDay: '',
  notifs: [],
});

let state: ClientShared = EMPTY;
const subs = new Set<() => void>();

export function publishClientShared(next: Partial<ClientShared> | null): void {
  state = next ? { ...state, ...next } : EMPTY;
  subs.forEach((f) => f());
}
export const getClientShared = (): ClientShared => state;
export function useClientShared(): ClientShared {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => state,
    () => state,
  );
}
