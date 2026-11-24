/** The line under an exercise in a live session that was prescribed as a % of max: the percent, the kilograms, the rep range. */
import { Tag } from '../components/ui/Tag';
import { useT } from '../i18n';
import type { Exercise } from '../types';
import { fill, STRINGS } from './strings';
import './periodization.css';

export function TargetLine({ exercise }: { exercise: Exercise }) {
  const { locale } = useT();
  const s = STRINGS[locale];
  const pct = exercise.plannedPct;
  if (!pct) return null;
  const range =
    exercise.plannedRepsMin && exercise.plannedReps
      ? fill(s.repsRange, { range: `${exercise.plannedRepsMin}–${exercise.plannedReps}` })
      : null;
  return (
    <div className="pd-target">
      {exercise.plannedKg ? (
        <Tag tone="accent">{fill(s.targetPct, { pct, kg: exercise.plannedKg })}</Tag>
      ) : (
        <>
          <Tag tone="illness">{fill(s.targetNoMax, { pct })}</Tag>
          <span className="ut-xs ut-faint">{s.noMaxHint}</span>
        </>
      )}
      {range && <span className="ut-xs ut-faint">{range}</span>}
    </div>
  );
}
