/** Today — design W-03…W-05 (desktop 3-column) / S-10…S-16 (mobile). */
import { useEffect, useMemo, useState } from 'react';
import type { Shell } from '../App';
import type { ExerciseKind, Gym, Workout } from '../types';
import { callFn, getRole } from '../api';
import { buildProgramSeed, programSuggestionReadiness, setProgramSeed } from '../data/programSeed';
import { useFlag } from '../data/flags';
import { MuscleChip } from '../components/Muscle';
import { dayReadoutLabel } from '../data/daySuggest';
import type { MuscleGroup } from '../data/exercises';
import {
  addExercise,
  backfillWorkout,
  dismissReminder,
  dismissWeighInToday,
  logVisitAsWorkout,
  muscleSetsInWorkout,
  resolveMuscles,
  startWorkout,
  topSet,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
  type useStore,
} from '../store';
import {
  fmtDayMonth,
  fmtDurationHM,
  fmtDurationHuman,
  fmtKg,
  fmtShortDate,
  fmtWeekday,
  fmtWeekdayDayMonth,
  useT,
} from '../i18n';
import { WeekStrip } from '../components/WeekStrip';
import { WeightSheet } from '../components/BodyMetrics';
import { Icon, Sheet } from '../ui';
import { DateField, TimeField, DurationField } from '../components/PickerFields';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';
import { EquipmentIcon, type EquipmentId } from '../data/equipment';

type Store = ReturnType<typeof useStore>;

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

function weekStartOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** minutes-since-midnight → "HH:MM" (pure; tabular clock). */
function hhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function compactProgramDaySummary(items: ProgramItem[]): string {
  const strength = items.filter((item) => item.kind === 'strength');
  if (strength.length === 0) {
    const totalMin = items.reduce((sum, item) => sum + (item.durationMin ?? 10), 0);
    return `${totalMin} min`;
  }
  const sets = strength.reduce((sum, item) => sum + item.sets, 0);
  const reps = strength.length === 1 ? strength[0].reps : null;
  return reps ? `${sets} × ${reps}` : String(sets);
}

const BAR_COLORS = [
  'var(--color-neutral-800)',
  'var(--color-neutral-800)',
  'var(--color-neutral-800)',
  'var(--color-neutral-800)',
  'var(--color-neutral-800)',
  'var(--color-accent-800)',
  'var(--color-accent-700)',
  'var(--color-accent-700)',
  'var(--color-accent-600)',
  'var(--color-accent)',
];

interface ProgramItem {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
  groupId?: string | null;
  groupOrder?: number | null;
  dropLast?: boolean;
}

interface ProgramAssignment {
  program: {
    id: string;
    name: string;
    weeks: number;
    daysPerWeek: number;
    dayNames?: Record<string, string>;
    /** Per-day target muscle groups (muscle-only or mixed days). */
    targetMuscles?: Record<string, MuscleGroup[]>;
    items: ProgramItem[];
  };
  assignedBy: string | null;
  week: number;
  done: number;
  total: number;
  expectedSoFar: number;
  adherence: number | null;
}

function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [active]);
  return now;
}

/** "Not now" cooldown for the Suggest-a-program banner (AC-3.2: reappears no
 *  more than once every 1–2 weeks). Local, device-only — a transient nudge. */
const SUGGEST_DISMISS_KEY = 'spotter.progSuggest.dismissedAt';
const SUGGEST_COOLDOWN_MS = 12 * 24 * 60 * 60 * 1000;

