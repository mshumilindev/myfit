/**
 * Muscle groups — chips and anatomical figures (design MG-1, EQ-1, RICH).
 *
 * Anatomical figures are now rendered from the `body-muscles` library's SVG
 * path data (FRONT_MUSCLES / BACK_MUSCLES), painted in the app palette: worked
 * regions in brass (primary) or grey (secondary), the rest of the body recedes.
 * The full human appears where the design has room (exercise detail); everywhere
 * else the figure auto-crops to the relevant body part — an arm for a biceps
 * curl, the legs for a squat, the back for a row — so the mark always shows the
 * work on a recognisable piece of the body.
 *
 * The tiny label chips (≤15 px) keep the crisp geometric locator mark: real
 * anatomy is an unreadable blob at that size, and the word beside it carries the
 * precision. `MuscleIcon` therefore renders a library figure at figure/row/full
 * sizes and the geometric mark at chip/chipLg sizes — same public API.
 */
import type { CSSProperties } from 'react';
import { FRONT_MUSCLES, BACK_MUSCLES } from 'body-muscles';
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

// ─────────────────────────────────────────────────────────────────────────────
// body-muscles bridge: app muscle groups → library muscle IDs, crop regions,
// and the palette that paints the shared silhouette.
// ─────────────────────────────────────────────────────────────────────────────

type BView = 'front' | 'back';
type Region = 'full' | 'upper' | 'lower' | 'arms' | 'torso';

/** Path list per view, extracted once from the library's data exports. */
const VIEW_PATHS: Record<BView, { id: string; path: string }[]> = {
  front: FRONT_MUSCLES.map((m) => ({ id: m.id, path: m.path })),
  back: BACK_MUSCLES.map((m) => ({ id: m.id, path: m.path })),
};

const ALL_IDS: Record<BView, string[]> = {
  front: VIEW_PATHS.front.map((m) => m.id),
  back: VIEW_PATHS.back.map((m) => m.id),
};

/** App group → library muscle IDs, split by anatomical view. */
type LibMap = { front: string[]; back: string[] };
const LIB: Record<Exclude<MuscleGroup, 'cardio'>, LibMap> = {
  chest: {
    front: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
    back: [],
  },
  back: {
    front: [],
    back: [
      'lats-upper-left',
      'lats-mid-left',
      'lats-lower-left',
      'lats-upper-right',
      'lats-mid-right',
      'lats-lower-right',
      'traps-upper-left',
      'traps-mid-left',
      'traps-lower-left',
      'traps-upper-right',
      'traps-mid-right',
      'traps-lower-right',
      'lower-back-erectors-left',
      'lower-back-ql-left',
      'lower-back-erectors-right',
      'lower-back-ql-right',
      'spine',
    ],
  },
  shoulders: {
    front: [
      'shoulder-front-left',
      'shoulder-side-left',
      'shoulder-front-right',
      'shoulder-side-right',
    ],
    back: ['deltoid-rear-left', 'deltoid-rear-right'],
  },
  biceps: {
    front: ['biceps-left', 'biceps-right'],
    back: [],
  },
  triceps: {
    front: [],
    back: [
      'triceps-long-left',
      'triceps-lateral-left',
      'triceps-long-right',
      'triceps-lateral-right',
    ],
  },
  forearms: {
    front: ['forearm-left', 'forearm-right'],
    back: [
      'forearm-flexors-left',
      'forearm-extensors-left',
      'forearm-flexors-right',
      'forearm-extensors-right',
    ],
  },
  core: {
    front: [
      'abs-upper-left',
      'abs-upper-right',
      'abs-lower-left',
      'abs-lower-right',
      'obliques-left',
      'obliques-right',
      'serratus-anterior-left',
      'serratus-anterior-right',
    ],
    back: [],
  },
  quads: {
    front: ['quads-left', 'quads-right', 'adductors-left', 'adductors-right'],
    back: [],
  },
  hamstrings: {
    front: [],
    back: [
      'hamstrings-medial-left',
      'hamstrings-lateral-left',
      'hamstrings-medial-right',
      'hamstrings-lateral-right',
    ],
  },
  glutes: {
    front: [],
    back: [
      'gluteus-maximus-left',
      'gluteus-medius-left',
      'gluteus-maximus-right',
      'gluteus-medius-right',
    ],
  },
  calves: {
    front: ['tibialis-anterior-left', 'tibialis-anterior-right'],
    back: [
      'calves-gastroc-medial-left',
      'calves-gastroc-lateral-left',
      'calves-soleus-left',
      'calves-gastroc-medial-right',
      'calves-gastroc-lateral-right',
      'calves-soleus-right',
    ],
  },
  // fullbody is handled specially (whole silhouette lights up).
  fullbody: { front: [], back: [] },
};

