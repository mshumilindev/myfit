import type { LocaleId } from '../../i18n';
import type { ChatStrings } from '../../i18n/coachChat';
import { coachClock, coachDate, coachTimeZone, coachWeekday } from '../format';

/** YYYY-MM-DD in the coach's zone: two instants are the same day iff their keys are equal. */
export const dayKey = (ts: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: coachTimeZone() }).format(ts);

const DAY = 86_400_000;

/** "Today" / "Yesterday" / "Tue 6 Oct" for the day divider. */
export function dayLabel(ts: number, now: number, ch: ChatStrings, locale: LocaleId): string {
  const k = dayKey(ts);
  if (k === dayKey(now)) return ch.chToday;
  if (k === dayKey(now - DAY)) return ch.chYesterday;
  return coachDate(ts, locale);
}

/** Right column of a list row: the clock today, "Yesterday", else the weekday. */
export function listTime(ts: number, now: number, ch: ChatStrings, locale: LocaleId): string {
  const k = dayKey(ts);
  if (k === dayKey(now)) return coachClock(ts);
  if (k === dayKey(now - DAY)) return ch.chYesterday;
  return coachWeekday(ts, locale);
}

export { coachClock as clock };

/** Hash `?with=<clientId>` of `#/c/chat`. */
export function readWith(hash: string): string | null {
  const q = hash.split('?')[1];
  return q ? new URLSearchParams(q).get('with') : null;
}
export const chatHash = (clientId?: string | null): string =>
  clientId ? `#/c/chat?with=${encodeURIComponent(clientId)}` : '#/c/chat';
