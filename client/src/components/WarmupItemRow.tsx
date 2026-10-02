/**
 * WarmupItemRow — one exercise of a warm-up block, in one of three states:
 *  - `pending`: the cut-down standard logger (photo + name, reps / weight or
 *    seconds, a Log button). Nothing is recorded until Log is pressed, and only
 *    ONE set can be logged.
 *  - `logged`: it collapses into a one-line row ("12 reps · 10 kg") with an Edit
 *    button that opens a drawer holding the same logger (Save / Remove).
 *  - `target`: a program day's prescription — the same line, no Log anywhere.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { exerciseImage } from '../data/exercises';
import { kgToLb } from '../plates';
import { exerciseUnit } from '../store';
import { useExerciseName, Sheet } from '../ui';
import { isTimedWarmupName, warmupUsesWeight, type WarmupValues } from '../warmupLog';
import { IconButton } from './ui/Button';
import { ListRow } from './ui/GroupedList';
import { WarmupLogger } from './WarmupLogger';
import './WarmupCard.css';

export interface WarmupRowValue {
  name: string;
  reps?: number;
  durationSec?: number;
  /** kg */
  weight?: number;
}

export type WarmupRowStatus = 'pending' | 'logged' | 'target';

/** "12 reps · 10 kg" / "30 s" — what the one set was (or should be). */
export function useWarmupValueText(): (item: WarmupRowValue) => string {
  const { t } = useT();
  return (item) => {
    const unit = exerciseUnit(item.name);
    const parts: string[] = [];
    if (item.durationSec) parts.push(`${item.durationSec} ${t.wuSecUnit}`);
    else if (item.reps) parts.push(`${item.reps} ${t.reps.toLowerCase()}`);
    if (item.weight && !item.durationSec)
      parts.push(
        unit === 'lb'
          ? `${Math.round(kgToLb(item.weight) * 10) / 10} lb`
          : `${Math.round(item.weight * 100) / 100} kg`,
      );
    return parts.join(' · ');
  };
}

export function WarmupItemRow(props: {
  item: WarmupRowValue;
  status: WarmupRowStatus;
  /** Weight to pre-fill a pending logger with when the item has none (history). */
  suggestWeightKg?: number;
  /** Pending: Log pressed. Logged / target: Save in the drawer. */
  onSubmit: (values: WarmupValues) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const { t } = useT();
  const exName = useExerciseName();
  const valueText = useWarmupValueText();
  const [editing, setEditing] = useState(false);
  const { item } = props;
  const timed = item.durationSec !== undefined || (!item.reps && isTimedWarmupName(item.name));
  const weighted = !timed && (warmupUsesWeight(item.name) || !!item.weight);
  const label = exName(item.name);
  const initial: WarmupValues = {
    ...(item.reps ? { reps: item.reps } : {}),
    ...(item.durationSec ? { durationSec: item.durationSec } : {}),
    ...(item.weight
      ? { weight: item.weight }
      : props.suggestWeightKg && weighted
        ? { weight: props.suggestWeightKg }
        : {}),
  };

  if (props.status === 'pending') {
    return (
      <WarmupLogger
        name={item.name}
        timed={timed}
        weighted={weighted}
        initial={initial}
        actionLabel={t.log}
        onSubmit={props.onSubmit}
        onRemove={props.onRemove}
      />
    );
  }

  const img = exerciseImage(item.name, 'strength');
  return (
    <>
      <ListRow
        dense
        icon={img ? <img className="wu-thumb" src={img} alt="" /> : undefined}
        label={label}
        value={valueText(item)}
        trailing={
          !props.readOnly && (
            <IconButton
              icon="pencil-simple"
              label={t.wuEdit(label)}
              onClick={() => setEditing(true)}
            />
          )
        }
      />
      {editing && (
        <Sheet tone="warmup" onClose={() => setEditing(false)}>
          <WarmupLogger
            plain
            name={item.name}
            timed={timed}
            weighted={weighted}
            initial={initial}
            actionLabel={t.save}
            onSubmit={(v) => {
              props.onSubmit(v);
              setEditing(false);
            }}
            onRemove={() => {
              props.onRemove();
              setEditing(false);
            }}
            removeAsButton
            confirmBeforeRemove={props.status === 'logged'}
            requireChange
          />
        </Sheet>
      )}
    </>
  );
}
