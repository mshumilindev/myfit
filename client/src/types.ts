/**
 * Set type (design DS-1 + SD-1): working · warm-up · dropset · reverse dropset ·
 * static-dynamic (a TUT-driven timed hold, logged as weight + hold seconds).
 * A drop/reverse-drop is still ONE set; its parts live in `drops`.
 */
import type { BandRung } from './loads';
import type { MuscleGroup } from './data/exercises';

export type SetType = 'working' | 'warmup' | 'drop' | 'reverse-drop' | 'static-dynamic';

/** One drop inside a drop/reverse-drop set (after the start weight). */
export interface DropEntry {
  reps: number;
  weight: number | null;
}

export type FailureMark = 'manual' | 'auto' | 'no';

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
  /**
   * Taken to failure — the next rep wouldn't go. 'manual' = the athlete said
   * so (F / flame), 'auto' = the app inferred it at log time (see failure.ts,
   * `failureWhy` says why), 'no' = an inference the athlete dismissed.
   * Absent = not to failure.
   */
  failure?: FailureMark | null;
  /** Why an 'auto' failure was inferred (failure.ts reason code). */
  failureWhy?: string | null;
  /** The rest target that was running when this set was logged (seconds) —
   *  lets the table flag a rest cut short. */
  restTargetSec?: number | null;
  /** The app's effort estimate (rpe.ts) when the athlete didn't rate the set. */
  rpeAuto?: number | null;
  /** Partial reps squeezed out after failure. */
  partials?: number | null;
  /** Cardio machine readings (absent on strength sets / older entries). */
  speedKmh?: number | null;
  inclinePct?: number | null;
  watts?: number | null;
  /** Resistance level — brand-specific, logged for progress only. */
  level?: number | null;
  floors?: number | null;
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

/**
 * One exercise inside a warm-up block (the `kind:'warmup'` marker). Pure
 * logging: a name, ONE set (reps + optional weight, or seconds) and `done`,
 * which means "logged" (set only by the Log action; pending otherwise).
 * Deliberately NOT
 * a SetEntry: a marker keeps zero sets, so volume / PR / set-type stats never
 * see warm-up items.
 */
export interface WarmupItem {
  id: string;
  /** Canonical English name from the exercise catalog. */
  name: string;
  /** Catalog id of the exercise. */
  exerciseId?: string;
  durationSec?: number;
  reps?: number;
  /** Load in kg (display unit is applied on screen), for weighted moves. */
  weight?: number;
  /** Logged (true) or still a pending logger (false / absent in old data). */
  done: boolean;
  /** When it was logged (ms epoch). */
  at?: number;
}

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
  /** Cool-down marker: when the athlete started it (ms). Rest stops from here
   *  until a set is logged again. */
  markerAt?: number | null;
  /** Warm-up marker: real measured time (seconds) from the warm-up start until
   *  the first working set (or finish). Frozen once known. Absent on older data
   *  = nothing was measured, nothing is shown. */
  warmupMeasuredSec?: number | null;
  /** Warm-up marker only: the exercises of the warm-up, in order. Absent or
   *  empty = a plain, generic warm-up (optionally with minutes). */
  warmupItems?: WarmupItem[];
  /** Muscle groups (design MG-1): one primary, any number of secondaries. */
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
  /** Home set moves: 'hold' / 'time' are logged with a stopwatch (a
   *  static-dynamic set, bodyweight, seconds in durationMin). Absent = reps. */
  measure?: 'reps' | 'hold' | 'time' | null;
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
  /** 'home' = a home set session (no gym, home-only moves). Absent = gym. */
  kind?: 'home' | null;
  /** The home set template this session was started from (if any). */
  homeSetId?: string | null;
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
// Daily resting energy (feature: resting kcal per day, computed on the fly)
// ---------------------------------------------------------------------------

/** Auto-inferred lifestyle band → a NEAT (non-exercise activity) multiplier on
 *  BMR. Logged workouts and activities are counted separately on top, so these
 *  factors deliberately exclude structured exercise. */
