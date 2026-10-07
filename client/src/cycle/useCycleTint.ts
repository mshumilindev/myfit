/**
 * The soft phase tint for calendar days. Returns nothing unless the person turned the Cycle on,
 * no pregnancy / menopause pauses it, and the "Calendar tint" switch is on.
 */
import { useState } from 'react';
import { dayOfTimestamp } from '../components/ui/calendarDays';
import type { Tone } from '../components/ui/tones';
import { PHASE_TONE } from '../views/health/cycle/text';
import { useCycle, useStore } from '../store';
import { calendarPhase, cycleSuppressedBy } from './cycleCore';

export function useCycleTint(): ((day: number) => Tone | undefined) | null {
  const cycle = useCycle();
  const { conditions } = useStore();
  const [now] = useState(() => Date.now());
  const s = cycle.settings;
  if (!cycle.enabled || !s || !cycle.surfaces.calendar || cycleSuppressedBy(conditions, now))
    return null;
  const today = dayOfTimestamp(now);
  return (day) => {
    const ph = calendarPhase(s, day, today);
    return ph ? PHASE_TONE[ph] : undefined;
  };
}
