/**
 * Current-week strip (Monday-first): one marker per day showing that day's
 * state — a session logged (brass/ok), a sick day (pulse), or a rest/time-off
 * day (moon). Today is ringed. Reusable across screens where a weekly rhythm
 * helps (Today, Progress). Reads finished workouts + rest periods from the store.
 */
import { Icon } from '../ui';
import { dayKey, useStore } from '../store';
import { useT } from '../i18n';

export function WeekStrip() {
  const { t } = useT();
  const store = useStore();
  const finished = store.workouts.filter((w) => w.finishedAt !== null);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayKey = dayKey(dayStart.getTime());
  const monday = new Date(dayStart);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  // A rest period covers a day when its inclusive [startDay, endDay] range does
  // (an open-ended illness period runs up to today).
  const restFor = (dk: number) =>
    store.restPeriods.find((r) => dk >= r.startDay && dk <= (r.open ? todayKey : r.endDay)) ?? null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    const dk = dayKey(start);
    const logged = finished.some((w) => w.startedAt >= start && w.startedAt < end);
    const rest = logged ? null : restFor(dk);
    const state: 'trained' | 'illness' | 'rest' | 'none' = logged
      ? 'trained'
      : rest
        ? rest.mode === 'illness'
          ? 'illness'
          : 'rest'
        : 'none';
    return { letter: t.weekDayLetters[i], state, isToday: start === dayStart.getTime() };
  });

  return (
    <div className="weekstrip">
      {days.map((d, i) => (
        <div key={i} className={`cell${d.isToday ? ' today-ring' : ''}`}>
          <div className="day">{d.letter}</div>
          {d.state === 'illness' ? (
            <span className="wk-ic ill" title={t.dayIll}>
              <Icon name="pulse" />
            </span>
          ) : d.state === 'rest' ? (
            <span className="wk-ic rest" title={t.dayRest}>
              <Icon name="moon" />
            </span>
          ) : (
            <div className={`dot${d.isToday ? ' today' : d.state === 'trained' ? ' done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}
