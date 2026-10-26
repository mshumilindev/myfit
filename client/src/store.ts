/**
 * Tracker store — Firestore-native.
 *
 * A workout is a single document at users/{uid}/workouts/{wid} with its
 * exercises/sets nested inline (matching the in-memory shape). Reads come from
 * live onSnapshot listeners; writes go straight to Firestore, whose offline
 * persistence queues and replays them automatically — so the old hand-rolled
 * localStorage mutation queue is gone. Every mutation still patches in-memory
 * state first for instant UI; the snapshot reconciles to canonical data.
 *
 * All the pure/derived helpers (volume, per-hand, supersets, muscles, records)
 * are unchanged — they operate on the in-memory workouts array.
 */
import { autoMainGymIds, isMainGym } from './mainGym';
import {
  coachView,
  pregnancyKeyAt,
  suggestedEnd,
  stripLegacyCondition,
  stripLegacyConditions,
  type GeneralShare,
} from './conditions';
import { COACH_DEFAULT, normalizeTemper, type CoachSettings } from './atlas/types';
import { useSyncExternalStore } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { EQUIPMENT_CATALOG } from './data/equipmentCatalog';
import {
  AUTO_FINISH_MS,
  type Activity,
  type ActivityCategory,
  type ActivityEffort,
  type BodyMetrics,
  type DropEntry,
  type Exercise,
  type ExerciseKind,
  type Gym,
  type LiveSession,
  type QueuedMutation,
  type RestMode,
  type IllnessKind,
  type RestPeriod,
  type Injury,
  type ChronicCondition,
  type RehabStageId,
  type CheckinFeel,
  type RehabCheckin,
  type RehabReason,
  type InjurySide,
  type SetEntry,
  type SetType,
  type SyncStatus,
  type SyncError,
  type WarmupItem,
  type WeightEntry,
  type Workout,
  type SleepNight,
  type SleepSchedule,
  type SleepSettings,
  type SleepQuality,
  type AlcoholCheckin,
  type AlcoholEntry,
  type AlcoholRegion,
  type AlcoholSettings,
  type AlcoholState,
  type AlcoholSurface,
  type SupplementEntry,
  type SupplementSettings,
  type SupplementState,
  type SupplementSurface,
  type NicotineProduct,
  type NicotineSettings,
  type NicotineState,
  type NicotineSurface,
} from './types';
import {
  canonicalExerciseName,
  isBuiltInExercise,
  muscleInfoByName,
  registerCustomExercise,
  registerCustomExercises,
  customExercises,
  type CustomExercise,
  type MuscleGroup,
  isCardioExerciseName,
} from './data/exercises';
import { defaultMeasure } from './data/exerciseProfile';
import { kitEvidence, type KitEvidence } from './gymEvidence';
import type { ExerciseSubRegions } from './data/subregions';
import { EMPTY_GOALS, type FitGoals, type PhysiqueTarget, type BlockFocus } from './goals';
import {
  EMPTY_HOME,
  HOME_IDLE_MS,
  homeIdleFinishAt,
  homeMoveById,
  type HomeMove,
  type HomeSet,
  type HomeState,
} from './homeSets';
import { sleepBlockedBy, type SleepBlock } from './sleepGuard';
import { setTypeOf, setDrops, setVolumeKg, topSet, autoWarmupSets } from './setMath';
import { resolveSidesMode, ONE_ARM_NAME, type SidesMode } from './sidesMode';
import { groupRounds } from './supersetBlocks';
export { setTypeOf, setDrops, setVolumeKg, topSet, autoWarmupSets, groupRounds };
export { setRepsTotal, setTopWeight, WARMUP_FRAC } from './setMath';
export { sessionBlocks, nextSupersetLetter, groupCurrentRound } from './supersetBlocks';
export type { SupersetGroup, SessionBlock } from './supersetBlocks';
export type { SidesMode };
import { deriveLoadType, BAND_DEFAULTS, type LoadType, type BandRung } from './loads';
import { REST_PREFS_DEFAULT, type RestPrefs } from './restTimer';
import { describeDay, dayReadoutLabel, type DayReadout } from './data/daySuggest';
import { t, getLocale, type LocaleId } from './i18n';
import {
  firstStrengthSetAt,
  positiveWeight,
  secToMinutes,
  warmupDoneSeconds,
  warmupItemsOf,
  warmupMeasuredSec,
} from './warmupLog';
import { localizedEquipName } from './data/equipmentI18n';
import {
  applyCheckin,
  nextStage,
  activeInjuries as selectActiveInjuries,
  bodyPart as findBodyPart,
} from './injury';
import {
  cutOut,
  mergeRanges,
  overlappingPeriods,
  validateRange,
  type DayRange,
  type RangeError,
} from './health';
import {
  awakeMsAt,
  SLEEP_IDLE_MS,
  computeUpcomingNights,
  classifySleepKind,
  sleepKindOf,
  duplicateSleepIds,
} from './sleep';
import { computeStreak } from './streak';
import { currentUid, getRole, callFn } from './api';
import { readProgramMemory } from './data/programMemory';
import { CONDITIONS_KEY, CONDITIONS_SHARE_KEY, createConditionsCache } from './conditionsCache';
import {
  healthSnapshot,
  healthVersion,
  healthWriteDenied,
  isHealthOn,
  subscribeHealth,
  type HealthWriteDenied,
  type HealthWriteResult,
} from './data/healthConsentGate';
import { maskHealth } from './healthMask';
import type { HealthFeature } from './legal/consents';
import { createAlcoholCache } from './alcoholCache';
import { alcoholCoachView } from './alcoholShare';
import {
  alcoholEffects,
  alcoholEffectsFor,
  alcoholLoad,
  alcoholWeekActual,
  dayKey as alcoholDayKey,
  normalizeCheckins,
  pendingAlcoholCheckin,
  usualOccasionGrams,
  type PendingCheckin,
  type WeekActual,
  emptyAlcoholState,
  isAlcoholSharing,
  cleanUsualDays,
  normalizeAlcohol,
  normalizeAlcoholEntry,
  type AlcoholEffects,
  type AlcoholLoad,
  type DayInput,
} from './alcohol';
import { isAlcoholRegion, resolveAlcoholRegion } from './alcoholRegion';
import { createSupplementsCache } from './supplementsCache';
import { supplementsCoachView } from './supplementsShare';
import {
  dayKey as supplementDayKey,
  emptySupplementState,
  isSupplementSharing,
  normalizeSupplementCheckins,
  normalizeSupplementEntry,
  normalizeSupplements,
  pendingSupplementCheckin,
  supplementEffectsFor,
  supplementProteinGramsFor,
  supplementWarnings,
  usualTrainingStartMin,
  type PendingSupplementCheckin,
  type SupplementContext,
  type SupplementEffects,
  type SupplementWarning,
} from './supplements';
import { createNicotineCache } from './nicotineCache';
import { createCycleCache } from './cycleCache';
import {
  emptyCycleState,
  normalizeCycle,
  withStart,
  type CycleState,
  type CycleSurface,
} from './cycle/cycleState';
import { MENOPAUSE_KEY, normalizeSettings, type CycleSettings } from './cycle/cycleCore';
import { nicotineCoachView } from './nicotineShare';
import {
  emptyNicotineState,
  isNicotineSharing,
  nicotineEffects,
  nicotineLoad,
  normalizeNicotine,
  normalizeNicotineProduct,
  type NicotineEffects,
  type NicotineLoad,
} from './nicotine';
import {
  vault,
  initVault,
  mirrorCollection,
  prepareWrite,
  runKeyExchange,
  setMigrationEnricher,
} from './vaultIO';
import {
  onWeekStartChange,
  resetWeekStart,
  setWeekStartDay,
  weekStartDay,
  weekStartUpdatedAt,
  type IsoDay,
} from './weekStart';
import type { GeneratedDay } from './sessionBuilder';
import {
  listPrefFromDoc,
  nextUpOffPref,
  programSuggestOffPref,
  pinsPref,
  reconcileListPref,
  type ListPrefStore,
} from './activityPrefs';
import { resetTodayLayout } from './today/layout';
import { pushTodayLayoutEdits, syncTodayLayoutFromDoc } from './today/layoutSync';
import { pushThemeEdits, syncThemeFromDoc } from './themes/themeSync';
// Synced Log-activity prefs (pins + "don't suggest after workouts").
export {
  activityPins,
  isPinned,
  nextUpOff,
  placePin,
  setActivityPins,
  setNextUpOff,
  toggleNextUpOff,
  togglePin,
  useActivityPins,
  useNextUpOff,
} from './activityPrefs';

const STATE_KEY = 'spotter.state';
const GYMS_KEY = 'spotter.gyms';
const SHARED_GYMS_KEY = 'spotter.sharedGyms';
const BODY_KEY = 'spotter.body';
const GOALS_KEY = 'spotter.goals';
const HOME_KEY = 'spotter.home';
const REST_KEY = 'spotter.restPeriods';
const INJURY_KEY = 'spotter.injuries';
const isGeneralShare = (v: unknown): v is GeneralShare =>
  v === 'off' || v === 'effects' || v === 'full';
const conditionsCache = createConditionsCache<ChronicCondition, GeneralShare>({
  vault,
  isShare: isGeneralShare,
});
const nicotineCache = createNicotineCache({ vault });
const cycleCache = createCycleCache({ vault });
const alcoholCache = createAlcoholCache({ vault });
const supplementsCache = createSupplementsCache({ vault });
function loadShare(): GeneralShare {
  try {
    const v = localStorage.getItem(CONDITIONS_SHARE_KEY);
    return isGeneralShare(v) ? v : 'effects';
  } catch {
    return 'effects';
  }
}
const ACTIVITIES_KEY = 'spotter.activities';
const EX_UNIT_KEY = 'spotter.exerciseUnits';
const EX_LOAD_KEY = 'spotter.exerciseLoads';
const EX_SIDES_KEY = 'spotter.exerciseSides';
const EX_REST_KEY = 'spotter.exerciseRest';
const REST_PREFS_KEY = 'spotter.restPrefs';
const WEIGHT_UNIT_KEY = 'spotter.weightUnit';
const MASTERY_KEY = 'spotter.mastery';
const COACH_KEY = 'spotter.coach';
const SLEEP_KEY = 'spotter.sleeps';
const SLEEP_SCHED_KEY = 'spotter.sleep.schedule';
const SLEEP_SET_KEY = 'spotter.sleep.settings';
const SLEEP_TOMB_KEY = 'spotter.sleepTombstones.v1';
// Ids of sleep nights the user discarded, kept until the server confirms the
// delete. Durable across reloads so stale snapshots cannot resurrect a night
// while the delete is still in flight.
const pendingSleepDeletes = new Set<string>(
  (() => {
    try {
      const raw = localStorage.getItem(SLEEP_TOMB_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })(),
);
function persistSleepTombstones(): void {
  try {
    localStorage.setItem(SLEEP_TOMB_KEY, JSON.stringify([...pendingSleepDeletes]));
  } catch {
    /* private mode: Firestore is the source of truth anyway */
  }
}
// Ids of nights confirmed present on the server (from an authoritative snapshot).
// Distinguishes a genuine pending upload (never synced -> keep) from a night
// that was synced and is now gone (deleted here or in another tab -> drop, do
// not resurrect). Shared across same-origin tabs via localStorage.
const SLEEP_SYNCED_KEY = 'spotter.sleepSynced.v1';
const syncedSleepIds = new Set<string>(
  (() => {
    try {
      const raw = localStorage.getItem(SLEEP_SYNCED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })(),
);
function persistSyncedSleepIds(): void {
  try {
    localStorage.setItem(SLEEP_SYNCED_KEY, JSON.stringify([...syncedSleepIds].slice(-500)));
  } catch {
    /* ignore */
  }
}

const EMPTY_BODY: BodyMetrics = { weights: [] };

/** Per-exercise weight display unit (Load-entry B). Storage stays canonical kg;
 *  this only changes how the weight is shown/entered for a given lift/machine. */

/**
 * Stored coach settings → current shape. Old five-step tempers map onto the
 * three: Steady → green, Drill → red; "your mom"/swearing only stay on in red.
 */
function coachFrom(data: Partial<CoachSettings>): CoachSettings {
  const c = { ...COACH_DEFAULT, ...data };
  const temper = normalizeTemper(c.temper);
  return temper === 5 ? { ...c, temper } : { ...c, temper, yoMama: false, swearing: false };
}

export type DisplayUnit = 'kg' | 'lb';

/** A gym is a shared entity: its equipment inventory is crowdsourced and lives
 *  in Firestore under sharedGyms/<externalId>, keyed by the venue's stable id.
 *  Each user still keeps their own per-user gym reference (name, coords, radius,
 *  favourite); the equipment is overlaid from here. Cached locally; only deltas
 *  (arrayUnion/arrayRemove) sync. */
export interface SharedGym {
  equipmentItems: string[];
  updatedAt: number;
}

export interface StoreState {
  workouts: Workout[];
  gyms: Gym[];
  /** Shared gym inventories by externalId (cache of sharedGyms/*). */
  sharedGyms: Record<string, SharedGym>;
  /** Planned rest / recovery / vacation windows. */
  restPeriods: RestPeriod[];
  /** Tracked injuries with feel-driven rehab plans. */
  injuries: Injury[];
  /** Permanent private health conditions (sealed in the vault; see conditions.ts). */
  conditions: ChronicCondition[];
  /** General default for sharing conditions (per-condition 'inherit' follows it). */
  conditionsShare: GeneralShare;
  /** Private nicotine products + switches (sealed in the vault; see nicotine.ts). */
  nicotine: NicotineState;
  /** Private cycle settings + switches (sealed in the vault; see cycle/cycleState.ts). Never shared. */
  cycle: CycleState;
  /** Private alcohol entries + switches (sealed in the vault; see alcohol.ts). */
  alcohol: AlcoholState;
  /** Private supplement entries, switches and check-ins (sealed in the vault; see supplements.ts). */
  supplements: SupplementState;
  /** Logged non-lifting activities (cardio & recovery). */
  activities: Activity[];
  /** Account-wide weight unit (Load-entry B): the default everything is shown
   *  in. Defaults to kg; a per-exercise entry overrides it for one machine. */
  weightUnit: DisplayUnit;
  /** Per-exercise display unit override (absent = use weightUnit). Local only. */
  exerciseUnits: Record<string, DisplayUnit>;
  /** Per-exercise load-type override (Load-entry C). Absent = derive from the
   *  exercise (equipment + name). Local only. */
  exerciseLoadTypes: Record<string, LoadType>;
  exerciseSides: Record<string, 'one' | 'both'>;
  /** Remembered rest target per exercise (lower-cased name → seconds). Local only. */
  exerciseRest: Record<string, number>;
  /** Rest-timer alerts: vibrate / chime / keep screen on / notify. Local only. */
  restPrefs: RestPrefs;
  /** Self-reported training history for the Mastery Experience axis (optional). */
  mastery: {
    sinceYear: number | null;
    pattern: 'continuous' | 'occasional' | 'frequent' | null;
    /** Last rating we surfaced to the user — drives the rank-up moment. */
    seenRating: number | null;
    /** Sync stamp for last-write-wins across devices. */
    updatedAt?: number;
  };
  /** Own body metrics (weigh-ins, height, optional composition). */
  bodyMetrics: BodyMetrics;
  /** Logged nights; a live (in-progress) night has wake === null. */
  sleeps: SleepNight[];
  /** Intended sleep rhythm (one plan, or per weekday). */
  sleepSchedule: SleepSchedule;
  /** Sleep behaviour toggles + goal. */
  sleepSettings: SleepSettings;
  /** Goals: physique target, block focus, long-term goals (My Fit). */
  goals: FitGoals;
  /** Atlas, the built-in coach: on/off, temper, role (synced, last-write-wins). */
  coach: CoachSettings;
  /** Home sets + own home moves (synced as meta/home, last-write-wins). */
  home: HomeState;
  /** Retained for compatibility; always empty (Firestore handles queueing). */
  queue: QueuedMutation[];
  /** Coached athletes with a live (or just-finished) session — real-time,
   *  populated only for trainers; never persisted. */
  liveTrainees: LiveSession[];
  syncStatus: SyncStatus;
  syncError: SyncError | null;
  lastSyncAt: number | null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let state: StoreState = {
  workouts: load<Workout[]>(STATE_KEY, []),
  gyms: load<Gym[]>(GYMS_KEY, []),
  sharedGyms: load<Record<string, SharedGym>>(SHARED_GYMS_KEY, {}),
  restPeriods: load<RestPeriod[]>(REST_KEY, []),
  injuries: load<Injury[]>(INJURY_KEY, []),
  conditions: stripLegacyConditions(load<ChronicCondition[]>(CONDITIONS_KEY, [])),
  conditionsShare: loadShare(),
  nicotine: nicotineCache.load(),
  cycle: cycleCache.load(),
  alcohol: alcoholCache.load(),
  supplements: supplementsCache.load(),
  activities: load<Activity[]>(ACTIVITIES_KEY, []),
  weightUnit: load<DisplayUnit>(WEIGHT_UNIT_KEY, 'kg'),
  exerciseUnits: load<Record<string, DisplayUnit>>(EX_UNIT_KEY, {}),
  exerciseLoadTypes: load<Record<string, LoadType>>(EX_LOAD_KEY, {}),
  exerciseSides: load<Record<string, 'one' | 'both'>>(EX_SIDES_KEY, {}),
  exerciseRest: load<Record<string, number>>(EX_REST_KEY, {}),
  restPrefs: { ...REST_PREFS_DEFAULT, ...load<Partial<RestPrefs>>(REST_PREFS_KEY, {}) },
  mastery: load<StoreState['mastery']>(MASTERY_KEY, {
    sinceYear: null,
    pattern: null,
    seenRating: null,
  }),
  bodyMetrics: load<BodyMetrics>(BODY_KEY, EMPTY_BODY),
  sleeps: load<SleepNight[]>(SLEEP_KEY, []),
  sleepSchedule: load<SleepSchedule>(SLEEP_SCHED_KEY, {
    sameEveryNight: true,
    every: null,
    byDay: {},
  }),
  sleepSettings: load<SleepSettings>(SLEEP_SET_KEY, {
    autoDim: false,
    autoLog: false,
    goalMin: 480,
    lastDimDay: null,
    skippedAutoSleepDates: [],
    patternOffer: 'unseen',
  }),
  goals: load<FitGoals>(GOALS_KEY, EMPTY_GOALS),
  coach: coachFrom(load<Partial<CoachSettings>>(COACH_KEY, {})),
  home: { ...EMPTY_HOME, ...load<Partial<HomeState>>(HOME_KEY, {}) },
  queue: [],
  liveTrainees: [],
  syncStatus: 'pending',
  syncError: null,
  lastSyncAt: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

conditionsCache.boot({ conditions: state.conditions, share: state.conditionsShare });

/** When the vault key becomes available: read the sealed on-device copy and migrate legacy plaintext. */
function hydrateConditions(): void {
  void conditionsCache
    .hydrate({ conditions: state.conditions, share: state.conditionsShare })
    .then((next) => {
      if (!next) return;
      state = {
        ...state,
        conditions: stripLegacyConditions(next.conditions),
        conditionsShare: next.share,
      };
      emit();
    })
    .catch(() => undefined);
}
vault.subscribe(hydrateConditions);
if (vault.materialOrNull()) hydrateConditions();

nicotineCache.boot(state.nicotine);
cycleCache.boot(state.cycle);
alcoholCache.boot(state.alcohol);
supplementsCache.boot(state.supplements);
/** When the vault key becomes available: open the sealed on-device nicotine copy. */
function hydrateNicotine(): void {
  void nicotineCache
    .hydrate(state.nicotine)
    .then((next) => {
      if (!next) return;
      state = { ...state, nicotine: next };
      emit();
      const uid = currentUid();
      if (uid) publishCoachShare(uid, state.conditions);
    })
    .catch(() => undefined);
}
vault.subscribe(hydrateNicotine);
if (vault.materialOrNull()) hydrateNicotine();
/** When the vault key becomes available: open the sealed on-device cycle copy. */
function hydrateCycle(): void {
  void cycleCache
    .hydrate(state.cycle)
    .then((next) => {
      if (!next) return;
      state = { ...state, cycle: next };
      emit();
    })
    .catch(() => undefined);
}
vault.subscribe(hydrateCycle);
if (vault.materialOrNull()) hydrateCycle();
/** When the vault key becomes available: open the sealed on-device alcohol copy. */
function hydrateAlcohol(): void {
  void alcoholCache
    .hydrate(state.alcohol)
    .then((next) => {
      if (!next) return;
      state = { ...state, alcohol: next };
      emit();
      const uid = currentUid();
      if (uid) publishCoachShare(uid, state.conditions);
    })
    .catch(() => undefined);
}
vault.subscribe(hydrateAlcohol);
if (vault.materialOrNull()) hydrateAlcohol();
/** When the vault key becomes available: open the sealed on-device supplements copy. */
function hydrateSupplements(): void {
  void supplementsCache
    .hydrate(state.supplements)
    .then((next) => {
      if (!next) return;
      state = { ...state, supplements: next };
      emit();
      const uid = currentUid();
      if (uid) publishCoachShare(uid, state.conditions);
    })
    .catch(() => undefined);
}
vault.subscribe(hydrateSupplements);
if (vault.materialOrNull()) hydrateSupplements();

/** Features whose delete is emptying the on-device copy right now: they may write (the empty value) while off. */
const forcedPersist = new Set<HealthFeature>();
const mayPersist = (f: HealthFeature): boolean => isHealthOn(f) || forcedPersist.has(f);
function withForcedPersist(f: HealthFeature, run: () => void): void {
  forcedPersist.add(f);
  try {
    run();
  } finally {
    forcedPersist.delete(f);
  }
}

function persist(): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state.workouts));
    localStorage.setItem(COACH_KEY, JSON.stringify(state.coach));
    localStorage.setItem(GYMS_KEY, JSON.stringify(state.gyms));
    localStorage.setItem(SHARED_GYMS_KEY, JSON.stringify(state.sharedGyms));
    localStorage.setItem(REST_KEY, JSON.stringify(state.restPeriods));
    // A health key is written only while its consent is on (or while a delete empties it): a feature that is off adds
    // nothing new to this device, and a Firestore mirror cannot put data back (SPO-290 S3). What was stored before stays
    // until the person deletes it; the safety limits are read from memory, loaded from that copy at start.
    if (mayPersist('injuries')) localStorage.setItem(INJURY_KEY, JSON.stringify(state.injuries));
    // Sealed on device once the vault key is here; plaintext only as the no-key fallback.
    if (mayPersist('chronic'))
      conditionsCache.persist({ conditions: state.conditions, share: state.conditionsShare });
    if (mayPersist('nicotine')) nicotineCache.persist(state.nicotine);
    if (mayPersist('cycle')) cycleCache.persist(state.cycle);
    if (mayPersist('alcohol')) alcoholCache.persist(state.alcohol);
    if (mayPersist('supplements')) supplementsCache.persist(state.supplements);
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(state.activities));
    localStorage.setItem(WEIGHT_UNIT_KEY, JSON.stringify(state.weightUnit));
    localStorage.setItem(EX_UNIT_KEY, JSON.stringify(state.exerciseUnits));
    localStorage.setItem(EX_LOAD_KEY, JSON.stringify(state.exerciseLoadTypes));
    localStorage.setItem(EX_SIDES_KEY, JSON.stringify(state.exerciseSides));
    localStorage.setItem(EX_REST_KEY, JSON.stringify(state.exerciseRest));
    localStorage.setItem(REST_PREFS_KEY, JSON.stringify(state.restPrefs));
    localStorage.setItem(MASTERY_KEY, JSON.stringify(state.mastery));
    localStorage.setItem(BODY_KEY, JSON.stringify(state.bodyMetrics));
    localStorage.setItem(SLEEP_KEY, JSON.stringify(state.sleeps));
    localStorage.setItem(SLEEP_SCHED_KEY, JSON.stringify(state.sleepSchedule));
    localStorage.setItem(SLEEP_SET_KEY, JSON.stringify(state.sleepSettings));
    localStorage.setItem(GOALS_KEY, JSON.stringify(state.goals));
    localStorage.setItem(HOME_KEY, JSON.stringify(state.home));
  } catch {
    /* quota / private mode — Firestore cache is the real store */
  }
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  persist();
  emit();
}

let exposedMemo: { raw: StoreState; v: number; out: StoreState } | null = null;
/**
 * What the rest of the app may see (SPO-290): the state, with every health feature that has no consent replaced by its
 * empty value. Stable between changes. Writers inside this file keep using the raw `state`.
 */
function exposed(): StoreState {
  const v = healthVersion();
  if (exposedMemo === null || exposedMemo.raw !== state || exposedMemo.v !== v)
    exposedMemo = { raw: state, v, out: maskHealth(state, healthSnapshot().on) };
  return exposedMemo.out;
}

/** The current state, outside React (for chained actions). */
export function getStoreState(): StoreState {
  return exposed();
}

/** The stored safety limits. Content-free by contract: callers may only turn them into restrictions. */
export interface StoredLimits {
  injuries: readonly Injury[];
  conditions: readonly ChronicCondition[];
}
let limitsMemo: { i: Injury[]; c: ChronicCondition[]; out: StoredLimits } | null = null;
/**
 * RESTRICTION path (SPO-290 owner decision): the stored injuries and conditions, whatever the consent says. An active
 * injury needing rest, a pregnancy or a limiting condition the person once entered keep capping workout generation,
 * protecting the streak and pausing the cycle even when the feature is off or its consent is unknown. They only ever
 * restrict: this is for `healthBuildCtx`, `cycleSuppressedBy` and the like, NEVER for anything shown, shared or sent
 * (those read `useStore()` / `getStoreState()`, the masked view). Stable between changes.
 */
export function getStoredLimits(): StoredLimits {
  if (limitsMemo === null || limitsMemo.i !== state.injuries || limitsMemo.c !== state.conditions)
    limitsMemo = {
      i: state.injuries,
      c: state.conditions,
      out: { injuries: state.injuries, conditions: state.conditions },
    };
  return limitsMemo.out;
}
export function useStoredLimits(): StoredLimits {
  return useSyncExternalStore(subscribeStore, getStoredLimits);
}

/** Cycle settings + switches (a stable object until something changes). */
export function useCycle(): CycleState {
  return useSyncExternalStore(subscribeStore, () => exposed().cycle);
}

/** Nicotine products + switches (a stable object until something changes). */
export function useNicotine(): NicotineState {
  return useSyncExternalStore(subscribeStore, () => exposed().nicotine);
}

let nicotineMemo: { n: NicotineState; load: NicotineLoad } | null = null;
/** The combined load of the active products (mg and cigarette-equivalents per day). */
export function getNicotineLoad(): NicotineLoad {
  // `exposed().nicotine` can be missing in an old seeded / not yet migrated state: count it as empty.
  if (nicotineMemo === null || nicotineMemo.n !== exposed().nicotine)
    nicotineMemo = {
      n: exposed().nicotine,
      load: nicotineLoad(exposed().nicotine?.products ?? []),
    };
  return nicotineMemo.load;
}
export function useNicotineLoad(): NicotineLoad {
  return useSyncExternalStore(subscribeStore, getNicotineLoad);
}

let effectsMemo: { n: NicotineState; e: NicotineEffects | null } | null = null;
/** What the engines should apply now; null = master off or no product (change nothing). */
export function getNicotineEffects(): NicotineEffects | null {
  if (effectsMemo === null || effectsMemo.n !== exposed().nicotine)
    effectsMemo = {
      n: exposed().nicotine,
      e: exposed().nicotine ? nicotineEffects(exposed().nicotine) : null,
    };
  return effectsMemo.e;
}
export function useNicotineEffects(): NicotineEffects | null {
  return useSyncExternalStore(subscribeStore, getNicotineEffects);
}

/** Alcohol entries + switches (a stable object until something changes). */
export function useAlcohol(): AlcoholState {
  return useSyncExternalStore(subscribeStore, () => exposed().alcohol);
}

let alcoholMemo: { a: AlcoholState; load: AlcoholLoad } | null = null;
/** Weekly grams of pure alcohol, memoised on the state object (an old / missing state counts as empty). */
export function getAlcoholLoad(): AlcoholLoad {
  if (alcoholMemo === null || alcoholMemo.a !== exposed().alcohol)
    alcoholMemo = { a: exposed().alcohol, load: alcoholLoad(exposed().alcohol?.entries ?? []) };
  return alcoholMemo.load;
}
export function useAlcoholLoad(): AlcoholLoad {
  return useSyncExternalStore(subscribeStore, getAlcoholLoad);
}

let alcoholEffectsMemo: { a: AlcoholState; e: AlcoholEffects | null } | null = null;
/** Flat weekly effects (null = nothing to apply), memoised; guarded against a missing state. */
export function getAlcoholEffects(): AlcoholEffects | null {
  if (alcoholEffectsMemo === null || alcoholEffectsMemo.a !== exposed().alcohol)
    alcoholEffectsMemo = {
      a: exposed().alcohol,
      e: exposed().alcohol ? alcoholEffects(exposed().alcohol) : null,
    };
  return alcoholEffectsMemo.e;
}
export function useAlcoholEffects(): AlcoholEffects | null {
  return useSyncExternalStore(subscribeStore, getAlcoholEffects);
}
/** Effects for one calendar day, honouring "usually drink on" (null = nothing to apply). */
export function getAlcoholEffectsFor(day: DayInput): AlcoholEffects | null {
  return alcoholEffectsFor(exposed().alcohol, day);
}

let pendingMemo: { a: AlcoholState; hour: number; p: PendingCheckin | null } | null = null;
/** The check-in to ask on Today (see `pendingAlcoholCheckin`), or null. Stable between calls within an hour. */
export function getPendingAlcoholCheckin(now: number = Date.now()): PendingCheckin | null {
  const hour = Math.floor(now / 3_600_000);
  if (pendingMemo === null || pendingMemo.a !== exposed().alcohol || pendingMemo.hour !== hour)
    pendingMemo = { a: exposed().alcohol, hour, p: pendingAlcoholCheckin(now, exposed().alcohol) };
  return pendingMemo.p;
}
export function usePendingAlcoholCheckin(): PendingCheckin | null {
  return useSyncExternalStore(subscribeStore, () => getPendingAlcoholCheckin());
}
/** The week so far from the check-ins; `weekStart` = ISO weekday the week begins on (default Monday). */
export function getAlcoholWeekActual(now: number = Date.now(), weekStart = 1): WeekActual | null {
  return alcoholWeekActual(exposed().alcohol, now, weekStart);
}

/** The region in force: the manual choice, else detected from position / time zone / language. */
export function getAlcoholRegion(): AlcoholRegion {
  return resolveAlcoholRegion(exposed().alcohol?.settings?.regionOverride);
}
export function useAlcoholRegion(): AlcoholRegion {
  return useSyncExternalStore(subscribeStore, getAlcoholRegion);
}

/** Supplement entries + switches + check-ins (a stable object until something changes). */
export function useSupplements(): SupplementState {
  return useSyncExternalStore(subscribeStore, () => exposed().supplements);
}
/** The current supplements document, outside React (an old / missing state counts as empty). */
export const getSupplements = (): SupplementState =>
  exposed().supplements ?? emptySupplementState();

/**
 * What the model needs from the rest of the store to tell a training day: today, the days with
 * a finished workout or conditioning activity, the start times of finished workouts and the
 * latest body weight. The training PLAN is added by `supplementsApply.supplementContext`
 * (the plan cache lives outside the store).
 */
export function getSupplementTrainingFacts(now: number = Date.now()): {
  todayKey: string;
  trainedDays: string[];
  workoutStarts: number[];
  bodyWeightKg: number | null;
} {
  const days = new Set<string>();
  const starts: number[] = [];
  for (const w of state.workouts ?? []) {
    if (w.finishedAt === null || w.finishedAt === undefined) continue;
    const k = supplementDayKey(w.startedAt);
    if (k) days.add(k);
    starts.push(w.startedAt);
  }
  for (const a of state.activities ?? []) {
    if (a.category !== 'conditioning' || a.finishedAt === null) continue;
    const k = supplementDayKey(a.startedAt);
    if (k) days.add(k);
  }
  const kg = latestWeight(state.bodyMetrics)?.weight;
  return {
    todayKey: supplementDayKey(now) ?? '',
    trainedDays: [...days],
    workoutStarts: starts,
    bodyWeightKg: typeof kg === 'number' && kg > 0 ? kg : null,
  };
}

/** The effects of one calendar day (null = master off or nothing counts). Pass `supplementContext()`. */
export function getSupplementEffectsFor(
  day: DayInput,
  ctx: SupplementContext,
): SupplementEffects | null {
  return supplementEffectsFor(exposed().supplements, day, ctx);
}
export function getSupplementProteinGramsFor(day: DayInput, ctx: SupplementContext): number {
  return supplementProteinGramsFor(exposed().supplements, day, ctx);
}
export function getSupplementWarnings(ctx: SupplementContext): SupplementWarning[] {
  return supplementWarnings(exposed().supplements, ctx);
}

/**
 * The check-in to ask on Today (see `pendingSupplementCheckin`), or null. Not memoised here: it
 * depends on the training context, which lives outside the store (memoise in the component).
 */
export function getPendingSupplementCheckin(
  ctx: SupplementContext,
  now: number = Date.now(),
): PendingSupplementCheckin | null {
  return pendingSupplementCheckin(now, exposed().supplements, ctx);
}

export function subscribeStore(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** A consent turned on or off: every reader gets the new masked state, and the coach's view is rebuilt without (or with) it. */
let seenHealthVersion = healthVersion();
subscribeHealth(() => {
  // Changes that arrived while a feature was off or its consent unknown are written now if it is on.
  if (healthVersion() !== seenHealthVersion) {
    seenHealthVersion = healthVersion();
    persist();
  }
  emit();
  const uid = currentUid();
  if (uid) publishCoachShare(uid, state.conditions);
});

export function useStore(): StoreState {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, exposed);
}

export const uuid = (): string => crypto.randomUUID();

export function exerciseKind(ex: Exercise): ExerciseKind {
  return ex.kind ?? 'strength';
}
export function isStrengthExercise(ex: Exercise): boolean {
  return exerciseKind(ex) === 'strength';
}
export function isTimedExercise(ex: Exercise): boolean {
  return exerciseKind(ex) !== 'strength';
}
/**
 * Warm-up and cool-down are session markers — no sets to log (stretching,
 * rolling, mobility). A cool-down logged with minutes before it became a
 * marker keeps showing as a timed entry, so history stays intact.
 */
export function isMarkerExercise(ex: Exercise): boolean {
  const k = exerciseKind(ex);
  return k === 'warmup' || (k === 'cooldown' && ex.sets.length === 0);
}

// --- Set types & drops (design DS-1…DS-4, EQ-4) ----------------------------

export function sidesMode(ex: Pick<Exercise, 'name' | 'equipment'>): SidesMode {
  return resolveSidesMode(ex, sidesFor(ex.name), () => equipmentFor(ex));
}

export function perHandFactor(ex: Pick<Exercise, 'name' | 'equipment'>): number {
  return sidesMode(ex) === 'single' ? 1 : 2;
}

export function exerciseVolumeKg(ex: Exercise): number {
  // Assist (negative help) and band (estimate) loads never count as real
  // tonnage — they'd otherwise subtract from or inflate the total (Load-entry C).
  if (loadTypeFor(ex) !== 'weight') return 0;
  return ex.sets.reduce((v, s) => v + setVolumeKg(s), 0) * perHandFactor(ex);
}

// --- Supersets (design SS-1…SS-3) ------------------------------------------

/** Set the round count for a circuit — stored as plannedSets on each member,
 *  which is what groupRounds() reads. */
export function setCircuitRounds(workoutId: string, groupId: string, rounds: number): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const r = Math.max(1, Math.min(20, Math.round(rounds)));
  const next = w.exercises.map((e) =>
    (e.groupId ?? null) === groupId ? { ...e, plannedSets: r } : e,
  );
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

export function groupAsSuperset(workoutId: string, exerciseIds: string[]): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w || exerciseIds.length < 2) return;
  const gid = uuid();
  const next = w.exercises.map((e) => {
    const order = exerciseIds.indexOf(e.id);
    return order < 0 ? e : { ...e, groupId: gid, groupOrder: order };
  });
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

