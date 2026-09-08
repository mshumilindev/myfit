/**
 * Resting-energy model. Sleep hours anchor the BMR baseline and the overnight
 * recovery burn, so daily expenditure and energy balance read honestly rather
 * than counting only active calories.
 */
import type { BodyMetrics } from './types';

/** Age in whole years from an ISO date of birth. */
export function ageFromDob(
  dob: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const n = new Date(now);
  let age = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Basal metabolic rate (kcal/day). Katch–McArdle when body-fat % is known
 * (most accurate), else Mifflin–St Jeor from sex/age/height/weight. Null when
 * we don't have enough to be honest.
 */
export function bmrKcal(
  bm: BodyMetrics | null | undefined,
  bodyKg: number | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!bm || !bodyKg || bodyKg <= 0) return null;
  const bf = bm.bodyFatPct;
  if (bf != null && bf > 0 && bf < 75) {
    const lean = bodyKg * (1 - bf / 100);
    return Math.round(370 + 21.6 * lean);
  }
  const cm = bm.heightCm;
  const age = ageFromDob(bm.dob, now);
  if (!cm || cm <= 0 || age == null || !bm.sex) return null;
  const base = 10 * bodyKg + 6.25 * cm - 5 * age;
  return Math.round(base + (bm.sex === 'male' ? 5 : -161));
}

/**
 * Energy burned across a night's sleep — the resting metabolic rate (~95% of
 * BMR) prorated over the hours actually slept.
 */
export function overnightKcal(durationMin: number, bmr: number | null): number | null {
  if (!bmr || durationMin <= 0) return null;
  return Math.round((bmr / 1440) * durationMin * 0.95);
}
