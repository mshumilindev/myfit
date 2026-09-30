/**
 * Strength widgets (design board L6 "Strength"): e1RM of the main lifts, the
 * progression engine's next target, forecasts, records, calculators, balance,
 * standards and stalls — every number derived from the logged set history
 * (standards.ts, progression.ts, plates.ts, swaps.ts, weakpoints.ts, store).
 *
 * The small shared helpers at the top (memo, local store, lift stats, empty
 * state) are also used by muscles.tsx.
 */
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Field } from '../../components/ui/Field';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  type WidgetSize,
  WidgetEmpty,
} from '../../components/ui/Widget';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import type { Tone } from '../../components/ui/tones';
import { PlateSheet } from '../../components/PlateSheet';
import { Sheet } from '../../ui';
import {
  DISCIPLINES,
  RANKS,
  computeStandards,
  type Sex,
  type StandardsResult,
} from '../../standards';
import { nextTarget, topHistory, type Target } from '../../progression';
import { solvePlates } from '../../plates';
import { swapCandidates } from '../../swaps';
import { strengthImbalance } from '../../weakpoints';
import {
  equipmentFor,
  est1rm,
  isStrengthExercise,
  latestWeight,
  loadTypeFor,
  pickSessionGym,
  prevLift,
  replaceExercise,
  setBestE1rm,
  setTypeOf,
} from '../../store';
import { muscleInfoByName } from '../../data/exercises';
import { localizedExerciseName } from '../../data/exerciseNames';
import { programDayItems, programDayName, readProgramCache } from '../../data/programMine';
import { fmtDayMonth, getLocale, type LocaleId } from '../../i18n';
import type { BodyMetrics, Workout } from '../../types';
import type { WidgetCtx, WidgetDef } from '../registry';
import { DAY } from './format';
import { ss, type StrengthStrings } from './strength.strings';

export const WEEK = 7 * DAY;

/* =====================================================================
 * Shared helpers (strength + muscles)
 * ===================================================================== */

const MEMO = new WeakMap<Workout[], Map<string, unknown>>();

