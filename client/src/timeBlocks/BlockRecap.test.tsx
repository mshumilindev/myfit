import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import type { Workout } from '../types';
import { BlockRecap } from './BlockRecap';

const w = (blocks: Workout['blocks']): Workout => ({
  id: 'w',
  startedAt: 1,
  finishedAt: 2,
  autoFinished: false,
  exercises: [],
  blocks,
});
beforeEach(() => addonsPref.set(['advanced-training', 'time-blocks']));
afterEach(() => {
  addonsPref.reset();
  cleanup();
});

describe('BlockRecap (trainer, read-only)', () => {
  it('lists logged blocks without edit or delete', () => {
    render(
      <BlockRecap
        workout={w([
          {
            id: 'b',
            spec: { fmt: 'amrap', capSec: 720 },
            members: [{ name: 'Pullups', reps: '5' }],
            position: 0,
            result: { rounds: 7, extraReps: 2, savedAt: 1 },
          },
          { id: 'c', spec: { fmt: 'emom', everySec: 60, rounds: 10 }, members: [], position: 1 },
        ])}
      />,
    );
    expect(screen.getAllByTestId('block-logged')).toHaveLength(1); // the unlogged one is not shown
    expect(screen.getByText('7 rounds + 2')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing for a session without blocks', () => {
    const { container } = render(<BlockRecap workout={w(undefined)} />);
    expect(container.firstChild).toBeNull();
  });
});
