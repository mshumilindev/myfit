/** "in 2 h", "yesterday", "in 3 days": the relative words of a session or a request, in the active locale. */
import type { LocaleId } from '../../i18n';
import { dayOfTs } from './time';

const loc = (l: LocaleId): string => (l === 'en' ? 'en-GB' : l);
const MIN = 60_000;

export interface RelativeWords {
  /** a session that is running right now */
  inProgress: string;
}

/**
 * When a session is, relative to `now`: minutes or hours the same day, whole calendar days otherwise ("tomorrow",
 * "yesterday", "in 3 days"). `end` set and `start <= now < end` = in progress. Calendar days are compared in the
 * coach's zone (day keys), so "tomorrow" is the next calendar day even 5 minutes after midnight.
 */
export function relativeWhen(
  start: number,
  end: number | null,
  now: number,
  l: LocaleId,
  words: RelativeWords,
): string {
  const rtf = new Intl.RelativeTimeFormat(loc(l), { numeric: 'auto' });
  if (end != null && start <= now && now < end) return words.inProgress;
  const days = dayOfTs(start) - dayOfTs(now);
  if (days !== 0) return rtf.format(days, 'day');
  const diff = Math.round((start - now) / MIN);
  if (Math.abs(diff) < 60) return rtf.format(diff, 'minute');
  return rtf.format(Math.round(diff / 60), 'hour');
}

/** "in 3 days" for an expiry: same rule, no in-progress state. */
export const relativeTo = (ts: number, now: number, l: LocaleId): string =>
  relativeWhen(ts, null, now, l, { inProgress: '' });
