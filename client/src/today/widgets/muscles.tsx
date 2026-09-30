/**
 * Muscles & consistency widgets (design board L7 "Muscles & habits"): the
 * body heat map, volume landmarks, stimulus left today, left/right balance,
 * muscle of the week, frequency, push/pull/legs split, the consistency
 * heat map, weekly goal, sessions per month, best training time and the
 * back-on-track ramp. Built on volume.ts, personalize.ts, goals.ts,
 * stimulus.ts, recovery.ts, weekStart.ts, the program cache and the store.
 */
import { useState, type ReactNode } from 'react';
import { Field } from '../../components/ui/Field';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDots,
  WidgetList,
  WidgetRing,
  WidgetStats,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import type { Tone } from '../../components/ui/tones';
import { MuscleHeatmap } from '../../components/Muscle';
import { Sheet } from '../../ui';
import {
  LANDMARKS,
  ZONE_COLOR,
  classifyZone,
  weeklyMuscleSets,
  type Landmark,
  type Zone,
} from '../../volume';
import { cachedPersonalLandmarks, weeklyMuscleSeries } from '../../personalize';
import { focusAdjustLandmarks } from '../../goals';
import { sessionPlateau } from '../../stimulus';
import { muscleReadiness } from '../../recovery';
import {
  est1rm,
  isStrengthExercise,
  muscleSetsInWorkout,
  prescribedTrainingDays,
  resolveMuscles,
  setTypeOf,
  sidesMode,
  workoutVolumeKg,
} from '../../store';
import { muscleInfoByName, type MuscleGroup } from '../../data/exercises';
import { exerciseDay } from '../../data/daySuggest';
import {
  programDayItems,
  programDayMuscles,
  programDayName,
  readProgramCache,
} from '../../data/programMine';
import { isoWeekday, weekOrder, weekStartOf } from '../../weekStart';
import { fmtDayMonth, fmtWeekdayShort, getLocale, type LocaleId } from '../../i18n';
import type { StoreState } from '../../store';
import type { Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY } from './format';
import {
  Muted,
  NoteAction,
  StackBar,
  Swatch,
  Tag,
  TwoLine,
  WEEK,
  exName,
  finishedOf,
  fmtKg,
  hourKey,
  memoOn,
  nextPlan,
  useLocal,
} from './strength';
import { ms, type MusclesStrings } from './muscles.strings';

/** XL heatmap width: two figures ≈ 1 : 2.8 each, so ~165 px keeps them ≈ 220 px
 *  tall and the XL tile square (a % width made it grow 110–160 px taller). */
const HEATMAP_XL_W = 'min(88%, 165px)';

/* =====================================================================
 * Shared helpers
 * ===================================================================== */

/** The eight headline muscles the widgets report on. */
const MAJOR: MuscleGroup[] = [
  'chest',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'calves',
];

/** Working (non-warm-up) strength sets in a session. */
function workingSets(w: Workout): number {
  let n = 0;
  for (const e of w.exercises)
    if (isStrengthExercise(e)) n += e.sets.filter((s) => setTypeOf(s) !== 'warmup').length;
  return n;
}

const mName = (t: WidgetCtx['t'], m: string): string => t.muscleGroups[m] ?? m;

/** Personal landmarks (history-tuned), shifted by the block focus in Goals. */
function landmarksOf(store: StoreState, now: number): Map<MuscleGroup, Landmark> {
  return memoOn(store.workouts, `lm:${hourKey(now)}:${JSON.stringify(store.goals ?? {})}`, () =>
    focusAdjustLandmarks(cachedPersonalLandmarks(store.workouts, now), store.goals),
  );
}

/** A Monday (for weekday labels by ISO day). */
const MONDAY = new Date(2024, 0, 1).getTime();
function dayLabel(iso: number, locale: LocaleId): string {
  return fmtWeekdayShort(MONDAY + (iso - 1) * DAY, locale).slice(0, 2);
}

/** Same date locales as i18n's fmtDayMonth, so short months match ("Sep", not "Sept"). */
const TAG: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};
function monthName(ts: number, locale: LocaleId, short = false): string {
  const s = new Intl.DateTimeFormat(TAG[locale], { month: short ? 'short' : 'long' }).format(
    new Date(ts),
  );
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\./g, '');
}

/** Muscles a program day trains: its target muscles plus its lifts' primaries. */
function programMuscles(day: number): { name: string | null; muscles: MuscleGroup[] } | null {
  const a = readProgramCache();
  if (!a) return null;
  const set = new Set<MuscleGroup>(programDayMuscles(a, day));
  for (const it of programDayItems(a, day)) {
    if (it.kind !== 'strength') continue;
    const p = muscleInfoByName(it.name)?.primary;
    if (p) set.add(p);
  }
  if (set.size === 0) return null;
  return { name: programDayName(a, day, (d) => String(d)), muscles: [...set] };
}

/** Coarse → landmarked fine muscles. */
function expand(m: MuscleGroup): MuscleGroup[] {
  if (m === 'back') return ['lats', 'traps'];
  if (m === 'fullbody') return MAJOR;
  if (m === 'cardio') return [];
  return [m];
}

/** A small square cell (heat maps, frequency dots). */
function Cell({
  bg,
  outline,
  round = false,
  size,
  children,
}: {
  bg: string;
  outline?: string;
  round?: boolean;
  size?: number;
  children?: ReactNode;
}) {
  return (
    <span
      className="uiw-t-xs ut-text"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size ?? '100%',
        height: size,
        aspectRatio: size ? undefined : '1 / 1',
        background: bg,
        borderRadius: round ? 'var(--radius-pill)' : 'var(--radius-sm)',
        boxShadow: outline ? `inset 0 0 0 1.5px ${outline}` : undefined,
      }}
    >
      {children}
    </span>
  );
}

const goHash = (h: string) => () => {
  window.location.hash = h;
};

/* =====================================================================
 * 1. Muscle map (sets per muscle, 7 days)
 * ===================================================================== */

function heatColor(sets: number): string | undefined {
  if (sets <= 0) return undefined;
  if (sets < 5) return 'var(--color-accent-800)';
  if (sets < 10) return 'var(--color-accent-600)';
  if (sets < 15) return 'var(--color-accent-500)';
  return 'var(--color-accent-300)';
}

const muscleMap: WidgetDef = {
  id: 'muscle-map',
  group: 'muscles',
  icon: 'person-arms-spread',
  tone: 'accent',
  name: () => ms(getLocale()).muscleMap,
  render: (size, { store, now, t, locale }) => {
    const s = ms(locale);
    const open = goHash('#/progress/volume');
    const fin = finishedOf(store.workouts);
    const per = weeklyMuscleSets(fin, now, 7);
    const total = fin
      .filter((w) => w.startedAt >= now - 7 * DAY)
      .reduce((n, w) => n + workingSets(w), 0);
    if (total === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="person-arms-spread"
          kicker={s.last7}
          title={s.mapEmpty}
          sub={s.mapEmptySub}
          onAction={open}
        />
      );
    const colors: Partial<Record<MuscleGroup, string>> = {};
    for (const [m, n] of per) {
      const c = heatColor(n);
      if (c && m !== 'cardio') colors[m] = c;
    }
    const ranked = MAJOR.map((m) => ({ m, n: Math.round(per.get(m) ?? 0) })).sort(
      (a, b) => b.n - a.n,
    );
    const most = ranked[0];
    const least = ranked[ranked.length - 1];
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="person-arms-spread"
          title={s.leads(mName(t, most.m), most.n)}
          sub={s.mapSub(total, mName(t, least.m), least.n)}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="accent" kicker={s.last7} onClick={open}>
          <div className="ul-flex ug-10 ua-center uf-1" style={{ minHeight: 0 }}>
            <MuscleHeatmap colors={colors} width={64} />
            <div className="ul-flex ul-col umw-0">
              <Muted>{s.most}</Muted>
              <span className="uiw-t-md">{mName(t, most.m)}</span>
              <span className="uiw-value uiw-t-xl">
                {most.n}
                <span className="uiw-unit">{s.sets}</span>
              </span>
              <Muted>{`${mName(t, least.m)} ${least.n}`}</Muted>
            </div>
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" onClick={open}>
          <div className="ul-flex ug-14 ua-center uf-1" style={{ minHeight: 0 }}>
            <MuscleHeatmap colors={colors} width={140} />
            <div className="ul-flex ul-col ug-2 uf-1 umw-0">
              <span className="uiw-kicker">{s.volume7}</span>
              <span className="uiw-value">
                {total}
                <span className="uiw-unit">{s.sets}</span>
              </span>
              {[ranked[0], ranked[1], least].map((r) => (
                <span key={r.m} className="uiw-t-base ul-flex uj-between">
                  <Muted>{mName(t, r.m)}</Muted>
                  <b>{r.n}</b>
                </span>
              ))}
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.mapKicker}
        badge={`${total} ${s.sets}`}
        onClick={open}
        footer={
          <NoteAction
            note={s.mostLeast(`${mName(t, most.m)} ${most.n}`, `${mName(t, least.m)} ${least.n}`)}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.details}
              </Button>
            }
          />
        }
      >
        <div className="uf-1 ul-flex uj-center" style={{ minHeight: 0 }}>
          <MuscleHeatmap colors={colors} width={HEATMAP_XL_W} />
        </div>
        <div className="uiw-t-sm ul-flex ug-10 ul-wrap">
          <Muted>{s.setsLegend}</Muted>
          <Swatch color="var(--color-accent-800)">&lt;5</Swatch>
          <Swatch color="var(--color-accent-600)">5–9</Swatch>
          <Swatch color="var(--color-accent-500)">10–14</Swatch>
          <Swatch color="var(--color-accent-300)">15+</Swatch>
        </div>
      </Widget>
    );
  },
};

