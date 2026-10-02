/**
 * WarmupCard — the controls of a warm-up block in the session. A warm-up is just
 * a block: add exercises to it from the exercise library (any exercise), or add
 * none and it is logged as a plain, generic warm-up (optionally with minutes).
 * Each exercise first shows as a cut-down standard logger and is only recorded
 * when Log is pressed (ONE set); then it collapses into a one-line row with an
 * Edit drawer. The block lives on the `kind:'warmup'` marker (no sets); "Repeat last warm-up" comes from the
 * user's own finished sessions.
 */
import { Fragment, useMemo, useState } from 'react';
import { useT } from '../i18n';
import {
  addWarmupItem,
  removeWarmupItem,
  setWarmupItems,
  setWarmupMinutes,
  logWarmupItem,
  updateWarmupItem,
  useStore,
} from '../store';
import type { Exercise, WarmupItem, Workout } from '../types';
import {
  defaultWarmupValue,
  findLastWarmup,
  fmtWarmupClock,
  lastWarmupValues,
  warmupItemsOf,
  warmupMeasuredSec,
} from '../warmupLog';
import type { PickItem } from '../picker';
import { Button } from './ui/Button';
import { GroupedList } from './ui/GroupedList';
import { ExercisePicker } from './ExercisePicker';
import { WarmupItemRow } from './WarmupItemRow';

export function WarmupCard(props: { workout: Workout; exercise: Exercise }) {
  const { t } = useT();
  const { workouts, gyms } = useStore();
  const { workout, exercise: ex } = props;
  const items = useMemo(() => warmupItemsOf(ex), [ex]);
  const [picking, setPicking] = useState(false);
  const gym = gyms.find((g) => g.id === workout.gymId) ?? null;

  const last = useMemo(
    () =>
      findLastWarmup(workouts, {
        dayName: workout.dayName,
        weekday: (new Date(workout.startedAt).getDay() + 6) % 7,
        excludeId: workout.id,
      }),
    [workouts, workout.id, workout.dayName, workout.startedAt],
  );
  const fresh = items.length === 0 && !ex.plannedDurationMin;

  const repeat = () => {
    if (!last) return;
    if (last.items.length) setWarmupItems(workout.id, ex.id, last.items);
    else setWarmupMinutes(workout.id, ex.id, last.minutes);
  };
  const lastSub = last
    ? [
        last.items.length ? t.nExercises(last.items.length) : null,
        last.minutes ? `${last.minutes} ${t.minShort}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const row = (i: WarmupItem) => (
    <WarmupItemRow
      key={i.id}
      item={i}
      status={i.done ? 'logged' : 'pending'}
      suggestWeightKg={lastWarmupValues(workouts, i.name, workout.id)?.weight}
      onSubmit={(v) =>
        i.done
          ? updateWarmupItem(workout.id, ex.id, i.id, v)
          : logWarmupItem(workout.id, ex.id, i.id, v)
      }
      onRemove={() => removeWarmupItem(workout.id, ex.id, i.id)}
    />
  );

  /** Runs of logged rows share one list; each pending logger is its own card. */
  const groups = useMemo(() => {
    const out: { logged: boolean; items: WarmupItem[] }[] = [];
    for (const i of items) {
      const last = out[out.length - 1];
      if (last && last.logged && i.done) last.items.push(i);
      else out.push({ logged: i.done, items: [i] });
    }
    return out;
  }, [items]);

  const add = (i: PickItem) =>
    addWarmupItem(workout.id, ex.id, {
      name: i.name,
      ...(i.catalogId ? { exerciseId: i.catalogId } : {}),
      // A pending logger pre-filled with what was logged last time (or defaults).
      ...(lastWarmupValues(workouts, i.name, workout.id) ?? defaultWarmupValue(i.name)),
    });

  return (
    <div className="ul-flex ul-col ug-12 umt-12">
      {last && fresh && (
        <Button variant="secondary" size="sm" icon="arrow-counter-clockwise" onClick={repeat}>
          {lastSub ? `${t.wuRepeatLast} · ${lastSub}` : t.wuRepeatLast}
        </Button>
      )}

      {groups.map((g) =>
        g.logged ? (
          <GroupedList key={g.items[0].id} surface="raised">
            {g.items.map((i) => row(i))}
          </GroupedList>
        ) : (
          <Fragment key={g.items[0].id}>{g.items.map((i) => row(i))}</Fragment>
        ),
      )}

      <Button variant="secondary" size="sm" icon="plus" onClick={() => setPicking(true)}>
        {t.wuAddExercise}
      </Button>

      {picking && (
        <ExercisePicker
          warmup
          workout={workout}
          gym={gym}
          addLabel={t.wuAddExercise}
          onPick={(i) => {
            add(i);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/**
 * The warm-up marker's title line: «Ready when you are · 1:05». The time is the
 * REAL measured one — ticking (from `now`) until the first strength set, then
 * frozen; nothing when it was never measured. The word "warm-up" lives only in
 * the card header name, never here.
 */
export function WarmupMarkerTitle(props: { workout: Workout; exercise: Exercise; now: number }) {
  const { t } = useT();
  const sec = warmupMeasuredSec(props.exercise, props.workout, props.now);
  return (
    <>
      {t.warmupMarkerTitle}
      {sec !== null ? ` · ${fmtWarmupClock(sec)}` : ''}
    </>
  );
}
