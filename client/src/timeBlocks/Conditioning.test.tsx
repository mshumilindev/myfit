import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { Conditioning } from './Conditioning';

afterEach(cleanup);
const w = (blocks: Workout['blocks']): Workout => ({
  id: 'w',
  startedAt: 0,
  finishedAt: 1,
  autoFinished: false,
  exercises: [],
  blocks,
});
const logged = (min: number, rounds: number) => ({
  id: `b${min}`,
  spec: { fmt: 'amrap' as const, capSec: min * 60 },
  members: [{ name: 'Pullups' }],
  position: -0.5,
  run: { startedAt: 0, pausedMs: 0, pausedAt: null, finishedAt: min * 60000 },
  result: { rounds, savedAt: 1 },
});

describe('Conditioning', () => {
  it('adds up the logged blocks and says they are not muscle sets', () => {
    render(<Conditioning workouts={[w([logged(12, 7), logged(10, 5)]), w([logged(9, 4)])]} />);
    expect(screen.getByText('3 blocks · 31 min · 16 rounds')).toBeTruthy();
    expect(screen.getByText('Not counted in muscle sets.')).toBeTruthy();
  });
  it('shows nothing without a logged block', () => {
    render(<Conditioning workouts={[w(undefined)]} />);
    expect(screen.queryByTestId('conditioning')).toBeNull();
  });
});
