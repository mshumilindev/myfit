/**
 * Colour families shared by every kit primitive. Each maps to four tokens in
 * styles.css :root — base · tint · text · line — exposed to a primitive's CSS
 * as --t-base / --t-tint / --t-text / --t-line by the `uit--<tone>` class
 * (tones.css). Pick the family by meaning, never by look:
 *
 *   accent   gold — gym / conditioning, primary & selected states
 *   rest     blue — full rest, recovery activities
 *   active   teal — active recovery
 *   illness  amber
 *   injury   warm red (not the error red)
 *   sleep    violet
 *   sport    court green — sports activities
 *   ok / danger / kcal — status families
 *   neutral  greys
 */
import './tones.css';

export type Tone =
  | 'neutral'
  | 'accent'
  | 'rest'
  | 'active'
  | 'illness'
  | 'injury'
  | 'sleep'
  | 'sport'
  | 'ok'
  | 'danger'
  | 'kcal';

export const TONES: Tone[] = [
  'neutral',
  'accent',
  'rest',
  'active',
  'illness',
  'injury',
  'sleep',
  'sport',
  'ok',
  'danger',
  'kcal',
];

/** The class that binds --t-* to a family. */
export function toneClass(tone: Tone): string {
  return `uit--${tone}`;
}
