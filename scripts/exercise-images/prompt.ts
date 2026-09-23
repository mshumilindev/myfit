/**
 * Deterministic prompt builder: structured exercise data + the versioned style
 * (style.ts) + the muscle palette → one prompt string. Same inputs always give
 * the same text (and hash), which is what makes resume/idempotency work.
 */
import type { CatalogExercise } from './catalog';
import type { ImageState } from './config';
import type { ResolvedPalette } from './palette';
import {
  ATHLETE,
  COMPOSITION_BASE,
  COMPOSITION_BY_POSITION,
  IDENTITY_RULES,
  NEGATIVE_CONSTRAINTS,
  HERO_PAIR_RULES,
  PAIR_RULES,
  PHOTOGRAPHY,
  PRIORITIES,
  PROMPT_VERSION,
  REFERENCE_RULES,
  WARDROBE,
} from './style';

/** What each reference image passed to the provider is, in order. */
export type RefRole = 'exercise' | 'identity' | 'start-frame';

export interface PromptInput {
  exercise: CatalogExercise;
  state: ImageState;
  palette: ResolvedPalette;
  /** Roles of the images that will be attached, in the order they're sent. */
  refs: RefRole[];
  /** Correction from the previous QA round, if any. */
  retryInstruction?: string | null;
  /**
   * describe = long photographic brief (API models) · edit = short numbered edit
   * instructions, which local instruction-edit models (Qwen-Image-Edit) follow far better.
   */
  style?: 'describe' | 'edit';
}

export interface BuiltPrompt {
  version: string;
  text: string;
}

const MUSCLE_WORDS: Record<string, string> = {
  quads: 'quadriceps',
  lats: 'latissimus dorsi',
  traps: 'trapezius',
  lower_back: 'lower back (erectors)',
  core: 'abdominals/core',
  fullbody: 'full body',
};
const word = (m: string) => MUSCLE_WORDS[m] ?? m.replace(/_/g, ' ');

const EQUIPMENT_WORDS: Record<string, string> = {
  body: 'bodyweight only (plus any bar/bench/station shown in the reference)',
  barbell: 'Olympic barbell with plates',
  dumbbell: 'dumbbells',
  kettlebell: 'kettlebell',
  cable: 'cable station (pulley + handle/attachment as shown)',
  machine: 'gym machine exactly as shown (selectorized or plate-loaded as in the reference)',
  bands: 'resistance band',
  medicineBall: 'medicine ball',
  exerciseBall: 'exercise (Swiss) ball',
  foamRoll: 'foam roller',
  ezBar: 'EZ curl bar',
  other: 'the specific equipment shown in the reference',
};

function stateLine(state: ImageState, ex: CatalogExercise): string {
  if (state === 'start')
    return 'Frame: the STARTING position of the movement, exactly as in the exercise reference.';
  if (state === 'end')
    return 'Frame: the END (contracted / finishing) position of the movement, exactly as in the exercise reference.';
  return (
    `Frame: HERO shot — the single most recognisable mid-movement moment of the ${ex.name} ` +
    '(roughly halfway between start and end, under visible effort). The exercise reference ' +
    'fixes the equipment, setup and grip; only the body position moves along the movement path.'
  );
}

function refLine(refs: RefRole[]): string {
  const label: Record<RefRole, string> = {
    exercise: 'exercise reference (pose/equipment blueprint)',
    identity: 'identity reference (the athlete)',
    'start-frame': 'start frame (already re-shot, keep everything but the pose)',
  };
  // "Picture N" is how Qwen-Image-Edit labels its inputs; other models read it just as well.
  return `Attached images, in order: ${refs.map((r, i) => `Picture ${i + 1} = ${label[r]}`).join('; ')}.`;
}

