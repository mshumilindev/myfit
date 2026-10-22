import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Radio } from './Radio';
import userEvent from '@testing-library/user-event';

afterEach(cleanup);

describe('Radio', () => {
  it('is a real radio input reflecting checked', () => {
    render(<Radio checked onChange={() => undefined} aria-label="a" />);
    const r = screen.getByRole('radio', { name: 'a' }) as HTMLInputElement;
    expect(r.checked).toBe(true);
  });

  it('unchecked radio calls onChange on click', () => {
    const onChange = vi.fn();
    render(<Radio checked={false} onChange={onChange} aria-label="a" />);
    fireEvent.click(screen.getByRole('radio'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled radio is disabled in the DOM', () => {
    const onChange = vi.fn();
    render(<Radio checked={false} onChange={onChange} disabled aria-label="a" />);
    const r = screen.getByRole('radio') as HTMLInputElement;
    expect(r.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('maps tone and className and passes name/value through; ring is decorative', () => {
    const { container } = render(
      <Radio
        checked={false}
        onChange={() => undefined}
        tone="ok"
        className="x"
        name="g"
        value="1"
        aria-label="a"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uiradio');
    expect(root.className).toContain('uit--ok');
    expect(root.className).toContain('x');
    const r = screen.getByRole('radio') as HTMLInputElement;
    expect(r.name).toBe('g');
    expect(r.value).toBe('1');
    expect(container.querySelector('.uiradio-ring')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to the accent tone', () => {
    const { container } = render(<Radio checked={false} onChange={() => undefined} />);
    expect((container.firstChild as HTMLElement).className).toContain('uit--accent');
  });

  it('a user click on a disabled radio never fires onChange', async () => {
    const onChange = vi.fn();
    render(<Radio checked={false} onChange={onChange} disabled aria-label="a" />);
    await userEvent.setup().click(screen.getByRole('radio'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
