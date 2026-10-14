import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '../../coach/testViewport';
import { ConfirmDialog } from './Overlays';

afterEach(cleanup);

const base = {
  title: 'Delete set?',
  body: 'This removes the set.',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep',
};

describe('ConfirmDialog (R-KIT-02)', () => {
  it('is a centred dialog on a wide screen and a bottom sheet on a phone, both an alertdialog', () => {
    setViewport(1280);
    const { unmount } = render(
      <ConfirmDialog {...base} danger onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(document.querySelector('.dialog')).toBeTruthy();
    expect(document.querySelector('.sheet')).toBeNull();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    unmount();
    setViewport(390);
    render(<ConfirmDialog {...base} danger onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(document.querySelector('.sheet')).toBeTruthy();
    expect(screen.getByRole('alertdialog', { name: 'Delete set?' })).toBeTruthy();
  });

  it('confirm and cancel work; Esc cancels', () => {
    setViewport(1280);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} danger onConfirm={onConfirm} onCancel={onCancel} />);
    const dlg = screen.getByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a checkbox, fine print and a loading confirm that ignores a second tap', () => {
    setViewport(1280);
    const onConfirm = vi.fn();
    function Host() {
      const [on, setOn] = useState(false);
      return (
        <ConfirmDialog
          {...base}
          checkbox={{ label: 'Also delete my notes', checked: on, onChange: setOn }}
          fineprint="This cannot be undone."
          loading
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      );
    }
    render(<Host />);
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: 'Also delete my notes' });
    fireEvent.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