/* =====================================================================
 * 2. Volume landmarks (personal MEV / MAV / MRV vs 7-day sets)
 * ===================================================================== */

/** Range bar: MEV–MRV band, MEV–MAV sweet spot, and the current sets tick. */
function LandmarkBar({ sets, lm, zone }: { sets: number; lm: Landmark; zone: Zone }) {
  const max = Math.max(lm.mrv * 1.15, sets + 1);
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <span
      className="ur-sm tw-bg-n800 ul-block"
      style={{ position: 'relative', height: 8 }}
      aria-hidden
    >
      <span
        className="ur-sm tw-bg-n700"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: pos(lm.mev),
          width: `calc(${pos(lm.mrv)} - ${pos(lm.mev)})`,
        }}
      />
      <span
        className="ur-sm tw-bg-ok-line"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: pos(lm.mev),
          width: `calc(${pos(lm.mav)} - ${pos(lm.mev)})`,
        }}
      />
      <span
        className="ur-sm"
        style={{
          position: 'absolute',
          top: -3,
          left: `calc(${pos(sets)} - 2px)`,
          width: 4,
          height: 14,
          background: ZONE_COLOR[zone],
        }}
      />
    </span>
  );
}

interface LmRow {
  m: MuscleGroup;
  sets: number;
  lm: Landmark;
  zone: Zone;
}

function landmarkRows(store: StoreState, now: number): LmRow[] {
  const lms = landmarksOf(store, now);
  const per = weeklyMuscleSets(finishedOf(store.workouts), now, 7);
  return MAJOR.map((m) => {
    const lm = lms.get(m) ?? (LANDMARKS[m] as Landmark);
    const sets = Math.round((per.get(m) ?? 0) * 2) / 2;
    return { m, sets, lm, zone: classifyZone(sets, lm) };
  });
}

const inRange = (z: Zone) => z === 'productive' || z === 'high';

const volumeLandmarks: WidgetDef = {
  id: 'volume-landmarks',
  group: 'muscles',
  icon: 'gauge',
  tone: 'ok',
  name: () => ms(getLocale()).landmarks,
  render: (size, { store, now, t, locale }) => {
    const s = ms(locale);
    const open = goHash('#/progress/volume');
    const rows = landmarkRows(store, now);
    if (rows.every((r) => r.sets === 0))
      return (
        <WidgetEmpty
          size={size}
          tone="ok"
          icon="gauge"
          kicker={s.landmarks}
          title={s.mapEmpty}
          sub={s.lmEmptySub}
          onAction={open}
        />
      );
    const good = rows.filter((r) => inRange(r.zone)).length;
    const over = rows
      .filter((r) => r.zone === 'over')
      .sort((a, b) => b.sets - b.lm.mrv - (a.sets - a.lm.mrv));
    const under = rows
      .filter((r) => r.zone === 'under' || r.zone === 'none')
      .sort((a, b) => b.lm.mev - b.sets - (a.lm.mev - a.sets));
    const worst = over[0] ?? under[0] ?? null;
    const worstLine = worst
      ? worst.zone === 'over'
        ? s.overMrv(mName(t, worst.m), fmtKg(worst.sets))
        : s.underMev(mName(t, worst.m), fmtKg(worst.sets))
      : s.allInRange;
    const row = (r: LmRow) => (
      <div
        key={r.m}
        className="ul-grid ug-8 ua-center"
        style={{ gridTemplateColumns: '78px 1fr 30px' }}
      >
        <Muted>{mName(t, r.m)}</Muted>
        <LandmarkBar sets={r.sets} lm={r.lm} zone={r.zone} />
        <span className="uiw-t-strong utx-right">{fmtKg(r.sets)}</span>
      </div>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone={over.length ? 'danger' : 'ok'}
          icon="gauge"
          title={worstLine}
          sub={s.inRangeOf(good, rows.length)}
          onClick={open}
          trailing={
            worst ? (
              <Chip size="sm">
                {worst.zone === 'over'
                  ? `MRV ${fmtKg(worst.lm.mrv)}`
                  : `MEV ${fmtKg(worst.lm.mev)}`}
              </Chip>
            ) : undefined
          }
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="ok"
          kicker={s.landmarksShort}
          value={good}
          unit={s.ofInRange(rows.length)}
          sub={worstLine}
          onClick={open}
          bodyLast
        >
          <div className="ul-grid ug-4" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
            {rows.map((r) => (
              <Cell key={r.m} bg={ZONE_COLOR[r.zone]} size={12} />
            ))}
          </div>
        </Widget>
      );
    const notable = [...over, ...under, ...rows.filter((r) => inRange(r.zone))].slice(0, 3);
    if (size === 'L')
      return (
        <Widget size="L" tone="ok" kicker={s.landmarks} badge={s.setsWeek} onClick={open}>
          <div className="ul-flex ul-col ug-8 umt-auto">{notable.map(row)}</div>
        </Widget>
      );
    const note = over[0]
      ? s.overNote(
          mName(t, over[0].m),
          fmtKg(Math.ceil(over[0].sets - over[0].lm.mrv)),
          under[0] ? mName(t, under[0].m) : null,
        )
      : under[0]
        ? s.underNote(mName(t, under[0].m), fmtKg(Math.ceil(under[0].lm.mev - under[0].sets)))
        : s.allInRange;
    return (
      <Widget
        size="XL"
        tone="ok"
        kicker={s.landmarks7}
        badge={s.setsWeek}
        onClick={open}
        footer={
          <NoteAction
            note={s.inRangeOf(good, rows.length)}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openVolume}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ul-col ug-8">{rows.map(row)}</div>
        <div className="uiw-t-sm ul-flex ug-12">
          <Swatch color="var(--color-ok-line)">{s.sweetSpot}</Swatch>
          <Swatch color="var(--color-neutral-700)">MEV–MRV</Swatch>
        </div>
        <WidgetStats items={[{ label: s.tip, value: note }]} />
      </Widget>
    );
  },
};

/* =====================================================================
 * 3. Stimulus left today (to MAV, capped by the per-session plateau)
 * ===================================================================== */

interface StimRow {
  m: MuscleGroup;
  target: number;
  done: number;
  left: number;
}

function stimulusToday(ctx: WidgetCtx): { name: string | null; rows: StimRow[] } | null {
  const { store, now } = ctx;
  const live = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const prog = programMuscles(isoWeekday(now));
  let muscles: MuscleGroup[] = prog?.muscles ?? [];
  if (muscles.length === 0 && live)
    muscles = [...muscleSetsInWorkout(live).keys()].filter((m) => m !== 'cardio');
  const fine = [...new Set(muscles.flatMap(expand))].filter((m) => LANDMARKS[m]);
  if (fine.length === 0) return null;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime();
  const fin = finishedOf(store.workouts);
  const before = new Map<MuscleGroup, number>();
  const today = new Map<MuscleGroup, number>();
  for (const w of [...fin, ...(live ? [live] : [])]) {
    if (w.startedAt < now - 7 * DAY) continue;
    const target = w.startedAt >= t0 ? today : before;
    for (const [m, n] of muscleSetsInWorkout(w)) target.set(m, (target.get(m) ?? 0) + n);
  }
  const lms = landmarksOf(store, now);
  const rows = fine.map((m) => {
    const lm = lms.get(m) ?? (LANDMARKS[m] as Landmark);
    const cap = sessionPlateau(lm.mrv, LANDMARKS[m]?.mrv);
    const target = Math.round(Math.max(0, Math.min(cap, lm.mav - (before.get(m) ?? 0))));
    const done = Math.round((today.get(m) ?? 0) * 2) / 2;
    return { m, target, done, left: Math.max(0, Math.round(target - done)) };
  });
  rows.sort((a, b) => b.left - a.left);
  return { name: prog?.name ?? live?.dayName ?? null, rows };
}

const stimulusLeft: WidgetDef = {
  id: 'stimulus-left',
  group: 'muscles',
  icon: 'target',
  tone: 'accent',
  name: () => ms(getLocale()).stimulus,
  render: (size, ctx) => {
    const { store, now, t, locale, shell } = ctx;
    const s = ms(locale);
    const live = store.workouts.find((w) => w.finishedAt === null) ?? null;
    const go = () =>
      live ? shell.openOverlay({ screen: 'session', workoutId: live.id }) : shell.openStart();
    const data = stimulusToday(ctx);
    if (!data)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="target"
          kicker={s.leftToday}
          title={s.stimEmpty}
          sub={s.stimEmptySub}
          onAction={go}
        />
      );
    const left = data.rows.reduce((n, r) => n + r.left, 0);
    const target = data.rows.reduce((n, r) => n + r.target, 0);
    const done = Math.min(target, target - left);
    const line = data.rows
      .filter((r) => r.left > 0)
      .slice(0, 3)
      .map((r) => `${mName(t, r.m)} ${r.left}`)
      .join(' · ');
    const kick = data.name ? s.leftTodayOf(data.name) : s.leftToday;
    const bar = (r: StimRow) => (
      <div
        key={r.m}
        className="ul-grid ug-8 ua-center"
        style={{ gridTemplateColumns: '84px 1fr 52px' }}
      >
        <Muted>{mName(t, r.m)}</Muted>
        <WidgetBar value={r.target ? r.done / r.target : 1} tone={r.left === 0 ? 'ok' : 'accent'} />
        <span className="uiw-t-strong utx-right">
          {size === 'XL'
            ? `${fmtKg(r.done)} / ${r.target}${r.left === 0 ? ' ✓' : ''}`
            : r.left === 0
              ? s.doneMark
              : s.nLeft(r.left)}
        </span>
      </div>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="target"
          title={left > 0 ? s.setsLeftTitle(left) : s.allDone}
          sub={line || kick}
          onClick={go}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.leftToday}
          value={left}
          unit={s.sets}
          sub={line || s.allDone}
          onClick={go}
          bodyLast
        >
          <WidgetBar value={target ? done / target : 1} />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={kick} badge={`${left} ${s.sets}`} onClick={go}>
          <div className="ul-flex ul-col ug-8 umt-auto">{data.rows.slice(0, 4).map(bar)}</div>
        </Widget>
      );
    const rd = muscleReadiness(finishedOf(store.workouts), now);
    const rv = data.rows.map((r) => rd.get(r.m)?.readiness).filter((x): x is number => x != null);
    const ready = rv.length ? Math.round((rv.reduce((a, b) => a + b, 0) / rv.length) * 100) : null;
    const pct = target ? done / target : 1;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={kick}
        badge={s.toMav}
        onClick={go}
        footer={
          <NoteAction
            note={ready != null ? s.readiness(ready) : s.toMav}
            action={
              <Button variant="primary" size="sm" onClick={go}>
                {live ? s.continueWorkout : s.start}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ug-14 ua-center">
          <WidgetRing value={pct} size={84}>
            {Math.round(pct * 100)}%
          </WidgetRing>
          <div className="ul-flex ul-col ug-2">
            <span className="uiw-value">
              {left}
              <span className="uiw-unit">{s.setsLeft}</span>
            </span>
            <Muted>{s.ofDone(fmtKg(done), target)}</Muted>
            {left > 0 && <Muted>{s.minutes(Math.round(left * 2.5))}</Muted>}
          </div>
        </div>
        <div className="ul-flex ul-col ug-8">{data.rows.slice(0, 5).map(bar)}</div>
      </Widget>
    );
  },
};

