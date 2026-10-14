import { describe, expect, it } from 'vitest';
import { buildFixtureWorld } from './fixtures';
import { setsFor } from './fixtureSets';

describe('fixture per-set detail', () => {
  it('has exactly the entry sets, 3 to 6 exercises, weights in 2.5 kg steps, deterministic', () => {
    const e = { id: 'w0-1', title: 'Lower A', sets: 14, tonnageKg: 15700 };
    const a = setsFor(e);
    expect(JSON.stringify(setsFor(e))).toBe(JSON.stringify(a));
    expect(a.reduce((n, x) => n + x.sets.length, 0)).toBe(14);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.length).toBeLessThanOrEqual(6);
    for (const x of a) for (const s of x.sets) expect(s.kg % 2.5).toBe(0);
    const t = a.reduce((n, x) => n + x.sets.reduce((m, s) => m + s.kg * s.reps, 0), 0);
    expect(Math.abs(t - 15700) / 15700).toBeLessThan(0.15);
  });
  it('every entry of every fixture client carries a set list that adds up', () => {
    const w = buildFixtureWorld();
    for (const h of Object.values(w.history ?? {})) {
      for (const e of h.workouts?.entries ?? []) {
        expect((e.exercises ?? []).reduce((n, x) => n + x.sets.length, 0)).toBe(e.sets);
      }
    }
  });
  it('no sets, no grid', () => {
    expect(setsFor({ id: 'x', title: 'Upper A', sets: 0, tonnageKg: 0 })).toEqual([]);
  });
});
