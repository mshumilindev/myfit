/** Today — design W-03…W-05 (desktop 3-column) / S-10…S-16 (mobile). */
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { Shell } from '../App';
import { db } from '../firebase';
import { computeTrends } from '../trends';
import { computePlaybook, type Play } from '../playbook';
import type { ExerciseKind, Gym, Workout } from '../types';
import { callFn, getRole } from '../api';
import { buildProgramSeed, programSuggestionReadiness, setProgramSeed } from '../data/programSeed';
import { useFlag } from '../data/flags';
import { MuscleChip, withMuscleBreak } from '../components/Muscle';
import { dayReadoutLabel } from '../data/daySuggest';
import type { MuscleGroup } from '../data/exercises';
import {
  activeRestPeriod,
  addExercise,
  backfillWorkout,
  consistencyStreak,
  dayKey,
  dismissReminder,
  dismissWeighInToday,
  endRestPeriod,
  startRestPeriod,
  latestWeight,
  deleteActivity,
  logVisitAsWorkout,
  muscleWorkSorted,
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
import { ActivitySheet } from '../components/ActivitySheet';
import {
  activityType,
  activityCalories,
  activityCategory,
  activityWeek,
  liftingCalories,
  durationMin as activityDurationMin,
} from '../activities';
import type { Activity } from '../types';
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
const ANALYSIS_DISMISS_KEY = 'spotter.analysisNudge.dismissedAt';
const ANALYSIS_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;
// Cache the assigned program so Today paints instantly and only revalidates in
// the background (no full cold fetch on every visit).
const PROGRAM_CACHE_KEY = 'spotter.programMine';
function readProgramCache(): ProgramAssignment | null {
  try {
    const raw = localStorage.getItem(PROGRAM_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ProgramAssignment) : null;
  } catch {
    return null;
  }
}
function writeProgramCache(a: ProgramAssignment | null): void {
  try {
    if (a) localStorage.setItem(PROGRAM_CACHE_KEY, JSON.stringify(a));
    else localStorage.removeItem(PROGRAM_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Recent logged activities (design feature 6, KCAL feed): cardio & recovery
 *  as secondary rows to strength, each with its calorie estimate. */
function RecentActivityList({
  activities,
  bodyKg,
  t,
  locale,
}: {
  activities: Activity[];
  bodyKg: number | null;
  t: ReturnType<typeof useT>['t'];
  locale: ReturnType<typeof useT>['locale'];
}) {
  const recent = [...activities].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <div className="td-activity-list">
      <div className="section-label" style={{ marginBottom: 8 }}>
        {t.recentActivity}
      </div>
      {recent.map((a) => {
        const type = activityType(a.type);
        const cat = activityCategory(a);
        const kcal = activityCalories(a, bodyKg);
        const min = Math.round(activityDurationMin(a));
        return (
          <div key={a.id} className={`ta-row cat-${cat}`}>
            <Icon name={type?.icon ?? 'heartbeat'} />
            <span className="ta-main">
              <span className="ta-name">{t.actType[a.type] ?? a.type}</span>
              <span className="ta-sub">
                {fmtShortDate(a.startedAt, locale)} · {min} {t.minShort}
                {a.distanceKm ? ` · ${a.distanceKm} ${t.kmShort}` : ''} ·{' '}
                {cat === 'recovery' ? t.actRecovery : t.actConditioning}
              </span>
            </span>
            {kcal != null && (
              <span className="ta-kcal tnum">
                <Icon name="flame" weight="fill" />~{kcal}
              </span>
            )}
            <button
              className="ta-del"
              onClick={() => deleteActivity(a.id)}
              aria-label={t.delete}
              title={t.delete}
            >
              <Icon name="trash" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function TodayView({ shell, store }: { shell: Shell; store: Store }) {
  const { t, locale } = useT();
  const presenceOn = useFlag('gymPresence');
  const suggestOn = true; // muscle readouts are always on (not flagged)
  const sessionMuscles = (w: Workout) => muscleWorkSorted(w);
  const [startPicker, setStartPicker] = useState(false);
  const [backfill, setBackfill] = useState(false);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  // Suggest-a-program banner state (AC · "Suggest Program Banner").
  const [progSheetOpen, setProgSheetOpen] = useState(false);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const openMuscleHistory = (muscle: MuscleGroup) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });
  const [progChoice, setProgChoice] = useState<'week' | 'week-lifts'>('week-lifts');
  const [, setProgDismissTick] = useState(0);
  const [assignment, setAssignment] = useState<ProgramAssignment | null>(() => readProgramCache());
  // A draft program can be assigned, but shouldn't surface on Today until it's
  // activated. When we can read the program doc (author/self) we honour its
  // status; when we can't (member of a trainer's plan) we default to showing.
  const [assignedActive, setAssignedActive] = useState(true);

  /** Session heading: the program day name if it has one, else the weekday. */
  // Program sessions keep their own day name; logged sessions are named by the
  // muscle groups trained ("Back + Shoulders", "Legs", "Chest"), weekday only
  // as a last resort (Ex suggestions).
  const sessionTitle = (w: Workout) => {
    if (w.dayName) return w.dayName;
    const r = workoutDayReadout(w);
    return r ? dayReadoutLabel(r, t) : fmtWeekday(w.startedAt, locale);
  };

  // A live activity is mutually exclusive with a live workout: while one runs,
  // the other can't be started (design feature 6).
  const open = store.workouts.find((w) => w.finishedAt === null);
  const liveAct = store.activities.find((a) => a.finishedAt === null) ?? null;

  function beginSession(gymId: string | null) {
    if (liveAct) {
      shell.openOverlay({ screen: 'activity' });
      return;
    }
    setStartPicker(false);
    const w = startWorkout(gymId);
    shell.openOverlay({ screen: 'session', workoutId: w.id });
  }
  function startSession() {
    if (liveAct) {
      shell.openOverlay({ screen: 'activity' });
      return;
    }
    if (store.gyms.length > 0) setStartPicker(true);
    else beginSession(null);
  }
  function openActivitySheet() {
    if (open) {
      shell.openOverlay({ screen: 'session', workoutId: open.id });
      return;
    }
    if (liveAct) {
      shell.openOverlay({ screen: 'activity' });
      return;
    }
    setActivityOpen(true);
  }

  const now = useNowTick(!!open);
  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;

  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const hasHistory = finished.length > 0;
  const [pbNow] = useState(() => Date.now());
  const playbook = useMemo(
    () =>
      computePlaybook(
        store.workouts.filter((w) => w.finishedAt !== null),
        pbNow,
      ),
    [store.workouts, pbNow],
  );
  const activeRest = activeRestPeriod(pbNow);
  const playName = (pl: Play) =>
    pl.name ?? (pl.readout ? dayReadoutLabel(pl.readout, t) : t.playUntitled);
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

  // Which weekdays (1=Mon…7=Sun) already have a logged session in the CURRENT
  // Mon–Sun week — drives the "done" marks on the program calendar.
  const weekTrainedDays = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const weekStart = d.getTime();
    const weekEnd = weekStart + 7 * DAY_MS;
    const set = new Set<number>();
    for (const w of finished) {
      if (w.startedAt >= weekStart && w.startedAt < weekEnd) {
        set.add(((new Date(w.startedAt).getDay() + 6) % 7) + 1);
      }
    }
    return set;
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

  // Weekly energy out (design feature 6, KCAL): lifting (session wall-clock) +
  // conditioning activities, split so cardio reads as a peer to strength.
  const weekAgoTs = now - WEEK_MS;
  const liftKcalWeek = finished
    .filter((w) => w.finishedAt !== null && w.startedAt >= weekAgoTs)
    .reduce((s, w) => s + (liftingCalories((w.finishedAt! - w.startedAt) / 60000, bodyKg) ?? 0), 0);
  const cardioKcalWeek = activityWeek(store.activities, now, bodyKg).conditioningKcal;
  const energyOut = {
    lift: Math.round(liftKcalWeek),
    cardio: Math.round(cardioKcalWeek),
    total: Math.round(liftKcalWeek + cardioKcalWeek),
  };
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

  const streakDays = consistencyStreak(pbNow);

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
      .then((data) => {
        setAssignment(data.assignment);
        writeProgramCache(data.assignment);
      })
      .catch(() => {
        /* keep whatever was cached — don't blank the card on a transient error */
      });
  }, []);

  useEffect(() => {
    if (!assignment) {
      setAssignedActive(true);
      return;
    }
    let alive = true;
    getDoc(doc(db, 'programs', assignment.program.id))
      .then((snap) => {
        if (!alive) return;
        const status = snap.exists() ? (snap.data() as { status?: string }).status : undefined;
        // Unknown/unreadable → keep showing; only a readable non-active hides it.
        setAssignedActive(status === undefined ? true : status === 'active');
      })
      .catch(() => alive && setAssignedActive(true));
    return () => {
      alive = false;
    };
  }, [assignment]);

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

  // Analysis nudge (Today → Trends): surfaces when Spotter has flagged actual
  // issues (warn-tone insights). Dismissible with a short cooldown.
  const analysisNudge = ((): { count: number; level: string; labels: string[] } | null => {
    if (getRole() === 'trainer' || open) return null;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(ANALYSIS_DISMISS_KEY) || 0);
    } catch {
      /* ignore */
    }
    if (dismissedAt && now - dismissedAt < ANALYSIS_COOLDOWN_MS) return null;
    const res = computeTrends(finished, store.bodyMetrics, now);
    // A "quick win" is something to FIX — risks and warnings. FYI stats and
    // on-track wins are not counted.
    const actionable = res.insights.filter((i) => i.level === 'risk' || i.level === 'warn');
    if (!res.ready || actionable.length === 0) return null;
    // Name the actual top cards so the banner mirrors what Trends shows.
    const labels = actionable
      .slice(0, 3)
      .map((i) => i.headline || i.kicker || '')
      .filter(Boolean);
    return { count: actionable.length, level: actionable[0].level, labels };
  })();

  function dismissAnalysis() {
    try {
      localStorage.setItem(ANALYSIS_DISMISS_KEY, String(now));
    } catch {
      /* ignore */
    }
    setProgDismissTick((n) => n + 1);
  }

  function openTrends() {
    window.location.hash = '#/trends';
  }

  const analysisBanner = analysisNudge != null && (
    <div className={`prog-banner analysis-banner lvl-${analysisNudge.level} fade-in`}>
      <span className="prog-sheen" aria-hidden />
      <div className="prog-banner-row">
        <span className="prog-banner-icon">
          <Icon name="chart-line-up" weight="bold" />
        </span>
        <div className="prog-banner-main">
          <span className="prog-banner-kicker">{t.todayAnalysisKicker}</span>
          <div className="prog-banner-title">{t.todayAnalysisTitle(analysisNudge.count)}</div>
          <div className="prog-banner-body">
            {analysisNudge.labels.length > 0
              ? t.todayAnalysisBodyList(analysisNudge.labels.join(' · '))
              : t.todayAnalysisBody}
          </div>
          <div className="prog-banner-acts">
            <button className="prog-banner-cta" onClick={openTrends}>
              <Icon name="arrow-right" weight="bold" />
              {t.todayAnalysisCta}
            </button>
            <button className="prog-banner-skip" onClick={dismissAnalysis}>
              {t.todayAnalysisDismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // When a program is assigned, today's session comes FROM THE PROGRAM (not
  // history). This plaque sits above the program card and is reworded away from
  // "likely" / "from your history".
  const programTodayPlan = (() => {
    if (open || !assignment || !assignedActive || trainedToday) return null;
    const day = todayWeekday;
    const items = assignment.program.items.filter((i) => i.day === day);
    const muscles = assignment.program.targetMuscles?.[String(day)] ?? [];
    if (items.length === 0 && muscles.length === 0) return null;
    const dayName = assignment.program.dayNames?.[day] || t.progDay(day);
    const labels = muscles.length > 0 ? muscles.map((m) => t.muscleGroups[m]) : [];
    // Usual start time + meal hint for this weekday, still learned from history.
    const dow = new Date(now).getDay();
    const sameDow = finished.filter((w) => new Date(w.startedAt).getDay() === dow);
    let startMin: number | null = null;
    let mealMin: number | null = null;
    if (sameDow.length > 0) {
      const mins = sameDow
        .map((w) => {
          const d = new Date(w.startedAt);
          return d.getHours() * 60 + d.getMinutes();
        })
        .sort((a, b) => a - b);
      startMin = mins[Math.floor(mins.length / 2)];
      mealMin = startMin - 105;
    }
    return { dayName, labels, startMin, mealMin };
  })();

  const programTodayBanner = programTodayPlan && (
    <div className="prog-banner today-plan-banner">
      <div className="prog-banner-row">
        <span className="prog-banner-icon">
          <Icon name="calendar-check" weight="bold" />
        </span>
        <div className="prog-banner-main">
          <span className="prog-banner-kicker">{t.todayPlanKicker}</span>
          {/* Day name + muscles duplicate the heading/cards on web, so they stay
              mobile-only (shown on web only when there's no timing to show). */}
          <div className={`tp-identity${programTodayPlan.startMin != null ? ' mobile-only' : ''}`}>
            <div className="tp-day">{programTodayPlan.dayName}</div>
            {programTodayPlan.labels.length > 0 && (
              <div className="tp-muscles">{programTodayPlan.labels.join(' · ')}</div>
            )}
          </div>
          {(programTodayPlan.startMin != null || programTodayPlan.mealMin != null) && (
            <div className="tp-timing">
              {programTodayPlan.startMin != null && (
                <div className="tp-stat">
                  <span className="tp-stat-ico">
                    <Icon name="clock-countdown" weight="bold" />
                  </span>
                  <span className="tp-stat-val">~{hhmm(programTodayPlan.startMin)}</span>
                  <span className="tp-stat-lab">{t.todayPlanStart}</span>
                </div>
              )}
              {programTodayPlan.mealMin != null && (
                <div className="tp-stat">
                  <span className="tp-stat-ico">
                    <Icon name="fork-knife" weight="bold" />
                  </span>
                  <span className="tp-stat-val">~{hhmm(programTodayPlan.mealMin)}</span>
                  <span className="tp-stat-lab">{t.todayPlanEat}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Weekly progress from actual history (matches the calendar's done marks) —
  // the server's post-assignment count reads 0 right after activation.
  const programWeek = (() => {
    if (!assignment) return { done: 0, total: 0, pct: 0 };
    const days = Array.from({ length: 7 }, (_, i) => i + 1).filter((day) => {
      const items = assignment.program.items.filter((it) => it.day === day);
      const muscles = assignment.program.targetMuscles?.[String(day)] ?? [];
      return items.length > 0 || muscles.length > 0;
    });
    const done = days.filter((d) => weekTrainedDays.has(d)).length;
    return {
      done,
      total: days.length,
      pct: days.length ? Math.round((done / days.length) * 100) : 0,
    };
  })();

  const programCard = !open && assignment && assignedActive && (
    <section className="today-program-card">
      <div className="program-card-head">
        <Icon name="copy" />
        <div className="pch-text">
          <div className="field-label">{t.progTitle}</div>
          <div className="n">{assignment.program.name}</div>
          <div className="s">
            {assignment.program.weeks !== 0 ? `${t.progWeekN(assignment.week)} · ` : ''}
            {t.progSessions(programWeek.done, programWeek.total)}
            {assignment.assignedBy ? ` · ${t.progAssignedBy(assignment.assignedBy)}` : ''}
          </div>
        </div>
        <div
          className={`pch-progress lvl-${
            programWeek.pct >= 100
              ? 'done'
              : programWeek.pct >= 60
                ? 'ok'
                : programWeek.pct > 0
                  ? 'warn'
                  : 'none'
          }`}
        >
          <div className="pch-top">
            <span className="pch-pct num">{programWeek.pct}%</span>
            <span className="pch-count num">
              {programWeek.done}/{programWeek.total}
            </span>
          </div>
          <div className="pch-bar">
            <span className="pch-bar-fill" style={{ width: `${programWeek.pct}%` }} />
          </div>
        </div>
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
          const isToday = day === todayWeekday;
          const done = weekTrainedDays.has(day);
          const missed = hasPlan && !done && day < todayWeekday;
          // Only today is actionable — and only while it hasn't been trained yet.
          const canStart = isToday && hasPlan && !trainedToday && !done;
          const state = !hasPlan
            ? 'rest'
            : done
              ? 'done'
              : isToday
                ? 'today'
                : missed
                  ? 'missed'
                  : 'upcoming';
          return (
            <button
              key={day}
              className={`program-start-day${hasPlan ? ' planned' : ''}${
                isToday ? ' is-today' : ''
              }${done ? ' is-done' : ''}${missed ? ' is-missed' : ''}${
                canStart ? ' can-start' : ''
              } state-${state}`}
              disabled={!canStart}
              aria-disabled={!canStart}
              onClick={() => canStart && startProgramDay(day)}
            >
              <span className="program-start-top">
                <span className="program-start-dow">{t.weekDayLetters[day - 1]}</span>
                <span className="program-start-mark">
                  {done ? (
                    <Icon name="check-circle" weight="fill" />
                  ) : canStart ? (
                    <Icon name="play" />
                  ) : missed ? (
                    <Icon name="warning-circle" weight="fill" />
                  ) : hasPlan ? (
                    <span className="program-start-dot" aria-hidden />
                  ) : (
                    <span className="program-start-plus">+</span>
                  )}
                </span>
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
              <span className="program-start-bar" aria-hidden />
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

  // With an assigned program, the page title becomes today's day name (or Rest).
  const todayHeading = (() => {
    if (assignment && assignedActive) {
      const day = todayWeekday;
      const items = assignment.program.items.filter((i) => i.day === day);
      const muscles = assignment.program.targetMuscles?.[String(day)] ?? [];
      if (items.length > 0 || muscles.length > 0) {
        return assignment.program.dayNames?.[day] || t.progDay(day);
      }
      return t.progRestDay;
    }
    return t.today;
  })();

  return (
    <div
      className={`screen paned${open ? ' today-live-mode' : ''}${
        !open && !liveAct && hasHistory ? ' today-has-pill' : ''
      }`}
    >
      <div className="pane-main">
        {open && <h2 className="visually-hidden">{t.today}</h2>}
        {!open &&
          (hasHistory ? (
            <div className="td-topbar">
              <div>
                <div className="kicker">{fmtWeekdayDayMonth(now, locale)}</div>
                <h2>{todayHeading}</h2>
              </div>
              <div className="td-topbar-actions">
                <SyncChip store={store} />
                <div className="td-header-ctas">
                  {!activeRest && (
                    <button className="btn btn-secondary" onClick={() => setRestSheetOpen(true)}>
                      <Icon name="clock-countdown" />
                      {t.restStartCta}
                    </button>
                  )}
                  {!liveAct && (
                    <button className="btn btn-secondary" onClick={openActivitySheet}>
                      <Icon name="heartbeat" />
                      {t.logActivity}
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setBackfill(true)}>
                    <Icon name="arrow-counter-clockwise" />
                    {t.logPastSession}
                  </button>
                  {!liveAct && (
                    <button className="btn btn-primary" onClick={startSession}>
                      <Icon name="play" />
                      {t.startSessionLabel}
                    </button>
                  )}
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
        {!open && liveAct && (
          <button
            className={`td-resume-activity cat-${activityCategory(liveAct)}`}
            onClick={() => shell.openOverlay({ screen: 'activity' })}
          >
            <span className="tra-icon">
              <Icon name={activityType(liveAct.type)?.icon ?? 'heartbeat'} weight="fill" />
            </span>
            <span className="tra-main">
              <span className="tra-kicker">{t.actInProgress}</span>
              <span className="tra-name">{t.actType[liveAct.type] ?? liveAct.type}</span>
            </span>
            <span className="tra-cta">
              {t.actResume}
              <Icon name="arrow-right" />
            </span>
          </button>
        )}
        {!open && activeRest && (
          <div
            className={`prog-banner analysis-banner gem-rest tr-banner ${activeRest.mode} fade-in`}
          >
            <span className="prog-sheen" aria-hidden />
            <div className="prog-banner-row">
              <span className="prog-banner-icon">
                <Icon name="clock-countdown" weight="bold" />
              </span>
              <div className="prog-banner-main">
                <div className="tr-top">
                  <span className="prog-banner-kicker">
                    {activeRest.mode === 'active' ? t.restModeActive : t.restModeOff}
                  </span>
                  <span className="tr-day">
                    {t.restDayOf(
                      Math.min(
                        dayKey(pbNow) - activeRest.startDay + 1,
                        activeRest.endDay - activeRest.startDay + 1,
                      ),
                      activeRest.endDay - activeRest.startDay + 1,
                    )}
                  </span>
                </div>
                <div className="prog-banner-title">
                  {activeRest.mode === 'active' ? t.restCardActiveTitle : t.restCardOffTitle}
                </div>
                <div className="tr-bar">
                  <span
                    className="tr-fill"
                    style={{
                      width: `${Math.round((Math.min(dayKey(pbNow) - activeRest.startDay + 1, activeRest.endDay - activeRest.startDay + 1) / (activeRest.endDay - activeRest.startDay + 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="prog-banner-body">
                  {activeRest.mode === 'active' ? t.restCardActiveNote : t.restCardOffNote}
                </div>
                <div className="prog-banner-acts">
                  {activeRest.mode === 'active' ? (
                    <>
                      <button className="prog-banner-cta" onClick={startSession}>
                        <Icon name="play" weight="bold" />
                        {t.restStartLight}
                      </button>
                      <button
                        className="prog-banner-skip"
                        onClick={() => endRestPeriod(activeRest.id)}
                      >
                        {t.restEndNow}
                      </button>
                    </>
                  ) : (
                    <button
                      className="prog-banner-cta"
                      onClick={() => endRestPeriod(activeRest.id)}
                    >
                      {t.restEndNow}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {analysisBanner}
        {suggestBanner}
        {programTodayBanner}
        {programCard}
        {!open && !(assignment && assignedActive) && hasHistory && (
          <div className="today-weekstrip-card">
            <WeekStrip />
          </div>
        )}

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

        {prediction && !(assignment && assignedActive) && (
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

        {!open && !liveAct && hasHistory && (
          <div className="td-pill-wrap">
            <svg className="glass-defs" aria-hidden width="0" height="0">
              <filter
                id="liquid-glass"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
                colorInterpolationFilters="sRGB"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.011 0.011"
                  numOctaves="2"
                  seed="7"
                  result="noise"
                />
                <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="soft"
                  scale="52"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </svg>
            <div className="td-pill">
              {!activeRest && (
                <button
                  className="tp-btn"
                  onClick={() => setRestSheetOpen(true)}
                  aria-label={t.restStartCta}
                  title={t.restStartCta}
                >
                  <Icon name="clock-countdown" />
                </button>
              )}
              <button
                className="tp-btn"
                onClick={openActivitySheet}
                aria-label={t.logActivity}
                title={t.logActivity}
              >
                <Icon name="heartbeat" />
              </button>
              <button
                className="tp-btn"
                onClick={() => setBackfill(true)}
                aria-label={t.logPastSession}
                title={t.logPastSession}
              >
                <Icon name="arrow-counter-clockwise" />
              </button>
              <button className="tp-start" onClick={startSession}>
                <Icon name="play" weight="fill" />
                <span>{t.startSessionLabel}</span>
              </button>
            </div>
          </div>
        )}

        {!open && hasHistory && playbook.plays.length > 0 && (
          <button className="td-playbook" onClick={() => shell.goPlaybook()}>
            <span className="td-pb-glow" aria-hidden />
            <span className="td-pb-head">
              <span className="td-pb-kicker">
                <Icon name="cards" />
                {t.playbook}
              </span>
              <span className="td-pb-tag">{t.playbookTagline}</span>
            </span>
            <span className="td-pb-plays">
              {playbook.plays.slice(0, 3).map((pl) => (
                <span className="td-pb-chip" key={pl.id} data-day={pl.dayType ?? 'other'}>
                  <span className="n">{playName(pl)}</span>
                  <span className="c">{t.playbookExCount(pl.exercises.length)}</span>
                </span>
              ))}
            </span>
            <span className="td-pb-go">
              {t.playbookOpen}
              <Icon name="arrow-right" />
            </span>
          </button>
        )}

        {!open && hasHistory && playbook.plays.length === 0 && (
          <button className="td-templates-link" onClick={() => shell.goPlaybook()}>
            <Icon name="cards" />
            <span className="tl-body">
              <span className="tl-title">{t.playbook}</span>
              <span className="tl-sub">{t.playbookTagline}</span>
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
                            {withMuscleBreak(sessionMuscles(w), (x) => (
                              <MuscleChip
                                key={x.muscle}
                                muscle={x.muscle}
                                tone={x.primary ? 'primary' : 'secondary'}
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
                          {withMuscleBreak(sessionMuscles(w), (x) => (
                            <MuscleChip
                              key={x.muscle}
                              muscle={x.muscle}
                              tone={x.primary ? 'primary' : 'secondary'}
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
              <RecentActivityList
                activities={store.activities}
                bodyKg={bodyKg}
                t={t}
                locale={locale}
              />
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

            {energyOut.total > 0 && (
              <div className="td-energy">
                <span className="te-icon">
                  <Icon name="flame" weight="fill" />
                </span>
                <div className="te-body">
                  <div className="te-top">
                    <span className="te-val tnum">~{energyOut.total.toLocaleString(locale)}</span>
                    <span className="te-unit">{t.kcalOut}</span>
                  </div>
                  <div className="te-split">
                    {t.energyLifting(energyOut.lift)} · {t.energyCardio(energyOut.cardio)}
                  </div>
                </div>
              </div>
            )}

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
                            {withMuscleBreak(sessionMuscles(w), (x) => (
                              <MuscleChip
                                key={x.muscle}
                                muscle={x.muscle}
                                tone={x.primary ? 'primary' : 'secondary'}
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
                          {withMuscleBreak(sessionMuscles(w), (x) => (
                            <MuscleChip
                              key={x.muscle}
                              muscle={x.muscle}
                              tone={x.primary ? 'primary' : 'secondary'}
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
              <RecentActivityList
                activities={store.activities}
                bodyKg={bodyKg}
                t={t}
                locale={locale}
              />
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
                <span className="gym-hint-icon">
                  <Icon name="map-pin" />
                </span>
                <span className="gym-hint-copy">{t.addGymHint}</span>
                <span className="gym-hint-action">{t.add}</span>
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
      {activityOpen && <ActivitySheet shell={shell} onClose={() => setActivityOpen(false)} />}
      {restSheetOpen && <RestSheet onClose={() => setRestSheetOpen(false)} />}
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
function RestSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<'active' | 'off'>('active');
  const iso = (d: Date) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const today = new Date();
  const [from, setFrom] = useState(iso(today));
  const [to, setTo] = useState(iso(new Date(today.getTime() + 6 * 86400000)));
  const dk = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d).getTime());
  };
  const days = Math.max(1, dk(to) - dk(from) + 1);
  const start = () => {
    startRestPeriod({ mode, startDay: dk(from), endDay: dk(to) });
    onClose();
  };
  return (
    <Sheet onClose={onClose} className="rest-sheet">
      <div className="ps-title">{t.restStartTitle}</div>
      <div className="rest-modes">
        {(['active', 'off'] as const).map((m) => (
          <button
            key={m}
            className={`rest-mode${mode === m ? ' active' : ''}`}
            onClick={() => setMode(m)}
          >
            <span className="rm-name">{m === 'active' ? t.restModeActive : t.restModeOff}</span>
            <span className="rm-desc">
              {m === 'active' ? t.restModeActiveDesc : t.restModeOffDesc}
            </span>
          </button>
        ))}
      </div>
      <div className="rest-dates">
        <label className="rest-date">
          <span>{t.restFrom}</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="rest-date">
          <span>{t.restTo}</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="rest-len">{t.restLength(days)}</div>
      <div className="rest-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          {t.cancel}
        </button>
        <button className="btn btn-primary" onClick={start}>
          {t.restStartAction}
        </button>
      </div>
    </Sheet>
  );
}

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
