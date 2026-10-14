/**
 * The clock of the demo build (fixtures as the default ports): the fixture world is a fixed week (Wed 7 Oct 2026), so
 * its day stays put, but the TIME OF DAY is the real one in the viewer's zone, ticking with the real clock. Before this
 * the demo clock was "09:05 on 7 Oct, running on from page load", so the Now line sat at 09:30 while the viewer's wall
 * clock said 17:14.
 *
 * The result is an instant that reads as `anchor day` + the viewer's current wall-clock minute IN THE COACH ZONE (the
 * zone every Coach screen formats in), so the Now line, the "Now" divider and the clock chip all show the viewer's own
 * time. DST-safe: the minute comes from Intl in the viewer's zone, the instant from the schedule's `tsOf`.
 * Tests and stories do not use it (they keep deterministic clocks).
 */
import { MIN } from '../../domain/time';
import { dayOfTs, tsOf, wall } from '../../schedule/time';
import { FIXTURE_NOW } from './fixtures';

export interface DemoClockOptions {
  /** the fixture day to show; default: the day of FIXTURE_NOW in the Coach zone */
  anchor?: number;
  /** the real clock (injectable) */
  realNow?: () => number;
  /** the viewer's zone; default: this browser's */
  zone?: string;
}

const browserZone = (): string => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export function createDemoClock(o: DemoClockOptions = {}): () => number {
  const real = o.realNow ?? Date.now;
  return () => {
    const r = real();
    const day = o.anchor ?? dayOfTs(FIXTURE_NOW);
    const { min } = wall(r, o.zone ?? browserZone());
    return tsOf(day, min) + (((r % MIN) + MIN) % MIN);
  };
}
