/**
 * WarmupCard — the controls of a warm-up marker in the session. One switch
 * picks how the warm-up is logged:
 *   • "One warm-up"  — the classic single marker, optionally with minutes;
 *   • "By exercises" — a checklist of the specific moves (tick each off, add its
 *     time or reps, add from the library / a custom name / today's suggestions,
 *     reorder, remove).
 * Both modes live on the same `kind:'warmup'` marker (no sets), and "Repeat last
 * warm-up" comes from the user's own finished sessions.
 */
import { useMemo, useState } from 'react';
import { useConditionLimits } from '../healthBuild';
import { useT } from '../i18n';
import {
  addWarmupItem,
  moveWarmupItem,
  removeWarmupItem,
  setWarmupDetailed,
  setWarmupItems,
  setWarmupMinutes,
  toggleWarmupItem,
  updateWarmupItem,
  useStore,
} from '../store';
import { Sheet, useExerciseName } from '../ui';
import type { MuscleGroup } from '../data/exercises';
import type { Exercise, WarmupItem, Workout } from '../types';
import { findLastWarmup, isDetailedWarmup, warmupItemsOf, warmupSummary } from '../warmupLog';
import { warmupSuggestions, type WarmupSuggestion, type WarmupTarget } from '../warmupFor';
import { Button, IconButton } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Chip, ChipGroup } from './ui/Chip';
import { GroupedList, ListRow } from './ui/GroupedList';
import { NumberStepper } from './ui/NumberStepper';
import { SectionLabel } from './ui/SectionLabel';
import { Segmented } from './ui/Segmented';
import { WarmupPickerSheet, type WarmupPick } from './WarmupPickerSheet';

type Mode = 'single' | 'items';

function itemDetail(t: { minShort: string; wuSecUnit: string; reps: string }, i: WarmupItem) {
  const parts: string[] = [];
  if (i.reps) parts.push(`${i.reps} × ${t.reps.toLowerCase()}`);
  if (i.durationSec)
    parts.push(
      i.durationSec >= 120 && i.durationSec % 60 === 0
        ? `${i.durationSec / 60} ${t.minShort}`
        : `${i.durationSec} ${t.wuSecUnit}`,
    );
  return parts.join(' · ');
}

