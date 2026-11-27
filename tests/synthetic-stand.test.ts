import { describe, expect, it } from 'vitest';
import { FIXED_NOW, buildStand } from '../scripts/lib/synthetic-stand.mjs';

describe('synthetic stand', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(buildStand({ seed: 7 })).toEqual(buildStand({ seed: 7 }));
    expect(buildStand({ seed: 7 }).workouts).not.toEqual(buildStand({ seed: 8 }).workouts);
  });
  it('has unique stable ids (idempotent upsert) and every role', () => {
    const s = buildStand();
    const ids = [...s.workouts, ...s.sleep, ...s.users].map((x: { id: string }) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(s.users.map((u: { role: string }) => u.role))).toEqual(
      new Set(['member', 'trainer', 'admin']),
    );
  });
  it('contains only reserved example.test emails and nothing in the future', () => {
    const s = buildStand();
    expect(s.users.every((u: { email: string }) => u.email.endsWith('@example.test'))).toBe(true);
    expect(s.workouts.every((w: { finishedAt: number }) => w.finishedAt <= FIXED_NOW)).toBe(true);
  });
  it('is rich enough to avoid empty states', () => {
    const s = buildStand();
    expect(s.workouts.length).toBeGreaterThan(30);
    expect(s.sleep.length).toBeGreaterThan(30);
  });
});