/** Memoise a derivation of the workout list; recomputed when the list changes. */
export function memoOn<T>(workouts: Workout[], key: string, fn: () => T): T {
  let m = MEMO.get(workouts);
  if (!m) {
    m = new Map();
    MEMO.set(workouts, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = fn();
  m.set(key, v);
  return v;
}

/** Finished sessions, newest first (memoised per workout list). */
export function finishedOf(workouts: Workout[]): Workout[] {
  return memoOn(workouts, 'finished', () =>
    workouts.filter((w) => w.finishedAt !== null).sort((a, b) => b.startedAt - a.startedAt),
  );
}

/** Hour bucket — for memo keys that also depend on `now`. */
export const hourKey = (now: number): number => Math.floor(now / 3600000);

/** 102.5 / 140 — one decimal at most, no trailing zero. */
export function fmtKg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** +2.5 / −1 / ±0 with a real minus. */
export function signedKg(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '±0';
  return r > 0 ? `+${fmtKg(r)}` : `−${fmtKg(-r)}`;
}

export function exName(name: string, locale: LocaleId): string {
  return localizedExerciseName(name, locale) ?? name;
}

/** Round to the nearest loadable 0.5 kg. */
const half = (n: number): number => Math.round(n * 2) / 2;

/* ---- tiny localStorage-backed state (key spotter.tw.<id>), synced across instances ---- */

const localSubs = new Set<() => void>();
function subscribeLocal(cb: () => void): () => void {
  localSubs.add(cb);
  return () => {
    localSubs.delete(cb);
  };
}
function readRaw(id: string): string | null {
  try {
    return localStorage.getItem(`spotter.tw.${id}`);
  } catch {
    return null;
  }
}
/** Read a widget's local value outside React. */
export function readLocal<T>(id: string, fallback: T): T {
  const raw = readRaw(id);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
/** A widget-local value persisted in localStorage (`spotter.tw.<id>`). */
export function useLocal<T>(id: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribeLocal,
    () => readRaw(id),
    () => null,
  );
  let value = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = (v: T): void => {
    try {
      localStorage.setItem(`spotter.tw.${id}`, JSON.stringify(v));
    } catch {
      /* private mode — nothing persists */
    }
    localSubs.forEach((l) => l());
  };
  return [value, set];
}

/* ---- small presentational bits built from kit parts ---- */

/** Secondary (muted) inline text — the widget's sub style. */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="uiw-sub">{children}</span>;
}

/** ↑ 5 / ↓ 2 / → 0 trend tag (green / red / muted). */
export function Trend({ d, suffix = '' }: { d: number; suffix?: string }) {
  if (Math.abs(d) < 0.05) return <span className="uiw-delta ut-muted">→ 0{suffix}</span>;
  return (
    <WidgetDelta good={d > 0}>
      {d > 0 ? '↑' : '↓'} {fmtKg(Math.abs(d))}
      {suffix}
    </WidgetDelta>
  );
}

/** A delta tag that may be neutral (good = null → muted). */
export function Tag({ text, good }: { text: string; good: boolean | null }) {
  if (good === null) return <span className="uiw-delta ut-muted">{text}</span>;
  return <WidgetDelta good={good}>{text}</WidgetDelta>;
}

/** Two-line label for WidgetList rows (title + muted sub). */
export function TwoLine({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="ul-flex ul-col umw-0">
      <span>{title}</span>
      {sub != null && sub !== '' && <Muted>{sub}</Muted>}
    </span>
  );
}

/** Horizontal meter with an optional target marker (0–1 scale). */
export function MarkerBar({
  value,
  marker,
  tone,
  height = 6,
}: {
  value: number;
  marker?: number | null;
  tone?: Tone;
  height?: number;
}) {
  return (
    <span className="ul-block" style={{ position: 'relative' }}>
      <WidgetBar value={value} tone={tone} height={height} />
      {marker != null && (
        <span
          aria-hidden
          className="ur-sm tw-bg-text"
          style={{
            position: 'absolute',
            top: -3,
            left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)`,
            width: 2,
            height: height + 6,
          }}
        />
      )}
    </span>
  );
}

/** A labelled meter row: "Squat ........ 0.80 / 0.85" over a bar. */
export function MeterRow({
  label,
  value,
  bar,
  marker,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  bar: number;
  marker?: number | null;
  tone?: Tone;
}) {
  return (
    <div className="ul-flex ul-col ug-4">
      <div className="ul-flex uj-between ug-8">
        <Muted>{label}</Muted>
        <span className="uiw-t-strong">{value}</span>
      </div>
      <MarkerBar value={bar} marker={marker} tone={tone} height={4} />
    </div>
  );
}

/** Stacked horizontal bar (shares), each segment a token colour. */
export function StackBar({
  parts,
  height = 10,
}: {
  parts: { value: number; color: string }[];
  height?: number;
}) {
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <span className="ul-flex ug-2 uw-full uf-none" style={{ height }} aria-hidden>
      {parts.map((p, i) =>
        p.value > 0 ? (
          <span
            key={i}
            className="ur-sm"
            style={{
              width: `${(p.value / sum) * 100}%`,
              background: p.color,
            }}
          />
        ) : null,
      )}
    </span>
  );
}

/** Legend swatch + label. */
export function Swatch({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="ul-iflex ua-center ug-6">
      <span
        aria-hidden
        className="ur-sm uf-none"
        style={{ width: 8, height: 8, background: color }}
      />
      {children}
    </span>
  );
}

/** Footer row: muted note on the left, one action on the right. */
export function NoteAction({ note, action }: { note: ReactNode; action: ReactNode }) {
  return (
    <div className="ul-flex uj-between ua-center uw-full ug-8 umw-0">
      <span className="umw-0 uf-1" style={{ overflow: 'hidden' }}>
        <Muted>{note}</Muted>
      </span>
      {action}
    </div>
  );
}

/* ---- main lifts ---- */

export type LiftKey = 'squat' | 'bench' | 'deadlift' | 'ohp';
export const LIFTS: LiftKey[] = ['squat', 'bench', 'deadlift', 'ohp'];
const BIG3: ('squat' | 'bench' | 'deadlift')[] = ['squat', 'bench', 'deadlift'];
/** Token colour per main lift (legend / stacked bars). */
const LIFT_COLOR: Record<LiftKey, string> = {
  squat: 'var(--color-accent)',
  bench: 'var(--color-accent-300)',
  deadlift: 'var(--color-ok)',
  ohp: 'var(--color-kcal)',
};

function liftMatcher(key: LiftKey): (n: string) => boolean {
  return DISCIPLINES.find((d) => d.key === key)?.match ?? (() => false);
}

export interface LiftPoint {
  ts: number;
  e1: number;
  weight: number;
  reps: number;
  name: string;
}
export interface LiftStat {
  key: LiftKey;
  /** Session-best e1RM, oldest first. */
  points: LiftPoint[];
  /** All-time best e1RM (0 = never trained). */
  best: number;
  /** The exercise name used most for this lift. */
  name: string | null;
}

/** Best e1RM of a lift as of `ts`. */
export function bestAt(points: LiftPoint[], ts: number): number {
  let b = 0;
  for (const p of points) if (p.ts <= ts && p.e1 > b) b = p.e1;
  return b;
}

/** Running-best e1RM at the end of each of the last `weeks` weeks (leading zeros dropped). */
export function runningSeries(points: LiftPoint[], now: number, weeks: number): number[] {
  const out: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(bestAt(points, now - i * WEEK));
  const first = out.findIndex((v) => v > 0);
  return first < 0 ? [] : out.slice(first);
}

/** Session-best e1RM history of squat / bench / deadlift / OHP (standards.ts matchers). */
export function liftStats(workouts: Workout[]): Record<LiftKey, LiftStat> {
  return memoOn(workouts, 'lifts', () => {
    const fin = finishedOf(workouts);
    const out = {} as Record<LiftKey, LiftStat>;
    for (const key of LIFTS) {
      const match = liftMatcher(key);
      const points: LiftPoint[] = [];
      const names = new Map<string, number>();
      for (const w of fin) {
        let top: LiftPoint | null = null;
        for (const ex of w.exercises) {
          if (!isStrengthExercise(ex) || !match(ex.name)) continue;
          names.set(ex.name, (names.get(ex.name) ?? 0) + 1);
          for (const s of ex.sets) {
            const e1 = setBestE1rm(s);
            if (e1 > 0 && (!top || e1 > top.e1))
              top = { ts: w.startedAt, e1, weight: s.weight ?? 0, reps: s.reps, name: ex.name };
          }
        }
        if (top) points.push(top);
      }
      points.reverse();
      let name: string | null = null;
      let n = 0;
      for (const [k, c] of names)
        if (c > n) {
          name = k;
          n = c;
        }
      out[key] = { key, points, best: points.reduce((m, p) => Math.max(m, p.e1), 0), name };
    }
    return out;
  });
}

/** Latest bodyweight (kg) or 0. */
export function bodyKg(bm: BodyMetrics | null | undefined): number {
  return latestWeight(bm)?.weight ?? 0;
}

function standardsOf(workouts: Workout[], bm: BodyMetrics): StandardsResult {
  const bw = bodyKg(bm);
  const sex: Sex = bm.sex === 'female' ? 'F' : 'M';
  return memoOn(workouts, `std:${bw}:${sex}`, () =>
    computeStandards(finishedOf(workouts), bw, sex),
  );
}

/* ---- next session plan (progression engine) ---- */

export interface PlanLift {
  name: string;
  sets: number;
  target: Target;
}
export interface Plan {
  dayName: string | null;
  dayTs: number | null;
  today: boolean;
  lifts: PlanLift[];
}

function targetFor(
  fin: Workout[],
  name: string,
  plannedReps: number | null,
  equipment: string[],
): Target {
  return nextTarget(topHistory(fin, name), {
    plannedReps,
    equipment,
    primary: muscleInfoByName(name)?.primary ?? null,
    loadType: loadTypeFor({ name, equipment }),
  });
}

/** The next program day with lifts (today first), else a repeat of the last session. */
export function nextPlan(ctx: WidgetCtx): Plan | null {
  const fin = finishedOf(ctx.store.workouts);
  const a = readProgramCache();
  if (a) {
    for (let off = 0; off < 7; off++) {
      const ts = ctx.now + off * DAY;
      const day = ((new Date(ts).getDay() + 6) % 7) + 1;
      const items = programDayItems(a, day).filter((i) => i.kind === 'strength');
      if (items.length === 0) continue;
      return {
        dayName: programDayName(a, day, ctx.t.progDay),
        dayTs: ts,
        today: off === 0,
        lifts: items.map((i) => ({
          name: i.name,
          sets: i.sets,
          target: targetFor(fin, i.name, i.reps, i.equipment),
        })),
      };
    }
  }
  const last = fin[0];
  if (!last) return null;
  const lifts = last.exercises
    .filter((e) => isStrengthExercise(e) && e.sets.length > 0)
    .map((e) => ({
      name: e.name,
      sets: e.sets.filter((s) => setTypeOf(s) !== 'warmup').length || e.sets.length,
      target: targetFor(fin, e.name, e.plannedReps ?? null, equipmentFor(e)),
    }));
  if (lifts.length === 0) return null;
  return { dayName: last.dayName ?? null, dayTs: null, today: false, lifts };
}

export function fmtSet(w: number | null, r: number): string {
  return w != null && w !== 0 ? `${fmtKg(w)} × ${r}` : `× ${r}`;
}

function targetDelta(t: Target, s: StrengthStrings): { text: string; good: boolean | null } {
  if (t.state === 'first') return { text: s.firstTime, good: null };
  if (t.state === 'stall') return { text: s.deload, good: false };
  if (t.deltaKg > 0) return { text: `+${fmtKg(t.deltaKg)} kg`, good: true };
  if (t.prevReps != null && t.reps > t.prevReps) return { text: s.plusRep, good: true };
  return { text: s.hold, good: null };
}

const goHash = (h: string) => () => {
  window.location.hash = h;
};

/* =====================================================================
 * 1. Top lifts
 * ===================================================================== */

const topLifts: WidgetDef = {
  id: 'top-lifts',
  group: 'strength',
  icon: 'chart-line-up',
  tone: 'accent',
  name: () => ss(getLocale()).topLifts,
  render: (size, { store, now, locale, shell }) => {
    const s = ss(locale);
    const L = liftStats(store.workouts);
    const open = () => shell.goTab('progress');
    const trained = LIFTS.filter((k) => L[k].best > 0);
    if (trained.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="chart-line-up"
          kicker={s.topLifts}
          title={s.topLiftsEmpty}
          sub={s.topLiftsEmptySub}
          onAction={open}
        />
      );
    const rows = trained.map((k) => {
      const cur = L[k].best;
      const was = bestAt(L[k].points, now - 4 * WEEK);
      return { k, cur, d: was > 0 ? cur - was : 0 };
    });
    const up = rows.filter((r) => r.d > 0).length;
    const line = rows.map((r) => `${s.liftShort[r.k]} ${fmtKg(r.cur)}`).join(' · ');
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="chart-line-up"
          title={s.topLiftsE1}
          sub={line}
          onClick={open}
          trailing={<Tag text={s.upCount(up)} good={up > 0 ? true : null} />}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.topLifts4}
          value={up}
          unit={s.ofUp(rows.length)}
          bodyLast
          onClick={open}
        >
          <div
            className="uiw-t-base ul-grid"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px 8px' }}
          >
            {rows.map((r) => (
              <span key={r.k} className="ul-flex ug-4 ua-base">
                <Muted>{s.liftShort[r.k]}</Muted>
                <b>{fmtKg(r.cur)}</b>
                <Tag
                  text={r.d > 0 ? '↑' : r.d < 0 ? '↓' : '→'}
                  good={r.d > 0 ? true : r.d < 0 ? false : null}
                />
              </span>
            ))}
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="accent" kicker={s.topLiftsE1} badge={s.weeks(4)} onClick={open}>
          <div className="umt-auto">
            <WidgetStats
              items={rows.map((r) => ({
                label: s.liftName[r.k],
                value: (
                  <span className="ul-flex ul-col">
                    <span className="uiw-t-xl">{fmtKg(r.cur)}</span>
                    <Trend d={r.d} />
                  </span>
                ),
              }))}
            />
          </div>
        </Widget>
      );
    const big3 = BIG3.every((k) => L[k].best > 0) ? BIG3.reduce((sum, k) => sum + L[k].best, 0) : 0;
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.topLiftsE1}
        badge={s.weeks(12)}
        onClick={open}
        footer={
          <NoteAction
            note={big3 > 0 ? s.big3(fmtKg(big3)) : s.topLiftsEmptySub}
            action={
              <Button variant="primary" size="sm" onClick={goHash('#/progress/records')}>
                {s.allLifts}
              </Button>
            }
          />
        }
      >
        <WidgetList
          rows={rows.map((r) => {
            const series = runningSeries(L[r.k].points, now, 12);
            return {
              label: (
                <span className="ul-flex ua-center ug-10">
                  <span className="uf-none" style={{ width: 80 }}>
                    <TwoLine title={s.liftName[r.k]} sub="kg" />
                  </span>
                  <span className="uf-1 umw-0">
                    {series.length > 1 && (
                      <WidgetSpark points={series} height={30} tone={r.d > 0 ? 'ok' : 'neutral'} />
                    )}
                  </span>
                </span>
              ),
              value: (
                <span className="ul-flex ul-col ua-end" style={{ minWidth: 56 }}>
                  <span className="uiw-t-lg ut-text">{fmtKg(r.cur)}</span>
                  <Trend d={r.d} />
                </span>
              ),
            };
          })}
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 2. Next target (progression engine)
 * ===================================================================== */

const nextTargetW: WidgetDef = {
  id: 'next-target',
  group: 'strength',
  icon: 'crosshair',
  tone: 'accent',
  name: () => ss(getLocale()).nextTarget,
  render: (size, ctx) => {
    const s = ss(ctx.locale);
    const plan = nextPlan(ctx);
    const start = () => ctx.shell.openStart();
    if (!plan)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="crosshair"
          kicker={s.nextTarget}
          title={s.nextEmpty}
          sub={s.nextEmptySub}
          action={s.start}
          onAction={start}
        />
      );
    const day = plan.dayName ?? s.lastSession;
    const when = plan.today
      ? s.dayToday(day)
      : plan.dayTs != null
        ? `${day} · ${fmtDayMonth(plan.dayTs, ctx.locale)}`
        : `${s.repeat} · ${day}`;
    const main = plan.lifts[0];
    const t = main.target;
    const d = targetDelta(t, s);
    const name = exName(main.name, ctx.locale);
    const loaded = t.weight != null && t.weight !== 0;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="crosshair"
          title={`${name}: ${fmtSet(t.weight, t.reps)}`}
          sub={`${when} · ${d.text}`}
          onClick={start}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.nextKicker(day)}
          value={loaded ? fmtKg(t.weight ?? 0) : t.reps}
          unit={loaded ? `× ${t.reps}` : s.reps}
          title={<span className="uiw-t-base">{name}</span>}
          sub={<Tag text={d.text} good={d.good} />}
          onClick={start}
        />
      );
    const last =
      t.prevReps != null
        ? s.lastLine(fmtSet(t.prevWeight, t.prevReps))
        : s.firstTimeHint(t.repLow, t.repHigh);
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.nextTargetKicker(when)}
          badge={<Tag text={d.text} good={d.good} />}
          value={loaded ? fmtKg(t.weight ?? 0) : t.reps}
          unit={loaded ? `kg × ${t.reps} ${s.setsX(main.sets)}` : `${s.reps} ${s.setsX(main.sets)}`}
          sub={name}
          onClick={start}
          footer={
            <NoteAction
              note={last}
              action={
                <Button variant="primary" size="sm" onClick={start}>
                  {s.start}
                </Button>
              }
            />
          }
        />
      );
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.nextTargetsKicker(day)}
        badge={plan.dayTs != null ? fmtDayMonth(plan.dayTs, ctx.locale) : s.repeat}
        onClick={start}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={start}>
            {plan.dayName ? s.startDay(plan.dayName) : s.start}
          </Button>
        }
      >
        <WidgetList
          rows={plan.lifts.slice(0, 5).map((l) => {
            const dd = targetDelta(l.target, s);
            return {
              label: exName(l.name, ctx.locale),
              value: (
                <span className="ul-flex ug-10 ua-center">
                  <span className="uiw-t-md ut-text">{fmtSet(l.target.weight, l.target.reps)}</span>
                  <span className="utx-right" style={{ width: 56 }}>
                    <Tag text={dd.text} good={dd.good} />
                  </span>
                </span>
              ),
            };
          })}
        />
        <Muted>{s.progressionNote}</Muted>
      </Widget>
    );
  },
};

/* =====================================================================
 * 3. PR forecast (linear e1RM trend → target date)
 * ===================================================================== */

interface Forecast {
  key: LiftKey;
  cur: number;
  slope: number;
  target: number;
  eta: number | null;
  reached: boolean;
  pts: LiftPoint[];
}

const defaultTarget = (cur: number): number => Math.ceil((cur * 1.05) / 5) * 5;

function forecastOf(stat: LiftStat, now: number, target?: number): Forecast | null {
  const pts = stat.points.filter((p) => p.ts >= now - 12 * WEEK);
  if (pts.length < 3 || stat.best <= 0) return null;
  const xs = pts.map((p) => (p.ts - now) / WEEK);
  const ys = pts.map((p) => p.e1);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const cur = stat.best;
  const tgt = target && target > 0 ? target : defaultTarget(cur);
  const reached = cur >= tgt;
  let eta: number | null = null;
  if (!reached && slope > 0.05) {
    const weeks = (tgt - cur) / slope;
    if (weeks <= 104) eta = now + weeks * WEEK;
  }
  return { key: stat.key, cur, slope, target: tgt, eta, reached, pts };
}

/** History line + dashed projection to the target (tokens only). */
function ForecastChart({
  f,
  now,
  height,
  s,
  locale,
  area = false,
}: {
  f: Forecast;
  now: number;
  height: number;
  s: StrengthStrings;
  locale: LocaleId;
  area?: boolean;
}) {
  const W = 320;
  const x0 = f.pts[0].ts;
  const x1 = Math.max(f.eta ?? now + 8 * WEEK, now + WEEK);
  const lo = Math.min(...f.pts.map((p) => p.e1)) - 2;
  const hi = Math.max(f.target, ...f.pts.map((p) => p.e1)) + 1;
  const X = (ts: number) => ((ts - x0) / (x1 - x0 || 1)) * (W - 16) + 4;
  const Y = (v: number) => height - 18 - ((v - lo) / (hi - lo || 1)) * (height - 32);
  const line = f.pts
    .map((p, i) => `${i ? 'L' : 'M'}${X(p.ts).toFixed(1)} ${Y(p.e1).toFixed(1)}`)
    .join(' ');
  const nx = X(now);
  const ny = Y(f.cur);
  const tx = X(x1);
  const ty = f.eta ? Y(f.target) : Y(Math.min(hi, f.cur + f.slope * ((x1 - now) / WEEK)));
  const yT = Y(f.target);
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      aria-hidden
      className="uf-none ul-block"
      style={{ overflow: 'visible' }}
    >
      <path d={`M0 ${yT} H${W}`} stroke="var(--color-border)" strokeDasharray="4 5" />
      <text x="0" y={yT - 4} fill="var(--color-text-faint)" fontSize="10">
        {s.targetLabel(fmtKg(f.target))}
      </text>
      {area && (
        <path
          d={`${line} L${nx} ${height} L${X(x0)} ${height}Z`}
          fill="var(--color-ok-tint)"
          opacity="0.6"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke="var(--color-ok)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${nx} ${ny} L${tx} ${ty}`}
        stroke="var(--color-ok)"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx={nx} cy={ny} r="3.5" fill="var(--color-ok)" />
      {f.eta && (
        <>
          <circle
            cx={tx}
            cy={ty}
            r="4"
            fill="var(--color-surface)"
            stroke="var(--color-ok)"
            strokeWidth="2"
          />
          <text
            x={Math.min(tx, W - 24)}
            y={ty + 16}
            fill="var(--color-ok-text)"
            fontSize="10"
            textAnchor="middle"
          >
            {fmtDayMonth(f.eta, locale)}
          </text>
        </>
      )}
      <text
        x={nx}
        y={Math.min(height - 2, ny + 16)}
        fill="var(--color-text-muted)"
        fontSize="10"
        textAnchor="middle"
      >
        {s.today}
      </text>
    </svg>
  );
}

function TargetsSheet({
  s,
  stats,
  targets,
  onSave,
  onClose,
}: {
  s: StrengthStrings;
  stats: Record<LiftKey, LiftStat>;
  targets: Partial<Record<LiftKey, number>>;
  onSave: (t: Partial<Record<LiftKey, number>>) => void;
  onClose: () => void;
}) {
  const lifts = LIFTS.filter((k) => stats[k].best > 0);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(lifts.map((k) => [k, String(targets[k] ?? defaultTarget(stats[k].best))])),
  );
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12" style={{ padding: '4px 0 12px' }}>
        <strong className="uiw-t-lg">{s.targetsTitle}</strong>
        <Muted>{s.targetsHint}</Muted>
        {lifts.map((k) => (
          <label key={k} className="ul-flex ua-center uj-between ug-12">
            <span>
              {s.liftName[k]} <Muted>· {s.now(fmtKg(stats[k].best))}</Muted>
            </span>
            <Field
              inputMode="decimal"
              style={{ width: 96 }}
              value={draft[k] ?? ''}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
            />
          </label>
        ))}
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            const out: Partial<Record<LiftKey, number>> = {};
            for (const k of lifts) {
              const v = Number(String(draft[k] ?? '').replace(',', '.'));
              if (v > 0) out[k] = v;
            }
            onSave(out);
            onClose();
          }}
        >
          {s.save}
        </Button>
      </div>
    </Sheet>
  );
}

function PrForecastWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, now, locale, shell } = ctx;
  const s = ss(locale);
  const [targets, setTargets] = useLocal<Partial<Record<LiftKey, number>>>('pr-forecast', {});
  const [editing, setEditing] = useState(false);
  const L = liftStats(store.workouts);
  const all = LIFTS.map((k) => forecastOf(L[k], now, targets[k])).filter(
    (f): f is Forecast => f !== null,
  );
  const sheet = editing ? (
    <TargetsSheet
      s={s}
      stats={L}
      targets={targets}
      onSave={setTargets}
      onClose={() => setEditing(false)}
    />
  ) : null;
  if (all.length === 0)
    return (
      <WidgetEmpty
        size={size}
        tone="ok"
        icon="trend-up"
        kicker={s.prForecast}
        title={s.prEmpty}
        sub={s.prEmptySub}
        onAction={() => shell.goTab('progress')}
      />
    );
  const withEta = all.filter((f) => f.eta != null).sort((a, b) => (a.eta ?? 0) - (b.eta ?? 0));
  const main = withEta[0] ?? all.find((f) => f.key === 'bench') ?? all[0];
  const lift = s.liftName[main.key];
  const name = L[main.key].name;
  const open = () =>
    name ? shell.openOverlay({ screen: 'exercise-history', name }) : shell.goTab('progress');
  const date = main.eta ? fmtDayMonth(main.eta, locale) : null;
  const weeks = main.eta ? Math.max(1, Math.round((main.eta - now) / WEEK)) : null;
  const slope = signedKg(main.slope);
  const headline = main.reached
    ? s.reachedLine(lift, fmtKg(main.target))
    : date
      ? s.prBy(lift, fmtKg(main.target), date)
      : s.noEtaLine(lift, fmtKg(main.target));
  let body: ReactNode;
  if (size === 'M')
    body = (
      <Widget
        size="M"
        tone="ok"
        icon="trend-up"
        title={headline}
        sub={`${s.perWeek(slope)} · ${s.now(fmtKg(main.cur))}`}
        onClick={open}
      />
    );
  else if (size === 'S')
    body = (
      <Widget
        size="S"
        tone="ok"
        kicker={s.prForecast}
        onClick={open}
        sub={`${lift} ${fmtKg(main.cur)} → ${fmtKg(main.target)} kg`}
      >
        <div className="ul-flex ua-center ug-10 umt-auto">
          <WidgetRing value={main.cur / main.target} size={56} tone="ok">
            <span className="uiw-t-base">{Math.round((main.cur / main.target) * 100)}%</span>
          </WidgetRing>
          <div className="ul-flex ul-col umw-0">
            <span className="uiw-t-md">{main.reached ? s.reached : (date ?? s.noEta)}</span>
            {weeks != null && <Muted>{s.inWeeks(weeks)}</Muted>}
          </div>
        </div>
      </Widget>
    );
  else if (size === 'L')
    body = (
      <Widget
        size="L"
        tone="ok"
        kicker={s.prForecastOf(lift)}
        title={
          <span className="uiw-t-md">{date ? s.atPace(fmtKg(main.target), date) : headline}</span>
        }
        bodyLast
        onClick={open}
      >
        <ForecastChart f={main} now={now} height={64} s={s} locale={locale} />
      </Widget>
    );
  else {
    const others = all.filter((f) => f.key !== main.key);
    body = (
      <Widget
        size="XL"
        tone="ok"
        kicker={s.prForecastOf(lift)}
        badge={<Tag text={s.perWeek(slope)} good={main.slope > 0.05 ? true : null} />}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={() => setEditing(true)}>
            {s.changeTargets}
          </Button>
        }
      >
        <div className="ul-flex ua-base ug-8">
          <span className="uiw-value">
            {fmtKg(main.target)}
            <span className="uiw-unit">kg</span>
          </span>
          <span className="uiw-t-md">
            {main.reached ? s.reached : date ? s.byDate(date) : s.noEta}
          </span>
        </div>
        <ForecastChart f={main} now={now} height={84} s={s} locale={locale} area />
        <WidgetList
          rows={others.slice(0, 3).map((f) => ({
            label: (
              <TwoLine
                title={`${s.liftName[f.key]} → ${fmtKg(f.target)}`}
                sub={s.nowPerWk(fmtKg(f.cur), signedKg(f.slope))}
              />
            ),
            value: f.reached ? (
              <Tag text={s.reached} good />
            ) : f.eta ? (
              <Tag text={fmtDayMonth(f.eta, locale)} good />
            ) : (
              <Tag text={s.noEta} good={null} />
            ),
          }))}
        />
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

const prForecast: WidgetDef = {
  id: 'pr-forecast',
  group: 'strength',
  icon: 'trend-up',
  tone: 'ok',
  name: () => ss(getLocale()).prForecast,
  render: (size, ctx) => <PrForecastWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 4. Recent PRs
 * ===================================================================== */

interface PrEvent {
  ts: number;
  name: string;
  kind: 'e1rm' | 'reps';
  value: number;
  weight: number;
  reps: number;
  delta: number;
  day: string | null;
}

/** Personal records in history order: e1RM beats, else more reps at a weight. */
function prEvents(workouts: Workout[]): PrEvent[] {
  return memoOn(workouts, 'prs', () => {
    const fin = finishedOf(workouts).slice().reverse();
    const best = new Map<string, number>();
    const repsAt = new Map<string, Map<number, number>>();
    const out: PrEvent[] = [];
    for (const w of fin) {
      for (const ex of w.exercises) {
        if (!isStrengthExercise(ex)) continue;
        const key = ex.name.trim().toLowerCase();
        const sets = ex.sets.filter((s) => setTypeOf(s) !== 'warmup' && (s.weight ?? 0) > 0);
        if (sets.length === 0) continue;
        let top = sets[0];
        for (const s of sets) if (setBestE1rm(s) > setBestE1rm(top)) top = s;
        const e1 = setBestE1rm(top);
        const prevBest = best.get(key) ?? 0;
        const map = repsAt.get(key) ?? new Map<number, number>();
        if (prevBest > 0 && e1 > prevBest) {
          out.push({
            ts: w.startedAt,
            name: ex.name,
            kind: 'e1rm',
            value: e1,
            weight: top.weight ?? 0,
            reps: top.reps,
            delta: e1 - prevBest,
            day: w.dayName ?? null,
          });
        } else if (prevBest > 0) {
          let rep: PrEvent | null = null;
          for (const s of sets) {
            const wt = s.weight ?? 0;
            const prev = map.get(wt);
            if (prev !== undefined && s.reps > prev && (!rep || wt > rep.weight))
              rep = {
                ts: w.startedAt,
                name: ex.name,
                kind: 'reps',
                value: s.reps,
                weight: wt,
                reps: s.reps,
                delta: s.reps - prev,
                day: w.dayName ?? null,
              };
          }
          if (rep) out.push(rep);
        }
        best.set(key, Math.max(prevBest, e1));
        for (const s of sets) {
          const wt = s.weight ?? 0;
          map.set(wt, Math.max(map.get(wt) ?? 0, s.reps));
        }
        repsAt.set(key, map);
      }
    }
    return out.reverse();
  });
}

const recentPrs: WidgetDef = {
  id: 'recent-prs',
  group: 'strength',
  icon: 'trophy',
  tone: 'ok',
  name: () => ss(getLocale()).recentPrs,
  render: (size, { store, now, locale }) => {
    const s = ss(locale);
    const prs = prEvents(store.workouts);
    const open = goHash('#/progress/records');
    if (prs.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="ok"
          icon="trophy"
          kicker={s.recentPrs}
          title={s.prsEmpty}
          sub={s.prsEmptySub}
          onAction={open}
        />
      );
    const d = new Date(now);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const month = prs.filter((p) => p.ts >= monthStart).length;
    const what = (p: PrEvent) =>
      p.kind === 'e1rm'
        ? `${exName(p.name, locale)} · ${s.e1rm} ${fmtKg(p.value)}`
        : `${exName(p.name, locale)} · ${fmtKg(p.weight)} × ${p.reps}`;
    const dlt = (p: PrEvent) => (p.kind === 'e1rm' ? `+${fmtKg(p.delta)}` : s.plusReps(p.delta));
    const latest = prs[0];
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="ok"
          icon="trophy"
          title={s.prLabel(what(latest))}
          sub={`${fmtDayMonth(latest.ts, locale)}${month > 1 ? ` · ${s.moreThisMonth(month - 1)}` : ''}`}
          onClick={open}
          trailing={<Tag text={dlt(latest)} good />}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="ok"
          kicker={s.recentPrs}
          value={month}
          unit={s.thisMonthUnit}
          title={<span className="uiw-t-base">{s.latest(what(latest))}</span>}
          sub={<Tag text={`${dlt(latest)} · ${fmtDayMonth(latest.ts, locale)}`} good />}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="ok" kicker={s.recentPrs} onClick={open}>
          <div className="umt-auto">
            <WidgetList
              rows={prs.slice(0, 3).map((p) => ({
                label: what(p),
                value: fmtDayMonth(p.ts, locale),
              }))}
            />
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="ok"
        kicker={s.recentPrs}
        badge={<Tag text={s.prsThisMonth(month)} good={month > 0 ? true : null} />}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.allRecords}
          </Button>
        }
      >
        <WidgetList
          rows={prs.slice(0, 4).map((p) => ({
            label: (
              <TwoLine
                title={
                  p.kind === 'e1rm'
                    ? `${exName(p.name, locale)} · ${fmtKg(p.value)} kg`
                    : `${exName(p.name, locale)} · ${fmtKg(p.weight)} × ${p.reps}`
                }
                sub={[p.kind === 'e1rm' ? s.e1rm : s.repsAtWeight, p.day]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ),
            value: (
              <span className="ul-flex ul-col ua-end">
                <Tag text={dlt(p)} good />
                <span>{fmtDayMonth(p.ts, locale)}</span>
              </span>
            ),
          }))}
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 5. 1RM calculator (Epley — store.est1rm)
 * ===================================================================== */

const PCTS: [number, number][] = [
  [95, 2],
  [90, 4],
  [85, 6],
  [80, 8],
  [75, 10],
  [70, 12],
  [65, 15],
  [60, 20],
];

interface CalcSet {
  weight: number;
  reps: number;
  lift: LiftKey | null;
  label: string | null;
}

/** The latest main-lift top set (≤10 reps), else any strength working set. */
function lastCalcSet(workouts: Workout[]): CalcSet | null {
  const L = liftStats(workouts);
  let best: LiftPoint | null = null;
  let key: LiftKey | null = null;
  for (const k of LIFTS) {
    const p = L[k].points[L[k].points.length - 1];
    if (p && p.reps <= 10 && (!best || p.ts > best.ts)) {
      best = p;
      key = k;
    }
  }
  if (best && key) return { weight: best.weight, reps: best.reps, lift: key, label: null };
  for (const w of finishedOf(workouts))
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const s = ex.sets.find(
        (x) => setTypeOf(x) !== 'warmup' && (x.weight ?? 0) > 0 && x.reps >= 1 && x.reps <= 10,
      );
      if (s) return { weight: s.weight ?? 0, reps: s.reps, lift: null, label: ex.name };
    }
  return null;
}

function CalcSheet({
  s,
  set,
  onSave,
  onClose,
}: {
  s: StrengthStrings;
  set: CalcSet;
  onSave: (v: CalcSet) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(set.weight ? String(set.weight) : '');
  const [r, setR] = useState(set.reps ? String(set.reps) : '');
  const wn = Number(w.replace(',', '.'));
  const rn = Math.round(Number(r));
  const e1 = est1rm(wn, rn);
  return (
    <Sheet onClose={onClose}>
      <div className="ul-flex ul-col ug-12" style={{ padding: '4px 0 12px' }}>
        <strong className="uiw-t-lg">{s.oneRm}</strong>
        <div className="ul-flex ug-8 ua-end">
          <label className="uf-1 ul-flex ul-col ug-4">
            <Muted>{s.weight} (kg)</Muted>
            <Field inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
          </label>
          <span style={{ paddingBottom: 10 }}>×</span>
          <label className="uf-1 ul-flex ul-col ug-4">
            <Muted>{s.reps}</Muted>
            <Field inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} />
          </label>
        </div>
        <WidgetStats items={[{ label: s.estimated, value: e1 > 0 ? `${e1} kg` : s.upTo10 }]} />
        {e1 > 0 && (
          <WidgetList
            rows={PCTS.map(([p, n]) => ({
              label: `${p}%`,
              value: `${fmtKg(half((e1 * p) / 100))} × ${n}`,
            }))}
          />
        )}
        <Button
          variant="primary"
          fullWidth
          disabled={e1 <= 0}
          onClick={() => {
            onSave({ weight: wn, reps: rn, lift: null, label: null });
            onClose();
          }}
        >
          {s.save}
        </Button>
      </div>
    </Sheet>
  );
}

function OneRmWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, locale } = ctx;
  const s = ss(locale);
  const [saved, setSaved] = useLocal<CalcSet | null>('one-rm-calc', null);
  const [editing, setEditing] = useState(false);
  const L = liftStats(store.workouts);
  const set = saved ?? lastCalcSet(store.workouts);
  const openSheet = () => setEditing(true);
  const sheet = editing ? (
    <CalcSheet
      s={s}
      set={set ?? { weight: 0, reps: 5, lift: null, label: null }}
      onSave={setSaved}
      onClose={() => setEditing(false)}
    />
  ) : null;
  const e1 = set ? est1rm(set.weight, set.reps) : 0;
  if (!set || e1 <= 0)
    return (
      <>
        <WidgetEmpty
          size={size}
          tone="neutral"
          icon="list-numbers"
          kicker={s.oneRm}
          title={s.oneRmEmpty}
          sub={s.tapToEdit}
          action={s.enterSet}
          onAction={openSheet}
        />
        {sheet}
      </>
    );
  const liftLabel = set.lift
    ? s.liftName[set.lift].toLowerCase()
    : set.label
      ? exName(set.label, locale)
      : null;
  const from = `${fmtKg(set.weight)} × ${set.reps}`;
  const at = (p: number) => fmtKg(half((e1 * p) / 100));
  const liftChips = LIFTS.filter((k) => L[k].points.some((x) => x.reps <= 10));
  const pick = (k: LiftKey) => {
    const p = L[k].points.filter((x) => x.reps <= 10).pop();
    if (p) setSaved({ weight: p.weight, reps: p.reps, lift: k, label: null });
  };
  let body: ReactNode;
  if (size === 'M')
    body = (
      <Widget
        size="M"
        tone="neutral"
        icon="list-numbers"
        title={`${from} → ${e1} kg`}
        sub={liftLabel ? s.fromLast(liftLabel) : s.est1rm}
        onClick={openSheet}
      />
    );
  else if (size === 'S')
    body = (
      <Widget
        size="S"
        tone="neutral"
        kicker={s.est1rm}
        value={e1}
        unit="kg"
        sub={liftLabel ? s.fromSet(from, liftLabel) : from}
        onClick={openSheet}
        bodyLast
      >
        <WidgetStats items={[{ label: '80%', value: `${at(80)} × 8` }]} />
      </Widget>
    );
  else if (size === 'L')
    body = (
      <Widget size="L" tone="neutral" kicker={s.oneRm} badge={s.epley} onClick={openSheet}>
        <div className="umt-auto">
          <WidgetStats
            items={[
              { label: s.weight, value: `${fmtKg(set.weight)} kg` },
              { label: s.reps, value: set.reps },
              { label: s.estimated, value: `${e1} kg` },
            ]}
          />
        </div>
      </Widget>
    );
  else
    body = (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.oneRm}
        badge={s.epley}
        onClick={openSheet}
        footer={
          liftChips.length > 0 ? (
            <div className="ul-flex ug-6 ul-wrap">
              {liftChips.map((k) => (
                <Chip key={k} size="sm" selected={set.lift === k} onClick={() => pick(k)}>
                  {s.liftName[k]}
                </Chip>
              ))}
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={openSheet}>
              {s.enterSet}
            </Button>
          )
        }
      >
        <WidgetStats
          items={[
            { label: s.weight, value: `${fmtKg(set.weight)} kg` },
            { label: s.reps, value: set.reps },
            { label: '1RM', value: `${e1} kg` },
          ]}
        />
        <div
          className="ul-grid"
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 18px' }}
        >
          <WidgetList
            rows={PCTS.slice(0, 4).map(([p, n]) => ({ label: `${p}%`, value: `${at(p)} × ${n}` }))}
          />
          <WidgetList
            rows={PCTS.slice(4).map(([p, n]) => ({ label: `${p}%`, value: `${at(p)} × ${n}` }))}
          />
        </div>
      </Widget>
    );
  return (
    <>
      {body}
      {sheet}
    </>
  );
}

