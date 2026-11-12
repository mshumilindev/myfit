/**
 * What the trainer sees of the person's availability (SPO-552 I10): free hours per weekday and the days they are not
 * available, nothing else. Never a reason: Unwell, Full rest and an injury's no-load window all read the same, "not available". Pure; the
 * result rides inside the sealed `meta/coachShare` doc like the other on-device views.
 */
import type { Injury, RestPeriod } from '../types';
import type { CoachAvailability } from '../plannerRt';
import { inFullRest } from '../injury';
import { overrides } from './availability';
import type { PlannerPrefs } from './types';

export function buildCoachAvailability(
  prefs: Pick<PlannerPrefs, 'shareAvailability' | 'availability'>,
  periods: readonly RestPeriod[],
  today: number,
  shown: (mode: RestPeriod['mode']) => boolean,
  /** Injuries as Health shows them (empty while its module is off). Only a clinician's no-load window counts. */
  injuries: readonly Injury[] = [],
): CoachAvailability | null {
  if (!prefs.shareAvailability) return null;
  const rest = injuries
    .filter((i) => i.healedDay == null && inFullRest(i, today))
    .map((i) => ({ fromDay: i.startDay, toDay: (i.fullRestUntil as number) - 1 }));
  const unavailable = [
    ...overrides(periods, today, shown).map((o) => ({ fromDay: o.startDay, toDay: o.endDay })),
    ...rest,
  ].sort((a, b) => a.fromDay - b.fromDay);
  return { weekly: prefs.availability, unavailable };
}
