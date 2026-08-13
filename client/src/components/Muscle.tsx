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

/**
 * Anatomical muscle map for the exercise detail (design RICH). Two silhouettes
 * — front and back — where every worked region is coloured: primary muscles in
 * brass, secondary in grey, everything else recedes into the body. Bundled SVG,
 * no runtime network. Muscle bellies are stylised (rounded shapes over a body
 * outline) rather than a medical illustration, so they read at ~120 px while
 * still locating the work precisely; the chips beside it carry the names.
 */
const BRASS = 'var(--color-accent)';
const GREY = 'var(--color-neutral-500)';
const DIM = 'var(--color-neutral-800)';
const SIL = 'var(--color-neutral-900)';

/** Shared body outline (dim) — head, torso, arms, legs — drawn behind muscles. */
function BodySilhouette() {
  return (
    <g fill={SIL}>
      <circle cx="50" cy="17" r="11" />
      <rect x="45" y="26" width="10" height="7" />
      <path d="M31 35 Q50 30 69 35 L64 96 Q50 101 36 96 Z" />
      <path d="M35 92 L65 92 L63 116 Q50 122 37 116 Z" />
      <rect x="17" y="38" width="11" height="38" rx="5.5" />
      <rect x="72" y="38" width="11" height="38" rx="5.5" />
      <rect x="16" y="74" width="9.5" height="32" rx="4.5" />
      <rect x="74.5" y="74" width="9.5" height="32" rx="4.5" />
      <rect x="34" y="114" width="13.5" height="50" rx="6.5" />
      <rect x="52.5" y="114" width="13.5" height="50" rx="6.5" />
      <rect x="35" y="162" width="11.5" height="44" rx="5.5" />
      <rect x="53.5" y="162" width="11.5" height="44" rx="5.5" />
    </g>
  );
}

function FrontBody({ col }: { col: (g: MuscleGroup) => string }) {
  return (
    <svg viewBox="0 0 100 214" style={{ width: '100%', display: 'block' }} aria-hidden>
      <BodySilhouette />
      {/* shoulders (deltoids) */}
      <circle cx="24" cy="43" r="7.5" fill={col('shoulders')} />
      <circle cx="76" cy="43" r="7.5" fill={col('shoulders')} />
      {/* chest (pecs) */}
      <path d="M35 43 Q42 40 48 43 L48 56 Q41 59 35 55 Z" fill={col('chest')} />
      <path d="M65 43 Q58 40 52 43 L52 56 Q59 59 65 55 Z" fill={col('chest')} />
      {/* biceps */}
      <ellipse cx="22.5" cy="55" rx="5" ry="9" fill={col('biceps')} />
      <ellipse cx="77.5" cy="55" rx="5" ry="9" fill={col('biceps')} />
      {/* forearms */}
      <ellipse cx="20.5" cy="87" rx="4.5" ry="12" fill={col('forearms')} />
      <ellipse cx="79.5" cy="87" rx="4.5" ry="12" fill={col('forearms')} />
      {/* core (abs + obliques) */}
      <rect x="43" y="60" width="14" height="30" rx="3" fill={col('core')} />
      {/* quads */}
      <ellipse cx="40.5" cy="134" rx="6.5" ry="22" fill={col('quads')} />
      <ellipse cx="59.5" cy="134" rx="6.5" ry="22" fill={col('quads')} />
      {/* calves (front) */}
      <ellipse cx="40.5" cy="182" rx="5" ry="16" fill={col('calves')} />
      <ellipse cx="59.5" cy="182" rx="5" ry="16" fill={col('calves')} />
    </svg>
  );
}

function BackBody({ col }: { col: (g: MuscleGroup) => string }) {
  return (
    <svg viewBox="0 0 100 214" style={{ width: '100%', display: 'block' }} aria-hidden>
      <BodySilhouette />
      {/* rear deltoids */}
      <circle cx="24" cy="43" r="7.5" fill={col('shoulders')} />
      <circle cx="76" cy="43" r="7.5" fill={col('shoulders')} />
      {/* back — traps, lats, lower back */}
      <path d="M41 36 L59 36 L56 50 L44 50 Z" fill={col('back')} />
      <path d="M37 51 L63 51 L59 82 L41 82 Z" fill={col('back')} />
      <rect x="43" y="82" width="14" height="10" rx="3" fill={col('back')} />
      {/* triceps */}
      <ellipse cx="22.5" cy="55" rx="5" ry="9" fill={col('triceps')} />
      <ellipse cx="77.5" cy="55" rx="5" ry="9" fill={col('triceps')} />
      {/* forearms */}
      <ellipse cx="20.5" cy="87" rx="4.5" ry="12" fill={col('forearms')} />
      <ellipse cx="79.5" cy="87" rx="4.5" ry="12" fill={col('forearms')} />
      {/* glutes */}
      <ellipse cx="42" cy="104" rx="8" ry="7" fill={col('glutes')} />
      <ellipse cx="58" cy="104" rx="8" ry="7" fill={col('glutes')} />
      {/* hamstrings */}
      <ellipse cx="40.5" cy="136" rx="6.5" ry="20" fill={col('hamstrings')} />
      <ellipse cx="59.5" cy="136" rx="6.5" ry="20" fill={col('hamstrings')} />
      {/* calves (back) */}
      <ellipse cx="40.5" cy="181" rx="6" ry="18" fill={col('calves')} />
      <ellipse cx="59.5" cy="181" rx="6" ry="18" fill={col('calves')} />
    </svg>
  );
}

export function MuscleBodyFigure({
  primary,
  secondary,
  width = 128,
}: {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  width?: number;
}) {
  const full = primary.includes('fullbody');
  const pr = new Set<MuscleGroup>(primary);
  const se = new Set<MuscleGroup>(secondary);
  const col = (g: MuscleGroup): string => (full || pr.has(g) ? BRASS : se.has(g) ? GREY : DIM);

  return (
    <div className="bodymap" style={{ width }}>
      <FrontBody col={col} />
      <BackBody col={col} />
    </div>
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

/**
 * Muscle token with a set count (Ex suggestions AC-2/AC-3): the system
 * body-figure icon (worked region in brass) + the muscle name + count.
 */
export function MuscleSetChip({ muscle, count }: { muscle: MuscleGroup; count?: number }) {
  if (muscle === 'cardio') return null;
  return (
    <span className="mworked-chip">
      <MuscleIcon muscle={muscle} variant="chip" tone="primary" />
      <span className="mworked-name">{strings().muscleGroups[muscle]}</span>
      {count !== undefined && <span className="mworked-count">{count}</span>}
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
  suspension: 'person-simple',
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
