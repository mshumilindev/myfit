import { Notice } from '../../components/ui/Notice';
import type { ScheduleStrings } from '../../i18n/coachSchedule';
import { useCalendarSettings } from './calendarSettings';
import { useGymWeeks } from './gymHours';
import { checkHours, gymSpansByDay, gymSummary } from './hours';
import { dayOfTs, dowOfDay, minOfTs } from './time';
import { gymName } from './types';

export interface DraftSpan {
  /** epoch ms of the start */
  start: number;
  durationMin: number;
  gymId: string;
}

/**
 * A calm warning (never a block) under a session form when the session(s) fall outside the trainer's working hours or
 * outside the opening hours of the gym they are booked at. One draft: the exact reason; a series: how many.
 */
export function HoursNotice({ drafts, t }: { drafts: readonly DraftSpan[]; t: ScheduleStrings }) {
  const { settings } = useCalendarSettings();
  const gyms = useGymWeeks();
  const out = drafts
    .map((d) => {
      const s = minOfTs(d.start);
      const dow = dowOfDay(dayOfTs(d.start));
      const e = Math.min(s + d.durationMin, 24 * 60);
      return { d, dow, ...checkHours(settings, gyms, dow, s, e, d.gymId) };
    })
    .filter((x) => x.outsideWorking || x.outsideGym);
  if (out.length === 0) return null;
  const first = out[0];
  let text: string;
  if (out.length > 1) text = t.hsOutsideN(out.length);
  else if (first.outsideGym) {
    const week = gyms.get(first.d.gymId);
    const spans = week ? gymSpansByDay(week)[first.dow] : [];
    text = spans.length
      ? t.hsOutsideGym(gymName(first.d.gymId), gymSummary(week, first.dow) ?? '')
      : t.hsOutsideGymNo(gymName(first.d.gymId));
  } else text = t.hsOutsideWork;
  return (
    <Notice tone="note" icon="clock" role="status">
      {text}
    </Notice>
  );
}
