import { type ReactNode } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Chip, ChipGroup } from '../../../../components/ui/Chip';
import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { Field } from '../../../../components/ui/Field';
import { ListRow } from '../../../../components/ui/GroupedList';
import { IconTile } from '../../../../components/ui/IconTile';
import { NumberStepper } from '../../../../components/ui/NumberStepper';
import { Segmented } from '../../../../components/ui/Segmented';
import { SectionLabel } from '../../../../components/ui/SectionLabel';
import { Switch } from '../../../../components/ui/Switch';
import { dayItems, isBare, type ProgramItemDoc } from '../../model/doc';
import {
  patchItem,
  removeItem,
  moveItem,
  setEquipment,
  setRowMode,
  ungroup,
} from '../../model/ops';
import { firstName } from '../text';
import { Pane, PaneCtx } from './PaneShared';
import { WarmupPane } from './WarmupPane';
import { ExerciseAsClient } from './ExerciseAsClient';

function OptTarget(o: {
  label: string;
  hint: string;
  notSet: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="pe-opt">
      <ListRow
        as="label"
        dense
        strong
        label={o.label}
        sub={o.on ? o.hint : o.notSet}
        trailing={<Switch checked={o.on} size="sm" aria-label={o.label} onChange={o.onToggle} />}
      />
      {o.on && <div className="pe-opt-b">{o.children}</div>}
    </div>
  );
}

