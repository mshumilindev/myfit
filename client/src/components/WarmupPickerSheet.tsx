/**
 * WarmupPickerSheet — "Add to warm-up": stretching / mobility (plus the curated
 * activation and light-cardio moves) from the exercise library, searchable in
 * any language, with a one-tap custom name. Moves the person's conditions or
 * injuries advise against stay pickable but carry the usual caution line.
 */
import { useMemo, useState } from 'react';
import { exerciseFlag } from '../conditions';
import { exerciseSearchText, type RichExercise } from '../data/exercises';
import { useConditionLimits } from '../healthBuild';
import { useT } from '../i18n';
import { tokenMatch } from '../search';
import { Icon, Sheet, useExerciseName } from '../ui';
import { GroupedList, ListRow } from './ui/GroupedList';
import { IconTile } from './ui/IconTile';
import { SearchField } from './ui/SearchField';
import { warmupCatalog, warmupSuggestions, type WarmupSuggestion } from '../warmupFor';
import type { MuscleGroup } from '../data/exercises';

export interface WarmupPick {
  name: string;
  exerciseId?: string;
  durationSec?: number;
  reps?: number;
}

const LIMIT = 30;

export function WarmupPickerSheet(props: {
  muscles: readonly MuscleGroup[];
  /** Names already on the list (marked, never blocked). */
  added: readonly string[];
  onPick: (pick: WarmupPick) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const exName = useExerciseName();
  const limits = useConditionLimits();
  const [q, setQ] = useState('');
  const query = q.trim();
  const have = useMemo(() => new Set(props.added.map((n) => n.toLowerCase())), [props.added]);

  const rows = useMemo<(RichExercise | WarmupSuggestion)[]>(() => {
    if (!query) {
      const s = warmupSuggestions({ muscles: props.muscles, limits, locale });
      return [...s.mobility, ...s.activation, ...s.cardio];
    }
    return warmupCatalog()
      .filter((r) =>
        tokenMatch(
          exerciseSearchText(r.name, [...r.primaryMuscles, ...r.secondaryMuscles], r.equipment),
          query.toLowerCase(),
        ),
      )
      .slice(0, LIMIT);
  }, [query, props.muscles, limits, locale]);

  const exact = rows.some((r) => r.name.toLowerCase() === query.toLowerCase());
  const pick = (p: WarmupPick) => {
    props.onPick(p);
    props.onClose();
  };

  return (
    <Sheet onClose={props.onClose}>
      <div className="sheet-label">{t.wuPickerTitle}</div>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder={t.wuPickerSearch}
        clearLabel={t.clearLabel}
      />
      <GroupedList surface="raised" className="umt-12">
        {query && !exact && (
          <ListRow
            icon={<IconTile icon="plus" tone="accent" />}
            label={t.wuCustom(query)}
            sub={t.wuCustomSub}
            onClick={() => pick({ name: query })}
          />
        )}
        {rows.map((r) => {
          const id = 'exerciseId' in r ? r.exerciseId : r.id;
          const flag = exerciseFlag(r.name, limits);
          const note =
            flag.level === 'avoid'
              ? t.pickNotAdvised
              : flag.level === 'caution'
                ? t.pickCareful
                : null;
          const draft: WarmupPick = {
            name: r.name,
            ...(id ? { exerciseId: id } : {}),
            ...('reps' in r && r.reps ? { reps: r.reps } : {}),
            ...('durationSec' in r && r.durationSec ? { durationSec: r.durationSec } : {}),
          };
          return (
            <ListRow
              key={'key' in r ? r.key : r.id}
              icon={<IconTile icon="flame" tone="accent" />}
              label={exName(r.name)}
              sub={note}
              value={have.has(r.name.toLowerCase()) ? <Icon name="check" /> : undefined}
              onClick={() => pick(draft)}
            />
          );
        })}
      </GroupedList>
    </Sheet>
  );
}
