/**
 * Current-week strip (Monday-first): one marker per day showing that day's
 * state — a session logged (brass/ok), a sick day (pulse), a rest/time-off day
 * (moon), or a missed program day (red). Today is ringed. Past days that have
 * something logged — or a program day you skipped — are tappable and open a
 * day-history drawer (or a "you missed it" note). Reads finished workouts,
 * activities, sleeps and rest periods from the store.
 */
import { useState } from 'react';
import { Icon } from '../ui';
import { dayKey, prescribedTrainingDays, useStore, weekdayOf } from '../store';
import { useT } from '../i18n';
import { DayHistorySheet } from './DayHistorySheet';

type DayState = 'trained' | 'illness' | 'rest' | 'vacation' | 'missed' | 'none';

export function WeekStrip({
  onOpenWorkout,
  onOpenActivity,
  onOpenSleep,
}: {
  onOpenWorkout?: (id: string) => void;
  onOpenActivity?: (id: string) => void;
  onOpenSleep?: (id: string) => void;
} = {}) {
  const { t } = useT();
  const store = useStore();
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayStart = dayStart.getTime();
  const todayKey = dayKey(todayStart);
  const monday = new Date(dayStart);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const presc = prescribedTrainingDays();

  const restFor = (dk: number) =>
    store.restPeriods.find((r) => dk >= r.startDay && dk <= (r.open ? todayKey : r.endDay)) ?? null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    const dk = dayKey(start);
    const isToday = start === todayStart;
    const isPast = start < todayStart;
    const logged = finished.some((w) => w.startedAt >= start && w.startedAt < end);
    const rest = logged ? null : restFor(dk);
    const restSpan = rest ? (rest.open ? todayKey : rest.endDay) - rest.startDay + 1 : 0;
    const missed = !logged && !rest && isPast && presc.has(weekdayOf(start));
    const state: DayState = logged
      ? 'trained'
      : rest
        ? rest.mode === 'illness'
          ? 'illness'
          : restSpan >= 4
            ? 'vacation'
            : 'rest'
        : missed
          ? 'missed'
          : 'none';
    const clickable = isPast && state !== 'none';
    return { letter: t.weekDayLetters[i], state, isToday, start, clickable };
  });

  return (
    <>
      <div className="weekstrip">
        {days.map((d, i) => {
          const inner = (
            <>
              <div className="day">{d.letter}</div>
              {d.state === 'illness' ? (
                <span className="wk-ic ill" title={t.dayIll}>
                  <Icon name="pulse" />
                </span>
              ) : d.state === 'rest' || d.state === 'vacation' ? (
                <span className="wk-ic rest" title={t.dayRest}>
                  <Icon name="moon" />
                </span>
              ) : (
                <div
                  className={`dot${
                    d.isToday
                      ? ' today'
                      : d.state === 'trained'
                        ? ' done'
                        : d.state === 'missed'
                          ? ' missed'
                          : ''
                  }`}
                />
              )}
            </>
          );
          const cls = `cell${d.isToday ? ' today-ring' : ''}${d.clickable ? ' tappable' : ''}`;
          return d.clickable ? (
            <button
              key={i}
              className={cls}
              onClick={() => setOpenDay(d.start)}
              aria-label={d.letter}
            >
              {inner}
            </button>
          ) : (
            <div key={i} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      {openDay != null && (
        <DayHistorySheet
          day={openDay}
          onClose={() => setOpenDay(null)}
          onOpenWorkout={onOpenWorkout}
          onOpenActivity={onOpenActivity}
          onOpenSleep={onOpenSleep}
        />
      )}
    </>
  );
}
