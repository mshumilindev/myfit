/** Live session + past workout editing — design S-17…S-31. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Shell } from '../App';
import type { Exercise, ExerciseKind, SetEntry, Workout } from '../types';
import {
  addExercise,
  clearSets,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  duplicateExercise,
  est1rm,
  exerciseKind,
  finishWorkoutClean,
  isStrengthExercise,
  isTimedExercise,
  knownExercises,
  prevLift,
  recordWeight,
  renameExercise,
  reopenWorkout,
  restoreExercise,
  restoreSet,
  topSet,
  upsertSet,
  useStore,
  workoutCardioDistanceKm,
  workoutCardioMinutes,
  workoutSets,
  workoutVolumeKg,
  reorderExercises,
} from '../store';
import { LiveHero } from '../components/LiveHero';
import { GymThumb } from '../components/GymThumb';
import { EquipmentIcon, EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import {
  fmtClock,
  fmtDayMonth,
  fmtDurationHM,
  fmtFullDate,
  fmtKg,
  fmtSessionClock,
  fmtSet,
  fmtSetSnack,
  fmtTonnes,
  useT,
} from '../i18n';
import { ConfirmDialog, Dialog, EmptyState, Icon, Sheet, Switch } from '../ui';
import { LOCALE_IDS } from '../i18n';
import { searchCatalog } from '../data/exercises';

const TIMED_KINDS: ExerciseKind[] = ['warmup', 'cardio', 'cooldown'];

type SheetState =
  | { kind: 'add' }
  | {
      kind: 'edit';
      exId: string;
      set: SetEntry | null;
      ghost: { reps: number; weight: number | null };
    }
  | { kind: 'menu'; exId: string }
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
  const workout = store.workouts.find((w) => w.id === props.workoutId);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [summary, setSummary] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
    if (s.isWarmup || (s.weight ?? 0) <= 0) return false;
    const base = baseline.get(ex.name.toLowerCase()) ?? 0;
    if ((s.weight ?? 0) <= base) return false;
    const best = topSet(ex.sets);
    return best?.id === s.id;
  }

  function logGhost(ex: Exercise, v: { reps: number; weight: number | null }): void {
    const base = Math.max(
      baseline.get(ex.name.toLowerCase()) ?? 0,
      ...ex.sets.filter((s) => !s.isWarmup).map((s) => s.weight ?? 0),
    );
    upsertSet(workout!.id, ex.id, { reps: v.reps, weight: v.weight, isWarmup: false });
    if (v.weight !== null && v.weight > base && base > 0) {
      props.shell.toast({
        kind: 'ok',
        icon: 'trophy',
        text: t.newRecordToast(ex.name, `${v.weight} kg × ${v.reps}`),
      });
    }
  }

  function logTimedGhost(
    ex: Exercise,
    v: { durationMin: number; distanceKm: number | null },
  ): void {
    const kind = exerciseKind(ex);
    upsertSet(workout!.id, ex.id, {
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
    const empty = workout!.exercises.find((e) => e.sets.length === 0);
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

          {prescribedSets > 0 && (
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
                  className="link danger-link"
                  style={{ marginTop: 'var(--space-2)' }}
                  onClick={() => setDialog({ kind: 'del-workout' })}
                >
                  {t.discardSession}
                </button>
              </EmptyState>
            </div>
          ) : (
            <>
              {sortedExercises.map((ex) => {
                const ghost = ghostFor(ex);
                const timedGhost = timedGhostFor(ex);
                const prev = prevLift(ex.name, workout.id);
                const kind = exerciseKind(ex);
                const timed = isTimedExercise(ex);
                const planned = Math.max(0, ex.plannedSets ?? 0);
                const completed = planned > 0 && ex.sets.length >= planned;
                const directLogBlocked = !timed && planned > 0 && ghost.weight === null;
                return (
                  <div
                    key={ex.id}
                    className={`exercise-card${completed ? ' completed' : ''}${activeExerciseId === ex.id ? ' active' : ''}${timed ? ' timed-card' : ''}${ex.sets.length === 0 ? ' empty-card' : ''}`}
                    onDragOver={(e) => {
                      if (dragId.current && dragId.current !== ex.id) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragId.current;
                      dragId.current = null;
                      if (!from || from === ex.id) return;
                      const ids = [...workout.exercises]
                        .sort((a, b) => a.position - b.position)
                        .map((x) => x.id);
                      const fi = ids.indexOf(from);
                      const ti = ids.indexOf(ex.id);
                      if (fi < 0 || ti < 0) return;
                      ids.splice(ti, 0, ids.splice(fi, 1)[0]);
                      reorderExercises(workout.id, ids);
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
                              if (renameVal.trim())
                                renameExercise(workout.id, ex.id, renameVal.trim());
                              setRenaming(null);
                            }}
                          >
                            {t.save}
                          </button>
                        </>
                      ) : (
                        <>
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
                          <button
                            className="name"
                            onClick={() =>
                              props.shell.openOverlay({
                                screen: 'exercise-history',
                                name: ex.name,
                              })
                            }
                          >
                            {ex.name}
                          </button>
                          {timed && <span className="prev">{t.exerciseKindNames[kind]}</span>}
                          {!timed && prev && (
                            <span className="prev">{t.prev(fmtSet(prev.weight, prev.reps))}</span>
                          )}
                          {planned > 0 && (
                            <span
                              className={`plan-count${ex.sets.length >= planned ? ' done' : ''}`}
                            >
                              {ex.sets.length} / {planned}
                            </span>
                          )}
                          {(ex.equipment ?? []).slice(0, 3).map((id) => (
                            <span key={id} className="exercise-equipment">
                              <EquipmentIcon equipment={id as EquipmentId} />
                            </span>
                          ))}
                          <button
                            className="dots"
                            onClick={() => setSheet({ kind: 'menu', exId: ex.id })}
                            aria-label={t.menuAction}
                          >
                            <Icon name="dots-three-vertical" />
                          </button>
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
                    {timed ? (
                      <>
                        <div className="set-grid header timed">
                          <span>#</span>
                          <span>{t.durationMinCol}</span>
                          <span>{t.distanceKmCol}</span>
                          <span>{t.rpeShort}</span>
                        </div>
                        <div style={renaming === ex.id ? { opacity: 0.6 } : undefined}>
                          {[...ex.sets]
                            .sort((a, b) => a.position - b.position)
                            .map((s, i) => (
                              <button
                                key={s.id}
                                className="set-row timed"
                                onClick={() =>
                                  setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })
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
                                setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })
                              }
                            >
                              {timedGhost.durationMin}
                            </button>
                            <button
                              className="gval"
                              onClick={() =>
                                setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })
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
                        <div className="set-grid header">
                          <span>#</span>
                          <span>{t.repsCol}</span>
                          <span>{t.kgCol}</span>
                          <span />
                        </div>
                        <div style={renaming === ex.id ? { opacity: 0.6 } : undefined}>
                          {[...ex.sets]
                            .sort((a, b) => a.position - b.position)
                            .map((s, i) => {
                              const rec = isRecordSet(ex, s);
                              return (
                                <button
                                  key={s.id}
                                  className={`set-row${s.isWarmup ? ' warm' : ''}${rec ? ' record' : ''}`}
                                  onClick={() =>
                                    setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })
                                  }
                                >
                                  <span className="idx">{i + 1}</span>
                                  <span className="val">{s.reps}</span>
                                  <span className="val">{s.weight ?? t.bodyweightShort}</span>
                                  <span className="kind">
                                    {rec ? t.record : s.isWarmup ? t.warmup : t.working}
                                  </span>
                                </button>
                              );
                            })}
                          <div className="ghost-row">
                            <span className="idx">{ex.sets.length + 1}</span>
                            <button
                              className="gval"
                              onClick={() =>
                                setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })
                              }
                            >
                              {ghost.reps}
                            </button>
                            <button
                              className="gval"
                              onClick={() =>
                                setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })
                              }
                            >
                              {ghost.weight ?? '—'}
                            </button>
                            <button
                              className="btn btn-primary log-btn"
                              disabled={directLogBlocked}
                              onClick={() => logGhost(ex, ghost)}
                            >
                              {props.past ? t.add : t.log}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    {ex.sets.length === 0 && live && (
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
              })}
              <button
                className="btn btn-secondary"
                style={{ minHeight: 44, fontSize: 14, gap: 8 }}
                onClick={() => setSheet({ kind: 'add' })}
              >
                <Icon name="plus" />
                {props.past ? t.addToSession : t.addExercise}
              </button>
              {(props.past || live) && !workout.autoFinished && (
                <button
                  className="link danger-link"
                  style={{ padding: '6px 0', textAlign: 'left' }}
                  onClick={() => setDialog({ kind: 'del-workout' })}
                >
                  {live ? t.discardSession : t.deleteWorkout}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {showSessionSide && (
        <aside className="pane-side desktop-only session-side">
          {gym && (
            <div className="session-gym-card">
              <div className="session-gym-photo">
                <GymThumb name={gym.name} lat={gym.lat} lng={gym.lng} size={320} />
              </div>
              <div className="session-gym-copy">
                <div className="section-label">{gym.name}</div>
                <div className="session-side-meta">
                  {fmtClock(workout.startedAt)} · {t.inside}
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
          onPick={(name, kind) => {
            addExercise(workout.id, name, kind);
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
          onSave={(vals) => {
            const ex = workout.exercises.find((e) => e.id === sheet.exId)!;
            if (sheet.set) {
              upsertSet(workout.id, ex.id, { ...vals, id: sheet.set.id });
            } else {
              logGhost(ex, { reps: vals.reps, weight: vals.weight });
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

function AddExerciseSheet(props: {
  workout: Workout;
  onPick: (name: string, kind: ExerciseKind) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [equip, setEquip] = useState<EquipmentId | undefined>(undefined);
  const known = useMemo(() => knownExercises(), []);
  const needle = q.trim().toLowerCase();
  const matches =
    kind === 'strength' && needle
      ? known.filter((k) => k.name.toLowerCase().includes(needle))
      : kind === 'strength'
        ? known.slice(0, 6)
        : [];
  const exact = kind === 'strength' && known.some((k) => k.name.toLowerCase() === needle);
  // Built-in catalog (searchable in all five languages); history ranks first.
  // An equipment chip narrows the catalog and also allows browsing with an
  // empty query (e.g. "show me everything for bands").
  const li = LOCALE_IDS.indexOf(locale);
  const catalog =
    kind === 'strength' && (needle || equip !== undefined)
      ? searchCatalog(needle, equip !== undefined ? 14 : 8, equip).filter(
          (c) =>
            !matches.some((m) => c.names.some((n) => n.toLowerCase() === m.name.toLowerCase())),
        )
      : [];

  return (
    <Sheet onClose={props.onClose}>
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          autoFocus
          value={q}
          placeholder={kind === 'strength' ? t.addExercise : t.exerciseKindPlaceholders[kind]}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) props.onPick(q.trim(), kind);
          }}
        />
      </div>
      <div className="equip-chips exercise-kind-chips">
        {(['strength', ...TIMED_KINDS] as ExerciseKind[]).map((id) => (
          <button
            key={id}
            className={`equip-chip${kind === id ? ' active' : ''}`}
            onClick={() => setKind(id)}
          >
            <Icon name={id === 'strength' ? 'barbell' : id === 'cardio' ? 'timer' : 'flame'} />
            {t.exerciseKindNames[id]}
          </button>
        ))}
      </div>
      {kind === 'strength' && (
        <div className="equip-chips">
          <button
            className={`equip-chip${equip === undefined ? ' active' : ''}`}
            onClick={() => setEquip(undefined)}
          >
            {t.equipmentAll}
          </button>
          {EQUIPMENT_IDS.map((id) => (
            <button
              key={id}
              className={`equip-chip${equip === id ? ' active' : ''}`}
              onClick={() => setEquip((x) => (x === id ? undefined : id))}
            >
              <EquipmentIcon equipment={id} />
              {t.equipmentNames[id]}
            </button>
          ))}
        </div>
      )}
      {kind !== 'strength' && (
        <div className="quick-add-grid">
          {TIMED_KINDS.map((id) => (
            <button
              key={id}
              className="quick-add-card"
              onClick={() => props.onPick(t.defaultTimedExerciseNames[id], id)}
            >
              <Icon name={id === 'cardio' ? 'timer' : id === 'warmup' ? 'flame' : 'clock'} />
              <span>{t.defaultTimedExerciseNames[id]}</span>
            </button>
          ))}
        </div>
      )}
      {matches.length > 0 && (
        <div>
          <div className="sheet-label" style={{ padding: '8px 4px 2px' }}>
            {t.matches}
          </div>
          {matches.map((m) => {
            const idx = needle ? m.name.toLowerCase().indexOf(needle) : -1;
            return (
              <button
                key={m.name}
                className="result-row"
                onClick={() => props.onPick(m.name, kind)}
              >
                <span>
                  {idx >= 0 ? (
                    <>
                      {m.name.slice(0, idx)}
                      <span className="hl">{m.name.slice(idx, idx + needle.length)}</span>
                      {m.name.slice(idx + needle.length)}
                    </>
                  ) : (
                    m.name
                  )}
                </span>
                {m.last && (
                  <span className="last">{t.lastLift(fmtSet(m.last.weight, m.last.reps))}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {catalog.length > 0 && (
        <div>
          {matches.length === 0 && (
            <div className="sheet-label" style={{ padding: '8px 4px 2px' }}>
              {t.matches}
            </div>
          )}
          {catalog.map((c) => {
            const name = c.names[li] ?? c.names[0];
            const idx = name.toLowerCase().indexOf(needle);
            return (
              <button key={c.id} className="result-row" onClick={() => props.onPick(name, kind)}>
                <span>
                  {idx >= 0 ? (
                    <>
                      {name.slice(0, idx)}
                      <span className="hl">{name.slice(idx, idx + needle.length)}</span>
                      {name.slice(idx + needle.length)}
                    </>
                  ) : (
                    name
                  )}
                </span>
                <span className="last">
                  {c.equipment && (
                    <span className="equip-tag">
                      <EquipmentIcon equipment={c.equipment} />
                      {t.equipmentNames[c.equipment]}
                    </span>
                  )}
                  {t.muscleGroups[c.muscle]}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {q.trim() && !exact && (
        <button className="result-row create" onClick={() => props.onPick(q.trim(), kind)}>
          <Icon name="plus" />
          {t.createExercise(q.trim())}
        </button>
      )}
    </Sheet>
  );
}

// --- Set editor sheet (S-21) -----------------------------------------------

function SetEditorSheet(props: {
  exercise: Exercise;
  set: SetEntry | null;
  ghost: { reps: number; weight: number | null };
  onSave: (vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const timed = isTimedExercise(props.exercise);
  const kind = exerciseKind(props.exercise);
  const [reps, setReps] = useState(props.set?.reps ?? props.ghost.reps);
  const [weight, setWeight] = useState(props.set?.weight ?? props.ghost.weight ?? 0);
  const [durationMin, setDurationMin] = useState(
    props.set?.durationMin ?? props.exercise.plannedDurationMin ?? (kind === 'cardio' ? 20 : 8),
  );
  const [distanceKm, setDistanceKm] = useState(props.set?.distanceKm ?? 0);
  const [calories, setCalories] = useState(props.set?.calories ?? 0);
  const [rpe, setRpe] = useState(props.set?.rpe ?? 0);
  // Bodyweight = weight stored as null (pull-ups, dips, planks…).
  const [bw, setBw] = useState(props.set ? props.set.weight === null : false);
  const [warm, setWarm] = useState(props.set?.isWarmup ?? false);
  const [openedAt] = useState(() => Date.now());
  const [focused, setFocused] = useState<'reps' | 'weight' | 'duration' | 'distance'>(
    timed ? 'duration' : 'weight',
  );
  const idx = props.set
    ? [...props.exercise.sets]
        .sort((a, b) => a.position - b.position)
        .findIndex((s) => s.id === props.set!.id) + 1
    : props.exercise.sets.length + 1;

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
            <div
              className={`stepper${focused === 'duration' ? ' focused' : ''}`}
              onClick={() => setFocused('duration')}
            >
              <div className="lab">{t.durationMinutes}</div>
              <div className="row">
                <button onClick={() => setDurationMin((v) => Math.max(1, v - 1))}>−</button>
                <span className="val">{durationMin}</span>
                <button onClick={() => setDurationMin((v) => v + 1)}>+</button>
              </div>
            </div>
            <div
              className={`stepper${focused === 'distance' ? ' focused' : ''}`}
              onClick={() => setFocused('distance')}
            >
              <div className="lab">{t.distanceKm}</div>
              <div className="row">
                <button onClick={() => setDistanceKm((v) => Math.max(0, +(v - 0.1).toFixed(1)))}>
                  −
                </button>
                <span className="val">{distanceKm}</span>
                <button onClick={() => setDistanceKm((v) => +(v + 0.1).toFixed(1))}>+</button>
              </div>
            </div>
          </div>
          <div className="steppers secondary-steppers">
            <div className="stepper">
              <div className="lab">{t.calories}</div>
              <div className="row">
                <button onClick={() => setCalories((v) => Math.max(0, v - 10))}>−</button>
                <span className="val">{calories}</span>
                <button onClick={() => setCalories((v) => v + 10)}>+</button>
              </div>
            </div>
            <div className="stepper">
              <div className="lab">{t.rpe}</div>
              <div className="row">
                <button onClick={() => setRpe((v) => Math.max(0, +(v - 0.5).toFixed(1)))}>−</button>
                <span className="val">{rpe}</span>
                <button onClick={() => setRpe((v) => Math.min(10, +(v + 0.5).toFixed(1)))}>
                  +
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="steppers">
            <div
              className={`stepper${focused === 'reps' ? ' focused' : ''}`}
              onClick={() => setFocused('reps')}
            >
              <div className="lab">{t.reps}</div>
              <div className="row">
                <button onClick={() => setReps((r) => Math.max(1, r - 1))}>−</button>
                <span className="val">{reps}</span>
                <button onClick={() => setReps((r) => r + 1)}>+</button>
              </div>
            </div>
            <div
              className={`stepper${focused === 'weight' ? ' focused' : ''}${bw ? ' disabled' : ''}`}
              onClick={() => !bw && setFocused('weight')}
            >
              <div className="lab">{t.weightKg}</div>
              <div className="row">
                {bw ? (
                  <span className="val">{t.bodyweightShort}</span>
                ) : (
                  <>
                    <button onClick={() => setWeight((w) => Math.max(0, +(w - 2.5).toFixed(2)))}>
                      −
                    </button>
                    <span className="val">{weight}</span>
                    <button onClick={() => setWeight((w) => +(w + 2.5).toFixed(2))}>+</button>
                  </>
                )}
              </div>
            </div>
          </div>
          <button className="toggle-row" onClick={() => setBw((x) => !x)}>
            <Icon name="barbell" />
            <span className="lab">{t.bodyweightSet}</span>
            <Switch on={bw} />
          </button>
          <button className="toggle-row" onClick={() => setWarm((x) => !x)}>
            <Icon name="flame" />
            <span className="lab">{t.warmupSet}</span>
            <Switch on={warm} />
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
        <button
          className="btn btn-primary grow"
          onClick={() =>
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
                    isWarmup: warm,
                    durationMin: null,
                    distanceKm: null,
                    calories: null,
                    rpe: null,
                  },
            )
          }
        >
          {props.set ? t.save : t.log}
        </button>
      </div>
    </Sheet>
  );
}
