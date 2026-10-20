import type { TeamStrings } from '../../i18n/coachTeam';
import type { LocaleId } from '../../i18n';
import { coachDayMonth, coachTimeZone } from '../format';

const MIN = 60_000;
const DAY = 86_400_000;

/** Calendar day of `ts` in the coach time zone as a UTC day number (so DST never shifts "yesterday"). */
function dayNumber(ts: number): number {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: coachTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(ts)
    .split('-')
    .map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

const daysBetween = (now: number, ts: number): number => dayNumber(now) - dayNumber(ts);

/** "Active now" within 5 minutes, else "Last active today / yesterday / 12 Sep". */
export function lastActiveLabel(
  tm: TeamStrings,
  locale: LocaleId,
  now: number,
  ts: number | null,
): string | null {
  if (ts == null) return null;
  if (now - ts < 5 * MIN) return tm.tmActiveNow;
  const d = daysBetween(now, ts);
  if (d <= 0) return tm.tmLastActive(tm.tmWhenToday);
  if (d === 1) return tm.tmLastActive(tm.tmWhenYesterday);
  return tm.tmLastActive(coachDayMonth(ts, locale));
}

/** "today" / "yesterday" / "2 days ago" for an invite. */
export function agoLabel(tm: TeamStrings, now: number, ts: number): string {
  const d = daysBetween(now, ts);
  if (d <= 0) return tm.tmAgoToday;
  if (d === 1) return tm.tmAgoYesterday;
  return tm.tmAgoDays(d);
}
