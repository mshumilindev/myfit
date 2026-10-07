import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { HoldDurationInput } from './HoldDurationInput';

describe('HoldDurationInput', () => {
  it('splits seconds into minutes and seconds and recombines on edit', () => {
    const onChange = vi.fn();
    const { container } = render(<HoldDurationInput seconds={150} onChange={onChange} />);
    const inputs = container.querySelectorAll('input');
    expect(inputs[0].value).toBe('2');
    expect(inputs[1].value).toBe('30');
    fireEvent.change(inputs[0], { target: { value: '3' } });
    fireEvent.blur(inputs[0]);
    expect(onChange).toHaveBeenLastCalledWith(210);
  });
});
