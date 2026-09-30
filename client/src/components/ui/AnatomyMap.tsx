import type { CSSProperties } from 'react';
import { toneClass, type Tone } from './tones';
import './AnatomyMap.css';

/** Which side of the body the projection looks from. `left` is the person's left side (spine curves). */
export type AnatomyView = 'front' | 'back' | 'left';

/** Region layers (white masks on the same 640×1400 canvas as the base bones). */
export type AnatomyLayer =
  | 'skull'
  | 'spine_cervical'
  | 'spine_thoracic'
  | 'spine_lumbar'
  | 'sacrum'
  | 'ribs'
  | 'pelvis'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'hip_l'
  | 'hip_r'
  | 'knee_l'
  | 'knee_r'
  | 'ankle_l'
  | 'ankle_r'
  | 'elbow_l'
  | 'elbow_r'
  | 'wrist_l'
  | 'wrist_r'
  | 'heart_mask'
  | 'lungs_shape'
  | 'brain_mask'
  | 'spinalcord_mask'
  | 'liver'
  | 'kidneys'
  | 'stomach'
  | 'intestines'
  | 'm_chest'
  | 'm_shoulder'
  | 'm_arm'
  | 'm_forearm'
  | 'm_back'
  | 'm_neck'
  | 'm_core'
  | 'm_glutes'
  | 'm_quads'
  | 'm_hams'
  | 'm_hipflex'
  | 'm_calves'
  | 'm_shin';

/** Shaded organ layers drawn under the marks. */
export type AnatomyOrgan =
  'heart' | 'lungs' | 'liver' | 'kidneys' | 'stomach' | 'brain' | 'spinalcord' | 'intestines';

export interface AnatomyMark {
  layer: AnatomyLayer;
  /** Colour family of the highlight (default `chronic`). */
  tone?: Tone;
}

/** Crop boxes as fractions of the full canvas: [x0, y0, x1, y1]. */
export const ANATOMY_FOCUS = {
  full: [0.08, 0.02, 0.92, 0.99],
  head: [0.36, 0.02, 0.64, 0.14],
  neck: [0.3, 0.06, 0.7, 0.3],
  torso: [0.2, 0.14, 0.8, 0.5],
  spine: [0.28, 0.03, 0.72, 0.56],
  pelvis: [0.25, 0.3, 0.75, 0.52],
  'arm-l': [0.55, 0.16, 0.95, 0.66],
  'arm-r': [0.05, 0.16, 0.45, 0.66],
  legs: [0.15, 0.48, 0.85, 0.99],
  knees: [0.2, 0.56, 0.8, 0.86],
  feet: [0.25, 0.84, 0.75, 0.99],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type AnatomyFocus = keyof typeof ANATOMY_FOCUS;

export type AnatomyBase = 'bones' | 'muscles';

export interface AnatomyMapProps {
  /** A fixed side, or a turntable angle in degrees (multiples of TURN_STEP). */
  view?: AnatomyView | number;
  /** Which layer is the body underneath: the skeleton (default) or the muscles. */
  base?: AnatomyBase;
  focus?: AnatomyFocus;
  /** Shaded internal organs (behind the marks). */
  organs?: AnatomyOrgan[];
  marks?: AnatomyMark[];
  /** Height of the whole figure; the crop keeps its aspect. Default: fill the width. */
  className?: string;
  /** Accessible description of what is highlighted. */
  label: string;
}

const BASE = `${import.meta.env.BASE_URL ?? '/'}anatomy/`;
// CSS custom-property URLs otherwise resolve against the stylesheet's assets/
// directory when the build uses a relative base (for example, Storybook).
export const TURN_STEP = 5;
export const TURN_FRAMES = 360 / TURN_STEP;
export const file = (layer: string, view: AnatomyView | number) =>
  typeof view === 'number' ? `${BASE}turn/${layer}/${view}.webp` : `${BASE}${layer}.${view}.webp`;
const url = (layer: string, view: AnatomyView | number) =>
  `url("${new URL(file(layer, view), document.baseURI).href}")`;

/**
 * Anatomical map: the skeleton with optional organs and highlighted regions,
 * rendered from BodyParts3D projections (CC BY 4.0, see public/anatomy/ATTRIBUTION.md).
 * Highlights are tone-tinted masks — colours come from the tone family, never hex.
 */
export function AnatomyMap({
  view = 'front',
  base = 'bones',
  focus = 'full',
  organs = [],
  marks = [],
  className,
  label,
}: AnatomyMapProps) {
  const [x0, y0, x1, y1] = ANATOMY_FOCUS[focus];
  const vars = {
    '--am-x0': x0,
    '--am-y0': y0,
    '--am-w': x1 - x0,
    '--am-h': y1 - y0,
  } as CSSProperties;
  const img = (layer: string): CSSProperties => ({ '--am-url': url(layer, view) }) as CSSProperties;
  return (
    <div
      className={`uianat${className ? ` ${className}` : ''}`}
      style={vars}
      role="img"
      aria-label={label}
    >
      <div className="uianat-in">
        {base === 'muscles' && <i className="uianat-layer uianat-muscles" style={img('muscles')} />}
        <i className="uianat-layer uianat-bones" style={img('bones')} />
        {organs.map((o) => (
          <i key={o} className="uianat-layer uianat-organ" style={img(o)} />
        ))}
        {marks.map((m) => (
          <i
            key={m.layer}
            className={`uianat-layer uianat-mark ${toneClass(m.tone ?? 'chronic')}`}
            style={img(m.layer)}
          />
        ))}
      </div>
    </div>
  );
}
