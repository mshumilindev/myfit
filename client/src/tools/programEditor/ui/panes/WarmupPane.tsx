import { useMemo, useState } from 'react';
import { Button, IconButton } from '../../../../components/ui/Button';
import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { IconTile } from '../../../../components/ui/IconTile';
import { NumberStepper } from '../../../../components/ui/NumberStepper';
import { SearchField } from '../../../../components/ui/SearchField';
import { Sheet } from '../../../../components/ui/Overlays';
import { Segmented } from '../../../../components/ui/Segmented';
import { Icon } from '../../../../ui';
import { type ProgramItemDoc, type WarmupExerciseDoc } from '../../model/doc';
import { addWarmupExercise, patchWarmupExercise, removeWarmupExercise } from '../../model/ops';
import { Pane, PaneCtx } from './PaneShared';

const KG_PER_LB = 0.45359237;
const toUnit = (kg: number, unit: 'kg' | 'lb'): number =>
  unit === 'lb' ? Math.round((kg / KG_PER_LB) * 10) / 10 : Math.round(kg * 100) / 100;
const fromUnit = (v: number, unit: 'kg' | 'lb'): number =>
  unit === 'lb' ? Math.round(v * KG_PER_LB * 100) / 100 : v;

/** "12 reps · 10 kg" / "30 s": what one warm-up exercise asks for. */
function warmSummary(c: PaneCtx, w: WarmupExerciseDoc): string {
  const { p } = c;
  const unit = c.host.weightUnit?.(w.name) ?? 'kg';
  const parts: string[] = [];
  if (w.durationSec) parts.push(`${w.durationSec} ${p.edWarmSecShort}`);
  else if (w.reps) parts.push(`${w.reps} ${p.edWarmReps.toLowerCase()}`);
  if (w.weight && !w.durationSec) parts.push(`${toUnit(w.weight, unit)} ${unit}`);
  return parts.join(' · ');
}

