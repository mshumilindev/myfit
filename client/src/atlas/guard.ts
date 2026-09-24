/**
 * The lines Atlas never crosses, enforced in code (not only in a prompt):
 *  - a hard temper (Drill, Merciless) is about effort only — never the body;
 *  - on a bad day (injury, illness, a short night, a long break) he speaks as
 *    Steady, whatever temper you picked.
 */
import type { Injury, RestPeriod, SleepNight, Workout } from '../types';
import { activeInjuries } from '../injury';
import { dayKey } from '../store';
import { finishedNights, nightDurationMin } from '../sleep';
import type { CoachFact, CoachSettings, Temper } from './types';
import { COMEBACK_DAYS } from './facts';

/** Nights shorter than this soften him for the day. */
export const SOFTEN_SLEEP_H = 5;
/** The temper a bad day falls back to. */
export const SOFT_TEMPER: Temper = 2;

export type SoftenReason = 'injury' | 'illness' | 'sleep' | 'comeback';

export interface GuardContext {
  injuries: Injury[];
  restPeriods: RestPeriod[];
  sleeps: SleepNight[];
  finished: Workout[];
  now: number;
}

/** Why today should be gentle (null = a normal day). */
export function softenReason(ctx: GuardContext): SoftenReason | null {
  const { injuries, restPeriods, sleeps, finished, now } = ctx;
  if (activeInjuries(injuries).length > 0) return 'injury';
  const today = dayKey(now);
  const ill = restPeriods.some(
    (r) => r.mode === 'illness' && r.startDay <= today && (r.open || r.endDay >= today),
  );
  if (ill) return 'illness';
  const night = finishedNights(sleeps, now)[0];
  if (night && now - (night.wake ?? 0) < 16 * 3600 * 1000) {
    if (nightDurationMin(night, now) / 60 < SOFTEN_SLEEP_H) return 'sleep';
  }
  const last = finished.reduce((m, w) => Math.max(m, w.startedAt), 0);
  if (last > 0 && (now - last) / 86_400_000 >= COMEBACK_DAYS) return 'comeback';
  return null;
}

/** The temper Atlas actually speaks in right now. */
export function effectiveTemper(settings: CoachSettings, ctx: GuardContext): Temper {
  if (settings.mutedUntil && settings.mutedUntil > ctx.now) return 1;
  const reason = softenReason(ctx);
  if (reason && settings.temper > SOFT_TEMPER) return SOFT_TEMPER;
  return settings.temper;
}

/** Facts a temper voices neutrally no matter what (the body is off-limits). */
export function neutralFact(fact: CoachFact): boolean {
  return fact.kind === 'bodyweight' || fact.kind === 'shortSleep';
}

/** Words a hard temper must never aim at the athlete (free-text chat check). */
const BODY_WORDS = [
  /\bfat\b/i,
  /\bobese\b/i,
  /\bugly\b/i,
  /\bskinny\b/i,
  /\bbelly\b/i,
  /\bchubby\b/i,
  /\bgross\b/i,
  /товст/i,
  /жирн/i,
  /пузо/i,
  /гидк/i,
  /потвор/i,
  /худющ/i,
];

/** False when a generated line talks about the body in a hard temper. */
export function lineAllowed(text: string, temper: Temper): boolean {
  if (temper < 4) return true;
  return !BODY_WORDS.some((re) => re.test(text));
}