export function RowPane({ c, it }: { c: PaneCtx; it: ProgramItemDoc }) {
  const { p, t } = c;
  const first = firstName(c.audience);
  const items = dayItems(c.draft, it.day);
  const idx = items.findIndex((i) => i.id === it.id);
  const lifts = items.filter((i) => i.kind === 'strength');
  const patch = (x: Partial<ProgramItemDoc>) => c.edit((d) => patchItem(d, it.id, x));
  const remove = () => {
    const wasLast = lifts.length <= 1;
    c.edit((d) => removeItem(d, it.id));
    c.clear();
    c.onRemoved(it.day, wasLast);
  };
  if (it.kind === 'cardio') {
    return (
      <Pane label={p.edInspCardio} readOnly={c.readOnly}>
        <header className="pe-ed-h">
          <IconTile icon="heartbeat" tone="conditioning" size={40} />
          <span>
            <b>{it.name}</b>
            <small>{p.edInspCardio}</small>
          </span>
        </header>
        <NumberStepper
          label={p.edCardioMin}
          unit="min"
          value={it.durationMin ?? 10}
          min={1}
          max={240}
          step={5}
          onChange={(n) => patch({ durationMin: n })}
        />
        <div className="pe-acts">
          <Button variant="danger" size={c.size} icon="trash" onClick={remove}>
            {p.edRemove}
          </Button>
        </div>
      </Pane>
    );
  }
  if (it.kind === 'warmup') return <WarmupPane c={c} it={it} remove={remove} />;
  if (it.kind !== 'strength') {
    return (
      <Pane label={p.edInspExercise} readOnly={c.readOnly}>
        <header className="pe-ed-h">
          <IconTile icon="snowflake" size={40} />
          <span>
            <b>{it.name}</b>
            <small>{p.edMarkerNote}</small>
          </span>
        </header>
        <p className="pe-p">{p.edMarkerBody}</p>
        <div className="pe-acts">
          <Button variant="danger" size={c.size} icon="trash" onClick={remove}>
            {p.edRemoveMarker}
          </Button>
        </div>
      </Pane>
    );
  }
  const f = c.host.catalog.facts(it.name);
  const bare = isBare(it);
  const partner = it.groupId
    ? items.find((x) => x.groupId === it.groupId && x.id !== it.id)
    : undefined;
  const equip = it.equipment ?? [];
  return (
    <Pane label={p.edInspExercise} readOnly={c.readOnly}>
      <header className="pe-ed-h">
        <ExerciseRow
          name={it.name}
          image={f.image}
          thumb={56}
          sub={[
            f.muscles
              .slice(0, 2)
              .map((m) => t.muscleGroups[m] ?? m)
              .join(' · '),
            f.equipment ? t.equipmentLabel(f.equipment) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          dense
        />
      </header>
      {f.flag && (
        <Chip size="xs" tone={f.flag.level === 'avoid' ? 'danger' : 'accent'} icon="warning">
          {f.flag.label}
        </Chip>
      )}
      {(c.host.exerciseLinks?.(it.name) ?? []).length > 0 && (
        <ChipGroup>
          {(c.host.exerciseLinks?.(it.name) ?? []).map((l) => (
            <Chip key={l.label} size="xs" icon={l.icon} onClick={l.onClick}>
              {l.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
      {c.features.targets && (
        <Segmented
          size="sm"
          fill
          label={p.edRowType}
          value={bare ? 'bare' : 'targets'}
          onChange={(v) => c.edit((d) => setRowMode(d, it.id, v === 'bare'))}
          options={[
            { value: 'bare', label: p.edJustEx },
            { value: 'targets', label: p.edWithTargets },
          ]}
        />
      )}
      {bare && c.features.targets ? (
        <>
          <p className="pe-p">{p.edBareBody(first)}</p>
          <div className="pe-acts">
            <Button
              variant="secondary"
              size={c.size}
              icon="plus"
              onClick={() => c.edit((d) => setRowMode(d, it.id, false))}
            >
              {p.edAddSets}
            </Button>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>{p.edSetsReps}</SectionLabel>
          <div className="pe-pair">
            <NumberStepper
              label={p.edSets}
              value={it.sets}
              min={1}
              max={20}
              onChange={(n) => patch({ sets: n })}
            />
            <NumberStepper
              label={p.edReps}
              value={it.reps}
              min={1}
              max={100}
              onChange={(n) => patch({ reps: n })}
            />
          </div>
          {c.features.targets && (
            <>
              <SectionLabel>{p.edTargetsOpt}</SectionLabel>
              <OptTarget
                label={p.edTargetWeight}
                hint={p.edShownAbove}
                notSet={p.edNotSet}
                on={!!it.targetWeight}
                onToggle={(v) => patch({ targetWeight: v ? 40 : undefined })}
              >
                <NumberStepper
                  label={p.edTargetWeight}
                  unit="kg"
                  value={it.targetWeight ?? 40}
                  min={0}
                  max={500}
                  step={2.5}
                  decimals={1}
                  onChange={(n) => patch({ targetWeight: n || undefined })}
                />
              </OptTarget>
              <OptTarget
                label={p.edTargetRpe}
                hint={p.edRpeHint}
                notSet={p.edNotSet}
                on={!!it.targetRpe}
                onToggle={(v) => patch({ targetRpe: v ? 8 : undefined })}
              >
                <NumberStepper
                  label={p.edTargetRpe}
                  value={it.targetRpe ?? 8}
                  min={5}
                  max={10}
                  step={0.5}
                  decimals={1}
                  onChange={(n) => patch({ targetRpe: n })}
                />
              </OptTarget>
              <OptTarget
                label={p.edRestBetween}
                hint={p.edRestHint}
                notSet={p.edNotSet}
                on={!!it.restSec}
                onToggle={(v) => patch({ restSec: v ? 90 : undefined })}
              >
                <NumberStepper
                  label={p.edRest}
                  unit="s"
                  value={it.restSec ?? 90}
                  min={0}
                  max={600}
                  step={15}
                  onChange={(n) => patch({ restSec: n || undefined })}
                />
              </OptTarget>
            </>
          )}
        </>
      )}
      <Field
        label={p.edNoteTo}
        value={it.note ?? ''}
        placeholder={p.edNotePh}
        maxLength={120}
        onChange={(e) => patch({ note: e.target.value })}
      />
      {c.features.preview && (
        <>
          <SectionLabel>{p.edWhatSees(first)}</SectionLabel>
          <ExerciseAsClient it={it} c={c} />
        </>
      )}
      <SectionLabel>{p.edMore}</SectionLabel>
      <div className="pe-more">
        <span className="pe-more-l">{p.edEquipment}</span>
        <ChipGroup>
          {c.host.equipment.slice(0, 12).map((e) => {
            const on = equip.includes(e);
            return (
              <Chip
                key={e}
                size="xs"
                selected={on}
                icon={on ? 'check' : undefined}
                aria-pressed={on}
                onClick={() =>
                  c.edit((d) =>
                    setEquipment(d, it.id, on ? equip.filter((x) => x !== e) : [...equip, e]),
                  )
                }
              >
                {t.equipmentLabel(e)}
              </Chip>
            );
          })}
        </ChipGroup>
        <ListRow
          as="label"
          dense
          label={p.edDropLast}
          trailing={
            <Switch
              checked={!!it.dropLast}
              size="sm"
              aria-label={p.edDropLast}
              onChange={(v) => patch({ dropLast: v })}
            />
          }
        />
        {c.features.supersets && (
          <ListRow
            dense
            label={p.edSuperWith}
            value={partner ? undefined : p.edChooseEx}
            trailing={
              partner ? (
                <Button
                  variant="link"
                  size={c.size}
                  onClick={() => c.edit((d) => ungroup(d, it.id))}
                >
                  {p.edUngroup(partner.name)}
                </Button>
              ) : undefined
            }
            chevron={!partner}
            disabled={lifts.length < 2}
            onClick={partner ? undefined : () => c.setPane('pair')}
          />
        )}
      </div>
      <div className="pe-acts is-four">
        <Button
          variant="secondary"
          size={c.size}
          icon="arrow-up"
          disabled={idx <= 0}
          aria-label={p.edMoveUp}
          onClick={() => c.edit((d) => moveItem(d, it.id, -1))}
        >
          {p.edUp}
        </Button>
        <Button
          variant="secondary"
          size={c.size}
          icon="arrow-down"
          disabled={idx >= items.length - 1}
          aria-label={p.edMoveDown}
          onClick={() => c.edit((d) => moveItem(d, it.id, 1))}
        >
          {p.edDown}
        </Button>
        <Button variant="secondary" size={c.size} icon="swap" onClick={() => c.setPane('swap')}>
          {p.edSwap}
        </Button>
        <Button variant="danger" size={c.size} icon="trash" onClick={remove}>
          {p.edRemove}
        </Button>
      </div>
    </Pane>
  );
}
