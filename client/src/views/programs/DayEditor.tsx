/**
 * One training day of a program (design m04–m09 / w02–w04): a day is defined by
 * muscles (clickable body map + tiles) OR by exercises (whose muscles are then
 * derived and locked). Warm-up / cool-down markers and cardio are their own item
 * types. Advanced exercise options live behind "More".
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { WarmupItemRow } from '../../components/WarmupItemRow';
import { defaultWarmupValue } from '../../warmupLog';
import { MusclePickerMap, equipmentIconName } from '../../components/Muscle';
import type { MuscleGroup } from '../../data/exercises';
import { CardioMachineList } from '../../components/CardioMachineList';
import { ExercisePicker } from '../../components/ExercisePicker';
import { EQUIPMENT_IDS, type EquipmentId } from '../../data/equipment';
import { useT } from '../../i18n';
import { getRole } from '../../api';
import { useConditionLimits } from '../../healthBuild';
import { exerciseFlag } from '../../conditions';
import { useWeekStartDay, weekOrder } from '../../weekStart';
import type { Shell } from '../../App';
import type { ExerciseKind, Workout } from '../../types';
import { ConfirmDialog, Icon, Sheet, useExerciseName } from '../../ui';
import {
  addItem,
  addWarmupExercise,
  copyDay,
  dayItems,
  dayMode,
  dayName,
  derivedMuscles,
  isTrainingDay,
  moveItem,
  patchItem,
  patchWarmupExercise,
  removeItem,
  removeWarmupExercise,
  setCount,
  setDayName,
  supersetLabels,
  supersetWith,
  toMusclesMode,
  toggleMuscle,
  ungroup,
  type DayMode,
  type Program,
  type ProgramItem,
} from './model';
import { IconButton, ModeTabs, ToggleRow } from './pieces';
import { NumberStepper } from '../../components/ui/NumberStepper';

/** Target-muscle tiles grouped like the exercise picker's families. */
const MUSCLE_BLOCKS: { id: string; muscles: MuscleGroup[] }[] = [
  { id: 'chest', muscles: ['chest'] },
  { id: 'back', muscles: ['back', 'lats', 'traps', 'lower_back'] },
  { id: 'shoulders', muscles: ['shoulders', 'neck'] },
  { id: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'] },
  { id: 'core', muscles: ['core'] },
  { id: 'fullbody', muscles: ['fullbody'] },
];

export interface DayNav {
  label: string;
  sub?: string;
  onClick: () => void;
}

export function DayEditor({
  program,
  day,
  readOnly,
  update,
  shell,
  desktop,
  rail,
  prev,
  next,
}: {
  program: Program;
  day: number;
  readOnly?: boolean;
  update: (fn: (p: Program) => Program) => void;
  shell: Shell;
  desktop: boolean;
  rail?: ReactNode;
  prev: DayNav | null;
  next: DayNav | null;
}) {
  const { t } = useT();
  const items = dayItems(program, day);
  const stored = dayMode(program, day);
  // The tab can be switched to Exercises before the first lift is picked.
  const [tab, setTab] = useState<DayMode>(stored);
  const mode: DayMode = stored === 'exercises' ? 'exercises' : tab;
  const [confirmMuscles, setConfirmMuscles] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const weekday = t.weekDayNames[day - 1] ?? '';
  const weekStart = useWeekStartDay();
  const target = program.targetMuscles[String(day)] ?? [];
  const derived = useMemo(() => derivedMuscles(items), [items]);
  const mapLabels = { front: t.pgFront, back: t.pgBack };

  const switchMode = (m: DayMode) => {
    if (m === 'muscles' && items.length > 0) setConfirmMuscles(true);
    else setTab(m);
  };

  const musclesBody = (
    <>
      {!desktop && (
        <MusclePickerMap
          selected={target}
          onToggle={readOnly ? undefined : (m) => update((p) => toggleMuscle(p, day, m))}
          labels={mapLabels}
          className="pg-map"
        />
      )}
      <div className="pg-mgroups" role="group" aria-label={t.progTargetMuscles}>
        {MUSCLE_BLOCKS.map((b) => (
          <section key={b.id} className="pg-mgroup">
            <h4 className="pg-label">
              {b.id === 'fullbody' ? t.muscleGroups.fullbody : t.pickFamilies[b.id]}
            </h4>
            <div className="pg-mtiles">
              {b.muscles.map((m) => {
                const on = target.includes(m);
                return (
                  <Card
                    as="button"
                    key={m}
                    pad="none"
                    tone={on ? 'accent' : 'neutral'}
                    emphasis={on ? 'hero' : 'card'}
                    className={`pg-mtile${on ? ' on' : ''}`}
                    aria-pressed={on}
                    disabled={readOnly}
                    onClick={() => update((p) => toggleMuscle(p, day, m))}
                  >
                    {t.muscleGroups[m]}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );

  const exercisesBody = (
    <>
      {derived.length > 0 && (
        <div className="pg-locked" title={t.pgFromExercises}>
          <Icon name="lock-simple" />
          {derived.slice(0, 6).map((m) => (
            <span key={m} className="pg-lk">
              {t.muscleGroups[m]}
            </span>
          ))}
          <span className="sr-only">{t.pgFromExercises}</span>
        </div>
      )}
      <ItemList items={items} readOnly={readOnly} update={update} shell={shell} />
      {!readOnly && (
        <Button variant="secondary" fullWidth icon="plus" onClick={() => setPickerOpen(true)}>
          {t.addExercise}
        </Button>
      )}
      {items.length > 0 && (
        <p className="pg-note">
          {t.progDayWorkoutSummary(
            items.filter((i) => i.kind === 'strength').length,
            setCount(items),
          )}
          {' · '}
          {t.pgNoWeightShort}
        </p>
      )}
    </>
  );

  const center = (
    <div className="pg-day-main">
      {rail}
      <div className="pg-day-head">
        <div className="pg-day-title">
          <span className="pg-kicker">{weekday}</span>
          <Field
            value={program.dayNames[String(day)] ?? ''}
            placeholder={t.pgNameThisDay}
            maxLength={40}
            aria-label={t.pgDayName(weekday)}
            readOnly={readOnly}
            onChange={(e) => update((p) => setDayName(p, day, e.target.value))}
          />
        </div>
        {!readOnly && (
          <IconButton icon="copy" label={t.progCopyDay} onClick={() => setCopyOpen(true)} />
        )}
      </div>
      <ModeTabs mode={mode} onChange={switchMode} disabled={readOnly} />
      {mode === 'muscles' ? musclesBody : exercisesBody}
      <div className="pg-daynav">
        {prev ? (
          <Card as="button" pad="none" className="pg-nav prev" onClick={prev.onClick}>
            <Icon name="caret-left" />
            <span>
              {prev.sub && <small>{prev.sub}</small>}
              {prev.label}
            </span>
          </Card>
        ) : (
          <span />
        )}
        {next && (
          <Card
            as="button"
            pad="none"
            tone="accent"
            emphasis="hero"
            className="pg-nav next"
            onClick={next.onClick}
          >
            <span>
              {next.sub && <small>{next.sub}</small>}
              {next.label}
            </span>
            <Icon name="caret-right" />
          </Card>
        )}
      </div>
    </div>
  );

  const side = desktop && (
    <aside className="pg-day-side">
      {mode === 'muscles' ? (
        <>
          <div className="pg-label">{t.pgMuscleMap}</div>
          <MusclePickerMap
            selected={target}
            onToggle={readOnly ? undefined : (m) => update((p) => toggleMuscle(p, day, m))}
            labels={mapLabels}
            className="pg-map"
          />
          <p className="pg-map-cap">
            {target.includes('fullbody')
              ? t.muscleGroups.fullbody
              : target.length
                ? target.map((m) => t.muscleGroups[m]).join(' · ')
                : t.pgTapBody}
          </p>
        </>
      ) : (
        <>
          <div className="pg-label">
            <Icon name="lock-simple" /> {t.pgFromExercises}
          </div>
          <MusclePickerMap selected={derived} locked labels={mapLabels} className="pg-map" />
          <p className="pg-map-cap">{derived.map((m) => t.muscleGroups[m]).join(' · ')}</p>
        </>
      )}
    </aside>
  );

  return (
    <div className={desktop ? 'pg-day desk' : 'pg-day'}>
      {center}
      {side}
      {confirmMuscles && (
        <ConfirmDialog
          tone="illness"
          icon="warning"
          title={t.pgSwitchMusclesTitle}
          body={t.pgSwitchMusclesBody(items.length)}
          confirmLabel={t.pgSwitchAction}
          cancelLabel={t.keep}
          onCancel={() => setConfirmMuscles(false)}
          onConfirm={() => {
            update((p) => toMusclesMode(p, day));
            setTab('muscles');
            setConfirmMuscles(false);
          }}
        />
      )}
      {copyOpen && (
        <Sheet onClose={() => setCopyOpen(false)}>
          <div className="pg-sheet">
            <h3>{t.progCopyDay}</h3>
            <p className="pg-note">{t.pgCopyHint}</p>
            <div className="pg-list">
              {weekOrder(weekStart)
                .filter((d) => d !== day)
                .map((d) => (
                  <ListRow
                    key={d}
                    label={t.weekDayNames[d - 1]}
                    sub={
                      isTrainingDay(program, d)
                        ? dayName(program, d) || t.pgUnnamed
                        : t.progRestShort
                    }
                    chevron
                    onClick={() => {
                      update((p) => copyDay(p, day, d));
                      setCopyOpen(false);
                    }}
                  />
                ))}
            </div>
          </div>
        </Sheet>
      )}
      {pickerOpen && (
        <ProgramPicker
          subtitle={`${weekday.slice(0, 3)} · ${dayName(program, day) || weekday}`}
          dayLabel={dayName(program, day) || weekday}
          added={items.map((i) => i.name)}
          onAdd={(item) => {
            update((p) => addItem(p, { ...item, day }));
            setTab('exercises');
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// --- the day's items ---------------------------------------------------------------

function ItemList({
  items,
  readOnly,
  update,
  shell,
}: {
  items: ProgramItem[];
  readOnly?: boolean;
  update: (fn: (p: Program) => Program) => void;
  shell: Shell;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const limits = useConditionLimits();
  // Only for the person training it: a coach building a client's plan has their own limits.
  const flagOf = (name: string) =>
    limits.keys.length && getRole() === 'member' ? exerciseFlag(name, limits).level : 'ok';
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProgramItem | null>(null);
  const [equipFor, setEquipFor] = useState<ProgramItem | null>(null);
  const [pairFor, setPairFor] = useState<ProgramItem | null>(null);
  const [warmFor, setWarmFor] = useState<string | null>(null);
  const labels = supersetLabels(items);
  if (items.length === 0) {
    return <p className="pg-empty">{t.pgNoExercisesYet}</p>;
  }
  const lifts = items.filter((i) => i.kind === 'strength');

  return (
    <div className="pg-items">
      {items.map((it) => {
        if (it.kind === 'warmup' || it.kind === 'cooldown') {
          const wu = it.kind === 'warmup' ? (it.warmupItems ?? []) : [];
          return (
            <div key={it.id} className="pg-ex">
              <div className="pg-marker">
                <Icon name={it.kind === 'warmup' ? 'flame' : 'snowflake'} />
                <span className="n">{t.exerciseKindNames[it.kind]}</span>
                {wu.length === 0 && <small>{t.pgMarker}</small>}
                {!readOnly && (
                  <IconButton
                    icon="x"
                    label={t.pgRemoveItem(t.exerciseKindNames[it.kind])}
                    onClick={() => update((p) => removeItem(p, it.id))}
                  />
                )}
              </div>
              {it.kind === 'warmup' && wu.length > 0 && (
                <GroupedList surface="raised" label={t.exerciseKindNames.warmup}>
                  {wu.map((w) => (
                    <WarmupItemRow
                      key={w.id}
                      item={w}
                      status="target"
                      readOnly={readOnly}
                      onSubmit={(patch) =>
                        update((p) => patchWarmupExercise(p, it.id, w.id, patch))
                      }
                      onRemove={() => update((p) => removeWarmupExercise(p, it.id, w.id))}
                    />
                  ))}
                </GroupedList>
              )}
              {it.kind === 'warmup' && !readOnly && (
                <Button variant="secondary" size="sm" icon="plus" onClick={() => setWarmFor(it.id)}>
                  {t.wuAddExercise}
                </Button>
              )}
            </div>
          );
        }
        if (it.kind === 'cardio') {
          return (
            <div key={it.id} className="pg-row cardio">
              <Icon name="pulse" />
              <span className="n">{exName(it.name)}</span>
              {flagOf(it.name) !== 'ok' && (
                <span
                  className="pg-care"
                  title={flagOf(it.name) === 'avoid' ? t.pickNotAdvised : t.pickCareful}
                >
                  <Icon name="shield-check" />
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="pg-sr"
                disabled={readOnly}
                aria-label={t.pgMinutesOf(exName(it.name))}
                onClick={() => setEditing(it)}
              >
                {it.durationMin ?? 10} {t.minShort}
              </Button>
              {!readOnly && (
                <IconButton
                  icon="x"
                  label={t.pgRemoveItem(exName(it.name))}
                  onClick={() => update((p) => removeItem(p, it.id))}
                />
              )}
            </div>
          );
        }
        const label = labels.get(it.id);
        const isOpen = open === it.id;
        const idx = items.indexOf(it);
        return (
          <div key={it.id} className={`pg-ex${isOpen ? ' open' : ''}${label ? ' grouped' : ''}`}>
            <div className="pg-row">
              {label && <span className="pg-ss">{label}</span>}
              <span className="n">{exName(it.name)}</span>
              <Button
                variant="secondary"
                size="sm"
                className="pg-sr"
                disabled={readOnly}
                aria-label={t.pgSetsRepsOf(exName(it.name))}
                onClick={() => setEditing(it)}
              >
                {it.sets} × {it.reps}
              </Button>
              <IconButton
                icon="info"
                label={t.pgDetailsOf(exName(it.name))}
                onClick={() => shell.openOverlay({ screen: 'exercise-detail', name: it.name })}
              />
              {!readOnly && (
                <IconButton
                  icon={isOpen ? 'caret-up' : 'caret-down'}
                  label={isOpen ? t.pgLess : t.pgMore}
                  expanded={isOpen}
                  className={isOpen ? 'on' : undefined}
                  onClick={() => setOpen(isOpen ? null : it.id)}
                />
              )}
            </div>
            {isOpen && !readOnly && (
              <div className="pg-more">
                <div className="pg-more-row">
                  <span>{t.progEquipment}</span>
                  <Button
                    variant="link"
                    className="pg-more-val"
                    iconTrailing="plus"
                    onClick={() => setEquipFor(it)}
                  >
                    {it.equipment.length ? (
                      it.equipment.map((e) => (
                        <span key={e} className="pg-eq">
                          {t.equipmentNames[e]}
                        </span>
                      ))
                    ) : (
                      <span className="pg-link">{t.pgAddEquipment}</span>
                    )}
                  </Button>
                </div>
                <ToggleRow
                  label={t.pgDropLastSet}
                  on={!!it.dropLast}
                  onToggle={() => update((p) => patchItem(p, it.id, { dropLast: !it.dropLast }))}
                />
                <div className="pg-more-row">
                  <span>{t.pgSupersetWith}</span>
                  {label ? (
                    <Button
                      variant="link"
                      className="pg-more-val"
                      onClick={() => update((p) => ungroup(p, it.id))}
                    >
                      {label} · {t.ungroup}
                    </Button>
                  ) : (
                    <Button
                      variant="link"
                      className="pg-more-val"
                      disabled={lifts.length < 2}
                      onClick={() => setPairFor(it)}
                    >
                      {t.pgChooseExercise}
                    </Button>
                  )}
                </div>
                <div className="pg-more-row">
                  <span>{t.pgHistory}</span>
                  <Button
                    variant="link"
                    className="pg-more-val"
                    iconTrailing="caret-right"
                    onClick={() => shell.openOverlay({ screen: 'exercise-history', name: it.name })}
                  >
                    {t.openHistory}
                  </Button>
                </div>
                <div className="pg-more-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="arrow-up"
                    disabled={idx === 0}
                    onClick={() => update((p) => moveItem(p, it.id, -1))}
                  >
                    {t.pgMoveUp}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="arrow-fat-down"
                    disabled={idx === items.length - 1}
                    onClick={() => update((p) => moveItem(p, it.id, 1))}
                  >
                    {t.pgMoveDown}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={() => {
                      setOpen(null);
                      update((p) => removeItem(p, it.id));
                    }}
                  >
                    {t.pgRemove}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {warmFor && (
        <ExercisePicker
          warmup
          workout={PLAIN_WORKOUT}
          gym={null}
          addLabel={t.wuAddExercise}
          onPick={(i) => {
            update((p) =>
              addWarmupExercise(p, warmFor, {
                name: i.name,
                ...(i.catalogId ? { exerciseId: i.catalogId } : {}),
                ...defaultWarmupValue(i.name),
              }),
            );
            setWarmFor(null);
          }}
          onClose={() => setWarmFor(null)}
        />
      )}
      {editing && (
        <SetsSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            update((p) => patchItem(p, editing.id, patch));
            setEditing(null);
          }}
        />
      )}
      {equipFor && (
        <EquipmentSheet
          value={equipFor.equipment}
          onClose={() => setEquipFor(null)}
          onSave={(equipment) => {
            update((p) => patchItem(p, equipFor.id, { equipment }));
            setEquipFor(null);
          }}
        />
      )}
      {pairFor && (
        <Sheet onClose={() => setPairFor(null)}>
          <div className="pg-sheet">
            <h3>{t.pgSupersetWith}</h3>
            <p className="pg-note">{exName(pairFor.name)}</p>
            <div className="pg-list">
              {lifts
                .filter((x) => x.id !== pairFor.id)
                .map((x) => (
                  <ListRow
                    key={x.id}
                    label={exName(x.name)}
                    sub={`${x.sets} × ${x.reps}`}
                    chevron
                    onClick={() => {
                      update((p) => supersetWith(p, pairFor.id, x.id));
                      setPairFor(null);
                    }}
                  />
                ))}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// --- sheets ------------------------------------------------------------------------

function SetsSheet({
  item,
  onSave,
  onClose,
}: {
  item: ProgramItem;
  onSave: (patch: Partial<ProgramItem>) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const timed = item.kind !== 'strength';
  const [sets, setSets] = useState(item.sets || 3);
  const [reps, setReps] = useState(item.reps || 10);
  const [mins, setMins] = useState(item.durationMin ?? 10);
  return (
    <Sheet onClose={onClose}>
      <div className="pg-sheet">
        <h3>{exName(item.name)}</h3>
        {timed ? (
          <NumberStepper
            size="big"
            label={t.minShort}
            value={mins}
            step={5}
            min={1}
            max={240}
            onChange={setMins}
          />
        ) : (
          <div className="pg-sets">
            <NumberStepper label={t.progSets} value={sets} min={1} max={20} onChange={setSets} />
            <span className="pg-x">×</span>
            <NumberStepper label={t.progReps} value={reps} min={1} max={100} onChange={setReps} />
          </div>
        )}
        <Button
          variant="primary"
          className="pg-wide"
          onClick={() => onSave(timed ? { durationMin: mins } : { sets, reps })}
        >
          {t.pgDone}
        </Button>
      </div>
    </Sheet>
  );
}

function EquipmentSheet({
  value,
  onSave,
  onClose,
}: {
  value: EquipmentId[];
  onSave: (v: EquipmentId[]) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [sel, setSel] = useState<EquipmentId[]>(value);
  return (
    <Sheet onClose={onClose}>
      <div className="pg-sheet">
        <h3>{t.progEquipment}</h3>
        <div className="pg-eqgrid">
          {EQUIPMENT_IDS.map((id) => {
            const on = sel.includes(id);
            return (
              <Chip
                key={id}
                className="pg-eqtile"
                selected={on}
                icon={equipmentIconName(id)}
                onClick={() => setSel((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
              >
                {t.equipmentNames[id]}
              </Chip>
            );
          })}
        </div>
        <Button variant="primary" className="pg-wide" onClick={() => onSave(sel)}>
          {t.pgDone}
        </Button>
      </div>
    </Sheet>
  );
}

type NewItem = {
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
};

/** A blank "session" for the picker: program authoring has no live workout. */
const PLAIN_WORKOUT: Workout = {
  id: 'program-authoring',
  startedAt: 0,
  finishedAt: null,
  autoFinished: false,
  gymId: null,
  exercises: [],
};

/** The session's Add exercise, without recommendations (design m07–m09, w04). */
function ProgramPicker({
  subtitle,
  dayLabel,
  added,
  onAdd,
  onClose,
}: {
  subtitle: string;
  dayLabel: string;
  added: string[];
  onAdd: (item: NewItem) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [machines, setMachines] = useState(false);
  if (machines) {
    return (
      <Sheet onClose={onClose}>
        <div className="sheet-label">{t.cardioMachineTitle}</div>
        <CardioMachineList
          gym={null}
          onPick={(_id, name) =>
            onAdd({ name, kind: 'cardio', sets: 1, reps: 0, durationMin: 10, equipment: [] })
          }
        />
      </Sheet>
    );
  }
  return (
    <ExercisePicker
      plain
      workout={PLAIN_WORKOUT}
      gym={null}
      subtitle={subtitle}
      added={added}
      addLabel={t.pgAddTo(dayLabel)}
      onPick={(i) =>
        onAdd({
          name: i.name,
          kind: 'strength',
          sets: 3,
          reps: 10,
          durationMin: null,
          equipment: i.equipment ? [i.equipment] : [],
        })
      }
      onMarker={(k) =>
        onAdd({
          name: t.defaultTimedExerciseNames[k],
          kind: k,
          sets: 1,
          reps: 0,
          durationMin: null,
          equipment: [],
        })
      }
      onCardio={() => setMachines(true)}
      onCreate={(name) =>
        onAdd({ name, kind: 'strength', sets: 3, reps: 10, durationMin: null, equipment: [] })
      }
      onClose={onClose}
    />
  );
}
