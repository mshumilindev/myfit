/**
 * History on Today (design K2 mobile / K3 desktop): the header with the
 * Timeline · Calendar toggle, and the Calendar view — a month of day tiles
 * (logged sessions, activities, nights, weigh-ins, PRs, health tints, planned
 * program days), the selected day as a History timeline day, the last 30 days
 * in numbers and, on the phone, the History settings.
 *
 * The toggle switches the view for the moment; the default lives in the Today
 * layout (Customize → History, or the settings card here).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, IconButton } from '../components/ui/Button';
import {
  MonthGrid,
  type MonthGridChip,
  type MonthGridDay,
  type MonthMarker,
} from '../components/ui/MonthGrid';
import { Segmented } from '../components/ui/Segmented';
import type { Tone } from '../components/ui/tones';
import { fmtCalendarMonth } from '../components/ui/Calendar';
import {
  addMonths,
  dayOfTimestamp,
  monthEnd,
  monthStart,
  timestampOfDay,
  ymdOf,
} from '../components/ui/calendarDays';
import { HistoryDay } from '../components/HistoryTimeline';
import {
  prescribedTrainingDays,
  programDayNameFor,
  programDayNameForWeekday,
  workoutDayReadout,
  type useStore,
} from '../store';
import { dayReadoutLabel } from '../data/daySuggest';
import { useProgramMine } from '../data/programMine';
import { activityCategory, activityTone, durationMin } from '../activities';
import { fmtBodyWeightKg, fmtDayMonth, fmtDurationHM, useT } from '../i18n';
import { Icon } from '../ui';
import { isoWeekday, useWeekStartDay, weekPos } from '../weekStart';
import type { MuscleGroup } from '../data/exercises';
import type { Workout } from '../types';
import type { Shell } from '../App';
import { countRange, dayMap, type DayInfo, type HealthKind } from './calendarData';
import { cs } from './widgets/calendar.strings';
import { CoreConfigSheet } from './CoreConfigSheet';
import { setTodayLayout, useTodayLayout, type HistoryOpts } from './layout';

type Store = ReturnType<typeof useStore>;
type View = HistoryOpts['view'];
type Filter = 'all' | 'workouts' | 'activities' | 'sleep' | 'weight' | 'prs';

const WIDE_QUERY = '(min-width: 900px)';

/** Desktop layout of the calendar (larger tiles with names) from 900px. */
function useWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia(WIDE_QUERY);
    const on = () => setWide(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return wide;
}

/** The calendar's own width. Its layout follows the column it sits in (rail,
 *  Start panel and window size all change that), not the window. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
/** Big tiles with names need ~100px per day; the side-by-side footer needs two
 *  columns wide enough for a History day card and the 5-stat strip. */
const WIDE_MIN = 700;
const SPLIT_MIN = 880;

const HEALTH_TONE: Record<HealthKind, Tone> = {
  rest: 'rest',
  sick: 'illness',
  off: 'neutral',
  injury: 'injury',
};

const ACTIVITY_TONE: Record<ReturnType<typeof activityTone>, Tone> = {
  sport: 'sport',
  conditioning: 'conditioning',
  recovery: 'rest',
};