export function ungroupSuperset(workoutId: string, groupId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const next = w.exercises.map((e) =>
    e.groupId === groupId ? { ...e, groupId: null, groupOrder: null } : e,
  );
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

// --- Muscle groups (design MG-1…MG-5, EQ-4) --------------------------------

export interface ResolvedMuscles {
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
}

export function resolveMuscles(
  ex: Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'kind'>,
): ResolvedMuscles {
  // A named exercise in the catalog — BUILT-IN or CUSTOM — resolves from the
  // catalog, the source of truth, not from the muscles snapshotted onto the log
  // at add time. This is what lets a catalog change — the finer muscle split, or
  // editing a custom exercise's muscles — flow into every past session, the
  // muscles-worked readout and the trends with no per-log migration. The stored
  // primaryMuscle is trusted only for an ad-hoc exercise with no catalog entry.
  const info = (ex.kind ?? 'strength') === 'strength' ? muscleInfoByName(ex.name) : null;
  if (info && info.primary !== 'cardio') {
    return { primary: info.primary, secondary: info.secondary };
  }
  if (ex.primaryMuscle) {
    return {
      primary: ex.primaryMuscle as MuscleGroup,
      secondary: (ex.secondaryMuscles ?? []) as MuscleGroup[],
    };
  }
  return { primary: null, secondary: [] };
}

/** Per-muscle work in a workout, best-practice fractional set counting: the
 *  primary mover earns a full set, each secondary/synergist earns half
 *  (SECONDARY_SET_WEIGHT). `primary` flags whether the muscle was ever a direct
 *  target in the session, so the UI can tone it brass (primary) vs grey
 *  (secondary-only). Load volume (kg) and day inference stay primary-only —
 *  splitting tonnage across synergists double-counts, and half-credited
 *  synergists would make the day label noisy. */
export const SECONDARY_SET_WEIGHT = 0.5;

export interface MuscleWork {
  sets: number;
  primary: boolean;
}

export function muscleWorkInWorkout(w: Workout): Map<MuscleGroup, MuscleWork> {
  const m = new Map<MuscleGroup, MuscleWork>();
  const bump = (g: MuscleGroup, sets: number, isPrimary: boolean): void => {
    const cur = m.get(g) ?? { sets: 0, primary: false };
    cur.sets += sets;
    cur.primary = cur.primary || isPrimary;
    m.set(g, cur);
  };
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const n = e.sets.length;
    if (n === 0) continue;
    const { primary, secondary } = resolveMuscles(e);
    if (primary) bump(primary, n, true);
    for (const s of secondary) if (s !== primary) bump(s, n * SECONDARY_SET_WEIGHT, false);
  }
  return m;
}

/** Fractional set counts per muscle (see muscleWorkInWorkout). */
export function muscleSetsInWorkout(w: Workout): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  for (const [g, v] of muscleWorkInWorkout(w)) out.set(g, v.sets);
  return out;
}

/** Worked muscles for display: primary (direct) groups first, then
 *  secondary-only, each block ordered by set count. */
export function muscleWorkSorted(
  w: Workout,
): { muscle: MuscleGroup; sets: number; primary: boolean }[] {
  // Order muscles the way they were trained: first-worked first. Primaries lead,
  // secondaries follow, each block in training order (not by set count).
  const orderIdx = new Map<MuscleGroup, number>();
  let idx = 0;
  for (const e of [...w.exercises].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (!isStrengthExercise(e) || e.sets.length === 0) continue;
    const { primary, secondary } = resolveMuscles(e);
    for (const g of primary ? [primary, ...secondary] : secondary) {
      if (g && g !== 'cardio' && !orderIdx.has(g)) orderIdx.set(g, idx++);
    }
  }
  return [...muscleWorkInWorkout(w).entries()]
    .filter(([, v]) => v.sets > 0)
    .map(([muscle, v]) => ({ muscle, sets: v.sets, primary: v.primary }))
    .sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) ||
        (orderIdx.get(a.muscle) ?? 1e9) - (orderIdx.get(b.muscle) ?? 1e9),
    );
}

/**
 * A session's day read from the muscle GROUPS trained (Ex suggestions): one
 * group → that muscle, one split → Push/Pull/Legs, several across splits → the
 * groups listed, many → full body. Groups are ordered by the exercise trained
 * first, so the main lift leads. Used to name logged sessions in lists (program
 * sessions keep their own day name instead).
 */
export function workoutDayReadout(w: Workout): DayReadout | null {
  const order: MuscleGroup[] = [];
  const counts = new Map<MuscleGroup, number>();
  for (const e of [...w.exercises].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (!isStrengthExercise(e)) continue;
    const { primary } = resolveMuscles(e);
    if (!primary || primary === 'cardio') continue;
    if (!counts.has(primary)) order.push(primary);
    counts.set(primary, (counts.get(primary) ?? 0) + Math.max(1, e.sets.length));
  }
  return describeDay(order.map((m) => [m, counts.get(m) as number]));
}

/** Weekday (1=Mon…7=Sun) — the program's day-key convention. */
function programDay(ts: number): number {
  return ((new Date(ts).getDay() + 6) % 7) + 1;
}

/** Collapse the fine back sub-muscles to the coarse `back` family, so a program
 *  day that targets one back region still matches a session that trained
 *  another (they are the same "back" day). Everything else maps to itself. */
function muscleFamily(m: MuscleGroup): MuscleGroup {
  return m === 'lats' || m === 'traps' || m === 'lower_back' ? 'back' : m;
}

/** The set of primary muscle groups a session actually trained. */
function primaryMusclesOf(w: Workout): Set<MuscleGroup> {
  const s = new Set<MuscleGroup>();
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const { primary } = resolveMuscles(e);
    if (primary && primary !== 'cardio') s.add(primary);
  }
  return s;
}

interface CachedAssignment {
  program: {
    dayNames?: Record<string, string>;
    targetMuscles?: Record<string, MuscleGroup[]>;
    items?: { day: number }[];
  };
  week?: number;
}
function readAssignment(): CachedAssignment | null {
  try {
    return readProgramMemory<CachedAssignment>(); // memory only: the on-device copy is the sealed snapshot
  } catch {
    return null;
  }
}

/**
 * The program day name to title a logged session with, or null.
 *
 * A session started from the program carries its own `dayName` — used while it
 * still matches the muscles actually trained (else the muscle readout wins).
 * For the rest, we read the assigned program (cached from Today) and map the
 * session's weekday to that program day's name — so history reads in program
 * terms ("Legs 2") rather than a raw muscle set ("Legs"). Guards keep it honest:
 * only from roughly when the program began (bounded by its current week), and
 * only when the session's muscles overlap the program day's targets — so an old,
 * off-program session on the same weekday isn't mislabelled. Without a program
 * (or on weekdays it doesn't name) it returns null and the caller shows the
 * muscle readout.
 */
/** Weekday of a timestamp in program terms: Mon=1 … Sun=7. */
export function weekdayOf(ts: number): number {
  return programDay(ts);
}

/** Weekdays (1–7) the assigned program prescribes training on (items or target
 *  muscles). Empty when there is no cached program. Drives "missed" markers. */
export function prescribedTrainingDays(): Set<number> {
  const a = readAssignment();
  const set = new Set<number>();
  if (!a) return set;
  for (const it of a.program.items ?? []) set.add(it.day);
  for (const [k, v] of Object.entries(a.program.targetMuscles ?? {})) {
    if (Array.isArray(v) && v.length > 0) set.add(Number(k));
  }
  return set;
}

/** How many days back a "missed" marker is trustworthy — roughly since the
 *  program began (bounded by its current week), matching programDayNameFor. */
export function programLookbackDays(): number {
  const a = readAssignment();
  return a ? (a.week ?? 1) * 7 + 6 : 0;
}

/** The assigned program's day name for a weekday (1=Mon…7=Sun), or null. Used to
 *  name a missed gym day ("you skipped Legs 2"). */
export function programDayNameForWeekday(weekday: number): string | null {
  const a = readAssignment();
  return a?.program.dayNames?.[String(weekday)] ?? null;
}

export function programDayNameFor(w: Workout, workouts: Workout[]): string | null {
  // A session that carries its own day name (from the program, the builder, or
  // "save as a day") uses it — but only while it still matches what was actually
  // trained. If the trained muscles diverge from the day's intended targets
  // (e.g. the plan said Legs but you trained Back instead), drop the stale name
  // so the caller falls back to the muscle readout ("Back", not "Legs 2").
  if (w.dayName) {
    const intended = w.targetMuscles ?? [];
    if (intended.length > 0) {
      const trainedFam = new Set([...primaryMusclesOf(w)].map(muscleFamily));
      if (
        trainedFam.size > 0 &&
        !intended.some((m) => trainedFam.has(muscleFamily(m as MuscleGroup)))
      )
        return null;
    }
    return w.dayName;
  }
  const a = readAssignment();
  if (!a) return null;
  const day = programDay(w.startedAt);
  const name = a.program.dayNames?.[String(day)];
  if (!name) return null;
  const targets = a.program.targetMuscles?.[String(day)] ?? [];
  const hasItems = (a.program.items ?? []).some((i) => i.day === day);
  if (!hasItems && targets.length === 0) return null; // a rest day, not a session
  // Only from ~when the program appeared (its current week bounds how far back).
  const now = workouts.reduce((m, x) => Math.max(m, x.startedAt), w.startedAt);
  const weeks = Math.max(1, a.week ?? 1);
  const programStart = now - (weeks + 1) * 7 * 86400000;
  if (w.startedAt < programStart) return null;
  // When the day names its target muscles, require the session to have trained
  // at least one of them; a pure exercise day (no targets) is taken on trust.
  // Match on the coarse muscle family: a program day may list `back` (or a
  // specific sub-muscle like `lats`) while the logged session's primaries are
  // other back sub-muscles (`traps`, `lower_back`) — the same back day, so a
  // strict sub-muscle match would wrongly reject it (e.g. a "Back 2" day shown
  // as the raw "Pull" readout).
  if (targets.length > 0) {
    const trained = primaryMusclesOf(w);
    const trainedFam = new Set([...trained].map(muscleFamily));
    if (!targets.some((m) => trainedFam.has(muscleFamily(m)))) return null;
  }
  return name;
}

export function muscleVolumeKg(workouts: Workout[]): Map<MuscleGroup, number> {
  const m = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const { primary } = resolveMuscles(e);
      if (!primary) continue;
      m.set(primary, (m.get(primary) ?? 0) + exerciseVolumeKg(e));
    }
  }
  return m;
}

export function workoutEquipment(w: Workout): string[] {
  const out: string[] = [];
  for (const e of w.exercises)
    for (const id of equipmentFor(e)) if (!out.includes(id)) out.push(id);
  return out;
}

export function equipmentFor(ex: Pick<Exercise, 'name' | 'equipment'>): string[] {
  if (ex.equipment && ex.equipment.length > 0) return ex.equipment;
  const info = muscleInfoByName(ex.name);
  return info?.equipment ? [info.equipment] : [];
}

export function exerciseNeeds(name: string): string[] {
  const needle = name.trim().toLowerCase();
  const out: string[] = [];
  const info = muscleInfoByName(name);
  if (info?.equipment) out.push(info.equipment);
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (e.name.trim().toLowerCase() !== needle) continue;
      for (const id of e.equipment ?? []) if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function missingAtGym(gym: Gym | null | undefined, needs: string[]): string[] {
  if (!gym?.inventory || gym.inventory.length === 0) return [];
  return needs.filter((id) => !gym.inventory!.includes(id));
}

interface ExercisePlan {
  plannedSets?: number | null;
  plannedReps?: number | null;
  plannedDurationMin?: number | null;
  /** Program item id the exercise was started from (the trainer's target is looked up by it). */
  planItemId?: string;
  equipment?: string[];
  groupId?: string | null;
  groupOrder?: number | null;
  groupKind?: 'superset' | 'circuit' | null;
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
  /** Fine equipment (catalog ids) — e.g. the cardio machine picked. */
  equipmentItems?: string[];
  /** Warm-up marker only: exercises the block starts with (a program day's
   *  warm-up, or the auto session's proposal). */
  warmupItems?: WarmupItemDraft[];
  /** How the exercise is logged; omitted = the catalog default (exerciseProfile). */
  measure?: 'reps' | 'hold' | 'time';
}

// --- Firestore writes -------------------------------------------------------

function onWriteError(err: unknown): void {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    setState({
      syncStatus: 'failed',
      syncError: { status: 403, statusLine: 'Firestore write rejected (permission-denied)' },
    });
  }
  // Transient errors: Firestore retries automatically; nothing to do.
}

/** Readable totals stored beside a sealed workout: server aggregates (leaderboards, coach summaries) use them. */
export function workoutStats(
  w: Pick<Workout, 'exercises'> & Parameters<typeof workoutVolumeKg>[0],
): {
  volumeKg: number;
  sets: number;
} {
  return {
    volumeKg: workoutVolumeKg(w),
    sets: w.exercises.reduce(
      (n, e) => n + ((e.kind ?? 'strength') === 'strength' ? e.sets.length : 0),
      0,
    ),
  };
}

setMigrationEnricher((d) => ({ ...d, stats: workoutStats(d as unknown as Workout) }));

/**
 * Finished workouts whose write is still waiting for the encryption key (SPO-269): the write is parked in memory
 * and would be lost with the tab, and the next server snapshot would then drop the workout from this device.
 * The ids are kept in localStorage (never the data: that stays in the app state), per account, until the write
 * has been handed to Firestore's own offline queue; they are re-sent on the next start.
 */
const UNSENT_KEY = 'spotter.unsentWorkouts.v1';
function readUnsent(uid: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(UNSENT_KEY) ?? 'null') as {
      uid?: string;
      ids?: unknown;
    } | null;
    if (!raw || raw.uid !== uid || !Array.isArray(raw.ids)) return new Set();
    return new Set(raw.ids.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}
const unsentWorkouts = new Set<string>();
let unsentUid: string | null = null;
function saveUnsent(uid: string): void {
  try {
    if (unsentWorkouts.size === 0) localStorage.removeItem(UNSENT_KEY);
    else localStorage.setItem(UNSENT_KEY, JSON.stringify({ uid, ids: [...unsentWorkouts] }));
  } catch {
    /* storage full or blocked: the write still goes out in this session */
  }
}
function loadUnsent(uid: string): void {
  if (unsentUid !== uid) {
    unsentWorkouts.clear();
    unsentUid = uid;
  }
  for (const id of readUnsent(uid)) unsentWorkouts.add(id);
}
/** Re-sends the finished workouts whose write never reached Firestore's queue (idempotent upsert). */
function resendUnsentWorkouts(uid: string): void {
  loadUnsent(uid);
  for (const id of [...unsentWorkouts]) {
    const w = state.workouts.find((x) => x.id === id);
    if (w && w.finishedAt !== null) writeWorkoutDoc(w);
    else unsentWorkouts.delete(id);
  }
  saveUnsent(uid);
}

function writeWorkoutDoc(w: Workout): void {
  const uid = currentUid();
  if (!uid) return;
  loadUnsent(uid);
  unsentWorkouts.add(w.id);
  saveUnsent(uid);
  prepareWrite('workouts', { ...w, stats: workoutStats(w), updatedAt: Date.now() })
    .then((d) => {
      const sent = setDoc(doc(db, 'users', uid, 'workouts', w.id), d);
      // setDoc has taken the document into Firestore's persistent queue: it survives a reload from here on.
      unsentWorkouts.delete(w.id);
      saveUnsent(uid);
      return sent;
    })
    .catch(onWriteError);
}

/**
 * Workouts that are being built on this device and must NOT hit the backend yet
 * — a backfilled past session while its editor is open. (A live session doesn't
 * need to be listed here: it's kept local by its `finishedAt === null`.) The set
 * is in-memory, so after a reload a draft that was mid-edit falls back to normal
 * syncing — an acceptable edge for an interrupted backfill.
 */
const draftWorkouts = new Set<string>();
// Editing a past session (or a fresh backfill) is draft work: the original is
// snapshotted so exiting can revert it, and nothing is pushed to history until
// the athlete taps Save. A fresh backfill has no snapshot — exiting drops it.
const pastSnapshots = new Map<string, Workout>();

/** True while a workout is deliberately kept on this device only. */
function isLocalOnlyWorkout(w: Workout): boolean {
  return w.finishedAt === null || draftWorkouts.has(w.id);
}

function saveWorkout(id: string): void {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  // A session in progress (or an open backfill draft) is kept on this device
  // only — every change is saved to localStorage (via setState → persist), but
  // nothing is pushed to the backend until the workout is finished/committed.
  // Editing an already-finished, already-synced workout still syncs immediately.
  if (isLocalOnlyWorkout(w)) return;
  writeWorkoutDoc(w);
}
function deleteWorkoutDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'workouts', id)).catch(onWriteError);
}
function writeGymDoc(g: Gym): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('gyms', { ...g, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'gyms', g.id), d))
    .catch(onWriteError);
}
function writeBodyDoc(): void {
  const uid = currentUid();
  if (!uid) return;
  // JSON round-trip drops `undefined` (Firestore rejects it).
  const clean = JSON.parse(JSON.stringify({ ...state.bodyMetrics, updatedAt: Date.now() }));
  prepareWrite('body', clean)
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'body'), d))
    .catch(onWriteError);
}

function writeGoalsDoc(): void {
  const uid = currentUid();
  if (!uid) return;
  const clean = JSON.parse(JSON.stringify({ ...state.goals, updatedAt: Date.now() }));
  setDoc(doc(db, 'users', uid, 'meta', 'goals'), clean).catch(onWriteError);
}
function writeHomeDoc(): void {
  const uid = currentUid();
  if (!uid) return;
  const clean = JSON.parse(
    JSON.stringify({ ...state.home, updatedAt: state.home.updatedAt ?? Date.now() }),
  );
  setDoc(doc(db, 'users', uid, 'meta', 'home'), clean).catch(onWriteError);
}
function writeMasteryDoc(): void {
  const uid = currentUid();
  if (!uid) return;
  const clean = JSON.parse(
    JSON.stringify({ ...state.mastery, updatedAt: state.mastery.updatedAt ?? Date.now() }),
  );
  setDoc(doc(db, 'users', uid, 'meta', 'mastery'), clean).catch(onWriteError);
}
/**
 * The coach doc is written a few seconds after the last change, not on every
 * one: a chat message can touch it twice (usage counters, what Atlas learned),
 * and a conversation dozens of times — one write per burst instead. Flushed
 * when the page is hidden or closed, so nothing is lost.
 */
const COACH_WRITE_DELAY = 4000;
let coachTimer: ReturnType<typeof setTimeout> | null = null;
let coachFor: string | null = null;
/** Fields changed here and not yet written: only these go to the server, so a stale
 *  device touching a counter can never put an old temper back. */
const coachDirty = new Set<string>();
/** Newest `updatedAt` seen on the server copy; local edits always stamp above it, so a
 *  clock that runs behind (or a device in the future) cannot make an edit lose. */
let coachServerAt = 0;
function flushCoachDoc(): void {
  if (coachTimer) clearTimeout(coachTimer);
  coachTimer = null;
  const uid = currentUid();
  // Signed out or switched account meanwhile → that change belonged to the old one.
  if (!uid || uid !== coachFor) return;
  const full = JSON.parse(JSON.stringify(state.coach)) as Record<string, unknown>;
  const keys = [...coachDirty];
  coachDirty.clear();
  const clean: Record<string, unknown> = { updatedAt: full.updatedAt };
  for (const k of keys) if (k in full) clean[k] = full[k];
  setDoc(doc(db, 'users', uid, 'meta', 'coach'), clean, { merge: true }).catch(onWriteError);
}
function writeCoachDoc(): void {
  coachFor = currentUid();
  if (!coachFor) return;
  if (coachTimer) clearTimeout(coachTimer);
  coachTimer = setTimeout(flushCoachDoc, COACH_WRITE_DELAY);
}
if (typeof window !== 'undefined') {
  const flushIfPending = () => {
    if (coachTimer) flushCoachDoc();
  };
  window.addEventListener('pagehide', flushIfPending);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushIfPending();
  });
}
function deleteGymDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'gyms', id)).catch(onWriteError);
}

function sortWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => b.startedAt - a.startedAt);
}

export function mergeServerWorkoutsWithLocalDrafts(
  serverWorkouts: Workout[],
  localWorkouts: Workout[],
): Workout[] {
  const byId = new Set(serverWorkouts.map((w) => w.id));
  const localById = new Map(localWorkouts.map((w) => [w.id, w]));
  // For a session being actively edited as a draft, keep the local (edited)
  // version even though the server still has the original — otherwise a snapshot
  // arriving mid-edit would clobber unsaved changes.
  const merged = serverWorkouts.map((sw) =>
    draftWorkouts.has(sw.id) ? (localById.get(sw.id) ?? sw) : sw,
  );
  // A finished workout still waiting to reach Firestore's queue is kept too (SPO-269), or the snapshot would drop it.
  const localOnly = localWorkouts.filter(
    (w) => (isLocalOnlyWorkout(w) || unsentWorkouts.has(w.id)) && !byId.has(w.id),
  );
  return sortWorkouts([...merged, ...localOnly]);
}

export function mergeServerActivitiesWithLocalLive(
  serverActivities: Activity[],
  localActivities: Activity[],
): Activity[] {
  const byId = new Set(serverActivities.map((a) => a.id));
  const localLive = localActivities.filter((a) => a.finishedAt === null && !byId.has(a.id));
  return [...serverActivities, ...localLive].sort((a, b) => b.startedAt - a.startedAt);
}

function bumpPending(): SyncStatus {
  if (state.syncStatus === 'failed') return 'failed';
  return navigator.onLine ? 'pending' : 'offline';
}

/** Mirrors the 8h auto-finish rule locally (also runs offline). */
export function applyAutoFinish(): void {
  const now = Date.now();
  const changed: string[] = [];
  // A draft (no exercise yet) left open that long is just dropped — never a
  // finished, empty workout in history.
  const staleDrafts = new Set(
    state.workouts
      .filter(
        (w) =>
          w.finishedAt === null && w.exercises.length === 0 && w.startedAt + AUTO_FINISH_MS <= now,
      )
      .map((w) => w.id),
  );
  if (staleDrafts.size)
    setState({ workouts: state.workouts.filter((w) => !staleDrafts.has(w.id)) });
  const workouts = state.workouts.map((w) => {
    // A home set with no new set for HOME_IDLE_MS finishes itself at its last
    // set, keeping what was logged (not an "auto-closed" warning — it's expected).
    if (w.finishedAt === null && w.kind === 'home') {
      const lastAt = homeIdleFinishAt(w);
      if (lastAt + HOME_IDLE_MS <= now) {
        changed.push(w.id);
        return {
          ...w,
          finishedAt: Math.max(lastAt, w.startedAt + 60000),
          autoFinished: false,
          exercises: w.exercises.filter((e) => e.sets.length > 0),
        };
      }
      return w;
    }
    if (w.finishedAt === null && w.startedAt + AUTO_FINISH_MS <= now) {
      changed.push(w.id);
      return { ...w, finishedAt: w.startedAt + AUTO_FINISH_MS, autoFinished: true };
    }
    return w;
  });
  // An idle home set that never got a set is dropped, never saved empty.
  const emptyHome = new Set(
    workouts
      .filter((w) => changed.includes(w.id) && w.kind === 'home' && w.exercises.length === 0)
      .map((w) => w.id),
  );
  if (emptyHome.size) {
    setState({ workouts: workouts.filter((w) => !emptyHome.has(w.id)) });
    finishLiveSession();
    const rest = changed.filter((id) => !emptyHome.has(id));
    for (const id of rest) saveWorkout(id);
    return;
  }
  if (changed.length) {
    setState({ workouts, syncStatus: bumpPending() });
    for (const id of changed) saveWorkout(id);
    const done = state.workouts.find((w) => changed.includes(w.id));
    if (done) finishLiveSession();
  }
}

