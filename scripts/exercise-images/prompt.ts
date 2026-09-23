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
  return `Attached images, in order: ${refs.map((r, i) => `#${i + 1} ${label[r]}`).join('; ')}.`;
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
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
