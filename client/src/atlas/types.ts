/**
 * Atlas — the built-in coach. One coach, five tempers; the temper only changes
 * how he talks, never what he knows. Everything he says starts as a CoachFact
 * derived from history (facts.ts), goes through the guard (guard.ts) and is
 * voiced from a phrase table (voice.ts).
 */
import type { MuscleGroup } from '../data/exercises';

/** 1 Warm · 2 Steady · 3 Blunt · 4 Drill · 5 Merciless. */
export type Temper = 1 | 2 | 3 | 4 | 5;
export const TEMPERS: Temper[] = [1, 2, 3, 4, 5];
export const TEMPER_ID: Record<Temper, 'warm' | 'steady' | 'blunt' | 'drill' | 'merciless'> = {
  1: 'warm',
  2: 'steady',
  3: 'blunt',
  4: 'drill',
  5: 'merciless',
};
/** Colour heats up with harshness (matches the design canvas). */
export const TEMPER_COLOR: Record<Temper, string> = {
  1: '#4cbe8c',
  2: '#6aa7e8',
  3: '#d9a24f',
  4: '#f0714f',
  5: '#e0344f',
};

/** Main coach writes the programme; an extra coach only watches and comments. */
export type CoachRole = 'main' | 'extra';

export interface CoachSettings {
  enabled: boolean;
  temper: Temper;
  role: CoachRole;
  startedAt: number;
  /** "Your mom…" lines (Drill/Merciless only). */
  yoMama: boolean;
  /** Mild swearing (Merciless only). Off by default. */
  swearing: boolean;
  /** Muted for today from a debrief ("Mute for today"): until this ms. */
  mutedUntil?: number | null;
}

export const COACH_DEFAULT: CoachSettings = {
  enabled: false,
  temper: 3,
  role: 'main',
  startedAt: 0,
  yoMama: true,
  swearing: false,
  mutedUntil: null,
};

interface FactBase {
  /** Stable id — the same event always yields the same id (dedupe, read marks). */
  id: string;
  /** When the event happened (ms). */
  at: number;
}

export type CoachFact = FactBase &
  (
    | { kind: 'session'; workoutId: string; sets: number; volumeKg: number; minutes: number }
    | { kind: 'pr'; exercise: string; weight: number; reps: number; prevWeight: number }
    | { kind: 'stall'; exercise: string; weight: number; sessions: number }
    | { kind: 'restShort'; exercise: string; restSec: number; targetSec: number }
    | { kind: 'skipped'; dayName: string | null }
    | {
        kind: 'imbalance';
        low: MuscleGroup;
        high: MuscleGroup;
        lowSets: number;
        highSets: number;
      }
    | { kind: 'week'; sessions: number; planned: number }
    | { kind: 'comeback'; daysOff: number }
    | { kind: 'shortSleep'; hours: number }
    | { kind: 'streak'; days: number }
    | { kind: 'bodyweight'; kg: number; deltaPct: number; days: number }
  );

export type FactKind = CoachFact['kind'];
export type FactOf<K extends FactKind> = Extract<CoachFact, { kind: K }>;

export interface CoachMessage {
  id: string;
  at: number;
  from: 'atlas' | 'me';
  text: string;
  /** The fact this message voices (absent for chat). */
  factId?: string;
  kind?: FactKind | 'chat';
  /** Temper it was said in (after the guard). */
  temper?: Temper;
}
