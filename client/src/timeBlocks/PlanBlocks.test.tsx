import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanBlocks } from './BlockUi';

afterEach(cleanup);

describe('PlanBlocks (a program day on Today)', () => {
  it('shows each block in the long form with its moves', () => {
    render(
      <PlanBlocks
        blocks={[
          {
            id: 'b1',
            spec: { fmt: 'amrap', capSec: 720, targetRounds: 8 },
            members: [
              { name: 'Pullups', reps: '5' },
              { name: 'Pushups', reps: '10' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByTestId('plan-blocks')).toBeTruthy();
    expect(screen.getByText(/12 min/)).toBeTruthy();
    expect(screen.getByText('5 Pullups · 10 Pushups')).toBeTruthy();
  });
  it('draws nothing for a day without blocks', () => {
    render(<PlanBlocks blocks={[]} />);
    expect(screen.queryByTestId('plan-blocks')).toBeNull();
  });
});
