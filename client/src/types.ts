/**
 * Set type (design DS-1 + SD-1): working · warm-up · dropset · reverse dropset ·
 * static-dynamic (a TUT-driven timed hold, logged as weight + hold seconds).
 * A drop/reverse-drop is still ONE set; its parts live in `drops`.
 */
import type { BandRung } from './loads';

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
  /** True once the athlete has set this set's warm-up/working state by hand
   *  (the type picker or the warm-up chip). Auto warm-up detection never
   *  overrides a manual choice. */
  warmupManual?: boolean;
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
  /** Fine equipment picked for this exercise instance (equipmentCatalog ids) —
   *  a combination is allowed (straps + bar + belt, a band, etc.). Absent =
   *  auto-suggest from the gym. Distinct from the coarse `equipment` above,
   *  which drives load-type. */
  equipmentItems?: string[];
  /** Superset group (design SS-1): null/absent = ungrouped. */
  groupId?: string | null;
  /** Order inside the superset group (0 = A1). */
  groupOrder?: number | null;
  /** Plain superset vs a round-based circuit (F3). */
  groupKind?: 'superset' | 'circuit' | null;
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

// ---------------------------------------------------------------------------
// Sleep (My Fit · Sleep) — a first-class recovery record.
// ---------------------------------------------------------------------------

/** How a night got into the log. */
export type SleepSource = 'live' | 'backfill' | 'auto' | 'schedule';
/** Optional morning self-rating. */
export type SleepQuality = 'restless' | 'ok' | 'good';

/** One logged night. A live (in-progress) night has `wake === null`. */
export interface SleepNight {
  id: string;
  /** Local date key (YYYY-MM-DD) of the morning you woke — the night's identity. */
  date: string;
  /** Epoch ms you went to bed. */
  bedtime: number;
  /** Epoch ms you woke; null while a live night is still in progress. */
  wake: number | null;
  quality?: SleepQuality | null;
  source: SleepSource;
  updatedAt?: number;
  /** Live nights only: total awake (paused) ms already banked from closed
   *  intervals — time spent using the app off the sleep screen, which does
   *  not count as sleep. Absent/0 for backfilled or finished nights. */
  awakeMs?: number;
  /** Live nights only: start of the currently-open awake interval (you left
   *  the sleep screen and are using the app). null/absent = counting as sleep. */
  awakeSince?: number | null;
  /** Live nights only: last activity seen while paused. Used to resolve the
   *  idle-→asleep transition and app-unload: after SLEEP_IDLE_MS of no
   *  activity (or the app being closed), the gap counts as sleep from here. */
  lastSeen?: number;
  /** Scheduled wake instant (epoch ms) for a live night the app is managing,
   *  so a server function can auto-finalize it at the usual time even if the
   *  app never reopens. Absent on manually-run nights with auto off. */
  autoWakeAt?: number;
}

/** Bed/wake for one slot, in minutes from local midnight (wake is the next
 *  morning, so e.g. bed 1400 / wake 400 = 23:20 → 06:40). */
export interface SleepDayPlan {
  bedMin: number;
  wakeMin: number;
}

/** The user's intended rhythm — one plan for every night, or per weekday. */
export interface SleepSchedule {
  /** Whether one plan applies to every night. */
  sameEveryNight: boolean;
  /** The single plan, when sameEveryNight. */
  every: SleepDayPlan | null;
  /** Per weekday (0 = Sunday … 6 = Saturday), when !sameEveryNight. */
  byDay: Partial<Record<number, SleepDayPlan>>;
}

/** Sleep behaviour toggles + goal. */
export interface SleepSettings {
  /** Dim the app at the scheduled bedtime. */
  autoDim: boolean;
  /** Fill each night automatically from the learned weekday pattern. */
  autoLog: boolean;
  /** Nightly goal in minutes (default 480 = 8h). */
  goalMin: number;
  /** Local date key the auto-dim prompt last fired (once per night). */
  lastDimDay?: string | null;
  /** Bedtime-day key the app last auto-started a night for (once per night,
   *  so discarding an auto-started night doesn't re-trigger the same evening). */
  lastAutoNight?: string | null;
  /** State of the "offer to auto-log" prompt. */
  patternOffer?: 'unseen' | 'declined' | 'accepted';
}

