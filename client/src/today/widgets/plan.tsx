/**
 * Plan & sessions widgets (design L5-Plan-Sessions): what to train next and how
 * the last sessions went — next workout, a quick session builder, warm-up,
 * program progress, the week, usual time, rest timer and session read-outs.
 * All numbers come from the app's own history, program cache and builders.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetDots,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { IconTile } from '../../components/ui/IconTile';
import { Segmented } from '../../components/ui/Segmented';
import type { Tone } from '../../components/ui/tones';
import { MuscleHeatmap } from '../../components/Muscle';
import { fmtDayMonth, fmtSet, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import { richExerciseByName, type MuscleGroup } from '../../data/exercises';
import { localizedExerciseName } from '../../data/exerciseNames';
import {
  programDayHasPlan,
  programDayItems,
  programDayMuscles,
  programDayName,
  readProgramCache,
  startPlaySession,
  startProgramDaySession,
  type ProgramAssignment,
} from '../../data/programMine';
import { dayReadoutLabel } from '../../data/daySuggest';
import {
  dayKey,
  equipmentFor,
  exerciseRestSec,
  historicalWorkingKg,
  isStrengthExercise,
  latestWeight,
  loadTypeFor,
  muscleWorkSorted,
  pickSessionGym,
  prescribedTrainingDays,
  programDayNameFor,
  programDayNameForWeekday,
  recordE1rm,
  restDayKeys,
  setBestE1rm,
  setTypeOf,
  startGeneratedDay,
  startHomeSet,
  topSet,
  workoutDayReadout,
  workoutSets,
  workoutVolumeKg,
} from '../../store';
import type { Exercise, SetEntry, Workout } from '../../types';
import { computePlaybook, playForWeekday, type Play, type PlaybookResult } from '../../playbook';
import { buildDay, warmupRamp, type GeneratedDay } from '../../sessionBuilder';
import { loadCaps, protectedMuscles } from '../../injury';
import { workoutCalories } from '../../activities';
import { defaultRestSec, fmtCountdown, restAlert } from '../../restTimer';
import { homeSetMoves, homeTotals, lastRunOf } from '../../homeSets';
import { dateInWeek, weekOrder, weekStartDay, weekStartOf } from '../../weekStart';
import type { WidgetCtx, WidgetDef } from '../registry';
import { ps } from './plan.strings';
import { DAY, hm, pct, signed } from './format';

/** XL heatmap width: two figures ≈ 1 : 2.8 each, so ~165 px keeps them ≈ 220 px
 *  tall and the XL tile square (a % width made it grow 110–160 px taller). */
const HEATMAP_XL_W = 'min(88%, 165px)';

/* ---------------------------------------------------------------- helpers */

const MIN = 60000;

function readLocal<T>(id: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`spotter.tw.${id}`);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(id: string, v: unknown): void {
  try {
    localStorage.setItem(`spotter.tw.${id}`, JSON.stringify(v));
  } catch {
    /* private mode — keeps working for this visit */
  }
}

const exName = (name: string, locale: LocaleId) => localizedExerciseName(name, locale) ?? name;
const muscleName = (t: Strings, m: MuscleGroup | string) => t.muscleGroups[m] ?? String(m);
const isoWd = (ts: number) => ((new Date(ts).getDay() + 6) % 7) + 1;

function finishedOf(ctx: WidgetCtx): Workout[] {
  return ctx.store.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}

function sessionLabel(w: Workout, all: Workout[], t: Strings): string {
  const named = programDayNameFor(w, all);
  if (named) return named;
  const r = workoutDayReadout(w);
  return r ? dayReadoutLabel(r, t) : (w.dayName ?? t.playUntitled);
}

function playLabel(p: Play, t: Strings): string {
  return p.name ?? (p.readout ? dayReadoutLabel(p.readout, t) : t.playUntitled);
}

/** Session minutes (auto-finished sessions end at their last logged set). */
function durMin(w: Workout): number {
  let end = w.finishedAt ?? w.startedAt;
  if (w.autoFinished) {
    let last = w.startedAt;
    for (const e of w.exercises)
      for (const s of e.sets) if (s.loggedAt) last = Math.max(last, s.loggedAt);
    end = last;
  }
  return Math.max(0, Math.min(240, Math.round((end - w.startedAt) / MIN)));
}

/** "today" / "tomorrow" / "Fri" / "Fri 24 Sep". */
function whenLabel(ts: number, now: number, locale: LocaleId, long = false): string {
  const s = ps(locale);
  const d = dayKey(ts) - dayKey(now);
  if (d === 0) return s.today;
  if (d === 1) return s.tomorrow;
  if (d === -1) return s.yesterday;
  return long
    ? `${fmtWeekdayShort(ts, locale)} ${fmtDayMonth(ts, locale)}`
    : fmtWeekdayShort(ts, locale);
}

/** Wrapping body text (the kit's sub line is single-line). */
function Para({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'uiw-name' : 'uiw-sub'} style={{ whiteSpace: 'normal' }}>
      {children}
    </div>
  );
}

/** A label / value line (L/XL footers). */
function Line({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%' }}>
      <span className="uiw-sub">{left}</span>
      {right != null && <span className="uiw-sub">{right}</span>}
    </div>
  );
}

/** Open the live session if there is one; true when it did. */
function resumeOpen(ctx: WidgetCtx): boolean {
  const open = ctx.store.workouts.find((w) => w.finishedAt === null);
  if (!open) return false;
  ctx.shell.openOverlay({ screen: 'session', workoutId: open.id });
  return true;
}

/* ------------------------------------------------------- playbook (cached) */

let PB_CACHE: { src: Workout[]; day: number; res: PlaybookResult } | null = null;
function playbookOf(ctx: WidgetCtx): PlaybookResult {
  const day = dayKey(ctx.now);
  if (PB_CACHE && PB_CACHE.src === ctx.store.workouts && PB_CACHE.day === day) return PB_CACHE.res;
  const res = computePlaybook(finishedOf(ctx), ctx.now);
  PB_CACHE = { src: ctx.store.workouts, day, res };
  return res;
}

/* ------------------------------------------------------------ next session */

interface PlanItem {
  name: string;
  kind: string;
  sets: number;
  reps: number;
  lastKg: number | null;
}

interface NextPlan {
  name: string;
  /** Local midnight of the day it's for. */
  when: number;
  items: PlanItem[];
  muscles: MuscleGroup[];
  minutes: number;
  source: 'program' | 'play';
  programName?: string;
  dayNo?: number;
  dayCount?: number;
  lastDone: number | null;
  start: () => void;
}

function estMinutes(items: PlanItem[]): number {
  if (items.length === 0) return 45;
  const m = items.reduce((a, i) => a + (i.kind === 'strength' ? i.sets * 2.5 : 10), 5);
  return Math.max(15, Math.round(m / 5) * 5);
}

function lastKg(name: string): number | null {
  const kg = historicalWorkingKg(name);
  return kg > 0 ? kg : null;
}

function programItems(a: ProgramAssignment, day: number): PlanItem[] {
  return programDayItems(a, day).map((i) => ({
    name: i.name,
    kind: i.kind,
    sets: i.kind === 'strength' ? i.sets : 1,
    reps: i.reps,
    lastKg: i.kind === 'strength' ? lastKg(i.name) : null,
  }));
}

/** The planned session for a program weekday / play (null = rest / none). */
function planForDate(ctx: WidgetCtx, date: number): { name: string; minutes: number } | null {
  const a = readProgramCache();
  const wd = isoWd(date);
  if (a) {
    if (!programDayHasPlan(a, wd)) return null;
    return {
      name: programDayName(a, wd, ctx.t.progDay),
      minutes: estMinutes(programItems(a, wd)),
    };
  }
  const play = playForWeekday(playbookOf(ctx).plays, new Date(date).getDay(), 2);
  if (!play) return null;
  return {
    name: playLabel(play, ctx.t),
    minutes: estMinutes(
      play.exercises.map((e) => ({ ...e, reps: e.repHigh, lastKg: e.topWeight })),
    ),
  };
}

function playItems(p: Play): PlanItem[] {
  return p.exercises.map((e) => ({
    name: e.name,
    kind: e.kind,
    sets: e.sets,
    reps: e.repHigh || e.repLow,
    lastKg: e.topWeight,
  }));
}

/** Items of a program day; a muscle-only day borrows the matching playbook
 *  play (same weekday, else the play covering most of the day's muscles). */