export function TodayView({ shell, store }: { shell: Shell; store: Store }) {
  const { t, locale } = useT();
  const presenceOn = useFlag('gymPresence');
  const suggestOn = true; // muscle readouts are always on (not flagged)
  const sessionMuscles = (w: Workout): MuscleGroup[] =>
    [...muscleSetsInWorkout(w).entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m)
      .slice(0, 4);
  const [startPicker, setStartPicker] = useState(false);
  const [backfill, setBackfill] = useState(false);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  // Suggest-a-program banner state (AC · "Suggest Program Banner").
  const [progSheetOpen, setProgSheetOpen] = useState(false);
  const openMuscleHistory = (muscle: MuscleGroup) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });
  const [progChoice, setProgChoice] = useState<'week' | 'week-lifts'>('week-lifts');
  const [, setProgDismissTick] = useState(0);
  const [assignment, setAssignment] = useState<ProgramAssignment | null>(null);

  /** Session heading: the program day name if it has one, else the weekday. */
  // Program sessions keep their own day name; logged sessions are named by the
  // muscle groups trained ("Back + Shoulders", "Legs", "Chest"), weekday only
  // as a last resort (Ex suggestions).
  const sessionTitle = (w: Workout) => {
    if (w.dayName) return w.dayName;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  function beginSession(gymId: string | null) {
    setStartPicker(false);
    const w = startWorkout(gymId);
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }
  function startSession() {
    if (store.gyms.length > 0) setStartPicker(true);
    else beginSession(null);
  }

  const open = store.workouts.find((w) => w.finishedAt === null);
  const now = useNowTick(!!open);
  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const hasHistory = finished.length > 0;
  const programReadiness = useMemo(() => programSuggestionReadiness(finished), [finished]);

  // Already trained today? Once a session for the current calendar day is
  // logged, the "what to do today" suggestion has served its purpose.
  const trainedToday = (() => {
    const n = new Date(now);
    return finished.some((w) => {
      const d = new Date(w.startedAt);
      return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
      );
    });
  })();

  // "Likely today" prediction (Today plaque): the usual split + start time for
  // this weekday, from history. Hidden mid-session, without weekday history, or
  // once today's session is already logged.
  const prediction = (() => {
    if (open || trainedToday) return null;
    const dow = new Date(now).getDay();
    const sameDow = finished
      .filter((w) => new Date(w.startedAt).getDay() === dow)
      .sort((a, b) => b.startedAt - a.startedAt);
    if (sameDow.length === 0) return null;
    const recent = sameDow[0];
    const readout = workoutDayReadout(recent);
    const dayLabel = recent.dayName || (readout ? dayReadoutLabel(readout, t) : null);
    if (!dayLabel) return null;
    const mins = sameDow
      .map((w) => {
        const d = new Date(w.startedAt);
        return d.getHours() * 60 + d.getMinutes();
      })
      .sort((a, b) => a - b);
    const startMin = mins[Math.floor(mins.length / 2)];
    // Muscle groups in the order they were trained that day (first exercise
    // first), not by set count.
    const seen = new Set<MuscleGroup>();
    const order: MuscleGroup[] = [];
    for (const e of [...recent.exercises].sort((a, b) => a.position - b.position)) {
      if (e.sets.length === 0) continue;
      const { primary } = resolveMuscles(e);
      if (!primary || primary === 'cardio' || seen.has(primary)) continue;
      seen.add(primary);
      order.push(primary);
    }
    const muscles = order.slice(0, 5).map((m) => t.muscleGroups[m]);
    return { dayLabel, startMin, mealMin: startMin - 105, muscles };
  })();

  // Weigh-in reminder (Body metrics §4): on the usual weekday, past the usual
  // time, if nothing is logged today and not dismissed. Learned from history.
  const ymd = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const weighReminder = (() => {
    if (open) return null;
    const ws = store.bodyMetrics.weights;
    if (ws.length < 2) return null;
    const dowCount = new Array(7).fill(0);
    ws.forEach((w) => (dowCount[new Date(w.at).getDay()] += 1));
    const usualDow = dowCount.indexOf(Math.max(...dowCount));
    const times = ws.map((w) => new Date(w.at).getHours() * 60 + new Date(w.at).getMinutes());
    times.sort((a, b) => a - b);
    const usualMin = times[Math.floor(times.length / 2)];
    const todayKey = ymd(now);
    const loggedToday = ws.some((w) => ymd(w.at) === todayKey);
    const nowD = new Date(now);
    const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
    const show =
      nowD.getDay() === usualDow &&
      nowMin >= usualMin &&
      !loggedToday &&
      store.bodyMetrics.weighInDismissedDay !== todayKey;
    return show ? { usualMin } : null;
  })();

  const firstLoad = store.workouts.length === 0 && store.lastSyncAt === null && !!store.queue;
  const showSkeleton = firstLoad && store.syncStatus === 'syncing';

  const reminder = presenceOn ? store.reminders[0] : undefined;
  const queuedIds = new Set(
    store.queue.map((q) => q.url.match(/workouts\/([0-9a-f-]+)/)?.[1]).filter(Boolean),
  );

  // --- Aggregates for the stat grid, weekly bars and records (W-04) --------
  const totalVolKg = finished.reduce((v, w) => v + workoutVolumeKg(w), 0);
  const byName = new Map<string, { recW: number; recReps: number; recTs: number }>();
  for (const w of finished) {
    for (const e of w.exercises) {
      const top = topSet(e.sets);
      if (!top || (top.weight ?? 0) <= 0) continue;
      const key = e.name.trim();
      if (!key) continue;
      const cur = byName.get(key) ?? { recW: 0, recReps: 0, recTs: 0 };
      if ((top.weight ?? 0) > cur.recW) {
        cur.recW = top.weight ?? 0;
        cur.recReps = top.reps;
        cur.recTs = w.startedAt;
      }
      byName.set(key, cur);
    }
  }
  const newPrs = [...byName.values()].filter((r) => now - r.recTs < 14 * DAY_MS).length;
  const records = [...byName.entries()].sort((a, b) => b[1].recW - a[1].recW).slice(0, 3);

  const thisWeek = weekStartOf(now);
  const weeks: number[] = [];
  for (let i = 9; i >= 0; i--) {
    const s = thisWeek - i * WEEK_MS;
    weeks.push(
      finished
        .filter((w) => weekStartOf(w.startedAt) === s)
        .reduce((v, w) => v + workoutVolumeKg(w), 0),
    );
  }
  const maxWeek = Math.max(...weeks, 1);
  const deltaPct = weeks[8] > 0 ? Math.round(((weeks[9] - weeks[8]) / weeks[8]) * 100) : null;

  const weeksSet = new Set(finished.map((w) => weekStartOf(w.startedAt)));
  let runWeeks = 0;
  for (let c = thisWeek; weeksSet.has(c); c -= WEEK_MS) runWeeks++;
  const streakDays = runWeeks * 7;

  const livePlannedSets = open
    ? open.exercises.reduce((sum, ex) => {
        if ((ex.plannedSets ?? 0) > 0) return sum + (ex.plannedSets ?? 0);
        return sum + Math.max(ex.sets.length, ex.kind === 'strength' ? 1 : 1);
      }, 0)
    : 0;
  const liveDoneSets = open ? workoutSets(open) : 0;
  const liveProgressPct =
    livePlannedSets > 0 ? Math.min(100, Math.round((liveDoneSets / livePlannedSets) * 100)) : 0;
  const livePrimaryName =
    open?.exercises.find((ex) => ex.sets.length < (ex.plannedSets ?? ex.sets.length + 1))?.name ??
    open?.exercises[0]?.name ??
    t.today;
  const liveExerciseSummary = open?.exercises
    .map((ex) => ex.name.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' · ');

  useEffect(() => {
    callFn<{ assignment: ProgramAssignment | null }>('programMine')
      .then((data) => setAssignment(data.assignment))
      .catch(() => setAssignment(null));
  }, []);

  function startProgramDay(day: number) {
    if (!assignment) return;
    const items = assignment.program.items
      .filter((item) => item.day === day)
      .sort((a, b) => a.position - b.position);
    const dayName = assignment.program.dayNames?.[String(day)] || t.progDay(day);
    const targetMuscles = assignment.program.targetMuscles?.[String(day)] ?? [];
    const w = startWorkout(null, { dayName, targetMuscles });
    if (items.length > 0) {
      for (const item of items) {
        addExercise(w.id, item.name, item.kind, {
          plannedSets: item.kind === 'strength' ? item.sets : 1,
          plannedReps: item.kind === 'strength' ? item.reps : null,
          plannedDurationMin: item.kind === 'strength' ? null : (item.durationMin ?? 10),
          equipment: item.equipment,
          // A prescribed superset arrives grouped (EQ-2 → SS-1).
          groupId: item.groupId ?? null,
          groupOrder: item.groupOrder ?? null,
        });
      }
    }
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }

  if (showSkeleton) {
    return (
      <div className="screen" style={{ gap: 'var(--space-6)' }}>
        <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="sk" style={{ width: 120, height: 10 }} />
          <div className="sk" style={{ width: 210, height: 26 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="sk" style={{ flex: 1, height: 46 }} />
          ))}
        </div>
        <div className="sk" style={{ height: 62, borderRadius: 14 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sk" style={{ flex: 1, height: 92 }} />
          <div className="sk" style={{ flex: 1, height: 92 }} />
        </div>
      </div>
    );
  }

  // Suggest a program (AC): members with enough history, never mid-session or
  // for read-only staff. "New" when there's no program; "drifted" when the last
  // few weeks diverge from the current one. Dismissal has a 1–2 week cooldown.
  const suggest = ((): { variant: 'new' | 'drifted' } | null => {
    // Anyone who trains on their own Today (members + a solo admin/owner); never
    // a trainer viewing clients, and never mid-session.
    if (getRole() === 'trainer' || open) return null;
    if (!programReadiness.ready) return null;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(SUGGEST_DISMISS_KEY) || 0);
    } catch {
      /* ignore */
    }
    if (dismissedAt && now - dismissedAt < SUGGEST_COOLDOWN_MS) return null;
    if (!assignment) return { variant: 'new' };
    const recent = finished.slice(0, 9);
    const recentEx = new Set(recent.flatMap((w) => w.exercises.map((e) => e.name.toLowerCase())));
    const progEx = new Set(assignment.program.items.map((i) => i.name.toLowerCase()));
    if (progEx.size === 0 || recentEx.size === 0) return null;
    let overlap = 0;
    recentEx.forEach((e) => {
      if (progEx.has(e)) overlap += 1;
    });
    return overlap / recentEx.size < 0.5 ? { variant: 'drifted' } : null;
  })();

  function dismissSuggest() {
    try {
      localStorage.setItem(SUGGEST_DISMISS_KEY, String(now));
    } catch {
      /* ignore */
    }
    setProgDismissTick((n) => n + 1);
  }

  function createProgramFromHistory() {
    setProgramSeed(buildProgramSeed(finished, progChoice === 'week-lifts', t.progNew));
    try {
      localStorage.setItem(SUGGEST_DISMISS_KEY, String(now));
    } catch {
      /* ignore */
    }
    setProgSheetOpen(false);
    setProgDismissTick((n) => n + 1);
    shell.toast({ kind: 'ok', icon: 'check-circle', text: t.progSuggestCreatedToast });
    shell.goTab('programs');
  }

  const suggestBanner = suggest && (
    <div className="prog-banner fade-in">
      <span className="prog-sheen" aria-hidden />
      <div className="prog-banner-row">
        <span className="prog-banner-icon">
          <Icon name="sparkle" weight="bold" />
        </span>
        <div className="prog-banner-main">
          <span className="prog-banner-kicker">{t.progSuggestKicker}</span>
          <div className="prog-banner-title">
            {suggest.variant === 'drifted' ? t.progSuggestDriftedTitle : t.progSuggestNewTitle}
          </div>
          <div className="prog-banner-body">
            {suggest.variant === 'drifted' ? t.progSuggestDriftedBody : t.progSuggestNewBody}
          </div>
          <div className="prog-banner-acts">
            <button className="prog-banner-cta" onClick={() => setProgSheetOpen(true)}>
              <Icon name="check" weight="bold" />
              {suggest.variant === 'drifted' ? t.progSuggestDriftedCta : t.progSuggestNewCta}
            </button>
            <button className="prog-banner-skip" onClick={dismissSuggest}>
              {t.progSuggestNotNow}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const programCard = !open && assignment && (
    <section className="today-program-card">
      <div className="program-card-head">
        <Icon name="copy" />
        <div>
          <div className="field-label">{t.progTitle}</div>
          <div className="n">{assignment.program.name}</div>
          <div className="s">
            {t.progWeekN(assignment.week)} · {t.progSessions(assignment.done, assignment.total)}
            {assignment.assignedBy ? ` · ${t.progAssignedBy(assignment.assignedBy)}` : ''}
          </div>
        </div>
        {assignment.adherence !== null && (
          <span className="tag tag-ok">{Math.round(assignment.adherence * 100)}%</span>
        )}
      </div>
      <div className="program-day-actions">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
          const items = assignment.program.items
            .filter((item) => item.day === day)
            .sort((a, b) => a.position - b.position);
          const equipment = [
            ...new Set(items.flatMap((item) => item.equipment ?? [])),
          ] as EquipmentId[];
          const dayMuscles = assignment.program.targetMuscles?.[String(day)] ?? [];
          // A day is a real training day if it prescribes lifts OR names target
          // muscles (a muscle-only day — we suggest the lifts on the day).
          const hasPlan = items.length > 0 || dayMuscles.length > 0;
          const dayName = assignment.program.dayNames?.[day] || t.progDay(day);
          const setCount = items.reduce(
            (sum, item) => sum + (item.kind === 'strength' ? item.sets : 1),
            0,
          );
          const summary =
            items.length === 0 && dayMuscles.length > 0
              ? dayMuscles.map((m) => t.muscleGroups[m]).join(' · ')
              : items.length === 1
                ? compactProgramDaySummary(items)
                : t.progDayWorkoutSummary(items.length, setCount);
          return (
            <button
              key={day}
              className={`program-start-day${hasPlan ? ' planned' : ''}${day === todayWeekday ? ' is-today' : ''}`}
              disabled={!hasPlan}
              onClick={() => startProgramDay(day)}
            >
              <span className="program-start-top">
                <span>{t.weekDayLetters[day - 1]}</span>
                {hasPlan ? <Icon name="play" /> : <span>+</span>}
              </span>
              <strong>{hasPlan ? dayName : t.progRestDay}</strong>
              {hasPlan && <span className="program-start-summary">{summary}</span>}
              {equipment.length > 0 && (
                <span className="program-start-equipment">
                  {equipment.slice(0, 4).map((id) => (
                    <EquipmentIcon key={id} equipment={id} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );

  const banners = (
    <>
      {store.syncStatus === 'offline' && store.queue.length > 0 && (
        <div className="banner offline">
          <Icon name="cloud-slash" />
          <span>{t.offlineQueued(store.queue.length)}</span>
        </div>
      )}
      {store.syncStatus === 'syncing' && store.queue.length > 0 && (
        <div className="sync-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="arrows-clockwise" className="num" />
            <span style={{ fontSize: 12, color: 'var(--color-neutral-300)', flex: 1 }}>
              {t.sendingQueued}
            </span>
            <span className="num" style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
              {store.queue.length}
            </span>
          </div>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: '66%' }} />
          </div>
        </div>
      )}
      {reminder && !open && (
        <div className="reminder-card">
          <Icon name="map-pin" />
          <div>
            {t.unloggedVisit(
              fmtDurationHuman(reminder.visitEnd - reminder.visitStart),
              reminder.gymName,
              fmtDayMonth(reminder.visitStart, locale),
            )}
            <div className="reminder-actions">
              <button
                className="link"
                onClick={() => {
                  const w = logVisitAsWorkout(reminder);
                  shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
                }}
              >
                {t.logIt}
              </button>
              <button className="link-muted" onClick={() => dismissReminder(reminder)}>
                {t.dismiss}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={`screen paned${open ? ' today-live-mode' : ''}`}>
      <div className="pane-main">
        {open && <h2 className="visually-hidden">{t.today}</h2>}
        {!open &&
          (hasHistory ? (
            <div className="td-topbar">
              <div>
                <div className="kicker">{fmtWeekdayDayMonth(now, locale)}</div>
                <h2>{t.today}</h2>
              </div>
              <div className="td-topbar-actions">
                <SyncChip store={store} />
                <div className="td-header-ctas">
                  <button className="btn btn-secondary" onClick={() => setBackfill(true)}>
                    <Icon name="arrow-counter-clockwise" />
                    {t.logPastSession}
                  </button>
                  <button className="btn btn-primary" onClick={startSession}>
                    <Icon name="play" />
                    {t.startSessionLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="td-topbar">
              <div className="kicker">{fmtWeekdayDayMonth(now, locale)}</div>
              <div className="td-topbar-actions">
                <SyncChip store={store} />
              </div>
            </div>
          ))}

        {banners}
        {suggestBanner}
        {programCard}

        {weighReminder && (
          <div className="weigh-plaque">
            <Icon name="scales" />
            <div className="wp-body">
              <div className="wp-title">{t.weighTitle}</div>
              <div className="wp-sub">{t.weighBody(hhmm(weighReminder.usualMin))}</div>
              <div className="wp-acts">
                <button className="wp-add" onClick={() => setAddWeightOpen(true)}>
                  {t.bmAddWeight}
                </button>
                <button className="wp-skip" onClick={() => dismissWeighInToday(ymd(now))}>
                  {t.weighNotToday}
                </button>
              </div>
            </div>
          </div>
        )}

        {prediction && (
          <div className="likely-plaque">
            <div className="lp-head">
              <Icon name="calendar-check" />
              <span className="lp-kicker">{t.likelyToday}</span>
              <span className="lp-from">{t.likelyFromHistory}</span>
            </div>
            <div className="lp-body">
              <div className="lp-day-row">
                <span className="lp-day">{t.likelyDayTitle(prediction.dayLabel)}</span>
                <span className="lp-time">~{hhmm(prediction.startMin)}</span>
              </div>
              {prediction.muscles.length > 0 && (
                <div className="lp-lifts">{prediction.muscles.join(' · ')}</div>
              )}
            </div>
            <div className="lp-meal">
              <Icon name="fork-knife" />
              <span>{t.likelyMeal(hhmm(prediction.mealMin))}</span>
            </div>
          </div>
        )}

        {!open && hasHistory && (
          <div className="td-start-ctas mobile-only">
            <button className="btn btn-primary td-start-cta" onClick={startSession}>
              <Icon name="play" />
              {t.startSessionLabel}
            </button>
            <button className="btn btn-secondary td-backfill-cta" onClick={() => setBackfill(true)}>
              <Icon name="arrow-counter-clockwise" />
              {t.logPastSession}
            </button>
          </div>
        )}

        {!open && hasHistory && (
          <button
            className="td-templates-link"
            onClick={() => shell.openOverlay({ screen: 'templates' })}
          >
            <Icon name="cards" />
            <span className="tl-body">
              <span className="tl-title">{t.templates}</span>
              <span className="tl-sub">{t.templatesSaved(finished.length)}</span>
            </span>
            <Icon name="arrow-right" className="tl-go" />
          </button>
        )}

        {open ? (
          <>
            <section className="today-live-summary">
              <div className="today-live-summary-head">
                <Icon name="list-checks" />
                <span>{liveExerciseSummary || livePrimaryName}</span>
                <strong>
                  {liveProgressPct}% ·{' '}
                  {t.progSetsDone(liveDoneSets, livePlannedSets || liveDoneSets)}
                </strong>
              </div>
              <div className="today-live-segments">
                {Array.from({ length: Math.max(livePlannedSets, liveDoneSets, 1) }, (_, i) => (
                  <span key={i} className={i < liveDoneSets ? 'done' : ''} />
                ))}
              </div>
              <p>{t.progGhostDivision}</p>
            </section>

            <div className="td-history">
              <div className="section-label" style={{ marginBottom: 8 }}>
                {t.recent}
              </div>
              <span className="visually-hidden">{t.tdHistory}</span>
              <div className="desktop-only">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.colDate}</th>
                      <th>{t.colSession}</th>
                      <th>{t.colSets}</th>
                      <th>{t.volumeCol}</th>
                      <th>{t.duration}</th>
                      {suggestOn && <th>{t.musclesCol}</th>}
                      <th className="td-history-dots"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {finished.slice(0, 5).map((w) => (
                      <tr
                        key={w.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          shell.openOverlay({ screen: 'past-workout', workoutId: w.id })
                        }
                      >
                        <td>{fmtShortDate(w.startedAt, locale)}</td>
                        <td>{sessionTitle(w)}</td>
                        <td>{workoutSets(w)}</td>
                        <td>{fmtKg(workoutVolumeKg(w))}</td>
                        <td>{w.finishedAt ? fmtDurationHM(w.finishedAt - w.startedAt) : '—'}</td>
                        {suggestOn && (
                          <td className="td-muscles">
                            {sessionMuscles(w).map((m) => (
                              <MuscleChip
                                key={m}
                                muscle={m}
                                tone="secondary"
                                onClick={openMuscleHistory}
                              />
                            ))}
                          </td>
                        )}
                        <td className="td-history-dots">
                          <Icon name="dots-three" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-only">
                {finished.slice(0, 4).map((w) => (
                  <button
                    key={w.id}
                    className="recent-row"
                    onClick={() => shell.openOverlay({ screen: 'past-workout', workoutId: w.id })}
                  >
                    <span className="d">{fmtShortDate(w.startedAt, locale)}</span>
                    <span style={{ flex: 1 }}>
                      <span className="name">{sessionTitle(w)}</span>
                      <div className="stats">
                        {workoutSets(w)} {t.sets} · {fmtKg(workoutVolumeKg(w))}
                        {w.finishedAt ? ` · ${fmtDurationHM(w.finishedAt - w.startedAt)}` : ''}
                      </div>
                      {suggestOn && sessionMuscles(w).length > 0 && (
                        <div className="recent-muscles">
                          {sessionMuscles(w).map((m) => (
                            <MuscleChip
                              key={m}
                              muscle={m}
                              tone="secondary"
                              onClick={openMuscleHistory}
                            />
                          ))}
                        </div>
                      )}
                    </span>
                    <Icon name="arrow-up-right" className="go" />
                  </button>
                ))}
              </div>
              {finished.length > 5 && (
                <button
                  className="td-history-all"
                  onClick={() => shell.openOverlay({ screen: 'history' })}
                >
                  {t.seeAllHistory}
                  <Icon name="arrow-up-right" />
                </button>
              )}
            </div>
          </>
        ) : hasHistory ? (
          <>
            <div className="td-stats">
              <div className="td-stat">
                <div className="v">{finished.length}</div>
                <div className="l">{t.statSessions}</div>
              </div>
              <div className="td-stat">
                <div className="v">{(totalVolKg / 1000).toFixed(1)} t</div>
                <div className="l">{t.statVolume}</div>
              </div>
              <div className="td-stat">
                <div className={`v${newPrs > 0 ? ' ok' : ''}`}>{newPrs}</div>
                <div className="l">{t.statNewPrs}</div>
              </div>
              <div className="td-stat">
                <div className="v">{t.statDays(streakDays)}</div>
                <div className="l">{t.statStreak}</div>
              </div>
            </div>

            <div className="mobile-only">
              <WeekStrip />
            </div>

            <div>
              <div className="td-block-head">
                <div className="section-label">{t.weeklyVolume}</div>
                {deltaPct !== null && (
                  <div className="td-delta">
                    {deltaPct >= 0 ? '+' : '−'}
                    {Math.abs(deltaPct)}%
                  </div>
                )}
              </div>
              <div className="bars">
                {weeks.map((v, i) => (
                  <div
                    key={i}
                    className="bar"
                    style={{
                      height: `${Math.max((v / maxWeek) * 100, 4)}%`,
                      background: BAR_COLORS[i],
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="td-history">
              <div className="section-label section-divide" style={{ marginBottom: 8 }}>
                {t.tdHistory}
              </div>
              {/* Desktop: full table (W-04). */}
              <div className="desktop-only">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t.colDate}</th>
                      <th>{t.colSession}</th>
                      <th>{t.colSets}</th>
                      <th>{t.volumeCol}</th>
                      <th>{t.duration}</th>
                      {suggestOn && <th>{t.musclesCol}</th>}
                      <th className="td-history-dots"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {finished.slice(0, 8).map((w) => (
                      <tr
                        key={w.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          shell.openOverlay({ screen: 'past-workout', workoutId: w.id })
                        }
                      >
                        <td>{fmtShortDate(w.startedAt, locale)}</td>
                        <td>
                          {fmtDayMonth(w.startedAt, locale)}
                          {w.autoFinished && (
                            <span className="tag tag-neutral" style={{ marginLeft: 6 }}>
                              {t.autoClosed}
                            </span>
                          )}
                          {queuedIds.has(w.id) && (
                            <span className="tag tag-neutral" style={{ marginLeft: 6 }}>
                              {t.queued}
                            </span>
                          )}
                        </td>
                        <td>{workoutSets(w)}</td>
                        <td>{fmtKg(workoutVolumeKg(w))}</td>
                        <td>{w.finishedAt ? fmtDurationHM(w.finishedAt - w.startedAt) : '—'}</td>
                        {suggestOn && (
                          <td className="td-muscles">
                            {sessionMuscles(w).map((m) => (
                              <MuscleChip
                                key={m}
                                muscle={m}
                                tone="secondary"
                                onClick={openMuscleHistory}
                              />
                            ))}
                          </td>
                        )}
                        <td className="td-history-dots">
                          <Icon name="dots-three" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile: stacked rows (S-13). */}
              <div className="mobile-only">
                {finished.slice(0, 5).map((w) => (
                  <button
                    key={w.id}
                    className="recent-row"
                    onClick={() => shell.openOverlay({ screen: 'past-workout', workoutId: w.id })}
                  >
                    <span className="d">{fmtShortDate(w.startedAt, locale)}</span>
                    <span style={{ flex: 1 }}>
                      <span className="name">{sessionTitle(w)}</span>
                      {w.autoFinished && (
                        <span className="tag tag-neutral" style={{ marginLeft: 6 }}>
                          {t.autoClosed}
                        </span>
                      )}
                      <div className="stats">
                        {workoutSets(w)} {t.sets} · {fmtKg(workoutVolumeKg(w))}
                        {w.finishedAt ? ` · ${fmtDurationHM(w.finishedAt - w.startedAt)}` : ''}
                      </div>
                      {suggestOn && sessionMuscles(w).length > 0 && (
                        <div className="recent-muscles">
                          {sessionMuscles(w).map((m) => (
                            <MuscleChip
                              key={m}
                              muscle={m}
                              tone="secondary"
                              onClick={openMuscleHistory}
                            />
                          ))}
                        </div>
                      )}
                    </span>
                    <Icon name="arrow-up-right" className="go" />
                  </button>
                ))}
              </div>
              {finished.length > 5 && (
                <button
                  className="td-history-all"
                  onClick={() => shell.openOverlay({ screen: 'history' })}
                >
                  {t.seeAllHistory}
                  <Icon name="arrow-up-right" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="td-empty">
            <Icon name="barbell" />
            <div className="td-empty-title">{t.tdEmptyTitle}</div>
            <div className="td-empty-body">{t.tdEmptyBody}</div>
            <div className="td-empty-actions">
              {!open && (
                <button className="btn btn-primary" onClick={startSession}>
                  <Icon name="play" />
                  {t.startFirstSession}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setBackfill(true)}>
                {t.logPastSession}
              </button>
            </div>
            {!open && store.gyms.length === 0 && (
              <button className="gym-hint" onClick={() => shell.goTab('gyms')}>
                <Icon name="map-pin" />
                <span style={{ flex: 1, textAlign: 'left' }}>{t.addGymHint}</span>
                <span style={{ color: 'var(--color-accent)', fontSize: 12 }}>{t.add}</span>
              </button>
            )}
          </div>
        )}

        {store.syncStatus === 'offline' && (
          <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', padding: '0 2px' }}>
            {t.servedFromCache}
          </div>
        )}
      </div>

      <aside className="pane-side">
        {records.length > 0 && (
          <>
            <div className="section-label section-divide">{t.records}</div>
            {records.map(([name, r]) => {
              const recent = now - r.recTs < 14 * DAY_MS;
              return (
                <button
                  key={name}
                  className="record-row"
                  onClick={() => shell.openOverlay({ screen: 'exercise-history', name })}
                >
                  <span className="n">{name}</span>
                  <span className="v">{r.recW} kg</span>
                  {recent && <span className="tag tag-ok">{t.record}</span>}
                </button>
              );
            })}
          </>
        )}
      </aside>

      {startPicker && (
        <GymPicker
          gyms={store.gyms}
          title={t.pickGymTitle}
          onClose={() => setStartPicker(false)}
          onPick={beginSession}
        />
      )}
      {backfill && (
        <BackfillSheet
          gyms={store.gyms}
          onClose={() => setBackfill(false)}
          onCreate={(startedAt, durationMs, gymId) => {
            const w = backfillWorkout(startedAt, durationMs, gymId);
            setBackfill(false);
            shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: true });
          }}
        />
      )}
      {addWeightOpen && (
        <WeightSheet state={{ kind: 'add' }} onClose={() => setAddWeightOpen(false)} />
      )}
      {progSheetOpen && (
        <Sheet onClose={() => setProgSheetOpen(false)} className="prog-suggest-sheet">
          <div className="ps-title">{t.progSuggestSheetTitle}</div>
          <button
            className={`ps-opt${progChoice === 'week' ? ' sel' : ''}`}
            onClick={() => setProgChoice('week')}
          >
            <div className="ps-opt-body">
              <div className="ps-opt-title">{t.progSuggestOptWeek}</div>
              <div className="ps-opt-sub">{t.progSuggestOptWeekBody}</div>
            </div>
            {progChoice === 'week' && <Icon name="check-circle" weight="fill" />}
          </button>
          <button
            className={`ps-opt${progChoice === 'week-lifts' ? ' sel' : ''}`}
            onClick={() => setProgChoice('week-lifts')}
          >
            <div className="ps-opt-body">
              <div className="ps-opt-title">{t.progSuggestOptLifts}</div>
              <div className="ps-opt-sub">{t.progSuggestOptLiftsBody}</div>
            </div>
            {progChoice === 'week-lifts' && <Icon name="check-circle" weight="fill" />}
          </button>
          <div className="ps-acts">
            <button className="btn btn-secondary" onClick={() => setProgSheetOpen(false)}>
              {t.cancel}
            </button>
            <button className="btn btn-primary" onClick={createProgramFromHistory}>
              {t.progSuggestCreate}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Backfill a past session — spec docs/specs/backfill-session.md (AC-1…AC-3). */
function BackfillSheet(props: {
  gyms: Gym[];
  onClose: () => void;
  onCreate: (startedAt: number, durationMs: number, gymId: string | null) => void;
}) {
  const { t } = useT();
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymPicker, setGymPicker] = useState(false);
  const chosenGym = props.gyms.find((g) => g.id === gymId) ?? null;
  const [defaults] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  });
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [now] = useState(() => Date.now());

  const [todayIso] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

  const startedAt = new Date(`${date}T${time}`).getTime();
  const inFuture = !Number.isNaN(startedAt) && startedAt > now;
  const badDuration = duration < 1 || duration > 480;
  const invalid = Number.isNaN(startedAt) || inFuture || badDuration;

  return (
    <Sheet onClose={props.onClose} className="backfill-sheet">
      <div className="sheet-head backfill-head">
        <Icon name="arrow-counter-clockwise" />
        <span className="t">{t.logPastSession}</span>
      </div>
      <div className="backfill-fields">
        <label className="field-block">
          <span className="field-label">{t.backfillDate}</span>
          <DateField value={date} onChange={setDate} max={todayIso} />
        </label>
        <div className="backfill-grid">
          <label className="field-block">
            <span className="field-label">{t.backfillStart}</span>
            <TimeField value={time} onChange={setTime} />
          </label>
          <label className="field-block">
            <span className="field-label">{t.backfillDuration}</span>
            <DurationField value={duration} onChange={setDuration} />
          </label>
        </div>
      </div>
      {props.gyms.length > 0 && (
        <label className="field-block">
          <span className="field-label">{t.backfillGym}</span>
          <button
            type="button"
            className="input gym-select"
            onClick={() => setGymPicker((x) => !x)}
          >
            {chosenGym ? (
              <span className="gym-select-chosen">
                <span className="thumb">
                  <GymThumb
                    name={chosenGym.name}
                    lat={chosenGym.lat}
                    lng={chosenGym.lng}
                    size={28}
                  />
                </span>
                {chosenGym.name}
              </span>
            ) : (
              <span className="gym-select-placeholder">{t.backfillGymChoose}</span>
            )}
            <Icon name={gymPicker ? 'caret-left' : 'arrow-right'} className="go" />
          </button>
          {gymPicker && (
            <GymPicker
              gyms={props.gyms}
              title={t.pickGymTitle}
              variant="inline"
              onClose={() => setGymPicker(false)}
              onPick={(id) => {
                setGymId(id);
                setGymPicker(false);
              }}
            />
          )}
        </label>
      )}
      {inFuture && (
        <div className="field-error">
          <Icon name="warning-circle" />
          {t.backfillFuture}
        </div>
      )}
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={invalid}
          onClick={() => props.onCreate(startedAt, duration * 60000, gymId)}
        >
          {t.backfillContinue}
        </button>
      </div>
    </Sheet>
  );
}

export function SyncChip({ store }: { store: Store }) {
  const { t } = useT();
  const s = store.syncStatus;
  if (s === 'syncing') {
    return (
      <div className="sync-chip">
        <span className="sk-dot" />
        <span>{t.syncing}</span>
      </div>
    );
  }
  if (s === 'offline') {
    return (
      <div className="sync-chip danger">
        <span className="dot" />
        <span>{t.offline}</span>
      </div>
    );
  }
  return (
    <div className={`sync-chip${s === 'synced' ? ' ok' : ''}`}>
      <span
        className="dot"
        style={s !== 'synced' ? { background: 'var(--color-neutral-600)' } : undefined}
      />
      <span>{s === 'synced' ? t.synced : t.syncing}</span>
    </div>
  );
}
