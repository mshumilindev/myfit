/**
 * Set type (design DS-1 + SD-1): working · warm-up · dropset · reverse dropset ·
 * static-dynamic (a TUT-driven timed hold, logged as weight + hold seconds).
 * A drop/reverse-drop is still ONE set; its parts live in `drops`.
 */
export type SetType = 'working' | 'warmup' | 'drop' | 'reverse-drop' | 'static-dynamic';

/** One drop inside a drop/reverse-drop set (after the start weight). */
export interface DropEntry {
  reps: number;
  weight: number | null;
}

export interface SetEntry {
  id: string;
  reps: number;
  weight: number | null;
  isWarmup: boolean;
  /** Absent = derived from isWarmup ('warmup') or 'working'. */
  type?: SetType;
  /** Drop parts for drop/reverse-drop sets, in performed order. */
  drops?: DropEntry[];
  durationMin?: number | null;
  distanceKm?: number | null;
  calories?: number | null;
  rpe?: number | null;
  position: number;
  /**
   * When this set was logged (ms epoch). Written on log/duplicate; drives the
   * live rest count-ups. Absent on older data.
   */
  loggedAt?: number | null;
  /**
   * Actual rest before this set, in seconds, captured at log time so it
   * survives as part of the saved set history (independent of loggedAt).
   */
  restSec?: number | null;
}

export type ExerciseKind = 'strength' | 'cardio' | 'warmup' | 'cooldown';

export interface Exercise {
  id: string;
  name: string;
  kind?: ExerciseKind;
  position: number;
  plannedSets?: number | null;
  plannedReps?: number | null;
  plannedDurationMin?: number | null;
  equipment?: string[];
  /** Superset group (design SS-1): null/absent = ungrouped. */
  groupId?: string | null;
  /** Order inside the superset group (0 = A1). */
  groupOrder?: number | null;
  /** Muscle groups (design MG-1): one primary, any number of secondaries. */
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  autoFinished: boolean;
  /** Saved gym this session belongs to (null = not attached). */
  gymId?: string | null;
  /** Program day name this session came from (e.g. "Push day"); null if none. */
  dayName?: string | null;
  /** Muscle-only program-day targets that should guide exercise suggestions. */
  targetMuscles?: string[];
  exercises: Exercise[];
}

/** One weigh-in (no notes). */
export interface WeightEntry {
  id: string;
  /** ms epoch of the weigh-in (date + time). */
  at: number;
  /** kg */
  weight: number;
}

/** Body metrics for one user — height, optional composition, weigh-in log. */
export interface BodyMetrics {
  /** Biological sex — drives strength-standard classification. */
  sex?: 'male' | 'female';
  /** Date of birth (ISO YYYY-MM-DD). */
  dob?: string | null;
  heightCm?: number | null;
  goalWeightKg?: number | null;
  bodyFatPct?: number | null;
  muscleKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  hipCm?: number | null;
  weights: WeightEntry[];
  /** Local date key (YYYY-MM-DD) the Today weigh-in reminder was dismissed. */
  weighInDismissedDay?: string | null;
  /** Count days with nothing logged as rest days (keeps the streak alive). */
  restCountsSkipped?: boolean;
  updatedAt?: number;
}

export interface Gym {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** User-marked favourite (fallback suggestion when GPS is unavailable). */
  favorite?: boolean;
  /** Equipment inventory (design EQ-3): what you ticked on this gym.
   *  Absent/empty = never audited → never warn. */
  inventory?: string[];
}

/** Default geofence for a newly saved gym (AC-GYM-05). */
export const DEFAULT_GYM_RADIUS_M = 50;

/** "Був у залі 1год+, але тренування не залоговане" */
export interface Reminder {
  gymId: string;
  gymName: string;
  visitStart: number;
  visitEnd: number;
}

/** A queued offline mutation = one HTTP request to replay later. */
/** How light a rest/recovery period is. 'active' = deloaded training still in
 *  the gym; 'off' = fully away from the gym (e.g. a vacation). */
export type RestMode = 'active' | 'off';

/** A planned rest / recovery / vacation window. Its days count as rest days in
 *  statistics (not missed) and keep the consistency streak alive. */
export interface RestPeriod {
  id: string;
  /** Inclusive day keys: Math.floor(ts / 86400000). */
  startDay: number;
  endDay: number;
  mode: RestMode;
  createdAt: number;
  note?: string | null;
  updatedAt?: number;
}

export interface QueuedMutation {
  id: string;
  method: 'PUT' | 'POST' | 'DELETE';
  url: string;
  body?: unknown;
  queuedAt: number;
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing' | 'failed';

export interface Notice {
  id: string;
  kind: string;
  actor: string | null;
  detail: string | null;
  createdAt: number;
  read: boolean;
}

export interface SyncError {
  status: number;
  statusLine: string;
}

export const AUTO_FINISH_MS = 8 * 60 * 60 * 1000;
