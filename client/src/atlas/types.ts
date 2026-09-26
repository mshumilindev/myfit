/**
 * Atlas — the built-in coach. One coach, three tempers; the temper only changes
 * how he talks, never what he knows. Everything he says starts as a CoachFact
 * derived from history (facts.ts), goes through the guard (guard.ts) and is
 * voiced from a phrase table (voice.ts).
 */
import type { MuscleGroup } from '../data/exercises';
import type { CoachPlan } from './plan';

/**
 * Three tempers — green, yellow, red. The values 1 · 3 · 5 are kept from the
 * old five-step scale (so harshness still compares: 5 is the hardest), and
 * old picks migrate: Steady (2) → green, Drill (4) → red (see normalizeTemper).
 *   1 Warm (green)  — your gym bro (also what a bad day falls back to);
 *   3 Blunt (yellow) — no fluff;
 *   5 Merciless (red) — merciless: mocks your effort, never your body.
 */
export type Temper = 1 | 3 | 5;
export const TEMPERS: Temper[] = [1, 3, 5];
export const TEMPER_ID: Record<Temper, 'warm' | 'blunt' | 'merciless'> = {
  1: 'warm',
  3: 'blunt',
  5: 'merciless',
};
/** Green · yellow · red. */
export const TEMPER_COLOR: Record<Temper, string> = {
  1: '#4cbe8c',
  3: '#e3b23c',
  5: '#e0344f',
};
/** Position on the scale (0..2) — for labels stored as three-item lists. */
export const temperIndex = (t: Temper): number => Math.max(0, TEMPERS.indexOf(t));
/** Any stored value (old 1–5 scale included) → one of the three. */
export function normalizeTemper(v: unknown): Temper {
  const n = Number(v);
  if (n <= 2) return 1;
  if (n >= 4) return 5;
  return 3;
}

/** Main coach writes the programme; an extra coach only watches and comments. */
export type CoachRole = 'main' | 'extra';

export interface CoachSettings {
  enabled: boolean;
  temper: Temper;
  role: CoachRole;
  startedAt: number;
  /** "Your mom…" lines (red only). */
  yoMama: boolean;
  /** Swearing (red only). */
  swearing: boolean;
  /** Muted for today from a debrief ("Mute for today"): until this ms. */
  mutedUntil?: number | null;
  /** Agreed to send a training summary to Gemini for chat (one-time consent). */
  chatConsent?: boolean;
  /** Notes newer than this are unread (the ring in the stories strip). */
  readAt: number;
  /** The programme (main-coach role); null until Atlas writes one. */
  plan?: CoachPlan | null;
  /** "Clear chat": notes before this are hidden. */
  clearedAt?: number;
  /** What you told Atlas in chat (injuries, goal, lifts to avoid…). */
  memory?: import('./memory').AtlasMemory;
  /** Counters only — how Atlas is doing (see metrics.ts). */
  stats?: import('./metrics').AtlasStats;
  /** Last local edit (last-write-wins against the synced copy). */
  updatedAt?: number;
}

/** "Your mom" and swearing — red only. */
export const momAllowed = (t: Temper) => t === 5;
export const swearAllowed = (t: Temper) => t === 5;
/** Picking a temper resets the extras to its defaults (all on for red). */
export const extrasFor = (t: Temper) => ({ yoMama: momAllowed(t), swearing: swearAllowed(t) });

export const COACH_DEFAULT: CoachSettings = {
  enabled: false,
  temper: 3,
  role: 'main',
  startedAt: 0,
  yoMama: true,
  swearing: false,
  mutedUntil: null,
  readAt: 0,
};

interface FactBase {
  /** Stable id — the same event always yields the same id (dedupe, read marks). */
  id: string;
  /** When the event happened (ms). */
  at: number;
}

export type CoachFact = FactBase &
  (
    | { kind: 'intro'; sessions: number }
    | { kind: 'session'; workoutId: string; sets: number; volumeKg: number; minutes: number }
    | { kind: 'pr'; exercise: string; weight: number; reps: number; prevWeight: number }
    | { kind: 'stall'; exercise: string; weight: number; sessions: number }
    | { kind: 'restShort'; exercise: string; restSec: number; targetSec: number }
    | { kind: 'setDrop'; exercise: string; reps: number; prevReps: number }
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
