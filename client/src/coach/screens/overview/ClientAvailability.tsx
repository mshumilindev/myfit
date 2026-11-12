import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DayBar } from '../../../components/ui/DayBar';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { Notice } from '../../../components/ui/Notice';
import type { RosterStrings } from '../../../i18n/coachRoster';
import type { AvailabilityView } from '../../data/availability';
import {
  DAY_MS,
  rangesLabel,
  upcomingUnavailable,
  type ClientAvailability as Availability,
} from '../../domain/availability';
import { DOWS } from '../../domain/types';

const dayText = (key: number, locale: string, withWeekday = true): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  }).format(new Date(key * DAY_MS));

/** "Thu 12 Nov – Sun 15 Nov", or one day, or "from Thu 12 Nov" for an open span. */
export function busyText(
  r: Pick<RosterStrings, 'c3AvBusy' | 'c3AvBusyFrom'>,
  span: { fromDay: number; toDay: number | null },
  locale: string,
): string {
  if (span.toDay === null) return r.c3AvBusyFrom(dayText(span.fromDay, locale));
  return r.c3AvBusy(
    span.toDay === span.fromDay
      ? dayText(span.fromDay, locale)
      : `${dayText(span.fromDay, locale)} – ${dayText(span.toDay, locale)}`,
  );
}

/** "<Name>'s free hours" (SPO-552 I10): the week as bars, the days they are not available (never why), and two actions. */
export function ClientAvailabilityCard({
  view,
  first,
  r,
  locale,
  today,
  onShow,
  onPropose,
}: {
  view: AvailabilityView;
  first: string;
  r: RosterStrings;
  locale: string;
  /** day key of today on the trainer's device */
  today: number;
  onShow: () => void;
  onPropose: () => void;
}) {
  if (view.state === 'loading' || view.state === 'not-shared') return null;
  const header = (
    <span role="heading" aria-level={2}>
      {r.c3AvTitle(first)}
    </span>
  );
  if (view.state === 'failed')
    return (
      <Card as="section" pad="lg" header={header}>
        <Notice
          tone="danger"
          icon="warning-circle"
          trail={
            <Button variant="link" size="sm" onClick={view.retry}>
              {r.c3AvRetry}
            </Button>
          }
        >
          {r.c3AvFailed}
        </Notice>
      </Card>
    );
  const a: Availability = view.availability;
  const busy = upcomingUnavailable(a, today);
  const any = DOWS.some((_, i) => (a.weekly[i]?.length ?? 0) > 0);
  return (
    <Card as="section" pad="lg" header={header}>
      {any ? (
        <GroupedList>
          {DOWS.map((d, i) => {
            const ranges = a.weekly[i] ?? [];
            const text = ranges.length ? rangesLabel(ranges) : r.c3AvNone;
            return (
              <ListRow
                key={d}
                label={r.c3Dow[d]}
                sub={text}
                value={
                  <DayBar ranges={ranges} label={ranges.length ? r.c3AvFree(text) : r.c3AvNone} />
                }
              />
            );
          })}
        </GroupedList>
      ) : (
        <p className="c3-m">{r.c3AvNoHours()}</p>
      )}
      {busy.map((s) => (
        <Notice key={`${s.fromDay}-${s.toDay}`} tone="rest" icon="clock" nested>
          <strong>{busyText(r, s, locale)}</strong>
          <br />
          {r.c3AvBusyNote()}
        </Notice>
      ))}
      <div className="c3-av-actions">
        <Button variant="secondary" size="sm" icon="calendar-dots" onClick={onShow}>
          {r.c3AvShow}
        </Button>
        <Button variant="ghost" size="sm" icon="plus" onClick={onPropose}>
          {r.c3AvPropose}
        </Button>
      </div>
    </Card>
  );
}