export function getOpenWorkout(): Workout | undefined {
  return state.workouts.find((w) => w.finishedAt === null);
}

/**
 * A live session only really starts with its first exercise (a lift, a
 * warm-up, cardio — anything). Until then it's a draft: the clock doesn't run,
 * the coach isn't told, and leaving it throws it away (there's nothing to
 * discard). Deleting every exercise turns it back into that draft.
 */
export function isSessionStarted(w: Pick<Workout, 'exercises'>): boolean {
  return w.exercises.length > 0;
}

/** Drop live sessions that never got an exercise (all, or all but `keepId`). */
export function pruneEmptyLiveWorkouts(keepId: string | null = null): void {
  const drop = state.workouts.filter(
    (w) => w.finishedAt === null && w.exercises.length === 0 && w.id !== keepId,
  );
  if (drop.length === 0) return;
  for (const w of drop) draftWorkouts.delete(w.id);
  const ids = new Set(drop.map((w) => w.id));
  setState({ workouts: state.workouts.filter((w) => !ids.has(w.id)) });
}

// ── Coached-athlete live presence (liveSessions/{uid}) ──────────────────────
// The athlete's own client mirrors an open workout to a small doc their coach
// can read in real time; cleared/finished when the workout ends.
let selfProfile: {
  trainerId: string | null;
  firstName?: string;
  lastName?: string;
  avatarExt?: string | null;
  /** The own profile doc has been read at least once. */
  loaded?: boolean;
} = { trainerId: null };
const trainerListeners = new Set<() => void>();
/** The athlete's human coach (uid), if they have one — reactive. */
export function useSelfTrainerId(): string | null {
  return useSyncExternalStore(
    (l) => {
      trainerListeners.add(l);
      return () => trainerListeners.delete(l);
    },
    () => selfProfile.trainerId,
  );
}
/**
 * Atlas's role follows the athlete's setup, never a switch: with a human coach
 * Atlas is always the extra coach; without one he is the main coach. null until
 * the own profile has loaded (so a slow load never flips the role by mistake).
 */
export function useSelfCoachRole(): 'main' | 'extra' | null {
  return useSyncExternalStore(
    (l) => {
      trainerListeners.add(l);
      return () => trainerListeners.delete(l);
    },
    () => (!selfProfile.loaded ? null : selfProfile.trainerId ? 'extra' : 'main'),
  );
}
const LIVE_HEARTBEAT_MS = 45000;
let lastLiveBeat = 0;
/**
 * ONE live-session writer. While the Coach backend is installed for this member, `coach/data/firestore/liveWriter.ts`
 * owns `liveSessions/{me}` (sealed shape, finished state, consent). This legacy presence-only writer (`startedAt`,
 * `updatedAt`, delete at finish) then stays silent, so the two never fight over the same document. Without the Coach
 * backend (flag off, signed out) it is the only writer, exactly as before.
 */
let legacyLiveWriter = true;
export function setLegacyLiveWriter(on: boolean): void {
  legacyLiveWriter = on;
}
export const legacyLiveWriterOn = (): boolean => legacyLiveWriter;

/** Mirror an open workout to the athlete's coach-visible liveSessions doc. */
export function writeLiveSession(w: Workout): void {
  if (!legacyLiveWriter) return;
  const uid = currentUid();
  if (!uid) return;
  const trainerId = selfProfile.trainerId;
  if (!trainerId) {
    deleteDoc(doc(db, 'liveSessions', uid)).catch(() => undefined); // no coach → no doc
    return;
  }
  // Only "a session is active" — nothing about its contents. The coach sees the
  // in-progress state on the strip / client page; the details appear from normal
  // history once the session is finished.
  const now = Date.now();
  lastLiveBeat = now;
  setDoc(doc(db, 'liveSessions', uid), {
    id: uid,
    trainerId,
    startedAt: w.startedAt,
    updatedAt: now,
  }).catch(onWriteError);
}
/** Mark the live session finished — kept briefly for the coach's "just
 *  finished" state, overwritten on the next start. */
export function finishLiveSession(): void {
  if (!legacyLiveWriter) return;
  const uid = currentUid();
  if (!uid) return;
  // Session ended — remove the active-session doc entirely.
  deleteDoc(doc(db, 'liveSessions', uid)).catch(() => undefined);
}
/** Heartbeat while a workout is open, so the coach can tell live from stale. */
function heartbeatLiveSession(): void {
  if (!legacyLiveWriter) return;
  const uid = currentUid();
  if (!uid || !selfProfile.trainerId) return;
  const open = state.workouts.find((w) => w.finishedAt === null);
  if (!open) return;
  const now = Date.now();
  if (now - lastLiveBeat < LIVE_HEARTBEAT_MS) return;
  lastLiveBeat = now;
  setDoc(doc(db, 'liveSessions', uid), { updatedAt: now }, { merge: true }).catch(() => undefined);
}

export function startWorkout(
  gymId: string | null = null,
  meta: Pick<Workout, 'dayName' | 'targetMuscles'> = {},
): Workout | null {
  // One live mode at a time — never start a workout while an activity or a
  // sleep is running.
  if ((state.activities ?? []).some((a) => a.finishedAt === null)) return null;
  if (liveSleep(state.sleeps)) return null;
  applyAutoFinish();
  // An earlier draft that never got an exercise is replaced, not closed.
  pruneEmptyLiveWorkouts(null);
  const now = Date.now();
  const closed: string[] = [];
  const workouts = state.workouts.map((w) => {
    if (w.finishedAt === null) {
      closed.push(w.id);
      return { ...w, finishedAt: now, autoFinished: true };
    }
    return w;
  });
  const workout: Workout = {
    id: uuid(),
    startedAt: now,
    finishedAt: null,
    autoFinished: false,
    gymId,
    dayName: meta.dayName ?? null,
    targetMuscles: meta.targetMuscles ?? [],
    exercises: [],
  };
  // The new session is local-only until it's finished (see saveWorkout); only
  // the sessions it just auto-closed (now finished) need syncing, so the chip
  // only goes "pending" when there actually are some.
  setState({
    workouts: sortWorkouts([workout, ...workouts]),
    syncStatus: closed.length > 0 ? bumpPending() : state.syncStatus,
  });
  for (const id of closed) saveWorkout(id);
  // The coach sees the session once it really starts (first exercise).
  return workout;
}

/**
 * Auto-pick the gym for a session with no explicit choice (e.g. the session
 * builder). Preference, most→least confident: a gym we're physically near right
 * now (from the cached location fix, so no permission prompt), else the gym we
 * train at most often lately, else our most recent gym, else the only gym we
 * have — else none. Pure and synchronous; safe to call at session start.
 */
export function pickSessionGym(): Gym | null {
  const gyms = state.gyms;
  if (gyms.length === 0) return null;
  if (gyms.length === 1) return gyms[0];

  // 1) Near a gym now, by the cached position (never prompts).
  const pos = readPosCache();
  if (pos) {
    let near: { g: Gym; d: number } | null = null;
    for (const g of gyms) {
      const d = haversineM(pos.lat, pos.lng, g.lat, g.lng);
      if (d <= g.radiusM + pos.accuracy && (!near || d < near.d)) near = { g, d };
    }
    if (near) return near.g;
  }

  // 2) The gym we usually train at — most frequent across recent finished
  //    workouts, most-recent as the tiebreak.
  const RECENT_MS = 90 * 24 * 60 * 60 * 1000;
  const since = Date.now() - RECENT_MS;
  const count = new Map<string, number>();
  let latest: { gymId: string; at: number } | null = null;
  for (const w of state.workouts) {
    if (w.finishedAt === null || !w.gymId) continue;
    if (!gyms.some((g) => g.id === w.gymId)) continue;
    if (w.startedAt >= since) count.set(w.gymId, (count.get(w.gymId) ?? 0) + 1);
    if (!latest || w.startedAt > latest.at) latest = { gymId: w.gymId, at: w.startedAt };
  }
  let best: { id: string; n: number } | null = null;
  for (const [id, n] of count) if (!best || n > best.n) best = { id, n };
  const chosenId = best?.id ?? latest?.gymId ?? null;
  return gyms.find((g) => g.id === chosenId) ?? null;
}

/**
 * Materialise a generated day (session builder) into a live workout: start it,
 * then add every planned exercise across the warm-up / main / cardio / cool-down
 * blocks with its planned sets, reps and muscles. Returns the live workout.
 */
/** Display name of a generated cardio block: the machine, or the treadmill's
 *  "incline walk" finisher. */
export function cardioBlockName(
  machine: string | null,
  inclineWalk: string,
  locale: LocaleId,
): string {
  if (!machine || machine === 'cardio-treadmill') return inclineWalk;
  const item = EQUIPMENT_CATALOG.find((e) => e.id === machine);
  return item ? localizedEquipName(item, locale) : inclineWalk;
}

export function startGeneratedDay(day: GeneratedDay, gymId: string | null = null): Workout | null {
  const tt = t();
  // Localised, muscle-based day name (matches how logged sessions read in
  // history) instead of the engine's English label.
  const readout = describeDay(day.coverage.map((c) => [c.muscle, c.sets] as [MuscleGroup, number]));
  const dayName = readout ? dayReadoutLabel(readout, tt) : day.dayName;
  const w = startWorkout(gymId, { dayName, targetMuscles: day.targetMuscles });
  if (!w) return null;
  addGeneratedDayTo(w.id, day);
  return state.workouts.find((x) => x.id === w.id) ?? w;
}

/** Add a generated day's blocks (warm-up → lifts → cardio → cool-down) to a workout. */
export function addGeneratedDayTo(workoutId: string, day: GeneratedDay): void {
  const tt = t();
  // Real lifts keep their canonical (English) catalog name — localised on display
  // via ExerciseName; the generic warm-up/cardio/cool-down blocks are stored in
  // the active language.
  const storedName = (ex: GeneratedDay['warmup'][number]): string =>
    ex.kind === 'warmup'
      ? ex.warmupItems?.length
        ? tt.exerciseKindNames.warmup
        : tt.sbWarmupName
      : ex.kind === 'cardio'
        ? cardioBlockName(ex.equipmentItems?.[0] ?? null, tt.sbCardioName, getLocale())
        : ex.kind === 'cooldown'
          ? tt.sbCooldownName
          : ex.name;
  for (const ex of [...day.warmup, ...day.main, ...day.cardio, ...day.cooldown]) {
    addExercise(workoutId, storedName(ex), ex.kind, {
      plannedSets: ex.sets > 0 ? ex.sets : null,
      plannedReps: ex.repHigh > 0 ? ex.repHigh : null,
      plannedDurationMin: ex.durationMin ?? null,
      equipment: ex.equipment,
      primaryMuscle: ex.primary && ex.primary !== 'cardio' ? ex.primary : null,
      secondaryMuscles: ex.secondary,
      ...(ex.equipmentItems?.length ? { equipmentItems: ex.equipmentItems } : {}),
      ...(ex.kind === 'warmup' && ex.warmupItems?.length ? { warmupItems: ex.warmupItems } : {}),
    });
  }
}

/**
 * Save a generated day as a repeating program day (session builder → "Save as a
 * day"). Creates a one-training-day program placed on the given weekday (Mon=1…
 * Sun=7) — every other weekday is a rest day by absence — and activates it as
 * the member's own program. Returns 'active' when activation succeeded, else
 * 'draft' (the program is created but activation was rejected, e.g. before the
 * relaxed validation is deployed). Throws only if not signed in.
 */
export async function saveGeneratedDayAsProgram(
  day: GeneratedDay,
  weekday: number,
  name: string,
): Promise<{ status: 'active' | 'draft'; days: number[] }> {
  const dayName = name.trim() || day.dayName;
  const uid = currentUid();
  if (!uid) throw new Error('not signed in');
  const wd = String(weekday);
  const newItems = day.main.map((ex, idx) => ({
    id: uuid(),
    day: weekday,
    position: idx,
    name: ex.name,
    kind: ex.kind,
    sets: ex.sets,
    reps: ex.repHigh,
    durationMin: ex.durationMin ?? null,
    equipment: ex.equipment,
    groupId: null as string | null,
    groupOrder: null as number | null,
    dropLast: false,
  }));

  // Append to the athlete's OWN active program if there is one (so the wizard
  // can build a whole week, one day at a time); otherwise create a fresh
  // one-day program and self-activate it.
  interface OwnProgram {
    id: string;
    authorId: string;
    name: string;
    weeks: number;
    daysPerWeek: number;
    dayNames?: Record<string, string>;
    targetMuscles?: Record<string, string[]>;
    items: Array<Record<string, unknown> & { day: number }>;
  }
  let existing: OwnProgram | null = null;
  try {
    const mine = await callFn<{ assignment: { program: OwnProgram } | null }>('programMine');
    const prog = mine?.assignment?.program;
    if (prog && prog.authorId === uid) existing = prog;
  } catch {
    /* offline / no assignment — fall through to create */
  }

  if (existing) {
    const items = existing.items
      .filter((it) => Number(it.day) !== weekday)
      .concat(newItems as unknown as OwnProgram['items']);
    const days = [...new Set(items.map((it) => Number(it.day)))].sort((a, b) => a - b);
    const prog = {
      ...existing,
      dayNames: { ...(existing.dayNames ?? {}), [wd]: dayName },
      targetMuscles: { ...(existing.targetMuscles ?? {}), [wd]: day.targetMuscles },
      items,
      daysPerWeek: days.length,
      status: 'active' as const,
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'programs', existing.id), prog);
    return { status: 'active', days };
  }

  const id = uuid();
  const program = {
    id,
    authorId: uid,
    name: dayName,
    weeks: 0,
    daysPerWeek: 1,
    status: 'draft' as const,
    dayNames: { [wd]: dayName },
    targetMuscles: { [wd]: day.targetMuscles },
    items: newItems,
    updatedAt: Date.now(),
  };
  await setDoc(doc(db, 'programs', id), program);
  let status: 'active' | 'draft' = 'draft';
  try {
    await callFn('setProgramStatus', { id, status: 'active' });
    status = 'active';
  } catch {
    /* validation not yet deployed for this weekday — stays a draft */
  }
  return { status, days: [weekday] };
}

function patchWorkout(id: string, patch: Partial<Workout>): void {
  const workouts = state.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w));
  const w = workouts.find((x) => x.id === id);
  // Local-only edits (a live session or an open backfill draft) never touch the
  // backend, so they must not flip the sync chip to "pending".
  const local = !w || isLocalOnlyWorkout(w);
  setState({
    workouts: sortWorkouts(workouts),
    syncStatus: local ? state.syncStatus : bumpPending(),
  });
}

export function finishWorkout(id: string, at = Date.now()): void {
  if (!state.workouts.find((x) => x.id === id)) return;
  // Finishing settles the session: it's no longer a local-only draft and now
  // syncs (patchWorkout will mark pending, saveWorkout writes it).
  draftWorkouts.delete(id);
  patchWorkout(id, { finishedAt: at, autoFinished: false });
  saveWorkout(id);
  freezeWarmupMeasure(id);
  const done = state.workouts.find((x) => x.id === id);
  if (done) finishLiveSession();
}

export function updateWorkoutTimes(
  id: string,
  startedAt: number,
  finishedAt: number | null,
  autoFinished: boolean,
): void {
  patchWorkout(id, { startedAt, finishedAt, autoFinished });
  saveWorkout(id);
}

export function attachGymToWorkout(workoutId: string, gymId: string | null): void {
  if (!state.workouts.find((x) => x.id === workoutId)) return;
  patchWorkout(workoutId, { gymId });
  saveWorkout(workoutId);
}

export function reorderExercises(workoutId: string, orderedIds: string[]): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const byId = new Map(w.exercises.map((e) => [e.id, e]));
  const next = orderedIds
    .map((id, i) => {
      const e = byId.get(id);
      return e ? { ...e, position: i } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (next.length !== w.exercises.length) return;
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

export function deleteWorkout(id: string): void {
  const w = state.workouts.find((x) => x.id === id);
  // A never-synced workout (a live session in progress, or an uncommitted
  // backfill draft) lives only on this device — drop it locally; there's nothing
  // on the backend to delete and no pending sync to raise.
  const neverSynced = !w || isLocalOnlyWorkout(w);
  draftWorkouts.delete(id);
  setState({
    workouts: state.workouts.filter((x) => x.id !== id),
    syncStatus: neverSynced ? state.syncStatus : bumpPending(),
  });
  if (!neverSynced) deleteWorkoutDoc(id);
}

/**
 * Flush a backfilled draft to the backend — called when its editor closes, so a
 * past session logged in one sitting syncs once, at the end, instead of on every
 * set. A no-op for a live (still-unfinished) session and for a normally-synced
 * workout.
 */
export function commitWorkout(id: string): void {
  if (!draftWorkouts.has(id)) return;
  draftWorkouts.delete(id);
  const w = state.workouts.find((x) => x.id === id);
  if (!w || w.finishedAt === null) return;
  setState({ syncStatus: bumpPending() });
  writeWorkoutDoc(w);
}

/**
 * Open a past session for editing as a draft: snapshot the current version so a
 * later discard can revert it, and mark it local-only so edits don't sync until
 * Save. A no-op for a fresh backfill (already a draft, and it has no prior
 * version to snapshot).
 */
export function beginPastEdit(id: string): void {
  if (draftWorkouts.has(id)) return;
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  pastSnapshots.set(id, structuredClone(w));
  draftWorkouts.add(id);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Does a past-session draft differ from what it was when its editor opened?
 * Drives the Save button (nothing to save → disabled). A fresh backfill has no
 * snapshot to compare with, so it counts as changed.
 */
export function isPastDirty(id: string): boolean {
  const snap = pastSnapshots.get(id);
  if (!snap) return true;
  const cur = state.workouts.find((w) => w.id === id);
  return !cur || !deepEqual(snap, cur);
}

/** Save a past-session draft to history (commit the edits / the new backfill). */
export function savePastWorkout(id: string): void {
  pastSnapshots.delete(id);
  commitWorkout(id);
}

/**
 * Leave a past-session draft without saving: a fresh backfill is dropped
 * entirely; an edited existing session is reverted to the snapshot taken when
 * its editor opened. Nothing syncs — the backend still holds the original.
 */
export function discardPastWorkout(id: string): void {
  if (!draftWorkouts.has(id)) return;
  const snap = pastSnapshots.get(id);
  pastSnapshots.delete(id);
  if (snap) {
    draftWorkouts.delete(id);
    setState({ workouts: sortWorkouts(state.workouts.map((w) => (w.id === id ? snap : w))) });
  } else {
    deleteWorkout(id); // still a draft → dropped locally, nothing on the backend
  }
}

/** Delete a past session outright (the trash action), whether or not it's an
 *  open draft. An edited existing session deletes on the backend too; a fresh
 *  backfill is only ever local. */
export function deletePastWorkout(id: string): void {
  if (pastSnapshots.has(id)) draftWorkouts.delete(id); // existing → real delete
  pastSnapshots.delete(id);
  deleteWorkout(id);
}

export function addExercise(
  workoutId: string,
  name: string,
  kindIn: ExerciseKind = 'strength',
  plan: ExercisePlan = {},
): Exercise {
  // Pure cardio picked by name is a cardio entry (minutes), never a lift.
  const kind: ExerciseKind =
    kindIn === 'strength' && isCardioExerciseName(name) ? 'cardio' : kindIn;
  const w = state.workouts.find((x) => x.id === workoutId);
  const info = kind === 'strength' ? muscleInfoByName(name) : null;
  // The first exercise is what starts a live session: the clock runs from now.
  const starting = !!w && w.finishedAt === null && w.exercises.length === 0;
  if (starting) patchWorkout(workoutId, { startedAt: Date.now() });
  const exercise: Exercise = {
    id: uuid(),
    name,
    kind,
    position: w ? w.exercises.length : 0,
    plannedSets: plan.plannedSets ?? null,
    plannedReps: plan.plannedReps ?? null,
    plannedDurationMin: plan.plannedDurationMin ?? null,
    ...(plan.planItemId ? { planItemId: plan.planItemId } : {}),
    equipment: plan.equipment ?? (info?.equipment ? [info.equipment] : []),
    groupId: plan.groupId ?? null,
    groupOrder: plan.groupOrder ?? null,
    groupKind: plan.groupKind ?? null,
    primaryMuscle: plan.primaryMuscle ?? (info && info.primary !== 'cardio' ? info.primary : null),
    secondaryMuscles: plan.secondaryMuscles ?? (info ? info.secondary : []),
    ...(plan.equipmentItems?.length ? { equipmentItems: plan.equipmentItems } : {}),
    // A timed hold (plank, side bridge…) starts on the stopwatch. Only NEW exercises get
    // this default — what is already logged keeps the way it was saved.
    ...(kind === 'strength' && (plan.measure ?? defaultMeasure(name)) !== 'reps'
      ? { measure: plan.measure ?? defaultMeasure(name) }
      : {}),
    // Adding a cool-down during a live session starts it: the rest clock
    // stops on its own (no separate "Start cool-down" step).
    ...((kind === 'cooldown' || kind === 'warmup') && w?.finishedAt === null
      ? { markerAt: Date.now() }
      : {}),
    sets: [],
  };
  if (kind === 'warmup' && plan.warmupItems?.length) {
    const now = Date.now();
    const items = plan.warmupItems
      .map((d) => newWarmupItem({ ...d, done: false }, now))
      .filter((i): i is WarmupItem => i !== null);
    if (items.length) exercise.warmupItems = items;
  }
  patchWorkout(workoutId, { exercises: [...(w?.exercises ?? []), exercise] });
  saveWorkout(workoutId);
  if (starting) {
    const live = state.workouts.find((x) => x.id === workoutId);
    if (live) writeLiveSession(live);
  }
  return exercise;
}

/**
 * Switch the machine a cardio exercise is done on: swaps the cardio catalog id
 * in its fine equipment (keeping anything else picked) and renames it, so the
 * card, history and calorie maths all follow the new machine. null = no machine.
 */
export function setCardioMachine(
  workoutId: string,
  exerciseId: string,
  machineId: string | null,
  name: string,
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w?.exercises.find((e) => e.id === exerciseId)) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => {
      if (e.id !== exerciseId) return e;
      const rest = (e.equipmentItems ?? []).filter((id) => !id.startsWith('cardio-'));
      return { ...e, name, equipmentItems: machineId ? [machineId, ...rest] : rest };
    }),
  });
  saveWorkout(workoutId);
}

export function renameExercise(workoutId: string, exerciseId: string, name: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w?.exercises.find((e) => e.id === exerciseId)) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, name } : e)),
  });
  saveWorkout(workoutId);
}

/**
 * Replace (substitute) an exercise in place: swap its identity — name, kind and
 * muscle/equipment tags — while keeping its logged sets. Muscles/equipment come
 * from the explicit meta if given, else from the catalogue for the new name.
 * Used by the "Replace" action (live session and day history alike).
 */
export function replaceExercise(
  workoutId: string,
  exerciseId: string,
  name: string,
  kind: ExerciseKind,
  meta?: {
    primaryMuscle?: MuscleGroup | null;
    secondaryMuscles?: MuscleGroup[];
    equipment?: string[];
  },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const info = muscleInfoByName(name);
  const primaryMuscle =
    meta?.primaryMuscle ?? (info && info.primary !== 'cardio' ? info.primary : null);
  const secondaryMuscles = meta?.secondaryMuscles ?? info?.secondary ?? [];
  const equipment = meta?.equipment ?? (info?.equipment ? [info.equipment] : []);
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId
        ? { ...e, name: name.trim(), kind, primaryMuscle, secondaryMuscles, equipment }
        : e,
    ),
  });
  saveWorkout(workoutId);
}

export function deleteExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const exercises = w.exercises.filter((e) => e.id !== exerciseId);
  // Removing the last exercise of a live session turns it back into a draft:
  // the clock resets and waits for the next first exercise.
  const backToDraft = w.finishedAt === null && exercises.length === 0;
  patchWorkout(workoutId, backToDraft ? { exercises, startedAt: Date.now() } : { exercises });
  saveWorkout(workoutId);
  if (backToDraft) finishLiveSession();
}

export function upsertSet(
  workoutId: string,
  exerciseId: string,
  set: Omit<SetEntry, 'id' | 'position'> & { id?: string },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const existing = set.id ? ex.sets.find((s) => s.id === set.id) : undefined;
  const type: SetType = set.type ?? (set.isWarmup ? 'warmup' : 'working');
  const loggedAt = set.loggedAt ?? existing?.loggedAt ?? Date.now();
  // Rest before a NEW set = the real gap to the most-recently logged set
  // anywhere in the workout (so rest between exercise cards is captured too),
  // stamped once at log time. Edits keep their existing value; absurd gaps
  // (backfilled / resumed-next-day) are dropped.
  const restSec =
    set.restSec !== undefined
      ? set.restSec
      : existing
        ? (existing.restSec ?? null)
        : (() => {
            const prevMax = Math.max(
              0,
              ...ex.sets.map((s) => s.loggedAt ?? 0),
              ...w.exercises.flatMap((e) => e.sets.map((s) => s.loggedAt ?? 0)),
            );
            if (!prevMax || prevMax >= loggedAt) return null;
            const gap = Math.round((loggedAt - prevMax) / 1000);
            return gap > 0 && gap < 3 * 3600 ? gap : null;
          })();
  const warmupManual = set.warmupManual ?? existing?.warmupManual;
  const full: SetEntry = {
    id: set.id ?? uuid(),
    reps: set.reps,
    weight: set.weight,
    isWarmup: type === 'warmup',
    ...(warmupManual ? { warmupManual: true } : {}),
    type,
    drops: type === 'drop' || type === 'reverse-drop' ? (set.drops ?? []) : [],
    durationMin: set.durationMin ?? null,
    distanceKm: set.distanceKm ?? null,
    calories: set.calories ?? null,
    rpe: set.rpe ?? null,
    ...(set.failure ? { failure: set.failure } : {}),
    ...(set.failure === 'auto' && set.failureWhy ? { failureWhy: set.failureWhy } : {}),
    ...(set.partials ? { partials: set.partials } : {}),
    ...(set.rpeAuto != null && set.rpe == null ? { rpeAuto: set.rpeAuto } : {}),
    ...((set.restTargetSec ?? existing?.restTargetSec) != null
      ? { restTargetSec: set.restTargetSec ?? existing?.restTargetSec }
      : {}),
    // Cardio machine readings — only written when present, so strength sets
    // stay lean.
    ...(set.speedKmh != null ? { speedKmh: set.speedKmh } : {}),
    ...(set.inclinePct != null ? { inclinePct: set.inclinePct } : {}),
    ...(set.watts != null ? { watts: set.watts } : {}),
    ...(set.level != null ? { level: set.level } : {}),
    ...(set.floors != null ? { floors: set.floors } : {}),
    position: existing ? existing.position : ex.sets.length,
    // Rest timer (AC-2.1): stamp new sets; keep the original stamp on edits.
    loggedAt,
    restSec,
  };
  const next = existing ? ex.sets.map((s) => (s.id === full.id ? full : s)) : [...ex.sets, full];
  // Auto-tag leading light sets as warm-ups (respecting manual choices). Seed the
  // reference with last session's working weight so a light opener is flagged as
  // a warm-up straight away, not only once a heavier set follows it.
  const sets = autoWarmupSets(
    next,
    loadTypeFor(ex),
    historicalWorkingKg(ex.name, workoutId, liftVariant(w, ex)),
  );
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
  });
  saveWorkout(workoutId);
  freezeWarmupMeasure(workoutId);
}

/** Store the measured warm-up time on the marker once it is known (first
 *  strength set logged, or the workout finished). Lives in the sealed workout. */
export function freezeWarmupMeasure(workoutId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const ex = w.exercises.find((e) => e.kind === 'warmup' && e.sets.length === 0);
  if (!ex || typeof ex.warmupMeasuredSec === 'number') return;
  if (firstStrengthSetAt(w) === null && w.finishedAt === null) return;
  const sec = warmupMeasuredSec(ex, w, Date.now());
  if (sec === null) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === ex.id ? { ...e, warmupMeasuredSec: sec } : e)),
  });
  saveWorkout(workoutId);
}

export function addDropToSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
  drop: DropEntry,
  reverse = false,
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  const s = ex?.sets.find((x) => x.id === setId);
  if (!w || !ex || !s) return;
  const type: SetType =
    setTypeOf(s) === 'drop' || setTypeOf(s) === 'reverse-drop'
      ? setTypeOf(s)
      : reverse
        ? 'reverse-drop'
        : 'drop';
  upsertSet(workoutId, exerciseId, { ...s, id: s.id, type, drops: [...(s.drops ?? []), drop] });
}

/**
 * Duplicate set (AC-1): deep-copy the whole set object — including its type
 * and all drops — assign a fresh id + rest timestamp, splice it in right after
 * the source, and renumber positions. Returns the new set's id.
 */
export function duplicateSet(workoutId: string, exerciseId: string, setId: string): string | null {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  const src = ex?.sets.find((s) => s.id === setId);
  if (!w || !ex || !src) return null;
  const ordered = [...ex.sets].sort((a, b) => a.position - b.position);
  const srcIdx = ordered.findIndex((s) => s.id === setId);
  if (srcIdx < 0) return null;
  const dupAt = Date.now();
  const copy: SetEntry = {
    ...src,
    id: uuid(),
    drops: src.drops ? src.drops.map((d) => ({ ...d })) : [],
    // Rest for the copy = gap since the set it was duplicated from (AC-1.5).
    loggedAt: dupAt,
    restSec:
      src.loggedAt != null
        ? Math.min(3 * 3600, Math.max(0, Math.round((dupAt - src.loggedAt) / 1000)))
        : null,
  };
  ordered.splice(srcIdx + 1, 0, copy);
  const renumbered = ordered.map((s, i) => ({ ...s, position: i }));
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: renumbered } : e)),
  });
  saveWorkout(workoutId);
  return copy.id;
}

/**
 * Actual rest before a set: the real elapsed time between the two set logs
 * (AC-2.2). Matches the live "since last set" count-up. Null when a stamp is
 * missing.
 */
export function restMs(prevLoggedAt?: number | null, loggedAt?: number | null): number | null {
  if (!prevLoggedAt || !loggedAt) return null;
  return Math.max(0, loggedAt - prevLoggedAt);
}