export interface Gym {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Stable venue id (e.g. "osm:...") linking this per-user gym to the shared
   *  gym entity (sharedGyms/<externalId>) whose equipment is crowdsourced. */
  externalId?: string;
  /** User-marked favourite (fallback suggestion when GPS is unavailable). */
  favorite?: boolean;
  /** Equipment inventory (design EQ-3): what you ticked on this gym.
   *  Absent/empty = never audited → never warn. */
  inventory?: string[];
  /** Fine-grained equipment picked from the catalog (equipmentCatalog ids).
   *  The coarse `inventory` above is derived from these items' `cls`. */
  equipmentItems?: string[];
  /** Band library (Load-entry C-5): colour → estimated resistance in kg, set
   *  once per gym. Absent = use BAND_DEFAULTS. */
  bandLibrary?: BandRung[];
}

/** Default geofence for a newly saved gym (AC-GYM-05). */
export const DEFAULT_GYM_RADIUS_M = 50;

/** The "Inside" badge is a tighter presence check than the (wider) save
 *  geofence: a gym floor is ~30 m across, so 130 m down the street must not
 *  read as inside. Capped independent of the saved radiusM. */
export const INSIDE_RADIUS_M = 30;

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

/** Non-lifting load (design feature 6). Conditioning adds systemic load;
 *  recovery (massage, sauna, cold, mobility) counts as recovery. */
/**
 * A coached athlete's live (or just-finished) session, mirrored to
 * `liveSessions/{athleteUid}` so their trainer sees it on Today in real time.
 * The athlete's own client writes it; the trainer reads by `trainerId`.
 */
export interface LiveSession {
  /** Doc id = the athlete's uid. */
  id: string;
  /** The workout id — lets the coach open the finished session's recap. */
  workoutId?: string;
  athleteName: string;
  avatarExt?: string | null;
  /** The coach who may read this doc. */
  trainerId: string;
  /** Epoch ms the session started. */
  startedAt: number;
  gymName?: string | null;
  exerciseCount?: number;
  /** The athlete's previous finished workout, for context on the banner. */
  lastName?: string | null;
  lastSets?: number;
  lastTonnageKg?: number;
  lastAt?: number | null;
  /** Set when the session ends; null while live. Final stats fill in then. */
  finishedAt?: number | null;
  finalSets?: number;
  finalTonnageKg?: number;
  /** Heartbeat while live — lets the trainer show an offline/last-seen state. */
  updatedAt: number;
}

export type ActivityCategory = 'conditioning' | 'recovery';

/** Effort dial that nudges the MET-based calorie estimate. */
export type ActivityEffort = 'light' | 'moderate' | 'hard';

/** One logged activity — a cardio or recovery session, timed live or backfilled. */
export interface Activity {
  id: string;
  /** Catalog key (see ACTIVITY_TYPES); unknown keys degrade gracefully. */
  type: string;
  /** Denormalised category so the feed survives catalog changes. */
  category: ActivityCategory;
  /** ms epoch the activity started (or the backfilled date). */
  startedAt: number;
  /** ms epoch it finished; null only while a live activity is running/paused. */
  finishedAt: number | null;
  /** Final duration in minutes (authoritative once saved). */
  durationMin: number;
  calories?: number | null;
  distanceKm?: number | null;
  effort?: ActivityEffort;
  note?: string | null;
  /** Live-timer bookkeeping (only while finishedAt === null):
   *  ms epoch of the current running segment's start, or null while paused. */
  runningSince?: number | null;
  /** Live-timer bookkeeping: elapsed ms banked from finished segments. */
  accumulatedMs?: number;
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
