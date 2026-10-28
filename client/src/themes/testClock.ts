/**
 * Test clock (SPO-378): the holiday themes switch on by the real date (SPO-321), so a suite that is not about a
 * holiday must not depend on what day it runs. Call `offSeason()` at the top of such a file: `Date` is pinned to a
 * day outside every holiday window (timers stay real).
 */
import { afterEach, beforeEach, vi } from 'vitest';

export function offSeason() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