// Estimated active seconds spent performing one set: a timed hold uses its own
// duration; a normal set is reps × ~3 s (≈1.5 s up + 1.5 s down) with a ~30 s
// floor so heavy low-rep sets still register. Mirrors the calorie work split.
const SET_SEC_PER_REP = 3;
const SET_MIN_WORK_SEC = 30;
export function setWorkSeconds(s: Pick<SetEntry, 'reps' | 'durationMin'>): number {
  if (s.durationMin && s.durationMin > 0) return s.durationMin * 60;
  return Math.max(SET_MIN_WORK_SEC, Math.max(0, s.reps) * SET_SEC_PER_REP);
}

/**
 * Rest BEFORE a set, in seconds: the gap since the previously logged set minus
 * the time spent performing THIS set. A set is logged once it's finished, so the
 * raw gap between two set logs is "rest after the previous set + this set's own
 * working time" — netting out the working time leaves the real rest. Derived
 * live from the saved `loggedAt` stamps, so it recomputes correctly for every
 * past session with no stored value and no data migration. Null when a stamp is
 * missing or the gap is implausible (backfilled / resumed next day).
 */
export function restBeforeSet(
  prevLoggedAt: number | null | undefined,
  set: SetEntry,
): number | null {
  if (!prevLoggedAt || !set.loggedAt) return null;
  const gap = Math.round((set.loggedAt - prevLoggedAt) / 1000);
  if (gap <= 0 || gap >= 3 * 3600) return null;
  return Math.max(0, gap - setWorkSeconds(set));
}

/** As restBeforeSet, but finds the previous logged set anywhere in the workout,
 *  so rest carried across exercise cards is captured too. A cool-down started
 *  in that gap means it wasn't rest at all — null. */
export function restBeforeSetInWorkout(w: Workout, set: SetEntry): number | null {
  if (!set.loggedAt) return null;
  let prev = 0;
  for (const e of w.exercises)
    for (const s of e.sets) {
      const ts = s.loggedAt ?? 0;
      if (ts > prev && ts < set.loggedAt) prev = ts;
    }
  if (prev <= 0) return null;
  const cooledDown = w.exercises.some(
    (e) => e.kind === 'cooldown' && e.markerAt && e.markerAt > prev && e.markerAt < set.loggedAt!,
  );
  return cooledDown ? null : restBeforeSet(prev, set);
}

/** Start (or undo) a cool-down marker: from `at` the rest clock stops until a
 *  set is logged again. */
export function setMarkerStarted(workoutId: string, exerciseId: string, at: number | null): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w?.exercises.find((e) => e.id === exerciseId)) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, markerAt: at } : e)),
  });
  saveWorkout(workoutId);
}

// --- Warm-up: a block, optionally holding exercises from the library ----------
// The marker stays a marker (no sets). `warmupItems` is an optional extra on it;
// everything without items reads as a plain generic warm-up. The retired
// `warmupDetailed` flag of earlier builds is stripped on the next write.

/** Apply `fn` to a warm-up marker of a workout; the marker's minutes follow the
 *  done items while it holds exercises (so summary / history have one number). */
function patchWarmup(
  workoutId: string,
  exerciseId: string,
  fn: (ex: Exercise) => Exercise,
): Exercise | null {
  const w = state.workouts.find((x) => x.id === workoutId);
  const cur = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !cur || cur.kind !== 'warmup' || cur.sets.length > 0) return null;
  let out: Exercise = { ...fn(cur) };
  delete (out as { warmupDetailed?: boolean }).warmupDetailed;
  const items = warmupItemsOf(out);
  if (items.length > 0) {
    const min = secToMinutes(warmupDoneSeconds(items));
    out = { ...out, plannedDurationMin: min > 0 ? min : null };
  } else {
    delete out.warmupItems;
  }
  const next = out;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? next : e)),
  });
  saveWorkout(workoutId);
  return next;
}

/** Minutes of a generic warm-up (null clears it). */
export function setWarmupMinutes(
  workoutId: string,
  exerciseId: string,
  minutes: number | null,
): void {
  patchWarmup(workoutId, exerciseId, (e) => ({
    ...e,
    plannedDurationMin: minutes && minutes > 0 ? Math.round(minutes) : null,
  }));
}

export interface WarmupItemDraft {
  name: string;
  exerciseId?: string;
  durationSec?: number;
  reps?: number;
  /** kg */
  weight?: number;
  done?: boolean;
}

function newWarmupItem(d: WarmupItemDraft, now: number): WarmupItem | null {
  const name = d.name.trim();
  if (!name) return null;
  const done = d.done === true;
  return {
    id: uuid(),
    name,
    ...(d.exerciseId ? { exerciseId: d.exerciseId } : {}),
    ...(d.durationSec && d.durationSec > 0 ? { durationSec: Math.round(d.durationSec) } : {}),
    ...(d.reps && d.reps > 0 ? { reps: Math.round(d.reps) } : {}),
    ...(positiveWeight(d.weight) ? { weight: positiveWeight(d.weight)! } : {}),
    done,
    ...(done ? { at: now } : {}),
  };
}

/** Add an exercise to the warm-up block. */
export function addWarmupItem(
  workoutId: string,
  exerciseId: string,
  draft: WarmupItemDraft,
): WarmupItem | null {
  const item = newWarmupItem(draft, Date.now());
  if (!item) return null;
  const r = patchWarmup(workoutId, exerciseId, (e) => ({
    ...e,
    warmupItems: [...warmupItemsOf(e), item],
  }));
  return r ? item : null;
}

/** Replace the whole list (used by "Repeat last warm-up"): fresh ids, nothing done. */
export function setWarmupItems(
  workoutId: string,
  exerciseId: string,
  drafts: readonly WarmupItemDraft[],
): void {
  const now = Date.now();
  const items = drafts
    .map((d) => newWarmupItem({ ...d, done: false }, now))
    .filter((i): i is WarmupItem => i !== null);
  patchWarmup(workoutId, exerciseId, (e) => ({ ...e, warmupItems: items }));
}

/** Edit an item's one set: reps (+ weight) or seconds (0 / null clears a value).
 *  `done` is not set here — only {@link logWarmupItem} logs an item. */
export function updateWarmupItem(
  workoutId: string,
  exerciseId: string,
  itemId: string,
  patch: Partial<Pick<WarmupItem, 'durationSec' | 'reps' | 'weight'>>,
): void {
  patchWarmup(workoutId, exerciseId, (e) => ({
    ...e,
    warmupItems: warmupItemsOf(e).map((i) => {
      if (i.id !== itemId) return i;
      const m = { ...i, ...patch };
      const next: WarmupItem = { id: i.id, name: i.name, done: i.done };
      if (i.exerciseId) next.exerciseId = i.exerciseId;
      if (m.durationSec && m.durationSec > 0) next.durationSec = Math.round(m.durationSec);
      if (m.reps && m.reps > 0) next.reps = Math.round(m.reps);
      if (positiveWeight(m.weight)) next.weight = positiveWeight(m.weight)!;
      if (i.at) next.at = i.at;
      return next;
    }),
  }));
}

/** Log an item: records its one set and marks it done (the Log button). */
export function logWarmupItem(
  workoutId: string,
  exerciseId: string,
  itemId: string,
  values: Partial<Pick<WarmupItem, 'durationSec' | 'reps' | 'weight'>>,
): void {
  updateWarmupItem(workoutId, exerciseId, itemId, values);
  patchWarmup(workoutId, exerciseId, (e) => ({
    ...e,
    warmupItems: warmupItemsOf(e).map((i) =>
      i.id === itemId ? { ...i, done: true, at: i.at ?? Date.now() } : i,
    ),
  }));
}

export function removeWarmupItem(workoutId: string, exerciseId: string, itemId: string): void {
  patchWarmup(workoutId, exerciseId, (e) => ({
    ...e,
    warmupItems: warmupItemsOf(e).filter((i) => i.id !== itemId),
  }));
}

/**
 * Is the session in its cool-down right now (so no rest clock)? Either the
 * athlete started a cool-down after their last set, or — on a planned day —
 * every planned exercise before a cool-down is complete and nothing after it
 * has been logged yet. Logging a set again (an extra exercise after the
 * cool-down) brings the rest clock back.
 */
export function cooldownInProgress(w: Workout): Exercise | null {
  let lastAt = 0;
  let lastEx: Exercise | null = null;
  for (const e of w.exercises)
    for (const s of e.sets)
      if ((s.loggedAt ?? 0) > lastAt) {
        lastAt = s.loggedAt ?? 0;
        lastEx = e;
      }
  const cooldowns = w.exercises.filter((e) => isMarkerExercise(e) && e.kind === 'cooldown');
  const started = cooldowns.find((c) => c.markerAt && c.markerAt >= lastAt);
  if (started) return started;
  if (!lastEx) return null;
  const lastPos = lastEx.position;
  for (const c of [...cooldowns].sort((a, b) => a.position - b.position)) {
    if (c.position < lastPos) continue;
    const before = w.exercises.filter((e) => !isMarkerExercise(e) && e.position < c.position);
    const allPlannedDone =
      before.length > 0 &&
      before.every((e) => (e.plannedSets ?? 0) > 0 && e.sets.length >= (e.plannedSets ?? 0));
    if (allPlannedDone) return c;
  }
  return null;
}

/**
 * One-time cleanup: the per-set `restSec` values stored by older builds were
 * computed incorrectly. Rest is now derived from real set timestamps at display
 * time, so clear every stored value. Idempotent — guarded by a local flag and
 * only rewrites workouts that actually carry stale rest.
 */
const REST_CLEARED_KEY = 'spotter.restCleared.v2';
export function clearStoredRest(): void {
  try {
    if (localStorage.getItem(REST_CLEARED_KEY)) return;
  } catch {
    /* private mode — attempt the cleanup anyway */
  }
  // Wait until workouts have actually loaded, so we don't set the flag on an
  // empty first snapshot and skip the real cleanup.
  if (state.workouts.length === 0) return;
  for (const w of state.workouts) {
    if (!w.exercises.some((e) => e.sets.some((s) => s.restSec != null))) continue;
    const exercises = w.exercises.map((e) =>
      e.sets.some((s) => s.restSec != null)
        ? { ...e, sets: e.sets.map((s) => (s.restSec != null ? { ...s, restSec: null } : s)) }
        : e,
    );
    patchWorkout(w.id, { exercises });
    saveWorkout(w.id);
  }
  try {
    localStorage.setItem(REST_CLEARED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function deleteSet(workoutId: string, exerciseId: string, setId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
    ),
  });
  saveWorkout(workoutId);
}

// --- Gyms & presence -------------------------------------------------------

export function upsertGym(gym: Omit<Gym, 'id'> & { id?: string }): Gym {
  const full: Gym = { id: gym.id ?? uuid(), ...gym };
  const exists = state.gyms.some((g) => g.id === full.id);
  setState({
    gyms: exists ? state.gyms.map((g) => (g.id === full.id ? full : g)) : [...state.gyms, full],
    syncStatus: bumpPending(),
  });
  writeGymDoc(full);
  return full;
}

export function toggleFavorite(id: string): void {
  const g = state.gyms.find((x) => x.id === id);
  if (!g) return;
  // An explicit choice only exists where it differs from what the log says; ticking
  // back to the automatic answer returns the gym to automatic.
  const auto = autoMainGymIds(state.workouts);
  const next = !isMainGym(g, auto);
  const { favorite: _old, ...rest } = g;
  void _old;
  upsertGym(next === auto.has(g.id) ? rest : { ...rest, favorite: next });
}

export function deleteGym(id: string): void {
  setState({ gyms: state.gyms.filter((g) => g.id !== id), syncStatus: bumpPending() });
  deleteGymDoc(id);
}

// --- Body metrics ----------------------------------------------------------

function commitBody(patch: Partial<BodyMetrics>): void {
  setState({ bodyMetrics: { ...state.bodyMetrics, ...patch }, syncStatus: bumpPending() });
  writeBodyDoc();
}

// --- Goals (My Fit) --------------------------------------------------------

function commitGoals(patch: Partial<FitGoals>): void {
  setState({ goals: { ...state.goals, ...patch }, syncStatus: bumpPending() });
  writeGoalsDoc();
}

export function setPhysiqueTarget(physique: PhysiqueTarget | undefined): void {
  commitGoals({ physique });
}

export function setBlockFocus(focus: BlockFocus | undefined): void {
  commitGoals({ focus });
}

export function resetGoals(): void {
  setState({ goals: EMPTY_GOALS, syncStatus: bumpPending() });
  writeGoalsDoc();
}

export function addWeight(weight: number, at: number): void {
  const entry: WeightEntry = { id: uuid(), at, weight };
  commitBody({ weights: [...state.bodyMetrics.weights, entry].sort((a, b) => a.at - b.at) });
}

export function editWeight(id: string, weight: number, at: number): void {
  commitBody({
    weights: state.bodyMetrics.weights
      .map((w) => (w.id === id ? { ...w, weight, at } : w))
      .sort((a, b) => a.at - b.at),
  });
}

export function removeWeight(id: string): void {
  commitBody({ weights: state.bodyMetrics.weights.filter((w) => w.id !== id) });
}

/** Height + optional composition (body fat, muscle, goal, waist/chest/hip). */
export function updateBodyMetrics(
  patch: Partial<Omit<BodyMetrics, 'weights' | 'updatedAt' | 'weighInDismissedDay'>>,
): void {
  commitBody(patch);
}

export function dismissWeighInToday(dayKey: string): void {
  commitBody({ weighInDismissedDay: dayKey });
}

// --- Rest / recovery periods (deloads, vacations) --------------------------
const REST_DAY_MS = 86_400_000;
/** Local-calendar day bucket: the index of the LOCAL Y-M-D of `ts`, so day
 *  boundaries follow the user's own midnight (not UTC). Consistent for
 *  workouts, rest periods and the date picker alike. */
export const dayKey = (ts: number): number => {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / REST_DAY_MS);
};

function writeRestPeriodDoc(r: RestPeriod): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('restPeriods', { ...r, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'restPeriods', r.id), d))
    .catch(onWriteError);
}
function deleteRestPeriodDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'restPeriods', id)).catch(onWriteError);
}

/** Start (or schedule) a rest period covering [startDay, endDay] inclusive. */
export function startRestPeriod(input: {
  mode: RestMode;
  startDay: number;
  endDay: number;
  note?: string | null;
  open?: boolean;
  illnessKind?: IllnessKind;
}): RestPeriod {
  const period: RestPeriod = {
    id: uuid(),
    startDay: Math.min(input.startDay, input.endDay),
    endDay: Math.max(input.startDay, input.endDay),
    mode: input.mode,
    createdAt: Date.now(),
    note: input.note ?? null,
    ...(input.open ? { open: true } : {}),
    ...(input.mode === 'illness' && input.illnessKind ? { illnessKind: input.illnessKind } : {}),
  };
  setState({ restPeriods: [period, ...state.restPeriods], syncStatus: bumpPending() });
  writeRestPeriodDoc(period);
  return period;
}

/** Interrupt a rest period: stop it from today on (the days already rested up to
 *  yesterday stay counted). If it hasn't started resting any earlier day yet
 *  (began today or is scheduled), remove it entirely. */
export function endRestPeriod(id: string, now: number = Date.now()): void {
  const today = dayKey(now);
  const period = state.restPeriods.find((r) => r.id === id);
  if (!period) return;
  if (period.startDay >= today) {
    deleteRestPeriod(id);
    return;
  }
  const list = state.restPeriods.map((r) =>
    r.id === id ? { ...r, endDay: today - 1, open: false } : r,
  );
  setState({ restPeriods: list, syncStatus: bumpPending() });
  const updated = list.find((r) => r.id === id);
  if (updated) writeRestPeriodDoc(updated);
}

export function deleteRestPeriod(id: string): void {
  setState({
    restPeriods: state.restPeriods.filter((r) => r.id !== id),
    syncStatus: bumpPending(),
  });
  deleteRestPeriodDoc(id);
}

/** How a new / edited period resolves an overlap with existing periods:
 *  'merge' folds them into one (same mode only), 'replace' cuts the new dates
 *  out of them (a period cut in two keeps both halves). */
export type RestOverlapChoice = 'merge' | 'replace';

export type RestSaveResult =
  | { ok: true; period: RestPeriod }
  | { ok: false; reason: RangeError | 'overlap' | 'merge-mode' | 'not-found' };

/** Input for logging / editing a period from the Health page (F03–F05, F09). */
export interface RestPeriodInput {
  mode: RestMode;
  startDay: number;
  endDay: number;
  open?: boolean;
  name?: string | null;
  /** What kind of illness (only meaningful for mode 'illness'). */
  illnessKind?: IllnessKind;
  /** Needed when the range overlaps another period; else the save is refused. */
  overlap?: RestOverlapChoice;
  /** Workouts inside the range to delete ("Remove the session", F04). */
  removeWorkoutIds?: string[];
  /** Scheduling full rest / active recovery (F03) may reach into the future;
   *  logging the past may not, and illness never does. */
  allowFuture?: boolean;
}

type ResolvedOverlap = {
  list: RestPeriod[];
  range: DayRange;
  changed: RestPeriod[];
  removed: string[];
};

/** Apply the overlap choice to the other periods; returns the final range and
 *  the list without the merged-away / replaced periods. */
function resolveRestOverlap(
  list: RestPeriod[],
  range: DayRange,
  mode: RestMode,
  selfId: string | null,
  choice: RestOverlapChoice | undefined,
  today: number,
): ResolvedOverlap | 'overlap' | 'merge-mode' {
  const others = overlappingPeriods(range, list, selfId, { mode, today });
  if (others.length === 0) return { list, range, changed: [], removed: [] };
  if (!choice) return 'overlap';
  if (choice === 'merge') {
    if (others.some((o) => o.mode !== mode)) return 'merge-mode';
    const ids = new Set(others.map((o) => o.id));
    return {
      list: list.filter((p) => !ids.has(p.id)),
      range: mergeRanges(range, others),
      changed: [],
      removed: [...ids],
    };
  }
  const changed: RestPeriod[] = [];
  const removed: string[] = [];
  let next = list;
  for (const o of others) {
    const pieces = cutOut(o, range);
    next = next.filter((p) => p.id !== o.id);
    if (pieces.length === 0) {
      removed.push(o.id);
      continue;
    }
    pieces.forEach((pc, i) => {
      const piece: RestPeriod = {
        ...o,
        id: i === 0 ? o.id : uuid(),
        startDay: pc.startDay,
        endDay: pc.endDay,
        open: pc.open === true,
      };
      changed.push(piece);
      next = [piece, ...next];
    });
  }
  return { list: next, range, changed, removed };
}

function normalizeRange(input: { startDay: number; endDay: number; open?: boolean }): DayRange {
  return input.open
    ? { startDay: input.startDay, endDay: Math.max(input.startDay, input.endDay), open: true }
    : { startDay: input.startDay, endDay: input.endDay };
}

function cleanName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  return n ? n.slice(0, 60) : null;
}

/**
 * Log a rest / illness period for any range — past (backfill), current or
 * scheduled — validating the range and resolving overlaps. Ids are client
 * UUIDs and every write is an upsert, so a replayed queue stays idempotent.
 */
export function logRestPeriod(input: RestPeriodInput, now: number = Date.now()): RestSaveResult {
  return saveRestPeriod(null, input, now);
}

/** Edit an existing period (F09): same validation and overlap rules. */
export function updateRestPeriod(
  id: string,
  input: RestPeriodInput,
  now: number = Date.now(),
): RestSaveResult {
  return saveRestPeriod(id, input, now);
}

function saveRestPeriod(id: string | null, input: RestPeriodInput, now: number): RestSaveResult {
  const today = dayKey(now);
  const existing = id ? state.restPeriods.find((r) => r.id === id) : null;
  if (id && !existing) return { ok: false, reason: 'not-found' };
  const range = normalizeRange(input);
  // Rest can be planned ahead; illness can't (it's logged on the day or later).
  const allowFuture = input.allowFuture === true && input.mode !== 'illness';
  const err = validateRange(range, { today, allowFuture });
  if (err) return { ok: false, reason: err };
  const res = resolveRestOverlap(state.restPeriods, range, input.mode, id, input.overlap, today);
  if (res === 'overlap' || res === 'merge-mode') return { ok: false, reason: res };
  const period: RestPeriod = {
    ...(existing ?? { id: uuid(), createdAt: now, note: null }),
    mode: input.mode,
    startDay: res.range.startDay,
    endDay: res.range.endDay,
    open: res.range.open === true,
    name: cleanName(input.name),
  };
  if (input.mode === 'illness' && input.illnessKind) period.illnessKind = input.illnessKind;
  else delete period.illnessKind;
  const list = [period, ...res.list.filter((r) => r.id !== period.id)];
  setState({ restPeriods: list, syncStatus: bumpPending() });
  writeRestPeriodDoc(period);
  for (const c of res.changed) writeRestPeriodDoc(c);
  for (const r of res.removed) deleteRestPeriodDoc(r);
  for (const wid of input.removeWorkoutIds ?? []) deleteWorkout(wid);
  return { ok: true, period };
}

/** The rest period covering `now`, if any (most recently created wins). */
export function activeRestPeriod(now: number = Date.now()): RestPeriod | null {
  const d = dayKey(now);
  return (
    [...state.restPeriods]
      .filter((r) => r.startDay <= d && (r.open === true || d <= r.endDay))
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

/** Every day key covered by any rest period. */
export function restDayKeys(
  periods: RestPeriod[] = state.restPeriods,
  now: number = Date.now(),
): Set<number> {
  const today = dayKey(now);
  const set = new Set<number>();
  for (const r of periods) {
    // Open-ended (illness) periods count as rest from startDay up to today.
    const end = r.open ? today : r.endDay;
    for (let d = r.startDay; d <= end; d++) set.add(d);
  }
  return set;
}

// --- Chronic conditions -----------------------------------------------------
let lastCoachShare = '';
// Publishes are serialised (B3): an older view can never overwrite a newer one, whatever the sealing latency.
let coachShareSeq = 0;
let coachShareChain: Promise<void> = Promise.resolve();
let coachShareRetry: ReturnType<typeof setTimeout> | null = null;
let coachShareFails = 0;
const COACH_SHARE_RETRY_MS = [2000, 5000, 15000, 60000] as const;

/** The memo of the last published coach view (and its retry) belongs to one account: the next one must publish its own. */
function resetCoachSharePublisher(): void {
  lastCoachShare = '';
  coachShareFails = 0;
  if (coachShareRetry) {
    clearTimeout(coachShareRetry);
    coachShareRetry = null;
  }
}
let coachShareUid: string | null = null;

/** Resolves when every coach view requested so far has been handed to Firestore (its offline queue; not the server ack). */
export function whenCoachSharePublished(): Promise<void> {
  return coachShareChain;
}

function coachShareFailed(uid: string, mine: number, err: unknown): void {
  if (mine !== coachShareSeq) return; // a newer view follows; this one is moot
  lastCoachShare = ''; // the next change republishes
  onWriteError(err);
  const delay = COACH_SHARE_RETRY_MS[Math.min(coachShareFails, COACH_SHARE_RETRY_MS.length - 1)];
  coachShareFails++;
  if (coachShareRetry) clearTimeout(coachShareRetry);
  coachShareRetry = setTimeout(() => {
    coachShareRetry = null;
    if (currentUid() === uid) publishCoachShare(uid, state.conditions);
  }, delay);
}

/** What the coach may see of the conditions (per-condition share), sealed like everything else. */
function publishCoachShare(uid: string, rawItems: readonly ChronicCondition[]): void {
  // Until the consent records are known nothing is published (a cold start must not blank what the coach sees), and a
  // feature without consent contributes nothing (SPO-290).
  if (!healthSnapshot().ready) return;
  const vis = exposed();
  // The general level Off is a MASTER off: a per-condition override (Full / Effects) never outlives it (B1).
  const items = isHealthOn('chronic') && state.conditionsShare !== 'off' ? rawItems : [];
  const nic = nicotineCoachView(vis.nicotine);
  const alc = alcoholCoachView(vis.alcohol);
  const facts = getSupplementTrainingFacts();
  const sup = supplementsCoachView(
    vis.supplements,
    {
      isTrainingDay: () => true,
      bodyWeightKg: facts.bodyWeightKg,
      usualTrainingStartMin: usualTrainingStartMin(facts.workoutStarts, Date.now()),
    },
    Date.now(),
  );
  const view = {
    ...coachView(items, state.conditionsShare),
    ...(nic ? { nicotine: nic } : {}),
    ...(alc ? { alcohol: alc } : {}),
    ...(sup ? { supplements: sup } : {}),
  };
  const json = JSON.stringify(view);
  if (json === lastCoachShare) return;
  lastCoachShare = json;
  if (coachShareRetry) {
    clearTimeout(coachShareRetry);
    coachShareRetry = null;
  }
  const mine = ++coachShareSeq;
  coachShareChain = coachShareChain.then(async () => {
    if (mine !== coachShareSeq) return; // superseded while queued: the newest one in the chain is the one that is sent
    try {
      const d = await prepareWrite('coachShare', { view, updatedAt: Date.now() });
      // issued in chain order; the server ack is not awaited (offline it only comes with the connection)
      setDoc(doc(db, 'users', uid, 'meta', 'coachShare'), d).then(
        () => void (coachShareFails = 0),
        (e) => coachShareFailed(uid, mine, e),
      );
    } catch (e) {
      coachShareFailed(uid, mine, e);
    }
  });
}

/** Sets the general default and republishes what the coach sees. */
export function setConditionsShare(v: GeneralShare): void {
  if (!isGeneralShare(v) || v === state.conditionsShare) return;
  setState({ conditionsShare: v, syncStatus: bumpPending() });
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('conditionPrefs', { conditionsShare: v, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'conditionPrefs'), d))
    .catch(onWriteError);
  publishCoachShare(uid, state.conditions);
}

function writeConditionDoc(c: ChronicCondition): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('conditions', { ...stripLegacyCondition(c), updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'conditions', c.id), d))
    .catch(onWriteError);
}

export function addCondition(
  input: Pick<ChronicCondition, 'key' | 'severity' | 'share'> &
    Partial<Pick<ChronicCondition, 'startedAt' | 'endsAt'>>,
): ChronicCondition | HealthWriteDenied {
  // No consent, nothing stored (SPO-290): an explicit refusal, never a made-up condition the caller could show.
  if (!isHealthOn('chronic')) return healthWriteDenied('chronic');
  const c: ChronicCondition = { ...input, id: uuid(), createdAt: Date.now() };
  setState({ conditions: [c, ...state.conditions], syncStatus: bumpPending() });
  writeConditionDoc(c);
  return c;
}

export function updateCondition(
  id: string,
  patch: Partial<Omit<ChronicCondition, 'id'>>,
): HealthWriteResult {
  if (!isHealthOn('chronic')) return healthWriteDenied('chronic');
  const cur = state.conditions.find((c) => c.id === id);
  if (!cur) return { ok: true };
  const next = { ...cur, ...patch };
  setState({
    conditions: state.conditions.map((c) => (c.id === id ? next : c)),
    syncStatus: bumpPending(),
  });
  writeConditionDoc(next);
  return { ok: true };
}

export function deleteCondition(id: string): void {
  deletedConditionIds.add(id);
  withForcedPersist('chronic', () =>
    setState({
      conditions: state.conditions.filter((c) => c.id !== id),
      syncStatus: bumpPending(),
    }),
  );
  const uid = currentUid();
  if (uid) deleteDoc(doc(db, 'users', uid, 'conditions', id)).catch(onWriteError);
}

// --- Cycle ------------------------------------------------------------------
// One sealed document, users/{uid}/meta/cycle: { enabled, settings, surfaces, updatedAt }.
// Typical values only. Deliberately NOT published to coachShare and not part of any Atlas facts.

function writeCycleDoc(c: CycleState): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('cycle', { ...c })
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'cycle'), d))
    .catch(onWriteError);
}

function commitCycle(
  patch: Partial<Pick<CycleState, 'enabled' | 'settings' | 'surfaces' | 'pendingDate' | 'starts'>>,
): boolean {
  if (!isHealthOn('cycle')) return false;
  const next: CycleState = {
    ...state.cycle,
    ...patch,
    updatedAt: Math.max(Date.now(), state.cycle.updatedAt + 1),
  };
  setState({ cycle: next, syncStatus: bumpPending() });
  writeCycleDoc(next);
  return true;
}

/** The current cycle document, outside React. */
export const getCycle = (): CycleState => exposed().cycle;

/** First setup / Save in settings: turns the feature on with these typical values. */
export function saveCycleSettings(input: CycleSettings): HealthWriteResult {
  if (!isHealthOn('cycle')) return healthWriteDenied('cycle');
  const settings = normalizeSettings(input);
  commitCycle({
    enabled: true,
    settings,
    pendingDate: false,
    starts: withStart(state.cycle.starts, settings.anchor),
  });
  return { ok: true };
}

/** "Update the date": only the anchor moves, the typical values stay. */
export function updateCycleAnchor(day: number): void {
  const cur = state.cycle.settings;
  if (!cur) return;
  commitCycle({
    settings: normalizeSettings({ ...cur, anchor: day }),
    pendingDate: false,
    starts: withStart(state.cycle.starts, day),
  });
}

/** The Cycle was paused by a condition: remember to ask for a new start date on resume. */
export function setCyclePendingDate(v: boolean): void {
  if (state.cycle.pendingDate !== v) commitCycle({ pendingDate: v });
}

export function setCycleSurface(surface: CycleSurface, on: boolean): void {
  commitCycle({ surfaces: { ...state.cycle.surfaces, [surface]: on } });
}

/**
 * Marks a pregnancy from the Cycle screen: creates the chronic condition right away (the
 * conditions store is the one source of truth; it switches the Cycle off). Private by default.
 */
export function markPregnancyFromCycle(startedAt: number): ChronicCondition | HealthWriteDenied {
  const now = Date.now();
  return addCondition({
    key: pregnancyKeyAt(startedAt, now),
    severity: 2,
    share: 'off',
    startedAt,
    endsAt: suggestedEnd('preg_first', startedAt),
  });
}

