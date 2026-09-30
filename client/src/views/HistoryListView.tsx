/**
 * Full history — finished workouts and activities merged into one day-grouped
 * timeline, newest day first. One CALENDAR WEEK per page, the week starting on
 * the day the user set in Settings; a week stepper (‹ range ›) moves between
 * weeks and its label opens a list to jump to any week. Reached from the
 * "See all history" link under the Today preview.
 */
import { useMemo, useState } from 'react';
import type { Shell } from '../App';
import { dayKey, latestWeight, useStore } from '../store';
import { useT } from '../i18n';
import { useMinuteClock } from '../atlas/notes';
import { HistoryTimeline, buildHistoryDays, useDayBars } from '../components/HistoryTimeline';
import { BackButton } from '../components/ui/BackButton';
import { WeekPickerSheet, type WeekOption } from '../components/ui/WeekPickerSheet';
import type { WeekBar } from '../components/ui/WeekBars';
import { WeekStepper } from '../components/ui/WeekStepper';
import { useWeekStartDay, weekStartOf } from '../weekStart';

const WEEK_MS = 7 * 86_400_000;

/** Local midnight `n` weeks after `ts` (n < 0 = earlier), DST-safe. */
function addWeeks(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n * 7);
  return d.getTime();
}

export function HistoryListView({ shell, onClose }: { shell: Shell; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const weekStart = useWeekStartDay();
  const now = useMinuteClock();
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const [week, setWeek] = useState(0); // 0 = the current week
  const [picking, setPicking] = useState(false);

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const workoutCount = finished.length;
  const dayBar = useDayBars(finished, store.activities, store.sleeps);
  const days = buildHistoryDays(finished, store.activities, store.sleeps);

  const thisWeek = weekStartOf(now, weekStart);
  const oldest = days.length ? weekStartOf(days[days.length - 1].ts, weekStart) : thisWeek;
  const lastWeek = Math.max(0, Math.round((thisWeek - oldest) / WEEK_MS));
  const cur = Math.min(week, lastWeek);

  // Workouts per week index, for the picker captions.
  const perWeek = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of finished) {
      const i = Math.round((thisWeek - weekStartOf(w.startedAt, weekStart)) / WEEK_MS);
      m.set(i, (m.get(i) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished.length, thisWeek, weekStart]);

  const fmt = useMemo(
    () => new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'short' }),
    [t.locale],
  );
  const rangeOf = (i: number) => {
    const from = addWeeks(thisWeek, -i);
    return `${fmt.format(from)} – ${fmt.format(addWeeks(from, 1) - 1)}`;
  };

  // A week is empty only when NOTHING was recorded in it: no workout, activity or
  // sleep, no rest / illness period touching it, no injury started in it.
  const hasRecords = (i: number): boolean => {
    const fromD = dayKey(addWeeks(thisWeek, -i));
    const toD = fromD + 6;
    return (
      days.some((d) => {
        const k = dayKey(d.ts);
        return k >= fromD && k <= toD;
      }) ||
      store.restPeriods.some((r) => r.startDay <= toD && (r.open === true || r.endDay >= fromD)) ||
      store.injuries.some((inj) => inj.startDay >= fromD && inj.startDay <= toD)
    );
  };
  /** How each of the week's seven days was filled — the timeline's own day states. */
  const barsOf = (i: number): WeekBar[] => {
    const fromD = dayKey(addWeeks(thisWeek, -i));
    return Array.from({ length: 7 }, (_, d) => dayBar(fromD + d));
  };
  const captionOf = (i: number) =>
    i === 0
      ? t.weekThis
      : i === 1
        ? t.weekLast
        : (perWeek.get(i) ?? 0) > 0
          ? t.historyCount(perWeek.get(i) ?? 0)
          : hasRecords(i)
            ? t.weekNoWorkouts
            : t.weekEmpty;

  const weeks: WeekOption[] = picking
    ? Array.from({ length: lastWeek + 1 }, (_, i) => ({
        label: rangeOf(i),
        sub: captionOf(i),
        bars: barsOf(i),
      }))
    : [];
  const from = dayKey(addWeeks(thisWeek, -cur));
  const range = { fromDay: from, toDay: from + 6 };
  const empty = !hasRecords(cur);

  return (
    <div className="screen hist-list">
      <div className="hist-head">
        <BackButton onClick={onClose} label={t.backAction} />
        <div className="uf-1 umw-0">
          <h2 className="title-26">{t.tdHistory}</h2>
          <div className="hist-list-sub">{t.historyCount(workoutCount)}</div>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="detail-muted">{t.noHistoryYet}</div>
      ) : (
        <>
          <HistoryTimeline
            workouts={finished}
            activities={store.activities}
            sleeps={store.sleeps}
            allWorkouts={store.workouts}
            bodyKg={bodyKg}
            range={range}
            onOpenWorkout={(id) => shell.openOverlay({ screen: 'past-workout', workoutId: id })}
            onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
            onOpenSleep={(id) => shell.openOverlay({ screen: 'sleep', mode: 'edit', nightId: id })}
          />
          {empty && <div className="detail-muted">{t.weekEmpty}</div>}
          <WeekStepper
            label={rangeOf(cur)}
            sub={captionOf(cur)}
            canPrev={cur > 0}
            canNext={cur < lastWeek}
            onPrev={() => setWeek(cur - 1)}
            onNext={() => setWeek(cur + 1)}
            onOpen={() => setPicking(true)}
            prevLabel={t.weekNext}
            nextLabel={t.weekPrev}
            openLabel={t.weekOpen}
          />
        </>
      )}

      {picking && (
        <WeekPickerSheet
          title={t.weekPickTitle}
          hint={t.weekPickSub}
          weeks={weeks}
          selected={cur}
          onPick={(i) => {
            setWeek(i);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
