// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkSheet } from './SkSheet';

afterEach(cleanup);

function Demo({
  onClose = () => {},
  open = true,
  ...rest
}: Partial<Parameters<typeof SkSheet>[0]>) {
  return (
    <>
      <button>opener</button>
      <SkSheet open={open} onClose={onClose} label="Remove Health?" {...rest}>
        <button>Cancel</button>
        <button>Remove</button>
      </SkSheet>
    </>
  );
}

describe('SkSheet', () => {
  it('renders nothing when closed', () => {
    render(<Demo open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('is a modal dialog with a name and a grabber', () => {
    const { container } = render(<Demo />);
    const d = screen.getByRole('dialog', { name: 'Remove Health?' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(container.querySelector('.sk-grab')?.getAttribute('aria-hidden')).toBe('true');
    expect(d.className).toContain('sk-sheet-auto');
  });
  it('maps variant and contained to classes', () => {
    render(<Demo variant="modal" contained />);
    const c = screen.getByRole('dialog').className;
    expect(c).toContain('sk-sheet-modal');
    expect(c).toContain('sk-sheet-in');
  });
  it('moves focus in on open and restores it on close', () => {
    const { rerender } = render(<Demo open={false} />);
    const opener = screen.getByText('opener');
    opener.focus();
    rerender(<Demo open />);
    expect(document.activeElement).toBe(screen.getByText('Cancel'));
    rerender(<Demo open={false} />);
    expect(document.activeElement).toBe(opener);
  });
  it('closes on Escape and on scrim click, unless the scrim is locked', () => {
    const on = vi.fn();
    const { rerender } = render(<Demo onClose={on} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(on).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('sk-scrim'));
    expect(on).toHaveBeenCalledTimes(2);
    rerender(<Demo onClose={on} dismissOnScrim={false} />);
    fireEvent.click(screen.getByTestId('sk-scrim'));
    expect(on).toHaveBeenCalledTimes(2);
  });
  it('traps Tab inside the dialog', () => {
    render(<Demo />);
    const d = screen.getByRole('dialog');
    const last = screen.getByText('Remove');
    last.focus();
    fireEvent.keyDown(d, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('Cancel'));
    fireEvent.keyDown(d, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
