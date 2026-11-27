import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockPicker } from './BlockPicker';

afterEach(cleanup);
const spec = { fmt: 'amrap', capSec: 720 } as const;

describe('BlockPicker', () => {
  it('lists block-ready moves, filters by how they are done, and marks the added ones', async () => {
    const onPick = vi.fn();
    render(<BlockPicker spec={spec} added={['Pullups']} onPick={onPick} onClose={vi.fn()} />);
    expect(screen.getByText('Block-ready exercises')).toBeTruthy();
    expect(screen.getByText('Added')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Kettlebell' }));
    expect(screen.queryByText('Pushups')).toBeNull();
    expect(screen.getByText('Kettlebell Thruster')).toBeTruthy();
    await userEvent.click(screen.getByText('Kettlebell Thruster'));
    expect(onPick).toHaveBeenCalledWith('Kettlebell Thruster');
  });

  it('adds an own move by name', async () => {
    const onPick = vi.fn();
    render(<BlockPicker spec={spec} added={[]} onPick={onPick} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'Rope climb');
    await userEvent.click(screen.getByText(/Add “Rope climb”/));
    expect(onPick).toHaveBeenCalledWith('Rope climb');
  });
});

import { blockReadyList } from './blockCatalog';
describe('block-ready list', () => {
  it('only names the catalogue really has, no duplicates', () => {
    const l = blockReadyList();
    expect(l.length).toBeGreaterThan(80);
    expect(new Set(l.map((i) => i.name)).size).toBe(l.length);
  });
});