function resolvedProgramItems(ctx: WidgetCtx, a: ProgramAssignment, wd: number, date: number) {
  const items = programItems(a, wd);
  if (items.length > 0) return items;
  const pb = playbookOf(ctx);
  if (!pb.ready || pb.plays.length === 0) return items;
  const muscles = new Set<string>(programDayMuscles(a, wd));
  const overlap = (p: Play) => p.coverage.filter((c) => c.primary && muscles.has(c.muscle)).length;
  const byDay = playForWeekday(pb.plays, new Date(date).getDay(), 2);
  const best =
    byDay && (muscles.size === 0 || overlap(byDay) > 0)
      ? byDay
      : [...pb.plays].sort((x, y) => overlap(y) - overlap(x))[0];
  return best && (muscles.size === 0 || overlap(best) > 0) ? playItems(best) : items;
}

function nextPlan(ctx: WidgetCtx): NextPlan | null {
  const { now, t, shell } = ctx;
  const finished = finishedOf(ctx);
  const today = dayKey(now);
  const trainedToday = finished.some((w) => dayKey(w.startedAt) === today);
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const a = readProgramCache();
  const gymId = () => pickSessionGym()?.id ?? null;
  if (a) {
    const planDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => programDayHasPlan(a, d));
    for (let off = trainedToday ? 1 : 0; off < 8; off++) {
      const date = new Date(midnight).setDate(new Date(midnight).getDate() + off);
      const wd = isoWd(date);
      if (!planDays.includes(wd)) continue;
      const name = programDayName(a, wd, t.progDay);
      const items = resolvedProgramItems(ctx, a, wd, date);
      return {
        name,
        when: date,
        items,
        muscles: programDayMuscles(a, wd),
        minutes: estMinutes(items),
        source: 'program',
        programName: a.program.name,
        dayNo: planDays.indexOf(wd) + 1,
        dayCount: planDays.length,
        lastDone: finished.find((w) => w.dayName === name)?.startedAt ?? null,
        start: () => {
          if (resumeOpen(ctx)) return;
          const id = startProgramDaySession(a, wd, name, gymId());
          if (id) shell.openOverlay({ screen: 'session', workoutId: id });
          else shell.openStart();
        },
      };
    }
    return null;
  }
  const pb = playbookOf(ctx);
  if (!pb.ready || pb.plays.length === 0) return null;
  let play: Play | null = null;
  let when = midnight;
  for (let off = trainedToday ? 1 : 0; off < 7 && !play; off++) {
    const date = new Date(midnight).setDate(new Date(midnight).getDate() + off);
    play = playForWeekday(pb.plays, new Date(date).getDay(), 2);
    when = date;
  }
  if (!play) {
    // No weekday habit: rotate to the play trained longest ago.
    play = [...pb.plays].sort((x, y) => x.lastTrainedAt - y.lastTrainedAt)[0];
    when = trainedToday ? midnight + DAY : midnight;
  }
  const p = play;
  const items = playItems(p);
  return {
    name: playLabel(p, t),
    when,
    items,
    muscles: p.coverage.filter((c) => c.primary).map((c) => c.muscle),
    minutes: estMinutes(items),
    source: 'play',
    lastDone: p.lastTrainedAt,
    start: () => {
      if (resumeOpen(ctx)) return;
      const id = startPlaySession(p, t.defaultTimedExerciseNames.warmup, gymId());
      if (id) shell.openOverlay({ screen: 'session', workoutId: id });
      else shell.openStart();
    },
  };
}

function presc(i: PlanItem, locale: LocaleId): string {
  const s = ps(locale);
  if (i.kind !== 'strength') return s.minN(10);
  const base = `${i.sets}×${i.reps || '—'}`;
  return i.lastKg ? `${base} · ${s.lastKg(i.lastKg)}` : base;
}

/* ------------------------------------------------------------ next workout */

const nextWorkout: WidgetDef = {
  id: 'next-workout',
  group: 'plan',
  icon: 'play',
  tone: 'accent',
  name: () => ps(getLocale()).names.next,
  render: (size, ctx) => {
    const { now, locale, shell } = ctx;
    const s = ps(locale);
    const np = nextPlan(ctx);
    if (!np)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="play"
          kicker={s.nextUp}
          title={s.noPlan}
          sub={s.noPlanSub}
          action={s.buildOne}
          onAction={() => shell.openOverlay({ screen: 'builder' })}
        />
      );
    const when = whenLabel(np.when, now, locale);
    const nEx = np.items.length;
    const exLine =
      nEx > 0 ? s.exercisesN(nEx) : np.muscles.map((m) => muscleName(ctx.t, m)).join(', ');
    const dayLine = np.dayNo ? s.dayOf(np.dayNo, np.dayCount ?? np.dayNo) : null;
    const gym = pickSessionGym();
    const startBtn = (full = false) => (
      <Button variant="primary" size="sm" icon="play" fullWidth={full} onClick={np.start}>
        {s.start}
      </Button>
    );
    const openSrc = () => (np.source === 'program' ? shell.goTab('programs') : shell.openStart());
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="play"
          title={`${np.name} · ${when}`}
          sub={[np.programName, exLine, `~${np.minutes} min`].filter(Boolean).join(' · ')}
          onClick={openSrc}
          trailing={
            <Button
              variant="primary"
              size="sm"
              icon="play"
              aria-label={s.start}
              onClick={np.start}
            />
          }
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.nextUp}
          title={np.name}
          sub={`${[dayLine, exLine].filter(Boolean).join(' · ')}`}
          onClick={openSrc}
          footer={<span className="uiw-sub">{`~${np.minutes} min · ${when}`}</span>}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={np.programName ? s.nextOf(np.programName) : s.names.next}
          badge={dayLine ?? when}
          title={np.name}
          bodyLast
          onClick={openSrc}
          footer={
            <>
              <span className="uiw-sub" style={{ flex: 1 }}>
                {[`~${np.minutes} min`, gym?.name ?? when].join(' · ')}
              </span>
              {startBtn()}
            </>
          }
        >
          <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
            {np.items.slice(0, 3).map((i) => (
              <Chip key={i.name} size="sm">
                {exName(i.name, locale)}
              </Chip>
            ))}
            {nEx > 3 && <Chip size="sm">{`+${nEx - 3}`}</Chip>}
          </div>
        </Widget>
      );
    const a = readProgramCache();
    const totalSets = np.items.reduce((x, i) => x + (i.kind === 'strength' ? i.sets : 0), 0);
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={a ? s.nextWeek(a.week) : s.names.next}
        badge={dayLine ?? when}
        title={np.name}
        sub={[exLine, totalSets > 0 ? s.setsN(totalSets) : null, `~${np.minutes} min`, gym?.name]
          .filter(Boolean)
          .join(' · ')}
        bodyLast
        onClick={openSrc}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {np.lastDone ? s.lastDone(whenLabel(np.lastDone, now, locale, true)) : when}
            </span>
            {startBtn()}
          </>
        }
      >
        {nEx > 0 ? (
          <WidgetList
            rows={np.items.slice(0, 6).map((i) => ({
              label: exName(i.name, locale),
              value: presc(i, locale),
            }))}
          />
        ) : np.muscles.length > 0 ? (
          <WidgetList
            rows={np.muscles.slice(0, 6).map((m) => ({
              icon: 'target',
              label: muscleName(ctx.t, m),
            }))}
          />
        ) : (
          <Para>{exLine}</Para>
        )}
      </Widget>
    );
  },
};

/* -------------------------------------------------- quick session builder */

