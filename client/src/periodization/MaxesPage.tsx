/**
 * The Maxes page (design SPO-609, M6–M8 / D6): the maxes a "% of max" is turned into kilograms against. A row per exercise the
 * person's programs ask a percent for, plus any they typed or have a history estimate for. Tap a row to take the estimate from
 * history or type one by hand. Everything here comes from the kit.
 */
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Notice } from '../components/ui/Notice';
import { PageHead } from '../components/ui/PageHead';
import { Segmented } from '../components/ui/Segmented';
import { Tag } from '../components/ui/Tag';
import { useProgramMine } from '../data/programMine';
import { useT } from '../i18n';
import { useStore } from '../store';
import { maxInfo, type MaxInfo } from './maxes';
import { maxKey, MAX_KG } from './maxesData';
import { clearMax, saveMax, useTypedMaxes } from './maxesSync';
import { fill, STRINGS } from './strings';
import './periodization.css';

/** Names of the exercises the person's current program prescribes as a percent. */
function programNames(a: ReturnType<typeof useProgramMine>['assignment']): string[] {
  if (!a) return [];
  const p = a.program as unknown as {
    items?: { name: string; targetPct?: number }[];
    cycle?: { weeks: { items: { name: string; targetPct?: number }[] }[] };
  };
  const rows = [...(p.items ?? []), ...(p.cycle?.weeks.flatMap((w) => w.items) ?? [])];
  return rows.filter((r) => r.targetPct && r.name.trim()).map((r) => r.name.trim());
}

export function MaxesPage({ onClose }: { onClose: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const typed = useTypedMaxes();
  const { assignment } = useProgramMine();
  useStore(); // history changes re-read the estimates
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of [...programNames(assignment), ...Object.values(typed.maxes).map((m) => m.name)])
      if (!seen.has(maxKey(n))) seen.set(maxKey(n), n);
    return [...seen.values()];
  }, [assignment, typed]);

  if (editing !== null) return <MaxEdit name={editing} onBack={() => setEditing(null)} />;
  if (adding)
    return (
      <AddMax
        onBack={() => setAdding(false)}
        onNext={(n) => {
          setAdding(false);
          setEditing(n);
        }}
      />
    );

  return (
    <div className="screen">
      <div className="pd-page">
        <PageHead back={{ label: s.back, onClick: onClose }} title={s.name} sub={s.sub} />
        {names.length === 0 ? (
          <EmptyState icon="barbell" title={s.emptyTitle} body={s.emptyBody}>
            <Button icon="plus" onClick={() => setAdding(true)}>
              {s.add}
            </Button>
          </EmptyState>
        ) : (
          <>
            <GroupedList header={s.used}>
              {names.map((n) => (
                <MaxRow key={maxKey(n)} name={n} info={maxInfo(n)} onOpen={() => setEditing(n)} />
              ))}
            </GroupedList>
            <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>
              {s.add}
            </Button>
            <Notice tone="accent" icon="info">
              {s.note}
            </Notice>
          </>
        )}
      </div>
    </div>
  );
}

function MaxRow({ name, info, onOpen }: { name: string; info: MaxInfo; onOpen: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  return (
    <ListRow
      label={name}
      sub={info.source === 'none' ? s.none : info.source === 'typed' ? s.typed : s.history}
      chevron
      trailing={
        info.kg === null ? (
          <Tag tone="illness">{s.setIt}</Tag>
        ) : (
          <span className="pd-v">
            {info.kg} {s.kg}
          </span>
        )
      }
      onClick={onOpen}
    />
  );
}

/** Edit one max: take the estimate from history, or type it by hand. */
function MaxEdit({ name, onBack }: { name: string; onBack: () => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const info = maxInfo(name);
  const [mode, setMode] = useState<'hist' | 'hand'>(info.source === 'typed' ? 'hand' : 'hist');
  const [kg, setKg] = useState(info.kg ?? info.estimate ?? 100);
  const canSave = mode === 'hand' || info.estimate !== null;

  const [failed, setFailed] = useState(false);
  const save = async () => {
    setFailed(false);
    try {
      if (mode === 'hand') await saveMax(name, kg);
      else await clearMax(name);
      onBack();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="screen">
      <div className="pd-page">
        <PageHead back={{ label: s.name, onClick: onBack }} title={name} />
        <Segmented
          label={s.source}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'hist', label: s.fromHistory },
            { value: 'hand', label: s.typeIt },
          ]}
        />
        <div className="pd-edit">
          {mode === 'hist' ? (
            <GroupedList>
              {info.estimate === null ? (
                <ListRow label={s.estimated} sub={s.noEstimate} />
              ) : (
                <ListRow label={s.estimated} value={`${info.estimate} ${s.kg}`} />
              )}
            </GroupedList>
          ) : (
            <>
              <NumberStepper
                label={s.maxLabel}
                value={kg}
                onChange={setKg}
                step={2.5}
                min={0}
                max={MAX_KG}
                decimals={1}
                unit={s.kg}
              />
              {info.estimate !== null && info.source === 'typed' && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setMode('hist');
                  }}
                >
                  {fill(s.useEstimate, { kg: info.estimate })}
                </Button>
              )}
            </>
          )}
          {failed && (
            <Notice tone="danger" icon="warning">
              {s.saveFailed}
            </Notice>
          )}
          <Button fullWidth disabled={!canSave} onClick={() => void save()}>
            {s.save}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Add a max for an exercise by name (one that no program asks a percent for yet). */
function AddMax({ onBack, onNext }: { onBack: () => void; onNext: (name: string) => void }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const [name, setName] = useState('');
  return (
    <div className="screen">
      <div className="pd-page">
        <PageHead back={{ label: s.name, onClick: onBack }} title={s.add} />
        <Field
          label={s.exercise}
          hint={s.exerciseHint}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
        <Button fullWidth disabled={!name.trim()} onClick={() => onNext(name.trim())}>
          {s.next}
        </Button>
      </div>
    </div>
  );
}
