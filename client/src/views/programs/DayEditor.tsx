/**
 * One training day of a program (design m04–m09 / w02–w04): a day is defined by
 * muscles (clickable body map + tiles) OR by exercises (whose muscles are then
 * derived and locked). Warm-up / cool-down markers and cardio are their own item
 * types. Advanced exercise options live behind "More".
 */
import { useMemo, useState, type ReactNode } from 'react';
import { MusclePickerMap, equipmentIconName } from '../../components/Muscle';
import type { MuscleGroup } from '../../data/exercises';
import { CardioMachineList } from '../../components/CardioMachineList';
import { ExercisePicker } from '../../components/ExercisePicker';
import { EQUIPMENT_IDS, type EquipmentId } from '../../data/equipment';
import { useT } from '../../i18n';
import { useWeekStartDay, weekOrder } from '../../weekStart';
import type { Shell } from '../../App';
import type { ExerciseKind, Workout } from '../../types';
import { ConfirmDialog, Icon, Sheet, useExerciseName } from '../../ui';
import {
  addItem,
  copyDay,
  dayItems,
  dayMode,
  dayName,
  derivedMuscles,
  isTrainingDay,
  moveItem,
  patchItem,
  removeItem,
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
import { IconButton, ModeTabs, Stepper, ToggleRow } from './pieces';

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
                  <button
                    key={m}
                    type="button"
                    className={`pg-mtile${on ? ' on' : ''}`}
                    aria-pressed={on}
                    disabled={readOnly}
                    onClick={() => update((p) => toggleMuscle(p, day, m))}
                  >
                    {t.muscleGroups[m]}
                  </button>
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
        <button type="button" className="pg-add" onClick={() => setPickerOpen(true)}>
          <Icon name="plus" />
          {t.addExercise}
        </button>
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
          <input
            className="pg-day-name"
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
          <button type="button" className="pg-nav prev" onClick={prev.onClick}>
            <Icon name="caret-left" />
            <span>
              {prev.sub && <small>{prev.sub}</small>}
              {prev.label}
            </span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" className="pg-nav next" onClick={next.onClick}>
            <span>
              {next.sub && <small>{next.sub}</small>}
              {next.label}
            </span>
            <Icon name="caret-right" />
          </button>
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
                  <button
                    key={d}
                    type="button"
                    className="pg-list-row"
                    onClick={() => {
                      update((p) => copyDay(p, day, d));
                      setCopyOpen(false);
                    }}
                  >
                    <b>{t.weekDayNames[d - 1]}</b>
                    <span>
                      {isTrainingDay(program, d)
                        ? dayName(program, d) || t.pgUnnamed
                        : t.progRestShort}
                    </span>
                  </button>
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
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProgramItem | null>(null);
  const [equipFor, setEquipFor] = useState<ProgramItem | null>(null);
  const [pairFor, setPairFor] = useState<ProgramItem | null>(null);
  const labels = supersetLabels(items);
  if (items.length === 0) {
    return <p className="pg-empty">{t.pgNoExercisesYet}</p>;
  }
  const lifts = items.filter((i) => i.kind === 'strength');

  return (
    <div className="pg-items">
      {items.map((it) => {
        if (it.kind === 'warmup' || it.kind === 'cooldown') {
          return (
            <div key={it.id} className="pg-marker">
              <Icon name={it.kind === 'warmup' ? 'flame' : 'snowflake'} />
              <span className="n">{t.exerciseKindNames[it.kind]}</span>
              <small>{t.pgMarker}</small>
              {!readOnly && (
                <IconButton
                  icon="x"
                  label={t.pgRemoveItem(t.exerciseKindNames[it.kind])}
                  onClick={() => update((p) => removeItem(p, it.id))}
                />
              )}
            </div>
          );
        }
        if (it.kind === 'cardio') {
          return (
            <div key={it.id} className="pg-row cardio">
              <Icon name="pulse" />
              <span className="n">{exName(it.name)}</span>
              <button
                type="button"
                className="pg-sr"
                disabled={readOnly}
                aria-label={t.pgMinutesOf(exName(it.name))}
                onClick={() => setEditing(it)}
              >
                {it.durationMin ?? 10} {t.minShort}
              </button>
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
              <button
                type="button"
                className="pg-sr"
                disabled={readOnly}
                aria-label={t.pgSetsRepsOf(exName(it.name))}
                onClick={() => setEditing(it)}
              >
                {it.sets} × {it.reps}
              </button>
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
                  <button type="button" className="pg-more-val" onClick={() => setEquipFor(it)}>
                    {it.equipment.length ? (
                      it.equipment.map((e) => (
                        <span key={e} className="pg-eq">
                          {t.equipmentNames[e]}
                        </span>
                      ))
                    ) : (
                      <span className="pg-link">{t.pgAddEquipment}</span>
                    )}
                    <Icon name="plus" />
                  </button>
                </div>
                <ToggleRow
                  label={t.pgDropLastSet}
                  on={!!it.dropLast}
                  onToggle={() => update((p) => patchItem(p, it.id, { dropLast: !it.dropLast }))}
                />
                <div className="pg-more-row">
                  <span>{t.pgSupersetWith}</span>
                  {label ? (
                    <button
                      type="button"
                      className="pg-more-val pg-link"
                      onClick={() => update((p) => ungroup(p, it.id))}
                    >
                      {label} · {t.ungroup}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pg-more-val pg-link"
                      disabled={lifts.length < 2}
                      onClick={() => setPairFor(it)}
                    >
                      {t.pgChooseExercise}
                    </button>
                  )}
                </div>
                <div className="pg-more-row">
                  <span>{t.pgHistory}</span>
                  <button
                    type="button"
                    className="pg-more-val pg-link"
                    onClick={() => shell.openOverlay({ screen: 'exercise-history', name: it.name })}
                  >
                    {t.openHistory}
                    <Icon name="caret-right" />
                  </button>
                </div>
                <div className="pg-more-actions">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => update((p) => moveItem(p, it.id, -1))}
                  >
                    <Icon name="arrow-up" />
                    {t.pgMoveUp}
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => update((p) => moveItem(p, it.id, 1))}
                  >
                    <Icon name="arrow-fat-down" />
                    {t.pgMoveDown}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setOpen(null);
                      update((p) => removeItem(p, it.id));
                    }}
                  >
                    <Icon name="trash" />
                    {t.pgRemove}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
                  <button
                    key={x.id}
                    type="button"
                    className="pg-list-row"
                    onClick={() => {
                      update((p) => supersetWith(p, pairFor.id, x.id));
                      setPairFor(null);
                    }}
                  >
                    <b>{exName(x.name)}</b>
                    <span>
                      {x.sets} × {x.reps}
                    </span>
                  </button>
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
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return (
    <Sheet onClose={onClose}>
      <div className="pg-sheet">
        <h3>{exName(item.name)}</h3>
        {timed ? (
          <Stepper
            big
            value={mins}
            label={t.minShort}
            decLabel={t.pgLess}
            incLabel={t.pgMore}
            onDec={() => setMins((v) => clamp(v - 5, 1, 240))}
            onInc={() => setMins((v) => clamp(v + 5, 1, 240))}
          />
        ) : (
          <div className="pg-sets">
            <Stepper
              value={sets}
              label={t.progSets}
              decLabel={t.pgFewer(t.progSets)}
              incLabel={t.pgMoreOf(t.progSets)}
              onDec={() => setSets((v) => clamp(v - 1, 1, 20))}
              onInc={() => setSets((v) => clamp(v + 1, 1, 20))}
            />
            <span className="pg-x">×</span>
            <Stepper
              value={reps}
              label={t.progReps}
              decLabel={t.pgFewer(t.progReps)}
              incLabel={t.pgMoreOf(t.progReps)}
              onDec={() => setReps((v) => clamp(v - 1, 1, 100))}
              onInc={() => setReps((v) => clamp(v + 1, 1, 100))}
            />
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary pg-wide"
          onClick={() => onSave(timed ? { durationMin: mins } : { sets, reps })}
        >
          {t.pgDone}
        </button>
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
              <button
                key={id}
                type="button"
                className={`pg-eqtile${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => setSel((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
              >
                <Icon name={equipmentIconName(id)} />
                {t.equipmentNames[id]}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary pg-wide" onClick={() => onSave(sel)}>
          {t.pgDone}
        </button>
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
