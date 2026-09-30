/** Today — design W-03…W-05 (desktop 3-column) / S-10…S-16 (mobile). */
import { illnessState } from '../illness';
import { illnessKindName } from './health/parts';
import { Skeleton } from '../components/ui/Skeleton';
import {
  dateInWeek,
  useWeekStartDay,
  weekBounds,
  weekOrder,
  weekPos,
  weekStartOf,
} from '../weekStart';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CORE_DEFAULTS,
  coreOpts,
  useTodayLayout,
  type AtlasOpts,
  type CoreId,
  type NudgeKind,
  type ProgramOpts,
  type TodayLayout,
} from '../today/layout';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ListRow } from '../components/ui/GroupedList';
import type { Tone } from '../components/ui/tones';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Notice } from '../components/ui/Notice';
import { ProgressBar } from '../components/ui/ProgressBar';
import { localizedExerciseName } from '../data/exerciseNames';
import { CustomSectionView } from '../today/CustomSectionView';
import { TodayCustomize } from '../today/TodayCustomize';
import { useTw } from '../today/strings';
import type { ShortcutCtx } from '../today/shortcuts';
import '../today/today.css';
import type { Shell } from '../App';
import type { LiveSession } from '../types';
import { computeTrends } from '../trends';
import { computePlaybook, type Play } from '../playbook';
import { getRole } from '../api';
import { buildProgramSeed, programSuggestionReadiness, setProgramSeed } from '../data/programSeed';
import { useFlag } from '../data/flags';
import { HistoryTimeline, buildHistoryDays } from '../components/HistoryTimeline';
import { dayReadoutLabel, type TrainingDay } from '../data/daySuggest';
import {
  programDayHasPlan,
  programDayItems,
  programDayMuscles,
  programDayName,
  programDayType,
  startProgramDaySession,
  useProgramMine,
  type ProgramItem,
} from '../data/programMine';
import type { MuscleGroup } from '../data/exercises';
import {
  activeRestPeriod,
  activeInjury,
  advanceInjury,
  dismissAdvance,
  healInjury,
  backfillWorkout,
  dayKey,
  endRestPeriod,
  latestWeight,
  liveSleep,
  logVisitAsWorkout,
  resolveMuscles,
  workoutDayReadout,
  type useStore,
  backfillHomeSet,
  gymAtCurrentPosition,
} from '../store';
import {
  fmtDayMonth,
  fmtDurationHuman,
  fmtWeekday,
  fmtWeekdayDayMonth,
  fmtWeekdayShort,
  useT,
} from '../i18n';
import { DayHistorySheet } from '../components/DayHistorySheet';
import { BackfillSheet, StartSheet } from '../components/StartSheet';
import { WeightSheet } from '../components/BodyMetrics';
import { AtlasClientsBlock } from '../today/AtlasClientsBlock';
import { hasCachedClients } from '../today/clientRoster';
import {
  activityType,
  activityCategory,
  activityTone,
  activityWeek,
  workoutCalories,
} from '../activities';
import { restingForDay } from '../dayEnergy';
import { buildReadinessNudge } from '../components/Readiness';
import { NudgeStack, type Nudge } from '../components/NudgeStack';
import { SleepForgotBanner, SleepAutoFilledCard } from '../components/SleepAutomation';
import { LESSON_COUNT, ALL_LESSONS, isReady } from '../learn/catalog';
import { ConfirmDialog, Icon, Sheet, useIsDesktop } from '../ui';
import { REHAB_STAGES, stageIndex, inFullRest, nextStage } from '../injury';
import { useGymStep } from '../components/useGymStep';
import { Tag } from '../components/ui/Tag';

type Store = ReturnType<typeof useStore>;

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

/** Program card colour family by the day's mode: brass while pending, green when
 *  trained, blue for rest / vacation, amber for illness, warm red for injury. */
const PROGRAM_MODE_TONE: Record<WeekMode, Tone> = {
  train: 'accent',
  done: 'ok',
  rest: 'rest',
  active: 'active',
  off: 'rest',
  illness: 'illness',
  injury: 'injury',
  none: 'neutral',
};

