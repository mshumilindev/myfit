/**
 * SPO-639 W13: deterministic synthetic data for verifiers (browser/regression checks). Never real data (invariant 6).
 * Same seed → same output; ids are stable (idempotent upsert, invariant 3); the clock is fixed (Fri 2026-10-09 12:10 UTC).
 */
export const FIXED_NOW = Date.parse('2026-10-09T12:10:00Z');
const DAY = 86400000;
const LIFTS = ['barbell-back-squat', 'bench-press', 'deadlift', 'overhead-press', 'barbell-row'];
const ROLES = ['member', 'trainer', 'admin'];

/** mulberry32: tiny seeded PRNG. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildStand({ seed = 1, days = 56, members = 3 } = {}) {
  const r = rng(seed);
  const users = [
    ...ROLES.slice(1).map((role) => ({ id: `u-${role}`, role, email: `${role}@example.test` })),
    ...Array.from({ length: members }, (_, i) => ({
      id: `u-member-${i + 1}`,
      role: 'member',
      email: `member${i + 1}@example.test`,
    })),
  ];
  const workouts = [];
  for (const u of users.filter((x) => x.role === 'member')) {
    for (let d = days; d > 0; d--) {
      if (r() < 0.45) continue;
      const startedAt = FIXED_NOW - d * DAY + Math.floor(r() * 4) * 3600000;
      workouts.push({
        id: `${u.id}-w-${d}`,
        uid: u.id,
        startedAt,
        finishedAt: startedAt + (45 + Math.floor(r() * 30)) * 60000,
        exercises: LIFTS.slice(0, 3 + Math.floor(r() * 3)).map((exerciseId) => ({
          exerciseId,
          sets: Array.from({ length: 3 }, () => ({
            reps: 5 + Math.floor(r() * 6),
            weight: 40 + Math.floor(r() * 80),
            done: true,
          })),
        })),
      });
    }
  }
  const sleep = users
    .filter((x) => x.role === 'member')
    .flatMap((u) =>
      Array.from({ length: Math.min(days, 30) }, (_, i) => ({
        id: `${u.id}-s-${i}`,
        uid: u.id,
        night: FIXED_NOW - (i + 1) * DAY,
        hours: +(5.5 + r() * 3).toFixed(1),
      })),
    );
  return { seed, now: FIXED_NOW, users, workouts, sleep };
}