/** The drawer of one warm-up exercise: reps or seconds, the number, and (for loaded moves) the weight. Save applies. */
function WarmupEditSheet({
  c,
  itemId,
  w,
  onClose,
}: {
  c: PaneCtx;
  itemId: string;
  w: WarmupExerciseDoc;
  onClose: () => void;
}) {
  const { p } = c;
  const unit = c.host.weightUnit?.(w.name) ?? 'kg';
  const [timed, setTimed] = useState(w.durationSec !== undefined);
  const [n, setN] = useState(w.durationSec ?? w.reps ?? 12);
  const [wt, setWt] = useState(w.weight ? toUnit(w.weight, unit) : 0);
  const weighted = !timed && (!!c.host.warmupWeighted?.(w.name) || !!w.weight);
  const save = () => {
    c.edit(
      (d) =>
        patchWarmupExercise(
          d,
          itemId,
          w.id,
          timed
            ? { durationSec: n }
            : { reps: n, weight: weighted && wt > 0 ? fromUnit(wt, unit) : undefined },
        ),
      'warmup',
    );
    onClose();
  };
  return (
    <Sheet onClose={onClose} padded label={p.edWarmEdit(w.name)}>
      <div className="pe-sheet">
        <h2 className="pe-sheet-t">{w.name}</h2>
        <Segmented
          size="sm"
          fill
          label={`${p.edWarmReps} / ${p.edWarmSecs}`}
          value={timed ? 'sec' : 'reps'}
          onChange={(v) => {
            setTimed(v === 'sec');
            setN(v === 'sec' ? 30 : 12);
          }}
          options={[
            { value: 'reps', label: p.edWarmReps },
            { value: 'sec', label: p.edWarmSecs },
          ]}
        />
        <NumberStepper
          label={timed ? p.edWarmSecs : p.edWarmReps}
          value={n}
          min={timed ? 5 : 1}
          max={timed ? 600 : 100}
          step={timed ? 5 : 1}
          onChange={setN}
        />
        {weighted && (
          <>
            <NumberStepper
              label={p.edWarmWeight}
              unit={unit}
              value={wt}
              min={0}
              max={unit === 'lb' ? 1000 : 500}
              step={unit === 'lb' ? 5 : 0.5}
              decimals={1}
              onChange={setWt}
            />
            {wt === 0 && <p className="pe-p">{p.edWarmWeightNone}</p>}
          </>
        )}
        <div className="pe-acts">
          <Button variant="primary" size="md" onClick={save}>
            {p.edDone}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function WarmupPane({
  c,
  it,
  remove,
}: {
  c: PaneCtx;
  it: ProgramItemDoc;
  remove: () => void;
}) {
  const { p, t } = c;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      adding
        ? c.host.catalog.search({
            query: q,
            muscle: q ? undefined : 'chest',
            exclude: (it.warmupItems ?? []).map((w) => w.name),
            limit: 8,
          })
        : [],
    [adding, q, it.warmupItems, c.host.catalog],
  );
  const items = it.warmupItems ?? [];
  if (adding) {
    return (
      <Pane label={p.edWarmPick} readOnly={c.readOnly}>
        <header className="pe-ph">
          <Button variant="ghost" size={c.size} icon="caret-left" onClick={() => setAdding(false)}>
            {p.edWarmTitle}
          </Button>
          <span>{p.edWarmPick}</span>
        </header>
        <SearchField
          value={q}
          onChange={setQ}
          placeholder={p.edSearchEx}
          clearLabel={p.edClearSearch}
        />
        <ul className="pe-pick">
          {list.map((x) => (
            <li key={x.name}>
              <ExerciseRow
                name={x.name}
                image={x.image}
                sub={[
                  t.muscleGroups[x.muscle] ?? x.muscle,
                  x.equipment ? t.equipmentLabel(x.equipment) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={<Icon name="plus" />}
                onClick={() => {
                  c.edit(
                    (d) =>
                      addWarmupExercise(d, it.id, {
                        name: x.name,
                        ...(x.id ? { exerciseId: x.id } : {}),
                        ...(c.host.warmupTarget?.(x.name) ?? { reps: 12 }),
                      }),
                    'warmup',
                  );
                  setAdding(false);
                  setQ('');
                }}
              />
            </li>
          ))}
          {!list.length && <li className="pe-p">{q ? p.edNoMatch(q) : p.edBrowse}</li>}
        </ul>
      </Pane>
    );
  }
  return (
    <Pane label={p.edWarmTitle} readOnly={c.readOnly}>
      <header className="pe-ed-h">
        <IconTile icon="flame" size={40} />
        <span>
          <b>{it.name}</b>
          <small>{items.length ? p.edWarmTitle : p.edMarkerNote}</small>
        </span>
      </header>
      {items.length === 0 && <p className="pe-p">{p.edWarmNone}</p>}
      {items.map((w) => (
        <div key={w.id} className="pe-warm" role="group" aria-label={w.name}>
          <ExerciseRow
            dense
            name={w.name}
            image={c.host.catalog.facts(w.name).image}
            prescription={warmSummary(c, w)}
            trailing={
              <span className="pe-warm-btns">
                {!c.readOnly && (
                  <IconButton
                    icon="pencil-simple"
                    variant="ghost"
                    size="sm"
                    label={p.edWarmEdit(w.name)}
                    onClick={() => setEditing(w.id)}
                  />
                )}
                <IconButton
                  icon="x"
                  variant="ghost"
                  size="sm"
                  label={p.edWarmRemove(w.name)}
                  onClick={() => c.edit((d) => removeWarmupExercise(d, it.id, w.id), 'warmup')}
                />
              </span>
            }
          />
        </div>
      ))}
      {editing && items.find((w) => w.id === editing) && (
        <WarmupEditSheet
          c={c}
          itemId={it.id}
          w={items.find((w) => w.id === editing) as WarmupExerciseDoc}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="pe-acts">
        <Button variant="secondary" size={c.size} icon="plus" onClick={() => setAdding(true)}>
          {p.edWarmAdd}
        </Button>
        <Button variant="danger" size={c.size} icon="trash" onClick={remove}>
          {p.edRemoveMarker}
        </Button>
      </div>
    </Pane>
  );
}
