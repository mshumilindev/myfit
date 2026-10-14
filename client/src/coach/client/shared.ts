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

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean => {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
};
const sameNotifs = (a: readonly Notif[], b: readonly Notif[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((n, i) => {
    const m = b[i] as unknown as Record<string, unknown>;
    const o = n as unknown as Record<string, unknown>;
    const keys = Object.keys(o);
    return keys.length === Object.keys(m).length && keys.every((k) => Object.is(o[k], m[k]));
  });
};
/** Structural equality: a publish that changes nothing must not wake the subscribers (it fed a render loop). */
function sameShared(a: ClientShared, b: ClientShared): boolean {
  return (
    a.hasTrainer === b.hasTrainer &&
    a.trainerFirst === b.trainerFirst &&
    a.unread === b.unread &&
    a.unreadLabel === b.unreadLabel &&
    a.markerLegend === b.markerLegend &&
    a.markerDay === b.markerDay &&
    sameSet(a.trainerDays, b.trainerDays) &&
    sameNotifs(a.notifs, b.notifs)
  );
}

export function publishClientShared(next: Partial<ClientShared> | null): void {
  const merged = next ? { ...state, ...next } : EMPTY;
  if (sameShared(state, merged)) return;
  state = merged;
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