type Focus = 'auto' | 'upper' | 'push' | 'pull' | 'legs' | 'full';
const FOCI: Focus[] = ['auto', 'upper', 'push', 'pull', 'legs', 'full'];
const FOCUS_MUSCLES: Record<Focus, MuscleGroup[] | undefined> = {
  auto: undefined,
  upper: ['chest', 'lats', 'shoulders', 'biceps', 'triceps'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['lats', 'traps', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  full: ['chest', 'lats', 'quads', 'hamstrings', 'shoulders'],
};
const LENGTHS = [30, 45, 60];

function generate(ctx: WidgetCtx, len: number, focus: Focus, avoid: string[]): GeneratedDay {
  const { store, now } = ctx;
  return buildDay({
    finished: store.workouts.filter((w) => w.finishedAt !== null),
    activities: store.activities,
    body: store.bodyMetrics,
    goals: store.goals,
    gym: pickSessionGym(),
    now,
    intent: 'muscle',
    targetMuscles: FOCUS_MUSCLES[focus],
    protectedMuscles: [...protectedMuscles(store.injuries)],
    loadCaps: loadCaps(store.injuries),
    lengthMin: len,
    warmup: true,
    cooldown: false,
    cardio: false,
    bodyKg: latestWeight(store.bodyMetrics)?.weight ?? null,
    sex: store.bodyMetrics.sex,
    avoid,
  });
}

function QuickBuilder({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { locale, shell } = ctx;
  const s = ps(locale);
  const [prefs, setPrefs] = useState(() =>
    readLocal<{ len: number; focus: Focus }>('quick-session-builder', { len: 45, focus: 'auto' }),
  );
  const [avoid, setAvoid] = useState<string[]>([]);
  const set = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    setAvoid([]);
    writeLocal('quick-session-builder', next);
  };
  const preview = useMemo(
    () => (size === 'XL' ? generate(ctx, prefs.len, prefs.focus, avoid) : null),
    // The preview follows the history, the chosen length/focus and "regenerate".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, prefs, avoid, ctx.store.workouts, ctx.store.injuries],
  );
  const gym = pickSessionGym();
  const focusLabel = s.focus[prefs.focus];
  const build = (day?: GeneratedDay | null) => {
    if (resumeOpen(ctx)) return;
    const d = day ?? generate(ctx, prefs.len, prefs.focus, avoid);
    const w = startGeneratedDay(d, gym?.id ?? null);
    if (w) shell.openOverlay({ screen: 'session', workoutId: w.id });
    else shell.openStart();
  };
  const open = () => shell.openOverlay({ screen: 'builder' });
  const line = [s.minN(prefs.len), focusLabel, gym?.name].filter(Boolean).join(' · ');
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="sparkle"
        title={s.buildMe}
        sub={line}
        onClick={open}
        trailing={
          <Button variant="primary" size="sm" onClick={() => build()}>
            {s.build}
          </Button>
        }
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={s.quick}
        value={prefs.len}
        unit="min"
        sub={[focusLabel, gym?.name].filter(Boolean).join(' · ')}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={() => build()}>
            {s.build}
          </Button>
        }
      />
    );
  const lenSeg = (
    <Segmented
      variant="buttons"
      size="sm"
      tone="accent"
      label={s.lengthL}
      options={LENGTHS.map((v) => ({ value: v, label: s.minN(v) }))}
      value={prefs.len}
      onChange={(v) => set({ len: v })}
    />
  );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={s.buildMe}
        badge={s.aboutEx(prefs.len <= 30 ? 4 : prefs.len <= 45 ? 5 : 6)}
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {[focusLabel, gym?.name].filter(Boolean).join(' · ')}
            </span>
            <Button variant="primary" size="sm" onClick={() => build()}>
              {s.generate}
            </Button>
          </>
        }
      >
        {lenSeg}
      </Widget>
    );
  const main = preview?.main ?? [];
  return (
    <Widget
      size="XL"
      tone="accent"
      kicker={s.buildMe}
      badge={gym?.name}
      onClick={open}
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon="arrows-clockwise"
            onClick={() => setAvoid(avoid.length ? [] : main.slice(1).map((m) => m.name))}
          >
            {s.regenerate}
          </Button>
          <div style={{ flex: 1, display: 'flex' }}>
            <Button
              variant="primary"
              size="sm"
              icon="play"
              fullWidth
              onClick={() => build(preview)}
            >
              {s.startMin(preview?.estMinutes ?? prefs.len)}
            </Button>
          </div>
        </>
      }
    >
      {lenSeg}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FOCI.map((f) => (
          <Chip key={f} size="sm" selected={f === prefs.focus} onClick={() => set({ focus: f })}>
            {s.focus[f]}
          </Chip>
        ))}
      </div>
      <WidgetList
        rows={main.slice(0, 4).map((m) => ({
          label: exName(m.name, locale),
          value: `${m.sets}×${m.repHigh === m.repLow ? m.repHigh : `${m.repLow}–${m.repHigh}`}`,
        }))}
      />
    </Widget>
  );
}

const quickBuilder: WidgetDef = {
  id: 'quick-session-builder',
  group: 'plan',
  icon: 'sparkle',
  tone: 'accent',
  name: () => ps(getLocale()).names.builder,
  render: (size, ctx) => <QuickBuilder size={size} ctx={ctx} />,
};

/* ----------------------------------------------------------------- warm-up */

const LOWER = new Set<string>([
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'lower_back',
  'adductors',
]);

/** The heaviest working lift of the last finished session (warm-up fallback). */
function lastTopLift(ctx: WidgetCtx): PlanItem | undefined {
  const last = finishedOf(ctx).find((w) => w.exercises.some(isStrengthExercise));
  if (!last) return undefined;
  let best: { e: Exercise; kg: number } | null = null;
  for (const e of last.exercises) {
    if (!isStrengthExercise(e)) continue;
    const kg = topSet(e.sets)?.weight ?? 0;
    if (!best || kg > best.kg) best = { e, kg };
  }
  if (!best) return undefined;
  const work = best.e.sets.filter((x) => setTypeOf(x) !== 'warmup');
  return {
    name: best.e.name,
    kind: 'strength',
    sets: Math.max(1, work.length),
    reps: topSet(best.e.sets)?.reps ?? 0,
    lastKg: best.kg > 0 ? best.kg : null,
  };
}

const warmup: WidgetDef = {
  id: 'warm-up',
  group: 'plan',
  icon: 'fire',
  tone: 'accent',
  name: () => ps(getLocale()).names.warmup,
  render: (size, ctx) => {
    const { t, locale, shell } = ctx;
    const s = ps(locale);
    const np = nextPlan(ctx);
    const first = np?.items.find((i) => i.kind === 'strength') ?? lastTopLift(ctx);
    const rich = first ? richExerciseByName(first.name) : null;
    const lower = rich ? LOWER.has(rich.primaryMuscles[0] ?? '') : false;
    const mobility = lower ? s.mobLower : s.mobUpper;
    const working = first ? (lastKg(first.name) ?? first.lastKg) : null;
    const ramp = first
      ? warmupRamp(working, {
          loadType: loadTypeFor({
            name: first.name,
            equipment: equipmentFor({ name: first.name }),
          }),
          compound: rich?.mechanic !== 'isolation',
        })
      : [];
    const minutes = Math.round(ramp.length * 1.5 + 5);
    const open = () => (np ? np.start() : shell.openStart());
    if (!first)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="fire"
          kicker={s.names.warmup}
          title={s.mobilityMin(5)}
          sub={mobility.slice(0, 3).join(' · ')}
          onAction={() => shell.openStart()}
        />
      );
    const liftName = exName(first.name, locale);
    const kg = working ? `${working} kg` : t.bodyweightShort;
    const rampLine = ramp.length > 0 ? s.rampTo(ramp.length, kg) : s.noRamp;
    const rungLabel = (w: number | null) => (w === 20 ? s.bar : w != null ? String(w) : '—');
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="fire"
          title={s.warmupFor(liftName)}
          sub={`${rampLine} · ${s.mobilityMin(5)}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.names.warmup}
          badge={`~${minutes} min`}
          title={rampLine}
          sub={`${liftName} · ${s.plusMobility}`}
          onClick={open}
        >
          <WidgetBars
            values={[...ramp.map((r) => r.weight ?? 0), working ?? 0]}
            highlight={[ramp.length]}
            height={30}
            tone="accent"
          />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.warmupFor(liftName)}
          badge={s.work(kg)}
          onClick={open}
          footer={<span className="uiw-sub">{`+ ${mobility.slice(0, 3).join(' · ')}`}</span>}
        >
          <WidgetStats
            items={[
              ...ramp.map((r) => ({ label: rungLabel(r.weight), value: `×${r.reps}` })),
              { label: working ? String(working) : kg, value: `${first.sets}×${first.reps}` },
            ]}
          />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.warmupFor(np?.name ?? liftName)}
        badge={`~${minutes} min`}
        title={`${liftName} → ${kg}`}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.startSession}
          </Button>
        }
      >
        <WidgetList
          rows={[
            ...ramp.map((r) => ({
              label: r.weight === 20 ? `${s.bar} 20 kg` : `${r.weight} kg`,
              value: `×${r.reps}`,
            })),
            { label: s.working(kg), value: `${first.sets}×${first.reps}` },
          ]}
        />
        <span className="uiw-kicker">{s.mobilityMin(5)}</span>
        <WidgetList
          rows={mobility.slice(0, ramp.length > 2 ? 3 : 4).map((m) => {
            const cut = m.lastIndexOf(' ');
            return cut > 0 ? { label: m.slice(0, cut), value: m.slice(cut + 1) } : { label: m };
          })}
        />
      </Widget>
    );
  },
};

/* -------------------------------------------------------- program progress */

const programProgress: WidgetDef = {
  id: 'program-progress',
  group: 'plan',
  icon: 'flag-checkered',
  tone: 'accent',
  name: () => ps(getLocale()).names.program,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = ps(locale);
    const a = readProgramCache();
    const open = () => shell.goTab('programs');
    if (!a)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="flag-checkered"
          kicker={s.names.program}
          title={s.noProgram}
          sub={s.noProgramSub}
          action={s.openPrograms}
          onAction={open}
        />
      );
    const name = a.program.name;
    const weeks = a.program.weeks;
    const openEnded = weeks === 0;
    const week = a.week;
    const startedAt =
      (a as ProgramAssignment & { startedAt?: number }).startedAt ??
      weekStartOf(now) - (week - 1) * 7 * DAY;
    const finished = finishedOf(ctx);
    const nWeeks = openEnded ? week : weeks;
    const perWeek = Array.from(
      { length: nWeeks },
      (_, i) =>
        finished.filter(
          (w) =>
            w.startedAt >= startedAt + i * 7 * DAY && w.startedAt < startedAt + (i + 1) * 7 * DAY,
        ).length,
    );
    // Missed = prescribed weekdays since the start (up to yesterday) with no
    // session and no rest period.
    const days = prescribedTrainingDays();
    const rest = restDayKeys(store.restPeriods, now);
    const trainedDays = new Set(finished.map((w) => dayKey(w.startedAt)));
    let missed = 0;
    let lastMissed: number | null = null;
    for (let k = dayKey(startedAt); k < dayKey(now); k++) {
      const ts = new Date(startedAt).setHours(12, 0, 0, 0) + (k - dayKey(startedAt)) * DAY;
      if (!days.has(isoWd(ts)) || trainedDays.has(k) || rest.has(k)) continue;
      missed++;
      lastMissed = ts;
    }
    const adh = a.adherence ?? (a.expectedSoFar > 0 ? Math.min(1, a.done / a.expectedSoFar) : 0);
    const toGo = Math.max(0, a.total - a.done);
    const weekLine = openEnded ? s.weekN(week) : s.weekOf(week, weeks);
    const bars = (h: number, labels: boolean) => (
      <WidgetBars
        tone="accent"
        values={perWeek.map((v) => Math.max(v, 0.15))}
        highlight={perWeek.map((_, i) => i).filter((i) => i < week)}
        height={h}
        labels={labels ? perWeek.map((_, i) => `W${i + 1}`) : undefined}
      />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="flag-checkered"
          title={`${weekLine} · ${name}`}
          sub={`${s.doneOf(a.done, a.expectedSoFar)} · ${s.adherence(pct(adh))}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={name}
          value={week}
          unit={openEnded ? s.weekShort : s.ofWeeks(weeks)}
          sub={s.adherence(pct(adh))}
          bodyLast
          onClick={open}
        >
          <WidgetBar value={openEnded ? adh : week / Math.max(1, weeks)} />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.programK(name)}
          badge={`${pct(adh)}%`}
          value={s.weekN(week)}
          unit={openEnded ? undefined : s.ofN(weeks)}
          bodyLast
          onClick={open}
          footer={
            <span className="uiw-sub">
              {[s.doneN(a.done), s.missedN(missed), openEnded ? null : s.toGoN(toGo)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          }
        >
          {bars(28, false)}
        </Widget>
      );
    const ends = openEnded ? null : startedAt + weeks * 7 * DAY;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.programK(name)}
        badge={weekLine}
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {ends
                ? s.endsOn(`${fmtWeekdayShort(ends, locale)} ${fmtDayMonth(ends, locale)}`)
                : ''}
            </span>
            <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={open}>
              {s.openProgram}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <WidgetRing value={adh} size={72} tone="accent">
            {`${pct(adh)}%`}
          </WidgetRing>
          <div style={{ minWidth: 0 }}>
            <div className="uiw-value">
              {a.done}
              {!openEnded && <span className="uiw-unit">{s.ofSessions(a.total)}</span>}
            </div>
            <div className="uiw-sub">
              {[s.adherenceWord, s.missedN(missed), openEnded ? null : s.toGoN(toGo)]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        {bars(40, true)}
        <WidgetList
          rows={[
            {
              label: s.missedL,
              value: lastMissed
                ? `${programDayNameForWeekday(isoWd(lastMissed)) ?? ''} · ${fmtWeekdayShort(lastMissed, locale)} ${fmtDayMonth(lastMissed, locale)}`
                : '—',
            },
            { label: s.thisWeekL, value: s.doneN(perWeek[Math.min(week, nWeeks) - 1] ?? 0) },
          ]}
        />
      </Widget>
    );
  },
};

