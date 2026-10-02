/**
 * The one own-move form (create / edit): name, measure, muscle, icon, and Delete for an
 * existing move. The caller owns the chrome and the Save button — the Home set page puts
 * it in its action bar, the in-session move picker in its sheet — so this returns the
 * fields plus `canSave` / `save`. Save needs a valid name and, when editing, a change.
 */
import { useState, type ReactNode } from 'react';
import { deleteHomeMove, saveHomeMove, useStore } from '../store';
import {
  HOME_ICONS,
  HOME_MUSCLES,
  ownMoveNameError,
  type HomeIcon,
  type HomeMeasure,
  type HomeMove,
} from '../homeSets';
import type { MuscleGroup } from '../data/exercises';
import { useT } from '../i18n';
import { ConfirmDialog } from '../ui';
import { Field } from './ui/Field';
import { GroupedList, ListRow } from './ui/GroupedList';
import { PresetChips } from './ui/PresetChips';
import { SectionLabel } from './ui/SectionLabel';
import { Segmented } from './ui/Segmented';
import { HomeMoveIcon } from './HomeMoveIcon';

export function useOwnMoveForm(
  move: HomeMove | null,
  on: { onSaved: (m: HomeMove) => void; onDeleted?: (id: string) => void },
): { fields: ReactNode; canSave: boolean; save: () => void } {
  const { t } = useT();
  const store = useStore();
  const [name, setName] = useState(move?.name ?? '');
  const [measure, setMeasure] = useState<HomeMeasure>(move?.measure ?? 'reps');
  const [muscle, setMuscle] = useState<MuscleGroup>(move?.muscle ?? 'core');
  const [icon, setIcon] = useState<HomeIcon>(move?.icon ?? 'body');
  const [confirm, setConfirm] = useState(false);
  const err = ownMoveNameError(store.home, name, move?.id ?? null);
  const usedIn = move ? store.home.sets.filter((s) => s.moves.includes(move.id)) : [];
  const dirty = move
    ? name.trim() !== move.name ||
      measure !== move.measure ||
      muscle !== move.muscle ||
      icon !== move.icon
    : true;
  const muscleName = (g: string) => (t.muscleGroups as Record<string, string>)[g] ?? g;

  const fields = (
    <>
      <Field
        label={t.homeNameLabel}
        value={name}
        maxLength={40}
        placeholder={t.homeMovePlaceholder}
        error={err === 'taken' ? t.homeNameTaken : undefined}
        onChange={(e) => setName(e.target.value)}
      />
      <div>
        <SectionLabel>{t.homeMeasuredBy}</SectionLabel>
        <Segmented
          value={measure}
          onChange={setMeasure}
          label={t.homeMeasuredBy}
          options={(['reps', 'hold', 'time'] as const).map((k) => ({
            value: k,
            label: t.homeMeasureName[k],
          }))}
        />
      </div>
      <div>
        <SectionLabel>{t.homeMuscle}</SectionLabel>
        <PresetChips
          label={t.homeMuscle}
          items={HOME_MUSCLES.map((g) => ({
            id: g,
            label: muscleName(g),
            selected: muscle === g,
            onClick: () => setMuscle(g),
          }))}
        />
      </div>
      <div>
        <SectionLabel>{t.homeIcon}</SectionLabel>
        <PresetChips
          label={t.homeIcon}
          items={HOME_ICONS.map((k) => ({
            id: k,
            label: <HomeMoveIcon icon={k} />,
            selected: icon === k,
            onClick: () => setIcon(k),
          }))}
        />
      </div>
      {move && (
        <GroupedList>
          <ListRow action tone="danger" label={t.homeDeleteMove} onClick={() => setConfirm(true)} />
        </GroupedList>
      )}
      {confirm && move && (
        <ConfirmDialog
          title={t.homeDeleteMoveTitle(move.name)}
          body={
            usedIn.length > 0
              ? t.homeDeleteMoveBodyIn(usedIn.map((s) => `“${s.name}”`).join(', '))
              : t.homeDeleteMoveBody
          }
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            deleteHomeMove(move.id);
            setConfirm(false);
            on.onDeleted?.(move.id);
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );

  return {
    fields,
    canSave: name.trim().length > 0 && !err && dirty,
    save: () => on.onSaved(saveHomeMove({ id: move?.id, name, measure, muscle, icon })),
  };
}
