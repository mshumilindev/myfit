/** Live session + past workout editing — design S-17…S-31 + SS/DS/MG/EQ. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Shell } from '../App';
import type { DropEntry, Exercise, ExerciseKind, Gym, SetEntry, SetType, Workout } from '../types';
import {
  addDropToSet,
  addExercise,
  attachGymToWorkout,
  clearSets,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  duplicateExercise,
  duplicateSet,
  equipmentFor,
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
  knownExercises,
  perHandFactor,
  muscleSetsInWorkout,
  muscleWorkSorted,
  nextSupersetLetter,
  prevLift,
  recordWeight,
  renameExercise,
  replaceExercise,
  reopenWorkout,
  resolveMuscles,
  restoreExercise,
  restoreSet,
  saveCatalogExercise,
  sessionBlocks,
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
} from '../store';
import { workoutCalories } from '../activities';
import { kgToLb, lbToKg } from '../plates';
import { bandForKg, assistStack, BAND_HEX, type BandRung, type LoadType } from '../loads';
import { LiveHero } from '../components/LiveHero';
import { SessionStartCoach } from '../components/SessionStartCoach';
import { EnergyPlaque, LiveEnergyCounter } from '../components/SessionEnergy';
import { PlateSheet } from '../components/PlateSheet';
import { SessionMuscleMap } from '../components/SessionMuscleMap';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';
import {
  EquipChip,
  MuscleChip,
  MuscleIcon,
  MuscleSetChip,
  MUSCLE_IDS,
  equipmentIconName,
  withMuscleBreak,
} from '../components/Muscle';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { nextTarget, topHistory } from '../progression';
import { describeDay, dayReadoutLabel, exerciseDay, type TrainingDay } from '../data/daySuggest';
import { drawShareCard, cardBlob, type ShareModel, type ShareFormat } from '../data/shareCard';
import {
  BUILT_IN_CATALOG,
  muscleInfoByName,
  richExerciseById,
  searchCatalog,
  secondaryMusclesOf,
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
import { ConfirmDialog, Dialog, EmptyState, Icon, Sheet, Switch, useIsDesktop } from '../ui';
import { LOCALE_IDS, fmtWeekday } from '../i18n';
import { getRole } from '../api';

const TIMED_KINDS: ExerciseKind[] = ['warmup', 'cardio', 'cooldown'];
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
  distanceKm?: number | null;
};

type SheetState =
  | { kind: 'add' }
  | {
      kind: 'edit';
      exId: string;
      set: SetEntry | null;
      /** Prefill for a not-yet-logged set: what the ghost row is proposing. */
      ghost: GhostValues;
    }
  | { kind: 'menu'; exId: string }
  | { kind: 'replace'; exId: string }
  | { kind: 'group-menu'; groupId: string }
  | { kind: 'superset'; exId: string }
  | { kind: 'gym' }
  | { kind: 'musclemap' }
  | null;

