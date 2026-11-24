import { afterEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import { warmupProposal } from './warmupFor';
import type { Gym } from './types';

afterEach(() => addonsPref.reset());

const gym = { id: 'g', name: 'G', inventory: ['dumbbell'] } as unknown as Gym;

describe('Equipment module off: the gym kit is not known, nothing is lost', () => {
  it('warm-up falls back to bodyweight without the module and uses the kit with it', () => {
    addonsPref.set([]);
    expect(warmupProposal({ muscles: ['shoulders', 'biceps'], gym } as never)?.station).toBe(
      'body',
    );
    expect(gym.inventory).toEqual(['dumbbell']);
    addonsPref.set(['equipment']);
    expect(warmupProposal({ muscles: ['shoulders', 'biceps'], gym } as never)?.station).toBe(
      'dumbbell',
    );
  });
});