/* =====================================================================
 * 4. Left / right balance (user-entered side tests — the log stores one side)
 * ===================================================================== */

interface LrTest {
  name: string;
  l: number;
  r: number;
  at: number;
}

/** Unilateral / per-hand lifts from history, most-trained first. */
function unilateralLifts(workouts: Workout[]): string[] {
  return memoOn(workouts, 'unilateral', () => {
    const count = new Map<string, number>();
    for (const w of finishedOf(workouts).slice(0, 120))
      for (const e of w.exercises)
        if (isStrengthExercise(e) && sidesMode(e) !== 'single')
          count.set(e.name, (count.get(e.name) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  });
}

const diffPct = (x: LrTest) => ((x.l - x.r) / Math.max(x.l, x.r, 1)) * 100;

function LrSheet({
  s,
  lifts,
  locale,
  onSave,
  onClose,
}: {
  s: MusclesStrings;
  lifts: string[];
  locale: LocaleId;
  onSave: (t: LrTest) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(lifts[0] ?? '');
  const [v, setV] = useState({ lw: '', lr: '', rw: '', rr: '' });
  const num = (x: string) => Number(x.replace(',', '.'));
  const l = est1rm(num(v.lw), Math.round(num(v.lr))) || num(v.lw);
  const r = est1rm(num(v.rw), Math.round(num(v.rr))) || num(v.rw);
  const field = (k: keyof typeof v, label: string, mode: 'decimal' | 'numeric') => (
    <label className="uf-1 ul-flex ul-col ug-4">
      <Muted>{label}</Muted>
      <Field inputMode={mode} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  );
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12" style={{ padding: '4px 0 12px' }}>
        <strong className="uiw-t-lg">{s.lrTitle}</strong>
        <Muted>{s.lrHint}</Muted>
        {lifts.length > 0 && (
          <div className="ul-flex ug-6 ul-wrap">
            {lifts.slice(0, 6).map((n) => (
              <Chip key={n} size="sm" selected={n === name} onClick={() => setName(n)}>
                {exName(n, locale)}
              </Chip>
            ))}
          </div>
        )}
        <Field value={name} placeholder={s.liftName} onChange={(e) => setName(e.target.value)} />
        <div className="ul-flex ug-8">
          {field('lw', `${s.left} · kg`, 'decimal')}
          {field('lr', s.reps, 'numeric')}
        </div>
        <div className="ul-flex ug-8">
          {field('rw', `${s.right} · kg`, 'decimal')}
          {field('rr', s.reps, 'numeric')}
        </div>
        <Button
          variant="primary"
          fullWidth
          disabled={!name.trim() || l <= 0 || r <= 0}
          onClick={() => {
            onSave({ name: name.trim(), l, r, at: Date.now() });
            onClose();
          }}
        >
          {s.save}
        </Button>
      </div>
    </Sheet>
  );
}

/** L value · mirrored bars · R value. */
function LrRow({ x, locale, s }: { x: LrTest; locale: LocaleId; s: MusclesStrings }) {
  const d = diffPct(x);
  const max = Math.max(x.l, x.r, 1);
  const even = Math.abs(d) < 2;
  return (
    <div className="ul-flex ul-col ug-4">
      <div className="ul-flex uj-between ug-8">
        <Muted>{exName(x.name, locale)}</Muted>
        <Tag
          text={even ? s.even : s.sideTag(d < 0 ? s.l : s.r, Math.round(Math.abs(d)))}
          good={even ? true : null}
        />
      </div>
      <div className="ul-grid ug-4 ua-center" style={{ gridTemplateColumns: '28px 1fr 1fr 28px' }}>
        <Muted>{fmtKg(x.l)}</Muted>
        <span style={{ transform: 'scaleX(-1)' }}>
          <WidgetBar value={x.l / max} tone={!even && d < 0 ? 'injury' : 'accent'} />
        </span>
        <WidgetBar value={x.r / max} tone={!even && d > 0 ? 'injury' : 'accent'} />
        <span className="utx-right">
          <Muted>{fmtKg(x.r)}</Muted>
        </span>
      </div>
    </div>
  );
}

function LrWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, locale } = ctx;
  const s = ms(locale);
  const [tests, setTests] = useLocal<LrTest[]>('lr-balance', []);
  const [editing, setEditing] = useState(false);
  const lifts = unilateralLifts(store.workouts);
  const add = () => setEditing(true);
  const sheet = editing ? (
    <LrSheet
      s={s}
      lifts={lifts}
      locale={locale}
      onSave={(x) => setTests([x, ...tests.filter((o) => o.name !== x.name)].slice(0, 8))}
      onClose={() => setEditing(false)}
    />
  ) : null;
  let body: ReactNode;
  if (tests.length === 0)
    body = (
      <WidgetEmpty
        size={size}
        tone="neutral"
        icon="arrows-out-line-horizontal"
        kicker={s.lr}
        title={s.lrEmpty}
        sub={lifts.length ? s.lrEmptySub(exName(lifts[0], locale)) : s.lrHint}
        action={s.testLift}
        onAction={add}
      />
    );
  else {
    const sorted = [...tests].sort((a, b) => Math.abs(diffPct(b)) - Math.abs(diffPct(a)));
    const w = sorted[0];
    const d = diffPct(w);
    const side = d < 0 ? s.leftSide : s.rightSide;
    const even = Math.abs(d) < 2;
    const pair = `${fmtKg(w.l)} vs ${fmtKg(w.r)} kg`;
    const title = even ? s.balancedLr : s.weaker(side, Math.round(Math.abs(d)));
    if (size === 'M')
      body = (
        <Widget
          size="M"
          tone={even ? 'ok' : 'injury'}
          icon="arrows-out-line-horizontal"
          title={title}
          sub={`${exName(w.name, locale)} · ${pair}`}
          onClick={add}
          trailing={
            <Chip size="sm">
              {even ? s.even : s.sideTag(d < 0 ? s.l : s.r, Math.round(Math.abs(d)))}
            </Chip>
          }
        />
      );
    else if (size === 'S')
      body = (
        <Widget
          size="S"
          tone="neutral"
          kicker={s.lr}
          value={even ? '±0' : `−${Math.round(Math.abs(d))}`}
          unit={even ? '%' : s.pctSide(d < 0 ? s.l : s.r)}
          sub={`${exName(w.name, locale)} · ${pair}`}
          onClick={add}
          bodyLast
        >
          <LrRow x={w} locale={locale} s={s} />
        </Widget>
      );
    else if (size === 'L')
      body = (
        <Widget size="L" tone="neutral" kicker={s.lrKicker} badge="L ← → R" onClick={add}>
          <div className="ul-flex ul-col ug-8 umt-auto">
            {sorted.slice(0, 2).map((x) => (
              <LrRow key={x.name} x={x} locale={locale} s={s} />
            ))}
          </div>
        </Widget>
      );
    else
      body = (
        <Widget
          size="XL"
          tone="neutral"
          kicker={s.lrKicker}
          badge="kg · L ← → R"
          onClick={add}
          footer={
            <NoteAction
              note={even ? s.balancedLr : s.startWeaker(side)}
              action={
                <Button variant="primary" size="sm" onClick={add}>
                  {s.testLift}
                </Button>
              }
            />
          }
        >
          <div className="ul-flex ua-base ug-8">
            <span className="uiw-value">
              {even ? '±0' : `−${Math.round(Math.abs(d))}`}
              <span className="uiw-unit">%</span>
            </span>
            <Muted>{`${exName(w.name, locale)} · ${fmtDayMonth(w.at, locale)}`}</Muted>
          </div>
          <div className="ul-flex ul-col ug-10">
            {sorted.slice(0, 4).map((x) => (
              <LrRow key={x.name} x={x} locale={locale} s={s} />
            ))}
          </div>
        </Widget>
      );
  }
  return (
    <>
      {body}
      {sheet}
    </>
  );
}

