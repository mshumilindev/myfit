import { Button } from '../../../../components/ui/Button';
import { ListRow } from '../../../../components/ui/GroupedList';
import { IconTile } from '../../../../components/ui/IconTile';
import { NumberStepper } from '../../../../components/ui/NumberStepper';
import { Segmented } from '../../../../components/ui/Segmented';
import { SectionLabel } from '../../../../components/ui/SectionLabel';
import { Select } from '../../../../components/ui/Select';
import { Icon } from '../../../../ui';
import { dayName, type ProgramActivityDoc } from '../../model/doc';
import { patchActivity } from '../../model/ops';
import { firstName } from '../text';
import { Head, Pane, PaneCtx } from './PaneShared';

export function ActAddPane({ c, onAdd }: { c: PaneCtx; onAdd: (type: string) => void }) {
  const { p, t } = c;
  return (
    <Pane label={p.edInspAddAct} readOnly={c.readOnly}>
      <Head c={c} title={p.edBackTo(p.edBackDay)} sub={p.edActAddTo(dayName(c.draft, c.day))} />
      <ul className="pe-pick">
        {c.host.activities.map((type) => {
          const k = type.key;
          return (
            <li key={k}>
              <ListRow
                dense
                strong
                icon={<IconTile icon={type.icon} tone="conditioning" size={40} />}
                label={t.actType[k] ?? k}
                sub={type.category === 'recovery' ? p.edActRecovery : p.edActConditioning}
                trailing={<Icon name="plus" />}
                onClick={() => onAdd(k)}
              />
            </li>
          );
        })}
      </ul>
      <p className="pe-p">{p.edActBody}</p>
    </Pane>
  );
}

export function ActPane({ c, a }: { c: PaneCtx; a: ProgramActivityDoc }) {
  const { p, t } = c;
  const type = c.host.activities.find((x) => x.key === a.type);
  const patch = (x: Partial<ProgramActivityDoc>) => c.edit((d) => patchActivity(d, a.id, x));
  return (
    <Pane label={p.edInspActivity} readOnly={c.readOnly}>
      <header className="pe-ed-h">
        <IconTile icon={type?.icon ?? 'heartbeat'} tone="conditioning" size={40} />
        <span>
          <b>{t.actType[a.type] ?? a.type}</b>
          <small>
            {type?.category === 'recovery' ? p.edActRecovery : p.edActConditioning} ·{' '}
            {dayName(c.draft, a.day)}
          </small>
        </span>
      </header>
      <Select label={p.edActivity} value={a.type} onChange={(e) => patch({ type: e.target.value })}>
        {c.host.activities.map((x) => (
          <option key={x.key} value={x.key}>
            {t.actType[x.key] ?? x.key}
          </option>
        ))}
      </Select>
      <NumberStepper
        label={p.edDuration}
        unit="min"
        value={a.minutes}
        min={5}
        max={300}
        step={5}
        onChange={(n) => patch({ minutes: n })}
      />
      <SectionLabel>{p.edEffort}</SectionLabel>
      <Segmented
        size="sm"
        fill
        label={p.edEffort}
        value={a.effort}
        onChange={(v) => patch({ effort: v })}
        options={(['light', 'moderate', 'hard'] as const).map((v) => ({
          value: v,
          label: t.actEffortLevel[v] ?? v,
        }))}
      />
      <SectionLabel>{p.edWhen}</SectionLabel>
      <Segmented
        size="sm"
        fill
        label={p.edWhen}
        value={a.when}
        onChange={(v) => patch({ when: v })}
        options={[
          { value: 'any', label: p.edWhenAny },
          { value: 'before', label: p.edWhenBefore },
          { value: 'after', label: p.edWhenAfter },
        ]}
      />
      <p className="pe-p">
        {p.edActCounts(
          firstName(c.audience),
          type?.category === 'recovery' ? p.edRecovery : p.edCardio,
        )}
      </p>
      <div className="pe-acts">
        <Button variant="danger" size={c.size} icon="trash" onClick={() => c.removeActivity(a.id)}>
          {p.edRemove}
        </Button>
      </div>
    </Pane>
  );
}