/* ------------------------------------------------------- this week's plan */

type DayState = 'done' | 'today' | 'planned' | 'missed' | 'rest';
const DAY_LOOK: Record<DayState, { icon: string; tone: Tone }> = {
  done: { icon: 'check', tone: 'ok' },
  today: { icon: 'play', tone: 'accent' },
  planned: { icon: 'barbell', tone: 'neutral' },
  missed: { icon: 'x', tone: 'danger' },
  rest: { icon: 'moon', tone: 'rest' },
};

const weekPlan: WidgetDef = {
  id: 'week-plan',
  group: 'plan',
  icon: 'calendar-check',
  tone: 'accent',
  name: () => ps(getLocale()).names.week,
  render: (size, ctx) => {
    const { now, t, locale, shell } = ctx;
    const s = ps(locale);
    const ws = weekStartDay();
    const first = weekStartOf(now, ws);
    const today = dayKey(now);
    const finished = finishedOf(ctx);
    const days = weekOrder(ws).map((d) => {
      const date = dateInWeek(first, d, ws);
      const k = dayKey(date);
      const done = finished.filter((w) => dayKey(w.startedAt) === k);
      const plan = planForDate(ctx, date);
      const state: DayState = done.length
        ? 'done'
        : k === today
          ? 'today'
          : plan && k > today
            ? 'planned'
            : plan
              ? 'missed'
              : 'rest';
      const name = done.length
        ? sessionLabel(done[0], ctx.store.workouts, t)
        : (plan?.name ?? s.rest);
      const value =
        state === 'done'
          ? `✓ ${hm(done.reduce((a, w) => a + durMin(w), 0))}`
          : state === 'today'
            ? plan
              ? `~${plan.minutes} min`
              : s.recover
            : state === 'planned'
              ? `~${plan?.minutes ?? 45} min`
              : state === 'missed'
                ? s.missedL
                : s.recover;
      return { date, k, state, name, value, rest: !plan && !done.length };
    });
    const doneN = days.filter((d) => d.state === 'done').length;
    const plannedN = days.filter((d) => !d.rest).length;
    const todayD = days.find((d) => d.k === today)!;
    const upcoming = days.filter((d) => d.k > today).slice(0, 2);
    const open = () => shell.goTab('programs');
    if (plannedN === 0 && !readProgramCache())
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="calendar-check"
          kicker={s.thisWeek}
          title={s.planWeek}
          sub={s.planWeekSub}
          action={s.buildOne}
          onAction={() => shell.openOverlay({ screen: 'builder' })}
        />
      );
    const todayTitle = `${s.todayCap} · ${todayD.rest ? s.rest : todayD.name}`;
    const nextLine = upcoming
      .map((d) => `${fmtWeekdayShort(d.date, locale)} ${d.rest ? s.rest.toLowerCase() : d.name}`)
      .join(' · ');
    const badge = s.doneOfN(doneN, plannedN);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="calendar-check"
          title={todayTitle}
          sub={nextLine}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.thisWeek}
          badge={badge}
          title={todayTitle}
          sub={upcoming[0] ? s.nextX(nextLine.split(' · ')[0]) : undefined}
          bodyLast
          onClick={open}
        >
          <WidgetDots values={days.map((d) => d.state === 'done')} tone="ok" />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={s.thisWeek} badge={badge} onClick={open}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, flex: 1 }}>
            {days.map((d) => (
              <div
                key={d.k}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span className="uiw-sub">{fmtWeekdayShort(d.date, locale).slice(0, 2)}</span>
                <IconTile
                  size={30}
                  icon={DAY_LOOK[d.state].icon}
                  tone={DAY_LOOK[d.state].tone}
                  outline={d.state === 'planned'}
                />
                <span className="uiw-sub" style={{ maxWidth: '100%' }}>
                  {d.rest ? s.rest : d.name}
                </span>
              </div>
            ))}
          </div>
        </Widget>
      );
    const nextWeek = first + 7 * DAY + 3 * 3600000;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={`${s.thisWeek} · ${fmtDayMonth(first, locale)} – ${fmtDayMonth(first + 6 * DAY, locale)}`}
        badge={badge}
        onClick={open}
        footer={
          <span className="uiw-sub">
            {s.nextWeekStarts(
              `${fmtWeekdayShort(nextWeek, locale)} ${fmtDayMonth(nextWeek, locale)}`,
            )}
          </span>
        }
      >
        <WidgetList
          rows={days.map((d) => ({
            label: `${fmtWeekdayShort(d.date, locale)} · ${d.rest ? s.rest : d.name}${d.k === today ? ` · ${s.today}` : ''}`,
            value: d.value,
            icon: DAY_LOOK[d.state].icon,
            tone: DAY_LOOK[d.state].tone,
          }))}
        />
      </Widget>
    );
  },
};