/** Short, imperative edit instructions for local edit models. */
function buildEditPrompt(input: PromptInput): BuiltPrompt {
  const { exercise: ex, state, palette, refs } = input;
  const pic = (role: RefRole) => `Picture ${refs.indexOf(role) + 1}`;
  const frame =
    state === 'start'
      ? 'the starting position'
      : state === 'end'
        ? 'the end (contracted) position'
        : 'the most recognisable mid-movement moment';
  const lines = [
    `Edit ${pic('exercise')} into a clean studio photo of the same exercise (${ex.name}, ${frame}).`,
    `1. Keep exactly as in ${pic('exercise')}: the movement, body position, grip, which arm/leg works, ` +
      'the equipment and its geometry, and the camera angle — if we see his back, still show his back; ' +
      'if we see his side, still his side.',
    refs.includes('identity')
      ? `2. The man must be the same person as in ${pic('identity')}: same face, hair, skin tone and physique.`
      : '2. The man: late 20s, athletic natural physique, short neat dark hair, clean-shaven face, no tattoos, no jewellery.',
    '3. Clothing — only three items: plain charcoal shorts, white crew socks, dark grey training shoes. SHIRTLESS: remove any tank top or shirt, bare torso. No logos.',
    `4. Replace the whole background: a plain seamless matte wall in dark desaturated ${palette.words} (${palette.wall}), ` +
      'dark rubber floor. Remove everything else from the wall and room — sockets, switches, posters, other equipment.',
    '5. Natural unshaved body hair: hairy legs, visible armpit hair, moderate chest hair.',
    '6. Raw true-to-life photograph, not a render: real skin with pores and a slight sweat sheen, ' +
      'soft studio key light from the front-left, subtle rim light, 50mm lens, sharp focus, high detail.',
    refs.includes('start-frame')
      ? `7. ${pic('start-frame')} is the start of this same exercise already edited: keep that athlete, clothes, set, light and camera identical — only the body position changes.`
      : '',
    ex.unilateral && !/alternat/i.test(ex.name)
      ? 'Single-side exercise: only one arm/leg works, as in the reference.'
      : '',
    input.retryInstruction ? `Fix: ${input.retryInstruction}` : '',
    'No text, no watermark, no extra people, no extra or missing limbs or fingers.',
  ].filter(Boolean);
  return { version: PROMPT_VERSION, text: lines.join('\n') };
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  if (input.style === 'edit') return buildEditPrompt(input);
  const { exercise: ex, state, palette, refs } = input;
  // First two steps describe setup/start; later ones describe the motion.
  const cues = ex.instructions.slice(0, state === 'end' ? 4 : 2).join(' ');
  const facts = [
    // Localized aliases stay out: they add noise to an English prompt (review search uses them).
    `Exercise: ${ex.name}.`,
    ex.category ? `Category: ${ex.category}.` : '',
    `Equipment: ${EQUIPMENT_WORDS[ex.equipment ?? 'other'] ?? ex.equipment}.`,
    ex.primary ? `Primary muscle: ${word(ex.primary)}.` : '',
    ex.secondary.length ? `Secondary: ${ex.secondary.map(word).join(', ')}.` : '',
    ex.bodyPosition !== 'unknown' ? `Body position: ${ex.bodyPosition.replace('-', ', ')}.` : '',
    ex.unilateral
      ? /alternat/i.test(ex.name)
        ? 'ALTERNATING exercise — one side works at a time while the other holds its position, exactly as in the reference.'
        : 'This is a UNILATERAL (single-side) exercise — only one arm/leg works, exactly as in the reference.'
      : '',
    ex.force ? `Movement type: ${ex.force}.` : '',
    cues ? `How it is performed (for mechanics only): ${cues}` : '',
  ].filter(Boolean);

  const colour =
    `Colour: the wall is a restrained, dark, desaturated ${palette.words} ` +
    `(about ${palette.wall}); ambient glow and rim light a touch of ${palette.glow}. ` +
    'Everything else neutral; skin tones stay natural.';

  const blocks = [
    PRIORITIES,
    refLine(refs),
    REFERENCE_RULES,
    refs.includes('identity') ? IDENTITY_RULES : '',
    refs.includes('start-frame') ? (state === 'hero' ? HERO_PAIR_RULES : PAIR_RULES) : '',
    stateLine(state, ex),
    facts.join(' '),
    ATHLETE,
    WARDROBE,
    PHOTOGRAPHY,
    colour,
    `${COMPOSITION_BASE} ${COMPOSITION_BY_POSITION[ex.bodyPosition]}`,
    input.retryInstruction
      ? `Correction from review — apply precisely: ${input.retryInstruction}`
      : '',
    `Must NOT contain: ${NEGATIVE_CONSTRAINTS.join('; ')}.`,
  ].filter(Boolean);

  return { version: PROMPT_VERSION, text: blocks.join('\n\n') };
}
