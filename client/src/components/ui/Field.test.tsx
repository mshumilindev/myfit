import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Field } from './Field';

afterEach(cleanup);

describe('Field', () => {
  it('labels the input and defaults to the md size', () => {
    const { container } = render(<Field label="Name" />);
    expect(screen.getByLabelText('Name').tagName).toBe('INPUT');
    expect((container.firstChild as HTMLElement).className).toBe('uifield uifield--md');
  });

  it.each(['sm', 'lg'] as const)('size %s maps to a class', (size) => {
    const { container } = render(<Field size={size} />);
    expect((container.firstChild as HTMLElement).className).toContain(`uifield--${size}`);
  });

  it('passes input attributes and fires onChange', () => {
    const onChange = vi.fn();
    render(<Field label="Kg" placeholder="0" type="number" disabled={false} onChange={onChange} />);
    const input = screen.getByLabelText('Kg') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.placeholder).toBe('0');
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwards the ref to the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Field ref={ref} />);
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('error paints the ring, sets aria-invalid and announces as alert', () => {
    const { container } = render(<Field label="Name" error="Required" hint="Your name" />);
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.getByLabelText(/Name/).getAttribute('aria-invalid')).toBe('true');
    expect((container.firstChild as HTMLElement).className).toContain('uifield--err');
    expect(screen.queryByText('Your name')).toBeNull();
  });

  it('hint shows when there is no error and the input is not invalid', () => {
    render(<Field label="Name" hint="Your name" />);
    expect(screen.getByText('Your name').className).toBe('uifield-hint');
    expect(screen.getByLabelText(/Name/).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders lead and trail slots', () => {
    const { container } = render(<Field lead="$" trail="kg" />);
    expect(container.querySelector('.uifield-lead')?.textContent).toBe('$');
    expect(container.querySelector('.uifield-trail')?.textContent).toBe('kg');
  });

  it('bare adds the bare modifier and no label span without label', () => {
    const { container } = render(<Field bare className="x" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('uifield--bare');
    expect(root.className).toContain('x');
    expect(container.querySelector('.uifield-l')).toBeNull();
  });
});
