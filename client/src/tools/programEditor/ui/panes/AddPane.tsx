import { useMemo, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Chip, ChipGroup } from '../../../../components/ui/Chip';
import { ExerciseRow } from '../../../../components/ui/ExerciseRow';
import { ListRow } from '../../../../components/ui/GroupedList';
import { IconTile } from '../../../../components/ui/IconTile';
import { SearchField } from '../../../../components/ui/SearchField';
import { SectionLabel } from '../../../../components/ui/SectionLabel';
import { Icon } from '../../../../ui';
import { dayItems, dayName, type MuscleGroup } from '../../model/doc';
import { cleanExerciseName } from '../../model/ops';
import { Head, Pane, PaneCtx } from './PaneShared';

const FILTER_MUSCLES: MuscleGroup[] = [
  'chest',
  'lats',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];

export function AddPane({ c }: { c: PaneCtx }) {
  const { p, t } = c;
  const [q, setQ] = useState('');
  const [m, setM] = useState<MuscleGroup | 'all'>('all');
  const taken = useMemo(() => dayItems(c.draft, c.day).map((i) => i.name), [c.draft, c.day]);
  const dayM = c.draft.targetMuscles[String(c.day)]?.[0];
  const list = useMemo(
    () =>
      c.host.catalog.search({
        query: q,
        muscle: m === 'all' ? (q ? undefined : dayM && dayM !== 'fullbody' ? dayM : 'chest') : m,
        limit: 8,
      }),
    [q, m, dayM, c.host.catalog],
  );
  const typed = cleanExerciseName(q);
  const canon = typed ? (c.host.canonicalName?.(typed) ?? typed) : '';
  const known =
    !!canon &&
    (list.some((x) => x.name.toLowerCase() === canon.toLowerCase()) ||
      c.host.catalog.facts(canon).primary !== null ||
      !!c.host.catalog.facts(canon).image);
  const taken1 = !!canon && taken.some((n) => n.toLowerCase() === canon.toLowerCase());
  const canCreate = c.features.customExercise && !c.readOnly && !!canon && !known && !taken1;
  return (
    <Pane label={p.edInspAdd} readOnly={c.readOnly}>
      <Head c={c} title={p.edBackTo(p.edBackDay)} sub={p.edAddTo(dayName(c.draft, c.day))} />
      <p className="pe-p">{p.edAddedAs}</p>
      {c.host.slots?.exercisePicker && !c.readOnly && (
        <Button
          variant="secondary"
          size={c.size}
          icon="magnifying-glass"
          fullWidth
          onClick={c.openPicker}
        >
          {p.edBrowseAll}
        </Button>
      )}
      <SearchField
        value={q}
        onChange={setQ}
        placeholder={p.edSearchEx}
        clearLabel={p.edClearSearch}
      />
      <ChipGroup>
        <Chip
          size="xs"
          selected={m === 'all'}
          aria-pressed={m === 'all'}
          onClick={() => setM('all')}
        >
          {p.edAll}
        </Chip>
        {FILTER_MUSCLES.map((x) => (
          <Chip key={x} size="xs" selected={m === x} aria-pressed={m === x} onClick={() => setM(x)}>
            {t.muscleGroups[x] ?? x}
          </Chip>
        ))}
      </ChipGroup>
      <ul className="pe-pick">
        {list.map((x) => {
          const has = taken.some((n) => n.toLowerCase() === x.name.toLowerCase());
          return (
            <li key={x.name}>
              <ExerciseRow
                name={x.name}
                image={x.image}
                sub={[
                  t.muscleGroups[x.muscle] ?? x.muscle,
                  x.equipment ? t.equipmentLabel(x.equipment) : '',
                  x.flag?.label ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  has ? (
                    <Chip size="xs" nested>
                      {p.edAdded}
                    </Chip>
                  ) : (
                    <Icon name="plus" />
                  )
                }
                onClick={has ? undefined : () => c.addExercise(x.name)}
              />
            </li>
          );
        })}
        {canCreate && (
          <li>
            <ListRow
              dense
              icon={<IconTile icon="plus" size={40} />}
              label={p.edCreateEx(canon)}
              sub={p.edCreateExNote}
              onClick={() => c.createExercise(canon)}
            />
          </li>
        )}
        {!list.length && !canCreate && <li className="pe-p">{q ? p.edNoMatch(q) : p.edBrowse}</li>}
      </ul>
      {c.features.cardio && (c.host.cardio ?? []).length > 0 && (
        <>
          <SectionLabel>{p.edAddCardio}</SectionLabel>
          <ChipGroup>
            {(c.host.cardio ?? []).map((m) => (
              <Chip
                key={m.name}
                size="xs"
                icon={m.icon ?? 'heartbeat'}
                onClick={() => c.addCardio(m.name)}
              >
                {m.name}
              </Chip>
            ))}
          </ChipGroup>
        </>
      )}
      {c.features.markers && (
        <ChipGroup>
          <Chip size="xs" icon="flame" onClick={() => c.addMarker('warmup')}>
            {p.edWarmMarker}
          </Chip>
          <Chip size="xs" icon="snowflake" onClick={() => c.addMarker('cooldown')}>
            {p.edCoolMarker}
          </Chip>
        </ChipGroup>
      )}
    </Pane>
  );
}