/** Which single silhouette best shows a group, and how tightly to crop it. */
const GROUP_VIEW: Record<Exclude<MuscleGroup, 'cardio'>, BView> = {
  chest: 'front',
  shoulders: 'front',
  biceps: 'front',
  forearms: 'front',
  core: 'front',
  quads: 'front',
  back: 'back',
  triceps: 'back',
  hamstrings: 'back',
  glutes: 'back',
  calves: 'back',
  fullbody: 'front',
};
const GROUP_REGION: Record<Exclude<MuscleGroup, 'cardio'>, Region> = {
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  chest: 'upper',
  shoulders: 'upper',
  core: 'upper',
  back: 'upper',
  quads: 'lower',
  hamstrings: 'lower',
  glutes: 'lower',
  calves: 'lower',
  fullbody: 'full',
};

/** Crop windows in the library's own coordinate space (front x0–32, back x37–69). */
const VIEWBOX: Record<BView, Record<Region, string>> = {
  front: {
    full: '-1.5 -2 34.5 96.5',
    upper: '-0.5 9 32.5 44.5',
    torso: '6 9 20 39',
    arms: '-2.5 10 36.5 43',
    lower: '4.5 36 22.5 59.5',
  },
  back: {
    full: '35 -2 35.5 96.6',
    upper: '36.4 3.5 32.2 41.5',
    torso: '36.4 3.5 32.2 41.5',
    arms: '34 12 37.5 40.5',
    lower: '41 36.5 23 59',
  },
};

/** Muscles drawn for a cropped region (keeps compact figures light). */
const REGION_IDS: Record<BView, Record<Region, string[]>> = {
  front: {
    full: ALL_IDS.front,
    arms: [
      'shoulder-front-left',
      'shoulder-side-left',
      'shoulder-front-right',
      'shoulder-side-right',
      'biceps-left',
      'biceps-right',
      'forearm-left',
      'forearm-right',
      'elbow-left',
      'elbow-right',
      'hand-left',
      'hand-right',
      'chest-upper-left',
      'chest-upper-right',
      'chest-lower-left',
      'chest-lower-right',
      'abs-upper-left',
      'abs-upper-right',
    ],
    upper: [
      'neck-left',
      'neck-right',
      'shoulder-front-left',
      'shoulder-side-left',
      'shoulder-front-right',
      'shoulder-side-right',
      'biceps-left',
      'biceps-right',
      'forearm-left',
      'forearm-right',
      'chest-upper-left',
      'chest-upper-right',
      'chest-lower-left',
      'chest-lower-right',
      'abs-upper-left',
      'abs-upper-right',
      'abs-lower-left',
      'abs-lower-right',
      'obliques-left',
      'obliques-right',
      'serratus-anterior-left',
      'serratus-anterior-right',
      'hip-flexor-left',
      'hip-flexor-right',
    ],
    torso: [
      'chest-upper-left',
      'chest-upper-right',
      'chest-lower-left',
      'chest-lower-right',
      'abs-upper-left',
      'abs-upper-right',
      'abs-lower-left',
      'abs-lower-right',
      'obliques-left',
      'obliques-right',
      'serratus-anterior-left',
      'serratus-anterior-right',
      'neck-left',
      'neck-right',
    ],
    lower: [
      'quads-left',
      'quads-right',
      'adductors-left',
      'adductors-right',
      'hip-flexor-left',
      'hip-flexor-right',
      'knee-left',
      'knee-right',
      'tibialis-anterior-left',
      'tibialis-anterior-right',
      'foot-left',
      'foot-right',
    ],
  },
  back: {
    full: ALL_IDS.back,
    arms: [
      'deltoid-rear-left',
      'deltoid-rear-right',
      'triceps-long-left',
      'triceps-lateral-left',
      'triceps-long-right',
      'triceps-lateral-right',
      'forearm-flexors-left',
      'forearm-extensors-left',
      'forearm-flexors-right',
      'forearm-extensors-right',
      'hand-back-left',
      'hand-back-right',
      'lats-upper-left',
      'lats-upper-right',
      'lats-mid-left',
      'lats-mid-right',
    ],
    upper: [
      'nape',
      'traps-upper-left',
      'traps-mid-left',
      'traps-lower-left',
      'traps-upper-right',
      'traps-mid-right',
      'traps-lower-right',
      'lats-upper-left',
      'lats-mid-left',
      'lats-lower-left',
      'lats-upper-right',
      'lats-mid-right',
      'lats-lower-right',
      'deltoid-rear-left',
      'deltoid-rear-right',
      'triceps-long-left',
      'triceps-lateral-left',
      'triceps-long-right',
      'triceps-lateral-right',
      'spine',
      'lower-back-erectors-left',
      'lower-back-erectors-right',
      'lower-back-ql-left',
      'lower-back-ql-right',
    ],
    torso: [
      'nape',
      'traps-upper-left',
      'traps-mid-left',
      'traps-lower-left',
      'traps-upper-right',
      'traps-mid-right',
      'traps-lower-right',
      'lats-upper-left',
      'lats-mid-left',
      'lats-lower-left',
      'lats-upper-right',
      'lats-mid-right',
      'lats-lower-right',
      'spine',
      'lower-back-erectors-left',
      'lower-back-erectors-right',
      'lower-back-ql-left',
      'lower-back-ql-right',
    ],
    lower: [
      'gluteus-maximus-left',
      'gluteus-medius-left',
      'gluteus-maximus-right',
      'gluteus-medius-right',
      'hamstrings-medial-left',
      'hamstrings-lateral-left',
      'hamstrings-medial-right',
      'hamstrings-lateral-right',
      'knee-back-left',
      'knee-back-right',
      'calves-gastroc-medial-left',
      'calves-gastroc-lateral-left',
      'calves-soleus-left',
      'calves-gastroc-medial-right',
      'calves-gastroc-lateral-right',
      'calves-soleus-right',
      'foot-back-left',
      'foot-back-right',
    ],
  },
};

