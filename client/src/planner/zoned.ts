/**
 * Planner time maths with no library: a local date + clock time in an IANA zone <-> a UTC instant.
 * Pure (Intl only), so the reminder engine and the tests share it. Days are 'YYYY-MM-DD' strings and are
 * counted as whole UTC days, never as 24 h spans, so daylight-saving shifts cannot move a plan to another day.
 */

export type DayKey = string; // 'YYYY-MM-DD'

const DAY = 86_400_000;

export function parseDay(d: DayKey): { y: number; m: number; d: number } {
  const [y, m, dd] = d.split('-').map(Number);
  return { y: y!, m: m!, d: dd! };
}

/** Whole days since 1970-01-01 of a day key. */
export function dayNumber(d: DayKey): number {
  const { y, m, d: dd } = parseDay(d);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY);
}

export function dayFromNumber(n: number): DayKey {
  const x = new Date(n * DAY);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(d: DayKey, n: number): DayKey {
  return dayFromNumber(dayNumber(d) + n);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(d: DayKey): number {
  return (((dayNumber(d) + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday (index 3)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Offset of the zone from UTC at an instant, in ms (local = utc + offset). */
export function zoneOffset(utcMs: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(new Date(utcMs)))
    if (x.type !== 'literal') p[x.type] = Number(x.value);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The local day and clock time ('HH:mm') of an instant in a zone. */
export function localParts(utcMs: number, tz: string): { day: DayKey; time: string } {
  const local = new Date(utcMs + zoneOffset(utcMs, tz));
  return {
    day: dayFromNumber(Math.floor(local.getTime() / DAY)),
    time: `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
  };
}

/**
 * UTC instant of a local day + 'HH:mm' in a zone. A time that does not exist (spring-forward gap) moves forward by the gap;
 * a time that happens twice (autumn) takes the first.
 */
export function zonedToUtc(day: DayKey, time: string, tz: string): number {
  const { y, m, d } = parseDay(day);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const before = zoneOffset(guess - DAY, tz);
  const after = zoneOffset(guess + DAY, tz);
  const ok = [guess - before, guess - after].filter((u) => {
    const lp = localParts(u, tz);
    return lp.day === day && lp.time === time;
  });
  return ok.length ? Math.min(...ok) : guess - before;
}
