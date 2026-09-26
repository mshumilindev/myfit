/** Live session + past workout editing — design S-17…S-31 + SS/DS/MG/EQ. */
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Shell } from '../App';
import type {
  DropEntry,
  Exercise,
  ExerciseKind,
  FailureMark,
  Gym,
  SetEntry,
  SetType,
  Workout,
} from '../types';
import { inferFailure, isFailure, suggestFailure, suggestionPresets } from '../failure';
import { StatShareSheet } from '../components/StatShareSheet';
import type { StatShareModel } from '../data/shareCard';
import { estimateRpe, readinessFactor, type RpeContext } from '../rpe';
import {
  SESSION_PLATEAU,
  dropTolerance,
  finalDrop,
  regionShares,
  sessionPlateau,
  setHardness,
  workingKg,
  marginalStimulus,
  muscleTally,
  performanceDrops,
  setStimuli,
  tiredVerdict,
  type SessionLift,
} from '../stimulus';
import { muscleFatigue, stalledMuscles } from '../fatigue';
import { PhotoSlider } from '../components/PhotoSlider';
import { SidesChip } from '../components/SidesChip';
import { MuscleStatePanel } from '../components/MuscleStatePanel';
import { cachedPersonalLandmarks } from '../personalize';
import { SPLIT_GROUPS } from '../data/subregions';
import { lastNight } from '../sleep';
import {
  REST_PRESETS,
  REST_PREFS_DEFAULT,
  planRest,
  type RestReason,
  fmtCountdown,
  primeRestAudio,
  requestRestNotifications,
  restAlert,
  useWakeLock,
  type RestPrefs,
} from '../restTimer';
import { haptic, isAppleTouch } from '../haptics';
import { cancelRestPush, enablePush, pushState, scheduleRestPush } from '../push';
import { useTodayPlan } from '../atlas/useTodayPlan';
import { AtlasFace } from '../components/AtlasFace';
import { AtlasDebrief } from '../components/AtlasDebrief';
import { TEMPER_COLOR, type Temper } from '../atlas/types';
import { setFact } from '../atlas/facts';
import { useAtlasFmt, voiceNow } from '../atlas/notes';
import {
  addExercise,
  attachGymToWorkout,
  clearSets,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  duplicateExercise,
  equipmentFor,
  gymKitEvidence,
  opensWithWarmupSession,
  warmupHabit,
  est1rm,
  exerciseKind,
  exerciseVolumeKg,
  finishWorkoutClean,
  groupAsSuperset,
  groupCurrentRound,
  groupRounds,
  isStrengthExercise,
  isTimedExercise,
  isMarkerExercise,
  restBeforeSetInWorkout,
  perHandFactor,
  sidesEligible,
  sidesFor,
  setExerciseSides,
  muscleSetsInWorkout,
  muscleWorkSorted,
  nextSupersetLetter,
  prevLift,
  recordWeight,
  recordE1rm,
  recentSessionsOf,
  exerciseRestSec,
  setExerciseRestSec,
  setRestPrefs,
  setBestE1rm,
  liftReference,
  dayKey,
  renameExercise,
  replaceExercise,
  setCardioMachine,
  cooldownInProgress,
  reopenWorkout,
  beginPastEdit,
  savePastWorkout,
  deletePastWorkout,
  resolveMuscles,
  restoreExercise,
  restoreSet,
  saveCatalogExercise,
  sessionBlocks,
  setCircuitRounds,
  setDrops,
  setRepsTotal,
  setTypeOf,
  setVolumeKg,
  topSet,
  ungroupSuperset,
  upsertSet,
  uuid,
  useStore,
  workoutCardioDistanceKm,
  workoutCardioMinutes,
  workoutEquipment,
  workoutSets,
  workoutVolumeKg,
  workoutDayReadout,
  programDayNameFor,
  reorderExercises,
  latestWeight,
  exerciseUnit,
  setExerciseUnit,
  loadTypeFor,
  setExerciseLoadType,
  bandLibraryFor,
  type DisplayUnit,
  type SupersetGroup,
  addGeneratedDayTo,
  setWorkSeconds,
} from '../store';
import { workoutCalories } from '../activities';
import { kgToLb, lbToKg } from '../plates';
import { bandForKg, assistStack, BAND_HEX, type BandRung, type LoadType } from '../loads';
import { LiveHero } from '../components/LiveHero';
import { SessionStartCoach, hasSessionStartCoach } from '../components/SessionStartCoach';
import { EnergyPlaque, LiveEnergyCounter } from '../components/SessionEnergy';
import { PlateSheet } from '../components/PlateSheet';
import { BandLibraryCard } from '../components/BandLibraryCard';
import { EquipmentPickerSheet } from '../components/EquipmentPickerSheet';
import { CardioMachineList, CardioMachineSheet } from '../components/CardioMachineList';
import { ExercisePicker, ExerciseDetail } from '../components/ExercisePicker';
import { buildPickItems } from '../picker';
import {
  cardioMachineOf,
  cardioProfile,
  entrySpeedKmh,
  pace500Sec,
  type CardioField,
} from '../cardio';
import { SessionMuscleMap } from '../components/SessionMuscleMap';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';
import {
  EquipChip,
  MuscleChip,
  MuscleRow,
  MuscleIcon,
  MuscleDetailContext,
  MuscleSetChip,
  MuscleBreakdownList,
  MUSCLE_IDS,
  equipmentIconName,
  withMuscleBreak,
} from '../components/Muscle';
import { EQUIPMENT_IDS } from '../data/equipment';
import { nextTarget, topHistory } from '../progression';
import { starterPlan } from '../starterPlan';
import { computePlaybook, playForWeekday, type Play } from '../playbook';
import { equipmentById } from '../data/equipmentCatalog';
import { muscleTintClass, photoTintClass } from '../photoTint';
import { GymKitCard, GymKitTray, GymKitUndo } from '../components/GymKit';
import { gymHasNoList, type KitEvidence } from '../gymEvidence';
import { warmupRamp } from '../sessionBuilder';
import { directReadiness } from '../picker';
import { READINESS_COLOR, muscleReadiness } from '../recovery';
import { dayReadoutLabel } from '../data/daySuggest';
import { drawShareCard, cardBlob, type ShareModel, type ShareFormat } from '../data/shareCard';
import {
  canonicalExerciseName,
  exercisesForSubRegions,
  richExerciseByName,
  exerciseImage,
  isCardioExerciseName,
  MARKER_IMAGES,
  subRegionsByName,
  type MuscleGroup,
} from '../data/exercises';
import {
  fmtClock,
  fmtDayMonth,
  fmtDurationHM,
  fmtDurationHuman,
  fmtFullDate,
  fmtKg,
  fmtSessionClock,
  fmtSet,
  fmtSetSnack,
  fmtTonnes,
  useT,
} from '../i18n';
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  ExerciseName,
  useExerciseName,
  Icon,
  Sheet,
  Switch,
  useIsDesktop,
} from '../ui';
import type { Strings } from '../i18n/en';
import { getRole } from '../api';

const PICKER_TARGET_MUSCLES = new Set<string>(MUSCLE_IDS);