/* ----------------------------------------------------------- time to train */

const startMin = (ts: number) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};
function median(xs: number[]): number {
  const a = [...xs].sort((p, q) => p - q);
  return a[Math.floor(a.length / 2)] ?? 0;
}
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

const timeToTrain: WidgetDef = {
  id: 'time-to-train',
  group: 'plan',
  icon: 'clock',
  tone: 'neutral',
  name: () => ps(getLocale()).names.time,
  render: (size, ctx) => {
    const { now, locale, shell } = ctx;
    const s = ps(locale);
    const finished = finishedOf(ctx);
    const recent = finished.filter((w) => w.startedAt >= now - 60 * DAY);
    const open = () => shell.openStart();
    if (recent.length < 3)
      return (
        <WidgetEmpty
          size={size}
          tone="neutral"
          icon="clock"
          kicker={s.usualTime}
          title={s.learningTime}
          sub={s.learningTimeSub}
          onAction={open}
        />
      );
    const usualFor = (dow: number) => {
      const same = recent.filter((w) => new Date(w.startedAt).getDay() === dow);
      return (
        Math.round(
          median((same.length >= 2 ? same : recent).map((w) => startMin(w.startedAt))) / 15,
        ) * 15
      );
    };
    const today = dayKey(now);
    const trainedToday = finished.some((w) => dayKey(w.startedAt) === today);
    const usual = usualFor(new Date(now).getDay());
    const nowMin = startMin(now);
    const diff = usual - nowMin;
    const status = trainedToday
      ? s.doneToday
      : diff > 0
        ? s.inX(hm(diff))
        : diff > -90
          ? s.nowTime
          : s.laterToday;
    const np = nextPlan(ctx);
    const todayPlan = np && dayKey(np.when) === today ? np.name : null;
    const gym = pickSessionGym();
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const from = (6 + 2 * i) * 60;
      return recent.filter((w) => {
        const m = startMin(w.startedAt);
        return m >= from && m < from + 120;
      }).length;
    });
    const hi = Math.min(7, Math.max(0, Math.floor((usual / 60 - 6) / 2)));
    const labels = buckets.map((_, i) => String(7 + 2 * i).padStart(2, '0'));
    const sub = [todayPlan, gym?.name].filter(Boolean).join(' · ');
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="clock"
          title={s.usuallyAt(hhmm(usual))}
          sub={[status, todayPlan].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={s.usualTime}
          value={hhmm(usual)}
          sub={[status, sub].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={s.names.time}
          badge={s.fromN(recent.length)}
          onClick={open}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flex: 1 }}>
            <div style={{ minWidth: 0 }}>
              <div className="uiw-value">{hhmm(usual)}</div>
              <div className="uiw-sub">{status}</div>
              {sub && <div className="uiw-sub">{sub}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <WidgetBars
                values={buckets.slice(2, 8)}
                highlight={[hi - 2]}
                labels={labels.slice(2, 8)}
                height={44}
              />
            </div>
          </div>
        </Widget>
      );
    const midnight = new Date(now).setHours(12, 0, 0, 0);
    const nextDays = Array.from(
      { length: 3 },
      (_, i) => midnight + (i + (trainedToday ? 1 : 0)) * DAY,
    ).map((d) => {
      const dow = new Date(d).getDay();
      const plan = planForDate(ctx, d);
      return {
        label: `${whenLabel(d, now, locale)} · ${plan?.name ?? s.rest}`,
        value: plan
          ? `${hhmm(usualFor(dow))}${dow === 0 || dow === 6 ? ` · ${s.weekend}` : ''}`
          : '—',
      };
    });
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.timeLast60}
        badge={s.sessionsN(recent.length)}
        value={hhmm(usual)}
        unit={s.usualStart}
        sub={status}
        bodyLast
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {s.fromN(recent.length)}
            </span>
            <Button variant="primary" size="sm" icon="play" onClick={open}>
              {s.startNow}
            </Button>
          </>
        }
      >
        <WidgetBars values={buckets} highlight={[hi]} labels={labels} height={48} />
        <WidgetList rows={nextDays} />
      </Widget>
    );
  },
};

/* -------------------------------------------------------------- rest timer */

interface RestLocal {
  /** Session mode: the loggedAt the adjustment belongs to. */
  at: number;
  delta: number;
  skip: boolean;
  /** Standalone mode. */
  endsAt: number;
  total: number;
}
const REST0: RestLocal = { at: 0, delta: 0, skip: false, endsAt: 0, total: 0 };
const PRESETS = [60, 90, 120, 180];

/** Wall clock for event handlers (kept out of render for the purity lint). */
function wallClock(): number {
  return Date.now();
}

function lastLogged(w: Workout | undefined): { ex: Exercise; set: SetEntry; at: number } | null {
  if (!w) return null;
  let best: { ex: Exercise; set: SetEntry; at: number } | null = null;
  for (const ex of w.exercises)
    for (const st of ex.sets)
      if (st.loggedAt && (!best || st.loggedAt > best.at)) best = { ex, set: st, at: st.loggedAt };
  return best;
}