export function TodayView({ shell, store }: { shell: Shell; store: Store }) {
  const { withGym, gymPicker } = useGymStep();
  const isDesktop = useIsDesktop();
  const { t, locale } = useT();
  const tw = useTw();
  const layout = useTodayLayout();
  const [editing, setEditing] = useState(false);
  /** Desktop right panel host for Customize's "Add to Today" (portal target). */
  const [editSide, setEditSide] = useState<HTMLElement | null>(null);
  const presenceOn = useFlag('gymPresence');
  const suggestOn = true; // muscle readouts are always on (not flagged)
  const [backfill, setBackfill] = useState(false);
  // "Log for <date>" on the History calendar prefills the past-session date.
  const [backfillDate, setBackfillDate] = useState<string | undefined>(undefined);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  // Suggest-a-program banner state (AC · "Suggest Program Banner").
  const [progSheetOpen, setProgSheetOpen] = useState(false);
  const [illDismissed, setIllDismissed] = useState(false);
  const [confirmEndRest, setConfirmEndRest] = useState<string | null>(null);
  const [dayDrawer, setDayDrawer] = useState<number | null>(null);
  const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
  const openMuscleHistory = (muscle: MuscleGroup) =>
    shell.openOverlay({ screen: 'muscle-history', muscle });
  const [progChoice, setProgChoice] = useState<'week' | 'week-lifts'>('week-lifts');
  const [, setProgDismissTick] = useState(0);
  // The assigned program (cached; a draft program stays hidden until it's
  // activated — see data/programMine).
  const { assignment, active: assignedActive } = useProgramMine();

  // A live activity is mutually exclusive with a live workout: while one runs,
  // the other can't be started (design feature 6).
  const open = store.workouts.find((w) => w.finishedAt === null);
  const liveAct = store.activities.find((a) => a.finishedAt === null) ?? null;
  const sleepLive = liveSleep(store.sleeps);
  // Mutual exclusion across all three live modes — a session, an activity and a
  // sleep never overlap. While any one runs, no other can be started: start
  // controls go disabled and a tap resumes the live one via resumeLive().
  const busy = !!open || !!liveAct || !!sleepLive;
  function resumeLive(): boolean {
    if (open) {
      shell.openOverlay({ screen: 'session', workoutId: open.id });
      return true;
    }
    if (liveAct) {
      shell.openOverlay({ screen: 'activity' });
      return true;
    }
    if (sleepLive) {
      shell.openOverlay({ screen: 'sleep' });
      return true;
    }
    return false;
  }

  /** Every "start" on Today opens the Start sheet (one entry point). */
  function startSession() {
    if (resumeLive()) return;
    shell.openStart();
  }

  const now = useNowTick(!!open);
  const todayWeekday = ((new Date(now).getDay() + 6) % 7) + 1;
  const weekStart = useWeekStartDay();
  const weekFirst = weekStartOf(now, weekStart);
  /** Before today in THIS training week (follows the chosen first day). */
  const beforeToday = (day: number) => weekPos(day, weekStart) < weekPos(todayWeekday, weekStart);
  const afterToday = (day: number) => weekPos(day, weekStart) > weekPos(todayWeekday, weekStart);
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  const hasHistory = finished.length > 0;
  const historyDayCount = buildHistoryDays(finished, store.activities, store.sleeps).length;
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
  const activeInj = activeInjury();
  const injToday = dayKey(pbNow);
  const injFullRest = activeInj ? inFullRest(activeInj, injToday) : false;
  const confirmRestPeriod = confirmEndRest
    ? store.restPeriods.find((r) => r.id === confirmEndRest)
    : null;
  const confirmEndIllness = confirmRestPeriod?.mode === 'illness';
  const illSt = illnessState(store.restPeriods, store.workouts, pbNow);
  const illReturn = activeRest || illSt.phase !== 'returning' ? null : illSt;
  const illMental = !!activeRest && activeRest.mode === 'illness' && illSt.phase === 'mental';
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
  // training week (it starts on the day chosen in Profile › Settings) — drives
  // the "done" marks on the program calendar.
  const weekTrainedDays = (() => {
    const [weekFrom, weekEnd] = weekBounds(now, weekStart);
    const set = new Set<number>();
    for (const w of finished) {
      if (w.startedAt >= weekFrom && w.startedAt < weekEnd) {
        set.add(((new Date(w.startedAt).getDay() + 6) % 7) + 1);
      }
    }
    return set;
  })();

  // Rest / illness state per weekday of the current week (day 1..7 → mode), so
  // the program calendar can show a sick or rest day instead of a plain "missed".
  const weekRestMode = (() => {
    const todayK = dayKey(now);
    const m = new Map<number, 'active' | 'off' | 'illness'>();
    for (let day = 1; day <= 7; day++) {
      const dk = dayKey(dateInWeek(weekFirst, day, weekStart));
      const r = store.restPeriods.find(
        (rp) => dk >= rp.startDay && dk <= (rp.open ? todayK : rp.endDay),
      );
      if (r) m.set(day, r.mode);
    }
    return m;
  })();

  // "Likely today" prediction (Today plaque): the usual split + start time for
  // this weekday, from history. Hidden mid-session, without weekday history, or
  // once today's session is already logged.
  const prediction = (() => {
    if (trainedToday) return null;
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

  // Weekly energy out (design feature 6, KCAL): lifting (session wall-clock) +
  // logged activities, split so non-lifting work reads as a peer to strength.
  const weekAgoTs = now - WEEK_MS;
  const liftKcalWeek = finished
    .filter((w) => w.finishedAt !== null && w.startedAt >= weekAgoTs)
    .reduce((s, w) => s + (workoutCalories(w, bodyKg) ?? 0), 0);
  const activityKcalWeek = activityWeek(store.activities, now, bodyKg).totalKcal;
  // Resting / baseline burn across the last 7 days, computed on the fly: each
  // past day uses the body weight in effect that day and the lifestyle inferred
  // from its trailing training window; today is prorated by elapsed time, so the
  // total climbs honestly through the day. No persistence.
  const restKcalWeek = (() => {
    const nowD = new Date(now);
    const todayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const dayStart = todayStart - i * DAY_MS;
      sum += restingForDay(store.bodyMetrics, store.workouts, store.activities, dayStart, now) ?? 0;
    }
    return sum;
  })();
  const energyOut = {
    lift: Math.round(liftKcalWeek),
    activities: Math.round(activityKcalWeek),
    // Passive / basal burn — the whole-day resting baseline. Its own category,
    // kept apart from the active (lifting / cardio) buckets and from the app's
    // "rest day" concept.
    passive: Math.round(restKcalWeek),
    total: Math.round(liftKcalWeek + activityKcalWeek + restKcalWeek),
  };
  /** `gymStep` off (Program block setting): no gym question — the gym you're
   *  standing in, else the gym of your last session. */
  function startProgramDay(day: number, gymStep = coreOpts(layout, 'program').gymStep) {
    if (resumeLive()) return;
    if (!assignment) return;
    const go = (gymId: string | null) => {
      const id = startProgramDaySession(
        assignment,
        day,
        programDayName(assignment, day, t.progDay),
        gymId,
      );
      if (id) shell.openOverlay({ screen: 'session', workoutId: id });
    };
    if (gymStep) {
      void withGym(go);
      return;
    }
    const lastGym =
      [...finished].sort((a, b) => b.startedAt - a.startedAt).find((w) => w.gymId)?.gymId ?? null;
    void gymAtCurrentPosition(store.gyms).then((g) => go(g?.id ?? lastGym));
  }

  if (showSkeleton) {
    return (
      <div className="screen ug-16">
        <div className="ul-flex ul-col ug-10" style={{ paddingTop: 6 }}>
          <Skeleton style={{ width: 120, height: 10 }} />
          <Skeleton style={{ width: 210, height: 26 }} />
        </div>
        <div className="ul-flex ug-6">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton className="uf-1" key={i} style={{ height: 46 }} />
          ))}
        </div>
        <Skeleton className="ur-lg" style={{ height: 62 }} />
        <div className="ul-flex ug-10">
          <Skeleton className="uf-1" style={{ height: 92 }} />
          <Skeleton className="uf-1" style={{ height: 92 }} />
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
    if (getRole() === 'trainer') return null;
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

  // Analysis nudge (Today → Trends): surfaces when Spotter has flagged actual
  // issues (risk/warn insights) — joins the deck, no separate dismiss.
  const analysisNudge = ((): { count: number; level: string; labels: string[] } | null => {
    if (getRole() === 'trainer') return null;
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

  function openTrends() {
    window.location.hash = '#/trends';
  }

  // Every advisory card on Today, collapsed into one deck instead of a wall of
  // banners: readiness, training-check, program plan, weigh-in, gym visit, the
  // "likely today" plaque. Each carries a `priority` (higher = more urgent) that
  // fixes its order in the deck and the expanded overlay.
  const nudges: Nudge[] = [];
  const readinessNudge = buildReadinessNudge(finished, now, t);
  if (readinessNudge) nudges.push(readinessNudge);
  if (energyOut.total > 0) {
    nudges.push({
      id: 'energy',
      tone: 'energy',
      priority: 40,
      icon: 'flame',
      kicker: t.kcalOut,
      title: `~${energyOut.total.toLocaleString(locale)}`,
      body: (() => {
        const fmt = (n: number) => n.toLocaleString(locale);
        const active: string[] = [];
        if (energyOut.lift > 0) active.push(t.energyLifting(fmt(energyOut.lift)));
        if (energyOut.activities > 0) active.push(t.energyCardio(fmt(energyOut.activities)));
        return (
          <span className="nudge-energy">
            {active.length > 0 && <span className="ne-active">{active.join(' · ')}</span>}
            {energyOut.passive > 0 && (
              <span className="ne-passive">{t.energyPassive(fmt(energyOut.passive))}</span>
            )}
          </span>
        );
      })(),
    });
  }
  if (analysisNudge) {
    nudges.push({
      id: 'analysis',
      tone: 'analysis',
      priority: 60,
      icon: 'chart-line-up',
      kicker: t.todayAnalysisKicker,
      title: t.todayAnalysisTitle(analysisNudge.count),
      body:
        analysisNudge.labels.length > 0
          ? t.todayAnalysisBodyList(analysisNudge.labels.join(' · '))
          : t.todayAnalysisBody,
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            openTrends();
            close();
          }}
        >
          {t.todayAnalysisCta}
          <Icon name="arrow-right" weight="bold" />
        </Button>
      ),
    });
  }
  if (suggest) {
    nudges.push({
      id: 'suggest',
      tone: 'suggest',
      priority: 50,
      icon: 'sparkle',
      kicker: t.progSuggestKicker,
      title: suggest.variant === 'drifted' ? t.progSuggestDriftedTitle : t.progSuggestNewTitle,
      body: suggest.variant === 'drifted' ? t.progSuggestDriftedBody : t.progSuggestNewBody,
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            setProgSheetOpen(true);
            close();
          }}
        >
          {suggest.variant === 'drifted' ? t.progSuggestDriftedCta : t.progSuggestNewCta}
          <Icon name="arrow-right" weight="bold" />
        </Button>
      ),
    });
  }

  // When a program is assigned, today's session comes FROM THE PROGRAM (not
  // history). This plaque sits above the program card and is reworded away from
  // "likely" / "from your history".
  const programTodayPlan = (() => {
    if (!assignment || !assignedActive || trainedToday) return null;
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

  // A program rest day: an active plan is assigned but this weekday prescribes
  // no work — and nothing's been logged yet, nor is a rest period already running.
  const programRestDay =
    !activeRest &&
    !!assignment &&
    assignedActive &&
    !trainedToday &&
    (() => {
      const day = todayWeekday;
      const items = assignment.program.items.filter((i) => i.day === day);
      const muscles = assignment.program.targetMuscles?.[String(day)] ?? [];
      return items.length === 0 && muscles.length === 0;
    })();

  // Program plan for today, weigh-in, gym-visit and "likely today" all join the
  // same deck.
  if (programTodayPlan) {
    const p = programTodayPlan;
    nudges.push({
      id: 'plan',
      tone: 'plan',
      priority: 100,
      icon: 'calendar-check',
      kicker: t.todayPlanKicker,
      title: p.dayName,
      body: (
        <>
          {p.labels.length > 0 && <div className="nudge-muscles">{p.labels.join(' · ')}</div>}
          {(p.startMin != null || p.mealMin != null) && (
            <div className="tp-timing">
              {p.startMin != null && (
                <div className="tp-stat">
                  <span className="tp-stat-ico">
                    <Icon name="clock-countdown" weight="bold" />
                  </span>
                  <span className="tp-stat-val">~{hhmm(p.startMin)}</span>
                  <span className="tp-stat-lab">{t.todayPlanStart}</span>
                </div>
              )}
              {p.mealMin != null && (
                <div className="tp-stat">
                  <span className="tp-stat-ico">
                    <Icon name="fork-knife" weight="bold" />
                  </span>
                  <span className="tp-stat-val">~{hhmm(p.mealMin)}</span>
                  <span className="tp-stat-lab">{t.todayPlanEat}</span>
                </div>
              )}
            </div>
          )}
        </>
      ),
    });
  }
  if (weighReminder) {
    nudges.push({
      id: 'weigh',
      tone: 'body',
      priority: 70,
      icon: 'scales',
      kicker: t.weighTitle,
      title: t.weighBody(hhmm(weighReminder.usualMin)),
      body: null,
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            setAddWeightOpen(true);
            close();
          }}
        >
          {t.bmAddWeight}
        </Button>
      ),
    });
  }
  if (reminder) {
    nudges.push({
      id: 'visit',
      tone: 'body',
      priority: 90,
      icon: 'map-pin',
      kicker: reminder.gymName,
      title: t.unloggedVisit(
        fmtDurationHuman(reminder.visitEnd - reminder.visitStart),
        reminder.gymName,
        fmtDayMonth(reminder.visitStart, locale),
      ),
      body: null,
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            const w = logVisitAsWorkout(reminder);
            close();
            shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
          }}
        >
          {t.logIt}
        </Button>
      ),
    });
  }
  if (prediction && !(assignment && assignedActive)) {
    nudges.push({
      id: 'likely',
      tone: 'plan',
      priority: 95,
      icon: 'calendar-check',
      kicker: t.likelyToday,
      title: t.likelyDayTitle(prediction.dayLabel),
      body: (
        <>
          {prediction.muscles.length > 0 && (
            <div className="nudge-muscles">{prediction.muscles.join(' · ')}</div>
          )}
          <div className="tp-timing">
            <div className="tp-stat">
              <span className="tp-stat-ico">
                <Icon name="clock-countdown" weight="bold" />
              </span>
              <span className="tp-stat-val">~{hhmm(prediction.startMin)}</span>
              <span className="tp-stat-lab">{t.todayPlanStart}</span>
            </div>
            <div className="tp-stat">
              <span className="tp-stat-ico">
                <Icon name="fork-knife" weight="bold" />
              </span>
              <span className="tp-stat-val">~{hhmm(prediction.mealMin)}</span>
              <span className="tp-stat-lab">{t.todayPlanEat}</span>
            </div>
          </div>
        </>
      ),
    });
  }
  if (hasHistory && playbook.plays.length > 0) {
    nudges.push({
      id: 'playbook',
      tone: 'suggest',
      priority: 40,
      icon: 'cards',
      kicker: t.playbook,
      title: t.playbookTagline,
      body: (
        <div className="nudge-plays">
          {playbook.plays.slice(0, 3).map((pl) => (
            <span className="td-pb-chip" key={pl.id} data-day={pl.dayType ?? 'other'}>
              <span className="n">{playName(pl)}</span>
              <span className="c">{t.playbookExCount(pl.exercises.length)}</span>
            </span>
          ))}
        </div>
      ),
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            close();
            shell.goPlaybook();
          }}
        >
          {t.playbookOpen}
          <Icon name="arrow-right" weight="bold" />
        </Button>
      ),
    });
  }

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

  // --- Week strip (program card / no-program card) --------------------------
  // One pill per Mon–Sun day, styled like the history milestones: done ✓, missed
  // ✕, rest (lotus), ill (pulse), full rest (plane), injury (band-aid), and a
  // brass ▶ on today when there's something to start. Days after today stay
  // blank (a planned full rest still shows its plane, dimmed). Taps keep their
  // old meaning: today's ▶ starts, past days open the day drawer.
  const todayTrained = weekTrainedDays.has(todayWeekday);
  const dayStartOf = (day: number) => dateInWeek(weekFirst, day, weekStart);
  // Anything logged on a day (session, activity or a night's sleep) makes its
  // pill open the day drawer — today included.
  const dayHasItems = (start: number) => {
    const dk = dayKey(start);
    return (
      finished.some((w) => dayKey(w.startedAt) === dk) ||
      store.activities.some((x) => x.finishedAt !== null && dayKey(x.startedAt) === dk) ||
      store.sleeps.some((n) => n.wake !== null && dayKey(n.wake) === dk)
    );
  };
  const todayHasItems = dayHasItems(dayStartOf(todayWeekday));
  const dayAria = (day: number, extra?: string) =>
    [fmtWeekday(dayStartOf(day), locale), extra].filter(Boolean).join(' · ');
  const injuryRehab = !!activeInj && !injFullRest && activeInj.stage !== 'return';

  const renderProgramCard = (po: ProgramOpts) =>
    assignment &&
    assignedActive &&
    (() => {
      const a = assignment;
      const todayPlan = programDayHasPlan(a, todayWeekday);
      const todayName = programDayName(a, todayWeekday, t.progDay);
      const todayRest = weekRestMode.get(todayWeekday);
      const mode: WeekMode =
        todayRest === 'illness'
          ? 'illness'
          : todayRest === 'off' || injFullRest
            ? 'off'
            : todayTrained
              ? 'done'
              : injuryRehab && todayPlan
                ? 'injury'
                : todayPlan
                  ? 'train'
                  : todayRest === 'active'
                    ? 'active'
                    : 'rest';
      const kicker =
        mode === 'illness'
          ? t.restCardIllnessKicker
          : mode === 'off'
            ? t.histStateVacation
            : mode === 'active'
              ? t.restModeActive
              : mode === 'injury' && activeInj
                ? t.injBannerTitle(
                    activeInj.reason === 'injury'
                      ? (t.injBodyParts[activeInj.bodyPart] ?? activeInj.bodyPart)
                      : t.injReason[activeInj.reason],
                  )
                : mode === 'rest'
                  ? `${t.progRestDay} · ${fmtWeekday(now, locale)}`
                  : `${t.today} · ${todayPlan ? todayName : t.progRestDay}`;
      const headIcon =
        mode === 'illness'
          ? 'pulse'
          : mode === 'off'
            ? 'airplane-tilt'
            : mode === 'injury'
              ? 'bandaids'
              : mode === 'rest' || mode === 'active'
                ? 'flower-lotus'
                : 'list-checks';
      const todayItems = programDayItems(a, todayWeekday);
      const todayMuscles = programDayMuscles(a, todayWeekday);
      const todaySummary =
        todayItems.length === 0 && todayMuscles.length > 0
          ? todayMuscles.includes('fullbody')
            ? t.muscleGroups.fullbody
            : todayMuscles.map((m) => t.muscleGroups[m]).join(' · ')
          : todayItems.length === 1
            ? compactProgramDaySummary(todayItems)
            : t.progDayWorkoutSummary(
                todayItems.length,
                todayItems.reduce((n, it) => n + (it.kind === 'strength' ? it.sets : 1), 0),
              );
      const status =
        mode === 'rest' && programRestDay
          ? t.restDayNote
          : mode === 'train' || mode === 'injury'
            ? `${todayName} — ${todaySummary}`
            : null;

      const cells: WeekCell[] = weekOrder(weekStart).map((day) => {
        const hasPlan = programDayHasPlan(a, day);
        const restMode = weekRestMode.get(day);
        const isToday = day === todayWeekday;
        const isPast = beforeToday(day);
        const done = weekTrainedDays.has(day);
        const missed = hasPlan && !done && isPast && !restMode;
        const canOpenDay =
          (isPast || isToday) && (done || missed || !!restMode || dayHasItems(dayStartOf(day)));
        // Only today is actionable — and only while it hasn't been trained yet
        // (a sick / rest day is not a "start" prompt).
        const canStart = isToday && hasPlan && !trainedToday && !done && !restMode;
        const name = hasPlan ? programDayName(a, day, t.progDay) : t.progRestDay;
        const state: PillState = afterToday(day)
          ? restMode === 'off'
            ? 'off-next'
            : hasPlan
              ? 'next-train'
              : 'next-rest'
          : done
            ? 'done'
            : restMode === 'illness'
              ? 'sick'
              : restMode === 'off'
                ? 'off'
                : restMode === 'active'
                  ? 'rest'
                  : canStart
                    ? injuryRehab
                      ? 'injury'
                      : 'play'
                    : missed
                      ? 'missed'
                      : 'rest';
        return {
          day,
          state,
          isToday,
          label: isToday ? t.today : fmtWeekdayShort(dayStartOf(day), locale),
          aria: dayAria(day, name),
          dayType: hasPlan ? programDayType(a, day) : null,
          // Today with something already logged opens its drawer (which still
          // offers the start); otherwise ▶ starts right away.
          onClick:
            canOpenDay && (!canStart || todayHasItems)
              ? () => setDayDrawer(dayStartOf(day))
              : canStart
                ? () => startProgramDay(day, po.gymStep)
                : undefined,
        };
      });

      // Program block settings: compact drops the meta and status lines;
      // the exercise list shows names (standard) or names + prescription (detailed).
      const compact = po.style === 'compact';
      const detailed = po.style === 'detailed';
      const exName = (it: ProgramItem) => localizedExerciseName(it.name, locale) ?? it.name;
      const exList =
        po.exercises &&
        !compact &&
        (mode === 'train' || mode === 'injury') &&
        todayItems.length > 0 ? (
          detailed ? (
            <ul className="pch-ex is-detailed">
              {todayItems.map((it) => (
                <li key={it.id}>
                  <span className="pch-ex-n">{exName(it)}</span>
                  <span className="pch-ex-v num">{compactProgramDaySummary([it])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="pch-ex">{todayItems.map(exName).join(' · ')}</div>
          )
        ) : null;
      return (
        <Card
          tone={PROGRAM_MODE_TONE[mode]}
          emphasis="hero"
          className="today-program-card td-week"
          data-mode={mode}
          data-style={po.style}
        >
          <div className="program-card-head">
            <Icon name={headIcon} className="pch-icon" />
            <div className="pch-text">
              <div className="pch-kicker">{kicker}</div>
              <div className="n">{a.program.name}</div>
              {!compact && (
                <div className="s">
                  {a.program.weeks !== 0 ? `${t.progWeekN(a.week)} · ` : ''}
                  {t.progSessions(programWeek.done, programWeek.total)}
                  {a.assignedBy ? ` · ${t.progAssignedBy(a.assignedBy)}` : ''}
                </div>
              )}
            </div>
            <div className="pch-progress">
              <span className="pch-pct num">{programWeek.pct}%</span>
              <span className="pch-bar">
                <span className="pch-bar-fill" style={{ width: `${programWeek.pct}%` }} />
              </span>
            </div>
          </div>
          {status && !compact && <div className="pch-status">{status}</div>}
          {detailed && todayMuscles.length > 0 && todayItems.length > 0 && (
            <div className="pch-ex">{todayMuscles.map((m) => t.muscleGroups[m]).join(' · ')}</div>
          )}
          {exList}
          {po.weekPills && <WeekPills cells={cells} />}
        </Card>
      );
    })();

  // What today's ▶ does (also offered from today's drawer): the program day,
  // or the Start sheet without a program. Null once there's nothing to start.
  const todayStart: (() => void) | null =
    assignment && assignedActive
      ? programDayHasPlan(assignment, todayWeekday) &&
        !trainedToday &&
        !weekRestMode.get(todayWeekday)
        ? () => startProgramDay(todayWeekday)
        : null
      : !todayTrained && !weekRestMode.get(todayWeekday)
        ? startSession
        : null;

  // No program: the same strip, neutral and text-free. Days you didn't train
  // read as rest after the fact (no red — nothing was prescribed), today is a
  // ▶ until something's logged.
  const renderWeekCard = (po: ProgramOpts) => {
    if (assignment && assignedActive) return null;
    if (!po.weekPills) return null;
    const cells: WeekCell[] = weekOrder(weekStart).map((day) => {
      const start = dayStartOf(day);
      const dk = dayKey(start);
      const isToday = day === todayWeekday;
      const isPast = beforeToday(day);
      const logged = weekTrainedDays.has(day);
      const rest = logged ? undefined : weekRestMode.get(day);
      const state: PillState = afterToday(day)
        ? rest === 'off'
          ? 'off-next'
          : 'blank'
        : logged
          ? 'done'
          : rest === 'illness'
            ? 'sick'
            : rest === 'off'
              ? 'off'
              : rest === 'active'
                ? 'rest'
                : isToday
                  ? injuryRehab
                    ? 'injury'
                    : 'play'
                  : 'rest';
      const hasDayItems =
        logged ||
        !!rest ||
        store.activities.some((x) => x.finishedAt !== null && dayKey(x.startedAt) === dk) ||
        store.sleeps.some((n) => n.wake !== null && dayKey(n.wake) === dk);
      return {
        day,
        state,
        isToday,
        label: isToday ? t.today : fmtWeekdayShort(start, locale),
        aria: dayAria(day),
        dayType: null,
        onClick:
          (isPast || isToday) && hasDayItems
            ? () => setDayDrawer(start)
            : isToday && !logged && !rest
              ? startSession
              : undefined,
      };
    });
    return (
      <Card emphasis="card" className="today-program-card td-week" data-mode="none">
        <WeekPills cells={cells} />
      </Card>
    );
  };

  const banners = (
    <>
      {store.syncStatus === 'offline' && store.queue.length > 0 && (
        <Notice tone="danger" icon="cloud-slash">
          {t.offlineQueued(store.queue.length)}
        </Notice>
      )}
      {store.syncStatus === 'syncing' && store.queue.length > 0 && (
        <Notice
          tone="neutral"
          icon="arrows-clockwise"
          trail={store.queue.length}
          below={<ProgressBar value={66} height={4} />}
        >
          {t.sendingQueued}
        </Notice>
      )}
    </>
  );

  // Learn-progress banner — nudges the user toward the how-to library, in
  // Learn's rubellite/gem colours. When nothing is completed yet it shows as a
  // full standalone banner ABOVE the nudge stack; once lessons are done it folds
  // into the stack as one more advisory card. Only shown once at least one
  // lesson actually has a recorded video — no point pointing at an empty library.
  const learnHasVideo = ALL_LESSONS.some(isReady);
  const learnProgress = (() => {
    let done = 0;
    try {
      const raw = localStorage.getItem('spotter.learn.completed');
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) done = Math.min(arr.length, LESSON_COUNT);
      }
    } catch {
      /* ignore */
    }
    const total = LESSON_COUNT;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  })();
  const openLearn = () => {
    window.location.hash = '#/learn';
  };
  const learnBanner = (
    <Card as="button" pad="none" emphasis="glass" className="learn-banner" onClick={openLearn}>
      <span className="learn-banner-ic">
        <Icon name="graduation-cap" weight="fill" />
      </span>
      <span className="learn-banner-main">
        <span className="learn-banner-kicker">{t.learnBannerKicker}</span>
        <span className="learn-banner-title">
          {learnProgress.done > 0 ? t.learnBannerTitleGoing : t.learnBannerTitleStart}
        </span>
        <span className="learn-banner-bar">
          <span style={{ width: `${learnProgress.pct}%` }} />
        </span>
        <span className="learn-banner-sub">
          {t.learnBannerProgress(learnProgress.done, learnProgress.total)}
        </span>
      </span>
      <Icon name="caret-right" className="learn-banner-go" />
    </Card>
  );
  // Zero completed → full banner above the stack; otherwise a card in the stack.
  if (learnHasVideo && learnProgress.done > 0) {
    nudges.push({
      id: 'learn',
      tone: 'learn',
      priority: 20,
      icon: 'graduation-cap',
      kicker: t.learnBannerKicker,
      title: t.learnBannerTitleGoing,
      body: (
        <div className="learn-nudge-prog">
          <span className="learn-banner-bar">
            <span style={{ width: `${learnProgress.pct}%` }} />
          </span>
          <span className="learn-banner-sub">
            {t.learnBannerProgress(learnProgress.done, learnProgress.total)}
          </span>
        </div>
      ),
      actions: (close) => (
        <Button
          variant="fill"
          size="sm"
          onClick={() => {
            openLearn();
            close();
          }}
        >
          {t.learnBannerCta}
          <Icon name="arrow-right" weight="bold" />
        </Button>
      ),
    });
  }

  // Atlas & clients block (settings A2, designs A1 / T5): Atlas is always
  // here — alone for members, beside the clients of anyone who coaches.
  const openCoach = () => shell.openOverlay({ screen: 'coach' });
  const openClient = (id: string) => shell.openOverlay({ screen: 'client-page', clientId: id });
  const watchClient = (s: LiveSession) =>
    s.workoutId
      ? shell.openOverlay({
          screen: 'trainee-session',
          athleteId: s.id,
          workoutId: s.workoutId,
          athleteName: s.athleteName,
        })
      : openClient(s.id);
  // The Clients area lives in the People app.
  const allClients = () => {
    window.location.hash = '#/people/clients';
  };
  const renderAtlas = (ao: AtlasOpts): ReactNode => (
    <AtlasClientsBlock
      opts={ao}
      withClients={getRole() !== 'member'}
      onOpenCoach={openCoach}
      onOpenClient={openClient}
      onWatch={watchClient}
      onAllClients={allClients}
    />
  );

  // A trainer's Today is just Atlas and their clients — nothing else, to avoid
  // clutter (the block with its defaults).
  if (getRole() === 'trainer') {
    return (
      <div className="screen paned today-page">
        <div className="pane-main">{renderAtlas(CORE_DEFAULTS.atlas)}</div>
      </div>
    );
  }

  const widgetCtx: ShortcutCtx = {
    store,
    now,
    t,
    tw,
    locale,
    shell,
    openWeight: () => setAddWeightOpen(true),
    startToday: todayStart,
    logPast: () => setBackfill(true),
  };
  const coreFor = (l: TodayLayout): Record<CoreId, ReactNode> => {
    const po = coreOpts(l, 'program');
    const off = coreOpts(l, 'nudges').off;
    const shows = (k: NudgeKind) => !off.includes(k);
    const days = coreOpts(l, 'history').days;
    return {
      status: (
        <>
          {banners}
          {liveAct && (
            <Card
              as="button"
              pad="none"
              tone={
                ({ recovery: 'rest', sport: 'sport' }[
                  activityTone(liveAct.type, activityCategory(liveAct)) as string
                ] as 'rest' | 'sport' | undefined) ?? 'accent'
              }
              className={`td-resume-activity cat-${activityTone(liveAct.type, activityCategory(liveAct))}`}
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
            </Card>
          )}
          {activeInj && injFullRest && activeInj.fullRestUntil != null && (
            <div className="prog-banner analysis-banner gem-rest tr-banner tr-banner--rest fade-in">
              <span className="prog-sheen" aria-hidden />
              <div className="prog-banner-row">
                <span className="prog-banner-icon">
                  <Icon name="moon" weight="fill" />
                </span>
                <div className="prog-banner-main">
                  <span className="prog-banner-kicker">{t.injStage0}</span>
                  <div className="prog-banner-title">
                    {t.injStage0Left(activeInj.fullRestUntil - injToday)}
                  </div>
                  <div className="prog-banner-body">{t.injStage0Note}</div>
                  <div className="tr-pills">
                    <Tag tone="illness" icon={<Icon name="pause" weight="bold" />}>
                      {t.illnessProgramPill}
                    </Tag>
                  </div>
                  <div className="prog-banner-acts">
                    <Button
                      variant="fill"
                      size="sm"
                      onClick={() =>
                        shell.openOverlay({ screen: 'injury', injuryId: activeInj.id })
                      }
                    >
                      <Icon name="list-checks" weight="bold" />
                      {t.injViewPlan}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeInj && !injFullRest && activeInj.stage === 'return' && (
            <div className="prog-banner analysis-banner gem-rest tr-banner tr-banner--ok fade-in utx-center">
              <span className="prog-sheen" aria-hidden />
              <div style={{ padding: '4px 2px' }}>
                <div
                  className="tr-done-ring ur-round ut-ok ut-3xl ul-grid"
                  style={{ width: 52, height: 52, margin: '0 auto', placeItems: 'center' }}
                >
                  <Icon name="confetti" weight="fill" />
                </div>
                <div className="tr-done-title ut-xl ut-w8 umt-12">{t.injDoneTitle}</div>
                <div className="prog-banner-body umt-6">{t.injDoneBody}</div>
                <div className="ul-flex ug-6 uj-center" style={{ margin: '12px 0 4px' }}>
                  {REHAB_STAGES.map((sid) => (
                    <span
                      key={sid}
                      className="tr-done-dot ur-round"
                      style={{ width: 8, height: 8 }}
                    />
                  ))}
                </div>
                <div className="prog-banner-acts uj-center">
                  <Button variant="fill" size="sm" onClick={() => healInjury(activeInj.id)}>
                    <Icon name="check-circle" weight="bold" />
                    {t.injBackToProgram}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {activeInj &&
            !injFullRest &&
            activeInj.stage !== 'return' &&
            activeInj.pendingAdvance && (
              <div className="prog-banner analysis-banner gem-rest tr-banner tr-banner--ok fade-in">
                <span className="prog-sheen" aria-hidden />
                <div className="prog-banner-row">
                  <span className="prog-banner-icon">
                    <Icon name="arrow-fat-up" weight="fill" />
                  </span>
                  <div className="prog-banner-main">
                    <span className="prog-banner-kicker">{t.injReadyKicker}</span>
                    <div className="prog-banner-title">
                      {t.injReadyTitle(t.injStage[nextStage(activeInj.stage)])}
                    </div>
                    <div className="prog-banner-body">{t.injReadyBody}</div>
                    <div className="prog-banner-acts">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissAdvance(activeInj.id)}
                      >
                        {t.injStayLonger}
                      </Button>
                      <Button variant="ok" size="sm" onClick={() => advanceInjury(activeInj.id)}>
                        {t.injMoveUpShort} <Icon name="arrow-right" weight="bold" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          {activeInj &&
            !injFullRest &&
            activeInj.stage !== 'return' &&
            !activeInj.pendingAdvance && (
              <div className="prog-banner analysis-banner gem-rest tr-banner illness rehab fade-in">
                <span className="prog-sheen" aria-hidden />
                <div className="prog-banner-row">
                  <span className="prog-banner-icon">
                    <Icon name="heartbeat" weight="bold" />
                  </span>
                  <div className="prog-banner-main">
                    <span className="prog-banner-kicker">
                      {t.injBannerStage(
                        stageIndex(activeInj.stage) + 1,
                        REHAB_STAGES.length,
                        t.injStage[activeInj.stage],
                      )}
                    </span>
                    <div className="prog-banner-title">
                      {t.injBannerTitle(
                        activeInj.reason === 'injury'
                          ? (t.injBodyParts[activeInj.bodyPart] ?? activeInj.bodyPart)
                          : t.injReason[activeInj.reason],
                      )}
                    </div>
                    <div className="ul-flex ug-6" style={{ margin: '8px 0 2px' }}>
                      {REHAB_STAGES.map((sid, i) => (
                        <span
                          key={sid}
                          className="ur-round"
                          style={{
                            width: 8,
                            height: 8,
                            background:
                              i < stageIndex(activeInj.stage)
                                ? 'var(--color-ok)'
                                : i === stageIndex(activeInj.stage)
                                  ? 'var(--color-danger)'
                                  : 'var(--color-neutral-700)',
                          }}
                        />
                      ))}
                    </div>
                    <div className="prog-banner-body">{t.injBannerBody}</div>
                    <div className="tr-pills">
                      {activeInj.muscles.slice(0, 4).map((m) => (
                        <Tag key={m} tone="illness">
                          {t.muscleGroups[m] ?? m}
                        </Tag>
                      ))}
                    </div>
                    <div className="prog-banner-acts">
                      <Button
                        variant="fill"
                        size="sm"
                        onClick={() =>
                          shell.openOverlay({ screen: 'injury', injuryId: activeInj.id })
                        }
                      >
                        <Icon name="list-checks" weight="bold" />
                        {t.injViewPlan}
                      </Button>
                      {activeInj.stage !== 'protect' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="heartbeat"
                          onClick={() =>
                            shell.openOverlay({
                              screen: 'injury',
                              injuryId: activeInj.id,
                              checkin: true,
                            })
                          }
                        >
                          {t.injBannerCheckin}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          {activeRest && (
            <div
              className={`prog-banner analysis-banner gem-rest tr-banner ${activeRest.mode} fade-in`}
            >
              <span className="prog-sheen" aria-hidden />
              <div className="prog-banner-row">
                <span
                  className={`prog-banner-icon${activeRest.mode === 'illness' ? ' ill-pulse' : ''}`}
                >
                  <Icon
                    name={activeRest.mode === 'illness' ? 'pulse' : 'clock-countdown'}
                    weight="bold"
                  />
                </span>
                <div className="prog-banner-main">
                  {activeRest.mode === 'illness' ? (
                    <>
                      <span className="prog-banner-kicker">
                        {illSt.kind === 'other'
                          ? t.restCardIllnessKicker
                          : `${t.restCardIllnessKicker} · ${illnessKindName(illSt.kind, t)}`}
                      </span>
                      <div className="prog-banner-title">
                        {t.restCardIllnessTitle(dayKey(pbNow) - activeRest.startDay + 1)}
                      </div>
                      <div className="prog-banner-body">
                        {illMental ? t.illMentalNote : t.restCardIllnessNote}
                        {illSt.needsDoctor ? ` ${t.illDoctor}` : ''}
                      </div>
                      <div className="tr-pills">
                        <Tag tone="illness" icon={<Icon name="check-circle" weight="bold" />}>
                          {t.illnessStreakPill}
                        </Tag>
                        <Tag tone="illness" icon={<Icon name="pause" weight="bold" />}>
                          {t.illnessProgramPill}
                        </Tag>
                      </div>
                      <div className="prog-banner-acts">
                        <Button
                          variant="fill"
                          size="sm"
                          onClick={() => setConfirmEndRest(activeRest.id)}
                        >
                          <Icon name="check" weight="bold" />
                          {t.illnessRecovered}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
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
                            <Button variant="fill" size="sm" onClick={startSession} disabled={busy}>
                              <Icon name="play" weight="bold" />
                              {t.restStartLight}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmEndRest(activeRest.id)}
                            >
                              {t.restEndNow}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="fill"
                            size="sm"
                            onClick={() => setConfirmEndRest(activeRest.id)}
                          >
                            {t.restEndNow}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {illReturn && !illDismissed && (
            <div className="prog-banner analysis-banner gem-rest tr-banner illness fade-in">
              <div className="prog-banner-row">
                <span className="prog-banner-icon">
                  <Icon name="hand-waving" weight="bold" />
                </span>
                <div className="prog-banner-main">
                  <span className="prog-banner-kicker">
                    {t.illnessReturnKicker} · {illnessKindName(illReturn.kind, t)}
                  </span>
                  <div className="prog-banner-title">
                    {t.illRetTitle(illReturn.step, illReturn.steps)}
                  </div>
                  <div className="prog-banner-body">
                    {illReturn.caps.rpeMax != null
                      ? t.illRetBody(Math.round(illReturn.caps.volume * 100), illReturn.caps.rpeMax)
                      : t.illRetBodyFree(Math.round(illReturn.caps.volume * 100))}
                  </div>
                  <div className="prog-banner-acts">
                    <Button variant="fill" size="sm" onClick={startSession} disabled={busy}>
                      <Icon name="play" weight="bold" />
                      {t.restStartLight}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIllDismissed(true)}>
                      {t.illnessReturnDismiss}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ),
      atlas: renderAtlas(coreOpts(l, 'atlas')),
      program: (
        <>
          {renderProgramCard(po)} {hasHistory && renderWeekCard(po)}
          {po.logPast &&
            !(assignment && assignedActive && programDayHasPlan(assignment, todayWeekday)) && (
              <Button
                variant="ghost"
                size="sm"
                icon="clock-counter-clockwise"
                className="td-logpast"
                onClick={() => setBackfill(true)}
              >
                {t.logPastSession}
              </Button>
            )}
        </>
      ),
      nudges: (
        <>
          {shows('learn') && learnHasVideo && learnProgress.done === 0 && learnBanner}
          <NudgeStack nudges={nudges.filter((n) => shows(n.id as NudgeKind))} />
          {shows('sleep') && (
            <>
              <SleepForgotBanner
                onOpenBackfill={() => shell.openOverlay({ screen: 'sleep', mode: 'backfill' })}
              />
              <SleepAutoFilledCard
                onOpenBackfill={() => shell.openOverlay({ screen: 'sleep', mode: 'backfill' })}
              />
            </>
          )}
        </>
      ),
      history: (
        <>
          {hasHistory ? (
            <>
              <div className="td-history">
                <SectionLabel className="section-divide">{t.tdHistory}</SectionLabel>
                <>
                  <HistoryTimeline
                    workouts={finished}
                    activities={store.activities}
                    sleeps={store.sleeps}
                    allWorkouts={store.workouts}
                    bodyKg={bodyKg}
                    maxDays={days}
                    onOpenWorkout={(id) =>
                      shell.openOverlay({ screen: 'past-workout', workoutId: id })
                    }
                    onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
                    onOpenSleep={(id) =>
                      shell.openOverlay({ screen: 'sleep', mode: 'edit', nightId: id })
                    }
                    openMuscleHistory={openMuscleHistory}
                    showMuscles={suggestOn}
                  />
                  {historyDayCount > days && (
                    <Button
                      variant="secondary"
                      fullWidth
                      iconTrailing="arrow-up-right"
                      className="td-history-all"
                      onClick={() => shell.openOverlay({ screen: 'history' })}
                    >
                      {t.seeAllHistory}
                    </Button>
                  )}
                </>
              </div>
            </>
          ) : (
            <div className="td-empty">
              <Icon name="barbell" />
              <div className="td-empty-title">{t.tdEmptyTitle}</div>
              <div className="td-empty-body">{t.tdEmptyBody}</div>
              <div className="td-empty-actions">
                <Button variant="primary" icon="play" onClick={startSession} disabled={busy}>
                  {t.startFirstSession}
                </Button>
                <Button variant="secondary" onClick={() => setBackfill(true)}>
                  {t.logPastSession}
                </Button>
              </div>
              {store.gyms.length === 0 && (
                <Card
                  as="button"
                  pad="none"
                  emphasis="quiet"
                  className="gym-hint"
                  onClick={() => shell.goTab('gyms')}
                >
                  <span className="gym-hint-icon">
                    <Icon name="map-pin" />
                  </span>
                  <span className="gym-hint-copy">{t.addGymHint}</span>
                  <span className="gym-hint-action">{t.add}</span>
                </Card>
              )}
            </div>
          )}
        </>
      ),
    };
  };

  const core = coreFor(layout);

  return (
    <div className="screen paned today-page">
      <div className="pane-main">
        <div className="td-topbar">
          <SectionLabel className="td-topbar-date">{fmtWeekdayDayMonth(now, locale)}</SectionLabel>
          <div className="td-topbar-actions">
            <SyncChip store={store} />
          </div>
        </div>

        {/* An admin who is also a trainer sees their clients between the day
            heading and the calendar. */}
        {editing ? (
          <TodayCustomize
            coreFor={coreFor}
            hasClients={getRole() === 'admin' && hasCachedClients()}
            ctx={widgetCtx}
            side={isDesktop ? editSide : null}
            onClose={() => setEditing(false)}
          />
        ) : (
          <>
            {layout.sections.map((s) =>
              s.kind === 'core' ? (
                <Fragment key={s.id}>{core[s.id]}</Fragment>
              ) : (
                <CustomSectionView key={s.id} section={s} ctx={widgetCtx} />
              ),
            )}
            <Button
              variant="ghost"
              fullWidth
              icon="sliders-horizontal"
              className="td-customize"
              onClick={() => setEditing(true)}
            >
              {t.todayCustomize}
            </Button>
          </>
        )}
        {dayDrawer != null && (
          <DayHistorySheet
            day={dayDrawer}
            onStart={
              dayDrawer === dayStartOf(todayWeekday) && todayStart
                ? () => {
                    setDayDrawer(null);
                    todayStart();
                  }
                : undefined
            }
            onClose={() => setDayDrawer(null)}
            onOpenWorkout={(id) => shell.openOverlay({ screen: 'past-workout', workoutId: id })}
            onOpenActivity={(id) => shell.openOverlay({ screen: 'activity', editId: id })}
            onOpenSleep={(id) => shell.openOverlay({ screen: 'sleep', mode: 'edit', nightId: id })}
          />
        )}
        {store.syncStatus === 'offline' && (
          <div className="ut-xs ut-faint" style={{ padding: '0 2px' }}>
            {t.servedFromCache}
          </div>
        )}
      </div>

      {/* Desktop: Start stands open on the right instead of the "+" sheet;
          while customizing, "Add to Today" takes its place (design D2). */}
      {isDesktop && (
        <aside className="pane-side today-start-side">
          {editing ? (
            <div ref={setEditSide} className="tdc-side-host" />
          ) : (
            <StartSheet shell={shell} onClose={() => undefined} inline />
          )}
        </aside>
      )}

      {backfill && (
        <BackfillSheet
          gyms={store.gyms}
          initialDate={backfillDate}
          onClose={() => {
            setBackfill(false);
            setBackfillDate(undefined);
          }}
          onCreate={(startedAt, durationMs, gymId) => {
            const w = backfillWorkout(startedAt, durationMs, gymId);
            setBackfill(false);
            setBackfillDate(undefined);
            shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: true });
          }}
          onCreateHome={(startedAt, durationMs, set) => {
            const w = backfillHomeSet(startedAt, durationMs, set);
            setBackfill(false);
            setBackfillDate(undefined);
            shell.openOverlay({ screen: 'past-workout', workoutId: w.id, startAdd: !set });
          }}
        />
      )}
      {addWeightOpen && (
        <WeightSheet state={{ kind: 'add' }} onClose={() => setAddWeightOpen(false)} />
      )}
      {confirmEndRest && (
        <ConfirmDialog
          title={confirmEndIllness ? t.illnessRecoveredTitle : t.restEndTitle}
          body={confirmEndIllness ? t.illnessRecoveredBody : t.restEndBody}
          confirmLabel={confirmEndIllness ? t.illnessRecoveredConfirm : t.restEndNow}
          cancelLabel={t.cancel}
          danger={!confirmEndIllness}
          tone={confirmEndIllness ? 'ok' : undefined}
          icon={confirmEndIllness ? 'check-circle' : undefined}
          onConfirm={() => {
            endRestPeriod(confirmEndRest);
            setConfirmEndRest(null);
          }}
          onCancel={() => setConfirmEndRest(null)}
        />
      )}
      {progSheetOpen && (
        <Sheet onClose={() => setProgSheetOpen(false)} className="prog-suggest-sheet">
          <div className="ps-title">{t.progSuggestSheetTitle}</div>
          <ListRow
            label={t.progSuggestOptWeek}
            sub={t.progSuggestOptWeekBody}
            selected={progChoice === 'week'}
            check={progChoice === 'week'}
            onClick={() => setProgChoice('week')}
          />
          <ListRow
            label={t.progSuggestOptLifts}
            sub={t.progSuggestOptLiftsBody}
            selected={progChoice === 'week-lifts'}
            check={progChoice === 'week-lifts'}
            onClick={() => setProgChoice('week-lifts')}
          />
          <div className="ps-acts">
            <Button variant="secondary" onClick={() => setProgSheetOpen(false)}>
              {t.cancel}
            </Button>
            <Button variant="primary" onClick={createProgramFromHistory}>
              {t.progSuggestCreate}
            </Button>
          </div>
        </Sheet>
      )}
      {gymPicker}
    </div>
  );
}

type WeekMode = 'train' | 'rest' | 'active' | 'done' | 'illness' | 'off' | 'injury' | 'none';
type PillState =
  | 'done'
  | 'missed'
  | 'rest'
  | 'sick'
  | 'off'
  | 'off-next'
  | 'next-train'
  | 'next-rest'
  | 'injury'
  | 'play'
  | 'blank';
interface WeekCell {
  day: number;
  state: PillState;
  isToday: boolean;
  label: string;
  aria: string;
  dayType: TrainingDay | null;
  onClick?: () => void;
}

const PILL_ICON: Partial<Record<PillState, string>> = {
  done: 'check',
  missed: 'x',
  rest: 'flower-lotus',
  sick: 'pulse',
  off: 'airplane-tilt',
  'off-next': 'airplane-tilt',
  'next-train': 'barbell',
  'next-rest': 'flower-lotus',
  injury: 'bandaids',
  play: 'play',
};

/** Mon–Sun status pills with weekday labels (today reads "Today"). */
function WeekPills({ cells }: { cells: WeekCell[] }) {
  return (
    <div className="wk-pills">
      {cells.map((c) => {
        const icon = PILL_ICON[c.state];
        const cls = `wk-pill st-${c.state}${c.isToday ? ' is-today' : ''}`;
        const inner = (
          <>
            <span className="wk-pill-bar" data-day={c.dayType ?? undefined}>
              {icon && <Icon name={icon} weight={c.state === 'play' ? 'fill' : 'bold'} />}
            </span>
            <span className="wk-pill-label">{c.label}</span>
          </>
        );
        return c.onClick ? (
          <Card
            as="button"
            pad="none"
            emphasis="quiet"
            key={c.day}
            className={cls}
            onClick={c.onClick}
            aria-label={c.aria}
          >
            {inner}
          </Card>
        ) : (
          <div key={c.day} className={cls} aria-label={c.aria}>
            {inner}
          </div>
        );
      })}
    </div>
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