const lrBalance: WidgetDef = {
  id: 'lr-balance',
  group: 'muscles',
  icon: 'arrows-out-line-horizontal',
  tone: 'neutral',
  name: () => ms(getLocale()).lr,
  render: (size, ctx) => <LrWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 5. Muscle of the week (furthest below MAV over 4 weeks)
 * ===================================================================== */

const muscleWeek: WidgetDef = {
  id: 'muscle-of-week',
  group: 'muscles',
  icon: 'star',
  tone: 'accent',
  name: () => ms(getLocale()).muscleWeek,
  render: (size, { store, now, t, locale, shell }) => {
    const s = ms(locale);
    const fin = finishedOf(store.workouts);
    const series = memoOn(store.workouts, `series4:${hourKey(now)}`, () =>
      weeklyMuscleSeries(fin, now, 4),
    );
    if (fin.length === 0 || fin[fin.length - 1].startedAt > now - 14 * DAY)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="star"
          kicker={s.muscleWeek}
          title={s.mwEmpty}
          sub={s.mwEmptySub}
          onAction={() => shell.goTab('progress')}
        />
      );
    const lms = landmarksOf(store, now);
    const pick = MAJOR.map((m) => {
      const lm = lms.get(m) ?? (LANDMARKS[m] as Landmark);
      const arr = series.get(m) ?? [0, 0, 0, 0];
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return { m, lm, arr, ratio: avg / lm.mav };
    }).sort((a, b) => a.ratio - b.ratio)[0];
    const ws = weekStartOf(now);
    const weekEnd = ws + 7 * DAY;
    const thisWeek = [...fin, ...store.workouts.filter((w) => w.finishedAt === null)].filter(
      (w) => w.startedAt >= ws,
    );
    const hits = new Map<string, { sets: number; day: string | null }>();
    let done = 0;
    for (const w of thisWeek)
      for (const e of w.exercises) {
        if (!isStrengthExercise(e) || e.sets.length === 0) continue;
        const { primary, secondary } = resolveMuscles(e);
        const f = primary === pick.m ? 1 : secondary.includes(pick.m) ? 0.5 : 0;
        if (!f) continue;
        done += e.sets.length * f;
        const cur = hits.get(e.name) ?? { sets: 0, day: w.dayName ?? null };
        cur.sets += e.sets.length;
        hits.set(e.name, cur);
      }
    done = Math.round(done * 2) / 2;
    const goal = Math.round(pick.lm.mav);
    const toGo = Math.max(0, Math.ceil(goal - done));
    const endDay = fmtWeekdayShort(weekEnd - DAY, locale);
    const name = mName(t, pick.m);
    const open = () => shell.openOverlay({ screen: 'muscle-history', muscle: pick.m });
    const pct = goal ? Math.min(1, done / goal) : 1;
    const ring = (sz: number) => (
      <WidgetRing value={pct} size={sz}>
        {fmtKg(done)}
        <small>/ {goal}</small>
      </WidgetRing>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="star"
          title={s.focus(name)}
          sub={s.mwSub(fmtKg(done), goal, toGo, endDay)}
          onClick={open}
          trailing={<Chip size="sm">{Math.round(pct * 100)}%</Chip>}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.focusWeek}
          title={name}
          value={fmtKg(done)}
          unit={s.ofSets(goal)}
          onClick={open}
          bodyLast
        >
          <WidgetBar value={pct} />
        </Widget>
      );
    const list = [...hits.entries()].sort((a, b) => b[1].sets - a[1].sets);
    const hint =
      toGo > 0
        ? list[0]
          ? s.addMore(toGo, exName(list[0][0], locale))
          : s.addSets(toGo)
        : s.goalHit;
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" onClick={open}>
          <div className="ul-flex ug-14 ua-center uf-1">
            {ring(96)}
            <div className="ul-flex ul-col ug-4 umw-0">
              <span className="uiw-kicker">{s.muscleWeek}</span>
              <span className="uiw-t-lg">{name}</span>
              <Muted>{hint}</Muted>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.muscleWeek}
        badge={`${fmtDayMonth(ws, locale)} – ${fmtDayMonth(weekEnd - DAY, locale)}`}
        onClick={open}
        footer={
          <NoteAction
            note={`MEV ${fmtKg(pick.lm.mev)} · MAV ${fmtKg(pick.lm.mav)} · MRV ${fmtKg(pick.lm.mrv)}`}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openMuscle}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ug-14 ua-center">
          {ring(84)}
          <div className="ul-flex ul-col ug-2 umw-0">
            <span className="uiw-t-lg">{name}</span>
            <Muted>{s.furthest}</Muted>
            <Muted>{toGo > 0 ? s.toGoBy(toGo, endDay) : s.goalHit}</Muted>
          </div>
        </div>
        <WidgetBars
          values={pick.arr}
          highlight={[pick.arr.length - 1]}
          height={40}
          tone="accent"
          labels={pick.arr.map((v, i) => (i === pick.arr.length - 1 ? s.nowShort : fmtKg(v)))}
        />
        <WidgetList
          rows={
            list.length
              ? list.slice(0, 3).map(([n, v]) => ({
                  label: exName(n, locale),
                  value: [s.nSets(v.sets), v.day].filter(Boolean).join(' · '),
                }))
              : [{ label: hint }]
          }
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 6. Frequency (days per week each muscle is hit)
 * ===================================================================== */

interface FreqRow {
  key: string;
  label: string;
  members: MuscleGroup[];
}

function freqRows(t: WidgetCtx['t'], rich: boolean): FreqRow[] {
  const back: MuscleGroup[] = ['lats', 'traps', 'lower_back', 'back'];
  if (!rich)
    return [
      { key: 'chest', label: mName(t, 'chest'), members: ['chest'] },
      { key: 'back', label: mName(t, 'back'), members: back },
      { key: 'shoulders', label: mName(t, 'shoulders'), members: ['shoulders'] },
      {
        key: 'arms',
        label: `${mName(t, 'biceps')}/${mName(t, 'triceps')}`,
        members: ['biceps', 'triceps'],
      },
      {
        key: 'legs',
        label: `${mName(t, 'quads')}/${mName(t, 'hamstrings')}`,
        members: ['quads', 'hamstrings', 'glutes'],
      },
    ];
  return [
    { key: 'chest', label: mName(t, 'chest'), members: ['chest'] },
    { key: 'back', label: mName(t, 'back'), members: back },
    ...(['shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'calves'] as MuscleGroup[]).map(
      (m) => ({ key: m, label: mName(t, m), members: [m] }),
    ),
  ];
}

type Mark = 'done' | 'plan' | 'off';

function frequency(
  ctx: WidgetCtx,
  rows: FreqRow[],
): { days: number[]; grid: Mark[][]; counts: number[] } {
  const { store, now } = ctx;
  const ws = weekStartOf(now);
  const days = weekOrder();
  const todayPos = Math.floor((now - ws) / DAY);
  const trained: Set<string>[] = days.map(() => new Set());
  for (const w of store.workouts) {
    if (w.startedAt < ws || w.startedAt >= ws + 7 * DAY) continue;
    const pos = Math.min(6, Math.floor((w.startedAt - ws) / DAY));
    for (const [m, n] of muscleSetsInWorkout(w)) if (n >= 1) trained[pos].add(m);
  }
  const grid = rows.map((r) =>
    days.map((iso, i): Mark => {
      if (r.members.some((m) => trained[i].has(m))) return 'done';
      if (i >= todayPos) {
        const p = programMuscles(iso);
        if (
          p &&
          p.muscles
            .flatMap((m) => (m === 'back' ? ['back', 'lats'] : m === 'fullbody' ? MAJOR : [m]))
            .some((m) => r.members.includes(m as MuscleGroup))
        )
          return 'plan';
      }
      return 'off';
    }),
  );
  return { days, grid, counts: grid.map((g) => g.filter((x) => x === 'done').length) };
}

function FreqGrid({
  rows,
  f,
  locale,
}: {
  rows: FreqRow[];
  f: ReturnType<typeof frequency>;
  locale: LocaleId;
}) {
  const cols = '84px repeat(7, 1fr) 26px';
  return (
    <div className="ul-flex ul-col ug-6">
      <div className="ul-grid ug-4 utx-center" style={{ gridTemplateColumns: cols }}>
        <span />
        {f.days.map((d) => (
          <Muted key={d}>{dayLabel(d, locale)}</Muted>
        ))}
        <span />
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.key}
          className="ul-grid ug-4 ua-center"
          style={{ gridTemplateColumns: cols, justifyItems: 'center' }}
        >
          <span className="umw-0" style={{ justifySelf: 'start', overflow: 'hidden' }}>
            <Muted>{r.label}</Muted>
          </span>
          {f.grid[ri].map((mk, i) => (
            <Cell
              key={i}
              size={10}
              round
              bg={
                mk === 'done'
                  ? 'var(--color-accent)'
                  : mk === 'plan'
                    ? 'transparent'
                    : 'var(--color-neutral-800)'
              }
              outline={mk === 'plan' ? 'var(--color-accent-line)' : undefined}
            />
          ))}
          <span className="uiw-t-strong" style={{ justifySelf: 'end' }}>
            {f.counts[ri]}×
          </span>
        </div>
      ))}
    </div>
  );
}

