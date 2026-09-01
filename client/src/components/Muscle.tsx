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
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FRONT_MUSCLES, BACK_MUSCLES } from 'body-muscles';
import type { MuscleGroup } from '../data/exercises';
import { EQUIPMENT_IDS, type EquipmentId } from '../data/equipment';
import { t as strings } from '../i18n';
import { Icon, Sheet } from '../ui';
import { useStore, muscleSetsInWorkout } from '../store';
import { LANDMARKS, classifyZone, ZONE_COLOR } from '../volume';

/** Muscles in the vocabulary order of the filter bar (MG-5). */
export const MUSCLE_IDS: Exclude<MuscleGroup, 'cardio'>[] = [
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'abductors',
  'calves',
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'forearms',
  'neck',
  'fullbody',
];

const UPPER: MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'neck',
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
  // Finer back groups — subsets of the coarse `back` region above.
  lats: {
    front: [],
    back: [
      'lats-upper-left',
      'lats-mid-left',
      'lats-lower-left',
      'lats-upper-right',
      'lats-mid-right',
      'lats-lower-right',
    ],
  },
  traps: {
    front: [],
    back: [
      'traps-upper-left',
      'traps-mid-left',
      'traps-lower-left',
      'traps-upper-right',
      'traps-mid-right',
      'traps-lower-right',
    ],
  },
  lower_back: {
    front: [],
    back: [
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
    front: ['quads-left', 'quads-right'],
    back: [],
  },
  adductors: {
    front: ['adductors-left', 'adductors-right'],
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
    back: ['gluteus-maximus-left', 'gluteus-maximus-right'],
  },
  // Hip abductors ≈ gluteus medius.
  abductors: {
    front: [],
    back: ['gluteus-medius-left', 'gluteus-medius-right'],
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
  neck: {
    front: ['neck-left', 'neck-right'],
    back: ['nape'],
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
  adductors: 'front',
  neck: 'front',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  triceps: 'back',
  hamstrings: 'back',
  glutes: 'back',
  abductors: 'back',
  calves: 'back',
  fullbody: 'front',
};
const GROUP_REGION: Record<Exclude<MuscleGroup, 'cardio'>, Region> = {
  // Arms are shown on the upper-body crop (not a bare 'arms' crop) so the limbs
  // stay attached to a torso instead of floating in mid-air.
  biceps: 'upper',
  triceps: 'upper',
  forearms: 'upper',
  chest: 'upper',
  shoulders: 'upper',
  core: 'upper',
  back: 'upper',
  lats: 'upper',
  traps: 'upper',
  lower_back: 'upper',
  neck: 'upper',
  quads: 'lower',
  adductors: 'lower',
  hamstrings: 'lower',
  glutes: 'lower',
  abductors: 'lower',
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

/**
 * Reverse map: library path id -> the fine app group that owns it. Built from
 * LIB over the FINE groups only, so the coarse `back` union (which repeats the
 * lats/traps/lower_back ids) never shadows them. Drives the volume heatmap.
 */
const HEAT_FINE: Exclude<MuscleGroup, 'cardio'>[] = [
  'chest',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'abductors',
  'calves',
  'neck',
];
const ID_TO_GROUP: Record<BView, Record<string, MuscleGroup>> = (() => {
  const out: Record<BView, Record<string, MuscleGroup>> = { front: {}, back: {} };
  for (const g of HEAT_FINE) {
    for (const v of ['front', 'back'] as BView[]) {
      for (const id of LIB[g][v]) out[v][id] = g;
    }
  }
  return out;
})();

/**
 * Volume heatmap (design VOL-3): full front + back silhouette with each muscle
 * painted the caller's colour (its volume zone), the rest of the body dimmed.
 * Reuses the shared body-muscles path data -- the same figure as everywhere
 * else, seen through a volume lens.
 */
export function MuscleHeatmap({
  colors,
  width,
  className,
}: {
  colors: Partial<Record<MuscleGroup, string>>;
  width?: number | string;
  className?: string;
}) {
  return (
    <div className={className ? `bodymap ${className}` : 'bodymap'} style={{ width }}>
      {(['front', 'back'] as BView[]).map((view) => (
        <svg
          key={view}
          viewBox={VIEWBOX[view].full}
          style={{ display: 'block', flex: 1, minWidth: 0, width: '100%', height: 'auto' }}
          aria-hidden
        >
          {VIEW_PATHS[view].map(({ id, path }) => {
            const g = ID_TO_GROUP[view][id];
            const c = g ? colors[g] : undefined;
            const active = !!c;
            return (
              <path
                key={id}
                d={path}
                fill={c ?? DIM}
                stroke={active ? 'var(--color-bg)' : DIM_STROKE}
                strokeWidth={active ? 0.25 : 0.12}
              />
            );
          })}
        </svg>
      ))}
    </div>
  );
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
    : muscle === 'chest' ||
        muscle === 'back' ||
        muscle === 'lats' ||
        muscle === 'traps' ||
        muscle === 'lower_back' ||
        muscle === 'core' ||
        muscle === 'neck'
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

type MuscleEntry = { muscle: MuscleGroup; sets: number; primary: boolean };

const WEEK_DAY_MS = 24 * 3600 * 1000;
/** Mon–Sun calendar week [start, end) containing `ts`. */
function weekBounds(ts: number): [number, number] {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const start = d.getTime() - dow * WEEK_DAY_MS;
  return [start, start + 7 * WEEK_DAY_MS];
}

/**
 * The worked-muscle list with weekly context: for each muscle, this session's
 * sets (the right-hand count) plus a bar toward its desired weekly volume (MAV),
 * split into this session (bright) and the rest of the same calendar week
 * (faded), so a muscle trained across several days reads as its week total. The
 * bar and the "N / target" label are tinted by the volume zone
 * (under / productive / high / over). `refTs` anchors which week to sum.
 */
export function MuscleBreakdownList({
  entries,
  refTs,
  onOpen,
}: {
  entries: MuscleEntry[];
  refTs: number;
  onOpen?: (m: MuscleGroup) => void;
}) {
  const store = useStore();
  const interactive = !!onOpen;
  const s = strings();
  const [wkStart, wkEnd] = weekBounds(refTs);
  const week = useMemo(() => {
    const m = new Map<MuscleGroup, number>();
    for (const w of store.workouts) {
      if (w.finishedAt === null || w.startedAt < wkStart || w.startedAt >= wkEnd) continue;
      // Weekly context is "as of" the viewed session: for a past workout, count
      // only what had been logged up to and including it, not sessions done
      // later the same week (which it couldn't have known about).
      if (w.startedAt > refTs) continue;
      for (const [mg, n] of muscleSetsInWorkout(w)) m.set(mg, (m.get(mg) ?? 0) + n);
    }
    return m;
  }, [store.workouts, wkStart, wkEnd, refTs]);

  return (
    <div className="md-list">
      {entries.map((e) => {
        const lm = LANDMARKS[e.muscle];
        const wk = Math.max(week.get(e.muscle) ?? e.sets, e.sets);
        const target = lm ? lm.mav : 0;
        const multi = wk > e.sets + 0.01;
        const color = lm ? ZONE_COLOR[classifyZone(wk, lm)] : undefined;
        const fillW = target > 0 ? Math.min(100, (wk / target) * 100) : 0;
        return (
          <div
            key={e.muscle}
            className={`md-row${e.primary ? ' primary' : ''}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onOpen(e.muscle) : undefined}
          >
            <MuscleIcon
              muscle={e.muscle}
              variant="chipFig"
              tone={e.primary ? 'primary' : 'secondary'}
            />
            <div className="md-main">
              <span className="md-name">{s.muscleGroups[e.muscle]}</span>
              {lm ? (
                <div className="md-meter">
                  <span className="md-bar">
                    <span
                      className="md-bar-fill"
                      style={{ width: `${fillW}%`, background: color }}
                    />
                  </span>
                  <span className="md-meter-lab" style={{ color }}>
                    {fmtSetCount(wk)} / {target}
                  </span>
                  <span className="md-week-tag">{s.mdWeekTag}</span>
                </div>
              ) : (
                multi && (
                  <div className="md-meter">
                    <span className="md-week-tag">
                      {s.mdWeekTag}: {fmtSetCount(wk)}
                    </span>
                  </div>
                )
              )}
            </div>
            <span className="md-count tnum">{fmtSetCount(e.sets)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The full worked-muscle list in a bottom drawer — opened from the "+N more"
 *  chip on a clipped session row. */
function MuscleDrawer({
  entries,
  refTs,
  onOpen,
  onClose,
}: {
  entries: MuscleEntry[];
  refTs: number;
  onOpen?: (m: MuscleGroup) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="muscle-drawer">
        <div className="section-label">{strings().musclesWorkedLabel}</div>
        <MuscleBreakdownList entries={entries} refTs={refTs} onOpen={onOpen} />
      </div>
    </Sheet>
  );
}

/**
 * One-line session muscle row for lists: primaries then secondaries (each in
 * training order), fitted to a single line — chips that don't fit drop from the
 * end and a "+N more" chip appears, opening the full list in a drawer.
 */
export function MuscleRow({
  entries,
  refTs,
  onOpen,
}: {
  entries: MuscleEntry[];
  /** Timestamp of the workout these entries belong to — anchors the week sum. */
  refTs: number;
  onOpen?: (m: MuscleGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const nRef = useRef<HTMLSpanElement>(null);
  const key = entries.map((e) => `${e.muscle}:${e.primary ? 1 : 0}`).join(',');
  useLayoutEffect(() => {
    const row = rowRef.current;
    const more = moreRef.current;
    if (!row) return;
    const fit = () => {
      const chips = Array.from(row.querySelectorAll<HTMLElement>('[data-mchip]'));
      chips.forEach((c) => (c.style.display = ''));
      if (more) more.style.display = 'none';
      const fits = () => row.scrollWidth <= row.clientWidth + 1;
      let hidden = 0;
      if (!fits() && more) {
        more.style.display = ''; // reserve room for the "+N more" chip
        for (let i = chips.length - 1; i >= 0 && !fits(); i--) {
          chips[i].style.display = 'none';
          hidden += 1;
        }
      }
      if (more) {
        more.style.display = hidden > 0 ? '' : 'none';
        if (nRef.current) nRef.current.textContent = String(hidden);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [key]);
  if (entries.length === 0) return null;
  const openDrawer = (ev: { stopPropagation: () => void }) => {
    ev.stopPropagation();
    setOpen(true);
  };
  return (
    <>
      {/* Stop clicks inside the muscle area from bubbling to the row button
          (which opens the workout) — chips and "+N more" act on their own. */}
      <div className="mrow" ref={rowRef} onClick={(e) => e.stopPropagation()}>
        {entries.map((e) => (
          <span key={e.muscle} data-mchip className="mrow-item">
            <MuscleChip
              muscle={e.muscle}
              tone={e.primary ? 'primary' : 'secondary'}
              onClick={onOpen}
            />
          </span>
        ))}
        <span
          className="mrow-more"
          role="button"
          tabIndex={0}
          ref={moreRef}
          onClick={openDrawer}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') openDrawer(ev);
          }}
        >
          +<span className="n" ref={nRef} />
          &nbsp;{strings().moreLabel}
        </span>
      </div>
      {open &&
        createPortal(
          // React re-parents portal events through the component tree, so the
          // Sheet's scrim click would otherwise bubble to the row button and
          // open the workout. Stop it at the portal boundary.
          <div onClick={(e) => e.stopPropagation()}>
            <MuscleDrawer
              entries={entries}
              refTs={refTs}
              onOpen={onOpen}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Muscle token with a set count (Ex suggestions AC-2/AC-3): the system
 * body-figure icon (worked region in brass) + the muscle name + count.
 */
/** Sets shown to one decimal, trailing ".0" trimmed (fractional secondary
 *  counting yields values like 4.5). */
function fmtSetCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Render a muscle-chip list (items sorted primary-first) with a line break
 * before the first secondary chip, so on mobile the secondary (grey) muscles
 * wrap to their own row. The `.chip-break` is a zero-height full-width flex
 * item, active only at the mobile breakpoint (see styles.css).
 */
export function withMuscleBreak<T extends { primary: boolean }>(
  items: T[],
  renderChip: (x: T) => ReactNode,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let broke = false;
  items.forEach((x, i) => {
    if (!broke && !x.primary && i > 0) {
      nodes.push(<span key="__mbreak" className="chip-break" aria-hidden />);
      broke = true;
    }
    nodes.push(renderChip(x));
  });
  return nodes;
}

export function MuscleSetChip({
  muscle,
  count,
  tone = 'primary',
  onClick,
}: {
  muscle: MuscleGroup;
  count?: number;
  /** brass when the muscle was a direct (primary) target, grey when secondary-only. */
  tone?: 'primary' | 'secondary';
  onClick?: (muscle: MuscleGroup) => void;
}) {
  if (muscle === 'cardio') return null;
  const interactive = !!onClick;
  return (
    <span
      className={`mworked-chip mworked-chip-fig${tone === 'secondary' ? ' secondary' : ''}`}
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
      <span className="mworked-name">{strings().muscleGroups[muscle]}</span>
      {count !== undefined && <span className="mworked-count">{fmtSetCount(count)}</span>}
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
