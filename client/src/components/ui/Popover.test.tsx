import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Popover, type PopoverProps } from './Popover';

afterEach(cleanup);

function Harness(props: Partial<PopoverProps>) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)}>
        trigger
      </button>
      <button>elsewhere</button>
      <Popover {...props} open={open} onClose={() => setOpen(false)} anchorRef={ref} label="Mode">
        <button>inside</button>
      </Popover>
    </>
  );
}

describe('Popover', () => {
  it('renders a labelled dialog in a portal and focuses it', () => {
    render(<Harness />);
    const dlg = screen.getByRole('dialog', { name: 'Mode' });
    expect(dlg.className).toContain('uipop');
    expect(document.activeElement).toBe(dlg);
  });

  it('Esc closes and returns focus to the trigger', () => {
    render(<Harness />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByText('trigger'));
  });

  it('an outside press closes; a press inside does not', () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByText('inside'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with a scrim, the scrim closes and the document press does not', () => {
    render(<Harness scrim="dim" arrow />);
    expect(screen.getByRole('dialog').className).toContain('uipop--arrow');
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('popover-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when closed', () => {
    const ref = { current: null };
    const { container } = render(
      <Popover open={false} onClose={() => undefined} anchorRef={ref}>
        x
      </Popover>,
    );
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('.uipop')).toBeNull();
  });

  it('uses the requested side class before it is measured', () => {
    render(<Harness side="right" />);
    expect(screen.getByRole('dialog').className).toMatch(/uipop--(right|left)/);
  });
});