/** Marks menopause from the Cycle screen: a permanent chronic condition, private by default. */
export function markMenopauseFromCycle(): ChronicCondition | HealthWriteDenied {
  return addCondition({ key: MENOPAUSE_KEY, severity: 2, share: 'off' });
}

/** Full wipe: settings, the sealed Firestore document and the on-device copy. */
export function deleteCycleData(): void {
  wipedAt.cycle = Math.max(Date.now(), state.cycle?.updatedAt ?? 0);
  cycleCache.clear();
  state = { ...state, cycle: emptyCycleState(), syncStatus: bumpPending() };
  persist();
  emit();
  const uid = currentUid();
  if (uid) deleteDoc(doc(db, 'users', uid, 'meta', 'cycle')).catch(onWriteError);
}

// --- Nicotine ---------------------------------------------------------------
// One sealed document, users/{uid}/meta/nicotine: { products, settings, updatedAt }.
// No counters or logging: only the approximate usual amounts the user entered.

function writeNicotineDoc(n: NicotineState): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('nicotine', { ...n })
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'nicotine'), d))
    .catch(onWriteError);
}

function commitNicotine(patch: Partial<Pick<NicotineState, 'products' | 'settings'>>): boolean {
  if (!isHealthOn('nicotine')) return false;
  const next: NicotineState = {
    ...state.nicotine,
    ...patch,
    updatedAt: Math.max(Date.now(), state.nicotine.updatedAt + 1),
  };
  setState({ nicotine: next, syncStatus: bumpPending() });
  writeNicotineDoc(next);
  const uid = currentUid();
  if (uid) publishCoachShare(uid, state.conditions);
  return true;
}

/** The current nicotine document, outside React. */
export const getNicotine = (): NicotineState => exposed().nicotine;

/**
 * Adds a product, or replaces the one with the same id (Save in the product sheet).
 * Returns the cleaned product, or null if it was not valid.
 */
export function saveNicotineProduct(
  input: NicotineProduct,
): NicotineProduct | null | HealthWriteDenied {
  if (!isHealthOn('nicotine')) return healthWriteDenied('nicotine');
  const p = normalizeNicotineProduct(input);
  if (!p) return null;
  const has = state.nicotine.products.some((x) => x.id === p.id);
  commitNicotine({
    products: has
      ? state.nicotine.products.map((x) => (x.id === p.id ? p : x))
      : [...state.nicotine.products, p],
  });
  return p;
}

/** Changes some fields of one product (amount, strength, unit, active...). */
export function updateNicotineProduct(
  id: string,
  patch: Partial<Omit<NicotineProduct, 'id'>>,
): void {
  const cur = state.nicotine.products.find((x) => x.id === id);
  if (!cur) return;
  const next = normalizeNicotineProduct({ ...cur, ...patch });
  if (!next || JSON.stringify(next) === JSON.stringify(cur)) return;
  commitNicotine({ products: state.nicotine.products.map((x) => (x.id === id ? next : x)) });
}

/** Removes one product (the UI confirms first). */
export function removeNicotineProduct(id: string): void {
  if (!state.nicotine.products.some((x) => x.id === id)) return;
  commitNicotine({ products: state.nicotine.products.filter((x) => x.id !== id) });
}

function updateNicotineSettings(patch: Partial<NicotineSettings>): void {
  const cur = state.nicotine.settings;
  const settings = { ...cur, ...patch };
  if (JSON.stringify(settings) === JSON.stringify(cur)) return;
  commitNicotine({ settings });
}

/** Master switch: "Use nicotine in my numbers". */
export function setNicotineUseInCalculations(v: boolean): void {
  updateNicotineSettings({ useInCalculations: v });
}

/** One Advanced switch. */
export function setNicotineSurface(surface: NicotineSurface, on: boolean): void {
  updateNicotineSettings({ surfaces: { ...state.nicotine.settings.surfaces, [surface]: on } });
}

/** What a coach may see: off (default), effects or full. */
export function setNicotineSharing(v: NicotineSettings['sharing']): void {
  if (!isNicotineSharing(v)) return;
  updateNicotineSettings({ sharing: v });
}

/** Full wipe: products, settings, the sealed Firestore document and the on-device copy. */
export function deleteNicotineData(): void {
  wipedAt.nicotine = Math.max(Date.now(), state.nicotine?.updatedAt ?? 0);
  nicotineCache.clear();
  state = { ...state, nicotine: emptyNicotineState(), syncStatus: bumpPending() };
  persist();
  emit();
  const uid = currentUid();
  if (uid) {
    deleteDoc(doc(db, 'users', uid, 'meta', 'nicotine')).catch(onWriteError);
    publishCoachShare(uid, state.conditions);
  }
}

// --- Alcohol ----------------------------------------------------------------
// One sealed document, users/{uid}/meta/alcohol: { entries, settings, updatedAt }.
// No logging by day: only the approximate usual servings a week the user entered.

function writeAlcoholDoc(a: AlcoholState): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('alcohol', { ...a })
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'alcohol'), d))
    .catch(onWriteError);
}

function commitAlcohol(
  patch: Partial<Pick<AlcoholState, 'entries' | 'settings' | 'checkins'>>,
): void {
  if (!isHealthOn('alcohol')) return;
  const cur = state.alcohol ?? emptyAlcoholState();
  const next: AlcoholState = {
    ...cur,
    ...patch,
    updatedAt: Math.max(Date.now(), cur.updatedAt + 1),
  };
  setState({ alcohol: next, syncStatus: bumpPending() });
  writeAlcoholDoc(next);
  const uid = currentUid();
  if (uid) publishCoachShare(uid, state.conditions);
}

/** The current alcohol document, outside React. */
export const getAlcohol = (): AlcoholState => exposed().alcohol;

/**
 * Adds an entry, or replaces the one with the same id (Save in the drink sheet). Returns the
 * cleaned entry, or null if it was not valid (unknown drink: the user cannot create drinks).
 */
export function saveAlcoholEntry(input: AlcoholEntry): AlcoholEntry | null | HealthWriteDenied {
  if (!isHealthOn('alcohol')) return healthWriteDenied('alcohol');
  const e = normalizeAlcoholEntry(input);
  if (!e) return null;
  const cur = (state.alcohol ?? emptyAlcoholState()).entries;
  const has = cur.some((x) => x.id === e.id);
  commitAlcohol({ entries: has ? cur.map((x) => (x.id === e.id ? e : x)) : [...cur, e] });
  return e;
}

/** Removes one entry (the UI confirms first). */
export function removeAlcoholEntry(id: string): void {
  const cur = state.alcohol?.entries ?? [];
  if (!cur.some((x) => x.id === id)) return;
  commitAlcohol({ entries: cur.filter((x) => x.id !== id) });
}

function updateAlcoholSettings(patch: Partial<AlcoholSettings>): void {
  const cur = (state.alcohol ?? emptyAlcoholState()).settings;
  const settings = { ...cur, ...patch };
  if (JSON.stringify(settings) === JSON.stringify(cur)) return;
  commitAlcohol({ settings });
}

/** Master switch: "Use alcohol in my numbers". */
export function setAlcoholUseInCalculations(v: boolean): void {
  updateAlcoholSettings({ useInCalculations: v });
}

/** One per-surface switch. */
export function setAlcoholSurface(surface: AlcoholSurface, on: boolean): void {
  updateAlcoholSettings({
    surfaces: { ...(state.alcohol ?? emptyAlcoholState()).settings.surfaces, [surface]: on },
  });
}

/** What a coach may see: off (default) or effects only. */
export function setAlcoholSharing(v: AlcoholSettings['sharing']): void {
  if (!isAlcoholSharing(v)) return;
  updateAlcoholSettings({ sharing: v });
}

/** "Ask me on Today": the optional "did you drink?" check-in (off by default). */
export function setAlcoholCheckinsOn(v: boolean): void {
  updateAlcoholSettings({ checkinsOn: v });
}

/** "Usually drink on": weekdays 0 = Monday ... 6 = Sunday; empty = no pattern. */
export function setAlcoholUsualDays(days: readonly number[]): void {
  updateAlcoholSettings({ usualDays: cleanUsualDays(days) });
}

/** Manual region; null / undefined = detect again. */
export function setAlcoholRegionOverride(r: AlcoholRegion | null | undefined): void {
  const settings = { ...(state.alcohol ?? emptyAlcoholState()).settings };
  if (isAlcoholRegion(r)) settings.regionOverride = r;
  else delete settings.regionOverride;
  if (JSON.stringify(settings) === JSON.stringify(state.alcohol?.settings)) return;
  commitAlcohol({ settings });
}

export type AlcoholDayAnswer =
  { kind: 'none' } | { kind: 'usual' } | { kind: 'custom'; grams: number };

/**
 * "Did you drink on this day?": stores the answer for a drinking day ('YYYY-MM-DD', or any
 * day input). 'none' = no alcohol, 'usual' = the usual evening (weekly grams over the usual
 * days), 'custom' = a typed amount (0 or less counts as none). Keeps the last 60 days.
 * Returns false when nothing was stored (bad day, or 'usual' with no usual days / entries).
 */
export function answerAlcoholDay(day: string | number | Date, answer: AlcoholDayAnswer): boolean {
  const key = alcoholDayKey(day);
  const cur = state.alcohol ?? emptyAlcoholState();
  if (!key || !isHealthOn('alcohol')) return false; // false = nothing stored (never a fake "logged")
  let c: AlcoholCheckin;
  if (answer.kind === 'none') c = { drank: false };
  else if (answer.kind === 'custom') {
    if (!Number.isFinite(answer.grams)) return false;
    c = answer.grams > 0 ? { drank: true, grams: answer.grams } : { drank: false };
  } else {
    const grams = usualOccasionGrams(cur.entries, cur.settings.usualDays);
    if (grams <= 0) return false;
    c = {
      drank: true,
      grams,
      entryIds: cur.entries.filter((e) => e.active).map((e) => e.id),
    };
  }
  const next = normalizeCheckins({ ...cur.checkins, [key]: c });
  if (JSON.stringify(next) === JSON.stringify(cur.checkins ?? {})) return true;
  commitAlcohol({ checkins: next });
  return true;
}

/** Takes an answer back (the day becomes unanswered again). */
export function clearAlcoholDay(day: string | number | Date): void {
  const key = alcoholDayKey(day);
  const cur = state.alcohol?.checkins ?? {};
  if (!key || !(key in cur)) return;
  const next = { ...cur };
  delete next[key];
  commitAlcohol({ checkins: next });
}

/** Full wipe: entries, settings, the sealed Firestore document and the on-device copy. */
export function deleteAlcoholData(): void {
  wipedAt.alcohol = Math.max(Date.now(), state.alcohol?.updatedAt ?? 0);
  alcoholCache.clear();
  state = { ...state, alcohol: emptyAlcoholState(), syncStatus: bumpPending() };
  persist();
  emit();
  const uid = currentUid();
  if (uid) {
    deleteDoc(doc(db, 'users', uid, 'meta', 'alcohol')).catch(onWriteError);
    publishCoachShare(uid, state.conditions);
  }
}

// --- Supplements ------------------------------------------------------------
// One sealed document, users/{uid}/meta/supplements: { entries, settings, checkins, updatedAt }.
// No logging by time: the dose, timing and schedule the user picked, plus an optional day check-in.

function writeSupplementsDoc(a: SupplementState): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('supplements', { ...a })
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'supplements'), d))
    .catch(onWriteError);
}

function commitSupplements(
  patch: Partial<Pick<SupplementState, 'entries' | 'settings' | 'checkins'>>,
): void {
  if (!isHealthOn('supplements')) return;
  const cur = state.supplements ?? emptySupplementState();
  const next: SupplementState = {
    ...cur,
    ...patch,
    updatedAt: Math.max(Date.now(), cur.updatedAt + 1),
  };
  setState({ supplements: next, syncStatus: bumpPending() });
  writeSupplementsDoc(next);
  const uid = currentUid();
  if (uid) publishCoachShare(uid, state.conditions);
}

/**
 * Adds an entry, or replaces the one with the same id (Save in the supplement sheet). Returns
 * the cleaned entry, or null if it was not valid (unknown item: the user cannot create items).
 * `startedAt` is set once, when the entry is first saved, and kept on every later edit (the
 * caller's value is ignored for an id that already exists).
 */
export function saveSupplementEntry(
  input: SupplementEntry,
): SupplementEntry | null | HealthWriteDenied {
  if (!isHealthOn('supplements')) return healthWriteDenied('supplements');
  const e = normalizeSupplementEntry(input, Date.now());
  if (!e) return null;
  const cur = (state.supplements ?? emptySupplementState()).entries;
  const old = cur.find((x) => x.id === e.id);
  const saved: SupplementEntry = old ? { ...e, startedAt: old.startedAt } : e;
  commitSupplements({
    entries: old ? cur.map((x) => (x.id === saved.id ? saved : x)) : [...cur, saved],
  });
  return saved;
}

/** Removes one entry (the UI confirms first). */
export function removeSupplementEntry(id: string): void {
  const cur = state.supplements?.entries ?? [];
  if (!cur.some((x) => x.id === id)) return;
  commitSupplements({ entries: cur.filter((x) => x.id !== id) });
}

function updateSupplementSettings(patch: Partial<SupplementSettings>): void {
  const cur = (state.supplements ?? emptySupplementState()).settings;
  const settings = { ...cur, ...patch };
  if (JSON.stringify(settings) === JSON.stringify(cur)) return;
  commitSupplements({ settings });
}

/** Master switch: "Use supplements in my numbers". */
export function setSupplementUseInCalculations(v: boolean): void {
  updateSupplementSettings({ useInCalculations: v });
}

/** One per-surface switch. */
export function setSupplementSurface(surface: SupplementSurface, on: boolean): void {
  updateSupplementSettings({
    surfaces: { ...(state.supplements ?? emptySupplementState()).settings.surfaces, [surface]: on },
  });
}

/** What a coach may see: off (default), effects only, or full (names and doses). */
export function setSupplementSharing(v: SupplementSettings['sharing']): void {
  if (!isSupplementSharing(v)) return;
  updateSupplementSettings({ sharing: v });
}

/** "Ask on Today": the optional day check-in (off by default). */
export function setSupplementCheckinsOn(v: boolean): void {
  updateSupplementSettings({ checkinsOn: v });
}

export type SupplementDayAnswer =
  { kind: 'none' } | { kind: 'all' } | { kind: 'some'; entryIds: readonly string[] };

/**
 * "Did you take your supplements on this day?": stores the answer for a day ('YYYY-MM-DD', or
 * any day input). 'none' = nothing taken, 'all' = everything due that day (no ids kept: new
 * entries count too), 'some' = only those entries (ids of unknown entries are dropped; none
 * left = nothing taken). Keeps the last 60 days. Returns false when nothing was stored (bad day).
 */
export function answerSupplementDay(
  day: string | number | Date,
  answer: SupplementDayAnswer,
): boolean {
  const key = supplementDayKey(day);
  const cur = state.supplements ?? emptySupplementState();
  if (!key || !isHealthOn('supplements')) return false; // false = nothing stored (never a fake "logged")
  let raw: Record<string, unknown>;
  if (answer.kind === 'none') raw = { taken: false };
  else if (answer.kind === 'all') raw = { taken: true };
  else {
    const known = new Set(cur.entries.map((e) => e.id));
    raw = { taken: true, entryIds: answer.entryIds.filter((id) => known.has(id)) };
  }
  const next = normalizeSupplementCheckins({ ...cur.checkins, [key]: raw });
  if (JSON.stringify(next) === JSON.stringify(cur.checkins ?? {})) return true;
  commitSupplements({ checkins: next });
  return true;
}

/** Takes an answer back (the day becomes unanswered again). */
export function clearSupplementDay(day: string | number | Date): void {
  const key = supplementDayKey(day);
  const cur = state.supplements?.checkins ?? {};
  if (!key || !(key in cur)) return;
  const next = { ...cur };
  delete next[key];
  commitSupplements({ checkins: next });
}

/** Full wipe: entries, settings, check-ins, the sealed Firestore document and the on-device copy. */
export function deleteSupplementData(): void {
  wipedAt.supplements = Math.max(Date.now(), state.supplements?.updatedAt ?? 0);
  supplementsCache.clear();
  state = { ...state, supplements: emptySupplementState(), syncStatus: bumpPending() };
  persist();
  emit();
  const uid = currentUid();
  if (uid) {
    deleteDoc(doc(db, 'users', uid, 'meta', 'supplements')).catch(onWriteError);
    publishCoachShare(uid, state.conditions);
  }
}

/** The four on-device sharing levels (`meta/coachShare`) that can be forgotten without consent. */
export type ForgettableShare = 'conditions' | 'nicotine' | 'alcohol' | 'supplements';

/**
 * Stop sharing / withdrawing a consent: sets the RAW stored sharing level to Off, also while the feature's consent is off
 * (its setters refuse then, and a stored Full would come back with the next grant). Narrow on purpose: the only value it
 * can write is Off, there is no level argument, and nothing else of the feature is touched (no deletion). The write goes to
 * the sealed document and the device copy like any other, then the coach view is republished (without the feature).
 */
export function forgetShareLevel(kind: ForgettableShare): void {
  const uid = currentUid();
  if (kind === 'conditions') {
    // Per-condition overrides (Full / Effects) go to Off too, so a later grant brings nothing back (B1).
    const overridden = state.conditions.filter((c) => c.share === 'full' || c.share === 'effects');
    if (state.conditionsShare === 'off' && !overridden.length) return;
    const wasOff = state.conditionsShare === 'off';
    withForcedPersist('chronic', () =>
      setState({
        conditionsShare: 'off',
        conditions: state.conditions.map((c) =>
          overridden.includes(c) ? { ...c, share: 'off' as const } : c,
        ),
        syncStatus: bumpPending(),
      }),
    );
    for (const c of overridden) writeConditionDoc({ ...c, share: 'off' });
    if (uid && !wasOff) {
      prepareWrite('conditionPrefs', { conditionsShare: 'off', updatedAt: Date.now() })
        .then((d) => setDoc(doc(db, 'users', uid, 'meta', 'conditionPrefs'), d))
        .catch(onWriteError);
    }
  } else if (kind === 'nicotine') {
    const cur = state.nicotine;
    if (cur.settings.sharing === 'off') return;
    const next: NicotineState = {
      ...cur,
      settings: { ...cur.settings, sharing: 'off' },
      updatedAt: Math.max(Date.now(), cur.updatedAt + 1),
    };
    withForcedPersist('nicotine', () => setState({ nicotine: next, syncStatus: bumpPending() }));
    writeNicotineDoc(next);
  } else if (kind === 'alcohol') {
    const cur = state.alcohol ?? emptyAlcoholState();
    if (cur.settings.sharing === 'off') return;
    const next: AlcoholState = {
      ...cur,
      settings: { ...cur.settings, sharing: 'off' },
      updatedAt: Math.max(Date.now(), cur.updatedAt + 1),
    };
    withForcedPersist('alcohol', () => setState({ alcohol: next, syncStatus: bumpPending() }));
    writeAlcoholDoc(next);
  } else {
    const cur = state.supplements ?? emptySupplementState();
    if (cur.settings.sharing === 'off') return;
    const next: SupplementState = {
      ...cur,
      settings: { ...cur.settings, sharing: 'off' },
      updatedAt: Math.max(Date.now(), cur.updatedAt + 1),
    };
    withForcedPersist('supplements', () =>
      setState({ supplements: next, syncStatus: bumpPending() }),
    );
    writeSupplementsDoc(next);
  }
  if (uid) publishCoachShare(uid, state.conditions);
}

// --- Injuries & rehab -------------------------------------------------------
function writeInjuryDoc(i: Injury): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('injuries', { ...i, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'injuries', i.id), d))
    .catch(onWriteError);
}
function deleteInjuryDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'injuries', id)).catch(onWriteError);
}

/** Log a new injury with its starting rehab stage. */
export function startInjury(input: {
  reason: RehabReason;
  bodyPart: string;
  side?: InjurySide;
  muscles: MuscleGroup[];
  stage: RehabStageId;
  fullRestUntil?: number | null;
  note?: string | null;
  now?: number;
  /** The day it happened, when logged later (defaults to today). */
  startDay?: number;
}): Injury | HealthWriteDenied {
  // No consent, nothing stored (SPO-290): an explicit refusal, never a made-up injury the caller could show as logged.
  if (!isHealthOn('injuries')) return healthWriteDenied('injuries');
  const now = input.now ?? Date.now();
  const inj: Injury = {
    id: uuid(),
    reason: input.reason,
    bodyPart: input.bodyPart,
    side: input.side,
    muscles: [...input.muscles],
    stage: input.stage,
    // Backfill (Health › I got hurt → Still healing): the day it happened.
    startDay: Math.min(input.startDay ?? dayKey(now), dayKey(now)),
    createdAt: now,
    checkins: [],
    note: input.note ?? null,
    fullRestUntil: input.fullRestUntil ?? null,
    healedDay: null,
  };
  setState({ injuries: [inj, ...state.injuries], syncStatus: bumpPending() });
  writeInjuryDoc(inj);
  return inj;
}

function patchInjury(id: string, patch: (i: Injury) => Injury): void {
  if (!isHealthOn('injuries')) return;
  let updated: Injury | undefined;
  const list = state.injuries.map((i) => {
    if (i.id !== id) return i;
    updated = { ...patch(i), updatedAt: Date.now() };
    return updated;
  });
  if (!updated) return;
  setState({ injuries: list, syncStatus: bumpPending() });
  writeInjuryDoc(updated);
}

/** Edit which muscles an injury protects. */
export function setInjuryMuscles(id: string, muscles: MuscleGroup[]): void {
  patchInjury(id, (i) => ({ ...i, muscles: [...muscles] }));
}

/** Manually move to a stage (from the manage screen). */
export function setInjuryStage(id: string, stage: RehabStageId): void {
  patchInjury(id, (i) => ({ ...i, stage }));
}

/** Edit the clinician full-rest window (Stage 0). null clears it. */
export function setInjuryTimeframe(id: string, fullRestUntil: number | null): void {
  patchInjury(id, (i) => ({ ...i, fullRestUntil }));
}

/**
 * Log a post-session rehab check-in and apply the feel-driven progression
 * (advance / hold / regress). Returns the outcome so the UI can react.
 */
export function logRehabCheckin(
  id: string,
  feel: CheckinFeel,
  now: number = Date.now(),
): { outcome: 'ready' | 'hold' | 'regress'; stage: RehabStageId } | HealthWriteDenied | null {
  if (!isHealthOn('injuries')) return healthWriteDenied('injuries');
  const inj = state.injuries.find((i) => i.id === id);
  if (!inj) return null;
  const res = applyCheckin(inj, feel);
  const checkin: RehabCheckin = {
    id: uuid(),
    day: dayKey(now),
    at: now,
    feel,
    stage: inj.stage,
  };
  patchInjury(id, (i) => {
    const base = { ...i, checkins: [...i.checkins, checkin] };
    // Progression is offered, never automatic: a regress eases back a stage now;
    // a 'ready' only flags the offer; the user confirms via advanceInjury.
    if (res.outcome === 'regress') return { ...base, stage: res.stage, pendingAdvance: false };
    if (res.outcome === 'ready') return { ...base, pendingAdvance: true };
    return base;
  });
  return res;
}

/** Confirm the offered step up (from the check-in result or the Today banner). */
export function advanceInjury(id: string): void {
  patchInjury(id, (i) => ({ ...i, stage: nextStage(i.stage), pendingAdvance: false }));
}

/** Decline the offer and stay at the current stage a while longer. */
export function dismissAdvance(id: string): void {
  patchInjury(id, (i) => ({ ...i, pendingAdvance: false }));
}

/** Mark an injury healed — it becomes history, no longer shaping training. */
export function healInjury(id: string, now: number = Date.now()): void {
  patchInjury(id, (i) => ({ ...i, healedDay: dayKey(now) }));
}

/** Ids deleted in this session: a snapshot that was already decrypting must not bring them back (SPO-290 S3). */
const deletedInjuryIds = new Set<string>();
const deletedConditionIds = new Set<string>();
/** When each feature's data was last wiped: a mirrored document not newer than that is the old data, not new. */
const wipedAt: Partial<Record<HealthFeature, number>> = {};
const wipeFloor = (f: HealthFeature): number => wipedAt[f] ?? 0;

export function deleteInjury(id: string): void {
  deletedInjuryIds.add(id);
  // Deleting works while the feature is off, and must reach the on-device copy too.
  withForcedPersist('injuries', () =>
    setState({
      injuries: state.injuries.filter((i) => i.id !== id),
      syncStatus: bumpPending(),
    }),
  );
  deleteInjuryDoc(id);
}

function bodyPartMuscles(id: string): MuscleGroup[] | null {
  return findBodyPart(id)?.muscles ?? null;
}

export type InjurySaveResult =
  | { ok: true; injury: Injury }
  | { ok: false; reason: 'future' | 'healed-before-start' | 'not-found' }
  | HealthWriteDenied;

function validInjuryDays(
  startDay: number,
  healedDay: number | null,
  today: number,
): 'future' | 'healed-before-start' | null {
  if (startDay > today || (healedDay !== null && healedDay > today)) return 'future';
  if (healedDay !== null && healedDay < startDay) return 'healed-before-start';
  return null;
}

/**
 * Backfill a past injury that has already healed (F06 "Healed on …"): history
 * only — it never shapes training, so it goes straight to the 'return' stage.
 */
export function logPastInjury(
  input: { bodyPart: string; side: InjurySide; startDay: number; healedDay: number },
  now: number = Date.now(),
): InjurySaveResult {
  if (!isHealthOn('injuries')) return healthWriteDenied('injuries');
  const err = validInjuryDays(input.startDay, input.healedDay, dayKey(now));
  if (err) return { ok: false, reason: err };
  const inj: Injury = {
    id: uuid(),
    reason: 'injury',
    bodyPart: input.bodyPart,
    side: input.side,
    muscles: [...(bodyPartMuscles(input.bodyPart) ?? [])],
    stage: 'return',
    startDay: input.startDay,
    createdAt: now,
    checkins: [],
    note: null,
    fullRestUntil: null,
    healedDay: input.healedDay,
  };
  setState({ injuries: [inj, ...state.injuries], syncStatus: bumpPending() });
  writeInjuryDoc(inj);
  return { ok: true, injury: inj };
}

/** Edit a logged injury's place and dates from the Health history. */
export function updateInjury(
  id: string,
  patch: { bodyPart: string; side: InjurySide; startDay: number; healedDay: number | null },
  now: number = Date.now(),
): InjurySaveResult {
  if (!isHealthOn('injuries')) return healthWriteDenied('injuries');
  const inj = state.injuries.find((i) => i.id === id);
  if (!inj) return { ok: false, reason: 'not-found' };
  const err = validInjuryDays(patch.startDay, patch.healedDay, dayKey(now));
  if (err) return { ok: false, reason: err };
  const muscles =
    patch.bodyPart !== inj.bodyPart
      ? (bodyPartMuscles(patch.bodyPart) ?? inj.muscles)
      : inj.muscles;
  patchInjury(id, (i) => ({
    ...i,
    bodyPart: patch.bodyPart,
    side: patch.side,
    muscles: [...muscles],
    startDay: patch.startDay,
    healedDay: patch.healedDay,
  }));
  const updated = state.injuries.find((i) => i.id === id) ?? inj;
  return { ok: true, injury: updated };
}

/**
 * DISPLAY path (SPO-290): the most recently logged active (not-healed) injury, if any. Reads the MASKED view, so with
 * the Injuries consent off it is null and nothing that names an injury (Today banner, body-part title) is shown.
 * Anything that only RESTRICTS (load caps, streak protection) uses `getStoredLimits()` instead.
 */
export function activeInjury(): Injury | null {
  return selectActiveInjuries(exposed().injuries)[0] ?? null;
}

/** DISPLAY path: all active injuries, masked like `activeInjury` (empty while the Injuries consent is off). */
export function activeInjuryList(): Injury[] {
  return selectActiveInjuries(exposed().injuries);
}

/** The health features the main store holds (the food log has its own store, `nutrition/store.ts`). */
export type StoreHealthFeature = Exclude<HealthFeature, 'nutrition'>;

/**
 * RAW (unmasked) stored health state, for the data copy only (GDPR Art. 15 / 20: giving a person their own stored data
 * back to their own device is not processing for the feature, so it needs no consent). NEVER read this for anything shown.
 */
export function getStoredHealthForExport(): Pick<
  StoreState,
  'injuries' | 'conditions' | 'conditionsShare' | 'cycle' | 'nicotine' | 'alcohol' | 'supplements'
> {
  const { injuries, conditions, conditionsShare, cycle, nicotine, alcohol, supplements } = state;
  return { injuries, conditions, conditionsShare, cycle, nicotine, alcohol, supplements };
}

/** Whether anything of a feature is stored, whatever the consent says (the withdrawal flow offers to delete it). */
export function hasStoredHealthData(f: StoreHealthFeature): boolean {
  const s = getStoredHealthForExport();
  if (f === 'injuries') return s.injuries.length > 0;
  if (f === 'chronic') return s.conditions.length > 0;
  return (s[f]?.updatedAt ?? 0) > 0;
}

/** Deletes everything stored for a feature through the feature's own delete path (works while it is off). */
export function deleteStoredHealthData(f: StoreHealthFeature): void {
  switch (f) {
    case 'injuries':
      for (const i of [...state.injuries]) deleteInjury(i.id);
      return;
    case 'chronic': {
      wipedAt.chronic = Date.now();
      for (const c of [...state.conditions]) deleteCondition(c.id);
      // The sharing preference (meta/conditionPrefs) is part of the feature's data: it goes too, back to the default.
      withForcedPersist('chronic', () => {
        state = { ...state, conditionsShare: 'effects', syncStatus: bumpPending() };
        persist();
        emit();
      });
      const uid = currentUid();
      if (uid) {
        deleteDoc(doc(db, 'users', uid, 'meta', 'conditionPrefs')).catch(onWriteError);
        publishCoachShare(uid, state.conditions);
      }
      return;
    }
    case 'cycle':
      return deleteCycleData();
    case 'nicotine':
      return deleteNicotineData();
    case 'alcohol':
      return deleteAlcoholData();
    case 'supplements':
      return deleteSupplementData();
  }
}

