/**
 * Current-week strip (Monday-first): one marker per day showing that day's
 * state — a session logged (brass/ok), a sick day (pulse), a rest/time-off day
 * (moon), or a missed program day (red). Today is ringed. Past days that have
 * something logged — or a program day you skipped — are tappable and open a
 * drawer with that day's history (or a "you missed it" note). Reads finished
 * workouts, activities, sleeps and rest periods from the store.
 */
import { useState } from 'react';
import { Icon, Sheet } from '../ui';
import {
  dayKey,
  latestWeight,
  prescribedTrainingDays,
  programDayNameForWeekday,
  useStore,
  weekdayOf,
} from '../store';
import { fmtWeekdayDayMonth, useT } from '../i18n';
import { WorkoutRow, ActivityRow, SleepRow } from './HistoryTimeline';

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
  const { t, locale } = useT();
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
    const missed =
      !logged && !rest && isPast && presc.has(weekdayOf(start));
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
    // Only past days are tappable, and only when there's something to show.
    const clickable = isPast && (logged || missed);
    return { letter: t.weekDayLetters[i], state, isToday, start, clickable };
  });

  // --- Drawer for a tapped day -------------------------------------------------
  const dayEnd = openDay != null ? openDay + 24 * 3600 * 1000 : 0;
  const dayWorkouts =
    openDay != null ? finished.filter((w) => w.startedAt >= openDay && w.startedAt < dayEnd) : [];
  const dayActs =
    openDay != null
      ? store.activities.filter(
          (a) => a.finishedAt !== null && a.startedAt >= openDay && a.startedAt < dayEnd,
        )
      : [];
  const daySleeps =
    openDay != null
      ? store.sleeps.filter((n) => n.wake !== null && n.wake >= openDay && n.wake < dayEnd)
      : [];
  const dayMissed = openDay != null && dayWorkouts.length === 0 && dayActs.length === 0
    ? presc.has(weekdayOf(openDay)) && !restFor(dayKey(openDay))
    : false;
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const missedName = openDay != null ? programDayNameForWeekday(weekdayOf(openDay)) : null;

  const closeDrawer = () => setOpenDay(null);
  const openWorkout = (id: string) => {
    closeDrawer();
    onOpenWorkout?.(id);
  };

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
            <button key={i} className={cls} onClick={() => setOpenDay(d.start)} aria-label={d.letter}>
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
        <Sheet onClose={closeDrawer}>
          <div className="day-sheet-head">
            <span className="t">{fmtWeekdayDayMonth(openDay, locale)}</span>
          </div>
          {dayMissed ? (
            <div className="day-sheet-missed">
              <span className="dsm-ic">
                <Icon name="x" />
              </span>
              <div className="dsm-text">
                <div className="dsm-title">{t.dayMissedTitle}</div>
                <div className="dsm-body">
                  {missedName ? t.dayMissedNamed(missedName) : t.dayMissedGeneric}
                </div>
              </div>
            </div>
          ) : (
            <div className="hist-timeline day-sheet-items">
              {[...dayWorkouts]
                .sort((a, b) => a.startedAt - b.startedAt)
                .map((w) => (
                  <WorkoutRow
                    key={w.id}
                    w={w}
                    allWorkouts={store.workouts}
                    bodyKg={bodyKg}
                    onOpen={openWorkout}
                  />
                ))}
              {[...dayActs]
                .sort((a, b) => a.startedAt - b.startedAt)
                .map((a) => (
                  <ActivityRow
                    key={a.id}
                    a={a}
                    bodyKg={bodyKg}
                    onOpen={
                      onOpenActivity
                        ? (id) => {
                            closeDrawer();
                            onOpenActivity(id);
                          }
                        : undefined
                    }
                  />
                ))}
              {[...daySleeps]
                .sort((a, b) => (a.wake ?? 0) - (b.wake ?? 0))
                .map((n) => (
                  <SleepRow
                    key={n.id}
                    n={n}
                    onOpen={
                      onOpenSleep
                        ? (id) => {
                            closeDrawer();
                            onOpenSleep(id);
                          }
                        : undefined
                    }
                  />
                ))}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
