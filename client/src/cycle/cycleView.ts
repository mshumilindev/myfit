/** One read of "what does the Cycle say today", shared by every surface (pure; takes the store slices). */
import { dayOfTimestamp } from '../components/ui/calendarDays';
import type { ChronicCondition } from '../types';
import { cycleSuppressedBy, estimate, isStale, type CycleEstimate } from './cycleCore';
import type { CycleState } from './cycleState';

export type CycleToday =
  | { kind: 'off' }
  | { kind: 'paused'; why: 'pregnancy' | 'menopause' }
  | { kind: 'log' }
  | { kind: 'stale' }
  | { kind: 'ok'; est: CycleEstimate };

export function cycleToday(
  cycle: CycleState,
  conditions: readonly ChronicCondition[],
  now: number,
): CycleToday {
  if (!cycle.enabled || !cycle.settings) return { kind: 'off' };
  const why = cycleSuppressedBy(conditions, now);
  if (why) return { kind: 'paused', why };
  const s = cycle.settings;
  if (s.mode === 'log') return { kind: 'log' };
  const today = dayOfTimestamp(now);
  if (cycle.pendingDate || isStale(s, today)) return { kind: 'stale' };
  const est = estimate(s, today);
  return est ? { kind: 'ok', est } : { kind: 'stale' };
}