const frequencyW: WidgetDef = {
  id: 'muscle-frequency',
  group: 'muscles',
  icon: 'calendar-check',
  tone: 'accent',
  name: () => ms(getLocale()).frequency,
  render: (size, ctx) => {
    const { store, t, locale } = ctx;
    const s = ms(locale);
    const open = goHash('#/progress/volume');
    if (finishedOf(store.workouts).length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="calendar-check"
          kicker={s.frequency}
          title={s.freqEmpty}
          sub={s.freqEmptySub}
          onAction={open}
        />
      );
    const rich = freqRows(t, true);
    const fr = frequency(ctx, rich);
    const hit = fr.counts.filter((c) => c >= 2).length;
    let lowI = 0;
    fr.counts.forEach((c, i) => {
      if (c < fr.counts[lowI]) lowI = i;
    });
    const low = rich[lowI];
    const lowLine = s.onlyX(low.label, fr.counts[lowI]);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="calendar-check"
          title={s.hitTwice(hit, rich.length)}
          sub={lowLine}
          onClick={open}
          trailing={<Chip size="sm">{`${low.label} ${fr.counts[lowI]}×`}</Chip>}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.frequency}
          value={hit}
          unit={s.atTwice(rich.length)}
          sub={lowLine}
          onClick={open}
          bodyLast
        >
          <WidgetDots values={fr.counts.map((c) => c >= 2)} height={8} tone="accent" />
        </Widget>
      );
    if (size === 'L') {
      const coarse = freqRows(t, false).slice(0, 4);
      const fc = frequency(ctx, coarse);
      return (
        <Widget size="L" tone="accent" kicker={s.freqWeek} badge={s.target2} onClick={open}>
          <FreqGrid rows={coarse} f={fc} locale={locale} />
        </Widget>
      );
    }
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.freqWeek}
        badge={s.target2Muscle}
        onClick={open}
        footer={
          <NoteAction
            note={fr.counts[lowI] < 2 ? lowLine : s.allTwice}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openVolume}
              </Button>
            }
          />
        }
      >
        <FreqGrid rows={rich} f={fr} locale={locale} />
        <div className="uiw-t-sm ul-flex ug-12">
          <Swatch color="var(--color-accent)">{s.trained}</Swatch>
          <Swatch color="var(--color-accent-line)">{s.planned}</Swatch>
        </div>
      </Widget>
    );
  },
};

/* =====================================================================
 * 7. Push / Pull / Legs split (sets, 4 weeks)
 * ===================================================================== */

type Ppl = 'push' | 'pull' | 'legs';
const PPL: Ppl[] = ['push', 'pull', 'legs'];
const PPL_TARGET: Record<Ppl, number> = { push: 35, pull: 35, legs: 30 };
const PPL_COLOR: Record<Ppl, string> = {
  push: 'var(--color-accent)',
  pull: 'var(--color-kcal)',
  legs: 'var(--color-ok)',
};

function pplSets(ws: Workout[]): Record<Ppl, number> {
  const out: Record<Ppl, number> = { push: 0, pull: 0, legs: 0 };
  for (const w of ws)
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const d = exerciseDay(resolveMuscles(e).primary);
      if (d === 'push' || d === 'pull' || d === 'legs')
        out[d] += e.sets.filter((s) => setTypeOf(s) !== 'warmup').length;
    }
  return out;
}

const pplSplit: WidgetDef = {
  id: 'ppl-split',
  group: 'muscles',
  icon: 'columns',
  tone: 'accent',
  name: () => ms(getLocale()).ppl,
  render: (size, { store, now, locale }) => {
    const s = ms(locale);
    const open = goHash('#/trends');
    const fin = finishedOf(store.workouts);
    const recent = fin.filter((w) => w.startedAt >= now - 28 * DAY);
    const tot = pplSets(recent);
    const sum = tot.push + tot.pull + tot.legs;
    if (sum === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="columns"
          kicker={s.ppl}
          title={s.pplEmpty}
          sub={s.pplEmptySub}
          onAction={open}
        />
      );
    const pct: Record<Ppl, number> = {
      push: Math.round((tot.push / sum) * 100),
      pull: Math.round((tot.pull / sum) * 100),
      legs: Math.round((tot.legs / sum) * 100),
    };
    const top = PPL.reduce((a, b) => (pct[b] > pct[a] ? b : a));
    const dev = PPL.map((k) => ({ k, d: pct[k] - PPL_TARGET[k] })).sort(
      (a, b) => Math.abs(b.d) - Math.abs(a.d),
    )[0];
    const balanced = Math.abs(dev.d) <= 5;
    const devLine = balanced
      ? s.pplBalanced
      : dev.d < 0
        ? s.below(s.pplName[dev.k], Math.abs(dev.d))
        : s.above(s.pplName[dev.k], dev.d);
    const stack = (v: Record<Ppl, number>, h = 10) => (
      <StackBar parts={PPL.map((k) => ({ value: v[k], color: PPL_COLOR[k] }))} height={h} />
    );
    const ratio = `${pct.push} / ${pct.pull} / ${pct.legs}`;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="columns"
          title={
            balanced ? `${s.pplBalancedShort} · ${ratio}` : `${s.heavy(s.pplName[top])} · ${ratio}`
          }
          sub={`${devLine} · ${s.weeks4}`}
          onClick={open}
          trailing={<Chip size="sm">{`${s.pplName[dev.k]} ${pct[dev.k]}%`}</Chip>}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.ppl}
          value={pct[top]}
          unit={`% ${s.pplName[top].toLowerCase()}`}
          sub={PPL.filter((k) => k !== top)
            .map((k) => `${s.pplName[k]} ${pct[k]}`)
            .join(' · ')}
          onClick={open}
          bodyLast
        >
          {stack(tot, 8)}
        </Widget>
      );
    const stats = (withSets: boolean) => (
      <WidgetStats
        items={PPL.map((k) => ({
          label: <Swatch color={PPL_COLOR[k]}>{s.pplName[k]}</Swatch>,
          value: withSets ? (
            <span className="ul-flex ul-col">
              <span>{pct[k]}%</span>
              <Muted>{s.setsTarget(tot[k], PPL_TARGET[k])}</Muted>
            </span>
          ) : (
            `${pct[k]}%`
          ),
        }))}
      />
    );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={s.split4} badge={`${sum} ${s.sets}`} onClick={open}>
          {stack(tot)}
          {stats(false)}
        </Widget>
      );
    const weeks = [3, 2, 1, 0].map((i) => {
      const to = now - i * WEEK;
      return { to, v: pplSets(recent.filter((w) => w.startedAt >= to - WEEK && w.startedAt < to)) };
    });
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.split4}
        badge={`${sum} ${s.sets}`}
        onClick={open}
        footer={
          <NoteAction
            note={devLine}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openTrends}
              </Button>
            }
          />
        }
      >
        {stack(tot)}
        {stats(true)}
        <div className="ul-flex ul-col ug-6">
          <span className="uiw-kicker">{s.byWeek}</span>
          {weeks.map((w) => (
            <div
              key={w.to}
              className="ul-grid ug-8 ua-center"
              style={{ gridTemplateColumns: '52px 1fr 32px' }}
            >
              <Muted>{fmtDayMonth(w.to - WEEK + DAY, locale)}</Muted>
              {stack(w.v, 8)}
              <span className="uiw-t-base utx-right">{w.v.push + w.v.pull + w.v.legs}</span>
            </div>
          ))}
        </div>
      </Widget>
    );
  },
};

/* =====================================================================
 * 8. Consistency heat map (training days, brightness = session volume)
 * ===================================================================== */

const HEAT = [
  'var(--color-neutral-800)',
  'var(--color-accent-800)',
  'var(--color-accent-600)',
  'var(--color-accent-400)',
];

interface Heat {
  level: Map<number, number>;
  weekStreak: number;
  bestWeekStreak: number;
}

function heatOf(workouts: Workout[], now: number): Heat {
  return memoOn(workouts, `heat:${hourKey(now)}`, () => {
    const fin = finishedOf(workouts);
    const vol = new Map<number, number>();
    for (const w of fin) {
      const d = new Date(w.startedAt);
      d.setHours(0, 0, 0, 0);
      const k = d.getTime();
      vol.set(k, (vol.get(k) ?? 0) + Math.max(1, workoutVolumeKg(w)));
    }
    const vals = [...vol.values()].sort((a, b) => a - b);
    const q = (p: number) => vals[Math.floor(p * (vals.length - 1))] ?? 0;
    const q1 = q(0.33);
    const q2 = q(0.66);
    const level = new Map<number, number>();
    for (const [k, v] of vol) level.set(k, v <= q1 ? 1 : v <= q2 ? 2 : 3);
    // week streaks: consecutive weeks with ≥1 session (the current week counts once trained, and never breaks it)
    const ws = weekStartOf(now);
    const weekHas = (start: number) =>
      fin.some((w) => w.startedAt >= start && w.startedAt < start + WEEK);
    let weekStreak = 0;
    for (let i = weekHas(ws) ? 0 : 1; i < 104; i++) {
      if (weekHas(ws - i * WEEK)) weekStreak++;
      else break;
    }
    let best = 0;
    let run = 0;
    for (let i = 103; i >= 0; i--) {
      if (weekHas(ws - i * WEEK)) best = Math.max(best, ++run);
      else run = 0;
    }
    return { level, weekStreak, bestWeekStreak: best };
  });
}

function HeatGrid({
  heat,
  now,
  weeks,
  endWeeksAgo = 0,
}: {
  heat: Heat;
  now: number;
  weeks: number;
  endWeeksAgo?: number;
}) {
  const lastWeek = weekStartOf(now) - endWeeksAgo * WEEK;
  const start = lastWeek - (weeks - 1) * WEEK;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();
  const cells: ReactNode[] = [];
  for (let w = 0; w < weeks; w++)
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + w * 7 + d);
      const k = dt.getTime();
      const future = k > t0;
      cells.push(
        <Cell
          key={k}
          bg={future ? 'transparent' : HEAT[heat.level.get(k) ?? 0]}
          outline={k === t0 ? 'var(--color-accent)' : future ? 'var(--color-border)' : undefined}
        />,
      );
    }
  return (
    <div
      className="ul-grid uw-full"
      style={{
        gridTemplateRows: 'repeat(7, auto)',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        gap: weeks > 20 ? 2 : 3,
      }}
      aria-hidden
    >
      {cells}
    </div>
  );
}