function RestTimer({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, locale, shell } = ctx;
  const s = ps(locale);
  const [loc, setLoc] = useState<RestLocal>(() => readLocal('rest-timer', REST0));
  const [tick, setTick] = useState(() => Date.now());
  const save = (next: RestLocal) => {
    setLoc(next);
    writeLocal('rest-timer', next);
  };
  const open = store.workouts.find((w) => w.finishedAt === null);
  const last = lastLogged(open);
  const liveish = !!last || loc.endsAt > tick;
  useEffect(() => {
    if (!liveish) return;
    const iv = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [liveish]);

  // Session mode: rest after the last logged set, toward the lift's target.
  let mode: 'session' | 'solo' | 'idle' = 'idle';
  let goal = 0;
  let left = 0;
  if (last) {
    const target =
      exerciseRestSec(last.ex.name) ??
      defaultRestSec({
        compound: richExerciseByName(last.ex.name)?.mechanic === 'compound',
        lastType: setTypeOf(last.set),
        midRound: false,
      });
    const adj = loc.at === last.at ? loc : { ...loc, delta: 0, skip: false };
    goal = Math.max(0, target + adj.delta);
    left = goal - (tick - last.at) / 1000;
    if (!adj.skip && left > -600) mode = 'session';
  }
  if (mode === 'idle' && loc.endsAt > 0 && tick - loc.endsAt < 60000) {
    mode = 'solo';
    goal = loc.total;
    left = (loc.endsAt - tick) / 1000;
  }
  const soloDone = mode === 'solo' && left <= 0;
  useEffect(() => {
    if (soloDone) restAlert(store.restPrefs);
  }, [soloDone, store.restPrefs]);

  const startSolo = (sec: number) => {
    const t0 = wallClock();
    setTick(t0);
    save({ ...loc, endsAt: t0 + sec * 1000, total: sec });
  };
  const nudge = (d: number) => {
    if (mode === 'session' && last) {
      const base = loc.at === last.at ? loc.delta : 0;
      save({ ...loc, at: last.at, delta: base + d, skip: false });
    } else if (mode === 'solo')
      save({ ...loc, endsAt: loc.endsAt + d * 1000, total: Math.max(15, loc.total + d) });
  };
  const skip = () => {
    if (mode === 'session' && last) save({ ...loc, at: last.at, skip: true });
    else save({ ...loc, endsAt: 0 });
  };
  const openSession = open
    ? () => shell.openOverlay({ screen: 'session', workoutId: open.id })
    : undefined;
  const presetRow = (full: boolean) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(full ? PRESETS : PRESETS.slice(1, 3)).map((p) => (
        <Button key={p} variant="secondary" size="sm" onClick={() => startSolo(p)}>
          {fmtCountdown(p)}
        </Button>
      ))}
    </div>
  );

  if (mode === 'idle') {
    const sub = last ? s.readyNext : s.quickRestSub;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="rest"
          icon="timer"
          title={s.names.rest}
          sub={sub}
          onClick={openSession}
          trailing={
            <Button variant="secondary" size="sm" onClick={() => startSolo(90)}>
              {fmtCountdown(90)}
            </Button>
          }
        />
      );
    return (
      <Widget
        size={size}
        tone="rest"
        kicker={s.names.rest}
        title={size === 'S' ? undefined : s.quickRest}
        sub={size === 'S' ? undefined : sub}
        bodyLast
        onClick={openSession}
        footer={size === 'L' ? undefined : presetRow(size === 'XL')}
      >
        {size === 'S' ? (
          <div className="uiw-value">{fmtCountdown(90)}</div>
        ) : size === 'L' ? (
          presetRow(true)
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
            <WidgetRing value={0} size={120} tone="rest">
              0:00
            </WidgetRing>
          </div>
        )}
      </Widget>
    );
  }

  const done = left <= 0;
  const clockTxt = done ? `+${fmtCountdown(-left)}` : fmtCountdown(left);
  const frac = goal > 0 ? Math.max(0, Math.min(1, left / goal)) : 0;
  const ofTxt = s.ofX(fmtCountdown(goal));
  const ex = mode === 'session' && last ? last.ex : null;
  const exTxt = ex ? exName(ex.name, locale) : s.quickRest;
  const setNo = ex ? `${ex.sets.length}/${Math.max(ex.sets.length, ex.plannedSets ?? 0)}` : null;
  const nextSet = last ? s.nextX(fmtSet(last.set.weight, last.set.reps)) : null;
  const kicker = done ? s.restOver : s.restRunning;
  const btn = (
    label: string,
    run: () => void,
    variant: 'secondary' | 'ghost' | 'primary' = 'secondary',
  ) => (
    <Button variant={variant} size="sm" onClick={run}>
      {label}
    </Button>
  );
  const ring = (px: number) => (
    <WidgetRing value={frac} size={px} tone={done ? 'ok' : 'rest'}>
      {clockTxt}
      {px >= 96 && <small>{ofTxt}</small>}
    </WidgetRing>
  );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="rest"
        icon="timer"
        title={`${clockTxt} ${ofTxt}`}
        sub={[exTxt, setNo ? s.setN(setNo) : null].filter(Boolean).join(' · ')}
        onClick={openSession}
        trailing={btn('+15s', () => nudge(15))}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="rest"
        kicker={kicker}
        onClick={openSession}
        footer={
          <>
            {btn('+15s', () => nudge(15))}
            {btn(s.skip, skip, 'ghost')}
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ring(52)}
          <div style={{ minWidth: 0 }}>
            <div className="uiw-sub">{ofTxt}</div>
            {setNo && <div className="uiw-sub">{s.setN(setNo)}</div>}
          </div>
        </div>
      </Widget>
    );
  const controls = (
    <>
      {btn('−15s', () => nudge(-15))}
      {btn('+15s', () => nudge(15))}
      {btn(s.skipRest, skip, 'primary')}
    </>
  );
  if (size === 'L')
    return (
      <Widget size="L" tone="rest" onClick={openSession}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
          {ring(96)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
            <span className="uiw-kicker">{kicker}</span>
            <div className="uiw-title">{[exTxt, setNo].filter(Boolean).join(' · ')}</div>
            {nextSet && <div className="uiw-sub">{nextSet}</div>}
            <div style={{ display: 'flex', gap: 6 }}>{controls}</div>
          </div>
        </div>
      </Widget>
    );
  const upNext =
    ex && open
      ? [...open.exercises]
          .sort((p, q) => p.position - q.position)
          .find(
            (e) => e.id !== ex.id && isStrengthExercise(e) && e.sets.length < (e.plannedSets ?? 1),
          )
      : undefined;
  return (
    <Widget
      size="XL"
      tone="rest"
      kicker={ex ? s.restK(open?.dayName ?? exTxt) : s.names.rest}
      badge={setNo ? s.setN(setNo) : undefined}
      onClick={openSession}
      footer={controls}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {ring(120)}
        <div style={{ minWidth: 0 }}>
          <div className="uiw-name">{exTxt}</div>
          {ex && (
            <WidgetDots
              values={Array.from(
                { length: Math.max(ex.sets.length, ex.plannedSets ?? 0) },
                (_, i) => i < ex.sets.length,
              )}
              tone="rest"
            />
          )}
          {last && (
            <div className="uiw-sub">{s.lastSetX(fmtSet(last.set.weight, last.set.reps))}</div>
          )}
          {nextSet && <div className="uiw-sub">{nextSet}</div>}
        </div>
      </div>
      {presetRow(true)}
      {upNext && (
        <Line
          left={s.upNext(exName(upNext.name, locale))}
          right={s.setsN(upNext.plannedSets ?? 0)}
        />
      )}
    </Widget>
  );
}

const restTimer: WidgetDef = {
  id: 'rest-timer',
  group: 'plan',
  icon: 'timer',
  tone: 'rest',
  name: () => ps(getLocale()).names.rest,
  render: (size, ctx) => <RestTimer size={size} ctx={ctx} />,
};

/* ------------------------------------------------------------ last session */

function sessionRpe(w: Workout): number | null {
  const xs: number[] = [];
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    for (const st of e.sets) {
      if (setTypeOf(st) === 'warmup') continue;
      const r = st.rpe ?? st.rpeAuto;
      if (r != null && r > 0) xs.push(r);
    }
  }
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Exercises of a session with their PR flag (e1RM above everything before). */
function sessionLifts(w: Workout): { ex: Exercise; pr: boolean; top: SetEntry | undefined }[] {
  return w.exercises
    .filter((e) => isStrengthExercise(e) && e.sets.length > 0)
    .sort((a, b) => a.position - b.position)
    .map((ex) => {
      const best = Math.max(0, ...ex.sets.map(setBestE1rm));
      const before = recordE1rm(ex.name, w.id);
      return { ex, pr: best > 0 && before > 0 && best > before, top: topSet(ex.sets) };
    });
}

const lastSession: WidgetDef = {
  id: 'last-session',
  group: 'plan',
  icon: 'list-checks',
  tone: 'accent',
  name: () => ps(getLocale()).names.last,
  render: (size, ctx) => {
    const { store, now, t, locale, shell } = ctx;
    const s = ps(locale);
    const w = finishedOf(ctx)[0];
    if (!w)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="list-checks"
          kicker={s.names.last}
          title={s.noSession}
          sub={s.noSessionSub}
          onAction={() => shell.openStart()}
        />
      );
    const open = () => shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
    const name = sessionLabel(w, store.workouts, t);
    const when = whenLabel(w.startedAt, now, locale, true);
    const dur = hm(durMin(w));
    const tonnes = `${(workoutVolumeKg(w) / 1000).toFixed(1)} t`;
    const sets = workoutSets(w);
    const lifts = sessionLifts(w);
    const prs = lifts.filter((l) => l.pr).length;
    const gym = store.gyms.find((g) => g.id === w.gymId)?.name;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="list-checks"
          title={`${name} · ${when}`}
          sub={`${dur} · ${tonnes} · ${s.setsN(sets)}`}
          onClick={open}
          trailing={
            prs > 0 ? (
              <Chip size="sm" tone="accent">
                {s.prN(prs)}
              </Chip>
            ) : undefined
          }
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.names.last}
          title={name}
          sub={`${dur} · ${tonnes}`}
          onClick={open}
          footer={
            <span className="uiw-sub">
              {[prs > 0 ? s.prN(prs) : null, when].filter(Boolean).join(' · ')}
            </span>
          }
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={`${s.names.last} · ${when}`}
          badge={gym}
          title={name}
          bodyLast
          onClick={open}
        >
          <WidgetStats
            items={[
              { label: s.timeL, value: dur },
              { label: s.volumeL, value: tonnes },
              { label: s.setsL, value: sets },
              { label: s.prsL, value: prs },
            ]}
          />
        </Widget>
      );
    const rpe = sessionRpe(w);
    const kcal = workoutCalories(w, latestWeight(store.bodyMetrics)?.weight ?? null);
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={`${s.names.last} · ${when}`}
        badge={rpe ? `RPE ${rpe.toFixed(1)}` : undefined}
        title={name}
        sub={`${dur} · ${tonnes} · ${s.setsN(sets)}`}
        bodyLast
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {[kcal ? `${kcal} kcal` : null, gym].filter(Boolean).join(' · ')}
            </span>
            <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={open}>
              {s.summary}
            </Button>
          </>
        }
      >
        <WidgetList
          rows={lifts.slice(0, 6).map((l) => ({
            label: exName(l.ex.name, locale),
            value: `${l.pr ? `${s.pr} ` : ''}${l.ex.sets.length}×${l.top?.reps ?? '—'}${l.top?.weight ? ` · ${l.top.weight} kg` : ''}`,
          }))}
        />
      </Widget>
    );
  },
};

/* --------------------------------------------------- last session muscles */