export type LifestyleLevel = 'sedentary' | 'light' | 'moderate' | 'active';

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
  /** An auto-filled night you confirmed ("Looks right"): stays marked `auto`, stops nudging. */
  autoConfirmed?: boolean;
  /** Sleep vs a daytime nap. Absent on older data → derived by
   *  classifySleepKind (a nap is a short ≤3h daytime sleep and stays out of the
   *  nightly averages/streak/graph). A manual choice in the editor sets this
   *  explicitly and wins over the heuristic. */
  kind?: 'sleep' | 'nap';
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
  /** Wake-day keys the user explicitly discarded from auto sleep, so auto-fill
   *  does not recreate them as soon as the live night disappears. */
  skippedAutoSleepDates?: string[];
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
  /** Kit the athlete said "not at this gym" to (catalog ids): never suggested
   *  again from their workouts here. Personal, never shared. */
  equipmentNotHere?: string[];
  /** Band library (Load-entry C-5): colour → estimated resistance in kg, set
   *  once per gym. Absent = use BAND_DEFAULTS. */
  bandLibrary?: BandRung[];
  /** Venue facilities the athlete confirmed here (gymAmenities ids: pool, sauna, …). When set it
   *  wins over `amenitiesAuto`; absent = not reviewed yet, fall back to the detected ones. */
  amenities?: string[];
  /** Facilities detected from the venue data (place tags / name) when the gym was saved. */
  amenitiesAuto?: string[];
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
 *  the gym; 'off' = fully away from the gym (e.g. a vacation); 'illness' = sick
 *  days (rest up — streak protected, program paused, ease back in on return). */
export type RestMode = 'active' | 'off' | 'illness';

/** What kind of "unwell" an illness period is (illness.ts turns it — with how
 *  long it lasted — into the return-to-training plan). `mental` (low mood,
 *  burnout, anxiety) has no rest-up or ramp: it goes by feel. */
export type IllnessKind = 'cold' | 'virus' | 'stomach' | 'mental' | 'other';

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
  /** User label from the Health form ("Vacation", "Flu"); null = the mode's name. */
  name?: string | null;
  /** Illness periods only: the kind of unwell. Missing (older records) = 'other'. */
  illnessKind?: IllnessKind;
  /** Open-ended (illness "until I'm better"): no fixed end yet — treated as
   *  running from startDay up to today until closed via endRestPeriod. */
  open?: boolean;
  updatedAt?: number;
}

/** A rehab stage. Protect (out) → Reintroduce (light) → Rebuild (graded) →
 *  Return (full). See injury.ts for the phase engine. */
export type RehabStageId = 'protect' | 'reintroduce' | 'rebuild' | 'return';

/** How a session touching the injured area felt — the pain traffic-light that
 *  drives progression. fine = no pain / gone within a day; sore = settled the
 *  same day; pain = sharp or lingering. */
export type CheckinFeel = 'fine' | 'sore' | 'pain';

/** One post-session rehab check-in. */
export interface RehabCheckin {
  id: string;
  /** Local day key (see dayKey). */
  day: number;
  at: number;
  feel: CheckinFeel;
  /** Stage the injury was in when this check-in was logged. */
  stage: RehabStageId;
}

/** Setup branch: a localised injury (muscle-derived) or a general/non-muscle
 *  situation that eases the whole body back rather than protecting one area. */
export type RehabReason = 'injury' | 'surgery' | 'illness' | 'break' | 'cautious';

/** Which side, for a localised injury. */
export type InjurySide = 'left' | 'right' | 'both';

/** A tracked injury with a guided, feel-driven rehab plan. Mirrors the
 *  RestPeriod pattern (localStorage + per-user Firestore subcollection). */