export function WarmupCard(props: {
  workout: Workout;
  exercise: Exercise;
  /** Primary muscles of the day's first lifts — steers the suggestions. */
  muscles: readonly MuscleGroup[];
}) {
  const { t, locale } = useT();
  const exName = useExerciseName();
  const limits = useConditionLimits();
  const { workouts, injuries } = useStore();
  const { workout, exercise: ex } = props;
  const mKey = props.muscles.join(',');
  const muscles = useMemo(() => (mKey ? (mKey.split(',') as MuscleGroup[]) : []), [mKey]);
  const mode: Mode = isDetailedWarmup(ex) ? 'items' : 'single';
  const items = useMemo(() => warmupItemsOf(ex), [ex]);
  const summary = warmupSummary(ex);
  const [picking, setPicking] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const last = useMemo(
    () =>
      findLastWarmup(workouts, {
        dayName: workout.dayName,
        weekday: (new Date(workout.startedAt).getDay() + 6) % 7,
        excludeId: workout.id,
      }),
    [workouts, workout.id, workout.dayName, workout.startedAt],
  );
  const fresh = mode === 'items' ? items.length === 0 : !ex.plannedDurationMin;
  const sug = useMemo(
    () =>
      warmupSuggestions({
        muscles,
        limits,
        injuries,
        locale,
        exclude: items.map((i) => i.name),
        perTarget: 4,
      }),
    [muscles, limits, injuries, locale, items],
  );

  const add = (p: WarmupPick) => addWarmupItem(workout.id, ex.id, p);
  const repeat = () => {
    if (!last) return;
    if (last.detailed) setWarmupItems(workout.id, ex.id, last.items);
    else {
      setWarmupDetailed(workout.id, ex.id, false);
      setWarmupMinutes(workout.id, ex.id, last.minutes);
    }
  };
  const lastSub = last
    ? [
        last.detailed ? t.nExercises(last.items.length) : null,
        last.minutes ? `${last.minutes} ${t.minShort}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const editing = editId ? items.find((i) => i.id === editId) : undefined;
  const targets: [WarmupTarget, string][] = [
    ['mobility', t.wuTargetMobility],
    ['activation', t.wuTargetActivation],
    ['cardio', t.wuTargetCardio],
  ];

  return (
    <div className="ul-flex ul-col ug-12 umt-12">
      <Segmented<Mode>
        label={t.wuModeLabel}
        value={mode}
        onChange={(m) => setWarmupDetailed(workout.id, ex.id, m === 'items')}
        options={[
          { value: 'single', label: t.wuModeSingle },
          { value: 'items', label: t.wuModeItems },
        ]}
      />

      {last && fresh && (
        <Button variant="secondary" size="sm" icon="arrow-counter-clockwise" onClick={repeat}>
          {lastSub ? `${t.wuRepeatLast} · ${lastSub}` : t.wuRepeatLast}
        </Button>
      )}

      {mode === 'single' ? (
        <NumberStepper
          label={t.wuMinutes}
          unit={t.minShort}
          value={ex.plannedDurationMin ?? 0}
          min={0}
          max={120}
          step={1}
          onChange={(m) => setWarmupMinutes(workout.id, ex.id, m || null)}
        />
      ) : (
        <>
          {items.length === 0 ? (
            <p className="ut-muted ut-sm">{t.wuItemsEmpty}</p>
          ) : (
            <GroupedList
              surface="raised"
              header={t.wuProgress(summary.count, summary.total)}
              label={t.exerciseKindNames.warmup}
            >
              {items.map((i) => (
                <ListRow
                  key={i.id}
                  as="label"
                  dense
                  icon={
                    <Checkbox
                      tone="ok"
                      checked={i.done}
                      aria-label={t.wuTick(exName(i.name))}
                      onChange={(v) => toggleWarmupItem(workout.id, ex.id, i.id, v)}
                    />
                  }
                  label={exName(i.name)}
                  sub={itemDetail(t, i) || undefined}
                  dim={i.done}
                  trailing={
                    <IconButton
                      icon="sliders-horizontal"
                      label={t.wuEditItem(exName(i.name))}
                      onClick={() => setEditId(i.id)}
                    />
                  }
                />
              ))}
            </GroupedList>
          )}

          <Button variant="secondary" size="sm" icon="plus" onClick={() => setPicking(true)}>
            {t.wuAddExercise}
          </Button>

          {targets.some(([k]) => sug[k].length > 0) && (
            <div className="ul-flex ul-col ug-8">
              <SectionLabel>{t.wuSuggested}</SectionLabel>
              {targets.map(([k, label]) =>
                sug[k].length === 0 ? null : (
                  <div key={k} className="ul-flex ul-col ug-8">
                    <span className="ut-muted ut-xs">{label}</span>
                    <ChipGroup>
                      {sug[k].map((s: WarmupSuggestion) => (
                        <Chip
                          key={s.key}
                          size="sm"
                          icon="plus"
                          onClick={() =>
                            add({
                              name: s.name,
                              ...(s.exerciseId ? { exerciseId: s.exerciseId } : {}),
                              ...(s.reps ? { reps: s.reps } : {}),
                              ...(s.durationSec ? { durationSec: s.durationSec } : {}),
                            })
                          }
                        >
                          {exName(s.name)}
                        </Chip>
                      ))}
                    </ChipGroup>
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}

      {picking && (
        <WarmupPickerSheet
          muscles={muscles}
          added={items.map((i) => i.name)}
          onPick={add}
          onClose={() => setPicking(false)}
        />
      )}
      {editing && (
        <Sheet onClose={() => setEditId(null)}>
          <div className="sheet-label">{exName(editing.name)}</div>
          <div className="ul-flex ul-col ug-12">
            <NumberStepper
              label={t.wuSeconds}
              unit={t.wuSecUnit}
              value={editing.durationSec ?? 0}
              min={0}
              max={1800}
              step={15}
              onChange={(v) =>
                updateWarmupItem(workout.id, ex.id, editing.id, { durationSec: v || undefined })
              }
            />
            <NumberStepper
              label={t.reps}
              value={editing.reps ?? 0}
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                updateWarmupItem(workout.id, ex.id, editing.id, { reps: v || undefined })
              }
            />
            <div className="ul-flex ug-8">
              <Button
                variant="secondary"
                size="sm"
                icon="arrow-up"
                disabled={items[0]?.id === editing.id}
                onClick={() => moveWarmupItem(workout.id, ex.id, editing.id, -1)}
              >
                {t.wuMoveUp}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="arrow-down"
                disabled={items[items.length - 1]?.id === editing.id}
                onClick={() => moveWarmupItem(workout.id, ex.id, editing.id, 1)}
              >
                {t.wuMoveDown}
              </Button>
            </div>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                removeWarmupItem(workout.id, ex.id, editing.id);
                setEditId(null);
              }}
            >
              {t.wuRemoveItem}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
