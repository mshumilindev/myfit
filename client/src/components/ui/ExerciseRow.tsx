import './ExerciseRow.css';
import type { ReactNode } from 'react';
import { ExerciseThumb, type ExerciseThumbSize } from './ExerciseThumb';
import { ListRow } from './GroupedList';

export interface ExerciseRowProps {
  name: string;
  image?: string;
  /** Muscles / equipment line. */
  sub?: ReactNode;
  /** Prescription line ("3 × 6 · target 60 kg · RPE 8"); omitted for a bare exercise: name and picture only. */
  prescription?: ReactNode;
  /** Superset badge ("A1"). */
  badge?: string;
  selected?: boolean;
  chevron?: boolean;
  onClick?: () => void;
  thumb?: ExerciseThumbSize;
  /** Spoken name of the row when it is a button. */
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  trailing?: ReactNode;
  dense?: boolean;
}

/**
 * One exercise of a program day (kit group `Coach/Exercise row`): picture, name, muscles, what is prescribed. The Coach
 * editor and the client's program view draw it the same way, so "what Oleh sees" is the real row. A bare exercise
 * has no prescription: the row stays name + picture.
 */
export function ExerciseRow({
  name,
  image,
  sub,
  prescription,
  badge,
  selected,
  chevron,
  onClick,
  thumb = 40,
  trailing,
  dense = true,
  ...aria
}: ExerciseRowProps) {
  // a toggle state only makes sense on a button
  if (!onClick) delete aria['aria-pressed'];
  return (
    <ListRow
      dense={dense}
      strong
      selected={selected}
      icon={
        <>
          {badge && <span className="uiex-badge">{badge}</span>}
          <ExerciseThumb src={image} size={thumb} />
        </>
      }
      label={name}
      sub={
        sub != null || prescription != null ? (
          <>
            {sub != null && <span className="uiex-sub">{sub}</span>}
            {prescription != null && <span className="uiex-rx">{prescription}</span>}
          </>
        ) : undefined
      }
      chevron={chevron}
      trailing={trailing}
      onClick={onClick}
      {...aria}
    />
  );
}
