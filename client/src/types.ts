export interface SetEntry {
  id: string;
  reps: number;
  weight: number | null;
  isWarmup: boolean;
  durationMin?: number | null;
  distanceKm?: number | null;
  calories?: number | null;
  rpe?: number | null;
  position: number;
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
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  autoFinished: boolean;
  /** Saved gym this session belongs to (null = not attached). */
  gymId?: string | null;
  exercises: Exercise[];
}

export interface Gym {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** User-marked favourite (fallback suggestion when GPS is unavailable). */
  favorite?: boolean;
}

/** "Був у залі 1год+, але тренування не залоговане" */
export interface Reminder {
  gymId: string;
  gymName: string;
  visitStart: number;
  visitEnd: number;
}

/** A queued offline mutation = one HTTP request to replay later. */
export interface QueuedMutation {
  id: string;
  method: 'PUT' | 'POST' | 'DELETE';
  url: string;
  body?: unknown;
  queuedAt: number;
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing';

export const AUTO_FINISH_MS = 8 * 60 * 60 * 1000;
