import { useState, type CSSProperties } from 'react';
import { IconTile } from './IconTile';
import './ExerciseThumb.css';

export type ExerciseThumbSize = 32 | 40 | 48 | 56;

export interface ExerciseThumbProps {
  /** Catalog picture URL; absent or failing = the neutral icon tile (never a blank slot). */
  src?: string;
  size?: ExerciseThumbSize;
  className?: string;
}

/** The picture of an exercise (kit group `Coach/Exercise row`): decorative, the name is always next to it. */
export function ExerciseThumb({ src, size = 40, className }: ExerciseThumbProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src)
    return <IconTile size={size === 32 ? 32 : size} icon="barbell" outline className={className} />;
  return (
    <img
      className={['uithumb', className].filter(Boolean).join(' ')}
      style={{ '--uithumb': `${size}px` } as CSSProperties}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(src)}
    />
  );
}
