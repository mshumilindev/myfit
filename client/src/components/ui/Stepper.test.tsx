import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

afterEach(cleanup);
const steps = [
  { id: 'a', label: 'Terms' },
  { id: 'b', label: 'Your choices' },
];
const word = (n: number, t: number) => `Step ${n} of ${t}`;

describe('Stepper', () => {
  it('says which step this is, with its name', () => {
    render(<Stepper steps={steps} current={0} stepLabel={word} />);
    expect(screen.getByText('Step 1 of 2 · Terms')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Step 1 of 2' })).toBeTruthy();
  });

  it('fills finished and current segments only', () => {
    const { container, rerender } = render(<Stepper steps={steps} current={0} stepLabel={word} />);
    const seg = () =>
      Array.from(container.querySelectorAll('.uistep-bar i')).map((i) => i.className);
    expect(seg()).toEqual(['is-on', '']);
    rerender(<Stepper steps={steps} current={1} stepLabel={word} />);
    expect(seg()).toEqual(['is-done', 'is-on']);
    expect(screen.getByText('Step 2 of 2 · Your choices')).toBeTruthy();
  });
});