/** m:ss for a static-dynamic hold time stored as fractional minutes. */
function fmtHold(min: number | null | undefined): string {
  const sec = Math.round((min ?? 0) * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** m:ss for rest durations (pure — safe in render). */
function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, '0')}`;
}

function fmtWeightValue(kg: number): string {
  return kg.toFixed(1);
}

function fmtWeightKg(kg: number): string {
  return `${fmtWeightValue(kg)} kg`;
}

/** Ghost-row proposal; timed exercises carry duration/distance instead of kg. */
type GhostValues = {
  reps: number;
  weight: number | null;
  durationMin?: number;
  /** A continued drop / reverse / static-dynamic set opens the editor already typed. */
  type?: SetType;
  drops?: DropEntry[];
  holdMin?: number | null;
} & Partial<MachineReadings>;

/** Cardio console readings carried from the last entry into the next one. */
type MachineReadings = Pick<
  SetEntry,
  'distanceKm' | 'speedKmh' | 'inclinePct' | 'watts' | 'level' | 'floors'
>;
type TimedGhost = { durationMin: number } & MachineReadings;

/** Column header for a cardio field in the set grid. */
function cardioFieldCol(t: Strings, f: CardioField): string {
  return f === 'distance'
    ? t.distanceKmCol
    : f === 'speed'
      ? t.speedCol
      : f === 'incline'
        ? t.inclineCol
        : f === 'watts'
          ? t.wattsCol
          : f === 'level'
            ? t.levelCol
            : t.floorsCol;
}
/** The value one cardio field reads on an entry (speed derived if not typed). */
function cardioFieldVal(s: Partial<SetEntry>, f: CardioField): number | null {
  const v =
    f === 'distance'
      ? s.distanceKm
      : f === 'speed'
        ? s.speedKmh || entrySpeedKmh(s as SetEntry)
        : f === 'incline'
          ? s.inclinePct
          : f === 'watts'
            ? s.watts
            : f === 'level'
              ? s.level
              : s.floors;
  return v != null && v > 0 ? Math.round(v * 10) / 10 : null;
}

type OptsTab = 'set' | 'exercise' | 'session';

/** Wall-clock ms for event handlers (kept out of render purity checks). */
const wallClock = (): number => Date.now();

/** autoRestFor results by set state (see there). */
const restPlanCache = new Map<
  string,
  { sec: number; reasons: { key: RestReason; sec: number }[] }
>();

type SheetState =
  | { kind: 'add'; intoGroupId?: string }
  | {
      kind: 'edit';
      exId: string;
      set: SetEntry | null;
      /** Prefill for a not-yet-logged set: what the ghost row is proposing. */
      ghost: GhostValues;
    }
  | { kind: 'menu'; exId: string }
  /** Focus mode's single options door: This set · Exercise · Session tabs. */
  | {
      kind: 'opts';
      tab: OptsTab;
      exId: string | null;
      set: SetEntry | null;
      ghost: GhostValues | null;
    }
  | { kind: 'replace'; exId: string }
  | { kind: 'equip'; exId: string }
  | { kind: 'cardio-machine'; exId: string }
  | { kind: 'group-menu'; groupId: string }
  | { kind: 'superset'; exId: string }
  | { kind: 'gym' }
  | { kind: 'musclemap' }
  | { kind: 'settings' }
  | { kind: 'circuit-run'; groupId: string }
  | { kind: 'coach' }
  /** Rest target + alert prefs for one lift (tap the rest ring). */
  | { kind: 'rest'; exName: string }
  | null;

type DialogState =
  | { kind: 'del-ex'; exId: string }
  | { kind: 'del-set'; exId: string; setId: string }
  | { kind: 'finish-warn'; emptyName: string | null }
  | { kind: 'del-workout' }
  | null;

export function rectHasVisiblePixels(
  rect: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>,
  viewport: { width: number; height: number },
): boolean {
  return (
    rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height
  );
}

/**
 * Share-summary bottom sheet (AC-3.2): live canvas preview, format toggle,
 * and native-share / save / copy. Drawing is offline and separate from the
 * live UI. Defined at module scope so it isn't re-created each render.
 */
function ShareSheet(props: {
  model: ShareModel;
  isDesktop: boolean;
  t: ReturnType<typeof useT>['t'];
  shell: Shell;
  onClose: () => void;
}) {
  const { t, model } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<ShareFormat>(props.isDesktop ? 'square' : 'story');
  const [busy, setBusy] = useState(false);
  const fileName = 'workout.png';

  useEffect(() => {
    if (canvasRef.current) drawShareCard(canvasRef.current, model, format);
  }, [model, format]);

  async function withBlob(fn: (b: Blob) => void | Promise<void>): Promise<void> {
    const cv = canvasRef.current;
    if (!cv) return;
    setBusy(true);
    try {
      const b = await cardBlob(cv);
      if (b) await fn(b);
    } catch {
      /* user cancelled the share, or unsupported */
    } finally {
      setBusy(false);
    }
  }

  function download(b: Blob): void {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function nativeShare(b: Blob): Promise<void> {
    const file = new File([b], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: model.title });
    } else {
      download(b);
    }
  }

  async function copy(b: Blob): Promise<void> {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      props.shell.toast({ kind: 'ok', icon: 'copy', text: t.shareCopied });
    } else {
      download(b);
    }
  }

  return (
    <Sheet className="share-sheet" onClose={props.onClose}>
      <div className="share-head">
        <h3>{t.shareSheetTitle}</h3>
        <div className="share-format" role="tablist">
          <button className={format === 'story' ? 'on' : ''} onClick={() => setFormat('story')}>
            {t.shareFormatStory}
          </button>
          <button className={format === 'square' ? 'on' : ''} onClick={() => setFormat('square')}>
            {t.shareFormatSquare}
          </button>
        </div>
      </div>
      <div className={`share-preview ${format}`}>
        <canvas ref={canvasRef} className="share-canvas" />
      </div>
      <div className="share-actions">
        {props.isDesktop ? (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(download)}
          >
            <Icon name="download-simple" />
            {t.shareDownload}
          </button>
        ) : (
          <button
            className="btn btn-primary grow"
            disabled={busy}
            onClick={() => withBlob(nativeShare)}
          >
            <Icon name="export" />
            {t.shareToStories}
          </button>
        )}
        {!props.isDesktop && (
          <button
            className="btn btn-secondary share-icon-btn"
            disabled={busy}
            onClick={() => withBlob(download)}
            aria-label={t.shareSaveImage}
            title={t.shareSaveImage}
          >
            <Icon name="download-simple" />
          </button>
        )}
        <button
          className="btn btn-secondary share-icon-btn"
          disabled={busy}
          onClick={() => withBlob(copy)}
          aria-label={t.shareCopy}
          title={t.shareCopy}
        >
          <Icon name="copy" />
        </button>
      </div>
    </Sheet>
  );
}

export function SessionView(props: {
  workoutId: string;
  past?: boolean;
  startAdd?: boolean;
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const exName = useExerciseName();
  const store = useStore();
  // Day-aware suggestions & muscle readouts are always on (not flagged).
  const suggestOn = true;
  const workout = store.workouts.find((w) => w.id === props.workoutId);
  // A past session is edited as a draft — snapshot it on open so leaving without
  // Save reverts (or drops a fresh backfill). Runs once per editor.
  useEffect(() => {
    if (props.past) beginPastEdit(props.workoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sheet, setSheet] = useState<SheetState>(null);
  // Full-screen exercise photos (start → end frames) from the focus card.
  const [photoView, setPhotoView] = useState<{ images: string[]; title: string } | null>(null);
  const [circuit, setCircuit] = useState<{ on: boolean; groupId: string | null; rounds: number }>({
    on: false,
    groupId: null,
    rounds: 4,
  });
  // Live count-up timer for a timed exercise (TIMED-1/2): Start → count-up, Stop → log held time.
  // Cardio interval timer (Start → Finish, repeatable). Persisted per workout so
  // a screen lock, reload or hopping to another screen mid-interval keeps it.
  const [timingRaw, setTimingRaw] = useState<{
    workoutId: string;
    exId: string;
    startedAt: number;
  } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('spotter.session.timing') ?? 'null');
    } catch {
      return null;
    }
  });
  const timing = timingRaw && timingRaw.workoutId === props.workoutId ? timingRaw : null;
  const setTiming = (v: { exId: string; startedAt: number } | null): void => {
    const next = v ? { ...v, workoutId: props.workoutId } : null;
    setTimingRaw(next);
    try {
      if (next) localStorage.setItem('spotter.session.timing', JSON.stringify(next));
      else localStorage.removeItem('spotter.session.timing');
    } catch {
      /* ignore */
    }
  };
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [summary, setSummary] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const atlasFmt = useAtlasFmt();
  const [atlasJab, setAtlasJab] = useState<{ text: string; temper: Temper; key: string } | null>(
    null,
  );
  useEffect(() => {
    if (!atlasJab) return;
    const id = window.setTimeout(() => setAtlasJab(null), 6000);
    return () => window.clearTimeout(id);
  }, [atlasJab]);
  // Atlas's day, offered on an empty session (main-coach role, a plan weekday).
  const todayPlan = useTodayPlan(
    workout && workout.exercises.length === 0 && !props.past ? workout.startedAt : 0,
    props.workoutId,
  );
  /** Share-summary bottom sheet open (AC-3.2). */
  const [shareOpen, setShareOpen] = useState(false);
  /** Past workout cards start collapsed for reading (SS-3). */
  const [expandedPast, setExpandedPast] = useState<string[]>([]);
  /** The set logged most recently in this visit — its row reads “just now”. */
  const [recentSetId, setRecentSetId] = useState<string | null>(null);
  /** This rest's ±15 s nudges / skip, keyed by the set that started it. */
  const [restAdj, setRestAdj] = useState<{ at: number; delta: number; skip: boolean }>({
    at: 0,
    delta: 0,
    skip: false,
  });
  /** Tired-muscle banner collapsed, per exercise (never dismissed). */
  const [tiredCollapsed, setTiredCollapsed] = useState<Record<string, boolean>>({});
  /** Exercise details opened from a suggestion tile (ⓘ). */
  const [tiredInfo, setTiredInfo] = useState<string | null>(null);
  // Empty session: the Playbook day offered when the big card is tapped.
  const [playSheet, setPlaySheet] = useState<{ play: Play; hero: TiredPick } | null>(null);
  // Gym kit nudge: items dismissed this session, and the Undo after an add.
  const [kitDismissed, setKitDismissed] = useState<string[]>([]);
  const [kitUndo, setKitUndo] = useState<{ items: string[]; inventory: string[] } | null>(null);
  /** The record's share-card sheet (same as the app's other share cards). */
  const [prShare, setPrShare] = useState<StatShareModel | null>(null);
  /** A record just set — shown as a celebration card, then folds into rest. */
  const [prMoment, setPrMoment] = useState<{
    setId: string;
    at: number;
    name: string;
    w: number;
    reps: number;
    e1: number;
    e1Prev: number;
    wPrev: number;
    vol: number;
    volPrev: number;
  } | null>(null);
  /** The single card the user has explicitly expanded (queued row tap, or
   * start/add-next). Overrides the derived active card while it points at a
   * still-present exercise. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Focus is the only live-session view: one exercise full-screen with
   *  Back/Next (past sessions still show the list). */
  const focusMode = true;
  const [focusStarted, setFocusStarted] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  /** An exercise just added/duplicated — the focus jumps to its step. */
  const [focusJumpId, setFocusJumpId] = useState<string | null>(null);
  /** A superset member picked by hand — holds until the group's next log. */
  const [focusPick, setFocusPick] = useState<{ id: string; logged: number } | null>(null);
  const isDesktop = useIsDesktop();
  const startAddConsumed = useRef(false);

  const live = !!workout && workout.finishedAt === null && !props.past;
  // Keep the screen on through a live workout so the rest alert fires on time.
  useWakeLock(live && (store.restPrefs ?? REST_PREFS_DEFAULT).keepAwake);
  // In focus mode, adding (or duplicating) an exercise jumps the view straight
  // to it. Kept above the early return so hook order stays stable.
  const focusIdsKey = workout
    ? [...workout.exercises]
        .sort((a, b) => a.position - b.position)
        .map((e) => e.id)
        .join('|')
    : '';
  const focusIdsRef = useRef(focusIdsKey);
  const focusAutoOn = focusMode && live && !props.past;
  useEffect(() => {
    const ids = focusIdsKey ? focusIdsKey.split('|') : [];
    const prev = focusIdsRef.current ? focusIdsRef.current.split('|') : [];
    if (focusAutoOn && ids.length > prev.length) {
      const prevSet = new Set(prev);
      const addedId = ids.find((id) => !prevSet.has(id));
      if (addedId) setFocusJumpId(addedId);
    }
    focusIdsRef.current = focusIdsKey;
  }, [focusIdsKey, focusAutoOn]);
  const openMuscleHistory = (muscle: MuscleGroup) =>
    props.shell.openOverlay({ screen: 'muscle-history', muscle });

  // Rest count-ups only tick while the session is live — they must freeze the
  // moment the workout is finished or discarded (no ticking on a past session).
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [live]);

  // Adding an exercise scrolls the content down to it (and the live energy
  // counter beneath), so the new card doesn't stay hidden below the fold.
  const contentBottomRef = useRef<HTMLDivElement | null>(null);
  const prevExCount = useRef(workout?.exercises.length ?? 0);
  const exCount = workout?.exercises.length ?? 0;
  useEffect(() => {
    if (exCount > prevExCount.current) {
      contentBottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }
    prevExCount.current = exCount;
  }, [exCount]);

  useEffect(() => {
    if (!props.startAdd || startAddConsumed.current || !workout) return;
    startAddConsumed.current = true;
    setSheet({ kind: 'add' });
  }, [props.startAdd, workout]);

  // Left milestone rail: which exercise card is currently the most-visible in
  // the viewport (scroll-spy). The observer callback fires asynchronously on
  // scroll, so the only setState here happens there — never synchronously in
  // the effect body.
  // The rail highlights whichever exercise is expanded (the one you're working
  // on), so no scroll-spy observer is needed.

  // Records BEFORE this workout, per exercise name — for PR detection.
  const baseline = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of workout?.exercises ?? []) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.toLowerCase();
      if (!m.has(key)) m.set(key, recordWeight(e.name, props.workoutId));
    }
    return m;
    // Depend on the whole history, not just this workout's exercise count:
    // recordWeight() reads every past session, so a resumed session or a cold
    // open (history still syncing in when the view mounts) must recompute once
    // the prior sessions arrive — otherwise the all-time best stays stale (often
    // 0) and a sub-PR set is wrongly tagged a record.
  }, [store.workouts, props.workoutId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!workout) return null;

  const sets = workoutSets(workout);
  const entries = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const volume = workoutVolumeKg(workout);
  const cardioMinutes = workoutCardioMinutes(workout);
  const cardioDistance = workoutCardioDistanceKm(workout);
  // Session energy estimate (feature 6) — shown on the finished-session summary.
  const sessionKcal = workoutCalories(
    workout,
    latestWeight(store.bodyMetrics)?.weight ?? null,
    workout.finishedAt ?? now,
  );
  const gym = store.gyms.find((g) => g.id === workout.gymId) ?? null;
  const gymName = gym?.name;
  const prescribedSets = workout.exercises.reduce((n, e) => n + Math.max(0, e.plannedSets ?? 0), 0);
  const loggedPrescribedSets = workout.exercises.reduce(
    (n, e) => n + Math.min(e.sets.length, Math.max(0, e.plannedSets ?? 0)),
    0,
  );
  const planPercent =
    prescribedSets > 0 ? Math.round((loggedPrescribedSets / prescribedSets) * 100) : 0;
  const sortedExercises = [...workout.exercises].sort((a, b) => a.position - b.position);

  // The most-recently logged set across the whole session — drives the live
  // rest clock and marks the only exercise whose rest is still "running" (a set
  // logged elsewhere ends the previous card's rest).
  const allSetsChrono = sortedExercises
    .flatMap((e) => e.sets.map((s) => ({ exId: e.id, s })))
    .filter((x) => x.s.loggedAt != null)
    .sort((a, b) => (a.s.loggedAt as number) - (b.s.loggedAt as number));
  const lastChrono = allSetsChrono[allSetsChrono.length - 1] ?? null;
  const lastLoggedAt = lastChrono ? (lastChrono.s.loggedAt as number) : 0;
  const lastLoggedExId = lastChrono ? lastChrono.exId : null;
  // Rest only runs between efforts — it's off while a cardio interval is on the
  // clock and for the whole cool-down (back on once a set is logged again).
  const cooldownNow = live ? cooldownInProgress(workout) : null;
  const restRunning = live && lastLoggedAt > 0 && !timing && !cooldownNow;

  // "Current" follows where you are actually working. If your most-recently
  // logged set is on an exercise that still has sets to go (planned remaining,
  // or any unplanned exercise you're mid-way through), that's the current one —
  // even if an earlier exercise is still unfinished (you skipped ahead). Only
  // when nothing is in progress do we fall back to the first incomplete
  // exercise by position.
  const incompleteById = (ex: Exercise): boolean => {
    if (isMarkerExercise(ex)) return false;
    const planned = Math.max(0, ex.plannedSets ?? 0);
    return planned > 0 ? ex.sets.length < planned : ex.sets.length === 0;
  };
  const lastLoggedEx = lastLoggedExId ? sortedExercises.find((e) => e.id === lastLoggedExId) : null;
  const lastLoggedStillGoing =
    lastLoggedEx && !isMarkerExercise(lastLoggedEx)
      ? Math.max(0, lastLoggedEx.plannedSets ?? 0) > 0
        ? lastLoggedEx.sets.length < (lastLoggedEx.plannedSets as number)
        : true
      : false;
  const activeExerciseId =
    (lastLoggedStillGoing ? lastLoggedEx!.id : null) ??
    sortedExercises.find(incompleteById)?.id ??
    sortedExercises[0]?.id ??
    null;
  // Exactly one card is expanded at a time: normally the derived active
  // exercise, but tapping a queued row (or starting/adding the next one)
  // focuses that one instead, until a set is logged returns focus to active.
  // Focus mode walks every exercise one at a time — a warm-up marker gets its
  // own slide too, so it doesn't silently vanish from the focus flow.
  // A superset or circuit is ONE focus step: its members are done in turns,
  // so they share a slide (the same block the classic list rendered).
  const focusBlocks = sessionBlocks(workout);
  const focusSteps = focusBlocks.map((b) =>
    b.kind === 'group' ? b.group.exercises : [b.exercise],
  );
  const focusCount = focusSteps.length;
  const focusPos = Math.min(Math.max(0, focusIdx), Math.max(0, focusCount - 1));
  const focusBlock = focusBlocks[focusPos] ?? null;
  const focusGroup = focusBlock?.kind === 'group' ? focusBlock.group : null;
  // In a group, the member whose turn it is (fewest sets logged, in order).
  const focusGroupLogged = focusGroup
    ? focusGroup.exercises.reduce((n, e) => n + e.sets.length, 0)
    : 0;
  const focusEx = focusGroup
    ? (() => {
        const picked =
          focusPick && focusPick.logged === focusGroupLogged
            ? focusGroup.exercises.find((e) => e.id === focusPick.id)
            : undefined;
        if (picked) return picked;
        const min = Math.min(...focusGroup.exercises.map((e) => e.sets.length));
        return focusGroup.exercises.find((e) => e.sets.length === min) ?? null;
      })()
    : (focusSteps[focusPos]?.[0] ?? null);
  const focusHasNext = focusPos < focusCount - 1;
  const focusStepOf = (exId: string): number =>
    focusSteps.findIndex((st) => st.some((e) => e.id === exId));
  const focusView = focusMode && live && !props.past;
  const focusedId =
    focusView && focusEx
      ? focusEx.id
      : expandedId && sortedExercises.some((e) => e.id === expandedId)
        ? expandedId
        : activeExerciseId;
  // Open on the exercise you're on: the first warm-up of a fresh session,
  // otherwise the active one. Once per mount — after that Back/Next rule.
  if (!focusStarted && focusView) {
    setFocusStarted(true);
    const fresh = sortedExercises.every((e) => e.sets.length === 0);
    const i =
      fresh && focusSteps[0]?.[0] && isMarkerExercise(focusSteps[0][0])
        ? 0
        : activeExerciseId
          ? focusStepOf(activeExerciseId)
          : 0;
    if (i > 0 && i !== focusIdx) setFocusIdx(i);
  }
  if (focusJumpId) {
    const i = focusStepOf(focusJumpId);
    setFocusJumpId(null);
    if (i >= 0 && i !== focusIdx) setFocusIdx(i);
  }
  // The next not-yet-started exercise after the active one — drives the
  // "start next exercise" shortcut on the active card.
  // "Next" is relative to the exercise you're looking at (the expanded one), so
  // advancing follows what you see rather than a separately-derived active one.
  const focusedIdx = sortedExercises.findIndex((e) => e.id === focusedId);
  const nextEx =
    focusedIdx >= 0
      ? (sortedExercises
          .slice(focusedIdx + 1)
          .find((e) => !isMarkerExercise(e) && e.sets.length === 0) ?? null)
      : null;
  // The left milestone rail shows on the phone during a LIVE session once
  // there's more than one exercise (not in history); the screen gets a class so
  // the content can inset to clear it.
  const showRail = live && !isDesktop && workout.exercises.length > 0 && sortedExercises.length > 1;
  // On a live phone session the muscle-map opener lives in the floating pill
  // (same condition as the pill), not inline in the "muscles worked" header.
  const muscleMapInPill = live && !workout.autoFinished && !isDesktop;
  // A rail dot reads as "done" once its planned sets are logged (or, unplanned,
  // once it has any set); markers count as done.
  const exerciseDone = (ex: Exercise): boolean => {
    if (isMarkerExercise(ex)) return true;
    const planned = Math.max(0, ex.plannedSets ?? 0);
    return planned > 0 ? ex.sets.length >= planned : ex.sets.length > 0;
  };
  const lastTimeRows = sortedExercises
    .filter((e) => isStrengthExercise(e))
    .map((e) => ({ name: e.name, prev: prevLift(e.name, workout.id) }))
    .filter((r) => r.prev);
  const showSessionSide =
    !!(live || props.past) &&
    !!(gym || lastTimeRows.length > 0 || entries > 0) &&
    // an empty live session (draft) has nothing to sum up yet — its own
    // layout uses the full width
    !(live && workout.exercises.length === 0);

  /**
   * What the next set should be. Once a working set is logged, repeat it (the
   * user may have tuned the load). Before that — with nothing logged, or only
   * warm-ups so far — walk the recommended ramp: warm-up weights first, then the
   * working target (which already carries this session's progression bump, so it
   * can sit at or above last time's working weight). `warmup` marks the ramp
   * phase so the quick-log stores those as warm-up sets and the sequence climbs.
   */
  function ghostFor(ex: Exercise): {
    reps: number;
    weight: number | null;
    warmup?: boolean;
    /** Warm-up ramp position (1-based) / length / the working weight it builds to. */
    ramp?: { i: number; n: number; toKg: number };
    /** Carried from the last set when it was a drop / reverse / static-dynamic,
     *  so the next set continues the same technique. */
    type?: SetType;
    drops?: DropEntry[];
    holdMin?: number | null;
  } {
    const sets = ex.sets;
    // Continue from the last logged WORKING set.
    for (let i = sets.length - 1; i >= 0; i--) {
      const s = sets[i];
      // null = bodyweight: keep it, so a pull-up ghost reads BW, not 0 kg
      if (!s.isWarmup && setTypeOf(s) !== 'warmup') {
        const ty = setTypeOf(s);
        if (ty === 'drop' || ty === 'reverse-drop' || ty === 'static-dynamic')
          return {
            reps: s.reps,
            weight: s.weight ?? null,
            type: ty,
            drops: s.drops ?? [],
            holdMin: s.durationMin ?? null,
          };
        return { reps: s.reps, weight: s.weight ?? null };
      }
    }
    // No working set yet — sequence the ramp, then the working target.
    if (isStrengthExercise(ex)) {
      const loadType = loadTypeFor(ex);
      const target = nextTarget(
        topHistory(
          store.workouts.filter((w) => w.finishedAt !== null),
          ex.name,
          workout!.startedAt,
        ),
        {
          plannedReps: ex.plannedReps,
          equipment: ex.equipment,
          primary: (ex.primaryMuscle as MuscleGroup | null) ?? undefined,
          loadType,
        },
      );
      if (loadType === 'weight' && target.weight != null && target.weight > 0) {
        const compound = richExerciseByName(ex.name)?.mechanic === 'compound';
        const ramp = warmupRamp(target.weight, { loadType, compound });
        // The ramp follows what was actually logged: steps at or below the
        // heaviest set so far are done, and once you've reached the working
        // weight (however you got there) the warm-ups are over.
        const heaviest = sets.reduce((m, s) => Math.max(m, s.weight ?? 0), 0);
        const left =
          heaviest >= target.weight ? [] : ramp.filter((w) => (w.weight ?? 0) > heaviest);
        if (left.length > 0) {
          const w = left[0];
          return {
            reps: w.reps,
            weight: w.weight ?? null,
            warmup: true,
            ramp: { i: ramp.length - left.length + 1, n: ramp.length, toKg: target.weight },
          };
        }
        return { reps: target.reps, weight: target.weight };
      }
      if (target.weight != null) return { reps: target.reps, weight: target.weight };
    }
    // Fallbacks: previous session, then the last set, then the plan.
    const prev = prevLift(ex.name, workout!.id);
    if (prev) return { reps: ex.plannedReps ?? prev.reps, weight: prev.weight };
    const last = sets[sets.length - 1];
    if (last) return { reps: last.reps, weight: last.weight ?? null };
    if (ex.plannedReps) return { reps: ex.plannedReps, weight: null };
    return { reps: 8, weight: 20 };
  }

  /** "then 60 × 8 · 40 × 8" under a continued drop set; hold time for S/D. */
  function ghostTechniqueNote(g: {
    type?: SetType;
    drops?: DropEntry[];
    holdMin?: number | null;
  }): string | undefined {
    if ((g.type === 'drop' || g.type === 'reverse-drop') && g.drops?.length)
      return `+ ${g.drops.map((d) => fmtSet(d.weight, d.reps)).join(' · ')}`;
    return undefined;
  }

  /** A proposed warm-up the athlete loads up to the working weight is logged
   *  as a working set — the ramp is a suggestion, not a label to enforce. */
  function ghostKind(
    g: { warmup?: boolean; ramp?: { toKg: number }; type?: SetType },
    kg: number | null,
  ): SetType {
    if (g.type) return g.type;
    if (!g.warmup) return 'working';
    return g.ramp && kg !== null && kg >= g.ramp.toKg ? 'working' : 'warmup';
  }

  function timedGhostFor(ex: Exercise): TimedGhost {
    const last = ex.sets[ex.sets.length - 1];
    if (last)
      return {
        durationMin: last.durationMin ?? 10,
        distanceKm: last.distanceKm ?? null,
        speedKmh: last.speedKmh ?? null,
        inclinePct: last.inclinePct ?? null,
        watts: last.watts ?? null,
        level: last.level ?? null,
        floors: last.floors ?? null,
      };
    const kind = exerciseKind(ex);
    if (ex.plannedDurationMin) {
      return {
        durationMin: ex.plannedDurationMin,
        distanceKm: kind === 'cardio' ? null : null,
      };
    }
    // A machine without a distance console shouldn't be pre-filled with 2 km.
    const withDistance = kind === 'cardio' && cardioProfile(ex).fields.includes('distance');
    return { durationMin: kind === 'cardio' ? 20 : 8, distanceKm: withDistance ? 2 : null };
  }

  function isRecordSet(ex: Exercise, s: SetEntry): boolean {
    if (!isStrengthExercise(ex)) return false;
    // Assist (negative kg) and band (estimate) don't carry weight records.
    if (loadTypeFor(ex) !== 'weight') return false;
    // Only plain working sets carry the record tint — a drop row already says
    // “drop”, and its record still counts in history (SS-3 note).
    if (setTypeOf(s) !== 'working' || (s.weight ?? 0) <= 0) return false;
    const base = baseline.get(ex.name.toLowerCase()) ?? 0;
    if ((s.weight ?? 0) <= base) return false;
    const best = topSet(ex.sets);
    return best?.id === s.id;
  }

  /**
   * Append a brand-new set. Takes the whole entry so set type, drops and the
   * timed fields survive — the sheet can create any kind of set, not just a
   * plain working one.
   */
  function logNewSet(
    ex: Exercise,
    vals: Omit<SetEntry, 'id' | 'position'>,
    /** What the set card proposed — lets a missed target read as failure. */
    target?: { reps: number; weight: number | null } | null,
  ): string {
    const base = Math.max(
      baseline.get(ex.name.toLowerCase()) ?? 0,
      ...ex.sets.filter((s) => setTypeOf(s) !== 'warmup').map((s) => s.weight ?? 0),
    );
    const e1Base = Math.max(recordE1rm(ex.name, workout!.id), ...ex.sets.map(setBestE1rm));
    const type: SetType = vals.type ?? (vals.isWarmup ? 'warmup' : 'working');
    // Nobody rated the effort → estimate it from history + today's state.
    const priorWorking = ex.sets.filter((s) => setTypeOf(s) !== 'warmup').length;
    const rpeAuto =
      vals.rpe == null && type !== 'warmup' && type !== 'static-dynamic'
        ? rpeEstimateFor(ex, vals.weight, vals.reps, priorWorking)
        : null;
    // Failure: an explicit mark (F / flame) wins; otherwise infer it from what
    // was actually logged (failure.ts) and tag it 'auto' — dismissable.
    let failure: FailureMark | null = vals.failure ?? null;
    let failureWhy: string | null = null;
    if (!failure && isStrengthExercise(ex)) {
      const why = inferFailure(
        {
          ...vals,
          type,
          rpeAuto,
          restSec: lastLoggedAt > 0 ? Math.round((wallClock() - lastLoggedAt) / 1000) : null,
        },
        { target, before: ex.sets },
      );
      if (why) {
        failure = 'auto';
        failureWhy = why;
      }
    }
    // The rest that this set ends: remember its target so the table can say
    // when it was cut short.
    let restTarget: number | null = null;
    if (live && restRunning && lastChrono) {
      const lastEx = workout!.exercises.find((e) => e.id === lastLoggedExId);
      if (lastEx && !isMarkerExercise(lastEx)) {
        const base = restTargetSec(lastEx, lastChrono.s);
        const d = restAdj.at === lastLoggedAt ? restAdj.delta : 0;
        restTarget = base > 0 ? Math.max(0, base + d) : null;
      }
    }
    const id = uuid();
    // Atlas's jab on this set (short rest vs plan, reps falling off).
    if (live && isStrengthExercise(ex) && type === 'working') {
      const prev = [...ex.sets].reverse().find((x) => setTypeOf(x) === 'working') ?? null;
      const f = setFact({
        workoutId: workout!.id,
        setId: id,
        exercise: ex.name,
        reps: vals.reps,
        weight: vals.weight ?? null,
        prev: prev ? { reps: prev.reps, weight: prev.weight } : null,
        restSec:
          lastLoggedAt > 0
            ? (wallClock() - lastLoggedAt) / 1000 - setWorkSeconds({ reps: vals.reps })
            : null,
        restTargetSec: restTarget,
        at: wallClock(),
      });
      const v = f ? voiceNow(f, store, wallClock(), locale, atlasFmt) : null;
      if (v) setAtlasJab({ ...v, key: id });
    }
    upsertSet(workout!.id, ex.id, {
      ...vals,
      ...(restTarget ? { restTargetSec: restTarget } : {}),
      ...(failure ? { failure, failureWhy } : {}),
      ...(rpeAuto != null ? { rpeAuto } : {}),
      id,
    });
    setRecentSetId(id);
    primeRestAudio();
    if ((store.restPrefs ?? REST_PREFS_DEFAULT).vibrate) haptic('tick');
    const w = vals.weight ?? 0;
    if (type === 'working' && loadTypeFor(ex) === 'weight' && w > 0) {
      const e1 = est1rm(w, vals.reps);
      const weightRecord = w > base && base > 0;
      const e1Record = e1 > e1Base && e1Base > 0;
      if (weightRecord || e1Record) {
        if (focusView) {
          const volPrev = Math.max(
            0,
            ...recentSessionsOf(ex.name, workout!.id, 30).flatMap((x) =>
              x.sets.filter((s) => setTypeOf(s) === 'working').map((s) => (s.weight ?? 0) * s.reps),
            ),
            ...ex.sets
              .filter((s) => setTypeOf(s) === 'working')
              .map((s) => (s.weight ?? 0) * s.reps),
          );
          setPrMoment({
            setId: id,
            at: wallClock(),
            name: ex.name,
            w,
            reps: vals.reps,
            e1,
            e1Prev: e1Base,
            wPrev: base,
            vol: w * vals.reps,
            volPrev,
          });
          if ((store.restPrefs ?? REST_PREFS_DEFAULT).vibrate) haptic('success');
        } else if (weightRecord) {
          props.shell.toast({
            kind: 'ok',
            icon: 'trophy',
            text: t.newRecordToast(ex.name, `${fmtWeightKg(w)} × ${vals.reps}`),
          });
        }
      }
    }
    return id;
  }

  /** Icon-only exercise-options button for a collapsed row — opens the menu
   * sheet WITHOUT expanding the card (the click stops here). */
  const cardCfg = (exId: string) => (
    <button
      type="button"
      className="card-cfg"
      aria-label={t.menuAction}
      onClick={(e) => {
        e.stopPropagation();
        setSheet({ kind: 'menu', exId });
      }}
    >
      <Icon name="gear" />
    </button>
  );
  function rowKey(e: { key: string; preventDefault: () => void }, fn: () => void): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  }

  /** What we know about the athlete today for an effort estimate (rpe.ts):
   *  the lift's recent strength, time away, illness, fatigue, sleep and the
   *  sets already done on it this session. */
  function rpeCtxFor(ex: Exercise, priorSets: number): RpeContext {
    const at = wallClock();
    const ref = liftReference(ex.name, workout!.id, 56, at);
    // Today's own sets count too: a stronger day raises the reference, so the
    // next sets aren't all read as maximal.
    ref.refE1 = Math.max(ref.refE1, ...ex.sets.map(setBestE1rm));
    const today = dayKey(at);
    let illnessDaysAgo: number | null = null;
    for (const r of store.restPeriods ?? []) {
      if (r.mode !== 'illness' || r.startDay > today) continue;
      const ago = r.open || r.endDay >= today ? 0 : today - r.endDay;
      if (ago < 14 && (illnessDaysAgo === null || ago < illnessDaysAgo)) illnessDaysAgo = ago;
    }
    const primary = resolveMuscles(ex).primary;
    const fat = primary
      ? (muscleFatigue(
          store.workouts.filter((w) => w.finishedAt !== null && w.id !== workout!.id),
          at,
          cachedPersonalLandmarks(store.workouts, at),
        ).get(primary)?.score ?? 0)
      : 0;
    const night = lastNight(store.sleeps, at);
    const slept =
      night && night.wake !== null && at - night.wake < 18 * 3600000
        ? (night.wake - night.bedtime) / 3600000
        : null;
    return {
      refE1: ref.refE1,
      daysSinceLift: ref.daysSinceLift,
      illnessDaysAgo,
      muscleFatigue: fat,
      sleepShortH: slept !== null ? Math.max(0, 7 - slept) : 0,
      priorSets,
    };
  }

  /** Effort estimate for a weight × reps on a lift, or null. */
  function rpeEstimateFor(ex: Exercise, weight: number | null, reps: number, priorSets: number) {
    if (!isStrengthExercise(ex) || loadTypeFor(ex) !== 'weight' || !weight) return null;
    return estimateRpe(weight, reps, rpeCtxFor(ex, priorSets));
  }

  // ---- Stimulus / tired muscle (stimulus.ts) --------------------------------
  const liftOf = (e: Exercise): SessionLift => {
    const m = resolveMuscles(e);
    return { sets: e.sets, primary: m.primary, secondary: m.secondary };
  };
  const firstAt = (e: Exercise): number =>
    Math.min(...e.sets.map((s) => s.loggedAt ?? Number.MAX_SAFE_INTEGER));
  /** Fractional hard sets per muscle this session. */
  function sessionTally(): Map<string, number> {
    return muscleTally(workout!.exercises.filter(isStrengthExercise).map(liftOf));
  }
  /** What the lift's main muscle had done before this lift started. */
  function priorBefore(ex: Exercise): number {
    const primary = resolveMuscles(ex).primary;
    if (!primary) return 0;
    const start = firstAt(ex);
    const earlier = workout!.exercises.filter(
      (e) => e.id !== ex.id && isStrengthExercise(e) && firstAt(e) < start,
    );
    return muscleTally(earlier.map(liftOf)).get(primary) ?? 0;
  }
  /** Per-set stimulus (bar height) and performance drop (bar colour) for rows. */
  // Personal volume tolerance: per-session plateau scales with this athlete's
  // tolerated weekly volume (personalize.ts), drop tolerance with their habit
  // on the lift.
  function plateauFor(m: string | null): number {
    if (!m) return SESSION_PLATEAU;
    const p = cachedPersonalLandmarks(store.workouts, wallClock()).get(m as MuscleGroup);
    return sessionPlateau(p?.mrv, p?.base.mrv);
  }
  function dropToleranceFor(ex: Exercise): number {
    const past = recentSessionsOf(ex.name, workout!.id, 6)
      .map((x) => finalDrop(x.sets))
      .filter((n): n is number => n !== null);
    const primary = resolveMuscles(ex).primary;
    const finished = store.workouts.filter((w) => w.finishedAt !== null);
    const stalled = !!primary && stalledMuscles(finished, wallClock()).has(primary);
    return dropTolerance(past, stalled);
  }
  function rowMeters(ex: Exercise): {
    stim: Map<string, number>;
    drop: Map<string, number>;
    load: Map<string, number>;
  } {
    const primary = resolveMuscles(ex).primary;
    const plateau = plateauFor(primary);
    // How loaded the muscle already was when each set started (0..1 of the
    // session plateau) — warm-ups included at their small hardness, so a warm-
    // up bar reads the muscle's real state instead of a fixed "priming" blue.
    const load = new Map<string, number>();
    let prior = priorBefore(ex);
    const ref = workingKg(ex.sets);
    for (const st of ex.sets) {
      load.set(st.id, Math.min(1, prior / Math.max(1, plateau)));
      prior += setHardness(st, ref);
    }
    return {
      stim: setStimuli(ex.sets, priorBefore(ex), plateau),
      drop: performanceDrops(ex.sets),
      load,
    };
  }
  /** Growth value of one more set of this lift vs the first set (0..1). */
  function nextWorth(ex: Exercise): number | null {
    if (!isStrengthExercise(ex) || ex.sets.length === 0) return null;
    const primary = resolveMuscles(ex).primary;
    if (!primary) return null;
    return marginalStimulus(sessionTally().get(primary) ?? 0, plateauFor(primary));
  }
  /** Fractional hard sets per muscle PART (upper/lower chest, delt heads). */
  function regionTally(): Map<string, number> {
    const m = new Map<string, number>();
    for (const e of workout!.exercises) {
      if (!isStrengthExercise(e) || e.sets.length === 0) continue;
      const shares = regionShares(subRegionsByName(e.name));
      if (shares.size === 0) continue;
      const ref = workingKg(e.sets);
      const hard = e.sets.reduce((n, s) => n + setHardness(s, ref), 0);
      for (const [r, k] of shares) m.set(r, (m.get(r) ?? 0) + hard * k);
    }
    return m;
  }
  type Tired =
    | { kind: 'group'; muscle: string; sets: number; drop: number; tally: Map<string, number> }
    | {
        kind: 'region';
        muscle: string;
        region: string;
        sibling: string;
        sets: number;
        drop: number;
        tally: Map<string, number>;
      };
  function tiredFor(ex: Exercise): Tired | null {
    if (!isStrengthExercise(ex) || isMarkerExercise(ex)) return null;
    const primary = resolveMuscles(ex).primary;
    if (!primary) return null;
    const tally = sessionTally();
    const plateau = plateauFor(primary);
    const v = tiredVerdict({
      sets: ex.sets,
      muscleSets: tally.get(primary) ?? 0,
      plannedLeft: Math.max(0, (ex.plannedSets ?? 0) - ex.sets.length),
      plateau,
      dropEnough: dropToleranceFor(ex),
    });
    if (v.enough) return { kind: 'group', muscle: primary, sets: v.sets, drop: v.drop, tally };
    // The whole muscle still has room, but this lift's PART may be done: e.g.
    // lots of incline work — upper chest had enough, lower chest barely any.
    const parts = SPLIT_GROUPS[primary as MuscleGroup];
    const mine = subRegionsByName(ex.name)?.primary ?? [];
    if (!parts || mine.length !== 1 || ex.sets.length < 2) return null;
    const rt = regionTally();
    const partPlateau = plateau * 0.6;
    const region = mine[0];
    const done = rt.get(region) ?? 0;
    const sibling = parts
      .filter((p) => p !== region)
      .sort((a, b) => (rt.get(a) ?? 0) - (rt.get(b) ?? 0))[0];
    if (sibling && done >= partPlateau && (rt.get(sibling) ?? 0) < partPlateau * 0.5)
      return { kind: 'region', muscle: primary, region, sibling, sets: done, drop: v.drop, tally };
    return null;
  }
  type TiredPick = {
    name: string;
    kicker: string;
    sub: string;
    img?: string;
    kind: 'strength' | 'cardio' | 'cooldown' | 'warmup';
  };
  /** Where to go next, in order: the other part of the same muscle (when only
   *  a part is done), today's plan, what you usually do in sessions like this
   *  one, core, then cardio / cool-down. Always two options when possible. */
  function tiredPicks(ex: Exercise, v: Tired): TiredPick[] {
    const tally = v.tally;
    const done = new Set(
      workout!.exercises.filter((e) => e.sets.length > 0).map((e) => e.name.trim().toLowerCase()),
    );
    done.add(ex.name.trim().toLowerCase());
    const muscleOf = (name: string) =>
      resolveMuscles({ name, kind: 'strength' } as Exercise).primary;
    const saturated = (m: string | null) =>
      !!m && ((v.kind === 'group' && m === v.muscle) || (tally.get(m) ?? 0) >= plateauFor(m));
    const img = (name: string) => richExerciseByName(name)?.images?.[0];
    const mName = (m: string | null) =>
      m ? ((t.muscleGroups as Record<string, string>)[m] ?? m) : '';
    const partName = (r: string) => (t.subMuscleNames as Record<string, string>)[r] ?? r;
    const picks: TiredPick[] = [];
    const taken = new Set<string>();
    const push = (p: TiredPick) => {
      const k = p.name.trim().toLowerCase();
      if (taken.has(k) || (p.kind === 'strength' && done.has(k))) return;
      taken.add(k);
      picks.push(p);
    };
    const finished = store.workouts
      .filter((w) => w.finishedAt !== null && w.id !== workout!.id)
      .sort((a, b) => b.startedAt - a.startedAt);
    // Lifts you've done lately, most frequent first.
    const freq = new Map<string, number>();
    for (const w of finished.slice(0, 40))
      for (const e of w.exercises)
        if (e.sets.length > 0 && isStrengthExercise(e) && !isCardioExerciseName(e.name))
          freq.set(e.name.trim(), (freq.get(e.name.trim()) ?? 0) + 1);
    const byFreq = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

    // 1 · The other part of the same muscle.
    if (v.kind === 'region') {
      const mine = byFreq.find((n) => subRegionsByName(n)?.primary.includes(v.sibling as never));
      const name = mine ?? exercisesForSubRegions([v.sibling as never], 1, 1)[0]?.name;
      if (name)
        push({
          name,
          kicker: t.pickSamePart(partName(v.sibling)),
          sub: t.pickHasRoom,
          img: img(name),
          kind: 'strength',
        });
    }
    // 2 · Today's plan.
    const idx = sortedExercises.findIndex((e) => e.id === ex.id);
    for (const e of [...sortedExercises.slice(idx + 1), ...sortedExercises.slice(0, idx)])
      if (e.sets.length === 0 && isStrengthExercise(e) && !saturated(resolveMuscles(e).primary)) {
        push({
          name: e.name,
          kicker: t.tiredNextPlan,
          sub: mName(resolveMuscles(e).primary),
          img: img(e.name),
          kind: 'strength',
        });
        break;
      }
    // 3 · What you usually do NEXT in sessions like this one. Past sessions that
    // share lifts with today are aligned to where you are now (the furthest of
    // today's lifts in that session); lifts right after that point score most,
    // fading with distance — so a lift you always leave for the very end (core,
    // say) ranks after the ones that usually come straight next. Lifts that sat
    // before that point (normally already done by now) count only a little.
    {
      const score = new Map<string, number>();
      const me = ex.name.trim().toLowerCase();
      for (const w of finished.slice(0, 40)) {
        const sorted = [...w.exercises]
          .filter((e) => e.sets.length > 0)
          .sort((a, b) => a.position - b.position);
        const names = sorted.map((e) => e.name.trim().toLowerCase());
        const overlap = names.filter((n) => done.has(n)).length;
        if (overlap === 0) continue;
        const atMe = names.indexOf(me);
        const point = atMe >= 0 ? atMe : Math.max(...names.map((n, i) => (done.has(n) ? i : -1)));
        const weight = overlap / Math.max(1, done.size);
        sorted.forEach((e, i) => {
          if (!isStrengthExercise(e) || isCardioExerciseName(e.name)) return;
          const k = e.name.trim();
          if (done.has(k.toLowerCase()) || saturated(muscleOf(k))) return;
          const d = i - point;
          const s = d > 0 ? 1 / d : 0.1 / (1 - d);
          score.set(k, (score.get(k) ?? 0) + weight * s);
        });
      }
      for (const [n] of [...score.entries()].sort((a, b) => b[1] - a[1])) {
        if (picks.length >= 5) break;
        push({
          name: n,
          kicker: t.tiredNextUsual,
          sub: mName(muscleOf(n)),
          img: img(n),
          kind: 'strength',
        });
      }
    }
    // 4 · Core, while it isn't worked out yet.
    if ((tally.get('core') ?? 0) < plateauFor('core') * 0.6) {
      const core = byFreq.find((n) => muscleOf(n) === 'core' && !done.has(n.toLowerCase()));
      const name = core ?? exercisesForSubRegions(['abs'], 1, 1)[0]?.name;
      if (name)
        push({ name, kicker: t.pickCore, sub: t.pickCoreSub, img: img(name), kind: 'strength' });
    }
    // 5 · Everything's worked: finish with cardio or the cool-down.
    {
      const cardio = finished
        .flatMap((w) => w.exercises)
        .find((e) => exerciseKind(e) === 'cardio' && e.sets.length > 0);
      if (cardio)
        push({
          name: cardio.name,
          kicker: t.pickFinishLabel,
          sub: t.pickCardioSub,
          img: img(cardio.name),
          kind: 'cardio',
        });
    }
    if (!workout!.exercises.some((e) => exerciseKind(e) === 'cooldown'))
      push({
        name: t.defaultTimedExerciseNames.cooldown,
        kicker: t.pickFinishLabel,
        sub: t.pickCooldownSub,
        img: MARKER_IMAGES.cooldown,
        kind: 'cooldown',
      });
    return picks.slice(0, 6);
  }
  function openPick(p: TiredPick): void {
    const existing = workout!.exercises.find(
      (e) => e.name.trim().toLowerCase() === p.name.trim().toLowerCase() && e.sets.length === 0,
    );
    if (existing) {
      const i = focusStepOf(existing.id);
      if (i >= 0) setFocusIdx(i);
      return;
    }
    addExercise(workout!.id, p.name, p.kind);
  }
  /** Suggestion tiles (photo, what, why) — two in view, the rest scroll. */
  function renderPickTiles(picks: TiredPick[]) {
    if (picks.length === 0) return null;
    return (
      <div className="tb-tiles">
        {picks.map((p, i) => (
          <div key={p.name} className={`tb-tile${i === 0 ? ' primary' : ''}`}>
            <button
              type="button"
              className={`tb-tile-main${photoTintClass}${tintOf(p)}`}
              onClick={() => openPick(p)}
            >
              {p.img ? (
                <span className="tb-img-wrap">
                  <img src={p.img} alt="" />
                  <span className="photo-tint-layer" aria-hidden />
                </span>
              ) : (
                <span className="tb-noimg">
                  <Icon
                    name={
                      p.kind === 'strength' ? 'barbell' : p.kind === 'warmup' ? 'flame' : 'wind'
                    }
                  />
                </span>
              )}
              <span className="tb-kicker">{p.kicker}</span>
              <span className="tb-name">
                {p.kind === 'cooldown' || p.kind === 'warmup' ? p.name : exName(p.name)}
              </span>
              {p.sub && <span className="tb-tsub">{p.sub}</span>}
            </button>
            {p.kind === 'strength' && (
              <button
                type="button"
                className="tb-info"
                aria-label={t.detailsAction}
                title={t.detailsAction}
                onClick={() => setTiredInfo(p.name)}
              >
                <Icon name="info" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  /** Empty session: how this weekday usually starts (else the last sessions),
   *  skipping muscles still recovering. Suggestions only. */
  function startPicks(): { picks: TiredPick[]; day: string | null; n: number } {
    const at = new Date(workout!.startedAt);
    const dow = at.getDay();
    const finished = store.workouts
      .filter((w) => w.finishedAt !== null && w.id !== workout!.id)
      .sort((a, b) => b.startedAt - a.startedAt);
    const sameDay = finished.filter((w) => new Date(w.startedAt).getDay() === dow).slice(0, 6);
    const src = sameDay.length > 0 ? sameDay : finished.slice(0, 4);
    const score = new Map<string, number>();
    // Where each lift actually sat (1st/2nd/3rd lift) in those sessions, so a
    // tile says "usually second" when that's the truth, not "first" for all.
    const slots = new Map<string, number[]>();
    src.forEach((w, k) => {
      const firsts = [...w.exercises]
        .filter((e) => isStrengthExercise(e) && e.sets.length > 0 && !isCardioExerciseName(e.name))
        .sort((a, b) => a.position - b.position)
        .slice(0, 3);
      firsts.forEach((e, i) => {
        const n = e.name.trim();
        score.set(n, (score.get(n) ?? 0) + (1 / (k + 1)) * ((3 - i) / 3));
        slots.set(n, [...(slots.get(n) ?? []), i]);
      });
    });
    const slotOf = (n: string) => {
      const xs = [...(slots.get(n) ?? [0])].sort((a, b) => a - b);
      return xs[Math.floor((xs.length - 1) / 2)];
    };
    const kickerAt = (slot: number) =>
      day ? t.startKickerDay(slot + 1) : t.startKickerRecent(slot + 1);
    const hist = [...finished, workout!];
    const day =
      sameDay.length > 0 ? new Intl.DateTimeFormat(t.locale, { weekday: 'long' }).format(at) : null;
    const picks: TiredPick[] = [];
    // Do these sessions usually open with a warm-up (marker or cardio first)?
    // Same rule as the Playbook (store.warmupHabit), so both agree.
    const warmOpen = src
      .filter(opensWithWarmupSession)
      .map(
        (w) =>
          [...w.exercises]
            .filter((e) => isMarkerExercise(e) || e.sets.length > 0)
            .sort((a, b) => a.position - b.position)[0],
      );
    const warmsUp = src.length > 0 && warmupHabit(src);
    if (warmsUp) {
      const cardio = warmOpen.filter((e) => exerciseKind(e!) !== 'warmup');
      const kicker = kickerAt(0);
      if (cardio.length > warmOpen.length / 2) {
        const name = cardio[0]!.name.trim();
        picks.push({
          name,
          kicker,
          sub: t.pickWarmupSub,
          img: richExerciseByName(name)?.images?.[0],
          kind: 'cardio',
        });
      } else {
        picks.push({
          name: t.defaultTimedExerciseNames.warmup,
          kicker,
          sub: t.pickWarmupSub,
          img: MARKER_IMAGES.warmup,
          kind: 'warmup',
        });
      }
    }
    for (const [n] of [...score.entries()].sort((a, b) => b[1] - a[1])) {
      const m = resolveMuscles({ name: n, kind: 'strength' } as Exercise).primary;
      if (m && directReadiness([m], m, hist, now).state === 'recovering') continue;
      picks.push({
        name: n,
        kicker: kickerAt(slotOf(n)),
        sub: m ? ((t.muscleGroups as Record<string, string>)[m] ?? m) : '',
        img: richExerciseByName(n)?.images?.[0],
        kind: 'strength',
      });
      if (picks.length >= 6) break;
    }
    // Show them in the order you'd do them (a leading warm-up stays first).
    const lead = picks[0]?.kind === 'strength' ? [] : picks.splice(0, 1);
    const ordered = picks
      .map((p, i) => ({ p, i, slot: slotOf(p.name) }))
      .sort((a, b) => a.slot - b.slot || a.i - b.i)
      .map((x) => x.p);
    return { picks: [...lead, ...ordered], day, n: src.length };
  }
  /** The new empty live session: readiness at a glance, the lift you usually
   *  open with (or a science-based first session when there's no history), four
   *  more ways to start, a circuit shortcut when you use circuits, and one
   *  pinned Add button. Everything here is a suggestion — nothing is added
   *  until you tap. */
  /** Photo tint class for a suggestion: its lift's main muscle group. */
  function tintOf(p: { name: string; kind: string }): string {
    if (p.kind !== 'strength') return '';
    return muscleTintClass(resolveMuscles({ name: p.name, kind: 'strength' } as Exercise).primary);
  }

  /** Apply a Playbook day to the (empty) live session: warm-up when you open
   *  with one, then every lift with its usual sets and reps. */
  function applyPlay(play: Play): void {
    const wid = workout!.id;
    if (play.opensWithWarmup) addExercise(wid, t.defaultTimedExerciseNames.warmup, 'warmup');
    for (const ex of play.exercises)
      addExercise(wid, ex.name, 'strength', {
        plannedSets: ex.sets,
        plannedReps: ex.repHigh || ex.repLow || null,
        primaryMuscle: ex.primary ?? undefined,
        secondaryMuscles: ex.secondary,
      });
  }
  function renderPlaySheet() {
    if (!playSheet) return null;
    const { play, hero } = playSheet;
    const day = new Intl.DateTimeFormat(t.locale, { weekday: 'long' }).format(workout!.startedAt);
    const steps = play.exercises.length + (play.opensWithWarmup ? 1 : 0);
    const mins = Math.round(
      (play.opensWithWarmup ? 5 : 0) + play.exercises.reduce((n, e) => n + e.sets * 2.5, 0),
    );
    const reps = (e: Play['exercises'][number]) =>
      e.repLow && e.repHigh && e.repLow !== e.repHigh
        ? `${e.repLow}–${e.repHigh}`
        : `${e.repHigh || e.repLow || ''}`;
    let i = 0;
    return (
      <Sheet onClose={() => setPlaySheet(null)} className="pb-sheet">
        <div className="pbs-head">
          <b>{t.pbSheetTitle}</b>
          <span>{t.pbSheetSub(day)}</span>
        </div>
        <div className="pbs-card">
          <div className="pbs-card-head">
            <span className="pbs-ic">
              <Icon name="book-open" />
            </span>
            <span className="pbs-card-text">
              <span className="pbs-kicker">{t.pbKicker(day)}</span>
              <b>
                {(play.name ?? (play.readout ? dayReadoutLabel(play.readout, t) : t.playUntitled)) +
                  ' · ' +
                  t.pbMeta(steps, mins)}
              </b>
              <span>{t.pbLearned(play.sessions)}</span>
            </span>
          </div>
          <div className="pbs-list">
            {play.opensWithWarmup && (
              <div className="pbs-row warm">
                <span className="pbs-n">{++i}</span>
                <img src={MARKER_IMAGES.warmup} alt="" />
                <span className="pbs-row-text">
                  <b>{t.defaultTimedExerciseNames.warmup}</b>
                  <span>{t.pickWarmupSub}</span>
                </span>
              </div>
            )}
            {play.exercises.map((e) => {
              const img = exerciseImage(e.name, 'strength');
              return (
                <div key={e.name} className="pbs-row">
                  <span className="pbs-n">{++i}</span>
                  {img ? <img src={img} alt="" /> : <span className="pbs-noimg" />}
                  <span className="pbs-row-text">
                    <b>{exName(e.name)}</b>
                    <span className="num">
                      {e.sets} × {reps(e)}
                      {e.topWeight ? ` · ${fmtWeightKg(e.topWeight)}` : ''}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-primary pbs-apply"
            onClick={() => {
              applyPlay(play);
              setPlaySheet(null);
            }}
          >
            <Icon name="book-open" />
            {t.pbApply}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary pbs-custom"
          onClick={() => {
            setPlaySheet(null);
            openPick(hero);
          }}
        >
          <Icon name="pencil-simple" />
          {t.pbCustom}
        </button>
      </Sheet>
    );
  }

  function renderEmptyStart() {
    const at = workout!.startedAt;
    const finished = store.workouts.filter((w) => w.finishedAt !== null && w.id !== workout!.id);
    const hist = [...finished, workout!];
    const { picks, day } = startPicks();
    const lead = picks.filter((p) => p.kind !== 'strength');
    const lifts = picks.filter((p) => p.kind === 'strength');
    const muscleOf = (name: string) =>
      resolveMuscles({ name, kind: 'strength' } as Exercise).primary;
    const mName = (m: string | null) =>
      m ? ((t.muscleGroups as Record<string, string>)[m] ?? m) : '';
    // What you do first is the hero — the warm-up when you open with one,
    // then the lifts count on from 2nd.
    let hero: TiredPick | null = lead[0] ?? lifts[0] ?? null;
    let heroKicker = day ? t.esHeroDay(day) : t.esHeroRecent;
    let tiles: TiredPick[] = lead[0] ? [...lead.slice(1), ...lifts] : hero ? lifts.slice(1) : [];
    // No (or too little) history: fill from how a training week is usually
    // split, dodging muscles that are still recovering.
    if (!hero || tiles.length < 4) {
      const plan = starterPlan({
        weekday: new Date(at).getDay(),
        finishedCount: finished.length,
        items: buildPickItems(workout!, store.workouts, gym),
        recovering: (m) => directReadiness([m], m, hist, now).state === 'recovering',
      });
      const taken = new Set([hero, ...tiles].filter(Boolean).map((p) => p!.name.toLowerCase()));
      const dayName = t.splitNames[plan.day];
      const extra: TiredPick[] = plan.lifts
        .filter((l) => !taken.has(l.name.toLowerCase()))
        .map((l) => ({
          name: l.name,
          kicker: dayName,
          sub: mName(l.muscle),
          img: l.image ?? undefined,
          kind: 'strength' as const,
        }));
      if (!hero && extra.length > 0) {
        // No history: the right order is warm-up first, then the lifts.
        hero = {
          name: t.defaultTimedExerciseNames.warmup,
          kicker: t.exerciseKindNames.warmup,
          sub: t.pickWarmupSub,
          img: MARKER_IMAGES.warmup,
          kind: 'warmup',
        };
        heroKicker = t.esStarterKicker(dayName).toLocaleUpperCase(t.locale);
      }
      tiles = [...tiles, ...extra];
    }
    tiles = tiles.slice(0, 4);
    // One "1st" only: the hero; history lifts in the tiles count on from 2nd in
    // the order they're shown. Warm-up and starter picks keep their own label.
    {
      let rank = 1;
      tiles = tiles.map((p) =>
        p.kind === 'strength' && lifts.some((l) => l.name === p.name)
          ? { ...p, kicker: t.esOrd(++rank) }
          : {
              ...p,
              kicker: (p.kind === 'strength'
                ? p.kicker
                : t.exerciseKindNames.warmup
              ).toLocaleUpperCase(t.locale),
            },
      );
    }

    // Hero line: last time and today's aim (or the rep range for a first go).
    const load = (w: number | null) => (w == null || w <= 0 ? t.bodyweightShort : fmtWeightKg(w));
    let heroSub = '';
    if (hero && hero.kind !== 'strength') heroSub = hero.sub;
    else if (hero) {
      const tg = nextTarget(topHistory(finished, hero.name, now), {
        primary: muscleOf(hero.name),
      });
      heroSub =
        tg.state === 'first' || tg.prevReps == null
          ? t.esFirst(tg.repLow, tg.repHigh)
          : `${t.esLast(load(tg.prevWeight), tg.prevReps)} · ${t.esAim(load(tg.weight), tg.reps)}`;
    }

    // Readiness of the muscles these starts would train (up to three).
    const ready = muscleReadiness(finished, now);
    const ms: MuscleGroup[] = [];
    for (const p of [hero, ...tiles]) {
      if (!p || p.kind !== 'strength') continue;
      const m = muscleOf(p.name);
      if (m && m !== 'cardio' && !ms.includes(m)) ms.push(m);
    }
    const rows = ms.slice(0, 3).map((m) => {
      const r = ready.get(m);
      const state = r?.state ?? 'ready';
      return { m, pct: Math.round((r?.readiness ?? 1) * 100), state };
    });
    const tired = rows
      .filter((r) => r.state === 'recovering' || r.state === 'nearly')
      .map((r) => mName(r.m));
    const readLine =
      tired.length > 0
        ? t.esRecovering(tired.join(', '))
        : finished.length === 0
          ? t.esNoHistory
          : t.esAllFresh;

    const infoBtn = (name: string, cls: string) => (
      <button
        type="button"
        className={cls}
        aria-label={t.detailsAction}
        title={t.detailsAction}
        onClick={() => setTiredInfo(name)}
      >
        <Icon name="info" />
      </button>
    );
    return (
      <div className={`es${photoTintClass}`}>
        <div className="es-scroll">
          {todayPlan && (
            <div
              className="atl-plancard"
              style={{ ['--atl' as string]: TEMPER_COLOR[store.coach.temper] }}
            >
              <AtlasFace temper={store.coach.temper} size={36} />
              <span className="atl-plancard-text">
                <span>{t.atlasPlanCardKicker}</span>
                <b>{todayPlan.day.name ?? t.splitNames[todayPlan.day.split]}</b>
                <span>
                  {t.atlasPlanCardMeta(todayPlan.built.estMinutes, todayPlan.built.main.length)}
                </span>
              </span>
              <button
                type="button"
                className="atl-plancard-go"
                onClick={() => addGeneratedDayTo(workout!.id, todayPlan.built)}
              >
                <Icon name="play" weight="fill" />
                {t.atlasPlanStart}
              </button>
            </div>
          )}
          <div className="es-ready">
            <div className="es-ready-line">
              <Icon name="heartbeat" weight="fill" />
              <span>
                {t.esReadiness} · <b>{readLine}</b>
              </span>
            </div>
            {rows.length > 0 && (
              <div className="es-ready-cards">
                {rows.map((r) => (
                  <div key={r.m} className="es-rc">
                    <div className="es-rc-top">
                      <span className="es-rc-name">{mName(r.m)}</span>
                      <span className="es-rc-pct num" style={{ color: READINESS_COLOR[r.state] }}>
                        {r.pct}%
                      </span>
                    </div>
                    <span className="es-rc-bar">
                      <span style={{ width: `${r.pct}%`, background: READINESS_COLOR[r.state] }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {hero && (
            <div className={`es-hero${hero.kind === 'strength' ? '' : ' warm'}${tintOf(hero)}`}>
              {hero.img ? <img src={hero.img} alt="" /> : <span className="es-hero-noimg" />}
              <span className="photo-tint-layer" aria-hidden />
              <button
                type="button"
                className="es-hero-main"
                onClick={() => {
                  // Enough history for this weekday → offer the whole day;
                  // otherwise just start with this (the custom scenario).
                  const play = playForWeekday(
                    computePlaybook(finished, now).plays,
                    new Date(at).getDay(),
                  );
                  if (play) setPlaySheet({ play, hero: hero! });
                  else openPick(hero!);
                }}
              >
                <span className="es-hero-text">
                  <span className="es-kicker">{heroKicker}</span>
                  <span className="es-hero-name">{exName(hero.name)}</span>
                  <span className="es-hero-sub num">{heroSub}</span>
                </span>
                <span className="es-play" aria-hidden>
                  <Icon name="play" weight="fill" />
                </span>
              </button>
              {hero.kind === 'strength' && infoBtn(hero.name, 'es-info')}
            </div>
          )}
          {tiles.length > 0 && (
            <div className="es-more">
              <div className="es-grid">
                {tiles.map((p) => (
                  <div
                    key={p.name}
                    className={`es-tile${p.kind === 'strength' ? '' : ' warm'}${tintOf(p)}`}
                  >
                    <button type="button" className="es-tile-main" onClick={() => openPick(p)}>
                      {p.img ? (
                        <img src={p.img} alt="" />
                      ) : (
                        <span className="es-noimg">
                          <Icon name={p.kind === 'strength' ? 'barbell' : 'wind'} />
                        </span>
                      )}
                      <span className="photo-tint-layer" aria-hidden />
                      <span className="es-tile-text">
                        <span className="es-kicker">{p.kicker}</span>
                        <span className="es-tile-name">
                          {p.kind === 'strength' || p.kind === 'cardio' ? exName(p.name) : p.name}
                        </span>
                        <span className="es-tile-sub">{p.sub || '\u00a0'}</span>
                      </span>
                    </button>
                    {p.kind === 'strength' && infoBtn(p.name, 'es-info sm')}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="es-circuit">
            <span className="es-loop" aria-hidden>
              <Icon name="arrows-clockwise" />
            </span>
            <span className="es-circuit-text">
              <span className="es-circuit-title">{t.circuitLabel}</span>
              <span className="es-circuit-sub">{t.esCircuitSub}</span>
            </span>
            <button
              type="button"
              className="es-circuit-go"
              onClick={() => {
                setCircuit((c) => ({ on: true, groupId: crypto.randomUUID(), rounds: c.rounds }));
                setSheet({ kind: 'add' });
              }}
            >
              <Icon name="play" weight="fill" />
              {t.esCircuitStart}
            </button>
          </div>
        </div>
        <div className="es-dock">
          <button
            type="button"
            className="btn btn-primary es-add"
            onClick={() => setSheet({ kind: 'add' })}
          >
            <Icon name="plus" weight="bold" />
            {t.addExercise}
          </button>
        </div>
      </div>
    );
  }

  function renderStartBanner() {
    const { picks, day, n } = startPicks();
    if (picks.length === 0) return null;
    return (
      <div className="tired-banner start-banner">
        <div className="tb-head">
          <span className="tb-ic start">
            <Icon name="calendar-check" />
          </span>
          <span className="tb-text">
            <span className="tb-title">{day ? t.startTitleDay(day) : t.startTitleRecent}</span>
            <span className="tb-sub">{t.startSub(n)}</span>
          </span>
        </div>
        {renderPickTiles(picks)}
      </div>
    );
  }

  /** V9 · under the set card when the lift's muscle (or its part) is done for
   *  today. A suggestion only: collapses to its header, never blocks. */
  function renderTiredBanner(ex: Exercise) {
    const v = tiredFor(ex);
    if (!v) return renderNextBanner(ex);
    const muscleName = (t.muscleGroups as Record<string, string>)[v.muscle] ?? v.muscle;
    const partName = (r: string) => (t.subMuscleNames as Record<string, string>)[r] ?? r;
    const sets = Math.round(v.sets);
    const dropPct = Math.round(v.drop * 100);
    const fresh = ex.sets.filter((x) => setTypeOf(x) !== 'warmup').length === 0;
    const title =
      v.kind === 'region'
        ? t.tiredPartTitle(partName(v.region))
        : fresh
          ? t.tiredAlreadyTitle(muscleName)
          : t.tiredTitle(muscleName);
    const sub =
      v.kind === 'region'
        ? t.tiredPartSub(partName(v.sibling))
        : dropPct >= 1
          ? t.tiredSub(dropPct, sets)
          : t.tiredSubSets(sets);
    const why =
      v.kind === 'region'
        ? t.tiredPartWhy(partName(v.region).toLowerCase(), sets, partName(v.sibling).toLowerCase())
        : t.tiredWhy(muscleName.toLowerCase(), sets, dropPct);
    const collapsed = tiredCollapsed[ex.id] ?? false;
    const picks = collapsed ? [] : tiredPicks(ex, v);
    return (
      <div className={`tired-banner${collapsed ? ' collapsed' : ''}`}>
        <button
          type="button"
          className="tb-head"
          aria-expanded={!collapsed}
          onClick={() => setTiredCollapsed((m) => ({ ...m, [ex.id]: !collapsed }))}
        >
          <span className="tb-ic">
            <Icon name="barbell" />
          </span>
          <span className="tb-text">
            <span className="tb-title">{title}</span>
            <span className="tb-sub">{sub}</span>
          </span>
          <Icon name={collapsed ? 'caret-down' : 'caret-up'} className="tb-chev" />
        </button>
        {!collapsed && (
          <>
            <div className="tb-why">
              <b>{t.tiredWhyLabel}</b> {why}
            </div>
            {renderPickTiles(picks)}
          </>
        )}
      </div>
    );
  }

  /** Near the end of any lift (its planned sets done, or 3+ working sets with
   *  no plan) the next move is suggested even when the muscle isn't tired —
   *  the same picks the tired banner offers. */
  function renderNextBanner(ex: Exercise) {
    if (!isStrengthExercise(ex) || isMarkerExercise(ex)) return null;
    const working = ex.sets.filter((x) => setTypeOf(x) !== 'warmup').length;
    const planned = Math.max(0, ex.plannedSets ?? 0);
    const atEnd = planned > 0 ? working >= planned : working >= 3;
    if (!atEnd) return null;
    const primary = resolveMuscles(ex).primary;
    if (!primary) return null;
    const tally = sessionTally();
    const collapsed = tiredCollapsed[ex.id] ?? false;
    const picks = collapsed
      ? []
      : tiredPicks(ex, {
          kind: 'group',
          muscle: primary,
          sets: tally.get(primary) ?? 0,
          drop: 0,
          tally,
        });
    if (!collapsed && picks.length === 0) return null;
    return (
      <div className={`tired-banner next-banner${collapsed ? ' collapsed' : ''}`}>
        <button
          type="button"
          className="tb-head"
          aria-expanded={!collapsed}
          onClick={() => setTiredCollapsed((m) => ({ ...m, [ex.id]: !collapsed }))}
        >
          <span className="tb-ic start">
            <Icon name="arrow-right" />
          </span>
          <span className="tb-text">
            <span className="tb-title">{t.nextUpTitle}</span>
            <span className="tb-sub">{t.nextUpSub}</span>
          </span>
          <Icon name={collapsed ? 'caret-down' : 'caret-up'} className="tb-chev" />
        </button>
        {!collapsed && renderPickTiles(picks)}
      </div>
    );
  }

  /** Failure suggestion for the next set (failure.ts): copy + whether the
   *  flame starts on (streak / habit / drop) or it's only a hint ("room"). */
  function ghostFailSuggest(
    ex: Exercise,
    g: {
      reps: number;
      weight: number | null;
      warmup?: boolean;
      ramp?: { toKg: number };
      type?: SetType;
    },
  ): { text: string; preset: boolean } | null {
    if (!isStrengthExercise(ex) || props.past) return null;
    const kind = ghostKind(g, g.weight);
    const priorWorking = ex.sets.filter((x) => setTypeOf(x) !== 'warmup').length;
    const est = rpeEstimateFor(ex, g.weight, g.reps, priorWorking);
    const eq = equipmentFor(ex);
    const compound =
      richExerciseByName(ex.name)?.mechanic === 'compound' &&
      resolveMuscles(ex).secondary.length >= 1;
    const why = suggestFailure({
      type: kind,
      estRpe: est,
      safeToFail: !compound || (eq.length > 0 && eq.every((e) => e === 'machine' || e === 'cable')),
      current: ex.sets,
      plannedSets: Math.max(0, ex.plannedSets ?? 0),
      past: recentSessionsOf(ex.name, workout!.id, 3),
    });
    if (!why) return null;
    const text =
      why === 'streak'
        ? t.failSuggestStreak
        : why === 'habit'
          ? t.failSuggestHabit
          : why === 'drop'
            ? t.failSuggestDrop
            : t.failSuggestRoom(String(Math.max(1, Math.round(10 - (est ?? 8)))));
    return { text, preset: suggestionPresets(why) };
  }

  /** "PR attempt" before the set: the proposal would beat a weight or e1RM best. */
  function ghostPrHint(
    ex: Exercise,
    g: {
      reps: number;
      weight: number | null;
      warmup?: boolean;
      ramp?: { toKg: number };
      type?: SetType;
    },
  ): { title: string; line: string } | null {
    if (!focusView || !isStrengthExercise(ex) || loadTypeFor(ex) !== 'weight') return null;
    if (ghostKind(g, g.weight) !== 'working') return null;
    const w = g.weight ?? 0;
    if (w <= 0) return null;
    const title = t.prAttemptTitle(ex.sets.length + 1);
    const base = Math.max(
      baseline.get(ex.name.toLowerCase()) ?? 0,
      ...ex.sets.filter((s) => setTypeOf(s) !== 'warmup').map((s) => s.weight ?? 0),
    );
    if (base > 0 && w > base)
      return { title, line: t.prAttemptWeight(fmtWeightKg(w - base), fmtWeightKg(base)) };
    const e1Base = Math.max(recordE1rm(ex.name, workout!.id), ...ex.sets.map(setBestE1rm));
    if (e1Base > 0 && est1rm(w, g.reps) > e1Base)
      return { title, line: t.prAttemptE1(g.reps, fmtWeightKg(e1Base)) };
    return null;
  }

  function logGhost(
    ex: Exercise,
    v: { reps: number; weight: number | null; failure?: FailureMark | null; partials?: number },
    type: SetType = 'working',
    carry?: { weight: number | null; drops?: DropEntry[]; holdMin?: number | null },
    target?: { reps: number; weight: number | null } | null,
  ): void {
    // A continued drop set keeps its drops, shifted by however much the main
    // weight moved (80→60→40 at 80 becomes 85→65→45 at 85).
    const shift = carry && carry.weight !== null && v.weight !== null ? v.weight - carry.weight : 0;
    const drops =
      (type === 'drop' || type === 'reverse-drop') && carry?.drops
        ? carry.drops.map((d) => ({
            reps: d.reps,
            weight: d.weight === null ? null : Math.max(0, d.weight + shift),
          }))
        : [];
    logNewSet(
      ex,
      {
        reps: v.reps,
        weight: v.weight,
        isWarmup: type === 'warmup',
        // The warm-up chip is a deliberate choice — pin it so auto-detect won't
        // flip it. A plain (working) quick-log stays auto-classified.
        ...(type === 'warmup' ? { warmupManual: true } : {}),
        type,
        drops,
        durationMin: type === 'static-dynamic' ? (carry?.holdMin ?? null) : null,
        distanceKm: null,
        calories: null,
        rpe: null,
        ...(v.failure ? { failure: v.failure } : {}),
        ...(v.partials ? { partials: v.partials } : {}),
      },
      target,
    );
    // A fresh log returns focus to whatever the derived active exercise is.
    setExpandedId(null);
  }

  /** DS-2 · “Add a drop”: append a lighter part to the last logged set. */

  function equipmentLabelOf(id: string): string {
    const names = t.equipmentNames as Record<string, string>;
    return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
  }

  /** One-line reading of a finished exercise (SS-3): «3 × 8 · 75 kg». */
  function pastSummary(ex: Exercise): string {
    if (isMarkerExercise(ex))
      return exerciseKind(ex) === 'cooldown' ? t.exerciseKindNames.cooldown : t.warmupMarkerTitle;
    if (isTimedExercise(ex)) {
      const min = ex.sets.reduce((n, s) => n + (s.durationMin ?? 0), 0);
      return `${Math.round(min)} ${t.minShort}`;
    }
    const top = topSet(ex.sets) ?? ex.sets[ex.sets.length - 1];
    if (!top) return `0 ${t.sets}`;
    const w = top.weight === null ? t.bodyweightShort : fmtWeightKg(top.weight);
    return `${ex.sets.length} × ${top.reps} · ${w}`;
  }

  interface GroupCtx {
    letter: string;
    index: number;
    active: boolean;
    rounds: number;
    /** The round in progress — a member with this many sets is done for now. */
    round: number;
  }

  /** Kind cell of one strength set row (working/warm-up/drop/record…). */
  function setKindLabel(ex: Exercise, s: SetEntry, grp: GroupCtx | null) {
    const type = setTypeOf(s);
    if (type === 'static-dynamic') {
      return (
        <span className="kind tsd">
          <Icon name="wave-sine" />
          {isDesktop ? t.setTypeStaticDynamic : t.setSDShort}
        </span>
      );
    }
    if (type === 'drop' || type === 'reverse-drop') {
      return (
        <span className="kind tdrop">
          <Icon name={type === 'drop' ? 'caret-line-down' : 'caret-line-up'} />
          {isDesktop
            ? type === 'drop'
              ? t.setTypeDrop
              : t.setTypeReverse
            : type === 'drop'
              ? t.dropWord
              : t.reverseWord}
        </span>
      );
    }
    const rec = isRecordSet(ex, s);
    const text = rec
      ? t.record
      : type === 'warmup'
        ? isDesktop
          ? t.setTypeWarmup
          : t.warmup
        : grp
          ? recentSetId === s.id
            ? t.justNow
            : t.setDone
          : isDesktop
            ? t.setTypeWorking
            : t.working;
    const cls = `kind${type === 'warmup' && !rec ? ' twarm' : ''}${!rec && grp && recentSetId === s.id ? ' just-now' : ''}`;
    return <span className={cls}>{text}</span>;
  }

  /** Kit this lift used that the session's gym doesn't list (medium evidence,
   *  only once a set is in — the moment of proof). */
  function kitNudge(ex: Exercise | null): KitEvidence | null {
    if (!live || !gym || gymHasNoList(gym) || !ex || !isStrengthExercise(ex)) return null;
    if (ex.sets.length === 0) return null;
    const classes = equipmentFor(ex);
    const items = ex.equipmentItems ?? [];
    return (
      gymKitEvidence(gym.id, wallClock()).find(
        (e) =>
          e.medium &&
          !kitDismissed.includes(e.itemId) &&
          (items.includes(e.itemId) || classes.includes(e.cls)),
      ) ?? null
    );
  }
  function renderKitTray() {
    if (!gym) return null;
    if (kitUndo)
      return (
        <div className="gk-float-wrap">
          <GymKitUndo gym={gym} prev={kitUndo} count={1} floating onDone={() => setKitUndo(null)} />
        </div>
      );
    const ev = kitNudge(focusEx);
    if (!ev) return null;
    return (
      <div className="gk-float-wrap">
        <GymKitTray
          key={ev.itemId}
          gym={gym}
          ev={ev}
          onDismiss={() => setKitDismissed((d) => [...d, ev.itemId])}
          onAdded={(prev) => setKitUndo(prev)}
        />
      </div>
    );
  }

  function renderFocusView() {
    // Focus header keeps only Finish; everything else lives behind the one
    // options door (sliders next to Log, or here when nothing is focused yet).
    // Focus header: the gym stays in the hero above, Finish sits next to Next
    // at the bottom, everything else lives behind the options door. Only an
    // empty focus (nothing to log yet) needs a door up here.
    const fmActions = !focusEx ? (
      <div className="fm-actions">
        <button
          className="fm-icon-btn"
          onClick={() =>
            setSheet({ kind: 'opts', tab: 'session', exId: null, set: null, ghost: null })
          }
          aria-label={t.sessionSettings}
          title={t.sessionSettings}
        >
          <Icon name="sliders-horizontal" />
        </button>
      </div>
    ) : null;
    const finishBtn = (
      <button
        className="btn focus-finish"
        disabled={entries === 0}
        onClick={requestFinish}
        aria-label={t.finish}
        title={t.finish}
      >
        <Icon name="check" weight="bold" />
      </button>
    );
    if (!focusEx && live && workout!.exercises.length === 0) {
      return <div className="focus-view focus-view-empty">{renderEmptyStart()}</div>;
    }
    if (!focusEx) {
      return (
        <div className="focus-view">
          <div className="fm-modebar">{fmActions}</div>
          <div className="focus-empty">
            <div className="fe-inner">
              <span className="fe-glyph" aria-hidden>
                <Icon name="barbell" weight="fill" />
              </span>
              <h3 className="fe-title">{t.noExercisesYet}</h3>
              <p className="fe-body">{t.noExercisesBody}</p>
              <button className="btn btn-primary fe-add" onClick={() => setSheet({ kind: 'add' })}>
                <Icon name="plus" />
                {t.addExercise}
              </button>
              {live &&
                hasSessionStartCoach(
                  store.workouts.filter((w) => w.finishedAt !== null),
                  now,
                ) && (
                  <button className="fe-coach" onClick={() => setSheet({ kind: 'coach' })}>
                    <Icon name="heartbeat" weight="fill" />
                    {t.sessionCoachButton}
                  </button>
                )}
            </div>
            {live && renderStartBanner()}
          </div>
        </div>
      );
    }
    const nx = focusSteps[focusPos + 1]?.[0] ?? null;
    const nxBlock = focusBlocks[focusPos + 1] ?? null;
    const segs = [
      ...focusSteps.map((st, i) => {
        const e = st[0];
        return (
          <span
            key={e.id}
            className={`${i < focusPos ? 'done' : i === focusPos ? 'cur' : ''}${
              isMarkerExercise(e) ? (exerciseKind(e) === 'cooldown' ? ' cd' : ' wu') : ''
            }${st.length > 1 ? ' grp' : ''}`}
          />
        );
      }),
      // a dashed placeholder for the next exercise you can still add
      <button
        key="__add"
        type="button"
        className="add"
        aria-label={t.addExercise}
        title={t.addExercise}
        onClick={() => setSheet({ kind: 'add' })}
      />,
    ];
    return (
      <div className="focus-view">
        {fmActions && <div className="fm-modebar">{fmActions}</div>}
        <div className="focus-scroll">
          <div className="plan-progress focus-step">
            <div className="plan-segments" aria-label={t.exerciseWord}>
              {segs}
            </div>
          </div>
          {circuitBanner}
          {focusGroup ? renderGroupStep(focusGroup) : renderCard(focusEx, null)}
        </div>
        {renderKitTray()}
        <div className="focus-nav">
          <button
            type="button"
            className="btn focus-discard"
            onClick={() => setDialog({ kind: 'del-workout' })}
            aria-label={t.discardSession}
            title={t.discardSession}
          >
            <Icon name="trash" />
          </button>
          <button
            className="btn btn-secondary focus-back"
            disabled={focusPos === 0}
            onClick={() => setFocusIdx(focusPos - 1)}
            aria-label={t.focusBack}
          >
            <Icon name="caret-left" />
          </button>
          {focusHasNext ? (
            <button
              className="btn btn-secondary focus-next"
              onClick={() => setFocusIdx(focusPos + 1)}
            >
              {(() => {
                const img = nx ? exerciseImage(nx.name, exerciseKind(nx)) : undefined;
                return img ? <img className="fn-thumb" src={img} alt="" /> : null;
              })()}
              <span className="fn-label">
                {nxBlock?.kind === 'group'
                  ? t.focusNext(
                      nxBlock.group.circuit
                        ? t.circuitTitle(nxBlock.group.letter)
                        : t.supersetTag(nxBlock.group.letter),
                    )
                  : t.focusNext(nx?.name ?? '')}
              </span>
              <Icon name="caret-right" />
            </button>
          ) : (
            <button
              className="btn btn-secondary focus-next"
              onClick={() => setSheet({ kind: 'add' })}
            >
              {t.focusNextExercise}
              <Icon name="caret-right" />
            </button>
          )}
          {finishBtn}
        </div>
      </div>
    );
  }

  /** Live rest count-up on the exercise that owns the most recent set (strength
   *  or cardio), AND on a freshly focused exercise with no sets yet — rest
   *  carries over from the previous exercise's last set. */
  /** The automatic rest after a set (restTimer.planRest): load vs today's
   *  strength, lift type, equipment, muscle size, effort/failure, technique,
   *  weekly muscle fatigue, illness and sleep. Cached per set state — it reads
   *  the whole history, and the view re-renders every second. */
  function autoRestFor(
    ex: Exercise,
    s: SetEntry,
  ): { sec: number; reasons: { key: RestReason; sec: number }[] } {
    const blk = focusBlocks.find(
      (b) => b.kind === 'group' && b.group.exercises.some((e) => e.id === ex.id),
    );
    const midRound =
      blk?.kind === 'group' &&
      !blk.group.circuit &&
      blk.group.exercises.some((e) => e.sets.length < ex.sets.length);
    const key = [s.id, s.weight, s.reps, s.type, s.failure, s.rpe, s.rpeAuto, midRound].join('|');
    const hit = restPlanCache.get(key);
    if (hit) return hit;
    const idx = ex.sets.findIndex((x) => x.id === s.id);
    const prior = ex.sets
      .slice(0, idx < 0 ? ex.sets.length : idx)
      .filter((x) => setTypeOf(x) !== 'warmup').length;
    const ctx = rpeCtxFor(ex, prior);
    const m = resolveMuscles(ex);
    const e1Today = ctx.refE1 * readinessFactor(ctx).factor;
    const w = s.weight ?? 0;
    const plan = planRest({
      compound: richExerciseByName(ex.name)?.mechanic === 'compound' && m.secondary.length >= 1,
      equipment: equipmentFor(ex),
      primary: m.primary,
      lastType: setTypeOf(s),
      intensity: loadTypeFor(ex) === 'weight' && w > 0 && e1Today > 0 ? w / e1Today : null,
      reps: s.reps,
      failure: isFailure(s),
      rpe: s.rpe ?? s.rpeAuto ?? null,
      muscleFatigue: ctx.muscleFatigue,
      illness: ctx.illnessDaysAgo !== null && ctx.illnessDaysAgo < 7,
      shortSleep: ctx.sleepShortH >= 1.5,
      midRound,
    });
    restPlanCache.set(key, plan);
    return plan;
  }

  /** Rest target: a superset hand-off is always none; else the lift's pinned
   *  target (rest sheet) if any, else the automatic plan. */
  function restTargetSec(ex: Exercise, s: SetEntry): number {
    const plan = autoRestFor(ex, s);
    if (plan.sec === 0 && plan.reasons[0]?.key === 'superset') return 0;
    if (setTypeOf(s) === 'warmup') return plan.sec;
    return exerciseRestSec(ex.name) ?? plan.sec;
  }

  /** The record card stays up for 30 s (or until dismissed). */
  const prShowing = !!prMoment && live && now - prMoment.at < 30000;

  /** B · the record moment: a celebration card that folds into the rest timer. */
  function renderPrCard() {
    const pm = prMoment!;
    const tile = (label: string, val: string, delta: number) => (
      <div className="pr-tile">
        <span className="pr-tile-lab">{label}</span>
        <span className="pr-tile-val">{val}</span>
        <span className={`pr-tile-d${delta > 0 ? ' up' : ''}`}>
          {delta > 0 ? `+${fmtWeightValue(Math.round(delta * 10) / 10)}` : '—'}
        </span>
      </div>
    );
    const setText = `${fmtWeightKg(pm.w)} × ${pm.reps}`;
    return (
      <div className="pr-card" role="status">
        <div className="pr-confetti" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
        <span className="pr-badge">
          <Icon name="trophy" weight="fill" />
        </span>
        <div className="pr-kicker">{t.prNewRecord(exName(pm.name))}</div>
        <div className="pr-main">{setText}</div>
        <div className="pr-stats">
          {tile(t.prE1, fmtWeightValue(pm.e1), pm.e1Prev > 0 ? pm.e1 - pm.e1Prev : 0)}
          {tile(t.prBestWeight, fmtWeightValue(pm.w), pm.wPrev > 0 ? pm.w - pm.wPrev : 0)}
          {tile(t.prSetVolume, fmtWeightValue(pm.vol), pm.volPrev > 0 ? pm.vol - pm.volPrev : 0)}
        </div>
        <div className="pr-actions">
          <button
            type="button"
            className="pr-share"
            onClick={() =>
              setPrShare({
                brand: 'spotter',
                kicker: t.prNewRecord(exName(pm.name)),
                headline: exName(pm.name),
                hero: { value: setText, label: t.record },
                rows: [
                  {
                    lead: '↑',
                    name: t.prE1,
                    detail: `${fmtWeightKg(pm.e1)}${pm.e1Prev > 0 && pm.e1 > pm.e1Prev ? ` (+${fmtWeightValue(pm.e1 - pm.e1Prev)})` : ''}`,
                    accent: true,
                  },
                  {
                    lead: '↑',
                    name: t.prBestWeight,
                    detail: `${fmtWeightKg(pm.w)}${pm.wPrev > 0 && pm.w > pm.wPrev ? ` (+${fmtWeightValue(pm.w - pm.wPrev)})` : ''}`,
                  },
                  { lead: '·', name: t.prSetVolume, detail: fmtWeightKg(pm.vol) },
                ],
                handle: 'spotter.app',
              })
            }
          >
            <Icon name="share-network" />
            {t.prShare}
          </button>
          <button type="button" className="pr-ok" onClick={() => setPrMoment(null)}>
            {t.prNiceRest}
          </button>
        </div>
        <div className="pr-fold">{t.prFolds}</div>
      </div>
    );
  }

  /** Live rest count-up on the exercise that owns the most recent set (strength
   *  or cardio), AND on a freshly focused exercise with no sets yet — rest
   *  carries over from the previous exercise's last set. In focus mode it's a
   *  countdown to the rest target that alerts when it's over. */
  function renderRest(ex: Exercise) {
    if (focusView) {
      if (ex.id !== focusedId || isMarkerExercise(ex)) return null;
      if (prShowing) return renderPrCard();
      if (!restRunning || !lastChrono) return null;
      const lastEx = workout!.exercises.find((e) => e.id === lastLoggedExId);
      if (!lastEx) return null;
      const target = restTargetSec(lastEx, lastChrono.s);
      const adj =
        restAdj.at === lastLoggedAt ? restAdj : { at: lastLoggedAt, delta: 0, skip: false };
      const goal = adj.skip ? 0 : Math.max(0, target + adj.delta);
      const whyLine = autoRestFor(lastEx, lastChrono.s)
        .reasons.filter((r) => r.key !== 'superset')
        .slice(0, 3)
        .map((r) => t.restWhy[r.key])
        .join(' · ');
      const elapsed = Math.max(0, (now - lastLoggedAt) / 1000);
      const left = goal - elapsed;
      const done = left <= 0;
      // Long past the target the timer means nothing any more (a break, a
      // reopened session) — let it go.
      if (left < -600) return null;
      const g = ghostFor(ex);
      const nextLine =
        focusGroup && focusGroup.exercises.some((e) => e.id === ex.id) && ex.id !== lastEx.id
          ? t.restGoTo(exName(ex.name))
          : t.restNext(`${t.setNumber(ex.sets.length + 1)} · ${fmtSet(g.weight, g.reps)}`);
      const R = 50;
      const C = 2 * Math.PI * R;
      const frac = done || goal === 0 ? 1 : Math.max(0, Math.min(1, left / goal));
      const nudge = (d: number) =>
        setRestAdj({ at: lastLoggedAt, delta: adj.delta + d, skip: false });
      // The set just logged was read as failure → say so, and why, with an
      // easy "no". (The row keeps its dashed F? tag either way.)
      const justSet = lastChrono.s;
      const failNote =
        justSet.failure === 'auto' && lastEx.id === ex.id ? (
          <div className="fail-note" role="status">
            <Icon name="flame" weight="fill" />
            <span className="fail-note-text">
              {t.failAutoNote(
                (t.failWhy as Record<string, string>)[justSet.failureWhy ?? ''] ?? t.failShort,
              )}
            </span>
            <button
              type="button"
              onClick={() =>
                upsertSet(workout!.id, lastEx.id, { ...justSet, failure: 'no', failureWhy: null })
              }
            >
              {t.failNotFailure}
            </button>
          </div>
        ) : null;
      return (
        <>
          {failNote}
          <div className={`rst-card${done ? ' done' : ''}`}>
            <RestAlarm
              setId={lastChrono!.s.id}
              dueAt={lastLoggedAt + goal * 1000}
              enabled={goal > 0}
              prefs={store.restPrefs ?? REST_PREFS_DEFAULT}
              title={t.restNoteTitle}
              body={nextLine}
            />
            <button
              type="button"
              className="rst-ring"
              aria-label={t.restSettingsAria}
              onClick={() => setSheet({ kind: 'rest', exName: lastEx.name })}
            >
              <svg viewBox="0 0 112 112" aria-hidden>
                <circle className="rst-track" cx="56" cy="56" r={R} />
                <circle
                  className="rst-arc"
                  cx="56"
                  cy="56"
                  r={R}
                  strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`}
                />
              </svg>
              <span className="rst-center">
                {done ? (
                  <>
                    <span className="rst-go">{t.restGo}</span>
                    <span className="rst-time">+{fmtCountdown(-left)}</span>
                  </>
                ) : (
                  <>
                    <span className="rst-time">{fmtCountdown(left)}</span>
                    <span className="rst-of">{t.restOf(fmtCountdown(goal))}</span>
                  </>
                )}
              </span>
            </button>
            <div className="rst-body">
              <div className="rst-lbl">
                <Icon name="timer" />
                {done ? t.restOverTitle : t.restHeaderLabel}
              </div>
              <div className="rst-next">{nextLine}</div>
              {!done && exerciseRestSec(lastEx.name) === null && whyLine && (
                <div className="rst-why">{whyLine}</div>
              )}
              {done ? (
                <div className="rst-note">{t.restOverNote}</div>
              ) : (
                <div className="rst-btns">
                  <button type="button" aria-label={t.restMinus15} onClick={() => nudge(-15)}>
                    −15
                  </button>
                  <button type="button" aria-label={t.restPlus15} onClick={() => nudge(15)}>
                    +15
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }
    if (!restRunning || isMarkerExercise(ex)) return null;
    if (!(ex.id === lastLoggedExId || (focusedId === ex.id && ex.sets.length === 0))) return null;
    const restNow = Math.max(0, now - lastLoggedAt);
    return focusView ? (
      <div className="fm-rest">
        <span className="fm-rest-ic">
          <Icon name="timer" />
        </span>
        <div className="fm-rest-txt">
          <span className="fm-rest-lbl">{t.restHeaderLabel}</span>
          <span className="fm-rest-sub">{t.focusRestSince}</span>
        </div>
        <span className="fm-rest-clock">{mmss(restNow)}</span>
      </div>
    ) : (
      <div className="ex-resting">
        <Icon name="timer" />
        <span>{t.restingSince(mmss(restNow))}</span>
      </div>
    );
  }

  // Building a circuit: exercises added now join it (shown in both views).
  const circuitBanner =
    live && circuit.on && circuit.groupId ? (
      <div className="circuit-banner">
        <span className="loop sm">
          <Icon name="arrows-clockwise" />
        </span>
        <div className="cb-text">
          <div className="cb-title">
            {t.circuitAdding}{' '}
            {(() => {
              const blk = sessionBlocks(workout).find(
                (b) => b.kind === 'group' && b.group.groupId === circuit.groupId,
              );
              return blk && blk.kind === 'group' ? blk.group.letter : 'A';
            })()}
          </div>
          <div className="cb-sub">
            {t.circuitSoFar(workout.exercises.filter((e) => e.groupId === circuit.groupId).length)}
          </div>
        </div>
        <button
          className="btn btn-secondary cb-done"
          onClick={() => setCircuit((c) => ({ ...c, on: false, groupId: null }))}
        >
          {t.circuitFinishSet}
        </button>
      </div>
    ) : null;

  /** Focus step for a superset / circuit: the whole group on one slide. */
  const renderGroupStep = (g: SupersetGroup) => {
    if (g.circuit)
      return (
        <CircuitBlock
          key={g.groupId}
          group={g}
          past={false}
          building={circuit.on && circuit.groupId === g.groupId}
          isLast
          rounds={circuit.rounds}
          onMuscle={openMuscleHistory}
          onRun={() => setSheet({ kind: 'circuit-run', groupId: g.groupId })}
          onAddAnother={() => setSheet({ kind: 'add' })}
          onDoneBuilding={() => setCircuit((c) => ({ ...c, on: false, groupId: null }))}
          onRounds={(delta) => {
            const r = Math.max(1, Math.min(20, circuit.rounds + delta));
            setCircuit((c) => ({ ...c, rounds: r }));
            setCircuitRounds(workout.id, g.groupId, r);
          }}
        />
      );
    // Superset: a strip of its members (whose turn, how far) above the normal
    // focus card for the member whose turn it is — logging moves to the next.
    const rounds = groupRounds(g);
    const round = groupCurrentRound(g);
    const cur = focusEx ?? g.exercises[0];
    return (
      <>
        <div className="fss" key={g.groupId}>
          <div className="fss-head">
            <span className="tag tag-accent">{t.supersetTag(g.letter)}</span>
            <span className="fss-round">{t.roundOf(round, rounds)}</span>
            <button
              className="dots"
              onClick={() => setSheet({ kind: 'group-menu', groupId: g.groupId })}
              aria-label={t.menuAction}
            >
              <Icon name="dots-three-vertical" />
            </button>
          </div>
          <div className="fss-members">
            {g.exercises.map((e, i) => {
              const done = e.sets.length >= rounds;
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`fss-m${e.id === cur.id ? ' on' : ''}${done ? ' done' : ''}`}
                  aria-pressed={e.id === cur.id}
                  onClick={() => setFocusPick({ id: e.id, logged: focusGroupLogged })}
                >
                  <span className="fss-idx">
                    {done ? <Icon name="check" weight="bold" /> : `${g.letter}${i + 1}`}
                  </span>
                  <span className="fss-name">{exName(e.name)}</span>
                  <span className="fss-count">
                    {e.sets.length}/{rounds}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {renderCard(cur, null)}
      </>
    );
  };

  function renderCard(ex: Exercise, grp: GroupCtx | null) {
    const ghost = ghostFor(ex);
    const timedGhost = timedGhostFor(ex);
    const timedSheetGhost: GhostValues = { ...ghost, ...timedGhost };
    // Focus mode: options live in the same sliders button as next to Log.
    const openExOpts = () =>
      setSheet({
        kind: 'opts',
        tab: 'exercise',
        exId: ex.id,
        set: null,
        ghost: isTimedExercise(ex) && !isMarkerExercise(ex) ? timedSheetGhost : null,
      });
    const cfgBtn = (
      <button
        className="gset-cfg"
        aria-label={t.setOptions}
        title={t.setOptions}
        onClick={openExOpts}
      >
        <Icon name="sliders-horizontal" />
      </button>
    );
    // Cardio photo: the chosen machine, else the lift catalog's photo.
    const cardioImg =
      exerciseKind(ex) === 'cardio'
        ? ((ex.equipmentItems ?? [])
            .map((id) => equipmentById(id)?.image?.thumbUrl)
            .find(Boolean) ?? exerciseImage(ex.name, 'strength'))
        : undefined;
    const prev = prevLift(ex.name, workout!.id);
    const kind = exerciseKind(ex);
    const marker = isMarkerExercise(ex);
    const timed = isTimedExercise(ex) && !marker;
    // Cardio: the machine decides which console readings the entry carries.
    const cardioFields = timed ? cardioProfile(ex).fields : [];
    const cardioCol: CardioField | null = cardioFields[0] ?? null;
    const cardioId = cardioMachineOf(ex);
    const showPace = !!cardioId && /rower|ski-erg/.test(cardioId);
    const planned = Math.max(0, ex.plannedSets ?? 0);
    const completed = planned > 0 && ex.sets.length >= planned;
    // A weight is required for a planned lift — unless this lift is already being
    // logged as bodyweight (then null is "BW", not "missing").
    const directLogBlocked =
      !timed &&
      !marker &&
      planned > 0 &&
      ghost.weight === null &&
      !ex.sets.some((s) => s.weight === null);
    const muscles = resolveMuscles(ex);
    const equipment = equipmentFor(ex);
    const loadType = loadTypeFor(ex);
    const bandLib = bandLibraryFor(gym);
    // Weight-cell text adapts to the load type (Load-entry C-3).
    const loadCell = (kg: number | null): string => {
      if (kg === null) return t.bodyweightShort;
      if (loadType === 'assist') return `${fmtWeightValue(kg)} ${t.kgCol.toLowerCase()}`;
      if (loadType === 'band') {
        const b = bandForKg(kg, bandLib);
        return b ? `${t.bandColor(b.color)} ~${fmtWeightValue(b.kg)}` : fmtWeightValue(kg);
      }
      return isDesktop ? fmtWeightKg(kg) : fmtWeightValue(kg);
    };
    const loadColHead =
      loadType === 'assist' ? t.assistCol : loadType === 'band' ? t.bandCol : null;
    const showChips = !timed && !marker && (muscles.primary !== null || equipment.length > 0);
    // Progression target from this lift's own history (design PROG-1).
    const target =
      live && !timed && !marker && isStrengthExercise(ex)
        ? nextTarget(
            topHistory(
              store.workouts.filter((w) => w.finishedAt !== null),
              ex.name,
              workout!.startedAt,
            ),
            {
              plannedReps: ex.plannedReps,
              equipment,
              primary: muscles.primary,
              bodyweight: ghost.weight === null,
              loadType,
            },
          )
        : null;
    const groupDone = grp !== null && ex.sets.length >= grp.round;
    // While the record card is up it owns the space — the next set waits.
    const showGhost = (!grp || grp.active) && !(focusView && prShowing && ex.id === focusedId);
    const rowCls = grp ? ' rrow' : '';
    const sortedSets = [...ex.sets].sort((a, b) => a.position - b.position);
    const meters = focusView && live && isStrengthExercise(ex) ? rowMeters(ex) : null;
    return (
      <div
        key={ex.id}
        data-exid={ex.id}
        className={`exercise-card${completed ? ' completed' : ''}${
          !grp && focusedId === ex.id ? ' active' : ''
        }${grp ? ' ss-card' : ''}${grp?.active ? ' ss-active' : ''}${timed ? ' timed-card' : ''}${
          marker ? ` warmup-marker${kind === 'cooldown' ? ' cooldown-marker' : ''}` : ''
        }`}
        onDragOver={(e) => {
          if (!grp && dragId.current && dragId.current !== ex.id) e.preventDefault();
        }}
        onDrop={(e) => {
          if (grp) return;
          e.preventDefault();
          const from = dragId.current;
          dragId.current = null;
          if (!from || from === ex.id) return;
          const ids = [...workout!.exercises]
            .sort((a, b) => a.position - b.position)
            .map((x) => x.id);
          const fi = ids.indexOf(from);
          const ti = ids.indexOf(ex.id);
          if (fi < 0 || ti < 0) return;
          ids.splice(ti, 0, ids.splice(fi, 1)[0]);
          reorderExercises(workout!.id, ids);
        }}
      >
        <div className="head">
          {renaming === ex.id ? (
            <>
              <input
                className="input"
                style={{
                  minHeight: 40,
                  fontSize: 15,
                  borderColor: 'var(--color-accent)',
                }}
                value={renameVal}
                autoFocus
                onChange={(e) => setRenameVal(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ height: 40, fontSize: 13 }}
                onClick={() => {
                  if (renameVal.trim()) renameExercise(workout!.id, ex.id, renameVal.trim());
                  setRenaming(null);
                }}
              >
                {t.save}
              </button>
            </>
          ) : (
            <>
              {grp ? (
                <span className="ss-index">
                  {grp.letter}
                  {grp.index + 1}
                </span>
              ) : (
                <span
                  className="drag-handle"
                  draggable
                  title={t.reorder}
                  onDragStart={(e) => {
                    dragId.current = ex.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    dragId.current = null;
                  }}
                >
                  <Icon name="dots-six" />
                </span>
              )}
              <button
                className="name"
                draggable={!grp}
                onDragStart={(e) => {
                  if (grp) return;
                  dragId.current = ex.id;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  dragId.current = null;
                }}
                onClick={() =>
                  props.shell.openOverlay({
                    screen: 'exercise-history',
                    name: ex.name,
                  })
                }
              >
                <ExerciseName name={ex.name} />
              </button>
              {(timed || marker) && <span className="prev">{t.exerciseKindNames[kind]}</span>}
              {!grp && !timed && !marker && prev && !target && (
                <span className="prev">{t.prev(fmtSet(prev.weight, prev.reps))}</span>
              )}
              {!grp && planned > 0 && (
                <span className={`plan-count${ex.sets.length >= planned ? ' done' : ''}`}>
                  {ex.sets.length} / {planned}
                </span>
              )}
              {grp && groupDone && (
                <span className="ss-done">
                  <Icon name="check-circle" weight="fill" />
                </span>
              )}
              {grp && !groupDone && grp.active && <span className="ss-now">{t.nowLabel}</span>}
              {/* Settings stay reachable in focus mode too — markers and cardio have
                  no set editor to reach them from, so this is how they're removed. */}
              {/* In focus mode strength sets reach options via the sliders next to
                  Log; markers and cardio have no set row, so they keep a door here. */}
              {!grp && !focusView && (
                <button
                  className="dots ex-settings"
                  onClick={() =>
                    setSheet(
                      focusView
                        ? {
                            kind: 'opts',
                            tab: 'exercise',
                            exId: ex.id,
                            set: null,
                            ghost: timed ? timedSheetGhost : null,
                          }
                        : { kind: 'menu', exId: ex.id },
                    )
                  }
                  aria-label={t.menuAction}
                >
                  <Icon name={focusView ? 'sliders-horizontal' : 'gear'} />
                </button>
              )}
            </>
          )}
        </div>
        {renaming === ex.id && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-neutral-600)',
              marginBottom: 8,
            }}
          >
            {t.renameHint}
          </div>
        )}
        {showChips && (
          <div className="exercise-chips one-line">
            <button
              className={`eq-pick-btn${
                (ex.equipmentItems && ex.equipmentItems.length > 0) || equipment.length > 0
                  ? ' on'
                  : ''
              }`}
              onClick={() => setSheet({ kind: 'equip', exId: ex.id })}
              aria-label={t.eqEquipment}
              title={t.eqEquipment}
            >
              <Icon name="barbell" />
            </button>
            <SidesChip
              ex={ex}
              onClick={
                props.past
                  ? undefined
                  : () => setSheet({ kind: 'opts', tab: 'set', exId: ex.id, set: null, ghost })
              }
            />
            {muscles.primary && (
              <MuscleDetailContext.Provider
                value={
                  focusView && live
                    ? (m: MuscleGroup) => (
                        <MuscleStatePanel
                          muscle={m}
                          workout={workout!}
                          todaySets={sessionTally().get(m) ?? 0}
                          plateau={plateauFor(m)}
                        />
                      )
                    : null
                }
              >
                <MuscleRow
                  entries={[
                    { muscle: muscles.primary, sets: ex.sets.length, primary: true },
                    ...muscles.secondary.map((m) => ({
                      muscle: m,
                      sets: ex.sets.length * 0.5,
                      primary: false,
                    })),
                  ]}
                  refTs={workout!.startedAt}
                  onOpen={openMuscleHistory}
                  showWeek={ex.sets.length > 0}
                  dots={
                    focusView && live
                      ? readinessDots([muscles.primary, ...muscles.secondary])
                      : undefined
                  }
                />
              </MuscleDetailContext.Provider>
            )}
          </div>
        )}
        {focusView &&
          !marker &&
          !timed &&
          (() => {
            const photos = (richExerciseByName(ex.name)?.images ?? []).slice(0, 4);
            if (photos.length === 0) return null;
            return (
              <button
                type="button"
                className={`ex-photos n${Math.min(photos.length, 2)}`}
                onClick={() => setPhotoView({ images: photos, title: ex.name })}
                aria-label={ex.name}
              >
                {photos.slice(0, 2).map((src, i) => (
                  <span className="ex-photo" key={src + i}>
                    <img src={src} alt="" loading="lazy" draggable={false} />
                    {photos.length >= 2 && (
                      <span className="ex-photo-tag">{i === 0 ? t.photoStart : t.photoEnd}</span>
                    )}
                  </span>
                ))}
                <span className="ex-photos-zoom" aria-hidden>
                  <Icon name="corners-out" weight="bold" />
                </span>
              </button>
            );
          })()}
        {marker ? (
          <div className="warmup-marker-body">
            <span className={`warmup-marker-photo-wrap`}>
              <img
                className="warmup-marker-photo"
                src={MARKER_IMAGES[kind === 'cooldown' ? 'cooldown' : 'warmup']}
                alt=""
              />
              <span className="photo-tint-layer" aria-hidden />
            </span>
            <span className="warmup-marker-icon" aria-hidden>
              <Icon name={kind === 'cooldown' ? 'wind' : 'flame'} weight="fill" />
            </span>
            <div className="warmup-marker-copy">
              <span className="warmup-marker-title">
                {kind === 'cooldown' ? t.cooldownMarkerTitle : t.warmupMarkerTitle}
                {ex.plannedDurationMin ? ` · ~${ex.plannedDurationMin} ${t.minShort}` : ''}
              </span>
              <span className="warmup-marker-sub">
                {kind === 'cooldown' ? t.cooldownMarkerBody : t.warmupMarkerBody}
              </span>
            </div>
            {focusView && <span className="warmup-marker-cfg">{cfgBtn}</span>}
          </div>
        ) : null}
        {marker ? null : timed ? (
          <>
            {focusView && cardioImg ? (
              <span className="cardio-photo">
                <img src={cardioImg} alt="" />
                {!props.past && (
                  <button
                    className="cardio-machine-chip on-photo"
                    onClick={() => setSheet({ kind: 'cardio-machine', exId: ex.id })}
                  >
                    <Icon name="swap" />
                    {t.cardioChangeMachine}
                  </button>
                )}
              </span>
            ) : (
              kind === 'cardio' &&
              !props.past && (
                <button
                  className="cardio-machine-chip"
                  onClick={() => setSheet({ kind: 'cardio-machine', exId: ex.id })}
                >
                  <Icon name="swap" />
                  {t.cardioChangeMachine}
                </button>
              )
            )}
            {(ex.sets.length > 0 || !live) && (
              <div className="set-grid header timed">
                <span>#</span>
                <span>{t.durationMinCol}</span>
                <span>{cardioCol ? cardioFieldCol(t, cardioCol) : ''}</span>
                <span>{t.rpeShort}</span>
              </div>
            )}
            <div style={renaming === ex.id ? { opacity: 0.6 } : undefined}>
              {sortedSets.map((s, i) => {
                // The row shows the machine's headline reading; the rest of the
                // console (speed, incline, watts, pace…) reads as a quiet line.
                const extras = cardioFields
                  .slice(1)
                  .map((f) => {
                    const v = cardioFieldVal(s, f);
                    if (v === null) return null;
                    return f === 'level' ? `${t.levelCol} ${v}` : `${v} ${cardioFieldCol(t, f)}`;
                  })
                  .filter((x): x is string => x !== null);
                const pace = showPace ? pace500Sec(s) : null;
                if (pace) extras.push(t.pace500(mmss(pace * 1000)));
                return (
                  <Fragment key={s.id}>
                    <button
                      className="set-row timed"
                      onClick={() =>
                        setSheet({ kind: 'edit', exId: ex.id, set: s, ghost: timedSheetGhost })
                      }
                    >
                      <span className="idx">{i + 1}</span>
                      <span className="val">{s.durationMin ?? 0}</span>
                      <span className="val">
                        {cardioCol ? (cardioFieldVal(s, cardioCol) ?? '—') : ''}
                      </span>
                      <span className="kind">{s.rpe ?? t.optionalMark}</span>
                    </button>
                    {extras.length > 0 && <div className="timed-extra">{extras.join(' · ')}</div>}
                  </Fragment>
                );
              })}
              {/* Past sessions have no clock to run — enter the entry by hand. */}
              {!live && (
                <div className="ghost-row timed">
                  <span className="idx">{ex.sets.length + 1}</span>
                  <button
                    className="gval"
                    onClick={() =>
                      setSheet({ kind: 'edit', exId: ex.id, set: null, ghost: timedSheetGhost })
                    }
                  >
                    {timedGhost.durationMin}
                  </button>
                  <button
                    className="gval"
                    onClick={() =>
                      setSheet({ kind: 'edit', exId: ex.id, set: null, ghost: timedSheetGhost })
                    }
                  >
                    {cardioCol ? (cardioFieldVal(timedGhost, cardioCol) ?? '—') : ''}
                  </button>
                  <button
                    className="btn btn-primary log-btn"
                    onClick={() => logTimedGhost(ex, timedGhost)}
                  >
                    {props.past ? t.add : t.log}
                  </button>
                </div>
              )}
              {renderRest(ex)}
              {/* Live: one clear action — Start, then Finish. Repeat for more
                  intervals; each Finish logs an entry. Manual entry stays as a
                  quiet link for when the clock wasn't running. */}
              {live &&
                (timing?.exId === ex.id ? (
                  <div className="timed-timer running">
                    <span className="tt-count num">{mmss(now - timing.startedAt)}</span>
                    <button className="btn btn-primary tt-stop" onClick={() => stopTiming(ex)}>
                      <Icon name="stop" weight="fill" />
                      {t.timerStop}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="gset-actions timed-actions">
                      {focusView && cfgBtn}
                      <button
                        className="btn btn-primary timed-timer start"
                        disabled={!!timing}
                        onClick={() => startTiming(ex)}
                      >
                        <Icon name="play" weight="fill" />
                        {ex.sets.length > 0 ? t.timerStartN(ex.sets.length + 1) : t.timerStart}
                      </button>
                    </div>
                    <button
                      className="timed-manual"
                      onClick={() =>
                        setSheet({ kind: 'edit', exId: ex.id, set: null, ghost: timedSheetGhost })
                      }
                    >
                      {t.timedLogManual}
                    </button>
                  </>
                ))}
            </div>
          </>
        ) : (
          <>
            {target && showGhost && !grp && (
              <div className={`prog-hint st-${target.state}`}>
                {target.deltaKg > 0 && (
                  <span className="ph-delta up">+{fmtWeightValue(target.deltaKg)}</span>
                )}
                {target.deltaKg < 0 && (
                  <span className="ph-delta down">{fmtWeightValue(target.deltaKg)}</span>
                )}
                <span className="ph-arrow">→</span>
                <span className="ph-target">
                  {target.weight === null
                    ? t.progRepsTarget(target.reps)
                    : `${fmtWeightValue(target.weight)} ${t.kgCol.toLowerCase()}`}
                </span>
                <span className="ph-sep">·</span>
                <span className="ph-action">
                  {target.state === 'progress'
                    ? t.progAdd
                    : target.state === 'stall'
                      ? t.progDeload
                      : target.state === 'hold'
                        ? t.progHold
                        : t.progFirst}
                </span>
                {prev && (
                  <>
                    <span className="ph-sep">·</span>
                    <span className="ph-prev">{t.prev(fmtSet(prev.weight, prev.reps))}</span>
                  </>
                )}
              </div>
            )}
            {!grp && ex.sets.length > 0 && (
              <div className="set-grid header">
                <span>#</span>
                <span>{t.repsCol}</span>
                <span>{loadColHead ?? (isDesktop ? t.weightCol : t.kgCol)}</span>
                <span>{isDesktop ? t.typeCol : ''}</span>
                {isDesktop && <span />}
              </div>
            )}
            <div style={renaming === ex.id ? { opacity: 0.6 } : undefined}>
              {sortedSets.map((s, i) => {
                // K1 · a bar per set: height = how much it built, colour
                // intensity = how far performance had dropped.
                const meter = meters ? meters.stim.get(s.id) : undefined;
                const meterStyle =
                  meter !== undefined
                    ? ({
                        // Linear, same scale as the "Muscle gain from this set"
                        // meter on the set card (warm-ups get a min-height nub).
                        '--stim': meter.toFixed(2),
                        // Colour = the worse of: how far performance dropped, and how
                        // little this set still built (diminishing returns).
                        // Warm-ups: the muscle's load so far (they barely build).
                        '--fat': (setTypeOf(s) === 'warmup'
                          ? (meters!.load.get(s.id) ?? 0)
                          : Math.min(1, Math.max((meters!.drop.get(s.id) ?? 0) / 0.1, 1 - meter))
                        ).toFixed(2),
                      } as CSSProperties)
                    : undefined;
                const rec = isRecordSet(ex, s);
                const type = setTypeOf(s);
                const drops = setDrops(s);
                const idx = grp ? `R${i + 1}` : `${i + 1}`;
                // Rest before this set — derived live from the set timestamps
                // (gap to the previously logged set anywhere in the session,
                // minus this set's own working time), so it stays correct for
                // every past session. For a card's first set the gap is the rest
                // since the previous exercise, so it renders as a "between cards"
                // marker on top.
                const restSecBefore = restBeforeSetInWorkout(workout!, s);
                const restBefore = restSecBefore != null ? restSecBefore * 1000 : null;
                const interCard = i === 0;
                const planned = s.restTargetSec ?? null;
                const cutShort =
                  planned !== null && restSecBefore != null && restSecBefore < planned * 0.8;
                // A rest that ran long, with slack: only once it's both 50% over
                // the plan AND a full minute past it — a few seconds late on a
                // phone check is never flagged. Between exercises it's not a
                // "rest", so the first set of a card never reads as too long.
                const ranLong =
                  !interCard &&
                  planned !== null &&
                  restSecBefore != null &&
                  restSecBefore > planned * 1.5 &&
                  restSecBefore - planned >= 60;
                // A rest cut short always shows — even a near-zero one.
                const restLine =
                  restBefore !== null && (restBefore > 0 || cutShort) ? (
                    <div
                      className={`set-rest${interCard ? ' inter-card' : ''}${cutShort ? ' short' : ''}${
                        ranLong ? ' long' : ''
                      }`}
                    >
                      {cutShort
                        ? t.restShortLabel(mmss(restBefore), mmss(planned * 1000))
                        : ranLong
                          ? t.restLongLabel(mmss(restBefore), mmss(planned * 1000))
                          : t.restLabel(mmss(restBefore))}
                    </div>
                  ) : null;
                const delBtn = live ? (
                  <button
                    type="button"
                    className="set-del"
                    title={t.deleteSet}
                    aria-label={t.deleteSet}
                    onClick={() => setDialog({ kind: 'del-set', exId: ex.id, setId: s.id })}
                  >
                    <Icon name="trash" />
                  </button>
                ) : null;
                const row = (
                  <button
                    className={`set-row${rowCls}${type === 'warmup' ? ' warm' : ''}${
                      rec ? ' record' : ''
                    }${meterStyle ? ' metered' : ''}`}
                    style={meterStyle}
                    onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })}
                  >
                    <span className="idx">{idx}</span>
                    <span className="val">
                      {type === 'static-dynamic' ? fmtHold(s.durationMin) : s.reps}
                      {s.partials ? <span className="partials">+{s.partials}p</span> : null}
                    </span>
                    <span className={`val${loadType === 'assist' ? ' assist-val' : ''}`}>
                      {loadCell(s.weight)}
                    </span>
                    {(() => {
                      // Tags cell: effort, failure and record as small pills
                      // (the plain "working" word only when there's nothing else).
                      const fail = isFailure(s);
                      const rpeV = type === 'warmup' ? null : (s.rpe ?? null);
                      // F already says RPE 10 — no separate estimate next to it.
                      const rpeEst = type === 'warmup' || rpeV || fail ? null : (s.rpeAuto ?? null);
                      if (!rec && !fail && rpeV === null && rpeEst === null)
                        return setKindLabel(ex, s, grp);
                      return (
                        <span className="kind set-tags">
                          {!rec && type !== 'working' ? setKindLabel(ex, s, grp) : null}
                          {rpeV !== null ? (
                            <span className="tag-rpe">@{rpeV}</span>
                          ) : rpeEst !== null ? (
                            <span className="tag-rpe est" title={t.rpeEstHint(String(rpeEst))}>
                              ~{rpeEst}
                            </span>
                          ) : null}
                          {fail && (
                            <span
                              className={`tag-fail${s.failure === 'auto' ? ' auto' : ''}`}
                              title={s.failure === 'auto' ? t.failAutoShort : t.failShort}
                              aria-label={s.failure === 'auto' ? t.failAutoShort : t.failShort}
                            >
                              <Icon name="flame" weight="fill" />
                              {s.failure === 'auto' ? 'F?' : 'F'}
                            </span>
                          )}
                          {rec && (
                            <span className="tag-pr" aria-label={t.record}>
                              <Icon name="trophy" weight="fill" />
                              PR
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    {isDesktop && (
                      <span className="cell5">
                        {drops.length > 0
                          ? t.inOneSet(fmtKg(setVolumeKg(s) * perHandFactor(ex))).split(' in ')[0]
                          : ''}
                      </span>
                    )}
                  </button>
                );
                if (drops.length === 0) {
                  return (
                    <div key={s.id} className="set-line">
                      {restLine}
                      <div className="set-main">
                        {row}
                        {delBtn}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={s.id} className="set-wrap">
                    {restLine}
                    <div className="set-main">
                      {row}
                      {delBtn}
                    </div>
                    <div className="drops">
                      <div className="dbar" />
                      <div className="dlist">
                        {drops.map((d, di) => (
                          <button
                            key={di}
                            className="drop-row"
                            onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })}
                          >
                            <span>{d.reps}</span>
                            <span>
                              {d.weight === null
                                ? t.bodyweightShort
                                : isDesktop
                                  ? fmtWeightKg(d.weight)
                                  : fmtWeightValue(d.weight)}
                            </span>
                            <span className="kind">
                              {isDesktop ? t.dropRowN(di + 1) : t.dropN(di + 1)}
                            </span>
                            {isDesktop && <span />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="set-foot">
                      <span>{t.dropsFoot(drops.length + 1, setRepsTotal(s))}</span>
                      <span>{t.inOneSet(fmtKg(setVolumeKg(s) * perHandFactor(ex)))}</span>
                    </div>
                  </div>
                );
              })}
              {/* Live rest count-up on the exercise that owns the most recent
                  set, AND on a freshly focused exercise with no sets yet — the
                  rest carries over from the previous exercise's last set, so the
                  new card shows the (full-width) counter before its first set. */}
              {renderRest(ex)}
              {showGhost &&
                (grp ? (
                  <div className={`ghost-row${rowCls}`}>
                    <span className="idx">{`R${ex.sets.length + 1}`}</span>
                    <button
                      className="gval"
                      onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })}
                    >
                      {ghost.reps}
                    </button>
                    <button
                      className="gval"
                      onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })}
                    >
                      {ghost.weight === null ? '—' : fmtWeightValue(ghost.weight)}
                    </button>
                    {isDesktop && <span className="kind" />}
                    <button
                      className="btn btn-primary log-btn"
                      disabled={directLogBlocked}
                      onClick={() => logGhost(ex, ghost, ghostKind(ghost, ghost.weight), ghost)}
                    >
                      {props.past ? t.add : t.log}
                    </button>
                  </div>
                ) : (
                  <GhostSetRow
                    key={`${ex.id}:${ex.sets.length}`}
                    ex={ex}
                    defReps={ghost.reps}
                    defWeightKg={ghost.weight}
                    weightRequired={directLogBlocked}
                    isPast={!!props.past}
                    title={
                      focusView
                        ? ghost.ramp
                          ? t.warmupRampTitle(ghost.ramp.i, ghost.ramp.n)
                          : ghost.type === 'drop'
                            ? t.setTypeDrop
                            : ghost.type === 'reverse-drop'
                              ? t.setTypeReverse
                              : ghost.type === 'static-dynamic'
                                ? t.setTypeStaticDynamic
                                : t.enterThisSet
                        : undefined
                    }
                    kind={ghost.type ?? (ghost.warmup ? 'warmup' : 'working')}
                    note={ghostTechniqueNote(ghost)}
                    defHoldSec={ghost.holdMin ? Math.round(ghost.holdMin * 60) : undefined}
                    defDrops={ghost.drops}
                    failSuggest={ghostFailSuggest(ex, ghost)}
                    prHint={ghostPrHint(ex, ghost)}
                    onLog={(v) =>
                      logGhost(
                        ex,
                        v,
                        ghostKind(ghost, v.weight),
                        v.holdMin
                          ? { ...ghost, holdMin: v.holdMin }
                          : v.drops
                            ? { weight: v.weight, drops: v.drops }
                            : ghost,
                        { reps: ghost.reps, weight: ghost.weight },
                      )
                    }
                    worth={focusView ? nextWorth(ex) : null}
                    onSettings={() =>
                      setSheet(
                        focusView
                          ? { kind: 'opts', tab: 'set', exId: ex.id, set: null, ghost }
                          : { kind: 'edit', exId: ex.id, set: null, ghost },
                      )
                    }
                  />
                ))}
              {focusView && live && ex.id === focusedId && renderTiredBanner(ex)}
            </div>
          </>
        )}
        {live && !grp && focusedId === ex.id && nextEx && (
          <>
            <div className="start-next-divider" />
            <button
              className="btn btn-secondary start-next"
              onClick={() => {
                const nx = nextEx;
                if (!nx) return;
                setExpandedId(nx.id);
                requestAnimationFrame(() => {
                  document
                    .querySelector(`[data-exid="${nx.id}"]`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
              }}
            >
              <Icon name="arrow-down" />
              {t.startNext(nextEx.name)}
            </button>
          </>
        )}
        {ex.sets.length === 0 && live && !marker && !timed && (
          <div className="ghost-hint">
            {directLogBlocked
              ? t.progWeightRequired
              : planned > 0
                ? t.progGhostDivision
                : timed
                  ? null
                  : ghost.ramp
                    ? t.ghostWarmupHint(fmtWeightKg(ghost.ramp.toKg))
                    : t.ghostHint}
          </div>
        )}
      </div>
    );
  }

  /** Exercise options — the classic ⚙ menu and the focus options sheet's
   *  "Exercise" tab share this list; the tab adds group labels and the
   *  equipment / rename / machine rows the focus card no longer shows. */
  const renderExerciseOptions = (ex: Exercise, tabs: boolean) => (
    <>
      {tabs && !isMarkerExercise(ex) && <div className="opts-group-label">{t.optsGroupChange}</div>}
      {tabs && isTimedExercise(ex) && exerciseKind(ex) === 'cardio' && !props.past && (
        <button
          className="menu-item"
          onClick={() => setSheet({ kind: 'cardio-machine', exId: ex.id })}
        >
          <Icon name="swap" />
          {t.cardioChangeMachine}
        </button>
      )}
      {sidesEligible(ex) &&
        loadTypeFor(ex) !== 'assist' &&
        loadTypeFor(ex) !== 'band' &&
        (() => {
          const sv = sidesFor(ex.name) ?? (perHandFactor(ex) === 2 ? 'one' : 'both');
          return (
            <div className="menu-sides sides-block">
              <div className="toggle-row sides-row">
                <Icon name="arrows-out-line-horizontal" />
                <span className="lab">{t.sidesLabel}</span>
                <div className="seg2 sides-seg">
                  <button
                    className={sv === 'both' ? 'active' : ''}
                    onClick={() => setExerciseSides(ex.name, 'both')}
                  >
                    {t.sidesBoth}
                  </button>
                  <button
                    className={sv === 'one' ? 'active' : ''}
                    onClick={() => setExerciseSides(ex.name, 'one')}
                  >
                    {t.sidesOne}
                  </button>
                </div>
              </div>
              {sv === 'one' && (
                <div className="sides-note">
                  <Icon name="info" />
                  {t.sidesNote}
                </div>
              )}
            </div>
          );
        })()}
      {/* Warm-up / cool-down markers only need removing; cardio keeps the
          set tools but has no catalog details or lift history. */}
      {isStrengthExercise(ex) && (
        <button className="menu-item" onClick={() => setSheet({ kind: 'replace', exId: ex.id })}>
          <Icon name="swap" />
          {t.replaceExercise}
        </button>
      )}
      {tabs && isStrengthExercise(ex) && (
        <button className="menu-item" onClick={() => setSheet({ kind: 'equip', exId: ex.id })}>
          <Icon name="barbell" />
          {t.eqEquipment}
        </button>
      )}
      {!tabs && !isMarkerExercise(ex) && (
        <button
          className="menu-item"
          onClick={() => {
            duplicateExercise(workout!.id, ex.id);
            setSheet(null);
          }}
        >
          <Icon name="copy" />
          {t.duplicateWithSets}
        </button>
      )}
      {isStrengthExercise(ex) &&
        !ex.groupId &&
        sortedExercises.filter((e) => isStrengthExercise(e) && !e.groupId).length > 1 && (
          <button className="menu-item" onClick={() => setSheet({ kind: 'superset', exId: ex.id })}>
            <Icon name="rows" />
            {t.supersetWith}
          </button>
        )}
      {ex.groupId && (
        <button
          className="menu-item"
          onClick={() => {
            ungroupSuperset(workout!.id, ex.groupId!);
            setSheet(null);
          }}
        >
          <Icon name="x" />
          {t.ungroup}
        </button>
      )}
      {isStrengthExercise(ex) && (
        <>
          {tabs && <div className="opts-group-label">{t.optsGroupLookUp}</div>}
          <button
            className="menu-item"
            onClick={() => {
              props.shell.openOverlay({ screen: 'exercise-detail', name: ex.name });
              setSheet(null);
            }}
          >
            <Icon name="info" />
            {t.detailsAction}
          </button>
          <button
            className="menu-item"
            onClick={() => {
              props.shell.openOverlay({ screen: 'exercise-history', name: ex.name });
              setSheet(null);
            }}
          >
            <Icon name="chart-line-up" />
            {t.openHistory}
          </button>
        </>
      )}
      {tabs && !isMarkerExercise(ex) && (
        <div className="opts-quick">
          <button
            type="button"
            onClick={() => {
              duplicateExercise(workout!.id, ex.id);
              setSheet(null);
            }}
          >
            <Icon name="copy" />
            {t.duplicateWithSets}
          </button>
          {ex.sets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const removed = clearSets(workout!.id, ex.id);
                setSheet(null);
                if (removed.length > 0) {
                  props.shell.snack({
                    text: t.exerciseDeleted(ex.name, removed.length),
                    onUndo: () => {
                      for (const s of removed) restoreSet(workout!.id, ex.id, s);
                    },
                  });
                }
              }}
            >
              <Icon name="eraser" />
              {t.clearAllSets}
            </button>
          )}
        </div>
      )}
      {!tabs && ex.sets.length > 0 && (
        <button
          className="menu-item"
          onClick={() => {
            const removed = clearSets(workout!.id, ex.id);
            setSheet(null);
            if (removed.length > 0) {
              props.shell.snack({
                text: t.exerciseDeleted(ex.name, removed.length),
                onUndo: () => {
                  for (const s of removed) restoreSet(workout!.id, ex.id, s);
                },
              });
            }
          }}
        >
          <Icon name="eraser" />
          {t.clearAllSets}
        </button>
      )}
      <div className="sheet-rule" />
      <button
        className="menu-item danger"
        onClick={() => {
          if (ex.sets.length > 0) {
            setDialog({ kind: 'del-ex', exId: ex.id });
            setSheet(null);
          } else {
            removeExercise(ex);
          }
        }}
      >
        <Icon name="trash" />
        {t.deleteExercise}
      </button>
    </>
  );

  /** Session options — the classic session-settings sheet and the focus
   *  options sheet's "Session" tab (which adds add / readiness / gym rows). */
  const renderSessionOptions = (tabs: boolean) => (
    <>
      <button
        className={`ss-circuit${circuit.on ? ' on' : ''}`}
        onClick={() =>
          setCircuit((c) =>
            c.on
              ? { on: false, groupId: null, rounds: c.rounds }
              : { on: true, groupId: crypto.randomUUID(), rounds: c.rounds },
          )
        }
      >
        <span className="ss-top">
          <span className="ss-loop">
            <Icon name="arrows-clockwise" />
          </span>
          <span className="ss-circuit-text">
            <span className="ss-circuit-title">{t.circuitLabel}</span>
            <span className="ss-circuit-hint">{t.circuitHint}</span>
          </span>
          <Switch on={circuit.on} />
        </span>
        <span className="ss-desc">{t.circuitSettingDesc}</span>
      </button>
      {tabs && live && (
        <div className="opts-rows">
          {hasSessionStartCoach(
            store.workouts.filter((w) => w.finishedAt !== null),
            now,
          ) && (
            <button className="menu-item" onClick={() => setSheet({ kind: 'coach' })}>
              <Icon name="heartbeat" />
              {t.sessionCoachButton}
            </button>
          )}
          <button className="menu-item" onClick={() => setSheet({ kind: 'gym' })}>
            <Icon name="map-pin" />
            <span className="mi-text">
              {t.changeGym}
              {gym ? <span className="mi-sub">{gym.name}</span> : null}
            </span>
          </button>
        </div>
      )}
    </>
  );

  /** Readiness right now, per muscle — the dots on focus muscle chips (green
   *  ready, brass nearly, red recovering; same colours as the picker). Today's
   *  sets count: a muscle worked hard this session turns red. */
  const readinessDots = (ms: MuscleGroup[]): Partial<Record<MuscleGroup, string>> => {
    const hist = [...store.workouts.filter((w) => w.finishedAt !== null), workout!];
    const at = live ? now : workout!.startedAt;
    const out: Partial<Record<MuscleGroup, string>> = {};
    for (const m of ms) {
      const r = directReadiness([m], m, hist, at);
      // 'stale' (not trained lately) gets no dot — only a real recovery reading does.
      if (r.days !== null && r.state !== 'stale') out[m] = READINESS_COLOR[r.state];
    }
    return out;
  };

  function startTiming(ex: Exercise): void {
    setTiming({ exId: ex.id, startedAt: Date.now() });
  }
  /** Finish an interval: log it with the measured time straight away (so it's
   *  never lost), then open it so the console readings — km, watts, level… —
   *  can go in while they're still on the screen. A stray tap under ~6 s is
   *  just cancelled. */
  function stopTiming(ex: Exercise): void {
    if (!timing || timing.exId !== ex.id) return;
    const min = Math.max(0, (wallClock() - timing.startedAt) / 60000);
    setTiming(null);
    if (min < 0.1) return;
    const kind = exerciseKind(ex);
    const vals = {
      reps: 0,
      weight: null,
      isWarmup: kind === 'warmup',
      durationMin: Math.round(min * 10) / 10,
      distanceKm: null,
      calories: null,
      rpe: null,
    };
    const id = logNewSet(ex, vals);
    setSheet({
      kind: 'edit',
      exId: ex.id,
      set: { ...vals, id, position: ex.sets.length },
      ghost: { reps: 0, weight: null, ...timedGhostFor(ex) },
    });
  }

  function logTimedGhost(ex: Exercise, v: TimedGhost): void {
    const kind = exerciseKind(ex);
    logNewSet(ex, {
      reps: 0,
      weight: null,
      isWarmup: kind === 'warmup',
      durationMin: v.durationMin,
      distanceKm: v.distanceKm ?? null,
      speedKmh: v.speedKmh ?? null,
      inclinePct: v.inclinePct ?? null,
      watts: v.watts ?? null,
      level: v.level ?? null,
      floors: v.floors ?? null,
      calories: null,
      rpe: null,
    });
  }

  function formatTimedEntry(s: SetEntry): string {
    const parts = [`${s.durationMin ?? 0} ${t.minShort}`];
    if (s.distanceKm !== null && s.distanceKm !== undefined && s.distanceKm > 0) {
      parts.push(`${s.distanceKm} ${t.kmShort}`);
    }
    if (s.speedKmh && s.speedKmh > 0) parts.push(`${s.speedKmh} ${t.speedCol}`);
    if (s.inclinePct && s.inclinePct > 0) parts.push(`${s.inclinePct}%`);
    if (s.watts && s.watts > 0) parts.push(`${s.watts} ${t.wattsCol}`);
    if (s.level && s.level > 0) parts.push(`${t.levelCol} ${s.level}`);
    if (s.floors && s.floors > 0) parts.push(`${s.floors} ${t.floorsCol}`);
    if (s.calories !== null && s.calories !== undefined && s.calories > 0) {
      parts.push(`${s.calories} ${t.kcalShort}`);
    }
    if (s.rpe !== null && s.rpe !== undefined && s.rpe > 0) {
      parts.push(`${t.rpeShort} ${s.rpe}`);
    }
    return parts.join(' · ');
  }

  /** Gather local workout data into the share-card model (AC-3.4, privacy AC-3.6). */
  function buildShareModel(): ShareModel {
    const w = workout!;
    const readout = workoutDayReadout(w);
    const title =
      programDayNameFor(w, store.workouts) ||
      (readout ? dayReadoutLabel(readout, t) : t.sessionDone);
    const prSet = w.exercises
      .flatMap((e) => e.sets.map((s) => ({ e, s })))
      .filter(({ e, s }) => isRecordSet(e, s))
      .sort((a, b) => (b.s.weight ?? 0) - (a.s.weight ?? 0))[0];
    const top = w.exercises
      .filter((e) => isStrengthExercise(e) && e.sets.length > 0)
      .map((e) => ({ e, vol: exerciseVolumeKg(e) }))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 3)
      .map(({ e }) => {
        const best = topSet(e.sets);
        return {
          name: e.name,
          detail: best ? fmtSet(best.weight, best.reps) : `${e.sets.length} ${t.sets}`,
        };
      });
    const muscleNames = t.muscleGroups as Record<string, string>;
    const muscles = [...muscleSetsInWorkout(w).entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => ({ name: muscleNames[m] ?? m, count: n }));
    return {
      brand: t.appName,
      tagline: t.shareCardTagline,
      title,
      date: fmtFullDate(w.startedAt, locale),
      gym: gymName ?? null,
      heroValue: fmtTonnes(volume),
      heroLabel: t.shareTotalVolume,
      stats: [
        { label: t.duration, value: fmtDurationHM((w.finishedAt ?? now) - w.startedAt) },
        { label: t.setsStat, value: String(sets) },
        { label: t.exercises, value: String(w.exercises.length) },
      ],
      record: prSet
        ? {
            name: t.newRecord,
            detail: `${prSet.e.name} · ${fmtWeightKg(prSet.s.weight ?? 0)} × ${prSet.s.reps}`,
          }
        : null,
      top,
      topLabel: t.shareTopExercises,
      muscles,
      autoFinished: w.autoFinished,
      autoLabel: t.closedAutomatically,
    };
  }

  function requestFinish(): void {
    // Always confirm — "are you ready to finish?" — and warn about any empty
    // exercise that would be dropped.
    const empty = workout!.exercises.find((e) => e.sets.length === 0 && !isMarkerExercise(e));
    setDialog({ kind: 'finish-warn', emptyName: empty ? empty.name : null });
  }

  function doFinish(): void {
    finishWorkoutClean(workout!.id);
    setDialog(null);
    setSummary(true);
  }

  function removeSet(ex: Exercise, s: SetEntry): void {
    deleteSet(workout!.id, ex.id, s.id);
    setSheet(null);
    props.shell.snack({
      text: t.setDeleted(isTimedExercise(ex) ? formatTimedEntry(s) : fmtSetSnack(s.reps, s.weight)),
      onUndo: () => restoreSet(workout!.id, ex.id, s),
    });
  }

  function removeExercise(ex: Exercise): void {
    const copy: Exercise = { ...ex, sets: [...ex.sets] };
    deleteExercise(workout!.id, ex.id);
    setDialog(null);
    setSheet(null);
    props.shell.snack({
      text: t.exerciseDeleted(ex.name, copy.sets.length),
      onUndo: () => restoreExercise(workout!.id, copy),
    });
  }

  // --- Summary (S-29) ------------------------------------------------------

  if (summary) {
    const prSet = workout.exercises
      .flatMap((e) => e.sets.map((s) => ({ e, s })))
      .filter(({ e, s }) => isRecordSet(e, s))
      .sort((a, b) => (b.s.weight ?? 0) - (a.s.weight ?? 0))[0];
    const prevW = store.workouts.find(
      (w) => w.id !== workout.id && w.finishedAt !== null && w.startedAt < workout.startedAt,
    );
    const compare: { name: string; v: string; delta: number | null }[] = [];
    if (prevW) {
      for (const e of workout.exercises) {
        if (!isStrengthExercise(e)) continue;
        const vol = exerciseVolumeKg(e);
        const prevEx = prevW.exercises.find((p) => p.name.toLowerCase() === e.name.toLowerCase());
        const prevVol = prevEx ? exerciseVolumeKg(prevEx) : 0;
        compare.push({
          name: e.name,
          v: fmtKg(vol),
          delta: prevVol > 0 ? Math.round(((vol - prevVol) / prevVol) * 100) : null,
        });
      }
      const prevTotal = workoutVolumeKg(prevW);
      compare.push({
        name: t.sessionVolume,
        v: fmtTonnes(volume),
        delta: prevTotal > 0 ? Math.round(((volume - prevTotal) / prevTotal) * 100) : null,
      });
    }
    return (
      <div className="screen" style={{ gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="saved-mark">
            <Icon name="check-circle" weight="fill" />
            <span>{t.sessionSaved}</span>
          </div>
        </div>
        <div>
          <h2 className="headline" style={{ fontSize: 32 }}>
            {t.sessionDone}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 6 }}>
            {fmtFullDate(workout.startedAt, locale)}
            {gymName ? ` · ${gymName}` : ''}
          </div>
        </div>
        <AtlasDebrief
          workout={workout}
          onOpen={() => props.shell.openOverlay({ screen: 'coach' })}
        />
        <div className="stat-grid">
          <div className="cell">
            <div className="v">
              {fmtDurationHM((workout.finishedAt ?? now) - workout.startedAt)}
            </div>
            <div className="l">{t.duration}</div>
          </div>
          <div className="cell">
            <div className="v">{sets}</div>
            <div className="l">{t.setsStat}</div>
          </div>
          <div className="cell">
            <div className="v">{fmtTonnes(volume)}</div>
            <div className="l">{t.movedStat}</div>
          </div>
          {cardioMinutes > 0 && (
            <div className="cell">
              <div className="v">{Math.round(cardioMinutes)}</div>
              <div className="l">{t.cardioMinutes}</div>
            </div>
          )}
          {cardioDistance > 0 && (
            <div className="cell">
              <div className="v">{cardioDistance.toFixed(1)}</div>
              <div className="l">{t.distanceKmCol}</div>
            </div>
          )}
        </div>
        {sessionKcal != null && <EnergyPlaque kcal={sessionKcal} />}
        {gym &&
          !gymHasNoList(gym) &&
          (() => {
            // Kit today's lifts used that the gym's list lacks — reviewed while
            // there's a minute, right after the workout.
            const items = gymKitEvidence(gym.id, wallClock()).filter(
              (e) => e.lastAt >= workout.startedAt,
            );
            return (
              <GymKitCard
                gym={gym}
                items={items}
                title={t.gkRecapTitle(items.length)}
                sub={gym.name}
              />
            );
          })()}
        {suggestOn &&
          (() => {
            const entries = muscleWorkSorted(workout);
            if (entries.length === 0) return null;
            return (
              <div className="muscles-worked">
                <div className="section-label">{t.muscleGroupsWorked}</div>
                <MuscleBreakdownList
                  entries={entries}
                  refTs={workout.startedAt}
                  onOpen={openMuscleHistory}
                />
              </div>
            );
          })()}
        {prSet && (
          <div className="pr-panel">
            <div className="head">
              <Icon name="trophy" />
              <span>{t.newRecord}</span>
            </div>
            <div className="big">
              {prSet.e.name} · {fmtWeightKg(prSet.s.weight ?? 0)} × {prSet.s.reps}
            </div>
            <div className="sub">
              {(() => {
                const estimated = est1rm(prSet.s.weight ?? 0, prSet.s.reps);
                return t.prevBest(
                  `${baseline.get(prSet.e.name.toLowerCase()) ?? 0} kg`,
                  estimated > 0 ? estimated : null,
                );
              })()}
            </div>
          </div>
        )}
        {compare.length > 0 && (
          <div>
            <div className="section-label">{t.comparedToLast}</div>
            <div>
              {compare.map((c, i) => (
                <div key={i} className="compare-row">
                  <span className="n">{c.name}</span>
                  <span className="v">{c.v}</span>
                  <span
                    className={`delta${c.delta !== null && c.delta >= 0 ? ' up' : c.delta !== null ? ' down' : ''}`}
                  >
                    {c.delta === null ? '—' : `${c.delta >= 0 ? '+' : '−'}${Math.abs(c.delta)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="summary-actions" style={{ marginTop: 'auto' }}>
          <button className="btn btn-primary grow share-cta" onClick={() => setShareOpen(true)}>
            <Icon name="export" />
            {t.shareWorkout}
          </button>
          <div className="sheet-actions">
            <button className="btn btn-secondary grow" onClick={() => setSummary(false)}>
              {t.editSession}
            </button>
            <button className="btn btn-secondary grow" onClick={props.onClose}>
              {t.done}
            </button>
          </div>
        </div>
        {shareOpen && (
          <ShareSheet
            model={buildShareModel()}
            isDesktop={isDesktop}
            t={t}
            shell={props.shell}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>
    );
  }

  // --- Header --------------------------------------------------------------

  const kicker = live
    ? gymName
      ? t.inSessionAt(gymName)
      : t.inSession
    : workout.autoFinished
      ? t.closedAutomatically
      : `${fmtFullDate(workout.startedAt, locale)} · ${fmtClock(workout.startedAt)}${
          workout.finishedAt ? ` → ${fmtClock(workout.finishedAt)}` : ''
        }`;

  return (
    <div
      className={`screen paned session-screen${live ? ' session-live' : ''}${props.past ? ' session-past' : ''}${workout.autoFinished ? ' session-auto' : ''}${showSessionSide ? ' session-has-side' : ''}${showRail ? ' session-has-rail' : ''}${focusView ? ' session-focus' : ''}`}
    >
      {live && !workout.autoFinished && !isDesktop && (
        <svg className="glass-defs" aria-hidden width="0" height="0">
          <filter
            id="liquid-glass"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.011 0.011"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="soft"
              scale="52"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      )}
      <div className="pane-main">
        {showRail && (
          <nav className="session-rail" aria-label={t.exerciseRailLabel}>
            {sortedExercises.map((ex) => {
              const inView = ex.id === focusedId;
              return (
                <button
                  key={ex.id}
                  type="button"
                  className={`srail-dot${exerciseDone(ex) ? ' done' : ''}`}
                  aria-label={exName(ex.name)}
                  aria-current={inView ? 'true' : undefined}
                  onClick={() => {
                    setExpandedId(ex.id);
                    document
                      .querySelector(`.session-screen [data-exid="${CSS.escape(ex.id)}"]`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              );
            })}
          </nav>
        )}
        <div className="session-head-wrap">
          <div className={`session-top${live ? ' live-toolbar' : ' past-hero'}`}>
            {live && (
              <LiveHero
                workout={workout}
                gym={gym}
                gyms={store.gyms}
                offline={store.syncStatus === 'offline'}
                queued={store.queue.length}
                mode="session"
              />
            )}
            {!live && (
              <div className="past-hero-bg" aria-hidden>
                <GymThumb
                  name={gym?.name ?? ''}
                  lat={gym?.lat ?? 0}
                  lng={gym?.lng ?? 0}
                  size={320}
                />
                <span className="past-hero-scrim" />
              </div>
            )}
            <button className="back" onClick={props.onClose} aria-label={t.backAction}>
              <Icon name="caret-left" />
            </button>
            {!live && (
              <div className="mid">
                {workout.finishedAt === null ? (
                  <div className="clock">
                    {fmtSessionClock((workout.finishedAt ?? now) - workout.startedAt)}
                  </div>
                ) : (
                  <div className="title">
                    {programDayNameFor(workout, store.workouts) ||
                      (() => {
                        const r = workoutDayReadout(workout);
                        return r ? dayReadoutLabel(r, t) : fmtDayMonth(workout.startedAt, locale);
                      })()}
                  </div>
                )}
                <button className="past-gym-row" onClick={() => setSheet({ kind: 'gym' })}>
                  <Icon name="map-pin" />
                  <span>{gym ? gym.name : t.addGymToSession}</span>
                  <Icon name="pencil-simple" className="edit" />
                </button>
              </div>
            )}
            {live ? null : workout.autoFinished ? (
              <button className="btn btn-secondary" onClick={() => reopenWorkout(workout.id)}>
                {t.reopen}
              </button>
            ) : (
              <div className="past-actions">
                <button
                  className="trash"
                  onClick={() => setDialog({ kind: 'del-workout' })}
                  aria-label={t.deleteWorkout}
                >
                  <Icon name="trash" />
                </button>
                {props.past && (
                  <button
                    className="btn btn-primary past-save"
                    onClick={() => {
                      savePastWorkout(workout.id);
                      props.onClose();
                    }}
                  >
                    {t.save}
                  </button>
                )}
              </div>
            )}
          </div>

          {!live && <div className="past-datebar">{kicker}</div>}

          {live && (
            <div className="stats-strip">
              <div>
                <div className="v">{sets}</div>
                <div className="l">{t.sets}</div>
              </div>
              <div>
                <div className="v">{fmtTonnes(volume)}</div>
                <div className="l">{t.moved}</div>
              </div>
              <div>
                <div className="v">{workout.exercises.length}</div>
                <div className="l">{t.exercises}</div>
              </div>
              {cardioMinutes > 0 && (
                <div>
                  <div className="v">{Math.round(cardioMinutes)}</div>
                  <div className="l">{t.cardioMinutes}</div>
                </div>
              )}
              {cardioDistance > 0 && (
                <div>
                  <div className="v">{cardioDistance.toFixed(1)}</div>
                  <div className="l">{t.distanceKmCol}</div>
                </div>
              )}
            </div>
          )}

          {live &&
            (() => {
              const activeEx =
                cooldownNow ?? sortedExercises.find((e) => e.id === activeExerciseId) ?? null;
              const nextSet =
                activeEx && !isMarkerExercise(activeEx) ? activeEx.sets.length + 1 : null;
              if (!activeEx && !lastLoggedAt) return null;
              return (
                <div className="live-rest">
                  {/* The current-exercise plaque stays pinned here between the
                      hero and the rest clock — shown whenever there's an active
                      exercise, with the set number only when it applies. */}
                  {activeEx && (
                    <div className="current-strip">
                      <Icon name={activeEx === cooldownNow ? 'wind' : 'barbell'} />
                      <span className="cur-label">{t.currentKicker}</span>
                      <ExerciseName name={activeEx.name} className="cur-name" />
                      {nextSet !== null && <span className="cur-set">{t.setNumber(nextSet)}</span>}
                    </div>
                  )}
                  {restRunning && (
                    <div className="rest-strip">
                      <Icon name="timer" />
                      <span className="rest-label">{t.restHeaderLabel}</span>
                      <span className="rest-clock">{mmss(Math.max(0, now - lastLoggedAt))}</span>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>

        {suggestOn &&
          (() => {
            const entries = muscleWorkSorted(workout);
            if (entries.length === 0) return null;
            return (
              <div className="muscles-worked">
                <div className="section-label mworked-head">
                  <span>{props.past ? t.muscleGroupsWorked : t.musclesWorkedLabel}</span>
                  {!muscleMapInPill && !props.past && (
                    <button className="mm-open" onClick={() => setSheet({ kind: 'musclemap' })}>
                      <Icon name="person" />
                      {t.muscleMapButton}
                    </button>
                  )}
                </div>
                <div className="mworked-row">
                  {withMuscleBreak(entries, (x) => (
                    <MuscleSetChip
                      key={x.muscle}
                      muscle={x.muscle}
                      count={x.sets}
                      tone={x.primary ? 'primary' : 'secondary'}
                      onClick={openMuscleHistory}
                      detail
                    />
                  ))}
                </div>
              </div>
            );
          })()}

        {/* Program-day coverage (past view): for a session started from a program
            day, tick each target muscle group that got at least one logged set
            (green check) and cross the ones that were skipped (red cross). */}
        {props.past &&
          (() => {
            const seen = new Set<string>();
            const targets = (workout.targetMuscles ?? []).filter(
              (m): m is MuscleGroup =>
                PICKER_TARGET_MUSCLES.has(m) && (seen.has(m) ? false : (seen.add(m), true)),
            );
            if (targets.length === 0) return null;
            const worked = muscleSetsInWorkout(workout);
            return (
              <div className="muscles-worked program-targets">
                <div className="section-label">{t.programTargetsLabel}</div>
                <div className="ptarget-row">
                  {targets.map((m) => {
                    const done = (worked.get(m) ?? 0) > 0;
                    return (
                      <span
                        key={m}
                        className={`ptarget ${done ? 'done' : 'skipped'}`}
                        title={done ? t.targetWorked : t.targetSkipped}
                      >
                        <Icon name={done ? 'check-circle' : 'x-circle'} />
                        {t.muscleGroups[m]}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        <div className="session-body">
          {focusView ? (
            renderFocusView()
          ) : (
            <>
              {workout.autoFinished && (
                <div className="notice-accent">
                  <Icon name="clock-countdown" />
                  <span>
                    {props.past
                      ? t.autoCloseNoticePast
                      : t.autoCloseNotice(fmtClock(workout.finishedAt ?? workout.startedAt))}
                  </span>
                </div>
              )}

              {live && prescribedSets > 0 && (
                <div className="plan-progress">
                  <div className="plan-progress-head">
                    <span>{t.progPlanProgress}</span>
                    <strong>
                      {planPercent}% · {t.progSetsDone(loggedPrescribedSets, prescribedSets)}
                    </strong>
                  </div>
                  <div className="plan-segments" aria-label={t.progPlanProgress}>
                    {workout.exercises.flatMap((ex) =>
                      Array.from({ length: Math.max(0, ex.plannedSets ?? 0) }, (_, i) => (
                        <span key={`${ex.id}-${i}`} className={i < ex.sets.length ? 'done' : ''} />
                      )),
                    )}
                  </div>
                  <div className="plan-progress-note">{t.progGhostDivision}</div>
                </div>
              )}

              {circuitBanner}

              {workout.exercises.length === 0 ? (
                <div className="session-empty">
                  <EmptyState icon="list-plus" title={t.noExercisesYet} body={t.noExercisesBody}>
                    {live &&
                      hasSessionStartCoach(
                        store.workouts.filter((w) => w.finishedAt !== null),
                        now,
                      ) && (
                        <button
                          className="btn btn-secondary session-coach-btn"
                          style={{ minHeight: 46, fontSize: 15, marginTop: 'var(--space-3)' }}
                          onClick={() => setSheet({ kind: 'coach' })}
                        >
                          <Icon name="heartbeat" weight="fill" />
                          {t.sessionCoachButton}
                        </button>
                      )}
                    <button
                      className="btn btn-primary"
                      style={{ minHeight: 46, fontSize: 15, marginTop: 'var(--space-3)' }}
                      onClick={() => setSheet({ kind: 'add' })}
                    >
                      <Icon name="plus" />
                      {t.addExercise}
                    </button>
                    <button
                      className="btn session-discard-btn"
                      style={{ marginTop: 'var(--space-3)' }}
                      onClick={() => setDialog({ kind: 'del-workout' })}
                    >
                      <Icon name="trash" />
                      {t.discardSession}
                    </button>
                  </EmptyState>
                </div>
              ) : (
                <>
                  {sessionBlocks(workout).map((block, blockIdx, blocks) => {
                    if (block.kind === 'group' && block.group.circuit) {
                      const building =
                        live && circuit.on && circuit.groupId === block.group.groupId;
                      return (
                        <CircuitBlock
                          key={block.group.groupId}
                          group={block.group}
                          past={!!props.past}
                          building={building}
                          isLast={blockIdx === blocks.length - 1}
                          rounds={circuit.rounds}
                          onMuscle={openMuscleHistory}
                          onRun={() =>
                            setSheet({ kind: 'circuit-run', groupId: block.group.groupId })
                          }
                          onAddAnother={() => setSheet({ kind: 'add' })}
                          onDoneBuilding={() =>
                            setCircuit((c) => ({ ...c, on: false, groupId: null }))
                          }
                          onRounds={(delta) => {
                            const r = Math.max(1, Math.min(20, circuit.rounds + delta));
                            setCircuit((c) => ({ ...c, rounds: r }));
                            setCircuitRounds(workout.id, block.group.groupId, r);
                          }}
                        />
                      );
                    }
                    // Not-yet-started upcoming exercises collapse under a QUEUED header.
                    const qExs = block.kind === 'group' ? block.group.exercises : [block.exercise];
                    const isQueued =
                      live &&
                      qExs.every(
                        (e) =>
                          !isMarkerExercise(e) &&
                          e.sets.length === 0 &&
                          e.id !== focusedId &&
                          e.id !== activeExerciseId,
                      );
                    if (isQueued) {
                      const firstQueuedIdx = blocks.findIndex((b) => {
                        if (b.kind === 'group' && b.group.circuit) return false;
                        const es = b.kind === 'group' ? b.group.exercises : [b.exercise];
                        return es.every(
                          (e) =>
                            !isMarkerExercise(e) &&
                            e.sets.length === 0 &&
                            e.id !== focusedId &&
                            e.id !== activeExerciseId,
                        );
                      });
                      const header =
                        blockIdx === firstQueuedIdx ? (
                          <div className="section-label queued-label">{t.queuedLabel}</div>
                        ) : null;
                      if (block.kind === 'group') {
                        const g = block.group;
                        return (
                          <Fragment key={g.groupId}>
                            {header}
                            <button
                              className="past-ex-card queued-ex-card queued-group"
                              onClick={() => setExpandedId(g.exercises[0]?.id ?? null)}
                            >
                              <span className="n">
                                {g.exercises.map((e) => e.name).join(' · ')}
                              </span>
                              <span className="count">{t.supersetTag(g.letter)}</span>
                            </button>
                          </Fragment>
                        );
                      }
                      const qsingle = block.exercise;
                      const qplanned = Math.max(0, qsingle.plannedSets ?? 0);
                      return (
                        <Fragment key={qsingle.id}>
                          {header}
                          <div
                            data-exid={qsingle.id}
                            className="past-ex-card queued-ex-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpandedId(qsingle.id)}
                            onKeyDown={(e) => rowKey(e, () => setExpandedId(qsingle.id))}
                          >
                            <span className="n">{exName(qsingle.name)}</span>
                            {qplanned > 0 && <span className="count">0 / {qplanned}</span>}
                            {cardCfg(qsingle.id)}
                          </div>
                        </Fragment>
                      );
                    }
                    if (block.kind === 'group') {
                      const g = block.group;
                      const rounds = groupRounds(g);
                      const round = groupCurrentRound(g);
                      const minSets = Math.min(...g.exercises.map((e) => e.sets.length));
                      const activeMemberId =
                        g.exercises.find((e) => e.sets.length === minSets)?.id ?? null;
                      void minSets;
                      const groupActive = g.exercises.some((e) => e.id === focusedId);
                      const groupIsCurrent = g.exercises.some((e) => e.id === activeExerciseId);
                      const collapsed = props.past
                        ? g.exercises.some((e) => e.sets.length > 0) &&
                          !g.exercises.some((e) => expandedPast.includes(e.id))
                        : live &&
                          !groupActive &&
                          (g.exercises.some((e) => e.sets.length > 0) || groupIsCurrent);
                      if (collapsed) {
                        const kg = g.exercises.reduce((v, e) => v + exerciseVolumeKg(e), 0);
                        return (
                          <div
                            key={g.groupId}
                            className={`ss-block past${
                              groupIsCurrent && !props.past ? ' is-current' : ''
                            }`}
                          >
                            <div className="ss-bar" />
                            <div className="ss-body">
                              <div className="ss-head">
                                <span className="tag tag-neutral">{t.supersetTag(g.letter)}</span>
                                {groupIsCurrent && !props.past && (
                                  <span className="cur-tag">
                                    <Icon name="barbell" />
                                    {t.currentKicker}
                                  </span>
                                )}
                                <span className="ss-rounds-meta">
                                  {t.roundsMeta(rounds, fmtKg(kg))}
                                </span>
                              </div>
                              <button
                                className="past-ex-card"
                                onClick={() =>
                                  props.past
                                    ? setExpandedPast((x) => [
                                        ...x,
                                        ...g.exercises.map((e) => e.id),
                                      ])
                                    : setExpandedId(g.exercises[0]?.id ?? null)
                                }
                              >
                                {g.exercises.map((e, i) => (
                                  <span key={e.id} className="past-ex-row">
                                    <span className="ss-index">
                                      {g.letter}
                                      {i + 1}
                                    </span>
                                    <span className="n">{exName(e.name)}</span>
                                    <span className="v">{pastSummary(e)}</span>
                                  </span>
                                ))}
                              </button>
                            </div>
                          </div>
                        );
                      }
                      if (isDesktop && live) {
                        // DS-4 · desktop: the group is one table — bracket outside,
                        // Muscles and Equipment columns added to grouped tables only.
                        return (
                          <div key={g.groupId} className="ss-block ss-desktop">
                            <div className="ss-bar" />
                            <div className="ss-desktop-card">
                              <div className="ss-head">
                                <span className="tag tag-accent">{t.supersetTag(g.letter)}</span>
                                <span className="ss-round">
                                  {t.roundOf(round, rounds).split(' · ')[0]}
                                </span>
                                <button
                                  className="dots"
                                  onClick={() =>
                                    setSheet({ kind: 'group-menu', groupId: g.groupId })
                                  }
                                  aria-label={t.menuAction}
                                >
                                  <Icon name="dots-three" />
                                </button>
                              </div>
                              <table className="table ss-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 44 }}></th>
                                    <th>{t.exerciseLabel}</th>
                                    <th style={{ width: 210 }}>{t.musclesCol}</th>
                                    <th style={{ width: 150 }}>{t.progEquipment}</th>
                                    <th style={{ width: 90 }}>{t.roundCol}</th>
                                    <th style={{ width: 110 }}>{t.lastCol}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.exercises.map((e, i) => {
                                    const m = resolveMuscles(e);
                                    const eq = equipmentFor(e);
                                    const prevL = prevLift(e.name, workout.id);
                                    return (
                                      <tr key={e.id}>
                                        <td className="ss-td-idx">
                                          {g.letter}
                                          {i + 1}
                                        </td>
                                        <td>{exName(e.name)}</td>
                                        <td>
                                          <span style={{ display: 'inline-flex', gap: 5 }}>
                                            {m.primary && (
                                              <span className="mchip">
                                                {t.muscleGroups[m.primary]}
                                              </span>
                                            )}
                                            {m.secondary.map((x) => (
                                              <span key={x} className="mchip">
                                                {t.muscleGroups[x]}
                                              </span>
                                            ))}
                                          </span>
                                        </td>
                                        <td>
                                          {eq.map((id) => (
                                            <span key={id} className="eq">
                                              <Icon name={equipmentIconName(id)} />{' '}
                                              {equipmentLabelOf(id)}
                                            </span>
                                          ))}
                                        </td>
                                        <td className="num">
                                          {e.sets.length} / {rounds}
                                        </td>
                                        <td className="num dim">
                                          {prevL
                                            ? `${prevL.reps} × ${
                                                prevL.weight === null
                                                  ? '—'
                                                  : fmtWeightValue(prevL.weight)
                                              }`
                                            : '—'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={g.groupId} className={`ss-block${props.past ? ' past' : ''}`}>
                          <div className="ss-bar" />
                          <div className="ss-body">
                            <div className="ss-head">
                              <span className="tag tag-accent">{t.supersetTag(g.letter)}</span>
                              <span className="ss-round">{t.roundOf(round, rounds)}</span>
                              <button
                                className="dots"
                                onClick={() => setSheet({ kind: 'group-menu', groupId: g.groupId })}
                                aria-label={t.menuAction}
                              >
                                <Icon name="dots-three-vertical" />
                              </button>
                            </div>
                            {g.exercises.map((e, i) =>
                              renderCard(e, {
                                letter: g.letter,
                                index: i,
                                active: activeMemberId === e.id,
                                rounds,
                                round,
                              }),
                            )}
                          </div>
                        </div>
                      );
                    }
                    const single = block.exercise;
                    const singleIsCurrent = !props.past && single.id === activeExerciseId;
                    if (
                      props.past
                        ? single.sets.length > 0 && !expandedPast.includes(single.id)
                        : live &&
                          focusedId !== single.id &&
                          (single.sets.length > 0 || singleIsCurrent)
                    ) {
                      const expandSingle = () =>
                        props.past
                          ? setExpandedPast((x) => [...x, single.id])
                          : setExpandedId(single.id);
                      return (
                        <div
                          key={single.id}
                          data-exid={single.id}
                          className={`past-ex-card${singleIsCurrent ? ' is-current' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={expandSingle}
                          onKeyDown={(e) => rowKey(e, expandSingle)}
                        >
                          <span className="past-ex-row">
                            {singleIsCurrent && (
                              <span className="cur-tag">
                                <Icon name="barbell" />
                                {t.currentKicker}
                              </span>
                            )}
                            <span className="n">{exName(single.name)}</span>
                            {single.sets.length > 0 && (
                              <span className="v">{pastSummary(single)}</span>
                            )}
                            {cardCfg(single.id)}
                          </span>
                        </div>
                      );
                    }
                    return renderCard(single, null);
                  })}
                  {live &&
                    !circuit.on &&
                    sessionBlocks(workout).some((b) => b.kind === 'group' && b.group.circuit) && (
                      <button
                        className="btn btn-secondary circuit-new"
                        onClick={() =>
                          setCircuit((c) => ({
                            ...c,
                            on: true,
                            groupId: crypto.randomUUID(),
                          }))
                        }
                      >
                        <Icon name="plus-circle" />
                        {t.circuitNewCircuit(
                          String.fromCharCode(
                            65 +
                              sessionBlocks(workout).filter(
                                (b) => b.kind === 'group' && b.group.circuit,
                              ).length,
                          ),
                        )}
                      </button>
                    )}
                  {/* Energy plaque sits under the exercises, matching their width. */}
                  {props.past && sessionKcal != null && <EnergyPlaque kcal={sessionKcal} />}
                  {props.past && workout.exercises.some((e) => e.groupId) && (
                    <div className="muscle-note" style={{ boxShadow: 'none' }}>
                      <Icon name="chart-line-up" />
                      <p style={{ color: 'var(--color-neutral-500)' }}>{t.supersetHistoryNote}</p>
                    </div>
                  )}
                  {!(live && !workout.autoFinished && !isDesktop) && (
                    <button
                      className="btn btn-secondary session-add-btn"
                      onClick={() => setSheet({ kind: 'add' })}
                    >
                      <Icon name="plus" />
                      {props.past ? t.addToSession : t.addExercise}
                    </button>
                  )}
                  {live && !workout.autoFinished && isDesktop && (
                    <>
                      <button
                        className="btn btn-secondary session-settings-btn"
                        onClick={() => setSheet({ kind: 'settings' })}
                      >
                        <Icon name="sliders-horizontal" />
                        {t.sessionSettings}
                      </button>
                      <button
                        className="btn btn-secondary session-map-btn"
                        onClick={() => setSheet({ kind: 'musclemap' })}
                      >
                        <Icon name="person" />
                        {t.muscleMapButton}
                      </button>
                    </>
                  )}
                  {props.past && muscleWorkSorted(workout).length > 0 && (
                    <button
                      className="btn btn-secondary session-map-btn"
                      onClick={() => setSheet({ kind: 'musclemap' })}
                    >
                      <Icon name="person" />
                      {t.muscleMapButton}
                    </button>
                  )}
                  {props.past && (
                    <button
                      className="btn btn-primary share-cta"
                      onClick={() => setShareOpen(true)}
                    >
                      <Icon name="export" />
                      {t.shareWorkout}
                    </button>
                  )}
                  {live && !workout.autoFinished && isDesktop && (
                    <div className="session-discard-row">
                      <button
                        className="btn session-discard-btn icon-only"
                        onClick={() => setDialog({ kind: 'del-workout' })}
                        aria-label={t.discardSession}
                        title={t.discardSession}
                      >
                        <Icon name="trash" />
                      </button>
                      <button
                        className="btn btn-primary session-finish-docked"
                        disabled={entries === 0}
                        onClick={requestFinish}
                      >
                        <Icon name="check" />
                        {t.finish}
                      </button>
                    </div>
                  )}
                  {/* Live energy counter — quietly under all the session content. */}
                  {live && sessionKcal != null && <LiveEnergyCounter kcal={sessionKcal} />}
                  <div ref={contentBottomRef} aria-hidden />
                </>
              )}
            </>
          )}
        </div>
      </div>
      {live && !workout.autoFinished && !isDesktop && !focusView && (
        <div className="session-pill-wrap">
          {/* Three liquid-glass pills: discard isolated left, add dead-centre
              (pulsing) flanked by settings + muscle map, finish isolated right. */}
          <div className="glass-pill">
            <button
              className="sp-btn sp-discard"
              onClick={() => setDialog({ kind: 'del-workout' })}
              aria-label={t.discardSession}
              title={t.discardSession}
            >
              <Icon name="trash" />
            </button>
          </div>
          <div className="glass-pill sp-center">
            <button
              className="sp-btn sp-settings"
              onClick={() => setSheet({ kind: 'settings' })}
              aria-label={t.sessionSettings}
              title={t.sessionSettings}
            >
              <Icon name="sliders-horizontal" />
            </button>
            <button
              className="sp-btn sp-plus plusfab"
              onClick={() => setSheet({ kind: 'add' })}
              aria-label={t.addExercise}
              title={t.addExercise}
            >
              <Icon name="plus" weight="bold" />
            </button>
            <button
              className="sp-btn sp-map"
              onClick={() => setSheet({ kind: 'musclemap' })}
              aria-label={t.muscleMapButton}
              title={t.muscleMapButton}
            >
              <Icon name="person" />
            </button>
          </div>
          <div className="glass-pill">
            <button
              className="sp-btn sp-finish"
              disabled={entries === 0}
              onClick={requestFinish}
              aria-label={t.finish}
              title={t.finish}
            >
              <Icon name="check" weight="bold" />
            </button>
          </div>
        </div>
      )}
      {atlasJab && !summary && (
        <button
          key={atlasJab.key}
          type="button"
          className="atl-jab"
          style={{ ['--atl' as string]: TEMPER_COLOR[atlasJab.temper] }}
          onClick={() => setAtlasJab(null)}
          aria-live="polite"
        >
          <AtlasFace temper={atlasJab.temper} size={36} />
          <span>{atlasJab.text}</span>
        </button>
      )}
      {shareOpen && !summary && (
        <ShareSheet
          model={buildShareModel()}
          shell={props.shell}
          isDesktop={isDesktop}
          t={t}
          onClose={() => setShareOpen(false)}
        />
      )}
      {showSessionSide && live && (
        <aside className="pane-side desktop-only session-side">
          <div className="section-label">{t.workedSoFar}</div>
          <div className="side-muscle-rows">
            {(() => {
              const counts = muscleSetsInWorkout(workout);
              const present: MuscleGroup[] = [];
              for (const e of sortedExercises) {
                const { primary } = resolveMuscles(e);
                if (primary && !present.includes(primary)) present.push(primary);
              }
              present.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
              const max = Math.max(1, ...present.map((m) => counts.get(m) ?? 0));
              const ramp = [
                'var(--color-accent)',
                'var(--color-accent-600)',
                'var(--color-accent-700)',
              ];
              let rank = 0;
              return present.map((m) => {
                const n = counts.get(m) ?? 0;
                const color = n > 0 ? ramp[Math.min(rank++, ramp.length - 1)] : undefined;
                return (
                  <div key={m} className={`side-muscle-row${n === 0 ? ' dim' : ''}`}>
                    <span className="n">{t.muscleGroups[m]}</span>
                    <span className="bar">
                      {n > 0 && (
                        <span style={{ width: `${(n / max) * 100}%`, background: color }} />
                      )}
                    </span>
                    <span className="v">{n}</span>
                  </div>
                );
              });
            })()}
          </div>
          <p className="side-note">{t.workedNote}</p>
          <div className="section-label" style={{ marginTop: 'var(--space-2)' }}>
            {t.equipmentInUse}
          </div>
          <div className="echip-row">
            {workoutEquipment(workout).map((id) => (
              <EquipChip key={id} id={id} style={{ padding: '4px 9px', fontSize: 11 }} />
            ))}
          </div>
        </aside>
      )}
      {showSessionSide && !live && (
        <aside className="pane-side desktop-only session-side">
          {gym && (
            <div className="session-gym-card">
              <div className="session-gym-photo">
                <GymThumb name={gym.name} lat={gym.lat} lng={gym.lng} size={320} />
              </div>
              <div className="session-gym-copy">
                <div className="section-label">{gym.name}</div>
                <div className="session-side-meta">
                  {fmtClock(workout.startedAt)} ·{' '}
                  {fmtDurationHuman((workout.finishedAt ?? now) - workout.startedAt)}
                </div>
              </div>
            </div>
          )}
          {lastTimeRows.length > 0 && (
            <>
              {gym && <div className="td-side-divider" />}
              <div className="section-label">{t.lastTimeLabel}</div>
            </>
          )}
          {lastTimeRows.map((r) => (
            <div key={r.name} className="lasttime-row">
              <span className="n">{r.name}</span>
              <span className="v">
                {r.prev!.reps}
                {r.prev!.weight !== null ? ` · ${fmtWeightKg(r.prev!.weight)}` : ''}
              </span>
            </div>
          ))}
          {entries > 0 && (
            <>
              {(gym || lastTimeRows.length > 0) && <div className="td-side-divider" />}
              <div className="lasttime-row session-total-row">
                <span className="n">{t.moved}</span>
                <span className="v">{fmtTonnes(volume)}</span>
              </div>
            </>
          )}
        </aside>
      )}

      {photoView && (
        <PhotoSlider
          images={photoView.images}
          title={photoView.title}
          onClose={() => setPhotoView(null)}
        />
      )}
      {sheet?.kind === 'add' && (
        <AddExerciseSheet
          workout={workout}
          gym={gym}
          onPick={(name, kind, meta) => {
            const base = meta
              ? {
                  primaryMuscle: meta.primaryMuscle,
                  secondaryMuscles: meta.secondaryMuscles,
                  equipment: meta.equipment,
                  ...(meta.equipmentItems ? { equipmentItems: meta.equipmentItems } : {}),
                }
              : {};
            const plan = sheet.intoGroupId
              ? {
                  ...base,
                  groupId: sheet.intoGroupId,
                  groupKind: 'superset' as const,
                  groupOrder: workout.exercises.filter((e) => e.groupId === sheet.intoGroupId)
                    .length,
                }
              : circuit.on && circuit.groupId
                ? {
                    ...base,
                    groupId: circuit.groupId,
                    groupKind: 'circuit' as const,
                    groupOrder: workout.exercises.filter((e) => e.groupId === circuit.groupId)
                      .length,
                    plannedSets: circuit.rounds,
                  }
                : base;
            const created = addExercise(workout.id, name, kind, plan);
            // If the exercise you're on already has sets, switch straight to the
            // one you just added instead of leaving it collapsed in the queue.
            const curEx = workout.exercises.find((e) => e.id === focusedId);
            if (
              created &&
              !sheet.intoGroupId &&
              !(circuit.on && circuit.groupId) &&
              curEx &&
              curEx.sets.length > 0
            ) {
              setExpandedId(created.id);
            }
            // Single-add: one pick adds the exercise and closes the picker.
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'replace' && (
        <AddExerciseSheet
          workout={workout}
          gym={gym}
          replacing
          onPick={(name, kind, meta) => {
            replaceExercise(workout.id, sheet.exId, name, kind, meta);
            if (kind === 'cardio') {
              setCardioMachine(workout.id, sheet.exId, meta?.equipmentItems?.[0] ?? null, name);
            }
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'edit' && (
        <SetEditorSheet
          key={sheet.set?.id ?? 'ghost'}
          exercise={workout.exercises.find((e) => e.id === sheet.exId)!}
          set={sheet.set}
          ghost={sheet.ghost}
          bandLibrary={bandLibraryFor(gym)}
          gym={gym}
          onSave={(vals) => {
            const ex = workout.exercises.find((e) => e.id === sheet.exId)!;
            if (sheet.set) {
              upsertSet(workout.id, ex.id, { ...vals, id: sheet.set.id });
            } else {
              logNewSet(
                ex,
                vals,
                sheet.ghost ? { reps: sheet.ghost.reps, weight: sheet.ghost.weight } : null,
              );
            }
            setSheet(null);
          }}
          onDelete={
            sheet.set
              ? () =>
                  removeSet(
                    workout.exercises.find((e) => e.id === sheet.exId)!,
                    sheet.set!,
                  )
              : undefined
          }
          onExerciseSettings={
            focusView
              ? () =>
                  setSheet({
                    kind: 'opts',
                    tab: 'exercise',
                    exId: sheet.exId,
                    set: sheet.set,
                    ghost: sheet.ghost,
                  })
              : undefined
          }
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'opts' &&
        (() => {
          const ex = sheet.exId
            ? (workout.exercises.find((e) => e.id === sheet.exId) ?? null)
            : null;
          const canSet = !!ex && !isMarkerExercise(ex) && sheet.ghost !== null;
          const tab: OptsTab =
            sheet.tab === 'set' && !canSet
              ? ex
                ? 'exercise'
                : 'session'
              : sheet.tab === 'exercise' && !ex
                ? 'session'
                : sheet.tab;
          const img = ex ? exerciseImage(ex.name, exerciseKind(ex)) : undefined;
          const tabsDef: { k: OptsTab; label: string; icon: string; off: boolean }[] = [
            { k: 'set', label: t.optsTabSet, icon: 'sliders-horizontal', off: !canSet },
            { k: 'exercise', label: t.optsTabExercise, icon: 'barbell', off: !ex },
            { k: 'session', label: t.optsTabSession, icon: 'timer', off: false },
          ];
          return (
            <Sheet className="opts-sheet" onClose={() => setSheet(null)}>
              <div className="opts-head">
                {img ? <img className="opts-thumb" src={img} alt="" /> : null}
                <div className="opts-head-text">
                  <span className="opts-title">{ex ? exName(ex.name) : t.sessionSettings}</span>
                  <span className="opts-sub">
                    {ex && !isMarkerExercise(ex) ? `${t.setsStat} · ${ex.sets.length}` : ''}
                  </span>
                </div>
              </div>
              <div className="opts-tabs" role="tablist">
                {tabsDef.map((d) => (
                  <button
                    key={d.k}
                    role="tab"
                    aria-selected={tab === d.k}
                    className={tab === d.k ? 'on' : ''}
                    disabled={d.off}
                    onClick={() => setSheet({ ...sheet, tab: d.k })}
                  >
                    <Icon name={d.icon} />
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="opts-body">
                {tab === 'set' && ex && sheet.ghost ? (
                  <SetEditorSheet
                    embedded
                    key={sheet.set?.id ?? 'ghost'}
                    exercise={ex}
                    set={sheet.set}
                    ghost={sheet.ghost}
                    bandLibrary={bandLibraryFor(gym)}
                    gym={gym}
                    rpeEstimate={(w, r) =>
                      rpeEstimateFor(
                        ex,
                        w,
                        r,
                        ex.sets.filter((x) => setTypeOf(x) !== 'warmup').length,
                      )
                    }
                    onSave={(vals) => {
                      if (sheet.set) upsertSet(workout.id, ex.id, { ...vals, id: sheet.set.id });
                      else
                        logNewSet(
                          ex,
                          vals,
                          sheet.ghost
                            ? { reps: sheet.ghost.reps, weight: sheet.ghost.weight }
                            : null,
                        );
                      setSheet(null);
                    }}
                    onDelete={sheet.set ? () => removeSet(ex, sheet.set!) : undefined}
                    onClose={() => setSheet(null)}
                  />
                ) : tab === 'exercise' && ex ? (
                  <div className="opts-list">{renderExerciseOptions(ex, true)}</div>
                ) : (
                  <div className="opts-list session-settings">{renderSessionOptions(true)}</div>
                )}
              </div>
              <div className="opts-pinned">
                <button type="button" onClick={() => setSheet({ kind: 'musclemap' })}>
                  <Icon name="person" />
                  {t.muscleMapButton}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setSheet(null);
                    setDialog({ kind: 'del-workout' });
                  }}
                >
                  <Icon name="trash" />
                  {t.discardSession}
                </button>
              </div>
            </Sheet>
          );
        })()}

      {sheet?.kind === 'menu' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === sheet.exId);
          if (!ex) return null;
          return (
            <Sheet padded={false} onClose={() => setSheet(null)}>
              <div className="sheet-label">{t.exerciseMenuTitle(ex.name, ex.sets.length)}</div>
              {renderExerciseOptions(ex, false)}
            </Sheet>
          );
        })()}

      {sheet?.kind === 'group-menu' &&
        (() => {
          const members = sortedExercises.filter((e) => e.groupId === sheet.groupId);
          if (members.length === 0) return null;
          const letter =
            sessionBlocks(workout).find(
              (b) => b.kind === 'group' && b.group.groupId === sheet.groupId,
            )?.kind === 'group'
              ? (
                  sessionBlocks(workout).find(
                    (b) => b.kind === 'group' && b.group.groupId === sheet.groupId,
                  ) as { kind: 'group'; group: SupersetGroup }
                ).group.letter
              : 'A';
          return (
            <Sheet padded={false} onClose={() => setSheet(null)}>
              <div className="sheet-label">{t.supersetTag(letter)}</div>
              <button
                className="menu-item"
                onClick={() => {
                  ungroupSuperset(workout.id, sheet.groupId);
                  setSheet(null);
                }}
              >
                <Icon name="x" />
                {t.ungroup}
              </button>
              <button
                className="menu-item"
                onClick={() => setSheet({ kind: 'add', intoGroupId: sheet.groupId })}
              >
                <Icon name="plus" />
                {t.addExercise}
              </button>
              <div className="sheet-rule" />
              {members.map((e) => (
                <button
                  key={e.id}
                  className="menu-item"
                  onClick={() => setSheet({ kind: 'menu', exId: e.id })}
                >
                  <Icon name="dots-three-vertical" />
                  {exName(e.name)}
                </button>
              ))}
            </Sheet>
          );
        })()}

      {sheet?.kind === 'equip' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === sheet.exId);
          return ex ? (
            <EquipmentPickerSheet
              workoutId={workout.id}
              exercise={ex}
              gym={gym}
              onClose={() => setSheet(null)}
            />
          ) : null;
        })()}
      {sheet?.kind === 'cardio-machine' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === sheet.exId);
          return ex ? (
            <CardioMachineSheet
              gym={gym}
              current={cardioMachineOf(ex)}
              onPick={(id, name) => {
                setCardioMachine(workout.id, ex.id, id, name);
                setSheet(null);
              }}
              onClose={() => setSheet(null)}
            />
          ) : null;
        })()}
      {sheet?.kind === 'gym' && (
        <GymPicker
          gyms={store.gyms}
          title={t.pickGymTitle}
          onClose={() => setSheet(null)}
          onPick={(id) => {
            attachGymToWorkout(workout.id, id);
            setSheet(null);
          }}
        />
      )}

      {sheet?.kind === 'musclemap' && (
        <SessionMuscleMap
          workout={workout}
          now={now}
          onOpenMuscle={openMuscleHistory}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'settings' && (
        <Sheet className="session-settings" onClose={() => setSheet(null)}>
          <div className="sheet-label">{t.sessionSettings}</div>
          {renderSessionOptions(false)}
        </Sheet>
      )}

      {prShare && (
        <StatShareSheet
          model={prShare}
          fileBase="spotter-record"
          onClose={() => setPrShare(null)}
        />
      )}
      {renderPlaySheet()}
      {tiredInfo &&
        (() => {
          const items = buildPickItems(workout, store.workouts, gym);
          const key = canonicalExerciseName(tiredInfo).toLowerCase();
          const item = items.find((i) => i.key === key) ?? items.find((i) => i.name === tiredInfo);
          if (!item) return null;
          return (
            <Sheet onClose={() => setTiredInfo(null)} className="xp-detail-sheet">
              <ExerciseDetail
                item={item}
                items={items}
                gym={gym}
                finished={store.workouts.filter((w) => w.finishedAt !== null)}
                onPick={(i) => {
                  setTiredInfo(null);
                  openPick({ name: i.name, kicker: '', sub: '', kind: 'strength' });
                }}
                onSwap={(i) => setTiredInfo(i.name)}
                onBack={() => setTiredInfo(null)}
              />
            </Sheet>
          );
        })()}
      {sheet?.kind === 'rest' && (
        <RestSheet
          exName={sheet.exName}
          displayName={exName(sheet.exName)}
          auto={(() => {
            const e = workout.exercises.find((x) => x.name === sheet.exName);
            const last = e?.sets[e.sets.length - 1];
            return e && last ? autoRestFor(e, last) : null;
          })()}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'circuit-run' &&
        (() => {
          const block = sessionBlocks(workout).find(
            (b) => b.kind === 'group' && b.group.groupId === sheet.groupId,
          );
          return block?.kind === 'group' ? (
            <CircuitRunSheet
              group={block.group}
              onLog={(ex, vals) => logNewSet(ex, vals)}
              onSetRounds={(r) => setCircuitRounds(workout.id, block.group.groupId, r)}
              onMuscle={openMuscleHistory}
              onClose={() => setSheet(null)}
            />
          ) : null;
        })()}

      {sheet?.kind === 'coach' && (
        <Sheet className="coach-sheet" onClose={() => setSheet(null)}>
          <div className="sheet-label">{t.sessionCoachTitle}</div>
          <SessionStartCoach
            finished={store.workouts.filter((w) => w.finishedAt !== null)}
            now={now}
          />
        </Sheet>
      )}

      {sheet?.kind === 'superset' &&
        (() => {
          const base = workout.exercises.find((e) => e.id === sheet.exId);
          if (!base) return null;
          return (
            <SupersetSheet
              workout={workout}
              base={base}
              onClose={() => setSheet(null)}
              onGroup={(ids) => {
                groupAsSuperset(workout.id, ids);
                setSheet(null);
              }}
            />
          );
        })()}

      {dialog?.kind === 'del-ex' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === dialog.exId);
          if (!ex) return null;
          const list = ex.sets.map((s) => fmtSet(s.weight, s.reps)).join(', ');
          return (
            <Dialog
              danger
              title={t.deleteExerciseTitle(ex.name)}
              onClose={() => setDialog(null)}
              actions={
                <>
                  <button className="btn btn-secondary" onClick={() => setDialog(null)}>
                    {t.keep}
                  </button>
                  <button className="danger-outline" onClick={() => removeExercise(ex)}>
                    {t.delete}
                  </button>
                </>
              }
            >
              {t.deleteExerciseBody(t.nLoggedSets(ex.sets.length, list))}
            </Dialog>
          );
        })()}

      {dialog?.kind === 'del-set' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === dialog.exId);
          const set = ex?.sets.find((x) => x.id === dialog.setId);
          if (!ex || !set) return null;
          const n =
            [...ex.sets].sort((a, b) => a.position - b.position).findIndex((x) => x.id === set.id) +
            1;
          return (
            <Dialog
              danger
              title={t.deleteSetTitle(n)}
              onClose={() => setDialog(null)}
              actions={
                <>
                  <button className="btn btn-secondary" onClick={() => setDialog(null)}>
                    {t.keep}
                  </button>
                  <button
                    className="danger-outline"
                    onClick={() => {
                      setDialog(null);
                      removeSet(ex, set);
                    }}
                  >
                    {t.delete}
                  </button>
                </>
              }
            >
              {t.deleteSetBody(
                isTimedExercise(ex) ? formatTimedEntry(set) : fmtSetSnack(set.reps, set.weight),
                ex.name,
              )}
            </Dialog>
          );
        })()}

      {dialog?.kind === 'finish-warn' && (
        <Dialog
          title={t.finishSessionTitle}
          onClose={() => setDialog(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setDialog(null)}>
                {t.keepGoing}
              </button>
              <button className="btn btn-primary" onClick={doFinish}>
                {t.finish}
              </button>
            </>
          }
        >
          {dialog.emptyName
            ? t.finishEmptyWarning(
                dialog.emptyName,
                sets,
                fmtTonnes(volume),
                fmtDayMonth(workout.startedAt, locale),
              )
            : t.finishCleanBody(sets, fmtTonnes(volume), fmtDayMonth(workout.startedAt, locale))}
        </Dialog>
      )}

      {dialog?.kind === 'del-workout' && (
        <ConfirmDialog
          danger
          title={live ? t.discardSession : t.deleteWorkoutTitle}
          cancelLabel={t.keep}
          confirmLabel={t.delete}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            if (props.past) deletePastWorkout(workout.id);
            else deleteWorkout(workout.id);
            setDialog(null);
            props.onClose();
          }}
          body={t.deleteWorkoutBody(
            `${fmtDayMonth(workout.startedAt, locale)}, ${sets} ${t.sets}, ${fmtKg(volume)}`,
          )}
        />
      )}
    </div>
  );
}

