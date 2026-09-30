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
 *   chronic  steel blue — long-term health conditions (private)
 *   sleep    violet
 *   sport    court green — sports activities
 *   ok / danger / kcal — status families
 *   apex / learn / atlas — sub-app families (Today widgets)
 *   gym / people — fixed identity of the Gym and People apps (app switcher); unlike
 *   `accent` they do not follow the active app's accent re-skin
 *   neutral  greys
 */
import './tones.css';
import './Text.css';
import './Layout.css';
import './States.css';

export type Tone =
  | 'neutral'
  | 'accent'
  | 'rest'
  | 'active'
  | 'illness'
  | 'injury'
  | 'chronic'
  | 'sleep'
  | 'sport'
  | 'ok'
  | 'danger'
  | 'kcal'
  | 'apex'
  | 'learn'
  | 'atlas'
  | 'gym'
  | 'people';

export const TONES: Tone[] = [
  'neutral',
  'accent',
  'rest',
  'active',
  'illness',
  'injury',
  'chronic',
  'sleep',
  'sport',
  'ok',
  'danger',
  'kcal',
  'apex',
  'learn',
  'atlas',
  'gym',
  'people',
];

/** The class that binds --t-* to a family. */
export function toneClass(tone: Tone): string {
  return `uit--${tone}`;
}
