import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PinToggle } from './PinToggle';

afterEach(cleanup);

describe('PinToggle', () => {
  it('icon variant is a toggle button reflecting pinned', () => {
    const { rerender } = render(
      <PinToggle pinned={false} onToggle={() => undefined} label="Pin" />,
    );
    const btn = screen.getByRole('button', { name: 'Pin' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.className).toContain('uipin--icon');
    expect(btn.className).not.toContain('is-on');
    rerender(<PinToggle pinned onToggle={() => undefined} label="Unpin" />);
    const on = screen.getByRole('button', { name: 'Unpin' });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.className).toContain('is-on');
  });

  it('click toggles and does not bubble to a clickable parent', () => {
    const onToggle = vi.fn();
    const parent = vi.fn();
    render(
      <div onClick={parent}>
        <PinToggle pinned={false} onToggle={onToggle} label="Pin" variant="boxed" />
      </div>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('uipin--boxed');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
  });

  it('tone maps to a class, inherit adds none, default is accent', () => {
    const a = render(<PinToggle pinned onToggle={() => undefined} label="x" tone="ok" />);
    expect(screen.getByRole('button').className).toContain('uit--ok');
    a.unmount();
    const b = render(<PinToggle pinned onToggle={() => undefined} label="x" tone="inherit" />);
    expect(screen.getByRole('button').className).not.toContain('uit--');
    b.unmount();
    render(<PinToggle pinned onToggle={() => undefined} label="x" />);
    expect(screen.getByRole('button').className).toContain('uit--accent');
  });

  it('row variant shows the text and a labelled switch that toggles', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PinToggle
        variant="row"
        pinned={false}
        onToggle={onToggle}
        label="Pin Tennis"
        text="Pin to top"
        className="x"
      />,
    );
    expect(screen.getByText('Pin to top')).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('uipin-row');
    expect((container.firstChild as HTMLElement).className).toContain('x');
    const sw = screen.getByLabelText('Pin Tennis');
    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
