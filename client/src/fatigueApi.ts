/**
 * The core side of the Fatigue & readiness add-on (SPO-558). The numbers that steer the app (the session builder, the exercise
 * picker, the rest timer, the RPE estimate, the set bars) read the history through these two functions: while the add-on is
 * installed they get the real history, so every value is exactly what it was before; without it they get none, and the same
 * functions return their value for an empty history (everything ready, nothing tired). Stored workouts are never touched.
 */
import type { ComponentType } from 'react';
import type { MuscleGroup } from './data/exercises';
import type { Nudge } from './components/NudgeStack';
import type { WidgetSize } from './components/ui/Widget';
import type { useT } from './i18n';
import type { Workout } from './types';
import { fatigueAvailable, readinessAvailable } from './addons/featureGates';

const NONE: Workout[] = [];

/** The history the fatigue numbers may read: all of it with Fatigue installed, none without. */
export function fatigueSource(finished: Workout[]): Workout[] {
  return fatigueAvailable() ? finished : NONE;
}

/** The history the readiness numbers may read: all of it with Readiness installed, none without. */
export function readinessSource(finished: Workout[]): Workout[] {
  return readinessAvailable() ? finished : NONE;
}

/** What the live session passes to the muscle state panel (the drawer of a tapped muscle chip). */
export interface MuscleStatePanelProps {
  muscle: MuscleGroup;
  /** The live session (its sets count toward today's read). */
  workout: Workout;
  /** Fractional hard sets the muscle has had in this session. */
  todaySets: number;
  /** Personal per-session plateau for the muscle. */
  plateau: number;
  /** Fatigue carried in from earlier sessions (fractional sets). */
  carry?: number;
}

/**
 * The screens of the add-on: they live in the lazy chunk `fatigue/` and arrive here through `fatigueHost` when it loads
 * (`fatigue/fatigueBoot.ts`). Until then (or while the module is off) the core draws nothing for them.
 */
/** What the Progress volume lens passes to the readiness read (`view` mirrors the panel's List / Map switch). */
export interface ReadinessLensProps {
  finished: Workout[];
  now: number;
  view?: 'full' | 'map' | 'list';
}

export interface FatigueWidgetProps {
  size: WidgetSize;
  /** A Today `WidgetCtx`; typed loosely here so the core seam does not import the Today registry (a cycle). The widget bodies narrow it. */
  ctx: unknown;
}

export interface FatigueHost {
  /** The body of the Fatigue & deload widget on Today. */
  FatigueWidget: ComponentType<FatigueWidgetProps> | null;
  /** The body of the Readiness widget on Today. */
  ReadinessWidget: ComponentType<FatigueWidgetProps> | null;
  /** The readiness read of the Progress volume lens. */
  ReadinessLens: ComponentType<ReadinessLensProps> | null;
  /** The readiness card for the Today stack (null on a cold start). */
  buildReadinessNudge:
    ((finished: Workout[], now: number, t: ReturnType<typeof useT>['t']) => Nudge | null) | null;
  /** A muscle's state inside the muscle drawer of a live session. */
  MuscleStatePanel: ComponentType<MuscleStatePanelProps> | null;
}

export const fatigueHost: FatigueHost = {
  FatigueWidget: null,
  ReadinessWidget: null,
  ReadinessLens: null,
  buildReadinessNudge: null,
  MuscleStatePanel: null,
};
