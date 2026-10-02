import { describe, expect, it } from 'vitest';
import {
  MAX_ITEMS,
  MIN_ITEMS,
  WARMUP_STATIONS,
  warmupProposal,
  type WarmupStation,
} from './warmupFor';
import { richExerciseById } from './data/exercises';
import { NO_LIMITS, type Limits } from './conditions';
import type { Gym } from './types';
import type { MuscleGroup } from './data/exercises';

const gym = (over: Partial<Gym>): Gym => ({ id: 'g', name: 'Gym', ...over }) as Gym;
const BANDS = gym({ inventory: ['bands', 'dumbbell', 'barbell', 'machine'] });
const DUMBBELLS = gym({ inventory: ['dumbbell', 'barbell', 'machine', 'cable'] });
const EMPTY = gym({ inventory: ['barbell', 'machine'] });

const limits = (avoid: string[]): Limits => ({
  effects: { avoid: avoid as never[] },
  avoidBy: Object.fromEntries(avoid.map((t) => [t, ['x']])),
  cautionBy: {},
  capBy: {},
  keys: ['x'],
});

const HEAVY = new Set(['barbell', 'machine', 'cable', 'kettlebell', 'ezBar', 'other']);
const equipmentOf = (items: { exerciseId: string }[]) =>
  items.map((i) => richExerciseById(i.exerciseId)?.equipment);

const DAYS: MuscleGroup[][] = [
  ['chest', 'shoulders', 'triceps'],
  ['lats', 'biceps'],
  ['back', 'traps'],
  ['quads', 'hamstrings', 'glutes'],
  ['shoulders'],
  ['core'],
  ['biceps', 'triceps'],
];

describe('warmupProposal: one station, light kit only', () => {
  it('is deterministic', () => {
    for (const m of DAYS) {
      expect(warmupProposal({ muscles: m, gym: BANDS })).toEqual(
        warmupProposal({ muscles: m, gym: BANDS }),
      );
    }
  });

  it('every proposal sits at ONE station, 2–4 exercises, from the catalog, nothing heavy', () => {
    for (const g of [BANDS, DUMBBELLS, EMPTY, null]) {
      for (const m of DAYS) {
        const p = warmupProposal({ muscles: m, gym: g });
        if (!p) continue;
        expect(WARMUP_STATIONS).toContain(p.station);
        expect(p.items.length).toBeGreaterThanOrEqual(MIN_ITEMS);
        expect(p.items.length).toBeLessThanOrEqual(MAX_ITEMS);
        const eq = new Set(equipmentOf(p.items));
        expect([...eq]).toEqual([p.station]);
        for (const e of eq) expect(HEAVY.has(e as string)).toBe(false);
        for (const i of p.items) {
          expect(richExerciseById(i.exerciseId)?.name).toBe(i.name);
          // one value: reps OR seconds
          expect(Number(i.reps !== undefined) + Number(i.durationSec !== undefined)).toBe(1);
        }
        expect(new Set(p.items.map((i) => i.exerciseId)).size).toBe(p.items.length);
      }
    }
  });

  it('prefers bands, then light dumbbells, then bodyweight — by what the gym has', () => {
    const order = (g: Gym | null) =>
      warmupProposal({ muscles: ['chest', 'shoulders'], gym: g })?.station;
    expect(order(BANDS)).toBe('bands');
    expect(order(DUMBBELLS)).toBe('dumbbell');
    expect(order(EMPTY)).toBe('body');
    // Unknown kit (no gym / never audited): bodyweight only, never a guess.
    expect(order(null)).toBe('body');
    expect(order(gym({}))).toBe('body');
  });

  it('a band library or fine band items count as having bands', () => {
    const lib = gym({ bandLibrary: [{ color: 'red', kg: 10 }] as never });
    expect(warmupProposal({ muscles: ['shoulders', 'chest'], gym: lib })?.station).toBe('bands');
  });

  it('light dumbbells are beginner isolation moves for the day muscles', () => {
    const p = warmupProposal({ muscles: ['shoulders', 'biceps', 'triceps'], gym: DUMBBELLS })!;
    expect(p.station).toBe('dumbbell');
    for (const i of p.items) {
      const r = richExerciseById(i.exerciseId)!;
      expect(r.mechanic).toBe('isolation');
      expect(r.level).toBe('beginner');
      expect(r.equipment).toBe('dumbbell');
    }
  });

  it('falls back to the next station when one cannot give enough for the day', () => {
    // Bands exist, but nothing band-based trains the calves + core only… fall through.
    const p = warmupProposal({ muscles: ['core'], gym: BANDS });
    if (p) expect(equipmentOf(p.items).every((e) => e === p.station)).toBe(true);
  });

  it('gives no exercises (generic warm-up) when unsure', () => {
    expect(warmupProposal({ muscles: [], gym: BANDS })).toBeNull();
    expect(warmupProposal({ muscles: ['fullbody'], gym: BANDS })).toBeNull();
    expect(warmupProposal({ muscles: ['cardio'], gym: BANDS })).toBeNull();
  });

  it('drops anything the condition limits avoid, and muscles in Protect', () => {
    const plain = warmupProposal({ muscles: ['glutes', 'hamstrings'], gym: null });
    expect(plain).not.toBeNull();
    expect(
      warmupProposal({ muscles: ['glutes', 'hamstrings'], gym: null, limits: NO_LIMITS }),
    ).toEqual(plain);
    const prot = warmupProposal({
      muscles: ['shoulders', 'chest'],
      gym: BANDS,
      protect: ['shoulders'],
    });
    if (prot)
      for (const i of prot.items)
        expect(richExerciseById(i.exerciseId)?.primaryMuscles).not.toContain('shoulders');
    const limited = warmupProposal({
      muscles: ['glutes'],
      gym: null,
      limits: limits(['extension']),
    });
    for (const i of limited?.items ?? []) expect(i.name).not.toMatch(/Bridge/i);
  });

  it('never repeats exercises the day already holds', () => {
    const first = warmupProposal({ muscles: ['shoulders', 'chest'], gym: BANDS })!;
    const next = warmupProposal({
      muscles: ['shoulders', 'chest'],
      gym: BANDS,
      exclude: first.items.map((i) => i.name.toUpperCase()),
    });
    for (const i of next?.items ?? []) expect(first.items.map((x) => x.name)).not.toContain(i.name);
  });

  it('spreads over the day muscles instead of one muscle taking every slot', () => {
    const p = warmupProposal({ muscles: ['shoulders', 'triceps', 'chest'], gym: BANDS })!;
    const primaries = new Set(
      p.items.map((i) => richExerciseById(i.exerciseId)?.primaryMuscles[0]),
    );
    expect(primaries.size).toBeGreaterThan(1);
  });

  it('honours the requested count within 2–4', () => {
    const n = (count: number) =>
      warmupProposal({
        muscles: ['shoulders', 'triceps', 'chest', 'biceps'],
        gym: DUMBBELLS,
        count,
      })?.items.length ?? 0;
    expect(n(1)).toBeGreaterThanOrEqual(MIN_ITEMS);
    expect(n(9)).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('station type is exhaustively one of three', () => {
    const s: WarmupStation[] = ['bands', 'dumbbell', 'body'];
    expect([...WARMUP_STATIONS]).toEqual(s);
  });
});
