/**
 * What a trainer knows of a client's availability (SPO-552 I10). Pure. The client's device publishes hours per weekday
 * (minutes since midnight, Monday = 0) and the day spans when they are "not available"; there is never a reason in it.
 * Whatever arrives from the network is treated as untrusted: `parseAvailability` keeps only well-formed values.
 */
export type MinuteRange = readonly [number, number];

export interface ClientAvailability {
  /** Monday = 0 … Sunday = 6 → sorted, non-overlapping ranges */
  weekly: Readonly<Record<number, readonly MinuteRange[]>>;
  /** Day keys (`Math.floor(ms / 86_400_000)`), inclusive; `toDay` null = open-ended */
  unavailable: readonly { fromDay: number; toDay: number | null }[];
}

export const MINUTES_DAY = 1440;
export const DAY_MS = 86_400_000;

const isMinute = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MINUTES_DAY;
const isDayKey = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0;

function cleanRanges(raw: unknown): MinuteRange[] {
  if (!Array.isArray(raw)) return [];
  const rs: [number, number][] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length !== 2) continue;
    const [a, b] = r as unknown[];
    if (isMinute(a) && isMinute(b) && b > a) rs.push([a, b]);
  }
  rs.sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const r of rs) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** The published view -> a clean value, or null when it carries no availability (not shared, or unreadable). */
export function parseAvailability(raw: unknown): ClientAvailability | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { weekly?: unknown; unavailable?: unknown };
  if (!r.weekly || typeof r.weekly !== 'object') return null;
  const weekly: Record<number, readonly MinuteRange[]> = {};
  for (let d = 0; d < 7; d++) {
    const ranges = cleanRanges((r.weekly as Record<string, unknown>)[String(d)]);
    if (ranges.length) weekly[d] = ranges;
  }
  const unavailable: { fromDay: number; toDay: number | null }[] = [];
  if (Array.isArray(r.unavailable))
    for (const u of r.unavailable) {
      if (!u || typeof u !== 'object') continue;
      const { fromDay, toDay } = u as { fromDay?: unknown; toDay?: unknown };
      if (!isDayKey(fromDay)) continue;
      if (toDay === null || toDay === undefined) unavailable.push({ fromDay, toDay: null });
      else if (isDayKey(toDay) && toDay >= fromDay) unavailable.push({ fromDay, toDay });
    }
  return { weekly, unavailable };
}

/** Day key of a moment in the given calendar day (the trainer's device passes local midnight of that day as UTC-free key). */
export const dayKeyOf = (ms: number): number => Math.floor(ms / DAY_MS);
/** Monday = 0 … Sunday = 6 for a day key (day 0 of the epoch was a Thursday). */
export const weekdayOfKey = (key: number): number => (((key + 3) % 7) + 7) % 7;

/** Is the person "not available" on this day (Unwell, Full rest, injury: never says which)? */
export const isUnavailableOn = (a: ClientAvailability, key: number): boolean =>
  a.unavailable.some((u) => key >= u.fromDay && (u.toDay === null || key <= u.toDay));

/** Free ranges on a day key: nothing on a "not available" day. */
export const freeOn = (a: ClientAvailability, key: number): readonly MinuteRange[] =>
  isUnavailableOn(a, key) ? [] : (a.weekly[weekdayOfKey(key)] ?? []);

/** Does [from, to) in minutes on this day sit fully inside one free range? */
export const fitsFree = (a: ClientAvailability, key: number, from: number, to: number): boolean =>
  to > from && freeOn(a, key).some(([s, e]) => from >= s && to <= e);

export type DayState = 'free' | 'none' | 'unavailable';
/** One word per day for a week strip: free hours set, none set, or not available. */
export const dayState = (a: ClientAvailability, key: number): DayState =>
  isUnavailableOn(a, key)
    ? 'unavailable'
    : (a.weekly[weekdayOfKey(key)]?.length ?? 0)
      ? 'free'
      : 'none';
