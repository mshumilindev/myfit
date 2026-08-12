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
  nextSupersetLetter,
  prevLift,
  recordWeight,
  renameExercise,
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
  reorderExercises,
  type SupersetGroup,
} from '../store';
import { LiveHero } from '../components/LiveHero';
import { GymPicker } from '../components/GymPicker';
import { GymThumb } from '../components/GymThumb';
import {
  EquipChip,
  MuscleChip,
  MuscleIcon,
  MuscleSetChip,
  MUSCLE_IDS,
  equipmentIconName,
} from '../components/Muscle';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { describeDay, exerciseDay, type TrainingDay } from '../data/daySuggest';
import { muscleInfoByName, secondaryMusclesOf, type MuscleGroup } from '../data/exercises';
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
import { CURATED, searchCatalog } from '../data/exercises';
import { getRole } from '../api';

const TIMED_KINDS: ExerciseKind[] = ['warmup', 'cardio', 'cooldown'];

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
  | { kind: 'group-menu'; groupId: string }
  | { kind: 'superset'; exId: string }
  | { kind: 'gym' }
  | null;

type DialogState =
  | { kind: 'del-ex'; exId: string }
  | { kind: 'finish-warn'; emptyName: string }
  | { kind: 'del-workout' }
  | null;

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
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [summary, setSummary] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** Past workout cards start collapsed for reading (SS-3). */
  const [expandedPast, setExpandedPast] = useState<string[]>([]);
  /** The set logged most recently in this visit — its row reads “just now”. */
  const [recentSetId, setRecentSetId] = useState<string | null>(null);
  /** Planned-but-untouched exercises the user tapped open (SS-1 queue rows). */
  const [wokenIds, setWokenIds] = useState<string[]>([]);
  const isDesktop = useIsDesktop();
  const startAddConsumed = useRef(false);

  const live = !!workout && workout.finishedAt === null && !props.past;

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!props.startAdd || startAddConsumed.current || !workout) return;
    startAddConsumed.current = true;
    setSheet({ kind: 'add' });
  }, [props.startAdd, workout]);

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
  const activeExerciseId =
    sortedExercises.find((ex) => {
      if (isMarkerExercise(ex)) return false;
      const planned = Math.max(0, ex.plannedSets ?? 0);
      return planned > 0 ? ex.sets.length < planned : ex.sets.length === 0;
    })?.id ??
    sortedExercises[0]?.id ??
    null;
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
    if (type === 'working' && vals.weight !== null && vals.weight > base && base > 0) {
      props.shell.toast({
        kind: 'ok',
        icon: 'trophy',
        text: t.newRecordToast(ex.name, `${vals.weight} kg × ${vals.reps}`),
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
    const w = top.weight === null ? t.bodyweightShort : `${top.weight} kg`;
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
    const showChips = !timed && !marker && (muscles.primary !== null || equipment.length > 0);
    const groupDone = grp !== null && ex.sets.length >= grp.round;
    const showGhost = !grp || grp.active;
    const rowCls = grp ? ' rrow' : '';
    const sortedSets = [...ex.sets].sort((a, b) => a.position - b.position);
    return (
      <div
        key={ex.id}
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
            {muscles.primary && <MuscleChip muscle={muscles.primary} tone="primary" />}
            {muscles.secondary.map((m) => (
              <MuscleChip key={m} muscle={m} tone="secondary" />
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
            </div>
          </>
        ) : (
          <>
            {!grp && (
              <div className="set-grid header">
                <span>#</span>
                <span>{t.repsCol}</span>
                <span>{isDesktop ? t.weightCol : t.kgCol}</span>
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
                const row = (
                  <button
                    key={drops.length > 0 ? undefined : s.id}
                    className={`set-row${rowCls}${type === 'warmup' ? ' warm' : ''}${
                      rec ? ' record' : ''
                    }`}
                    onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })}
                  >
                    <span className="idx">{idx}</span>
                    <span className="val">{s.reps}</span>
                    <span className="val">
                      {s.weight === null
                        ? t.bodyweightShort
                        : isDesktop
                          ? `${s.weight} kg`
                          : s.weight}
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
                if (drops.length === 0) return row;
                return (
                  <div key={s.id} className="set-wrap">
                    {row}
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
                                  ? `${d.weight} kg`
                                  : d.weight}
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
                    {ghost.weight ?? '—'}
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

  function requestFinish(): void {
    const empty = workout!.exercises.find((e) => e.sets.length === 0 && !isMarkerExercise(e));
    if (empty) {
      setDialog({ kind: 'finish-warn', emptyName: empty.name });
    } else {
      doFinish();
    }
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
        const vol = e.sets.reduce((s, x) => s + (x.weight ?? 0) * x.reps, 0);
        const prevEx = prevW.exercises.find((p) => p.name.toLowerCase() === e.name.toLowerCase());
        const prevVol = prevEx ? prevEx.sets.reduce((s, x) => s + (x.weight ?? 0) * x.reps, 0) : 0;
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
              {fmtDurationHM((workout.finishedAt ?? Date.now()) - workout.startedAt)}
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
        {suggestOn &&
          (() => {
            const entries = [...muscleSetsInWorkout(workout).entries()]
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) return null;
            return (
              <div className="muscles-worked">
                <div className="section-label">{t.muscleGroupsWorked}</div>
                <div className="mworked-row">
                  {entries.map(([m, n]) => (
                    <MuscleSetChip key={m} muscle={m} count={n} />
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
              {prSet.e.name} · {prSet.s.weight} kg × {prSet.s.reps}
            </div>
            <div className="sub">
              {t.prevBest(
                `${baseline.get(prSet.e.name.toLowerCase()) ?? 0} kg`,
                est1rm(prSet.s.weight ?? 0, prSet.s.reps),
              )}
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
        <div className="sheet-actions" style={{ marginTop: 'auto' }}>
          <button className="btn btn-secondary grow" onClick={() => setSummary(false)}>
            {t.editSession}
          </button>
          <button className="btn btn-primary grow" onClick={props.onClose}>
            {t.done}
          </button>
        </div>
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
      className={`screen paned session-screen${live ? ' session-live' : ''}${props.past ? ' session-past' : ''}${workout.autoFinished ? ' session-auto' : ''}${showSessionSide ? ' session-has-side' : ''}`}
    >
      <div className="pane-main">
        <div className={`session-top${live ? ' live-toolbar' : ''}`}>
          {live && (
            <LiveHero
              workout={workout}
              gym={gym}
              gyms={store.gyms}
              offline={store.syncStatus === 'offline'}
              queued={store.queue.length}
              mode="session"
              actions={
                <button
                  className="btn btn-secondary"
                  disabled={entries === 0}
                  onClick={requestFinish}
                >
                  {t.finish}
                </button>
              }
            />
          )}
          <button className="back" onClick={props.onClose} aria-label={t.backAction}>
            <Icon name="caret-left" />
          </button>
          {!live && (
            <div className="mid">
              <div className="kicker">{kicker}</div>
              {workout.finishedAt === null ? (
                <div className="clock">
                  {fmtSessionClock((workout.finishedAt ?? now) - workout.startedAt)}
                </div>
              ) : (
                <div className="title">{fmtDayMonth(workout.startedAt, locale)}</div>
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

        {suggestOn &&
          (() => {
            const counts = muscleSetsInWorkout(workout);
            const entries = [...counts.entries()]
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) return null;
            return (
              <div className="muscles-worked">
                <div className="section-label">
                  {props.past ? t.muscleGroupsWorked : t.musclesWorkedLabel}
                </div>
                <div className="mworked-row">
                  {entries.map(([m, n]) => (
                    <MuscleSetChip key={m} muscle={m} count={n} />
                  ))}
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
                                      {prevL ? `${prevL.reps} × ${prevL.weight ?? '—'}` : '—'}
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
              {props.past && workout.exercises.some((e) => e.groupId) && (
                <div className="muscle-note" style={{ boxShadow: 'none' }}>
                  <Icon name="chart-line-up" />
                  <p style={{ color: 'var(--color-neutral-500)' }}>{t.supersetHistoryNote}</p>
                </div>
              )}
              <button
                className="btn btn-secondary session-add-btn"
                onClick={() => setSheet({ kind: 'add' })}
              >
                <Icon name="plus" />
                {props.past ? t.addToSession : t.addExercise}
              </button>
              {live && !workout.autoFinished && (
                <div className="session-discard-row">
                  <button
                    className="btn session-discard-btn"
                    onClick={() => setDialog({ kind: 'del-workout' })}
                  >
                    <Icon name="trash" />
                    {t.discardSession}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
                {r.prev!.weight !== null ? ` · ${r.prev!.weight} kg` : ''}
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
          suggestions={suggestOn}
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
            // Day-aware strength suggestions stay open for multiple adds; timed
            // one-off rows are complete after the pick.
            if (!suggestOn || kind !== 'strength') setSheet(null);
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
                onClick={() => {
                  setRenaming(ex.id);
                  setRenameVal(ex.name);
                  setSheet(null);
                }}
              >
                <Icon name="pencil-simple" />
                {t.rename}
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
          {t.finishEmptyWarning(
            dialog.emptyName,
            sets,
            fmtTonnes(volume),
            fmtDayMonth(workout.startedAt, locale),
          )}
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

  // --- Day-aware picker (Ex suggestions, AC-1) -----------------------------
  if (props.suggestions) {
    // Read the day from the muscle GROUPS trained — never a hardcoded guess:
    //   • one dominant group        → name it ("Back"),
    //   • several in one split       → the split ("Pull"),
    //   • several across splits      → the actual groups ("Shoulders + Back"),
    //   • many groups                → full body.
    // Reference: this session's own logged exercises, else the most recent
    // session on this weekday, else the most recent session overall. Groups are
    // ordered by the exercise trained first, so the main lift leads the label.
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
    let refGroups = orderedGroups(props.workout, true);
    let from: 'logged' | 'weekday' | 'overall' | null = refGroups.length ? 'logged' : null;
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
    const dayLabel = !readout
      ? ''
      : readout.kind === 'split'
        ? DAY_LABEL[readout.split]
        : readout.kind === 'full'
          ? t.dayFull
          : readout.groups.map((m) => t.muscleGroups[m]).join(' + ');
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
    const all: Cand[] = CURATED.filter((c) => c.muscle !== 'cardio')
      .map((c) => ({
        id: c.id,
        name: c.names[li] ?? c.names[0],
        primary: c.muscle as MuscleGroup,
        secondary: secondaryMusclesOf(c),
        equipment: (c.equipment ?? null) as EquipmentId | null,
        day: exerciseDay(c.muscle as MuscleGroup),
      }))
      .filter((x) => !inSession.has(x.name.trim().toLowerCase()));
    const visible = needle ? all.filter((x) => x.name.toLowerCase().includes(needle)) : all;
    const suggested = readout ? visible.filter((x) => matchesReadout(x.primary)).slice(0, 4) : [];
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
        </div>
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
      {kind === 'strength' && filtersOpen && (
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
      )}
      {kind === 'strength' && !filtersOpen && (muscle || equip) && (
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
      )}
      {kind === 'strength' && totalCount > 0 && (
        <h6 className="pick-count">{t.nExercises(totalCount)}</h6>
      )}
      {kind === 'strength' && (
        <div className="pick-rows">
          {historyMatches.map((m) => {
            const missing = availability(m.info?.equipment ?? null);
            return (
              <button
                key={m.name}
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
  onSave: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const timed = isTimedExercise(props.exercise);
  const kind = exerciseKind(props.exercise);
  const [view, setView] = useState<'main' | 'type'>('main');
  const [type, setType] = useState<SetType>(props.set ? setTypeOf(props.set) : 'working');
  const [drops, setDropsState] = useState<DropEntry[]>(props.set?.drops ?? []);
  const [reps, setReps] = useState(props.set?.reps ?? props.ghost.reps);
  const [weight, setWeight] = useState(props.set?.weight ?? props.ghost.weight ?? 0);
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
  const [openedAt] = useState(() => Date.now());
  const [focused, setFocused] = useState<'reps' | 'weight' | 'duration' | 'distance'>(
    timed ? 'duration' : 'weight',
  );
  const idx = props.set
    ? [...props.exercise.sets]
        .sort((a, b) => a.position - b.position)
        .findIndex((s) => s.id === props.set!.id) + 1
    : props.exercise.sets.length + 1;
  const isDropType = type === 'drop' || type === 'reverse-drop';
  const dropRepsTotal = reps + drops.reduce((n, d) => n + d.reps, 0);
  const dropKgTotal =
    (bw ? 0 : weight) * reps + drops.reduce((v, d) => v + (d.weight ?? 0) * d.reps, 0);

  const typeMeta: Record<SetType, { name: string; hint: string }> = {
    working: { name: t.setTypeWorking, hint: '' },
    warmup: { name: t.setTypeWarmup, hint: t.excludedFromVolume },
    drop: { name: t.setTypeDrop, hint: t.weightFalls },
    'reverse-drop': { name: t.setTypeReverse, hint: t.weightClimbs },
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
            reps,
            weight: bw ? null : weight,
            isWarmup: type === 'warmup',
            type,
            drops: isDropType ? drops : [],
            durationMin: null,
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
          label={t.weightKg}
          value={partWeight ?? 0}
          step={2.5}
          min={0}
          decimals={2}
          focused={focusKey === 'weight'}
          disabled={bw}
          placeholder={t.bodyweightShort}
          onFocus={() => setFocused('weight')}
          onChange={onWeight}
        />
      </div>
    );
  }

  // --- DS-1: the four types, one list --------------------------------------
  if (!timed && view === 'type') {
    return (
      <Sheet onClose={() => setView('main')}>
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
          {isDropType ? (
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
          ) : (
            strengthSteppers(
              reps,
              bw ? null : weight,
              setReps,
              setWeight,
              focused === 'reps' || focused === 'weight' ? focused : null,
            )
          )}
          <button className="toggle-row" onClick={() => setBw((x) => !x)}>
            <Icon name="barbell" />
            <span className="lab">{t.bodyweightSet}</span>
            <Switch on={bw} />
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
                      : 'caret-line-up'
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
    </Sheet>
  );
}
