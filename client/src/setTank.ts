/**
 * Set bars = the "tank" of the target muscle (SPO-151).
 *
 * Every set row in a live session shows how much readiness the muscle still has
 * for THIS lift after the set: 1 = fresh, 0 = nothing left. The tank only falls
 * with work, recovers with rest (a fast part with a half-life, a slow part that
 * does not come back during the session) and can never climb above the level it
 * had before the previous set ("no second wind").
 *
 * Pure: plain data in, plain data out. No store, no React, no clock, no random —
 * the adapter (views/useSetBars.ts) feeds readiness, e1RM history and the sets.
 *
 * Sources and the honest status of every number: docs/research/set-bars-fatigue.md
 * («Д»). Model, worked examples and the change rule: docs/specs/set-bars-tank.md.
 * DO NOT change TANK_PARAMS or the formulas without updating Д, the spec (§2.1,
 * §3) and the regression tests together (spec §6 «Правило змін»).
 */
import type { DropEntry, FailureMark, SetType } from './types';

/** Frozen parameters (spec §2.1). `tests: setTank.params.test.ts` pins them. */
export const TANK_PARAMS = Object.freeze({
  /** Half-life of the recoverable (fast) part of a loss, seconds (Д№1, upper end). */
  halfLifeSec: 60,
  /** φ — share of a loss that rest can win back (assumption, no source). */
  fastShare: 0.75,
  /** C_FAIL — share of the tank one set to failure costs (assumption). */
  failCost: 0.44,
  /** p — convexity of cost in u = reps / (reps + RIR) (assumption, direction Д№14–15). */
  costPower: 1.5,
  /** λ — weight of the readiness deficit in the day's starting tank (anchor Д№16). */
  readinessWeight: 0.25,
  /** Reps in reserve of a working set with no information at all. */
  rirDefault: 2,
  /** Reps in reserve of every non-final segment of a drop set (assumption). */
  rirSegment: 1,
  /** u of a warm-up when the lift has no e1RM reference yet (assumption). */
  warmUnknownU: 0.15,
  /** Rest when a set has neither timestamps nor a stored `restSec`, seconds. */
  restFallbackSec: 90,
  /** A secondary muscle counts half a set (store.SECONDARY_SET_WEIGHT). */
  secondaryWeight: 0.5,
  /** Epley divisor, as in the rest of the app. */
  epleyDiv: 30,
  /** Work-time model of a set, as store.setWorkSeconds. */
  secPerRep: 3,
  minWorkSec: 30,
  /** Reps above this are not used to estimate a 1RM (store.E1RM_MAX_REPS). */
  e1rmMaxReps: 10,
  /** RIR is never read as more than this from an RPE (RPE 5 and below). */
  rirMax: 5,
  /** A gap this long (or a cool-down in it) is a full rest, as restBeforeSet. */
  fullRestSec: 3 * 3600,
  /** Colour: tank loss that paints the bar fully red. */
  colourTankRed: 0.8,
  /** Display: exponent of the concave stretch of the deficit (spec §2.3). */
  displayGamma: 0.5,
  /** Display: the bar never gets shorter than this (0..1 of full height). */
  displayFloor: 0.1,
});

export interface TankSetInput {
  id: string;
  reps: number;
  weight: number | null;
  type?: SetType | null;
  isWarmup?: boolean;
  drops?: DropEntry[] | null;
  durationMin?: number | null;
  rpe?: number | null;
  rpeAuto?: number | null;
  failure?: FailureMark | null;
  partials?: number | null;
  loggedAt?: number | null;
  restSec?: number | null;
  position: number;
}

export interface TankExercise {
  id: string;
  /** Target muscle; null = unknown (the lift gets a private fresh tank). */
  primary: string | null;
  secondary: readonly string[];
  /** The load is plain kg (not bodyweight / band / assist): Epley may be used. */
  weighted: boolean;
  /** Best e1RM of the lift's own sets before this session (0 = none). */
  e1rmRef: number;
  sets: readonly TankSetInput[];
  /** Existing real rep loss per working set (stimulus.performanceDrops). */
  perfDrop?: ReadonlyMap<string, number>;
  /** How much rep loss paints a bar fully red (default 0.1). */
  dropTolerance?: number;
}

export interface TankInput {
  /** Strength exercises in card order. */
  exercises: readonly TankExercise[];
  /** Base readiness per muscle at the workout start, 0..1; absent = 1. */
  readiness: ReadonlyMap<string, number>;
  /** Cool-down start stamps (ms): a rest running across one is a full rest. */
  breaks?: readonly number[];
}