const heatmap: WidgetDef = {
  id: 'consistency-heatmap',
  group: 'muscles',
  icon: 'squares-four',
  tone: 'accent',
  name: () => ms(getLocale()).heatmap,
  render: (size, { store, now, shell, locale }) => {
    const s = ms(locale);
    const open = () => shell.openOverlay({ screen: 'history' });
    const fin = finishedOf(store.workouts);
    if (fin.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="squares-four"
          kicker={s.heatmap}
          title={s.heatEmpty}
          sub={s.heatEmptySub}
          onAction={open}
        />
      );
    const heat = heatOf(store.workouts, now);
    const since = (weeks: number) =>
      fin.filter((w) => w.startedAt >= weekStartOf(now) - (weeks - 1) * WEEK).length;
    const n16 = since(16);
    const per = (n16 / 16).toFixed(1);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="squares-four"
          title={s.weekStreak(heat.weekStreak)}
          sub={s.sessions16(n16, per)}
          onClick={open}
          trailing={<Chip size="sm">{s.bestN(heat.bestWeekStreak)}</Chip>}
        />
      );
    if (size === 'S')
      return (
        <Widget size="S" tone="accent" kicker={s.consistency} onClick={open}>
          <div className="ul-flex ug-10 ua-center uf-1">
            <div className="uf-none" style={{ width: 60 }}>
              <HeatGrid heat={heat} now={now} weeks={4} />
            </div>
            <div className="ul-flex ul-col">
              <span className="uiw-value">{heat.weekStreak}</span>
              <Muted>{s.wkStreak}</Muted>
              <Muted>{s.perWeek(per)}</Muted>
            </div>
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" onClick={open}>
          <div className="ul-flex ug-14 ua-center uf-1">
            <div className="uf-1 umw-0">
              <HeatGrid heat={heat} now={now} weeks={16} />
            </div>
            <div className="ul-flex ul-col ug-2 uf-none" style={{ width: 92 }}>
              <span className="uiw-kicker">{s.weeks16}</span>
              <span className="uiw-value">
                {heat.weekStreak}
                <span className="uiw-unit">{s.wk}</span>
              </span>
              <Muted>{s.wkStreak}</Muted>
              <Muted>{s.nSessions(n16)}</Muted>
              <Muted>{s.perWeek(per)}</Muted>
            </div>
          </div>
        </Widget>
      );
    const n52 = since(52);
    const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
    const inYear = fin.filter((w) => w.startedAt >= yearStart).length;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.days52}
        badge={s.nSessions(n52)}
        onClick={open}
        footer={
          <WidgetStats
            items={[
              { label: s.streak, value: s.nWeeks(heat.weekStreak) },
              { label: s.longest, value: s.nWeeks(heat.bestWeekStreak) },
              { label: s.inYear(new Date(now).getFullYear()), value: inYear },
            ]}
          />
        }
      >
        <div className="ul-flex ul-col ug-4">
          <Muted>{`${monthName(weekStartOf(now) - 51 * WEEK, locale, true)} – ${monthName(weekStartOf(now) - 26 * WEEK, locale, true)}`}</Muted>
          <HeatGrid heat={heat} now={now} weeks={26} endWeeksAgo={26} />
        </div>
        <div className="ul-flex ul-col ug-4">
          <Muted>{`${monthName(weekStartOf(now) - 25 * WEEK, locale, true)} – ${monthName(now, locale, true)}`}</Muted>
          <HeatGrid heat={heat} now={now} weeks={26} />
        </div>
        <div className="uiw-t-sm ul-flex ug-4 ua-center">
          <Muted>{s.less}</Muted>
          {HEAT.map((c) => (
            <Cell key={c} bg={c} size={10} />
          ))}
          <Muted>{s.more}</Muted>
        </div>
      </Widget>
    );
  },
};

/* =====================================================================
 * 9. Weekly goal (sessions this week vs the goal)
 * ===================================================================== */

function GoalSheet({
  s,
  value,
  onSave,
  onClose,
}: {
  s: MusclesStrings;
  value: number;
  onSave: (n: number) => void;
  onClose: () => void;
}) {
  const [n, setN] = useState(value);
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-14" style={{ padding: '4px 0 12px' }}>
        <strong className="uiw-t-lg">{s.goalTitle}</strong>
        <Muted>{s.goalHint}</Muted>
        <div className="ul-flex ua-center uj-center ug-20">
          <Button
            variant="secondary"
            icon="minus"
            onClick={() => setN(Math.max(1, n - 1))}
            aria-label="−"
          />
          <span className="uiw-value">
            {n}
            <span className="uiw-unit">{s.perWk}</span>
          </span>
          <Button
            variant="secondary"
            icon="plus"
            onClick={() => setN(Math.min(14, n + 1))}
            aria-label="+"
          />
        </div>
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            onSave(n);
            onClose();
          }}
        >
          {s.save}
        </Button>
      </div>
    </Sheet>
  );
}

function sessionLabel(w: Workout, t: WidgetCtx['t']): string {
  if (w.dayName) return w.dayName;
  const m = [...muscleSetsInWorkout(w).entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  return m.length ? m.map(([g]) => mName(t, g)).join(' · ') : t.muscleGroups.fullbody;
}

function WeeklyGoalWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, t, locale } = ctx;
  const s = ms(locale);
  const [saved, setSaved] = useLocal<number | null>('weekly-goal', null);
  const [editing, setEditing] = useState(false);
  const planned = prescribedTrainingDays();
  const goal = saved ?? (planned.size || 3);
  const open = goHash('#/goals');
  const edit = () => setEditing(true);
  const fin = finishedOf(store.workouts);
  const ws = weekStartOf(now);
  const weekEnd = ws + 7 * DAY;
  const week = fin.filter((w) => w.startedAt >= ws).sort((a, b) => a.startedAt - b.startedAt);
  const done = week.length;
  const toGo = Math.max(0, goal - done);
  const endDay = fmtWeekdayShort(weekEnd - DAY, locale);
  const daysLeft = Math.max(0, Math.ceil((weekEnd - now) / DAY));
  const countWeek = (i: number) =>
    fin.filter((w) => w.startedAt >= ws - i * WEEK && w.startedAt < ws - (i - 1) * WEEK).length;
  const last6 = [6, 5, 4, 3, 2, 1].map(countWeek);
  let streak = 0;
  for (let i = 1; i < 52 && countWeek(i) >= goal; i++) streak++;
  const order = weekOrder();
  const trainedDays = new Set(week.map((w) => isoWeekday(w.startedAt)));
  const todayIso = isoWeekday(now);
  const todayPos = order.indexOf(todayIso);
  const upcoming = order
    .filter((d, i) => i >= todayPos && planned.has(d) && !(d === todayIso && trainedDays.has(d)))
    .map((d) => ({ d, name: programMuscles(d)?.name ?? null }));
  const nextUp = upcoming[0];
  const ring = (sz: number) => (
    <WidgetRing
      value={goal ? Math.min(1, done / goal) : 0}
      size={sz}
      tone={done >= goal ? 'ok' : 'accent'}
    >
      {done}
      <small>/ {goal}</small>
    </WidgetRing>
  );
  const sheet = editing ? (
    <GoalSheet s={s} value={goal} onSave={setSaved} onClose={() => setEditing(false)} />
  ) : null;
  const status = toGo === 0 ? s.goalDone : s.toGoBy2(toGo, endDay);
  let body: ReactNode;
  if (size === 'M')
    body = (
      <Widget
        size="M"
        tone="accent"
        icon="flag-checkered"
        title={s.goalOf(done, goal)}
        sub={
          nextUp
            ? s.nextOn(
                nextUp.name ?? dayLabel(nextUp.d, locale),
                nextUp.d === todayIso ? s.todayWord : dayLabel(nextUp.d, locale),
              )
            : status
        }
        onClick={open}
      />
    );
  else if (size === 'S')
    body = (
      <Widget size="S" tone="accent" kicker={s.weeklyGoal} onClick={open}>
        <div className="ul-flex ug-12 ua-center uf-1">
          {ring(64)}
          <div className="ul-flex ul-col">
            <span className="uiw-t-md">{toGo === 0 ? s.goalDone : s.nToGo(toGo)}</span>
            <Muted>{toGo === 0 ? s.streakWeeks(streak + 1) : s.byDay(endDay)}</Muted>
          </div>
        </div>
      </Widget>
    );
  else if (size === 'L')
    body = (
      <Widget size="L" tone="accent" onClick={open}>
        <div className="ul-flex ug-14 ua-center uf-1">
          {ring(96)}
          <div className="ul-flex ul-col ug-6 uf-1 umw-0">
            <span className="uiw-kicker">{s.goalKicker(goal)}</span>
            <div
              className="ul-grid ug-4 utx-center"
              style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
            >
              {order.map((d) => (
                <Muted key={d}>{dayLabel(d, locale)}</Muted>
              ))}
              {order.map((d) => (
                <Cell
                  key={d}
                  size={14}
                  bg={
                    trainedDays.has(d)
                      ? 'var(--color-accent)'
                      : planned.has(d)
                        ? 'transparent'
                        : 'var(--color-neutral-800)'
                  }
                  outline={
                    !trainedDays.has(d) && planned.has(d) ? 'var(--color-accent-line)' : undefined
                  }
                />
              ))}
            </div>
            <Muted>{status}</Muted>
            {streak > 0 && <Tag text={s.streakWeeks(streak)} good />}
          </div>
        </div>
      </Widget>
    );
  else
    body = (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.goalWeek(`${fmtDayMonth(ws, locale)} – ${fmtDayMonth(weekEnd - DAY, locale)}`)}
        badge={s.nSessions(goal)}
        onClick={open}
        footer={
          <NoteAction
            note={s.last6(last6.join(' · '))}
            action={
              <Button variant="primary" size="sm" onClick={edit}>
                {s.editGoal}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ug-14 ua-center">
          {ring(84)}
          <div className="ul-flex ul-col ug-2">
            <span className="uiw-t-lg">{status}</span>
            <Muted>{s.daysLeft(daysLeft)}</Muted>
            {streak > 0 && <Tag text={s.streakWeeks(streak)} good />}
          </div>
        </div>
        <WidgetList
          rows={[
            ...week.map((w) => ({
              icon: 'check-circle',
              tone: 'ok' as Tone,
              label: sessionLabel(w, t),
              value: `${dayLabel(isoWeekday(w.startedAt), locale)} · ${Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000)} min`,
            })),
            ...upcoming.slice(0, Math.max(0, 5 - week.length)).map((u) => ({
              icon: 'circle',
              tone: 'neutral' as Tone,
              label: u.name ?? s.planned,
              value:
                u.d === todayIso ? s.todayWord : `${dayLabel(u.d, locale)} · ${s.plannedLower}`,
            })),
          ].slice(0, 5)}
        />
      </Widget>
    );
  return (
    <>
      {body}
      {sheet}
    </>
  );
}

