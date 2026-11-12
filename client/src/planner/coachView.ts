/**
 * What the trainer sees of the person's availability (SPO-552 I10): free hours per weekday and the days they are not
 * available, nothing else. Never a reason: Unwell, Full rest and an injury all read the same, "not available". Pure; the
 * result rides inside the sealed `meta/coachShare` doc like the other on-device views.
 */
import type { RestPeriod } from '../types';
import type { CoachAvailability } from '../plannerRt';
import { overrides } from './availability';
import type { PlannerPrefs } from './types';

export function buildCoachAvailability(
  prefs: Pick<PlannerPrefs, 'shareAvailability' | 'availability'>,
  periods: readonly RestPeriod[],
  today: number,
  shown: (mode: RestPeriod['mode']) => boolean,
): CoachAvailability | null {
  if (!prefs.shareAvailability) return null;
  return {
    weekly: prefs.availability,
    unavailable: overrides(periods, today, shown).map((o) => ({
      fromDay: o.startDay,
      toDay: o.endDay,
    })),
  };
}
