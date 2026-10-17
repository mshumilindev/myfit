import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TimeField } from './TimeField';

afterEach(cleanup);

describe('TimeField', () => {
  it('is a time input in the Field well with the uitime class', () => {
    const { container } = render(<TimeField label="Start" defaultValue="07:30" />);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.type).toBe('time');
    expect(input.value).toBe('07:30');
    expect(container.querySelector('label')?.className).toContain('uitime');
    expect(container.querySelector('label')?.className).toContain('uifield');
  });

  it('size maps to the Field size class; default is md', () => {
    const { container, rerender } = render(<TimeField aria-label="t" />);
    expect(container.querySelector('label')?.className).toContain('uifield--md');
    rerender(<TimeField aria-label="t" size="sm" className="dense" />);
    const cls = container.querySelector('label')?.className ?? '';
    expect(cls).toContain('uifield--sm');
    expect(cls).toContain('dense');
  });

  it('fires onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<TimeField aria-label="t" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('t'), { target: { value: '21:15' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0].target as HTMLInputElement).value).toBe('21:15');
  });

  it('shows a leading icon, hint and error, and forwards the ref', () => {
    const ref = createRef<HTMLInputElement>();
    const { container, rerender } = render(
      <TimeField ref={ref} aria-label="t" lead={<i data-testid="lead" />} hint="24h" />,
    );
    expect(screen.getByTestId('lead').parentElement?.className).toContain('uifield-lead');
    expect(screen.getByText('24h')).toBeTruthy();
    expect(ref.current?.type).toBe('time');
    rerender(<TimeField aria-label="t" error="Required" />);
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(container.querySelector('.uifield--err')).not.toBeNull();
  });

  it('can be disabled', () => {
    render(<TimeField aria-label="t" disabled />);
    expect((screen.getByLabelText('t') as HTMLInputElement).disabled).toBe(true);
  });
});
