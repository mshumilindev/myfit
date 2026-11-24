/** The line under an exercise in a live session that was prescribed as a % of max. Drawn by the Periodization chunk; nothing until it has loaded. */
import { usePeriodizationHost } from './periodizationRt';
import type { Exercise, Workout } from './types';

export function PeriodizationTarget({ exercise }: { exercise: Exercise }) {
  const Line = usePeriodizationHost()?.TargetLine;
  return Line ? <Line exercise={exercise} /> : null;
}

/** "New max?" on the session summary; nothing until the chunk has loaded (and only after a test week). */
export function PeriodizationNewMax({ workout }: { workout: Workout }) {
  const NewMax = usePeriodizationHost()?.NewMaxCard;
  return NewMax ? <NewMax workout={workout} /> : null;
}
