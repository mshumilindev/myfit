/**
 * History — a grouped-by-day timeline. Each day is a circle node on a rail,
 * coloured and glyphed by the day's state: trained (green), rest (topaz),
 * vacation (amber), sick (teal), missed (red). Days you logged a session show
 * the session cards; days the program prescribed but you rested, were ill, were
 * away or skipped are surfaced too, so the timeline reads the whole week — not
 * only what got logged. Used by the Today preview and the full history.
 */
import {
  dayKey as dayBucket,
  prescribedTrainingDays,
  programDayNameFor,
  programLookbackDays,
  weekdayOf,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
} from '../store';
import { Card } from './ui/Card';
import { DayTimelineDay as KitDay } from './ui/DayTimeline';
import { ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import { Tag } from './ui/Tag';
import type { Tone } from './ui/tones';
import {
  fmtClock,
  fmtDayMonth,
  fmtDurationHM,
  fmtKg,
  fmtWeekday,
  fmtWeekdayShort,
  useT,
} from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import {
  activityType,
  activityCategory,
  activityTone,
  durationMin as activityDurationMin,
} from '../activities';
import type { MuscleGroup } from '../data/exercises';
import { nightDurationMin, sleepKindOf } from '../sleep';
import { useStore } from '../store';
import { useState, type ReactNode } from 'react';
import { dayToTs, type HealthFormSpec } from '../health';
import type { WeekBar } from './ui/WeekBars';
import { PeriodEditSheet } from './PeriodEditSheet';
import { fmtRange, illnessKindName, injuryLabel, periodLabel } from '../views/health/parts';
import type { LocaleId } from '../i18n';
import type { Strings } from '../i18n/en';
import type { Activity, RestPeriod, SleepNight, Workout } from '../types';

type Item =
  | { kind: 'w'; ts: number; w: Workout }
  | { kind: 'a'; ts: number; a: Activity }
  | { kind: 's'; ts: number; n: SleepNight };

/** Per-day state, in priority order when several could apply. */
type DayState = 'trained' | 'illness' | 'injury' | 'vacation' | 'rest' | 'missed' | 'logged';

// Milestone glyphs, shared with Today's week pills: full rest is a plane, a
// rest / recovery day the lotus, never a "sleep" moon.
/** Day state → colour family (tones.ts). */
const STATE_TONE: Record<DayState, Tone> = {
  trained: 'ok',
  rest: 'rest',
  vacation: 'rest',
  illness: 'illness',
  injury: 'injury',
  missed: 'danger',
  logged: 'neutral',
};

const STATE_GLYPH: Record<Exclude<DayState, 'logged'>, string> = {
  trained: 'check',
  illness: 'pulse',
  injury: 'bandaids',
  vacation: 'airplane-tilt',
  rest: 'flower-lotus',
  missed: 'x',
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Merge + group finished workouts and activities into day buckets, newest day
 *  first, and each day's items in chronological order (earliest on top). */
export function buildHistoryDays(
  workouts: Workout[],
  activities: Activity[],
  sleeps: SleepNight[] = [],
): { key: string; ts: number; items: Item[] }[] {
  const items: Item[] = [
    ...workouts
      .filter((w) => w.finishedAt !== null)
      .map((w) => ({ kind: 'w' as const, ts: w.startedAt, w })),
    ...activities
      .filter((a) => a.finishedAt !== null)
      .map((a) => ({ kind: 'a' as const, ts: a.startedAt, a })),
    // A finished night is grouped on the morning it ended (its wake time).
    ...sleeps
      .filter((n) => n.wake !== null)
      .map((n) => ({ kind: 's' as const, ts: n.wake as number, n })),
  ];
  const map = new Map<string, { key: string; ts: number; items: Item[] }>();
  for (const it of items) {
    const key = dayKey(it.ts);
    let g = map.get(key);
    if (!g) {
      g = { key, ts: it.ts, items: [] };
      map.set(key, g);
    }
    g.items.push(it);
    if (it.ts > g.ts) g.ts = it.ts;
  }
  const days = [...map.values()].sort((a, b) => b.ts - a.ts);
  for (const d of days) d.items.sort((x, y) => x.ts - y.ts);
  return days;
}

interface TlDay {
  bucket: number;
  ts: number;
  items: Item[];
  state: DayState;
}

export function HistoryTimeline({
  workouts,
  activities,
  sleeps = [],
  allWorkouts,
  bodyKg,
  maxDays,
  dayOffset = 0,
  range,
  onOpenWorkout,
  onOpenActivity,
  onOpenSleep,
  openMuscleHistory,
  showMuscles = true,
  restPeriodsOverride,
  prescribedDaysOverride,
  lookbackOverride,
}: {
  /** Finished workouts to show. */
  workouts: Workout[];
  /** Finished activities to show. */
  activities: Activity[];
  /** Finished sleep nights to show. */
  sleeps?: SleepNight[];
  /** All workouts — used to resolve program day names. */
  allWorkouts: Workout[];
  bodyKg: number | null;
  /** Cap the number of days rendered; omit to show all. */
  maxDays?: number;
  /** Skip this many of the most-recent days first (for paging). */
  dayOffset?: number;
  /** Show only these days (day keys, inclusive) — one week per page. */
  range?: { fromDay: number; toDay: number };
  onOpenWorkout: (id: string) => void;
  /** Open a logged activity's detail/edit view. Omit to keep rows non-interactive. */
  onOpenActivity?: (id: string) => void;
  /** Open a logged night's edit view. Omit to keep rows non-interactive. */
  onOpenSleep?: (id: string) => void;
  openMuscleHistory?: (m: MuscleGroup) => void;
  showMuscles?: boolean;
  /** Client mode: use this person's rest periods / program instead of the
   *  signed-in user's store (which HistoryTimeline reads by default). */
  restPeriodsOverride?: RestPeriod[];
  prescribedDaysOverride?: Set<number>;
  lookbackOverride?: number;
}) {
  const loggedDays = buildHistoryDays(workouts, activities, sleeps);
  const byBucket = new Map<number, Item[]>();
  for (const g of loggedDays) byBucket.set(dayBucket(g.ts), g.items);

  // Enrich: walk calendar days from today back, tagging each with its state and
  // surfacing rest / illness / vacation / missed days that have no logged items.
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const todayK = dayBucket(todayMid.getTime());
  const oldestLogged = loggedDays.length ? dayBucket(loggedDays[loggedDays.length - 1].ts) : todayK;
  const sctx = useStateCtx({ restPeriodsOverride, prescribedDaysOverride, lookbackOverride });
  const lookback = sctx.lookback;

  const entries: TlDay[] = [];
  const cur = new Date(range ? Math.min(todayMid.getTime(), dayToTs(range.toDay)) : todayMid);
  for (let guard = 0; guard < 400; guard++) {
    const ts = cur.getTime();
    const dk = dayBucket(ts);
    const items = byBucket.get(dk) ?? [];
    const state = dayStateOf(dk, ts, items, sctx);

    if (state) {
      const ets = items.length ? Math.max(...items.map((i) => i.ts)) : ts;
      entries.push({ bucket: dk, ts: ets, items, state });
    }
    // Stop once we've covered every logged day and the missed-lookback window.
    if (range && dk <= range.fromDay) break;
    if (dk < oldestLogged && todayK - dk > lookback) break;
    if (maxDays != null && entries.length >= dayOffset + maxDays) break;
    cur.setDate(cur.getDate() - 1);
  }

  const days =
    maxDays != null ? entries.slice(dayOffset, dayOffset + maxDays) : entries.slice(dayOffset);
  if (days.length === 0) return null;

  return (
    <div className="hist-tl">
      {days.map((day, i) => (
        <TimelineDay
          key={day.bucket}
          day={day}
          isLast={i === days.length - 1}
          isToday={day.bucket === todayK}
          allWorkouts={allWorkouts}
          bodyKg={bodyKg}
          showMuscles={showMuscles}
          onOpenWorkout={onOpenWorkout}
          onOpenActivity={onOpenActivity}
          onOpenSleep={onOpenSleep}
          openMuscleHistory={openMuscleHistory}
          editable={!restPeriodsOverride}
        />
      ))}
    </div>
  );
}

interface StateCtx {
  todayK: number;
  presc: Set<number>;
  lookback: number;
  coveringRest: (dk: number) => { mode: string; span: number } | null;
  coveringInjury: (dk: number) => boolean;
}

/** What decides a day's state: rest periods, injuries, the program. */
function useStateCtx({
  restPeriodsOverride,
  prescribedDaysOverride,
  lookbackOverride,
}: {
  restPeriodsOverride?: RestPeriod[];
  prescribedDaysOverride?: Set<number>;
  lookbackOverride?: number;
}): StateCtx {
  const store = useStore();
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const todayK = dayBucket(todayMid.getTime());
  const presc = prescribedDaysOverride ?? prescribedTrainingDays();
  const lookback = lookbackOverride ?? programLookbackDays();
  const rests = restPeriodsOverride ?? store.restPeriods;
  // Injuries are the signed-in user's own (client mode has no injury feed).
  const injuries = restPeriodsOverride ? [] : (store.injuries ?? []);
  const coveringInjury = (dk: number): boolean =>
    injuries.some((j) => dk >= j.startDay && dk <= (j.healedDay ?? todayK));
  const coveringRest = (dk: number): { mode: string; span: number } | null => {
    for (const r of rests) {
      const end = r.open ? todayK : r.endDay;
      if (dk >= r.startDay && dk <= end) return { mode: r.mode, span: end - r.startDay + 1 };
    }
    return null;
  };
  return { todayK, presc, lookback, coveringRest, coveringInjury };
}

/** A day's state from what was logged on it and what covered it. */
function dayStateOf(dk: number, ts: number, items: Item[], c: StateCtx): DayState | null {
  const { todayK, presc, lookback } = c;
  const hasWorkout = items.some((it) => it.kind === 'w');
  const rest = c.coveringRest(dk);
  if (hasWorkout) return 'trained';
  if (rest?.mode === 'illness') return 'illness';
  if (rest?.mode === 'off') return 'vacation';
  if (rest) return 'rest';
  if (items.length === 0 && dk <= todayK && c.coveringInjury(dk)) return 'injury';
  if (dk < todayK && lookback > 0 && todayK - dk <= lookback && presc.has(weekdayOf(ts)))
    return 'missed';
  // Program rest days: a non-training weekday inside the program window with
  // no session logged is a planned rest (a night of sleep or a walk on it is
  // still a rest day) — surface it the same way missed days are.
  if (
    dk <= todayK &&
    lookback > 0 &&
    presc.size > 0 &&
    todayK - dk <= lookback &&
    !presc.has(weekdayOf(ts))
  )
    return 'rest';
  if (items.length > 0) return 'logged';
  return null;
}

/** Day → the bar shown in a week's mini chart (WeekBars): the SAME day state the
 *  timeline uses, coloured by its family; a workout always wins (green). */
export function useDayBars(
  workouts: Workout[],
  activities: Activity[],
  sleeps: SleepNight[],
): (dk: number) => WeekBar {
  const sctx = useStateCtx({});
  const by = new Map<number, Item[]>();
  for (const g of buildHistoryDays(workouts, activities, sleeps)) by.set(dayBucket(g.ts), g.items);
  return (dk) => {
    if (dk > sctx.todayK) return { level: 1 };
    const state = dayStateOf(dk, dayToTs(dk), by.get(dk) ?? [], sctx);
    if (!state) return { level: 1 };
    const active = state === 'rest' && sctx.coveringRest(dk)?.mode === 'active';
    return {
      tone: active ? 'active' : STATE_TONE[state],
      level: state === 'trained' ? 3 : state === 'logged' ? 1 : 2,
    };
  };
}

interface PeriodRow {
  spec: HealthFormSpec;
  label: string;
  sub: string;
  tone: Tone;
  icon: string;
}

/** Every logged period / injury covering a day — one row each that opens its
 *  edit form (states can run side by side). Program rest days have no period. */
function periodRowsFor(
  bucket: number,
  store: ReturnType<typeof useStore>,
  t: Strings,
  locale: LocaleId,
): PeriodRow[] {
  const today = dayBucket(Date.now());
  const rows: PeriodRow[] = [];
  for (const r of store.restPeriods) {
    const end = r.open ? today : r.endDay;
    if (bucket < r.startDay || bucket > end) continue;
    const label = periodLabel(r, t);
    const kindName =
      r.mode === 'illness' && r.illnessKind && r.illnessKind !== 'other'
        ? illnessKindName(r.illnessKind, t)
        : '';
    // The kind rides in the sub-line unless it already is the row's name.
    const kindNote = kindName && kindName !== label ? `${kindName} · ` : '';
    rows.push({
      spec: { kind: 'edit', periodId: r.id },
      label,
      sub: `${kindNote}${fmtRange(r.startDay, end, locale, today)}`,
      tone: r.mode === 'illness' ? 'illness' : r.mode === 'active' ? 'active' : 'rest',
      icon: r.mode === 'illness' ? 'pulse' : r.mode === 'active' ? 'heartbeat' : 'flower-lotus',
    });
  }
  for (const inj of store.injuries ?? []) {
    if (bucket < inj.startDay || bucket > (inj.healedDay ?? today)) continue;
    rows.push({
      spec: { kind: 'edit-injury', injuryId: inj.id },
      label: injuryLabel(inj, t),
      sub: fmtRange(inj.startDay, inj.healedDay ?? today, locale, today),
      tone: 'injury',
      icon: 'bandaids',
    });
  }
  return rows;
}

interface DayRowHandlers {
  allWorkouts: Workout[];
  bodyKg: number | null;
  showMuscles?: boolean;
  onOpenWorkout: (id: string) => void;
  onOpenActivity?: (id: string) => void;
  onOpenSleep?: (id: string) => void;
  openMuscleHistory?: (m: MuscleGroup) => void;
}

/** One day of the timeline: the state node on the rail, the date line and the
 *  day card with its sessions, activities and nights. */
function TimelineDay({
  day,
  isLast,
  isToday,
  aside,
  allWorkouts,
  bodyKg,
  showMuscles,
  onOpenWorkout,
  onOpenActivity,
  onOpenSleep,
  openMuscleHistory,
  editable = true,
}: DayRowHandlers & {
  /** Rows of logged periods open the edit drawer (off in client mode). */
  editable?: boolean;
  day: TlDay;
  isLast: boolean;
  isToday: boolean;
  /** Right side of the date line (e.g. "day 3 of 6"). */
  aside?: ReactNode;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const [editSpec, setEditSpec] = useState<HealthFormSpec | null>(null);
  const stateLabel: Record<Exclude<DayState, 'trained' | 'logged'>, string> = {
    rest: t.histStateRest,
    vacation: t.histStateVacation,
    illness: t.histStateSick,
    injury: t.injRestEntry,
    missed: t.histStateMissed,
  };
  // "FRI · SEP 25 · MISSED" — the state rides on the date line.
  const showState = day.state !== 'trained' && day.state !== 'logged';
  const dateLine = [
    isToday ? t.today : fmtWeekdayShort(day.ts, locale),
    fmtDayMonth(day.ts, locale),
    showState ? stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const periodRows = editable ? periodRowsFor(day.bucket, store, t, locale) : [];
  const nodeLabel =
    day.state === 'trained' || day.state === 'logged'
      ? undefined
      : stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>];
  return (
    <KitDay
      className={`hist-tl-day st-${day.state}`}
      tone={STATE_TONE[day.state]}
      icon={day.state === 'logged' ? undefined : STATE_GLYPH[day.state]}
      nodeLabel={nodeLabel}
      date={dateLine}
      aside={aside}
      isLast={isLast}
      isToday={isToday}
    >
      {periodRows.length > 0 && (
        <Card pad="none" emphasis={isToday ? 'glass' : 'card'} className="hist-day-card">
          {periodRows.map((pr) => (
            <ListRow
              key={
                pr.spec.kind === 'edit'
                  ? pr.spec.periodId
                  : pr.spec.kind === 'edit-injury'
                    ? pr.spec.injuryId
                    : ''
              }
              icon={<IconTile tone={pr.tone} size={30} icon={pr.icon} />}
              label={pr.label}
              sub={pr.sub}
              chevron
              onClick={() => setEditSpec(pr.spec)}
            />
          ))}
        </Card>
      )}
      {editSpec && <PeriodEditSheet spec={editSpec} onClose={() => setEditSpec(null)} />}
      {day.items.length > 0 && (
        <Card pad="none" emphasis={isToday ? 'glass' : 'card'} className="hist-day-card">
          {day.items.map((it) => {
            if (it.kind === 's') return <SleepRow key={it.n.id} n={it.n} onOpen={onOpenSleep} />;
            if (it.kind === 'a')
              return <ActivityRow key={it.a.id} a={it.a} bodyKg={bodyKg} onOpen={onOpenActivity} />;
            return (
              <WorkoutRow
                key={it.w.id}
                w={it.w}
                allWorkouts={allWorkouts}
                bodyKg={bodyKg}
                showMuscles={showMuscles}
                onOpen={onOpenWorkout}
                openMuscleHistory={openMuscleHistory}
              />
            );
          })}
        </Card>
      )}
    </KitDay>
  );
}

/**
 * One calendar day rendered exactly like a History timeline day (the History
 * calendar's selected day). `day` is any timestamp on that local date.
 */
export function HistoryDay({
  day,
  workouts,
  activities,
  sleeps = [],
  aside,
  children,
  ...rest
}: DayRowHandlers & {
  day: number;
  workouts: Workout[];
  activities: Activity[];
  sleeps?: SleepNight[];
  aside?: ReactNode;
  /** Shown under the date line when the day has nothing logged. */
  children?: ReactNode;
}) {
  const sctx = useStateCtx({});
  const dk = dayBucket(day);
  const logged = buildHistoryDays(
    workouts.filter((w) => w.finishedAt !== null && dayBucket(w.startedAt) === dk),
    activities.filter((a) => a.finishedAt !== null && dayBucket(a.startedAt) === dk),
    sleeps.filter((n) => n.wake !== null && dayBucket(n.wake) === dk),
  );
  const items = logged[0]?.items ?? [];
  const mid = new Date(day);
  mid.setHours(12, 0, 0, 0);
  const state = dayStateOf(dk, mid.getTime(), items, sctx) ?? 'logged';
  return (
    <div className="hist-tl hist-tl-single">
      <TimelineDay
        day={{ bucket: dk, ts: mid.getTime(), items, state }}
        isLast
        isToday={dk === sctx.todayK}
        aside={aside}
        {...rest}
      />
      {items.length === 0 && children}
    </div>
  );
}

/** One finished workout row — program-day title, stats, muscles, kcal, opens
 *  the session detail. Exported so single-day views (the calendar day drawer)
 *  can reuse the exact My-history row. */
export function WorkoutRow({
  w,
  allWorkouts,
  onOpen,
}: {
  w: Workout;
  allWorkouts: Workout[];
  /** Kept for callers; kcal now lives on the detail page. */
  bodyKg?: number | null;
  showMuscles?: boolean;
  onOpen: (id: string) => void;
  openMuscleHistory?: (m: MuscleGroup) => void;
}) {
  const { t, locale } = useT();
  const dn = programDayNameFor(w, allWorkouts);
  const readout = workoutDayReadout(w);
  const title = dn ?? (readout ? dayReadoutLabel(readout, t) : fmtWeekday(w.startedAt, locale));
  if (w.kind === 'home') {
    // A home set: its own khaki house chip, its name, and sets (no tonnage).
    return (
      <ListRow
        className="hist-item hist-workout hist-home"
        dense
        strong
        time={fmtClock(w.startedAt)}
        icon={<IconTile tone="accent" size={36} icon="house" />}
        label={w.dayName || t.homeSetTitle}
        sub={`${w.finishedAt ? `${fmtDurationHM(w.finishedAt - w.startedAt)} · ` : ''}${workoutSets(w)} ${t.sets}`}
        chevron
        onClick={() => onOpen(w.id)}
      />
    );
  }
  return (
    <ListRow
      className="hist-item hist-workout"
      dense
      strong
      time={fmtClock(w.startedAt)}
      icon={<IconTile tone="accent" size={36} icon="barbell" />}
      label={title}
      sub={`${w.finishedAt ? `${fmtDurationHM(w.finishedAt - w.startedAt)} · ` : ''}${workoutSets(w)} ${t.sets} · ${fmtKg(workoutVolumeKg(w))}`}
      chevron
      onClick={() => onOpen(w.id)}
    />
  );
}

/** One finished activity in the timeline — the type icon sits inline with the
 *  name; the date lives in the shared day column. */
export function ActivityRow({
  a,
  onOpen,
}: {
  a: Activity;
  /** Kept for callers; kcal now lives on the detail page. */
  bodyKg?: number | null;
  onOpen?: (id: string) => void;
}) {
  const { t } = useT();
  const cat = activityTone(a.type, activityCategory(a));
  const min = Math.round(activityDurationMin(a));
  const tone: Tone = cat === 'sport' ? 'sport' : cat === 'recovery' ? 'rest' : 'accent';
  return (
    <ListRow
      className={`hist-item hist-activity is-minor cat-${cat}`}
      dense
      strong
      time={fmtClock(a.startedAt)}
      icon={<IconTile tone={tone} size={36} icon={activityType(a.type)?.icon ?? 'heartbeat'} />}
      label={
        <>
          {t.actType[a.type] ?? a.type}
          <span className="hist-item-inline">
            {' · '}
            {min} {t.minShort}
          </span>
        </>
      }
      chevron={!!onOpen}
      onClick={onOpen ? () => onOpen(a.id) : undefined}
      aria-label={t.actType[a.type] ?? a.type}
    />
  );
}

/** One finished night in the timeline — moon icon inline with "Sleep", the
 *  duration + range in the stats line, an `auto` flag for auto-logged nights. */
export function SleepRow({ n, onOpen }: { n: SleepNight; onOpen?: (id: string) => void }) {
  const { t } = useT();
  const mins = nightDurationMin(n);
  const nap = sleepKindOf(n) === 'nap';
  const pad = (x: number) => String(x).padStart(2, '0');
  const clk = (ms: number) => {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return (
    <ListRow
      className="hist-item hist-activity is-minor cat-sleep"
      dense
      strong
      time={clk(n.bedtime)}
      icon={<IconTile tone="sleep" size={36} icon={nap ? 'sun-horizon' : 'moon-stars'} />}
      label={
        <>
          {nap ? t.sleepKindNap : t.sleepTitle}
          <span className="hist-item-inline">
            {' · '}
            {fmtDurationHM(mins * 60000)}
          </span>
          {n.source === 'auto' && (
            <Tag tone="accent" className="hist-sleep-auto">
              {t.sleepAutoBadge}
            </Tag>
          )}
        </>
      }
      chevron={!!onOpen}
      onClick={onOpen ? () => onOpen(n.id) : undefined}
      aria-label={t.sleepTitle}
    />
  );
}