const oneRmCalc: WidgetDef = {
  id: 'one-rm-calc',
  group: 'strength',
  icon: 'list-numbers',
  tone: 'neutral',
  name: () => ss(getLocale()).oneRm,
  render: (size, ctx) => <OneRmWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 6. Plate calculator (plates.ts)
 * ===================================================================== */

/** Disc colours by denomination as tokens (the calibrated-plate convention). */
const PLATE_TOKEN: Record<number, string> = {
  25: 'var(--color-danger)',
  20: 'var(--color-kcal)',
  15: 'var(--color-accent)',
  10: 'var(--color-ok)',
  5: 'var(--color-neutral-100)',
  2.5: 'var(--color-neutral-400)',
  1.25: 'var(--color-neutral-500)',
  0.5: 'var(--color-neutral-600)',
};

/** One loaded sleeve: bar end, collar, plates (heaviest inside), bar. */
function BarSide({ plates, h }: { plates: number[]; h: number }) {
  const sleeve = Math.max(6, Math.round(h * 0.1));
  return (
    <div className="ul-flex ua-center ug-2 uf-none" style={{ height: h }} aria-hidden>
      <span
        className="ur-sm tw-bg-n700 uf-none"
        style={{ width: Math.round(h * 0.25), height: sleeve }}
      />
      <span
        className="ur-sm tw-bg-n400 uf-none"
        style={{ width: Math.max(4, Math.round(h * 0.06)), height: Math.round(h * 0.3) }}
      />
      {plates.map((d, i) => (
        <span
          key={i}
          className="ur-sm"
          style={{
            width: Math.max(3, Math.round(h * (d >= 15 ? 0.14 : d >= 5 ? 0.09 : 0.05))),
            minWidth: 2,
            flex: '0 1 auto',
            height: Math.round(h * (0.3 + (Math.min(d, 25) / 25) * 0.7)),
            background: PLATE_TOKEN[d] ?? 'var(--color-neutral-500)',
          }}
        />
      ))}
      <span className="ur-sm tw-bg-n700 uf-1" style={{ height: sleeve }} />
    </div>
  );
}

/** The widget's default load: the next target on a barbell lift, else the last barbell weight. */
function defaultBarKg(ctx: WidgetCtx): number {
  const plan = nextPlan(ctx);
  const bar = plan?.lifts.find(
    (l) => equipmentFor({ name: l.name }).includes('barbell') && (l.target.weight ?? 0) > 20,
  );
  if (bar?.target.weight) return bar.target.weight;
  for (const w of finishedOf(ctx.store.workouts))
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex) || !equipmentFor(ex).includes('barbell')) continue;
      const top = Math.max(
        0,
        ...ex.sets.filter((x) => setTypeOf(x) !== 'warmup').map((x) => x.weight ?? 0),
      );
      if (top > 20) return top;
    }
  return 60;
}

function PlateWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const s = ss(ctx.locale);
  const [adj, setAdj] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const def = defaultBarKg(ctx);
  const target = adj ?? def;
  const sol = solvePlates(target, { barKg: 20, unit: 'kg' });
  const perSideTxt = sol.perSide.length ? sol.perSide.map(fmtKg).join(' + ') : s.barOnly;
  const show = () => setOpen(true);
  const sheet = open ? (
    <PlateSheet targetKg={target} onApply={(kg) => setAdj(kg)} onClose={() => setOpen(false)} />
  ) : null;
  const value = fmtKg(sol.achievedKg);
  let body: ReactNode;
  if (size === 'M')
    body = (
      <Widget
        size="M"
        tone="neutral"
        icon="circle"
        title={`${value} kg: ${perSideTxt}`}
        sub={sol.exact ? s.bar20 : s.closest(fmtKg(target))}
        onClick={show}
      />
    );
  else if (size === 'S')
    body = (
      <Widget
        size="S"
        tone="neutral"
        kicker={s.platesPerSide}
        value={value}
        unit="kg"
        sub={perSideTxt}
        onClick={show}
      >
        <div className="umt-auto">
          <BarSide plates={sol.perSide} h={40} />
        </div>
      </Widget>
    );
  else if (size === 'L')
    body = (
      <Widget size="L" tone="neutral" kicker={s.plates} onClick={show}>
        <div className="ul-flex ua-center ug-14 uf-1">
          <div className="ul-flex ul-col ug-4 uf-none" style={{ width: 110 }}>
            <span className="uiw-value">
              {value}
              <span className="uiw-unit">kg</span>
            </span>
            <Muted>{s.perSide(fmtKg(sol.perSideKg))}</Muted>
            <span className="uiw-t-base">{perSideTxt}</span>
          </div>
          <div className="uf-1 umw-0">
            <BarSide plates={sol.perSide} h={96} />
          </div>
        </div>
      </Widget>
    );
  else {
    const warm = (p: number) => {
      const w = Math.max(20, Math.round((target * p) / 100 / 2.5) * 2.5);
      const ws = solvePlates(w, { barKg: 20, unit: 'kg' });
      return ws.perSide.length ? ws.perSide.map(fmtKg).join(' + ') : s.barOnly;
    };
    const denoms = [...new Set(sol.perSide)];
    body = (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.plateCalc}
        badge={s.barPerSide}
        onClick={show}
        footer={
          <WidgetStats
            items={[
              { label: s.warmup(60), value: warm(60) },
              { label: s.warmup(80), value: warm(80) },
              { label: s.topSet, value: perSideTxt },
            ]}
          />
        }
      >
        <div className="ul-flex ua-center uj-between ug-8">
          <Button variant="secondary" size="sm" onClick={() => setAdj(Math.max(20, target - 2.5))}>
            − 2.5
          </Button>
          <span className="uiw-value">
            {value}
            <span className="uiw-unit">kg</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => setAdj(target + 2.5)}>
            + 2.5
          </Button>
        </div>
        <BarSide plates={sol.perSide} h={110} />
        <div className="uiw-t-base ul-flex ug-10 ul-wrap">
          {denoms.map((d) => (
            <Swatch key={d} color={PLATE_TOKEN[d] ?? 'var(--color-neutral-500)'}>
              {fmtKg(d)} × {sol.perSide.filter((x) => x === d).length}
            </Swatch>
          ))}
          {!sol.exact && <Muted>{s.closest(fmtKg(target))}</Muted>}
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

const plateCalc: WidgetDef = {
  id: 'plate-calc',
  group: 'strength',
  icon: 'circle',
  tone: 'neutral',
  name: () => ss(getLocale()).plateCalc,
  render: (size, ctx) => <PlateWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 7. Strength balance (squat : bench : deadlift vs typical)
 * ===================================================================== */

/** Typical proportions relative to the deadlift (≈ 1.31 : 1 : 1.54 S:B:D). */
const TYPICAL: Record<'squat' | 'bench' | 'deadlift', number> = {
  squat: 0.85,
  bench: 0.65,
  deadlift: 1,
};

const balance: WidgetDef = {
  id: 'strength-balance',
  group: 'strength',
  icon: 'scales',
  tone: 'neutral',
  name: () => ss(getLocale()).balance,
  render: (size, { store, locale }) => {
    const s = ss(locale);
    const L = liftStats(store.workouts);
    const open = goHash('#/trends');
    if (!BIG3.every((k) => L[k].best > 0))
      return (
        <WidgetEmpty
          size={size}
          tone="neutral"
          icon="scales"
          kicker={s.balance}
          title={s.balanceEmpty}
          sub={s.balanceEmptySub}
          onAction={open}
        />
      );
    const dl = L.deadlift.best;
    // Deadlift-equivalent of each lift; the strongest sets the reference.
    const ref = Math.max(...BIG3.map((k) => L[k].best / TYPICAL[k]));
    const lags = BIG3.map((k) => ({ k, lag: TYPICAL[k] * ref - L[k].best }));
    const worst = lags.reduce((a, b) => (b.lag > a.lag ? b : a));
    const balanced = worst.lag < 0.05 * TYPICAL[worst.k] * ref;
    const lagKg = Math.max(2.5, Math.round(worst.lag / 2.5) * 2.5);
    const ratio = (k: LiftKey) => (L[k].best / dl).toFixed(2);
    const tone = (k: 'squat' | 'bench' | 'deadlift'): Tone =>
      !balanced && k === worst.k ? 'injury' : k === 'deadlift' ? 'ok' : 'accent';
    const liftN = s.liftName[worst.k];
    const title = balanced ? s.balanced : s.lags(liftN);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone={balanced ? 'ok' : 'injury'}
          icon="scales"
          title={balanced ? s.balanced : s.lagsBy(liftN, fmtKg(lagKg))}
          sub={BIG3.map((k) => `${s.liftName[k]} ${ratio(k)}`).join(' · ')}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={s.balance}
          title={title}
          value={balanced ? undefined : `−${fmtKg(lagKg)}`}
          unit={balanced ? undefined : 'kg'}
          sub={balanced ? s.balancedSub : s.vsTypical(fmtKg(dl))}
          onClick={open}
          bodyLast
        >
          <div className="ul-flex ug-4">
            {BIG3.map((k) => (
              <span key={k} className="uf-1">
                <WidgetBar value={1} tone={tone(k)} height={5} />
              </span>
            ))}
          </div>
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={s.balanceVsDl}
          badge={`│ ${s.typical}`}
          onClick={open}
        >
          <div className="ul-flex ul-col ug-10 umt-auto">
            {BIG3.map((k) => (
              <MeterRow
                key={k}
                label={s.liftName[k]}
                value={k === 'deadlift' ? '1.00' : `${ratio(k)} / ${TYPICAL[k].toFixed(2)}`}
                bar={L[k].best / Math.max(dl, L[k].best)}
                marker={k === 'deadlift' ? null : TYPICAL[k]}
                tone={tone(k)}
              />
            ))}
          </div>
        </Widget>
      );
    const b = L.bench.best;
    const imb = strengthImbalance(standardsOf(store.workouts, store.bodyMetrics).results);
    const nameOf = (k: string) => s.liftName[k as LiftKey] ?? k;
    const note = balanced
      ? s.balancedSub
      : `${s.lagNote(liftN, fmtKg(lagKg))}${imb ? ` ${s.tierNote(nameOf(imb.lift), nameOf(imb.strongest))}` : ''}`;
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.balance}
        badge={s.e1rm12}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.openTrends}
          </Button>
        }
      >
        <div className="ul-flex ul-col ug-2">
          <span className="uiw-value uiw-t-num">
            {`${(L.squat.best / b).toFixed(2)} : 1 : ${(dl / b).toFixed(2)}`}
          </span>
          <Muted>{s.ratioSub('1.31 : 1 : 1.54')}</Muted>
        </div>
        <WidgetBars
          values={BIG3.flatMap((k) => [L[k].best, TYPICAL[k] * ref])}
          highlight={[0, 2, 4]}
          height={90}
          tone="accent"
          labels={BIG3.flatMap((k) => [`${s.liftShort[k]} ${fmtKg(L[k].best)}`, ''])}
        />
        <div className="uiw-t-base ul-flex ug-12">
          <Swatch color="var(--color-accent)">{s.you}</Swatch>
          <Swatch color="var(--color-neutral-800)">{s.typicalFor}</Swatch>
        </div>
        <Muted>{note}</Muted>
      </Widget>
    );
  },
};