export interface Injury {
  id: string;
  /** Setup branch. 'injury' = a localised body part (default); the rest are the
   *  general/non-muscle branch (post-surgery, illness, long break, caution). */
  reason: RehabReason;
  /** Body-part key (see BODY_PARTS in injury.ts). Empty on the general branch. */
  bodyPart: string;
  /** Side of a localised injury. */
  side?: InjurySide;
  /** Muscles protected while rehabbing (derived from the body part, editable). */
  muscles: MuscleGroup[];
  stage: RehabStageId;
  /** Local day key the injury was logged. */
  startDay: number;
  createdAt: number;
  updatedAt?: number;
  /** Newest last. */
  checkins: RehabCheckin[];
  /** Two good check-ins in a row have offered the next stage; the user confirms
   *  (advance) or stays. Progression is offered, never automatic. */
  pendingAdvance?: boolean;
  note?: string | null;
  /** Clinician-set no-load window (Stage 0 · Full rest): the day key training
   *  resumes. While today < this, the plan is date-bound full rest, shown in
   *  rest-blue; after it, the by-feel stages begin. null = go by feel from now. */
  fullRestUntil?: number | null;
  /** Set when marked healed; a healed injury is history, not active. */
  healedDay?: number | null;
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

/** Per-condition sharing with the coach: 'inherit' follows the general default. */
export type ConditionShare = 'inherit' | 'off' | 'effects' | 'full';

/** A permanent, private long-term health condition (see docs/specs/chronic-conditions-plan.md). */
export interface ChronicCondition {
  id: string;
  key: string;
  severity: 1 | 2 | 3;
  share: ConditionShare;
  createdAt: number;
  /** Temporary conditions (pregnancy, recovery after surgery): when it began (ms). */
  startedAt?: number;
  /** Expected end (ms). Auto-filled from the condition's typical length; user-editable. */
  endsAt?: number;
}

// --- Nicotine (private, sealed; see nicotine.ts) ----------------------------------------

/** The 10 product tiles of the "What I use" grid. */
export type NicotineKind =
  | 'cigarettes'
  | 'cigars'
  | 'pipe'
  | 'heated'
  | 'vape'
  | 'pouches'
  | 'snus'
  | 'chew'
  | 'hookah'
  | 'other';

/** What the usual amount is counted in. Which units a kind offers: `NICOTINE_KINDS`. */
export type NicotineUnit =
  | 'pieces'
  | 'packs'
  | 'sticks'
  | 'bowls'
  | 'pouches'
  | 'portions'
  | 'sessions'
  | 'puffs'
  | 'pods'
  | 'ml'
  | 'uses';

/** One product the user uses. Amounts are approximate, per ordinary day. No logging. */
export interface NicotineProduct {
  id: string;
  kind: NicotineKind;
  unit: NicotineUnit;
  /** Approximate usual amount per day, in `unit`. Ignored while `occasional`. */
  amount: number;
  /** From time to time: used now and then, no amount known. Only the strength counts. */
  occasional?: true;
  /** Nicotine per base unit: mg per cigarette / stick / pouch / portion / bowl / use, or mg per ml (vape). */
  strengthMg: number;
  /** Vape pods only: how many ml one pod holds. */
  mlPerPod?: number;
  /** Inactive products stay saved but are left out of every number. */
  active: boolean;
}

/** Every place nicotine may quietly adjust a number; each has its own switch. */
export type NicotineSurface =
  | 'readiness'
  | 'fatigue'
  | 'sleep'
  | 'warmup'
  | 'rest'
  | 'progression'
  | 'rpe'
  | 'trends'
  | 'afterWorkoutHints';

export type NicotineSharing = 'off' | 'effects' | 'full';

export interface NicotineSettings {
  /**
   * Schema version of these settings (current 2). Below 2 (or absent) the experimental
   * surfaces are reset to off once when the document is read; from 2 on explicit choices stay.
   */
  version: number;
  /** Master switch: "Use nicotine in my numbers". */
  useInCalculations: boolean;
  /** "Advanced": per-surface switches (all on by default). */
  surfaces: Record<NicotineSurface, boolean>;
  /** What a coach may see. Off by default. */
  sharing: NicotineSharing;
}

/** The whole sealed user document (users/{uid}/meta/nicotine). */
export interface NicotineState {
  products: NicotineProduct[];
  settings: NicotineSettings;
  /** Last-write-wins stamp (ms); 0 = never saved. */
  updatedAt: number;
}

// --- Alcohol (private, sealed; see alcohol.ts) ------------------------------------------

/** Where the user is, for the standard-drink size and the measures shown (see alcoholRegion.ts). */
export type AlcoholRegion = 'eu' | 'us' | 'uk' | 'au' | 'ca';

/** The 25 bundled drinks (the user cannot create their own; see alcoholCatalog.ts). */
export type AlcoholItemId =
  | 'beerLight'
  | 'beerRegular'
  | 'beerStrong'
  | 'beerCraft'
  | 'ciderRegular'
  | 'ciderStrong'
  | 'wineRed'
  | 'wineWhite'
  | 'wineRose'
  | 'wineSparkling'
  | 'fortPort'
  | 'fortSherry'
  | 'fortVermouth'
  | 'spVodka'
  | 'spWhisky'
  | 'spRum'
  | 'spGin'
  | 'spBrandy'
  | 'spTequila'
  | 'spLiqueur'
  | 'cocktail'
  | 'longDrink'
  | 'hardSeltzer'
  | 'rtd'
  | 'lowAlcohol';

/** One drink the user has. Approximate, per ordinary week. No logging by day. */
export interface AlcoholEntry {
  id: string;
  itemId: AlcoholItemId;
  /** One serving, in ml (a preset or close to it). */
  servingMl: number;
  /** Approximate servings in an ordinary week. Ignored while `occasional`. */
  servingsPerWeek: number;
  /** From time to time: a small fixed background amount, whatever the count holds. */
  occasional?: true;
  /** Inactive entries stay saved but are left out of every number. */
  active: boolean;
}

/** Every place alcohol may quietly adjust a number; each has its own switch. */
export type AlcoholSurface =
  'readiness' | 'sleep' | 'fatigue' | 'progression' | 'trends' | 'afterWorkoutHints';

/** Alcohol is shared as effects only: never the amounts or the drinks. */
export type AlcoholSharing = 'off' | 'effects';

export interface AlcoholSettings {
  /** Schema version of these settings (current 1). */
  version: number;
  /** Master switch: "Use alcohol in my numbers". */
  useInCalculations: boolean;
  /** Per-surface switches; the ones with no research behind them start off. */
  surfaces: Record<AlcoholSurface, boolean>;
  /** What a coach may see. Off by default. */
  sharing: AlcoholSharing;
  /**
   * "Usually drink on": weekdays, 0 = Monday ... 6 = Sunday (ISO weekday - 1). Empty = no
   * pattern, the weekly amount is spread evenly. Otherwise the readiness / sleep effect
   * lands on the day AFTER a listed day.
   */
  usualDays: number[];
  /** "Ask me on Today": the optional "did you drink?" check-in. Off by default. */
  checkinsOn: boolean;
  /** Manual region; absent = detect (position, then time zone, then language). */
  regionOverride?: AlcoholRegion;
}

/**
 * The answer to "did you drink on this day?" (asked on Today after a usual drinking day).
 * No answer = the usual-days assumption. Kept for the last 60 days only.
 */
export interface AlcoholCheckin {
  /** False = no alcohol that day. */
  drank: boolean;
  /** Grams of pure alcohol that evening (the usual amount, or what the user typed). */
  grams?: number;
  /** The active entries behind a "usual" answer (ids only). */
  entryIds?: string[];
}

/** The whole sealed user document (users/{uid}/meta/alcohol). */
export interface AlcoholState {
  entries: AlcoholEntry[];
  /** 'YYYY-MM-DD' (the local drinking day) -> answer. Same sealed doc; last 60 days. */
  checkins: Record<string, AlcoholCheckin>;
  settings: AlcoholSettings;
  /** Last-write-wins stamp (ms); 0 = never saved. */
  updatedAt: number;
}

// --- Supplements (private, sealed; see supplements.ts) ----------------------------------

/** The four groups of the bundled catalog (see supplementCatalog.ts). */
export type SupplementGroup = 'performance' | 'protein' | 'recovery' | 'health';

/** The 31 bundled supplements (the user cannot create their own; see supplementCatalog.ts). */
export type SupplementId =
  | 'creatine'
  | 'caffeine'
  | 'preWorkout'
  | 'betaAlanine'
  | 'citrulline'
  | 'nitrate'
  | 'bicarbonate'
  | 'whey'
  | 'casein'
  | 'plantProtein'
  | 'eaa'
  | 'bcaa'
  | 'glutamine'
  | 'hmb'
  | 'collagen'
  | 'magnesium'
  | 'melatonin'
  | 'glycine'
  | 'ashwagandha'
  | 'omega3'
  | 'tartCherry'
  | 'curcumin'
  | 'vitaminD'
  | 'multivitamin'
  | 'zinc'
  | 'iron'
  | 'vitaminC'
  | 'vitaminE'
  | 'probiotics'
  | 'vitaminB12'
  | 'calcium';

/** The unit a dose is counted in ('serving' = one tablet / capsule / label serving). */
export type SupplementUnit = 'g' | 'mg' | 'µg' | 'ml' | 'scoop' | 'serving';

/** How often an entry counts: every day, or only on the user's training days (plan / actual). */
export type SupplementSchedule = 'daily' | 'trainingDays';

/** When in the day it is taken (the label the user picks). */
export type SupplementTiming =
  'anytime' | 'morning' | 'preWorkout' | 'withMeal' | 'postWorkout' | 'evening';

/** One supplement the user takes. Approximate; nothing is logged by time. */
export interface SupplementEntry {
  id: string;
  itemId: SupplementId;
  /** One serving, in the item's unit (a preset or a stepper value). */
  dose: number;
  schedule: SupplementSchedule;
  timing: SupplementTiming;
  /** When the entry was first saved (ms). Effects and their ramp are measured from here. */
  startedAt: number;
  /** Inactive entries stay saved but are left out of every number. */
  active: boolean;
}

/** Every place supplements may quietly show or adjust a number; each has its own switch. */
export type SupplementSurface =
  'strength' | 'sleep' | 'rpe' | 'protein' | 'trends' | 'afterWorkoutHints';

/** What a coach may see: nothing, the effect ranges only, or also names and doses. */
export type SupplementSharing = 'off' | 'effects' | 'full';

export interface SupplementSettings {
  /** Schema version of these settings (current 1). */
  version: number;
  /** Master switch: "Use supplements in my numbers". */
  useInCalculations: boolean;
  /** Per-surface switches. */
  surfaces: Record<SupplementSurface, boolean>;
  /** What a coach may see. Off by default. */
  sharing: SupplementSharing;
  /** "Ask on Today": the optional day check-in. Off by default. */
  checkinsOn: boolean;
}

/**
 * The answer to "did you take your supplements on this day?" (asked on Today). No answer =
 * the assumption that everything due that day was taken. Kept for the last 60 days only.
 */
export interface SupplementCheckin {
  /** False = nothing taken that day. */
  taken: boolean;
  /** The due entries that were taken (ids only); absent = every entry that was due. */
  entryIds?: string[];
}

/** The whole sealed user document (users/{uid}/meta/supplements). */
export interface SupplementState {
  entries: SupplementEntry[];
  /** 'YYYY-MM-DD' (the local day) -> answer. Same sealed doc; last 60 days. */
  checkins: Record<string, SupplementCheckin>;
  settings: SupplementSettings;
  /** Last-write-wins stamp (ms); 0 = never saved. */
  updatedAt: number;
}
