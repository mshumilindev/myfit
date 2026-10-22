import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog, Dialog, Sheet } from './Overlays';

afterEach(cleanup);

describe('Dialog', () => {
  it('is an alertdialog named by its title and described by its body', () => {
    render(
      <Dialog title="Discard?" actions={<button>Yes</button>} onClose={() => undefined}>
        Changes are lost.
      </Dialog>,
    );
    const d = screen.getByRole('alertdialog');
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Discard?' })).toBeTruthy();
    expect(d.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Changes are lost.')).toBeTruthy();
  });

  it('danger switches the tone to danger; an explicit tone wins', () => {
    const { unmount } = render(
      <Dialog title="t" danger actions={null} onClose={() => undefined}>
        b
      </Dialog>,
    );
    expect(screen.getByRole('alertdialog').className).toContain('danger');
    unmount();
    render(
      <Dialog title="t" danger tone="ok" actions={null} onClose={() => undefined}>
        b
      </Dialog>,
    );
    expect(screen.getByRole('alertdialog').className).not.toContain('danger');
  });

  it('closes on the scrim but not on a click inside the dialog', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="t" actions={<button>Yes</button>} onClose={onClose}>
        b
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.dialog-scrim') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  const base = {
    title: 'Delete?',
    body: 'Gone for good.',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep',
  };

  it('confirm and cancel call their handlers', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the optional checkbox and reports its change', () => {
    const onChange = vi.fn();
    render(
      <ConfirmDialog
        {...base}
        checkbox={{ label: 'Also delete notes', checked: false, onChange }}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByLabelText('Also delete notes'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the fine print when given', () => {
    render(
      <ConfirmDialog
        {...base}
        fineprint="This cannot be undone."
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });
});

describe('Sheet', () => {
  it('is a dialog named by `label`, and `alertdialog` when asked', () => {
    const { unmount } = render(
      <Sheet label="Pick a day" onClose={() => undefined}>
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Pick a day' })).toBeTruthy();
    unmount();
    render(
      <Sheet role="alertdialog" label="Sure?" onClose={() => undefined}>
        <p>content</p>
      </Sheet>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Sure?' })).toBeTruthy();
  });

  it('adds the toned classes and keeps a caller class', () => {
    render(
      <Sheet tone="ok" className="my-sheet" label="s" onClose={() => undefined}>
        <p>content</p>
      </Sheet>,
    );
    const el = screen.getByRole('dialog');
    expect(el.className).toContain('sheet--toned');
    expect(el.className).toContain('my-sheet');
  });

  it('moves focus into the drawer on open', () => {
    render(
      <Sheet label="s" onClose={() => undefined}>
        <p>content</p>
      </Sheet>,
    );
    const el = screen.getByRole('dialog');
    expect(el.contains(document.activeElement)).toBe(true);
  });
});

describe('Sheet drag with a mouse (desktop app)', () => {
  const setup = () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Sheet label="s" onClose={onClose}>
        body
      </Sheet>,
    );
    const grip = document.querySelector('.sheet-grip') as HTMLElement;
    grip.setPointerCapture = vi.fn();
    return { onClose, grip };
  };
  afterEach(() => vi.useRealTimers());

  it('pulling the grabber down with the mouse dismisses the drawer', () => {
    const { onClose, grip } = setup();
    fireEvent.pointerDown(grip, { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 0 });
    fireEvent.pointerMove(grip, { pointerId: 1, pointerType: 'mouse', clientY: 300 });
    fireEvent.pointerUp(grip, { pointerId: 1, pointerType: 'mouse', clientY: 300 });
    vi.advanceTimersByTime(300);
    expect(grip.setPointerCapture).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('touch pointers are left to the touch handlers (no double drag)', () => {
    const { onClose, grip } = setup();
    fireEvent.pointerDown(grip, { pointerId: 2, pointerType: 'touch', button: 0, clientY: 0 });
    fireEvent.pointerMove(grip, { pointerId: 2, pointerType: 'touch', clientY: 300 });
    fireEvent.pointerUp(grip, { pointerId: 2, pointerType: 'touch', clientY: 300 });
    vi.advanceTimersByTime(300);
    expect(grip.setPointerCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a click on the close button is not swallowed by the drag strip', () => {
    const { onClose } = setup();
    const x = screen.getByRole('button');
    const chrome = document.querySelector('.sheet-chrome') as HTMLElement;
    chrome.setPointerCapture = vi.fn();
    fireEvent.pointerDown(x, { pointerId: 3, pointerType: 'mouse', button: 0, clientY: 0 });
    expect(chrome.setPointerCapture).not.toHaveBeenCalled();
    fireEvent.click(x);
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
