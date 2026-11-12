import { describe, expect, it, vi } from 'vitest';

const write = vi.fn();
vi.mock('../../../plannerRt', () => ({
  usePlannerShare: () => false,
  writePlannerShare: (on: boolean) => write(on),
}));

import { writeLocal } from './TrainerSharing';

describe('TrainerSharing: availability level', () => {
  it('full shares the availability, anything else stops it', () => {
    writeLocal('availability', 'full');
    expect(write).toHaveBeenLastCalledWith(true);
    writeLocal('availability', 'off');
    expect(write).toHaveBeenLastCalledWith(false);
  });
});