const lastMuscles: WidgetDef = {
  id: 'last-session-muscles',
  group: 'plan',
  icon: 'person-simple',
  tone: 'accent',
  name: () => ps(getLocale()).names.muscles,
  render: (size, ctx) => {
    const { store, now, t, locale, shell } = ctx;
    const s = ps(locale);
    const w = finishedOf(ctx).find((x) => workoutSets(x) > 0);
    if (!w)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="person-simple"
          kicker={s.worked}
          title={s.noSession}
          sub={s.noSessionSub}
          onAction={() => shell.openStart()}
        />
      );
    const work = muscleWorkSorted(w).filter((m) => m.muscle !== 'cardio');
    const primary = work.filter((m) => m.primary);
    const secondary = work.filter((m) => !m.primary);
    const colors: Partial<Record<MuscleGroup, string>> = {};
    for (const m of secondary) colors[m.muscle] = 'var(--color-accent-700)';
    for (const m of primary) colors[m.muscle] = 'var(--color-accent)';
    const name = sessionLabel(w, store.workouts, t);
    const when = whenLabel(w.startedAt, now, locale, true);
    const prim = primary
      .slice(0, 2)
      .map((m) => muscleName(t, m.muscle))
      .join(', ');
    const secLine = secondary.length ? s.plusSecondary(secondary.length) : '';
    const open = () =>
      primary[0]
        ? shell.openOverlay({ screen: 'muscle-history', muscle: primary[0].muscle })
        : shell.goTab('progress');
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="person-simple"
          title={`${name} · ${when}`}
          sub={[prim, secLine].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="accent" kicker={s.workedWhen(when)} onClick={open}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minHeight: 0 }}>
            <MuscleHeatmap colors={colors} width={64} />
            <div style={{ minWidth: 0 }}>
              <div className="uiw-title">{name}</div>
              <div className="uiw-sub">{prim}</div>
              {secLine && <div className="uiw-sub">{secLine}</div>}
            </div>
          </div>
        </Widget>
      );
    const sets = workoutSets(w);
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" onClick={open}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minHeight: 0 }}>
            <MuscleHeatmap colors={colors} width={130} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div className="uiw-title">{`${name} · ${when}`}</div>
              <div className="uiw-sub">{`● ${primary.map((m) => muscleName(t, m.muscle)).join(', ')}`}</div>
              {secondary.length > 0 && (
                <div className="uiw-sub">{`○ ${secondary.map((m) => muscleName(t, m.muscle)).join(', ')}`}</div>
              )}
              <div className="uiw-sub">{s.setsGroups(sets, work.length)}</div>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={`${s.worked} · ${name} · ${when}`}
        badge={s.setsN(sets)}
        onClick={open}
      >
        <div style={{ display: 'flex', justifyContent: 'center', flex: 1, minHeight: 0 }}>
          <MuscleHeatmap colors={colors} width={HEATMAP_XL_W} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {work.slice(0, 5).map((m) => (
            <Chip key={m.muscle} size="sm" tone={m.primary ? 'accent' : 'neutral'}>
              {`${muscleName(t, m.muscle)} ${Math.round(m.sets)}`}
            </Chip>
          ))}
        </div>
      </Widget>
    );
  },
};

/* ---------------------------------------------------------- session energy */

