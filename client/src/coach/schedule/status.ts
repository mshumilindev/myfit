/**
 * One source of truth for how a session is shown: the card state of the calendar, the legend swatch and the agenda
 * rows all read `cardStateOf` and `MARK_ICON`. Pure (no React). "In progress" is derived from the clock, never stored:
 * a planned session whose window contains `now`.
 *
 *   planned     neutral tourmaline tint
 *   inprogress  solid accent, "Now", a thin progress bar
 *   done        muted green + check
 *   missed      muted red + x
 *   proposed    dashed ghost + hourglass (a request's proposed time, the struck "Moved to ..." mark)
 *   overlap     a small warning marker only (it is a flag on a card, not a state of its own)
 */
import { endOf } from './model';
import type { ScheduleSlot } from './types';

export type CardState = 'planned' | 'inprogress' | 'done' | 'missed' | 'proposed';
export type MarkKey = CardState | 'overlap';

export const MARK_KEYS: readonly MarkKey[] = [
  'planned',
  'inprogress',
  'done',
  'missed',
  'proposed',
  'overlap',
];

/** The icon of each state; the same glyph sits on the card and in the legend chip (`planned` has none: its swatch is the bar). */
export const MARK_ICON: Record<MarkKey, string | null> = {
  planned: null,
  inprogress: 'play-circle',
  done: 'check-circle',
  missed: 'x-circle',
  proposed: 'hourglass-medium',
  overlap: 'warning',
};

const open = (s: ScheduleSlot): boolean => s.status === 'planned' || s.status === 'pending-move';

/** A session that has started and not ended at `now` (the end itself is already past). */
export const isLive = (s: ScheduleSlot, now: number): boolean =>
  open(s) && s.start <= now && now < endOf(s);

/** The state of a session or of a proposed-move ghost at `now`. */
export function cardStateOf(s: ScheduleSlot, now: number, ghost = false): CardState {
  if (ghost || s.status === 'moved') return 'proposed';
  if (s.status === 'done') return 'done';
  if (s.status === 'missed') return 'missed';
  if (isLive(s, now)) return 'inprogress';
  // an open session whose window is over without a mark reads as done, like the model derives it
  if (open(s) && endOf(s) <= now) return 'done';
  return 'planned';
}

/** 0..1 of a live session that has elapsed (clamped). */
export function liveProgress(s: ScheduleSlot, now: number): number {
  const total = endOf(s) - s.start;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - s.start) / total));
}

/** Whole minutes left of a live session (at least 1 while it runs). */
export const minutesLeft = (s: ScheduleSlot, now: number): number =>
  Math.max(1, Math.ceil((endOf(s) - now) / 60_000));

/** Whole minutes since a live session started. */
export const minutesIn = (s: ScheduleSlot, now: number): number =>
  Math.max(0, Math.floor((now - s.start) / 60_000));

/**
 * Where the "Now" divider of a day list goes: before the first session that has NOT started yet (by start time), so a
 * session that is running sits above the divider, and a session that already ended does too. `list` is one day's
 * sessions sorted by start. Returns `list.length` when every session has started (the divider closes the list) and 0
 * when none has. Overlapping sessions never move the divider: only the start of each one counts.
 */
export function nowDividerIndex(list: readonly Pick<ScheduleSlot, 'start'>[], now: number): number {
  const i = list.findIndex((s) => s.start > now);
  return i < 0 ? list.length : i;
}
