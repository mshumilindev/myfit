/**
 * Equipment taxonomy for the exercise catalog. The closed set mirrors
 * free-exercise-db's `equipment` field (public domain, Unlicense). Icons are
 * bundled SVG bodies pulled once from Iconify (open licences: Apache/MIT/CC),
 * so equipment renders offline with zero runtime requests.
 */
import ICONS from './equipment.icons.json';

export type EquipmentId =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'body'
  | 'kettlebell'
  | 'bands'
  | 'medicineBall'
  | 'exerciseBall'
  | 'ezBar'
  | 'foamRoll'
  | 'suspension'
  | 'other';

export const EQUIPMENT_IDS: EquipmentId[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'body',
  'bands',
  'medicineBall',
  'exerciseBall',
  'ezBar',
  'foamRoll',
  'suspension',
  'other',
];

interface IconDef {
  body: string;
  w: number;
  h: number;
  id: string;
}

const iconMap = ICONS as Record<EquipmentId, IconDef>;

/** Inline SVG for an equipment id — same 1em sizing contract as <Icon>. */
export function EquipmentIcon({
  equipment,
  size = '1em',
  className,
}: {
  equipment: EquipmentId;
  size?: number | string;
  className?: string;
}) {
  const def = iconMap[equipment] ?? iconMap.other;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${def.w} ${def.h}`}
      fill="currentColor"
      aria-hidden
      // Iconify bodies are self-contained path markup.
      dangerouslySetInnerHTML={{ __html: def.body }}
    />
  );
}
