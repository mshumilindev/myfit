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
  muscleWorkSorted,
  prescribedTrainingDays,
  programDayNameFor,
  programLookbackDays,
  weekdayOf,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
} from '../store';
import { fmtDurationHM, fmtKg, fmtShortDate, fmtWeekday, useT } from '../i18n';
import { dayReadoutLabel } from '../data/daySuggest';
import { MuscleRow } from './Muscle';
import { Icon } from '../ui';
import {
  activityType,
  activityCategory,
  activityCalories,
  workoutCalories,
  durationMin as activityDurationMin,
} from '../activities';
import type { MuscleGroup } from '../data/exercises';
import { nightDurationMin, sleepKindOf } from '../sleep';
import { bmrKcal, overnightKcal } from '../energy';
import { latestWeight, useStore } from '../store';
import type { Activity, SleepNight, Workout } from '../types';

type Item =
  | { kind: 'w'; ts: number; w: Workout }
  | { kind: 'a'; ts: number; a: Activity }
  | { kind: 's'; ts: number; n: SleepNight };

/** Per-day state, in priority order when several could apply. */
type DayState = 'trained' | 'illness' | 'vacation' | 'rest' | 'missed' | 'logged';

const STATE_GLYPH: Record<Exclude<DayState, 'logged'>, string> = {
  trained: 'check',
  illness: 'pulse',
  vacation: 'sun-horizon',
  rest: 'moon',
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
  const oldestLogged = loggedDays.length
    ? dayBucket(loggedDays[loggedDays.length - 1].ts)
    : todayK;
  const presc = prescribedTrainingDays();
  const lookback = programLookbackDays();
  const rests = store.restPeriods;

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
    else if (rest?.mode === 'off') state = rest.span >= 4 ? 'vacation' : 'rest';
    else if (
      dk < todayK &&
      lookback > 0 &&
      todayK - dk <= lookback &&
      presc.has(weekdayOf(ts))
    )
      state = 'missed';
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

  const days = maxDays != null ? entries.slice(dayOffset, dayOffset + maxDays) : entries.slice(dayOffset);
  if (days.length === 0) return null;

  const title = (w: Workout) => {
    const dn = programDayNameFor(w, allWorkouts);
    if (dn) return dn;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  const stateLabel: Record<Exclude<DayState, 'trained' | 'logged'>, string> = {
    rest: t.histStateRest,
    vacation: t.histStateVacation,
    illness: t.histStateSick,
    missed: t.histStateMissed,
  };

  return (
    <div className="hist-tl">
      {days.map((day, i) => {
        const isLast = i === days.length - 1;
        const showState = day.state !== 'trained' && day.state !== 'logged';
        return (
          <div
            className={`hist-tl-day st-${day.state}${isLast ? ' is-last' : ''}`}
            key={day.bucket}
          >
            <div className="hist-tl-rail">
              {day.state === 'logged' ? (
                <span className="hist-tl-dot" />
              ) : (
                <span className="hist-tl-node">
                  <Icon name={STATE_GLYPH[day.state as Exclude<DayState, 'logged'>]} />
                </span>
              )}
              <span className="hist-tl-line" />
            </div>
            <div className="hist-tl-body">
              {/* Date + state pill share one row, centred on the node. */}
              <div className="hist-tl-head">
                <span className="hist-tl-date">{fmtShortDate(day.ts, locale)}</span>
                {showState && (
                  <div className="hist-tl-state">
                    <Icon name={STATE_GLYPH[day.state as Exclude<DayState, 'logged'>]} />
                    {stateLabel[day.state as Exclude<DayState, 'trained' | 'logged'>]}
                  </div>
                )}
              </div>
              {day.items.map((it) => {
                if (it.kind === 's')
                  return <SleepRow key={it.n.id} n={it.n} onOpen={onOpenSleep} />;
                if (it.kind === 'a')
                  return (
                    <ActivityRow key={it.a.id} a={it.a} bodyKg={bodyKg} onOpen={onOpenActivity} />
                  );
                const kc = it.w.finishedAt ? workoutCalories(it.w, bodyKg) : null;
                return (
                  <button
                    key={it.w.id}
                    className="hist-item hist-workout"
                    onClick={() => onOpenWorkout(it.w.id)}
                  >
                    <span className="hist-item-body">
                      <span className="hist-item-name">{title(it.w)}</span>
                      <div className="hist-item-stats">
                        {workoutSets(it.w)} {t.sets} · {fmtKg(workoutVolumeKg(it.w))}
                        {it.w.finishedAt
                          ? ` · ${fmtDurationHM(it.w.finishedAt - it.w.startedAt)}`
                          : ''}
                      </div>
                      {showMuscles && muscleWorkSorted(it.w).length > 0 && (
                        <MuscleRow
                          entries={muscleWorkSorted(it.w)}
                          refTs={it.w.startedAt}
                          onOpen={openMuscleHistory}
                        />
                      )}
                    </span>
                    {kc != null && (
                      <span className="ta-kcal tnum">
                        <Icon name="flame" weight="fill" />~{kc}
                      </span>
                    )}
                    <Icon name="arrow-up-right" className="go" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One finished activity in the timeline — the type icon sits inline with the
 *  name; the date lives in the shared day column. */
function ActivityRow({
  a,
  bodyKg,
  onOpen,
}: {
  a: Activity;
  bodyKg: number | null;
  onOpen?: (id: string) => void;
}) {
  const { t } = useT();
  const cat = activityCategory(a);
  const kcal = a.calories ?? activityCalories(a, bodyKg);
  const min = Math.round(activityDurationMin(a));
  const inner = (
    <>
      <span className="hist-item-body">
        <span className="hist-item-name">
          <Icon name={activityType(a.type)?.icon ?? 'heartbeat'} className="hist-act-icon" />
          {t.actType[a.type] ?? a.type}
        </span>
        <div className="hist-item-stats">
          {min} {t.minShort}
          {a.distanceKm ? ` · ${a.distanceKm} ${t.kmShort}` : ''} ·{' '}
          {cat === 'recovery' ? t.actRecovery : t.actConditioning}
        </div>
      </span>
      {kcal != null && (
        <span className="ta-kcal tnum">
          <Icon name="flame" weight="fill" />~{kcal}
        </span>
      )}
      {onOpen && <Icon name="arrow-up-right" className="go" />}
    </>
  );
  return onOpen ? (
    <button
      className={`hist-item hist-activity cat-${cat}`}
      onClick={() => onOpen(a.id)}
      aria-label={t.actType[a.type] ?? a.type}
    >
      {inner}
    </button>
  ) : (
    <div className={`hist-item hist-activity cat-${cat}`}>{inner}</div>
  );
}

/** One finished night in the timeline — moon icon inline with "Sleep", the
 *  duration + range in the stats line, an `auto` flag for auto-logged nights. */
function SleepRow({ n, onOpen }: { n: SleepNight; onOpen?: (id: string) => void }) {
  const { t } = useT();
  const store = useStore();
  const mins = nightDurationMin(n);
  const nap = sleepKindOf(n) === 'nap';
  const kcal = overnightKcal(
    mins,
    bmrKcal(store.bodyMetrics, latestWeight(store.bodyMetrics)?.weight),
  );
  const pad = (x: number) => String(x).padStart(2, '0');
  const clk = (ms: number) => {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const inner = (
    <>
      <span className="hist-item-body">
        <span className="hist-item-name">
          <Icon name={nap ? 'sun-horizon' : 'moon-stars'} className="hist-act-icon" />
          {nap ? t.sleepKindNap : t.sleepTitle}
          {n.source === 'auto' && <span className="hist-sleep-auto">{t.sleepAutoBadge}</span>}
        </span>
        <div className="hist-item-stats">
          {fmtDurationHM(mins * 60000)}
          {n.wake ? ` · ${clk(n.bedtime)}→${clk(n.wake)}` : ''}
          {n.quality ? ` · ${t.sleepQuality[n.quality]}` : ''}
        </div>
      </span>
      {kcal != null && (
        <span className="ta-kcal tnum">
          <Icon name="flame" weight="fill" />~{kcal}
        </span>
      )}
      {onOpen && <Icon name="arrow-up-right" className="go" />}
    </>
  );
  return onOpen ? (
    <button
      className="hist-item hist-activity cat-sleep"
      onClick={() => onOpen(n.id)}
      aria-label={t.sleepTitle}
    >
      {inner}
    </button>
  ) : (
    <div className="hist-item hist-activity cat-sleep">{inner}</div>
  );
}