// --- Add exercise sheet (S-18) --------------------------------------------

interface NewExerciseMeta {
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
  /** Fine equipment — the cardio machine picked. */
  equipmentItems?: string[];
}

function AddExerciseSheet(props: {
  workout: Workout;
  gym: Gym | null;
  /** Substitute an existing exercise rather than add a new one — the pick swaps
   *  the target's identity and keeps its sets. */
  replacing?: boolean;
  onPick: (name: string, kind: ExerciseKind, meta?: NewExerciseMeta) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  // Admins/trainers creating a brand-new exercise set its muscles + equipment
  // here, and it is written to the shared server catalog (EQ-4).
  const [creating, setCreating] = useState<string | null>(null);
  const canAuthor = getRole() === 'admin' || getRole() === 'trainer';
  // Cardio asks "which machine?" before adding — the machine decides the
  // entry's fields and how its calories are worked out.
  const [machineView, setMachineView] = useState(false);

  if (machineView) {
    return (
      <Sheet onClose={props.onClose}>
        <div className="sheet-label">{t.cardioMachineTitle}</div>
        <CardioMachineList
          gym={props.gym}
          onPick={(id, name) =>
            props.onPick(
              name,
              'cardio',
              id
                ? { primaryMuscle: null, secondaryMuscles: [], equipment: [], equipmentItems: [id] }
                : undefined,
            )
          }
        />
      </Sheet>
    );
  }

  if (creating !== null) {
    return (
      <NewExerciseSheet
        name={creating}
        canAuthor={canAuthor}
        onBack={() => setCreating(null)}
        onCreate={(meta) => {
          // Admins/trainers publish it to the shared catalog; everyone applies
          // it to this exercise straight away (no wait for the next sync).
          if (canAuthor) {
            saveCatalogExercise({ name: creating, kind: 'strength', ...meta });
          }
          props.onPick(creating, 'strength', meta);
        }}
      />
    );
  }

  // Picker v2: one pick per tap, ⓘ for details; warm-up / cool-down add a
  // marker, cardio goes through the machine list above.
  return (
    <ExercisePicker
      workout={props.workout}
      gym={props.gym}
      replacing={props.replacing}
      onPick={(i) =>
        props.onPick(i.name, 'strength', {
          primaryMuscle: i.primary,
          secondaryMuscles: i.secondary,
          equipment: i.equipment ? [i.equipment] : [],
        })
      }
      onMarker={(k) => props.onPick(t.defaultTimedExerciseNames[k], k)}
      onCardio={() => setMachineView(true)}
      onCreate={setCreating}
      onClose={props.onClose}
    />
  );
}

/**
 * Create a new exercise (EQ-4): name the muscles it trains and the equipment
 * it needs. For an admin or trainer this is also written to the shared server
 * catalog, so every member's picker and muscle math learn it. A member can
 * still tag the one they just added; it just stays local to their log.
 */
function NewExerciseSheet(props: {
  name: string;
  canAuthor: boolean;
  onBack: () => void;
  onCreate: (meta: NewExerciseMeta) => void;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const [primary, setPrimary] = useState<MuscleGroup | null>(null);
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  function toggleSecondary(m: MuscleGroup) {
    setSecondary((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]));
  }
  function toggleEquip(id: string) {
    setEquipment((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }

  return (
    <Sheet onClose={props.onBack} className="new-exercise-sheet">
      <div className="sheet-head with-back">
        <button className="sheet-back" onClick={props.onBack} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <span className="t">{exName(props.name)}</span>
      </div>
      <p className="sheet-note">{props.canAuthor ? t.newExerciseAuthorNote : t.newExerciseNote}</p>

      <div className="field-label">{t.primaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.map((m) => (
          <button
            key={m}
            className={`fchip${primary === m ? ' active' : ''}`}
            onClick={() => {
              setPrimary((x) => (x === m ? null : m));
              setSecondary((xs) => xs.filter((x) => x !== m));
            }}
          >
            <MuscleIcon muscle={m} variant="chip" tone={primary === m ? 'onAccent' : 'secondary'} />
            {t.muscleGroups[m]}
          </button>
        ))}
      </div>

      <div className="field-label">{t.secondaryMuscleLabel}</div>
      <div className="filter-chips">
        {MUSCLE_IDS.filter((m) => m !== primary).map((m) => (
          <button
            key={m}
            className={`fchip${secondary.includes(m) ? ' active' : ''}`}
            onClick={() => toggleSecondary(m)}
          >
            <MuscleIcon
              muscle={m}
              variant="chip"
              tone={secondary.includes(m) ? 'onAccent' : 'secondary'}
            />
            {t.muscleGroups[m]}
          </button>
        ))}
      </div>

      <div className="field-label">{t.equipmentLabelField}</div>
      <div className="filter-chips">
        {EQUIPMENT_IDS.map((id) => (
          <button
            key={id}
            className={`fchip${equipment.includes(id) ? ' active' : ''}`}
            onClick={() => toggleEquip(id)}
          >
            <Icon name={equipmentIconName(id)} />
            {t.equipmentNames[id]}
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        style={{ minHeight: 48, fontSize: 15, marginTop: 'var(--space-3)' }}
        onClick={() =>
          props.onCreate({ primaryMuscle: primary, secondaryMuscles: secondary, equipment })
        }
      >
        <Icon name="plus" />
        {t.createExercise(props.name)}
      </button>
    </Sheet>
  );
}

// --- “Superset with…” drawer (SS-2) ----------------------------------------

function SupersetSheet(props: {
  workout: Workout;
  base: Exercise;
  onClose: () => void;
  onGroup: (ids: string[]) => void;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const [sel, setSel] = useState<string[]>([]);
  const letter = nextSupersetLetter(props.workout);
  const candidates = [...props.workout.exercises]
    .sort((a, b) => a.position - b.position)
    .filter((e) => e.id !== props.base.id && isStrengthExercise(e) && !e.groupId);

  function toggle(id: string): void {
    setSel((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  }

  return (
    <Sheet onClose={props.onClose}>
      <h4 className="ss-sheet-title">{t.supersetWith}</h4>
      <p className="ss-sheet-sub">{t.supersetWithBody(props.base.name)}</p>
      <div className="ss-pick-list">
        <div className="ss-pick-row">
          <span className="idx">{letter}1</span>
          <span className="n">{props.base.name}</span>
          <span className="meta">{t.thisOne}</span>
        </div>
        {candidates.map((e) => {
          const si = sel.indexOf(e.id);
          const on = si >= 0;
          return (
            <button
              key={e.id}
              className={`ss-pick-row${on ? '' : ' dim'}`}
              onClick={() => toggle(e.id)}
            >
              {on ? (
                <span className="idx">
                  {letter}
                  {si + 2}
                </span>
              ) : (
                <span className="idx" />
              )}
              <span className="n">{exName(e.name)}</span>
              <span className={`cbx${on ? ' on' : ''}`}>{on && <Icon name="check" />}</span>
            </button>
          );
        })}
      </div>
      <div className="sheet-note">
        <Icon name="info" />
        <p>{t.supersetKeepNote}</p>
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          disabled={sel.length === 0}
          onClick={() => props.onGroup([props.base.id, ...sel])}
        >
          {t.groupAs(letter)}
        </button>
      </div>
    </Sheet>
  );
}

// --- Set editor sheet (S-21 + DS-1/DS-3) ------------------------------------

const SET_TYPE_ROWS: Array<{ type: SetType; icon: string }> = [
  { type: 'working', icon: 'equals' },
  { type: 'warmup', icon: 'fire' },
  { type: 'drop', icon: 'caret-line-down' },
  { type: 'reverse-drop', icon: 'caret-line-up' },
  { type: 'static-dynamic', icon: 'wave-sine' },
];

/**
 * − / value / + control. The value is editable; clearing it stays empty while
 * typing (never snaps to 0 mid-edit). Empty blur keeps the previous number.
 */
/** Fires the rest alert once, at `dueAt` (a timer, not the 1 s tick, so it
 *  lands on time). Nothing if the moment already passed (a reload, a skip). */
function RestAlarm(props: {
  /** The logged set this rest follows — keys the server-side push. */
  setId: string;
  dueAt: number;
  enabled: boolean;
  prefs: RestPrefs;
  title: string;
  body: string;
}) {
  const { setId, dueAt, enabled, prefs, title, body } = props;
  useEffect(() => {
    if (!enabled) return;
    const ms = dueAt - Date.now();
    if (ms <= 0) return;
    const id = window.setTimeout(() => restAlert(prefs, { title, body }), ms);
    return () => window.clearTimeout(id);
  }, [dueAt, enabled, prefs, title, body]);
  // A locked phone suspends this page, so the exact-time alert also goes out as
  // a push. Still here and visible just before the end → cancel it (the local
  // alert covers it); a new set or skipped rest cancels it too.
  useEffect(() => {
    if (!enabled || !prefs.notify) return;
    const ms = dueAt - Date.now();
    if (ms <= REST_PUSH_CANCEL_LEAD_MS) return;
    scheduleRestPush(setId, dueAt, title, body);
    let settled = false;
    const guard = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        settled = true;
        cancelRestPush(setId);
      }
    }, ms - REST_PUSH_CANCEL_LEAD_MS);
    return () => {
      window.clearTimeout(guard);
      if (!settled && Date.now() < dueAt) cancelRestPush(setId);
    };
  }, [setId, dueAt, enabled, prefs.notify, title, body]);
  return null;
}

/** How long before the rest ends a visible page cancels the rest push. */
const REST_PUSH_CANCEL_LEAD_MS = 3000;

/** Rest target for one lift + how the end of rest is announced. */
function RestSheet(props: {
  exName: string;
  displayName: string;
  /** The automatic plan after the lift's last set (null = no set yet). */
  auto: { sec: number; reasons: { key: RestReason; sec: number }[] } | null;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const st = useStore();
  const [target, setTarget] = useState<number | 'auto'>(
    () => exerciseRestSec(props.exName) ?? 'auto',
  );
  const [prefs, setPrefs] = useState<RestPrefs>(st.restPrefs ?? REST_PREFS_DEFAULT);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const row = (key: keyof RestPrefs, label: string, sub: string) => (
    <button
      type="button"
      className="toggle-row rest-pref"
      aria-pressed={prefs[key]}
      onClick={async () => {
        const on = !prefs[key];
        if (key === 'notify' && on) {
          const ps = pushState();
          if (ps === 'needs-install') {
            setPushHint(t.pushNeedsInstall);
            return;
          }
          // Push where the device supports it (reaches a locked phone); the
          // plain notification permission otherwise.
          const ok =
            ps === 'unsupported'
              ? await requestRestNotifications()
              : (await enablePush(locale)) === 'on';
          if (!ok) {
            setPushHint(t.pushDenied);
            return;
          }
          setPushHint(null);
        }
        setPrefs((p) => ({ ...p, [key]: on }));
      }}
    >
      <span className="rest-pref-text">
        <span className="lab">{label}</span>
        <span className="sub">{sub}</span>
      </span>
      <Switch on={prefs[key]} />
    </button>
  );
  return (
    <Sheet onClose={props.onClose} className="rest-sheet">
      <div className="sheet-head">
        <h3>{t.restSheetTitle(props.displayName)}</h3>
      </div>
      <div className="se-label se-label-first">{t.restTarget}</div>
      <div className="rest-presets">
        <button
          type="button"
          className={`rest-auto${target === 'auto' ? ' on' : ''}`}
          aria-pressed={target === 'auto'}
          onClick={() => setTarget('auto')}
        >
          {t.restAuto}
          {props.auto && props.auto.sec > 0 ? ` · ${fmtCountdown(props.auto.sec)}` : ''}
        </button>
        {REST_PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={target === sec ? 'on' : ''}
            aria-pressed={target === sec}
            onClick={() => setTarget(sec)}
          >
            {fmtCountdown(sec)}
          </button>
        ))}
      </div>
      {target === 'auto' && props.auto && props.auto.sec > 0 ? (
        <div className="rest-why-box">
          <div className="se-hint">{t.restAutoHint(fmtCountdown(props.auto.sec))}</div>
          <div className="rest-why-chips">
            {props.auto.reasons.map((r) => (
              <span
                key={r.key}
                className={`rest-why-chip${r.sec > 0 ? ' up' : r.sec < 0 ? ' down' : ''}`}
              >
                {t.restWhy[r.key]}
                {r.sec !== 0 ? ` ${r.sec > 0 ? '+' : '−'}${Math.abs(r.sec)} s` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="se-hint rest-hint">{t.restTargetHint}</div>
      )}
      <div className="se-label">{t.restWhenEnds}</div>
      <div className="se-group">
        {row('vibrate', t.restVibrate, isAppleTouch() ? t.restVibrateSubIos : t.restVibrateSub)}
        {row('sound', t.restSound, t.restSoundSub)}
        {row('keepAwake', t.restKeepAwake, t.restKeepAwakeSub)}
        {row('notify', t.restNotify, t.restNotifySub)}
      </div>
      {pushHint && <div className="se-hint rest-push-hint">{pushHint}</div>}
      <button
        type="button"
        className="rest-test"
        onClick={() => {
          primeRestAudio();
          restAlert(prefs);
        }}
      >
        <Icon name="bell-ringing" />
        {t.restTestAlert}
      </button>
      <div className="sheet-actions">
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button
          className="btn btn-primary grow"
          onClick={() => {
            setExerciseRestSec(props.exName, target === 'auto' ? null : target);
            setRestPrefs(prefs);
            props.onClose();
          }}
        >
          {t.save}
        </button>
      </div>
    </Sheet>
  );
}

function GhostSetRow(props: {
  ex: Exercise;
  defReps: number;
  defWeightKg: number | null;
  weightRequired: boolean;
  isPast: boolean;
  onLog: (v: {
    reps: number;
    weight: number | null;
    holdMin?: number;
    drops?: DropEntry[];
    failure?: FailureMark | null;
  }) => void;
  onSettings: () => void;
  title?: string;
  /** Failure suggestion: copy, and whether the flame starts on. */
  failSuggest?: { text: string; preset: boolean } | null;
  /** The proposal would be a record — gold card with this title/line. */
  prHint?: { title: string; line: string } | null;
  /** Growth value of this set vs the first one (stimulus.ts), shown when low. */
  worth?: number | null;
  /** Drop / reverse drop: the parts of the last such set — one row each. */
  defDrops?: DropEntry[];
  /** Static-dynamic: default hold in seconds (the card swaps Reps for Hold). */
  defHoldSec?: number;
  /** Set type the row proposes — colours the card (warm-up, working, drop…). */
  kind?: SetType;
  /** Small line under the steppers (e.g. the drops a continued drop set carries). */
  note?: string;
}) {
  const { t } = useT();
  const unit = exerciseUnit(props.ex.name);
  const [reps, setReps] = useState(Math.max(1, props.defReps || 1));
  const [weightKg, setWeightKg] = useState<number | null>(props.defWeightKg);
  const isSd = props.kind === 'static-dynamic';
  const [holdSec, setHoldSec] = useState(Math.max(5, props.defHoldSec ?? 30));
  const isDrop =
    (props.kind === 'drop' || props.kind === 'reverse-drop') && !!props.defDrops?.length;
  const [drops, setDrops] = useState<DropEntry[]>(() =>
    (props.defDrops ?? []).map((d) => ({ ...d })),
  );
  const patchDrop = (i: number, patch: Partial<DropEntry>) =>
    setDrops((list) => list.map((d, xi) => (xi === i ? { ...d, ...patch } : d)));
  // Moving the start weight carries the drops along (80→60→40 becomes 85→65→45).
  const setStartWeight = (kg: number) => {
    if (isDrop && weightKg !== null) {
      const delta = kg - weightKg;
      setDrops((list) =>
        list.map((d) => (d.weight === null ? d : { ...d, weight: Math.max(0, d.weight + delta) })),
      );
    }
    setWeightKg(kg);
  };
  const toDisp = (kg: number): number => (unit === 'lb' ? Math.round(kgToLb(kg) * 10) / 10 : kg);
  const fromDisp = (v: number): number => (unit === 'lb' ? Math.round(lbToKg(v) * 100) / 100 : v);
  const bw = weightKg === null && !props.weightRequired;
  const blocked = props.weightRequired && weightKg === null;
  // Flame: "this set goes to failure". Starts on when the app suggests it;
  // switching a suggestion off is an explicit "no".
  const canFail = props.kind !== 'warmup' && !isSd && !props.isPast;
  const [fail, setFail] = useState(!!props.failSuggest?.preset && canFail);
  const failMark: FailureMark | null = fail
    ? 'manual'
    : props.failSuggest?.preset && canFail
      ? 'no'
      : null;
  const pr = props.prHint && !fail ? props.prHint : null;
  return (
    <div
      className={`gset kind-${props.kind ?? 'working'}${fail ? ' fail-on' : ''}${pr ? ' pr' : ''}`}
    >
      {(pr || props.title) && (
        <div className="gset-title">
          {pr && <Icon name="trophy" />}
          {pr ? pr.title : props.title}
          {fail && <span className="gset-fail-tag"> · {t.failTitle}</span>}
        </div>
      )}
      {isDrop ? (
        <div className="gset-drops">
          <div className="gset-part">
            <div className="gset-part-lab">{t.startLabel}</div>
            <div className="gset-steppers">
              <Stepper label={t.reps} value={reps} step={1} min={0} onChange={setReps} />
              <Stepper
                label={unit === 'lb' ? t.weightLb : t.weightKg}
                value={toDisp(weightKg ?? 0)}
                step={unit === 'lb' ? 5 : 2.5}
                min={0}
                decimals={unit === 'lb' ? 1 : 2}
                disabled={bw}
                placeholder={t.bodyweightShort}
                onChange={(x) => setStartWeight(fromDisp(x))}
              />
            </div>
          </div>
          {drops.map((d, i) => (
            <div className="gset-part" key={i}>
              <div className="gset-part-lab">{t.dropRowN(i + 1)}</div>
              <div className="gset-steppers">
                <Stepper
                  label={t.reps}
                  value={d.reps}
                  step={1}
                  min={0}
                  onChange={(n) => patchDrop(i, { reps: n })}
                />
                <Stepper
                  label={unit === 'lb' ? t.weightLb : t.weightKg}
                  value={toDisp(d.weight ?? 0)}
                  step={unit === 'lb' ? 5 : 2.5}
                  min={0}
                  decimals={unit === 'lb' ? 1 : 2}
                  disabled={d.weight === null}
                  placeholder={t.bodyweightShort}
                  onChange={(x) => patchDrop(i, { weight: fromDisp(x) })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="gset-steppers">
          {!isSd && <Stepper label={t.reps} value={reps} step={1} min={0} onChange={setReps} />}
          <Stepper
            label={unit === 'lb' ? t.weightLb : t.weightKg}
            value={toDisp(weightKg ?? 0)}
            step={unit === 'lb' ? 5 : 2.5}
            min={0}
            decimals={unit === 'lb' ? 1 : 2}
            disabled={bw}
            placeholder={t.bodyweightShort}
            onChange={(x) => setWeightKg(fromDisp(x))}
          />
          {isSd && (
            <Stepper
              label={t.holdSecLabel}
              value={holdSec}
              step={5}
              min={5}
              onChange={setHoldSec}
            />
          )}
        </div>
      )}
      {props.note && !isDrop && <div className="gset-note">{props.note}</div>}
      {props.worth != null && props.worth < 0.5 && props.kind !== 'warmup' && (
        <div className="gset-worth">
          <div className="gw-head">
            <span>{t.worthTitle}</span>
            <b>{props.worth < 0.3 ? t.worthLow : t.worthMid}</b>
          </div>
          <div className="gw-bar">
            <span
              style={
                {
                  width: `${Math.round(props.worth * 100)}%`,
                  '--fat': (1 - props.worth).toFixed(2),
                } as CSSProperties
              }
            />
          </div>
          <div className="gw-text">{t.worthText(Math.round(props.worth * 100))}</div>
        </div>
      )}
      {pr && (
        <div className="gset-pr">
          <Icon name="trophy" />
          {pr.line}
        </div>
      )}
      {props.failSuggest && canFail && (fail || !props.failSuggest.preset) && (
        <div className={`gset-fail-hint${fail ? '' : ' idle'}`}>
          <Icon name="flame" />
          {props.failSuggest.text}
        </div>
      )}
      <div className="gset-actions">
        <button
          className="gset-cfg"
          aria-label={t.setOptions}
          title={t.setOptions}
          onClick={props.onSettings}
        >
          <Icon name="sliders-horizontal" />
        </button>
        {canFail && (
          <button
            type="button"
            className={`gset-fail${fail ? ' on' : ''}`}
            aria-pressed={fail}
            aria-label={t.failToggle}
            title={t.failToggle}
            onClick={() => setFail((x) => !x)}
          >
            <Icon name="flame" weight={fail ? 'fill' : 'bold'} />
          </button>
        )}
        <button
          className="btn btn-primary gset-log"
          disabled={blocked}
          onClick={() =>
            props.onLog(
              isSd
                ? { reps: 1, weight: weightKg, holdMin: holdSec / 60 }
                : isDrop
                  ? { reps, weight: weightKg, drops, failure: failMark }
                  : { reps, weight: weightKg, failure: failMark },
            )
          }
        >
          {props.isPast ? t.add : t.log}
        </button>
      </div>
    </div>
  );
}

function Stepper(props: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  focused?: boolean;
  disabled?: boolean;
  placeholder?: string;
  decimals?: number;
  onFocus?: () => void;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const min = props.min ?? 0;
  const max = props.max ?? Number.POSITIVE_INFINITY;
  const decimals = props.decimals ?? 0;

  function format(n: number): string {
    if (decimals <= 0) return String(n);
    const fixed = n.toFixed(decimals);
    return fixed.replace(/\.?0+$/, '') || '0';
  }

  const shown = draft !== null ? draft : format(props.value);

  function clamp(n: number): number {
    const rounded = decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n);
    return Math.min(max, Math.max(min, rounded));
  }

  function bump(dir: -1 | 1): void {
    const fromDraft =
      draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
        ? Number(draft)
        : props.value;
    setDraft(null);
    props.onChange(clamp(fromDraft + dir * props.step));
  }

  function commit(raw: string): void {
    setDraft(null);
    if (raw.trim() === '') return; // keep previous — empty is allowed while editing
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    props.onChange(clamp(n));
  }

  return (
    <div
      className={`stepper${props.focused ? ' focused' : ''}${props.disabled ? ' disabled' : ''}`}
      onClick={() => !props.disabled && props.onFocus?.()}
    >
      <div className="lab">{props.label}</div>
      <div className="row">
        {props.disabled && props.placeholder ? (
          <span className="val">{props.placeholder}</span>
        ) : (
          <>
            <button
              type="button"
              aria-label="−"
              disabled={props.disabled}
              onClick={(e) => {
                e.stopPropagation();
                bump(-1);
              }}
            >
              −
            </button>
            <input
              className="val"
              inputMode={decimals > 0 ? 'decimal' : 'numeric'}
              disabled={props.disabled}
              value={shown}
              onFocus={() => {
                props.onFocus?.();
                setDraft(format(props.value));
              }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft ?? '')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
            <button
              type="button"
              aria-label="+"
              disabled={props.disabled}
              onClick={(e) => {
                e.stopPropagation();
                bump(1);
              }}
            >
              +
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The set editor either owns its sheet or lives inside the focus options sheet. */
function SetEditorFrame(props: { embedded: boolean; onClose: () => void; children: ReactNode }) {
  return props.embedded ? (
    <>{props.children}</>
  ) : (
    <Sheet onClose={props.onClose}>{props.children}</Sheet>
  );
}

function SetEditorSheet(props: {
  exercise: Exercise;
  set: SetEntry | null;
  ghost: GhostValues;
  bandLibrary: readonly BandRung[];
  /** The session's gym — its band library can be edited right from here. */
  gym?: Gym | null;
  /** Effort estimate for a weight × reps (rpe.ts), shown when nobody rated it. */
  rpeEstimate?: (weight: number | null, reps: number) => number | null;
  onSave: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onDelete?: () => void;
  onExerciseSettings?: () => void;
  /** Rendered inside the focus options sheet (tabs) instead of its own sheet. */
  embedded?: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const timed = isTimedExercise(props.exercise);
  const kind = exerciseKind(props.exercise);
  // Load type (Load-entry C): assist (negative kg help) / band (colour→kg
  // estimate) / plain weight. Derived from the exercise, but the athlete can
  // pin it here (a pull-up bar vs an assist machine vs a band) — local state so
  // the sheet morphs instantly, and persisted as a per-exercise override.
  const bandLib = props.bandLibrary;
  const defaultBandKg = bandLib[Math.min(1, bandLib.length - 1)]?.kg ?? 0;
  const [loadType, setLoadTypeState] = useState<LoadType>(() => loadTypeFor(props.exercise));
  const isAssist = loadType === 'assist';
  const isBand = loadType === 'band';
  const [view, setView] = useState<'main' | 'type' | 'load'>('main');
  const [type, setType] = useState<SetType>(
    props.set ? setTypeOf(props.set) : (props.ghost.type ?? 'working'),
  );
  // The athlete opened the type picker and chose — pin the warm-up/working
  // state so auto-detection won't override it.
  const [typeTouched, setTypeTouched] = useState(false);
  const [drops, setDropsState] = useState<DropEntry[]>(props.set?.drops ?? props.ghost.drops ?? []);
  const [reps, setReps] = useState(props.set?.reps ?? props.ghost.reps);
  const [weight, setWeight] = useState(
    props.set?.weight ?? props.ghost.weight ?? (isBand ? defaultBandKg : 0),
  );
  const [durationMin, setDurationMin] = useState(
    props.set?.durationMin ??
      props.ghost.durationMin ??
      props.exercise.plannedDurationMin ??
      (kind === 'cardio' ? 20 : 8),
  );
  const [distanceKm, setDistanceKm] = useState(
    props.set?.distanceKm ?? props.ghost.distanceKm ?? 0,
  );
  const [calories, setCalories] = useState(props.set?.calories ?? 0);
  const [rpe, setRpe] = useState(props.set?.rpe ?? 0);
  // To failure: F at the end of the effort row. 'auto' = the app inferred it.
  const [fail, setFail] = useState<FailureMark | null>(props.set?.failure ?? null);
  const [partials, setPartials] = useState(props.set?.partials ?? 0);
  const failOn = fail === 'manual' || fail === 'auto';
  // Cardio console readings — which ones show depends on the machine.
  const cardioFields: CardioField[] = timed ? cardioProfile(props.exercise).fields : [];
  const seed = (k: 'speedKmh' | 'inclinePct' | 'watts' | 'level' | 'floors'): number =>
    props.set?.[k] ?? props.ghost[k] ?? 0;
  const [speedKmh, setSpeedKmh] = useState(() => seed('speedKmh'));
  const [inclinePct, setInclinePct] = useState(() => seed('inclinePct'));
  const [watts, setWatts] = useState(() => seed('watts'));
  const [level, setLevel] = useState(() => seed('level'));
  const [floors, setFloors] = useState(() => seed('floors'));
  // Bodyweight = weight stored as null (pull-ups, dips, planks…).
  const [bw, setBw] = useState(props.set ? props.set.weight === null : false);
  const [holdSec, setHoldSec] = useState(
    props.set && setTypeOf(props.set) === 'static-dynamic' && props.set.durationMin != null
      ? Math.round(props.set.durationMin * 60)
      : props.ghost.holdMin
        ? Math.round(props.ghost.holdMin * 60)
        : 35,
  );
  const [openedAt] = useState(() => Date.now());
  const [focused, setFocused] = useState<'reps' | 'weight' | 'duration' | 'distance'>(
    timed ? 'duration' : 'weight',
  );
  // Plate calculator (Load-entry A): offered on barbell lifts to work out what
  // goes on the bar for the entered weight.
  const [plateOpen, setPlateOpen] = useState(false);
  const [bandsOpen, setBandsOpen] = useState(false);
  const equip = equipmentFor(props.exercise);
  const isBarbell = equip.includes('barbell');
  // Per-exercise weight unit (Load-entry B): log in the unit the machine is
  // labelled in; storage stays canonical kg.
  const unitEligible =
    !timed && (isBarbell || equip.includes('dumbbell') || equip.includes('machine'));
  const sidesOk = sidesEligible(props.exercise);
  const [sides, setSidesState] = useState<'one' | 'both'>(() =>
    perHandFactor(props.exercise) === 2 ? 'one' : 'both',
  );
  const pickSides = (v: 'one' | 'both') => {
    setSidesState(v);
    setExerciseSides(props.exercise.name, v);
  };
  const [unit, setUnitState] = useState<DisplayUnit>(() => exerciseUnit(props.exercise.name));
  const setUnit = (u: DisplayUnit) => {
    setUnitState(u);
    setExerciseUnit(props.exercise.name, u);
  };
  const toDisp = (kg: number): number => (unit === 'lb' ? Math.round(kgToLb(kg) * 10) / 10 : kg);
  const fromDisp = (v: number): number => (unit === 'lb' ? Math.round(lbToKg(v) * 100) / 100 : v);
  const currentBand: BandRung | null = isBand
    ? (bandForKg(weight, bandLib) ?? bandLib[Math.min(1, bandLib.length - 1)] ?? null)
    : null;
  // Pick a load type: persist the override and re-seed the weight so the value
  // makes sense for the new mode (negative help, a band estimate, or plain).
  const pickLoadType = (lt: LoadType): void => {
    setLoadTypeState(lt);
    setExerciseLoadType(props.exercise.name, lt);
    if (lt === 'assist') {
      setBw(false);
      if (weight >= 0) setWeight(-16);
    } else if (lt === 'band') {
      setBw(false);
      if (weight <= 0) setWeight(defaultBandKg);
    } else if (weight < 0) {
      setWeight(0);
    }
    setView('main');
  };
  const LOAD_ROWS: { key: LoadType; icon: string; name: string; hint: string }[] = [
    { key: 'weight', icon: 'barbell', name: t.loadWeight, hint: t.loadWeightHint },
    { key: 'assist', icon: 'scales', name: t.loadAssist, hint: t.loadAssistHint },
    { key: 'band', icon: 'wave-sine', name: t.loadBand, hint: t.loadBandHint },
  ];
  const idx = props.set
    ? [...props.exercise.sets]
        .sort((a, b) => a.position - b.position)
        .findIndex((s) => s.id === props.set!.id) + 1
    : props.exercise.sets.length + 1;
  const isDropType = type === 'drop' || type === 'reverse-drop';
  const isSD = type === 'static-dynamic';
  // The app's effort estimate when nobody rated the set (dashed on the row).
  const rpeEst =
    timed || isSD || isAssist || isBand || bw || type === 'warmup'
      ? null
      : props.set
        ? (props.set.rpeAuto ?? null)
        : (props.rpeEstimate?.(weight, reps) ?? null);
  const dropRepsTotal = reps + drops.reduce((n, d) => n + d.reps, 0);
  const dropKgTotal =
    (bw ? 0 : weight) * reps + drops.reduce((v, d) => v + (d.weight ?? 0) * d.reps, 0);

  const typeMeta: Record<SetType, { name: string; hint: string }> = {
    working: { name: t.setTypeWorking, hint: '' },
    warmup: { name: t.setTypeWarmup, hint: t.excludedFromVolume },
    drop: { name: t.setTypeDrop, hint: t.weightFalls },
    'reverse-drop': { name: t.setTypeReverse, hint: t.weightClimbs },
    'static-dynamic': { name: t.setTypeStaticDynamic, hint: t.setTypeSDHint },
  };

  function save(): void {
    props.onSave(
      timed
        ? {
            reps: 0,
            weight: null,
            isWarmup: kind === 'warmup',
            durationMin,
            distanceKm: cardioFields.includes('distance') && distanceKm > 0 ? distanceKm : null,
            speedKmh: cardioFields.includes('speed') && speedKmh > 0 ? speedKmh : null,
            inclinePct: cardioFields.includes('incline') && inclinePct > 0 ? inclinePct : null,
            watts: cardioFields.includes('watts') && watts > 0 ? watts : null,
            level: cardioFields.includes('level') && level > 0 ? level : null,
            floors: cardioFields.includes('floors') && floors > 0 ? floors : null,
            calories: calories > 0 ? calories : null,
            rpe: rpe > 0 ? rpe : null,
          }
        : {
            // A static-dynamic set is one weighted hold: reps 1, TUT in durationMin.
            reps: isSD ? 1 : reps,
            // Bodyweight, whether toggled or just left at 0, is stored as null
            // so it reads as "BW" while total volume keeps external load at 0.
            weight: bw || weight === 0 ? null : weight,
            isWarmup: type === 'warmup',
            ...(typeTouched ? { warmupManual: true } : {}),
            type,
            drops: isDropType ? drops : [],
            durationMin: isSD ? holdSec / 60 : null,
            distanceKm: null,
            calories: null,
            rpe: rpe > 0 ? rpe : null,
            failure: isSD ? null : fail,
            failureWhy: fail === 'auto' ? (props.set?.failureWhy ?? null) : null,
            partials: failOn && partials > 0 ? partials : null,
            rpeAuto: rpe > 0 ? null : (props.set?.rpeAuto ?? null),
          },
    );
  }

  function patchDrop(i: number, patch: Partial<DropEntry>): void {
    setDropsState((list) => list.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
  }

  function addDropPart(): void {
    const prevPart = drops[drops.length - 1] ?? { reps, weight: bw ? null : weight };
    setDropsState((list) => [
      ...list,
      {
        reps: Math.max(1, prevPart.reps - (type === 'drop' ? 2 : 3)),
        weight:
          prevPart.weight === null
            ? null
            : Math.max(
                0,
                type === 'drop'
                  ? Math.round((prevPart.weight * 0.75) / 5) * 5
                  : prevPart.weight + 5,
              ),
      },
    ]);
  }

  function strengthSteppers(
    partReps: number,
    partWeight: number | null,
    onReps: (n: number) => void,
    onWeight: (n: number) => void,
    focusKey: 'reps' | 'weight' | null,
  ) {
    return (
      <div className="steppers">
        <Stepper
          label={t.reps}
          value={partReps}
          step={1}
          min={0}
          focused={focusKey === 'reps'}
          onFocus={() => setFocused('reps')}
          onChange={onReps}
        />
        <Stepper
          label={unit === 'lb' ? t.weightLb : t.weightKg}
          value={toDisp(partWeight ?? 0)}
          step={unit === 'lb' ? 5 : 2.5}
          min={0}
          decimals={unit === 'lb' ? 1 : 2}
          focused={focusKey === 'weight'}
          disabled={bw}
          placeholder={t.bodyweightShort}
          onFocus={() => setFocused('weight')}
          onChange={(v) => onWeight(fromDisp(v))}
        />
      </div>
    );
  }

  // --- DS-1: the four types, one list --------------------------------------
  if (!timed && view === 'type') {
    return (
      <SetEditorFrame embedded={!!props.embedded} onClose={props.onClose}>
        <div className="sheet-head">
          <span className="t">{t.setN(idx, props.exercise.name)}</span>
        </div>
        {SET_TYPE_ROWS.map((row, i) => (
          <button
            key={row.type}
            className={`stype-row${i === SET_TYPE_ROWS.length - 1 ? ' last' : ''}`}
            onClick={() => {
              setType(row.type);
              setTypeTouched(true);
              if (row.type === 'warmup') setBw(false);
              setView('main');
            }}
          >
            <Icon name={row.icon} />
            <span className="n">{typeMeta[row.type].name}</span>
            {type === row.type ? (
              <span className="stype-check">
                <Icon name="check" />
              </span>
            ) : (
              <span className="hint">{typeMeta[row.type].hint}</span>
            )}
          </button>
        ))}
        <div className="sheet-note" style={{ marginTop: 'var(--space-3)' }}>
          <Icon name="info" />
          <p>
            {t.dropNote1}
            <strong>{t.dropNoteStrong}</strong>
            {t.dropNote2}
          </p>
        </div>
      </SetEditorFrame>
    );
  }

  // --- Load type (Load-entry C): weight · assist · band --------------------
  if (!timed && view === 'load') {
    return (
      <SetEditorFrame embedded={!!props.embedded} onClose={props.onClose}>
        <div className="sheet-head">
          <span className="t">{t.loadTypeLabel}</span>
        </div>
        {LOAD_ROWS.map((row, i) => (
          <button
            key={row.key}
            className={`stype-row${i === LOAD_ROWS.length - 1 ? ' last' : ''}`}
            onClick={() => pickLoadType(row.key)}
          >
            <Icon name={row.icon} />
            <span className="n">{row.name}</span>
            {loadType === row.key ? (
              <span className="stype-check">
                <Icon name="check" />
              </span>
            ) : (
              <span className="hint">{row.hint}</span>
            )}
          </button>
        ))}
        <div className="sheet-note" style={{ marginTop: 'var(--space-3)' }}>
          <Icon name="info" />
          <p>{t.loadTypeNote}</p>
        </div>
      </SetEditorFrame>
    );
  }

  return (
    <SetEditorFrame embedded={!!props.embedded} onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">
          {props.embedded
            ? t.setNumber(idx)
            : timed
              ? t.entryN(idx, props.exercise.name)
              : t.setN(idx, props.exercise.name)}
        </span>
        {props.set && <span className="m">{t.loggedAt(fmtClock(openedAt))}</span>}
      </div>
      {timed ? (
        <>
          <div className="steppers">
            <Stepper
              label={t.durationMinutes}
              value={durationMin}
              step={1}
              min={0.1}
              decimals={1}
              focused={focused === 'duration'}
              onFocus={() => setFocused('duration')}
              onChange={setDurationMin}
            />
            {cardioFields.includes('distance') && (
              <Stepper
                label={t.distanceKm}
                value={distanceKm}
                step={0.1}
                min={0}
                decimals={1}
                focused={focused === 'distance'}
                onFocus={() => setFocused('distance')}
                onChange={setDistanceKm}
              />
            )}
          </div>
          {cardioFields.some((f) => f !== 'distance') && (
            <div className="steppers secondary-steppers">
              {cardioFields.includes('speed') && (
                <Stepper
                  label={t.speedKmh}
                  value={speedKmh}
                  step={0.5}
                  min={0}
                  max={30}
                  decimals={1}
                  onChange={setSpeedKmh}
                />
              )}
              {cardioFields.includes('incline') && (
                <Stepper
                  label={t.inclinePct}
                  value={inclinePct}
                  step={0.5}
                  min={0}
                  max={40}
                  decimals={1}
                  onChange={setInclinePct}
                />
              )}
              {cardioFields.includes('watts') && (
                <Stepper label={t.watts} value={watts} step={5} min={0} onChange={setWatts} />
              )}
              {cardioFields.includes('level') && (
                <Stepper label={t.level} value={level} step={1} min={0} onChange={setLevel} />
              )}
              {cardioFields.includes('floors') && (
                <Stepper label={t.floors} value={floors} step={1} min={0} onChange={setFloors} />
              )}
            </div>
          )}
          <div className="steppers secondary-steppers">
            <Stepper label={t.calories} value={calories} step={10} min={0} onChange={setCalories} />
            <Stepper
              label={t.rpe}
              value={rpe}
              step={0.5}
              min={0}
              max={10}
              decimals={1}
              onChange={setRpe}
            />
          </div>
        </>
      ) : (
        <>
          {/* Load type first — it decides what the steppers below mean. Each
              block is a labelled card, like the Exercise tab's groups. */}
          <div className="se-label se-label-first">{t.loadTypeLabel}</div>
          <div className="se-card se-card-load">
            <div className="seg2 se-load">
              {LOAD_ROWS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={loadType === r.key ? 'active' : ''}
                  onClick={() => pickLoadType(r.key)}
                >
                  {r.name}
                </button>
              ))}
            </div>
            {isSD ? (
              <div className="steppers">
                <Stepper
                  label={unit === 'lb' ? t.weightLb : t.weightKg}
                  value={toDisp(weight)}
                  step={unit === 'lb' ? 5 : 2.5}
                  min={0}
                  decimals={unit === 'lb' ? 1 : 2}
                  focused={focused === 'weight'}
                  disabled={bw}
                  placeholder={t.bodyweightShort}
                  onFocus={() => setFocused('weight')}
                  onChange={(v) => setWeight(fromDisp(v))}
                />
                <Stepper
                  label={t.holdSecLabel}
                  value={holdSec}
                  step={5}
                  min={5}
                  focused={focused === 'duration'}
                  onFocus={() => setFocused('duration')}
                  onChange={setHoldSec}
                />
              </div>
            ) : isDropType ? (
              <div className="dropedit-rows">
                <div className="drop-part">
                  <div className="drop-part-lab">{t.startLabel}</div>
                  {strengthSteppers(
                    reps,
                    bw ? null : weight,
                    setReps,
                    setWeight,
                    focused === 'reps' || focused === 'weight' ? focused : null,
                  )}
                </div>
                {drops.map((d, i) => (
                  <div key={i} className="drop-part">
                    <div className="drop-part-lab">
                      <span>{t.dropRowN(i + 1)}</span>
                      <button
                        type="button"
                        className="drop-trash"
                        aria-label={t.delete}
                        onClick={() => setDropsState((list) => list.filter((_, xi) => xi !== i))}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                    {strengthSteppers(
                      d.reps,
                      d.weight,
                      (n) => patchDrop(i, { reps: n }),
                      (n) => patchDrop(i, { weight: n }),
                      null,
                    )}
                  </div>
                ))}
                <button type="button" className="dropedit-add" onClick={addDropPart}>
                  <Icon name="plus" />
                  <span className="n">{t.addAnotherDrop}</span>
                  <span className="m">{t.dropTotals(dropRepsTotal, fmtKg(dropKgTotal))}</span>
                </button>
                {type === 'reverse-drop' && (
                  <div className="sheet-note">
                    <Icon name="caret-line-up" />
                    <p>{t.reverseNote}</p>
                  </div>
                )}
              </div>
            ) : isAssist ? (
              <>
                <div className="steppers">
                  <Stepper
                    label={t.reps}
                    value={reps}
                    step={1}
                    min={0}
                    focused={focused === 'reps'}
                    onFocus={() => setFocused('reps')}
                    onChange={setReps}
                  />
                  <Stepper
                    label={t.assistLabel}
                    value={Math.abs(weight)}
                    step={5}
                    min={0}
                    focused={focused === 'weight'}
                    onFocus={() => setFocused('weight')}
                    onChange={(v) => setWeight(-Math.abs(v))}
                  />
                </div>
                <div className="load-chips assist-chips">
                  {assistStack(weight).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`load-chip${weight === v ? ' on' : ''}`}
                      onClick={() => setWeight(v)}
                    >
                      {fmtWeightValue(v)}
                    </button>
                  ))}
                </div>
                <div className="load-note">{t.assistNote}</div>
              </>
            ) : isBand ? (
              <>
                <div className="steppers">
                  <Stepper
                    label={t.reps}
                    value={reps}
                    step={1}
                    min={0}
                    focused={focused === 'reps'}
                    onFocus={() => setFocused('reps')}
                    onChange={setReps}
                  />
                  <div className="band-readout">
                    {/* Same height as the Reps stepper: label row (with ~kg), value row. */}
                    <span className="band-readout-head">
                      <span className="band-readout-lab">{t.bandLabel}</span>
                      {currentBand ? (
                        <span className="band-readout-kg">
                          ~{fmtWeightValue(currentBand.kg)} {t.kgCol.toLowerCase()}
                        </span>
                      ) : null}
                    </span>
                    <span className="band-readout-val">
                      <span
                        className="band-readout-dot"
                        style={{
                          background: currentBand ? BAND_HEX[currentBand.color] : undefined,
                        }}
                      />
                      {currentBand ? t.bandColor(currentBand.color) : '—'}
                    </span>
                  </div>
                </div>
                <div className="band-grid">
                  {bandLib.map((r) => (
                    <button
                      key={r.color}
                      type="button"
                      className={`band-tile${currentBand?.color === r.color ? ' on' : ''}`}
                      onClick={() => setWeight(r.kg)}
                      aria-pressed={currentBand?.color === r.color}
                    >
                      <span className="band-swatch" style={{ background: BAND_HEX[r.color] }} />
                      <span className="band-name">{t.bandColor(r.color)}</span>
                      <span className="band-kg">~{fmtWeightValue(r.kg)}</span>
                    </button>
                  ))}
                </div>
                <div className="load-note">{t.bandNote}</div>
                {props.gym && (
                  <button type="button" className="band-edit" onClick={() => setBandsOpen(true)}>
                    <Icon name="sliders-horizontal" />
                    <span className="lab">{t.bandEditLink(props.gym.name)}</span>
                    <Icon name="caret-right" />
                  </button>
                )}
              </>
            ) : (
              strengthSteppers(
                reps,
                bw ? null : weight,
                setReps,
                setWeight,
                focused === 'reps' || focused === 'weight' ? focused : null,
              )
            )}
          </div>
          {/* Set type · effort (design "One door"), rarer toggles grouped below. */}
          <div className="se-label">{t.setTypeLabel}</div>
          <div className="se-card">
            <div className="se-types">
              {SET_TYPE_ROWS.map((row) => (
                <button
                  key={row.type}
                  type="button"
                  className={`se-type t-${row.type}${type === row.type ? ' on' : ''}`}
                  aria-pressed={type === row.type}
                  onClick={() => {
                    setType(row.type);
                    setTypeTouched(true);
                    if (row.type === 'warmup') setBw(false);
                  }}
                >
                  <span className="se-dot" aria-hidden />
                  {typeMeta[row.type].name}
                </button>
              ))}
            </div>
            {typeMeta[type].hint ? <div className="se-hint">{typeMeta[type].hint}</div> : null}
          </div>
          <div className="se-label">{t.rpeLabel}</div>
          <div className="se-card">
            <div className="se-rpe">
              {[0, 6, 7, 8, 9, 10].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={
                    rpe === v && !failOn
                      ? 'on'
                      : rpe === 0 && !failOn && rpeEst !== null && v === Math.round(rpeEst)
                        ? 'est'
                        : ''
                  }
                  aria-pressed={rpe === v && !failOn}
                  onClick={() => {
                    setRpe(v);
                    // Picking an effort below 10 says "not to failure"; 10 or
                    // Skip leave it to the app (an 'auto' mark is dismissed).
                    setFail(v >= 6 && v < 10 ? 'no' : fail === 'auto' ? 'no' : null);
                  }}
                >
                  {v === 0 ? t.rpeNone : v}
                </button>
              ))}
              {!isSD && (
                <button
                  type="button"
                  className={`rpe-f${failOn ? ' on' : ''}${fail === 'auto' ? ' auto' : ''}`}
                  aria-pressed={failOn}
                  aria-label={t.failToggle}
                  onClick={() => {
                    setFail('manual');
                    setRpe(10);
                  }}
                >
                  F
                </button>
              )}
            </div>
            <div className="se-hint">
              {failOn
                ? fail === 'auto'
                  ? t.rpeHintFAuto
                  : t.rpeHintF
                : rpe === 0 && rpeEst !== null
                  ? t.rpeEstHint(String(rpeEst))
                  : t.rpeHint(rpe)}
            </div>
            {failOn && (
              <div className="se-partials">
                <span className="lab">{t.partialsLabel}</span>
                <Stepper
                  label=""
                  value={partials}
                  step={1}
                  min={0}
                  max={20}
                  onChange={setPartials}
                />
              </div>
            )}
          </div>
          <div className="se-label se-label-more">{t.seGroupMore}</div>
          <div className="se-group">
            {sidesOk && !isAssist && !isBand && (
              <div className="sides-block">
                <div className="toggle-row sides-row">
                  <Icon name="arrows-out-line-horizontal" />
                  <span className="lab">{t.sidesLabel}</span>
                  <div className="seg2 sides-seg">
                    <button
                      className={sides === 'both' ? 'active' : ''}
                      onClick={() => pickSides('both')}
                    >
                      {t.sidesBoth}
                    </button>
                    <button
                      className={sides === 'one' ? 'active' : ''}
                      onClick={() => pickSides('one')}
                    >
                      {t.sidesOne}
                    </button>
                  </div>
                </div>
                {sides === 'one' && (
                  <div className="sides-note">
                    <Icon name="info" />
                    {t.sidesNote}
                  </div>
                )}
              </div>
            )}
            {unitEligible && !isAssist && !isBand && !bw && (
              <div className="toggle-row unit-row">
                <Icon name="scales" />
                <span className="lab">{t.unitLabel}</span>
                <div className="seg2 unit-seg">
                  {(['kg', 'lb'] as DisplayUnit[]).map((u) => (
                    <button
                      key={u}
                      className={unit === u ? 'active' : ''}
                      onClick={() => setUnit(u)}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {unitEligible && !isAssist && !isBand && unit === 'lb' && !bw && weight > 0 && (
              <div className="unit-equiv">{t.unitStoredKg(fmtWeightValue(weight))}</div>
            )}
            {isBarbell && !isAssist && !isBand && !bw && (
              <button className="toggle-row" onClick={() => setPlateOpen(true)}>
                <Icon name="barbell" />
                <span className="lab">{t.plateTitle}</span>
                <span className="toggle-value">
                  {fmtWeightValue(weight)} {t.kgCol.toLowerCase()}
                </span>
              </button>
            )}
            {!isAssist && !isBand && (
              <button className="toggle-row" onClick={() => setBw((x) => !x)}>
                <Icon name="barbell" />
                <span className="lab">{t.bodyweightSet}</span>
                <Switch on={bw} />
              </button>
            )}
          </div>
        </>
      )}
      {props.onExerciseSettings && (
        <button className="toggle-row se-exset" onClick={props.onExerciseSettings}>
          <Icon name="gear" />
          <span className="lab">{t.exerciseSettings}</span>
          <Icon name="caret-right" />
        </button>
      )}
      <div className="sheet-actions">
        {props.onDelete && (
          <button className="danger-outline" style={{ minHeight: 44 }} onClick={props.onDelete}>
            <Icon name="trash" />
            {t.deleteSet}
          </button>
        )}
        <button className="btn btn-secondary grow" onClick={props.onClose}>
          {t.cancel}
        </button>
        <button className="btn btn-primary grow" onClick={save}>
          {props.set ? t.save : t.log}
        </button>
      </div>
      {plateOpen && (
        <PlateSheet
          targetKg={weight}
          initialUnit={unit}
          onApply={(kg) => {
            setWeight(kg);
            setBw(false);
          }}
          onClose={() => setPlateOpen(false)}
        />
      )}
      {bandsOpen && props.gym && (
        <Sheet onClose={() => setBandsOpen(false)} className="band-sheet">
          <BandLibraryCard gym={props.gym} seedDefaults onSaved={() => setBandsOpen(false)} />
        </Sheet>
      )}
    </SetEditorFrame>
  );
}

// ---------------------------------------------------------------------------
// F3 · Circuit rendering (design CR-03 … CR-07)
// ---------------------------------------------------------------------------

function circuitPrimaryMuscle(ex: Exercise): MuscleGroup | null {
  const m = ex.primaryMuscle;
  if (m && (MUSCLE_IDS as readonly string[]).includes(m)) return m as MuscleGroup;
  const s = (ex.secondaryMuscles ?? []).find((x) => (MUSCLE_IDS as readonly string[]).includes(x));
  return (s as MuscleGroup) ?? null;
}

function circuitMuscleChips(
  ex: Exercise,
  onMuscle: (m: MuscleGroup) => void,
  opts?: { icon?: boolean; max?: number },
) {
  const primary = circuitPrimaryMuscle(ex);
  const secondary = (ex.secondaryMuscles ?? [])
    .filter((x) => (MUSCLE_IDS as readonly string[]).includes(x) && x !== primary)
    .slice(0, opts?.max ?? 1) as MuscleGroup[];
  return (
    <>
      {primary && (
        <MuscleChip
          muscle={primary}
          tone="primary"
          variant="pill"
          icon={opts?.icon}
          onClick={onMuscle}
          detail
        />
      )}
      {secondary.map((m) => (
        <MuscleChip key={m} muscle={m} tone="secondary" variant="pill" onClick={onMuscle} detail />
      ))}
    </>
  );
}

function CircuitBlock(props: {
  group: SupersetGroup;
  past: boolean;
  onRun: () => void;
  onMuscle: (m: MuscleGroup) => void;
  building?: boolean;
  rounds?: number;
  onAddAnother?: () => void;
  onDoneBuilding?: () => void;
  onRounds?: (delta: number) => void;
  isLast?: boolean;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const [expanded, setExpanded] = useState(false);
  const g = props.group;
  const rounds = groupRounds(g);
  const doneRounds = Math.min(...g.exercises.map((e) => e.sets.length));
  const complete = doneRounds >= rounds;
  const summary = !props.building && (props.past || complete);
  const letter = g.letter;
  const totalKg = g.exercises.reduce((v, e) => v + exerciseVolumeKg(e), 0);
  // CR-11 · a finished circuit that isn't the last block collapses to a slim
  // done-bar; the just-finished one (last block) and history stay expanded.
  const slim = summary && !props.past && !props.isLast && !expanded;

  // CR-02 · building the circuit (mode active) — a plain list, rounds control
  // and the "Done — start" CTA. The loop wash lives in the top banner instead.
  if (props.building) {
    const buildRounds = props.rounds ?? rounds;
    return (
      <div className="circuit-building">
        <div className="section-label cbld-label">{t.circuitBuilding}</div>
        {g.exercises.map((e, i) => (
          <div key={e.id} className="cbld-row">
            <span className="cb-slot">
              {letter}
              {i + 1}
            </span>
            <div className="cbld-main">
              <div className="cbld-name">{exName(e.name)}</div>
              <div className="cbld-mus">{circuitMuscleChips(e, props.onMuscle)}</div>
            </div>
            <Icon name="list" className="cbld-drag" />
          </div>
        ))}
        <div className="cbld-rounds">
          <Icon name="arrows-clockwise" className="cbld-loopi" />
          <span className="cbld-rlabel">{t.circuitRounds}</span>
          <div className="cbld-stepper">
            <button aria-label="-" onClick={() => props.onRounds?.(-1)}>
              <Icon name="minus-circle" />
            </button>
            <span className="num">{buildRounds}</span>
            <button aria-label="+" onClick={() => props.onRounds?.(1)}>
              <Icon name="plus-circle" />
            </button>
          </div>
        </div>
        <button className="btn btn-secondary cbld-add" onClick={props.onAddAnother}>
          <Icon name="plus" weight="bold" />
          {t.circuitAddAnother}
        </button>
        <button className="btn btn-primary cbld-done" onClick={props.onDoneBuilding}>
          <Icon name="check-circle" />
          {t.circuitDoneStart(letter)}
        </button>
      </div>
    );
  }

  if (slim) {
    return (
      <button className="circuit-block donebar" onClick={() => setExpanded(true)}>
        <span className="loop sm off">
          <Icon name="arrows-clockwise" />
        </span>
        <div className="cb-htext">
          <div className="cb-tag">
            <span className="cb-name off">{t.circuitTitle(letter)}</span>
            <span className="cb-dot">·</span>
            <span className="cb-done-tag">{t.circuitStatusDone}</span>
          </div>
          <div className="cb-meta">
            {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
          </div>
        </div>
        <Icon name="check-circle" weight="fill" className="cb-donecheck" />
      </button>
    );
  }

  if (summary) {
    return (
      <div className="circuit-block done">
        <span className="cb-spine" />
        <div className="cb-inner">
          <div className="cb-head">
            <span className="loop sm">
              <Icon name="arrows-clockwise" />
            </span>
            <div className="cb-htext">
              <div className="cb-tag">
                <span className="cb-name">{t.circuitTitle(letter)}</span>
                <span className="cb-dot">·</span>
                <span className="cb-done-tag">{t.circuitStatusDone}</span>
              </div>
              <div className="cb-meta">
                {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
              </div>
            </div>
            {props.past && totalKg > 0 && <span className="cb-vol num">{fmtTonnes(totalKg)}</span>}
            {!props.past && !props.isLast && (
              <button
                className="cb-collapse"
                aria-label={t.navCollapse}
                onClick={() => setExpanded(false)}
              >
                <Icon name="caret-up" />
              </button>
            )}
          </div>
          <div className="cb-didhead">
            <span className="section-label">{t.circuitWhatYouDid}</span>
            {!complete && (
              <button className="btn btn-secondary cb-continue" onClick={props.onRun}>
                <Icon name="arrow-counter-clockwise" />
                {t.circuitContinueCircuit}
              </button>
            )}
          </div>
          <div className="cb-summary">
            {g.exercises.map((e, i) => (
              <div key={e.id} className="cb-srow">
                <div className="cb-sline">
                  <span className="cb-slot">
                    {letter}
                    {i + 1}
                  </span>
                  <span className="cb-sname">{exName(e.name)}</span>
                  <span className="cb-scount num">
                    {t.circuitNRoundsShort(Math.min(e.sets.length, rounds), rounds)}
                  </span>
                </div>
                <div className="cb-plates">
                  {Array.from({ length: rounds }).map((_, r) => {
                    const st = e.sets[r];
                    const on = !!st;
                    const val = st
                      ? st.weight != null
                        ? `${st.reps}×${fmtWeightValue(st.weight)}`
                        : `${st.reps}`
                      : '—';
                    return (
                      <div key={r} className={`rplate${on ? ' on' : ''}`}>
                        <span className="rplate-r">R{r + 1}</span>
                        <span className="rplate-v num">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="circuit-block">
      <span className="cb-spine" />
      <div className="cb-inner">
        <div className="cb-head">
          <span className="loop sm">
            <Icon name="arrows-clockwise" />
          </span>
          <div className="cb-htext">
            <div className="cb-tag">
              <span className="cb-name">{t.circuitTitle(letter)}</span>
            </div>
            <div className="cb-meta">
              {t.circuitNExercises(g.exercises.length)} · {t.circuitNRounds(rounds)}
            </div>
          </div>
          <div className="cb-counter">
            <span className="num">{t.circuitNRoundsShort(doneRounds, rounds)}</span>
            <span className="cb-counter-lbl">{t.circuitRoundsShort}</span>
          </div>
        </div>
        <div className="cb-pips">
          {Array.from({ length: rounds }).map((_, r) => (
            <span
              key={r}
              className={`pip${r < doneRounds ? ' done' : r === doneRounds ? ' active' : ''}`}
            />
          ))}
        </div>
        <div className="cb-list">
          {g.exercises.map((e, i) => (
            <div key={e.id} className="cb-row">
              <span className="cb-slot">
                {letter}
                {i + 1}
              </span>
              <span className="cb-rname">{exName(e.name)}</span>
              <span className="cb-rmus">{circuitMuscleChips(e, props.onMuscle)}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary cb-cta" onClick={props.onRun}>
          <Icon name="play" />
          {doneRounds === 0 ? t.circuitStart : t.circuitContinueRound(doneRounds + 1)}
        </button>
      </div>
    </div>
  );
}

function CircuitRunSheet(props: {
  group: SupersetGroup;
  onLog: (ex: Exercise, vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onSetRounds: (r: number) => void;
  onClose: () => void;
  onMuscle: (m: MuscleGroup) => void;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const g = props.group;
  const rounds = groupRounds(g);
  const letter = g.letter;
  const startRound = Math.min(rounds - 1, Math.min(...g.exercises.map((e) => e.sets.length)));
  const [roundIdx, setRoundIdx] = useState(Math.max(0, startRound));
  const firstUnlogged = g.exercises.findIndex((e) => e.sets.length <= startRound);
  const [exIdx, setExIdx] = useState(firstUnlogged < 0 ? 0 : firstUnlogged);
  // CR-10 · between-rounds panel: the round number just completed (null = running).
  const [roundDone, setRoundDone] = useState<number | null>(null);
  const [restSec, setRestSec] = useState(0);

  useEffect(() => {
    if (roundDone == null) return;
    const id = setInterval(() => setRestSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [roundDone]);

  const n = g.exercises.length;
  const cur = g.exercises[Math.min(exIdx, n - 1)];
  const loggedThisRound = (i: number) => g.exercises[i].sets.length > roundIdx;
  const curLogged = loggedThisRound(exIdx);
  const weighted = loadTypeFor(cur) === 'weight';

  const prevSet = cur.sets[cur.sets.length - 1];
  const goalReps = cur.plannedReps ?? prevSet?.reps ?? 10;
  const seedReps = prevSet?.reps ?? cur.plannedReps ?? 10;
  const seedWeight = prevSet?.weight ?? null;

  const recorded = curLogged ? cur.sets[roundIdx] : undefined;
  const nextEx = (() => {
    for (let k = 1; k <= n; k++) {
      const i = (exIdx + k) % n;
      if (i !== exIdx && !loggedThisRound(i)) return { ex: g.exercises[i], i };
    }
    return null;
  })();

  function advance(justLogged: number) {
    for (let k = 1; k <= n; k++) {
      const i = (justLogged + k) % n;
      if (i !== justLogged && !loggedThisRound(i)) {
        setExIdx(i);
        return;
      }
    }
  }

  function completeRound() {
    setRestSec(0);
    setRoundDone(roundIdx + 1);
  }

  function startNextRound() {
    const next = roundDone ?? roundIdx + 1;
    if (next + 1 > rounds) props.onSetRounds(next + 1);
    setRoundIdx(next);
    setExIdx(0);
    setRoundDone(null);
  }

  const fmtRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  // CR-10 · between-rounds panel ------------------------------------------
  if (roundDone != null) {
    const doneCount = g.exercises.filter((e) => e.sets.length >= roundDone).length;
    return (
      <Sheet className="circuit-run cr-between" onClose={props.onClose}>
        <div className="crb-body">
          <span className="crb-check">
            <Icon name="check-circle" weight="fill" />
          </span>
          <div className="crb-title">{t.circuitRoundComplete(roundDone)}</div>
          <div className="crb-sub">
            {t.circuitAllLogged(doneCount)} {t.circuitRoundCompleteBody}
          </div>
          <div className="crb-pips">
            {Array.from({ length: rounds }).map((_, r) => (
              <span
                key={r}
                className={`pip${r < roundDone ? ' done' : r === roundDone ? ' active' : ''}`}
              />
            ))}
            <span className="pip open">
              <Icon name="plus" weight="bold" />
            </span>
          </div>
          <div className="crb-openlbl">
            {t.circuitNRoundsShort(roundDone, rounds)} · <span>{t.circuitRoundsOpen}</span>
          </div>
          <div className="crb-rest">
            <Icon name="timer" />
            <span className="crb-rest-lbl">{t.circuitRest}</span>
            <span className="crb-rest-num num">{fmtRest(restSec)}</span>
          </div>
        </div>
        <div className="crb-actions">
          <button className="btn btn-primary cr-log" onClick={startNextRound}>
            <Icon name="play" />
            {t.circuitStartRound(roundDone + 1)}
          </button>
          <div className="crb-actions-row">
            <button
              className="btn btn-secondary cr-finish"
              onClick={() => props.onSetRounds(rounds + 1)}
            >
              <Icon name="plus" weight="bold" />
              {t.circuitAddRound}
            </button>
            <button className="btn btn-secondary cr-finish" onClick={props.onClose}>
              <Icon name="flag-checkered" />
              {t.circuitFinishAll}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet className="circuit-run" onClose={props.onClose}>
      <div className="cr-loophead">
        <span className="loop">
          <Icon name="arrows-clockwise" />
        </span>
        <div className="cr-lh-text">
          <div className="cr-lh-tag">{t.circuitTitle(letter)}</div>
          <div className="cr-lh-round">{t.circuitRoundOf(roundIdx + 1, rounds)}</div>
        </div>
        <div className="cr-pips">
          {Array.from({ length: rounds }).map((_, r) => (
            <span
              key={r}
              className={`pip${r < roundIdx ? ' done' : r === roundIdx ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="cr-nav">
        <button
          className="cr-arrow"
          disabled={exIdx === 0}
          aria-label={t.navPrev}
          onClick={() => setExIdx(Math.max(0, exIdx - 1))}
        >
          <Icon name="caret-left" />
        </button>
        <div className="cr-nav-mid">
          <div className="cr-dots">
            {g.exercises.map((e, i) => (
              <span
                key={e.id}
                className={`crb-pos${i === exIdx ? ' active' : loggedThisRound(i) ? ' done' : ''}`}
              />
            ))}
          </div>
          <div className="cr-nav-lbl">{t.circuitExerciseOf(exIdx + 1, n)}</div>
        </div>
        <button
          className="cr-arrow"
          disabled={exIdx >= n - 1}
          aria-label={t.navNext}
          onClick={() => setExIdx(Math.min(n - 1, exIdx + 1))}
        >
          <Icon name="caret-right" />
        </button>
      </div>

      <div className="cr-stage">
        {recorded ? (
          <div className="cr-card recorded">
            <div className="cr-card-head">
              <span className="slot ok">
                {letter}
                {exIdx + 1}
              </span>
              <span className="cr-card-name">{exName(cur.name)}</span>
              <Icon name="check-circle" weight="fill" className="cr-ok" />
            </div>
            <div className="cr-mus">{circuitMuscleChips(cur, props.onMuscle, { icon: true })}</div>
            <div className="cr-recorded">
              <Icon name="check-circle" weight="fill" />
              <span className="cr-rec-text">
                {t.circuitRecorded} ·{' '}
                <span className="num">
                  {recorded.weight != null
                    ? `${recorded.reps} × ${fmtWeightValue(recorded.weight)} ${t.kgCol.toLowerCase()}`
                    : `${recorded.reps} ${t.chUnit.reps}`}
                </span>
              </span>
            </div>
            {nextEx && (
              <div className="cr-next">
                <span className="cr-next-slot num">
                  {letter}
                  {nextEx.i + 1}
                </span>
                <span className="cr-next-name">
                  {t.circuitNext} · {nextEx.ex.name}
                </span>
                <button className="cr-next-go" onClick={() => setExIdx(nextEx.i)}>
                  {t.circuitNext === 'Next' ? 'Go' : ''}
                  <Icon name="arrow-right" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <CircuitExerciseCard
            key={`${cur.id}-${roundIdx}`}
            exercise={cur}
            slot={`${letter}${exIdx + 1}`}
            round={roundIdx + 1}
            goalReps={goalReps}
            seedReps={seedReps}
            seedWeight={seedWeight}
            weighted={weighted}
            last={exIdx === n - 1}
            onMuscle={props.onMuscle}
            onLog={(vals) => {
              props.onLog(cur, vals);
              advance(exIdx);
            }}
          />
        )}
      </div>

      <div className="cr-foot">
        <button className="btn btn-primary cr-complete" onClick={completeRound}>
          <Icon name="check-circle" />
          {t.circuitCompleteRound}
        </button>
        <button className="btn btn-secondary cr-finish" onClick={props.onClose}>
          {t.circuitFinishAll}
        </button>
      </div>
    </Sheet>
  );
}

function CircuitExerciseCard(props: {
  exercise: Exercise;
  slot: string;
  round: number;
  goalReps: number;
  seedReps: number;
  seedWeight: number | null;
  weighted: boolean;
  last: boolean;
  onMuscle: (m: MuscleGroup) => void;
  onLog: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
}) {
  const { t } = useT();
  const [reps, setReps] = useState(props.seedReps);
  const [weight, setWeight] = useState<number>(props.seedWeight ?? 0);

  function log() {
    props.onLog({
      reps,
      weight: props.weighted ? weight : null,
      isWarmup: false,
      type: 'working',
      drops: [],
      durationMin: null,
      distanceKm: null,
      calories: null,
      rpe: null,
    });
  }

  return (
    <div className="cr-card">
      <div className="cr-card-head">
        <span className="slot">{props.slot}</span>
        <span className="cr-card-name">{props.exercise.name}</span>
      </div>
      <div className="cr-mus">
        {circuitMuscleChips(props.exercise, props.onMuscle, { icon: true })}
      </div>
      <div className="cr-goal">
        <Icon name="target" />
        <span>
          {t.circuitRoundGoal} ·{' '}
          <strong>
            {props.goalReps} {t.chUnit.reps}
          </strong>
        </span>
      </div>
      <div className="cr-steppers">
        <div className="cr-step">
          <div className="lbl">{t.repsCol}</div>
          <div className="cr-step-ctl">
            <button aria-label="-" onClick={() => setReps(Math.max(0, reps - 1))}>
              <Icon name="minus" weight="bold" />
            </button>
            <span className="num">{reps}</span>
            <button aria-label="+" onClick={() => setReps(reps + 1)}>
              <Icon name="plus" weight="bold" />
            </button>
          </div>
        </div>
        {props.weighted && (
          <div className="cr-step">
            <div className="lbl">{t.kgCol}</div>
            <div className="cr-step-ctl">
              <button aria-label="-" onClick={() => setWeight(Math.max(0, weight - 2.5))}>
                <Icon name="minus" weight="bold" />
              </button>
              <span className="num">{fmtWeightValue(weight)}</span>
              <button aria-label="+" onClick={() => setWeight(weight + 2.5)}>
                <Icon name="plus" weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>
      <button className="btn btn-primary cr-log" onClick={log}>
        <Icon name="check" />
        {t.circuitLogRound(props.slot, props.round)}
      </button>
      {props.weighted ? (
        <div className="cr-swipe">
          <Icon name="arrow-left" />
          {t.circuitSwipeHint}
          <Icon name="arrow-right" />
        </div>
      ) : (
        <div className="cr-noload">{t.circuitNoLoad}</div>
      )}
    </div>
  );
}