export interface SetTank {
  /** Display height 0..1 (concave stretch of the tank, with a floor). */
  barHeight: number;
  /** Tank of the target muscle at the END of the set, 0..1. */
  tank: number;
  /** Tank at the START of the set (after rest and the ratchet), 0..1. */
  before: number;
  /** Colour intensity 0..1: worse of tank loss and measured rep loss. */
  fat: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const P = TANK_PARAMS;
const DEFAULT_DROP_TOLERANCE = 0.1;

/** A rep count that is a finite number >= 0 (NaN/Infinity must not poison the muscle state). */
const fin = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0);

const typeOf = (s: Pick<TankSetInput, 'type' | 'isWarmup'>): SetType =>
  s.type ?? (s.isWarmup ? 'warmup' : 'working');
const isDropType = (t: SetType): boolean => t === 'drop' || t === 'reverse-drop';
const isTimed = (s: TankSetInput): boolean =>
  typeOf(s) === 'static-dynamic' || (s.durationMin ?? 0) > 0;

interface Segment {
  weight: number | null;
  reps: number;
}

/** The pieces of work of a set, in performed order (a drop set has several). */
function segmentsOf(s: TankSetInput): Segment[] {
  if (isTimed(s)) {
    const secs = (s.durationMin ?? 0) * 60;
    return [{ weight: s.weight, reps: secs > 0 ? secs / P.secPerRep : fin(s.reps) }];
  }
  const segs: Segment[] = [{ weight: s.weight, reps: fin(s.reps) }];
  if (isDropType(typeOf(s))) for (const d of s.drops ?? []) segs.push({ ...d, reps: fin(d.reps) });
  return segs;
}

/** Seconds spent performing the set (all drop parts count). */
function workSeconds(s: TankSetInput, segs: Segment[]): number {
  if (isTimed(s) && (s.durationMin ?? 0) > 0) return (s.durationMin ?? 0) * 60;
  const reps = segs.reduce((n, g) => n + g.reps, 0);
  return Math.max(P.minWorkSec, reps * P.secPerRep);
}

/** Reps in reserve the athlete or the app stated for the set, or null. */
function statedRir(s: TankSetInput): number | null {
  if (s.failure === 'manual' || s.failure === 'auto' || (s.partials ?? 0) > 0) return 0;
  const r = s.rpe ?? s.rpeAuto ?? null;
  if (r === null || !Number.isFinite(r)) return null;
  return clamp(10 - r, 0, P.rirMax);
}

/** RIR of one segment from stated data only (null = nothing known). */
function segmentRir(s: TankSetInput, last: boolean, drop: boolean): number | null {
  if (drop) return last ? (statedRir(s) ?? 0) : P.rirSegment;
  return statedRir(s);
}

/** e1RM of one set with the reps in reserve it was taken with (0 = unusable). */
export function setE1rm(s: TankSetInput, weighted = true): number {
  if (!weighted || typeOf(s) === 'warmup' || isTimed(s)) return 0;
  const segs = segmentsOf(s);
  const drop = isDropType(typeOf(s));
  let best = 0;
  segs.forEach((g, i) => {
    const w = g.weight ?? 0;
    if (w <= 0 || g.reps < 1 || g.reps > P.e1rmMaxReps) return;
    const rir = segmentRir(s, i === segs.length - 1, drop) ?? P.rirDefault;
    best = Math.max(best, w * (1 + (g.reps + rir) / P.epleyDiv));
  });
  return best;
}

/**
 * Reference e1RM of a lift from earlier sessions: the best set within `days`
 * before `at`, else the best ever (as store.liftReference, but reps in reserve
 * count). `sessions` must only hold sessions that ended before `at`.
 */
export function referenceE1rm(
  sessions: readonly { startedAt: number; sets: readonly TankSetInput[] }[],
  at: number,
  weighted = true,
  days = 56,
): number {
  let recent = 0;
  let ever = 0;
  for (const w of sessions) {
    const best = w.sets.reduce((m, s) => Math.max(m, setE1rm(s, weighted)), 0);
    ever = Math.max(ever, best);
    if (at - w.startedAt <= days * 86400000) recent = Math.max(recent, best);
  }
  return recent > 0 ? recent : ever;
}

/** Share of the effort used: reps / (reps + RIR). */
const usedShare = (reps: number, rir: number): number => (reps <= 0 ? 0 : reps / (reps + rir));

/** u of every segment of a set. */
function segmentShares(
  s: TankSetInput,
  segs: Segment[],
  weighted: boolean,
  eRef: number,
): number[] {
  const type = typeOf(s);
  const drop = isDropType(type);
  const timed = isTimed(s);
  return segs.map((g, i) => {
    const stated = segmentRir(s, i === segs.length - 1, drop);
    if (stated !== null) return usedShare(g.reps, stated);
    const w = g.weight ?? 0;
    if (weighted && !timed && eRef > 0 && w > 0) {
      return usedShare(g.reps, Math.max(0, P.epleyDiv * (eRef / w - 1) - g.reps));
    }
    if (type === 'warmup') return P.warmUnknownU;
    return usedShare(g.reps, P.rirDefault);
  });
}

