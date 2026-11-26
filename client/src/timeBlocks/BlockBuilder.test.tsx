import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockBuilder } from './BlockBuilder';

afterEach(cleanup);

describe('BlockBuilder', () => {
  it('keeps Add block guarded until an exercise is added, then saves the numbers of the format', async () => {
    const onSave = vi.fn();
    render(
      <BlockBuilder onSave={onSave} onClose={vi.fn()} onPickExercise={(add) => add('Pullups')} />,
    );
    const d = screen.getByRole('dialog');
    await userEvent.click(within(d).getByRole('button', { name: 'Add block' }));
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.click(within(d).getByRole('button', { name: 'Add exercise' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Add block' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fmt: 'amrap', capSec: 720 }), [
      { name: 'Pullups' },
    ]);
  });

  it('a classic fills the format, numbers and exercises; tapping it again clears the pick', async () => {
    const onSave = vi.fn();
    render(<BlockBuilder onSave={onSave} onClose={vi.fn()} onPickExercise={vi.fn()} />);
    const d = screen.getByRole('dialog');
    await userEvent.click(within(d).getByRole('button', { name: 'Fran' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Add block' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ fmt: 'fortime', scheme: [21, 15, 9] });
    expect(onSave.mock.calls[0][1]).toHaveLength(2);
  });
});
