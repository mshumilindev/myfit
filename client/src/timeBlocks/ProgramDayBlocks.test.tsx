import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyDoc, dayBlocks, type ProgramDoc } from '../tools/programEditor';
import { ProgramDayBlocks } from './ProgramDayBlocks';

afterEach(cleanup);

function Harness({ start, readOnly = false }: { start: ProgramDoc; readOnly?: boolean }) {
  const [doc, setDoc] = useState(start);
  return (
    <>
      <ProgramDayBlocks doc={doc} day={1} readOnly={readOnly} edit={(fn) => setDoc((d) => fn(d))} />
      <output data-testid="count">{dayBlocks(doc, 1).length}</output>
    </>
  );
}
const withOne = (): ProgramDoc => ({
  ...emptyDoc('P'),
  blocks: [
    {
      id: 'b1',
      day: 1,
      position: 0,
      spec: { fmt: 'fortime', capSec: 900, scheme: [21, 15, 9] },
      members: [
        { name: 'Kettlebell Thruster', reps: '21' },
        { name: 'Pullups', reps: '21' },
      ],
    },
  ],
});

describe('time blocks of a program day', () => {
  it('shows the block with its format, numbers and members, and no add button when read only', () => {
    render(<Harness start={withOne()} readOnly />);
    const list = screen.getByTestId('program-blocks');
    expect(within(list).getByText(/For time/)).toBeTruthy();
    expect(within(list).getByText(/21 Kettlebell Thruster/)).toBeTruthy();
    expect(screen.queryByTestId('program-block-add')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete block' })).toBeNull();
  });

  it('shows nothing for a read-only day without blocks', () => {
    const { container } = render(<Harness start={emptyDoc('P')} readOnly />);
    expect(container.querySelector('[data-testid="program-blocks"]')).toBeNull();
  });

  it('has no button inside a button (edit and delete are siblings of the row, not nested in it)', () => {
    const { container } = render(<Harness start={withOne()} />);
    expect(container.querySelector('button button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete block' })).toBeTruthy();
  });

  it('opens the block for editing from the Edit button', async () => {
    render(<Harness start={withOne()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('button', { name: /Save|Add block/ })).toBeTruthy();
  });

  it('removes a block after a confirmation', async () => {
    render(<Harness start={withOne()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete block' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete block' }),
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('adds a block from a classic and keeps it on the day', async () => {
    render(<Harness start={emptyDoc('P')} />);
    await userEvent.click(screen.getByTestId('program-block-add'));
    await userEvent.click(await screen.findByRole('button', { name: /Cindy/ }));
    await userEvent.click(screen.getByRole('button', { name: /Add block/ }));
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(within(screen.getByTestId('program-blocks')).getByText(/Pullups/)).toBeTruthy();
  });
});