// --- Activities (design feature 6: cardio & recovery + calories) -----------
function writeActivityDoc(a: Activity): void {
  const uid = currentUid();
  if (!uid) return;
  prepareWrite('activities', { ...a, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'activities', a.id), d))
    .catch(onWriteError);
}
function deleteActivityDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'activities', id)).catch(onWriteError);
}

/** The live (unfinished) activity, if one is running or paused. */
export function liveActivity(): Activity | null {
  return (state.activities ?? []).find((a) => a.finishedAt === null) ?? null;
}

/** Begin a live activity (design feature 6): a persisted, resumable timer that
 *  survives closing the page — mirrors how an open workout works. */
export function startActivity(type: string, category: ActivityCategory): Activity | null {
  // One live mode at a time — never start an activity while a workout or a
  // sleep is running.
  if ((state.workouts ?? []).some((w) => w.finishedAt === null)) return null;
  if (liveSleep(state.sleeps)) return null;
  const now = Date.now();
  const activity: Activity = {
    id: uuid(),
    type,
    category,
    startedAt: now,
    finishedAt: null,
    durationMin: 0,
    effort: 'moderate',
    runningSince: now,
    accumulatedMs: 0,
  };
  // A live activity is kept on this device only until it's finished (mirrors an
  // open workout); nothing is pushed to the backend here.
  setState({
    activities: [activity, ...state.activities].sort((a, b) => b.startedAt - a.startedAt),
    syncStatus: state.syncStatus,
  });
  return activity;
}

function patchActivity(id: string, patch: Partial<Activity>): void {
  const list = state.activities.map((a) => (a.id === id ? { ...a, ...patch } : a));
  const updated = list.find((a) => a.id === id);
  // In-progress activity edits stay local; only a finished activity syncs (so
  // the sync chip also stays settled while the timer runs).
  const local = !updated || updated.finishedAt === null;
  setState({ activities: list, syncStatus: local ? state.syncStatus : bumpPending() });
  if (updated && updated.finishedAt !== null) writeActivityDoc(updated);
}

/** Pause the live timer, banking the current running segment. */
export function pauseActivity(id: string, now: number = Date.now()): void {
  const a = state.activities.find((x) => x.id === id);
  if (!a || a.finishedAt !== null || !a.runningSince) return;
  patchActivity(id, {
    accumulatedMs: (a.accumulatedMs ?? 0) + Math.max(0, now - a.runningSince),
    runningSince: null,
  });
}

/** Resume a paused live timer. */
export function resumeActivity(id: string, now: number = Date.now()): void {
  const a = state.activities.find((x) => x.id === id);
  if (!a || a.finishedAt !== null || a.runningSince) return;
  patchActivity(id, { runningSince: now });
}

/** Edit live-activity fields (effort, distance, note). */
export function updateActivity(
  id: string,
  patch: Pick<Partial<Activity>, 'effort' | 'distanceKm' | 'note'>,
): void {
  patchActivity(id, patch);
}

/** Finish a live activity: freeze the clock, store duration & calories. */
export function finishActivity(
  id: string,
  input: { calories?: number | null } = {},
  now: number = Date.now(),
): Activity | null {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return null;
  const elapsedMs =
    (a.accumulatedMs ?? 0) + (a.runningSince ? Math.max(0, now - a.runningSince) : 0);
  const patch: Partial<Activity> = {
    finishedAt: now,
    runningSince: null,
    accumulatedMs: elapsedMs,
    durationMin: Math.round((elapsedMs / 60000) * 10) / 10,
    calories: input.calories ?? a.calories ?? null,
  };
  patchActivity(id, patch);
  return state.activities.find((x) => x.id === id) ?? null;
}

/** Persist a finished (backfilled) activity in one shot. */
export function logActivity(input: {
  type: string;
  category: ActivityCategory;
  startedAt: number;
  finishedAt: number | null;
  durationMin: number;
  calories?: number | null;
  distanceKm?: number | null;
  effort?: ActivityEffort;
  note?: string | null;
}): Activity {
  const activity: Activity = {
    id: uuid(),
    type: input.type,
    category: input.category,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMin: Math.round(input.durationMin * 10) / 10,
    calories: input.calories ?? null,
    distanceKm: input.distanceKm ?? null,
    effort: input.effort ?? 'moderate',
    note: input.note ?? null,
  };
  setState({
    activities: [activity, ...state.activities].sort((a, b) => b.startedAt - a.startedAt),
    syncStatus: bumpPending(),
  });
  writeActivityDoc(activity);
  return activity;
}

/** Edit a finished (logged) activity — time, duration, effort, distance and the
 *  recomputed calories in one patch. Calories are computed by the caller (which
 *  has the body weight + estimator) just like a backfill. */
