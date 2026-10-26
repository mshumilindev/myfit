import { describe, expect, it } from 'vitest';
import { muscleFatigue } from './fatigue';
import type { Exercise, SetEntry, Workout } from './types';

/**
 * SPO-353 (SPO-66 style): invariants of the fatigue model over many seeded random training histories. No external
 * library: a fixed seed keeps every failure reproducible.
 */
const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 26, 12);
const LIFTS = [
  'Barbell Bench Press - Medium Grip',
  'Barbell Full Squat',
  'Pullups',
  'Barbell Curl',
  'Standing Military Press',
  'Romanian Deadlift',
  'Cable Crunch',
];

/** mulberry32: a tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function history(seed: number): Workout[] {
  const r = rng(seed);
  const n = Math.floor(r() * 25);
  return Array.from({ length: n }, (_, i) => {
    const startedAt = NOW - Math.floor(r() * 60 * DAY);
    const exercises: Exercise[] = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, j) => ({
      id: `e${i}-${j}`,
      name: LIFTS[Math.floor(r() * LIFTS.length)],
      position: j,
      sets: Array.from({ length: Math.floor(r() * 7) }, (_, k): SetEntry => ({
        id: `s${i}-${j}-${k}`,
        reps: 3 + Math.floor(r() * 12),
        weight: 20 + Math.floor(r() * 10) * 10,
        isWarmup: false,
        position: k,
        loggedAt: startedAt,
      })),
    }));
    return {
      id: `w${i}`,
      startedAt,
      finishedAt: startedAt + 3600000,
      autoFinished: false,
      exercises,
    };
  });
}

const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);

describe('muscleFatigue properties', () => {
  it('is deterministic: the same history and time give the same map', () => {
    for (const s of SEEDS) {
      const h = history(s);
      expect([...muscleFatigue(h, NOW)]).toEqual([...muscleFatigue(h, NOW)]);
    }
  });

  it('a muscle with no sets in the window is never above fresh (score 0)', () => {
    for (const s of SEEDS) {
      for (const m of muscleFatigue(history(s), NOW).values()) {
        if (m.sets <= 0) {
          expect(m.score).toBe(0);
          expect(m.level).toBe('fresh');
        }
      }
    }
  });

  it('never decreases the rest: more days without training never raises fatigue', () => {
    for (const s of SEEDS) {
      const h = history(s);
      let prev = muscleFatigue(h, NOW);
      for (const days of [1, 2, 4, 7, 14, 30]) {
        const next = muscleFatigue(h, NOW + days * DAY);
        for (const [muscle, m] of next) {
          expect(m.score).toBeLessThanOrEqual(prev.get(muscle)!.score + 1e-9);
        }
        prev = next;
      }
    }
  });

  it('after 8 days of rest nothing is high or fried, whatever the history', () => {
    for (const s of SEEDS) {
      for (const m of muscleFatigue(history(s), NOW + 8 * DAY).values()) {
        expect(['fresh', 'moderate']).toContain(m.level);
      }
    }
  });

  it('scores stay within 0..1', () => {
    for (const s of SEEDS) {
      for (const m of muscleFatigue(history(s), NOW).values()) {
        expect(m.score).toBeGreaterThanOrEqual(0);
        expect(m.score).toBeLessThanOrEqual(1);
      }
    }
  });
});
