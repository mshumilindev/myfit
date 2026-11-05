/**
 * Savage (the red temper) is 18+ only (SPO-124). The app is 18+ at registration (Terms),
 * so an unknown date of birth is allowed; a known one under 18 is not.
 */
import { ageFromDob } from '../energy';

export const SAVAGE_MIN_AGE = 18;
/** The temper an under-18 user falls back to. */
export const UNDERAGE_TEMPER = 3 as const;

/** True when the date of birth shows the person is under 18. Unknown dob → false. */
export function isUnderSavageAge(
  dob: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (dob && new Date(dob).getTime() > now) return true; // a future date is a typo → be safe
  const age = ageFromDob(dob, now);
  return age !== null && age < SAVAGE_MIN_AGE;
}

/** Savage can be picked / spoken. */
export function savageAllowedFor(
  dob: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return !isUnderSavageAge(dob, now);
}

/** A temper capped for the person's age: Savage becomes Neutral under 18. */
export function capTemperForAge<T extends number>(
  temper: T,
  dob: string | null | undefined,
  now: number = Date.now(),
): T | typeof UNDERAGE_TEMPER {
  return temper === 5 && isUnderSavageAge(dob, now) ? UNDERAGE_TEMPER : temper;
}

/** A coach-settings patch with Savage taken out when the person is under 18. */
export function clampForAge<T extends { temper?: number }>(
  input: T,
  dob: string | null | undefined,
  now: number = Date.now(),
): T {
  return input.temper === 5 && isUnderSavageAge(dob, now)
    ? { ...input, temper: UNDERAGE_TEMPER, yoMama: false, swearing: false }
    : input;
}

/** Said when someone under 18 asks for Savage (en / uk; the chat answers in the user's language elsewhere). */
export const UNDERAGE_REPLY = (L: (en: string, uk: string) => string): string =>
  L(
    'Savage is 18+ only. I can stay Bro or Neutral.',
    'Жорсткий режим лише для 18+. Лишаюсь «Бро» або «Нейтральним».',
  );