export function editActivity(
  id: string,
  patch: {
    startedAt: number;
    finishedAt: number | null;
    durationMin: number;
    calories?: number | null;
    distanceKm?: number | null;
    effort?: ActivityEffort;
    note?: string | null;
  },
): void {
  patchActivity(id, {
    startedAt: patch.startedAt,
    finishedAt: patch.finishedAt,
    durationMin: Math.round(patch.durationMin * 10) / 10,
    calories: patch.calories ?? null,
    distanceKm: patch.distanceKm ?? null,
    ...(patch.effort ? { effort: patch.effort } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
  });
}

export function deleteActivity(id: string): void {
  const a = state.activities.find((x) => x.id === id);
  // A live (never-synced) activity is local-only — drop it without a backend
  // delete or a pending sync. A finished one deletes remotely as before.
  const neverSynced = !a || a.finishedAt === null;
  setState({
    activities: state.activities.filter((x) => x.id !== id),
    syncStatus: neverSynced ? state.syncStatus : bumpPending(),
  });
  if (!neverSynced) deleteActivityDoc(id);
}

/** Discard a live activity (semantic alias of delete, used by the timer page). */
export function discardActivity(id: string): void {
  deleteActivity(id);
}

// --- Weight unit (Load-entry B) --------------------------------------------
/** The account-wide weight unit (kg unless the user picked lb in their profile). */
export function globalWeightUnit(): DisplayUnit {
  return state.weightUnit;
}
/** Set the account-wide weight unit. Per-exercise overrides equal to it are
 *  pruned so they don't linger as no-ops. */
export function setGlobalWeightUnit(unit: DisplayUnit): void {
  const next: Record<string, DisplayUnit> = {};
  for (const [k, v] of Object.entries(state.exerciseUnits)) if (v !== unit) next[k] = v;
  setState({ weightUnit: unit, exerciseUnits: next });
}
/** The display unit for a lift/machine: its override, else the account default. */
export function exerciseUnit(name: string): DisplayUnit {
  return (state.exerciseUnits ?? {})[name.trim().toLowerCase()] ?? state.weightUnit;
}
/** Set (or clear, when it matches the account default) the unit for a machine. */
export function setExerciseUnit(name: string, unit: DisplayUnit): void {
  const key = name.trim().toLowerCase();
  const next = { ...(state.exerciseUnits ?? {}) };
  if (unit === state.weightUnit) delete next[key];
  else next[key] = unit;
  setState({ exerciseUnits: next });
}

// --- Rest timer ------------------------------------------------------------
/** The athlete's remembered rest target for a lift (seconds), if any. */
export function exerciseRestSec(name: string): number | null {
  return (state.exerciseRest ?? {})[name.trim().toLowerCase()] ?? null;
}
/** Pin a lift's rest target, or `null` to go back to the automatic one. */
export function setExerciseRestSec(name: string, sec: number | null): void {
  const next = { ...(state.exerciseRest ?? {}) };
  const key = name.trim().toLowerCase();
  if (sec === null) delete next[key];
  else next[key] = sec;
  setState({ exerciseRest: next });
}
export function restPrefs(): RestPrefs {
  return state.restPrefs ?? REST_PREFS_DEFAULT;
}
export function setRestPrefs(patch: Partial<RestPrefs>): void {
  setState({ restPrefs: { ...restPrefs(), ...patch } });
}

// --- Per-exercise load type (Load-entry C) ---------------------------------
/** How a lift is loaded: plain weight, an assisted machine (negative kg help),
 *  or a resistance band (colour → estimated kg). Derived from the exercise
 *  unless the user has pinned an override. */
export function loadTypeFor(ex: Pick<Exercise, 'name' | 'equipment'>): LoadType {
  const override = (state.exerciseLoadTypes ?? {})[ex.name.trim().toLowerCase()];
  if (override) return override;
  return deriveLoadType(ex.name, equipmentFor(ex));
}
/** Pin a load type for a lift; null restores the derived default. */
export function setExerciseLoadType(name: string, type: LoadType | null): void {
  const key = name.trim().toLowerCase();
  const next = { ...(state.exerciseLoadTypes ?? {}) };
  if (type === null) delete next[key];
  else next[key] = type;
  setState({ exerciseLoadTypes: next });
}

// --- Per-exercise sides / laterality (F4) ----------------------------------
/** Explicit "log both together" vs "log one side (counts ×2)" choice, or null
 *  when the user hasn't pinned one (the perHandFactor heuristic then decides). */
export function sidesFor(name: string): 'one' | 'both' | null {
  return (state.exerciseSides ?? {})[name.trim().toLowerCase()] ?? null;
}
/** Pin the sides choice for a lift; null restores the derived default. */
export function setExerciseSides(name: string, sides: 'one' | 'both' | null): void {
  const key = name.trim().toLowerCase();
  const next = { ...(state.exerciseSides ?? {}) };
  if (sides === null) delete next[key];
  else next[key] = sides;
  setState({ exerciseSides: next });
}

/** Self-reported training history for the Mastery Experience axis. */
export function setMasteryHistory(
  sinceYear: number | null,
  pattern: 'continuous' | 'occasional' | 'frequent' | null,
): void {
  setState({ mastery: { ...state.mastery, sinceYear, pattern, updatedAt: Date.now() } });
  writeMasteryDoc();
}

/** Record the rating last surfaced to the user (so the rank-up moment fires once). */
export function setMasterySeenRating(rating: number): void {
  setState({ mastery: { ...state.mastery, seenRating: rating, updatedAt: Date.now() } });
  writeMasteryDoc();
}

/** Atlas settings (temper, role, read mark…); synced to users/{uid}/meta/coach. */
export function setCoach(patch: Partial<CoachSettings>): void {
  const updatedAt = Math.max(Date.now(), coachServerAt + 1, (state.coach.updatedAt ?? 0) + 1);
  setState({ coach: { ...state.coach, ...patch, updatedAt } });
  for (const k of Object.keys(patch)) coachDirty.add(k);
  writeCoachDoc();
}

// ---------------------------------------------------------------------------
// Sleep — a live night mirrors the open-workout model (wake === null while in
// progress). Nights persist locally like activities; nothing here re-prompts
// geolocation.
// ---------------------------------------------------------------------------

/** Local YYYY-MM-DD for an epoch ms (the night's identity is its wake day). */
export function sleepDayId(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The live (in-progress) night, if any. */
export function liveSleep(list: SleepNight[] | null | undefined): SleepNight | null {
  return (list ?? []).find((n) => n.wake === null) ?? null;
}

/** Push one night to Firestore (durable fields only — the live pause bookkeeping
 *  awakeSince/lastSeen stays on the device). */
function writeSleepDoc(n: SleepNight): void {
  const uid = currentUid();
  if (!uid) return;
  const { awakeSince: _a, lastSeen: _l, ...durable } = n;
  void _a;
  void _l;
  prepareWrite('sleeps', { ...durable, updatedAt: Date.now() })
    .then((d) => setDoc(doc(db, 'users', uid, 'sleeps', n.id), d))
    .catch(onWriteError);
}
function deleteSleepDoc(id: string): void {
  pendingSleepDeletes.add(id);
  persistSleepTombstones();
  const uid = currentUid();
  if (!uid) return;
  // Keep the tombstone even if the delete fails: the snapshot handler retries
  // it and only forgets it once the server confirms the night is gone. Clearing
  // it here let a failed/late delete resurrect the discarded night.
  deleteDoc(doc(db, 'users', uid, 'sleeps', id)).catch(onWriteError);
}
/** Sync one night by id — write it if present, else delete the remote copy. */
function saveSleep(id: string): void {
  const n = state.sleeps.find((x) => x.id === id);
  if (n) writeSleepDoc(n);
  else deleteSleepDoc(id);
}
function saveLiveSleep(): void {
  const live = liveSleep(state.sleeps);
  if (live) writeSleepDoc(live);
}

/** Keep the server auto-start queue (sleepSchedules/{uid}) in step with the
 *  schedule + settings. The client — which knows the timezone — lays out the
 *  upcoming bedtimes as absolute instants, so the scheduled function stays pure
 *  UTC. Removed entirely when auto-log is off or nothing is scheduled. */
export function syncSleepAutoQueue(): void {
  const uid = currentUid();
  if (!uid) return;
  const ref = doc(db, 'sleepSchedules', uid);
  if (!state.sleepSettings.autoLog) {
    deleteDoc(ref).catch(onWriteError);
    return;
  }
  const upcoming = computeUpcomingNights(state.sleepSchedule, state.sleeps, Date.now(), 14);
  if (upcoming.length === 0) {
    deleteDoc(ref).catch(onWriteError);
    return;
  }
  setDoc(ref, {
    nextStartAt: upcoming[0].startAt,
    upcoming,
    updatedAt: Date.now(),
  }).catch(onWriteError);
}

/** Merge server nights with local, preserving a live night's on-device pause
 *  state and any local edit that is newer than the server copy. */
export function mergeServerSleepsWithLocal(
  server: SleepNight[],
  local: SleepNight[],
): SleepNight[] {
  const serverIds = new Set(server.map((n) => n.id));
  const out: SleepNight[] = server.map((sN) => {
    const l = local.find((n) => n.id === sN.id);
    if (!l) return sN;
    // Both still open: keep the device's live/pause state, adopt server bedtime
    // /autoWakeAt. If the server has finalized it (auto-end), take the server.
    if (sN.wake === null && l.wake === null) {
      return { ...sN, ...l, bedtime: sN.bedtime, autoWakeAt: sN.autoWakeAt ?? l.autoWakeAt };
    }
    // A newer local edit wins over the server copy (last-write-wins).
    if ((l.updatedAt ?? 0) > (sN.updatedAt ?? 0)) return l;
    return sN;
  });
  for (const l of local) {
    // Re-add a local-only night only if it was NEVER confirmed on the server
    // (a genuine pending upload). If it was synced and is now missing, it was
    // DELETED -- here or in another tab/device -- so drop it. This is what lets
    // a delete/discard win across every open tab, including a live night.
    if (!serverIds.has(l.id) && !syncedSleepIds.has(l.id)) out.push(l);
  }
  return out.sort((a, b) => b.bedtime - a.bedtime);
}

function pushLocalSleepDiffs(server: SleepNight[], merged: SleepNight[]): void {
  const byId = new Map(server.map((n) => [n.id, n]));
  for (const n of merged) {
    if (pendingSleepDeletes.has(n.id)) continue;
    const remote = byId.get(n.id);
    if (remote) {
      if ((n.updatedAt ?? 0) > (remote.updatedAt ?? 0)) writeSleepDoc(n); // genuine edit
    } else if (!syncedSleepIds.has(n.id)) {
      writeSleepDoc(n); // never-synced pending create; synced-then-missing = deleted -> skip
    }
  }
}

function applySleepSnapshot(serverSleeps: SleepNight[], fromCache = false): void {
  // Pick up tombstones set by sibling tabs (same origin) so a discard in one
  // tab is respected here and can't be resurrected by this tab's state.
  try {
    const raw = localStorage.getItem(SLEEP_TOMB_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) pendingSleepDeletes.add(id);
    const rawS = localStorage.getItem(SLEEP_SYNCED_KEY);
    if (rawS) for (const id of JSON.parse(rawS) as string[]) syncedSleepIds.add(id);
  } catch {
    /* ignore */
  }
  const serverIds = new Set(serverSleeps.map((n) => n.id));
  if (!fromCache) {
    let sChanged = false;
    for (const id of serverIds)
      if (!syncedSleepIds.has(id)) {
        syncedSleepIds.add(id);
        sChanged = true;
      }
    if (sChanged) persistSyncedSleepIds();
  }
  let tombChanged = false;
  for (const id of Array.from(pendingSleepDeletes)) {
    if (serverIds.has(id)) {
      // The night is still on the server: the delete did not take (lost race or
      // failure). Re-issue it; keep the tombstone so it stays hidden meanwhile.
      const uid = currentUid();
      if (uid) deleteDoc(doc(db, 'users', uid, 'sleeps', id)).catch(onWriteError);
    } else if (!fromCache) {
      // Only a server-authoritative snapshot may retire a tombstone. A local
      // (cache) snapshot that merely lacks the id could still be racing a write.
      pendingSleepDeletes.delete(id);
      tombChanged = true;
    }
  }
  if (tombChanged) persistSleepTombstones();
  const visibleServerSleeps = serverSleeps.filter((n) => !pendingSleepDeletes.has(n.id));
  const visibleLocalSleeps = state.sleeps.filter((n) => !pendingSleepDeletes.has(n.id));
  const sleeps = mergeServerSleepsWithLocal(visibleServerSleeps, visibleLocalSleeps);
  state = {
    ...state,
    sleeps,
  };
  backfillSleepKind();
  normalizeSleeps();
  pushLocalSleepDiffs(visibleServerSleeps, state.sleeps);
  persist();
  emit();
}

/**
 * Keep the sleep log honest after any sync: a finished night is dated by the
 * morning it ended (the server's auto-end can't compute local dates), and the
 * same sleep recorded twice (app + server + auto-fill + another device) is
 * collapsed to one.
 */
export function normalizeSleeps(now: number = Date.now()): void {
  const redated: SleepNight[] = [];
  const fixed = state.sleeps.map((n) => {
    if (n.wake !== null && n.date !== sleepDayId(n.wake)) {
      const r = { ...n, date: sleepDayId(n.wake), updatedAt: Date.now() };
      redated.push(r);
      return r;
    }
    return n;
  });
  const drop = new Set(duplicateSleepIds(fixed, now));
  if (redated.length === 0 && drop.size === 0) return;
  state = { ...state, sleeps: fixed.filter((n) => !drop.has(n.id)) };
  for (const n of redated) if (!drop.has(n.id)) writeSleepDoc(n);
  for (const id of drop) deleteSleepDoc(id);
}

/** Why a sleep can't be started right now (null = free). */
export function sleepStartBlock(): SleepBlock | null {
  return sleepBlockedBy(state);
}

/** Begin a live night (idempotent — returns the existing one if already asleep).
 *  `source` marks how it began ('live' by hand, 'auto' when the app starts it
 *  at your scheduled bedtime). */
export function startSleep(
  bedtime: number = Date.now(),
  source: SleepNight['source'] = 'live',
  autoWakeAt?: number,
): SleepNight | null {
  const existing = liveSleep(state.sleeps);
  if (existing) return existing;
  // One live mode at a time — never start a sleep while a workout, an
  // activity or a home set is running (a quiet no-op; callers show the reason).
  if (sleepBlockedBy(state)) return null;
  const night: SleepNight = {
    id: uuid(),
    // A night's identity is the morning it ends — set it from the start, so a
    // night the server closes (it can't recompute local dates) keeps the right day.
    date: sleepDayId(autoWakeAt ?? bedtime),
    bedtime,
    wake: null,
    source,
    ...(autoWakeAt != null ? { autoWakeAt } : {}),
    updatedAt: Date.now(),
  };
  setState({ sleeps: [night, ...state.sleeps] });
  writeSleepDoc(night);
  syncSleepAutoQueue();
  return night;
}

/** End the live night at `wakeAt`; its identity becomes the wake day. */
export function stopSleep(
  wakeAt: number = Date.now(),
  source?: SleepNight['source'],
): SleepNight | null {
  const live = liveSleep(state.sleeps);
  if (!live) return null;
  const wake = Math.max(wakeAt, live.bedtime + 60000);
  // Finalize any open awake interval so the night stores a plain awakeMs.
  const updated: SleepNight = {
    ...live,
    wake,
    date: sleepDayId(wake),
    source: source ?? live.source,
    awakeMs: awakeMsAt(live, wake),
    awakeSince: null,
    lastSeen: undefined,
    kind: live.kind ?? classifySleepKind(live.bedtime, wake, awakeMsAt(live, wake)),
    updatedAt: Date.now(),
  };
  setState({ sleeps: state.sleeps.map((n) => (n.id === live.id ? updated : n)) });
  writeSleepDoc(updated);
  syncSleepAutoQueue();
  return updated;
}

/** Discard the live night without logging it. */
export function cancelSleep(): void {
  const live = liveSleep(state.sleeps);
  if (!live) return;
  const skipDate = live.autoWakeAt ? sleepDayId(live.autoWakeAt) : live.date;
  const lastAutoNight = sleepDayId(live.bedtime + 12 * 60 * 60000);
  const skipped = Array.from(
    new Set([...(state.sleepSettings.skippedAutoSleepDates ?? []), skipDate]),
  ).slice(-14);
  setState({ sleeps: state.sleeps.filter((n) => n.id !== live.id) });
  if (state.sleepSettings.autoLog || live.source === 'auto' || live.autoWakeAt != null) {
    setState({
      sleepSettings: {
        ...state.sleepSettings,
        lastAutoNight,
        skippedAutoSleepDates: skipped,
      },
    });
  }
  deleteSleepDoc(live.id);
  syncSleepAutoQueue();
}

/** Patch the live night in place (no updatedAt bump — pause bookkeeping is
 *  local-only and shouldn't churn sync ordering). */
function patchLive(patch: Partial<SleepNight>): void {
  const live = liveSleep(state.sleeps);
  if (!live) return;
  setState({ sleeps: state.sleeps.map((n) => (n.id === live.id ? { ...n, ...patch } : n)) });
}

/** You left the sleep screen: open an awake interval (stop counting sleep). */
export function pauseSleep(at: number = Date.now()): void {
  const live = liveSleep(state.sleeps);
  if (!live || live.awakeSince != null) return;
  patchLive({ awakeSince: at, lastSeen: at });
}

/** You returned to the sleep screen: close the open interval at `at` and
 *  resume counting. */
export function resumeSleep(at: number = Date.now()): void {
  const live = liveSleep(state.sleeps);
  if (!live || live.awakeSince == null) return;
  patchLive({
    awakeMs: (live.awakeMs ?? 0) + Math.max(0, at - live.awakeSince),
    awakeSince: null,
    lastSeen: undefined,
  });
  saveLiveSleep();
}

/** Activity while off the sleep screen. If the app had gone idle past the
 *  threshold (you fell asleep, then stirred), bank that gap as sleep and open
 *  a fresh awake interval from now; otherwise just record the heartbeat. */
export function markSleepActivity(at: number = Date.now()): void {
  const live = liveSleep(state.sleeps);
  if (!live || live.awakeSince == null) return;
  const cut = live.lastSeen ?? live.awakeSince;
  if (at - cut >= SLEEP_IDLE_MS) {
    patchLive({
      awakeMs: (live.awakeMs ?? 0) + Math.max(0, cut - live.awakeSince),
      awakeSince: at,
      lastSeen: at,
    });
    saveLiveSleep();
  } else {
    patchLive({ lastSeen: at });
  }
}

/** No activity for SLEEP_IDLE_MS while paused (or the app was closed): commit
 *  the idle gap as sleep and resume counting from the last activity. */
export function reconcileSleep(at: number = Date.now()): void {
  const live = liveSleep(state.sleeps);
  if (!live || live.awakeSince == null) return;
  const cut = live.lastSeen ?? live.awakeSince;
  if (at - cut >= SLEEP_IDLE_MS) {
    patchLive({
      awakeMs: (live.awakeMs ?? 0) + Math.max(0, cut - live.awakeSince),
      awakeSince: null,
      lastSeen: undefined,
    });
    saveLiveSleep();
  }
}

/** Single entry point the pause controller calls. On the sleep screen → count.
 *  Off it → pause when counting, else treat as activity (heartbeat / re-pause
 *  after an idle stretch). */
export function noteSleepPresence(onSleepScreen: boolean, at: number = Date.now()): void {
  const live = liveSleep(state.sleeps);
  if (!live) return;
  if (onSleepScreen) {
    resumeSleep(at);
    return;
  }
  if (live.awakeSince == null) pauseSleep(at);
  else markSleepActivity(at);
}

/** Add or replace a finished night (backfill / auto / schedule). One night per date. */
export function logSleepNight(input: {
  date: string;
  bedtime: number;
  wake: number;
  quality?: SleepQuality | null;
  source: SleepNight['source'];
  kind?: 'sleep' | 'nap';
}): SleepNight {
  const night: SleepNight = { id: uuid(), updatedAt: Date.now(), ...input };
  if (!night.kind && night.wake != null)
    night.kind = classifySleepKind(night.bedtime, night.wake, night.awakeMs ?? 0);
  const kind = night.kind ?? 'sleep';
  // Replace only a same-day entry of the SAME kind — a day can hold both a
  // night and a nap.
  const withoutSameDay = state.sleeps.filter(
    (n) => !(n.wake !== null && n.date === input.date && sleepKindOf(n) === kind),
  );
  setState({
    sleeps: [night, ...withoutSameDay].sort((a, b) => b.bedtime - a.bedtime),
  });
  writeSleepDoc(night);
  syncSleepAutoQueue();
  return night;
}

/** Edit a night's times / quality / date. */
export function updateSleepNight(id: string, patch: Partial<SleepNight>): void {
  setState({
    sleeps: state.sleeps.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
  });
  saveSleep(id);
}

/** Remove a logged night. */
export function removeSleepNight(id: string): void {
  const gone = state.sleeps.find((n) => n.id === id);
  // Deleting an automatic night means "that wasn't a night" — don't auto-fill it
  // straight back the next minute.
  if (gone && gone.source === 'auto' && gone.wake !== null)
    setState({
      sleepSettings: {
        ...state.sleepSettings,
        skippedAutoSleepDates: Array.from(
          new Set([...(state.sleepSettings.skippedAutoSleepDates ?? []), gone.date]),
        ).slice(-14),
      },
    });
  setState({ sleeps: state.sleeps.filter((n) => n.id !== id) });
  deleteSleepDoc(id);
  syncSleepAutoQueue();
}

/** Set the optional morning quality rating. */
export function setSleepQuality(id: string, quality: SleepQuality | null): void {
  updateSleepNight(id, { quality });
}

/** Manually mark a logged entry as a night's sleep or a daytime nap. An explicit
 *  choice wins over the auto-classifier. */
export function setSleepKind(id: string, kind: 'sleep' | 'nap'): void {
  updateSleepNight(id, { kind });
}

/** One-time backfill: stamp `kind` on every finished night that predates the
 *  sleep/nap split, so the stored data reflects the classification (naps drop
 *  out of the nightly stats). Idempotent, guarded by a local flag; runs once
 *  sleeps have loaded. */
const SLEEP_KIND_KEY = 'spotter.sleepKind.v1';
export function backfillSleepKind(): void {
  try {
    if (localStorage.getItem(SLEEP_KIND_KEY)) return;
  } catch {
    /* private mode — attempt anyway */
  }
  if (state.sleeps.length === 0) return;
  const changed: string[] = [];
  const next = state.sleeps.map((n) => {
    if (n.kind || n.wake == null) return n;
    changed.push(n.id);
    return {
      ...n,
      kind: classifySleepKind(n.bedtime, n.wake, n.awakeMs ?? 0),
      updatedAt: Date.now(),
    };
  });
  if (changed.length > 0) {
    setState({ sleeps: next });
    const byId = new Map(next.map((n) => [n.id, n]));
    for (const id of changed) {
      const n = byId.get(id);
      if (n) writeSleepDoc(n);
    }
  }
  try {
    localStorage.setItem(SLEEP_KIND_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Replace the sleep schedule. */
export function setSleepSchedule(schedule: SleepSchedule): void {
  setState({ sleepSchedule: schedule });
  syncSleepAutoQueue();
}

/** Merge sleep settings. */
export function setSleepSettings(patch: Partial<SleepSettings>): void {
  setState({ sleepSettings: { ...state.sleepSettings, ...patch } });
  syncSleepAutoQueue();
}
/** Whether the Sides control makes sense for a lift — dumbbell / cable /
 *  kettlebell, single-limb machines, and one-arm/one-leg moves. Hidden for
 *  inherently bilateral lifts (a barbell squat). */
export function sidesEligible(ex: Pick<Exercise, 'name' | 'equipment'>): boolean {
  const eq = equipmentFor(ex);
  // Free-weight & cable work is inherently per-limb — always offer the choice.
  if (eq.includes('dumbbell') || eq.includes('cable') || eq.includes('kettlebell')) return true;
  const n = `${ex.name} ${canonicalExerciseName(ex.name)}`.toLowerCase();
  // Any explicit one/single-arm/leg or unilateral move, whatever the equipment.
  if (ONE_ARM_NAME.test(n)) return true;
  // Single-limb-capable machines: leg extension/curl/press, hip abd/adduction,
  // calf, glute work. Body-position words (seated/lying) are NOT signals — they
  // wrongly caught bilateral machines (seated row, lying t-bar row).
  if (eq.includes('machine') && /\bleg\b|abduct|adduct|kickback|\bcalf\b|glute/.test(n))
    return true;
  return false;
}
/** The band library for a gym, falling back to sensible defaults. */
export function bandLibraryFor(gym: Gym | null | undefined): readonly BandRung[] {
  return gym?.bandLibrary && gym.bandLibrary.length > 0 ? gym.bandLibrary : BAND_DEFAULTS;
}
/** Persist a gym's band library (colour → estimated kg). */
export function setGymBandLibrary(gymId: string, rungs: BandRung[]): void {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return;
  upsertGym({ ...g, bandLibrary: rungs });
}

/** Coarse EquipmentId per catalog item id — derives the gym `inventory` set
 *  (what the "available at your gym" filters read) from the fine picks. */
const ITEM_CLS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_CATALOG.map((e) => [e.id, e.cls as string]),
);

/** Coarse inventory (EquipmentId set) from fine catalog picks. */
function deriveInventory(items: string[]): string[] {
  return Array.from(new Set(items.map((id) => ITEM_CLS[id]).filter((c): c is string => !!c)));
}

/** Overlay a gym with its shared (crowdsourced) equipment, when we have it. */
function applyShared(gym: Gym): Gym {
  const key = gym.externalId;
  if (!key) return gym;
  const shared = state.sharedGyms[key];
  if (!shared) return gym;
  return {
    ...gym,
    equipmentItems: shared.equipmentItems,
    inventory: deriveInventory(shared.equipmentItems),
  };
}

// --- Shared gym inventory (crowdsourced entity; needs sharedGyms rules) -----
const sharedUnsub = new Map<string, Unsubscribe>();

/** Subscribe to a shared gym's inventory (deltas only; onSnapshot pushes just
 *  changes). Cached locally. On permission-denied (rules not deployed) or any
 *  error, silently unsubscribe — the per-user gym stays the source of truth. */
export function watchSharedGym(externalId: string): void {
  if (!externalId || sharedUnsub.has(externalId)) return;
  try {
    const unsub = onSnapshot(
      doc(db, 'sharedGyms', externalId),
      (snap) => {
        const data = snap.data() as Partial<SharedGym> | undefined;
        if (!data || !Array.isArray(data.equipmentItems)) return;
        const shared: SharedGym = {
          equipmentItems: data.equipmentItems,
          updatedAt: data.updatedAt ?? Date.now(),
        };
        state = {
          ...state,
          sharedGyms: { ...state.sharedGyms, [externalId]: shared },
        };
        // Re-overlay the local gyms so filters/board reflect the shared set.
        state = { ...state, gyms: state.gyms.map(applyShared) };
        persist();
        emit();
      },
      () => {
        const u = sharedUnsub.get(externalId);
        if (u) u();
        sharedUnsub.delete(externalId);
      },
    );
    sharedUnsub.set(externalId, unsub);
  } catch {
    /* offline / not signed in — fallback to per-user */
  }
}

/**
 * Add kit to a gym's list straight from your workouts (catalog item ids).
 * Goes to the shared list at once (same path as ticking it by hand). The
 * coarse inventory keeps whatever it already had — a gym audited only at the
 * class level must not lose classes just because it gains a fine item.
 * Returns the previous list so the caller can undo.
 */
export function addGymKit(
  gymId: string,
  itemIds: string[],
): { items: string[]; inventory: string[] } | null {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return null;
  const prev = { items: [...(g.equipmentItems ?? [])], inventory: [...(g.inventory ?? [])] };
  setGymEquipment(gymId, [...prev.items, ...itemIds]);
  const now = state.gyms.find((x) => x.id === gymId);
  if (now) {
    const inventory = Array.from(new Set([...prev.inventory, ...(now.inventory ?? [])]));
    if (inventory.length !== (now.inventory ?? []).length) upsertGym({ ...now, inventory });
  }
  return prev;
}

/** Kit used at a gym that isn't on its list yet (see gymEvidence.ts). */
export function gymKitEvidence(gymId: string, now: number): KitEvidence[] {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return [];
  return kitEvidence(g, state.workouts, now, {
    classesOf: (ex) => equipmentFor(ex),
    clsOfItem: (id) => ITEM_CLS[id] ?? null,
    isLift: (ex) => isStrengthExercise(ex) && !isCardioExerciseName(ex.name),
  });
}

/** Undo `addGymKit`: put the list back exactly as it was. */
export function restoreGymKit(gymId: string, prev: { items: string[]; inventory: string[] }): void {
  setGymEquipment(gymId, prev.items);
  const now = state.gyms.find((x) => x.id === gymId);
  if (now) upsertGym({ ...now, inventory: prev.inventory });
}

/** "Not at this gym": never suggest this item from your workouts here again. */
export function markGymKitNotHere(gymId: string, itemId: string): void {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return;
  const notHere = Array.from(new Set([...(g.equipmentNotHere ?? []), itemId]));
  upsertGym({ ...g, equipmentNotHere: notHere });
}

/** Set a gym's fine equipment picks and derive its coarse inventory. When the
 *  gym is a known shared entity (has externalId), the change is also written to
 *  the shared doc as a delta (arrayUnion/arrayRemove), so every user who has
 *  this gym sees it. */
export function setGymEquipment(gymId: string, itemIds: string[]): void {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return;
  const items = Array.from(new Set(itemIds));
  upsertGym({ ...g, equipmentItems: items, inventory: deriveInventory(items) });

  const key = g.externalId;
  if (key) {
    const prev = g.equipmentItems ?? [];
    const added = items.filter((i) => !prev.includes(i));
    const removed = prev.filter((i) => !items.includes(i));
    const ref = doc(db, 'sharedGyms', key);
    const now = Date.now();
    if (added.length)
      setDoc(ref, { equipmentItems: arrayUnion(...added), updatedAt: now }, { merge: true }).catch(
        () => {},
      );
    if (removed.length)
      setDoc(
        ref,
        { equipmentItems: arrayRemove(...removed), updatedAt: now },
        { merge: true },
      ).catch(() => {});
  }
}

/** Activities whose start falls on the given local day key. */
export function activitiesOnDay(day: number, list: Activity[] = state.activities): Activity[] {
  return list.filter((a) => dayKey(a.startedAt) === day);
}

const STREAK_DAY_MS = 86_400_000;

/** ISO weekday (1=Mon…7=Sun) of a day key (day keys are UTC-midnight buckets of the local date). */
function isoWeekdayOfDay(day: number): number {
  const w = new Date(day * STREAK_DAY_MS).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Days that keep a streak alive without a workout: rest periods (rest / active rest /
 *  illness), active injury or surgery rehab, and weekdays the assigned program leaves free. */
export function streakProtectedPredicate(now: number = Date.now()): (day: number) => boolean {
  const today = dayKey(now);
  const rests = restDayKeys(state.restPeriods, now);
  // RESTRICTION path (SPO-290 owner decision): the stored injuries protect the streak even with the Injuries consent
  // off. Raw state on purpose; it only decides which days count, and nothing about the injury is shown or sent.
  const rehab = state.injuries.filter(
    (i) => (i.reason === 'injury' || i.reason === 'surgery') && i.startDay <= today,
  );
  const program = prescribedTrainingDays();
  return (d) => {
    if (rests.has(d)) return true;
    for (const i of rehab) if (d >= i.startDay && d <= (i.healedDay ?? today)) return true;
    return program.size > 0 && !program.has(isoWeekdayOfDay(d));
  };
}

/** Day keys with a finished workout or activity. */
export function trainedDayKeys(
  workouts: Workout[] = state.workouts,
  activities: Activity[] = state.activities,
): Set<number> {
  const days = new Set<number>();
  for (const w of workouts) if (w.finishedAt !== null) days.add(dayKey(w.startedAt));
  for (const a of activities) if (a.finishedAt !== null) days.add(dayKey(a.startedAt));
  return days;
}

/**
 * Consistency streak in days — the single value shown everywhere. Rule and
 * constants live in `streak.ts` (trained or protected days count; a gap of more
 * than STREAK_MAX_GAP uncovered days resets it).
 */
export function consistencyStreak(now: number = Date.now()): number {
  const trained = trainedDayKeys();
  if (trained.size === 0) return 0;
  return computeStreak({
    trained,
    isProtected: streakProtectedPredicate(now),
    today: dayKey(now),
    floorDay: Math.min(...trained),
  });
}

/** Latest weigh-in (by time), or null. */
export function latestWeight(bm: BodyMetrics | null | undefined): WeightEntry | null {
  if (!bm?.weights?.length) return null;
  return bm.weights.reduce((a, b) => (b.at >= a.at ? b : a));
}

/** Body v1 §3.2: required-metric completeness — height + at least one weigh-in.
 *  Drives the blocking profile-completion gate for returning users. */
export function bodyMetricsComplete(bm: BodyMetrics): boolean {
  return !!bm.heightCm && bm.heightCm > 0 && bm.weights.length > 0;
}

/** BMI from height (cm) + weight (kg); null if height missing/invalid. */
export function bmiValue(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type PosFix = { lat: number; lng: number; accuracy: number; at: number };
const POS_CACHE_KEY = 'spotter.lastPos';

/** Last known position, cached in localStorage so we can reuse it without asking
 * the browser for permission again (see getCurrentPositionOnce). */
function readPosCache(): PosFix | null {
  try {
    const raw = localStorage.getItem(POS_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PosFix;
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number' && typeof p?.at === 'number') {
      return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}
function writePosCache(fix: { lat: number; lng: number; accuracy: number }): void {
  try {
    localStorage.setItem(POS_CACHE_KEY, JSON.stringify({ ...fix, at: Date.now() }));
  } catch {
    /* quota */
  }
}
/** True only when the browser already granted geolocation — so we can read a
 * fresh fix without popping a permission prompt. */
async function geolocationGranted(): Promise<boolean> {
  try {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!perms?.query) return false;
    const status = await perms.query({ name: 'geolocation' as PermissionName });
    return status.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * One location read, designed so the app asks for permission at most once.
 *  - maxAgeMs: if the cached fix is younger than this, return it with NO
 *    geolocation call (no permission prompt, no GPS spin-up).
 *  - cacheFirst: if ANY cached fix exists, return it immediately and never
 *    prompt; when permission is already granted, refresh the cache silently in
 *    the background. Only when there is no cached fix at all do we do a real
 *    read (which may prompt). Used at session start so opening the app reuses
 *    the location it already has instead of re-asking every time.
 * Every successful fresh read is cached in localStorage for later reuse.
 */
export function getCurrentPositionOnce(opts?: {
  maxAgeMs?: number;
  cacheFirst?: boolean;
}): Promise<{ lat: number; lng: number; accuracy: number }> {
  const maxAgeMs = opts?.maxAgeMs ?? 0;
  const cached = readPosCache();
  const fromCache = cached ? { lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy } : null;
  // Only fall back to a cached fix for callers that opted into cache behaviour;
  // a plain getCurrentPositionOnce() keeps its original resolve/reject contract.
  const canUseCache = maxAgeMs > 0 || !!opts?.cacheFirst;

  // Fresh enough cache → instant, no geolocation call at all.
  if (cached && maxAgeMs > 0 && Date.now() - cached.at <= maxAgeMs) {
    return Promise.resolve({ lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy });
  }

  // Have a fix already → reuse it and never prompt; quietly refresh if allowed.
  if (fromCache && opts?.cacheFirst) {
    if ('geolocation' in navigator) {
      void geolocationGranted().then((granted) => {
        if (!granted) return;
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            writePosCache({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          () => {
            /* ignore background refresh errors */
          },
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: maxAgeMs },
        );
      });
    }
    return Promise.resolve(fromCache);
  }

  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      if (fromCache && canUseCache) return resolve(fromCache);
      return reject(new Error('Геолокація недоступна в цьому браузері'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        writePosCache(fix);
        resolve(fix);
      },
      (err) => {
        if (fromCache && canUseCache) return resolve(fromCache);
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Доступ до геолокації заборонено. Дозволь його в налаштуваннях браузера.'
              : 'Не вдалося визначити локацію',
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: maxAgeMs },
    );
  });
}

/**
 * The saved gym you're standing in, if any. Uses a cached fix ≤ 2 min old and NEVER waits for a new
 * one (the picker opens instantly): none → null + background refresh if granted. ≤ 60 m, nearest wins.
 */
export async function gymAtCurrentPosition(gyms: Gym[]): Promise<Gym | null> {
  if (gyms.length === 0) return null;
  const pos = readPosCache();
  if (!pos || Date.now() - pos.at > 2 * 60 * 1000) {
    void geolocationGranted()
      .then((ok) => (ok ? getCurrentPositionOnce() : null))
      .catch(() => undefined);
    return null;
  }
  if (pos.accuracy > 60) return null;
  const inside = gyms
    .map((g) => ({ g, d: haversineM(pos.lat, pos.lng, g.lat, g.lng) }))
    .filter((x) => x.d <= x.g.radiusM)
    .sort((a, b) => a.d - b.d);
  return inside[0]?.g ?? null;
}

// --- Live listeners (replaces the old sync loop) ---------------------------

let unsubs: Unsubscribe[] = [];
let presenceTimer: ReturnType<typeof setInterval> | null = null;

function markSynced(fromCache: boolean, hasPending: boolean): void {
  const status: SyncStatus = hasPending
    ? navigator.onLine
      ? 'pending'
      : 'offline'
    : fromCache && !navigator.onLine
      ? 'offline'
      : 'synced';
  const patch: Partial<StoreState> = {
    syncStatus: state.syncStatus === 'failed' ? 'failed' : status,
  };
  if (status === 'synced') {
    patch.lastSyncAt = Date.now();
    patch.syncError = null;
    if (state.syncStatus === 'failed') patch.syncStatus = 'synced';
  }
  setState(patch);
}

// --- Account prefs (meta/prefs, last-write-wins per field) ---------------------
// The doc holds independent settings, each with its own stamp:
//   weekStart + updatedAt                 — first day of the training week
//   activityPins + activityPinsUpdatedAt  — Log activity › Pinned (ordered)
//   nextUpOff + nextUpOffUpdatedAt        — types not to suggest after workouts
//   programSuggestOff + …UpdatedAt        — "add to program" suggestions muted / snoozed
//   todayLayout + todayLayoutUpdatedAt    — the Today layout (today/layoutSync.ts)
//   theme                                 — the chosen theme (themes/themeSync.ts)
// Every write merges only its own fields, so a device with a stale copy of one
// setting can't clobber a newer value of another.
let applyingRemotePrefs = false;
function writePrefsFields(fields: Record<string, unknown>): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'meta', 'prefs'), fields, { merge: true }).catch(onWriteError);
}
function writePrefsDoc(): void {
  writePrefsFields({
    weekStart: weekStartDay(),
    updatedAt: weekStartUpdatedAt() || Date.now(),
  });
}
const LIST_PREFS: Array<[string, ListPrefStore]> = [
  ['activityPins', pinsPref],
  ['nextUpOff', nextUpOffPref],
  ['programSuggestOff', programSuggestOffPref],
];
function writeListPref(name: string, pref: ListPrefStore): void {
  const cur = pref.snapshot();
  writePrefsFields({ [name]: cur.list, [`${name}UpdatedAt`]: cur.updatedAt || Date.now() });
}
onWeekStartChange(() => {
  if (!applyingRemotePrefs) writePrefsDoc();
  // Every week view reads the setting through the store's consumers.
  emit();
});
for (const [name, pref] of LIST_PREFS) {
  pref.subscribe(() => {
    if (!applyingRemotePrefs) writeListPref(name, pref);
  });
}
// Local Today-layout edits only; synced values never fire this (no echo).
pushTodayLayoutEdits(writePrefsFields);
pushThemeEdits(writePrefsFields);

export function startSyncLoop(): () => void {
  const uid = currentUid();
  if (!uid) return () => undefined;
  stopListeners();
  // Sign-out does not go through resetLocalData: a different account signing in here must not inherit the memo (SPO-219).
  if (coachShareUid !== uid) resetCoachSharePublisher();
  coachShareUid = uid;
  resendUnsentWorkouts(uid);
  void initVault(uid);

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'prefs'),
      (snap) => {
        const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
        if (typeof data.weekStart !== 'number') {
          // First sync: keep a locally chosen start day.
          if (weekStartUpdatedAt() > 0) writePrefsDoc();
        } else {
          applyingRemotePrefs = true;
          try {
            setWeekStartDay(
              data.weekStart as IsoDay,
              typeof data.updatedAt === 'number' ? data.updatedAt : 0,
            );
          } finally {
            applyingRemotePrefs = false;
          }
        }
        for (const [name, pref] of LIST_PREFS) {
          const { apply, push } = reconcileListPref(pref.snapshot(), listPrefFromDoc(data, name));
          if (apply) {
            applyingRemotePrefs = true;
            try {
              pref.set(apply.list, apply.updatedAt);
            } finally {
              applyingRemotePrefs = false;
            }
          }
          if (push) writeListPref(name, pref);
        }
        syncTodayLayoutFromDoc(data, writePrefsFields);
        syncThemeFromDoc(data, writePrefsFields);
      },
      onWriteError,
    ),
  );

  const workoutsMirror = mirrorCollection<
    Workout & Record<string, unknown>,
    { fromCache: boolean; pending: boolean }
  >((serverWorkouts, { meta }) => {
    // A document without its exercise list is damaged: skipped, so the code below never trips over it (SPO-219).
    const usable = serverWorkouts.filter((w) => Array.isArray(w.exercises));
    state = {
      ...state,
      workouts: mergeServerWorkoutsWithLocalDrafts(usable, state.workouts),
    };
    markSynced(meta.fromCache, meta.pending);
    applyAutoFinish();
    clearStoredRest();
    backfillSleepKind();
  });
  unsubs.push(workoutsMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'workouts'),
      (snap) =>
        workoutsMirror.push(
          snap.docs.map((d) => d.data()),
          { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites },
        ),
      onWriteError,
    ),
  );
  const gymsMirror = mirrorCollection<Gym & Record<string, unknown>>((items) => {
    const gyms = items.map((g) => applyShared(g));
    state = { ...state, gyms };
    // Subscribe to the shared entity for every gym that has a stable id.
    gyms.forEach((g) => g.externalId && watchSharedGym(g.externalId));
    emit();
  });
  unsubs.push(gymsMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'gyms'),
      (snap) => gymsMirror.push(snap.docs.map((d) => d.data())),
      onWriteError,
    ),
  );
  const restMirror = mirrorCollection<RestPeriod & Record<string, unknown>>((items) => {
    state = { ...state, restPeriods: items };
    persist();
    emit();
  });
  unsubs.push(restMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'restPeriods'),
      (snap) => restMirror.push(snap.docs.map((d) => d.data())),
      // Soft: if the restPeriods rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  const injuriesMirror = mirrorCollection<Injury & Record<string, unknown>>((raw) => {
    const items = raw.filter((i) => !deletedInjuryIds.has(i.id));
    state = { ...state, injuries: items };
    persist();
    emit();
  });
  unsubs.push(injuriesMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'injuries'),
      (snap) => injuriesMirror.push(snap.docs.map((d) => d.data())),
      // Soft: if the injuries rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  const conditionsMirror = mirrorCollection<ChronicCondition & Record<string, unknown>>((raw) => {
    const items = raw.filter((c) => !deletedConditionIds.has(c.id));
    conditionsCache.markRemote('conditions');
    state = { ...state, conditions: stripLegacyConditions(items) };
    persist();
    emit();
    publishCoachShare(uid, items);
  });
  unsubs.push(conditionsMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'conditions'),
      (snap) => conditionsMirror.push(snap.docs.map((d) => d.data())),
      // Soft: if the conditions rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  const activitiesMirror = mirrorCollection<Activity & Record<string, unknown>>((items) => {
    state = {
      ...state,
      activities: mergeServerActivitiesWithLocalLive(items, state.activities),
    };
    persist();
    emit();
  });
  unsubs.push(activitiesMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'activities'),
      (snap) => activitiesMirror.push(snap.docs.map((d) => d.data())),
      // Soft: if the activities rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  const sleepsMirror = mirrorCollection<SleepNight & Record<string, unknown>, boolean>(
    (items, { meta }) => applySleepSnapshot(items, meta),
  );
  unsubs.push(sleepsMirror.dispose);
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'sleeps'),
      (snap) =>
        sleepsMirror.push(
          snap.docs.map((d) => d.data()),
          snap.metadata.fromCache,
        ),
      // Soft: if the sleeps rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  // Own profile doc — trainerId / name / avatar drive the coach-visible live
  // presence doc this athlete writes. Self-read is always allowed by rules.
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const d = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
        selfProfile = {
          trainerId: (d.trainerId as string) ?? null,
          firstName: d.firstName as string | undefined,
          lastName: d.lastName as string | undefined,
          avatarExt: (d.avatarExt as string) ?? null,
          loaded: true,
        };
        trainerListeners.forEach((l) => l());
        // Key exchange is automatic: a coach publishes a key, an athlete grants theirs.
        void runKeyExchange(selfProfile.trainerId, getRole() !== 'member');
      },
      () => undefined,
    ),
  );
  // Coach view: athletes this trainer coaches who are training now. Members get
  // an empty result (no doc names them as trainer); harmless either way.
  unsubs.push(
    onSnapshot(
      query(collection(db, 'liveSessions'), where('trainerId', '==', uid)),
      (snap) => {
        setState({ liveTrainees: snap.docs.map((d) => d.data() as LiveSession) });
      },
      // Soft: if the liveSessions rule/index isn't deployed yet, don't block sync.
      () => undefined,
    ),
  );
  const prefsMirror = mirrorCollection<{ conditionsShare?: unknown } & Record<string, unknown>>(
    (items) => {
      const v = items[0]?.conditionsShare;
      if (!isGeneralShare(v)) return;
      // The preference document of data that was deleted must not come back with a late snapshot.
      if (Number(items[0]?.updatedAt ?? 0) <= wipeFloor('chronic')) return;
      conditionsCache.markRemote('share');
      if (v === state.conditionsShare) return;
      state = { ...state, conditionsShare: v };
      persist();
      emit();
      publishCoachShare(uid, state.conditions);
    },
  );
  unsubs.push(prefsMirror.dispose);
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'conditionPrefs'),
      (snap) => prefsMirror.push(snap.exists() ? [snap.data()] : []),
      // Soft: a missing rule must not block the rest of the sync.
      () => undefined,
    ),
  );
  const cycleMirror = mirrorCollection<Record<string, unknown>>((items) => {
    if (!items.length) return; // locked, absent or wiped: keep what is on screen
    cycleCache.markRemote();
    const remote = normalizeCycle(items[0]);
    if (remote.updatedAt <= wipeFloor('cycle')) return; // deleted since: this is the old document
    if (remote.updatedAt < state.cycle.updatedAt) return;
    if (JSON.stringify(remote) === JSON.stringify(state.cycle)) return;
    state = { ...state, cycle: remote };
    persist();
    emit();
  });
  unsubs.push(cycleMirror.dispose);
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'cycle'),
      (snap) => cycleMirror.push(snap.exists() ? [snap.data()] : []),
      () => undefined,
    ),
  );
  const nicotineMirror = mirrorCollection<Record<string, unknown>>((items) => {
    if (!items.length) return; // locked, absent or wiped: keep what is on screen
    nicotineCache.markRemote();
    const remote = normalizeNicotine(items[0]);
    if (remote.updatedAt <= wipeFloor('nicotine')) return; // deleted since: this is the old document
    // Last-write-wins: a newer local edit (not yet echoed back) beats the snapshot.
    if (remote.updatedAt < state.nicotine.updatedAt) return;
    if (JSON.stringify(remote) === JSON.stringify(state.nicotine)) return;
    state = { ...state, nicotine: remote };
    persist();
    emit();
  });
  unsubs.push(nicotineMirror.dispose);
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'nicotine'),
      (snap) => nicotineMirror.push(snap.exists() ? [snap.data()] : []),
      // Soft: a missing rule must not block the rest of the sync.
      () => undefined,
    ),
  );
  const alcoholMirror = mirrorCollection<Record<string, unknown>>((items) => {
    if (!items.length) return; // locked, absent or wiped: keep what is on screen
    alcoholCache.markRemote();
    const remote = normalizeAlcohol(items[0]);
    if (remote.updatedAt <= wipeFloor('alcohol')) return; // deleted since: this is the old document
    // Last-write-wins: a newer local edit (not yet echoed back) beats the snapshot.
    if (remote.updatedAt < (state.alcohol?.updatedAt ?? 0)) return;
    if (JSON.stringify(remote) === JSON.stringify(state.alcohol)) return;
    state = { ...state, alcohol: remote };
    persist();
    emit();
  });
  unsubs.push(alcoholMirror.dispose);
  const supplementsMirror = mirrorCollection<Record<string, unknown>>((items) => {
    if (!items.length) return; // locked, absent or wiped: keep what is on screen
    supplementsCache.markRemote();
    const remote = normalizeSupplements(items[0]);
    if (remote.updatedAt <= wipeFloor('supplements')) return; // deleted since: this is the old document
    // Last-write-wins: a newer local edit (not yet echoed back) beats the snapshot.
    if (remote.updatedAt < (state.supplements?.updatedAt ?? 0)) return;
    if (JSON.stringify(remote) === JSON.stringify(state.supplements)) return;
    state = { ...state, supplements: remote };
    persist();
    emit();
  });
  unsubs.push(supplementsMirror.dispose);
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'supplements'),
      (snap) => supplementsMirror.push(snap.exists() ? [snap.data()] : []),
      // Soft: a missing rule must not block the rest of the sync.
      () => undefined,
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'alcohol'),
      (snap) => alcoholMirror.push(snap.exists() ? [snap.data()] : []),
      // Soft: a missing rule must not block the rest of the sync.
      () => undefined,
    ),
  );
  const bodyMirror = mirrorCollection<BodyMetrics & Record<string, unknown>>((items, info) => {
    // Locked and sealed: keep what is on screen rather than flashing an empty profile.
    if (!items.length && info.locked) return;
    const data = items[0] ?? EMPTY_BODY;
    state = { ...state, bodyMetrics: { ...data, weights: data.weights ?? [] } };
    persist();
    emit();
  });
  unsubs.push(bodyMirror.dispose);
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'body'),
      (snap) => bodyMirror.push(snap.exists() ? [snap.data()] : []),
      onWriteError,
    ),
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'goals'),
      (snap) => {
        const data = snap.exists() ? (snap.data() as FitGoals) : EMPTY_GOALS;
        state = { ...state, goals: { ...EMPTY_GOALS, ...data } };
        persist();
        emit();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'home'),
      (snap) => {
        if (!snap.exists()) {
          // First sync on this account — push home sets made before signing in.
          if (state.home.sets.length || state.home.moves.length) writeHomeDoc();
          return;
        }
        const data = snap.data() as Partial<HomeState>;
        // Last-write-wins: a newer local edit (not yet echoed) beats the snapshot.
        if ((state.home.updatedAt ?? 0) > (data.updatedAt ?? 0)) return;
        state = { ...state, home: { ...EMPTY_HOME, ...data } };
        persist();
        emit();
      },
      () => undefined,
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'mastery'),
      (snap) => {
        if (!snap.exists()) {
          // No server copy yet — push existing local mastery up so pre-sync
          // data is preserved rather than lost. (One-time migration per user.)
          const m = state.mastery;
          if (m.sinceYear != null || m.pattern != null || m.seenRating != null) writeMasteryDoc();
          return;
        }
        const data = snap.data() as StoreState['mastery'];
        // Last-write-wins: keep a newer local edit over a stale server copy.
        if ((state.mastery.updatedAt ?? 0) > (data.updatedAt ?? 0)) return;
        state = {
          ...state,
          mastery: {
            sinceYear: data.sinceYear ?? null,
            pattern: data.pattern ?? null,
            seenRating: data.seenRating ?? null,
            updatedAt: data.updatedAt,
          },
        };
        persist();
        emit();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'coach'),
      (snap) => {
        if (!snap.exists()) {
          if (state.coach.enabled) {
            for (const k of Object.keys(state.coach)) coachDirty.add(k);
            writeCoachDoc();
          }
          return;
        }
        const data = snap.data() as Partial<CoachSettings>;
        // Last-write-wins: keep a newer local edit over a stale server copy.
        coachServerAt = Math.max(coachServerAt, data.updatedAt ?? 0);
        // An edit still waiting to be written is never overwritten by an older copy.
        if (coachDirty.size || (state.coach.updatedAt ?? 0) > (data.updatedAt ?? 0)) return;
        state = { ...state, coach: coachFrom(data) };
        persist();
        emit();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'exerciseCatalog'),
      (snap) => {
        registerCustomExercises(snap.docs.map((d) => d.data() as CustomExercise));
        emit();
      },
      () => undefined,
    ),
  );

  const tick = () => {
    applyAutoFinish();
    heartbeatLiveSession();
  };
  presenceTimer = setInterval(tick, 15_000);
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  tick();

  // Refresh the server auto-start queue from the current schedule on sign-in.
  syncSleepAutoQueue();

  return () => stopListeners();
}

function stopListeners(): void {
  for (const u of unsubs) u();
  unsubs = [];
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}

/** No-op kept for compatibility — Firestore syncs continuously on its own. */
export async function sync(): Promise<void> {
  /* writes flush automatically; nothing to drain */
}

/**
 * Manual / scheduled retry of the background sync (the "Retry" on the sync chip).
 * Firestore retries queued writes by itself; this clears a stale failed/pending
 * status and re-attaches the live listeners, which makes the SDK re-open its
 * server stream. Local state stays untouched: the next snapshot replaces the
 * cache (server is the source of truth), so it is safe to call repeatedly.
 */
export function retrySync(): void {
  setState({ syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: null });
  if (navigator.onLine && currentUid()) startSyncLoop();
}
export function discardBlockingChange(): void {
  setState({ syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: null });
}

// --- Shared exercise catalog -----------------------------------------------

export function saveCatalogExercise(meta: {
  name: string;
  kind?: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
  subRegions?: ExerciseSubRegions;
}): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  const id = meta.name.trim().toLowerCase();
  // Optimistic register under the REAL id (upsert by id). The previous code
  // registered a `pending-<id>` twin and only added the real id after the server
  // confirmed — with no emit — so the list showed BOTH until a reload let the
  // server snapshot replace it. One entry under the real id: edit is live, no
  // duplicate; the snapshot reconciles it afterwards.
  registerCustomExercise({ id, ...meta });
  emit();
  const uid = currentUid();
  if (!uid) return;
  // Rules gate this to trainer/admin; id is the lowercased name (uniqueness).
  setDoc(doc(db, 'exerciseCatalog', id), {
    id,
    name: meta.name.trim(),
    kind: meta.kind ?? 'strength',
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles,
    equipment: meta.equipment,
    ...(meta.subRegions ? { subRegions: meta.subRegions } : {}),
    createdBy: uid,
    updatedAt: Date.now(),
  }).catch(onWriteError);
}

/** Edit a custom catalog exercise. Handles rename (id = lowercased name): if the
 *  name changed, the old doc is removed and a new one written. */
