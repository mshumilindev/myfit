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
import { Icon } from '../ui';
import { activityType, activityCategory, durationMin as activityDurationMin } from '../activities';
import type { MuscleGroup } from '../data/exercises';
import { nightDurationMin, sleepKindOf } from '../sleep';
import { useStore } from '../store';
import type { Activity, RestPeriod, SleepNight, Workout } from '../types';

type Item =
  | { kind: 'w'; ts: number; w: Workout }
  | { kind: 'a'; ts: number; a: Activity }
  | { kind: 's'; ts: number; n: SleepNight };

/** Per-day state, in priority order when several could apply. */
type DayState = 'trained' | 'illness' | 'injury' | 'vacation' | 'rest' | 'missed' | 'logged';

// Milestone glyphs, shared with Today's week pills: full rest is a plane, a
// rest / recovery day the lotus, never a "sleep" moon.
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
  const { t, locale } = useT();
  const store = useStore();

  const loggedDays = buildHistoryDays(workouts, activities, sleeps);
  const byBucket = new Map<number, Item[]>();
  for (const g of loggedDays) byBucket.set(dayBucket(g.ts), g.items);

  // Enrich: walk calendar days from today back, tagging each with its state and
  // surfacing rest / illness / vacation / missed days that have no logged items.
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const todayK = dayBucket(todayMid.getTime());
  const oldestLogged = loggedDays.length ? dayBucket(loggedDays[loggedDays.length - 1].ts) : todayK;
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

  const entries: TlDay[] = [];
  const cur = new Date(todayMid);
  for (let guard = 0; guard < 400; guard++) {
    const ts = cur.getTime();
    const dk = dayBucket(ts);
    const items = byBucket.get(dk) ?? [];
    const hasWorkout = items.some((it) => it.kind === 'w');
    const rest = coveringRest(dk);
    let state: DayState | null = null;
    if (hasWorkout) state = 'trained';
    else if (rest?.mode === 'illness') state = 'illness';
    else if (rest?.mode === 'off') state = 'vacation';
    else if (rest) state = 'rest';
    else if (items.length === 0 && dk <= todayK && coveringInjury(dk)) state = 'injury';
    else if (dk < todayK && lookback > 0 && todayK - dk <= lookback && presc.has(weekdayOf(ts)))
      state = 'missed';
    // Program rest days: a non-training weekday inside the program window with
    // no session logged is a planned rest (a night of sleep or a walk on it is
    // still a rest day) — surface it the same way missed days are.
    else if (
      dk <= todayK &&
      lookback > 0 &&
      presc.size > 0 &&
      todayK - dk <= lookback &&
      !presc.has(weekdayOf(ts))
    )
      state = 'rest';
    else if (items.length > 0) state = 'logged';

    if (state) {
      const ets = items.length ? Math.max(...items.map((i) => i.ts)) : ts;
      entries.push({ bucket: dk, ts: ets, items, state });
    }
    // Stop once we've covered every logged day and the missed-lookback window.
    if (dk < oldestLogged && todayK - dk > lookback) break;
    if (maxDays != null && entries.length >= dayOffset + maxDays) break;
    cur.setDate(cur.getDate() - 1);
  }

  const days =
    maxDays != null ? entries.slice(dayOffset, dayOffset + maxDays) : entries.slice(dayOffset);
  if (days.length === 0) return null;

  const stateLabel: Record<Exclude<DayState, 'trained' | 'logged'>, string> = {
    rest: t.histStateRest,
    vacation: t.histStateVacation,
    illness: t.histStateSick,
    injury: t.injRestEntry,
    missed: t.histStateMissed,
  };

  return (
    <div className="hist-tl">
      {days.map((day, i) => {
        const isLast = i === days.length - 1;
        const isToday = day.bucket === todayK;
        // "FRI · SEP 25 · MISSED" — the state rides on the date line.
        const showState = day.state !== 'trained' && day.state !== 'logged';
        const dateLine = [
          isToday ? t.today : fmtWeekdayShort(day.ts, locale),
          fmtDayMonth(day.ts, locale),
          showState ? stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>] : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div
            className={`hist-tl-day st-${day.state}${isLast ? ' is-last' : ''}${
              isToday ? ' is-today' : ''
            }`}
            key={day.bucket}
          >
            <div className="hist-tl-rail">
              {day.state === 'logged' ? (
                <span className="hist-tl-dot" />
              ) : (
                <span
                  className="hist-tl-node"
                  title={
                    day.state === 'trained'
                      ? undefined
                      : stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>]
                  }
                  aria-label={
                    day.state === 'trained'
                      ? undefined
                      : stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>]
                  }
                >
                  <Icon name={STATE_GLYPH[day.state as Exclude<DayState, 'logged'>]} />
                </span>
              )}
              <span className="hist-tl-line" />
            </div>
            <div className="hist-tl-body">
              {/* Date + state share one line, centred on the node. */}
              <div className="hist-tl-head">
                <span className="hist-tl-date">{dateLine}</span>
              </div>
              {day.items.length > 0 && (
                <div className="hist-day-card">
                  {day.items.map((it) => {
                    if (it.kind === 's')
                      return <SleepRow key={it.n.id} n={it.n} onOpen={onOpenSleep} />;
                    if (it.kind === 'a')
                      return (
                        <ActivityRow
                          key={it.a.id}
                          a={it.a}
                          bodyKg={bodyKg}
                          onOpen={onOpenActivity}
                        />
                      );
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
                </div>
              )}
            </div>
          </div>
        );
      })}
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
      <button className="hist-item hist-workout hist-home" onClick={() => onOpen(w.id)}>
        <span className="hist-tm tnum">{fmtClock(w.startedAt)}</span>
        <span className="hist-ic">
          <Icon name="house" weight="fill" />
        </span>
        <span className="hist-item-body">
          <span className="hist-item-name">{w.dayName || t.homeSetTitle}</span>
          <div className="hist-item-stats">
            {w.finishedAt ? `${fmtDurationHM(w.finishedAt - w.startedAt)} · ` : ''}
            {workoutSets(w)} {t.sets}
          </div>
        </span>
        <span className="hist-go">
          <Icon name="caret-right" weight="bold" />
        </span>
      </button>
    );
  }
  return (
    <button className="hist-item hist-workout" onClick={() => onOpen(w.id)}>
      <span className="hist-tm tnum">{fmtClock(w.startedAt)}</span>
      <span className="hist-ic">
        <Icon name="barbell" weight="fill" />
      </span>
      <span className="hist-item-body">
        <span className="hist-item-name">{title}</span>
        <div className="hist-item-stats">
          {w.finishedAt ? `${fmtDurationHM(w.finishedAt - w.startedAt)} · ` : ''}
          {workoutSets(w)} {t.sets} · {fmtKg(workoutVolumeKg(w))}
        </div>
      </span>
      <span className="hist-go">
        <Icon name="caret-right" weight="bold" />
      </span>
    </button>
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
  const cat = activityCategory(a);
  const min = Math.round(activityDurationMin(a));
  const inner = (
    <>
      <span className="hist-tm tnum">{fmtClock(a.startedAt)}</span>
      <span className="hist-ic">
        <Icon name={activityType(a.type)?.icon ?? 'heartbeat'} weight="fill" />
      </span>
      <span className="hist-item-body">
        <span className="hist-item-name">
          {t.actType[a.type] ?? a.type}
          <span className="hist-item-inline">
            {' · '}
            {min} {t.minShort}
          </span>
        </span>
      </span>
      {onOpen && (
        <span className="hist-go">
          <Icon name="caret-right" weight="bold" />
        </span>
      )}
    </>
  );
  return onOpen ? (
    <button
      className={`hist-item hist-activity is-minor cat-${cat}`}
      onClick={() => onOpen(a.id)}
      aria-label={t.actType[a.type] ?? a.type}
    >
      {inner}
    </button>
  ) : (
    <div className={`hist-item hist-activity is-minor cat-${cat}`}>{inner}</div>
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
  const inner = (
    <>
      <span className="hist-tm tnum">{clk(n.bedtime)}</span>
      <span className="hist-ic">
        <Icon name={nap ? 'sun-horizon' : 'moon-stars'} weight="fill" />
      </span>
      <span className="hist-item-body">
        <span className="hist-item-name">
          {nap ? t.sleepKindNap : t.sleepTitle}
          <span className="hist-item-inline">
            {' · '}
            {fmtDurationHM(mins * 60000)}
          </span>
          {n.source === 'auto' && <span className="hist-sleep-auto">{t.sleepAutoBadge}</span>}
        </span>
      </span>
      {onOpen && (
        <span className="hist-go">
          <Icon name="caret-right" weight="bold" />
        </span>
      )}
    </>
  );
  return onOpen ? (
    <button
      className="hist-item hist-activity is-minor cat-sleep"
      onClick={() => onOpen(n.id)}
      aria-label={t.sleepTitle}
    >
      {inner}
    </button>
  ) : (
    <div className="hist-item hist-activity is-minor cat-sleep">{inner}</div>
  );
}