const DIM = 'var(--color-neutral-800)';
const DIM_STROKE = 'var(--color-neutral-900)';

/** Highlight colour for a tone (primary = brass, secondary = grey …). */
function highlightColor(tone: Tone): string {
  return TONES[tone][2];
}

type IdSet = Set<string>;

/**
 * One anatomical silhouette (front or back), cropped to `region`, with the
 * `prim` muscles in the highlight colour, `sec` in grey, the rest dimmed.
 */
function BodySvg({
  view,
  region,
  prim,
  sec,
  hl,
  full = false,
  width,
  height,
  title,
}: {
  view: BView;
  region: Region;
  prim: IdSet;
  sec: IdSet;
  hl: string;
  full?: boolean;
  width?: number | string;
  height?: number | string;
  title?: string;
}) {
  const drawIds = REGION_IDS[view][region];
  const drawSet = region === 'full' ? null : new Set(drawIds);
  return (
    <svg
      viewBox={VIEWBOX[view][region]}
      width={width}
      height={height}
      style={{
        display: 'block',
        flex: region === 'full' ? 1 : 'none',
        minWidth: 0,
        width: width === undefined ? '100%' : undefined,
        height: 'auto',
      }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {VIEW_PATHS[view].map(({ id, path }) => {
        if (drawSet && !drawSet.has(id)) return null;
        const on = full || prim.has(id);
        const se = !on && sec.has(id);
        const fill = on ? hl : se ? 'var(--color-neutral-500)' : DIM;
        const active = on || se;
        return (
          <path
            key={id}
            d={path}
            fill={fill}
            stroke={active ? 'var(--color-bg)' : DIM_STROKE}
            strokeWidth={active ? 0.25 : 0.12}
          />
        );
      })}
    </svg>
  );
}

/** Collect library IDs for a set of groups, on one view. */
function idsForGroups(groups: MuscleGroup[], view: BView): IdSet {
  const s: IdSet = new Set();
  for (const g of groups) {
    if (g === 'cardio') continue;
    for (const id of LIB[g][view]) s.add(id);
  }
  return s;
}

export type MuscleFigureView = 'front' | 'back' | 'both' | 'auto';

/**
 * Anatomical body figure driven by `body-muscles` data. Renders the front
 * and/or back silhouette (per `view`) cropped to `region`, with primary muscles
 * in brass and secondary in grey. `view="auto"` shows only the silhouette(s)
 * that actually carry worked muscles.
 */
export function MuscleFigure({
  primary,
  secondary = [],
  view = 'auto',
  region = 'full',
  tone = 'primary',
  width,
  className,
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  view?: MuscleFigureView;
  region?: Region;
  tone?: Tone;
  width?: number | string;
  className?: string;
}) {
  const full = primary.includes('fullbody');
  const groups = [...primary, ...secondary];

  let views: BView[];
  if (view === 'front' || view === 'back') views = [view];
  else if (view === 'both' || full) views = ['front', 'back'];
  else {
    const hasFront = groups.some((g) => g !== 'cardio' && LIB[g].front.length > 0);
    const hasBack = groups.some((g) => g !== 'cardio' && LIB[g].back.length > 0);
    views = hasFront && hasBack ? ['front', 'back'] : hasBack ? ['back'] : ['front'];
  }

  const hl = highlightColor(tone);
  return (
    <div className={className ? `bodymap ${className}` : 'bodymap'} style={{ width }}>
      {views.map((v) => (
        <BodySvg
          key={v}
          view={v}
          region={region}
          prim={idsForGroups(primary, v)}
          sec={idsForGroups(secondary, v)}
          hl={hl}
          full={full}
        />
      ))}
    </div>
  );
}

export type MuscleIconVariant = 'chip' | 'chipLg' | 'chipFig' | 'row' | 'figure' | 'full';

const SIZES: Record<MuscleIconVariant, [number, number]> = {
  chip: [8, 13],
  chipLg: [9, 15],
  chipFig: [16, 25],
  row: [13, 22],
  figure: [13, 22],
  full: [15, 26],
};

/**
 * Muscle mark. At figure/row/full sizes it renders a library-driven anatomical
 * figure auto-cropped to the group's body part (an arm for biceps, legs for
 * quads …). At chip/chipLg sizes it renders the crisp geometric locator mark —
 * real anatomy does not read below ~16 px and these always sit beside a label.
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

  // Larger variants: real anatomy from the library, cropped to the body part.
  if (variant === 'chipFig' || variant === 'row' || variant === 'figure' || variant === 'full') {
    const [w, h] = SIZES[variant];
    const view = GROUP_VIEW[muscle];
    const region = GROUP_REGION[muscle];
    const full = muscle === 'fullbody';
    return (
      <BodySvg
        view={view}
        region={region}
        prim={full ? new Set() : new Set(LIB[muscle][view])}
        sec={new Set()}
        hl={highlightColor(tone)}
        full={full}
        width={w}
        height={h}
      />
    );
  }

  return <GeoMuscleMark muscle={muscle} variant={variant} tone={tone} className={className} />;
}

/**
 * Compact geometric locator mark for chip sizes (design MG-1). One silhouette,
 * one highlighted region: at chip size the mark locates — upper body, arms,
 * legs — and the word beside it carries the precision.
 */
function GeoMuscleMark({
  muscle,
  variant,
  tone,
  className,
}: {
  muscle: MuscleGroup;
  variant: 'chip' | 'chipLg';
  tone: Tone;
  className?: string;
}) {
  const [w, h] = SIZES[variant];
  const [dim, region, hl] = TONES[tone];
  const bg = 'var(--color-bg)';
  const upper = UPPER.includes(muscle);
  const full = muscle === 'fullbody';
  const showArms = full || upper;
  const showLegs = full || !upper;

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
 * Anatomical muscle map for the exercise detail (design RICH). Full front and/or
 * back silhouette from `body-muscles`: every worked region coloured — primary in
 * brass, secondary in grey, the rest recedes. Only the view(s) that carry worked
 * muscles are shown, so an upper-body lift never draws empty legs beside it.
 */
export function MuscleBodyFigure({
  primary,
  secondary,
  width = 128,
}: {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  width?: number;
}) {
  return (
    <MuscleFigure primary={primary} secondary={secondary} view="auto" region="full" width={width} />
  );
}

/** Graphite muscle chip: silhouette + label (EQ-1). `lg` is the history
 * header size (EQ-3): 11 px text, 9×15 mark, primary label near-white. */
export function MuscleChip({
  muscle,
  tone = 'primary',
  size = 'sm',
  onClick,
}: {
  muscle: MuscleGroup;
  tone?: Tone;
  size?: 'sm' | 'lg';
  onClick?: (muscle: MuscleGroup) => void;
}) {
  if (muscle === 'cardio') return null;
  const interactive = !!onClick;
  return (
    <span
      className={`mchip mchip-fig${size === 'lg' ? ' lg' : ''}${tone === 'primary' ? ' primary' : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              onClick(muscle);
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onClick(muscle);
            }
          : undefined
      }
    >
      <MuscleIcon muscle={muscle} variant="chipFig" tone={tone} />
      {strings().muscleGroups[muscle]}
    </span>
  );
}

/**
 * Muscle token with a set count (Ex suggestions AC-2/AC-3): the system
 * body-figure icon (worked region in brass) + the muscle name + count.
 */
export function MuscleSetChip({
  muscle,
  count,
  onClick,
}: {
  muscle: MuscleGroup;
  count?: number;
  onClick?: (muscle: MuscleGroup) => void;
}) {
  if (muscle === 'cardio') return null;
  const interactive = !!onClick;
  return (
    <span
      className="mworked-chip mworked-chip-fig"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              onClick(muscle);
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onClick(muscle);
            }
          : undefined
      }
    >
      <MuscleIcon muscle={muscle} variant="chipFig" tone="primary" />
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