const sessionEnergy: WidgetDef = {
  id: 'session-energy',
  group: 'plan',
  icon: 'flame',
  tone: 'kcal',
  name: () => ps(getLocale()).names.energy,
  render: (size, ctx) => {
    const { store, now, t, locale, shell, openWeight } = ctx;
    const s = ps(locale);
    const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
    const finished = finishedOf(ctx);
    if (!bodyKg)
      return (
        <WidgetEmpty
          size={size}
          tone="kcal"
          icon="flame"
          kicker={s.names.energy}
          title={s.needWeight}
          sub={s.needWeightSub}
          action={s.logWeight}
          onAction={openWeight}
        />
      );
    const rows = finished
      .slice(0, 9)
      .map((w) => ({ w, kcal: workoutCalories(w, bodyKg) ?? 0 }))
      .filter((r) => r.kcal > 0);
    const last = rows[0];
    if (!last)
      return (
        <WidgetEmpty
          size={size}
          tone="kcal"
          icon="flame"
          kicker={s.names.energy}
          title={s.noSession}
          sub={s.noSessionSub}
          onAction={() => shell.openStart()}
        />
      );
    const w = last.w;
    const open = () => shell.openOverlay({ screen: 'past-workout', workoutId: w.id });
    const name = sessionLabel(w, store.workouts, t);
    const mins = Math.max(1, durMin(w));
    const perMin = (last.kcal / mins).toFixed(1);
    const series = rows.map((r) => r.kcal).reverse();
    const avg = Math.round(series.reduce((a, b) => a + b, 0) / series.length);
    const d = last.kcal - avg;
    const when = whenLabel(w.startedAt, now, locale, true);
    const weekRows = finished.filter((x) => x.startedAt >= now - 7 * DAY);
    const weekKcal = weekRows.reduce((a, x) => a + (workoutCalories(x, bodyKg) ?? 0), 0);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="kcal"
          icon="flame"
          title={`${last.kcal} kcal · ${name}`}
          sub={`${when} · ${s.perMin(perMin)}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="kcal"
          kicker={s.lastWorkout}
          value={last.kcal}
          unit="kcal"
          sub={`${name} · ${hm(mins)}`}
          onClick={open}
        />
      );
    const bars = (h: number) => (
      <WidgetBars values={series} highlight={[series.length - 1]} height={h} tone="kcal" />
    );
    if (size === 'L')
      return (
        <Widget size="L" tone="kcal" kicker={s.energyK(name)} badge={when} onClick={open}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flex: 1 }}>
            <div style={{ minWidth: 0 }}>
              <div className="uiw-value">
                {last.kcal}
                <span className="uiw-unit">kcal</span>
              </div>
              <div className="uiw-sub">{`${s.perMin(perMin)} · ${hm(mins)}`}</div>
              <WidgetDelta good={d >= 0}>{s.vsAvg(signed(d, 0))}</WidgetDelta>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {bars(44)}
              <div className="uiw-sub">{s.lastNAvg(series.length, avg)}</div>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="kcal"
        kicker={`${s.names.energy} · ${when}`}
        badge={name}
        value={last.kcal}
        unit="kcal"
        sub={`${s.perMin(perMin)} · ${hm(mins)}`}
        bodyLast
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {s.weekKcal(Math.round(weekKcal), weekRows.length)}
            </span>
            <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={open}>
              {s.summary}
            </Button>
          </>
        }
      >
        {bars(70)}
        <div className="uiw-sub">{s.lastNAvg(series.length, avg)}</div>
        <WidgetList
          rows={rows.slice(0, 3).map((r) => ({
            label: `${fmtWeekdayShort(r.w.startedAt, locale)} · ${sessionLabel(r.w, store.workouts, t)}`,
            value: `${r.kcal} kcal`,
          }))}
        />
      </Widget>
    );
  },
};

/* ------------------------------------------------------------ effort trend */

const ZONE_LO = 7;
const ZONE_HI = 8.5;

const effortTrend: WidgetDef = {
  id: 'effort-trend',
  group: 'plan',
  icon: 'gauge',
  tone: 'accent',
  name: () => ps(getLocale()).names.effort,
  render: (size, ctx) => {
    const { store, t, locale, shell } = ctx;
    const s = ps(locale);
    const rows = finishedOf(ctx)
      .map((w) => ({ w, rpe: sessionRpe(w) }))
      .filter((r): r is { w: Workout; rpe: number } => r.rpe !== null)
      .slice(0, 10);
    const open = () => shell.goTab('progress');
    if (rows.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="gauge"
          kicker={s.effortK}
          title={s.noRpe}
          sub={s.noRpeSub}
          onAction={open}
        />
      );
    const avg = rows.reduce((a, r) => a + r.rpe, 0) / rows.length;
    const inZone = rows.filter((r) => r.rpe >= ZONE_LO && r.rpe <= ZONE_HI).length;
    const zoneTxt = s.zone(`${ZONE_LO}–${ZONE_HI}`);
    const state = avg < ZONE_LO ? s.belowZone : avg > ZONE_HI ? s.aboveZone : s.inZone;
    const advice = avg < ZONE_LO ? s.adviceLow : avg > ZONE_HI ? s.adviceHigh : s.adviceZone;
    const series = rows.map((r) => r.rpe).reverse();
    const spark = (h: number) =>
      series.length > 1 ? <WidgetSpark points={series} height={h} tone="accent" area /> : null;
    const avgTxt = avg.toFixed(1);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="gauge"
          title={s.avgRpe(avgTxt)}
          sub={`${s.lastNSessions(rows.length)} · ${state}`}
          onClick={open}
          trailing={<span style={{ width: 72, display: 'flex' }}>{spark(28)}</span>}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.effortK}
          value={avgTxt}
          unit={s.avg}
          sub={`${state} ${`${ZONE_LO}–${ZONE_HI}`}`}
          bodyLast
          onClick={open}
        >
          {spark(24)}
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.effortLast(rows.length)}
          badge={zoneTxt}
          value={avgTxt}
          unit={s.avgRpeUnit}
          bodyLast
          onClick={open}
        >
          {spark(44)}
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.effortLast(rows.length)}
        badge={s.inZoneN(inZone, rows.length)}
        value={avgTxt}
        unit={s.avgRpeUnit}
        sub={zoneTxt}
        bodyLast
        onClick={open}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {advice}
            </span>
            <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={open}>
              {s.progress}
            </Button>
          </>
        }
      >
        {spark(80)}
        <WidgetList
          rows={rows.slice(0, 3).map((r) => ({
            label: `${fmtWeekdayShort(r.w.startedAt, locale)} · ${sessionLabel(r.w, store.workouts, t)}`,
            value: `RPE ${r.rpe.toFixed(1)}`,
          }))}
        />
      </Widget>
    );
  },
};

/* ---------------------------------------------------------- session length */

const sessionLength: WidgetDef = {
  id: 'session-length',
  group: 'plan',
  icon: 'hourglass',
  tone: 'neutral',
  name: () => ps(getLocale()).names.length,
  render: (size, ctx) => {
    const { store, now, t, locale, shell } = ctx;
    const s = ps(locale);
    const rows = finishedOf(ctx)
      .map((w) => ({ w, min: durMin(w) }))
      .filter((r) => r.min >= 5);
    const open = () => shell.openOverlay({ screen: 'history' });
    const last30 = rows.filter((r) => r.w.startedAt >= now - 30 * DAY);
    const prev30 = rows.filter(
      (r) => r.w.startedAt < now - 30 * DAY && r.w.startedAt >= now - 60 * DAY,
    );
    if (last30.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="neutral"
          icon="hourglass"
          kicker={s.avgSession}
          title={s.noSession}
          sub={s.noRecent}
          onAction={open}
        />
      );
    const mean = (xs: { min: number }[]) => xs.reduce((a, r) => a + r.min, 0) / xs.length;
    const avg = Math.round(mean(last30));
    const d = prev30.length ? Math.round(avg - mean(prev30)) : 0;
    const dTxt = prev30.length
      ? s.vsPrev(`${d > 0 ? '↑' : d < 0 ? '↓' : '±'} ${Math.abs(d)} min`)
      : '';
    const last10 = rows.slice(0, 10).reverse();
    const bars = (h: number) => (
      <WidgetBars
        values={last10.map((r) => r.min)}
        highlight={[last10.length - 1]}
        height={h}
        tone="neutral"
      />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="hourglass"
          title={s.avgPer(hm(avg))}
          sub={[s.days30, s.sessionsN(last30.length), dTxt].filter(Boolean).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={s.avgSession}
          value={hm(avg)}
          sub={dTxt || s.sessionsN(last30.length)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={s.lengthLast(last10.length)}
          badge={dTxt || undefined}
          value={hm(avg)}
          unit={s.avg}
          bodyLast
          onClick={open}
        >
          {bars(44)}
        </Widget>
      );
    const byName = new Map<string, number[]>();
    for (const r of last30) {
      const n = sessionLabel(r.w, store.workouts, t);
      byName.set(n, [...(byName.get(n) ?? []), r.min]);
    }
    const names = [...byName.entries()]
      .map(([n, xs]) => ({ n, avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
    const first = last10[0]?.w.startedAt;
    const lastTs = last10[last10.length - 1]?.w.startedAt;
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.length30}
        badge={dTxt || undefined}
        value={hm(avg)}
        unit={s.avg}
        sub={s.sessionsN(last30.length)}
        bodyLast
        onClick={open}
        footer={
          <Button variant="secondary" size="sm" fullWidth iconTrailing="caret-right" onClick={open}>
            {s.history}
          </Button>
        }
      >
        {bars(64)}
        {first && lastTs ? (
          <Line left={fmtDayMonth(first, locale)} right={fmtDayMonth(lastTs, locale)} />
        ) : null}
        <WidgetList
          rows={names.map((x, i) => ({
            label: x.n,
            value: i === 0 ? s.avgLongest(hm(x.avg)) : s.avgX(hm(x.avg)),
          }))}
        />
      </Widget>
    );
  },
};

/* --------------------------------------------------------------- home sets */

const homeSetsW: WidgetDef = {
  id: 'home-sets',
  group: 'plan',
  icon: 'house',
  tone: 'active',
  name: () => ps(getLocale()).names.home,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = ps(locale);
    const sets = store.home.sets;
    const newOne = () => shell.openStart();
    if (sets.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="active"
          icon="house"
          kicker={s.names.home}
          title={s.noHome}
          sub={s.noHomeSub}
          action={s.newTemplate}
          onAction={newOne}
        />
      );
    const finished = finishedOf(ctx);
    const runs = finished.filter((w) => w.kind === 'home');
    const start = (id: string) => {
      if (resumeOpen(ctx)) return;
      const set = sets.find((x) => x.id === id);
      if (!set) return;
      const w = startHomeSet({ set, name: set.name, moves: set.moves });
      if (w) shell.openOverlay({ screen: 'session', workoutId: w.id });
      else shell.openStart();
    };
    const ordered = [...sets].sort(
      (a, b) => (lastRunOf(finished, b.id)?.at ?? 0) - (lastRunOf(finished, a.id)?.at ?? 0),
    );
    const top = ordered[0];
    const detail = (id: string) => {
      const set = sets.find((x) => x.id === id)!;
      const moves = homeSetMoves(store.home, set);
      return moves
        .map((m) => (m.custom ? m.name : exName(m.name, locale)))
        .slice(0, 3)
        .join(' · ');
    };
    const lastRun = runs[0];
    const weekN = runs.filter((w) => w.startedAt >= now - 7 * DAY).length;
    const startBtn = (id: string, label = s.start) => (
      <Button variant="secondary" size="sm" onClick={() => start(id)}>
        {label}
      </Button>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="active"
          icon="house"
          title={s.homeN(sets.length)}
          sub={sets
            .map((x) => x.name)
            .slice(0, 3)
            .join(' · ')}
          onClick={newOne}
          trailing={startBtn(top.id)}
        />
      );
    if (size === 'S') {
      const lr = lastRunOf(finished, top.id);
      return (
        <Widget
          size="S"
          tone="active"
          kicker={s.names.home}
          title={top.name}
          sub={lr ? `${detail(top.id)} · ${s.minN(lr.durationMin)}` : detail(top.id)}
          onClick={newOne}
          footer={
            <Button variant="primary" size="sm" icon="play" fullWidth onClick={() => start(top.id)}>
              {s.start}
            </Button>
          }
        />
      );
    }
    const list = (n: number) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ordered.slice(0, n).map((x) => (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="uiw-title">{x.name}</div>
              <div className="uiw-sub">{detail(x.id)}</div>
            </div>
            {startBtn(x.id)}
          </div>
        ))}
      </div>
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="active"
          kicker={s.names.home}
          badge={lastRun ? s.lastX(whenLabel(lastRun.startedAt, now, locale)) : undefined}
          onClick={newOne}
        >
          {list(2)}
        </Widget>
      );
    // XL: the latest home run vs the one before of the same set.
    const same = lastRun ? runs.filter((w) => w.homeSetId === lastRun.homeSetId) : [];
    const reps = same
      .slice(0, 6)
      .map((w) => homeTotals(w).reps)
      .reverse();
    const cur = reps[reps.length - 1] ?? 0;
    const prev = reps[reps.length - 2];
    return (
      <Widget
        size="XL"
        tone="active"
        kicker={s.homeN(sets.length)}
        badge={s.weekTimes(weekN)}
        onClick={newOne}
        footer={
          <>
            <span className="uiw-sub" style={{ flex: 1 }}>
              {s.noGym}
            </span>
            <Button variant="ghost" size="sm" icon="plus" onClick={newOne}>
              {s.newTemplate}
            </Button>
          </>
        }
      >
        {lastRun ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 0 }}>
              <div className="uiw-sub">{`${lastRun.dayName ?? ''} · ${s.lastX(whenLabel(lastRun.startedAt, now, locale))}`}</div>
              <div className="uiw-value">
                {cur}
                <span className="uiw-unit">{s.reps}</span>
              </div>
              {prev != null && (
                <WidgetDelta good={cur >= prev}>{s.vsLast(signed(cur - prev, 0))}</WidgetDelta>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {reps.length > 1 && (
                <WidgetBars values={reps} highlight={[reps.length - 1]} height={48} tone="active" />
              )}
            </div>
          </div>
        ) : (
          <div className="uiw-empty-art">
            <IconTile tone="active" size={56} icon="house" />
          </div>
        )}
        {list(lastRun ? 3 : 4)}
      </Widget>
    );
  },
};

/* ------------------------------------------------------------------ export */

export const PLAN_WIDGETS: WidgetDef[] = [
  nextWorkout,
  quickBuilder,
  warmup,
  programProgress,
  weekPlan,
  timeToTrain,
  restTimer,
  lastSession,
  lastMuscles,
  sessionEnergy,
  effortTrend,
  sessionLength,
  homeSetsW,
];