export function updateCatalogExercise(
  oldId: string,
  meta: {
    name: string;
    kind?: string;
    primaryMuscle: MuscleGroup | null;
    secondaryMuscles: MuscleGroup[];
    equipment: string[];
    subRegions?: ExerciseSubRegions;
  },
): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  const newId = meta.name.trim().toLowerCase();
  if (newId !== oldId) {
    registerCustomExercises(customExercises().filter((e) => e.id !== oldId));
    deleteDoc(doc(db, 'exerciseCatalog', oldId)).catch(onWriteError);
  }
  saveCatalogExercise(meta);
}

/** Delete a custom catalog exercise (optimistic local remove + Firestore). */
export function deleteCatalogExercise(id: string): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  registerCustomExercises(customExercises().filter((e) => e.id !== id));
  emit();
  deleteDoc(doc(db, 'exerciseCatalog', id)).catch(onWriteError);
}

/** Set the fine equipment combination for one exercise in a workout, and add
 *  any newly-picked items to the gym (shared entity), so picking equipment on
 *  an exercise stocks the gym too (design Load-entry). */
export function setExerciseEquipmentItems(
  workoutId: string,
  exerciseId: string,
  itemIds: string[],
  gymId?: string | null,
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const items = Array.from(new Set(itemIds));
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, equipmentItems: items } : e)),
  });
  saveWorkout(workoutId);
  // Stock the gym with anything picked that it doesn't already have.
  if (gymId) {
    const g = state.gyms.find((x) => x.id === gymId);
    if (g) {
      const have = new Set(g.equipmentItems ?? []);
      const merged = [...have];
      for (const id of items) if (!have.has(id)) merged.push(id);
      if (merged.length !== have.size) setGymEquipment(gymId, merged);
    }
  }
}

export function updateExerciseMeta(
  workoutId: string,
  exerciseId: string,
  meta: { primaryMuscle: MuscleGroup | null; secondaryMuscles: MuscleGroup[]; equipment: string[] },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId
        ? {
            ...e,
            primaryMuscle: meta.primaryMuscle,
            secondaryMuscles: meta.secondaryMuscles,
            equipment: meta.equipment,
          }
        : e,
    ),
  });
  saveWorkout(workoutId);
}

// --- Derived data for the designed UI (ghost rows, PRs, compare) -----------

export interface PrevLift {
  reps: number;
  weight: number | null;
}

/**
 * The athlete's usual working weight on a lift, from history (not today's
 * session): the most common working weight of the last session, heavier one on
 * ties. A single heavy top set or a PR doesn't move it. 0 = no history.
 */
export function historicalWorkingKg(
  name: string,
  currentWorkoutId?: string,
  variant?: string,
): number {
  const found = lastSessionWith(name, currentWorkoutId, variant);
  if (!found) return 0;
  const counts = new Map<number, number>();
  for (const s of found.exercise.sets) {
    if (setTypeOf(s) === 'warmup') continue;
    const w = s.weight ?? 0;
    if (w > 0) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = 0;
  let n = 0;
  for (const [w, c] of counts) if (c > n || (c === n && w > best)) [best, n] = [w, c];
  return best;
}

/**
 * Weight differs per machine, not per exercise name. A "variant" tells which
 * physical setup a lift was done on: the picked equipment item, else the gym —
 * but only for machine/cable lifts. Free weights are absolute (variant ''), so
 * they match everywhere. Derived at read time: old data is never rewritten.
 */
export function isMachineLift(e: Pick<Exercise, 'name' | 'equipment'>): boolean {
  const eq = equipmentFor(e);
  return eq.includes('machine') || eq.includes('cable');
}
export function liftVariant(w: Pick<Workout, 'gymId'>, e: Exercise): string {
  if (!isMachineLift(e)) return '';
  const items = [...(e.equipmentItems ?? [])].sort();
  if (items.length > 0) return 'eq:' + items.join('+');
  return w.gymId ? 'gym:' + w.gymId : '';
}
function sameVariant(w: Workout, e: Exercise, variant?: string): boolean {
  return variant === undefined || liftVariant(w, e) === variant;
}

export function lastSessionWith(
  name: string,
  beforeWorkoutId?: string,
  variant?: string,
): { workout: Workout; exercise: Exercise } | undefined {
  const needle = name.trim().toLowerCase();
  for (const w of state.workouts) {
    if (w.id === beforeWorkoutId || w.finishedAt === null) continue;
    const ex = w.exercises.find(
      (e) =>
        isStrengthExercise(e) &&
        e.name.trim().toLowerCase() === needle &&
        e.sets.length > 0 &&
        sameVariant(w, e, variant),
    );
    if (ex) return { workout: w, exercise: ex };
  }
  return undefined;
}
export function prevLift(
  name: string,
  currentWorkoutId?: string,
  variant?: string,
): PrevLift | undefined {
  const found = lastSessionWith(name, currentWorkoutId, variant);
  if (!found) return undefined;
  const top = topSet(found.exercise.sets) ?? found.exercise.sets[found.exercise.sets.length - 1];
  return top ? { reps: top.reps, weight: top.weight } : undefined;
}
export function recordWeight(name: string, excludeWorkoutId?: string, variant?: string): number {
  const needle = name.trim().toLowerCase();
  let max = 0;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.name.trim().toLowerCase() !== needle) continue;
      if (!sameVariant(w, e, variant)) continue;
      // AC-DS-07: records consider the parent entry only — a drop (even a
      // heavier reverse-drop) can never set or break a record.
      for (const s of e.sets) {
        const parent = s.weight ?? 0;
        if (setTypeOf(s) !== 'warmup' && parent > max) max = parent;
      }
    }
  }
  return max;
}
/** Best e1RM of a lift before a workout (warm-ups excluded, drops included). */
export function recordE1rm(name: string, excludeWorkoutId?: string, variant?: string): number {
  const needle = name.trim().toLowerCase();
  let max = 0;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.name.trim().toLowerCase() !== needle) continue;
      if (!sameVariant(w, e, variant)) continue;
      for (const s of e.sets) max = Math.max(max, setBestE1rm(s));
    }
  }
  return max;
}

// --- Main gym & cross-gym weight -------------------------------------------

/** Gyms that are main (several allowed). */
export function mainGyms(): Gym[] {
  const auto = autoMainGymIds(state.workouts);
  return state.gyms.filter((g) => isMainGym(g, auto));
}

function topOf(e: Exercise): { weight: number; reps: number } | null {
  const t = topSet(e.sets);
  return t && (t.weight ?? 0) > 0 ? { weight: t.weight ?? 0, reps: t.reps } : null;
}

/** Last top set of every machine lift per gym (name → top), newest session wins. */
function lastTopsInGym(gymId: string): Map<string, { weight: number; reps: number }> {
  const out = new Map<string, { weight: number; reps: number }>();
  for (const w of state.workouts) {
    if (w.finishedAt === null || w.gymId !== gymId) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || !isMachineLift(e)) continue;
      const key = e.name.trim().toLowerCase();
      if (out.has(key)) continue;
      const t = topOf(e);
      if (t) out.set(key, t);
    }
  }
  return out;
}

/** Minimum number of machine lifts done in both gyms before we dare an estimate. */
export const TRANSFER_MIN_SHARED = 3;

/**
 * How heavy this gym's machines feel compared with another gym: the median of
 * to/from over lifts done in both. null = too little to say (never guess).
 */
export function gymTransferRatio(fromGymId: string, toGymId: string): number | null {
  const a = lastTopsInGym(fromGymId);
  const b = lastTopsInGym(toGymId);
  const ratios: number[] = [];
  for (const [k, from] of a) {
    const to = b.get(k);
    if (to) ratios.push(to.weight / from.weight);
  }
  if (ratios.length < TRANSFER_MIN_SHARED) return null;
  ratios.sort((x, y) => x - y);
  const m = ratios[Math.floor(ratios.length / 2)];
  return m >= 0.4 && m <= 1.6 ? m : null;
}

export interface CrossGymHint {
  /** The main gym the figure comes from. */
  gym: Gym;
  weight: number;
  reps: number;
  /** Estimated working weight here (null = not enough shared lifts). */
  estimate: number | null;
  /** This machine already has its own history here. */
  hasLocal: boolean;
}

/**
 * For a machine lift in a non-main gym: what you did on it in your main gym and
 * (only without history here) an estimate for this one. Never written to history.
 */
export function crossGymHint(workoutId: string, ex: Exercise): CrossGymHint | undefined {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w || !w.gymId || !isStrengthExercise(ex) || !isMachineLift(ex)) return undefined;
  const mains = mainGyms();
  if (mains.length === 0 || mains.some((g) => g.id === w.gymId)) return undefined;
  const needle = ex.name.trim().toLowerCase();
  for (const mw of state.workouts) {
    if (mw.finishedAt === null || !mw.gymId || !mains.some((g) => g.id === mw.gymId)) continue;
    const me = mw.exercises.find(
      (e) => isStrengthExercise(e) && e.name.trim().toLowerCase() === needle,
    );
    const top = me ? topOf(me) : null;
    if (!me || !top) continue;
    const gym = mains.find((g) => g.id === mw.gymId)!;
    const hasLocal = !!lastSessionWith(ex.name, workoutId, liftVariant(w, ex));
    const ratio = hasLocal ? null : gymTransferRatio(gym.id, w.gymId);
    const estimate = ratio ? Math.round((top.weight * ratio) / 2.5) * 2.5 : null;
    return { gym, weight: top.weight, reps: top.reps, estimate, hasLocal };
  }
  return undefined;
}

/** Best working weight of a lift per variant (machine/gym) — for the records block. */
export interface VariantRecord {
  variant: string;
  gymId: string | null;
  equipmentItems: string[];
  weight: number;
  reps: number;
  isMain: boolean;
}
export function recordsByVariant(name: string): VariantRecord[] {
  const needle = name.trim().toLowerCase();
  const m = new Map<string, VariantRecord>();
  const mains = mainGyms();
  for (const w of state.workouts) {
    if (w.finishedAt === null) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.name.trim().toLowerCase() !== needle) continue;
      const v = liftVariant(w, e);
      for (const s of e.sets) {
        if (setTypeOf(s) === 'warmup') continue;
        const wt = s.weight ?? 0;
        const cur = m.get(v);
        if (wt > 0 && (!cur || wt > cur.weight)) {
          m.set(v, {
            variant: v,
            gymId: w.gymId ?? null,
            equipmentItems: e.equipmentItems ?? [],
            weight: wt,
            reps: s.reps,
            isMain: !!w.gymId && mains.some((g) => g.id === w.gymId),
          });
        }
      }
    }
  }
  return [...m.values()].sort((a, b) => Number(b.isMain) - Number(a.isMain) || b.weight - a.weight);
}

/**
 * One progress curve across machines: an index starting at 100. Between two
 * sessions on the same variant it moves by their weight ratio; a switch of
 * variant moves nothing (flagged), so a lighter machine never looks like a loss.
 */
export interface ProgressPoint {
  ts: number;
  value: number;
  switched: boolean;
}
export function normalizedProgress(name: string): ProgressPoint[] {
  const needle = name.trim().toLowerCase();
  const pts: { ts: number; v: string; w: number }[] = [];
  for (const w of state.workouts) {
    if (w.finishedAt === null) continue;
    const e = w.exercises.find(
      (x) => isStrengthExercise(x) && x.name.trim().toLowerCase() === needle,
    );
    const t = e ? topOf(e) : null;
    if (e && t) pts.push({ ts: w.startedAt, v: liftVariant(w, e), w: t.weight });
  }
  pts.sort((a, b) => a.ts - b.ts);
  const out: ProgressPoint[] = [];
  let value = 100;
  pts.forEach((p, i) => {
    if (i === 0) return void out.push({ ts: p.ts, value, switched: false });
    const prev = pts[i - 1];
    const switched = prev.v !== p.v;
    if (!switched) value = value * (p.w / prev.w);
    out.push({ ts: p.ts, value, switched });
  });
  return out;
}
/** The lift's sets in its most recent finished sessions, newest first. */
export function recentSessionsOf(
  name: string,
  excludeWorkoutId: string | undefined,
  n: number,
): { sets: SetEntry[] }[] {
  const needle = name.trim().toLowerCase();
  return state.workouts
    .filter((w) => w.id !== excludeWorkoutId && w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((w) => w.exercises.find((e) => e.name.trim().toLowerCase() === needle))
    .filter((e): e is Exercise => !!e && e.sets.length > 0)
    .slice(0, n)
    .map((e) => ({ sets: e.sets }));
}
/** A lift's reference strength for effort estimates: best e1RM over the last
 *  `days` (else all-time) and how long since it was last trained. */
export function liftReference(
  name: string,
  excludeWorkoutId: string | undefined,
  days = 56,
  now: number = Date.now(),
): { refE1: number; daysSinceLift: number | null } {
  const needle = name.trim().toLowerCase();
  let recent = 0;
  let last: number | null = null;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId || w.finishedAt === null) continue;
    const e = w.exercises.find((x) => x.name.trim().toLowerCase() === needle);
    if (!e || e.sets.length === 0) continue;
    if (last === null || w.startedAt > last) last = w.startedAt;
    if (now - w.startedAt <= days * 86400000)
      for (const s of e.sets) recent = Math.max(recent, setBestE1rm(s));
  }
  return {
    refE1: recent > 0 ? recent : recordE1rm(name, excludeWorkoutId),
    daysSinceLift: last === null ? null : Math.floor((now - last) / 86400000),
  };
}
export const E1RM_MAX_REPS = 10;

export function est1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Best estimated 1RM across a set's performed segments — the top set AND any
 * drop parts. A drop or reverse-drop set is one set whose parts live in
 * `drops`; without looking at them, an ascending reverse-drop (or a heavy,
 * high-rep drop) would never register an e1RM record even though it was the
 * strongest effort. Warm-ups score 0.
 */
export function setBestE1rm(s: SetEntry): number {
  if (setTypeOf(s) === 'warmup') return 0;
  let best = est1rm(s.weight ?? 0, s.reps);
  for (const d of setDrops(s)) best = Math.max(best, est1rm(d.weight ?? 0, d.reps));
  return best;
}

export function estimatedOneRepMaxSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => setBestE1rm(s) > 0)
    .sort((a, b) => setBestE1rm(b) - setBestE1rm(a))[0];
}
export interface MyExercise {
  /** Catalogue id, or `logged-<name>` for a history-only user exercise. */
  id: string;
  name: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
  subRegions?: ExerciseSubRegions;
  /** 'catalog' = saved to exerciseCatalog (editable + deletable);
   *  'logged'  = created ad-hoc in a session, not yet in the catalogue. */
  source: 'catalog' | 'logged';
}

/**
 * The user's own exercises: everything they created — both saved catalogue
 * entries AND names they logged ad-hoc that aren't built-in library lifts.
 * The latter is why manually-created exercises show up even if they were never
 * written to the shared catalogue.
 */
export function myExercises(): MyExercise[] {
  const out: MyExercise[] = customExercises().map((e) => ({
    id: e.id,
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    subRegions: e.subRegions,
    source: 'catalog' as const,
  }));
  const seen = new Set(out.map((e) => e.name.trim().toLowerCase()));
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim().toLowerCase();
      if (!key || seen.has(key) || isBuiltInExercise(e.name)) continue;
      seen.add(key);
      const rm = resolveMuscles(e);
      out.push({
        id: `logged-${key}`,
        name: e.name.trim(),
        primaryMuscle: rm.primary,
        secondaryMuscles: rm.secondary,
        equipment: (e.equipment ?? []) as string[],
        source: 'logged',
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function knownExercises(): { name: string; last?: PrevLift }[] {
  const seen = new Map<string, PrevLift | undefined>();
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const top = topSet(e.sets) ?? e.sets[e.sets.length - 1];
      seen.set(key.toLowerCase(), top ? { reps: top.reps, weight: top.weight } : undefined);
    }
  }
  const out: { name: string; last?: PrevLift }[] = [];
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim();
      if (!key || out.some((o) => o.name.toLowerCase() === key.toLowerCase())) continue;
      out.push({ name: key, last: seen.get(key.toLowerCase()) });
    }
  }
  return out;
}

export function workoutSets(w: Workout): number {
  return w.exercises.reduce((n, e) => n + (isStrengthExercise(e) ? e.sets.length : 0), 0);
}
export function workoutVolumeKg(w: Workout): number {
  return w.exercises.reduce((v, e) => v + (isStrengthExercise(e) ? exerciseVolumeKg(e) : 0), 0);
}
export function workoutCardioMinutes(w: Workout): number {
  return w.exercises.reduce(
    (n, e) =>
      n +
      (isTimedExercise(e) ? e.sets.reduce((s, x) => s + Math.max(0, x.durationMin ?? 0), 0) : 0),
    0,
  );
}
export function workoutCardioDistanceKm(w: Workout): number {
  return w.exercises.reduce(
    (n, e) =>
      n + (isTimedExercise(e) ? e.sets.reduce((s, x) => s + Math.max(0, x.distanceKm ?? 0), 0) : 0),
    0,
  );
}

// --- Undo (reversible deletes re-insert via idempotent upserts) ------------

export function restoreSet(workoutId: string, exerciseId: string, set: SetEntry): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const sets = [...ex.sets, set].sort((a, b) => a.position - b.position);
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
  });
  saveWorkout(workoutId);
}

export function restoreExercise(workoutId: string, exercise: Exercise): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: [...w.exercises, exercise].sort((a, b) => a.position - b.position),
  });
  saveWorkout(workoutId);
}

export function clearSets(workoutId: string, exerciseId: string): SetEntry[] {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return [];
  const removed = ex.sets;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: [] } : e)),
  });
  saveWorkout(workoutId);
  return removed;
}

export function duplicateExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const copy: Exercise = {
    id: uuid(),
    name: ex.name,
    kind: exerciseKind(ex),
    position: w.exercises.length,
    plannedSets: ex.plannedSets ?? null,
    plannedReps: ex.plannedReps ?? null,
    plannedDurationMin: ex.plannedDurationMin ?? null,
    ...(ex.planItemId ? { planItemId: ex.planItemId } : {}),
    equipment: ex.equipment ?? [],
    primaryMuscle: ex.primaryMuscle ?? null,
    secondaryMuscles: ex.secondaryMuscles ?? [],
    ...(ex.warmupItems
      ? { warmupItems: warmupItemsOf(ex).map((i) => ({ ...i, id: uuid() })) }
      : {}),
    sets: ex.sets.map((s, i) => ({ ...s, id: uuid(), position: i })),
  };
  restoreExercise(workoutId, copy);
}

/** Warm-up / cool-down markers are kept on finish since this build; sessions
 *  finished earlier lost them, so they can't say whether you warmed up. */
export const MARKERS_KEPT_SINCE = Date.UTC(2026, 8, 24);

/** The first thing a session opened with (markers included). */
function sessionOpener(w: Workout): Exercise | undefined {
  return [...w.exercises]
    .filter((e) => isMarkerExercise(e) || e.sets.length > 0)
    .sort((a, b) => a.position - b.position)[0];
}
/** Opened with a warm-up: the marker, or cardio before the first lift. */
export function opensWithWarmupSession(w: Workout): boolean {
  const e = sessionOpener(w);
  return (
    !!e &&
    (exerciseKind(e) === 'warmup' || exerciseKind(e) === 'cardio' || isCardioExerciseName(e.name))
  );
}
/**
 * Do these sessions usually start with a warm-up? Judged on sessions that
 * could tell: those since markers were kept, plus any older one that shows a
 * warm-up anyway (cardio first). Nothing to judge → yes (the safe default).
 */
export function warmupHabit(sessions: Workout[]): boolean {
  const judged = sessions.filter(
    (w) => w.startedAt >= MARKERS_KEPT_SINCE || opensWithWarmupSession(w),
  );
  if (judged.length === 0) return true;
  return judged.filter(opensWithWarmupSession).length >= judged.length / 3;
}

export function finishWorkoutClean(id: string): Workout | undefined {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return undefined;
  // Drop lifts that never got a set — but keep warm-up / cool-down markers
  // (they never have sets): they're how the app learns a session's shape,
  // e.g. "on Thursdays you start with a warm-up".
  const kept = w.exercises.filter((e) => e.sets.length > 0 || isMarkerExercise(e));
  if (kept.length !== w.exercises.length) patchWorkout(id, { exercises: kept });
  finishWorkout(id);
  return state.workouts.find((x) => x.id === id);
}

export function reopenWorkout(id: string): void {
  if (!state.workouts.find((x) => x.id === id)) return;
  patchWorkout(id, { finishedAt: null, autoFinished: false });
  saveWorkout(id);
}

export function backfillWorkout(
  startedAt: number,
  durationMs: number,
  gymId: string | null = null,
): Workout {
  const workout: Workout = {
    id: uuid(),
    startedAt,
    finishedAt: startedAt + durationMs,
    autoFinished: false,
    gymId,
    exercises: [],
  };
  // A backfilled session is a draft while its editor is open: it stays on this
  // device (saved to localStorage) and syncs once, via commitWorkout, when the
  // editor closes — so building it doesn't spray writes on every added set.
  draftWorkouts.add(workout.id);
  setState({ workouts: sortWorkouts([workout, ...state.workouts]), syncStatus: state.syncStatus });
  return workout;
}

// --- Home sets --------------------------------------------------------------

function commitHome(next: Omit<HomeState, 'updatedAt'>): void {
  setState({ home: { ...next, updatedAt: Date.now() }, syncStatus: bumpPending() });
  writeHomeDoc();
}

/** Create or update a home set (name + ordered move ids). Returns it. */
export function saveHomeSet(input: { id?: string; name: string; moves: string[] }): HomeSet {
  const now = Date.now();
  const prev = input.id ? state.home.sets.find((x) => x.id === input.id) : undefined;
  const set: HomeSet = {
    id: prev?.id ?? uuid(),
    name: input.name.trim(),
    moves: [...new Set(input.moves)],
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  const sets = prev
    ? state.home.sets.map((x) => (x.id === set.id ? set : x))
    : [...state.home.sets, set];
  commitHome({ ...state.home, sets });
  return set;
}

/** Delete a home set template. Sessions done from it stay in history. */
export function deleteHomeSet(id: string): void {
  commitHome({ ...state.home, sets: state.home.sets.filter((x) => x.id !== id) });
}

/** Create or update an own home move. Returns it. */
export function saveHomeMove(
  input: Omit<HomeMove, 'id' | 'custom' | 'updatedAt'> & { id?: string },
): HomeMove {
  const prev = input.id ? state.home.moves.find((m) => m.id === input.id) : undefined;
  const move: HomeMove = {
    id: prev?.id ?? uuid(),
    name: input.name.trim(),
    measure: input.measure,
    muscle: input.muscle,
    icon: input.icon,
    custom: true,
    updatedAt: Date.now(),
  };
  const moves = prev
    ? state.home.moves.map((m) => (m.id === move.id ? move : m))
    : [...state.home.moves, move];
  commitHome({ ...state.home, moves });
  // Renaming a move renames it in a live / draft session that uses it, so the
  // stopwatch and icon keep resolving.
  if (prev && prev.name !== move.name) {
    for (const w of state.workouts) {
      if (w.kind !== 'home' || !isLocalOnlyWorkout(w)) continue;
      const exercises = w.exercises.map((e) =>
        e.name === prev.name ? { ...e, name: move.name, measure: move.measure } : e,
      );
      patchWorkout(w.id, { exercises });
    }
  }
  return move;
}

/** Delete an own move: it leaves every home set; logged sets stay in history. */
export function deleteHomeMove(id: string): void {
  commitHome({
    sets: state.home.sets.map((x) => ({ ...x, moves: x.moves.filter((m) => m !== id) })),
    moves: state.home.moves.filter((m) => m.id !== id),
  });
}

/** Set how an exercise is logged (home moves: reps vs a stopwatch hold). */
export function setExerciseMeasure(
  workoutId: string,
  exerciseId: string,
  measure: 'reps' | 'hold' | 'time',
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId ? { ...e, measure: measure === 'reps' ? null : measure } : e,
    ),
  });
  saveWorkout(workoutId);
}

/** Add a home move to a (live or past) home workout as an exercise. */
export function addHomeMoveToWorkout(workoutId: string, move: HomeMove): Exercise {
  const ex = addExercise(
    workoutId,
    move.name,
    'strength',
    move.custom
      ? { primaryMuscle: move.muscle, secondaryMuscles: [], equipment: ['body only'] }
      : {},
  );
  const w = state.workouts.find((x) => x.id === workoutId);
  if (w) {
    const measure = move.measure === 'reps' ? null : move.measure;
    patchWorkout(workoutId, {
      exercises: w.exercises.map((e) => (e.id === ex.id ? { ...e, measure } : e)),
    });
    saveWorkout(workoutId);
  }
  return (
    state.workouts.find((x) => x.id === workoutId)?.exercises.find((e) => e.id === ex.id) ?? ex
  );
}

/**
 * Start a live home set: a normal session (no gym, kind 'home') with the set's
 * moves already on it. Returns null when something else is live (a session, an
 * activity or a sleep) — one live thing at a time.
 */
export function startHomeSet(input: {
  set?: HomeSet | null;
  name: string;
  moves: string[];
}): Workout | null {
  if (state.workouts.some((w) => w.finishedAt === null && w.exercises.length > 0)) return null;
  const w = startWorkout(null, { dayName: input.name });
  if (!w) return null;
  patchWorkout(w.id, { kind: 'home', homeSetId: input.set?.id ?? null });
  for (const id of input.moves) {
    const move = homeMoveById(state.home, id);
    if (move) addHomeMoveToWorkout(w.id, move);
  }
  return state.workouts.find((x) => x.id === w.id) ?? null;
}

/**
 * Log a forgotten home set (Log past → Home set): a finished home workout at
 * the given time with the chosen set's moves on it, opened as a draft to add
 * sets. Moves without sets are dropped when the editor saves.
 */
export function backfillHomeSet(
  startedAt: number,
  durationMs: number,
  set: HomeSet | null,
): Workout {
  const w = backfillWorkout(startedAt, durationMs, null);
  patchWorkout(w.id, { kind: 'home', homeSetId: set?.id ?? null, dayName: set?.name ?? null });
  if (set) {
    for (const id of set.moves) {
      const move = homeMoveById(state.home, id);
      if (move) addHomeMoveToWorkout(w.id, move);
    }
  }
  return state.workouts.find((x) => x.id === w.id) ?? w;
}

export function repeatWorkout(sourceId: string): Workout | undefined {
  const src = state.workouts.find((x) => x.id === sourceId);
  if (!src) return undefined;
  const w = startWorkout();
  if (!w) return undefined;
  for (const e of [...src.exercises].sort((a, b) => a.position - b.position)) {
    addExercise(w.id, e.name, exerciseKind(e));
  }
  return state.workouts.find((x) => x.id === w.id);
}

export function resetLocalData(): void {
  stopListeners();
  deletedInjuryIds.clear();
  deletedConditionIds.clear();
  for (const k of Object.keys(wipedAt)) delete wipedAt[k as HealthFeature];
  resetCoachSharePublisher();
  unsentWorkouts.clear();
  localStorage.removeItem(UNSENT_KEY);
  void initVault(null); // forget the data key on this device
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(GYMS_KEY);
  localStorage.removeItem(BODY_KEY);
  localStorage.removeItem(REST_KEY);
  localStorage.removeItem(COACH_KEY);
  localStorage.removeItem(HOME_KEY);
  localStorage.removeItem(INJURY_KEY);
  conditionsCache.clear();
  nicotineCache.clear();
  cycleCache.clear();
  alcoholCache.clear();
  supplementsCache.clear();
  localStorage.removeItem(ACTIVITIES_KEY);
  localStorage.removeItem(SLEEP_KEY);
  localStorage.removeItem(SLEEP_SCHED_KEY);
  localStorage.removeItem(SLEEP_SET_KEY);
  localStorage.removeItem(WEIGHT_UNIT_KEY);
  applyingRemotePrefs = true;
  try {
    resetWeekStart();
    pinsPref.reset();
    nextUpOffPref.reset();
    programSuggestOffPref.reset();
    resetTodayLayout();
  } finally {
    applyingRemotePrefs = false;
  }
  localStorage.removeItem(EX_UNIT_KEY);
  localStorage.removeItem(EX_LOAD_KEY);
  localStorage.removeItem(EX_REST_KEY);
  localStorage.removeItem(REST_PREFS_KEY);
  localStorage.removeItem(SHARED_GYMS_KEY);
  state = {
    workouts: [],
    gyms: [],
    sharedGyms: {},
    restPeriods: [],
    injuries: [],
    conditions: [],
    conditionsShare: 'effects',
    nicotine: emptyNicotineState(),
    cycle: emptyCycleState(),
    alcohol: emptyAlcoholState(),
    supplements: emptySupplementState(),
    activities: [],
    weightUnit: 'kg',
    exerciseUnits: {},
    exerciseLoadTypes: {},
    exerciseSides: {},
    exerciseRest: {},
    restPrefs: REST_PREFS_DEFAULT,
    mastery: { sinceYear: null, pattern: null, seenRating: null },
    bodyMetrics: EMPTY_BODY,
    sleeps: [],
    sleepSchedule: { sameEveryNight: true, every: null, byDay: {} },
    sleepSettings: {
      autoDim: false,
      autoLog: false,
      goalMin: 480,
      lastDimDay: null,
      skippedAutoSleepDates: [],
      patternOffer: 'unseen',
    },
    goals: EMPTY_GOALS,
    coach: { ...COACH_DEFAULT },
    home: EMPTY_HOME,
    queue: [],
    liveTrainees: [],
    syncStatus: 'pending',
    syncError: null,
    lastSyncAt: null,
  };
  pendingSleepDeletes.clear();
  persistSleepTombstones();
  emit();
}

export function __getStateForTests(): StoreState {
  return structuredClone(state);
}
export function __replaceStateForTests(next: StoreState): void {
  state = structuredClone(next);
  pendingSleepDeletes.clear();
  persistSleepTombstones();
  persist();
  emit();
}

export function __applySleepSnapshotForTests(serverSleeps: SleepNight[]): void {
  applySleepSnapshot(serverSleeps);
}
