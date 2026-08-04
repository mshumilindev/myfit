/**
 * Muscle-group silhouettes and chips (design MG-1, EQ-1).
 * One silhouette, one highlighted region: at chip size the mark locates —
 * upper body, arms, legs — and the word beside it carries the precision.
 * It is never used without its label.
 */
import type { CSSProperties } from 'react';
import type { MuscleGroup } from '../data/exercises';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { t as strings } from '../i18n';
import { Icon } from '../ui';

/** Muscles in the vocabulary order of the filter bar (MG-5). */
export const MUSCLE_IDS: Exclude<MuscleGroup, 'cardio'>[] = [
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'forearms',
  'fullbody',
];

const UPPER: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
];

type Tone = 'primary' | 'secondary' | 'muted' | 'onAccent';

/** Palette per tone: [dim base, region base, highlight]. */
const TONES: Record<Tone, [string, string, string]> = {
  primary: ['var(--color-neutral-800)', 'var(--color-neutral-700)', 'var(--color-accent)'],
  secondary: ['var(--color-neutral-800)', 'var(--color-neutral-700)', 'var(--color-neutral-500)'],
  muted: ['var(--color-neutral-800)', 'var(--color-neutral-700)', 'var(--color-accent-700)'],
  onAccent: ['var(--color-accent-700)', 'var(--color-accent-700)', 'var(--color-accent-300)'],
};

export type MuscleIconVariant = 'chip' | 'chipLg' | 'row' | 'figure' | 'full';

const SIZES: Record<MuscleIconVariant, [number, number]> = {
  chip: [8, 13],
  chipLg: [9, 15],
  row: [13, 22],
  figure: [13, 22],
  full: [15, 26],
};

/**
 * Inline SVG silhouette. `chip`/`row` subset the figure to the relevant half
 * (torso+arms for upper-body groups, torso+legs for lower); `figure`/`full`
 * draw the whole body with the head.
 */
export function MuscleIcon({
  muscle,
  variant = 'chip',
  tone = 'primary',
  className,
}: {
  muscle: MuscleGroup;
  variant?: MuscleIconVariant;
  tone?: Tone;
  className?: string;
}) {
  if (muscle === 'cardio') return null;
  const [w, h] = SIZES[variant];
  const [dim, region, hl] = TONES[tone];
  const bg = 'var(--color-bg)';
  const whole = variant === 'figure' || variant === 'full';
  const upper = UPPER.includes(muscle);
  const full = muscle === 'fullbody';
  const showHead = whole;
  const showArms = whole || full || upper;
  const showLegs = whole || full || !upper;

  const torsoFill = full
    ? hl
    : muscle === 'chest' || muscle === 'back' || muscle === 'core'
      ? region
      : dim;
  const armFill = full
    ? hl
    : muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms'
      ? region
      : dim;
  const legFill = full ? hl : !upper ? region : dim;

  return (
    <svg
      viewBox="0 0 20 34"
      className={className}
      style={{ width: w, height: h, display: 'block', flex: 'none' }}
      aria-hidden
    >
      {showHead && <circle cx="10" cy="3.4" r="2.6" fill={full ? hl : dim} />}
      <rect x="6" y="7" width="8" height="10" rx="2" fill={torsoFill} />
      {showArms && (
        <>
          <rect x="2.6" y="7.4" width="2.8" height="9" rx="1.4" fill={armFill} />
          <rect x="14.6" y="7.4" width="2.8" height="9" rx="1.4" fill={armFill} />
        </>
      )}
      {showLegs && (
        <>
          <rect x="6.3" y="18" width="3.2" height="12" rx="1.6" fill={legFill} />
          <rect x="10.5" y="18" width="3.2" height="12" rx="1.6" fill={legFill} />
        </>
      )}
      {muscle === 'chest' && <rect x="6.4" y="8" width="7.2" height="3.6" rx="1.6" fill={hl} />}
      {muscle === 'back' && (
        <>
          <rect x="6.4" y="9" width="7.2" height="6.4" rx="1.6" fill={hl} />
          <rect x="9.4" y="7.6" width="1.2" height="9" rx="0.6" fill={bg} />
        </>
      )}
      {muscle === 'shoulders' && (
        <>
          <circle cx="4" cy="8.6" r="2" fill={hl} />
          <circle cx="16" cy="8.6" r="2" fill={hl} />
        </>
      )}
      {muscle === 'biceps' && (
        <>
          <rect x="2.6" y="7.4" width="2.8" height="4.4" rx="1.4" fill={hl} />
          <rect x="14.6" y="7.4" width="2.8" height="4.4" rx="1.4" fill={hl} />
        </>
      )}
      {muscle === 'triceps' && (
        <>
          <rect x="2.6" y="11.5" width="2.8" height="4.9" rx="1.4" fill={hl} />
          <rect x="14.6" y="11.5" width="2.8" height="4.9" rx="1.4" fill={hl} />
        </>
      )}
      {muscle === 'forearms' && (
        <>
          <rect x="2.6" y="14.2" width="2.8" height="2.4" rx="1.2" fill={hl} />
          <rect x="14.6" y="14.2" width="2.8" height="2.4" rx="1.2" fill={hl} />
        </>
      )}
      {muscle === 'core' && <rect x="6.4" y="12" width="7.2" height="4.6" rx="1.6" fill={hl} />}
      {muscle === 'quads' && (
        <>
          <rect x="6.3" y="18" width="3.2" height="6.4" rx="1.6" fill={hl} />
          <rect x="10.5" y="18" width="3.2" height="6.4" rx="1.6" fill={hl} />
        </>
      )}
      {muscle === 'hamstrings' && (
        <>
          <rect x="6.3" y="20.6" width="3.2" height="5.6" rx="1.6" fill={hl} />
          <rect x="10.5" y="20.6" width="3.2" height="5.6" rx="1.6" fill={hl} />
          <rect x="9.5" y="19" width="1" height="9" fill={bg} />
        </>
      )}
      {muscle === 'glutes' && <rect x="6" y="15.6" width="8" height="3.4" rx="1.6" fill={hl} />}
      {muscle === 'calves' && (
        <>
          <rect x="6.3" y="26.4" width="3.2" height="3.6" rx="1.6" fill={hl} />
          <rect x="10.5" y="26.4" width="3.2" height="3.6" rx="1.6" fill={hl} />
        </>
      )}
    </svg>
  );
}

