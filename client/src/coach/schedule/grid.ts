/** Pure maths of "click an empty slot": the clicked y becomes a snapped start, a drag becomes a duration. */
import { tsOf } from './time';

/** Snap step of the week grid (minutes). */
export const SNAP = 15;
/** Duration of a new session when nothing else is known. */
export const DEFAULT_DURATION = 60;
export const MAX_DURATION = 240;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Minutes since midnight at `y` pixels below the top of a column that spans `[from, to]` (minutes) over `height`
 * pixels, snapped DOWN to `step` (the 15-minute row under the pointer, like Google Calendar). The result always leaves
 * room for one step inside the visible range.
 */
export function snapMinutes(
  y: number,
  height: number,
  from: number,
  to: number,
  step: number = SNAP,
): number {
  if (!(height > 0) || !(to > from)) return from;
  const raw = from + (clamp(y, 0, height) / height) * (to - from);
  return clamp(Math.floor(raw / step) * step, from, Math.max(from, to - step));
}

/** Start and length of a drag from one snapped row to another (both rows are included, any direction). */
export function dragSpan(
  a: number,
  b: number,
  step: number = SNAP,
  max: number = MAX_DURATION,
): { start: number; dur: number } {
  const start = Math.min(a, b);
  return { start, dur: clamp(Math.abs(b - a) + step, step, max) };
}

export interface CreateDraft {
  /** day key (the trainer's calendar date) */
  day: number;
  /** start, minutes since local midnight (already snapped) */
  start: number;
  /** length in minutes; null = the default (last used) */
  dur: number | null;
}

/** `day.start` or `day.start.dur` in the hash (`?create=20737.810.90`): a refresh keeps the form open, a story can open it. */
export const formatDraft = (d: CreateDraft): string =>
  [d.day, d.start, ...(d.dur != null ? [d.dur] : [])].join('.');
export function parseDraft(s: string | null): CreateDraft | null {
  if (!s) return null;
  const [day, start, dur] = s.split('.').map(Number);
  if (!Number.isInteger(day) || !Number.isInteger(start) || start < 0 || start >= 24 * 60)
    return null;
  return {
    day,
    start,
    dur: Number.isInteger(dur) && dur >= SNAP && dur <= MAX_DURATION ? dur : null,
  };
}

/** The instant of a draft in the coach's time zone (DST-safe: it is the wall clock of that zone that is kept). */
export const draftStartTs = (d: Pick<CreateDraft, 'day' | 'start'>, tz?: string): number =>
  tsOf(d.day, d.start, tz);

/* ---- last used values (a per-viewer convenience, never required) ---- */
const KEY_DUR = 'sc.quick.dur';
const KEY_GYM = 'sc.quick.gym';
const read = (k: string): string | null => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string): void => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* storage blocked: the default is used next time */
  }
};
export function lastDuration(): number {
  const n = Number(read(KEY_DUR));
  return Number.isFinite(n) && n >= SNAP && n <= MAX_DURATION ? n : DEFAULT_DURATION;
}
export const rememberDuration = (n: number): void => write(KEY_DUR, String(n));
export const lastGym = (): string | null => read(KEY_GYM);
export const rememberGym = (id: string): void => write(KEY_GYM, id);
