import type { ReactNode } from 'react';
import { exerciseNeeds } from '../store';
import { muscleInfoByName, type MuscleGroup } from '../data/exercises';
import { EquipChip, MuscleChip } from '../components/Muscle';

/** The muscles an exercise works and the kit it needs, as chips; `empty` shows when it has neither. */
export function ExerciseChips({
  name,
  empty,
  onMuscle,
}: {
  name: string;
  empty: ReactNode;
  onMuscle: (muscle: MuscleGroup) => void;
}) {
  const info = muscleInfoByName(name);
  const needs = exerciseNeeds(name);
  if (!info && needs.length === 0) return <>{empty}</>;
  return (
    <div className="hist-chips hist-chips--tight ua-center">
      {info && info.primary !== 'cardio' && (
        <MuscleChip muscle={info.primary} tone="primary" onClick={onMuscle} detail />
      )}
      {info?.secondary.map((m) => (
        <MuscleChip key={m} muscle={m} tone="secondary" onClick={onMuscle} detail />
      ))}
      {needs.map((id) => (
        <EquipChip key={id} id={id} />
      ))}
    </div>
  );
}
