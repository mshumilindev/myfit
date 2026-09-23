/**
 * The versioned visual system. Bump PROMPT_VERSION whenever any text here
 * changes meaningfully — every approved image carries the version it was made
 * with, and a new version marks it for regeneration (see manifest.ts).
 */
import type { BodyPosition } from './catalog';

export const PROMPT_VERSION = 'v2-2026-09-23';

/** Order of priorities the model is reminded of in every prompt. */
export const PRIORITIES =
  'Priorities, strictly in this order: (1) exercise correctness — the exact movement, ' +
  'equipment and setup shown in the reference; (2) pose, grip and limb configuration; ' +
  '(3) the same athlete as the identity reference; (4) visual polish. A beautiful image ' +
  'of the wrong movement is a failure.';

export const ATHLETE =
  'The athlete: one adult man, late 20s, athletic and clearly trained with an aesthetic, ' +
  'natural physique (not a competition bodybuilder), realistic low-but-healthy body fat, ' +
  'short neat dark hair, clean-shaven face, neutral calm expression, no tattoos, no ' +
  'jewellery, no watch, no headphones. Natural, unshaved body hair: hairy legs, visible ' +
  'armpit hair, moderate chest hair and a light trail on the stomach. Real skin: visible ' +
  'pores, slight sheen of sweat, small natural imperfections — not airbrushed, not waxy.';

/** Wardrobe per owner request: shirtless so the working muscles read clearly. */
export const WARDROBE =
  'Wardrobe — exactly three items and nothing else: plain matte charcoal athletic shorts ' +
  '(mid-thigh), plain white crew socks, plain dark grey training shoes. SHIRTLESS: bare ' +
  'torso so the working muscles are clearly visible — no tank top, no singlet, no T-shirt, ' +
  'no vest, no top of any kind. No logos, text, stripes or prints on anything.';

export const PHOTOGRAPHY =
  'Raw, true-to-life photograph (not a render, not CGI, not illustration) — editorial fitness photography for a premium training app, one ' +
  'continuous professional studio-gym shoot: a controlled minimal gym set, matte ' +
  'seamless wall, dark rubber floor, only the equipment the exercise needs. Soft large ' +
  'key light from front-left at about 45°, gentle fill, a subtle coloured rim light from ' +
  'behind; crisp subject separation; natural contrast; believable materials (knurled ' +
  'steel, rubber plates, powder-coated frames, taut steel cables, vinyl pads). Shot on a ' +
  'full-frame camera, ~50mm equivalent, eye-level to chest-level camera height, no ' +
  'wide-angle distortion, no fisheye, no tilt, shallow-but-not-extreme depth of field ' +
  'with the whole athlete and equipment in focus.';

export const COMPOSITION_BASE =
  'Composition: 3:2 landscape frame. Athlete and all equipment centered and fully inside ' +
  'the central 70% of the width (the app crops the sides for wide cards), comfortable ' +
  'negative space around, feet never cropped for standing movements, barbell plates ' +
  'and cable origins fully in frame when they matter.';

/** Extra framing guidance per body position (instructional clarity first). */
export const COMPOSITION_BY_POSITION: Record<BodyPosition, string> = {
  standing: 'Full body head-to-toe visible, camera at chest height.',
  seated: 'Whole athlete and the full seat/machine visible, camera at seated-shoulder height.',
  'lying-flat':
    'Side-on three-quarter view with the full bench length and the bar/dumbbells visible; enough horizontal room.',
  'lying-incline':
    'Side-on three-quarter view; the INCLINE angle of the bench must be clearly readable.',
  'lying-decline':
    'Side-on three-quarter view; the DECLINE angle and leg anchor must be clearly readable.',
  prone: 'Side-on view showing the full bench/pad and the athlete lying face down.',
  kneeling: 'Full body visible including knees and the pad/floor contact.',
  hanging:
    'Full body visible including the overhead bar/handles and hands on it; room above the bar.',
  supported: 'Whole athlete and the supporting pad/bench visible.',
  unknown: 'Whole athlete and all equipment visible.',
};

export const REFERENCE_RULES =
  'Reference images: the FIRST image is the exercise reference for this exact frame. ' +
  'Treat it as a strict structural blueprint — keep the same exercise, equipment type ' +
  'and placement, athlete orientation, stance, grip (pronated/supinated/neutral as ' +
  'shown), bench angle, seat position, cable/pulley height and attachment, bar and ' +
  'dumbbell positions, machine geometry, joint angles and approximately the same camera ' +
  'angle. Do NOT copy its visual style, background, lighting, clothing or the person. ' +
  'Re-shoot it in the visual system described here.';

export const IDENTITY_RULES =
  'The image labelled identity reference shows THE athlete of this library: match his ' +
  'face, hair, skin tone, physique, proportions and wardrobe exactly. Do not take pose or ' +
  'equipment from it.';

/** Hero frames reuse the re-shot start frame for athlete/set/light, but pick their own pose. */
export const HERO_PAIR_RULES =
  'The image labelled start frame is this same exercise already re-shot: keep the same ' +
  'athlete, wardrobe, set, lighting, camera position and equipment — only the body position ' +
  'changes, to the most recognisable mid-movement moment described here.';

export const PAIR_RULES =
  'The image labelled start frame is this same exercise already re-shot: keep everything ' +
  'identical — athlete, wardrobe, set, lighting, camera position, equipment and its ' +
  'placement — and change ONLY the limb/body positions to the end position of the movement.';

/** Always appended. Written as explicit prohibitions — models honour those best. */
export const NEGATIVE_CONSTRAINTS = [
  'no change to the exercise mechanics, equipment or setup compared with the reference',
  'no incorrect or swapped equipment (no Smith machine unless shown, no machine swap)',
  'no duplicated or extra equipment, no floating or detached plates',
  'no disconnected, slack-where-taut or wrongly routed cables; cable origin height exactly as referenced',
  'no bent bars, no impossible machine geometry',
  'no changed grip width or grip orientation; single-arm stays single-arm; split stance stays split',
  'no extra, missing, fused or malformed fingers or limbs; no anatomically impossible joints',
  'no exaggerated muscles or vascularity, no plastic or waxy skin, no HDR, no oversharpening',
  'no text, letters, numbers, labels, captions, watermarks, logos, brand marks or UI elements',
  'no other people, no mirrors, no clutter, no posters, no windows with busy scenery',
  'no coloured tint on the skin — the colour cast stays on the wall and rim light only',
];