type DialogState =
  | { kind: 'del-ex'; exId: string }
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
  const store = useStore();
  // Day-aware suggestions & muscle readouts are always on (not flagged).
  const suggestOn = true;
  const workout = store.workouts.find((w) => w.id === props.workoutId);
  const [sheet, setSheet] = useState<SheetState>(null);
  // Live count-up timer for a timed exercise (TIMED-1/2): Start → count-up, Stop → log held time.
  const [timing, setTiming] = useState<{ exId: string; startedAt: number } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [summary, setSummary] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Share-summary bottom sheet open (AC-3.2). */
  const [shareOpen, setShareOpen] = useState(false);
  /** Past workout cards start collapsed for reading (SS-3). */
  const [expandedPast, setExpandedPast] = useState<string[]>([]);
  /** The set logged most recently in this visit — its row reads “just now”. */
  const [recentSetId, setRecentSetId] = useState<string | null>(null);
  /** Planned-but-untouched exercises the user tapped open (SS-1 queue rows). */
  const [wokenIds, setWokenIds] = useState<string[]>([]);
  const isDesktop = useIsDesktop();
  const startAddConsumed = useRef(false);

  const live = !!workout && workout.finishedAt === null && !props.past;
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
      contentBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
  const [viewportExId, setViewportExId] = useState<string | null>(null);
  const railExKey = (workout?.exercises ?? []).map((e) => e.id).join(',');
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.session-screen [data-exid]'));
    if (cards.length === 0) return;
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.exid;
          if (!id) continue;
          if (e.isIntersecting) ratios.set(id, e.intersectionRatio);
          else ratios.delete(id);
        }
        // Most-visible card wins; DOM order breaks ties toward the topmost.
        let best: string | null = null;
        let bestRatio = 0;
        for (const c of cards) {
          const id = c.dataset.exid;
          if (!id) continue;
          const r = ratios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        setViewportExId(best);
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1], rootMargin: '-96px 0px -40% 0px' },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [railExKey, expandedPast, wokenIds, live]);

  // Records BEFORE this workout, per exercise name — for PR detection.
  const baseline = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of workout?.exercises ?? []) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.toLowerCase();
      if (!m.has(key)) m.set(key, recordWeight(e.name, props.workoutId));
    }
    return m;
  }, [workout?.exercises.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const activeExerciseId =
    sortedExercises.find((ex) => {
      if (isMarkerExercise(ex)) return false;
      const planned = Math.max(0, ex.plannedSets ?? 0);
      return planned > 0 ? ex.sets.length < planned : ex.sets.length === 0;
    })?.id ??
    sortedExercises[0]?.id ??
    null;
  // The left milestone rail shows on the phone once there's more than one
  // exercise; the screen gets a class so the content can inset to clear it.
  const showRail = !isDesktop && workout.exercises.length > 0 && sortedExercises.length > 1;
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
    !!(live || props.past) && !!(gym || lastTimeRows.length > 0 || entries > 0);

  function ghostFor(ex: Exercise): { reps: number; weight: number | null } {
    const last = ex.sets[ex.sets.length - 1];
    if (last && !last.isWarmup) return { reps: last.reps, weight: last.weight ?? 0 };
    const prev = prevLift(ex.name, workout!.id);
    if (prev) return { reps: ex.plannedReps ?? prev.reps, weight: prev.weight };
    if (last) return { reps: last.reps, weight: last.weight ?? 0 };
    if (ex.plannedReps) return { reps: ex.plannedReps, weight: null };
    return { reps: 8, weight: 20 };
  }

  function timedGhostFor(ex: Exercise): { durationMin: number; distanceKm: number | null } {
    const last = ex.sets[ex.sets.length - 1];
    if (last) return { durationMin: last.durationMin ?? 10, distanceKm: last.distanceKm ?? null };
    const kind = exerciseKind(ex);
    if (ex.plannedDurationMin) {
      return {
        durationMin: ex.plannedDurationMin,
        distanceKm: kind === 'cardio' ? null : null,
      };
    }
    return { durationMin: kind === 'cardio' ? 20 : 8, distanceKm: kind === 'cardio' ? 2 : null };
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
  function logNewSet(ex: Exercise, vals: Omit<SetEntry, 'id' | 'position'>): void {
    const base = Math.max(
      baseline.get(ex.name.toLowerCase()) ?? 0,
      ...ex.sets.filter((s) => setTypeOf(s) !== 'warmup').map((s) => s.weight ?? 0),
    );
    const id = uuid();
    upsertSet(workout!.id, ex.id, { ...vals, id });
    setRecentSetId(id);
    const type: SetType = vals.type ?? (vals.isWarmup ? 'warmup' : 'working');
    if (
      type === 'working' &&
      loadTypeFor(ex) === 'weight' &&
      vals.weight !== null &&
      vals.weight > base &&
      base > 0
    ) {
      props.shell.toast({
        kind: 'ok',
        icon: 'trophy',
        text: t.newRecordToast(ex.name, `${fmtWeightKg(vals.weight)} × ${vals.reps}`),
      });
    }
  }

  function logGhost(
    ex: Exercise,
    v: { reps: number; weight: number | null },
    type: SetType = 'working',
  ): void {
    logNewSet(ex, {
      reps: v.reps,
      weight: v.weight,
      isWarmup: type === 'warmup',
      type,
      drops: [],
      durationMin: null,
      distanceKm: null,
      calories: null,
      rpe: null,
    });
  }

  /** DS-2 · “Add a drop”: append a lighter part to the last logged set. */
  function addDropQuick(ex: Exercise): void {
    const last = [...ex.sets].sort((a, b) => a.position - b.position)[ex.sets.length - 1];
    if (!last) return;
    const parts = setDrops(last);
    const prev = parts[parts.length - 1] ?? { reps: last.reps, weight: last.weight };
    const drop: DropEntry = {
      reps: Math.max(1, prev.reps - 2),
      weight: prev.weight === null ? null : Math.max(0, Math.round((prev.weight * 0.75) / 5) * 5),
    };
    addDropToSet(workout!.id, ex.id, last.id, drop);
    setRecentSetId(last.id);
  }

  /** AC-1: one-tap deep copy of a logged set, inserted right after it. */
  function duplicateSetAction(ex: Exercise, s: SetEntry): void {
    const newId = duplicateSet(workout!.id, ex.id, s.id);
    if (!newId) return;
    setRecentSetId(newId);
    props.shell.toast({ kind: 'ok', icon: 'copy', text: t.setDuplicated });
  }

  function equipmentLabelOf(id: string): string {
    const names = t.equipmentNames as Record<string, string>;
    return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
  }

  /** One-line reading of a finished exercise (SS-3): «3 × 8 · 75 kg». */
  function pastSummary(ex: Exercise): string {
    if (isMarkerExercise(ex)) return t.warmupMarkerTitle;
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
    const cls = `kind${!rec && grp && recentSetId === s.id ? ' just-now' : ''}`;
    return <span className={cls}>{text}</span>;
  }

  function renderCard(ex: Exercise, grp: GroupCtx | null) {
    const ghost = ghostFor(ex);
    const timedGhost = timedGhostFor(ex);
    const timedSheetGhost: GhostValues = { ...ghost, ...timedGhost };
    const prev = prevLift(ex.name, workout!.id);
    const kind = exerciseKind(ex);
    const marker = isMarkerExercise(ex);
    const timed = isTimedExercise(ex) && !marker;
    const planned = Math.max(0, ex.plannedSets ?? 0);
    const completed = planned > 0 && ex.sets.length >= planned;
    const directLogBlocked = !timed && !marker && planned > 0 && ghost.weight === null;
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
    const showGhost = !grp || grp.active;
    const rowCls = grp ? ' rrow' : '';
    const sortedSets = [...ex.sets].sort((a, b) => a.position - b.position);
    return (
      <div
        key={ex.id}
        data-exid={ex.id}
        className={`exercise-card${completed ? ' completed' : ''}${
          !grp && activeExerciseId === ex.id ? ' active' : ''
        }${grp ? ' ss-card' : ''}${grp?.active ? ' ss-active' : ''}${timed ? ' timed-card' : ''}${
          marker ? ' warmup-marker' : ''
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
                {ex.name}
              </button>
              {(timed || marker) && <span className="prev">{t.exerciseKindNames[kind]}</span>}
              {!grp && !timed && !marker && prev && (
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
              {!grp && (
                <button
                  className="dots"
                  onClick={() => setSheet({ kind: 'menu', exId: ex.id })}
                  aria-label={t.menuAction}
                >
                  <Icon name="dots-three-vertical" />
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
          <div className="exercise-chips">
            {muscles.primary && (
              <MuscleChip muscle={muscles.primary} tone="primary" onClick={openMuscleHistory} />
            )}
            {muscles.primary && muscles.secondary.length > 0 && (
              <span className="chip-break" aria-hidden />
            )}
            {muscles.secondary.map((m) => (
              <MuscleChip key={m} muscle={m} tone="secondary" onClick={openMuscleHistory} />
            ))}
            {equipment.map((id) => (
              <EquipChip key={id} id={id} />
            ))}
            {perHandFactor(ex) === 2 && (
              <span className="echip" title={t.perHandNote}>
                {t.perHandChip}
              </span>
            )}
          </div>
        )}
        {marker ? (
          <div className="warmup-marker-body">
            <span className="warmup-marker-icon" aria-hidden>
              <Icon name="flame" weight="fill" />
            </span>
            <div className="warmup-marker-copy">
              <span className="warmup-marker-title">{t.warmupMarkerTitle}</span>
              <span className="warmup-marker-sub">{t.warmupMarkerBody}</span>
            </div>
          </div>
        ) : timed ? (
          <>
            <div className="set-grid header timed">
              <span>#</span>
              <span>{t.durationMinCol}</span>
              <span>{t.distanceKmCol}</span>
              <span>{t.rpeShort}</span>
            </div>
            <div style={renaming === ex.id ? { opacity: 0.6 } : undefined}>
              {sortedSets.map((s, i) => (
                <button
                  key={s.id}
                  className="set-row timed"
                  onClick={() =>
                    setSheet({ kind: 'edit', exId: ex.id, set: s, ghost: timedSheetGhost })
                  }
                >
                  <span className="idx">{i + 1}</span>
                  <span className="val">{s.durationMin ?? 0}</span>
                  <span className="val">{s.distanceKm ?? '—'}</span>
                  <span className="kind">{s.rpe ?? t.optionalMark}</span>
                </button>
              ))}
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
                  {timedGhost.distanceKm ?? '—'}
                </button>
                <button
                  className="btn btn-primary log-btn"
                  onClick={() => logTimedGhost(ex, timedGhost)}
                >
                  {props.past ? t.add : t.log}
                </button>
              </div>
              {live &&
                (timing?.exId === ex.id ? (
                  <div className="timed-timer running">
                    <span className="tt-count num">{mmss(now - timing.startedAt)}</span>
                    <button className="btn btn-primary tt-stop" onClick={() => stopTiming(ex)}>
                      {t.timerStop}
                    </button>
                  </div>
                ) : (
                  <button className="timed-timer start" onClick={() => startTiming(ex)}>
                    <Icon name="timer" />
                    {t.timerStart}
                  </button>
                ))}
            </div>
          </>
        ) : (
          <>
            {target && showGhost && !grp && (
              <div className={`prog-target st-${target.state}`}>
                <span className="pt-label">{t.progTarget}</span>
                <span className="pt-val">
                  {target.weight === null
                    ? t.progRepsTarget(target.reps)
                    : `${fmtWeightValue(target.weight)} × ${target.reps}`}
                </span>
                {target.deltaKg > 0 && (
                  <span className="pt-delta up">+{fmtWeightValue(target.deltaKg)}</span>
                )}
                {target.deltaKg < 0 && (
                  <span className="pt-delta down">{fmtWeightValue(target.deltaKg)}</span>
                )}
                {target.state === 'hold' && <span className="pt-tag">{t.progHold}</span>}
                {target.state === 'stall' && <span className="pt-tag warn">{t.progDeload}</span>}
                {target.state === 'first' && <span className="pt-tag">{t.progFirst}</span>}
                <span className="pt-why">
                  {target.state === 'progress'
                    ? t.progWhyProgress
                    : target.state === 'hold'
                      ? t.progWhyHold
                      : target.state === 'stall'
                        ? t.progWhyStall
                        : t.progWhyFirst}
                </span>
              </div>
            )}
            {!grp && (
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
                const rec = isRecordSet(ex, s);
                const type = setTypeOf(s);
                const drops = setDrops(s);
                const idx = grp ? `R${i + 1}` : `${i + 1}`;
                // Rest before this set, captured at log time (gap to the
                // previously logged set anywhere in the session). Cleared for
                // old workouts whose values were computed incorrectly. For a
                // card's first set the gap is the rest since the previous
                // exercise, so it renders as a "between cards" marker on top.
                const restBefore = s.restSec != null ? s.restSec * 1000 : null;
                const interCard = i === 0;
                const restLine =
                  restBefore !== null && restBefore > 0 ? (
                    <div className={`set-rest${interCard ? ' inter-card' : ''}`}>
                      {t.restLabel(mmss(restBefore))}
                    </div>
                  ) : null;
                const dupBtn = live ? (
                  <button
                    type="button"
                    className="set-dup"
                    title={t.duplicateSet}
                    aria-label={t.duplicateSet}
                    onClick={() => duplicateSetAction(ex, s)}
                  >
                    <Icon name="copy" />
                  </button>
                ) : null;
                const row = (
                  <button
                    className={`set-row${rowCls}${type === 'warmup' ? ' warm' : ''}${
                      rec ? ' record' : ''
                    }`}
                    onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })}
                  >
                    <span className="idx">{idx}</span>
                    <span className="val">
                      {type === 'static-dynamic' ? fmtHold(s.durationMin) : s.reps}
                    </span>
                    <span className={`val${loadType === 'assist' ? ' assist-val' : ''}`}>
                      {loadCell(s.weight)}
                    </span>
                    {setKindLabel(ex, s, grp)}
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
                        {dupBtn}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={s.id} className="set-wrap">
                    {restLine}
                    <div className="set-main">
                      {row}
                      {dupBtn}
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
              {/* Live rest count-up only on the exercise that owns the most
                  recent set — logging in another card ends this one's rest. */}
              {live &&
                ex.id === lastLoggedExId &&
                lastLoggedAt > 0 &&
                (() => {
                  const restNow = Math.max(0, now - lastLoggedAt);
                  return (
                    <div className="ex-resting">
                      <Icon name="timer" />
                      <span>{t.restingSince(mmss(restNow))}</span>
                    </div>
                  );
                })()}
              {showGhost && (
                <div className={`ghost-row${rowCls}`}>
                  <span className="idx">{grp ? `R${ex.sets.length + 1}` : ex.sets.length + 1}</span>
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
                  {isDesktop && <span className="kind">{grp ? '' : t.setTypeWorking}</span>}
                  <button
                    className="btn btn-primary log-btn"
                    disabled={directLogBlocked}
                    onClick={() => logGhost(ex, ghost)}
                  >
                    {props.past ? t.add : t.log}
                  </button>
                </div>
              )}
              {!grp && live && ex.sets.length > 0 && (
                <div className="ghost-tools">
                  <button className="ghost-chip" onClick={() => addDropQuick(ex)}>
                    <Icon name="caret-line-down" />
                    {t.addADrop}
                  </button>
                  <button
                    className="ghost-chip muted"
                    onClick={() => logGhost(ex, ghost, 'warmup')}
                  >
                    <Icon name="fire" />
                    {t.warmupChip}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {ex.sets.length === 0 && live && !marker && (
          <div className="ghost-hint">
            {directLogBlocked
              ? t.progWeightRequired
              : planned > 0
                ? t.progGhostDivision
                : timed
                  ? t.timedGhostHint
                  : t.ghostHint}
          </div>
        )}
      </div>
    );
  }

  function startTiming(ex: Exercise): void {
    setTiming({ exId: ex.id, startedAt: Date.now() });
  }
  function stopTiming(ex: Exercise): void {
    if (!timing || timing.exId !== ex.id) return;
    const min = Math.max(0, (Date.now() - timing.startedAt) / 60000);
    const kind = exerciseKind(ex);
    logNewSet(ex, {
      reps: 0,
      weight: null,
      isWarmup: kind === 'warmup',
      durationMin: Math.round(min * 100) / 100,
      distanceKm: null,
      calories: null,
      rpe: null,
    });
    setTiming(null);
  }

  function logTimedGhost(
    ex: Exercise,
    v: { durationMin: number; distanceKm: number | null },
  ): void {
    const kind = exerciseKind(ex);
    logNewSet(ex, {
      reps: 0,
      weight: null,
      isWarmup: kind === 'warmup',
      durationMin: v.durationMin,
      distanceKm: v.distanceKm,
      calories: null,
      rpe: null,
    });
  }

  function formatTimedEntry(s: SetEntry): string {
    const parts = [`${s.durationMin ?? 0} ${t.minShort}`];
    if (s.distanceKm !== null && s.distanceKm !== undefined && s.distanceKm > 0) {
      parts.push(`${s.distanceKm} ${t.kmShort}`);
    }
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
        {suggestOn &&
          (() => {
            const entries = muscleWorkSorted(workout);
            if (entries.length === 0) return null;
            return (
              <div className="muscles-worked">
                <div className="section-label">{t.muscleGroupsWorked}</div>
                <div className="mworked-row">
                  {withMuscleBreak(entries, (x) => (
                    <MuscleSetChip
                      key={x.muscle}
                      muscle={x.muscle}
                      count={x.sets}
                      tone={x.primary ? 'primary' : 'secondary'}
                      onClick={openMuscleHistory}
                    />
                  ))}
                </div>
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
      className={`screen paned session-screen${live ? ' session-live' : ''}${props.past ? ' session-past' : ''}${workout.autoFinished ? ' session-auto' : ''}${showSessionSide ? ' session-has-side' : ''}${showRail ? ' session-has-rail' : ''}`}
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
              const inView = ex.id === viewportExId;
              return (
                <button
                  key={ex.id}
                  type="button"
                  className={`srail-dot${exerciseDone(ex) ? ' done' : ''}${
                    live && ex.id === activeExerciseId ? ' active' : ''
                  }${inView ? ' inview' : ''}`}
                  aria-label={ex.name}
                  aria-current={inView ? 'true' : undefined}
                  onClick={() => {
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
              <button
                className="trash"
                onClick={() => setDialog({ kind: 'del-workout' })}
                aria-label={t.deleteWorkout}
              >
                <Icon name="trash" />
              </button>
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
              const activeEx = sortedExercises.find((e) => e.id === activeExerciseId) ?? null;
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
                      <Icon name="barbell" />
                      <span className="cur-label">{t.currentKicker}</span>
                      <span className="cur-name">{activeEx.name}</span>
                      {nextSet !== null && <span className="cur-set">{t.setNumber(nextSet)}</span>}
                    </div>
                  )}
                  {lastLoggedAt > 0 && (
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
                  <button className="mm-open" onClick={() => setSheet({ kind: 'musclemap' })}>
                    <Icon name="person-simple" />
                    {t.muscleMapButton}
                  </button>
                </div>
                <div className="mworked-row">
                  {withMuscleBreak(entries, (x) => (
                    <MuscleSetChip
                      key={x.muscle}
                      muscle={x.muscle}
                      count={x.sets}
                      tone={x.primary ? 'primary' : 'secondary'}
                      onClick={openMuscleHistory}
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

          {workout.exercises.length === 0 ? (
            <div className="session-empty">
              {live && (
                <SessionStartCoach
                  finished={store.workouts.filter((w) => w.finishedAt !== null)}
                  now={now}
                />
              )}
              <EmptyState icon="list-plus" title={t.noExercisesYet} body={t.noExercisesBody}>
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
              {sessionBlocks(workout).map((block) => {
                if (block.kind === 'group') {
                  const g = block.group;
                  const rounds = groupRounds(g);
                  const round = groupCurrentRound(g);
                  const minSets = Math.min(...g.exercises.map((e) => e.sets.length));
                  const activeMemberId =
                    g.exercises.find((e) => e.sets.length === minSets)?.id ?? null;
                  void minSets;
                  const collapsed =
                    props.past &&
                    g.exercises.some((e) => e.sets.length > 0) &&
                    !g.exercises.some((e) => expandedPast.includes(e.id));
                  if (collapsed) {
                    const kg = g.exercises.reduce((v, e) => v + exerciseVolumeKg(e), 0);
                    return (
                      <div key={g.groupId} className="ss-block past">
                        <div className="ss-bar" />
                        <div className="ss-body">
                          <div className="ss-head">
                            <span className="tag tag-neutral">{t.supersetTag(g.letter)}</span>
                            <span className="ss-rounds-meta">
                              {t.roundsMeta(rounds, fmtKg(kg))}
                            </span>
                          </div>
                          <button
                            className="past-ex-card"
                            onClick={() =>
                              setExpandedPast((x) => [...x, ...g.exercises.map((e) => e.id)])
                            }
                          >
                            {g.exercises.map((e, i) => (
                              <span key={e.id} className="past-ex-row">
                                <span className="ss-index">
                                  {g.letter}
                                  {i + 1}
                                </span>
                                <span className="n">{e.name}</span>
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
                              onClick={() => setSheet({ kind: 'group-menu', groupId: g.groupId })}
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
                                    <td>{e.name}</td>
                                    <td>
                                      <span style={{ display: 'inline-flex', gap: 5 }}>
                                        {m.primary && (
                                          <span className="mchip">{t.muscleGroups[m.primary]}</span>
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
                if (
                  live &&
                  isStrengthExercise(single) &&
                  single.sets.length === 0 &&
                  Math.max(0, single.plannedSets ?? 0) > 0 &&
                  activeExerciseId !== single.id &&
                  !wokenIds.includes(single.id)
                ) {
                  return (
                    <button
                      key={single.id}
                      data-exid={single.id}
                      className="past-ex-card queued-ex-card"
                      onClick={() => setWokenIds((x) => [...x, single.id])}
                    >
                      <span className="past-ex-row">
                        <span className="n">{single.name}</span>
                        <span className="count">
                          {single.sets.length} / {Math.max(0, single.plannedSets ?? 0)}
                        </span>
                      </span>
                    </button>
                  );
                }
                if (props.past && single.sets.length > 0 && !expandedPast.includes(single.id)) {
                  return (
                    <button
                      key={single.id}
                      data-exid={single.id}
                      className="past-ex-card"
                      onClick={() => setExpandedPast((x) => [...x, single.id])}
                    >
                      <span className="past-ex-row">
                        <span className="n">{single.name}</span>
                        <span className="v">{pastSummary(single)}</span>
                      </span>
                    </button>
                  );
                }
                return renderCard(single, null);
              })}
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
              {props.past && (
                <button className="btn btn-primary share-cta" onClick={() => setShareOpen(true)}>
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
        </div>
      </div>
      {live && !workout.autoFinished && !isDesktop && (
        <div className="session-pill-wrap">
          <div className="session-pill">
            <button
              className="sp-btn sp-discard"
              onClick={() => setDialog({ kind: 'del-workout' })}
              aria-label={t.discardSession}
              title={t.discardSession}
            >
              <Icon name="trash" />
            </button>
            <button className="sp-btn sp-add" onClick={() => setSheet({ kind: 'add' })}>
              <Icon name="plus" weight="bold" />
              <span>{t.addExercise}</span>
            </button>
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

      {sheet?.kind === 'add' && (
        <AddExerciseSheet
          workout={workout}
          gym={gym}
          suggestions={!props.past && workout.exercises.length === 0}
          onPick={(name, kind, meta) => {
            addExercise(
              workout.id,
              name,
              kind,
              meta
                ? {
                    primaryMuscle: meta.primaryMuscle,
                    secondaryMuscles: meta.secondaryMuscles,
                    equipment: meta.equipment,
                  }
                : {},
            );
            // Single-add: one pick adds the exercise and closes the picker.
            // Re-open to add another (same exercise allowed, e.g. circuits).
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
          onSave={(vals) => {
            const ex = workout.exercises.find((e) => e.id === sheet.exId)!;
            if (sheet.set) {
              upsertSet(workout.id, ex.id, { ...vals, id: sheet.set.id });
            } else {
              logNewSet(ex, vals);
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
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'menu' &&
        (() => {
          const ex = workout.exercises.find((e) => e.id === sheet.exId);
          if (!ex) return null;
          return (
            <Sheet padded={false} onClose={() => setSheet(null)}>
              <div className="sheet-label">{t.exerciseMenuTitle(ex.name, ex.sets.length)}</div>
              <button
                className="menu-item"
                onClick={() => setSheet({ kind: 'replace', exId: ex.id })}
              >
                <Icon name="swap" />
                {t.replaceExercise}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  duplicateExercise(workout.id, ex.id);
                  setSheet(null);
                }}
              >
                <Icon name="copy" />
                {t.duplicateWithSets}
              </button>
              {isStrengthExercise(ex) &&
                !ex.groupId &&
                sortedExercises.filter((e) => isStrengthExercise(e) && !e.groupId).length > 1 && (
                  <button
                    className="menu-item"
                    onClick={() => setSheet({ kind: 'superset', exId: ex.id })}
                  >
                    <Icon name="rows" />
                    {t.supersetWith}
                  </button>
                )}
              {ex.groupId && (
                <button
                  className="menu-item"
                  onClick={() => {
                    ungroupSuperset(workout.id, ex.groupId!);
                    setSheet(null);
                  }}
                >
                  <Icon name="x" />
                  {t.ungroup}
                </button>
              )}
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
              <button
                className="menu-item"
                onClick={() => {
                  const removed = clearSets(workout.id, ex.id);
                  setSheet(null);
                  if (removed.length > 0) {
                    props.shell.snack({
                      text: t.exerciseDeleted(ex.name, removed.length),
                      onUndo: () => {
                        for (const s of removed) restoreSet(workout.id, ex.id, s);
                      },
                    });
                  }
                }}
              >
                <Icon name="eraser" />
                {t.clearAllSets}
              </button>
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
              <div className="sheet-rule" />
              {members.map((e) => (
                <button
                  key={e.id}
                  className="menu-item"
                  onClick={() => setSheet({ kind: 'menu', exId: e.id })}
                >
                  <Icon name="dots-three-vertical" />
                  {e.name}
                </button>
              ))}
            </Sheet>
          );
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
            deleteWorkout(workout.id);
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
}

function AddExerciseSheet(props: {
  workout: Workout;
  gym: Gym | null;
  suggestions?: boolean;
  /** Substitute an existing exercise rather than add a new one — the pick swaps
   *  the target's identity and keeps its sets. */
  replacing?: boolean;
  onPick: (name: string, kind: ExerciseKind, meta?: NewExerciseMeta) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [equip, setEquip] = useState<EquipmentId | undefined>(undefined);
  const [muscle, setMuscle] = useState<MuscleGroup | undefined>(undefined);
  const [checkGym, setCheckGym] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Admins/trainers creating a brand-new exercise set its muscles + equipment
  // here, and it is written to the shared server catalog (EQ-4).
  const [creating, setCreating] = useState<string | null>(null);
  const canAuthor = getRole() === 'admin' || getRole() === 'trainer';
  const known = useMemo(() => knownExercises(), []);
  const needle = q.trim().toLowerCase();
  const li = LOCALE_IDS.indexOf(locale);
  const hasInventory = !!props.gym?.inventory && props.gym.inventory.length > 0;

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

  const historyMatches =
    kind === 'strength'
      ? known
          .filter((k) => (needle ? k.name.toLowerCase().includes(needle) : true))
          .map((k) => ({ name: k.name, last: k.last, info: muscleInfoByName(k.name) }))
          .filter(
            (k) =>
              (muscle === undefined ||
                (k.info && (k.info.primary === muscle || k.info.secondary.includes(muscle)))) &&
              (equip === undefined || k.info?.equipment === equip),
          )
          .slice(0, needle || muscle !== undefined || equip !== undefined ? 24 : 6)
      : [];
  const exact = kind === 'strength' && known.some((k) => k.name.toLowerCase() === needle);
  const catalog =
    kind === 'strength' && (needle || equip !== undefined || muscle !== undefined)
      ? searchCatalog(
          needle,
          equip !== undefined || muscle !== undefined ? 14 : 8,
          equip,
          muscle,
        ).filter(
          (c) =>
            !historyMatches.some((m) =>
              c.names.some((n) => n.toLowerCase() === m.name.toLowerCase()),
            ),
        )
      : [];
  const totalCount = historyMatches.length + catalog.length;

  function availability(equipment: EquipmentId | null | undefined): EquipmentId | null {
    if (!checkGym || !hasInventory || !equipment) return null;
    return props.gym!.inventory!.includes(equipment) ? null : equipment;
  }

  // Exercise rows are picked with a plain onClick: a native click fires only on
  // a genuine tap (press + release without scrolling), so dragging to scroll the
  // list never selects a row. No pointerdown handling — that fired on touch-start
  // and grabbed a pick the moment a scroll began.

  function renderFilterPanel() {
    if (kind !== 'strength' || !filtersOpen) return null;
    return (
      <div className="filter-panel">
        <div className="filter-group">
          <div className="filter-group-label">{t.muscleGroupsLabel}</div>
          <div className="filter-chips lg">
            {MUSCLE_IDS.map((m) => (
              <button
                key={m}
                className={`fchip lg${muscle === m ? ' active' : ''}`}
                onClick={() => setMuscle((x) => (x === m ? undefined : m))}
              >
                <MuscleIcon
                  muscle={m}
                  variant="chipLg"
                  tone={muscle === m ? 'onAccent' : 'secondary'}
                />
                {t.muscleGroups[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-group-label">{t.equipmentLabelField}</div>
          <div className="filter-chips lg">
            {EQUIPMENT_IDS.map((id) => (
              <button
                key={id}
                className={`fchip lg${equip === id ? ' active' : ''}`}
                onClick={() => setEquip((x) => (x === id ? undefined : id))}
              >
                <Icon name={equipmentIconName(id)} />
                {t.equipmentNames[id]}
              </button>
            ))}
          </div>
        </div>
        {hasInventory && (
          <button
            className={`fchip lg${checkGym ? ' active' : ''}`}
            onClick={() => setCheckGym((x) => !x)}
          >
            {t.availableHere}
            {checkGym && <Icon className="x" name="x" />}
          </button>
        )}
      </div>
    );
  }

  function renderActiveFilters() {
    if (kind !== 'strength' || filtersOpen || (!muscle && !equip)) return null;
    return (
      <div className="filter-chips">
        {muscle && (
          <button className="fchip active" onClick={() => setMuscle(undefined)}>
            <MuscleIcon muscle={muscle} variant="chip" tone="onAccent" />
            {t.muscleGroups[muscle]}
            <Icon className="x" name="x" />
          </button>
        )}
        {equip && (
          <button className="fchip active" onClick={() => setEquip(undefined)}>
            <Icon name={equipmentIconName(equip)} />
            {t.equipmentNames[equip]}
            <Icon className="x" name="x" />
          </button>
        )}
      </div>
    );
  }

  // --- Day-aware picker (Ex suggestions, AC-1) -----------------------------
  if (props.suggestions) {
    // Read the day from the muscle GROUPS trained — never a hardcoded guess:
    //   • one dominant group        → name it ("Back"),
    //   • several in one split       → the split ("Pull"),
    //   • several across splits      → the actual groups ("Shoulders + Back"),
    //   • many groups                → full body.
    // Reference: program-day targets, else this session's own logged exercises,
    // else the most recent session on this weekday, else the most recent session
    // overall. Groups are ordered by the exercise trained first, so the main
    // lift leads the label.
    const weekday = new Date(props.workout.startedAt).getDay();
    const past = store.workouts
      .filter((w) => w.finishedAt !== null && w.id !== props.workout.id)
      .sort((a, b) => b.startedAt - a.startedAt);
    const orderedGroups = (w: Workout, requireSet: boolean): [MuscleGroup, number][] => {
      const order: MuscleGroup[] = [];
      const counts = new Map<MuscleGroup, number>();
      for (const e of [...w.exercises].sort((a, b) => a.position - b.position)) {
        if (requireSet && e.sets.length === 0) continue;
        const p = resolveMuscles(e).primary;
        if (!p || p === 'cardio') continue;
        if (!counts.has(p)) order.push(p);
        counts.set(p, (counts.get(p) ?? 0) + Math.max(1, e.sets.length));
      }
      return order.map((m) => [m, counts.get(m) as number]);
    };
    const programTargets = (props.workout.targetMuscles ?? []).filter((m): m is MuscleGroup =>
      PICKER_TARGET_MUSCLES.has(m),
    );
    let refGroups: [MuscleGroup, number][] = programTargets.map((m) => [m, 1]);
    let from: 'program' | 'logged' | 'weekday' | 'overall' | null = refGroups.length
      ? 'program'
      : null;
    if (!refGroups.length) {
      refGroups = orderedGroups(props.workout, true);
      if (refGroups.length) from = 'logged';
    }
    if (!refGroups.length) {
      const sameWd = past.find((w) => new Date(w.startedAt).getDay() === weekday);
      if (sameWd) {
        refGroups = orderedGroups(sameWd, false);
        if (refGroups.length) from = 'weekday';
      }
      if (!refGroups.length && past[0]) {
        refGroups = orderedGroups(past[0], false);
        if (refGroups.length) from = 'overall';
      }
    }
    const readout = describeDay(refGroups);
    const DAY_LABEL: Record<TrainingDay, string> = {
      push: t.dayPush,
      pull: t.dayPull,
      legs: t.dayLegs,
      core: t.dayCore,
      full: t.dayFull,
    };
    // Collapse fine muscles into split names ("Legs + Core"), same as the
    // history day readout -- not a long "Quads + Hamstrings + Adductors + ..."
    const dayLabel = readout ? dayReadoutLabel(readout, t) : '';
    const matchesReadout = (primary: MuscleGroup): boolean => {
      if (!readout) return false;
      if (readout.kind === 'split') return exerciseDay(primary) === readout.split;
      if (readout.kind === 'full') return true;
      return readout.groups.includes(primary);
    };
    type Cand = {
      id: string;
      name: string;
      primary: MuscleGroup;
      secondary: MuscleGroup[];
      equipment: EquipmentId | null;
      day: TrainingDay | null;
    };
    const inSession = new Set(props.workout.exercises.map((e) => e.name.trim().toLowerCase()));
    const all: Cand[] = BUILT_IN_CATALOG.filter((c) => c.muscle !== 'cardio')
      .map((c) => ({
        id: c.id,
        name: c.names[li] ?? c.names[0],
        primary: c.muscle as MuscleGroup,
        secondary: secondaryMusclesOf(c),
        equipment: (c.equipment ?? null) as EquipmentId | null,
        day: exerciseDay(c.muscle as MuscleGroup),
      }))
      .filter((x) => !inSession.has(x.name.trim().toLowerCase()));
    const visible = all.filter(
      (x) =>
        (needle ? x.name.toLowerCase().includes(needle) : true) &&
        (muscle === undefined || x.primary === muscle || x.secondary.includes(muscle)) &&
        (equip === undefined || x.equipment === equip),
    );
    const targetSet = new Set(refGroups.map(([m]) => m));
    const suggestionScore = (x: Cand): number => {
      const rich = richExerciseById(x.id);
      let score = 0;
      if (targetSet.has(x.primary)) score += 80;
      for (const m of x.secondary) {
        if (targetSet.has(m)) score += 18;
      }
      if (rich?.category === 'strength') score += 18;
      else if (rich?.category === 'powerlifting') score += 10;
      else if (rich?.category === 'stretching') score -= 20;
      else if (rich?.category === 'plyometrics') score -= 8;
      if (rich?.level === 'beginner') score += 8;
      else if (rich?.level === 'intermediate') score += 5;
      else if (rich?.level === 'expert') score -= 8;
      if (
        x.equipment === 'body' ||
        x.equipment === 'dumbbell' ||
        x.equipment === 'barbell' ||
        x.equipment === 'cable' ||
        x.equipment === 'machine'
      ) {
        score += 4;
      }
      return score - x.name.length / 100;
    };
    const suggested = readout
      ? visible
          .filter((x) => matchesReadout(x.primary))
          .sort((a, b) => suggestionScore(b) - suggestionScore(a) || a.name.localeCompare(b.name))
          .slice(0, 4)
      : [];
    const suggestedIds = new Set(suggested.map((x) => x.id));
    const rest = visible
      .filter((x) => !suggestedIds.has(x.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const noneToSuggest =
      !!readout && suggested.length === 0 && !all.some((x) => matchesReadout(x.primary));

    const pick = (x: Cand) =>
      props.onPick(x.name, 'strength', {
        primaryMuscle: x.primary,
        secondaryMuscles: x.secondary,
        equipment: x.equipment ? [x.equipment] : [],
      });
    const row = (x: Cand, isSug: boolean) => (
      <button key={x.id} className={`add-row${isSug ? ' suggested' : ''}`} onClick={() => pick(x)}>
        <span className="add-main">
          <span className="add-name">{x.name}</span>
          <span className="add-tokens">
            <MuscleChip muscle={x.primary} tone="primary" />
            {x.secondary.map((m) => (
              <MuscleChip key={m} muscle={m} tone="secondary" />
            ))}
          </span>
        </span>
        {!isSug && x.day && <span className="add-day">{DAY_LABEL[x.day]}</span>}
      </button>
    );

    return (
      <Sheet onClose={props.onClose}>
        <div className="add-head">
          {readout && (
            <div className="add-banner">
              <div className="add-banner-title">{t.looksLikeDay(dayLabel)}</div>
              <div className="add-banner-reason">
                {from === 'logged'
                  ? t.reasonFromLogged
                  : from === 'program'
                    ? t.reasonProgramTarget
                    : from === 'weekday'
                      ? t.reasonUsualSplit(fmtWeekday(props.workout.startedAt, locale))
                      : t.reasonRecent}
              </div>
            </div>
          )}
          <button className="btn btn-primary add-done" onClick={props.onClose}>
            {t.pickerDone}
          </button>
        </div>
        <div className="searchbar">
          <Icon name="magnifying-glass" />
          <input
            autoFocus
            value={q}
            placeholder={t.searchExercises}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="searchbar-funnel"
            onClick={() => setFiltersOpen((x) => !x)}
            aria-label={t.filters}
          >
            <Icon name="funnel-simple" />
          </button>
        </div>
        {renderFilterPanel()}
        {renderActiveFilters()}
        <div className="kind-grid three">
          {TIMED_KINDS.map((id) => (
            <button
              key={id}
              className="kind-card"
              onClick={() => props.onPick(t.defaultTimedExerciseNames[id], id)}
            >
              <Icon name={id === 'cardio' ? 'timer' : id === 'warmup' ? 'flame' : 'clock'} />
              <span>{t.exerciseKindNames[id]}</span>
            </button>
          ))}
        </div>
        {noneToSuggest ? (
          <div className="add-note">{t.addedUsualLifts(dayLabel)}</div>
        ) : suggested.length > 0 ? (
          <div className="add-section">
            <div className="section-label">{t.suggestedLabel}</div>
            <div className="add-rows">{suggested.map((x) => row(x, true))}</div>
          </div>
        ) : null}
        <div className="add-section">
          <div className="section-label">{t.allExercisesLabel}</div>
          <div className="add-rows">{rest.map((x) => row(x, false))}</div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={props.onClose}>
      {props.replacing && <div className="sheet-label">{t.replaceExercise}</div>}
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          autoFocus
          value={q}
          placeholder={kind === 'strength' ? t.searchExercises : t.exerciseKindPlaceholders[kind]}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) {
              if (kind === 'strength' && !exact) setCreating(q.trim());
              else props.onPick(q.trim(), kind);
            }
          }}
        />
        {kind === 'strength' && (
          <button
            className="searchbar-funnel"
            onClick={() => setFiltersOpen((x) => !x)}
            aria-label={t.filters}
          >
            <Icon name="funnel-simple" />
          </button>
        )}
      </div>
      {/* One row of four large kind buttons. Strength opens the search below;
          Warm-up inserts a marker card; Cardio / Cool-down log a timed entry. */}
      <div className="kind-grid">
        <button
          className={`kind-card${kind === 'strength' ? ' active' : ''}`}
          onClick={() => setKind('strength')}
        >
          <Icon name="barbell" />
          <span>{t.exerciseKindNames.strength}</span>
        </button>
        {TIMED_KINDS.map((id) => (
          <button
            key={id}
            className="kind-card"
            onClick={() => props.onPick(t.defaultTimedExerciseNames[id], id)}
          >
            <Icon name={id === 'cardio' ? 'timer' : id === 'warmup' ? 'flame' : 'clock'} />
            <span>{t.exerciseKindNames[id]}</span>
          </button>
        ))}
      </div>
      {renderFilterPanel()}
      {renderActiveFilters()}
      {kind === 'strength' && totalCount > 0 && (
        <h6 className="pick-count">{t.nExercises(totalCount)}</h6>
      )}
      {kind === 'strength' && (
        <div className="pick-rows">
          {historyMatches.map((m) => {
            const missing = availability(m.info?.equipment ?? null);
            // My own logged exercise with no muscle/equipment data yet — offer to
            // tag it (opens the meta editor prefilled with its name).
            const untagged = !m.info;
            return (
              <div key={m.name} className={`pick-row-wrap${untagged ? ' taggable' : ''}`}>
                <button
                  className={`pick-row${missing ? ' unavailable' : ''}`}
                  onClick={() => props.onPick(m.name, kind)}
                >
                  {m.info && m.info.primary !== 'cardio' ? (
                    <MuscleIcon muscle={m.info.primary} variant="figure" tone="primary" />
                  ) : (
                    <span style={{ width: 13 }} />
                  )}
                  <span className="txt">
                    <span className="n">{m.name}</span>
                    {missing ? (
                      <span className="s warn">{t.noItemHere(t.equipmentNames[missing])}</span>
                    ) : m.info ? (
                      <span className="s">
                        {[m.info.primary, ...m.info.secondary]
                          .filter((x) => x !== 'cardio')
                          .map((x) => t.muscleGroups[x])
                          .join(' · ')}
                      </span>
                    ) : m.last ? (
                      <span className="s">{t.lastLift(fmtSet(m.last.weight, m.last.reps))}</span>
                    ) : null}
                  </span>
                  {m.info?.equipment && (
                    <span className="eq">
                      <Icon name={equipmentIconName(m.info.equipment)} />
                      {t.equipmentNames[m.info.equipment]}
                    </span>
                  )}
                </button>
                {untagged && (
                  <button
                    className="pick-row-edit"
                    aria-label={t.tagExercise}
                    title={t.tagExercise}
                    onClick={() => setCreating(m.name)}
                  >
                    <Icon name="pencil-simple" />
                  </button>
                )}
              </div>
            );
          })}
          {catalog.map((c) => {
            const name = c.names[li] ?? c.names[0];
            const missing = availability(c.equipment ?? null);
            const secondaries = secondaryMusclesOf(c);
            return (
              <button
                key={c.id}
                className={`pick-row${missing ? ' unavailable' : ''}`}
                onClick={() => props.onPick(name, kind)}
              >
                {c.muscle !== 'cardio' ? (
                  <MuscleIcon muscle={c.muscle} variant="figure" tone="primary" />
                ) : (
                  <span style={{ width: 13 }} />
                )}
                <span className="txt">
                  <span className="n">{name}</span>
                  {missing ? (
                    <span className="s warn">{t.noItemHere(t.equipmentNames[missing])}</span>
                  ) : c.muscle !== 'cardio' ? (
                    <span className="s">
                      {[c.muscle, ...secondaries].map((x) => t.muscleGroups[x]).join(' · ')}
                    </span>
                  ) : null}
                </span>
                {c.equipment && (
                  <span className="eq">
                    <Icon name={equipmentIconName(c.equipment)} />
                    {t.equipmentNames[c.equipment]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {q.trim() && !exact && (
        <button
          className="result-row create"
          onClick={() =>
            kind === 'strength' ? setCreating(q.trim()) : props.onPick(q.trim(), kind)
          }
        >
          <Icon name="plus" />
          {t.createExercise(q.trim())}
        </button>
      )}
      {kind === 'strength' && hasInventory && checkGym && (
        <p className="pick-hint">{t.filtersCombineNote}</p>
      )}
    </Sheet>
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
        <span className="t">{props.name}</span>
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
              <span className="n">{e.name}</span>
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

function SetEditorSheet(props: {
  exercise: Exercise;
  set: SetEntry | null;
  ghost: GhostValues;
  bandLibrary: readonly BandRung[];
  onSave: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onDelete?: () => void;
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
  const [type, setType] = useState<SetType>(props.set ? setTypeOf(props.set) : 'working');
  const [drops, setDropsState] = useState<DropEntry[]>(props.set?.drops ?? []);
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
  // Bodyweight = weight stored as null (pull-ups, dips, planks…).
  const [bw, setBw] = useState(props.set ? props.set.weight === null : false);
  const [holdSec, setHoldSec] = useState(
    props.set && setTypeOf(props.set) === 'static-dynamic' && props.set.durationMin != null
      ? Math.round(props.set.durationMin * 60)
      : 35,
  );
  const [openedAt] = useState(() => Date.now());
  const [focused, setFocused] = useState<'reps' | 'weight' | 'duration' | 'distance'>(
    timed ? 'duration' : 'weight',
  );
  // Plate calculator (Load-entry A): offered on barbell lifts to work out what
  // goes on the bar for the entered weight.
  const [plateOpen, setPlateOpen] = useState(false);
  const equip = equipmentFor(props.exercise);
  const isBarbell = equip.includes('barbell');
  // Per-exercise weight unit (Load-entry B): log in the unit the machine is
  // labelled in; storage stays canonical kg.
  const unitEligible =
    !timed && (isBarbell || equip.includes('dumbbell') || equip.includes('machine'));
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
            distanceKm: distanceKm > 0 ? distanceKm : null,
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
            type,
            drops: isDropType ? drops : [],
            durationMin: isSD ? holdSec / 60 : null,
            distanceKm: null,
            calories: null,
            rpe: null,
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
      <Sheet onClose={props.onClose}>
        <div className="sheet-head">
          <span className="t">{t.setN(idx, props.exercise.name)}</span>
        </div>
        {SET_TYPE_ROWS.map((row, i) => (
          <button
            key={row.type}
            className={`stype-row${i === SET_TYPE_ROWS.length - 1 ? ' last' : ''}`}
            onClick={() => {
              setType(row.type);
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
      </Sheet>
    );
  }

  // --- Load type (Load-entry C): weight · assist · band --------------------
  if (!timed && view === 'load') {
    return (
      <Sheet onClose={props.onClose}>
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
      </Sheet>
    );
  }

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">
          {timed ? t.entryN(idx, props.exercise.name) : t.setN(idx, props.exercise.name)}
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
              min={1}
              focused={focused === 'duration'}
              onFocus={() => setFocused('duration')}
              onChange={setDurationMin}
            />
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
          </div>
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
                  <span className="band-readout-lab">{t.bandLabel}</span>
                  <span
                    className="band-readout-val"
                    style={{ color: currentBand ? BAND_HEX[currentBand.color] : undefined }}
                  >
                    {currentBand
                      ? `${t.bandColor(currentBand.color)} · ~${fmtWeightValue(currentBand.kg)} ${t.kgCol.toLowerCase()}`
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="load-chips band-chips">
                {bandLib.map((r) => (
                  <button
                    key={r.color}
                    type="button"
                    className={`band-chip${currentBand?.color === r.color ? ' on' : ''}`}
                    onClick={() => setWeight(r.kg)}
                  >
                    <span className="band-dot" style={{ background: BAND_HEX[r.color] }} />
                    {t.bandColor(r.color)}
                  </button>
                ))}
              </div>
              <div className="load-note">{t.bandNote}</div>
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
          {unitEligible && !isAssist && !isBand && !bw && (
            <div className="toggle-row unit-row">
              <Icon name="scales" />
              <span className="lab">{t.unitLabel}</span>
              <div className="seg2 unit-seg">
                {(['kg', 'lb'] as DisplayUnit[]).map((u) => (
                  <button key={u} className={unit === u ? 'active' : ''} onClick={() => setUnit(u)}>
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
          <button className="toggle-row" onClick={() => setView('load')}>
            <Icon name={isAssist ? 'scales' : isBand ? 'wave-sine' : 'barbell'} />
            <span className="lab">{t.loadTypeLabel}</span>
            <span className="toggle-value">
              {isAssist ? t.loadAssist : isBand ? t.loadBand : t.loadWeight}
            </span>
          </button>
          <button className="toggle-row" onClick={() => setView('type')}>
            <Icon
              name={
                type === 'working'
                  ? 'equals'
                  : type === 'warmup'
                    ? 'fire'
                    : type === 'drop'
                      ? 'caret-line-down'
                      : type === 'reverse-drop'
                        ? 'caret-line-up'
                        : 'wave-sine'
              }
            />
            <span className="lab">{t.setTypeLabel}</span>
            <span className="toggle-value">{typeMeta[type].name}</span>
          </button>
        </>
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
    </Sheet>
  );
}
