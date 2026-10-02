import { useMemo, useState, type ReactNode } from 'react';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetDots,
  WidgetList,
  WidgetSpark,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip, type ChipTone } from '../../components/ui/Chip';
import { IconTile } from '../../components/ui/IconTile';
import { ToneText } from '../../components/ui/ToneText';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { toneClass, type Tone } from '../../components/ui/tones';
import { Sheet } from '../../ui';
import {
  addExercise,
  exerciseNeeds,
  isStrengthExercise,
  latestWeight,
  missingAtGym,
  muscleSetsInWorkout,
  setBestE1rm,
  setTypeOf,
  startWorkout,
  workoutVolumeKg,
} from '../../store';
import { fmtDayMonth, fmtMonthYear, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import { localizedExerciseName } from '../../data/exerciseNames';
import { FOCUS_MUSCLES, focusToGroup, type FocusMuscle } from '../../data/subregions';
import type { MuscleGroup } from '../../data/exercises';
import { dayReadoutLabel } from '../../data/daySuggest';
import { haversineM } from '../../data/gymProviders';
import { startPlaySession } from '../../data/programMine';
import { equipmentLabel } from '../../components/Muscle';
import { useGymStep } from '../../components/useGymStep';
import { computePlaybook, playForWeekday, type Play, type PlaySuggestion } from '../../playbook';
import { volumeWeakPoints } from '../../weakpoints';
import { activeGym, fixCandidates, type FixCandidate } from '../../fixit';
import { deloadSuggestion, muscleFatigue, type FatigueLevel } from '../../fatigue';
import {
  activityCalories,
  activityCategory,
  activityRecoveryBias,
  activityTone,
  activityType,
  durationMin,
} from '../../activities';
import { sleepReadinessBias } from '../../sleep';
import { deloadMult, sleepNeedExtraMin } from '../../calcMods';
import { personalLandmarks } from '../../personalize';
import { FOCUS_MAV_DELTA, focusLists, groupEmphasis } from '../../goals';
import { LANDMARKS } from '../../volume';
import { availableRecaps, type RecapEntry } from '../../recaps';
import { weekStartOf } from '../../weekStart';
import type { Activity, SetEntry, Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY, signed } from './format';
import { trs } from './training.strings';

/* ---------- shared helpers ---------- */

const HOUR = 3600 * 1000;
const WEEK = 7 * DAY;

const finishedOf = (workouts: Workout[]): Workout[] =>
  workouts.filter((w) => w.finishedAt !== null);

function exName(name: string, locale: LocaleId): string {
  return localizedExerciseName(name, locale) ?? name;
}

function goHash(hash: string): void {
  window.location.hash = hash;
}

/** "1 480" — thin-space thousands like the app's kg/kcal figures. */
function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A row of flex children (layout only). */
function Row({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="ul-flex ul-wrap ua-center umw-0" style={{ gap }}>
      {children}
    </div>
  );
}

/**
 * A stacked share bar (kit bar track; each part binds its own tone family).
 * Built locally from `.uiw-bar` semantics — the kit has no stacked variant yet.
 */
function StackBar({
  parts,
  height = 10,
}: {
  parts: { value: number; tone: Tone }[];
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <span className="uiw-bar ug-2" style={{ height }}>
      {parts.map((p, i) => (
        <span
          key={i}
          className={toneClass(p.tone)}
          style={{ width: `${(p.value / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

/** Weekly volume (tonnage) vs the 8-week average. */
const volume: WidgetDef = {
  id: 'weekly-volume',
  group: 'training',
  icon: 'chart-bar',
  tone: 'accent',
  name: (tw) => tw.volume8,
  render: (size, { store, now, tw, shell, locale }) => {
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const to = now - (7 - i) * 7 * DAY;
      const from = to - 7 * DAY;
      return (
        finished
          .filter((w) => w.startedAt >= from && w.startedAt < to)
          .reduce((s, w) => s + workoutVolumeKg(w), 0) / 1000
      );
    });
    const cur = weeks[7];
    const prev = weeks.slice(0, 7).filter((v) => v > 0);
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    const d = avg > 0 ? Math.round(((cur - avg) / avg) * 100) : 0;
    const deltaTxt = `${d >= 0 ? '+' : '−'}${Math.abs(d)}%`;
    const delta = <WidgetDelta good={d >= 0}>{tw.vsAvg(deltaTxt)}</WidgetDelta>;
    const t1 = cur.toFixed(1);
    const open = () => shell.goTab('progress');
    const bars = (h: number) => (
      <WidgetBars values={weeks} highlight={[7]} height={h} tone="accent" />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="chart-bar"
          title={tw.volumeWeek(t1)}
          sub={tw.vsAvg(deltaTxt)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={tw.thisWeek}
          value={t1}
          unit="t"
          sub={delta}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={tw.volume8}
          badge={<WidgetDelta good={d >= 0}>{deltaTxt}</WidgetDelta>}
          value={t1}
          unit="t"
          bodyLast
          onClick={open}
        >
          {bars(52)}
        </Widget>
      );
    // One row per week (newest first), labelled by the week's start date.
    const recent = weeks
      .map((v, i) => ({ v, from: now - (8 - i) * 7 * DAY }))
      .slice(-4)
      .reverse()
      .map((w) => ({
        label: fmtDayMonth(w.from, locale),
        value: `${w.v.toFixed(1)} t`,
      }));
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={tw.volume8}
        badge={<WidgetDelta good={d >= 0}>{deltaTxt}</WidgetDelta>}
        value={t1}
        unit="t"
        bodyLast
        onClick={open}
      >
        {bars(110)}
        <WidgetList rows={recent} />
      </Widget>
    );
  },
};

/* ---------- Lift record ---------- */

interface LiftPoint {
  ts: number;
  e1: number;
  sets: number;
  reps: number;
  weight: number;
  day: string | null;
}
interface LiftIndex {
  series: Map<string, LiftPoint[]>;
  /** The lift whose e1RM record fell most recently (else the most trained). */
  auto: string | null;
  byCount: string[];
}

/** Per-lift session series (best e1RM + the top working set), oldest first. */
function indexLifts(finished: Workout[]): LiftIndex {
  const series = new Map<string, LiftPoint[]>();
  const sorted = [...finished].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const working = e.sets.filter((s) => setTypeOf(s) !== 'warmup');
      let e1 = 0;
      let top: SetEntry | null = null;
      for (const s of working) {
        e1 = Math.max(e1, setBestE1rm(s));
        if (!top || (s.weight ?? 0) > (top.weight ?? 0)) top = s;
      }
      if (e1 <= 0 || !top) continue;
      const key = e.name.trim();
      const list = series.get(key) ?? [];
      list.push({
        ts: w.startedAt,
        e1,
        sets: working.length,
        reps: top.reps,
        weight: top.weight ?? 0,
        day: w.dayName?.trim() || null,
      });
      series.set(key, list);
    }
  }
  let auto: string | null = null;
  let autoTs = -1;
  for (const [name, pts] of series) {
    let best = 0;
    pts.forEach((p, i) => {
      if (p.e1 > best) {
        if (i > 0 && p.ts > autoTs) {
          autoTs = p.ts;
          auto = name;
        }
        best = p.e1;
      }
    });
  }
  const byCount = [...series.entries()].sort((a, b) => b[1].length - a[1].length).map(([n]) => n);
  return { series, auto: auto ?? byCount[0] ?? null, byCount };
}

const LIFT_KEY = 'spotter.tw.lift-record';
function readLift(): string | null {
  try {
    return localStorage.getItem(LIFT_KEY);
  } catch {
    return null;
  }
}
function writeLift(name: string | null): void {
  try {
    if (name) localStorage.setItem(LIFT_KEY, name);
    else localStorage.removeItem(LIFT_KEY);
  } catch {
    /* storage unavailable — the choice lasts for this session only */
  }
}

function LiftRecordWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, locale, shell } = ctx;
  const s = trs(locale);
  const idx = useMemo(() => indexLifts(finishedOf(store.workouts)), [store.workouts]);
  const [chosen, setChosen] = useState<string | null>(() => readLift());
  const [picking, setPicking] = useState(false);
  const name = chosen && idx.series.has(chosen) ? chosen : idx.auto;
  const pick = (n: string | null) => {
    writeLift(n);
    setChosen(n);
    setPicking(false);
  };
  const sheet = picking ? (
    <Sheet onClose={() => setPicking(false)}>
      <GroupedList header={s.pickLift}>
        <ListRow label={s.autoLift} check={!chosen} onClick={() => pick(null)} />
        {idx.byCount.slice(0, 15).map((n) => (
          <ListRow
            key={n}
            label={exName(n, locale)}
            value={s.sessionsN(idx.series.get(n)?.length ?? 0)}
            check={chosen === n}
            onClick={() => pick(n)}
          />
        ))}
      </GroupedList>
    </Sheet>
  ) : null;

  if (!name)
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="trend-up"
        kicker={s.nLiftRecord}
        title={s.noLifts}
        sub={s.noLiftsSub}
        action={s.startSession}
        onAction={shell.openStart}
      />
    );

  const pts = idx.series.get(name) ?? [];
  const best = Math.max(...pts.map((p) => p.e1));
  const bestAt = pts.find((p) => p.e1 === best)?.ts ?? now;
  const older = pts.filter((p) => p.ts <= now - 28 * DAY);
  const d = older.length ? best - Math.max(...older.map((p) => p.e1)) : null;
  const label = exName(name, locale);
  const open = () => shell.openOverlay({ screen: 'exercise-history', name });
  const delta = d !== null ? <WidgetDelta good={d >= 0}>{s.delta4w(signed(d))}</WidgetDelta> : null;
  const spark = (h: number) => (
    <WidgetSpark points={pts.slice(-12).map((p) => p.e1)} height={h} tone="ok" area={h < 80} />
  );

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="accent"
        icon="trend-up"
        title={`${label} · ${best} kg`}
        sub={s.e1rmShort}
        trailing={d !== null ? <WidgetDelta good={d >= 0}>{signed(d)}</WidgetDelta> : undefined}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="accent"
        kicker={s.e1rmOf(label)}
        value={best}
        unit="kg"
        sub={delta ?? s.e1rmShort}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="accent"
        kicker={s.e1rmOf(label)}
        badge={delta}
        value={best}
        unit="kg"
        bodyLast
        onClick={open}
      >
        {spark(56)}
      </Widget>
    );
  const recent = pts
    .slice(-3)
    .reverse()
    .map((p) => ({
      label: [fmtWeekdayShort(p.ts, locale), p.day].filter(Boolean).join(' · '),
      value: `${p.sets} × ${p.reps} · ${p.weight} kg`,
    }));
  return (
    <>
      <Widget
        size="XL"
        tone="accent"
        kicker={s.liftXl(label)}
        badge={
          <ToneText tone="ok" strong>
            {s.prAgo(Math.floor((now - bestAt) / DAY))}
          </ToneText>
        }
        value={best}
        unit="kg"
        sub={delta}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={() => setPicking(true)}>
            {s.changeLift}
          </Button>
        }
      >
        {spark(96)}
        <WidgetList rows={recent} />
      </Widget>
      {sheet}
    </>
  );
}

const liftRecord: WidgetDef = {
  id: 'lift-record',
  group: 'training',
  icon: 'trend-up',
  tone: 'accent',
  name: () => trs(getLocale()).nLiftRecord,
  render: (size, ctx) => <LiftRecordWidget size={size} ctx={ctx} />,
};

/* ---------- Activities (this training week) ---------- */

function actTone(a: Activity): Tone {
  const c = activityTone(a.type, activityCategory(a));
  return c === 'sport' ? 'sport' : c === 'recovery' ? 'rest' : 'active';
}

const activities: WidgetDef = {
  id: 'activities-week',
  group: 'training',
  icon: 'person-simple-run',
  tone: 'active',
  name: () => trs(getLocale()).nActivities,
  render: (size, { store, now, t, tw, locale, shell }) => {
    const s = trs(locale);
    const from = weekStartOf(now);
    const list = (store.activities ?? [])
      .filter((a) => a.finishedAt !== null && a.startedAt >= from && a.startedAt <= now)
      .sort((a, b) => a.startedAt - b.startedAt);
    const log = () => shell.openOverlay({ screen: 'log-activity' });
    const open = () => shell.openOverlay({ screen: 'history' });
    if (!list.length)
      return (
        <WidgetEmpty
          size={size}
          tone="active"
          icon="person-simple-run"
          kicker={s.activeWeek}
          title={s.noActivities}
          sub={s.noActivitiesSub}
          action={s.logActivity}
          onAction={log}
        />
      );
    const bodyKg = latestWeight(store.bodyMetrics)?.weight ?? null;
    const typeName = (a: Activity) => t.actType[a.type] ?? a.type;
    const mins = Math.round(list.reduce((sum, a) => sum + durationMin(a), 0));
    const kcal = list.reduce((sum, a) => sum + (activityCalories(a, bodyKg) ?? 0), 0);
    const byType = new Map<string, { name: string; min: number; tone: Tone }>();
    for (const a of list) {
      const cur = byType.get(a.type) ?? { name: typeName(a), min: 0, tone: actTone(a) };
      cur.min += durationMin(a);
      byType.set(a.type, cur);
    }
    const types = [...byType.values()].sort((a, b) => b.min - a.min);
    const kcalTxt = kcal > 0 ? s.kcal(thousands(kcal)) : undefined;

    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="active"
          icon="person-simple-run"
          title={s.minActive(mins)}
          sub={types.map((x) => x.name).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="active"
          kicker={s.activeWeek}
          value={mins}
          unit={s.min}
          sub={s.activitiesN(list.length)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="active"
          kicker={tw.thisWeek}
          badge={kcalTxt}
          value={mins}
          unit={s.min}
          sub={
            <Row gap={12}>
              {types.slice(0, 3).map((x) => (
                <ToneText key={x.name} tone={x.tone}>
                  {`${x.name} ${Math.round(x.min)}`}
                </ToneText>
              ))}
            </Row>
          }
          bodyLast
          onClick={open}
        >
          <StackBar parts={types.slice(0, 4).map((x) => ({ value: x.min, tone: x.tone }))} />
        </Widget>
      );
    const rows = list
      .slice(-4)
      .reverse()
      .map((a) => ({
        icon: activityType(a.type)?.icon ?? 'pulse',
        tone: actTone(a),
        label: typeName(a),
        value: [
          fmtWeekdayShort(a.startedAt, locale),
          a.distanceKm ? `${a.distanceKm} km` : null,
          `${Math.round(durationMin(a))} ${s.min}`,
        ]
          .filter(Boolean)
          .join(' · '),
      }));
    return (
      <Widget
        size="XL"
        tone="active"
        kicker={s.activitiesWeek}
        badge={kcalTxt}
        value={mins}
        unit={s.min}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" icon="plus" fullWidth onClick={log}>
            {s.logActivity}
          </Button>
        }
      >
        <WidgetList rows={rows} />
      </Widget>
    );
  },
};

/* ---------- Weekly recap (the last closed training week) ---------- */

interface WeekRecap {
  lo: number;
  hi: number;
  sessions: number;
  tonnes: string;
  prs: number;
  /** Beats this many weeks back (0 = not the biggest recently; -1 = ever). */
  biggestIn: number;
  topMuscle: { m: MuscleGroup; sets: number } | null;
}

function lastWeekRecap(finished: Workout[], now: number): WeekRecap | null {
  const hi = weekStartOf(now);
  const lo = weekStartOf(hi - DAY);
  const ws = finished.filter((w) => w.startedAt >= lo && w.startedAt < hi);
  if (!ws.length) return null;
  const volOf = (a: number, b: number) =>
    finished
      .filter((w) => w.startedAt >= a && w.startedAt < b)
      .reduce((sum, w) => sum + workoutVolumeKg(w), 0);
  const vol = ws.reduce((sum, w) => sum + workoutVolumeKg(w), 0);
  // PRs: a lift's best e1RM this week beating its best before the week.
  const before = new Map<string, number>();
  const during = new Map<string, number>();
  for (const w of finished) {
    if (w.startedAt >= hi) continue;
    const into = w.startedAt < lo ? before : during;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim().toLowerCase();
      const best = Math.max(0, ...e.sets.map((x) => setBestE1rm(x)));
      if (best > (into.get(key) ?? 0)) into.set(key, best);
    }
  }
  let prs = 0;
  for (const [k, v] of during) if ((before.get(k) ?? 0) > 0 && v > (before.get(k) ?? 0)) prs++;
  // How far back this week's tonnage is the biggest.
  const earliest = Math.min(...finished.map((w) => w.startedAt));
  let biggestIn = -1;
  for (let k = 1; lo - k * WEEK >= earliest - WEEK && k <= 52; k++) {
    if (volOf(lo - k * WEEK, lo - (k - 1) * WEEK) >= vol) {
      biggestIn = k - 1;
      break;
    }
  }
  if (biggestIn === -1 && earliest >= lo) biggestIn = 0; // first week ever: nothing to beat
  const sets = new Map<MuscleGroup, number>();
  for (const w of ws)
    for (const [m, n] of muscleSetsInWorkout(w)) sets.set(m, (sets.get(m) ?? 0) + n);
  const top = [...sets.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    lo,
    hi,
    sessions: ws.length,
    tonnes: (vol / 1000).toFixed(1),
    prs,
    biggestIn,
    topMuscle: top ? { m: top[0], sets: Math.round(top[1]) } : null,
  };
}

function recapPeriodLabel(e: RecapEntry, locale: LocaleId): string {
  if (e.ref.kind === 'month') return fmtMonthYear(e.ref.start, locale);
  if (e.ref.kind === 'quarter') return `Q${e.ref.index} ${e.ref.year}`;
  return String(e.ref.year);
}

const weeklyRecap: WidgetDef = {
  id: 'weekly-recap',
  group: 'training',
  icon: 'bookmark-simple',
  tone: 'accent',
  name: () => trs(getLocale()).nWeeklyRecap,
  render: (size, { store, now, t, locale, shell }) => {
    const s = trs(locale);
    const r = lastWeekRecap(finishedOf(store.workouts), now);
    const openHistory = () => shell.openOverlay({ screen: 'history' });
    if (!r)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="bookmark-simple"
          kicker={s.recap}
          title={s.noRecap}
          sub={s.noRecapSub}
          action={s.startSession}
          onAction={shell.openStart}
        />
      );
    const range = `${fmtDayMonth(r.lo, locale)} – ${fmtDayMonth(r.hi - DAY, locale)}`;
    const story = (
      <WidgetDots values={[true, false, false, false, false]} height={3} tone="accent" />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="bookmark-simple"
          title={s.weekReady}
          sub={`${range} · ${s.sessionsN(r.sessions)}`}
          onClick={openHistory}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.recap}
          badge={<ToneText tone="accent">●</ToneText>}
          title={s.weekReady}
          sub={`${range} · ${s.prsN(r.prs)}`}
          onClick={openHistory}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.recapRange(range)}
          title={`${s.sessionsN(r.sessions)} · ${r.tonnes} t · ${s.prsN(r.prs)}`}
          bodyLast
          onClick={openHistory}
        >
          {story}
        </Widget>
      );
    const ready = availableRecaps(store.workouts, now).find((e) => e.status === 'ready');
    const line =
      r.biggestIn === -1
        ? s.bestWeekEver
        : r.biggestIn >= 2
          ? s.bestWeekIn(r.biggestIn + 1)
          : r.topMuscle
            ? s.topMuscle(t.muscleGroups[r.topMuscle.m] ?? r.topMuscle.m, r.topMuscle.sets)
            : undefined;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.recapRange(range)}
        value={
          <span className="ul-block" style={{ lineHeight: 1.2 }}>
            {s.bigSessions(r.sessions)}
            <br />
            {s.bigTonnes(r.tonnes)}
            <br />
            {s.bigPrs(r.prs)}
          </span>
        }
        sub={line}
        onClick={openHistory}
        footer={
          ready ? (
            <Button
              variant="primary"
              size="sm"
              icon="play"
              fullWidth
              onClick={() => shell.openOverlay({ screen: 'recap-story', period: ready.ref.id })}
            >
              {s.watchRecap(recapPeriodLabel(ready, locale))}
            </Button>
          ) : (
            <Button variant="primary" size="sm" fullWidth onClick={openHistory}>
              {s.openHistory}
            </Button>
          )
        }
      >
        {story}
      </Widget>
    );
  },
};

/* ---------- Goals (physique target + block focus) ---------- */

const goals: WidgetDef = {
  id: 'goals',
  group: 'training',
  icon: 'target',
  tone: 'accent',
  name: () => trs(getLocale()).nGoals,
  render: (size, { store, now, t, locale }) => {
    const s = trs(locale);
    const open = () => goHash('#/goals');
    const physique = store.goals.physique;
    const { grow, ease } = focusLists(store.goals);
    if (!physique && !grow.length && !ease.length)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="target"
          kicker={s.goal}
          title={s.noGoal}
          sub={s.noGoalSub}
          action={s.setGoal}
          onAction={open}
        />
      );
    const fl = (f: FocusMuscle) =>
      (t.subMuscleNames as Record<string, string>)[f] ?? t.muscleGroups[focusToGroup(f)] ?? f;
    const arch = physique ? t.archetypes[physique.archetype] : undefined;
    const name = arch?.name ?? s.focus;
    const growNames = grow.map(fl);
    const easeNames = ease.map(fl);
    const hold = FOCUS_MUSCLES.filter((f) => !grow.includes(f) && !ease.includes(f));
    const chips = (list: FocusMuscle[], tone: ChipTone, mark: string, max: number) => (
      <Row>
        {list.slice(0, max).map((f) => (
          <Chip key={f} size="sm" tone={tone}>
            {`${fl(f)} ${mark}`}
          </Chip>
        ))}
        {list.length > max && (
          <Chip size="sm" tone="neutral">
            {`+${list.length - max}`}
          </Chip>
        )}
      </Row>
    );
    const easeLine = easeNames.length ? s.easeLine(easeNames.join(', ')) : s.restHold;

    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="target"
          title={`${name} · ${s.inFocusShort(grow.length)}`}
          sub={growNames.length ? s.growList(growNames.join(', ')) : easeLine}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.goal}
          title={name}
          sub={s.inFocus(grow.length)}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={s.goalOf(name)} sub={easeLine} onClick={open}>
          {grow.length > 0 && chips(grow, 'ok', '↑', 4)}
        </Widget>
      );
    // XL: the three emphasis rows + this week's sets vs the focus-raised target.
    const from = weekStartOf(now);
    const weekSets = new Map<MuscleGroup, number>();
    for (const w of finishedOf(store.workouts)) {
      if (w.startedAt < from) continue;
      for (const [m, n] of muscleSetsInWorkout(w)) weekSets.set(m, (weekSets.get(m) ?? 0) + n);
    }
    const plan = [...groupEmphasis(store.goals).entries()]
      .filter(([, e]) => e === 'grow')
      .map(([m]) => {
        const base = LANDMARKS[m]?.mav;
        return base == null
          ? null
          : {
              label: t.muscleGroups[m] ?? m,
              value: s.setsOf(Math.round(weekSets.get(m) ?? 0), base + FOCUS_MAV_DELTA),
            };
      })
      .filter((x): x is { label: string; value: string } => x !== null)
      .slice(0, 2);
    const rows: ({ label: ReactNode; value: string } | null)[] = [
      grow.length ? { label: chips(grow, 'ok', '↑', 3), value: s.grow } : null,
      { label: chips(hold, 'neutral', '=', 3), value: s.hold },
      ease.length ? { label: chips(ease, 'rest', '↓', 3), value: s.ease } : null,
    ];
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={physique ? s.goalArchetype : s.focus}
        badge={physique ? s.since(fmtDayMonth(physique.setAt, locale)) : undefined}
        title={name}
        sub={arch?.blurb}
        bodyLast
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.editGoal}
          </Button>
        }
      >
        <WidgetList
          rows={[
            ...rows.filter((x): x is { label: ReactNode; value: string } => x !== null),
            ...plan,
          ]}
        />
      </Widget>
    );
  },
};

/* ---------- Playbook (plays learned from history) ---------- */

function playName(p: Play, t: WidgetCtx['t']): string {
  return p.name ?? (p.readout ? dayReadoutLabel(p.readout, t) : t.playUntitled);
}

function suggestionText(sg: PlaySuggestion, ctx: WidgetCtx): string {
  const s = trs(ctx.locale);
  if (sg.kind === 'swap') return s.sugPlateau(exName(sg.exercise, ctx.locale));
  if (sg.reason === 'favorite') return s.sugFavorite(exName(sg.exercise, ctx.locale));
  return s.sugGap(ctx.t.muscleGroups[sg.muscle] ?? sg.muscle);
}

function PlaybookWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = trs(locale);
  const hour = Math.floor(now / HOUR);
  const finished = useMemo(() => finishedOf(store.workouts), [store.workouts]);
  const plays = useMemo(() => computePlaybook(finished, hour * HOUR).plays, [finished, hour]);
  const { withGym, gymPicker } = useGymStep();
  const open = () => shell.goPlaybook();
  if (!plays.length)
    return (
      <WidgetEmpty
        size={size}
        tone="accent"
        icon="cards"
        kicker={s.nPlaybook}
        title={s.noPlays}
        sub={s.noPlaysSub}
        action={s.startSession}
        onAction={shell.openStart}
      />
    );
  const today = playForWeekday(plays, new Date(now).getDay());
  const top = today ?? plays[0];
  const i = plays.indexOf(top) + 1;
  const name = playName(top, t);
  const reason = top.suggestions[0]
    ? suggestionText(top.suggestions[0], ctx)
    : s.playMeta(top.exercises.length, top.sessions);
  const start = () =>
    void withGym((gymId) => {
      const id = startPlaySession(top, t.defaultTimedExerciseNames.warmup, gymId);
      if (id) shell.openOverlay({ screen: 'session', workoutId: id });
    });
  const startBtn = (full: boolean) => (
    <Button variant="primary" size="sm" icon="play" fullWidth={full} onClick={start}>
      {full ? s.startPlay : s.start}
    </Button>
  );
  const allBtn = (
    <Button variant="secondary" size="sm" onClick={open}>
      {s.allPlays}
    </Button>
  );
  let w: ReactNode;
  if (size === 'M')
    w = (
      <Widget
        size="M"
        tone="accent"
        icon="cards"
        title={s.playsLearned(plays.length)}
        sub={today ? s.todayPlay(name) : name}
        trailing={startBtn(false)}
        onClick={open}
      />
    );
  else if (size === 'S')
    w = (
      <Widget
        size="S"
        tone="accent"
        kicker={s.nPlaybook}
        badge={s.playsN(plays.length)}
        title={name}
        sub={reason}
        onClick={open}
      />
    );
  else if (size === 'L')
    w = (
      <Widget
        size="L"
        tone="accent"
        kicker={s.nPlaybook}
        badge={s.playOf(i, plays.length)}
        title={name}
        sub={reason}
        onClick={open}
        footer={
          <>
            {startBtn(false)}
            {allBtn}
          </>
        }
      />
    );
  else
    w = (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.playbookOf(i, plays.length)}
        badge={s.sessionsN(top.sessions)}
        title={name}
        sub={reason}
        bodyLast
        onClick={open}
        footer={
          <>
            <div className="uf-1 ul-flex">{startBtn(true)}</div>
            {allBtn}
          </>
        }
      >
        <WidgetList
          rows={top.exercises.slice(0, 5).map((ex) => ({
            label: exName(ex.name, locale),
            value: [
              `${ex.sets} × ${ex.repLow === ex.repHigh ? ex.repLow : `${ex.repLow}–${ex.repHigh}`}`,
              ex.topWeight != null ? `${ex.topWeight} kg` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          }))}
        />
      </Widget>
    );
  return (
    <>
      {w}
      {gymPicker}
    </>
  );
}

const playbook: WidgetDef = {
  id: 'playbook',
  group: 'training',
  icon: 'cards',
  tone: 'accent',
  name: () => trs(getLocale()).nPlaybook,
  render: (size, ctx) => <PlaybookWidget size={size} ctx={ctx} />,
};

/* ---------- Weak points (+ fix-it) ---------- */

function WeakPointsWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = trs(locale);
  const hour = Math.floor(now / HOUR);
  const finished = useMemo(() => finishedOf(store.workouts), [store.workouts]);
  const { weak, tracked } = useMemo(() => {
    const at = hour * HOUR;
    const lm = personalLandmarks(finished, at);
    const weeks = new Set(
      finished
        .filter((w) => w.startedAt >= at - 6 * WEEK)
        .map((w) => Math.floor((at - w.startedAt) / WEEK)),
    );
    return { weak: volumeWeakPoints(finished, at, 6, lm), tracked: weeks.size };
  }, [finished, hour]);
  const gym = activeGym(store.gyms, finished);
  const fixes = useMemo(
    () =>
      size === 'XL'
        ? weak
            .slice(0, 2)
            .flatMap((wp, i) =>
              fixCandidates(wp.muscle, gym, i === 0 ? 2 : 1).map((c) => ({ c, m: wp.muscle })),
            )
        : [],
    [size, weak, gym],
  );
  const open = () => goHash('#/progress/volume');
  const mName = (m: MuscleGroup) => t.muscleGroups[m] ?? m;
  if (!weak.length)
    return (
      <WidgetEmpty
        size={size}
        tone="injury"
        icon="user-focus"
        kicker={s.nWeakPoints}
        title={tracked < 3 ? s.weakNeedHistory : s.noWeak}
        sub={s.noWeakSub}
        onAction={open}
      />
    );
  const names = weak.map((w) => mName(w.muscle));
  const add = (c: FixCandidate) => {
    const plan = {
      plannedSets: c.scheme.sets,
      plannedReps: c.scheme.reps,
      primaryMuscle: c.primary,
      secondaryMuscles: c.secondary,
      equipment: c.equipment,
    };
    const live = store.workouts.find((w) => w.finishedAt === null) ?? startWorkout(gym?.id ?? null);
    if (!live) return;
    addExercise(live.id, c.name, 'strength', plan);
    shell.openOverlay({ screen: 'session', workoutId: live.id });
  };
  const barRows = (n: number) =>
    weak.slice(0, n).map((w) => ({
      label: (
        <span className="ul-flex ul-col ug-4">
          {mName(w.muscle)}
          <WidgetBar value={w.avgSets / w.mev} tone="injury" height={4} />
        </span>
      ),
      value: (
        <ToneText tone="injury" strong>
          {s.setsOf(w.avgSets, w.mev)}
        </ToneText>
      ),
    }));

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="injury"
        icon="user-focus"
        title={s.weakN(weak.length)}
        sub={names.join(' · ')}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="injury"
        kicker={s.nWeakPoints}
        value={weak.length}
        unit={s.lagging}
        sub={names.join(' · ')}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="injury" kicker={s.nWeakPoints} onClick={open}>
        <WidgetList rows={barRows(2)} />
      </Widget>
    );
  const fixRows = fixes.map(({ c, m }) => ({
    label: `${exName(c.name, locale)} · ${mName(m)} · ${c.scheme.label}`,
    value: (
      <Button variant="primary" size="sm" icon="plus" onClick={() => add(c)}>
        {s.add}
      </Button>
    ),
  }));
  return (
    <Widget
      size="XL"
      tone="injury"
      kicker={s.weakWeeks(6)}
      badge={s.underWeeks(weak[0].weeksUnder, weak[0].weeksTracked)}
      onClick={open}
    >
      <WidgetList rows={barRows(2)} />
      {fixRows.length > 0 && (
        <>
          <ToneText tone="injury" strong>
            {gym ? s.fixAt(gym.name) : s.fixIt}
          </ToneText>
          <WidgetList rows={fixRows} />
        </>
      )}
    </Widget>
  );
}

const weakPoints: WidgetDef = {
  id: 'weak-points',
  group: 'training',
  icon: 'user-focus',
  tone: 'injury',
  name: () => trs(getLocale()).nWeakPoints,
  render: (size, ctx) => <WeakPointsWidget size={size} ctx={ctx} />,
};

/* ---------- Fatigue & deload ---------- */

/** Same bands as fatigue.ts levelOf, on the 0–100 load index. */
export function levelOfIdx(idx: number): FatigueLevel {
  // Nicotine lowers the 'high' / 'fried' lines exactly as fatigue.ts does (x1 when off).
  const k = deloadMult();
  if (idx >= 70 * k) return 'fried';
  if (idx >= 40 * k) return 'high';
  if (idx >= 15) return 'moderate';
  return 'fresh';
}
const LEVEL_TONE: Record<FatigueLevel, Tone> = {
  fresh: 'ok',
  moderate: 'accent',
  high: 'accent',
  fried: 'danger',
};

function FatigueWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale } = ctx;
  const s = trs(locale);
  const hour = Math.floor(now / HOUR);
  const finished = useMemo(() => finishedOf(store.workouts), [store.workouts]);
  const data = useMemo(() => {
    const at = hour * HOUR;
    const lm = personalLandmarks(finished, at);
    // Load index = mean of the five most-loaded muscles' fatigue scores.
    const indexAt = (ts: number) => {
      const fat = muscleFatigue(
        finished.filter((w) => w.startedAt <= ts),
        ts,
        lm,
      );
      const top = [...fat.values()]
        .map((f) => f.score)
        .sort((a, b) => b - a)
        .slice(0, 5);
      return { fat, idx: Math.round((top.reduce((a, b) => a + b, 0) / (top.length || 1)) * 100) };
    };
    const cur = indexAt(at);
    const trend = [5, 4, 3, 2, 1].map((k) => indexAt(at - k * WEEK).idx).concat(cur.idx);
    const deload = deloadSuggestion(
      cur.fat,
      activityRecoveryBias(store.activities, at) +
        0.6 *
          sleepReadinessBias(
            store.sleeps,
            at,
            store.sleepSettings?.goalMin ?? 480,
            sleepNeedExtraMin(at),
          ),
    );
    const vol = (a: number, b: number) =>
      finished
        .filter((w) => w.startedAt >= a && w.startedAt < b)
        .reduce((sum, w) => sum + workoutVolumeKg(w), 0);
    const wk = vol(at - WEEK, at);
    const prev = [1, 2, 3, 4]
      .map((k) => vol(at - (k + 1) * WEEK, at - k * WEEK))
      .filter((v) => v > 0);
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    const muscles = [...cur.fat.values()];
    return {
      idx: cur.idx,
      trend,
      deload,
      volPct: avg > 0 ? Math.round(((wk - avg) / avg) * 100) : null,
      stalled: muscles.filter((f) => f.stalled).sort((a, b) => b.score - a.score),
      hottest: muscles.filter((f) => f.sets > 0).sort((a, b) => b.score - a.score)[0] ?? null,
      recent: finished.some((w) => w.startedAt >= at - 14 * DAY),
    };
  }, [finished, hour, store.activities, store.sleeps, store.sleepSettings]);
  const open = () => goHash('#/progress/volume/fatigue');
  const level = levelOfIdx(data.idx);
  const tone = LEVEL_TONE[level];
  const levelTxt = s.level[level];
  const mName = (m: MuscleGroup) => t.muscleGroups[m] ?? m;
  if (!data.recent)
    return (
      <WidgetEmpty
        size={size}
        tone="rest"
        icon="gauge"
        kicker={s.fatigue}
        title={s.level.fresh}
        sub={s.noFatigue}
        onAction={open}
      />
    );
  const hint =
    data.deload.kind === 'systemic'
      ? s.deloadSystemic
      : data.deload.kind === 'local' && data.deload.muscle
        ? s.deloadLocal(mName(data.deload.muscle))
        : s.deloadNone;
  const levelBadge = (
    <ToneText tone={tone} strong>
      {levelTxt}
    </ToneText>
  );

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="rest"
        icon="gauge"
        title={s.fatigueIs(levelTxt)}
        sub={hint}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="rest"
        kicker={s.fatigue}
        badge={levelBadge}
        value={data.idx}
        unit="/ 100"
        sub={hint}
        bodyLast
        onClick={open}
      >
        <WidgetBar value={data.idx / 100} tone={tone} />
      </Widget>
    );
  if (size === 'L') {
    const title = data.stalled[0]
      ? s.stalledTitle(mName(data.stalled[0].muscle))
      : data.deload.kind !== 'none'
        ? hint
        : s.lowFatigue;
    return (
      <Widget
        size="L"
        tone="rest"
        kicker={s.fatigue}
        badge={levelBadge}
        title={title}
        sub={title === hint ? undefined : hint}
        bodyLast
        onClick={open}
      >
        <WidgetBar value={data.idx / 100} tone={tone} height={8} />
      </Widget>
    );
  }
  const rows: { label: ReactNode; value: ReactNode }[] = [];
  if (data.stalled[0])
    rows.push({
      label: mName(data.stalled[0].muscle),
      value: <ToneText tone="injury">{s.stalled}</ToneText>,
    });
  if (data.hottest)
    rows.push({
      label: mName(data.hottest.muscle),
      value: s.nearLimit(Math.round(data.hottest.sets), data.hottest.mrv),
    });
  if (data.volPct !== null)
    rows.push({ label: s.volumeWeek, value: s.vs4(`${signed(data.volPct, 0)}%`) });
  return (
    <Widget
      size="XL"
      tone="rest"
      kicker={s.fatigue6}
      badge={hint}
      value={data.idx}
      unit={s.of100(levelTxt)}
      bodyLast
      onClick={open}
      footer={
        <Button
          variant={data.deload.kind !== 'none' ? 'primary' : 'secondary'}
          size="sm"
          fullWidth
          onClick={open}
        >
          {data.deload.kind !== 'none' ? s.planDeload : s.openFatigue}
        </Button>
      }
    >
      <WidgetSpark points={data.trend} height={72} tone={tone} area />
      <WidgetList rows={rows} />
    </Widget>
  );
}

const fatigue: WidgetDef = {
  id: 'fatigue-deload',
  group: 'training',
  icon: 'gauge',
  tone: 'rest',
  name: () => trs(getLocale()).nFatigue,
  render: (size, ctx) => <FatigueWidget size={size} ctx={ctx} />,
};

/* ---------- Gyms (the gym you train at) ---------- */

/** The app's last cached location fix (store.ts writes it); never prompts. */
function cachedPosition(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem('spotter.lastPos');
    if (!raw) return null;
    const p = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    return typeof p.lat === 'number' && typeof p.lng === 'number'
      ? { lat: p.lat, lng: p.lng }
      : null;
  } catch {
    return null;
  }
}

function GymWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale, shell } = ctx;
  const s = trs(locale);
  const hour = Math.floor(now / HOUR);
  const finished = useMemo(() => finishedOf(store.workouts), [store.workouts]);
  const gym = activeGym(store.gyms, finished);
  // XL only: does today's usual play fit this gym's kit?
  const fit = useMemo(() => {
    if (size !== 'XL' || !gym) return null;
    const plays = computePlaybook(finished, hour * HOUR).plays;
    const play = playForWeekday(plays, new Date(hour * HOUR).getDay()) ?? plays[0];
    if (!play) return null;
    const lifts = play.exercises.filter((e) => e.kind === 'strength');
    const ok = lifts.filter((e) => missingAtGym(gym, exerciseNeeds(e.name)).length === 0).length;
    return { name: playName(play, t), ok, total: lifts.length };
  }, [size, gym, finished, hour, t]);
  if (!gym)
    return (
      <WidgetEmpty
        size={size}
        tone="neutral"
        icon="map-pin"
        kicker={s.myGym}
        title={s.noGym}
        sub={s.noGymSub}
        action={s.findGym}
        onAction={() => shell.goTab('gyms')}
      />
    );
  const visits = finished.filter((w) => w.gymId === gym.id);
  const last = visits.length ? Math.max(...visits.map((w) => w.startedAt)) : null;
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const month = visits.filter((w) => w.startedAt >= monthStart).length;
  const pos = cachedPosition();
  const km = pos ? s.km((haversineM(pos, gym) / 1000).toFixed(1)) : null;
  const lastTxt = last !== null ? s.daysAgo(Math.floor((now - last) / DAY)) : null;
  const open = () => shell.openOverlay({ screen: 'gym', gymId: gym.id });
  const start = () => {
    const w = startWorkout(gym.id);
    if (w) shell.openOverlay({ screen: 'session', workoutId: w.id });
  };
  const startBtn = (full: boolean) => (
    <Button variant="primary" size="sm" icon="barbell" fullWidth={full} onClick={start}>
      {s.startHere}
    </Button>
  );

  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="neutral"
        icon="map-pin"
        title={km ? `${gym.name} · ${km}` : gym.name}
        sub={lastTxt ? s.lastVisit(lastTxt) : s.noVisits}
        onClick={open}
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="neutral"
        kicker={s.myGym}
        title={gym.name}
        sub={[km, lastTxt].filter(Boolean).join(' · ') || s.noVisits}
        onClick={open}
      />
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="neutral"
        kicker={s.myGym}
        badge={km ?? undefined}
        title={gym.name}
        sub={visits.length ? s.visitsMonth(month) : s.noVisits}
        onClick={open}
        footer={startBtn(false)}
      />
    );
  const kit = gym.inventory ?? [];
  const fitTxt = fit
    ? fit.ok === fit.total
      ? s.fitsHere(fit.name)
      : s.partlyFits(fit.name, fit.ok, fit.total)
    : null;
  return (
    <Widget
      size="XL"
      tone="neutral"
      kicker={s.myGym}
      badge={km ?? undefined}
      title={gym.name}
      sub={[lastTxt ? s.lastVisit(lastTxt) : s.noVisits, s.visitsMonth(month)].join(' · ')}
      onClick={open}
      footer={startBtn(true)}
    >
      <div className="ul-grid uf-1" style={{ placeItems: 'center' }}>
        <IconTile tone="neutral" size={56} icon="map-pin" />
      </div>
      <Row>
        {kit.length ? (
          <>
            {kit.slice(0, 5).map((id) => (
              <Chip key={id} size="sm" tone="neutral">
                {equipmentLabel(id)}
              </Chip>
            ))}
            {kit.length > 5 && (
              <Chip size="sm" tone="neutral">
                {`+${kit.length - 5}`}
              </Chip>
            )}
          </>
        ) : (
          <Chip size="sm" tone="neutral">
            {s.noInventory}
          </Chip>
        )}
      </Row>
      {fitTxt && <ToneText tone={fit && fit.ok === fit.total ? 'ok' : 'accent'}>{fitTxt}</ToneText>}
    </Widget>
  );
}

const gyms: WidgetDef = {
  id: 'my-gym',
  group: 'training',
  icon: 'map-pin',
  tone: 'neutral',
  name: () => trs(getLocale()).nGyms,
  render: (size, ctx) => <GymWidget size={size} ctx={ctx} />,
};

export const TRAINING_WIDGETS: WidgetDef[] = [
  volume,
  liftRecord,
  activities,
  weeklyRecap,
  goals,
  playbook,
  weakPoints,
  fatigue,
  gyms,
];