const weeklyGoal: WidgetDef = {
  id: 'weekly-goal',
  group: 'muscles',
  icon: 'flag-checkered',
  tone: 'accent',
  name: () => ms(getLocale()).weeklyGoal,
  render: (size, ctx) => <WeeklyGoalWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 10. Sessions this month (vs last month)
 * ===================================================================== */

const sessionsMonth: WidgetDef = {
  id: 'sessions-month',
  group: 'muscles',
  icon: 'calendar-blank',
  tone: 'accent',
  name: () => ms(getLocale()).sessionsMonth,
  render: (size, { store, now, locale, shell }) => {
    const s = ms(locale);
    const open = () => shell.openOverlay({ screen: 'history' });
    const fin = finishedOf(store.workouts);
    if (fin.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="calendar-blank"
          kicker={s.sessionsMonth}
          title={s.heatEmpty}
          sub={s.heatEmptySub}
          onAction={open}
        />
      );
    const d = new Date(now);
    // In the first days of a month the previous full month is the headline.
    const shift = d.getDate() <= 3 ? 1 : 0;
    const mStart = (back: number) =>
      new Date(d.getFullYear(), d.getMonth() - shift - back, 1).getTime();
    const inMonth = (back: number) =>
      fin.filter((w) => w.startedAt >= mStart(back) && w.startedAt < mStart(back - 1));
    const cur = inMonth(0);
    const prev = inMonth(1).length;
    const n = cur.length;
    const delta = n - prev;
    const dTxt = delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '±0';
    const good = delta > 0 ? true : delta < 0 ? false : null;
    const mName0 = monthName(mStart(0), locale);
    const mName1 = monthName(mStart(1), locale);
    const hist = [5, 4, 3, 2, 1, 0].map((b) => inMonth(b).length);
    const best6 = n > 0 && hist.slice(0, 5).every((x) => x < n);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="calendar-blank"
          title={s.inMonth(n, mName0)}
          sub={`${s.vsIn(prev, mName1)}${best6 ? ` · ${s.best6}` : ''}`}
          onClick={open}
          trailing={<Tag text={dTxt} good={good} />}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={mName0}
          value={n}
          unit={s.sessionsUnit}
          sub={<Tag text={s.vsMonth(dTxt, mName1)} good={good} />}
          onClick={open}
        />
      );
    const bars = (h: number) => (
      <WidgetBars
        values={hist}
        highlight={[5]}
        height={h}
        tone="accent"
        labels={[5, 4, 3, 2, 1, 0].map((b) => monthName(mStart(b), locale, true))}
      />
    );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.monthVs(monthName(mStart(0), locale, true), monthName(mStart(1), locale, true))}
          badge={<Tag text={dTxt} good={good} />}
          onClick={open}
        >
          <div className="ul-flex ug-14 ua-end uf-1">
            <span className="uiw-value">
              {n}
              <span className="uiw-unit">{s.vsN(prev)}</span>
            </span>
            <div className="uf-1 umw-0">{bars(56)}</div>
          </div>
        </Widget>
      );
    const mins = cur.reduce((m, w) => m + ((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000, 0);
    const chunks: { from: number; to: number }[] = [];
    const endOfMonth = mStart(-1);
    for (let st = mStart(0); st < endOfMonth; st += 7 * DAY) {
      const to = Math.min(endOfMonth, st + 7 * DAY);
      chunks.push({ from: st, to: endOfMonth - to < 3 * DAY ? endOfMonth : to });
      if (endOfMonth - to < 3 * DAY) break;
    }
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.sessionsOf(mName0)}
        badge={<Tag text={s.vsMonth(dTxt, monthName(mStart(1), locale, true))} good={good} />}
        onClick={open}
        footer={
          <NoteAction
            note={s.hoursTotal((mins / 60).toFixed(1), n ? Math.round(mins / n) : 0)}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openHistory}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ua-base ug-10">
          <span className="uiw-value">
            {n}
            <span className="uiw-unit">{s.sessionsUnit}</span>
          </span>
          <Muted>{best6 ? `${s.best6} · ${s.vsIn(prev, mName1)}` : s.vsIn(prev, mName1)}</Muted>
        </div>
        {bars(70)}
        <WidgetList
          rows={chunks.map((c) => {
            const ws = cur.filter((w) => w.startedAt >= c.from && w.startedAt < c.to);
            const h =
              ws.reduce((m, w) => m + ((w.finishedAt ?? w.startedAt) - w.startedAt), 0) / 3600000;
            return {
              label: `${fmtDayMonth(c.from, locale)} – ${fmtDayMonth(c.to - DAY, locale)}`,
              value: s.chunk(ws.length, h.toFixed(1)),
            };
          })}
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 11. Best training time (weekday × time of day, top-set e1RM vs average)
 * ===================================================================== */

const SLOTS = [0, 1, 2, 3] as const;
function slotOf(ts: number): number {
  const h = new Date(ts).getHours();
  return h < 10 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3;
}

interface TimeGrid {
  cells: { sum: number; n: number }[][]; // [slot][iso-1]
  sessions: number;
}

function timeGrid(workouts: Workout[], now: number): TimeGrid {
  return memoOn(workouts, `besttime:${hourKey(now)}`, () => {
    const fin = finishedOf(workouts).filter((w) => w.startedAt >= now - 12 * WEEK);
    const per = new Map<string, number[]>();
    const sessBest = fin.map((w) => {
      const m = new Map<string, number>();
      for (const e of w.exercises) {
        if (!isStrengthExercise(e)) continue;
        const b = Math.max(
          0,
          ...e.sets.map((s) => (setTypeOf(s) === 'warmup' ? 0 : est1rm(s.weight ?? 0, s.reps))),
        );
        if (b > 0) m.set(e.name.toLowerCase(), Math.max(m.get(e.name.toLowerCase()) ?? 0, b));
      }
      for (const [k, v] of m) per.set(k, [...(per.get(k) ?? []), v]);
      return { w, m };
    });
    const mean = new Map<string, number>();
    for (const [k, arr] of per)
      if (arr.length >= 3) mean.set(k, arr.reduce((a, b) => a + b, 0) / arr.length);
    const cells = SLOTS.map(() => Array.from({ length: 7 }, () => ({ sum: 0, n: 0 })));
    let sessions = 0;
    for (const { w, m } of sessBest) {
      const r: number[] = [];
      for (const [k, v] of m) {
        const mu = mean.get(k);
        if (mu) r.push(v / mu - 1);
      }
      if (r.length === 0) continue;
      sessions++;
      const c = cells[slotOf(w.startedAt)][isoWeekday(w.startedAt) - 1];
      c.sum += (r.reduce((a, b) => a + b, 0) / r.length) * 100;
      c.n++;
    }
    return { cells, sessions };
  });
}

function timeColor(v: number | null): string {
  if (v == null) return 'var(--color-neutral-900)';
  if (v < -1.5) return 'var(--color-neutral-800)';
  if (v < 1) return 'var(--color-accent-800)';
  if (v < 3) return 'var(--color-accent-600)';
  return 'var(--color-accent-400)';
}

const bestTime: WidgetDef = {
  id: 'best-training-time',
  group: 'muscles',
  icon: 'clock',
  tone: 'accent',
  name: () => ms(getLocale()).bestTime,
  render: (size, { store, now, locale }) => {
    const s = ms(locale);
    const open = goHash('#/trends');
    const g = timeGrid(store.workouts, now);
    if (g.sessions < 6)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="clock"
          kicker={s.bestTime}
          title={s.btEmpty}
          sub={s.btEmptySub}
          onAction={open}
        />
      );
    const avg = (slot: number, d: number) => {
      const c = g.cells[slot][d];
      return c.n ? c.sum / c.n : null;
    };
    const all: { slot: number; d: number; v: number; n: number }[] = [];
    for (const slot of SLOTS)
      for (let d = 0; d < 7; d++) {
        const v = avg(slot, d);
        if (v != null) all.push({ slot, d, v, n: g.cells[slot][d].n });
      }
    const pool = all.filter((x) => x.n >= 2).length ? all.filter((x) => x.n >= 2) : all;
    const best = pool.reduce((a, b) => (b.v > a.v ? b : a));
    const worst = pool.reduce((a, b) => (b.v < a.v ? b : a));
    const sign = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))}%`;
    const dayL = (d: number) => fmtWeekdayShort(MONDAY + d * DAY, locale);
    const bestLabel = `${dayL(best.d)} · ${s.slotRange[best.slot]}`;
    const header = (
      <>
        <span />
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <Muted key={d}>{dayLabel(d + 1, locale)}</Muted>
        ))}
      </>
    );
    const grid = (withVals: boolean) => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${withVals ? 64 : 34}px repeat(7, 1fr)`,
          gap: 4,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {header}
        {SLOTS.map((slot) => (
          <FragmentRow key={slot}>
            <span className="utx-left">
              {withVals ? (
                <TwoLine title={<Muted>{s.slotName[slot]}</Muted>} sub={s.slotRange[slot]} />
              ) : (
                <Muted>{s.slotShort[slot]}</Muted>
              )}
            </span>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const v = avg(slot, d);
              return (
                <Cell
                  key={d}
                  bg={timeColor(v)}
                  outline={slot === best.slot && d === best.d ? 'var(--color-accent)' : undefined}
                >
                  {withVals
                    ? v == null
                      ? '·'
                      : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))}`
                    : null}
                </Cell>
              );
            })}
          </FragmentRow>
        ))}
      </div>
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="clock"
          title={s.strongest(dayL(best.d), s.slotName[best.slot].toLowerCase())}
          sub={s.topSets(sign(best.v))}
          onClick={open}
          trailing={<Chip size="sm">{s.slotRange[best.slot]}</Chip>}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.bestTimeShort}
          title={bestLabel}
          sub={<Tag text={s.topSetsShort(sign(best.v))} good={best.v > 0 ? true : null} />}
          onClick={open}
        >
          <div className="ul-grid ug-4" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <Cell key={d} bg={timeColor(avg(best.slot, d))} />
            ))}
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" onClick={open}>
          <div className="ul-flex ug-14 ua-center uf-1">
            <div className="uf-1 umw-0">{grid(false)}</div>
            <div className="ul-flex ul-col ug-4 uf-none" style={{ width: 100 }}>
              <span className="uiw-kicker">{s.bestTimeShort}</span>
              <span className="uiw-t-md">{bestLabel}</span>
              <Tag text={s.topSetsShort(sign(best.v))} good={best.v > 0 ? true : null} />
              <Muted>{s.fromN(g.sessions)}</Muted>
            </div>
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.bestTime}
        badge={s.vsAvg12}
        onClick={open}
        footer={
          <NoteAction
            note={s.weakest(
              `${dayL(worst.d)} ${s.slotName[worst.slot].toLowerCase()}`,
              sign(worst.v),
            )}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openTrends}
              </Button>
            }
          />
        }
      >
        {grid(true)}
        <Muted>{s.valuesNote(g.sessions)}</Muted>
        <WidgetStats
          items={[
            {
              label: s.bestTimeShort,
              value: s.bestNote(dayL(best.d), s.slotName[best.slot].toLowerCase(), sign(best.v)),
            },
          ]}
        />
      </Widget>
    );
  },
};

/** Grid children without a wrapper element. */
function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* =====================================================================
 * 12. Back on track (after a 7+ day break: 80% → 90% → full)
 * ===================================================================== */

const LOADS = [80, 90, 100];

const backOnTrack: WidgetDef = {
  id: 'back-on-track',
  group: 'muscles',
  icon: 'arrow-clockwise',
  tone: 'active',
  name: () => ms(getLocale()).backOnTrack,
  render: (size, ctx) => {
    const { store, now, locale, shell } = ctx;
    const s = ms(locale);
    const start = () => shell.openStart();
    const fin = finishedOf(store.workouts);
    if (fin.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="active"
          icon="arrow-clockwise"
          kicker={s.backOnTrack}
          title={s.heatEmpty}
          sub={s.heatEmptySub}
          onAction={start}
        />
      );
    let after = -1;
    let daysOff = 0;
    const gapNow = (now - fin[0].startedAt) / DAY;
    if (gapNow >= 7) {
      after = 0;
      daysOff = Math.floor(gapNow);
    } else
      for (let i = 0; i < Math.min(3, fin.length - 1); i++) {
        const gap = (fin[i].startedAt - fin[i + 1].startedAt) / DAY;
        if (gap >= 7) {
          after = i + 1;
          daysOff = Math.floor(gap);
          break;
        }
      }
    const lastDate = fmtDayMonth(fin[0].startedAt, locale);
    if (after < 0 || after >= LOADS.length) {
      const ago = Math.floor(gapNow);
      const line = s.lastAgo(ago, lastDate);
      if (size === 'M')
        return (
          <Widget
            size="M"
            tone="active"
            icon="arrow-clockwise"
            title={s.onTrack}
            sub={line}
            onClick={start}
          />
        );
      if (size === 'XL') {
        const today0 = new Date(now).setHours(0, 0, 0, 0);
        const trained = new Set(
          fin.map((w) => Math.round((today0 - new Date(w.startedAt).setHours(0, 0, 0, 0)) / DAY)),
        );
        const days14 = Array.from({ length: 14 }, (_, i) => trained.has(13 - i));
        const n14 = fin.filter((w) => w.startedAt >= today0 - 13 * DAY).length;
        return (
          <Widget
            size="XL"
            tone="active"
            kicker={s.backOnTrack}
            badge={s.lastSession(lastDate)}
            onClick={start}
            footer={
              <NoteAction
                note={s.onTrackNote}
                action={
                  <Button variant="primary" size="sm" onClick={start}>
                    {s.start}
                  </Button>
                }
              />
            }
          >
            <div className="ul-flex ua-base ug-8">
              <span className="uiw-value">{s.onTrack}</span>
              <Muted>{line}</Muted>
            </div>
            <span className="uiw-kicker">{s.last14}</span>
            <WidgetDots values={days14} height={18} tone="active" />
            <Muted>{s.sessions14(n14)}</Muted>
            <WidgetList
              rows={fin.slice(0, 4).map((w) => ({
                icon: 'barbell',
                tone: 'active' as Tone,
                label: `${w.dayName || fmtWeekdayShort(w.startedAt, locale)} · ${fmtDayMonth(w.startedAt, locale)}`,
                value: `${w.exercises.reduce((x, e) => x + e.sets.length, 0)} ${s.sets}`,
              }))}
            />
          </Widget>
        );
      }
      return (
        <Widget
          size={size}
          tone="active"
          kicker={s.backOnTrack}
          title={s.onTrack}
          value={size === 'S' ? ago : undefined}
          unit={size === 'S' ? s.daysSince : undefined}
          sub={size === 'S' ? lastDate : `${line} · ${s.onTrackNote}`}
          onClick={start}
        />
      );
    }
    const load = LOADS[after];
    // Upcoming program days (names) for the ramp list.
    const a = readProgramCache();
    const next: string[] = [];
    if (a)
      for (let off = 0; off < 14 && next.length < 3; off++) {
        const day = isoWeekday(now + off * DAY);
        if (programDayItems(a, day).length || programDayMuscles(a, day).length)
          next.push(programDayName(a, day, ctx.t.progDay));
      }
    const steps = LOADS.slice(after).map((l, i) => ({
      l,
      name: next[i] ?? s.sessionN(after + i + 1),
    }));
    const plan = nextPlan(ctx);
    const lift = plan?.lifts.find((x) => (x.target.weight ?? 0) > 0);
    const example =
      lift && lift.target.weight
        ? s.example(
            exName(lift.name, locale),
            fmtKg(Math.round((lift.target.weight * load) / 100 / 2.5) * 2.5),
            fmtKg(lift.target.weight),
          )
        : s.lighter;
    const stepLabel = (l: number) => (l >= 100 ? s.fullLoad : `${l}%`);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="active"
          icon="arrow-clockwise"
          title={after === 0 ? s.welcome(daysOff) : s.rampStep(after + 1)}
          sub={s.firstLighter(load)}
          onClick={start}
          trailing={
            <Button variant="secondary" size="sm" onClick={start}>
              {s.start}
            </Button>
          }
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="active"
          kicker={s.backOnTrack}
          value={load}
          unit={s.pctLoad}
          sub={s.offSession(daysOff, after + 1)}
          onClick={start}
          bodyLast
        >
          <WidgetDots values={LOADS.map((_, i) => i <= after)} height={6} tone="active" />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="active"
          kicker={s.botKicker(daysOff)}
          title={<span className="uiw-t-md">{s.ease}</span>}
          onClick={start}
          footer={
            <NoteAction
              note={s.minus(100 - load)}
              action={
                <Button variant="primary" size="sm" onClick={start}>
                  {s.startLight}
                </Button>
              }
            />
          }
        >
          <WidgetStats
            items={steps.map((st, i) => ({
              label: i === 0 ? s.todayCap : i === 1 ? s.nextCap : s.thenCap,
              value: `${st.name} · ${stepLabel(st.l)}`,
            }))}
          />
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="active"
        kicker={s.backOnTrack}
        badge={s.lastSession(lastDate)}
        onClick={start}
        footer={
          <NoteAction
            note={s.warmNote}
            action={
              <Button variant="primary" size="sm" onClick={start}>
                {s.startLight}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex ua-base ug-8">
          <span className="uiw-value">
            {daysOff}
            <span className="uiw-unit">{s.daysOffUnit}</span>
          </span>
          <Muted>{s.ease}</Muted>
        </div>
        <WidgetBars
          values={LOADS}
          highlight={[after]}
          height={56}
          tone="active"
          labels={LOADS.map(stepLabel)}
        />
        <WidgetList
          rows={steps.map((st, i) => ({
            icon: i === 0 ? 'play-circle' : 'circle',
            tone: (i === 0 ? 'active' : 'neutral') as Tone,
            label: i === 0 ? `${st.name} · ${s.todayWord}` : st.name,
            value: st.l >= 100 ? s.backToPlan : s.loadSets(st.l),
          }))}
        />
        <WidgetStats items={[{ label: s.example0, value: example }]} />
      </Widget>
    );
  },
};

export const MUSCLES_WIDGETS: WidgetDef[] = [
  muscleMap,
  volumeLandmarks,
  stimulusLeft,
  lrBalance,
  muscleWeek,
  frequencyW,
  pplSplit,
  heatmap,
  weeklyGoal,
  sessionsMonth,
  bestTime,
  backOnTrack,
];
