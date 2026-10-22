import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../coach/testViewport';
import { StepConfirmDialog, type StepConfirmStepText } from './StepConfirmDialog';

afterEach(cleanup);

const steps: StepConfirmStepText[] = [
  { id: 'a', title: 'Delete account?', confirmLabel: 'Continue' },
  { id: 'b', title: 'Keep a copy?', confirmLabel: 'Continue' },
  {
    id: 'c',
    title: 'Type to confirm',
    confirmLabel: 'Delete',
    typeWord: 'DELETE',
    typeLabel: 'Type DELETE',
  },
];

describe('StepConfirmDialog', () => {
  it('walks the steps, locks the last until the word matches, then confirms once', () => {
    setViewport(1280);
    const onConfirm = vi.fn();
    render(
      <StepConfirmDialog
        steps={steps}
        cancelLabel="Cancel"
        progressLabel={(i, n) => `Step ${i} of ${n}`}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const dlg = () => screen.getByRole('alertdialog');
    expect(within(dlg()).getByText('Step 1 of 3')).toBeTruthy();
    fireEvent.click(within(dlg()).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(dlg()).getByRole('button', { name: 'Continue' }));
    const del = within(dlg()).getByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(del);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(within(dlg()).getByLabelText('Type DELETE'), { target: { value: 'delete' } });
    expect((del as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(del);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps Cancel and the action in one actions row; Esc cancels', () => {
    setViewport(1280);
    const onCancel = vi.fn();
    render(
      <StepConfirmDialog
        steps={steps.slice(0, 1)}
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const row = document.querySelector('.uicfx-act') as HTMLElement;
    expect(
      within(row)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cancel', 'Continue']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('is an alertdialog named by its title on a phone too', () => {
    setViewport(390);
    render(
      <StepConfirmDialog
        steps={steps.slice(0, 1)}
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alertdialog', { name: 'Delete account?' })).toBeTruthy();
  });
});
