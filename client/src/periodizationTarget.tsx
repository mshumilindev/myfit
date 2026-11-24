/** The line under an exercise in a live session that was prescribed as a % of max. Drawn by the Periodization chunk; nothing until it has loaded. */
import { usePeriodizationHost } from './periodizationRt';
import type { Exercise } from './types';

export function PeriodizationTarget({ exercise }: { exercise: Exercise }) {
  const Line = usePeriodizationHost()?.TargetLine;
  return Line ? <Line exercise={exercise} /> : null;
}