function isoDate(day: number): string {
  const { y, m, d } = ymdOf(day);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface HistorySectionProps {
  opts: HistoryOpts;
  /** The Timeline view (the existing History timeline + "See all"). */
  timeline: ReactNode;
  store: Store;
  shell: Shell;
  bodyKg: number | null;
  openMuscleHistory?: (m: MuscleGroup) => void;
  /** Open the past-session flow for a date (YYYY-MM-DD). */
  onLogFor: (date: string) => void;
}

/** The History core block: header + Timeline or Calendar. */
export function HistorySection(props: HistorySectionProps) {
  const { opts } = props;
  const { t } = useT();
  const wide = useWide();
  const layout = useTodayLayout();
  const [view, setView] = useState<View>(opts.view);
  const [seen, setSeen] = useState<View>(opts.view);
  if (seen !== opts.view) {
    // The default changed (settings) — follow it.
    setSeen(opts.view);
    setView(opts.view);
  }
  const [cfgOpen, setCfgOpen] = useState(false);
  return (
    <div className="td-history">
      <div className="td-hist-head section-divide">
        <span className="section-label">{t.tdHistory}</span>
        <span className="td-hist-tools">
          <Segmented
            size="sm"
            className="td-hist-seg"
            label={t.histCalView}
            value={view}
            onChange={setView}
            options={[
              { value: 'timeline' as const, label: t.todayHistView.timeline },
              {
                value: 'calendar' as const,
                label: t.todayHistView.calendar,
                icon: 'calendar-blank',
              },
            ]}
          />
          {wide && (
            <IconButton
              size="sm"
              variant="secondary"
              icon="sliders-horizontal"
              label={t.histCalSettings}
              onClick={() => setCfgOpen(true)}
            />
          )}
        </span>
      </div>
      {view === 'calendar' ? <HistoryCalendar {...props} /> : props.timeline}
      {cfgOpen && (
        <CoreConfigSheet
          id="history"
          draft={layout}
          onChange={setTodayLayout}
          preview={null}
          hasClients={false}
          onClose={() => setCfgOpen(false)}
        />
      )}
    </div>
  );
}

function workoutName(w: Workout, all: Workout[], t: ReturnType<typeof useT>['t']): string {
  const readout = workoutDayReadout(w);
  return (
    programDayNameFor(w, all) ??
    (w.kind === 'home' ? w.dayName || t.homeSetTitle : null) ??
    (readout ? dayReadoutLabel(readout, t) : null) ??
    t.startSessionLabel
  );
}

function HistoryCalendar({
  opts,
  store,
  shell,
  bodyKg,
  openMuscleHistory,
  onLogFor,
}: HistorySectionProps) {
  const [boxRef, boxW] = useWidth<HTMLDivElement>();
  const wide = boxW >= WIDE_MIN;
  const split = boxW >= SPLIT_MIN;
  const { t, locale } = useT();
  const s = cs(locale);
  const [now] = useState(() => Date.now());
  const today = dayOfTimestamp(now);
  const weekStart = useWeekStartDay();
  const [month, setMonth] = useState(() => monthStart(today));
  const [sel, setSel] = useState(today);
  // Today's block shows everything; filtering lives in the full History calendar.
  const filter = 'all' as Filter;
  const { assignment, active } = useProgramMine();
  const programName = assignment && active ? assignment.program.name : null;
  const map = dayMap(store, now);
  const presc = prescribedTrainingDays();
  const weekdayOf = (d: number) => isoWeekday(timestampOfDay(d));

  const show = (f: Exclude<Filter, 'all'>) => filter === 'all' || filter === f;
  const plannedTrain = (d: number, info: DayInfo | undefined) =>
    opts.planned && d >= today && presc.has(weekdayOf(d)) && !info?.workouts.length;
  const plannedRest = (d: number) =>
    opts.planned && d > today && presc.size > 0 && !presc.has(weekdayOf(d));
  const plannedName = (d: number) => programDayNameForWeekday(weekdayOf(d)) ?? s.planned;
  const healthLabel = (k: HealthKind) =>
    k === 'rest' ? s.rest : k === 'sick' ? s.sick : k === 'off' ? s.off : s.injury;

  const cell = (d: number): MonthGridDay | undefined => {
    const info = map.get(d);
    const pTrain = plannedTrain(d, info);
    const pRest = plannedRest(d);
    if (!info && !pTrain && !pRest) return undefined;
    const markers: MonthMarker[] = [];
    const chips: MonthGridChip[] = [];
    const notes: { label: string; tone?: Tone }[] = [];
    if (show('workouts')) {
      if (info?.workouts.length) {
        markers.push('workout');
        for (const w of info.workouts)
          chips.push({ label: workoutName(w, store.workouts, t), tone: 'accent' });
      } else if (pTrain) {
        markers.push('planned');
        chips.push({ label: plannedName(d), tone: 'accent', planned: true });
      }
    }
    if (show('activities') && info?.activities.length) {
      markers.push('activity');
      for (const a of info.activities)
        chips.push({
          label: `${t.actType[a.type] ?? a.type} ${Math.round(durationMin(a))} ${t.minShort}`,
          tone: ACTIVITY_TONE[activityTone(a.type, activityCategory(a))],
        });
    }
    if (show('sleep') && info?.sleep) markers.push('sleep');
    if (show('prs') && info?.pr) markers.push('pr');
    if (show('weight') && info?.weight != null) markers.push('weight');
    if (info?.health)
      notes.push({ label: healthLabel(info.health), tone: HEALTH_TONE[info.health] });
    else if (pRest && filter === 'all') notes.push({ label: s.rest, tone: 'rest' });
    if (show('weight') && info?.weight != null) notes.push({ label: fmtBodyWeightKg(info.weight) });
    const meta =
      show('sleep') && info?.sleep && info.sleepMin > 0 ? (
        <>
          <Icon name="moon-stars" />
          {fmtDurationHM(info.sleepMin * 60000)}
        </>
      ) : undefined;
    return {
      tint: info?.health ? HEALTH_TONE[info.health] : undefined,
      plan: pTrain ? 'train' : pRest ? 'rest' : undefined,
      markers,
      chips,
      notes,
      meta,
      pr: show('prs') && !!info?.pr,
      label: [...chips.map((c) => c.label), ...notes.map((n) => n.label)].join(', ') || undefined,
    };
  };

  const pick = (d: number) => {
    setSel(d);
    if (monthStart(d) !== month) setMonth(monthStart(d));
  };

  // Month summary: "1 logged · 26 planned · MS - 6 days".
  const mStart = month;
  const mEnd = monthEnd(month);
  const logged = mStart <= today ? countRange(map, mStart, Math.min(mEnd, today)).logged : 0;
  let planned = 0;
  if (opts.planned)
    for (let d = Math.max(mStart, today); d <= mEnd; d++)
      if (plannedTrain(d, map.get(d))) planned++;
  const summary = [
    s.loggedN(logged),
    opts.planned && presc.size > 0 ? t.histCalPlanned(planned) : null,
    programName,
  ]
    .filter(Boolean)
    .join(' · ');

  // "day 3 of 6" — the selected weekday's place in the program week.
  const order = [...presc].sort((a, b) => weekPos(a, weekStart) - weekPos(b, weekStart));
  const selIdx = order.indexOf(weekdayOf(sel));
  const dayOf = selIdx >= 0 ? t.histCalDayOf(selIdx + 1, order.length) : undefined;

  const selTs = timestampOfDay(sel);
  const selInfo = map.get(sel);
  const selectedDay = (
    <div className="td-hcal-day">
      <HistoryDay
        day={selTs}
        workouts={store.workouts}
        activities={store.activities}
        sleeps={store.sleeps}
        allWorkouts={store.workouts}
        bodyKg={bodyKg}
        aside={
          wide ? (
            <>
              {t.histCalSelectedDay}
              {dayOf ? ` · ${dayOf}` : ''}
            </>
          ) : (
            dayOf
          )
        }
        onOpenWorkout={(id) => shell.openOverlay({ screen: 'past-workout', workoutId: id })}
        onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
        onOpenSleep={(id) => shell.openOverlay({ screen: 'sleep', mode: 'edit', nightId: id })}
        openMuscleHistory={openMuscleHistory}
      >
        <div className="td-hcal-none">
          {plannedTrain(sel, selInfo) ? t.histCalPlannedDay(plannedName(sel)) : t.histCalNothing}
        </div>
      </HistoryDay>
      {sel <= today && (
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          className="td-hcal-log"
          onClick={() => onLogFor(isoDate(sel))}
        >
          {t.histCalLogFor(fmtDayMonth(selTs, locale))}
        </Button>
      )}
    </div>
  );

  return (
    <div ref={boxRef} className={`td-hcal${wide ? ' is-wide' : ''}${split ? ' is-split' : ''}`}>
      <div className="td-hcal-top">
        <div className="td-hcal-title">
          <div className="td-hcal-titletext">
            <div className="td-hcal-month">{fmtCalendarMonth(month, locale)}</div>
            <div className="td-hcal-sum">{summary}</div>
          </div>
          <span className="td-hcal-nav">
            <IconButton
              size="sm"
              variant="secondary"
              icon="caret-left"
              label={t.hlPrevMonth}
              onClick={() => setMonth((m) => addMonths(m, -1))}
            />
            <IconButton
              size="sm"
              variant="secondary"
              icon="caret-right"
              label={t.hlNextMonth}
              onClick={() => setMonth((m) => addMonths(m, 1))}
            />
            {wide && (
              <Button variant="secondary" size="sm" onClick={() => pick(today)}>
                {t.today}
              </Button>
            )}
          </span>
        </div>
      </div>
      <MonthGrid
        month={month}
        today={today}
        weekStart={weekStart}
        day={cell}
        selected={sel}
        onSelect={pick}
        size={wide ? 'lg' : 'sm'}
        todayLabel={t.today}
        label={fmtCalendarMonth(month, locale)}
      />
      <div className="td-hcal-foot">
        {selectedDay}
        <Button
          variant="secondary"
          fullWidth
          iconTrailing="arrow-up-right"
          onClick={() => shell.openOverlay({ screen: 'history' })}
        >
          {t.histCalOpenFull}
        </Button>
      </div>
    </div>
  );
}
