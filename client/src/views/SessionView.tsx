/** Live session + past workout editing — design S-17…S-31. */
import { useEffect, useMemo, useState } from 'react';
import type { Shell } from '../App';
import type { Exercise, SetEntry, Workout } from '../types';
import {
  addExercise,
  clearSets,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  duplicateExercise,
  est1rm,
  finishWorkoutClean,
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
  workoutSets,
  workoutVolumeKg,
} from '../store';
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
import { Dialog, EmptyState, Icon, LanguageSelector, Sheet, Switch } from '../ui';

const REST_SECONDS = 90;

type SheetState =
  | { kind: 'add' }
  | { kind: 'edit'; exId: string; set: SetEntry | null; ghost: { reps: number; weight: number } }
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
  shell: Shell;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const store = useStore();
  const workout = store.workouts.find((w) => w.id === props.workoutId);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [summary, setSummary] = useState(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const live = !!workout && workout.finishedAt === null && !props.past;

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Records BEFORE this workout, per exercise name — for PR detection.
  const baseline = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of workout?.exercises ?? []) {
      const key = e.name.toLowerCase();
      if (!m.has(key)) m.set(key, recordWeight(e.name, props.workoutId));
    }
    return m;
  }, [workout?.exercises.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!workout) return null;

  const sets = workoutSets(workout);
  const volume = workoutVolumeKg(workout);
  const gymName = store.gyms[0]?.name;

  function ghostFor(ex: Exercise): { reps: number; weight: number } {
    const last = ex.sets[ex.sets.length - 1];
    if (last && !last.isWarmup) return { reps: last.reps, weight: last.weight ?? 0 };
    const prev = prevLift(ex.name, workout!.id);
    if (prev) return { reps: prev.reps, weight: prev.weight ?? 0 };
    if (last) return { reps: last.reps, weight: last.weight ?? 0 };
    return { reps: 8, weight: 20 };
  }

  function isRecordSet(ex: Exercise, s: SetEntry): boolean {
    if (s.isWarmup || (s.weight ?? 0) <= 0) return false;
    const base = baseline.get(ex.name.toLowerCase()) ?? 0;
    if ((s.weight ?? 0) <= base) return false;
    const best = topSet(ex.sets);
    return best?.id === s.id;
  }

  function logGhost(ex: Exercise, v: { reps: number; weight: number }): void {
    const base = Math.max(
      baseline.get(ex.name.toLowerCase()) ?? 0,
      ...ex.sets.filter((s) => !s.isWarmup).map((s) => s.weight ?? 0),
    );
    upsertSet(workout!.id, ex.id, { reps: v.reps, weight: v.weight, isWarmup: false });
    if (live) setRestUntil(Date.now() + REST_SECONDS * 1000);
    if (v.weight > base && base > 0) {
      props.shell.toast({
        kind: 'ok',
        icon: 'trophy',
        text: t.newRecordToast(ex.name, `${v.weight} kg × ${v.reps}`),
      });
    }
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
      text: t.setDeleted(fmtSetSnack(s.reps, s.weight)),
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
      <div className="screen" style={{ padding: '14px 22px 24px', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="saved-mark">
            <i className="ph-fill ph-check-circle" aria-hidden />
            <span>{t.sessionSaved}</span>
          </div>
          <LanguageSelector />
        </div>
        <div>
          <h1 className="headline" style={{ fontSize: 32 }}>
            {t.sessionDone}
          </h1>
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
    <>
      <div className="session-top">
        <button className="back" onClick={props.onClose} aria-label="Back">
          <Icon name="caret-left" />
        </button>
        <div className="mid">
          <div className={`kicker${live ? ' live' : ''}`}>{kicker}</div>
          {live || workout.finishedAt === null ? (
            <div className="clock">
              {fmtSessionClock((workout.finishedAt ?? now) - workout.startedAt)}
            </div>
          ) : (
            <div className="title">{fmtDayMonth(workout.startedAt, locale)}</div>
          )}
        </div>
        <LanguageSelector />
        {live ? (
          <button className="btn btn-secondary" disabled={sets === 0} onClick={requestFinish}>
            {t.finish}
          </button>
        ) : workout.autoFinished ? (
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

      {live && sets > 0 && (
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

        {workout.exercises.length === 0 ? (
          <div style={{ margin: 'auto 8px' }}>
            <EmptyState icon="list-plus" title={t.noExercisesYet} body={t.noExercisesBody}>
              <button
                className="btn btn-primary"
                style={{ minHeight: 46, fontSize: 15, marginTop: 'var(--space-3)' }}
                onClick={() => setSheet({ kind: 'add' })}
              >
                <Icon name="plus" />
                {t.addExercise}
              </button>
            </EmptyState>
          </div>
        ) : (
          <>
            {[...workout.exercises]
              .sort((a, b) => a.position - b.position)
              .map((ex) => {
                const ghost = ghostFor(ex);
                const prev = prevLift(ex.name, workout.id);
                return (
                  <div key={ex.id} className="exercise-card">
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
                          <button
                            className="name"
                            onClick={() =>
                              props.shell.openOverlay({ screen: 'exercise-history', name: ex.name })
                            }
                          >
                            {ex.name}
                          </button>
                          {prev && (
                            <span className="prev">{t.prev(fmtSet(prev.weight, prev.reps))}</span>
                          )}
                          <button
                            className="dots"
                            onClick={() => setSheet({ kind: 'menu', exId: ex.id })}
                            aria-label="Menu"
                          >
                            <Icon name="dots-three-vertical" />
                          </button>
                        </>
                      )}
                    </div>
                    {renaming === ex.id && (
                      <div
                        style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginBottom: 8 }}
                      >
                        {t.renameHint}
                      </div>
                    )}
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
                              onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: s, ghost })}
                            >
                              <span className="idx">{i + 1}</span>
                              <span className="val">{s.reps}</span>
                              <span className="val">{s.weight ?? 0}</span>
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
                          onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })}
                        >
                          {ghost.reps}
                        </button>
                        <button
                          className="gval"
                          onClick={() => setSheet({ kind: 'edit', exId: ex.id, set: null, ghost })}
                        >
                          {ghost.weight}
                        </button>
                        <button
                          className="btn btn-primary log-btn"
                          onClick={() => logGhost(ex, ghost)}
                        >
                          {props.past ? t.add : t.log}
                        </button>
                      </div>
                    </div>
                    {ex.sets.length === 0 && live && (
                      <div className="ghost-hint">{t.ghostHint}</div>
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
            {props.past && !workout.autoFinished && (
              <button
                className="link"
                style={{ color: 'var(--color-danger)', padding: '6px 0', textAlign: 'left' }}
                onClick={() => setDialog({ kind: 'del-workout' })}
              >
                {t.deleteWorkout}
              </button>
            )}
          </>
        )}
      </div>

      {live && restUntil !== null && restUntil > now && (
        <div className="rest-bar">
          <Icon name="timer" />
          <span className="label">{t.rest}</span>
          <span className="time">{fmtSessionClock(restUntil - now)}</span>
          <button className="skip" onClick={() => setRestUntil(null)}>
            {t.skip}
          </button>
        </div>
      )}

      {sheet?.kind === 'add' && (
        <AddExerciseSheet
          workout={workout}
          onPick={(name) => {
            addExercise(workout.id, name);
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
              logGhost(ex, { reps: vals.reps, weight: vals.weight ?? 0 });
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
        <Dialog
          danger
          title={t.deleteWorkoutTitle}
          onClose={() => setDialog(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setDialog(null)}>
                {t.keep}
              </button>
              <button
                className="danger-outline"
                onClick={() => {
                  deleteWorkout(workout.id);
                  setDialog(null);
                  props.onClose();
                }}
              >
                {t.delete}
              </button>
            </>
          }
        >
          {t.deleteWorkoutBody(
            `${fmtDayMonth(workout.startedAt, locale)}, ${sets} ${t.sets}, ${fmtKg(volume)}`,
          )}
        </Dialog>
      )}
    </>
  );
}

// --- Add exercise sheet (S-18) --------------------------------------------

function AddExerciseSheet(props: {
  workout: Workout;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const known = useMemo(() => knownExercises(), []);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? known.filter((k) => k.name.toLowerCase().includes(needle))
    : known.slice(0, 6);
  const exact = known.some((k) => k.name.toLowerCase() === needle);

  return (
    <Sheet onClose={props.onClose}>
      <div className="searchbar">
        <Icon name="magnifying-glass" />
        <input
          autoFocus
          value={q}
          placeholder={t.addExercise}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) props.onPick(q.trim());
          }}
        />
      </div>
      {matches.length > 0 && (
        <div>
          <div className="sheet-label" style={{ padding: '8px 4px 2px' }}>
            {t.matches}
          </div>
          {matches.map((m) => {
            const idx = needle ? m.name.toLowerCase().indexOf(needle) : -1;
            return (
              <button key={m.name} className="result-row" onClick={() => props.onPick(m.name)}>
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
      {q.trim() && !exact && (
        <button className="result-row create" onClick={() => props.onPick(q.trim())}>
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
  ghost: { reps: number; weight: number };
  onSave: (vals: { reps: number; weight: number | null; isWarmup: boolean }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [reps, setReps] = useState(props.set?.reps ?? props.ghost.reps);
  const [weight, setWeight] = useState(props.set?.weight ?? props.ghost.weight);
  const [warm, setWarm] = useState(props.set?.isWarmup ?? false);
  const [openedAt] = useState(() => Date.now());
  const [focused, setFocused] = useState<'reps' | 'weight'>('weight');
  const idx = props.set
    ? [...props.exercise.sets]
        .sort((a, b) => a.position - b.position)
        .findIndex((s) => s.id === props.set!.id) + 1
    : props.exercise.sets.length + 1;

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-head">
        <span className="t">{t.setN(idx, props.exercise.name)}</span>
        {props.set && <span className="m">{t.loggedAt(fmtClock(openedAt))}</span>}
      </div>
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
          className={`stepper${focused === 'weight' ? ' focused' : ''}`}
          onClick={() => setFocused('weight')}
        >
          <div className="lab">{t.weightKg}</div>
          <div className="row">
            <button onClick={() => setWeight((w) => Math.max(0, +(w - 2.5).toFixed(2)))}>−</button>
            <span className="val">{weight}</span>
            <button onClick={() => setWeight((w) => +(w + 2.5).toFixed(2))}>+</button>
          </div>
        </div>
      </div>
      <button className="toggle-row" onClick={() => setWarm((x) => !x)}>
        <Icon name="flame" />
        <span className="lab">{t.warmupSet}</span>
        <Switch on={warm} onToggle={() => setWarm((x) => !x)} />
      </button>
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
          onClick={() => props.onSave({ reps, weight, isWarmup: warm })}
        >
          {props.set ? t.save : t.log}
        </button>
      </div>
    </Sheet>
  );
}
