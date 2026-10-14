/** Fixture date helper: UTC month/day/hour/minute in 2026 (month is 1-based). */
export const D = (m: number, d: number, h = 18, min = 0): number =>
  Date.UTC(2026, m - 1, d, h, min);