interface MuscleState {
  /** Recoverable loss. */
  df: number;
  /** Loss that stays for the session. */
  ds: number;
  /** Tank at the END of this muscle's previous event (the ratchet). */
  prev: number;
  /** When this muscle's previous event was logged (ms), or null. */
  lastAt: number | null;
  started: boolean;
}

/** Display height of a tank value: concave stretch of the deficit, floored. */
export function displayHeight(tank: number): number {
  const d = clamp(1 - tank, 0, 1);
  return Math.max(P.displayFloor, 1 - d ** P.displayGamma);
}

/** Colour intensity 0..1 from the tank and the measured rep loss. */
export function tankColour(tank: number, perfDrop = 0, tolerance = DEFAULT_DROP_TOLERANCE): number {
  const byTank = clamp((1 - tank) / P.colourTankRed, 0, 1);
  const byDrop = tolerance > 0 ? clamp(perfDrop / tolerance, 0, 1) : 0;
  return Math.max(byTank, byDrop);
}

/**
 * Tank of every set of a live workout, keyed by set id. Events are ordered by
 * the real log time (supersets interleave correctly); a workout with any
 * missing stamp falls back to card/set order and `restSec ?? 90 s` rests.
 */
export function setTanks(input: TankInput): Map<string, SetTank> {
  type Ev = { ex: TankExercise; xi: number; s: TankSetInput };
  const events: Ev[] = [];
  input.exercises.forEach((ex, xi) => ex.sets.forEach((s) => events.push({ ex, xi, s })));
  const stamped = events.every((e) => (e.s.loggedAt ?? 0) > 0);
  events.sort((a, b) =>
    stamped
      ? (a.s.loggedAt as number) - (b.s.loggedAt as number) ||
        a.xi - b.xi ||
        a.s.position - b.s.position
      : a.xi - b.xi || a.s.position - b.s.position,
  );

  const muscles = new Map<string, MuscleState>();
  const refs = new Map<string, number>();
  const out = new Map<string, SetTank>();
  const stateOf = (key: string): MuscleState => {
    let m = muscles.get(key);
    if (!m) {
      const r = clamp(input.readiness.get(key) ?? 1, 0, 1);
      const t0 = 1 - P.readinessWeight * (1 - r);
      m = { df: 0, ds: 1 - t0, prev: Infinity, lastAt: null, started: false };
      muscles.set(key, m);
    }
    return m;
  };

  for (const { ex, s } of events) {
    const segs = segmentsOf(s);
    const eRef = Math.max(refs.get(ex.id) ?? 0, ex.e1rmRef);
    const shares = segmentShares(s, segs, ex.weighted, eRef);
    const work = workSeconds(s, segs);
    const own = ex.primary ?? `ex:${ex.id}`;
    const targets: [string, number][] = [[own, 1]];
    for (const m of ex.secondary) if (m !== own) targets.push([m, P.secondaryWeight]);

    for (const [key, weight] of targets) {
      const m = stateOf(key);
      if (m.started) {
        let rest: number;
        if (m.lastAt !== null && s.loggedAt) {
          const gap = (s.loggedAt - m.lastAt) / 1000;
          const cut = (input.breaks ?? []).some(
            (b) => b > (m.lastAt as number) && b < (s.loggedAt as number),
          );
          rest = gap >= P.fullRestSec || cut ? Infinity : Math.max(0, gap - work);
        } else rest = s.restSec ?? P.restFallbackSec;
        m.df *= 2 ** (-rest / P.halfLifeSec);
        // A real break (or a full rest) lifts the ratchet; otherwise there is no second wind.
        if (rest === Infinity) m.prev = Infinity;
      }
      const free = 1 - m.df - m.ds;
      const start = Math.min(m.prev, free);
      if (start < free) m.df = 1 - start - m.ds; // surplus recovery is discarded
      let t = start;
      for (const u of shares) {
        const loss = P.failCost * u ** P.costPower * weight * t;
        m.df += P.fastShare * loss;
        m.ds += (1 - P.fastShare) * loss;
        t -= loss;
      }
      m.started = true;
      m.lastAt = s.loggedAt && s.loggedAt > 0 ? s.loggedAt : null;
      m.prev = Math.max(0, t); // ratchet on the END level: the bar never rises between sets
      if (key === own) {
        const tank = clamp(t, 0, 1);
        out.set(s.id, {
          barHeight: displayHeight(tank),
          tank,
          before: clamp(start, 0, 1),
          fat: tankColour(tank, ex.perfDrop?.get(s.id) ?? 0, ex.dropTolerance),
        });
      }
    }
    if (typeOf(s) !== 'warmup')
      refs.set(ex.id, Math.max(refs.get(ex.id) ?? 0, setE1rm(s, ex.weighted)));
  }
  return out;
}
