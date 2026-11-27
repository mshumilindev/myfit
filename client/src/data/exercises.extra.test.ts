import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockReadyList } from '../timeBlocks/blockCatalog';
import { exerciseProfile } from './exerciseProfile';
import { exerciseDisplay } from './exerciseNames';
import {
  BUILT_IN_CATALOG,
  isBuiltInExercise,
  loadExerciseInstructions,
  muscleInfoByName,
  richExerciseByName,
} from './exercises';

const EXTRA = ['Burpee', 'Wall Ball', 'Toes To Bar'] as const;

describe('curated moves on top of the free-exercise-db import', () => {
  it('are catalogue moves with muscles and equipment', () => {
    for (const n of EXTRA) expect(isBuiltInExercise(n)).toBe(true);
    expect(muscleInfoByName('Burpee')).toMatchObject({ primary: 'quads', equipment: 'body' });
    expect(muscleInfoByName('Wall Ball')?.equipment).toBe('medicineBall');
    expect(muscleInfoByName('Toes To Bar')).toMatchObject({ primary: 'core' });
    expect(muscleInfoByName('Toes To Bar')?.secondary).toContain('lats');
  });

  it('have a stub photo pair on disk, so no tile is blank', () => {
    for (const n of EXTRA) {
      const imgs = richExerciseByName(n)!.images;
      expect(imgs).toHaveLength(2);
      for (const url of imgs)
        expect(existsSync(resolve(__dirname, '../../public', `.${url}`))).toBe(true);
    }
  });

  it('are named in every locale and described step by step', async () => {
    for (const loc of ['uk', 'pl', 'lt', 'et'] as const)
      for (const n of EXTRA) expect(exerciseDisplay(n, loc).primary.length).toBeGreaterThan(2);
    expect(exerciseDisplay('Burpee', 'uk').primary).toBe('Берпі');
    expect(exerciseDisplay('Wall Ball', 'pl').secondary).toBe('Wall Ball');
    for (const n of EXTRA) {
      const steps = await loadExerciseInstructions(richExerciseByName(n)!.id);
      expect(steps.length).toBeGreaterThanOrEqual(4);
    }
    // the import's own instructions still load next to them
    expect((await loadExerciseInstructions('Pushups')).length).toBeGreaterThan(0);
  });

  it('log as bodyweight or loaded reps, and the import keeps its own profiles', () => {
    expect(exerciseProfile('Burpee')).toEqual({ m: 'reps', l: 'bodyweight' });
    expect(exerciseProfile('Wall Ball')).toEqual({ m: 'reps', l: 'weight' });
    expect(exerciseProfile('Toes To Bar')).toEqual({ m: 'reps', l: 'bodyweight' });
    expect(exerciseProfile('Pullups').l).toBeDefined();
  });

  it('are offered in the block picker and keep the catalogue ids unique', () => {
    const ready = blockReadyList().map((r) => r.name);
    for (const n of EXTRA) expect(ready).toContain(n);
    const ids = BUILT_IN_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