/* =====================================================================
 * 8. Standards (sport class on the powerlifting total)
 * ===================================================================== */

const standards: WidgetDef = {
  id: 'standards',
  group: 'strength',
  icon: 'medal',
  tone: 'accent',
  name: () => ss(getLocale()).standards,
  render: (size, { store, t, locale, openWeight }) => {
    const s = ss(locale);
    const open = goHash('#/apex/ranks');
    const bw = bodyKg(store.bodyMetrics);
    if (bw <= 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="medal"
          kicker={s.standards}
          title={s.stdNeedWeight}
          sub={s.stdNeedWeightSub}
          action={s.logWeight}
          onAction={openWeight}
        />
      );
    const r = standardsOf(store.workouts, store.bodyMetrics).results.find((x) => x.key === 'total');
    if (!r || !r.trained)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="medal"
          kicker={s.standards}
          title={s.stdEmpty}
          sub={s.balanceEmptySub}
          onAction={open}
        />
      );
    const label = (i: number) => t.rankShort[RANKS[i]] ?? RANKS[i];
    const cur = r.achievedIdx >= 0 ? s.cls(label(r.achievedIdx)) : t.stdBelowRank;
    const curShort = r.achievedIdx >= 0 ? label(r.achievedIdx) : '—';
    const next = r.nextIdx != null ? s.cls(label(r.nextIdx)) : null;
    const toGo = r.toGo != null && next ? s.toNext(fmtKg(r.toGo), next) : s.topRank;
    const total = fmtKg(r.best);
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="medal"
          title={`${cur} · ${s.totalLine(total)}`}
          sub={`${toGo} · ${s.cat(r.classLabel)}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.classKicker(r.classLabel)}
          value={<span className="tw-accent-deep">{curShort}</span>}
          sub={toGo}
          onClick={open}
          bodyLast
        >
          <WidgetBar value={r.progress} />
        </Widget>
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.stdKickerL(r.classLabel)}
          badge={`BW ${fmtKg(bw)}`}
          value={total}
          unit={r.nextIdx != null ? `/ ${fmtKg(r.thresholds[r.nextIdx])} kg` : 'kg'}
          sub={<span className="tw-accent-deep">{toGo}</span>}
          onClick={open}
        >
          <div className="ul-flex ug-4">
            {r.tierIds.map((id, i) => (
              <div key={id} className="uf-1 ul-flex ul-col ug-6 ua-center">
                <span className="uw-full">
                  <WidgetBar
                    height={8}
                    tone={i < r.achievedIdx ? 'ok' : 'accent'}
                    value={i <= r.achievedIdx ? 1 : i === r.nextIdx ? r.progress : 0}
                  />
                </span>
                <Muted>{label(i)}</Muted>
              </div>
            ))}
          </div>
        </Widget>
      );
    const shown = Math.min(r.tierIds.length, Math.max(4, (r.nextIdx ?? r.tierIds.length - 1) + 2));
    const rows = r.tierIds
      .slice(0, shown)
      .map((_, i) => i)
      .reverse();
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.stdKickerXL(r.classLabel)}
        badge={s.rawTotal}
        onClick={open}
        footer={
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.openStandards}
          </Button>
        }
      >
        <div className="ul-flex ua-base ug-10">
          <span className="uiw-value tw-accent-deep">{cur}</span>
          <Muted>{s.kgTotal(total)}</Muted>
        </div>
        <WidgetList
          rows={rows.map((i) => ({
            icon: i <= r.achievedIdx ? 'check-circle' : i === r.nextIdx ? 'target' : 'circle',
            tone: (i <= r.achievedIdx ? 'ok' : i === r.nextIdx ? 'accent' : 'neutral') as Tone,
            label: `${s.cls(label(i))}${i === r.achievedIdx ? s.youMark : ''}`,
            value:
              i === r.nextIdx && r.toGo != null
                ? `${s.toGo(fmtKg(r.toGo))} · ${fmtKg(r.thresholds[i])}`
                : fmtKg(r.thresholds[i]),
          }))}
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 9. Powerlifting total
 * ===================================================================== */

function totalAt(L: Record<LiftKey, LiftStat>, ts: number): number {
  const v = BIG3.map((k) => bestAt(L[k].points, ts));
  return v.every((x) => x > 0) ? v.reduce((a, b) => a + b, 0) : 0;
}

const plTotal: WidgetDef = {
  id: 'pl-total',
  group: 'strength',
  icon: 'barbell',
  tone: 'accent',
  name: () => ss(getLocale()).plTotal,
  render: (size, { store, now, t, locale, shell }) => {
    const s = ss(locale);
    const L = liftStats(store.workouts);
    const open = () => shell.goTab('progress');
    const total = totalAt(L, now);
    if (total <= 0)
      return (
        <WidgetEmpty
          size={size}
          tone="accent"
          icon="barbell"
          kicker={s.plTotal}
          title={s.balanceEmpty}
          sub={s.balanceEmptySub}
          onAction={open}
        />
      );
    const was30 = totalAt(L, now - 30 * DAY);
    const d30 = was30 > 0 ? total - was30 : 0;
    const good = (d: number) => (d > 0 ? true : d < 0 ? false : null);
    const series: number[] = [];
    for (let i = 11; i >= 0; i--) series.push(totalAt(L, now - i * WEEK));
    const spark = series.filter((v) => v > 0);
    const line = BIG3.map((k) => `${s.liftShort[k]} ${fmtKg(L[k].best)}`).join(' · ');
    const stack = (
      <StackBar parts={BIG3.map((k) => ({ value: L[k].best, color: LIFT_COLOR[k] }))} />
    );
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="accent"
          icon="barbell"
          title={s.totalKg(fmtKg(total))}
          sub={line}
          onClick={open}
          trailing={<Tag text={signedKg(d30)} good={good(d30)} />}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="accent"
          kicker={s.total}
          value={fmtKg(total)}
          unit="kg"
          sub={<Tag text={s.days30(signedKg(d30))} good={good(d30)} />}
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="accent"
          kicker={s.plTotal}
          badge={<Tag text={s.days30(signedKg(d30))} good={good(d30)} />}
          onClick={open}
        >
          <div className="ul-flex uj-between ua-end ug-12">
            <span className="uiw-value">
              {fmtKg(total)}
              <span className="uiw-unit">kg</span>
            </span>
            <span style={{ width: 150 }}>
              {spark.length > 1 && <WidgetSpark points={spark} height={36} tone="ok" />}
            </span>
          </div>
          <div className="ul-flex ul-col ug-6 umt-auto">
            {stack}
            <div className="uiw-t-base ul-flex ug-14">
              {BIG3.map((k) => (
                <Swatch key={k} color={LIFT_COLOR[k]}>
                  {s.liftName[k]} {fmtKg(L[k].best)}
                </Swatch>
              ))}
            </div>
          </div>
        </Widget>
      );
    const start = now - 11 * WEEK;
    const d12 = spark.length > 1 ? total - spark[0] : 0;
    const std = standardsOf(store.workouts, store.bodyMetrics).results.find(
      (x) => x.key === 'total',
    );
    const rank = (i: number) => t.rankShort[RANKS[i]] ?? RANKS[i];
    const cls =
      std && std.trained && bodyKg(store.bodyMetrics) > 0 && std.achievedIdx >= 0
        ? std.nextIdx != null && std.toGo != null
          ? s.clsTo(rank(std.achievedIdx), fmtKg(std.toGo), rank(std.nextIdx))
          : s.cls(rank(std.achievedIdx))
        : s.weeks(12);
    return (
      <Widget
        size="XL"
        tone="accent"
        kicker={s.plTotal}
        badge={s.weeks(12)}
        onClick={open}
        footer={
          <NoteAction
            note={cls}
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.viewProgress}
              </Button>
            }
          />
        }
      >
        <div className="ul-flex uj-between ua-base">
          <span className="uiw-value">
            {fmtKg(total)}
            <span className="uiw-unit">kg</span>
          </span>
          <Tag text={s.since(signedKg(d12), fmtDayMonth(start, locale))} good={good(d12)} />
        </div>
        {spark.length > 1 && <WidgetSpark points={spark} height={64} tone="ok" area />}
        {stack}
        <WidgetList
          rows={BIG3.map((k) => {
            const was = bestAt(L[k].points, start);
            const d = was > 0 ? L[k].best - was : 0;
            return {
              label: <Swatch color={LIFT_COLOR[k]}>{s.liftName[k]}</Swatch>,
              value: (
                <span className="ul-flex ug-10">
                  <span className="ut-text">{fmtKg(L[k].best)}</span>
                  <span className="utx-right" style={{ width: 40 }}>
                    <Tag text={signedKg(d)} good={good(d)} />
                  </span>
                </span>
              ),
            };
          })}
        />
      </Widget>
    );
  },
};

/* =====================================================================
 * 10. Relative strength (e1RM ÷ bodyweight)
 * ===================================================================== */

const MILESTONES: Record<LiftKey, number[]> = {
  squat: [1, 1.5, 2, 2.5, 3],
  bench: [0.75, 1, 1.25, 1.5, 2],
  deadlift: [1.5, 2, 2.5, 3, 3.5],
  ohp: [0.5, 0.75, 1, 1.25, 1.5],
};

const relative: WidgetDef = {
  id: 'relative-strength',
  group: 'strength',
  icon: 'person-simple',
  tone: 'neutral',
  name: () => ss(getLocale()).relStrength,
  render: (size, { store, now, locale, openWeight }) => {
    const s = ss(locale);
    const L = liftStats(store.workouts);
    const bw = bodyKg(store.bodyMetrics);
    const trained = LIFTS.filter((k) => L[k].best > 0);
    if (bw <= 0 || trained.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="neutral"
          icon="person-simple"
          kicker={s.relStrength}
          title={bw <= 0 ? s.relEmpty : s.topLiftsEmpty}
          sub={bw <= 0 ? s.relEmptySub : s.topLiftsEmptySub}
          action={bw <= 0 ? s.logWeight : undefined}
          onAction={openWeight}
        />
      );
    const ratio = (k: LiftKey) => L[k].best / bw;
    const r2 = (n: number) => n.toFixed(2);
    const main: LiftKey = trained.includes('bench') ? 'bench' : trained[0];
    const others = trained.filter((k) => k !== main);
    const scale = Math.max(2.5, ...trained.map((k) => Math.ceil(ratio(k) * 2) / 2));
    const next = (k: LiftKey) => MILESTONES[k].find((m) => m > ratio(k) + 0.005) ?? null;
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="neutral"
          icon="person-simple"
          title={s.bwTimes(s.liftName[main], r2(ratio(main)))}
          sub={
            others.map((k) => `${s.liftName[k]} ${r2(ratio(k))}×`).join(' · ') ||
            s.bwKicker(fmtKg(bw))
          }
          onClick={openWeight}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="neutral"
          kicker={s.xBw(s.liftName[main])}
          value={r2(ratio(main))}
          unit="×"
          sub={`${fmtKg(L[main].best)} / ${fmtKg(bw)} kg`}
          onClick={openWeight}
        />
      );
    if (size === 'L')
      return (
        <Widget
          size="L"
          tone="neutral"
          kicker={s.bwKicker(fmtKg(bw))}
          badge={s.scale(fmtKg(scale))}
          onClick={openWeight}
        >
          <div className="ul-flex ul-col ug-8 umt-auto">
            {trained.slice(0, 3).map((k) => (
              <MeterRow
                key={k}
                label={s.liftName[k]}
                value={`${r2(ratio(k))}×`}
                bar={ratio(k) / scale}
                tone={k === 'deadlift' ? 'ok' : 'accent'}
              />
            ))}
          </div>
        </Widget>
      );
    const big3 = BIG3.every((k) => L[k].best > 0) ? BIG3.reduce((a, k) => a + L[k].best, 0) : 0;
    const closest = trained
      .map((k) => ({ k, m: next(k) }))
      .filter((x): x is { k: LiftKey; m: number } => x.m !== null)
      .map((x) => ({ ...x, kg: x.m * bw - L[x.k].best }))
      .sort((a, b) => a.kg - b.kg)[0];
    const ws = (store.bodyMetrics?.weights ?? [])
      .filter((w) => w.at >= now - 30 * DAY)
      .sort((a, b) => a.at - b.at);
    const d30 = ws.length > 1 ? ws[ws.length - 1].weight - ws[0].weight : 0;
    return (
      <Widget
        size="XL"
        tone="neutral"
        kicker={s.bwKicker(fmtKg(bw))}
        badge={`│ ${s.nextMilestone}`}
        onClick={openWeight}
        footer={
          <NoteAction
            note={`BW ${fmtKg(bw)} · ${signedKg(d30)} ${s.in30}`}
            action={
              <Button variant="primary" size="sm" onClick={openWeight}>
                {s.logWeight}
              </Button>
            }
          />
        }
      >
        {big3 > 0 && (
          <div className="ul-flex ua-base ug-8">
            <span className="uiw-value">
              {r2(big3 / bw)}
              <span className="uiw-unit">×</span>
            </span>
            <Muted>{s.totalBw(fmtKg(big3))}</Muted>
          </div>
        )}
        <div className="ul-flex ul-col ug-10">
          {trained.map((k) => {
            const m = next(k);
            return (
              <MeterRow
                key={k}
                label={s.liftName[k]}
                value={m ? `${r2(ratio(k))}× / ${m}` : `${r2(ratio(k))}×`}
                bar={ratio(k) / scale}
                marker={m ? m / scale : null}
                tone={k === 'deadlift' ? 'ok' : 'accent'}
              />
            );
          })}
        </div>
        {closest && (
          <WidgetStats
            items={[
              {
                label: s.closestMilestone,
                value: s.milestone(
                  s.liftName[closest.k],
                  String(closest.m),
                  fmtKg(half(closest.m * bw)),
                ),
              },
              { label: s.toGoLabel, value: `+${fmtKg(Math.max(0, closest.kg))} kg` },
            ]}
          />
        )}
      </Widget>
    );
  },
};

/* =====================================================================
 * 11. Rep PRs (most reps at each weight)
 * ===================================================================== */

interface RepCell {
  weight: number;
  reps: number;
  ts: number;
}

function repTable(workouts: Workout[], key: LiftKey): RepCell[] {
  return memoOn(workouts, `reps:${key}`, () => {
    const match = liftMatcher(key);
    const fin = finishedOf(workouts).slice().reverse();
    const m = new Map<number, RepCell>();
    for (const w of fin)
      for (const ex of w.exercises) {
        if (!isStrengthExercise(ex) || !match(ex.name)) continue;
        for (const s of ex.sets) {
          const wt = s.weight ?? 0;
          if (setTypeOf(s) === 'warmup' || wt <= 0 || s.reps < 1) continue;
          const cur = m.get(wt);
          if (!cur || s.reps > cur.reps) m.set(wt, { weight: wt, reps: s.reps, ts: w.startedAt });
        }
      }
    return [...m.values()].sort((a, b) => a.weight - b.weight);
  });
}

/** Up to n cells spread across the range, heaviest always included. */
function spread(cells: RepCell[], n: number): RepCell[] {
  if (cells.length <= n) return cells;
  const out: RepCell[] = [];
  for (let i = 0; i < n; i++) out.push(cells[Math.round((i * (cells.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

function RepPrWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, locale, shell } = ctx;
  const s = ss(locale);
  const L = liftStats(store.workouts);
  const [sel, setSel] = useLocal<string>('rep-prs', '');
  const options = LIFTS.filter((k) => L[k].best > 0);
  const key: LiftKey | null = options.includes(sel as LiftKey)
    ? (sel as LiftKey)
    : options.includes('bench')
      ? 'bench'
      : (options[0] ?? null);
  const cells = key ? repTable(store.workouts, key) : [];
  if (!key || cells.length === 0)
    return (
      <WidgetEmpty
        size={size}
        tone="ok"
        icon="chart-bar"
        kicker={s.repPrs}
        title={s.repEmpty}
        sub={s.topLiftsEmptySub}
        onAction={() => shell.goTab('progress')}
      />
    );
  const lift = s.liftName[key];
  const name = L[key].name;
  const open = () =>
    name ? shell.openOverlay({ screen: 'exercise-history', name }) : shell.goTab('progress');
  const latest = cells.reduce((a, b) => (b.ts > a.ts ? b : a));
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="ok"
        icon="chart-bar"
        title={s.repTitle(lift, fmtKg(latest.weight), latest.reps)}
        sub={s.bestSet(fmtDayMonth(latest.ts, locale))}
        onClick={open}
      />
    );
  const four = spread(cells, 4);
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="ok"
        kicker={s.repPrOf(lift)}
        value={latest.reps}
        unit={s.repsUnit}
        sub={s.atKg(fmtKg(latest.weight), fmtDayMonth(latest.ts, locale))}
        onClick={open}
        bodyLast
      >
        <WidgetBars
          values={four.map((c) => c.reps)}
          highlight={[four.indexOf(latest)].filter((i) => i >= 0)}
          height={22}
          tone="ok"
        />
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget size="L" tone="ok" kicker={s.repPrsOf(lift)} badge={s.bestReps} onClick={open}>
        <div className="umt-auto">
          <WidgetStats
            items={four.map((c) => ({
              label: `${fmtKg(c.weight)} kg`,
              value: (
                <span className="ul-flex ul-col">
                  <span
                    className="uiw-t-xl"
                    style={{ color: c === latest ? 'var(--color-ok)' : 'var(--color-text)' }}
                  >
                    {c.reps}
                  </span>
                  <Muted>{fmtDayMonth(c.ts, locale)}</Muted>
                </span>
              ),
            }))}
          />
        </div>
      </Widget>
    );
  const six = spread(cells, 6);
  const heavy = cells.slice(-3).reverse();
  return (
    <Widget
      size="XL"
      tone="ok"
      kicker={s.repPrsOf(lift)}
      badge={s.bestReps}
      onClick={open}
      footer={
        options.length > 1 ? (
          <div className="ul-flex ug-6 ul-wrap">
            {options.map((k) => (
              <Chip key={k} size="sm" selected={k === key} onClick={() => setSel(k)}>
                {s.liftName[k]}
              </Chip>
            ))}
          </div>
        ) : (
          <Button variant="primary" size="sm" fullWidth onClick={open}>
            {s.exerciseHistory}
          </Button>
        )
      }
    >
      <WidgetBars
        values={six.map((c) => c.reps)}
        highlight={[six.indexOf(latest)].filter((i) => i >= 0)}
        height={60}
        tone="ok"
        labels={six.map((c) => `${fmtKg(c.weight)}·${c.reps}`)}
      />
      <Muted>{s.chances}</Muted>
      <WidgetList
        rows={heavy.map((c) => ({
          label: (
            <TwoLine
              title={`${fmtKg(c.weight)} kg`}
              sub={s.bestOn(c.reps, fmtDayMonth(c.ts, locale))}
            />
          ),
          value: <Tag text={s.isPr(c.reps + 1)} good />,
        }))}
      />
    </Widget>
  );
}

const repPrs: WidgetDef = {
  id: 'rep-prs',
  group: 'strength',
  icon: 'chart-bar',
  tone: 'ok',
  name: () => ss(getLocale()).repPrs,
  render: (size, ctx) => <RepPrWidget size={size} ctx={ctx} />,
};

/* =====================================================================
 * 12. Stalled lifts (progression engine: top weight flat 3+ sessions)
 * ===================================================================== */

interface Stall {
  name: string;
  n: number;
  weight: number;
  reps: number;
  target: Target;
  spark: number[];
  swap: string | null;
}

function stalls(
  workouts: Workout[],
  now: number,
): { stalled: Stall[]; watching: { name: string; n: number }[] } {
  return memoOn(workouts, `stalls:${hourKey(now)}`, () => {
    const fin = finishedOf(workouts);
    const seen = new Map<string, string>();
    for (const w of fin) {
      if (w.startedAt < now - 8 * WEEK) break;
      for (const ex of w.exercises)
        if (isStrengthExercise(ex) && ex.sets.some((x) => (x.weight ?? 0) > 0)) {
          const k = ex.name.trim().toLowerCase();
          if (!seen.has(k)) seen.set(k, ex.name);
        }
    }
    const stalled: Stall[] = [];
    const watching: { name: string; n: number }[] = [];
    for (const name of seen.values()) {
      const hist = topHistory(fin, name);
      if (hist.length < 2 || (hist[0].weight ?? 0) <= 0) continue;
      const equipment = equipmentFor({ name });
      const target = nextTarget(hist, {
        equipment,
        primary: muscleInfoByName(name)?.primary ?? null,
        loadType: loadTypeFor({ name, equipment }),
      });
      let n = 0;
      while (n < hist.length && hist[n].weight === hist[0].weight) n++;
      if (target.state === 'stall') {
        stalled.push({
          name,
          n,
          weight: hist[0].weight ?? 0,
          reps: hist[0].reps,
          target,
          spark: hist
            .slice(0, 6)
            .reverse()
            .map((p) => est1rm(p.weight ?? 0, p.reps) || (p.weight ?? 0)),
          swap: n >= 4 ? (swapCandidates(name, null, 1)[0]?.name ?? null) : null,
        });
      } else if (n === 2 && hist[0].reps <= hist[1].reps) {
        watching.push({ name, n });
      }
    }
    stalled.sort((a, b) => b.n - a.n);
    return { stalled, watching };
  });
}

const stalledLifts: WidgetDef = {
  id: 'stalled-lifts',
  group: 'strength',
  icon: 'warning-circle',
  tone: 'injury',
  name: () => ss(getLocale()).stalled,
  render: (size, { store, now, locale }) => {
    const s = ss(locale);
    const { stalled, watching } = stalls(store.workouts, now);
    const open = goHash('#/trends');
    if (stalled.length === 0)
      return (
        <WidgetEmpty
          size={size}
          tone="ok"
          icon="check-circle"
          kicker={s.stalled}
          title={s.noStalls}
          sub={watching.length ? s.watching(exName(watching[0].name, locale), 2) : s.noStallsSub}
          onAction={open}
        />
      );
    const first = stalled[0];
    const set = (x: Stall) => `${fmtKg(x.weight)} × ${x.reps}`;
    const fix = (x: Stall) =>
      x.swap
        ? s.swapTo(exName(x.swap, locale))
        : s.deloadTo(fmtSet(x.target.weight, x.target.reps));
    if (size === 'M')
      return (
        <Widget
          size="M"
          tone="injury"
          icon="warning-circle"
          title={s.stalledN(stalled.length)}
          sub={`${exName(first.name, locale)} · ${s.sessionsAt(first.n, set(first))}`}
          onClick={open}
        />
      );
    if (size === 'S')
      return (
        <Widget
          size="S"
          tone="injury"
          kicker={s.stalledK}
          value={stalled.length}
          unit={s.lifts}
          title={
            <span className="uiw-t-base">
              {`${exName(first.name, locale)} · ${s.sessionsAt(first.n, set(first))}`}
            </span>
          }
          sub={
            <span className="ut-w6 tw-accent-deep">
              {first.swap ? s.swapShort : s.deloadShort} ›
            </span>
          }
          onClick={open}
        />
      );
    if (size === 'L')
      return (
        <Widget size="L" tone="injury" kicker={s.stalled} onClick={open}>
          <div className="umt-auto">
            <WidgetList
              rows={stalled.slice(0, 2).map((x) => ({
                label: <TwoLine title={exName(x.name, locale)} sub={s.sessionsDot(x.n, set(x))} />,
                value: <Chip size="sm">{x.swap ? s.swapShort : s.deloadShort}</Chip>,
              }))}
            />
          </div>
        </Widget>
      );
    return (
      <Widget
        size="XL"
        tone="injury"
        kicker={s.stalled}
        badge={s.noGain}
        onClick={open}
        footer={
          <NoteAction
            note={
              watching.length
                ? s.watching(exName(watching[0].name, locale), watching[0].n)
                : s.stalledHint
            }
            action={
              <Button variant="primary" size="sm" onClick={open}>
                {s.openTrends}
              </Button>
            }
          />
        }
      >
        {stalled.slice(0, 2).map((x) => (
          <WidgetStats
            key={x.name}
            items={[
              {
                label: s.stuckAt(x.n, set(x)),
                value: (
                  <span className="ul-flex ul-col ug-4">
                    <span className="ul-flex uj-between ug-8 ua-center">
                      <span>{exName(x.name, locale)}</span>
                      <span className="uf-none" style={{ width: 80 }}>
                        {x.spark.length > 1 && (
                          <WidgetSpark points={x.spark} width={80} height={24} tone="injury" />
                        )}
                      </span>
                    </span>
                    <Muted>{fix(x)}</Muted>
                  </span>
                ),
              },
            ]}
          />
        ))}
      </Widget>
    );
  },
};

/* =====================================================================
 * 13. Smart swap (swaps.ts — same muscle profile, gym kit)
 * ===================================================================== */

function SmartSwapWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { store, t, locale, shell } = ctx;
  const s = ss(locale);
  const live = store.workouts.find((w) => w.finishedAt === null) ?? null;
  const liveEx = live
    ? [...live.exercises]
        .filter((e) => isStrengthExercise(e))
        .sort((a, b) => b.position - a.position)[0]
    : undefined;
  const plan = liveEx ? null : nextPlan(ctx);
  const src = liveEx?.name ?? plan?.lifts[0]?.name ?? null;
  const gym =
    (live?.gymId ? store.gyms.find((g) => g.id === live.gymId) : null) ?? pickSessionGym();
  const gymId = gym?.id ?? null;
  const cands = useMemo(
    () => (src ? swapCandidates(src, gym, 3) : []),
    // `gym` is resolved from `gymId`; the list only changes with the lift or the gym.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, gymId],
  );
  if (!src || cands.length === 0)
    return (
      <WidgetEmpty
        size={size}
        tone="apex"
        icon="swap"
        kicker={s.smartSwap}
        title={s.swapEmpty}
        sub={s.swapEmptySub}
        onAction={() => shell.openStart()}
      />
    );
  const best = cands[0];
  const pct = (m: number) => Math.round(m * 100);
  const srcName = exName(src, locale);
  const where = gym
    ? best.available
      ? s.atGym(gym.name)
      : s.needs(best.missing.join(', '))
    : s.anyGym;
  const info = muscleInfoByName(src);
  const muscles = [info?.primary, ...(info?.secondary ?? [])]
    .filter((m): m is NonNullable<typeof m> => !!m && m !== 'cardio')
    .slice(0, 3)
    .map((m) => t.muscleGroups[m] ?? m);
  const hint = (name: string) => {
    const p = prevLift(name);
    return p && p.weight ? `${fmtKg(p.weight)} × ${p.reps}` : null;
  };
  const doSwap = (name: string) => {
    const c = cands.find((x) => x.name === name);
    if (live && liveEx && c) {
      replaceExercise(live.id, liveEx.id, c.name, 'strength', {
        primaryMuscle: c.primary,
        secondaryMuscles: c.secondary,
        equipment: c.equipment,
      });
      shell.openOverlay({ screen: 'session', workoutId: live.id });
    } else shell.openOverlay({ screen: 'exercise-detail', name });
  };
  const view = () => shell.openOverlay({ screen: 'exercise-detail', name: best.name });
  const actLabel = live ? s.swap : s.view;
  const kick = s.swapKicker(gym?.name ?? s.anyGym);
  const chips = (
    <div className="ul-flex ug-6 ul-wrap">
      {muscles.map((m) => (
        <Chip key={m} size="sm">
          {m}
        </Chip>
      ))}
    </div>
  );
  if (size === 'M')
    return (
      <Widget
        size="M"
        tone="apex"
        icon="swap"
        title={s.busy(srcName, exName(best.name, locale))}
        sub={`${s.sameMuscles(pct(best.match))} · ${where}`}
        onClick={view}
        trailing={
          <Button variant="secondary" size="sm" onClick={() => doSwap(best.name)}>
            {actLabel}
          </Button>
        }
      />
    );
  if (size === 'S')
    return (
      <Widget
        size="S"
        tone="apex"
        kicker={s.swapOf(srcName)}
        title={<span className="uiw-t-md">{exName(best.name, locale)}</span>}
        sub={where}
        onClick={view}
      >
        <div className="ul-flex ua-center ug-10">
          <WidgetRing value={best.match} size={44} tone="apex" />
          <div className="ul-flex ul-col">
            <span className="uiw-t-lg">{pct(best.match)}%</span>
            <Muted>{s.match}</Muted>
          </div>
        </div>
      </Widget>
    );
  if (size === 'L')
    return (
      <Widget
        size="L"
        tone="apex"
        kicker={kick}
        badge={s.pctMatch(pct(best.match))}
        onClick={view}
        footer={
          <Button variant="primary" size="sm" onClick={() => doSwap(best.name)}>
            {hint(best.name) ? `${actLabel} · ${hint(best.name)}` : actLabel}
          </Button>
        }
      >
        <div className="ul-flex ua-center ug-10 umw-0">
          <span
            className="ut-muted ut-w6"
            style={{
              textDecoration: 'line-through',
            }}
          >
            {srcName}
          </span>
          <Muted>→</Muted>
          <span className="uiw-t-lg">{exName(best.name, locale)}</span>
        </div>
        {chips}
      </Widget>
    );
  return (
    <Widget
      size="XL"
      tone="apex"
      kicker={kick}
      badge={live ? s.now('') : (plan?.dayName ?? '')}
      onClick={view}
      footer={
        <Button variant="primary" size="sm" fullWidth onClick={() => doSwap(best.name)}>
          {`${actLabel} · ${exName(best.name, locale)}`}
        </Button>
      }
    >
      <WidgetStats items={[{ label: s.replacing, value: srcName }]} />
      {chips}
      <WidgetList
        rows={cands.map((c) => ({
          label: (
            <TwoLine
              title={exName(c.name, locale)}
              sub={[
                gym ? (c.available ? s.available : s.needs(c.missing.join(', '))) : null,
                hint(c.name),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ),
          value: <Tag text={`${pct(c.match)}%`} good={c === best ? true : null} />,
        }))}
      />
    </Widget>
  );
}

const smartSwap: WidgetDef = {
  id: 'smart-swap',
  group: 'strength',
  icon: 'swap',
  tone: 'apex',
  name: () => ss(getLocale()).smartSwap,
  render: (size, ctx) => <SmartSwapWidget size={size} ctx={ctx} />,
};

export const STRENGTH_WIDGETS: WidgetDef[] = [
  topLifts,
  nextTargetW,
  prForecast,
  recentPrs,
  oneRmCalc,
  plateCalc,
  balance,
  standards,
  plTotal,
  relative,
  repPrs,
  stalledLifts,
  smartSwap,
];
