/**
 * The athlete app's full "Add exercise" picker as the program editor's `exercisePicker` slot: the same picker the
 * session uses (family tiles, equipment, details, search), in its plain program-authoring form (no recommendations,
 * readiness or last loads), with "Create <name>", warm-up / cool-down markers and the cardio machine list.
 * Exercises created by name are kept by name inside the sealed program; nothing else is written (the shared catalog
 * is only extended from the session's "new exercise" sheet by admins and trainers).
 */
import { useState } from 'react';
import { CardioMachineList } from '../../components/CardioMachineList';
import { ExercisePicker } from '../../components/ExercisePicker';
import { useT } from '../../i18n';
import type { ExercisePickerSlotProps } from '../../tools/programEditor';
import type { Workout } from '../../types';
import { Sheet } from '../../components/ui/Overlays';

/** Program authoring has no live workout: the picker only needs a blank one. */
const PLAIN_WORKOUT: Workout = {
  id: 'program-authoring',
  startedAt: 0,
  finishedAt: null,
  autoFinished: false,
  gymId: null,
  exercises: [],
};

export function SelfExercisePicker(p: ExercisePickerSlotProps) {
  const { t } = useT();
  const [machines, setMachines] = useState(false);
  if (machines) {
    return (
      <Sheet onClose={p.onClose}>
        <div className="sheet-label">{t.cardioMachineTitle}</div>
        <CardioMachineList gym={null} onPick={(_id, name) => p.onCardio(name)} />
      </Sheet>
    );
  }
  return (
    <ExercisePicker
      plain
      workout={PLAIN_WORKOUT}
      gym={null}
      subtitle={p.dayLabel}
      added={[...p.taken]}
      addLabel={t.pgAddTo(p.dayLabel)}
      onPick={(i) => p.onPick(i.name)}
      onMarker={p.onMarker}
      onCardio={() => setMachines(true)}
      onCreate={p.onCreate}
      onClose={p.onClose}
    />
  );
}