/** Graphite muscle chip: silhouette + label (EQ-1). `lg` is the history
 * header size (EQ-3): 11 px text, 9×15 mark, primary label near-white. */
export function MuscleChip({
  muscle,
  tone = 'primary',
  size = 'sm',
}: {
  muscle: MuscleGroup;
  tone?: Tone;
  size?: 'sm' | 'lg';
}) {
  if (muscle === 'cardio') return null;
  return (
    <span className={`mchip${size === 'lg' ? ' lg' : ''}${tone === 'primary' ? ' primary' : ''}`}>
      <MuscleIcon muscle={muscle} variant={size === 'lg' ? 'chipLg' : 'chip'} tone={tone} />
      {strings().muscleGroups[muscle]}
    </span>
  );
}

/** Equipment ids → phosphor icon names used by the design's graphite chips. */
const EQUIP_PH_ICON: Record<string, string> = {
  barbell: 'barbell',
  dumbbell: 'barbell',
  kettlebell: 'barbell',
  cable: 'plugs',
  machine: 'devices',
  body: 'person-simple',
  bands: 'wave-sine',
  medicineBall: 'circle',
  exerciseBall: 'circle',
  ezBar: 'barbell',
  foamRoll: 'cylinder',
  bench: 'rows',
  rack: 'frame-corners',
  other: 'toolbox',
};

export function equipmentIconName(id: string): string {
  return EQUIP_PH_ICON[id] ?? 'toolbox';
}

export function equipmentLabel(id: string): string {
  const names = strings().equipmentNames as Record<string, string>;
  return names[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** Graphite equipment chip (icon + word, EQ-1). */
export function EquipChip({ id, style }: { id: string; style?: CSSProperties }) {
  return (
    <span className="echip" style={style}>
      <Icon name={equipmentIconName(id)} />
      {equipmentLabel(id)}
    </span>
  );
}

export function isEquipmentId(id: string): id is EquipmentId {
  return (EQUIPMENT_IDS as string[]).includes(id);
}
